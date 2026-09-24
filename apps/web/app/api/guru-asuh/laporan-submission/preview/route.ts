import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { buildLaporanReport } from '@/lib/guru-asuh/laporan-report';

export const dynamic = 'force-dynamic';

/**
 * Pratinjau laporan in-app — mengembalikan HTML dokumen yang sama persis
 * dengan hasil cetak PDF, tapi TANPA Puppeteer maupun upload ke storage.
 * Dipakai utk tombol "Pratinjau" di tab Laporan Guru Asuh & tab Approval.
 */
export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        const origin = new URL(request.url).origin;
        const result = await buildLaporanReport({ ...body, origin, token });
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }
        return NextResponse.json({ ok: true, html: result.html });
    } catch (error: any) {
        console.error('[guru-asuh laporan-submission preview] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
