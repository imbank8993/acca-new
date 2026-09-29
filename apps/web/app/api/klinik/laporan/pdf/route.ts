import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { buildKlinikReport, bolehAksesLaporanKlinik } from '@/lib/klinik/laporan-report';
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
        // Pemeriksaan izin dilakukan SEBELUM Puppeteer dijalankan: selain
        // kerahasiaan isi laporan, endpoint ini melaunch satu browser per
        // request sehingga tidak boleh terbuka untuk sembarang akun.
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
        const { html, slot } = result;

        // Catatan: PDF sengaja TIDAK diunggah ke storage. Sebelumnya setiap klik
        // "Cetak" meninggalkan satu berkas baru yang tidak pernah dirujuk dari
        // mana pun (kolom pdf_url tidak ada), jadi hanya menumpuk sampah.
        const pdfBuffer = await convertHtmlToPdf(html);
        const fileName = `Laporan_Klinik_${slot.id}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        console.error('[klinik laporan pdf] error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
