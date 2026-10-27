import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Pratinjau libur nasional dari kalender publik Google (lihat LiburController.getLiburNasional). */
export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/jadwal/libur/nasional${search}`);
}

/** Simpan libur nasional terpilih; tanggal yang sudah punya data libur dilewati. */
export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/jadwal/libur/sinkron-nasional', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
