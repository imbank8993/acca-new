import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const recipients = req.nextUrl.searchParams.get('recipients') === 'true';
  const id = req.nextUrl.searchParams.get('id');
  const { status, body } = await nestFetchAsUser(`/ptsp/disposisi${recipients ? '/recipients' : id ? '?id=' + encodeURIComponent(id) : '?' + new URLSearchParams({ page: req.nextUrl.searchParams.get('page') || '1', unread: req.nextUrl.searchParams.get('unread') || 'false' }).toString()}`, extractRequestToken(req) || '');
  return NextResponse.json(body, { status });
}
export async function POST(req: NextRequest) {
  const { status, body } = await nestFetchAsUser('/ptsp/disposisi', extractRequestToken(req) || '', { method: 'POST', body: JSON.stringify(await req.json()) });
  return NextResponse.json(body, { status });
}
