/**
 * Mode tema per role.
 *
 * Penyimpanan & resolusinya sudah pindah ke backend NestJS di atas PostgreSQL
 * VPS (`backend/src/access/`); di sini tinggal tipenya untuk dipakai UI admin.
 */
export type ThemeMode = 'ALL' | 'LIGHT' | 'DARK'
export type RoleThemeMap = Record<string, ThemeMode>

export const ALWAYS_ALLOWED_THEME_ROLES = ['ADMIN', 'ADMINISTRATOR']
