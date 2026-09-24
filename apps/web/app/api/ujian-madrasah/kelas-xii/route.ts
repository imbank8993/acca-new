import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = extractRequestToken(request) || '';
    const result = await nestFetchAsUser(`/ujian-madrasah/kelas-xii?${searchParams.toString()}`, token);
    return NextResponse.json((result.body || {}), { status: result.status });
}
