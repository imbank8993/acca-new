import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

/**
 * Agenda publik — memang dirancang terbuka tanpa login, termasuk untuk dibaca
 * situs lain. `publicRead` menjaga wildcard CORS-nya tetap ada setelah
 * `corsResponse` diperketat untuk endpoint bersesi; karena varian ini tidak
 * mengirim `Allow-Credentials`, cookie sesi tidak pernah ikut terbawa.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const { status, body } = await nestFetch(`/agenda/public?${searchParams.toString()}`);
        return corsResponse(NextResponse.json(body, { status }), { publicRead: true });
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }), { publicRead: true });
    }
}

export async function OPTIONS() {
    return handleOptions({ publicRead: true });
}
