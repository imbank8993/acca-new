export interface KonfigurasiAksesClient {
    allowedRoles?: string[];
    allowedUsers?: Array<{ id?: string | number; nip?: string }>;
}

export function parseKonfigurasiAksesClient(nilai: unknown): KonfigurasiAksesClient {
    let raw: unknown = nilai;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<KonfigurasiAksesClient>;
    return {
        allowedRoles: Array.isArray(obj.allowedRoles) ? obj.allowedRoles.map(String) : undefined,
        allowedUsers: Array.isArray(obj.allowedUsers) ? obj.allowedUsers : [],
    };
}

export function checkFeatureAccess(
    user: any,
    config: KonfigurasiAksesClient | null | undefined,
    defaultRoles: string[] = []
): boolean {
    if (!user) return false;
    const roles: string[] = Array.isArray(user.roles)
        ? user.roles.map((r: string) => String(r).toUpperCase().trim())
        : String(user.role || '').split(/[,|]/).map((r: string) => r.toUpperCase().trim()).filter(Boolean);

    // ADMIN always allowed
    if (roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || !!user.isAdmin) return true;

    const allowedRoles = (config && Array.isArray(config.allowedRoles) && config.allowedRoles.length > 0)
        ? config.allowedRoles.map((r: string) => String(r).toUpperCase().trim())
        : defaultRoles.map((r: string) => String(r).toUpperCase().trim());

    if (allowedRoles.some(r => roles.includes(r))) return true;

    if (config && Array.isArray(config.allowedUsers) && config.allowedUsers.length > 0) {
        const userId = String(user.id || user.user_id || '');
        const userNip = String(user.nip || user.username || '');
        return config.allowedUsers.some((u: any) => {
            const uid = String(u.id || '');
            const unip = String(u.nip || '');
            return (userId && uid === userId) || (userNip && unip === userNip);
        });
    }

    return false;
}
