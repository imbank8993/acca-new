import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/ketidakhadiran/rekam-medis-siswa${search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, `/ketidakhadiran/rekam-medis-siswa${request.nextUrl.search}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const search = request.nextUrl.search;
    return proxy(request, `/ketidakhadiran/rekam-medis-siswa${search}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/ketidakhadiran/rekam-medis-siswa${search}`, {
        method: 'DELETE',
    });
}
