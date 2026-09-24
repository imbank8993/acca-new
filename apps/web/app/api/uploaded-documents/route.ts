import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
    return handleOptions();
}

async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    // Note: If some routes don't require token, nestFetchAsUser might fail, but let's assume token is required.
    // If not, we might need a general fetch.
    const { status, body } = await nestFetchAsUser(path, token || '', init);
    return corsResponse(NextResponse.json(body, { status }));
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    return proxy(request, '/dokumen/uploaded-documents?' + searchParams.toString());
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/dokumen/uploaded-documents', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
}
