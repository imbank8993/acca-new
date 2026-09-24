import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = extractRequestToken(request);
        const { status, body } = await nestFetchAsUser(`/ketidakhadiran/acca-letter/${id}`, token, {
            method: 'DELETE',
        });
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
