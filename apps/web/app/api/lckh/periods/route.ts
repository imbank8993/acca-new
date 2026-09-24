import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return proxy(request, '/lckh/periods');
}

export async function POST(request: NextRequest) {
    return proxy(request, '/lckh/periods');
}
