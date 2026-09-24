import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/guru-asuh/bulk-copy', token, {
    method: 'POST',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
