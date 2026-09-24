import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return corsResponse(
            NextResponse.json({ ok: false, verified: false, error: 'id wajib diisi' }, { status: 400 })
        );
    }

    try {
        // Verification endpoint is public in NestJS (no bearer token required)
        const { status, body } = await nestFetchAsUser(
            `/guru-asuh/laporan-submission/verify?id=${encodeURIComponent(id)}`,
            ''
        );
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(
            NextResponse.json({ ok: false, verified: false, error: error.message }, { status: 500 })
        );
    }
}

export async function OPTIONS() {
    return handleOptions();
}
