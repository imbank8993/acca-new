'use client'

import { useEffect, useState } from 'react'

/** Kunci tab, sama dengan `tabs` dari `/api/settings/pengaturan-data/my-access`. */
export type PengaturanDataTab =
    | 'siswa_kelas'
    | 'guru_mapel'
    | 'ekskul_siswa'
    | 'relasi_ortu'
    | 'dropdown'
    | 'ganti_massal'

export interface PengaturanDataAccess {
    /** `true` selama wewenangnya belum diketahui — pemanggil sebaiknya menahan render. */
    memuat: boolean
    /** Role ADMIN / ADMINISTRATOR. Beberapa aksi hanya untuk ini. */
    isAdmin: boolean
    tabs: Partial<Record<PengaturanDataTab, boolean>>
    /** Boleh membuka halaman: memegang minimal satu tab. */
    adaAkses: boolean
    boleh: (tab: PengaturanDataTab) => boolean
}

/**
 * Wewenang halaman Pengaturan Data untuk pemakai yang sedang login.
 *
 * Pasangan dari `useMasterAccess`, dengan alasan yang sama: hanya ADMIN yang
 * melekat di kode, sisanya ditunjuk per tab di Pengaturan Users → Hak Akses Fitur,
 * jadi wewenangnya tidak bisa disimpulkan dari objek user dan harus ditanyakan ke
 * server.
 *
 * Gagal ke arah tertutup: kalau permintaannya gagal, tidak ada tab yang dianggap
 * dipegang. Server tetap yang menentukan, jadi salah-ketat hanya menyembunyikan
 * tampilan, bukan membuka data.
 */
export function usePengaturanDataAccess(): PengaturanDataAccess {
    const [state, setState] = useState<{
        isAdmin: boolean
        tabs: Partial<Record<PengaturanDataTab, boolean>>
    }>({ isAdmin: false, tabs: {} })
    const [memuat, setMemuat] = useState(true)

    useEffect(() => {
        let dibatalkan = false
        fetch('/api/settings/pengaturan-data/my-access', { cache: 'no-store' })
            .then((res) => res.json())
            .then((json) => {
                if (dibatalkan) return
                if (json?.ok) setState({ isAdmin: !!json.isAdmin, tabs: json.tabs || {} })
            })
            .catch(() => { /* biarkan kosong: tidak ada tab yang dipegang */ })
            .finally(() => { if (!dibatalkan) setMemuat(false) })
        return () => { dibatalkan = true }
    }, [])

    return {
        memuat,
        isAdmin: state.isAdmin,
        tabs: state.tabs,
        adaAkses: Object.values(state.tabs).some(Boolean),
        boleh: (tab: PengaturanDataTab) => state.tabs[tab] === true,
    }
}
