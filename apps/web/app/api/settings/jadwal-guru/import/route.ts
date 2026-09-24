import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Diteruskan memakai token milik pemanggil, BUKAN `x-internal-key`. Dengan
 * kunci internal, backend melewati seluruh guard sehingga user mana pun yang
 * punya sesi — termasuk siswa — bisa menimpa jadwal seluruh madrasah.
 * Pembatasan rolenya ditegakkan di SettingsController.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => []);
  return proxy(request, '/settings/jadwal-guru/import', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
