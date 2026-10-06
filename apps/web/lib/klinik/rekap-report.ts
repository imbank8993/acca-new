/**
 * Membangun dokumen HTML Rekap Bulanan Klinik Pembelajaran — laporan kolektif
 * seluruh guru yang melaksanakan sesi klinik pada satu bulan.
 *
 * Dilengkapi dengan:
 * 1. Tabel utama rekapitulasi sesi per guru pengampu.
 * 2. Blok pengesahan digital resmi oleh WKM Bidang Akademik dengan QR Code verifikasi.
 * 3. Lampiran I: Daftar hadir (absensi) lengkap setiap sesi klinik.
 * 4. Lampiran II: Foto dokumentasi kegiatan klinik pembelajaran.
 */
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { renderKopHTML, KOP_CSS, kotaKedudukan } from '@/lib/lckh/print-shared';
import { getPublicOrigin } from '@/lib/public-url';

export const BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtTanggalPendek(d?: string | Date | null): string {
    if (!d) return '-';
    try {
        const dateObj = typeof d === 'string' ? new Date(d.includes('T') ? d : `${d}T12:00:00`) : d;
        return dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return '-';
    }
}

function fmtTanggalPanjang(d: Date): string {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function jam(v?: string | Date | null): string {
    if (!v) return '';
    if (v instanceof Date) {
        return v.toISOString().slice(11, 16);
    }
    const s = String(v).trim();
    if (s.includes('T')) return (s.split('T')[1] || '').slice(0, 5);
    return s.slice(0, 5);
}

async function generateQrDataUrl(data: string): Promise<string> {
    try {
        return await QRCode.toDataURL(data, { errorCorrectionLevel: 'M', margin: 1, width: 160 });
    } catch {
        return '';
    }
}

export interface RekapKlinikInput {
    bulan: number | string;
    tahun: number | string;
    /** true (default): hanya sesi yang laporannya sudah disahkan. */
    hanyaDisetujui?: boolean;
    /** Origin host untuk QR Code verifikasi */
    origin?: string;
}

export type RekapKlinikResult =
    | { ok: true; html: string; jumlahSesi: number; jumlahGuru: number; jumlahFoto: number }
    | { ok: false; error: string; status: number };

interface BarisSesi {
    tanggal: string;
    mapel: string;
    topik: string;
    ruangan: string;
    peserta: number;
    hadir: number;
    statusLaporan: string;
    lampiran: string;
    jumlahFoto: number;
}

interface FotoLampiran {
    nomor: number;
    url: string;
    guru: string;
    mapel: string;
    tanggal: string;
}

interface SesiAbsensiPeserta {
    no: number;
    nama: string;
    kelas: string;
    hadir: boolean;
    waktuHadir: string;
}

interface SesiAbsensiItem {
    nomor: number;
    id: string;
    tanggalText: string;
    jamText: string;
    mapel: string;
    topik: string;
    ruangan: string;
    guruNama: string;
    guruNip: string;
    materiText: string;
    peserta: SesiAbsensiPeserta[];
    totalPeserta: number;
    totalHadir: number;
}

export async function buildRekapKlinik(input: RekapKlinikInput): Promise<RekapKlinikResult> {
    const bulan = Number(input.bulan);
    const tahun = Number(input.tahun);
    const hanyaDisetujui = input.hanyaDisetujui !== false;

    if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12 || !Number.isInteger(tahun)) {
        return { ok: false, error: 'Bulan/tahun tidak valid', status: 400 };
    }

    // Rentang tanggal bulan tsb (akhir bulan dihitung dari hari ke-0 bulan berikutnya).
    const awalDate = new Date(Date.UTC(tahun, bulan - 1, 1, 0, 0, 0));
    const akhirDate = new Date(Date.UTC(tahun, bulan, 0, 23, 59, 59, 999));

    try {
        const slots = await prisma.klinik_slots.findMany({
            where: {
                tanggal: { gte: awalDate, lte: akhirDate },
                status: { in: ['finished', 'paid'] }
            },
            include: {
                klinik_peserta: true,
                klinik_laporan: true
            },
            orderBy: { tanggal: 'asc' }
        });

        const terpakai = (slots || []).filter((s: any) => {
            const lap = Array.isArray(s.klinik_laporan) ? s.klinik_laporan[0] : s.klinik_laporan;
            return hanyaDisetujui ? lap?.status === 'Approved' : Boolean(lap);
        });

        const profil = await prisma.profil_sekolah.findFirst();

        const guruIds = [...new Set(terpakai.map((s: any) => Number(s.guru_id)).filter(Boolean))];
        const nipMap = new Map<number, string>();
        if (guruIds.length > 0) {
            const guruRows = await (prisma as any).public_users.findMany({
                where: { id: { in: guruIds } },
                select: { id: true, nip: true }
            });
            for (const g of guruRows || []) nipMap.set(Number(g.id), g.nip || '-');
        }

        const perGuru = new Map<string, { nama: string; nip: string; sesi: BarisSesi[] }>();
        const fotoLampiran: FotoLampiran[] = [];

        // 1. Kumpulkan sesi per guru & daftar foto
        for (const s of terpakai as any[]) {
            const kunci = String(s.guru_id ?? s.nama_guru);
            if (!perGuru.has(kunci)) {
                perGuru.set(kunci, {
                    nama: s.nama_guru || '-',
                    nip: nipMap.get(Number(s.guru_id)) || '-',
                    sesi: [],
                });
            }
            const lap = Array.isArray(s.klinik_laporan) ? s.klinik_laporan[0] : s.klinik_laporan;
            const fotos: string[] = ((lap?.foto_bukti as string[]) || []).filter(Boolean);

            const nomorAwal = fotoLampiran.length + 1;
            for (const url of fotos) {
                fotoLampiran.push({
                    nomor: fotoLampiran.length + 1,
                    url,
                    guru: s.nama_guru || '-',
                    mapel: s.mapel || '-',
                    tanggal: fmtTanggalPendek(s.tanggal),
                });
            }
            const nomorAkhir = fotoLampiran.length;

            perGuru.get(kunci)!.sesi.push({
                tanggal: `${fmtTanggalPendek(s.tanggal)}<br/><span class="c-jam">${esc(jam(s.jam_mulai))}–${esc(jam(s.jam_selesai))}</span>`,
                mapel: s.mapel || '-',
                topik: s.topik || '-',
                ruangan: s.ruangan || '-',
                peserta: (s.klinik_peserta || []).length,
                hadir: (s.klinik_peserta || []).filter((p: any) => p.kehadiran === 'H').length,
                statusLaporan: lap?.status || 'Draft',
                lampiran: fotos.length === 0
                    ? '-'
                    : fotos.length === 1 ? `${nomorAwal}` : `${nomorAwal}–${nomorAkhir}`,
                jumlahFoto: fotos.length,
            });
        }

        // 2. Kumpulkan daftar absensi per sesi untuk Lampiran I
        const sesiAbsensiList: SesiAbsensiItem[] = (terpakai as any[]).map((s, idx) => {
            const rawPeserta = (s.klinik_peserta || []) as any[];
            const sorted = [...rawPeserta].sort((a, b) =>
                (a.nama_siswa || '').localeCompare(b.nama_siswa || '', 'id-ID')
            );
            const lap = Array.isArray(s.klinik_laporan) ? s.klinik_laporan[0] : s.klinik_laporan;

            const pesertaFormatted: SesiAbsensiPeserta[] = sorted.map((p, pIdx) => {
                let waktuHadir = '-';
                if (p.kehadiran === 'H') {
                    if (p.kehadiran_at) {
                        try {
                            const dt = new Date(p.kehadiran_at);
                            waktuHadir = dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
                        } catch {
                            waktuHadir = 'Hadir';
                        }
                    } else {
                        waktuHadir = 'Hadir';
                    }
                }
                return {
                    no: pIdx + 1,
                    nama: p.nama_siswa || '-',
                    kelas: p.kelas || '-',
                    hadir: p.kehadiran === 'H',
                    waktuHadir,
                };
            });

            const totalHadirSesi = pesertaFormatted.filter(p => p.hadir).length;

            return {
                nomor: idx + 1,
                id: s.id,
                tanggalText: fmtTanggalPanjang(new Date(s.tanggal)),
                jamText: `${jam(s.jam_mulai)} – ${jam(s.jam_selesai)} WIB`,
                mapel: s.mapel || '-',
                topik: s.topik || '-',
                ruangan: s.ruangan || '-',
                guruNama: s.nama_guru || '-',
                guruNip: nipMap.get(Number(s.guru_id)) || '-',
                materiText: lap?.materi_disampaikan || '',
                peserta: pesertaFormatted,
                totalPeserta: pesertaFormatted.length,
                totalHadir: totalHadirSesi,
            };
        });

        const daftarGuru = [...perGuru.values()].sort((a, b) => a.nama.localeCompare(b.nama));
        const totalSesi = daftarGuru.reduce((n, g) => n + g.sesi.length, 0);
        const totalPeserta = daftarGuru.reduce((n, g) => n + g.sesi.reduce((m, s) => m + s.peserta, 0), 0);
        const totalHadir = daftarGuru.reduce((n, g) => n + g.sesi.reduce((m, s) => m + s.hadir, 0), 0);

        const kota = kotaKedudukan(profil);
        const hariIni = fmtTanggalPanjang(new Date());
        const periode = `${BULAN[bulan - 1]} ${tahun}`;

        // QR Code & Verification link
        const verifyCode = `KLN-REKAP-${tahun}${String(bulan).padStart(2, '0')}`;
        const baseOrigin = getPublicOrigin(input.origin);
        const verifyUrl = `${baseOrigin}/klinik/verify/rekap?bulan=${bulan}&tahun=${tahun}${hanyaDisetujui ? '&sah=1' : ''}`;
        const qrDataUrl = await generateQrDataUrl(verifyUrl);

        let no = 0;
        const rowsHtml = daftarGuru.map(g => {
            no += 1;
            return g.sesi.map((s, i) => {
                const kolomGuru = i === 0
                    ? `<td class="c-no" rowspan="${g.sesi.length}">${no}</td>
               <td class="c-guru" rowspan="${g.sesi.length}">${esc(g.nama)}<div class="c-nip">NIP. ${esc(g.nip)}</div></td>`
                    : '';
                return `
            <tr>
              ${kolomGuru}
              <td class="c-tgl">${s.tanggal}</td>
              <td class="c-mapel">${esc(s.mapel)}</td>
              <td class="c-topik">${esc(s.topik)}</td>
              <td class="c-ruang">${esc(s.ruangan)}</td>
              <td class="c-peserta">${s.hadir}/${s.peserta}</td>
              <td class="c-lampiran">${s.lampiran}</td>
            </tr>`;
            }).join('');
        }).join('');

        // 3. Lampiran I: Daftar Hadir Absensi Setiap Sesi
        const lampiranAbsensiHtml = sesiAbsensiList.length === 0 ? '' : `
      <div class="lampiran-page">
        <div class="doc-title"><h1>LAMPIRAN I: DAFTAR HADIR PESERTA SETIAP SESI</h1></div>
        <div class="doc-sub">Rekapitulasi Pelaksanaan Klinik Pembelajaran — <strong>${esc(periode)}</strong></div>

        <div class="sesi-container">
          ${sesiAbsensiList.map(sesi => `
          <div class="sesi-card">
            <div class="sesi-card-head">
              <div class="sesi-card-title">
                <span class="sesi-pill">Sesi #${sesi.nomor}</span>
                <span class="sesi-mapel">${esc(sesi.mapel)}</span>
              </div>
              <div class="sesi-card-badge">
                Kehadiran: <strong>${sesi.totalHadir} / ${sesi.totalPeserta} Siswa</strong>
              </div>
            </div>

            <table class="sesi-info-table">
              <tbody>
                <tr>
                  <td class="sit-lbl">Guru Pengampu</td>
                  <td class="sit-sep">:</td>
                  <td class="sit-val"><strong>${esc(sesi.guruNama)}</strong> ${sesi.guruNip && sesi.guruNip !== '-' ? `<span class="c-nip">(NIP. ${esc(sesi.guruNip)})</span>` : ''}</td>
                  <td class="sit-lbl">Waktu &amp; Tanggal</td>
                  <td class="sit-sep">:</td>
                  <td class="sit-val">${esc(sesi.tanggalText)}, ${esc(sesi.jamText)}</td>
                </tr>
                <tr>
                  <td class="sit-lbl">Topik Pembelajaran</td>
                  <td class="sit-sep">:</td>
                  <td class="sit-val">${esc(sesi.topik)}</td>
                  <td class="sit-lbl">Ruangan</td>
                  <td class="sit-sep">:</td>
                  <td class="sit-val">${esc(sesi.ruangan)}</td>
                </tr>
                ${sesi.materiText ? `
                <tr>
                  <td class="sit-lbl">Materi Disampaikan</td>
                  <td class="sit-sep">:</td>
                  <td class="sit-val" colspan="4"><em>${esc(sesi.materiText)}</em></td>
                </tr>
                ` : ''}
              </tbody>
            </table>

            <table class="absen-table">
              <thead>
                <tr>
                  <th style="width: 6%;">No</th>
                  <th style="width: 44%;">Nama Siswa</th>
                  <th style="width: 18%;">Kelas</th>
                  <th style="width: 16%;">Kehadiran</th>
                  <th style="width: 16%;">Waktu Presensi</th>
                </tr>
              </thead>
              <tbody>
                ${sesi.peserta.length > 0 ? sesi.peserta.map(p => `
                <tr>
                  <td style="text-align: center;">${p.no}</td>
                  <td><strong>${esc(p.nama)}</strong></td>
                  <td style="text-align: center;">${esc(p.kelas)}</td>
                  <td style="text-align: center;">
                    ${p.hadir
                        ? '<span class="badge-hadir">HADIR</span>'
                        : '<span class="badge-absen">TIDAK HADIR</span>'}
                  </td>
                  <td style="text-align: center;">${esc(p.waktuHadir)}</td>
                </tr>
                `).join('') : `
                <tr>
                  <td colspan="5" style="text-align: center; color: #64748b; font-style: italic; padding: 8px;">
                    Tidak ada peserta terdaftar pada sesi ini
                  </td>
                </tr>
                `}
              </tbody>
            </table>
          </div>
          `).join('')}
        </div>
      </div>`;

        // 4. Lampiran II: Foto Dokumentasi
        const lampiranFotoHtml = fotoLampiran.length === 0 ? '' : `
      <div class="lampiran-page">
        <div class="doc-title"><h1>${sesiAbsensiList.length > 0 ? 'LAMPIRAN II: FOTO DOKUMENTASI KEGIATAN' : 'LAMPIRAN: FOTO DOKUMENTASI KEGIATAN'}</h1></div>
        <div class="doc-sub">Rekapitulasi Pelaksanaan Klinik Pembelajaran — <strong>${esc(periode)}</strong></div>
        <div class="foto-grid">
          ${fotoLampiran.map(f => `
          <div class="foto-item">
            <img src="${esc(f.url)}" alt="Dokumentasi ${f.nomor}" />
            <div class="foto-caption">
              <div class="foto-nomor">Foto ${f.nomor} — ${esc(f.mapel)}</div>
              <div class="foto-meta">${esc(f.guru)} &middot; ${esc(f.tanggal)}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>`;

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Rekap Klinik Pembelajaran - ${esc(periode)}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 15mm 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10pt; color: #000; line-height: 1.35; }
  .page { padding: 0; }
  @media print { .page { padding: 0; } }
  ${KOP_CSS}
  .kop { position: relative; display: block; }
  .kop-logo { position: absolute; left: 0; top: 0; margin: 0; }
  .kop-text { width: 100%; }
  .doc-title { text-align: center; margin: 12px 0 4px; }
  .doc-title h1 { font-size: 12pt; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 0.5px; font-weight: bold; }
  .doc-sub { text-align: center; font-size: 10pt; margin-bottom: 12px; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 9.5pt; }
  .meta-table td { padding: 1px 0; vertical-align: top; }
  .meta-table td:first-child { width: 160px; font-weight: 500; }
  .meta-table td:nth-child(2) { width: 12px; }
  table.entries { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.entries th, table.entries td { border: 1px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; }
  table.entries th { background: #f1f5f9; font-weight: bold; text-align: center; font-size: 8.5pt; }
  table.entries tr { page-break-inside: avoid; }
  .c-no { text-align: center; width: 4%; vertical-align: middle; }
  .c-guru { width: 22%; font-weight: bold; vertical-align: middle; }
  .c-nip { font-weight: normal; font-size: 7.5pt; color: #555; margin-top: 1px; }
  .c-tgl { width: 13%; white-space: nowrap; }
  .c-jam { font-size: 7.5pt; color: #555; }
  .c-mapel { width: 14%; }
  .c-topik { width: 25%; }
  .c-ruang { width: 10%; text-align: center; font-size: 8pt; }
  .c-peserta { width: 9%; text-align: center; white-space: nowrap; font-weight: bold; }
  .c-lampiran { width: 7%; text-align: center; white-space: nowrap; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .kosong { text-align: center; padding: 14px; font-style: italic; color: #555; }

  /* Pengesahan WKM Akademik */
  .pengesahan-container { margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
  .pengesahan-card { border: 1.5px solid #2563eb; border-radius: 8px; padding: 10px 14px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 14px; }
  .pengesahan-left { flex: 1; }
  .pengesahan-kota-tgl { font-size: 8.5pt; color: #475569; margin-bottom: 3px; }
  .pengesahan-badge { display: inline-flex; align-items: center; gap: 4px; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 999px; font-size: 8pt; font-weight: bold; margin-bottom: 4px; }
  .pengesahan-pejabat { font-size: 10pt; color: #0f172a; margin-bottom: 3px; }
  .pengesahan-desc { font-size: 7.5pt; color: #64748b; line-height: 1.35; max-width: 440px; }
  .pengesahan-right { display: flex; flex-direction: column; align-items: center; text-align: center; flex-shrink: 0; }
  .verify-qr-box { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .verify-qr { width: 68px; height: 68px; display: block; border-radius: 4px; border: 1px solid #cbd5e1; padding: 2px; background: #fff; }
  .verify-label { font-size: 6.5pt; color: #475569; margin-top: 3px; max-width: 85px; text-align: center; }
  .verify-id { font-family: 'Courier New', monospace; font-size: 6.5pt; font-weight: bold; color: #1e293b; letter-spacing: 0.5px; margin-top: 1px; }

  /* Lampiran Page */
  .lampiran-page { page-break-before: always; padding-top: 2mm; }
  @media print { .lampiran-page { page-break-before: always; } }

  /* Sesi Card di Lampiran Absensi */
  .sesi-container { display: flex; flex-direction: column; gap: 14px; margin-top: 10px; }
  .sesi-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #fff; }
  .sesi-card-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 6px; }
  .sesi-card-title { display: flex; align-items: center; gap: 6px; }
  .sesi-pill { background: #2563eb; color: #fff; font-weight: bold; font-size: 7.5pt; padding: 2px 6px; border-radius: 4px; }
  .sesi-mapel { font-size: 9.5pt; font-weight: bold; color: #0f172a; }
  .sesi-card-badge { font-size: 8pt; color: #334155; }
  
  .sesi-info-table { width: 100%; font-size: 8pt; margin-bottom: 6px; border-collapse: collapse; }
  .sesi-info-table td { padding: 1.5px 3px; vertical-align: top; border: none; }
  .sit-lbl { width: 105px; color: #475569; font-weight: 600; }
  .sit-sep { width: 8px; color: #475569; }
  .sit-val { color: #0f172a; }
  
  .absen-table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 4px; }
  .absen-table th, .absen-table td { border: 1px solid #cbd5e1; padding: 3px 5px; }
  .absen-table th { background: #f8fafc; font-weight: bold; text-align: center; color: #334155; }
  .badge-hadir { display: inline-block; padding: 1px 5px; border-radius: 3px; font-weight: bold; font-size: 7pt; background: #dcfce7; color: #166534; }
  .badge-absen { display: inline-block; padding: 1px 5px; border-radius: 3px; font-weight: bold; font-size: 7pt; background: #fee2e2; color: #991b1b; }

  /* Foto Grid di Lampiran Foto */
  .foto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .foto-item { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .foto-item img { width: 100%; height: 50mm; object-fit: cover; display: block; background: #f1f5f9; }
  .foto-caption { padding: 4px 6px; }
  .foto-nomor { font-size: 8.5pt; font-weight: bold; margin-bottom: 1px; }
  .foto-meta { font-size: 7.5pt; color: #555; }
</style>
</head>
<body>
  <div class="page">
    ${renderKopHTML(profil)}
    <div class="doc-title"><h1>REKAP PELAKSANAAN KLINIK PEMBELAJARAN</h1></div>
    <div class="doc-sub">Periode : <strong>${esc(periode)}</strong></div>

    <table class="meta-table">
      <tr><td>Jumlah Guru Pelaksana</td><td>:</td><td>${daftarGuru.length} orang</td></tr>
      <tr><td>Jumlah Sesi Klinik</td><td>:</td><td>${totalSesi} sesi</td></tr>
      <tr><td>Jumlah Kehadiran Siswa</td><td>:</td><td>${totalHadir} siswa (dari total ${totalPeserta} peserta terdaftar)</td></tr>
      <tr><td>Lampiran Dokumen</td><td>:</td><td>${sesiAbsensiList.length > 0 ? 'Daftar Hadir Siswa per Sesi' : '-'}${fotoLampiran.length > 0 ? `, ${fotoLampiran.length} Foto Dokumentasi` : ''}</td></tr>
      <tr><td>Dasar Rekapitulasi</td><td>:</td><td>${hanyaDisetujui ? 'Laporan sesi yang telah disahkan' : 'Seluruh laporan sesi yang diajukan'}</td></tr>
    </table>

    <table class="entries">
      <thead>
        <tr>
          <th class="c-no">No</th>
          <th class="c-guru">Nama Guru / NIP</th>
          <th class="c-tgl">Tanggal &amp; Waktu</th>
          <th class="c-mapel">Mata Pelajaran</th>
          <th class="c-topik">Topik Pembelajaran</th>
          <th class="c-ruang">Ruangan</th>
          <th class="c-peserta">Hadir / Peserta</th>
          <th class="c-lampiran">Foto</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="8" class="kosong">Tidak ada sesi klinik pada periode ini</td></tr>`}
      </tbody>
      ${totalSesi > 0 ? `
      <tfoot>
        <tr>
          <td colspan="6" style="text-align:right">Total ${totalSesi} sesi</td>
          <td class="c-peserta">${totalHadir}/${totalPeserta}</td>
          <td class="c-lampiran">${fotoLampiran.length} foto</td>
        </tr>
      </tfoot>` : ''}
    </table>

    <div class="pengesahan-container">
      <div class="pengesahan-card">
        <div class="pengesahan-left">
          <div class="pengesahan-kota-tgl">${kota ? esc(kota) + ', ' : ''}${esc(hariIni)}</div>
          <div class="pengesahan-badge">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="display:inline-block; vertical-align:middle; margin-right:4px;">
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
            </svg>
            Telah Disahkan Secara Resmi
          </div>
          <div class="pengesahan-pejabat">
            Pengesahan Oleh: <strong>WKM Bidang Akademik</strong>
          </div>
          <div class="pengesahan-desc">
            Dokumen rekapitulasi pelaksanaan beserta seluruh lampiran daftar kehadiran sesi klinik pembelajaran ini telah diverifikasi dan disahkan secara digital melalui sistem manajemen madrasah ACCA.
          </div>
        </div>
        <div class="pengesahan-right">
          <div class="verify-qr-box">
            <img class="verify-qr" src="${qrDataUrl}" alt="QR Verifikasi Dokumen" />
            <div class="verify-label">Pindai untuk verifikasi &amp; preview dokumen</div>
            <div class="verify-id">${esc(verifyCode)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  ${lampiranAbsensiHtml}
  ${lampiranFotoHtml}
</body>
</html>`;

        return {
            ok: true,
            html,
            jumlahSesi: totalSesi,
            jumlahGuru: daftarGuru.length,
            jumlahFoto: fotoLampiran.length,
        };
    } catch (error: any) {
        console.error('buildRekapKlinik Error:', error);
        return { ok: false, error: error.message, status: 500 };
    }
}
