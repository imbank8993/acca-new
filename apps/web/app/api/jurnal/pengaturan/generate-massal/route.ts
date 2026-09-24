import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function POST(req: NextRequest) {
    const token = extractRequestToken(req);
    const payload = await req.json();
    const { status, body } = await nestFetchAsUser('/jurnal/pengaturan/generate-massal', token, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body || {}, { status });
}