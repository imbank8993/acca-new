import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const token = extractRequestToken(req);
        const { status, body } = await nestFetchAsUser('/e-supervisi/tahun-ajaran', token, {
            method: 'GET',
            cache: 'no-store',
        });
        return NextResponse.json(body || { ok: false }, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
