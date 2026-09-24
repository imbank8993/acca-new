/**
 * HTML Print Utilities
 * Renders documents as self-contained HTML files and triggers browser print.
 *
 * Currently used for: Rekam Medis UKS (multi-row, A4, browser-native printing).
 */

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

interface RekamMedisRow {
  nama?: string;
  nisn?: string;
  kelas?: string;
  keterangan?: string;
  tindakan?: string;
  tindak_lanjut?: string;
  petugas_nama?: string;
  no?: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Open a printable Rekam Medis UKS page and trigger browser print.
 * Used when no .docx template has been uploaded for REKAM_MEDIK.
 *
 * @param rows        Array of medical record rows
 * @param month       1–12
 * @param year        Full year (e.g. 2026)
 * @param petugasNama Name of the UKS officer signing the document
 */
export function generateRekamMedis(
  rows: RekamMedisRow[],
  month: number,
  year: number,
  petugasNama: string
): void {
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const rowsHtml = rows
    .map((row, i) => {
      const rawKet = row.keterangan || '';
      const parts = rawKet.includes('|') ? rawKet.split('|').map((s: string) => s.trim()) : [rawKet, row.tindakan || '', row.tindak_lanjut || ''];
      const ket_1 = parts[0] || '';
      const ket_2 = parts[1] || row.tindakan || '';
      const ket_3 = parts[2] || row.tindak_lanjut || '';

      // Format date if available
      const tglMulaiFmt = row.keterangan && row.keterangan.match(/\d{4}-\d{2}-\d{2}/)
        ? formatDate(row.keterangan.match(/\d{4}-\d{2}-\d{2}/)![0])
        : '-';
      const tglFmt = tglMulaiFmt;

      return `
      <tr>
        <td style="text-align:center; font-weight:bold;">${row.no || (i + 1)}</td>
        <td>
          <div style="font-weight: bold; margin-bottom: 2px;">${row.nama || '-'}</div>
          <div style="color: #444; font-size: 8pt; margin-bottom: 2px;">NISN: ${row.nisn || '-'}</div>
          <div style="color: #444; font-size: 8pt;">Kelas: ${row.kelas || '-'}</div>
        </td>
        <td>${tglFmt}</td>
        <td>
          <ul style="margin: 0; padding-left: 14px; list-style-type: disc;">
            <li style="margin-bottom: 3px;"><strong>Keterangan:</strong> ${ket_1 || '-'}</li>
            <li style="margin-bottom: 3px;"><strong>Tindakan:</strong> ${ket_2 || '-'}</li>
            <li style="margin-bottom: 0;"><strong>Tindak Lanjut:</strong> ${ket_3 || '-'}</li>
          </ul>
        </td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Rekam Medis UKS - ${periodLabel}</title>
<style>
  /* Kertas A4 = 210mm × 297mm */
  @page { size: 210mm 297mm portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm; max-width: 210mm; min-height: 297mm;
    margin: 0 auto; padding: 0;
    color: #000; background: #fff;
    font-family: 'Times New Roman', serif; font-size: 11pt;
  }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; page-break-inside: auto; }
  thead { display: table-header-group; }
  tbody tr { page-break-inside: avoid; break-inside: avoid-page; }
  .kop { text-align: center; margin-bottom: 6px; padding: 30mm 20mm 0; }
  .kop-title { font-size: 14pt; font-weight: bold; line-height: 1.3; }
  .kop-sub { font-size: 10pt; }
  .kop-divider { border-top: 2.5px solid #000; margin: 4px 0 2px; }
  .kop-dotted { border-top: 1px dashed #000; margin: 0; }
  .doc-title { text-align: center; margin: 10px 0 4px; padding: 0 20mm; font-size: 12pt; font-weight: bold; text-decoration: underline; }
  .doc-meta { text-align: center; font-size: 11pt; margin-bottom: 12px; padding: 0 20mm; }
  .table-wrap { padding: 0 20mm; }
  th { background: #3083FF; color: #fff; border: 1px solid #555; padding: 6px 8px; font-weight: bold; text-align: center; font-size: 9pt; }
  td { border: 1px solid #555; padding: 6px 8px; vertical-align: top; font-size: 9pt; word-wrap: break-word; overflow: hidden; }
  tr:nth-child(even) td { background: #f0f4ff; }
  .sign-area { margin-top: 24px; padding: 0 20mm; display: flex; justify-content: flex-end; }
  .sign-box { text-align: left; width: 260px; }
  .sign-meta { font-size: 10pt; margin-bottom: 4px; }
  .sign-label { font-size: 10pt; margin-bottom: 52px; }
  .sign-name-spacer { height: 52px; }
  .sign-name { font-weight: bold; font-size: 10pt; }
  .footer { margin-top: 12px; font-size: 8pt; color: #666; text-align: center; padding: 0 20mm 20mm; }
  .empty-row td { text-align: center; color: #888; padding: 20px; }
  @media print {
    @page { size: 210mm 297mm portrait; margin: 30mm 20mm 20mm 20mm; }
    html, body {
      width: 210mm !important; max-width: 210mm !important;
      min-height: 297mm; margin: 0 !important; padding: 0 !important;
    }
    .kop, .doc-title, .doc-meta, .table-wrap, .sign-area, .footer { padding-left: 0; padding-right: 0; }
    .kop { padding-top: 0; }
    .footer { padding-bottom: 0; }
    th { background: #3083FF !important; color: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    tr:nth-child(even) td { background: #f0f4ff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body class="a4-document">

<div class="kop">
  <div class="kop-title">MADRASAH ALIYAH NEGERI INSAN CENDEKIA GOWA</div>
  <div class="kop-sub">Jl. Pendidikan, Desa Belapunranga, Kec. Parangloe</div>
  <div class="kop-sub">Kabupaten Gowa 92173 – Provinsi Sulawesi Selatan</div>
  <div class="kop-sub">Email: maninsancendekiagowa@gmail.com | Web: icgowa.sch.id</div>
  <div class="kop-divider"></div>
  <div class="kop-dotted"></div>
</div>

<div class="doc-title">REKAM MEDIK KESEHATAN</div>
<div class="doc-meta">Periode: <strong>${periodLabel}</strong></div>

<div class="table-wrap">
<table>
  <thead>
    <tr>
      <th style="width:6%">No</th>
      <th style="width:34%">IDENTITAS</th>
      <th style="width:22%">TANGGAL</th>
      <th style="width:38%">KETERANGAN</th>
    </tr>
  </thead>
  <tbody>
    ${
      rowsHtml
        ? rowsHtml
        : `<tr class="empty-row"><td colspan="4">Tidak ada data sakit pada periode ini</td></tr>`
    }
  </tbody>
</table>
</div>

<div class="sign-area">
  <div class="sign-box">
    <div class="sign-meta">Gowa, ${formatLongDate(new Date())}</div>
    <div class="sign-label">Petugas UKS</div>
    <div class="sign-name-spacer"></div>
    <div class="sign-name">${petugasNama || '_________________'}</div>
  </div>
</div>

<div class="footer">
  Dicetak dari Sistem ACCA — Rekam Medis UKS MAN Insan Cendekia Gowa | ${periodLabel}
</div>

<script>window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
