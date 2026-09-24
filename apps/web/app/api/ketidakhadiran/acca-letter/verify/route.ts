import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';

export async function GET(request: NextRequest) {
    try {
        const barcode = request.nextUrl.searchParams.get('barcode') || '';
        const { status, body } = await nestFetch(`/ketidakhadiran/acca-letter/verify?barcode=${encodeURIComponent(barcode)}`);
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message, verified: false }, { status: 500 });
    }
}
