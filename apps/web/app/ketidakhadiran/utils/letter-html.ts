import { escapeHtml } from '@/lib/print/print-utils';

export function getMonthRoman(month: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[month - 1] || 'I';
}

export function formatDateId(d?: string | null): string {
  if (!d) return '-';
  try {
    const dateOnly = d.split('T')[0];
    const dt = new Date(`${dateOnly}T00:00:00`);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d;
  }
}

export interface SingleHtmlParams {
  nomorSurat: string;
  barcode: string;
  siswaNama: string;
  siswaNisn: string;
  siswaKelas: string;
  tglMulai: string;
  tglSelesai: string;
  keterangan: string;
  pejabatNama: string;
  pejabatJabatan: string;
  pejabatNip: string;
  scanUrl: string;
  qrCodeUrl?: string;
  letterType: string;
  status?: string;
  backgroundUrl: string;
  autoPrint?: boolean;
}

export function buildSingleHtml(params: SingleHtmlParams): string {
  const {
    nomorSurat, barcode, siswaNama, siswaNisn, siswaKelas,
    tglMulai, tglSelesai, keterangan,
    pejabatNama, pejabatJabatan, pejabatNip,
    scanUrl, qrCodeUrl, letterType, status, backgroundUrl,
    autoPrint = false,
  } = params;

  const qrSrc = qrCodeUrl || `/api/qrcode?data=${encodeURIComponent(scanUrl)}`;
  const safe = (value: string) => escapeHtml(value || '-');
  const logoSrc = new URL('/logo-icon.png', scanUrl).toString();
  const isRekomendasi = letterType === 'REKOMENDASI_KONTROL' || letterType === 'SAKIT' ||
    (Boolean(nomorSurat) && nomorSurat.includes('/UKS/'));
  const isKontrol = (status || '').toLowerCase() === 'kontrol';

  let titleText = 'SURAT IZIN MENINGGALKAN ASRAMA';
  let openingText = 'Yang bertanda tangan di bawah ini adalah petugas pemberi izin MAN Insan Cendekia Gowa, menyatakan bahwa siswa berikut:';
  let stateText = 'diberikan izin dengan keterangan dan keperluan sebagai berikut:';
  let footerText = 'Izin ini diberikan berdasarkan pertimbangan kondisi dan kebutuhan siswa, serta telah melalui prosedur yang berlaku di sekolah/madrasah. Siswa diwajibkan untuk kembali ke lingkungan sekolah/madrasah tepat waktu sesuai ketentuan yang berlaku, serta melaporkan kehadirannya kepada pihak terkait setelah izin berakhir.';
  let followupText = '';

  if (letterType === 'REKAM_MEDIK') {
    titleText = 'SURAT KETERANGAN REKAM MEDIK';
    openingText = 'Yang bertanda tangan di bawah ini adalah petugas kesehatan / UKS MAN Insan Cendekia Gowa, menerangkan bahwa siswa berikut:';
    stateText = 'telah dilakukan pemeriksaan kesehatan dengan rincian sebagai berikut:';
    footerText = 'Demikian surat keterangan rekam medik ini diberikan untuk dapat dipergunakan sebagaimana mestinya.';
  } else if (isRekomendasi) {
    titleText = 'SURAT REKOMENDASI';
    openingText = isKontrol
      ? 'Yang bertanda tangan di bawah ini adalah petugas UKS MAN Insan Cendekia Gowa merekomendasikan siswa untuk kontrol/berobat dengan keterangan sebagai berikut:'
      : 'Yang bertanda tangan di bawah ini adalah petugas UKS MAN Insan Cendekia Gowa merekomendasikan siswa untuk mendapat perawatan/penanganan di luar madrasah dengan keterangan sebagai berikut:';
    stateText = '';
    followupText = 'Selanjutnya, rekomendasi ini akan ditindaklanjuti oleh pihak Keasramaan melalui PTSP untuk proses penerbitan surat izin resmi bagi siswa yang bersangkutan.';
    footerText = 'Demikian surat rekomendasi ini dibuat untuk dipergunakan sebagaimana mestinya.';
  }

  const scriptTag = autoPrint
    ? `<script>
  window.addEventListener('load', function() {
    var imgs = Array.from(document.images);
    Promise.all(imgs.map(function(img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function(resolve) {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })).then(function() {
      setTimeout(function() { window.print(); }, 300);
    });
  });
</script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${safe(titleText)} - ${safe(nomorSurat)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 210mm; height: 297mm; margin: 0;
    font-family: 'Times New Roman', serif;
    font-size: 11pt;
    color: #000; background: #fff;
  }
  .a4-page { position: relative; width: 210mm; height: 297mm; overflow: hidden; }
  .bg-img { position: absolute; inset: 0; width: 210mm; height: 297mm; z-index: 0; }
  .bg-img img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .content {
    position: absolute; top: 35mm; left: 30mm; right: 20mm; bottom: 20mm; z-index: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .nomor-surat-wrapper { text-align: center; margin-bottom: 10px; padding-bottom: 8px; }
  .surat-title {
    font-size: 13pt;
    font-weight: bold;
    text-decoration: underline;
    text-underline-offset: 5px;
    text-transform: uppercase;
    margin-bottom: 4px;
    letter-spacing: 2px;
  }
  .surat-nomor { font-size: 10pt; margin-bottom: 14pt; }
  .body-text { font-size: 10.5pt; text-align: justify; line-height: 1.55; margin-bottom: 10px; }
  .data-table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 10.5pt; }
  .data-table td { padding: 3px 0; vertical-align: top; }
  .data-table td:first-child { width: 110px; }
  .data-table td:nth-child(2) { width: 20px; }
  .data-table td:last-child { padding-left: 6px; }
  .footer-statement { font-size: 10.5pt; text-align: justify; margin: 0 0 10px; line-height: 1.55; }
  .sign-area { padding: 16pt 0 0; flex-shrink: 0; display: flex; justify-content: flex-end; }
  .sign-box { display: flex; flex-direction: column; align-items: flex-start; font-size: 9pt; line-height: 1.4; gap: 1px; }
  .sign-place { font-size: 9pt; margin-bottom: 2px; }
  .qr-section-inline { margin: 4px 0; }
  .qr-wrap { position: relative; display: inline-block; }
  .qr-img { display: block; width: 60px; height: 60px; }
  .qr-logo { position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; transform: translate(-50%, -50%); border-radius: 50%; background: #fff; padding: 1px; }
  .sign-name { font-weight: bold; }
  .barcode-id { font-family: 'Courier New', monospace; font-size: 7pt; color: #555; letter-spacing: 1px; margin-top: 3px; }
  .recommendation-sign-gap { height: 45pt; flex-shrink: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; }
    .bg-img img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="a4-page">
  <div class="bg-img"><img src="${safe(backgroundUrl)}" alt="Background"/></div>
  <div class="content">
    <div class="nomor-surat-wrapper">
      <div class="surat-title">${safe(titleText)}</div>
      <div class="surat-nomor">Nomor : ${safe(nomorSurat)}</div>
    </div>
    <div class="body-text">${safe(openingText)}</div>
    <table class="data-table">
      <tbody>
        <tr><td>Nama</td><td>:</td><td style="font-weight:bold;">${safe(siswaNama)}</td></tr>
        <tr><td>NISN</td><td>:</td><td>${safe(siswaNisn)}</td></tr>
        <tr><td>Kelas</td><td>:</td><td>${safe(siswaKelas)}</td></tr>
      </tbody>
    </table>
    ${stateText ? `<div class="body-text" style="margin-top:2px;">${safe(stateText)}</div>` : ''}
    <table class="data-table">
      <tbody>
        <tr><td>${isRekomendasi ? 'Tanggal' : 'Waktu'}</td><td>:</td><td>${safe(formatDateId(tglMulai))}${tglSelesai && tglSelesai !== tglMulai ? ` s/d ${safe(formatDateId(tglSelesai))}` : ''}</td></tr>
        <tr><td>Keterangan</td><td>:</td><td>${safe(keterangan)}</td></tr>
      </tbody>
    </table>
    ${followupText ? `<div class="body-text" style="font-size:10pt;">${safe(followupText)}</div>` : ''}
    <div class="${isRekomendasi ? 'body-text' : 'footer-statement'}">${safe(footerText)}</div>
    ${isRekomendasi ? '<div class="recommendation-sign-gap"></div>' : ''}
    <div class="sign-area">
      <div class="sign-box">
        <div class="sign-place">Gowa, ${formatDateId(new Date().toISOString().slice(0, 10))}</div>
        <div>${safe(pejabatJabatan)}</div>
        <div class="qr-section-inline">
          <div class="qr-wrap">
            <img src="${safe(qrSrc)}" alt="QR Code" class="qr-img"/>
            <img src="${safe(logoSrc)}" alt="Logo" class="qr-logo"/>
          </div>
        </div>
        <div class="sign-name">${safe(pejabatNama)}</div>
        ${pejabatNip && pejabatNip !== '-' ? `<div>NIP. ${safe(pejabatNip)}</div>` : ''}
        <div class="barcode-id">${safe(barcode)}</div>
      </div>
    </div>
  </div>
</div>
${scriptTag}
</body>
</html>`;
}

export interface CollectiveHtmlParams {
  nomorSurat: string;
  barcode: string;
  rows: any[];
  tglMulai: string;
  tglSelesai: string;
  keterangan: string;
  pejabatNama: string;
  pejabatJabatan: string;
  pejabatNip: string;
  scanUrl: string;
  qrCodeUrl?: string;
  backgroundUrl: string;
  autoPrint?: boolean;
}

export function buildCollectiveHtml(params: CollectiveHtmlParams): string {
  const {
    nomorSurat, barcode, rows,
    tglMulai, tglSelesai,
    pejabatNama, pejabatJabatan, pejabatNip,
    scanUrl, qrCodeUrl, backgroundUrl,
    autoPrint = false,
  } = params;

  const qrSrc = qrCodeUrl || `/api/qrcode?data=${encodeURIComponent(scanUrl)}`;
  const safe = (value: unknown) => escapeHtml(String(value || '-'));
  const logoSrc = new URL('/logo-icon.png', scanUrl).toString();
  const ketList = rows.map((r) => String(r.keterangan || '').trim());
  const sharedKet = ketList.length > 0 && ketList.every((item) => item === ketList[0]) &&
    ketList[0] !== '' && ketList[0] !== '-'
    ? ketList[0]
    : '';
  const showKetColumn = !sharedKet;
  const rowsHtml = rows.map((r, i) => `
    <tr>
      <td class="cell-no">${i + 1}</td>
      <td>${safe(r.nama || r.siswa_nama)}</td>
      <td>${safe(r.nisn || r.siswa_nisn)}</td>
      <td>${safe(r.kelas || r.siswa_kelas)}</td>
      ${showKetColumn ? `<td>${safe(r.keterangan)}</td>` : ''}
    </tr>`).join('');
  const colWidthCss = showKetColumn
    ? `.grp-table th:nth-child(1), .grp-table td:nth-child(1) { width: 6%; }
  .grp-table th:nth-child(2), .grp-table td:nth-child(2) { width: 20%; }
  .grp-table th:nth-child(3), .grp-table td:nth-child(3) { width: 16%; }
  .grp-table th:nth-child(4), .grp-table td:nth-child(4) { width: 12%; }
  .grp-table th:nth-child(5), .grp-table td:nth-child(5) { width: 46%; }`
    : `.grp-table th:nth-child(1), .grp-table td:nth-child(1) { width: 7%; }
  .grp-table th:nth-child(2), .grp-table td:nth-child(2) { width: 47%; }
  .grp-table th:nth-child(3), .grp-table td:nth-child(3) { width: 26%; }
  .grp-table th:nth-child(4), .grp-table td:nth-child(4) { width: 20%; }`;

  const scriptTag = autoPrint
    ? `<script>
  window.addEventListener('load', function() {
    var imgs = Array.from(document.images);
    Promise.all(imgs.map(function(img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function(resolve) {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })).then(function() {
      setTimeout(function() { window.print(); }, 300);
    });
  });
</script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>SURAT IZIN MENINGGALKAN ASRAMA - ${safe(nomorSurat)}</title>
<style>
  @page { size: 210mm 297mm portrait; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; max-width: 210mm; font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; background: #fff; }
  .page-bg { position: fixed; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; pointer-events: none; background-image: url('${safe(backgroundUrl)}'); background-repeat: no-repeat; background-position: top left; background-size: 210mm 297mm; }
  .page-frame { width: 210mm; border-collapse: collapse; position: relative; z-index: 1; }
  .frame-top { height: 35mm; }
  .frame-bottom { height: 20mm; }
  .frame-body > td { padding: 0 20mm 0 30mm; vertical-align: top; }
  .nomor-surat-wrapper { text-align: center; margin-bottom: 10px; padding-bottom: 8px; }
  .surat-title { font-size: 13pt; font-weight: bold; text-decoration: underline; text-underline-offset: 5px; letter-spacing: 2px; margin-bottom: 4px; }
  .surat-nomor { font-size: 10pt; margin-bottom: 14pt; }
  .body-text { font-size: 10.5pt; line-height: 1.55; margin-bottom: 10px; text-align: justify; }
  .grp-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0 12px; }
  .grp-table th, .grp-table td { border: 1px solid #333; padding: 4px 6px; vertical-align: middle; word-break: break-word; }
  .grp-table th { background: #3083FF; color: #fff; text-align: center; font-weight: bold; }
  .grp-table thead { display: table-header-group; }
  .grp-table tr { break-inside: avoid; page-break-inside: avoid; }
  .cell-no { text-align: center; font-weight: bold; }
${colWidthCss}
  .data-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-bottom: 10px; }
  .data-table td { padding: 3px 0; vertical-align: top; }
  .data-table td:first-child { width: 110px; }
  .data-table td:nth-child(2) { width: 20px; }
  .data-table td:last-child { padding-left: 6px; }
  .sign-area { padding: 16pt 0 0; display: flex; justify-content: flex-end; break-inside: avoid; page-break-inside: avoid; }
  .sign-box { display: flex; flex-direction: column; align-items: flex-start; font-size: 9pt; line-height: 1.4; gap: 1px; }
  .sign-place { font-size: 9pt; margin-bottom: 2px; }
  .qr-section-inline { margin: 4px 0; }
  .qr-wrap { position: relative; display: inline-block; }
  .qr-img { display: block; width: 60px; height: 60px; }
  .qr-logo { position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; transform: translate(-50%, -50%); border-radius: 50%; background: #fff; padding: 1px; }
  .sign-name { font-weight: bold; }
  .barcode-id { font-family: 'Courier New', monospace; font-size: 7pt; color: #555; letter-spacing: 1px; margin-top: 3px; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; }
    .page-bg, .grp-table th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page-bg"></div>
<table class="page-frame">
  <thead><tr><td><div class="frame-top"></div></td></tr></thead>
  <tfoot><tr><td><div class="frame-bottom"></div></td></tr></tfoot>
  <tbody><tr class="frame-body"><td>
    <div class="nomor-surat-wrapper">
      <div class="surat-title">SURAT IZIN MENINGGALKAN ASRAMA</div>
      <div class="surat-nomor">Nomor : ${safe(nomorSurat)}</div>
    </div>
    <div class="body-text">
      Yang bertanda tangan di bawah ini adalah petugas pemberi izin MAN Insan Cendekia Gowa, menyatakan bahwa siswa-siswa berikut:
    </div>
    <table class="grp-table">
      <thead>
        <tr><th>No</th><th>Nama</th><th>NISN</th><th>Kelas</th>${showKetColumn ? '<th>Keterangan</th>' : ''}</tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="body-text" style="margin-top:2px;">diberikan izin meninggalkan asrama pada:</div>
    <table class="data-table">
      <tbody>
        <tr><td>Waktu</td><td>:</td><td>${safe(formatDateId(tglMulai))}${tglSelesai && tglSelesai !== tglMulai ? ` s/d ${safe(formatDateId(tglSelesai))}` : ''}</td></tr>
        ${sharedKet ? `<tr><td>Keperluan</td><td>:</td><td>${safe(sharedKet)}</td></tr>` : ''}
      </tbody>
    </table>
    <div class="body-text" style="margin-top:10px;">
      Izin ini diberikan berdasarkan pertimbangan kondisi dan kebutuhan siswa, serta telah melalui prosedur yang berlaku di sekolah/madrasah. Siswa diwajibkan untuk kembali ke lingkungan sekolah/madrasah tepat waktu sesuai ketentuan yang berlaku, serta melaporkan kehadirannya kepada pihak terkait setelah izin berakhir.
    </div>
    <div class="sign-area">
      <div class="sign-box">
        <div class="sign-place">Gowa, ${formatDateId(new Date().toISOString().slice(0, 10))}</div>
        <div>${safe(pejabatJabatan)}</div>
        <div class="qr-section-inline">
          <div class="qr-wrap">
            <img src="${safe(qrSrc)}" alt="QR Code" class="qr-img"/>
            <img src="${safe(logoSrc)}" alt="Logo" class="qr-logo"/>
          </div>
        </div>
        <div class="sign-name">${safe(pejabatNama)}</div>
        ${pejabatNip && pejabatNip !== '-' ? `<div>NIP. ${safe(pejabatNip)}</div>` : ''}
        <div class="barcode-id">${safe(barcode)}</div>
      </div>
    </div>
  </td></tr></tbody>
</table>
${scriptTag}
</body>
</html>`;
}

export interface RekapanHtmlParams {
  nomorSurat: string;
  barcode: string;
  letterType: string;
  monthName: string;
  year: number;
  pejabatNama: string;
  pejabatJabatan: string;
  pejabatNip: string;
  scanUrl: string;
  qrCodeUrl?: string;
  backgroundUrl: string;
  autoPrint?: boolean;
}

export function buildRekapanHtml(params: RekapanHtmlParams): string {
  const {
    nomorSurat, barcode, letterType,
    monthName, year,
    pejabatNama, pejabatJabatan, pejabatNip,
    scanUrl, qrCodeUrl, backgroundUrl,
    autoPrint = false,
  } = params;

  const qrSrc = qrCodeUrl || `/api/qrcode?data=${encodeURIComponent(scanUrl)}`;

  const isIzin = letterType === 'REKAPAN_IZIN';
  const titleText = isIzin ? 'REKAPITULASI IZIN SISWA' : 'REKAPITULASI PEMERIKSAAN KESEHATAN (SAKIT)';

  const scriptTag = autoPrint
    ? `<script>
  window.addEventListener('load', function() {
    var imgs = Array.from(document.images);
    Promise.all(imgs.map(function(img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function(resolve) {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })).then(function() {
      setTimeout(function() { window.print(); }, 300);
    });
  });
</script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${titleText} - ${monthName} ${year}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 210mm;
    height: 296.5mm;
    font-family: 'Times New Roman', serif;
    font-size: 11pt;
    position: relative;
    overflow: hidden;
    background: #fff;
  }
  .page-wrapper { position: relative; width: 210mm; height: 296.5mm; }
  .bg-img { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; }
  .bg-img img { width: 210mm; height: 100%; object-fit: cover; }
  .content {
    position: absolute;
    top: 38mm;
    left: 30mm;
    right: 30mm;
    bottom: 28mm;
    z-index: 1;
    display: flex;
    flex-direction: column;
  }
  .nomor-surat-wrapper { text-align: center; margin-bottom: 18px; }
  .surat-title {
    font-size: 12pt;
    font-weight: bold;
    text-decoration: underline;
    text-underline-offset: 5px;
    text-transform: uppercase;
    margin-bottom: 2px;
    letter-spacing: 1.5px;
  }
  .surat-nomor { font-size: 11pt; }
  .body-text { font-size: 11pt; text-align: justify; line-height: 1.6; margin-bottom: 12px; }
  .sign-area { margin-top: 30px; display: flex; justify-content: flex-end; padding-right: 5mm; }
  .sign-box { text-align: center; width: 260px; }
  .sign-place { font-size: 11pt; margin-bottom: 4px; }
  .sign-jabatan { font-size: 10pt; margin-bottom: 2px; }
  .sign-name { font-size: 11pt; font-weight: bold; margin-top: 4px; }
  .sign-nip { font-size: 9pt; margin-top: 2px; }
  .qr-section-inline { display: flex; flex-direction: column; align-items: center; margin: 8px 0; width: 100%; }
  .qr-img {
    width: 75px;
    height: 75px;
    display: block;
    object-fit: contain;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
  .barcode-id { font-family: 'Courier New', monospace; font-size: 7pt; color: #666; letter-spacing: 1px; margin-top: 4px; }
  @media print {
    html, body { height: 296.5mm; overflow: hidden; margin: 0 !important; padding: 0 !important; }
    .page-wrapper { page-break-after: avoid; page-break-before: avoid; break-after: avoid; }
    .bg-img img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page-wrapper">
  <div class="bg-img"><img src="${backgroundUrl}" alt="Background"/></div>
  <div class="content">
    <div class="nomor-surat-wrapper">
      <div class="surat-title">${titleText}</div>
      <div class="surat-nomor">Nomor : ${nomorSurat}</div>
    </div>
    <div class="body-text">
      Berdasarkan pencatatan sistem ketidakhadiran MAN Insan Cendekia Gowa, dengan ini diterbitkan lembar rekapitulasi data ketidakhadiran periode <b>${monthName} ${year}</b>.
    </div>
    <div class="body-text">
      Dokumen ini sah dan terverifikasi secara elektronik dalam sistem informasi madrasah (ACCA). Rincian data terlampir pada sistem dan dapat diverifikasi melalui pemindaian kode QR di bawah ini.
    </div>
    <div class="sign-area">
      <div class="sign-box">
        <div class="sign-place">Gowa, ${formatDateId(new Date().toISOString().slice(0, 10))}</div>
        <div class="sign-jabatan">${pejabatJabatan}</div>
        <div class="qr-section-inline">
          <img src="${qrSrc}" alt="QR Code" class="qr-img"/>
          <div class="barcode-id">${barcode}</div>
        </div>
        <div class="sign-name">${pejabatNama}</div>
        ${pejabatNip && pejabatNip !== '-' ? `<div class="sign-nip">NIP. ${pejabatNip}</div>` : ''}
      </div>
    </div>
  </div>
</div>
${scriptTag}
</body>
</html>`;
}
