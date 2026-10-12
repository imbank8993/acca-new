import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/tugas-siswa/action${search}`);
}

export async function POST(request: NextRequest) {
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON tidak valid' }, { status: 400 }); }
    return proxy(request, '/tugas-siswa/action', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
