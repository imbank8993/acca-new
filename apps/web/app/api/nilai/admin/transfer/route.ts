import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/nilai/admin/transfer', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
