import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/tugas-siswa${search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/tugas-siswa', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}