import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Proxy riwayat audit log sistem dari backend NestJS */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const response = await proxy(request, '/audit-logs?' + searchParams.toString());
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
