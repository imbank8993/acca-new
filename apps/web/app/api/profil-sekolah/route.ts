import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const path = id ? `/profil-sekolah?id=${id}` : `/profil-sekolah`;
    
    const { status, body } = await nestFetchAsUser(path, token, { method: 'GET' });
    return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    const payload = await request.json();
    
    const { status, body } = await nestFetchAsUser(`/profil-sekolah`, token, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body, { status });
}

export async function PUT(request: NextRequest) {
    const token = extractRequestToken(request);
    const payload = await request.json();
    
    const { status, body } = await nestFetchAsUser(`/profil-sekolah`, token, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body, { status });
}