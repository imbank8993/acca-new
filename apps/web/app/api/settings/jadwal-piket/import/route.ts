import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Lihat catatan di ../../jadwal-guru/import/route.ts — token user, bukan kunci internal. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => []);
  return proxy(request, '/settings/jadwal-piket/import', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
