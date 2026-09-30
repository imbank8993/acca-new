import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/master/students/verify
 * Proxy publik ke NestJS GET /students/verify
 * ?nisn=... atau ?card_id=...
 */
export async function GET(request: NextRequest) {
  try {
    const { status, body } = await nestFetch(
      `/students/verify${request.nextUrl.search}`,
    );
    return NextResponse.json(body, { status });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Gagal memverifikasi identitas siswa' },
      { status: 500 },
    );
  }
}

