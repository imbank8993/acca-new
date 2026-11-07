import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

/**
 * Kelola link publik satu berkas Dokumen Sekolah.
 *   GET    → daftar link berkas ini
 *   POST   → buat link baru
 *   PATCH  ?linkId=…  body { revoked } → aktif/nonaktifkan
 *   DELETE ?linkId=…  → hapus link
 * Hak akses (pengunggah atau pengelola dokumen) diperiksa di backend.
 */
async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { status, body } = await nestFetchAsUser(path, token, init);
    if (status < 200 || status >= 300 || body?.ok === false) {
        return NextResponse.json(
            { ok: false, error: body?.message || body?.error || 'Permintaan gagal' },
            { status: status >= 400 ? status : 400 },
        );
    }
    return NextResponse.json(body);
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    return proxy(request, `/dokumen/uploaded-documents/${encodeURIComponent(id)}/share`);
}

export async function POST(request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    return proxy(request, `/dokumen/uploaded-documents/${encodeURIComponent(id)}/share`, { method: 'POST' });
}

export async function PATCH(request: NextRequest) {
    const linkId = new URL(request.url).searchParams.get('linkId') || '';
    const data = await request.json().catch(() => ({}));
    return proxy(request, `/dokumen/share-links/${encodeURIComponent(linkId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ revoked: data?.revoked }),
    });
}

export async function DELETE(request: NextRequest) {
    const linkId = new URL(request.url).searchParams.get('linkId') || '';
    return proxy(request, `/dokumen/share-links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
}
