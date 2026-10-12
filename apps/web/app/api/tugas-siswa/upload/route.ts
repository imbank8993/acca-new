import { NextRequest, NextResponse } from 'next/server';
import { POST as upload } from '@/app/api/upload/route';
import { extractRequestToken } from '@/lib/app-jwt';

export async function POST(req: NextRequest) {
    if (!extractRequestToken(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    let form: FormData;
    try { form = await req.formData(); } catch { return NextResponse.json({ ok: false, error: 'Data unggahan tidak valid' }, { status: 400 }); }
    form.set('folder', 'tugas-siswa');
    const headers = new Headers(req.headers);
    headers.delete('content-type'); headers.delete('content-length');
    return upload(new NextRequest(req.url, { method: 'POST', headers, body: form }));
}
