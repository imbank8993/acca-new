import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const nomor = searchParams.get('nomor');

    if (!nomor) {
        return NextResponse.json({ ok: false, error: 'Nomor surat required' }, { status: 400 });
    }

    const token = extractRequestToken(req);
    const { status, body } = await nestFetchAsUser(
        `/surat/by-nomor?nomor=${encodeURIComponent(nomor.trim())}`,
        token || ''
    );
    return NextResponse.json(body, { status });
}