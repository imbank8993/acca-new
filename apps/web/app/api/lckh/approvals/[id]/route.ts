import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    return proxy(request, `/lckh/approvals/${id}`);
}

export async function POST(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    const body = await request.json();
    return proxy(request, `/lckh/approvals/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
