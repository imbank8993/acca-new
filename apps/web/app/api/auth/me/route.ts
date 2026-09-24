import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { buildUserObject } from '@/lib/auth';
import { decodeSessionCookie } from '@/lib/app-jwt';
import { fetchMyAccess } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
};

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

        if (!token) {
            const cookieStore = await cookies();
            const raw = cookieStore.get('acca_session')?.value || '';
            token = decodeSessionCookie(raw);
        }

        const payload = token ? await fetchMyAccess(token) : null;

        if (!payload?.user) {
            return NextResponse.json(
                { ok: false, error: 'Unauthorized' },
                { status: 401, headers: NO_STORE_HEADERS }
            );
        }

        const fullUser = await buildUserObject(payload.user, payload.access);

        return NextResponse.json(
            { ok: true, user: fullUser, source: 'auth_id' },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error: any) {
        console.error('Error in /api/auth/me:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
