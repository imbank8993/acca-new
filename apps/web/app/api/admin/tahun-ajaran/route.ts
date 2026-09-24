/**
 * Route Tahun Ajaran — GET/POST/PATCH/DELETE.
 *
 * Sebelumnya menulis langsung ke Supabase cloud. Sekarang diteruskan ke NestJS
 * → Prisma → PostgreSQL VPS (194.233.81.192).
 *
 * Catatan penyesuaian:
 *   POST semester='Semua' → 2 insert terpisah (Ganjil + Genap)
 *   PATCH { id, is_active } → diterjemahkan ke PUT di NestJS
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };
const ENTITY = '/master/tahun-ajaran';

async function nest(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  return nestFetchAsUser(path, token, init);
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return unauthorized();
  try {
    const { status, body } = await nest(token, `${ENTITY}${request.nextUrl.search}`);
    return NextResponse.json(body, { status, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return unauthorized();
  try {
    const { tahun_ajaran, semester } = await request.json();
    if (!tahun_ajaran || !semester) {
      return NextResponse.json(
        { ok: false, error: 'Tahun Ajaran dan Semester wajib diisi' },
        { status: 400, headers: NO_STORE },
      );
    }

    if (semester === 'Semua') {
      // Insert dua baris: Ganjil dan Genap
      const results = [];
      for (const sem of ['Ganjil', 'Genap']) {
        const { status, body } = await nest(token, ENTITY, {
          method: 'POST',
          body: JSON.stringify({ tahun_ajaran, semester: sem, is_active: false }),
        });
        if (status !== 200 && status !== 201) {
          return NextResponse.json(
            { ok: false, error: body?.message || `Gagal menyimpan semester ${sem}` },
            { status, headers: NO_STORE },
          );
        }
        results.push(body.data);
      }
      return NextResponse.json({ ok: true, data: results }, { headers: NO_STORE });
    }

    const { status, body } = await nest(token, ENTITY, {
      method: 'POST',
      body: JSON.stringify({ tahun_ajaran, semester, is_active: false }),
    });
    return NextResponse.json(body, { status, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500, headers: NO_STORE });
  }
}

/** Toggle is_active — NestJS MasterController hanya punya PUT (bukan PATCH). */
export async function PATCH(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return unauthorized();
  try {
    const { id, is_active } = await request.json();
    const { status, body } = await nest(token, ENTITY, {
      method: 'PUT',
      body: JSON.stringify({ id, is_active }),
    });
    return NextResponse.json(body, { status, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return unauthorized();
  try {
    const { status, body } = await nest(token, `${ENTITY}${request.nextUrl.search}`, {
      method: 'DELETE',
    });
    return NextResponse.json(body, { status, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500, headers: NO_STORE });
  }
}
