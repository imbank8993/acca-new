import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    const body = await request.json();
    const { status, body: result } = await nestFetchAsUser('/ekskul/approval', token || '', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    return NextResponse.json(result, { status });
}
