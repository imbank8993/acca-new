import { NextRequest, NextResponse } from 'next/server';
import { proxy } from '@/lib/nest-proxy';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
async function forward(request: NextRequest, context: Context, method: 'GET' | 'POST' | 'PATCH') {
  const { path } = await context.params;
  if (!path.length || !['items', 'loans'].includes(path[0]) || path.length > 2) return NextResponse.json({ ok: false, error: 'Rute tidak valid' }, { status: 404 });
  const body = method === 'GET' ? undefined : await request.json().catch(() => null);
  if (method !== 'GET' && !body) return NextResponse.json({ ok: false, error: 'JSON tidak valid' }, { status: 400 });
  return proxy(request, `/inventory/${path.map(encodeURIComponent).join('/')}${method === 'GET' ? request.nextUrl.search : ''}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
}
export const GET = (request: NextRequest, context: Context) => forward(request, context, 'GET');
export const POST = (request: NextRequest, context: Context) => forward(request, context, 'POST');
export const PATCH = (request: NextRequest, context: Context) => forward(request, context, 'PATCH');
