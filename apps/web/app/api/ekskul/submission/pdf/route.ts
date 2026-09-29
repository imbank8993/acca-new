import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { uploadFile } from '@/lib/storage/storage-handler';
import { buildEkskulReport } from '@/lib/ekskul/laporan-report';
import { launchPuppeteerBrowser } from '@/lib/puppeteer-launcher';

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

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const body = await request.json();
        const origin = new URL(request.url).origin;
        const result = await buildEkskulReport({ ...body, origin }, token || '');
        
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }
        const { html, submission } = result;

        const pdfBuffer = await convertHtmlToPdf(html);
        const fileName = `Laporan_Ekskul_${submission.pembina_nip}_${submission.bulan}_${submission.tahun}_${Date.now()}.pdf`;
        const uploadResult = await uploadFile(pdfBuffer, fileName, 'laporan_ekskul_pdf');
        
        if (!uploadResult.ok || !uploadResult.file_url) {
            throw new Error(uploadResult.error || 'Gagal upload PDF ke penyimpanan.');
        }

        if (submission.id) {
            await nestFetchAsUser('/ekskul/update-pdf', token || '', {
                method: 'POST',
                body: JSON.stringify({ id: submission.id, pdf_url: uploadResult.file_url }),
            });
        }

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${fileName}"`,
                'X-File-Url': uploadResult.file_url
            }
        });
    } catch (error: any) {
        console.error('[ekskul submission pdf] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
