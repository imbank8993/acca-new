import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const endpoint = `/dashboard/summary${qs ? '?' + qs : ''}`;
    const { status, body } = await nestFetchAsUser(endpoint, token);
    return NextResponse.json(body, { status });
}
