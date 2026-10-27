import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest, params: Promise<{ id: string }>, subpath = '/status') {
    const token = extractRequestToken(req);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const sp = req.nextUrl.searchParams.toString();
    const url = `/catatan-pribadi/${id}${subpath}` + (sp ? '?' + sp : '');
    const options: any = { method: req.method };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const text = await req.text();
        if (text) options.body = text;
    }
    const { status, body } = await nestFetchAsUser(url, token, options);
    return NextResponse.json(body || {}, { 
        status, 
        headers: { 'Cache-Control': 'private, no-store' } 
    });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return proxy(req, params, '/status');
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return proxy(req, params, '/status');
}
