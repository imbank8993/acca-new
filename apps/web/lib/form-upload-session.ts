import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
export const FORM_UPLOAD_COOKIE = 'acca_form_upload';
export function formUploadSession(existing?: string): { token: string; owner: string } {
    const secret = process.env.INTERNAL_API_KEY;
    if (!secret) throw new Error('Konfigurasi sesi unggahan belum tersedia');
    if (existing) {
        const [id, signature] = existing.split('.');
        const issued = Number(id?.split('_')[0]);
        if (existing.split('.').length === 2 && /^\d{13}_[a-f0-9-]{36}$/.test(id || '') && issued <= Date.now() + 60000 && Date.now() - issued < 86400000) {
            const expected = createHmac('sha256', secret).update(id).digest('hex');
            if (signature?.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return { token: existing, owner: `guest:${id}` };
        }
    }
    const id = `${Date.now()}_${randomUUID()}`;
    return { token: `${id}.${createHmac('sha256', secret).update(id).digest('hex')}`, owner: `guest:${id}` };
}
