import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function POST(req: NextRequest) {
    const token = extractRequestToken(req);
    const bodyInput = await req.json().catch(() => ({}));
    const { status, body } = await nestFetchAsUser('/users/link-auth', token, {
        method: 'POST',
        body: JSON.stringify(bodyInput)
    });
    return NextResponse.json(body || { ok: false }, { status });
}
