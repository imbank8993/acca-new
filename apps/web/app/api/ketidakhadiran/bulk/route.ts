import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/ketidakhadiran/bulk', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
