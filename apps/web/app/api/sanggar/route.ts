import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3007/api';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    const search = request.nextUrl.search;
    try {
        const { status, body } = await nestFetchAsUser(`/sanggar${search}`, token);
        return NextResponse.json(body, { status });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    const reqBody = await request.json();
    try {
        const { status, body } = await nestFetchAsUser('/sanggar', token, {
            method: 'POST',
            body: JSON.stringify(reqBody),
        });
        return NextResponse.json(body, { status });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
