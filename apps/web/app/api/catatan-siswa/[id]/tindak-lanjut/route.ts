export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = extractRequestToken(req);
    const { id } = await params;
    const payload = await req.json();
    const { status, body } = await nestFetchAsUser(`/catatan-siswa/${id}/tindak-lanjut`, token, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body || {}, { status });
}

