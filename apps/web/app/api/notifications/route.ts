import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Notifikasi untuk pemakai yang sedang login.
 *
 * Sebelumnya rute ini memakai `nestFetch`, yang mengirim `x-internal-key` dan
 * melewati `JwtAuthGuard` di backend. Dua akibatnya:
 *
 *  1. Endpoint terbuka TANPA LOGIN sama sekali.
 *  2. Karena guard dilewati, `req.user` di backend kosong — dan
 *     `NotificationsController` justru mengambil role serta userId dari `req.user`.
 *     Dengan keduanya kosong, penyaringan di `NotificationsService` tidak pernah
 *     aktif (`if (role || userId)` bernilai false), sehingga yang dikembalikan
 *     adalah SELURUH notifikasi aktif — bukan hanya milik satu role. Isinya memuat
 *     nama pengguna dan rincian proses internal (pengajuan izin, tukar jadwal,
 *     akun baru).
 *
 * `role` dan `userId` dari query sengaja TIDAK diteruskan lagi: backend memang
 * mengabaikannya dan menentukan keduanya dari token, jadi meneruskannya hanya
 * menyesatkan pembaca berikutnya.
 */
export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized', data: [] }, { status: 401 });
  }

  const { status, body } = await nestFetchAsUser('/notifications', token);
  return NextResponse.json(body || { ok: false, data: [] }, { status: status || 200 });
}

export async function POST(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const bodyData = await request.json().catch(() => ({}));
  const { status, body } = await nestFetchAsUser('/notifications', token, {
    method: 'POST',
    body: JSON.stringify(bodyData),
  });
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
