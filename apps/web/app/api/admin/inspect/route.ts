import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    const { status, body } = await nestFetchAsUser('/jurnal', token);
    return NextResponse.json({
        sample: (body?.data || []).slice(0, 20),
        all_columns: (body?.data && body.data.length > 0) ? Object.keys(body.data[0]) : []
    }, { status });
}
