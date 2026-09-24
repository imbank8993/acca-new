import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = extractRequestToken(request);
        const { status, body } = await nestFetchAsUser(`/lckh/nilai-detail?${searchParams.toString()}`, token);
        return NextResponse.json(body, { status });
    } catch (error: any) {
        console.error('[nilai-detail] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
