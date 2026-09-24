import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const token = extractRequestToken(request);

    const { status, body } = await nestFetchAsUser(`/forms/${id}`, token || '');
    return NextResponse.json(body, { status });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const json = await request.json();
        const { status, body } = await nestFetchAsUser(`/forms/${id}`, token, {
            method: 'PUT',
            body: JSON.stringify(json),
        });
        return NextResponse.json(body, { status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status, body } = await nestFetchAsUser(`/forms/${id}`, token, {
        method: 'DELETE',
    });
    return NextResponse.json(body, { status });
}
