import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

/**
 * Wewenang pemanggil per tab halaman Pengaturan Data. Dihitung server dari baris
 * `site_settings` per tab — pasangan dari `/api/master/my-access`.
 */
export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { status, body } = await nestFetchAsUser('/settings/pengaturan-data/my-access', token);
    return NextResponse.json(body, { status });
}
