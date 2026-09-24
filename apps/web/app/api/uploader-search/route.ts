import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
    return handleOptions();
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || '';
    const q = searchParams.get('q') || '';
    const token = extractRequestToken(request);

    try {
        const { status, body } = await nestFetchAsUser(
            `/dokumen/uploader-search?type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}`,
            token || ''
        );
        return corsResponse(NextResponse.json(Array.isArray(body) ? body : (body?.data || [])));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
    }
}
