import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const token = extractRequestToken(request);
    const { status, body } = await nestFetchAsUser(`/access/users/${id}/roles`, token);
    return NextResponse.json(body, { status });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const token = extractRequestToken(request);
    const reqBody = await request.json();
    const { status, body } = await nestFetchAsUser(`/access/users/${id}/roles`, token, {
        method: 'POST',
        body: JSON.stringify(reqBody),
    });
    return NextResponse.json(body, { status });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const token = extractRequestToken(request);
    const reqBody = await request.json();
    const { status, body } = await nestFetchAsUser(`/access/users/${id}/roles`, token, {
        method: 'POST',
        body: JSON.stringify(reqBody),
    });
    return NextResponse.json(body, { status });
}

