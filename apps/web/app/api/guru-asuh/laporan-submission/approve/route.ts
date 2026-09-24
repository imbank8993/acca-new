import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) {
        return corsResponse(
            NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        );
    }

    try {
        const body = await request.json();
        const { status, body: resBody } = await nestFetchAsUser(
            '/guru-asuh/laporan-submission/approve',
            token,
            {
                method: 'POST',
                body: JSON.stringify(body),
            }
        );
        return corsResponse(NextResponse.json(resBody, { status }));
    } catch (error: any) {
        return corsResponse(
            NextResponse.json({ ok: false, error: error.message }, { status: 500 })
        );
    }
}

export async function OPTIONS() {
    return handleOptions();
}
