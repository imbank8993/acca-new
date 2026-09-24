import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/jurnal${search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/jurnal', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (id) {
        return proxy(request, `/jurnal/${id}`, {
            method: 'DELETE',
        });
    }
    const body = await request.json().catch(() => ({}));
    if (body.id) {
        return proxy(request, `/jurnal/${body.id}`, {
            method: 'DELETE',
        });
    }
    return NextResponse.json({ ok: false, error: 'ID jurnal diperlukan' }, { status: 400 });
}

