import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { buildRekapKlinik, BULAN } from '@/lib/klinik/rekap-report';
import { isReviewerKlinik } from '@/lib/klinik/laporan-report';
import { launchPuppeteerBrowser } from '@/lib/puppeteer-launcher';

async function convertHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await launchPuppeteerBrowser();
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        // Lampiran memuat foto dari storage; tanpa menunggu ini kotak foto
        // ikut tercetak dalam keadaan kosong. Dibatasi 30 detik supaya satu
        // URL yang menggantung tidak membuat request PDF tidak pernah selesai.
        await Promise.race([
            page.evaluate(() => Promise.all(
                Array.from(document.images)
                    .filter(img => !img.complete)
                    .map(img => new Promise<void>(resolve => {
                        img.addEventListener('load', () => resolve(), { once: true });
                        img.addEventListener('error', () => resolve(), { once: true });
                    })),
            ).then(() => undefined)),
            new Promise(resolve => setTimeout(resolve, 30_000)),
        ]);

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '20mm' },
        });
        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

/** POST /api/klinik/laporan/rekap/pdf — rekap bulanan kolektif sbg PDF. */
export async function POST(request: NextRequest) {
    try {
        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();
        if (!isReviewerKlinik(user)) {
            return forbiddenResponse('Anda tidak memiliki izin mencetak rekap klinik');
        }

        const body = await request.json();
        const origin = request.nextUrl.origin;
        const result = await buildRekapKlinik({ ...body, origin });
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }

        const pdfBuffer = await convertHtmlToPdf(result.html);
        const label = `${BULAN[Number(body.bulan) - 1] || body.bulan}_${body.tahun}`;
        const fileName = `Rekap_Klinik_${label}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        console.error('[klinik rekap pdf] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
