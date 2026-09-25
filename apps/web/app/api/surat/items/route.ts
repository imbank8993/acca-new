import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, `/surat/items${search}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/surat/items', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
