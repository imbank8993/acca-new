/**
 * auth-client.ts
 * ==========================================
 * Client-side helper untuk fetch data user yang sudah login.
 * 
 * Keuntungan vs getUserByAuthId langsung dari client:
 * - Berjalan via /api/auth/me (server-side) → pakai service role key
 * - In-memory cache → tidak fetch ulang jika data sudah ada di sesi ini
 * - Session storage cache → bertahan saat navigasi antar halaman
 * - Tidak create GoTrueClient instance tambahan di browser
 * ==========================================
 */

import type { User } from './types';

// In-memory cache (hilang saat hard refresh atau tab ditutup)
// PENTING: Ini adalah per-browser-tab state, BUKAN server state.
// CATATAN: Modul ini di-import oleh client component yang TETAP di-evaluasi
// saat SSR. Karena itu kita TIDAK boleh throw di module-load. Proteksi terhadap
// kebocoran cache antar-request dilakukan di dalam getCurrentUser() di bawah:
// saat dijalankan di server (typeof window === 'undefined') cache modul di-bypass.
let _cachedUser: User | null = null;
let _cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60_000; // 1 menit

/**
 * Ambil data user yang sedang login.
 * 
 * Urutan prioritas cache:
 * 1. In-memory cache (tercepat, tidak ada network)
 * 2. SessionStorage cache (bertahan antar navigasi, tidak ada network)
 * 3. Fetch ke /api/auth/me (server-side, paling akurat)
 */
export async function getCurrentUser(options: { throwOnFailure?: boolean } = {}): Promise<User | null> {
    const now = Date.now();

    // Guard server context: jangan pernah pakai cache modul di server —
    // _cachedUser akan bocor antar user dalam satu proses Node.js (SSR).
    // Fungsi ini memang dirancang dipanggil dari client (useEffect).
    const isBrowser = typeof window !== 'undefined';

    // 1. In-memory cache masih valid (HANYA di browser)
    if (isBrowser && _cachedUser && (now - _cacheTimestamp) < CACHE_TTL_MS) {
        return _cachedUser;
    }

    // 2. Coba session storage (bertahan saat navigasi SPA)
    if (typeof window !== 'undefined') {
        try {
            const stored = sessionStorage.getItem('__acca_user');
            const storedTs = parseInt(sessionStorage.getItem('__acca_user_ts') || '0');
            if (stored && (now - storedTs) < CACHE_TTL_MS) {
                const parsed = JSON.parse(stored) as User;
                _cachedUser = parsed;
                _cacheTimestamp = storedTs;
                return parsed;
            }
        } catch {
            // abaikan jika sessionStorage tidak tersedia
        }
    }

    // 3. Fetch dari server
    try {
        const res = await fetch('/api/auth/me', {
            credentials: 'include', // pastikan cookies sesi dikirim
            headers: { 'Cache-Control': 'no-cache' }
        });

        if (res.status === 401) { clearUserCache(); return null; }
        if (!res.ok) throw new Error('Sesi belum dapat diperiksa. Silakan coba lagi.');

        const json = await res.json();
        if (!json.ok || !json.user) throw new Error('Respons pemeriksaan sesi tidak lengkap. Silakan coba lagi.');

        const user = json.user as User;

        // Simpan ke caches — HANYA di browser. Di server, cache modul dibagikan
        // antar request sehingga bisa menyebabkan kebocoran sesi antar user.
        if (isBrowser) {
            _cachedUser = user;
            _cacheTimestamp = now;
            try {
                sessionStorage.setItem('__acca_user', JSON.stringify(user));
                sessionStorage.setItem('__acca_user_ts', now.toString());
            } catch {
                // abaikan storage error
            }
        }

        return user;
    } catch (err: any) {
        if (err?.name === 'TypeError' && err?.message === 'Failed to fetch') {
            console.debug('[auth-client] Network error while fetching /api/auth/me (offline or server recompiling)');
        } else {
            console.error('[auth-client] Failed to fetch /api/auth/me:', err);
        }
        if (options.throwOnFailure) throw err;
        return null;
    }
}

/**
 * Hapus cache user (panggil saat logout atau perlu refresh data)
 */
export function clearUserCache() {
    _cachedUser = null;
    _cacheTimestamp = 0;
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.removeItem('__acca_user');
            sessionStorage.removeItem('__acca_user_ts');
        } catch { }
    }
}

/**
 * Paksa refresh data user dari server (bypass semua cache)
 */
export async function refreshCurrentUser(): Promise<User | null> {
    clearUserCache();
    return getCurrentUser();
}

/**
 * Normalisasi role user menjadi array uppercase string.
 * Menangani user.roles (array/string), user.role (string/array), atau null/undefined.
 */
export function getUserRoles(user: any): string[] {
    if (!user) return [];
    const raw = user.roles ?? user.role ?? [];
    if (Array.isArray(raw)) {
        return raw.map((r: any) => String(r).trim().toUpperCase()).filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean);
    }
    return [];
}

/**
 * Periksa apakah user memiliki peran administratif (ADMIN, ADMINISTRATOR, SUPERADMIN)
 */
export function isUserAdmin(user: any): boolean {
    if (!user) return false;
    if (user.isAdmin === true) return true;
    const roles = getUserRoles(user);
    return roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || roles.includes('SUPERADMIN');
}

/**
 * Periksa apakah user adalah Guru/Tenaga Kependidikan/Pegawai yang berhak atas fitur Dokumen Pribadi (Master Guru).
 * Siswa, Pengurus Kelas, Orang Tua/Wali, dan Tamu TIDAK memiliki akses ke Dokumen Pribadi.
 */
export function isMasterGuruUser(user: any): boolean {
    if (!user) return false;
    const roles = getUserRoles(user);

    // Siswa, wali siswa, atau tamu tidak pernah menjadi Master Guru
    const isSiswaOrWali = roles.some(r => [
        'SISWA', 'PENGURUS_KELAS', 'PENGURUS KELAS',
        'ORANG_TUA', 'ORANGTUA', 'WALI', 'TAMU'
    ].includes(r));
    if (isSiswaOrWali) return false;

    // Periksa peran pendidik/tenaga kependidikan atau administrator
    const hasGuruOrStaffRole = roles.some(r => [
        'GURU', 'STAF', 'TU', 'TATA_USAHA', 'BENDAHARA',
        'KAMAD', 'KEPALA_SEKOLAH', 'WAKAMAD', 'WALI_KELAS',
        'ADMIN', 'ADMINISTRATOR', 'SUPERADMIN',
        'BK', 'PEMBINA_EKSKUL', 'PENGAWAS_MADRASAH',
        'WKM_AKADEMIK', 'WKM_KESISWAAN', 'WKM_KEASRAMAAN', 'WKM_HUMAS',
        'OP_IZIN', 'OP_ABSENSI', 'OP_UKS', 'OP_JURNAL', 'OP_AGENDA',
        'OP_LAYANAN', 'OP_PENGUMUMAN', 'OP_FORM', 'OP_LOMBA', 'OP_KELAS',
        'PTSP', 'BANKDATA'
    ].includes(r));

    if (hasGuruOrStaffRole) return true;

    // Fallback NIP: hanya berlaku jika NIP panjang (> 10 digit, bukan format NISN)
    // dan user tidak memiliki role siswa
    const nip = String(user.nip || '').trim();
    if (nip && !user.nisn && nip.length > 10) {
        return true;
    }

    return false;
}
