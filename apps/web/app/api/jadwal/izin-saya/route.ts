import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Hak pengguna saat ini atas halaman jadwal, dievaluasi di server. */
export async function GET(request: NextRequest) {
  return proxy(request, '/jadwal/izin-saya');
}
