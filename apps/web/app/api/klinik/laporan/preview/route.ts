import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { buildKlinikReport, bolehAksesLaporanKlinik } from '@/lib/klinik/laporan-report';

export async function POST(request: NextRequest) {
    try {
        // Middleware melewatkan RBAC untuk seluruh /api/*, jadi tanpa pemeriksaan
        // di sini siapa pun yang login bisa menarik laporan sesi milik orang lain
        // (nama & kelas seluruh peserta, materi, foto dokumentasi).
        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();

        const body = await request.json();
        const izin = await bolehAksesLaporanKlinik(user, body?.slotId);
        if (!izin.ok) {
            return NextResponse.json({ ok: false, error: izin.error }, { status: izin.status });
        }

        const origin = new URL(request.url).origin;
        const result = await buildKlinikReport({ ...body, origin });
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }
        return NextResponse.json({ ok: true, html: result.html });
    } catch (error: any) {
        console.error('[klinik laporan preview] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
