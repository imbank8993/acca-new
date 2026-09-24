import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/absensi/sesi${search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/absensi/sesi', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const id = body.sesi_id || body.id;
    return proxy(request, `/absensi/sesi/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const sesi_id = searchParams.get('sesi_id') || searchParams.get('id');
    if (!sesi_id) {
        return NextResponse.json({ ok: false, error: 'sesi_id required' }, { status: 400 });
    }
    return proxy(request, `/absensi/sesi/${sesi_id}`, {
        method: 'DELETE',
    });
}
