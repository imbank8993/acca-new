import { nestFetchAsUser } from '@/lib/nest-api';
import { decodeSessionCookie } from '@/lib/app-jwt';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nip = searchParams.get('nip');
  const kelas = searchParams.get('kelas');
  const tanggal = searchParams.get('tanggal');

  const params = new URLSearchParams();
  if (nip) params.set('nip', nip);
  if (kelas) params.set('kelas', kelas);
  if (tanggal) params.set('tanggal', tanggal);

  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    const cookieStore = await cookies();
    const raw = cookieStore.get('acca_session')?.value || '';
    token = decodeSessionCookie(raw);
  }

  /**
   * Tanpa token, permintaan DITOLAK.
   *
   * Sebelumnya cabang ini jatuh ke `nestFetch`, yang mengirim `x-internal-key` —
   * dan kunci itu melewati seluruh guard di backend. Akibatnya endpoint ini bisa
   * dipanggil TANPA LOGIN sama sekali, dan responsnya memuat NIP guru (username
   * login pegawai), namanya, seluruh daftar kelas, serta mapel per kelas. Siapa pun
   * yang bisa menjangkau server dapat memanennya dengan menyisir NIP.
   *
   * Kunci internal memang untuk pemanggilan antar-service, bukan untuk menutupi
   * permintaan dari browser yang tidak punya sesi.
   */
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { status, body } = await nestFetchAsUser(`/jadwal/scopes?${params.toString()}`, token);

  return NextResponse.json(body || { ok: false }, { status: status || 200 });
}

