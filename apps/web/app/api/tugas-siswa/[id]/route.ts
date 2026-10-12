import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    return proxy(request, `/tugas-siswa/${encodeURIComponent(id)}`);
}

export async function PUT(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON tidak valid' }, { status: 400 }); }
    return proxy(request, `/tugas-siswa/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    return proxy(request, `/tugas-siswa/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}