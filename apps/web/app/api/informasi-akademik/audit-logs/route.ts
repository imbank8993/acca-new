import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Proxy riwayat audit log dari backend NestJS Informasi */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return proxy(request, '/informasi/audit-logs?' + searchParams.toString());
}
