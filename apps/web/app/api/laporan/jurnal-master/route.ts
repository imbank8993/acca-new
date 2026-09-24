import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Sesi wajib: rekap jurnal mengajar bisa dicari per NIP atau nama guru, jadi
 * tanpa penjagaan ini siapa pun bisa menelusuri aktivitas guru mana pun.
 *
 * Diteruskan dengan `nestFetchAsUser`, BUKAN `nestFetch`. Kunci internal
 * melewati `JwtAuthGuard`, sehingga `req.user` di backend kosong — dan
 * `getJurnalMaster` justru memakai identitas itu untuk memutuskan apakah
 * `?nip=` dan `?nama_guru=` milik orang lain boleh ditanyakan. Dengan kunci
 * internal, setiap pemanggil tampak sebagai bukan-siapa-siapa dan pembatasannya
 * tidak dapat bekerja.
 */
export async function GET(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const valid_date = searchParams.get('valid_date') || '';
  const nip = searchParams.get('nip') || '';
  const nama_guru = searchParams.get('nama_guru') || '';

  const q = new URLSearchParams();
  if (valid_date) q.set('valid_date', valid_date);
  if (nip) q.set('nip', nip);
  if (nama_guru) q.set('nama_guru', nama_guru);

  const queryString = q.toString() ? `?${q.toString()}` : '';
  const { status, body } = await nestFetchAsUser(`/jurnal/jurnal-master${queryString}`, token);
  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}
