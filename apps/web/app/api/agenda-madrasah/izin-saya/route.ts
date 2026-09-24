import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Hak pengguna saat ini atas modul Agenda Madrasah, dievaluasi di server. */
export async function GET(request: NextRequest) {
  return proxy(request, '/agenda/izin-saya');
}
