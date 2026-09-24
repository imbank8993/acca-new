import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function DELETE(req: NextRequest) {
    const token = extractRequestToken(req);
    let payload: any = await req.json().catch(() => null);
    if (!payload) {
        const search = req.nextUrl.searchParams;
        payload = {
            startDate: search.get('startDate'),
            endDate: search.get('endDate') || search.get('startDate'),
            jamKe: search.get('jamKe') || '',
            termasuk_terisi: search.get('termasuk_terisi') === 'true',
        };
    }
    const { status, body } = await nestFetchAsUser('/jurnal/pengaturan/delete-by-date', token, {
        method: 'DELETE',
        body: JSON.stringify(payload)
    });
    return NextResponse.json(body || {}, { status });
}

