import { NextRequest } from 'next/server';
import { proxy } from '@/lib/nest-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const response = await proxy(request, '/audit-logs/clear', {
    method: 'POST',
    body: JSON.stringify({ confirmation: body?.confirmation }),
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
