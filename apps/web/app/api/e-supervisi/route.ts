import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const { searchParams } = new URL(request.url);
        const tahun_ajaran_id = searchParams.get('tahun_ajaran_id');
        const query = tahun_ajaran_id ? `?tahun_ajaran_id=${encodeURIComponent(tahun_ajaran_id)}` : '';

        const { status, body } = await nestFetchAsUser(`/e-supervisi/penugasan${query}`, token, {
            method: 'GET',
            cache: 'no-store',
        });

        const penugasan = Array.isArray(body) ? body : (body?.data || []);
        return NextResponse.json({ ok: true, data: { penugasan } }, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
