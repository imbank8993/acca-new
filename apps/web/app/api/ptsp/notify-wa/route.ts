import { nestFetch } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Sesi wajib. Route ini meneruskan permintaan ke NestJS memakai kunci internal
 * service, jadi tidak ada satu pun pemeriksaan identitas di belakangnya —
 * ditambah middleware sengaja tidak mencocokkan `/api`. Sebelum penjagaan ini
 * antrean notifikasi PTSP bisa dibaca tanpa login.
 *
 * Transport ke NestJS sengaja tetap memakai kunci internal: mengubahnya jadi
 * token pengguna akan ikut mengaktifkan guard peran di sisi NestJS dan bisa
 * memutus pemanggil sah yang selama ini lewat. Itu pengetatan tersendiri.
 */
export async function GET(request: NextRequest) {
  if (!extractRequestToken(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const { status, body } = await nestFetch(`/ptsp/notify-wa?limit=${encodeURIComponent(limit)}`);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
