import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const { status, body } = await nestFetchAsUser('/surat/templates/urls', token || '');
    return NextResponse.json(body, { status });
}