import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return proxy(request, '/notulensi/pengaturan');
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/notulensi/pengaturan', {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}
