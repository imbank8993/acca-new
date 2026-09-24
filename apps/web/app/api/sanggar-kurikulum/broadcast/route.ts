import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  const { status, body } = await nestFetchAsUser('/sanggar/broadcast/config', token);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/sanggar/broadcast', token, {
    method: 'POST',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
