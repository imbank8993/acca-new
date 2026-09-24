import { NextRequest, NextResponse } from 'next/server';

// Delegate to the main upload API
export async function POST(req: NextRequest) {
    const uploadUrl = new URL('/api/upload', req.url);

    const formData = await req.formData();

    // Cookie pemanggil ikut diteruskan: /api/upload sekarang menolak permintaan
    // tanpa sesi, dan fetch server-ke-server tidak membawa cookie dengan
    // sendirinya. Tanpa baris ini unggahan yang sah balas 401.
    const response = await fetch(uploadUrl.toString(), {
        method: 'POST',
        headers: { cookie: req.headers.get('cookie') || '' },
        body: formData
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
}

export const dynamic = 'force-dynamic';
