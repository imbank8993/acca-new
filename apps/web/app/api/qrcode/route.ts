import { NextRequest, NextResponse } from 'next/server';
import { createAccaQrPng } from '@/lib/qr/acca-qr.server';

export async function GET(req: NextRequest) {
    try {
        const url = req.nextUrl.searchParams.get('data');

        if (!url) {
            return NextResponse.json({ ok: false, error: 'Missing data parameter' }, { status: 400 });
        }

        // QR persuratan memakai `logo=acca` (lihat accaQrImageUrl) agar logo ACCA
        // ditanam di server; pemakai lain (mis. kartu siswa) tetap QR polos.
        const withLogo = req.nextUrl.searchParams.get('logo') === 'acca';
        const qrBuffer = await createAccaQrPng(url, { width: withLogo ? 300 : 200, margin: withLogo ? 1 : 2, withLogo });

        return new NextResponse(qrBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000'
            }
        });

    } catch (error: any) {
        console.error('[QR-Code] Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
