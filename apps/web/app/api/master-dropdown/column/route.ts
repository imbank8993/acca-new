import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return unauthorized();

  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/master-dropdown/column', token, {
    method: 'POST',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

export async function DELETE(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return unauthorized();

  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/master-dropdown/column', token, {
    method: 'DELETE',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
