import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const bodyData = await request.json();
        // Diarahkan ke `/jurnal/submit`, bukan `/jurnal`. Keduanya berbeda:
        // `/jurnal` membuat baris bebas dan khusus pengelola, sedangkan
        // `/jurnal/submit` mengisi slot yang sudah ada dengan aturan
        // penggabungan isian guru vs isian pengurus kelas.
        const { status, body } = await nestFetchAsUser('/jurnal/submit', token, {
            method: 'POST',
            body: JSON.stringify(bodyData),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
