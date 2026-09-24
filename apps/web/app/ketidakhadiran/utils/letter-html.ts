export function getMonthRoman(month: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[month - 1] || 'I';
}

export function formatDateId(d?: string | null): string {
  if (!d) return '-';
  try {
    const dt = new Date(d + (d.includes('T') ? '' : 'T00:00:00'));
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
  backgroundUrl: string;
  autoPrint?: boolean;
}

export function buildSingleHtml(params: SingleHtmlParams): string {
  const {
    nomorSurat, barcode, siswaNama, siswaNisn, siswaKelas,
    tglMulai, tglSelesai, keterangan,
    pejabatNama, pejabatJabatan, pejabatNip,
    scanUrl, qrCodeUrl, letterType, backgroundUrl,
    autoPrint = false,
  } = params;

  const qrSrc = qrCodeUrl || `/api/qrcode?data=${encodeURIComponent(scanUrl)}`;

  let titleText = 'SURAT IZIN MENINGGALKAN ASRAMA';
  let openingText = 'Yang bertanda tangan di bawah ini adalah petugas pemeriksa / pemberi izin MAN Insan Cendekia Gowa, menerangkan bahwa siswa berikut:';
  let stateText = 'diberikan izin dengan rincian sebagai berikut:';
  let footerText = 'Demikian surat ini diberikan untuk dapat dipergunakan sebagaimana mestinya. Siswa diwajibkan kembali ke madrasah / asrama tepat waktu sesuai batas waktu yang telah ditentukan.';

  if (letterType === 'REKAM_MEDIK') {
    titleText = 'SURAT KETERANGAN REKAM MEDIK';
    openingText = 'Yang bertanda tangan di bawah ini adalah petugas kesehatan / UKS MAN Insan Cendekia Gowa, menerangkan bahwa siswa berikut:';
    stateText = 'telah dilakukan pemeriksaan kesehatan dengan rincian sebagai berikut:';
    footerText = 'Demikian surat keterangan rekam medik ini diberikan untuk dapat dipergunakan sebagaimana mestinya.';
  } else if (
    letterType === 'REKOMENDASI_KONTROL' ||
    letterType === 'SAKIT' ||
    (Boolean(nomorSurat) && nomorSurat.includes('/UKS/'))
  ) {
    titleText = 'SURAT REKOMENDASI KONTROL';
    openingText = 'Yang bertanda tangan di bawah ini adalah petugas pemeriksa / UKS MAN Insan Cendekia Gowa, menerangkan bahwa siswa berikut:';
    stateText = 'diberikan rekomendasi kontrol / perawatan dengan rincian sebagai berikut:';
    footerText = 'Demikian surat rekomendasi kontrol ini diberikan untuk dapat dipergunakan sebagaimana mestinya.';
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
<title>${titleText} - ${nomorSurat}</title>
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
  .data-table { margin: 10px 0; font-size: 11pt; }
  .data-row { display: flex; margin-bottom: 6px; }
  .data-label { width: 110px; min-width: 110px; flex-shrink: 0; }
  .data-colon { width: 20px; flex-shrink: 0; }
  .data-value { flex: 1; }
  .footer-statement { font-size: 11pt; text-align: justify; margin-top: 10px; margin-bottom: 10px; line-height: 1.6; }
  .sign-area { margin-top: 24px; display: flex; justify-content: flex-end; padding-right: 5mm; }
  .sign-box { text-align: center; width: 260px; }
  .sign-place { font-size: 11pt; margin-bottom: 4px; }
  .sign-date { font-size: 11pt; margin-bottom: 10px; }
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
    <div class="body-text">${openingText}</div>
    <div class="data-table">
      <div class="data-row"><span class="data-label">Nama</span><span class="data-colon">:</span><span class="data-value" style="font-weight: bold;">${siswaNama}</span></div>
      <div class="data-row"><span class="data-label">NISN</span><span class="data-colon">:</span><span class="data-value">${siswaNisn}</span></div>
      <div class="data-row"><span class="data-label">Kelas</span><span class="data-colon">:</span><span class="data-value">${siswaKelas || '-'}</span></div>
    </div>
    <div class="body-text" style="margin-top: 10px;">${stateText}</div>
    <div class="data-table">
      <div class="data-row"><span class="data-label">Waktu Mulai</span><span class="data-colon">:</span><span class="data-value">${formatDateId(tglMulai)}</span></div>
      <div class="data-row"><span class="data-label">Waktu Selesai</span><span class="data-colon">:</span><span class="data-value">${formatDateId(tglSelesai || tglMulai)}</span></div>
      <div class="data-row"><span class="data-label">Keterangan</span><span class="data-colon">:</span><span class="data-value">${keterangan || '-'}</span></div>
    </div>
    <div class="footer-statement">${footerText}</div>
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
    tglMulai, tglSelesai, keterangan,
    pejabatNama, pejabatJabatan, pejabatNip,
    scanUrl, qrCodeUrl, backgroundUrl,
    autoPrint = false,
  } = params;

  const qrSrc = qrCodeUrl || `/api/qrcode?data=${encodeURIComponent(scanUrl)}`;

  const rowsHtml = (rows || [])
    .map(
      (r, i) => `
    <tr>
      <td style="text-align:center;padding:6px;border:1px solid #333;">${i + 1}</td>
      <td style="padding:6px;border:1px solid #333;font-weight:bold;">${r.nama || r.siswa_nama || '-'}</td>
      <td style="text-align:center;padding:6px;border:1px solid #333;">${r.nisn || r.siswa_nisn || '-'}</td>
      <td style="text-align:center;padding:6px;border:1px solid #333;">${r.kelas || r.siswa_kelas || '-'}</td>
    </tr>`,
    )
    .join('');

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
<title>SURAT IZIN MENINGGALKAN ASRAMA (KOLEKTIF) - ${nomorSurat}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 210mm;
    min-height: 296.5mm;
    font-family: 'Times New Roman', serif;
    font-size: 10.5pt;
    position: relative;
    background: #fff;
  }
  .page-wrapper { position: relative; width: 210mm; min-height: 296.5mm; }
  .bg-img { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; }
  .bg-img img { width: 210mm; height: 100%; object-fit: cover; }
  .content {
    position: relative;
    padding: 38mm 25mm 25mm 25mm;
    z-index: 1;
    display: flex;
    flex-direction: column;
  }
  .nomor-surat-wrapper { text-align: center; margin-bottom: 14px; }
  .surat-title {
    font-size: 12pt;
    font-weight: bold;
    text-decoration: underline;
    text-underline-offset: 5px;
    text-transform: uppercase;
    margin-bottom: 2px;
    letter-spacing: 1.2px;
  }
  .surat-nomor { font-size: 11pt; }
  .body-text { font-size: 10.5pt; text-align: justify; line-height: 1.5; margin-bottom: 10px; }
  table.student-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 10pt;
  }
  table.student-table th {
    background: #f1f5f9;
    border: 1px solid #333;
    padding: 6px;
    text-align: center;
  }
  .footer-statement { font-size: 10.5pt; text-align: justify; margin-top: 8px; margin-bottom: 8px; line-height: 1.5; }
  .sign-area { margin-top: 16px; display: flex; justify-content: flex-end; padding-right: 5mm; }
  .sign-box { text-align: center; width: 260px; }
  .sign-place { font-size: 10.5pt; margin-bottom: 2px; }
  .sign-jabatan { font-size: 10pt; margin-bottom: 2px; }
  .sign-name { font-size: 10.5pt; font-weight: bold; margin-top: 4px; }
  .sign-nip { font-size: 9pt; margin-top: 2px; }
  .qr-section-inline { display: flex; flex-direction: column; align-items: center; margin: 6px 0; width: 100%; }
  .qr-img {
    width: 70px;
    height: 70px;
    display: block;
    object-fit: contain;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
  .barcode-id { font-family: 'Courier New', monospace; font-size: 7pt; color: #666; letter-spacing: 1px; margin-top: 3px; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; }
    .bg-img img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page-wrapper">
  <div class="bg-img"><img src="${backgroundUrl}" alt="Background"/></div>
  <div class="content">
    <div class="nomor-surat-wrapper">
      <div class="surat-title">SURAT IZIN MENINGGALKAN ASRAMA (KOLEKTIF)</div>
      <div class="surat-nomor">Nomor : ${nomorSurat}</div>
    </div>
    <div class="body-text">
      Yang bertanda tangan di bawah ini adalah petugas pemeriksa / pemberi izin MAN Insan Cendekia Gowa, menerangkan bahwa siswa-siswa berikut diberikan izin meninggalkan asrama secara kolektif:
    </div>
    <table class="student-table">
      <thead>
        <tr>
          <th style="width: 35px;">No</th>
          <th>Nama Siswa</th>
          <th style="width: 110px;">NISN</th>
          <th style="width: 80px;">Kelas</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div class="body-text" style="margin-top: 8px;">
      <b>Waktu:</b> ${formatDateId(tglMulai)} s.d. ${formatDateId(tglSelesai || tglMulai)}<br/>
      <b>Keterangan:</b> ${keterangan || '-'}
    </div>
    <div class="footer-statement">
      Demikian surat izin ini diberikan secara kolektif untuk dapat dipergunakan sebagaimana mestinya. Seluruh siswa diwajibkan kembali ke madrasah / asrama tepat waktu sesuai jadwal yang telah disepakati.
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
