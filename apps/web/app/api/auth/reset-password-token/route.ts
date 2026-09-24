import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

/**
 * Tukar token dari email dengan password baru. TANPA token sesi — pemakainya
 * memang belum bisa masuk.
 *
 * Backend memakai satu pesan yang sama untuk token salah, sudah dipakai, maupun
 * kedaluwarsa; rute ini meneruskannya apa adanya dan tidak menambah keterangan.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { status, body: hasil } = await nestFetch('/auth/reset-password-token', {
            method: 'POST',
            body: JSON.stringify({ token: body?.token ?? '', password: body?.password ?? '' }),
        });

        if (status === 429) {
            return NextResponse.json(
                { ok: false, error: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' },
                { status: 429 },
            );
        }

        if (status !== 200 && status !== 201) {
            return NextResponse.json(
                { ok: false, error: hasil?.message || hasil?.error || 'Gagal mengatur password' },
                { status },
            );
        }

        return NextResponse.json(hasil ?? { ok: true }, { status: 200 });
    } catch {
        return NextResponse.json(
            { ok: false, error: 'Tidak dapat terhubung ke server' },
            { status: 500 },
        );
    }
}
