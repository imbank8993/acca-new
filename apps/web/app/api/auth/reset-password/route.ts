import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { user_id, new_password } = body;

        if (!user_id) {
            return NextResponse.json({ ok: false, error: 'User ID wajib diisi' }, { status: 400 });
        }

        const { status, body: nestBody } = await nestFetchAsUser(
            '/auth/admin/reset-password',
            token,
            {
                method: 'POST',
                // `new_password` TIDAK diberi nilai bawaan di sini. Dulu diisi
                // 'acca123', sehingga password sementara acak yang dibuat backend
                // tidak pernah terpakai — proxy selalu menimpanya dengan satu nilai
                // yang sama untuk semua akun.
                body: JSON.stringify(
                    new_password && String(new_password).trim()
                        ? { user_id, new_password: String(new_password).trim() }
                        : { user_id },
                ),
            }
        );

        if (status !== 200 && status !== 201) {
            return NextResponse.json(
                { ok: false, error: nestBody?.message || nestBody?.error || 'Gagal mereset password' },
                { status }
            );
        }

        return NextResponse.json({
            ok: true,
            // Nilai sebenarnya datang dari backend (acak per akun) — ini
            // satu-satunya kesempatan menampilkannya, karena yang tersimpan
            // hanyalah hash-nya.
            password: nestBody?.password || new_password || null,
            harusGanti: nestBody?.harusGanti === true,
            message: nestBody?.message || 'Password berhasil direset',
        });
    } catch (error: any) {
        console.error('Reset password error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

