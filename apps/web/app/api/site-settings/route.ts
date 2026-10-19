import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { clearWAConfigCache } from '@/lib/wa-sender';
import { clearFileStorageConfigCache } from '@/lib/file-storage';

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const path = key ? `/site-settings?key=${key}` : `/site-settings`;
    
    const { status, body } = await nestFetchAsUser(path, token, { method: 'GET' });
    return NextResponse.json(body, { status });
}

export async function PUT(request: NextRequest) {
    const token = extractRequestToken(request);
    const payload = await request.json();
    
    const { status, body } = await nestFetchAsUser(`/site-settings`, token, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });

    if (status === 200 || status === 201) {
        clearWAConfigCache();
        clearFileStorageConfigCache();
    }

    return NextResponse.json(body, { status });
}

export async function PATCH(request: NextRequest) {
    const token = extractRequestToken(request);
    const payload = await request.json();
    const { status, body } = await nestFetchAsUser(`/site-settings/bulk`, token, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (status === 200 || status === 201) {
        clearWAConfigCache();
        clearFileStorageConfigCache();
    }
    return NextResponse.json(body, { status });
}
