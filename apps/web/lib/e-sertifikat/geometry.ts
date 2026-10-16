import { PDFDocument } from 'pdf-lib';
import { CertificateError } from './validation';
import type { CertificateTemplate } from './model';

export type TemplateGeometry = { width: number; height: number; rotation: number; pixels?: { width: number; height: number }; dpi?: { x: number; y: number }; densitySource?: 'metadata' | 'default' };
/** Preserve image print density where supplied. Images without print metadata use 96 dpi. */
function density(bytes: Uint8Array, mime: string) {
    const b = Buffer.from(bytes); let x = 96, y = 96, source: 'metadata' | 'default' = 'default';
    if (mime === 'image/png') {
        for (let offset = 8; offset + 12 <= b.length;) {
            const length = b.readUInt32BE(offset);
            if (offset + length + 12 > b.length) break;
            if (b.toString('ascii', offset + 4, offset + 8) === 'pHYs' && length === 9 && b[offset + 16] === 1) {
                x = b.readUInt32BE(offset + 8) * .0254; y = b.readUInt32BE(offset + 12) * .0254; source = 'metadata'; break;
            }
            offset += length + 12;
        }
    } else {
        for (let offset = 2; offset + 4 < b.length;) {
            if (b[offset] !== 255) break;
            const marker = b[offset + 1]; if (marker === 218 || marker === 217) break;
            const length = b.readUInt16BE(offset + 2); if (length < 2 || offset + 2 + length > b.length) break;
            if (marker === 224 && length >= 16 && b.toString('ascii', offset + 4, offset + 9) === 'JFIF\0') {
                const unit = b[offset + 11], factor = unit === 1 ? 1 : unit === 2 ? 2.54 : 0;
                if (factor) { x = b.readUInt16BE(offset + 12) * factor; y = b.readUInt16BE(offset + 14) * factor; source = 'metadata'; }
                break;
            }
            offset += length + 2;
        }
    }
    if (x < 10 || y < 10 || x > 2400 || y > 2400) throw new CertificateError('Metadata resolusi gambar tidak valid. Simpan ulang template.');
    return { x, y, source };
}
export async function templateGeometry(asset: { mime: string; bytes: Uint8Array }): Promise<TemplateGeometry> {
    if (asset.mime === 'application/pdf') {
        const doc = await PDFDocument.load(asset.bytes, { updateMetadata: false });
        if (doc.getPageCount() !== 1) throw new CertificateError('Template PDF harus tepat satu halaman');
        const page = doc.getPage(0), crop = page.getCropBox(), rotation = ((page.getRotation().angle % 360) + 360) % 360;
        if (![0, 90, 180, 270].includes(rotation)) throw new CertificateError('Rotasi halaman PDF tidak didukung');
        return { width: rotation % 180 ? crop.height : crop.width, height: rotation % 180 ? crop.width : crop.height, rotation };
    }
    const doc = await PDFDocument.create();
    const image = asset.mime === 'image/png' ? await doc.embedPng(asset.bytes) : await doc.embedJpg(asset.bytes);
    const dpi = density(asset.bytes, asset.mime), width = image.width * 72 / dpi.x, height = image.height * 72 / dpi.y;
    if (width < 72 || height < 72 || width > 20000 || height > 20000) throw new CertificateError('Ukuran fisik template di luar rentang yang didukung');
    return { width, height, rotation: 0, pixels: { width: image.width, height: image.height }, dpi: { x: dpi.x, y: dpi.y }, densitySource: dpi.source };
}
export function assertPageGeometry(template: CertificateTemplate, geometry: TemplateGeometry) {
    if (template.unit === 'pt' && (!template.page || Math.abs(template.page.width - geometry.width) > .01 || Math.abs(template.page.height - geometry.height) > .01))
        throw new CertificateError('Ukuran tata letak berbeda dari template asli. Buka kembali editor template.');
}
