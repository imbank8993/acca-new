import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const letterId = req.nextUrl.searchParams.get('letter_id');
    if (!letterId) {
        return NextResponse.json({
            ok: false,
            error: 'Missing letter_id parameter',
        }, { status: 400 });
    }

    try {
        const { status, body } = await nestFetchAsUser(
            `/surat/verify?letter_id=${encodeURIComponent(letterId)}`,
            ''
        );
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message, found: false },
            { status: 500 }
        );
    }
}
