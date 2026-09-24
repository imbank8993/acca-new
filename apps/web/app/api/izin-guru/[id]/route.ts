import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await request.json();
    return proxy(request, `/izin-guru/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxy(request, `/izin-guru/${id}`, {
        method: 'DELETE',
    });
}
