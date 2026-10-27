import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Izin pemanggil di halaman Ekstrakurikuler (lihat EkskulController.getIzinSaya). */
export async function GET(request: NextRequest) {
    return proxy(request, '/ekskul/izin-saya');
}
