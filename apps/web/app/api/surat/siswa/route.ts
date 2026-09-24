import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    const token = extractRequestToken(request);

    const { status, body } = await nestFetchAsUser(
        `/surat/siswa${search}`,
        token || ''
    );
    return NextResponse.json(body, { status });
}
