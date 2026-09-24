import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

/**
 * Wewenang pemanggil per tab Master Data.
 *
 * Dihitung server dari baris `site_settings` per tab, jadi klien tidak perlu
 * membaca sembilan konfigurasi lalu mengevaluasinya sendiri — satu permintaan,
 * dan aturannya tidak ditulis dua kali di dua bahasa.
 */
export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { status, body } = await nestFetchAsUser('/master/my-access', token);
    return NextResponse.json(body, { status });
}
