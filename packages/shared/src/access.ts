export interface NestAccess {
    roles: string[];
    pageIds: string[];
    flatGroupKeys: string[];
    /** `null` = tabel role_capabilities tak terbaca → pemanggil pakai paket bawaan registry. */
    caps: string[] | null;
    theme: { can_use_dark_mode: boolean; forced_theme: 'light' | 'dark' | null };
}

export interface NestUserAccess {
    user: Record<string, any>;
    access: NestAccess;
}
