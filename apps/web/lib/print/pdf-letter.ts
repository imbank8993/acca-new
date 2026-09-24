/**
 * PDF Letter Generator
 *
 * Generates styled A4 HTML letters with:
 *   - ACCA background image
 *   - QR code (with ACCA logo in center)
 *   - Student data (nama, NISN, kelas, tanggal, keterangan)
 *   - Auto-triggers browser print dialog (user saves as PDF)
 *
 * Used for: MENINGGALKAN_ASRAMA, REKOMENDASI_KONTROL, SAKIT (PDF path)
 * NOT used for: IZIN_SINGLE, IZIN_GROUP, TUGAS_SINGLE, TUGAS_GROUP (those use .docx templates)
 */

import { getUploadUrl } from '@/lib/file-storage';
import { prisma } from '@/lib/prisma';
import https from 'https';

/** Result of opening a PDF-ready letter in a new window */
export interface PdfLetterResult {
    barcode: string;
    scanUrl: string;
}

function generateBarcode(): string {
    return 'ACCA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getMonthRoman(month: number): string {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[month - 1] || 'I';
}

function formatDateId(d: string): string {
    if (!d) return '-';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Surat Umum config (background + logo QR) ─────────────────
interface SuratUmumConfig {
    backgroundUrl: string | null;
    logoQrUrl: string | null;
}

async function getSuratUmumConfig(letterType?: string): Promise<SuratUmumConfig> {
    try {
        let backgroundUrl: string | null = null;

        // 1. Try to get specific template uploaded for this letter type first
        if (letterType) {
            const templateData = await prisma.surat_templates.findFirst({
                where: { jenis_surat: letterType, is_active: true },
                select: { template_html: true }
            });
            
            if (templateData?.template_html && typeof templateData.template_html === 'string' && templateData.template_html.trim().startsWith('http')) {
                const url = templateData.template_html.trim();
                const isWordFile = url.toLowerCase().endsWith('.docx') || url.toLowerCase().endsWith('.doc');
                if (!isWordFile) {
                    backgroundUrl = url;
                }
            }
        }

        // 2. Fallback to config_surat
        const configData = await prisma.config_surat.findFirst({
            where: { is_default: true },
            select: { background_url: true, logo_kecil_url: true }
        });

        if (!backgroundUrl && configData?.background_url) {
            backgroundUrl = configData.background_url;
        }

        // 3. Fallback to profil_sekolah
        if (!backgroundUrl) {
            const profilData = await prisma.profil_sekolah.findFirst({
                select: { background_surat_url: true }
            });
            if (profilData?.background_surat_url) {
                backgroundUrl = profilData.background_surat_url;
            }
        }

        return {
            backgroundUrl,
            logoQrUrl: configData?.logo_kecil_url || null,
        };
    } catch {
        return { backgroundUrl: null, logoQrUrl: null };
    }
}

// ── Upload HTML blob to hosting ───────────────────────────────
async function uploadToHosting(blob: Blob, fileName: string, folder: string): Promise<string> {
    const uploadUrl = await getUploadUrl();
    if (!uploadUrl) throw new Error('Konfigurasi penyimpanan file belum diset.');

    const targetUrl = new URL(uploadUrl);
    const fileBuffer = Buffer.from(await blob.arrayBuffer());
    const boundary = '----AccaUpload' + Math.random().toString(36).substring(2);
    const chunks: Buffer[] = [];
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="folder"\r\n\r\n${folder}\r\n`));
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
    chunks.push(Buffer.from(`Content-Type: text/html\r\n\r\n`));
    chunks.push(fileBuffer);
    chunks.push(Buffer.from('\r\n'));
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const bodyBuffer = Buffer.concat(chunks);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: targetUrl.hostname,
            path: targetUrl.pathname + `?folder=${encodeURIComponent(folder)}`,
            method: 'POST',
            rejectUnauthorized: false,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length,
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.ok && json.publicUrl) resolve(json.publicUrl);
                    else reject(new Error(json.error || 'Upload failed'));
                } catch {
                    reject(new Error('Invalid response from hosting server'));
                }
            });
        });
        req.on('error', reject);
        req.write(bodyBuffer);
        req.end();
    });
}

// ── HTML generator ───────────────────────────────────────────
function buildLetterHtml(params: {
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
    tempatTtd: string;
    tanggalTtd: string;
    scanUrl: string;
    letterType: 'MENINGGALKAN_ASRAMA' | 'REKOMENDASI_KONTROL';
    suratUmumConfig: SuratUmumConfig;
}): string {
    const {
        nomorSurat, barcode, siswaNama, siswaNisn, siswaKelas,
        tglMulai, tglSelesai, keterangan,
        pejabatNama, pejabatJabatan, pejabatNip,
        tempatTtd, tanggalTtd, scanUrl,
        letterType, suratUmumConfig,
    } = params;

    const isRekom = letterType === 'REKOMENDASI_KONTROL';
    const bgUrl = suratUmumConfig?.backgroundUrl || '/images/Surat ACCA.png';
    const qrLogoUrl = '/logo-icon.png';
    const titleText = isRekom ? 'SURAT REKOMENDASI KONTROL' : 'SURAT IZIN MENINGGALKAN ASRAMA';
    const openingText = 'Yang bertanda tangan di bawah ini adalah petugas pemberi izin MAN Insan Cendekia Gowa, menyatakan bahwa siswa berikut:';
    const stateText = 'diberikan izin dengan keterangan dan keperluan sebagai berikut:';
    const footerText = 'Izin ini diberikan berdasarkan pertimbangan kondisi dan kebutuhan siswa, serta telah melalui prosedur yang berlaku di sekolah/madrasah. Siswa diwajibkan untuk kembali ke lingkungan sekolah/madrasah tepat waktu sesuai ketentuan yang berlaku, serta melaporkan kehadirannya kepada pihak terkait setelah izin berakhir.';

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
    text-decoration: underline;
    text-underline-offset: 5px;
    text-transform: uppercase;
    margin-bottom: 2px;
    letter-spacing: 1.5px;
  }
  .surat-nomor { font-size: 11pt; }
  .body-text { font-size: 11pt; text-align: justify; line-height: 1.6; margin-bottom: 12px; }
  .data-table { margin: 10px 0 10px 0; font-size: 11pt; }
  .data-row { display: flex; margin-bottom: 6px; }
  .data-label { width: 110px; min-width: 110px; flex-shrink: 0; }
  .data-colon { width: 20px; flex-shrink: 0; }
  .data-value { flex: 1; }
  .footer-statement { font-size: 11pt; text-align: justify; margin-top: 6px; margin-bottom: 10px; }
  .sign-area { margin-top: 30px; display: flex; justify-content: flex-end; padding-right: 5mm; }
  .sign-box { text-align: center; width: 260px; }
  .sign-place { font-size: 11pt; margin-bottom: 4px; }
  .sign-date { font-size: 11pt; margin-bottom: 50px; }
  .sign-jabatan { font-size: 9pt; margin-bottom: 2px; }
  .sign-name { font-size: 11pt; margin-top: 4px; }
  .sign-nip { font-size: 9pt; margin-top: 2px; }
  .qr-section-inline { display: flex; flex-direction: column; align-items: center; margin: 10px 0 8px 0; width: 100%; }
  .qr-wrapper { position: relative; display: inline-block; }
  .qr-img { width: 75px; height: 75px; display: block; }
  .qr-logo {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 24px; height: 24px; border-radius: 50%;
    background: #fff; padding: 1px; box-shadow: 0 1px 4px rgba(0,0,0,0.2);
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
  <div class="bg-img"><img src="${bgUrl}" alt="Template Background"/></div>
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
      <div class="data-row"><span class="data-label">Waktu</span><span class="data-colon">:</span><span class="data-value">${formatDateId(tglMulai)}</span></div>
      <div class="data-row"><span class="data-label">Keterangan</span><span class="data-colon">:</span><span class="data-value">${keterangan || '-'}</span></div>
    </div>
    <div class="footer-statement" style="margin-bottom: 10px;">${footerText}</div>
    <div class="sign-area">
      <div class="sign-box">
        <div class="sign-place">${tempatTtd}, ${formatDateId(tanggalTtd)}</div>
        <div class="sign-jabatan">${pejabatJabatan}</div>
        <div class="qr-section-inline">
          <div class="qr-wrapper">
            <img src="/api/qrcode?data=${encodeURIComponent(scanUrl)}" alt="QR" class="qr-img"/>
            <img src="${qrLogoUrl}" alt="Logo" class="qr-logo"/>
          </div>
          <div class="barcode-id">${barcode}</div>
        </div>
        <div class="sign-name">${pejabatNama}</div>
        ${pejabatNip ? `<div class="sign-nip">NIP. ${pejabatNip}</div>` : ''}
      </div>
    </div>
  </div>
</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 600); }; </script>
</body>
</html>`;
}

// ── Get pejabat from ID ───────────────────────────────────────
async function resolvePejabat(pejabatId: string): Promise<{ nama: string; nip: string; jabatan: string }> {
    try {
        const numericId = parseInt(pejabatId, 10);
        if (!isNaN(numericId)) {
            const data = await prisma.master_guru.findUnique({
                where: { id: numericId },
                select: { nama_lengkap: true, nip: true }
            });
            if (data) return { nama: data.nama_lengkap || '-', nip: data.nip || '-', jabatan: 'Guru' };
        }
        if (typeof pejabatId === 'string' && pejabatId.length > 5) {
            const data = await prisma.master_guru.findFirst({
                where: { nip: pejabatId },
                select: { nama_lengkap: true, nip: true }
            });
            if (data) return { nama: data.nama_lengkap || '-', nip: data.nip || '-', jabatan: 'Guru' };
        }
        return { nama: pejabatId, nip: '-', jabatan: '-' };
    } catch {
        return { nama: pejabatId, nip: '-', jabatan: '-' };
    }
}

// ── Main export: open PDF letter in new window ───────────────
/**
 * Open a PDF-ready letter (styled HTML) in a new browser window.
 * Auto-triggers window.print() so the user can Save as PDF.
 *
 * @param row           Student absence row
 * @param letterType    'MENINGGALKAN_ASRAMA' | 'REKOMENDASI_KONTROL'
 * @param pejabatId    ID or NIP or name of signing official (optional)
 * @param pejabatJabatan Custom jabatan string (optional)
 */
export async function openPdfLetter(
    row: any,
    letterType: 'MENINGGALKAN_ASRAMA' | 'REKOMENDASI_KONTROL',
    pejabatId?: string,
    pejabatJabatan?: string,
): Promise<PdfLetterResult> {
    const tahun = new Date().getFullYear();
    const bulan = new Date().getMonth() + 1;
    const monthRoman = getMonthRoman(bulan);
    const barcode = generateBarcode();

    // Resolve pejabat
    let pejabatNama = 'Imran, S.Si.';
    let pejabatNip = '-';
    let pejabatJabatanFinal = pejabatJabatan || 'Guru';

    if (pejabatId) {
        const resolved = await resolvePejabat(pejabatId);
        pejabatNama = resolved.nama;
        pejabatNip = resolved.nip;
        if (!pejabatJabatan) pejabatJabatanFinal = resolved.jabatan;
    }

    // Scan URL
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let scanBase = origin;
    if (scanBase.includes('localhost')) {
        const envUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (envUrl && !envUrl.includes('localhost')) scanBase = envUrl;
        else scanBase = 'https://acca.icgowa.sch.id';
    }
    const scanUrl = `${scanBase}/ketidakhadiran/verify/${barcode}`;

    // Generate letter number
    const isRekom = letterType === 'REKOMENDASI_KONTROL';
    const nomorSurat = isRekom
        ? `001/UKS/${monthRoman}/${tahun}`
        : `001/IZIN/P/${monthRoman}/${tahun}`;

    // Fetch config
    const suratUmumConfig = await getSuratUmumConfig(letterType);

    const html = buildLetterHtml({
        nomorSurat,
        barcode,
        siswaNama: row.nama || '-',
        siswaNisn: row.nisn || '-',
        siswaKelas: row.kelas || '-',
        tglMulai: row.tgl_mulai || '',
        tglSelesai: row.tgl_selesai || row.tgl_mulai || '',
        keterangan: (row.keterangan || '').replace(/\|/g, ', '),
        pejabatNama,
        pejabatJabatan: pejabatJabatanFinal,
        pejabatNip,
        tempatTtd: 'Gowa',
        tanggalTtd: new Date().toISOString().split('T')[0],
        scanUrl,
        letterType,
        suratUmumConfig,
    });

    // Open in new window → auto-prints
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        // Popup blocked — fall back to link click
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.click();
    }

    return { barcode, scanUrl };
}