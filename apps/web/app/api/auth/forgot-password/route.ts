import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

/**
 * Minta tautan atur ulang password. TANPA token — pemakainya sedang tidak bisa
 * masuk.
 *
 * Jawaban backend sengaja seragam apa pun hasilnya, supaya endpoint ini tidak
 * bisa dipakai memeriksa alamat email mana yang punya akun. Rute ini karena itu
 * tidak boleh menambahkan keterangan apa pun di luar yang dikirim backend.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const origin = request.headers.get('origin') || request.nextUrl.origin || '';
        const { status, body: hasil } = await nestFetch('/auth/forgot-password', {
            method: 'POST',
            headers: {
                ...(origin ? { 'x-client-origin': origin } : {}),
            },
            body: JSON.stringify({
                email: body?.email ?? '',
                username: body?.username ?? '',
                origin: body?.origin || origin,
            }),
        });

        if (status === 429) {
            return NextResponse.json(
                {
                    ok: false,
                    error: 'Terlalu banyak permintaan. Coba lagi beberapa menit.',
                },
                { status: 429 },
            );
        }

        const httpStatus =
            hasil?.ok === false && (!status || status === 200 || status === 201)
                ? 400
                : status || 200;

        return NextResponse.json(hasil ?? { ok: true }, { status: httpStatus });
    } catch {
        return NextResponse.json(
            { ok: false, error: 'Tidak dapat terhubung ke server' },
            { status: 500 },
        );
    }
}
