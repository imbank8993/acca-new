import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const { body, status } = await nestFetchAsUser('/agenda/kategori', token, { method: 'GET' });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const bodyReq = await request.json();
        const { body, status } = await nestFetchAsUser('/agenda/kategori', token, {
            method: 'POST',
            body: JSON.stringify(bodyReq),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function PUT(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const bodyReq = await request.json();
        const { body, status } = await nestFetchAsUser('/agenda/kategori', token, {
            method: 'PUT',
            body: JSON.stringify(bodyReq),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return corsResponse(NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 }));

        const token = extractRequestToken(request);
        const { body, status } = await nestFetchAsUser(`/agenda/kategori?id=${id}`, token, { method: 'DELETE' });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
