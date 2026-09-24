import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { status, body: hasil } = await nestFetch('/auth/verify-recovery-token', {
            method: 'POST',
            body: JSON.stringify({ token: body?.token ?? '' }),
        });
        return NextResponse.json(hasil ?? { valid: false, message: 'Respon server tidak valid' }, { status: status || 200 });
    } catch {
        return NextResponse.json({ valid: false, message: 'Tidak dapat terhubung ke server' }, { status: 500 });
    }
}
