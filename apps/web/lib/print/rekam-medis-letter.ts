/**
 * Rekam Medis — HTML cetak multi-halaman
 *
 * Setiap halaman = satu lembar A4 (210×297mm) dengan:
 *   - Gambar template full-bleed sebagai background halaman
 *   - Konten di dalam area aman (30mm atas, 20mm samping/bawah)
 *
 * Pendekatan ini andal di Chrome/Edge karena tidak bergantung pada
 * position:fixed + @page margin yang sering tidak selaras.
 */

import {
  A4_PAGE,
  REKAP_METRICS,
  resolvePrintAssetUrl,
  escapeHtml,
} from './print-utils';

export interface AbsenceDetail {
  tgl_mulai_fmt: string;
  tgl_selesai_fmt: string;
  keterangan: string;
  tindakan: string; // Used for Tindakan in SAKIT, or Status in IZIN
  tindak_lanjut: string;
}

export interface RekamMedisPrintRow {
  no: number;
  nama: string;
  nisn: string;
  kelas: string;
  absences: AbsenceDetail[];
}

export interface BuildRekapHtmlParams {
  jenis: 'IZIN' | 'SAKIT';
  nomorSurat: string;
  monthName: string;
  year: number;
  /**
   * Nama penanda tangan rekap — pemegang role OP_UKS (Sakit) / OP_IZIN (Izin),
   * bukan orang yang kebetulan mencetak. Maksimal 3 nama; QR tetap satu.
   * Sudah diurutkan & dipotong di sisi pemanggil.
   */
  penandatangan: string[];
  rekamRows: RekamMedisPrintRow[];
  /**
   * Background halaman — wajib ada. Diambil pemanggil dari template yang diunggah
   * admin (Rekap Izin ikut "Izin Keasramaan", Rekap Sakit ikut "Surat Rekomendasi");
   * tidak ada gambar bawaan sebagai cadangan.
   */
  backgroundUrl: string;
  appBase: string;
}

/** Perkiraan jumlah baris teks yang dipakai satu potong teks di kolom keterangan. */
function textLines(text: string): number {
  const len = (text || '-').trim().length || 1;
  return Math.max(1, Math.ceil(len / REKAP_METRICS.charsPerLine));
}

/** Tinggi satu entri ketidakhadiran (satu blok tanggal + keterangan). */
function entryHeight(abs: AbsenceDetail, jenis: 'IZIN' | 'SAKIT'): number {
  // Label bullet ("Keterangan:", "Tindakan:", …) ikut menambah panjang teks,
  // makanya dihitung sekalian lewat panjang gabungan.
  const fields = jenis === 'SAKIT'
    ? [`Keterangan: ${abs.keterangan}`, `Tindakan: ${abs.tindakan}`, `Tindak Lanjut: ${abs.tindak_lanjut}`]
    : [`Status: ${abs.tindakan}`, `Keterangan: ${abs.keterangan}`];
  const lines = fields.reduce((n, f) => n + textLines(f), 0);
  // Kolom tanggal bisa jadi 3 baris kalau ada "s.d.", jadi dipakai yang terbesar.
  const dateLines = abs.tgl_selesai_fmt && abs.tgl_selesai_fmt !== '-' ? 3 : 1;
  return Math.max(lines, dateLines) * REKAP_METRICS.lineHeight + REKAP_METRICS.entryPadding;
}

function rowHeight(row: RekamMedisPrintRow, jenis: 'IZIN' | 'SAKIT'): number {
  const body = row.absences.reduce((h, a) => h + entryHeight(a, jenis), 0);
  return Math.max(REKAP_METRICS.minRowHeight, body);
}

/** Sisa ruang tabel pada satu halaman. */
function pageBudget(pageIndex: number, headerHeight: number): number {
  const { contentHeight, tableHeadHeight, continuedHeight, safety } = REKAP_METRICS;
  const top = pageIndex === 0 ? headerHeight : continuedHeight;
  return contentHeight - top - tableHeadHeight - safety;
}

/**
 * Bagi baris ke halaman berdasarkan perkiraan tinggi, bukan jumlah baris.
 *
 * Siswa dengan banyak entri bisa lebih tinggi dari satu halaman penuh; entri-nya
 * dipecah ke halaman berikutnya (identitas diulang) supaya tidak ada yang
 * terpotong. Halaman terakhir menyisakan ruang untuk blok tanda tangan.
 */
function paginateRows(
  rows: RekamMedisPrintRow[],
  jenis: 'IZIN' | 'SAKIT',
  headerHeight: number,
): RekamMedisPrintRow[][] {
  if (rows.length === 0) return [[]];

  const pages: RekamMedisPrintRow[][] = [];
  let current: RekamMedisPrintRow[] = [];
  let used = 0;
  let budget = pageBudget(0, headerHeight);

  const startNewPage = () => {
    pages.push(current);
    current = [];
    used = 0;
    budget = pageBudget(pages.length, headerHeight);
  };

  for (const row of rows) {
    let remaining = row;

    // Setiap putaran menaruh sebagian (atau seluruh) baris, jadi selalu maju.
    for (;;) {
      const h = rowHeight(remaining, jenis);
      const free = budget - used;

      if (h <= free) { current.push(remaining); used += h; break; }

      // Satu entri saja tapi tetap tak muat: coba halaman kosong dulu.
      if (remaining.absences.length <= 1) {
        if (current.length > 0) { startNewPage(); continue; }
        current.push(remaining);
        used += h;
        break;
      }

      // Ambil entri sebanyak yang muat di sisa halaman, sisanya ke halaman berikut.
      const fit: AbsenceDetail[] = [];
      let acc = 0;
      for (const abs of remaining.absences) {
        const ah = entryHeight(abs, jenis);
        if (acc + ah > free) break;
        fit.push(abs);
        acc += ah;
      }
      if (fit.length === 0) {
        if (current.length > 0) { startNewPage(); continue; }
        // Halaman kosong pun tak cukup untuk satu entri — paksa satu entri
        // supaya tidak berputar tanpa henti.
        fit.push(remaining.absences[0]);
        acc = entryHeight(remaining.absences[0], jenis);
      }
      current.push({ ...remaining, absences: fit });
      used += acc;
      remaining = { ...remaining, absences: remaining.absences.slice(fit.length) };
      startNewPage();
    }
  }
  pages.push(current);

  // Halaman terakhir harus muat blok tanda tangan; kalau mepet, geser baris
  // terakhir ke halaman baru (bukan dibiarkan tertimpa tanda tangan).
  const lastBudget = pageBudget(pages.length - 1, headerHeight) - REKAP_METRICS.signHeight;
  const lastUsed = () => pages[pages.length - 1].reduce((h, r) => h + rowHeight(r, jenis), 0);
  while (pages[pages.length - 1].length > 1 && lastUsed() > lastBudget) {
    const moved = pages[pages.length - 1].pop() as RekamMedisPrintRow;
    pages.push([moved]);
  }

  return pages;
}

function buildDateCell(abs: AbsenceDetail): string {
  let text = escapeHtml(abs.tgl_mulai_fmt);
  if (abs.tgl_selesai_fmt && abs.tgl_selesai_fmt !== '-' && abs.tgl_selesai_fmt !== abs.tgl_mulai_fmt) {
    text += '<br/>s.d.<br/>' + escapeHtml(abs.tgl_selesai_fmt);
  }
  return text;
}

function buildKetCell(abs: AbsenceDetail, jenis: 'IZIN' | 'SAKIT'): string {
  const items = jenis === 'SAKIT'
    ? [
        ['Keterangan', abs.keterangan],
        ['Tindakan', abs.tindakan],
        ['Tindak Lanjut', abs.tindak_lanjut],
      ]
    : [
        ['Status', abs.tindakan],
        ['Keterangan', abs.keterangan],
      ];
  return `<ul class="ket-list">${items
    .map(([label, value]) => `<li><strong>${label}:</strong> ${escapeHtml(value || '-')}</li>`)
    .join('')}</ul>`;
}

/**
 * Satu entri ketidakhadiran = satu <tr> pada tabel yang sama, dengan kolom No
 * dan Identitas di-rowspan sepanjang jumlah entri siswa tersebut.
 *
 * Sebelumnya entri dirender sebagai tabel bersarang di dalam sel colspan="2".
 * Border tabel dalam tidak ikut `border-collapse` tabel luar, sehingga garisnya
 * bertumpuk (tampak seperti tabel di dalam tabel), lebar kolomnya tidak sejajar
 * dengan kepala tabel, dan `tr:nth-child(even)` menghitung ulang di tiap tabel
 * dalam sehingga arsirannya loncat-loncat.
 */
function buildTableBodyRows(rows: RekamMedisPrintRow[], jenis: 'IZIN' | 'SAKIT'): string {
  if (rows.length === 0) {
    return `<tr class="empty-row"><td colspan="4">Tidak ada data ${jenis.toLowerCase()} pada periode ini</td></tr>`;
  }
  return rows
    .map((r, studentIndex) => {
      // Arsiran selang-seling mengikuti siswa, bukan entri, supaya satu siswa
      // dengan beberapa entri tetap terbaca sebagai satu blok.
      const alt = studentIndex % 2 === 1 ? ' is-alt' : '';
      const entries: (AbsenceDetail | null)[] = r.absences.length > 0 ? r.absences : [null];
      const span = entries.length;

      return entries
        .map((abs, idx) => {
          const identityCells = idx === 0
            ? `<td class="col-no" rowspan="${span}">${r.no}</td>
      <td class="col-identitas" rowspan="${span}">
        <div class="cell-name">${escapeHtml(r.nama)}</div>
        <div class="cell-sub">NISN: ${escapeHtml(r.nisn)}</div>
        <div class="cell-sub">Kelas: ${escapeHtml(r.kelas)}</div>
      </td>`
            : '';
          const dateCell = abs ? buildDateCell(abs) : '-';
          const ketCell = abs ? buildKetCell(abs, jenis) : '-';
          return `
    <tr class="entry-row${alt}">${identityCells}
      <td class="col-tanggal">${dateCell}</td>
      <td class="col-keterangan">${ketCell}</td>
    </tr>`;
        })
        .join('');
    })
    .join('');
}

function buildRekamTable(rows: RekamMedisPrintRow[], jenis: 'IZIN' | 'SAKIT'): string {
  return `
    <table class="rekam-table">
      <thead>
        <tr>
          <th class="col-no">No</th>
          <th class="col-identitas">IDENTITAS</th>
          <th class="col-tanggal">TANGGAL</th>
          <th class="col-keterangan">KETERANGAN</th>
        </tr>
      </thead>
      <tbody>${buildTableBodyRows(rows, jenis)}</tbody>
    </table>`;
}

export function buildRekapPrintHtml(params: BuildRekapHtmlParams): string {
  const {
    jenis,
    nomorSurat,
    monthName,
    year,
    penandatangan,
    rekamRows,
    backgroundUrl,
    appBase,
  } = params;

  const signers = (penandatangan || []).filter(Boolean);
  const signerLabel = jenis === 'SAKIT' ? 'Petugas UKS' : 'Petugas Izin';
  // Nama petugas ditulis menurun dan bernomor di blok meta (bukan di bawah
  // tanda tangan), urut abjad — urutannya sudah disiapkan pemanggil.
  const signerList = signers.length > 0
    ? signers.map((n, i) => `<div class="signer-item">${i + 1}. ${escapeHtml(n)}</div>`).join('')
    : '<div class="signer-item">-</div>';

  const bgUrl = resolvePrintAssetUrl(backgroundUrl, appBase);

  // Tinggi blok kepala halaman pertama ikut jumlah nama petugas, karena itu
  // menentukan berapa baris tabel yang muat di halaman pertama.
  const { introHeight, metaRowHeight, metaMargin } = REKAP_METRICS;
  const metaLines = 2 + Math.max(1, signers.length); // Bulan + Jumlah Siswa + daftar petugas
  const headerHeight = introHeight + metaMargin + metaLines * metaRowHeight;

  const pages = paginateRows(rekamRows, jenis, headerHeight);
  const periodLabel = `${monthName} ${year}`;
  const safeBase = appBase.replace(/\/$/, '') + '/';

  const sheetsHtml = pages
    .map((pageRows, pageIndex) => {
      const isFirst = pageIndex === 0;
      const pageNum = pageIndex + 1;
      const totalPages = pages.length;

      const headerBlock = isFirst
        ? `
        <div class="nomor-surat">
          <div class="surat-title">REKAPITULASI KETIDAKHADIRAN — ${jenis}</div>
        </div>
        <div class="body-text">Yang bertanda tangan di bawah ini membuat rekapitulasi ketidakhadiran (${jenis.toLowerCase()}) sebagai berikut:</div>
        <div class="meta-table">
          <div class="meta-row"><span class="meta-label">Bulan</span><span class="meta-colon">:</span><span class="meta-value">${escapeHtml(periodLabel)}</span></div>
          <div class="meta-row"><span class="meta-label">${signerLabel}</span><span class="meta-colon">:</span><span class="meta-value signer-list">${signerList}</span></div>
          <div class="meta-row"><span class="meta-label">Jumlah Siswa</span><span class="meta-colon">:</span><span class="meta-value">${rekamRows.length} orang</span></div>
        </div>`
        : `<div class="sheet-continued">REKAPITULASI KETIDAKHADIRAN — ${jenis} — ${escapeHtml(periodLabel)} <span class="page-tag">(hal. ${pageNum}/${totalPages})</span></div>`;

      const isLast = pageIndex === pages.length - 1;
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const qrData = encodeURIComponent(`REKAP ${jenis}\nPeriode: ${periodLabel}\nJumlah: ${rekamRows.length} siswa\n${signerLabel}: ${signers.join(', ') || '-'}\nDicetak: ${today}`);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}&format=png`;

      // Blok tanda tangan: tempat & tanggal, QR tunggal, lalu label jabatan.
      // Nama petugas tidak diulang di sini — sudah terdaftar di atas tabel.
      const signArea = isLast
        ? `<div class="sign-area">
            <div class="sign-right">
              <div class="sign-date">Gowa, ${escapeHtml(today)}</div>
              <div class="sign-qr-box">
                <img class="sign-qr-img" src="${qrUrl}" alt="QR Code" />
                <div class="sign-qr-caption">Pindai untuk verifikasi</div>
              </div>
              <div class="sign-label">${signerLabel}</div>
            </div>
          </div>`
        : '';

      return `
    <section class="print-sheet" data-page="${pageNum}">
      <img class="sheet-bg" src="${bgUrl}" alt="" />
      <div class="sheet-inner">
        ${headerBlock}
        <div class="rekam-table-wrap">
          ${buildRekamTable(pageRows, jenis)}
        </div>
        ${signArea}
      </div>
    </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<base href="${safeBase}"/>
<title>Rekam Medis - ${escapeHtml(periodLabel)}</title>
<style>
  @page {
    size: ${A4_PAGE.width} ${A4_PAGE.height};
    margin: 0;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #000;
    background: #e5e7eb;
  }
  body { margin: 0; padding: 12px 0; height: 100%; }

  /* Satu lembar = satu halaman A4 fisik */
  .print-sheet {
    position: relative;
    width: ${A4_PAGE.width};
    height: ${A4_PAGE.height};
    margin: 0 auto 12px;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
    break-after: page;
  }
  .print-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
    margin-bottom: 0;
  }

  /* Template A4 penuh sebagai background halaman */
  .sheet-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: ${A4_PAGE.width};
    height: ${A4_PAGE.height};
    z-index: 0;
    display: block;
    pointer-events: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Area konten — margin selaras template (3cm atas, 2cm samping & bawah) */
  .sheet-inner {
    position: absolute;
    top: ${A4_PAGE.padTop};
    right: ${A4_PAGE.padRight};
    bottom: ${A4_PAGE.padBottom};
    left: ${A4_PAGE.padLeft};
    z-index: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .nomor-surat { text-align: center; margin-bottom: 10px; flex-shrink: 0; }
  .surat-title {
    font-size: 12pt;
    font-weight: bold;
    text-decoration: underline;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .surat-nomor { font-size: 11pt; }
  .body-text { font-size: 11pt; line-height: 1.5; margin-bottom: 8px; flex-shrink: 0; }
  .meta-table { font-size: 11pt; margin-bottom: 8px; flex-shrink: 0; }
  .meta-row { display: flex; margin-bottom: 3px; align-items: baseline; }
  .meta-label { min-width: 100px; font-weight: bold; flex-shrink: 0; }
  .meta-colon { width: 12px; flex-shrink: 0; }
  .meta-value { flex: 1; border-bottom: 1px dotted #333; }
  .sheet-continued {
    font-size: 10pt;
    font-weight: bold;
    margin-bottom: 6px;
    flex-shrink: 0;
  }
  .page-tag { font-weight: normal; font-size: 9pt; color: #444; }

  .sign-area {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
  }
  .sign-right {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 120px;
  }
  .sign-date { font-size: 10pt; margin-bottom: 6px; }
  .sign-label { font-size: 10pt; font-weight: bold; margin-top: 6px; }

  /* Daftar petugas di blok meta: menurun & bernomor */
  .signer-list { border-bottom: none; }
  .signer-item { line-height: 1.35; }
  .sign-qr-box {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    flex-shrink: 0;
  }
  .sign-qr-img {
    width: 80px;
    height: 80px;
    display: block;
    border: 1px solid #333;
  }
  .sign-qr-caption {
    font-size: 7pt;
    color: #666;
  }

  .rekam-table-wrap { flex: 1; min-height: 0; overflow: hidden; height: 100%; display: flex; flex-direction: column; }
  .rekam-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8pt;
    flex: 1;
  }
  .rekam-table th,
  .rekam-table td {
    border: 1px solid #333;
    padding: 3px 5px;
    vertical-align: top;
    word-wrap: break-word;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .rekam-table th {
    background: #3083FF;
    color: #fff;
    font-weight: bold;
    text-align: center;
  }
  .rekam-table tbody tr.is-alt td { background: #f0f4ff; }
  .col-no { width: 6%; text-align: center; font-weight: bold; }
  .col-identitas { width: 34%; }
  .col-tanggal { width: 18%; }
  .col-keterangan { width: 42%; }
  .cell-name { font-weight: bold; margin-bottom: 2px; }
  .cell-sub { color: #444; font-size: 7.5pt; margin-bottom: 1px; }
  .ket-list { margin: 0; padding-left: 14px; list-style-type: disc; }
  .ket-list li { margin-bottom: 2px; }
  .empty-row td { text-align: center; color: #888; padding: 20px; }

  @media print {
    html, body {
      width: ${A4_PAGE.width};
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    body { padding: 0 !important; }
    .print-sheet {
      margin: 0 !important;
      box-shadow: none !important;
      page-break-after: always;
      break-after: page;
    }
    .print-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .sheet-bg {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .rekam-table th {
      background: #3083FF !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .rekam-table tbody tr.is-alt td {
      background: #f0f4ff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sign-qr-img {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
${sheetsHtml}
<script>
(function () {
  function triggerPrint() {
    setTimeout(function () { window.print(); }, 400);
  }
  function waitForBackground() {
    var imgs = document.querySelectorAll('.sheet-bg');
    if (!imgs.length) {
      triggerPrint();
      return;
    }
    var pending = 0;
    function done() {
      pending--;
      if (pending <= 0) triggerPrint();
    }
    imgs.forEach(function (img) {
      if (img.complete) return;
      pending++;
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    });
    if (pending === 0) triggerPrint();
  }
  if (document.readyState === 'complete') waitForBackground();
  else window.addEventListener('load', waitForBackground);
})();
</script>
</body>
</html>`;
}
