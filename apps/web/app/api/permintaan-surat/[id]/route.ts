import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function OPTIONS() {
    return handleOptions();
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const token = extractRequestToken(request);
    if (!token) {
        return corsResponse(NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }));
    }

    const { status, body } = await nestFetchAsUser(`/surat/permintaan/${id}`, token);
    return corsResponse(NextResponse.json(body, { status }));
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const token = extractRequestToken(request);
    if (!token) {
        return corsResponse(NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }));
    }

    try {
        const json = await request.json();
        const { status, body } = await nestFetchAsUser(`/surat/permintaan/${id}`, token, {
            method: 'PUT',
            body: JSON.stringify(json),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const token = extractRequestToken(request);
    if (!token) {
        return corsResponse(NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }));
    }

    const { status, body } = await nestFetchAsUser(`/surat/permintaan/${id}`, token, {
        method: 'DELETE',
    });
    return corsResponse(NextResponse.json(body, { status }));
}