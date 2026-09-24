import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function GET(req: NextRequest) {
  const token = extractRequestToken(req);
  const { status, body } = await nestFetchAsUser(`/menu-layout`, token, { method: 'GET' });
  return NextResponse.json(body || {}, { status });
}

export async function PUT(req: NextRequest) {
  const token = extractRequestToken(req);
  const payload = await req.json();
  const { status, body } = await nestFetchAsUser(`/menu-layout`, token, {
      method: 'PUT',
      body: JSON.stringify(payload)
  });
  return NextResponse.json(body || {}, { status });
}
