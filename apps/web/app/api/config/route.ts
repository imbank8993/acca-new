import { NextRequest, NextResponse } from 'next/server';
import { nestFetch, nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export const dynamic = 'force-dynamic';

/**
 * Baca satu pengaturan sistem yang bersifat publik.
 *
 * Tetap memakai `nestFetch` dengan sadar: endpoint `/config` di backend memang
 * tanpa guard, karena halaman redirect kartu siswa memanggilnya sebelum ada sesi.
 * Bedanya sekarang backend hanya melayani kunci yang ada di daftar putih
 * (`KUNCI_CONFIG_PUBLIK`), jadi melewatkan guard tidak lagi berarti melewatkan
 * pembatasan.
 *
 * Hanya `key` yang diteruskan. Sebelumnya seluruh query string dikirim apa adanya,
 * termasuk `all=true` yang membuat backend menumpahkan seluruh tabel
 * `system_config` ke pemanggil anonim.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key') || '';
        const { status, body } = await nestFetch(`/config?key=${encodeURIComponent(key)}`);
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const bodyData = await request.json();
        const { status, body } = await nestFetchAsUser('/config', token, {
            method: 'PUT',
            body: JSON.stringify(bodyData),
        });
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}