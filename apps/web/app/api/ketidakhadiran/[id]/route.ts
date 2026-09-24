import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    const search = request.nextUrl.search;
    return proxy(request, `/ketidakhadiran/${id}${search}`);
}

export async function PATCH(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    const search = request.nextUrl.search;
    const body = await request.json();
    return proxy(request, `/ketidakhadiran/${id}${search}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    const search = request.nextUrl.search;
    return proxy(request, `/ketidakhadiran/${id}${search}`, {
        method: 'DELETE',
    });
}
