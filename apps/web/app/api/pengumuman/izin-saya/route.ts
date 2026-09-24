import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Hak pengguna saat ini atas modul Pengumuman, dievaluasi di server. */
export async function GET(request: NextRequest) {
  return proxy(request, '/pengumuman/izin-saya');
}
