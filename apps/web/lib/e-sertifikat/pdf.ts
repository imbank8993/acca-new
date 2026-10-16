import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import type { CertificateSnapshot, TextPlacement } from './model';
import { CertificateError } from './validation';
import { templateGeometry, assertPageGeometry } from './geometry';

export type TemplateAsset = { mime: string; bytes: Uint8Array };
export async function validateAsset(file: File, kind: string): Promise<TemplateAsset> {
    if (!file.size || file.size > 5 * 1024 * 1024) throw new CertificateError('Ukuran berkas harus 1 byte–5 MB');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let mime = '';
    if (Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-') {
        mime = 'application/pdf';
        const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
        if (!pdf.getPageCount() || pdf.getPageCount() > (kind === 'template' ? 1 : 50)) throw new CertificateError(kind === 'template' ? 'Template PDF harus tepat satu halaman' : 'PDF pendukung maksimal 50 halaman');
        for (const page of pdf.getPages()) {
            const { width, height } = page.getSize();
            if (width < 200 || height < 200 || width > 2000 || height > 2000) throw new CertificateError('Ukuran halaman PDF tidak didukung');
        }
    } else {
        const doc = await PDFDocument.create();
        const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
        const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!png && !jpg) throw new CertificateError('Berkas harus PDF, PNG, atau JPG yang valid');
        // Check IHDR before PNG decompression to reject oversized compressed images.
        if (png) {
            const header = Buffer.from(bytes);
            if (header.length < 33 || header.toString('ascii', 12, 16) !== 'IHDR') throw new CertificateError('Header PNG tidak valid');
            const width = header.readUInt32BE(16), height = header.readUInt32BE(20);
            if (width < 100 || height < 100 || width * height > 24_000_000) throw new CertificateError('Resolusi gambar harus minimal 100 piksel dan maksimal 24 megapiksel');
        }
        const image = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        if (image.width * image.height > 24_000_000 || image.width < 100 || image.height < 100) throw new CertificateError('Resolusi gambar harus minimal 100 piksel dan maksimal 24 megapiksel');
        mime = png ? 'image/png' : 'image/jpeg';
    }
    return { mime, bytes };
}
function linesFor(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/)) {
            const candidate = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
            if (line) { lines.push(line); line = ''; }
            for (const char of word) {
                if (font.widthOfTextAtSize(line + char, size) > width && line) { lines.push(line); line = ''; }
                line += char;
            }
        }
        lines.push(line);
    }
    return lines;
}
export async function renderCertificate(snapshot: CertificateSnapshot, number: string, url: string, asset: TemplateAsset, preview = false) {
    const doc = await PDFDocument.create();
    const geometry = await templateGeometry(asset);
    assertPageGeometry(snapshot.template, geometry);
    let { width, height } = geometry;
    const { rotation } = geometry;
    // Previously issued image snapshots used A4 width; keep their output stable.
    if (snapshot.template.unit !== 'pt' && asset.mime !== 'application/pdf') {
        const ratio = height / width; width = ratio > 1 ? 595.28 : 841.89; height = width * ratio;
    }
    const page = doc.addPage([width, height]);
    if (asset.mime === 'application/pdf') {
        const source = await PDFDocument.load(asset.bytes);
        const sourcePage = source.getPage(0), crop = sourcePage.getCropBox();
        const embedded = await doc.embedPage(sourcePage, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
        page.drawPage(embedded, { x: rotation === 180 || rotation === 270 ? width : 0,
            y: rotation === 90 || rotation === 180 ? height : 0, rotate: degrees(-rotation) });
    } else {
        const image = asset.mime === 'image/png' ? await doc.embedPng(asset.bytes) : await doc.embedJpg(asset.bytes);
        page.drawImage(image, { x: 0, y: 0, width, height });
    }
    const points = snapshot.template.unit === 'pt';
    const normal = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const draw = (raw: string, position: TextPlacement, font: PDFFont, maxLines: number) => {
        if (!raw) return;
        const value = raw.replace(/\t/g, ' ').replace(/\r/g, '');
        const areaWidth = points ? position.width : width * position.width / 100;
        const top = points ? position.y : height * position.y / 100, left = points ? position.x : width * position.x / 100;
        let size = position.size, lines: string[];
        try {
            lines = linesFor(value, font, size, areaWidth);
            while (lines.length > maxLines && size > 8) { size -= 0.5; lines = linesFor(value, font, size, areaWidth); }
        } catch { throw new CertificateError('Ada karakter yang belum didukung font template. Gunakan huruf Latin untuk teks yang dicetak.'); }
        if (lines.length > maxLines) throw new CertificateError('Teks terlalu panjang untuk area template. Lebarkan area teks atau kecilkan font.');
        const color = position.color.slice(1);
        lines.forEach((line, index) => {
            const lineWidth = font.widthOfTextAtSize(line, size);
            const x = left + (position.align === 'center' ? (areaWidth - lineWidth) / 2 : position.align === 'right' ? areaWidth - lineWidth : 0);
            const y = height - top - size - index * size * 1.3;
            if (y < 8) throw new CertificateError('Teks melewati batas bawah template');
            page.drawText(line, { x, y, size, font, color: rgb(parseInt(color.slice(0, 2), 16) / 255, parseInt(color.slice(2, 4), 16) / 255, parseInt(color.slice(4, 6), 16) / 255) });
        });
    };
    draw(snapshot.name, snapshot.template.name, bold, 2);
    if (snapshot.template.visible.institution && snapshot.institution) draw(snapshot.institution, snapshot.template.institution, normal, 2);
    if (points) {
        for (const [key, layout] of Object.entries(snapshot.template.identityFields || {})) {
            const value = snapshot.identities[key];
            if (layout.visible && value) draw(layout.showLabel ? `${key}: ${value}` : value, layout, normal, 2);
        }
        for (const signer of snapshot.template.signers || []) if (signer.print) {
            draw(signer.name, signer.nameLayout, bold, 2); draw(signer.title, signer.titleLayout, normal, 2);
        }
    } else if (snapshot.template.visible.identities) draw(Object.entries(snapshot.identities).map(([key, value]) => `${key}: ${value}`).join('\n'), snapshot.template.identities, normal, 8);
    if (snapshot.template.visible.number) draw(number, snapshot.template.number, normal, 1);
    const qr = snapshot.template.qr, size = points ? qr.size : width * qr.size / 100;
    const qx = points ? qr.x : width * qr.x / 100, qy = points ? qr.y : height * qr.y / 100;
    if (size < 56 || qy + size > height + .001 || qx + size > width + .001 || qx < 0 || qy < 0) throw new CertificateError('QR terlalu kecil atau keluar dari template. Gunakan ukuran minimal 20 mm dan sesuaikan posisi Y.');
    const png = await QRCode.toBuffer(url, { type: 'png', width: 512, margin: 4, errorCorrectionLevel: 'M' });
    page.drawImage(await doc.embedPng(png), { x: qx, y: height - qy - size, width: size, height: size });
    if (preview) page.drawText('PRATINJAU - BELUM DITERBITKAN', { x: 12, y: 12, size: 9, color: rgb(.7, .15, .15), font: bold });
    doc.setTitle(`Sertifikat ${snapshot.name}`); doc.setAuthor(snapshot.event.organizer); doc.setCreator('ACCA E-Sertifikat');
    return doc.save();
}
