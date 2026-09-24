import { NextRequest, NextResponse } from 'next/server';

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3007/api';

/**
 * Pendaftaran orang tua + klaim anak — seluruhnya dilayani NestJS di atas
 * PostgreSQL VPS, termasuk pembuatan kredensialnya, supaya akun yang baru
 * dibuat langsung bisa dipakai login dan `orangtua_siswa.user_id` menunjuk
 * baris users yang benar-benar ada.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${NEST_API_URL}/register/parent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.message || 'Pendaftaran gagal';
      return NextResponse.json(
        { ok: false, error: Array.isArray(message) ? message[0] : message },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, message: data?.message || 'Pendaftaran dan klaim siswa berhasil.' });
  } catch (err: any) {
    console.error('register-parent error:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server internal' }, { status: 500 });
  }
}
