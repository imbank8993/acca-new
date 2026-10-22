import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from './app-jwt';
import { nestFetchAsUser } from './nest-api';

/** Current server permissions only; page visibility never grants database/storage access. */
export async function requireAuditAdmin(request: NextRequest): Promise<NextResponse | null> {
    const token = extractRequestToken(request);
    const privateHeaders = { 'Cache-Control': 'private, no-store' };
    if (!token) return NextResponse.json({ ok: false, error: 'Silakan login kembali.' }, { status: 401, headers: privateHeaders });
    const { status, body } = await nestFetchAsUser('/access/me', token, { signal: AbortSignal.timeout(10000) });
    if (status !== 200 || !body?.user) return NextResponse.json({ ok: false, error: 'Sesi belum dapat diperiksa.' }, { status: status === 401 ? 401 : 503, headers: privateHeaders });
    if (!Array.isArray(body.access?.roles) || !body.access.roles.some((role: string) => ['ADMIN','ADMINISTRATOR'].includes(String(role).toUpperCase()))) {
        return NextResponse.json({ ok: false, error: 'Hanya administrator yang dapat membuka data sistem.' }, { status: 403, headers: privateHeaders });
    }
    return null;
}
