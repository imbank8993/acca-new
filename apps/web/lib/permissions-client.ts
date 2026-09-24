/**
 * Permission helpers untuk komponen klien.
 *
 * Tabel PAGE_ROLE_REQUIREMENTS TIDAK lagi didefinisikan di sini — dulu file ini
 * menyimpan salinan kedua yang isinya menyimpang dari lib/page-requirements.ts
 * (mis. OP_KELAS hanya ada di sini, `ekstrakurikuler` hanya ada di sana).
 * Sekarang semuanya di-re-export dari sumber tunggal itu.
 *
 * Untuk izin per-FUNGSI (bukan per-halaman) pakai `can()` di lib/capabilities.ts.
 */
import {
    PAGE_ROLE_REQUIREMENTS,
    getRequirement,
    canAccessPage,
    getActionLevel,
    type PageRequirement,
} from './page-requirements';

export { PAGE_ROLE_REQUIREMENTS, canAccessPage, getRequirement };
export type { PageRequirement };

export interface Permission {
    role_name: string;
    resource: string;
    action: string;
}

export function matchResource(required: string, possessed: string): boolean {
    if (possessed === '*') return true;
    if (possessed === required) return true;
    if (required.startsWith(possessed + ':')) return true;
    if (required.startsWith(possessed + '.')) return true;
    return false;
}

export function matchAction(required: string, possessed: string): boolean {
    if (possessed === '*') return true;
    if (possessed === 'manage') return true;
    if (possessed === required) return true;
    const p = possessed.toLowerCase();
    const r = required.toLowerCase();
    if (p === 'view' && r === 'read') return true;
    if (p === 'read' && r === 'view') return true;
    if ((p === 'view' || p === 'manage') && r.startsWith('tab:')) return true;
    return false;
}

/**
 * Level aksi user pada sebuah halaman.
 * `null` = halaman terdaftar tapi user tak punya role yang diizinkan.
 * `'edit'` = halaman tidak terdaftar (default permisif warisan lama).
 */
export function getPageActionForRole(userRoles: string[], pageId: string): string | null {
    if (!getRequirement(pageId)) return 'edit';
    return getActionLevel(userRoles, pageId);
}

const ACTION_HIERARCHY: Record<string, number> = { 'view': 1, 'edit': 2, 'manage': 3 };

/**
 * Client-side permission check.
 *
 * @param userPermissions - Array permission legacy (bukan sumber utama lagi)
 * @param resource - Halaman/resource yang dicek (mendukung notasi `:` dan `.`)
 * @param action - view, edit, create, update, delete, manage, atau `tab:<key>`
 * @param isAdmin - Admin melewati semua pemeriksaan
 * @param userRoles - Role user, dipakai untuk lookup PAGE_ROLE_REQUIREMENTS
 */
export function hasPermission(
    userPermissions: any[],
    resource: string,
    action: string,
    isAdmin: boolean = false,
    userRoles: string[] = []
): boolean {
    if (isAdmin) return true;

    if (resource && typeof resource === 'string' && resource !== '*') {
        // Normalisasi action (create/update/delete → edit, import/export → manage)
        let normalizedAction = action.toLowerCase();
        if (['create', 'update', 'delete'].includes(normalizedAction)) normalizedAction = 'edit';
        else if (['import', 'export'].includes(normalizedAction)) normalizedAction = 'manage';

        // Pemeriksaan tab: (mis. tab:siswa_kelas)
        if (normalizedAction.startsWith('tab:')) {
            const tabKey = normalizedAction.slice(4);
            const req = getRequirement(`${resource}:${tabKey}`) || getRequirement(resource);
            if (!req) return true; // Tak terdaftar → izinkan (kompatibilitas mundur)

            const allowed = req.allowedRoles.map(r => r.toUpperCase());
            return userRoles.length === 0 || userRoles.some(r => allowed.includes(r.toUpperCase()));
        }

        // Akses halaman dasar
        if (!canAccessPage(userRoles, resource)) return false;

        // Level aksi
        const roleAction = getPageActionForRole(userRoles, resource);
        if (roleAction) {
            const allowedLevel = ACTION_HIERARCHY[roleAction] || 0;
            const requiredLevel = ACTION_HIERARCHY[normalizedAction] || 0;
            if (requiredLevel > allowedLevel) return false;
        }
    }

    // Fallback ke permission legacy bila ada
    if (!userPermissions || userPermissions.length === 0) return true;

    return userPermissions.some(p =>
        matchResource(resource, p.resource) && matchAction(action, p.action) && p.is_allowed
    );
}
