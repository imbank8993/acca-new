import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || 'guru';
    const token = extractRequestToken(req);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { status, body } = await nestFetchAsUser(
        `/forms/dynamic-options?source=${encodeURIComponent(source)}`,
        token
    );

    return NextResponse.json(body?.options ? body : { options: [] }, { status });
}
