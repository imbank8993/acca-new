import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = extractRequestToken(request) || '';
    const result = await nestFetchAsUser(`/ujian-madrasah?${searchParams.toString()}`, token);
    return NextResponse.json((result.body || {}), { status: result.status });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const token = extractRequestToken(request) || '';
    const result = await nestFetchAsUser(`/ujian-madrasah`, token, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    return NextResponse.json((result.body || {}), { status: result.status });
}
