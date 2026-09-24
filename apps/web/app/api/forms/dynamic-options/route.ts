import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || 'guru';

    const { status, body } = await nestFetchAsUser(
        `/forms/dynamic-options?source=${encodeURIComponent(source)}`,
        ''
    );

    return NextResponse.json(body?.options ? body : { options: [] }, { status });
}
