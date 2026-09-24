import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
    return handleOptions({ publicRead: true });
}

/**
 * Daftar testimoni dibiarkan terbuka: isinya memang untuk dipajang, dan
 * `publicRead` mempertahankan wildcard CORS-nya setelah `corsResponse`
 * diperketat untuk endpoint bersesi.
 */
export async function GET() {
    try {
        const { status, body } = await nestFetch('/testimonials');
        return corsResponse(NextResponse.json(body, { status }), { publicRead: true });
    } catch (error: any) {
        return corsResponse(
            NextResponse.json({ ok: false, error: error.message }, { status: 500 }),
            { publicRead: true },
        );
    }
}

/**
 * Menulis tidak: sebelumnya siapa pun di internet bisa menyisipkan testimoni
 * langsung ke database lewat kunci internal service, tanpa satu pun pemeriksaan
 * — saluran spam yang terbuka lebar. Tidak ada halaman di aplikasi ini yang
 * memanggilnya, jadi mensyaratkan sesi tidak memutus alur mana pun.
 */
export async function POST(req: NextRequest) {
    try {
        if (!extractRequestToken(req)) {
            return corsResponse(
                NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
            );
        }

        const bodyData = await req.json();
        const { status, body } = await nestFetch('/testimonials', {
            method: 'POST',
            body: JSON.stringify(bodyData),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
    }
}
