import { NextRequest } from 'next/server';
import { can, CAPABILITIES, CAPABILITY_KEYS, isKnownCapability, type CapabilityKey } from './capabilities';
import { verifyAppSession, extractRequestToken } from './app-jwt';
import { fetchMyAccess } from './nest-api';

export interface ApiUser {
    authId: string;
    /** Nama tampilan; dipakai saat identitas pelaku tidak boleh berasal dari body request. */
    nama: string;
    nip: string;
    /** NISN siswa (kosong utk non-siswa); dipakai memetakan ke master_siswa */
    nisn: string;
    roles: string[];
    /**
     * Kapabilitas efektif (fungsi yang boleh dijalankan) — lihat lib/capabilities.ts.
     * `undefined` = belum ter-resolve; `can()` jatuh ke paket bawaan registry.
     */
    caps?: string[];
    /**
     * Halaman yang boleh dibuka user ini — hasil resolusi `role_pages` (union
     * antar role) + override per-user, sama persis dengan yang dipakai sidebar.
     *
     * BUKAN `canAccessPage()` di lib/page-requirements.ts: fungsi itu membaca
     * daftar statis di kode dan menjawab `true` untuk halaman yang tidak
     * terdaftar di sana — tidak berguna sebagai gerbang bagi halaman yang
     * gerbangnya memang murni role_pages.
     */
    pages: string[];
    isAdmin: boolean;
    /** ADMIN / OP_JURNAL: boleh mengelola sesi absensi milik guru lain */
    isPrivileged: boolean;
}

/**
 * Verifikasi access token (cookie atau header Bearer) dan kembalikan
 * identitas user aplikasi (nip + roles). Return null jika tidak valid.
 */
export async function getApiUser(request: NextRequest): Promise<ApiUser | null> {
    const token = extractRequestToken(request);
    if (!token) return null;

    try {
        const claims = await verifyAppSession(token);
        if (!claims || (!claims.authId && !claims.sub)) {
            console.warn('[api-auth] Token verify failed or missing sub/authId');
            return null;
        }

        const effectiveAuthId = claims.authId || claims.sub;

        // Sekali panggil ke NestJS: identitas + otorisasi sudah lengkap dari VPS.
        const payload = await fetchMyAccess(token);
        if (payload?.user) {
            const appUser: any = payload.user;
            const roles: string[] = (payload.access?.roles || []).map((r: string) => String(r).toUpperCase());
            const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');

            return {
                authId: effectiveAuthId,
                nama: appUser.nama || appUser.nama_lengkap || appUser.username || claims.username || '',
                nip: appUser.nip || appUser.username || claims.username || '',
                // Tabel users tidak punya kolom nisn; utk siswa NISN tersimpan di
                // nip/username (login). Samakan dgn resolusi di DashboardContent.
                nisn: appUser.nisn || appUser.nip || appUser.username || claims.username || '',
                roles,
                caps: isAdmin ? [...CAPABILITY_KEYS] : payload.access?.caps?.filter(isKnownCapability) ?? undefined,
                pages: payload.access?.pageIds || [],
                isAdmin,
                isPrivileged: isAdmin || roles.includes('OP_JURNAL'),
            };
        }

        // Fallback jika backend NestJS lambat/unreachable tetapi JWT valid
        const roles: string[] = claims.role ? [claims.role.toUpperCase()] : [];
        const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
        return {
            authId: effectiveAuthId,
            nama: claims.username || '',
            nip: claims.username || '',
            nisn: claims.username || '',
            roles,
            caps: isAdmin ? [...CAPABILITY_KEYS] : undefined,
            pages: claims.pageIds || [],
            isAdmin,
            isPrivileged: isAdmin,
        };
    } catch (e) {
        console.error('[api-auth] Failed to verify token:', e);
        return null;
    }
}

export function unauthorizedResponse() {
    return Response.json(
        { ok: false, error: 'Unauthorized: token tidak valid atau tidak ada' },
        { status: 401 }
    );
}

export function forbiddenResponse(message = 'Forbidden: Anda tidak memiliki izin untuk aksi ini') {
    return Response.json({ ok: false, error: message }, { status: 403 });
}

/**
 * Gerbang kapabilitas untuk route handler.
 *
 * Kembalikan `null` bila boleh lanjut, atau Response 403 bila tidak:
 *
 *   const denied = requireCap(user, 'klinik.approve_slot');
 *   if (denied) return denied;
 *
 * Dipakai menggantikan cek role hardcoded (`roles.includes('OP_KLINIK')`)
 * supaya izin bisa diatur admin lewat data, bukan lewat deploy.
 */
export function requireCap(
    user: ApiUser | null,
    key: CapabilityKey,
    message?: string
): Response | null {
    if (!user) return unauthorizedResponse();
    if (can(user, key)) return null;
    return forbiddenResponse(message || `Forbidden: Anda tidak memiliki izin "${CAPABILITIES[key].label}"`);
}

/**
 * Gerbang AKSES HALAMAN untuk route handler — dipakai ketika izin sebuah aksi
 * memang cuma "boleh membuka halamannya", tanpa kapabilitas tersendiri.
 *
 *   const denied = requirePage(user, 'bank-data');
 *   if (denied) return denied;
 *
 * Perlu dipanggil eksplisit: middleware hanya menjaga NAVIGASI ke halaman, dan
 * route /api/* tidak ikut terjaga olehnya. Tanpa ini, siapa pun yang punya
 * token — termasuk siswa dan orang tua — bisa memanggil route-nya langsung.
 */
export function requirePage(
    user: ApiUser | null,
    pageId: string,
    message?: string
): Response | null {
    if (!user) return unauthorizedResponse();
    if (user.isAdmin || user.pages.includes(pageId)) return null;
    return forbiddenResponse(message || 'Forbidden: Anda tidak memiliki akses ke halaman ini');
}
