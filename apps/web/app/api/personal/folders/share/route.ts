import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { status, body } = await nestFetchAsUser(path, token, init);
    return NextResponse.json(body, { status });
}
export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/personal/folders/share', { method: 'POST', body: JSON.stringify(body) });
}
