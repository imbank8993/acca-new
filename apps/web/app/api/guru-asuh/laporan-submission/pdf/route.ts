import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { buildLaporanReport } from '@/lib/guru-asuh/laporan-report';
import { launchPuppeteerBrowser } from '@/lib/puppeteer-launcher';

export const dynamic = 'force-dynamic';

async function convertHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await launchPuppeteerBrowser();
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' as any });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '20mm' },
        });
        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

async function handleGeneratePdf(
    params: {
        submissionId?: string | null;
        nip?: string | null;
        bulan?: number | string | null;
        tahun?: number | string | null;
        nama_guru?: string | null;
    },
    token: string,
    origin: string
) {
    const result = await buildLaporanReport({ ...params, origin, token });
    if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    const { html, submission } = result;

    // Catatan: PDF sengaja TIDAK diunggah ke storage. Dibuat in-memory dan langsung
    // dikembalikan sebagai stream binary untuk menghemat kapasitas storage dan
    // mencegah tumpukan berkas duplikat setiap kali tombol cetak ditekan.
    const pdfBuffer = await convertHtmlToPdf(html);
    const fileName = `Laporan_Guru_Asuh_${submission.nip || 'guru'}_${submission.bulan}_${submission.tahun}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${fileName}"`,
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json().catch(() => ({}));
        const origin = new URL(request.url).origin;
        return await handleGeneratePdf(body, token, origin);
    } catch (error: any) {
        console.error('[guru-asuh laporan-submission pdf POST] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const submissionId = searchParams.get('submissionId');
        const nip = searchParams.get('nip');
        const bulan = searchParams.get('bulan');
        const tahun = searchParams.get('tahun');
        const nama_guru = searchParams.get('nama_guru');

        const origin = new URL(request.url).origin;
        return await handleGeneratePdf({ submissionId, nip, bulan, tahun, nama_guru }, token, origin);
    } catch (error: any) {
        console.error('[guru-asuh laporan-submission pdf GET] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
