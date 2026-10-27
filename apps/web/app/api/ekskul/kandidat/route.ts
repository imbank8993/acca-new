import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Calon peserta ekskul (siswa per kelas) — hanya pembina ekskul itu / pengelola. */
export async function GET(request: NextRequest) {
    return proxy(request, `/ekskul/kandidat${request.nextUrl.search}`);
}
