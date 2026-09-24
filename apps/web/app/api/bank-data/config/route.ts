import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  const { status, body } = await nestFetchAsUser('/bank-data/config', token);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

export async function PUT(request: NextRequest) {
  const token = extractRequestToken(request);
  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/bank-data/config', token, {
    method: 'PUT',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
