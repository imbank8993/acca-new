import { NextRequest, NextResponse } from 'next/server';

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3007/api';

/**
 * Pendaftaran/aktivasi mandiri akun siswa.
 * Seluruh verifikasi (NISN, tgl lahir) dan penulisan kredensial dilayani NestJS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${NEST_API_URL}/register/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.message || 'Aktivasi siswa gagal';
      return NextResponse.json(
        { ok: false, error: Array.isArray(message) ? message[0] : message },
        { status: res.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: data?.message || 'Akun siswa berhasil diaktifkan.',
      username: data?.username,
      nama: data?.nama,
    });
  } catch (err: any) {
    console.error('register-student error:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server internal' }, { status: 500 });
  }
}
