import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/nilai/tagihan${search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/nilai/tagihan', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
        return NextResponse.json({ ok: false, error: 'Parameter id wajib diisi' }, { status: 400 });
    }
    return proxy(request, `/nilai/tagihan/${id}`, {
        method: 'DELETE',
    });
}
