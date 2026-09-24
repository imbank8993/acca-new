import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '10';

    if (query.length < 3) {
        return NextResponse.json({ ok: true, data: [] });
    }

    const token = extractRequestToken(req);
    const { status, body } = await nestFetchAsUser(
        `/surat/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        token || ''
    );
    return NextResponse.json(body, { status });
}
