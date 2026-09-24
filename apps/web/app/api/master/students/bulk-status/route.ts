import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

// Wajib dinamis + no-store: hasil audit berubah tiap kali data kelas diubah,
// dan proxy nginx di VPS meng-cache GET kalau tidak dilarang eksplisit.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

/**
 * GET /api/master/students/bulk-status
 * Proxy ke NestJS GET /students/bulk-status
 */
export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Tidak terautentikasi' }, { status: 401, headers: NO_STORE });
  }
  const { status, body } = await nestFetchAsUser(
    `/students/bulk-status${request.nextUrl.search}`,
    token,
  );
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * POST /api/master/students/bulk-status
 * Proxy ke NestJS POST /students/bulk-status
 * Body: { nisns: string[], aktif: boolean, sertakan_akun?: boolean }
 */
export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Tidak terautentikasi' }, { status: 401, headers: NO_STORE });
  }
  const bodyJson = await request.json().catch(() => null);
  const { status, body } = await nestFetchAsUser('/students/bulk-status', token, {
    method: 'POST',
    body: JSON.stringify(bodyJson),
  });
  return NextResponse.json(body, { status, headers: NO_STORE });
}
