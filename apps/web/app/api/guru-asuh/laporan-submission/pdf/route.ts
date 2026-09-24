import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { uploadFile } from '@/lib/storage/storage-handler';
import { buildLaporanReport } from '@/lib/guru-asuh/laporan-report';

export const dynamic = 'force-dynamic';

async function convertHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
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
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        const origin = new URL(request.url).origin;
        const result = await buildLaporanReport({ ...body, origin, token });
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }
        const { html, submission } = result;

        const pdfBuffer = await convertHtmlToPdf(html);
        const fileName = `Laporan_Guru_Asuh_${submission.nip}_${submission.bulan}_${submission.tahun}_${Date.now()}.pdf`;
        const uploadResult = await uploadFile(pdfBuffer, fileName, 'laporan_guru_asuh_pdf');
        if (!uploadResult.ok || !uploadResult.file_url) {
            throw new Error(uploadResult.error || 'Gagal upload PDF ke penyimpanan.');
        }

        if (submission.id && submission.status === 'Approved') {
            await nestFetchAsUser('/guru-asuh/laporan-submission/pdf-url', token, {
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
        console.error('[guru-asuh laporan-submission pdf] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
