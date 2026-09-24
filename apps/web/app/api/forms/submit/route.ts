import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);

    try {
        const body = await request.json();
        const { status, body: result } = await nestFetchAsUser(
            '/forms/submit',
            token || '',
            {
                method: 'POST',
                body: JSON.stringify(body),
            }
        );

        if (status === 200 || status === 201) {
            return NextResponse.json({ success: true, ...result });
        }

        return NextResponse.json(
            { error: result?.message || result?.error || 'Gagal menyimpan tanggapan' },
            { status }
        );
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
