import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';
const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3007/api';

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const formData = await request.formData();
        
        // Cannot use nestFetchAsUser directly because it overrides Content-Type to application/json
        const res = await fetch(`${NEST_API_URL}/agenda/foto`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
            cache: 'no-store',
        });
        
        const body = await res.json().catch(() => null);
        return corsResponse(NextResponse.json(body, { status: res.status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function PUT(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const bodyReq = await request.json();
        const { body, status } = await nestFetchAsUser('/agenda/foto', token, {
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
        const agendaId = searchParams.get('agenda_id');
        const url = searchParams.get('url');
        
        if (!agendaId || !url) {
            return corsResponse(NextResponse.json({ error: 'agenda_id dan url wajib diisi' }, { status: 400 }));
        }

        const token = extractRequestToken(request);
        const query = new URLSearchParams({ agenda_id: agendaId, url }).toString();
        const { body, status } = await nestFetchAsUser(`/agenda/foto?${query}`, token, { method: 'DELETE' });
        
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
