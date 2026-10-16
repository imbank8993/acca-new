import { DEFAULT_TEMPLATE, type CertificateTemplate } from './model';

export class CertificateError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export const uuid = (value: unknown) => {
    if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) throw new CertificateError('ID tidak valid');
    return value;
};
export function text(value: unknown, label: string, max = 200, required = true): string {
    if (value == null && !required) return '';
    if (typeof value !== 'string') throw new CertificateError(`${label} harus berupa teks`);
    const result = value.trim().normalize('NFC');
    if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) throw new CertificateError(`${label} wajib diisi, maksimal ${max} karakter`);
    return result;
}
function date(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new CertificateError('Tanggal kegiatan tidak valid');
    return value;
}
function bounded(value: unknown, min: number, max: number, label: string) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new CertificateError(`${label} harus antara ${min} dan ${max}`);
    return value;
}
export function validateTemplate(input: unknown): CertificateTemplate {
    const candidate = (input || DEFAULT_TEMPLATE) as CertificateTemplate;
    const result = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)) as CertificateTemplate;
    result.assetId = candidate.assetId ? uuid(candidate.assetId) : null;
    if (candidate.unit !== undefined && candidate.unit !== 'pt') throw new CertificateError('Satuan tata letak tidak valid');
    const points = candidate.unit === 'pt';
    const page = points ? { width: bounded(candidate.page?.width, 72, 20000, 'Lebar template'), height: bounded(candidate.page?.height, 72, 20000, 'Tinggi template') } : { width: 100, height: 100 };
    if (points) { result.unit = 'pt'; result.page = page; }
    const placement = (item: any) => {
        if (!item || !['left', 'center', 'right'].includes(item.align) || !/^#[a-f\d]{6}$/i.test(item.color)) throw new CertificateError('Pengaturan teks tidak valid');
        const value = { x: bounded(item.x, 0, points ? page.width : 95, 'Posisi X'), y: bounded(item.y, 0, points ? page.height - 8 : 92, 'Posisi Y'),
            width: bounded(item.width, points ? 1 : 5, page.width, 'Lebar teks'), size: bounded(item.size, 8, 60, 'Ukuran teks'), align: item.align, color: item.color };
        if (value.x + value.width > page.width + .001) throw new CertificateError('Teks melewati batas template');
        return value;
    };
    for (const key of ['name', 'institution', 'identities', 'number'] as const) {
        result[key] = placement(candidate[key]);
    }
    const qr = candidate.qr;
    if (!qr) throw new CertificateError('Posisi QR wajib ditentukan');
    result.qr = { x: bounded(qr.x, 0, page.width, 'Posisi QR X'), y: bounded(qr.y, 0, page.height, 'Posisi QR Y'), size: bounded(qr.size, points ? 56.69 : 8, points ? Math.min(page.width, page.height) : 25, 'Ukuran QR') };
    if (qr.x + qr.size > page.width + .001 || (points && qr.y + qr.size > page.height + .001)) throw new CertificateError('QR melewati batas template');
    for (const key of ['institution', 'identities', 'number'] as const) result.visible[key] = candidate.visible?.[key] !== false;
    if (points) {
        if (candidate.signers !== undefined && (!Array.isArray(candidate.signers) || candidate.signers.length > 3)) throw new CertificateError('Maksimal 3 penandatangan');
        const seen = new Set<string>();
        result.signers = (candidate.signers || []).map(signer => {
            if (!signer || typeof signer !== 'object' || Array.isArray(signer)) throw new CertificateError('Penandatangan tidak valid');
            const id = uuid(signer.id); if (seen.has(id)) throw new CertificateError('Penandatangan ganda'); seen.add(id);
            return { id, name: text(signer.name, 'Nama penandatangan', 180, false), title: text(signer.title, 'Jabatan', 200, false), print: signer.print !== false,
                nameLayout: placement(signer.nameLayout), titleLayout: placement(signer.titleLayout) };
        });
        const fields = candidate.identityFields || {};
        if (typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).length > 30) throw new CertificateError('Kolom identitas tidak valid');
        result.identityFields = Object.create(null);
        for (const [key, value] of Object.entries(fields)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new CertificateError('Nama kolom tidak valid');
            const name = text(key, 'Nama kolom', 50);
            result.identityFields![name] = { ...placement(value), visible: value.visible !== false, showLabel: value.showLabel === true };
        }
    }
    return result;
}
export function validateEvent(body: any) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CertificateError('Data kegiatan tidak valid');
    const start = date(body.start_date), end = date(body.end_date);
    if (end < start) throw new CertificateError('Tanggal akhir tidak boleh sebelum tanggal mulai');
    const prefix = text(body.number_prefix, 'Awalan nomor', 60);
    if (!/^[A-Za-z0-9._/-]+$/.test(prefix)) throw new CertificateError('Awalan nomor hanya boleh berisi huruf, angka, titik, garis miring, dan tanda hubung');
    return { title: text(body.title, 'Nama kegiatan'), organizer: text(body.organizer, 'Penyelenggara'),
        description: text(body.description, 'Keterangan', 3000, false), location: text(body.location, 'Lokasi', 200, false),
        start_date: start, end_date: end, number_prefix: prefix, template: validateTemplate(body.template), archived: body.archived === true };
}
export function validateRecipients(input: unknown) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 500) throw new CertificateError('Impor harus berisi 1–500 peserta');
    const seen = new Set<string>();
    return input.map(row => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new CertificateError('Data peserta tidak valid');
        const id = uuid(row.id);
        if (seen.has(id)) throw new CertificateError('ID peserta ganda');
        seen.add(id);
        const identities: Record<string, string> = Object.create(null);
        if (row.identities && (typeof row.identities !== 'object' || Array.isArray(row.identities))) throw new CertificateError('Identitas tambahan tidak valid');
        const entries = Object.entries(row.identities || {});
        if (entries.length > 8) throw new CertificateError('Maksimal 8 identitas tambahan');
        for (const [key, value] of entries) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new CertificateError('Nama kolom tidak valid');
            identities[text(key, 'Nama kolom', 50)] = text(value, 'Identitas', 200, false);
        }
        return { id, name: text(row.name, 'Nama peserta', 180), institution: text(row.institution, 'Asal sekolah / instansi', 200, false), identities };
    });
}
