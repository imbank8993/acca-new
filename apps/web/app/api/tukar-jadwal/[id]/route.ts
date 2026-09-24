import { proxy } from '@/lib/nest-proxy';
import { notifTukarJadwalWa, type PeristiwaTukar } from '@/lib/wa-tukar-jadwal';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Aksi yang dikirim UI → peristiwa yang diberitahukan lewat WhatsApp. */
const PERISTIWA: Record<string, PeristiwaTukar> = {
    terima: 'diterima_guru',
    tolak: 'ditolak_guru',
    setujui: 'disetujui_wkm',
    tolak_wkm: 'ditolak_wkm',
    batal: 'dibatalkan',
};

/**
 * Teruskan tanggapan ke backend, lalu — hanya bila backend benar-benar
 * menerimanya — kirim pemberitahuan WhatsApp ke pihak yang ditunggu
 * tindakannya. Kegagalan WA tidak pernah mengubah respons.
 */
async function teruskanDanBeriTahu(
    request: NextRequest,
    id: string,
    method: 'PUT' | 'PATCH',
    body: any,
) {
    const res = await proxy(request, `/jadwal/tukar/${encodeURIComponent(id)}`, {
        method,
        body: JSON.stringify(body),
    });

    const peristiwa = PERISTIWA[String(body?.aksi ?? '')];
    if (res.ok && peristiwa) {
        const hasil = await res.clone().json().catch(() => null);
        if (hasil?.ok && hasil.data) await notifTukarJadwalWa(peristiwa, hasil.data);
    }
    return res;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return proxy(request, `/jadwal/tukar/${encodeURIComponent(id)}`);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    return teruskanDanBeriTahu(request, id, 'PUT', body);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    return teruskanDanBeriTahu(request, id, 'PATCH', body);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const res = await proxy(request, `/jadwal/tukar/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (res.ok) {
        const hasil = await res.clone().json().catch(() => null);
        if (hasil?.ok && hasil.data) await notifTukarJadwalWa('dibatalkan', hasil.data);
    }
    return res;
}
