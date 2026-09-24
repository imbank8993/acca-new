import { nestFetch } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Sesi wajib. Diteruskan ke NestJS dengan kunci internal service, sehingga
 * tanpa penjagaan di sini penugasan mengajar guru mana pun bisa ditanyakan
 * tanpa login (middleware sengaja tidak mencocokkan `/api`).
 */
export async function GET(request: NextRequest) {
  if (!extractRequestToken(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const nip = searchParams.get('nip') || '';
  const tahunAjaran = searchParams.get('tahun_ajaran') || '';
  const semester = searchParams.get('semester') || '';

  const params = new URLSearchParams({ nip, tahun_ajaran: tahunAjaran, semester });
  const { status, body } = await nestFetch(`/settings/guru-mapel/check?${params.toString()}`);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
