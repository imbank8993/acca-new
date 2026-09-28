// Authentication helper functions

import type { User, PageNode } from './types';
import { toPagesString } from './role-pages';
import { CAPABILITY_KEYS, isKnownCapability } from './capabilities';
import {
    fetchUserAccessByAuthId,
    fetchUserAccessByUsername,
    type NestAccess,
    type NestUserAccess,
} from './nest-api';

/**
 * Parse role string into array
 * Supports: "GURU,KAMAD" or "GURU|KAMAD"
 */
export function parseRoles(roleStr: string): string[] {
    if (!roleStr) return [];

    const parts = roleStr
        .split(/[,|]/)
        .map(r => r.trim().toUpperCase().replace(/\s+/g, '_'))
        .filter(Boolean);

    return [...new Set(parts)]; // Remove duplicates
}

/**
 * Format role for display (e.g. "ADMIN" -> "Admin", "GURU_ASUH" -> "Guru Asuh")
 */
export function formatRoleDisplay(role: string): string {
    if (!role) return '';
    const upperRole = role.toUpperCase();

    // Spesifik untuk OP_ABSENSI & OP_FORM
    if (upperRole === 'OP_ABSENSI') return 'OP_Absensi';
    if (upperRole === 'OP_FORM') return 'OP_Form';

    return role
        .split(/[_, ]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Parse pages string into array and tree structure
 * Format: "Dashboard,User,Laporan>ExportJurnal|ExportAbsensi"
 * Also supports legacy format with Unicode checkbox symbols: "☑Page1☐Page2"
 */
export function parsePages(pagesStr: string): {
    pagesArray: string[];
    pagesTree: PageNode[];
} {
    if (!pagesStr) return { pagesArray: [], pagesTree: [] };

    // Clean Unicode symbols that might be used as prefixes
    // Remove: ☑ ☐ 📊 📋 🔧 ↓ 📣 🎓 👥 ⊗ and other common emoji/symbols
    let cleanedStr = pagesStr.replace(/[☑☐📊📋🔧↓📣🎓👥⊗🎯📈📉✓✔️❌⚠️📌📍🔔🔕]/g, '');

    // Replace Unicode checkbox symbols with comma if they're being used as separators
    // This handles legacy format where ☐ was used instead of comma
    cleanedStr = cleanedStr.replace(/[\u2610\u2611\u2612]/g, ',');

    // Split by comma and clean up
    const tokens = cleanedStr.split(',').map(s => s.trim()).filter(Boolean);
    const tree: PageNode[] = [];
    const flatPages: string[] = [];

    tokens.forEach(token => {
        // Check if it's a parent with children (contains ">")
        if (token.includes('>')) {
            const [parentTitle, childrenStr] = token.split('>');
            const parent = parentTitle.trim();

            if (!parent) return;

            const children: PageNode[] = [];
            const childTokens = childrenStr.split('|').map(s => s.trim()).filter(Boolean);

            childTokens.forEach(childToken => {
                // Support "Label=Page" format
                if (childToken.includes('=')) {
                    const [label, page] = childToken.split('=');
                    const title = label.trim();
                    const pageName = page.trim();

                    if (title && pageName) {
                        children.push({ title, page: pageName, children: [] });
                        flatPages.push(pageName);
                    }
                } else {
                    // Simple format: just page name
                    children.push({ title: childToken, page: childToken, children: [] });
                    flatPages.push(childToken);
                }
            });

            if (children.length > 0) {
                tree.push({ title: parent, page: null, children });
            }
        } else {
            // Simple page (no children)
            if (token.includes('=')) {
                const [label, page] = token.split('=');
                const title = label.trim();
                const pageName = page.trim();

                if (title && pageName) {
                    tree.push({ title, page: pageName, children: [] });
                    flatPages.push(pageName);
                }
            } else {
                tree.push({ title: token, page: token, children: [] });
                flatPages.push(token);
            }
        }
    });

    return {
        pagesArray: [...new Set(flatPages)], // Remove duplicates
        pagesTree: tree
    };
}

/**
 * Full page configuration for Admin role
 */
export const FULL_ADMIN_PAGES = "Dashboard=dashboard,Informasi=informasi,Pengumuman=pengumuman,Jurnal Pembelajaran=jurnal,Riwayat Banding=jurnal-banding,Ujian Madrasah=ujian-madrasah,Pusat Dokumen=dokumen,Agenda=agenda-madrasah,Monitoring=monitoring,Kinerja Guru=kinerja-guru,Tugas Siswa=tugas-siswa,E-Supervisi=e-supervisi,Konfigurasi Data>Master Data=master|Formulir Dinamis=form|Pengaturan Data=pengaturan-data|Pengaturan Tugas=pengaturan-tugas|Pengaturan Users=pengaturan-users,LCKH>Ajukan LCKH=lckh|Jurnal=jurnal|Absensi=absensi|Nilai=nilai|TugasTambahan=tugas-tambahan,Ketidakhadiran=ketidakhadiran,LCKH Approval=lckh-approval,Pembayaran=pembayaran,Akademik>Catatan Keuangan=catatan-keuangan|Laporan Piket=piket|Layanan Guru Asuh=guru-asuh|Layanan Wali Kelas=wali-kelas|Jadwal=jadwal,Aplikasi CBT=cbt-app";

/**
 * Rakit objek User dari baris database + hasil resolusi akses NestJS.
 *
 * Otorisasinya (role efektif termasuk role tugas, halaman, capabilities, tema)
 * dihitung backend NestJS di atas PostgreSQL VPS. Fungsi ini tinggal merakit
 * bentuk tampilan: label halaman & pagesTree untuk sidebar.
 */
export async function buildUserObject(dbUser: any, access?: NestAccess): Promise<User> {
    const identityRoles = parseRoles(dbUser.role || '');
    const isAdmin = identityRoles.some(r => r === 'ADMIN');
    const nip = dbUser.nip || dbUser.guru_id || dbUser.guruId || dbUser.nisn || dbUser.username || '';

    const resolved =
        access ?? (await fetchUserAccessByAuthId(dbUser.auth_id || ''))?.access ?? null;

    const roles = resolved ? resolved.roles : identityRoles;

    // Bila resolusi gagal total, jatuh ke default AMAN — menu penuh untuk admin,
    // dashboard saja untuk selainnya — supaya halaman admin tidak pernah bocor.
    const ids =
        resolved && resolved.pageIds.length > 0
            ? resolved.pageIds
            : isAdmin
                ? parsePages(FULL_ADMIN_PAGES).pagesArray
                : ['dashboard'];

    const runtimePages = toPagesString(ids);
    const { pagesArray, pagesTree } = parsePages(runtimePages);

    // Admin dapat semua kapabilitas tanpa query; `can()` juga meloloskan admin,
    // tapi daftar lengkap dipasang agar UI yang menampilkan caps ikut akurat.
    // `undefined` = belum ter-resolve → `can()` memakai paket bawaan registry,
    // BUKAN berarti "tidak punya izin apa pun".
    let caps: string[] | undefined;
    if (isAdmin) {
        caps = [...CAPABILITY_KEYS];
    } else if (resolved?.caps) {
        // Buang kunci yang sudah dihapus dari registry tapi masih tertinggal di DB.
        caps = resolved.caps.filter(isKnownCapability);
    }

    const themeSetting = resolved
        ? resolved.theme
        : { can_use_dark_mode: true, forced_theme: null as 'light' | 'dark' | null };

    return {
        id: dbUser.id,
        auth_id: dbUser.auth_id || null,
        username: dbUser.username || '',
        nip,
        nisn: dbUser.nisn || '',
        nama: dbUser.nama || 'User',
        nama_lengkap: dbUser.nama_lengkap || dbUser.nama || '',
        tanggal_lahir: dbUser.tanggal_lahir || '',
        email: dbUser.email || '',
        role: dbUser.role || '',
        roles,
        caps,
        divisi: dbUser.divisi || '',
        pages: runtimePages,
        pagesArray,
        pagesTree,
        aktif: dbUser.aktif === true || dbUser.aktif === 'true' || dbUser.aktif === 'ya',
        photoUrl: dbUser.foto_profil || dbUser.photoUrl || null,
        permissions: [], // Now handled by PAGE_ROLE_REQUIREMENTS in code
        can_use_dark_mode: themeSetting.can_use_dark_mode,
        forced_theme: themeSetting.forced_theme
    };
}

async function toUser(payload: NestUserAccess | null): Promise<User | null> {
    if (!payload?.user) return null;
    return buildUserObject(payload.user, payload.access);
}

/**
 * Get user data by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
    return toUser(await fetchUserAccessByUsername(username));
}

/**
 * Get user data by auth_id.
 *
 * Di server memakai shared secret antar-service (bisa me-resolve user mana pun).
 * Di browser secret itu tidak tersedia — dan sejak cookie `acca_session` dibuat
 * httpOnly, tokennya juga tidak bisa dibaca dari sini. Jalur klien karena itu
 * lewat `/api/auth/me`, yang membaca cookie di sisi server; klien toh hanya
 * pernah meminta dirinya sendiri.
 */
export async function getUserByAuthId(authId: string): Promise<User | null> {
    if (!authId) return null;

    if (typeof window === 'undefined') {
        return toUser(await fetchUserAccessByAuthId(authId));
    }

    const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const user: User | null = json?.ok ? json.user : null;

    if (user && (user as any).auth_id && (user as any).auth_id !== authId) {
        console.warn('getUserByAuthId: auth_id sesi tidak cocok dengan yang diminta');
        return null;
    }
    return user;
}

/**
 * Check if user has specific role
 */
export function userHasRole(user: User, role: string): boolean {
    return user.roles.includes(role.toUpperCase());
}

/**
 * Check if user has any of the specified roles
 */
export function userHasAnyRole(user: User, roles: string[]): boolean {
    const userRoles = new Set(user.roles);
    return roles.some(r => userRoles.has(r.toUpperCase()));
}

/**
 * Check if user has access to a specific page
 */
export function userHasPageAccess(user: User, page: string): boolean {
    return user.pagesArray.includes(page);
}

/**
 * Standardize page path/slug to resource name
 */
export function pagePathToResource(path: string): string {
    const slug = path.startsWith('/') ? path.slice(1) : path;
    const resource = slug.split('/')[0] // Get first segment
        .replace(/-/g, '_')
        .toLowerCase();

    // Custom mappings if any
    // 'informasi' = admin page (upload/manage), 'informasi_akademik' = public view page
    if (resource === 'dokumen_siswa') return 'dokumen_siswa';

    return resource;
}
