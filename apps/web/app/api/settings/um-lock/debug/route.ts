import { nestFetch } from '@/lib/nest-api';
import { getApiUser } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint debug untuk kunci nilai Ujian Madrasah — dibatasi Admin.
 *
 * Sebelumnya terbuka sepenuhnya: GET membeberkan keadaan kunci per tahun
 * ajaran, dan POST mengubahnya, tanpa satu pun pemeriksaan (route ini memakai
 * kunci internal service, dan middleware tidak mencocokkan `/api`). Tidak ada
 * halaman yang memanggilnya — ini sisa perkakas pengembangan, jadi Admin saja
 * sudah cukup dan tidak memutus alur mana pun.
 */
async function assertAdmin(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Hanya Admin' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = await assertAdmin(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';
  const { status, body } = await nestFetch(`/settings/um-lock/debug?tahun_ajaran=${encodeURIComponent(tahunAjaran)}`);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

export async function POST(request: NextRequest) {
  const denied = await assertAdmin(request);
  if (denied) return denied;

  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetch('/settings/um-lock/debug', {
    method: 'POST',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
