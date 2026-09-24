import 'server-only'
import { nestFetch } from '@/lib/nest-api'
import type { ApiUser } from '@/lib/api-auth'

/**
 * Evaluasi "Hak Akses Fitur" di sisi server, untuk route Next yang mengerjakan
 * logikanya sendiri (bukan sekadar proxy ke NestJS).
 *
 * Cerminan `aksesDiizinkan` di `apps/api/src/auth/feature-access.guard.ts`.
 * Aturannya harus sama persis: ADMIN selalu lolos dan tidak bisa dicabut lewat
 * konfigurasi; selebihnya ditunjuk per role (`allowedRoles`) atau per orang
 * (`allowedUsers`) dari layar Pengaturan Users → Hak Akses Fitur.
 *
 * Konfigurasinya dibaca lewat `nestFetch` (kunci internal antar-service), jadi
 * tidak bergantung pada daftar kunci yang boleh dibaca klien.
 */

export interface KonfigurasiAkses {
    allowedRoles: string[]
    allowedUsers: Array<{ id?: string | number; nip?: string }>
}

/** Bawaannya ADMIN saja — baris yang belum ada atau JSON rusak tidak membuka apa pun. */
export function parseKonfigurasiAkses(nilai: unknown): KonfigurasiAkses {
    let raw: unknown = nilai
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw) } catch { raw = null }
    }
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<KonfigurasiAkses>
    return {
        allowedRoles: Array.isArray(obj.allowedRoles) ? obj.allowedRoles.map(String) : ['ADMIN', 'ADMINISTRATOR'],
        allowedUsers: Array.isArray(obj.allowedUsers) ? obj.allowedUsers : [],
    }
}

/**
 * Apakah `user` berwenang atas fitur bertanda `settingKey`?
 *
 * Gagal ke arah TERTUTUP: bila konfigurasinya tidak terbaca (backend tak
 * terjangkau, baris belum ada), hanya ADMIN yang lolos.
 */
export async function bolehAksesFitur(
    user: Pick<ApiUser, 'roles' | 'nip'> & { id?: string | number; isAdmin?: boolean },
    settingKey: string,
): Promise<boolean> {
    const roles = (user?.roles || []).map((r) => String(r).trim().toUpperCase())
    if (roles.includes('ADMIN') || roles.includes('ADMINISTRATOR')) return true

    let nilai: unknown = null
    try {
        const { status, body } = await nestFetch(`/site-settings?key=${encodeURIComponent(settingKey)}`)
        if (status === 200) nilai = body?.data?.value ?? null
    } catch {
        return false
    }

    const konfig = parseKonfigurasiAkses(nilai)
    if (konfig.allowedRoles.some((r) => roles.includes(String(r).trim().toUpperCase()))) return true

    const idUser = String(user?.id ?? '')
    const nipUser = String(user?.nip ?? '')
    return konfig.allowedUsers.some((u) => {
        const id = String(u?.id ?? '')
        const nip = String(u?.nip ?? '')
        return (!!idUser && id === idUser) || (!!nipUser && nip === nipUser)
    })
}

/** Kunci "Hak Akses Fitur" untuk tab-tab halaman Pengaturan Data. */
export const PENGATURAN_DATA_ACCESS_KEYS = {
    siswa_kelas: 'pengaturan_data_siswa_kelas_access_config',
    guru_mapel: 'pengaturan_data_guru_mapel_access_config',
    ekskul_siswa: 'pengaturan_data_ekskul_siswa_access_config',
    relasi_ortu: 'pengaturan_data_relasi_ortu_access_config',
    dropdown: 'pengaturan_data_dropdown_access_config',
    ganti_massal: 'pengaturan_data_ganti_massal_access_config',
} as const
