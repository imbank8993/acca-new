import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxy(request, `/notulensi/${encodeURIComponent(id)}`);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await request.json();
    return proxy(request, `/notulensi/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxy(request, `/notulensi/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}
