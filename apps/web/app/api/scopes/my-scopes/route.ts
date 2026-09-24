import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const { status, body } = await nestFetchAsUser('/access/me', token);
        if (status === 200 && body?.user) {
            return NextResponse.json({
                ok: true,
                guru: {
                    nip: body.user.nip,
                    nama: body.user.nama,
                    role: body.user.role
                }
            });
        }
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
