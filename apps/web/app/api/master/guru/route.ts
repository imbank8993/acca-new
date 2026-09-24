/**
 * Route data master guru & tendik — GET/POST/PUT/DELETE.
 *
 * Sebelumnya menulis langsung ke Supabase. Sekarang diteruskan ke NestJS
 * → Prisma → PostgreSQL VPS.
 *
 * Transformasi yang dilakukan di sini:
 *   ?jenis=GURU   → ?jenis_pegawai=GURU  (param yang dimengerti NestJS)
 *   ?jenis=TENDIK → ?jenis_pegawai=TENDIK
 *
 * Sub-route `/pindah` TIDAK ikut bermigrasi — logikanya berbeda.
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

/** Terjemahkan query string frontend ke format yang dimengerti NestJS. */
function translateParams(search: string): string {
  const params = new URLSearchParams(search);
  const jenis = params.get('jenis');
  if (jenis) {
    params.delete('jenis');
    params.set('jenis_pegawai', jenis.toUpperCase());
  }
  return params.toString() ? `?${params.toString()}` : '';
}

async function proxy(request: NextRequest, init: RequestInit = {}, search = '') {
  const token = extractRequestToken(request);
  if (!token) {
    return corsResponse(
      NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    );
  }
  try {
    const { status, body } = await nestFetchAsUser(`/master/guru${search}`, token, init);
    if (status !== 200 && status !== 201) {
      return corsResponse(
        NextResponse.json({ ok: false, error: body?.message || 'Permintaan gagal' }, { status }),
      );
    }
    return corsResponse(NextResponse.json(body));
  } catch (error: any) {
    return corsResponse(
      NextResponse.json({ ok: false, error: error.message }, { status: 500 }),
    );
  }
}

export async function GET(request: NextRequest) {
  return proxy(request, {}, translateParams(request.nextUrl.search));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxy(request, { method: 'POST', body: JSON.stringify(body) }, request.nextUrl.search);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  return proxy(request, { method: 'PUT', body: JSON.stringify(body) });
}

export async function DELETE(request: NextRequest) {
  // Terjemahkan ?jenis=GURU → ?jenis_pegawai=GURU juga untuk scope=all
  return proxy(request, { method: 'DELETE' }, translateParams(request.nextUrl.search));
}

export async function OPTIONS() {
  return handleOptions();
}
