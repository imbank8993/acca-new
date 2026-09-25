'use client'

import { useEffect, useState } from 'react'

/**
 * Ambang mobile untuk SELURUH app — satu angka, tidak boleh ada yang kedua.
 *
 * Nilainya harus sama persis dengan `@media` di components/bottom-nav.css,
 * header.css, sidebar.css, mobile/mobile-ui.css, dan app/(dashboard)/layout.tsx.
 * Begitu salah satunya berbeda, rentang di antara keduanya jadi keadaan campur:
 * pernah terjadi ambang ini 767px sementara cangkang 991.98px, sehingga di
 * 768–991,98px bilah nav bawah muncul di atas tabel desktop. Kebalikannya juga
 * pernah terjadi pada header (lihat catatan di components/header.css) —
 * header mobile di atas sidebar desktop.
 *
 * Dipilih 1023.98px: tablet portrait (~768–1024px) diperlakukan sebagai mobile.
 * Di 768px dengan sidebar fixed 258px, konten hanya mendapat ~510px — terlalu
 * sempit untuk tabel 5 kolom dan FilterToolbar satu baris. Tablet landscape
 * (≥1024px) tetap memakai layout desktop dengan sidebar.
 */
export const MOBILE_QUERY = '(max-width: 1023.98px)'

/**
 * Cocokkan media query di klien.
 *
 * Nilai awal SELALU `false`, termasuk pada render pertama di browser: server
 * tidak tahu lebar layar, jadi menebak di render pertama akan memicu hydration
 * mismatch. Konsekuensinya varian desktop sempat tampil satu frame di HP —
 * dipilih karena arah sebaliknya (menebak mobile) membuat halaman desktop
 * berkedip ke tata letak mobile, yang jauh lebih terlihat.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])

  return matches
}

/**
 * `true` bila layar di bawah 768px — yakni saat bilah nav bawah tampil.
 *
 * Dipakai untuk memilih SALAH SATU cabang render — bukan menyembunyikan salah
 * satunya dengan CSS. Pola lama (tabel + kartu dua-duanya masuk DOM lalu
 * `display:none`) menggandakan jumlah node: 900 siswa jadi ~1800 baris.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}
