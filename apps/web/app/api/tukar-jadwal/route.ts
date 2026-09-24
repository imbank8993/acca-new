import { proxy } from '@/lib/nest-proxy';
import { notifTukarJadwalWa } from '@/lib/wa-tukar-jadwal';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/jadwal/tukar${search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const res = await proxy(request, '/jadwal/tukar', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    // Pemberitahuan WA menyusul SETELAH backend menyimpan dengan sukses, dan
    // tidak boleh mengubah hasil yang dikembalikan ke pemanggil.
    if (res.ok) {
        const hasil = await res.clone().json().catch(() => null);
        if (hasil?.ok && hasil.data) await notifTukarJadwalWa('diajukan', hasil.data);
    }
    return res;
}
