import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { CAPABILITY_KEYS, defaultRoleCapabilities, resolveCapabilities } from '@/lib/capabilities';

/**
 * GET /api/me/capabilities — kapabilitas efektif pengguna yang sedang login.
 *
 * Dipakai komponen klien untuk menyembunyikan tombol yang tidak boleh ditekan.
 * Ini SEMATA-MATA soal tampilan: setiap fungsi tetap dijaga `requireCap` di
 * route-nya masing-masing, karena respons ini bisa saja dipalsukan di browser.
 *
 * Kenapa endpoint tersendiri dan bukan menumpang data user yang sudah ada:
 * halaman-halaman menarik barisnya sendiri langsung dari tabel `users`, yang
 * tidak punya kolom caps (dan juga tidak tahu role turunan dari penugasan).
 */
export async function GET(request: NextRequest) {
    const user = await getApiUser(request);
    if (!user) return unauthorizedResponse();

    // Admin lolos semua gerbang di `can()`; kirim daftar penuh agar UI konsisten.
    // caps undefined = resolusi gagal/belum di-seed → pakai paket bawaan registry,
    // sama seperti perilaku fallback `can()` di server.
    const caps = user.isAdmin
        ? [...CAPABILITY_KEYS]
        : (user.caps ?? resolveCapabilities(user.roles, defaultRoleCapabilities()));

    return NextResponse.json({ ok: true, caps, roles: user.roles, isAdmin: user.isAdmin });
}
