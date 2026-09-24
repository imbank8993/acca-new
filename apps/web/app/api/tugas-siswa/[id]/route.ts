import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    return proxy(request, `/tugas-siswa/${id}`);
}

export async function PUT(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    const body = await request.json();
    return proxy(request, `/tugas-siswa/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function DELETE(request: NextRequest, props: RouteParams) {
    const { id } = await props.params;
    return proxy(request, `/tugas-siswa/${id}`, {
        method: 'DELETE',
    });
}