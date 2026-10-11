import QRCode from 'qrcode';
import { nestFetchAsUser } from '@/lib/nest-api';
import { renderKopHTML, KOP_CSS } from '@/lib/lckh/print-shared';
import { getPublicOrigin } from '@/lib/public-url';
import { optimizeImageUrls } from '@/lib/image-optimizer';

export const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export function esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fmtDate(d?: string | null): string {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return '-';
    }
}

async function generateQrDataUrl(data: string): Promise<string> {
    try {
        return await QRCode.toDataURL(data, { errorCorrectionLevel: 'M', margin: 1, width: 160 });
    } catch {
        return '';
    }
}

export interface EkskulReportInput {
    submissionId?: string | null;
    nip?: string | null;
    ekskul_id?: string | null;
    bulan?: number | string | null;
    tahun?: number | string | null;
    nama_guru?: string | null;
    origin: string;
}

export type EkskulReportResult =
    | { ok: true; html: string; submission: any }
    | { ok: false; error: string; status: number };

export async function buildEkskulReport(input: EkskulReportInput, token: string = ''): Promise<EkskulReportResult> {
    const { origin } = input;

    const { status, body: reportData } = await nestFetchAsUser('/ekskul/report-data', token, {
        method: 'POST',
        body: JSON.stringify(input),
    });

    if (status !== 200 || !reportData) {
        return { ok: false, error: reportData?.message || 'Data tidak ditemukan', status: status || 500 };
    }

    const { submission, entries, profil, guruName, approverName, approverNip } = reportData;

    if (!submission) {
        return { ok: false, error: 'Data laporan tidak ditemukan.', status: 404 };
    }

    const absensiMap: Record<string, { hadir: number; total: number }> = {};
    for (const e of entries || []) {
        const absList = e.ekskul_absensi || [];
        absensiMap[e.id] = {
            total: absList.length,
            hadir: absList.filter((a: any) => a.status === 'H' || a.status === 'Hadir').length,
        };
    }

    const fotoEntries = (entries || []).filter((e: any) => e.dokumentasi);

    let jmlInternal = 0;
    let jmlEksternal = 0;
    
    const rowsHtml = (entries || []).map((e: any, i: number) => {
        if (e.status_pelatih === 'Eksternal') jmlEksternal++; else jmlInternal++;
        const abs = absensiMap[e.id] || { hadir: 0, total: 0 };
        return `
        <tr>
          <td class="c-no">${i + 1}</td>
          <td class="c-tgl">${fmtDate(e.tanggal)}</td>
          <td>${esc(e.materi || '-')}</td>
          <td class="c-kelas">${esc(e.status_pelatih)}</td>
          <td class="c-kelas">${abs.total > 0 ? `${abs.hadir} / ${abs.total} Siswa` : '-'}</td>
        </tr>`;
    }).join('');

    const rawEkskulUrls = fotoEntries.map((e: any) => e.dokumentasi).filter(Boolean);
    const optimizedEkskulMap = await optimizeImageUrls(rawEkskulUrls);

    const lampiranHtml = fotoEntries.length === 0 ? '' : `
    <div class="lampiran-page">
      <div class="doc-title"><h1>LAMPIRAN FOTO DOKUMENTASI KEGIATAN</h1></div>
      <div class="foto-grid">
        ${fotoEntries.map((e: any, i: number) => {
          const imgSrc = optimizedEkskulMap.get(e.dokumentasi) || esc(e.dokumentasi);
          return `
          <div class="foto-item" id="foto-${i + 1}">
            <img src="${imgSrc}" alt="Dokumentasi ${esc(e.materi)}" />
            <div class="foto-caption">
              <div class="foto-kegiatan">${i + 1}. ${esc(e.materi || 'Pertemuan ' + (i+1))}</div>
              <div class="foto-tgl">${fmtDate(e.tanggal)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

    const isApproved = submission.status === 'Disahkan';
    const baseOrigin = getPublicOrigin(origin);
    const scanUrl = submission.id ? `${baseOrigin}/ekstrakurikuler?tab=approval&id=${submission.id}` : '';
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
<title>Laporan Ekstrakurikuler - ${esc(submission.ekskul?.nama_ekskul)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; }
  .page { padding: 10mm 15mm 15mm 20mm; }
  @media print { .page { padding: 0; } }
  ${KOP_CSS}
  .kop { position: relative; display: block; }
  .kop-logo { position: absolute; left: 0; top: 0; margin: 0; }
  .kop-text { width: 100%; }
  .doc-title { text-align: center; margin: 14px 0 4px; }
  .doc-title h1 { font-size: 12.5pt; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 1px; }
  .doc-sub { text-align: center; font-size: 10pt; margin-bottom: 14px; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 10pt; }
  .meta-table td { padding: 1px 0; vertical-align: middle; }
  .meta-table td:first-child { width: 140px; }
  .meta-table td:nth-child(2) { width: 14px; }
  .status-text { display: inline-flex; align-items: center; gap: 2px; color: #2563eb; font-size: 10pt; font-weight: normal; line-height: 1; vertical-align: middle; }
  table.entries { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 16px; }
  table.entries th, table.entries td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
  table.entries th { background: #f1f5f9; font-weight: bold; text-align: center; }
  .c-no { text-align: center; width: 5%; }
  .c-tgl { width: 18%; white-space: nowrap; }
  .c-kelas { width: 15%; text-align: center; font-size: 9pt; white-space: nowrap; }
  .approval-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; page-break-inside: avoid; }
  .ttd-table { font-size: 10pt; border-collapse: collapse; margin-top: 0; }
  .ttd-table td { padding: 4px 0; vertical-align: top; }
  .ttd-table td:first-child { width: 120px; font-weight: bold; }
  .ttd-table td:nth-child(2) { width: 14px; }
  .ttd-nip { font-size: 8.5pt; color: #555; }
  .verify-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 0; margin-left: 20px; gap: 2px; flex-shrink: 0; }
  .verify-qr { width: 64px; height: 64px; display: block; }
  .verify-label { font-size: 7pt; color: #555; text-align: center; }
  .verify-id { font-family: 'Courier New', monospace; font-size: 6.5pt; color: #777; letter-spacing: 0.5px; text-align: center; }
  .pending-note { margin-top: 22px; padding: 10px 14px; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 9pt; color: #64748b; text-align: center; font-style: italic; }

  .lampiran-page { page-break-before: always; padding: 20mm 15mm 20mm 20mm; }
  @media print { .lampiran-page { padding: 0; } }
  .foto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
  .foto-item { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
  .foto-item img { width: 100%; height: 55mm; object-fit: cover; display: block; background: #f1f5f9; }
  .foto-caption { padding: 6px 8px; }
  .foto-kegiatan { font-size: 9pt; font-weight: bold; margin-bottom: 2px; }
  .foto-tgl { font-size: 8pt; color: #555; }
</style>
</head>
<body>
  <div class="page">
    ${renderKopHTML(profil)}
    <div class="doc-title"><h1>LAPORAN BULANAN EKSTRAKURIKULER</h1></div>
    <div class="doc-sub">Periode : <strong>${BULAN[submission.bulan - 1] || '-'} ${submission.tahun}</strong></div>

    <table class="meta-table">
      <tr><td>Ekstrakurikuler</td><td>:</td><td><strong>${esc(submission.ekskul?.nama_ekskul)}</strong></td></tr>
      <tr><td>Nama Guru / Pelatih</td><td>:</td><td>${esc(guruName)}</td></tr>
      <tr><td>NIP</td><td>:</td><td>${esc(submission.pembina_nip)}</td></tr>
      <tr><td>Jumlah Pertemuan</td><td>:</td><td>${entries?.length || 0} (Internal: ${jmlInternal}, Eksternal: ${jmlEksternal})</td></tr>
      <tr><td>Status</td><td>:</td><td><span class="status-text">${statusInfo.iconHtml}${statusInfo.label}</span></td></tr>
    </table>

    <table class="entries">
      <thead>
        <tr><th class="c-no">No</th><th class="c-tgl">Tanggal</th><th>Materi / Topik Kegiatan</th><th class="c-kelas">Status Pelatih</th><th class="c-kelas">Kehadiran</th></tr>
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
          <tr><td>Diajukan Oleh</td><td>:</td><td>${esc(guruName)}${submission.pembina_nip && submission.pembina_nip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(submission.pembina_nip)}</span>` : ''}</td></tr>
          <tr><td>Disahkan Oleh</td><td>:</td><td>${esc(approverName)}${approverNip && approverNip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(approverNip)}</span>` : ''}</td></tr>
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
      Dokumen ini belum disahkan. Tanda tangan WKM Kesiswaan dan kode QR verifikasi
      hanya tersedia pada versi resmi setelah laporan disetujui melalui sistem approval.
    </div>
    `}
  </div>
  ${lampiranHtml}
</body>
</html>`;

    return { ok: true, html, submission };
}
