import { NextRequest } from 'next/server';
import { proxy } from '@/lib/nest-proxy';

export async function POST(request: NextRequest) {
  return proxy(request, '/jadwal/delete-dates', { method: 'POST', body: JSON.stringify(await request.json()) });
}
