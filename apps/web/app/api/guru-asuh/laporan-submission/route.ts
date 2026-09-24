import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { status, body } = await nestFetchAsUser(path, token, init);
    if (status !== 200 && status !== 201) {
        return NextResponse.json({ ok: false, error: body?.message || body?.error || 'Permintaan gagal' }, { status });
    }
    return NextResponse.json(body);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    return proxy(request, `/guru-asuh/laporan-submission${searchParams.toString() ? '?' + searchParams.toString() : ''}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/guru-asuh/laporan-submission', { method: 'POST', body: JSON.stringify(body) });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    return proxy(request, `/guru-asuh/laporan-submission?id=${encodeURIComponent(id || '')}`, { method: 'DELETE' });
}
