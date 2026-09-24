'use client'

import { useEffect, useState } from 'react'

/** Entity tiap tab, sama dengan kunci `tabs` dari `/api/master/my-access`. */
export type MasterTab =
    | 'tahun-ajaran'
    | 'siswa'
    | 'guru'
    | 'kode-guru'
    | 'mapel'
    | 'mapel-kelas'
    | 'kelas'
    | 'waktu'
    | 'jp-mapel'
    | 'ekskul'

export interface MasterAccess {
    /** `true` selama wewenangnya belum diketahui — pemanggil sebaiknya menahan render. */
    memuat: boolean
    /** Role ADMIN / ADMINISTRATOR. Aksi paling merusak hanya untuk ini. */
    isAdmin: boolean
    /** Wewenang per tab. Tab yang tidak ada di peta dianggap tidak dipegang. */
    tabs: Partial<Record<MasterTab, boolean>>
    /** Boleh membuka halaman Master Data: memegang minimal satu tab. */
    adaAkses: boolean
    /** Pintasan: wewenang atas satu tab tertentu. */
    boleh: (tab: MasterTab) => boolean
}

/**
 * Wewenang Master Data untuk pemakai yang sedang login.
 *
 * Hanya ADMIN yang melekat di kode; pengelola tiap tab ditunjuk di Pengaturan
 * Users → Hak Akses Fitur. Karena itu wewenangnya tidak bisa disimpulkan dari
 * objek user — harus ditanyakan ke server, dan `/master/my-access` menjawab
 * seluruh tab dalam satu permintaan.
 *
 * Kalau gagal dibaca, hasilnya kosong: tidak ada tab yang dianggap dipegang.
 * Lebih baik terlalu ketat daripada terlalu longgar — server tetap yang
 * menentukan, jadi salah-ketat hanya menyembunyikan tombol, bukan membuka data.
 */
export function useMasterAccess(): MasterAccess {
    const [state, setState] = useState<{ isAdmin: boolean; tabs: Partial<Record<MasterTab, boolean>> }>({
        isAdmin: false,
        tabs: {},
    })
    const [memuat, setMemuat] = useState(true)

    useEffect(() => {
        let dibatalkan = false
        fetch('/api/master/my-access', { cache: 'no-store' })
            .then((res) => res.json())
            .then((json) => {
                if (dibatalkan) return
                if (json?.ok) {
                    setState({ isAdmin: !!json.isAdmin, tabs: json.tabs || {} })
                }
            })
            .catch(() => { /* biarkan kosong: tidak ada tab yang dipegang */ })
            .finally(() => { if (!dibatalkan) setMemuat(false) })
        return () => { dibatalkan = true }
    }, [])

    const boleh = (tab: MasterTab) => state.tabs[tab] === true
    return {
        memuat,
        isAdmin: state.isAdmin,
        tabs: state.tabs,
        adaAkses: Object.values(state.tabs).some(Boolean),
        boleh,
    }
}
