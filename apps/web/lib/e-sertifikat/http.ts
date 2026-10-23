import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../prisma';
import { getApiUser } from '../api-auth';
import { CertificateService, assertManager, verifyUrl, type CertificateDb } from './service';
import { CertificateError, text, uuid, validateTemplate } from './validation';
import { templateGeometry } from './geometry';
import { Prisma } from '@prisma/client';
import { renderCertificate, validateAsset } from './pdf';
import { mapParticipantColumns, readParticipantExcel } from './excel';
import { limitPublicCertificateRequest } from './rate-limit';
import JSZip from 'jszip';
import { validateRecipients } from './validation';

const db: CertificateDb = {
    $queryRaw: query => prisma.$queryRaw(query),
    $executeRaw: query => prisma.$executeRaw(query),
    $transaction: callback => prisma.$transaction(tx => callback(tx as unknown as CertificateDb), { timeout: 60000, maxWait: 10000 }),
};
const service = new CertificateService(db);
const json = (data: unknown) => NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
function binary(bytes: Uint8Array, mime: string, filename: string, attachment = true) {
    return new NextResponse(new Uint8Array(bytes), { headers: {
        'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${attachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Security-Policy': "default-src 'none'; sandbox", 'X-Robots-Tag': 'noindex, nofollow',
    } });
}
function failed(error: unknown) {
    if (error instanceof CertificateError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store', ...(error.status === 429 ? { 'Retry-After': '60' } : {}) } });
    const code = (error as any)?.code;
    if (code === 'P2010' && ['42P01', '42703', '42501'].includes((error as any)?.meta?.code)) return NextResponse.json({ ok: false, error: 'Modul e-sertifikat belum diaktifkan. Administrator perlu menjalankan migrasi database.' }, { status: 503 });
    if (code === 'P2010' && (error as any)?.meta?.code === '23505') return NextResponse.json({ ok: false, error: 'Awalan atau nomor sertifikat sudah digunakan. Gunakan awalan unik untuk kegiatan ini.' }, { status: 409 });
    console.error('[e-sertifikat] request failed', (error as any)?.code || 'UNKNOWN');
    return NextResponse.json({ ok: false, error: 'Permintaan e-sertifikat gagal diproses' }, { status: 500 });
}
async function limitedBody(request: NextRequest, max: number) {
    if (Number(request.headers.get('content-length') || 0) > max) throw new CertificateError('Data terlalu besar', 413);
    const reader = request.body?.getReader();
    if (!reader) throw new CertificateError('Data kosong');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > max) { await reader.cancel(); throw new CertificateError('Data terlalu besar', 413); }
        chunks.push(part.value);
    }
    return Buffer.concat(chunks, size);
}
async function body(request: NextRequest) {
    const bytes = await limitedBody(request, 2 * 1024 * 1024);
    try { const result = JSON.parse(bytes.toString('utf8')); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result; }
    catch { throw new CertificateError('Data JSON tidak valid'); }
}
async function upload(request: NextRequest) {
    const bytes = await limitedBody(request, 6 * 1024 * 1024);
    let form: FormData;
    try { form = await new Response(new Uint8Array(bytes), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData(); }
    catch { throw new CertificateError('Data unggahan tidak valid'); }
    const file = form.get('file');
    if (!(file instanceof File)) throw new CertificateError('Pilih berkas terlebih dahulu');
    return { file, form };
}
async function readUploadedParticipants(file: File) {
    try { return await readParticipantExcel(file); }
    catch (error) {
        if (error instanceof CertificateError) throw error;
        throw new CertificateError('Excel rusak atau tidak dapat dibaca. Simpan ulang sebagai .xls atau .xlsx.');
    }
}
export async function manage(request: NextRequest, path: string[] = []) {
    try {
        const user = await getApiUser(request); assertManager(user);
        // Same-origin mutation guard in addition to HttpOnly session validation.
        const origin = request.headers.get('origin');
        if (!['GET', 'HEAD'].includes(request.method) && origin && origin !== request.nextUrl.origin && origin !== new URL(verifyUrl('')).origin) throw new CertificateError('Asal permintaan tidak diizinkan', 403);
        if (!path.length) {
            if (request.method === 'GET') return json(await service.list(user, request.nextUrl.searchParams));
            if (request.method === 'POST') return json(await service.saveEvent(user, await body(request)));
        }
        if (path[0] === 'excel' && path.length === 1 && request.method === 'POST') {
            const { file } = await upload(request);
            return json(await readUploadedParticipants(file));
        }
        if (path[0] === 'signers' && path.length === 1 && request.method === 'GET')
            return json(await db.$queryRaw(Prisma.sql`SELECT id::text AS id,nama_lengkap FROM master_guru ORDER BY nama_lengkap LIMIT 1000`));
        const eventId = uuid(path[0]);
        if (path[1] === 'geometry' && path.length === 3 && request.method === 'GET') {
            const asset = await service.asset(user, eventId, path[2]);
            if (asset.kind !== 'template') throw new CertificateError('Pilih berkas template');
            return json(await templateGeometry(asset));
        }
        if (path.length === 1) {
            if (request.method === 'GET') return json(await service.detail(user, eventId));
            if (request.method === 'PATCH') return json(await service.saveEvent(user, await body(request), eventId));
        }
        if (path[1] === 'recipients' && path.length === 2 && request.method === 'POST') {
            if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new CertificateError('Penerima hanya dapat ditambahkan melalui impor Excel');
            const { file, form } = await upload(request);
            let mapping: unknown, ids: unknown;
            try { mapping = JSON.parse(String(form.get('mapping'))); ids = JSON.parse(String(form.get('ids'))); }
            catch { throw new CertificateError('Pemetaan kolom Excel tidak valid'); }
            const table = await readUploadedParticipants(file);
            return json(await service.importRecipients(user, eventId, mapParticipantColumns(table, mapping, ids)));
        }
        if (path[1] === 'recipients' && path.length === 3 && request.method === 'DELETE') {
            await service.removeDraft(user, eventId, path[2]); return json(null);
        }
        if (path[1] === 'recipients' && path.length === 3 && request.method === 'PATCH') {
            await service.updateDraft(user, eventId, path[2], await body(request)); return json(null);
        }
        if (path[1] === 'issue' && path.length === 2 && request.method === 'POST') {
            return json(await service.issue(user, eventId, (await body(request)).ids,
                async (snapshot, number, asset) => { await renderCertificate(snapshot, number, verifyUrl('0'.repeat(48)), asset); }));
        }
        if (path[1] === 'preview' && path.length === 2 && request.method === 'POST') {
            const event = await service.event(user, eventId);
            const payload = await body(request);
            const template = validateTemplate(payload.template || event.template);
            if (!template.assetId) throw new CertificateError('Unggah template terlebih dahulu');
            const example = validateRecipients([{ id: '00000000-0000-4000-8000-000000000001',
                name: payload.name || 'Nama Peserta Contoh', institution: payload.institution || '', identities: payload.identities || {} }])[0];
            const asset = await service.asset(user, eventId, template.assetId);
            if (asset.kind !== 'template') throw new CertificateError('Pilih berkas template');
            const bytes = await renderCertificate({ event, template,
                name: example.name, institution: example.institution,
                identities: example.identities }, `${event.number_prefix}/0001`, verifyUrl('0'.repeat(48)), asset, true);
            return binary(bytes, 'application/pdf', 'pratinjau-sertifikat.pdf', false);
        }
        if (path[1] === 'download' && path.length === 2 && request.method === 'POST') {
            const { ids } = await body(request);
            if (!Array.isArray(ids) || ids.length < 1 || ids.length > 25) throw new CertificateError('Pilih 1–25 sertifikat terbit untuk unduhan ZIP');
            await service.event(user, eventId);
            const archive = new JSZip(); let totalBytes = 0;
            for (const recipientId of [...new Set(ids.map(uuid))]) {
                const row = await service.certificate(user, eventId, recipientId);
                const asset = await service.asset(user, eventId, row.snapshot.template.assetId);
                const pdf = await renderCertificate(row.snapshot, row.certificate_number, verifyUrl(row.verify_token, row.snapshot.verification_origin), asset);
                totalBytes += pdf.length;
                if (totalBytes > 50 * 1024 * 1024) throw new CertificateError('Ukuran gabungan melebihi 50 MB. Unduh lebih sedikit sertifikat sekaligus.');
                archive.file(`sertifikat-${row.certificate_number.replace(/[^\w.-]/g, '-')}-${row.id.slice(0, 8)}.pdf`, pdf);
            }
            return binary(await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }), 'application/zip', 'sertifikat-kegiatan.zip');
        }
        if (path[1] === 'certificates' && path.length === 4) {
            if (path[3] === 'pdf' && request.method === 'GET') {
                const row = await service.certificate(user, eventId, path[2]);
                const asset = await service.asset(user, eventId, row.snapshot.template.assetId);
                return binary(await renderCertificate(row.snapshot, row.certificate_number, verifyUrl(row.verify_token, row.snapshot.verification_origin), asset),
                    'application/pdf', `sertifikat-${row.certificate_number.replace(/[^\w.-]/g, '-')}.pdf`);
            }
            if (path[3] === 'revoke' && request.method === 'POST') {
                await service.revoke(user, eventId, path[2], (await body(request)).reason); return json(null);
            }
        }
        if (path[1] === 'assets') {
            if (path.length === 2 && request.method === 'POST') {
                await service.event(user, eventId);
                const { file, form } = await upload(request);
                const kind = String(form.get('kind') || 'documentation');
                let asset;
                try { asset = await validateAsset(file, kind); }
                catch (error) { if (error instanceof CertificateError) throw error; throw new CertificateError('Berkas rusak, terenkripsi, atau tidak dapat dibaca'); }
                return json(await service.addAsset(user, eventId, { kind, filename: text(file.name, 'Nama berkas', 160), mime: asset.mime, bytes: Buffer.from(asset.bytes) }));
            }
            if (path.length === 3 && request.method === 'GET') {
                const asset = await service.asset(user, eventId, path[2]); return binary(asset.bytes, asset.mime, asset.filename, asset.mime === 'application/pdf');
            }
            if (path.length === 3 && request.method === 'PATCH') {
                await service.visibility(user, eventId, path[2], (await body(request)).is_public); return json(null);
            }
            if (path.length === 3 && request.method === 'DELETE') {
                await service.removeAsset(user, eventId, path[2]); return json(null);
            }
        }
        throw new CertificateError('Rute tidak ditemukan', 404);
    } catch (error) { return failed(error); }
}

export async function publicRead(request: NextRequest, path: string[]) {
    try {
        await limitPublicCertificateRequest(db, path[0] || '');
        if (path.length === 1) {
            const response = json(await service.verification(path[0])); response.headers.set('X-Robots-Tag', 'noindex, nofollow'); return response;
        }
        if (path.length === 3 && path[1] === 'files') {
            const asset = await service.asset(null, null, path[2], path[0]); return binary(asset.bytes, asset.mime, asset.filename, asset.mime === 'application/pdf');
        }
        throw new CertificateError('Rute tidak ditemukan', 404);
    } catch (error) { return failed(error); }
}
