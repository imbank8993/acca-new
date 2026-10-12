import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await request.json();
    return proxy(request, `/notulensi/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}
