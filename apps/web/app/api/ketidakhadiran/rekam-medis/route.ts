import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const search = req.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/ketidakhadiran/rekam-medis-siswa${search}`, token);
    return NextResponse.json(body || { ok: false }, { status });
}

export async function POST(req: NextRequest) {
    const token = extractRequestToken(req);
    const bodyInput = await req.json().catch(() => ({}));
    const { status, body } = await nestFetchAsUser('/ketidakhadiran/rekam-medis-siswa', token, {
        method: 'POST',
        body: JSON.stringify(bodyInput)
    });
    return NextResponse.json(body || { ok: false }, { status });
}

export async function PUT(req: NextRequest) {
    const token = extractRequestToken(req);
    const bodyInput = await req.json().catch(() => ({}));
    const search = req.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/ketidakhadiran/rekam-medis-siswa${search}`, token, {
        method: 'PUT',
        body: JSON.stringify(bodyInput)
    });
    return NextResponse.json(body || { ok: false }, { status });
}

export async function DELETE(req: NextRequest) {
    const token = extractRequestToken(req);
    const search = req.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/ketidakhadiran/rekam-medis-siswa${search}`, token, {
        method: 'DELETE'
    });
    return NextResponse.json(body || { ok: false }, { status });
}