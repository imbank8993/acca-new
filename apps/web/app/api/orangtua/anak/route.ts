import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

// Relasi orang tua–anak kini dibaca & ditulis di PostgreSQL VPS lewat NestJS,
// sejalan dengan pendaftaran orang tua yang sudah pindah ke sana.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const { status, body } = await nestFetchAsUser('/orangtua/anak', token);
        if (status !== 200) {
            return NextResponse.json(
                { ok: false, error: body?.message || 'Gagal memuat data anak' },
                { status }
            );
        }

        return NextResponse.json({ ok: true, data: body.data || [] });
    } catch (err: any) {
        console.error('API /api/orangtua/anak ERROR:', err);
        return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server internal' }, { status: 500 });
    }
}

/**
 * POST /api/orangtua/anak — klaim anak tambahan dari dashboard orang tua.
 * Body: { nisn, tanggal_lahir_siswa, status_keluarga }
 * Verifikasi sama dengan pendaftaran awal: NISN + tanggal lahir harus cocok,
 * maksimal 2 orang tua per siswa, status Ayah/Ibu unik per siswa.
 */
export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { status, body: result } = await nestFetchAsUser('/orangtua/anak', token, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        if (status !== 200 && status !== 201) {
            return NextResponse.json(
                { ok: false, error: result?.message || 'Gagal menautkan anak' },
                { status }
            );
        }

        return NextResponse.json({ ok: true, message: result?.message });
    } catch (err: any) {
        console.error('API POST /api/orangtua/anak ERROR:', err);
        return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server internal' }, { status: 500 });
    }
}
