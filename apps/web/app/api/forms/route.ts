import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status, body } = await nestFetchAsUser(`/forms${request.nextUrl.search}`, token);
    return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let json;
        try { json = await request.json(); } catch { return NextResponse.json({ error: 'JSON tidak valid' }, { status: 400 }); }
        const { status, body } = await nestFetchAsUser('/forms', token, {
            method: 'POST',
            body: JSON.stringify(json),
        });
        return NextResponse.json(body, { status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
