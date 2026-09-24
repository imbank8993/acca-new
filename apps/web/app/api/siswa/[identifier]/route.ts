import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    identifier: string;
  }>;
}

/**
 * Daftar siswa satu kelas (nama + NISN).
 *
 * Diteruskan sebagai PEMANGGIL, bukan dengan kunci internal. Versi lama memakai
 * `nestFetch` (x-internal-key) dan tidak memeriksa sesi sama sekali — padahal
 * middleware sengaja tidak mencocokkan `/api`, jadi route handler-lah yang
 * bertanggung jawab atas otentikasinya. Akibatnya `GET /api/siswa/XI-IPA-1`
 * bisa dipanggil siapa saja tanpa login dan mengembalikan daftar kelasnya.
 * `proxy()` menolak permintaan tanpa token.
 */
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  const kelas = decodeURIComponent(params.identifier).trim();

  const { searchParams } = new URL(request.url);
  const tahunAjaran = searchParams.get('tahun_ajaran') || '';
  const semester = searchParams.get('semester') || '';

  const q = new URLSearchParams();
  if (tahunAjaran) q.set('tahun_ajaran', tahunAjaran);
  if (semester) q.set('semester', semester);

  const queryString = q.toString() ? `?${q.toString()}` : '';
  return proxy(request, `/siswa/by-kelas/${encodeURIComponent(kelas)}${queryString}`);
}
