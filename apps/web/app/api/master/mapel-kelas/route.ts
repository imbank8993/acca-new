import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, endpoint: string, init: RequestInit = {}) {
    const token = extractRequestToken(request);
    if (!token) {
        return corsResponse(
            NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        );
    }

    try {
        const { status, body } = await nestFetchAsUser(endpoint, token, init);
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(
            NextResponse.json({ ok: false, error: error.message }, { status: 500 })
        );
    }
}

export async function GET(request: NextRequest) {
    return proxy(request, `/master/mapel-kelas/mappings${request.nextUrl.search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/master/mapel-kelas/mappings', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function OPTIONS() {
    return handleOptions();
}
