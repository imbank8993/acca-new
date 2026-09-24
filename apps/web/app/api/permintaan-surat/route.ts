import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
    return handleOptions();
}

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    const token = extractRequestToken(request);
    if (!token) {
        return corsResponse(NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }));
    }

    const { status, body } = await nestFetchAsUser(`/surat/permintaan${search}`, token);
    return corsResponse(NextResponse.json(body, { status }));
}

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) {
        return corsResponse(NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }));
    }

    try {
        const json = await request.json();
        const { status, body } = await nestFetchAsUser('/surat/permintaan', token, {
            method: 'POST',
            body: JSON.stringify(json),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
    }
}