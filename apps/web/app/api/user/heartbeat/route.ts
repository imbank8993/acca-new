import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        let bodyData = {};
        try {
            bodyData = await request.json();
        } catch {}

        const { status, body } = await nestFetchAsUser('/users/heartbeat', token, {
            method: 'POST',
            body: JSON.stringify(bodyData),
        });
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
