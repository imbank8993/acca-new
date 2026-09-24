import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const { status, body } = await nestFetchAsUser('/e-supervisi/unggahan?' + searchParams.toString(), token, { method: 'GET', cache: 'no-store' });
    return NextResponse.json(body || {}, { status });
}

export async function DELETE(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const { status, body } = await nestFetchAsUser('/e-supervisi/unggahan?' + searchParams.toString(), token, {
        method: 'DELETE',
        cache: 'no-store'
    });
    return NextResponse.json(body || {}, { status });
}
