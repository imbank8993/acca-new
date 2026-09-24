import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const search = req.nextUrl.search;
    const token = extractRequestToken(req);

    const { status, body } = await nestFetchAsUser(
        `/surat/generate-number${search}`,
        token || ''
    );
    return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
    const token = extractRequestToken(req);
    try {
        const body = await req.json();
        const { status, body: result } = await nestFetchAsUser(
            '/surat/generate-number',
            token || '',
            {
                method: 'POST',
                body: JSON.stringify(body),
            }
        );
        return NextResponse.json(result, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
