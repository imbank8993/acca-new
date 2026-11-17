/**
 * Sumber tunggal untuk QR code persuratan ACCA (surat keluar, tanda tangan
 * digital, surat izin/ketidakhadiran, rekap UKS). Modul ini aman dipakai di
 * browser maupun server; pembuatan PNG ada di `acca-qr.server.ts`.
 *
 * Logo yang dipakai adalah simbol ACCA terbaru dari `branding.config.json`
 * (lihat `scripts/sync-branding.cjs`), sehingga mengganti branding cukup
 * dilakukan di satu tempat.
 */
import { APP_BRAND } from '@/lib/branding';

/** URL publik logo ACCA yang ditanam di tengah QR. */
export const ACCA_QR_LOGO_SRC = APP_BRAND.logo;

/** Opsi QR bersama: koreksi galat H agar tetap terbaca meski tengahnya tertutup logo. */
export const ACCA_QR_OPTIONS = {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 300,
    color: { dark: '#000000', light: '#ffffff' },
    /** Lebar pelat putih logo terhadap lebar gambar QR (±20–25%). */
    logoRatio: 0.22,
    /** Jarak logo ke tepi pelat putih, relatif terhadap lebar pelat. */
    logoPaddingRatio: 0.1,
} as const;

// Ikut berubah ketika logo branding berganti, supaya cache browser (max-age 1 tahun)
// untuk /api/qrcode tidak menyajikan QR dengan logo lama.
const LOGO_VERSION = APP_BRAND.logo.split('?v=')[1] || '1';

/**
 * URL gambar QR berlogo ACCA yang dilayani `/api/qrcode`.
 * Berikan `origin` bila URL harus absolut (mis. untuk template DOCX).
 */
export function accaQrImageUrl(data: string, origin = ''): string {
    return `${origin}/api/qrcode?data=${encodeURIComponent(data)}&logo=acca&v=${LOGO_VERSION}`;
}
