export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = extractRequestToken(req);
    const { id } = await params;
    const payload = await req.json();
    const { status, body } = await nestFetchAsUser(`/catatan-siswa/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body || {}, { status });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = extractRequestToken(req);
    const { id } = await params;
    const payload = await req.json();
    const { status, body } = await nestFetchAsUser(`/catatan-siswa/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body || {}, { status });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = extractRequestToken(req);
    const { id } = await params;
    const { status, body } = await nestFetchAsUser(`/catatan-siswa/${id}`, token, { method: 'DELETE' });
    return NextResponse.json(body || {}, { status });
}

