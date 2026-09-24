import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const { status, body } = await nestFetchAsUser('/surat/dropdown/jenis-surat', token);
    return NextResponse.json(body || { ok: false }, { status });
}
