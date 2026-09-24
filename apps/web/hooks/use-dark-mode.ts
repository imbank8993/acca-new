'use client'

import { useEffect, useState } from 'react'
import type { User } from '@/lib/types'
import { applyThemeColor } from '@/lib/theme-color'

/**
 * Satu-satunya sumber logic mode gelap/terang, dipakai bersama oleh
 * `components/Header.tsx` (semua halaman selain dashboard) dan kartu
 * identitas profil di `app/(dashboard)/dashboard/DashboardContent.tsx`
 * (yang menggantikan Header di halaman dashboard). Diekstrak dari Header
 * supaya kedua tempat tetap satu perilaku — dulu logic ini hanya ada di
 * Header, jadi halaman tanpa Header tidak akan pernah menjalankan efek
 * sinkronisasi kelas `.dark` di <html>.
 */
export function useDarkMode(user: User | null | undefined) {
    const [isDark, setIsDark] = useState(false)

    const forcedTheme = user?.forced_theme
    const canUseDarkMode = user?.can_use_dark_mode ?? (
        user?.roles?.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) || false
    )

    useEffect(() => {
        if (forcedTheme === 'dark') {
            if (!document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.add('dark')
            }
            localStorage.setItem('darkMode', '1')
            setIsDark(true)
        } else if (forcedTheme === 'light' || (!canUseDarkMode && !forcedTheme)) {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark')
            }
            localStorage.setItem('darkMode', '0')
            setIsDark(false)
        } else {
            setIsDark(document.documentElement.classList.contains('dark'))
        }
        applyThemeColor()
    }, [forcedTheme, canUseDarkMode])

    const toggleDarkMode = () => {
        if (!canUseDarkMode || forcedTheme) return
        const nextDark = !document.documentElement.classList.contains('dark')
        if (nextDark) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('darkMode', '1')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('darkMode', '0')
        }
        applyThemeColor()
        setIsDark(nextDark)
    }

    return { isDark, canUseDarkMode, forcedTheme, toggleDarkMode }
}
