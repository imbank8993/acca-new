import { nestFetch, nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenParam = searchParams.get('token');
  const scope = searchParams.get('scope');
  const docId = searchParams.get('doc_id');
  const folder = searchParams.get('folder');
  const division = searchParams.get('division');

  const q = new URLSearchParams();
  if (tokenParam) q.set('token', tokenParam);
  if (scope) q.set('scope', scope);
  if (docId) q.set('doc_id', docId);
  if (folder) q.set('folder', folder);
  if (division) q.set('division', division);

  const queryString = q.toString() ? `?${q.toString()}` : '';

  if (tokenParam) {
    const { status, body } = await nestFetch(`/informasi/share${queryString}`);
    return NextResponse.json(body || { ok: false }, { status: status || 200 });
  }
  const token = extractRequestToken(request);
  const { status, body } = await nestFetchAsUser(`/informasi/share${queryString}`, token);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/informasi/share', token, {
    method: 'POST',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

export async function PATCH(request: NextRequest) {
  const token = extractRequestToken(request);
  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/informasi/share', token, {
    method: 'PATCH',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

export async function DELETE(request: NextRequest) {
  const token = extractRequestToken(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const { status, body } = await nestFetchAsUser(`/informasi/share?id=${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

