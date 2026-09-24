import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const requestBody = await request.json();

        const { status, body } = await nestFetchAsUser('/dokumen/bulk-delete', token, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
