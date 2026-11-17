import 'server-only';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { APP_LOGO_DATA_URI } from '@/lib/branding-logo';
import { ACCA_QR_OPTIONS } from './acca-qr-config';

export { ACCA_QR_OPTIONS, ACCA_QR_LOGO_SRC, accaQrImageUrl } from './acca-qr-config';

const LOGO_BUFFER = Buffer.from(APP_LOGO_DATA_URI.slice(APP_LOGO_DATA_URI.indexOf(',') + 1), 'base64');

export interface AccaQrOptions {
    /** Lebar gambar QR dalam piksel (termasuk quiet zone). */
    width?: number;
    /** Quiet zone dalam jumlah modul. */
    margin?: number;
    /** `false` untuk QR polos tanpa logo. */
    withLogo?: boolean;
}

/** Membuat PNG QR code dengan logo ACCA terbaru di tengahnya (error correction H). */
export async function createAccaQrPng(data: string, options: AccaQrOptions = {}): Promise<Buffer> {
    const qr = await QRCode.toBuffer(data, {
        type: 'png',
        width: Math.max(64, Math.round(options.width ?? ACCA_QR_OPTIONS.width)),
        margin: options.margin ?? ACCA_QR_OPTIONS.margin,
        errorCorrectionLevel: ACCA_QR_OPTIONS.errorCorrectionLevel,
        color: { ...ACCA_QR_OPTIONS.color },
    });
    if (options.withLogo === false) return qr;

    try {
        const size = (await sharp(qr).metadata()).width ?? 0;
        const plate = Math.round(size * ACCA_QR_OPTIONS.logoRatio);
        const padding = Math.max(1, Math.round(plate * ACCA_QR_OPTIONS.logoPaddingRatio));
        const inner = plate - padding * 2;
        if (inner < 8) return qr;

        const logo = await sharp(LOGO_BUFFER)
            .resize({ width: inner, height: inner, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer();
        const radius = Math.round(plate * 0.18);
        const plateSvg = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${plate}" height="${plate}"><rect width="${plate}" height="${plate}" rx="${radius}" ry="${radius}" fill="${ACCA_QR_OPTIONS.color.light}"/></svg>`,
        );
        const offset = Math.round((size - plate) / 2);
        return await sharp(qr)
            .composite([
                { input: plateSvg, left: offset, top: offset },
                { input: logo, left: offset + padding, top: offset + padding },
            ])
            .png()
            .toBuffer();
    } catch (error) {
        console.error('[ACCA-QR] Gagal menanam logo, memakai QR polos:', error);
        return qr;
    }
}

/** Versi data URL (`data:image/png;base64,...`) dari {@link createAccaQrPng}. */
export async function createAccaQrDataUrl(data: string, options: AccaQrOptions = {}): Promise<string> {
    const png = await createAccaQrPng(data, options);
    return `data:image/png;base64,${png.toString('base64')}`;
}
