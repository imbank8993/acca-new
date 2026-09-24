import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

/**
 * Sesi wajib. Parameternya `nip`/`nama`, jadi endpoint ini menjawab pertanyaan
 * "apakah orang ini terdaftar" untuk siapa pun yang ditanyakan. Satu-satunya
 * pemanggilnya adalah halaman sanggar-kurikulum yang berada di bawah
 * (dashboard) — sudah butuh login — jadi ini bukan endpoint publik, cuma
 * kelewat tidak dijaga.
 */
export async function GET(req: NextRequest) {
    try {
        if (!extractRequestToken(req)) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const { status, body } = await nestFetch(`/sanggar/check?${searchParams.toString()}`);
        return NextResponse.json(body, {
            status,
            headers: { 'Cache-Control': 'no-store' }
        });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
