import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export async function POST(request: NextRequest) {
    try {
        const origin = request.headers.get('origin');
        const allowed = new Set([request.nextUrl.origin, 'https://acca.icgowa.sch.id']);
        for (const value of [process.env.APP_PUBLIC_URL, process.env.NEXT_PUBLIC_BASE_URL]) {
            if (value) { try { allowed.add(new URL(value).origin); } catch {} }
        }
        if ((origin && !allowed.has(origin)) || request.headers.get('sec-fetch-site') === 'cross-site') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const token = extractRequestToken(request);
        let bodyData = {};
        try {
            bodyData = await request.json();
        } catch {}

        const { status, body } = await nestFetchAsUser('/users/heartbeat', token, {
            method: 'POST',
            body: JSON.stringify(bodyData),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
