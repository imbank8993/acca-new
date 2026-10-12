import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxy(request, `/prestasi/${encodeURIComponent(id)}`);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON tidak valid' }, { status: 400 }); }
    return proxy(request, `/prestasi/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxy(request, `/prestasi/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}
