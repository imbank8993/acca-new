import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  const { searchParams } = new URL(request.url);
  const halaman = searchParams.get('halaman') || '1';
  const dataset = searchParams.get('dataset') || '';

  const q = new URLSearchParams();
  if (halaman) q.set('halaman', halaman);
  if (dataset) q.set('dataset', dataset);

  const { status, body } = await nestFetchAsUser(`/bank-data/log?${q.toString()}`, token);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
