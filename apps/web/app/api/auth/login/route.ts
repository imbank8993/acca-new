import { NextRequest, NextResponse } from 'next/server';
import { encodeSessionCookie } from '@/lib/app-jwt';
import { logoutResponse } from '@/lib/single-logout';

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://127.0.0.1:3007/api';

export const dynamic = 'force-dynamic';

const COOKIE_NAMES = {
  accessToken: 'acca_session',
  refreshToken: 'acca_refresh_token',
};

/**
 * Kapan cookie sesi harus mati — dibaca dari klaim `exp` token itu sendiri.
 *
 * Panjang sesi ditentukan di SATU tempat: `JWT_EXPIRES_IN` pada backend NestJS.
 * Dengan menurunkan umur cookie dari token, keduanya tidak bisa melenceng —
 * mengubah env di backend otomatis mengubah cookie, tanpa ada angka kedua yang
 * harus diingat untuk ikut disamakan.
 *
 * Tanda tangannya tidak diverifikasi di sini, dan memang tidak perlu: token ini
 * baru saja diterima langsung dari API kita sendiri, dan nilainya hanya dipakai
 * untuk menentukan masa berlaku cookie. Otoritas sesungguhnya tetap verifikasi
 * di middleware dan di NestJS.
 */
function sessionExpiry(accessToken: string): Date {
  const CADANGAN = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return CADANGAN;
    const klaim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof klaim?.exp === 'number' ? new Date(klaim.exp * 1000) : CADANGAN;
  } catch {
    return CADANGAN;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username: rawUsername, password } = body;
    const username = rawUsername?.trim();

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const nestRes = await fetch(`${NEST_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: username, password }),
    });

    const nestData = await nestRes.json().catch(() => null);

    if (!nestRes.ok || !nestData?.access_token) {
      const message = nestData?.message || 'Username atau password salah';
      return NextResponse.json({ ok: false, error: Array.isArray(message) ? message[0] : message }, { status: nestRes.status || 401 });
    }

    const xfProto = request.headers.get('x-forwarded-proto');
    const isHttps = xfProto === 'https' || request.nextUrl.protocol === 'https:';
    /**
     * `httpOnly` wajib: isi cookie ini adalah JWT sesi, dan selama bisa dibaca
     * `document.cookie` satu celah XSS di halaman mana pun cukup untuk
     * mencurinya. Tidak ada lagi kode klien yang membacanya — pemeriksaan sesi
     * di browser lewat `/api/auth/me`, yang membaca cookie ini di sisi server.
     */
    const cookieOpts = {
      path: '/',
      expires: sessionExpiry(nestData.access_token),
      sameSite: 'lax' as const,
      secure: isHttps,
      httpOnly: true,
    };

    // Diteruskan ke klien supaya halaman login bisa mengarahkan pemakai mengganti
    // password sementara yang baru diberikan admin. Penandanya dihitung backend
    // dari `auth_users.raw_user_meta_data`, bukan dari token.
    const res = NextResponse.json(
      {
        ok: true,
        message: 'Login berhasil',
        must_change_password: nestData?.must_change_password === true,
      },
      { status: 200 },
    );
    res.cookies.set(COOKIE_NAMES.accessToken, encodeSessionCookie(nestData.access_token), cookieOpts);

    console.log('[login] Session cookie set for user:', username);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Login error:', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const DELETE = logoutResponse;
