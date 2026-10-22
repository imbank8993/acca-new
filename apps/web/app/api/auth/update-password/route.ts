import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { authErrorMessage } from '@/lib/auth-error-message';

/**
 * Set password baru untuk sesi yang sedang berjalan.
 *
 * Password disimpan sebagai bcrypt di auth_users (PostgreSQL VPS) — tabel yang
 * sama yang diperiksa saat login. Tanpa ini, password baru tidak akan berlaku.
 */
export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json(
                { ok: false, error: 'Sesi tidak valid atau telah kedaluwarsa (Token tidak ditemukan)' },
                { status: 401 }
            );
        }

        const { password, oldPassword } = await request.json();
        if (typeof password !== 'string' || password.length < 6) {
            return NextResponse.json({ ok: false, error: 'Password minimal 6 karakter' }, { status: 400 });
        }
        if (typeof oldPassword !== 'string' || !oldPassword) return NextResponse.json({ ok: false, error: 'Password saat ini wajib diisi. Gunakan password sementara dari admin jika akun baru direset.' }, { status: 400 });

        const { status, body } = await nestFetchAsUser('/users/me/password', token, {
            method: 'POST',
            body: JSON.stringify({ password, oldPassword }),
        });

        if (status === 401) {
            return NextResponse.json(
                { ok: false, error: 'Sesi tidak valid atau telah kedaluwarsa' },
                { status: 401 }
            );
        }
        if (status !== 200 && status !== 201) {
            return NextResponse.json(
                { ok: false, error: authErrorMessage(body, status, 'Gagal memperbarui password') },
                { status }
            );
        }

        const response = NextResponse.json({ ok: true, message: 'Password berhasil diperbarui' });
        response.cookies.set('acca_session', '', {
            httpOnly: true, secure: request.headers?.get('x-forwarded-proto') === 'https' || request.nextUrl?.protocol === 'https:',
            sameSite: 'lax', path: '/', maxAge: 0,
        });
        return response;
    } catch (error: any) {
        console.error('Update password error:', error);
        return NextResponse.json({ ok: false, error: 'Layanan akun sedang tidak tersedia. Silakan coba lagi beberapa saat.' }, { status: 500 });
    }
}
