import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { buildRekapKlinik } from '@/lib/klinik/rekap-report';
import { isReviewerKlinik } from '@/lib/klinik/laporan-report';

/** POST /api/klinik/laporan/rekap/preview — HTML rekap bulanan utk pratinjau in-app. */
export async function POST(request: NextRequest) {
    try {
        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();
        if (!isReviewerKlinik(user)) {
            return forbiddenResponse('Anda tidak memiliki izin mencetak rekap klinik');
        }

        const body = await request.json();
        const result = await buildRekapKlinik(body);
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }
        return NextResponse.json({
            ok: true,
            html: result.html,
            jumlahSesi: result.jumlahSesi,
            jumlahGuru: result.jumlahGuru,
            jumlahFoto: result.jumlahFoto,
        });
    } catch (error: any) {
        console.error('[klinik rekap preview] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
