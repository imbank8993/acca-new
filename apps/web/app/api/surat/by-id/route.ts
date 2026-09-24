import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ ok: false, error: 'ID wajib diisi' }, { status: 400 });
    }

    const token = extractRequestToken(req);
    const { status, body } = await nestFetchAsUser(`/surat/items/${id}`, token || '');
    return NextResponse.json(body, { status });
}
