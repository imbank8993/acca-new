import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Proxy riwayat audit log sistem dari backend NestJS */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return proxy(request, '/audit-logs?' + searchParams.toString());
}
