import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { FORM_UPLOAD_COOKIE } from '@/lib/form-upload-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);

    try {
        let body;
        try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON tidak valid' }, { status: 400 }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Jawaban tidak valid' }, { status: 400 });
        const { status, body: result } = await nestFetchAsUser(
            '/forms/submit',
            token || '',
            {
                method: 'POST',
                body: JSON.stringify({ ...body, upload_session: request.cookies.get(FORM_UPLOAD_COOKIE)?.value || null }),
            }
        );

        if (status === 200 || status === 201) {
            return NextResponse.json({ success: true, ...result });
        }

        return NextResponse.json(
            { error: result?.message || result?.error || 'Gagal menyimpan tanggapan' },
            { status }
        );
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
