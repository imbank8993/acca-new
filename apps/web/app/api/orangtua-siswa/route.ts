import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

// Pengelolaan relasi orang tua–siswa (tab "Relasi Orang Tua") dilayani NestJS
// di atas PostgreSQL VPS. Gerbang izinnya ditegakkan backend: akses halaman
// `pengaturan-data` untuk melihat, dan khusus Admin untuk mengubah.
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { status, body } = await nestFetchAsUser(path, token, init);
    if (status !== 200 && status !== 201) {
        return NextResponse.json(
            { ok: false, error: body?.message || 'Permintaan gagal' },
            { status }
        );
    }
    return NextResponse.json(body);
}

/**
 * GET /api/orangtua-siswa — view untuk role dengan akses pengaturan-data
 * (tab Relasi Orang Tua); pencarian siswa khusus Admin (form tambah).
 * - ?siswa=<query>  → cari siswa (nisn / nama) untuk form tambah relasi
 * - tanpa query     → seluruh relasi orangtua_siswa + daftar akun ORANG_TUA
 */
export async function GET(request: NextRequest) {
    const siswa = request.nextUrl.searchParams.get('siswa');
    const path = siswa ? `/orangtua/relasi?siswa=${encodeURIComponent(siswa)}` : '/orangtua/relasi';
    return proxy(request, path);
}

/**
 * POST /api/orangtua-siswa — Admin menautkan siswa ke akun orang tua.
 * Body: { user_id, nisn, status_keluarga }
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/orangtua/relasi', { method: 'POST', body: JSON.stringify(body) });
}

/** PATCH /api/orangtua-siswa — ubah status keluarga sebuah relasi. */
export async function PATCH(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/orangtua/relasi', { method: 'PATCH', body: JSON.stringify(body) });
}

/** DELETE /api/orangtua-siswa?id=<uuid> — hapus relasi (akun ortu tetap ada). */
export async function DELETE(request: NextRequest) {
    const id = (request.nextUrl.searchParams.get('id') || '').trim();
    return proxy(request, `/orangtua/relasi?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
