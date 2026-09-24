import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const { status, body } = await nestFetchAsUser('/catatan-siswa?' + searchParams.toString(), token, { method: 'GET', cache: 'no-store' });
    return NextResponse.json(body || {}, { status });
}

export async function POST(req: NextRequest) {
    const token = extractRequestToken(req);
    const payload = await req.json();
    const { status, body } = await nestFetchAsUser('/catatan-siswa', token, {
        method: 'POST',
        body: JSON.stringify(payload),
        cache: 'no-store'
    });
    return NextResponse.json(body || {}, { status });
}

