import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    const search = request.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/ekskul/pertemuan${search}`, token || '');
    return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    const body = await request.json();
    const { status, body: result } = await nestFetchAsUser('/ekskul/pertemuan', token || '', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    return NextResponse.json(result, { status });
}

export async function DELETE(request: NextRequest) {
    const token = extractRequestToken(request);
    const search = request.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/ekskul/pertemuan${search}`, token || '', {
        method: 'DELETE',
    });
    return NextResponse.json(body, { status });
}
