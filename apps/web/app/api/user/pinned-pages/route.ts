import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        const { status, body } = await nestFetchAsUser('/users/pinned-pages', token);
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        const bodyData = await request.json();
        const { status, body } = await nestFetchAsUser('/users/pinned-pages', token, {
            method: 'PUT',
            body: JSON.stringify(bodyData),
        });
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
