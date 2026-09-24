/**
 * POST /api/sidebar-badges/seen
 * Tandai sebuah antrean badge sebagai "sudah dilihat sampai sekarang".
 *
 * Hanya berlaku untuk badge bertipe KABAR BARU (nilai siswa, hasil validasi
 * prestasi) — badge yang pemiliknya tidak bisa menindak apa pun sehingga tidak
 * bisa hilang dengan sendirinya. Antrean tindakan tidak boleh lewat sini: ia
 * harus turun karena dikerjakan, bukan karena halamannya dibuka.
 *
 * Body: { queue: 'nilai-siswa' | 'prestasi-hasil' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { tandaiDilihat, ANTREAN_BERPENANDA, type AntreanBerpenanda } from '@/lib/sidebar-badges';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();

        const { queue } = await request.json().catch(() => ({ queue: null }));

        // Daftar putih: tanpa ini pemanggil bisa membuat baris penanda untuk
        // kunci sembarangan dan menumpuki tabelnya.
        if (!ANTREAN_BERPENANDA.includes(queue)) {
            return NextResponse.json(
                { ok: false, error: `queue harus salah satu dari: ${ANTREAN_BERPENANDA.join(', ')}` },
                { status: 400 }
            );
        }

        const ok = await tandaiDilihat(
            { nip: user.nip, roles: user.roles, authId: user.authId },
            queue as AntreanBerpenanda
        );

        return NextResponse.json({ ok });
    } catch (err: any) {
        console.error('[sidebar-badges/seen] error:', err);
        return NextResponse.json({ ok: false, error: err?.message || 'Gagal menandai' }, { status: 500 });
    }
}
