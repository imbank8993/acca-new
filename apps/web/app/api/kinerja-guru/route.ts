import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    const search = request.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/kinerja-guru${search}`, token || '');
    return corsResponse(NextResponse.json(body, { status }));
}

export async function OPTIONS() {
    return handleOptions();
}