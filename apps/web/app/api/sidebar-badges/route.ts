/**
 * GET /api/sidebar-badges
 * Jumlah antrean yang menunggu tindakan user yang sedang login, per id menu sidebar.
 *
 * Perhitungan sengaja di server (service role) supaya aturan "siapa boleh menindak apa"
 * tinggal di satu tempat dan klien tidak perlu diberi akses baca ke tabel antrean.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { computeSidebarBadges } from '@/lib/sidebar-badges';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();

        const badges = await computeSidebarBadges({
            nip: user.nip,
            roles: user.roles,
            // Antrean klinik ikut penunjukan petugas, bukan nama role.
            caps: user.caps,
            authId: user.authId,
        });

        return NextResponse.json({ ok: true, ...badges });
    } catch (err: any) {
        console.error('[sidebar-badges] error:', err);
        return NextResponse.json({ ok: false, error: err?.message || 'Gagal menghitung antrean' }, { status: 500 });
    }
}
