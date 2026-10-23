import type { CertificateTemplate, TextPlacement, IdentityPlacement, CertificateSigner } from './model';

export const PT_PER_MM = 72 / 25.4;
export const mmToPt = (value: number) => value * PT_PER_MM;
export const ptToMm = (value: number) => value / PT_PER_MM;
export const roundPoint = (value: number) => Math.round(value * 10000) / 10000;
export const MIN_QR_MM = 20;
export function fitLayerPlacement(placement: TextPlacement, patch: Partial<TextPlacement>, page: { width: number; height: number }, qr = false): Partial<TextPlacement> {
    const width = Math.min(qr ? Math.min(page.width, page.height) : page.width, Math.max(qr ? mmToPt(MIN_QR_MM) : 1, patch.width ?? placement.width));
    const height = qr ? width : (patch.size ?? placement.size) * 1.3;
    return { ...patch, width: roundPoint(width),
        x: roundPoint(Math.max(0, Math.min(page.width - width, patch.x ?? placement.x))),
        y: roundPoint(Math.max(0, Math.min(page.height - height, patch.y ?? placement.y))) };
}
export function resizeLayerWidth(placement: TextPlacement, page: { width: number; height: number }, deltaX: number, deltaY: number, qr = false) {
    const maximum = qr ? Math.min(page.width - placement.x, page.height - placement.y) : page.width - placement.x;
    const delta = qr && Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX;
    return Math.min(maximum, Math.max(qr ? mmToPt(MIN_QR_MM) : 1, placement.width + delta));
}
export function pointPlacement(item: TextPlacement, page: { width: number; height: number }, alreadyPoints: boolean): TextPlacement {
    return alreadyPoints ? { ...item } : { ...item, x: item.x * page.width / 100, y: item.y * page.height / 100, width: item.width * page.width / 100 };
}
/** Old issued snapshots retain percentage semantics. Only editable designs are upgraded. */
export function pointTemplate(template: CertificateTemplate, page: { width: number; height: number }, identityKeys: string[] = []): CertificateTemplate {
    const isPoints = template.unit === 'pt';
    const result: CertificateTemplate = { ...template, unit: 'pt', page: { width: page.width, height: page.height },
        name: pointPlacement(template.name, page, isPoints), institution: pointPlacement(template.institution, page, isPoints),
        identities: pointPlacement(template.identities, page, isPoints), number: pointPlacement(template.number, page, isPoints),
        visible: { ...template.visible },
        qr: isPoints ? { ...template.qr } : { x: template.qr.x * page.width / 100, y: template.qr.y * page.height / 100, size: template.qr.size * page.width / 100 },
        signers: (template.signers || []).map(signer => ({ ...signer, nameLayout: { ...signer.nameLayout }, titleLayout: { ...signer.titleLayout } })),
        identityFields: { ...template.identityFields },
    };
    if (!isPoints) {
        result.qr.size = Math.max(72 / 25.4 * 20, result.qr.size);
        result.qr.x = Math.min(result.qr.x, page.width - result.qr.size);
        result.qr.y = Math.min(result.qr.y, page.height - result.qr.size);
    }
    const keys = [...new Set([...Object.keys(result.identityFields || {}), ...identityKeys])].filter(key => !['__proto__', 'prototype', 'constructor'].includes(key));
    keys.slice(0, 30).forEach((key, index) => {
        if (!Object.hasOwn(result.identityFields!, key)) result.identityFields![key] = {
            ...result.identities, y: Math.min(page.height - 28, result.identities.y + index * result.identities.size * 1.8),
            visible: template.visible.identities, showLabel: false,
        };
    });
    return result;
}
export function newSigner(page: { width: number; height: number }, index = 0): CertificateSigner {
    const width = Math.min(220, page.width * .32);
    const base: TextPlacement = { x: Math.min(page.width - width, page.width * (.12 + index * .3)), y: page.height * .85,
        width, size: 12, color: '#17335c', align: 'center' };
    return { id: crypto.randomUUID(), name: '', title: '', print: true, nameLayout: { ...base }, titleLayout: { ...base, y: base.y + 18, size: 10 } };
}
export type CertificateLayer = { id: string; label: string; text: string; placement: TextPlacement; qr?: boolean };
export function templateLayers(template: CertificateTemplate, example: { name: string; institution: string; identities: Record<string, string> }, number: string): CertificateLayer[] {
    const layers: CertificateLayer[] = [{ id: 'name', label: 'Nama peserta', text: example.name || 'Nama Peserta Contoh', placement: template.name }];
    if (template.visible.institution) layers.push({ id: 'institution', label: 'Asal sekolah / instansi', text: example.institution || 'Asal Sekolah / Instansi', placement: template.institution });
    for (const [key, item] of Object.entries(template.identityFields || {})) if (item.visible) layers.push({ id: `identity:${key}`, label: key,
        text: item.showLabel ? `${key}: ${example.identities[key] || key}` : example.identities[key] || key, placement: item });
    if (template.visible.number) layers.push({ id: 'number', label: 'Nomor sertifikat', text: number, placement: template.number });
    (template.signers || []).filter(signer => signer.print).forEach(signer => {
        layers.push({ id: `signer:${signer.id}:name`, label: `Nama ${signer.name || 'penandatangan'}`, text: signer.name || 'Nama penandatangan', placement: signer.nameLayout });
        layers.push({ id: `signer:${signer.id}:title`, label: `Jabatan ${signer.name || 'penandatangan'}`, text: signer.title || 'Jabatan penandatangan', placement: signer.titleLayout });
    });
    layers.push({ id: 'qr', label: 'QR verifikasi', text: 'QR', qr: true, placement: { x: template.qr.x, y: template.qr.y, width: template.qr.size, size: template.qr.size, align: 'left', color: '#000000' } });
    return layers;
}
export function changeLayer(template: CertificateTemplate, id: string, patch: Partial<TextPlacement>): CertificateTemplate {
    if (id === 'qr') return { ...template, qr: { x: patch.x ?? template.qr.x, y: patch.y ?? template.qr.y, size: patch.width ?? template.qr.size } };
    if (id.startsWith('identity:')) {
        const key = id.slice(9), item = template.identityFields?.[key];
        if (!item) return template;
        return { ...template, identityFields: { ...template.identityFields, [key]: { ...item, ...patch } as IdentityPlacement } };
    }
    if (id.startsWith('signer:')) return { ...template, signers: (template.signers || []).map(signer =>
        id === `signer:${signer.id}:name` ? { ...signer, nameLayout: { ...signer.nameLayout, ...patch } }
            : id === `signer:${signer.id}:title` ? { ...signer, titleLayout: { ...signer.titleLayout, ...patch } } : signer) };
    if (['name', 'institution', 'number'].includes(id)) {
        const key = id as 'name' | 'institution' | 'number'; return { ...template, [key]: { ...template[key], ...patch } };
    }
    return template;
}
