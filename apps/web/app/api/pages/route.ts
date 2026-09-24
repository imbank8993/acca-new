import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    const { status, body } = await nestFetchAsUser(`/pages`, token, { method: 'GET' });
    return NextResponse.json(body, { status });
}