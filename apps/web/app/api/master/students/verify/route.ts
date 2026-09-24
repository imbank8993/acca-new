import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/master/students/verify
 * Proxy ke NestJS GET /students/verify
 * ?nisn=... atau ?card_id=...
 */
export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { status, body } = await nestFetchAsUser(
    `/students/verify${request.nextUrl.search}`,
    token,
  );
  return NextResponse.json(body, { status });
}
