'use client'

/**
 * lib/use-sidebar-badges.ts
 * Menyediakan angka badge sidebar ke layout dashboard.
 *
 * Realtime dipakai sebagai PEMICU, bukan sebagai sumber angka: begitu ada perubahan
 * pada tabel antrean, hook ini memanggil ulang /api/sidebar-badges. Dengan begitu
 * aturan "siapa boleh menindak apa" tetap tinggal di server dan klien tidak perlu
 * diberi akses baca ke tabel antreannya.
 *
 * Realtime tidak selalu bisa diandalkan di sini:
 * - tabelnya harus terdaftar di publikasi `supabase_realtime` (lihat migrasi
 *   20260828_realtime_sidebar_badges.sql — dijalankan manual lewat Dashboard), dan
 * - langganan `postgres_changes` tunduk pada RLS milik klien, sedangkan beberapa
 *   tabel antrean di aplikasi ini RLS-nya terkunci rapat.
 * Karena itu tetap ada penyegaran berkala dan saat tab kembali aktif; keduanya murah
 * (satu query count per antrean) dan membuat badge tetap benar walau realtime bisu.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Jaring pengaman bila realtime tak aktif untuk sebuah tabel. */
const FALLBACK_POLL_MS = 60_000

/** Perubahan beruntun (mis. approve massal) cukup memicu satu perhitungan ulang. */
const DEBOUNCE_MS = 800

export interface SidebarBadgeState {
    counts: Record<string, number>
    refresh: () => void
}

export function useSidebarBadges(enabled: boolean): SidebarBadgeState {
    const [counts, setCounts] = useState<Record<string, number>>({})
    const [tables, setTables] = useState<string[]>([])
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inFlightRef = useRef(false)

    const refresh = useCallback(async () => {
        if (!enabled || inFlightRef.current) return
        inFlightRef.current = true
        try {
            const res = await fetch('/api/sidebar-badges', { cache: 'no-store' })
            if (!res.ok) return
            const json = await res.json()
            if (!json.ok) return
            setCounts(json.counts || {})
            // Daftar tabel ikut peran user, jadi ambil dari server sekalian.
            setTables(prev => {
                const next: string[] = json.tables || []
                return prev.length === next.length && prev.every((t, i) => t === next[i]) ? prev : next
            })
        } catch {
            // Jaringan putus sesaat — biarkan angka lama, jangan kosongkan badge.
        } finally {
            inFlightRef.current = false
        }
    }, [enabled])

    const scheduleRefresh = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { refresh() }, DEBOUNCE_MS)
    }, [refresh])

    // Muat awal + penyegaran berkala + saat tab kembali aktif.
    useEffect(() => {
        if (!enabled) {
            setCounts({})
            return
        }
        refresh()
        const timer = setInterval(refresh, FALLBACK_POLL_MS)
        const onFocus = () => { if (document.visibilityState === 'visible') refresh() }
        document.addEventListener('visibilitychange', onFocus)
        window.addEventListener('focus', onFocus)
        return () => {
            clearInterval(timer)
            document.removeEventListener('visibilitychange', onFocus)
            window.removeEventListener('focus', onFocus)
        }
    }, [enabled, refresh])

    return { counts, refresh }
}
