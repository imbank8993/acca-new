/**
 * Membangun dokumen HTML Rekap Bulanan Klinik Pembelajaran — laporan kolektif
 * seluruh guru yang melaksanakan sesi klinik pada satu bulan.
 *
 * Dipakai bersama oleh route rekap/pdf (dikonversi ke PDF via Puppeteer) dan
 * rekap/preview (HTML mentah utk pratinjau in-app). Format & gaya mengikuti
 * Laporan Bulanan Guru Asuh (lib/guru-asuh/laporan-report.ts): KOP resmi,
 * judul bergaris bawah, meta-table, tabel entri, lalu blok tanda tangan.
 */
import { prisma } from '@/lib/prisma';
import { renderKopHTML, KOP_CSS, kotaKedudukan } from '@/lib/lckh/print-shared';

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtTanggalPendek(d?: string | null): string {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return '-';
    }
}

function fmtTanggalPanjang(d: Date): string {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function jam(v?: string | null): string {
    if (!v) return '';
    const s = String(v).trim();
    if (s.includes('T')) return (s.split('T')[1] || '').slice(0, 5);
    return s.slice(0, 5);
}

export interface RekapKlinikInput {
    bulan: number | string;
    tahun: number | string;
    /** true (default): hanya sesi yang laporannya sudah disahkan. */
    hanyaDisetujui?: boolean;
}

export type RekapKlinikResult =
    | { ok: true; html: string; jumlahSesi: number; jumlahGuru: number; jumlahFoto: number }
    | { ok: false; error: string; status: number };

interface BarisSesi {
    tanggal: string;
    mapel: string;
    topik: string;
    peserta: number;
    /** Peserta yang tercatat hadir. Sesi lama (sebelum absensi) bernilai 0. */
    hadir: number;
    statusLaporan: string;
    /** Nomor lampiran foto milik sesi ini, mis. "1–3". */
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

export async function buildRekapKlinik(input: RekapKlinikInput): Promise<RekapKlinikResult> {
    const bulan = Number(input.bulan);
    const tahun = Number(input.tahun);
    const hanyaDisetujui = input.hanyaDisetujui !== false;

    if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12 || !Number.isInteger(tahun)) {
        return { ok: false, error: 'Bulan/tahun tidak valid', status: 400 };
    }

    // Rentang tanggal bulan tsb (akhir bulan dihitung dari hari ke-0 bulan berikutnya).
    const awal = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
    const akhirDate = new Date(tahun, bulan, 0);
    const akhir = `${tahun}-${String(bulan).padStart(2, '0')}-${String(akhirDate.getDate()).padStart(2, '0')}`;

    try {
        const slots = await prisma.klinik_slots.findMany({
            where: {
                tanggal: { gte: awal, lte: akhir },
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
                peserta: (s.klinik_peserta || []).length,
                hadir: (s.klinik_peserta || []).filter((p: any) => p.kehadiran === 'H').length,
                statusLaporan: lap?.status || 'Draft',
                lampiran: fotos.length === 0
                    ? '-'
                    : fotos.length === 1 ? `${nomorAwal}` : `${nomorAwal}–${nomorAkhir}`,
                jumlahFoto: fotos.length,
            });
        }

        const daftarGuru = [...perGuru.values()].sort((a, b) => a.nama.localeCompare(b.nama));
        const totalSesi = daftarGuru.reduce((n, g) => n + g.sesi.length, 0);
        const totalPeserta = daftarGuru.reduce((n, g) => n + g.sesi.reduce((m, s) => m + s.peserta, 0), 0);
        const totalHadir = daftarGuru.reduce((n, g) => n + g.sesi.reduce((m, s) => m + s.hadir, 0), 0);

        const kota = kotaKedudukan(profil);
        const hariIni = fmtTanggalPanjang(new Date());
        const periode = `${BULAN[bulan - 1]} ${tahun}`;

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
              <td class="c-peserta">${s.hadir}/${s.peserta}</td>
              <td class="c-lampiran">${s.lampiran}</td>
            </tr>`;
            }).join('');
        }).join('');

        const lampiranHtml = fotoLampiran.length === 0 ? '' : `
      <div class="lampiran-page">
        <div class="doc-title"><h1>LAMPIRAN FOTO DOKUMENTASI</h1></div>
        <div class="doc-sub">Rekap Klinik Pembelajaran — <strong>${esc(periode)}</strong></div>
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
  @page { size: A4 portrait; margin: 20mm 15mm 20mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; }
  .page { padding: 20mm 15mm 20mm 20mm; }
  @media print { .page { padding: 0; } }
  ${KOP_CSS}
  .kop { position: relative; display: block; }
  .kop-logo { position: absolute; left: 0; top: 0; margin: 0; }
  .kop-text { width: 100%; }
  .doc-title { text-align: center; margin: 14px 0 4px; }
  .doc-title h1 { font-size: 12.5pt; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 1px; }
  .doc-sub { text-align: center; font-size: 10.5pt; margin-bottom: 14px; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 10pt; }
  .meta-table td { padding: 1px 0; vertical-align: top; }
  .meta-table td:first-child { width: 150px; }
  .meta-table td:nth-child(2) { width: 14px; }
  table.entries { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table.entries th, table.entries td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
  table.entries th { background: #f1f5f9; font-weight: bold; text-align: center; }
  table.entries tr { page-break-inside: avoid; }
  .c-no { text-align: center; width: 4%; vertical-align: middle; }
  .c-guru { width: 22%; font-weight: bold; vertical-align: middle; }
  .c-nip { font-weight: normal; font-size: 8pt; color: #555; margin-top: 2px; }
  .c-tgl { width: 14%; white-space: nowrap; }
  .c-jam { font-size: 8pt; color: #555; }
  .c-mapel { width: 15%; }
  .c-topik { width: 29%; }
  .c-peserta { width: 10%; text-align: center; white-space: nowrap; }
  .c-lampiran { width: 8%; text-align: center; white-space: nowrap; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .kosong { text-align: center; padding: 14px; font-style: italic; color: #555; }
  .ttd-wrap { margin-top: 26px; display: flex; justify-content: flex-end; }
  .ttd-box { width: 62mm; text-align: center; font-size: 10pt; }
  .ttd-space { height: 22mm; }
  .ttd-nama { font-weight: bold; text-decoration: underline; }
  .ttd-nip { font-size: 9pt; }
  .catatan { margin-top: 10px; font-size: 8.5pt; color: #555; font-style: italic; }

  .lampiran-page { page-break-before: always; padding: 20mm 15mm 20mm 20mm; }
  @media print { .lampiran-page { padding: 0; } }
  .foto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .foto-item { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
  .foto-item img { width: 100%; height: 52mm; object-fit: cover; display: block; background: #f1f5f9; }
  .foto-caption { padding: 6px 8px; }
  .foto-nomor { font-size: 9pt; font-weight: bold; margin-bottom: 2px; }
  .foto-meta { font-size: 8pt; color: #555; }
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
      <tr><td>Jumlah Kehadiran Siswa</td><td>:</td><td>${totalHadir} siswa</td></tr>
      <tr><td>Foto Dokumentasi</td><td>:</td><td>${fotoLampiran.length} foto (terlampir)</td></tr>
      <tr><td>Dasar Rekap</td><td>:</td><td>${hanyaDisetujui ? 'Laporan sesi yang telah disahkan' : 'Seluruh laporan sesi yang diajukan'}</td></tr>
    </table>

    <table class="entries">
      <thead>
        <tr>
          <th class="c-no">No</th>
          <th class="c-guru">Nama Guru / NIP</th>
          <th class="c-tgl">Tanggal &amp; Waktu</th>
          <th class="c-mapel">Mata Pelajaran</th>
          <th class="c-topik">Topik Pembelajaran</th>
          <th class="c-peserta">Hadir / Peserta</th>
          <th class="c-lampiran">Lampiran</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="7" class="kosong">Tidak ada sesi klinik pada periode ini</td></tr>`}
      </tbody>
      ${totalSesi > 0 ? `
      <tfoot>
        <tr>
          <td colspan="5" style="text-align:right">Total ${totalSesi} sesi</td>
          <td class="c-peserta">${totalHadir}/${totalPeserta}</td>
          <td class="c-lampiran">${fotoLampiran.length} foto</td>
        </tr>
      </tfoot>` : ''}
    </table>

    <div class="ttd-wrap">
      <div class="ttd-box">
        <div>${kota ? esc(kota) + ', ' : ''}${esc(hariIni)}</div>
        <div>Kepala Madrasah,</div>
        <div class="ttd-space"></div>
        <div class="ttd-nama">${esc(profil?.kepala_sekolah_nama || '..................................')}</div>
        <div class="ttd-nip">NIP. ${esc(profil?.kepala_sekolah_nip || '-')}</div>
      </div>
    </div>

    <div class="catatan">
      Rekap ini dihasilkan otomatis dari data pelaksanaan Klinik Pembelajaran pada aplikasi ACCA.
    </div>
  </div>
  ${lampiranHtml}
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
