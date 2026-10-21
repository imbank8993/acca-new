/**
 * Membangun dokumen HTML Laporan Bulanan Guru Asuh — dipakai bersama oleh
 * route pdf/route.ts (dikonversi ke PDF via Puppeteer) dan preview/route.ts
 * (dikembalikan mentah utk pratinjau in-app, tanpa Puppeteer/upload).
 */
import QRCode from 'qrcode';
import { nestFetchAsUser } from '@/lib/nest-api';
import { renderKopHTML, CENTERED_KOP_CSS } from '@/lib/lckh/print-shared';
import { getPublicOrigin } from '@/lib/public-url';
import { optimizeImageUrls } from '@/lib/image-optimizer';

export const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export function esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function sanitizeMediaUrl(url: unknown): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) {
        if (trimmed.includes('169.254.169.254') || trimmed.includes('metadata.google.internal')) {
            return '';
        }
        return esc(trimmed);
    }
    if (/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
        return trimmed;
    }
    return '';
}

export function fmtDate(d?: string | null): string {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return '-';
    }
}

/**
 * Base64 data URI langsung dari paket qrcode (bukan fetch ke /api/qrcode).
 * Memanggil endpoint sendiri via HTTP dari dalam route Puppeteer bisa deadlock
 * di Next.js dev server (request nyangkut nunggu dirinya sendiri selesai).
 */
async function generateQrDataUrl(data: string): Promise<string> {
    try {
        return await QRCode.toDataURL(data, { errorCorrectionLevel: 'M', margin: 1, width: 160 });
    } catch {
        return '';
    }
}

export interface LaporanReportInput {
    submissionId?: string | null;
    nip?: string | null;
    bulan?: number | string | null;
    tahun?: number | string | null;
    nama_guru?: string | null;
    /** Origin request (mis. https://app.example.com) — dipakai membangun URL QR verifikasi. */
    origin: string;
    token?: string;
}

export type LaporanReportResult =
    | { ok: true; html: string; submission: any }
    | { ok: false; error: string; status: number };

export async function buildLaporanReport(input: LaporanReportInput): Promise<LaporanReportResult> {
    const { submissionId, nip: bodyNip, bulan: bodyBulan, tahun: bodyTahun, nama_guru: bodyNamaGuru, origin, token } = input;

    const qs = new URLSearchParams();
    if (submissionId) qs.set('submissionId', submissionId);
    if (bodyNip) qs.set('nip', bodyNip);
    if (bodyBulan) qs.set('bulan', String(bodyBulan));
    if (bodyTahun) qs.set('tahun', String(bodyTahun));

    const { status, body } = await nestFetchAsUser(
        `/guru-asuh/laporan-submission/report-data?${qs.toString()}`,
        token || ''
    );

    if (status !== 200 || !body?.ok) {
        return { ok: false, error: body?.message || 'Gagal memuat data laporan dari server.', status };
    }

    const reportData = body.data || {};
    let submission = reportData.submission;
    const entries = reportData.entries || [];
    const profil = reportData.profil;
    const approverNip = reportData.approverNip || '-';

    if (!submission) {
        if (!bodyNip || !bodyBulan || !bodyTahun) {
            return { ok: false, error: 'submissionId atau (nip, bulan, tahun) wajib diisi', status: 400 };
        }
        submission = {
            id: null,
            nip: bodyNip,
            nama_guru_snap: bodyNamaGuru || reportData.guru?.nama_lengkap || null,
            bulan: Number(bodyBulan),
            tahun: Number(bodyTahun),
            status: 'Draft',
            total_laporan: entries.length,
            approved_at: null,
            approved_by: null,
            approved_by_name: null,
        };
    }

    const guruName = submission.nama_guru_snap || reportData.guru?.nama_lengkap || '-';

    // Dedup berdasarkan foto_url — entri kelompok (banyak siswa, 1 kegiatan)
    // sering berbagi link foto yang sama persis, jangan tampilkan berulang.
    const fotoEntries = Array.from(
        new Map((entries || []).filter((e: any) => e.foto_url).map((e: any) => [e.foto_url, e])).values()
    );

    // Gabung baris yang tanggal + kegiatan + hasilnya sama persis (mis. satu
    // sesi kelompok yang dicatat terpisah per siswa) jadi satu baris dengan
    // nama siswa digabung, supaya tabel tidak duplikat.
    const mergedByKey = new Map<string, { tanggal: string; kegiatan: string; siswaList: {nama: string, kelas: string}[] }>();
    for (const e of (entries || [])) {
        const siswaObj = { nama: e.guru_asuh?.nama_siswa || '-', kelas: e.guru_asuh?.kelas || '-' };
        const key = `${e.tanggal}|${e.kegiatan}|${e.hasil || ''}`;
        const existing = mergedByKey.get(key);
        if (existing) existing.siswaList.push(siswaObj);
        else mergedByKey.set(key, { tanggal: e.tanggal, kegiatan: e.kegiatan, siswaList: [siswaObj] });
    }
    const mergedRows = Array.from(mergedByKey.values());
    for (const r of mergedRows) {
        r.siswaList.sort((a, b) => a.nama.localeCompare(b.nama, 'id-ID'));
    }

    const rowsHtml = mergedRows.map((r, i: number) => {
        return r.siswaList.map((s, sIdx) => {
            if (sIdx === 0) {
                return `
            <tr>
              <td class="c-no" rowspan="${r.siswaList.length}">${i + 1}</td>
              <td class="c-tgl" rowspan="${r.siswaList.length}">${fmtDate(r.tanggal)}</td>
              <td class="c-siswa">${esc(s.nama)}</td>
              <td class="c-kelas">${esc(s.kelas)}</td>
              <td rowspan="${r.siswaList.length}">${esc(r.kegiatan)}</td>
            </tr>`;
            }
            return `
            <tr>
              <td class="c-siswa">${esc(s.nama)}</td>
              <td class="c-kelas">${esc(s.kelas)}</td>
            </tr>`;
        }).join('');
    }).join('');

    const validFotoEntries = fotoEntries.filter((e: any) => sanitizeMediaUrl(e.foto_url));
    const rawGuruUrls = validFotoEntries.map((e: any) => e.foto_url).filter(Boolean);
    const optimizedGuruMap = await optimizeImageUrls(rawGuruUrls);

    const lampiranHtml = validFotoEntries.length === 0 ? '' : `
    <div class="lampiran-page">
      <div class="doc-title"><h1>LAMPIRAN FOTO DOKUMENTASI KEGIATAN</h1></div>
      <div class="foto-grid">
        ${validFotoEntries.map((e: any, i: number) => {
          const imgSrc = optimizedGuruMap.get(e.foto_url) || sanitizeMediaUrl(e.foto_url);
          return `
          <div class="foto-item" id="foto-${i + 1}">
            <img src="${imgSrc}" alt="Dokumentasi ${esc(e.kegiatan)}" />
            <div class="foto-caption">
              <div class="foto-kegiatan">${i + 1}. ${esc(e.kegiatan)}</div>
              <div class="foto-tgl">Diunggah: ${fmtDate(e.created_at)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

    const isApproved = submission.status === 'Approved';
    const baseOrigin = getPublicOrigin(origin);
    const scanUrl = submission.id ? `${baseOrigin}/guru-asuh/verify/${submission.id}` : '';
    const qrDataUrl = scanUrl ? await generateQrDataUrl(scanUrl) : '';

    const statusInfo = isApproved
        ? { label: 'Disahkan', iconHtml: '<svg width="15" height="15" viewBox="0 0 16 16" fill="#2563eb" style="display:inline-block; vertical-align:middle; margin-right:4px; flex-shrink:0;"><path d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01zm.287 5.984-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 8.793l2.646-2.647a.5.5 0 0 1 .708.708"/></svg>' }
        : submission.id
            ? { label: 'Menunggu Pengesahan', iconHtml: '' }
            : { label: 'Pratinjau · Belum Diajukan', iconHtml: '' };

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Laporan Guru Asuh - ${esc(guruName)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; width: 794px; margin: 0 auto; background: #fff; }
  .page { padding: 10mm 15mm 15mm 20mm; width: 100%; }
  @media print { 
      body { width: 100%; margin: 0; zoom: 1 !important; }
      .page { padding: 0; } 
  }
  @media screen and (max-width: 820px) {
      body { zoom: calc(100vw / 820); }
  }
  ${CENTERED_KOP_CSS}
  .doc-title { text-align: center; margin: 14px 0 4px; }
  .doc-title h1 { font-size: 12.5pt; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 1px; }
  .doc-sub { text-align: center; font-size: 10pt; margin-bottom: 14px; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 10pt; }
  .meta-table td { padding: 1px 0; vertical-align: middle; }
  .meta-table td:first-child { width: 110px; }
  .meta-table td:nth-child(2) { width: 14px; }
  .status-text { display: inline-flex; align-items: center; gap: 2px; color: #2563eb; font-size: 10pt; font-weight: normal; line-height: 1; vertical-align: middle; }
  table.entries { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 16px; }
  table.entries th, table.entries td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
  table.entries th { background: #f1f5f9; font-weight: normal; text-align: center; }
  .c-no { text-align: center; width: 5%; }
  .c-tgl { width: 14%; white-space: nowrap; }
  .c-siswa { width: 26%; font-size: 8pt; }
  .c-kelas { width: 10%; text-align: center; font-size: 8pt; white-space: nowrap; }
  .approval-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; page-break-inside: avoid; }
  .ttd-table { font-size: 10pt; border-collapse: collapse; margin-top: 0; }
  .ttd-table td { padding: 4px 0; vertical-align: top; }
  .ttd-table td:first-child { width: 120px; font-weight: normal; }
  .ttd-table td:nth-child(2) { width: 14px; }
  .ttd-nip { font-size: 8.5pt; color: #555; }
  .verify-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 0; margin-left: 20px; gap: 2px; flex-shrink: 0; }
  .verify-qr { width: 64px; height: 64px; display: block; }
  .verify-label { font-size: 7pt; color: #555; text-align: center; }
  .verify-id { font-family: 'Courier New', monospace; font-size: 6.5pt; color: #777; letter-spacing: 0.5px; text-align: center; }
  .pending-note { margin-top: 22px; padding: 10px 14px; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 9pt; color: #64748b; text-align: center; font-style: italic; }

  .lampiran-page { page-break-before: always; padding: 20mm 15mm 20mm 20mm; }
  @media print { .lampiran-page { padding: 0; } }
  .foto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; align-items: start; }
  .foto-item { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid; background: #fff; }
  .foto-item img { width: 100%; height: auto; max-height: 80mm; object-fit: contain; display: block; background: #f8fafc; }
  .foto-caption { padding: 6px 8px; }
  .foto-kegiatan { font-size: 9pt; font-weight: bold; margin-bottom: 2px; }
  .foto-tgl { font-size: 8pt; color: #555; }
</style>
</head>
<body>
  <div class="page">
    ${renderKopHTML(profil)}
    <div class="doc-title"><h1>LAPORAN BULANAN GURU ASUH</h1></div>
    <div class="doc-sub">Periode : <strong>${BULAN[submission.bulan - 1] || '-'} ${submission.tahun}</strong></div>

    <table class="meta-table">
      <tr><td>Nama Guru</td><td>:</td><td>${esc(guruName)}</td></tr>
      <tr><td>NIP</td><td>:</td><td>${esc(submission.nip)}</td></tr>
      <tr><td>Jumlah Kegiatan</td><td>:</td><td>${mergedRows.length}</td></tr>
      <tr><td>Status</td><td>:</td><td><span class="status-text">${statusInfo.iconHtml}${statusInfo.label}</span></td></tr>
    </table>

    <table class="entries">
      <thead>
        <tr><th class="c-no">No</th><th class="c-tgl">Tanggal</th><th class="c-siswa">Siswa Asuh</th><th class="c-kelas">Kelas</th><th>Kegiatan</th></tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:10px;">Tidak ada data</td></tr>'}
      </tbody>
    </table>

    ${isApproved ? `
    <div class="approval-footer">
      <table class="ttd-table">
        <tbody>
          <tr><td>Diajukan pada</td><td>:</td><td>${fmtDate(submission.submitted_at)}</td></tr>
          <tr><td>Diajukan Oleh</td><td>:</td><td>${esc(guruName)}${submission.nip && submission.nip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(submission.nip)}</span>` : ''}</td></tr>
          <tr><td>Disahkan Oleh</td><td>:</td><td>${esc(submission.approved_by_name || '-')}${approverNip && approverNip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(approverNip)}</span>` : ''}</td></tr>
        </tbody>
      </table>

      <div class="verify-wrap">
        <img class="verify-qr" src="${qrDataUrl}" alt="QR Verifikasi"/>
        <div class="verify-label">Pindai untuk verifikasi keaslian dokumen</div>
        <div class="verify-id">${esc(submission.id)}</div>
      </div>
    </div>
    ` : `
    <div class="pending-note">
      Dokumen ini belum disahkan. Tanda tangan WKM Keasramaan dan kode QR verifikasi
      hanya tersedia pada versi resmi setelah laporan disetujui melalui sistem approval.
    </div>
    `}
  </div>
  ${lampiranHtml}
</body>
</html>`;

    return { ok: true, html, submission };
}
