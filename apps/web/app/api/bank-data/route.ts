import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return NextResponse.json({ ok: false, error: 'Sesi diperlukan' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const search = request.nextUrl.search || '';
  const { status, body } = await nestFetchAsUser(`/bank-data${search}`, token);
  return NextResponse.json(body || { ok: false }, { status: status || 200, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return NextResponse.json({ ok: false, error: 'Sesi diperlukan' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  let bodyData;
  try { bodyData = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Permintaan tidak valid' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
  
  const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://127.0.0.1:3007/api';
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
  
  try {
    const res = await fetch(`${NEST_API_URL}/bank-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
      },
      body: JSON.stringify(bodyData),
      cache: 'no-store',
    });
    
    // Check Content-Type to see if it's a file download
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => ({ ok: false }));
      return NextResponse.json(json, { status: res.status, headers: { 'Cache-Control': 'no-store' } });
    } else {
      // It's a file, proxy the raw response
      const headers = new Headers();
      res.headers.forEach((value, key) => headers.set(key, value));
      headers.set('Cache-Control', 'no-store');
      return new NextResponse(res.body, {
        status: res.status,
        headers,
      });
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Network error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
