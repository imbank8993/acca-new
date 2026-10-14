import { NextRequest, NextResponse } from 'next/server';

import { buildUserObject } from '@/lib/auth';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
};

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json(
                { ok: false, error: 'Unauthorized' },
                { status: 401, headers: NO_STORE_HEADERS }
            );
        }

        const { status, body: payload } = await nestFetchAsUser('/access/me', token);
        if (status === 401) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
        }
        if (status < 200 || status >= 300 || !payload?.user) {
            console.warn('[auth/me] Access check failed:', { status, hasUser: Boolean(payload?.user) });
            return NextResponse.json(
                { ok: false, error: 'Sesi belum dapat diperiksa. Silakan coba lagi.' },
                { status: status === 403 ? 403 : 503, headers: NO_STORE_HEADERS }
            );
        }

        const fullUser = await buildUserObject(payload.user, payload.access);

        return NextResponse.json(
            { ok: true, user: fullUser, source: 'auth_id' },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error: any) {
        console.error('Error in /api/auth/me:', error);
        return NextResponse.json({ ok: false, error: 'Sesi belum dapat diperiksa. Silakan coba lagi.' }, { status: 503, headers: NO_STORE_HEADERS });
    }
}
