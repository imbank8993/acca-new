import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Tambah beberapa peserta sekaligus ke satu ekskul (pembina ekskul itu / pengelola). */
export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/ekskul/siswa/tambah', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
