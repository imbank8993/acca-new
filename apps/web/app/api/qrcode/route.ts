import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
    try {
        const url = req.nextUrl.searchParams.get('data');

        if (!url) {
            return NextResponse.json({ ok: false, error: 'Missing data parameter' }, { status: 400 });
        }

        // Generate QR code as PNG buffer with high error correction
        const qrBuffer = await QRCode.toBuffer(url, {
            type: 'png',
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H' // High error correction to allow logo overlay
        });

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
