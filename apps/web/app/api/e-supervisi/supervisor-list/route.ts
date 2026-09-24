import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { handleOptions, corsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const { status, body } = await nestFetchAsUser('/e-supervisi/supervisor-list?' + searchParams.toString(), token, { method: 'GET', cache: 'no-store' });
    return corsResponse(NextResponse.json(body || {}, { status }));
}

export async function OPTIONS() { return handleOptions(); }
