import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

/**
 * Middleware Next tidak berjalan untuk `/api/*` (lihat matcher di middleware.ts),
 * jadi pemeriksaan sesi harus dilakukan di sini. Sebelumnya token diambil tetapi
 * hasilnya tidak pernah diperiksa — dipadu route GET di NestJS yang saat itu juga
 * tanpa guard, seluruh tabel dropdown terbaca tanpa login.
 */
function unauthorized() {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) return unauthorized();

    const { searchParams } = new URL(request.url);
    const columnKey = searchParams.get('columnKey');
    const checkEmptySlot = searchParams.get('checkEmptySlot');

    let path = '/master-dropdown';
    const params = new URLSearchParams();
    if (columnKey) params.append('columnKey', columnKey);
    if (checkEmptySlot) params.append('checkEmptySlot', checkEmptySlot);
    if (params.toString()) path += '?' + params.toString();

    const { status, body } = await nestFetchAsUser(path, token, { method: 'GET' });
    return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) return unauthorized();

    const payload = await request.json();
    const { status, body } = await nestFetchAsUser(`/master-dropdown`, token, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body, { status });
}

export async function PUT(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) return unauthorized();

    const payload = await request.json();
    const { status, body } = await nestFetchAsUser(`/master-dropdown`, token, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body, { status });
}

export async function DELETE(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const path = id ? `/master-dropdown?id=${encodeURIComponent(id)}` : `/master-dropdown`;

    const { status, body } = await nestFetchAsUser(path, token, { method: 'DELETE' });
    return NextResponse.json(body, { status });
}
