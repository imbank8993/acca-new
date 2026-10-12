import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { uploadFile } from '@/lib/storage';
import { getMimeTypeFromFileName } from '@/lib/storage/mime';
import { formUploadSession, FORM_UPLOAD_COOKIE } from '@/lib/form-upload-session';

const ALLOWED = new Set(['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','jpg','jpeg','png','webp','zip']);
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const fieldId = req.nextUrl.searchParams.get('field') || '';
        const permission = await nestFetchAsUser(`/forms/${encodeURIComponent(id)}/upload?field=${encodeURIComponent(fieldId)}`, extractRequestToken(req) || '');
        if (permission.status !== 200) return NextResponse.json({ error: permission.body?.message || 'Unggahan tidak diizinkan' }, { status: permission.status });
        const { field, form_id, owner } = permission.body;
        if (!field || !Number.isFinite(field.maxSize) || field.maxSize <= 0 || field.maxSize > 10) return NextResponse.json({ error: 'Pengaturan unggahan tidak valid' }, { status: 400 });
        const maxBytes = field.maxSize * 1048576 + 65536;
        if (!req.body || Number(req.headers.get('content-length') || 0) > maxBytes) return NextResponse.json({ error: 'Unggahan terlalu besar atau kosong' }, { status: 413 });
        const reader = req.body.getReader();
        const chunks: ArrayBuffer[] = [];
        let received = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > maxBytes) { await reader.cancel(); return NextResponse.json({ error: 'Ukuran unggahan melebihi batas' }, { status: 413 }); }
            chunks.push(new Uint8Array(value).buffer);
        }
        let form: FormData;
        try { form = await new Request(req.url, { method: 'POST', headers: req.headers, body: new Blob(chunks) }).formData(); }
        catch { return NextResponse.json({ error: 'Data unggahan tidak valid' }, { status: 400 }); }
        const file = form.get('file');
        if (!(file instanceof File) || !file.size || file.size > field.maxSize * 1048576 || !/^[\w-]{1,80}$/.test(field.id)) return NextResponse.json({ error: `Berkas wajib diisi, maksimal ${field.maxSize} MB` }, { status: 400 });
        const parts = file.name.toLowerCase().split('.');
        const ext = parts.at(-1) || '';
        if (!ALLOWED.has(ext) || parts.slice(0,-1).some(p => ['php','exe','phtml','js','html','svg','bat','cmd','ps1'].includes(p)) || /[\\/\0]/.test(file.name)) return NextResponse.json({ error: 'Format berkas tidak aman/tidak didukung' }, { status: 400 });
        const accept = String(field.accept || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        const mime = getMimeTypeFromFileName(file.name);
        if (accept.length && !accept.some((a: string) => a === `.${ext}` || a === mime || (a.endsWith('/*') && mime.startsWith(a.slice(0,-1))))) return NextResponse.json({ error: 'Format berkas tidak sesuai komponen form' }, { status: 400 });
        const signature = Buffer.from(await file.slice(0, 12).arrayBuffer());
        const zip = signature[0] === 80 && signature[1] === 75 && [3,5,7].includes(signature[2]) && [4,6,8].includes(signature[3]);
        const ole = signature.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]));
        if ((ext === 'pdf' && signature.subarray(0,5).toString() !== '%PDF-') ||
            (ext === 'png' && !signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
            (['jpg','jpeg'].includes(ext) && !(signature[0] === 255 && signature[1] === 216 && signature[2] === 255)) ||
            (ext === 'webp' && !(signature.subarray(0,4).toString() === 'RIFF' && signature.subarray(8,12).toString() === 'WEBP')) ||
            (['zip','docx','xlsx','pptx'].includes(ext) && !zip) || (['doc','xls','ppt'].includes(ext) && !ole)) return NextResponse.json({ error: 'Isi berkas tidak sesuai format yang dipilih' }, { status: 400 });
        const session = owner ? null : formUploadSession(req.cookies.get(FORM_UPLOAD_COOKIE)?.value);
        const result = await uploadFile(Buffer.from(await file.arrayBuffer()), file.name, `forms/${form_id}/${field.id}`, { owner_auth_id: owner || session!.owner, required: true });
        if (!result.ok || !result.file_url) return NextResponse.json({ error: 'Unggahan gagal. Silakan coba kembali.' }, { status: 503 });
        const response = NextResponse.json({ ok: true, file: { url: result.file_url, name: file.name } });
        if (session) response.cookies.set(FORM_UPLOAD_COOKIE, session.token, { httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/api/forms', maxAge: 86400 });
        return response;
    } catch {
        return NextResponse.json({ error: 'Unggahan tidak berhasil atau pencatatan berkas gagal' }, { status: 503 });
    }
}
