import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { corsResponse, handleOptions } from '@/lib/cors';

/**
 * Semua route data master mengikuti kontrak yang sama (GET daftar, POST tambah/
 * upsert, PUT ubah, DELETE nonaktifkan). Backend NestJS sudah menanganinya
 * secara generik di `/master/:entity`, jadi di sini cukup satu pabrik handler
 * ketimbang menyalin ulang CRUD yang sama di tiap berkas.
 *
 * Otorisasinya ditegakkan backend, per TAB, lewat baris `site_settings` yang
 * ditunjuk di Pengaturan Users → Hak Akses Fitur: barisnya boleh dibaca semua
 * PEGAWAI yang login (dipakai sebagai sumber dropdown di banyak halaman), tetapi
 * kolom pribadi hanya ikut terkirim untuk pengelola tab itu — sama seperti izin
 * menulis. `?scope=all` menghapus permanen dan menuntut `?confirm=all`.
 */
export function masterRouteHandlers(entity: string) {
    async function proxy(request: NextRequest, init: RequestInit = {}, search = '') {
        const token = extractRequestToken(request);
        if (!token) {
            return corsResponse(
                NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
            );
        }

        try {
            const { status, body } = await nestFetchAsUser(
                `/master/${entity}${search}`,
                token,
                init
            );

            if (status !== 200 && status !== 201) {
                return corsResponse(
                    NextResponse.json(
                        { ok: false, error: body?.message || 'Permintaan gagal' },
                        { status }
                    )
                );
            }

            return corsResponse(NextResponse.json(body));
        } catch (error: any) {
            return corsResponse(
                NextResponse.json({ ok: false, error: error.message }, { status: 500 })
            );
        }
    }

    return {
        async GET(request: NextRequest) {
            return proxy(request, {}, request.nextUrl.search);
        },

        async POST(request: NextRequest) {
            const body = await request.json();
            return proxy(
                request,
                { method: 'POST', body: JSON.stringify(body) },
                request.nextUrl.search
            );
        },

        async PUT(request: NextRequest) {
            const body = await request.json();
            return proxy(request, { method: 'PUT', body: JSON.stringify(body) });
        },

        async DELETE(request: NextRequest) {
            return proxy(request, { method: 'DELETE' }, request.nextUrl.search);
        },

        OPTIONS() {
            return handleOptions();
        },
    };
}
