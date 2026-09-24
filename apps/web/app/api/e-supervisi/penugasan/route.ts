import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const { status, body } = await nestFetchAsUser('/e-supervisi/penugasan?' + searchParams.toString(), token, { method: 'GET', cache: 'no-store' });
    return NextResponse.json(body || {}, { status });
}

export async function POST(req: NextRequest) {
    const token = extractRequestToken(req);
    const payload = await req.json();
    const { status, body } = await nestFetchAsUser('/e-supervisi/penugasan', token, {
        method: 'POST',
        body: JSON.stringify(payload),
        cache: 'no-store'
    });
    return NextResponse.json(body || {}, { status });
}

export async function DELETE(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const { status, body } = await nestFetchAsUser('/e-supervisi/penugasan?' + searchParams.toString(), token, {
        method: 'DELETE',
        cache: 'no-store'
    });
    return NextResponse.json(body || {}, { status });
}

export async function PATCH(req: NextRequest) {
    const token = extractRequestToken(req);
    const payload = await req.json();
    const { status, body } = await nestFetchAsUser('/e-supervisi/penugasan', token, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        cache: 'no-store'
    });
    return NextResponse.json(body || {}, { status });
}
