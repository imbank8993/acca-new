import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, init: RequestInit = {}, search = '') {
  const token = extractRequestToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { status, body } = await nestFetchAsUser(`/settings/jadwal-piket${search}`, token, init);
    if (status !== 200 && status !== 201) {
      return NextResponse.json({ ok: false, error: body?.error || body?.message || 'Permintaan gagal' }, { status });
    }
    return NextResponse.json(body);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return proxy(request, {}, request.nextUrl.search);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxy(request, { method: 'POST', body: JSON.stringify(body) });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  return proxy(request, { method: 'PUT', body: JSON.stringify(body) }, request.nextUrl.search);
}

export async function DELETE(request: NextRequest) {
  return proxy(request, { method: 'DELETE' }, request.nextUrl.search);
}
