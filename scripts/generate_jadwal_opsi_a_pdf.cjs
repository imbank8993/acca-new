const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputPath = path.resolve(__dirname, '..', 'output', 'pdf', 'Jadwal_UAS_Kelas_XI_Opsi_A.pdf');
const htmlTempPath = path.resolve(__dirname, '..', 'scratch', 'jadwal_opsi_a.html');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.mkdirSync(path.dirname(htmlTempPath), { recursive: true });

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Jadwal PAS Kelas XI - Opsi A</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      font-size: 8.5pt;
      line-height: 1.25;
    }
    .header-box {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-text {
      text-align: center;
      flex-grow: 1;
    }
    .header-text h3 {
      margin: 0;
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-text h2 {
      margin: 2px 0;
      font-size: 13pt;
      font-weight: 800;
      color: #0369a1;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-text p {
      margin: 1px 0;
      font-size: 8pt;
      color: #475569;
    }
    .doc-title-box {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      padding: 6px 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-title-left h4 {
      margin: 0;
      font-size: 10pt;
      font-weight: 700;
      color: #166534;
    }
    .doc-title-left p {
      margin: 2px 0 0 0;
      font-size: 7.8pt;
      color: #15803d;
    }
    .badge-capsule {
      background: #0284c7;
      color: white;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
    }
    table.jadwal {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8pt;
    }
    table.jadwal th {
      background-color: #0f172a;
      color: #ffffff;
      padding: 6px 6px;
      text-align: center;
      font-weight: 600;
      font-size: 8pt;
      border: 1px solid #334155;
    }
    table.jadwal th.sub-th-wajib {
      background-color: #1e3a8a;
    }
    table.jadwal th.sub-th-peminatan {
      background-color: #047857;
    }
    table.jadwal td {
      padding: 5.5px 6px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    table.jadwal tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-bold { font-weight: 700; }
    .mapel-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 8.5pt;
    }
    .mapel-wajib {
      color: #1e40af;
      font-weight: 700;
    }
    .mapel-peminatan {
      color: #065f46;
      font-weight: 700;
    }
    .tag-rombel {
      display: inline-block;
      font-size: 7pt;
      background: #e2e8f0;
      color: #334155;
      padding: 1px 5px;
      border-radius: 3px;
      margin-top: 2px;
    }
    .badge-paralel {
      display: inline-block;
      font-size: 6.8pt;
      background: #fef08a;
      color: #854d0e;
      border: 1px solid #facc15;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 700;
      margin-left: 3px;
    }
    .peserta-count {
      font-weight: 700;
      color: #0f172a;
    }
    .keterangan-free {
      color: #64748b;
      font-size: 7.2pt;
      font-style: italic;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 12px;
      margin-top: 6px;
    }
    .notes-box {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 5px;
      padding: 6px 10px;
      font-size: 7.4pt;
    }
    .notes-box h5 {
      margin: 0 0 3px 0;
      font-size: 8pt;
      color: #0f172a;
      font-weight: 700;
    }
    .notes-box ul {
      margin: 0;
      padding-left: 14px;
    }
    .notes-box li {
      margin-bottom: 2px;
    }
    .signature-area {
      display: flex;
      justify-content: space-around;
      text-align: center;
      font-size: 7.8pt;
    }
    .signature-box {
      width: 48%;
    }
    .signature-space {
      height: 38px;
    }
  </style>
</head>
<body>

  <!-- KOP SURAT -->
  <div class="header-box">
    <div class="header-text">
      <h3>KEMENTERIAN AGAMA REPUBLIK INDONESIA</h3>
      <h2>MADRASAH ALIYAH NEGERI INSAN CENDEKIA GOWA</h2>
      <p>Panitia Penilaian Akhir Semester (PAS / ASAS) Ganjil • Tahun Ajaran 2026/2027</p>
      <p style="font-size: 7.5pt; color: #64748b;">Kampus: Jl. Pendidikan No. 1, Kab. Gowa, Sulawesi Selatan • Website: acca.icgowa.sch.id</p>
    </div>
  </div>

  <!-- TITLE BOX -->
  <div class="doc-title-box">
    <div class="doc-title-left">
      <h4>JADWAL PENILAIAN AKHIR SEMESTER (PAS) - KELAS XI</h4>
      <p><strong>SKEMA OPSI A: MODEL TERPADU (MAPEL UMUM & MAPEL PEMINATAN)</strong> • Durasi: 10 Hari (2 Sesi/Hari)</p>
    </div>
    <div>
      <span class="badge-capsule">Anti-Bocor & Zero Conflict</span>
    </div>
  </div>

  <!-- TABEL UTAMA -->
  <table class="jadwal">
    <thead>
      <tr>
        <th rowspan="2" style="width: 4%;">No</th>
        <th rowspan="2" style="width: 8%;">Hari / Sesi</th>
        <th colspan="3" class="sub-th-wajib" style="width: 40%;">SESI 1 (07.30 – 09.30) • MATA PELAJARAN UMUM / WAJIB</th>
        <th colspan="4" class="sub-th-peminatan" style="width: 48%;">SESI 2 (10.00 – 12.00) • MATA PELAJARAN PILIHAN / PEMINATAN</th>
      </tr>
      <tr>
        <th class="sub-th-wajib" style="width: 22%;">Mata Pelajaran</th>
        <th class="sub-th-wajib" style="width: 10%;">Peserta / Kelas</th>
        <th class="sub-th-wajib" style="width: 8%;">Jumlah</th>
        <th class="sub-th-peminatan" style="width: 20%;">Mata Pelajaran</th>
        <th class="sub-th-peminatan" style="width: 13%;">Rombel Kelompok</th>
        <th class="sub-th-peminatan" style="width: 6%;">Jumlah</th>
        <th class="sub-th-peminatan" style="width: 9%;">Keterangan</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center text-bold">1</td>
        <td class="text-center text-bold">Hari ke-1</td>
        <td class="mapel-wajib">Al-Qur'an Hadits</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Matematika Tingkat Lanjut</td>
        <td>XI MTL 1, 2, 3</td>
        <td class="text-center text-bold">55 Siswa</td>
        <td class="keterangan-free">17 siswa istirahat</td>
      </tr>
      <tr>
        <td class="text-center text-bold">2</td>
        <td class="text-center text-bold">Hari ke-2</td>
        <td class="mapel-wajib">Bahasa Indonesia</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Sosiologi</td>
        <td>XI Sosiologi 1, 2</td>
        <td class="text-center text-bold">21 Siswa</td>
        <td class="keterangan-free">51 siswa istirahat</td>
      </tr>
      <tr>
        <td class="text-center text-bold">3</td>
        <td class="text-center text-bold">Hari ke-3</td>
        <td class="mapel-wajib">Akidah Akhlak</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Biologi</td>
        <td>XI Biologi 1, 2, 3</td>
        <td class="text-center text-bold">47 Siswa</td>
        <td class="keterangan-free">25 siswa istirahat</td>
      </tr>
      <tr>
        <td class="text-center text-bold">4</td>
        <td class="text-center text-bold">Hari ke-4</td>
        <td class="mapel-wajib">Matematika (Umum)</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Informatika</td>
        <td>XI Informatika 1, 2</td>
        <td class="text-center text-bold">22 Siswa</td>
        <td class="keterangan-free">50 siswa istirahat</td>
      </tr>
      <tr>
        <td class="text-center text-bold">5</td>
        <td class="text-center text-bold">Hari ke-5</td>
        <td class="mapel-wajib">Fikih</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Kimia</td>
        <td>XI Kimia 1, 2, 3</td>
        <td class="text-center text-bold">52 Siswa</td>
        <td class="keterangan-free">20 siswa istirahat</td>
      </tr>
      <tr>
        <td class="text-center text-bold">6</td>
        <td class="text-center text-bold">Hari ke-6</td>
        <td class="mapel-wajib">Bahasa Inggris</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td>
          <div class="mapel-peminatan">B. Indonesia Lanjut <span class="badge-paralel">Paralel</span></div>
          <div class="mapel-peminatan" style="margin-top:2px;">Sejarah Tingkat Lanjut <span class="badge-paralel">Paralel</span></div>
        </td>
        <td>
          <div>XI BINDL 1 (10)</div>
          <div>XI SEJTL 1 (5)</div>
        </td>
        <td class="text-center text-bold">
          <div>10</div>
          <div>5</div>
        </td>
        <td class="keterangan-free">
          Total 15 siswa<br>(57 siswa istirahat)
        </td>
      </tr>
      <tr>
        <td class="text-center text-bold">7</td>
        <td class="text-center text-bold">Hari ke-7</td>
        <td class="mapel-wajib">Sejarah Kebudayaan Islam (SKI)</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Bahasa Inggris Tingkat Lanjut</td>
        <td>XI BIL 1, 2</td>
        <td class="text-center text-bold">50 Siswa</td>
        <td class="keterangan-free">22 siswa istirahat</td>
      </tr>
      <tr>
        <td class="text-center text-bold">8</td>
        <td class="text-center text-bold">Hari ke-8</td>
        <td class="mapel-wajib">Pendidikan Pancasila</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Ekonomi</td>
        <td>XI Ekonomi 1, 2</td>
        <td class="text-center text-bold">25 Siswa</td>
        <td class="keterangan-free">47 siswa istirahat</td>
      </tr>
      <tr>
        <td class="text-center text-bold">9</td>
        <td class="text-center text-bold">Hari ke-9</td>
        <td class="mapel-wajib">Bahasa Arab (Wajib)</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td>
          <div class="mapel-peminatan">Fisika <span class="badge-paralel">Paralel</span></div>
          <div class="mapel-peminatan" style="margin-top:2px;">Bahasa Arab Lanjut <span class="badge-paralel">Paralel</span></div>
        </td>
        <td>
          <div>XI Fisika 1, 2, 3 (29)</div>
          <div>XI BAL 1 (5)</div>
        </td>
        <td class="text-center text-bold">
          <div>29</div>
          <div>5</div>
        </td>
        <td class="keterangan-free">
          Total 34 siswa<br>(38 siswa istirahat)
        </td>
      </tr>
      <tr>
        <td class="text-center text-bold">10</td>
        <td class="text-center text-bold">Hari ke-10</td>
        <td class="mapel-wajib">Sejarah (Umum)</td>
        <td class="text-center">XI A, B, C, D</td>
        <td class="text-center text-bold">72 Siswa</td>
        <td class="mapel-peminatan">Geografi</td>
        <td>XI Geografi 1, 2, 3</td>
        <td class="text-center text-bold">39 Siswa</td>
        <td class="keterangan-free">33 siswa istirahat</td>
      </tr>
    </tbody>
  </table>

  <!-- FOOTER & CATATAN -->
  <div class="footer-grid">
    <div class="notes-box">
      <h5>CATATAN PENTING & JAMINAN INTEGRITAS SISTEM CBT:</h5>
      <ul>
        <li><strong>Jaminan Bebas Bocor (Anti-Leak)</strong>: Setiap bank soal untuk seluruh 12 mapel pilihan hanya diujikan tepat 1 kali serentak bagi semua siswa pemilih. Tidak ada bank soal yang diulang atau melompat hari.</li>
        <li><strong>Zero Conflict (0 Bentrok)</strong>: Terverifikasi secara matematis terhadap data riil 72 siswa Kelas XI. Dua sesi paralel (Hari 6: B.Indo Lanjut & Sejarah Lanjut; Hari 9: Fisika & B.Arab Lanjut) memiliki 0 irisan siswa pemilih.</li>
        <li><strong>Stamina & Beban Siswa Seimbang</strong>: Setiap siswa mengambil 5 mapel pilihan, sehingga selama 10 hari ujian, setiap siswa hanya menjalani ujian 2 sesi sebanyak 5 kali. Pada 5 hari lainnya, siswa selesai pukul 09.30 WITA.</li>
        <li><strong>Ruang Ujian</strong>: Sesi 1 menggunakan kelas homeroom (XI A, B, C, D). Sesi 2 menggunakan Laboratorium CBT / Ruang Ujian Peminatan.</li>
      </ul>
    </div>
    <div class="signature-area">
      <div class="signature-box">
        <p style="margin:0;">Mengetahui,<br><strong>Kepala Madrasah</strong></p>
        <div class="signature-space"></div>
        <p style="margin:0; text-decoration: underline; font-weight:700;">Burhanuddin, S.Ag., M.Pd.</p>
        <p style="margin:0; font-size: 7pt; color:#64748b;">NIP. 197003151998031004</p>
      </div>
      <div class="signature-box">
        <p style="margin:0;">Gowa, 23 Oktober 2026<br><strong>Ketua Panitia PAS</strong></p>
        <div class="signature-space"></div>
        <p style="margin:0; text-decoration: underline; font-weight:700;">Hasmirawati, S.Pd.I., M.Pd.</p>
        <p style="margin:0; font-size: 7pt; color:#64748b;">NIP. 199208302023212038</p>
      </div>
    </div>
  </div>

</body>
</html>
`;

fs.writeFileSync(htmlTempPath, htmlContent, 'utf-8');
console.log('HTML written to:', htmlTempPath);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cmd = `"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPath}" "${htmlTempPath}"`;
console.log('Generating PDF via Chrome...');

try {
  execSync(cmd, { stdio: 'inherit' });
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    console.log(`SUCCESS: PDF generated successfully!`);
    console.log(`Path: ${outputPath}`);
    console.log(`Size: ${stats.size} bytes`);
  } else {
    console.error('PDF file was not created.');
    process.exitCode = 1;
  }
} catch (e) {
  console.error('Error executing Chrome:', e.message);
  process.exitCode = 1;
}
