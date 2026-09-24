import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

/**
 * Helper terpusat untuk meneruskan (proxy) request route handler Next.js ke NestJS backend.
 * Mengambil JWT token dari request, menyertakannya ke nestFetchAsUser, dan mengembalikan
 * NextResponse dengan status code dan payload dari backend NestJS.
 */
export async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { status, body } = await nestFetchAsUser(path, token, init);
    if (status !== 200 && status !== 201) {
        return NextResponse.json(
            { ok: false, error: body?.message || body?.error || 'Permintaan gagal' },
            { status }
        );
    }
    return NextResponse.json(body);
}
