'use client'

import { useEffect } from 'react'

/**
 * Auto-reload untuk PWA iOS yang macet di build lama.
 *
 * KENAPA PERLU: "Add to Home Screen" di iOS menjalankan proses WKWebView
 * standalone yang TIDAK refetch HTML/JS baru setiap dibuka — beda dari tab
 * Safari biasa yang selalu request ulang ke server. Tanpa ini, PWA bisa
 * bertahun-tahun menampilkan build lama meski server sudah deploy versi baru,
 * dan tidak ada cara manual bagi pengguna awam untuk menyadarinya.
 *
 * CURRENT_BUILD_ID dibekukan di bundle klien saat build (lihat `env` di
 * next.config.ts). /api/version SELALU mencerminkan build yang sedang live
 * di server (no-store, lihat header '/api/:path*'). Begitu keduanya beda,
 * berarti bundle yang berjalan sudah basi → reload paksa.
 */
const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || ''

export function AppUpdateChecker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !CURRENT_BUILD_ID) return

    let cancelled = false

    const checkForUpdate = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { buildId } = await res.json()
        if (!cancelled && buildId && buildId !== CURRENT_BUILD_ID) {
          window.location.reload()
        }
      } catch {
        // Jaringan tidak terjangkau — jangan ganggu pengguna, coba lagi nanti.
      }
    }

    checkForUpdate()

    // PWA standalone dibangunkan lagi lewat visibilitychange/focus saat
    // pengguna kembali dari background — bukan lewat navigasi baru.
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', checkForUpdate)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [])

  return null
}
