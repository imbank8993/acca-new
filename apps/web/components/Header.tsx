'use client'

import { useState, useEffect, useRef } from 'react'
import type { User } from '@/lib/types'
import { useModalBlur } from './ModalBlurProvider'
import { useDarkMode } from '@/hooks/use-dark-mode'
import { getProxiedImageUrl } from '@/lib/image-utils'
import { Sun, Moon, Menu, User as UserIcon, Shield, LogOut, ArrowLeft } from 'lucide-react'
import NotificationBell from './NotificationBell'
import './header.css'

interface HeaderProps {
    user: User
    onMenuToggle: () => void
    onNavigate: (page: string) => void
    isCollapsed: boolean
    /** Melipat/membentangkan sidebar (opsional). */
    onCollapse?: () => void
    /** Handler kembali ke halaman sebelumnya (opsional, fallback ke history.back). */
    onBack?: () => void
    /** Judul halaman aktif — dipakai HANYA di mobile, menggantikan nama aplikasi. */
    pageTitle?: string
    pageSubtitle?: string
    onScrollHiddenChange?: (hidden: boolean) => void
}

// Detect if any modal is open via ModalBlurContext
function useDetectModalOpen() {
    const { isAnyModalOpen } = useModalBlur()
    return isAnyModalOpen
}

export default function Header({ user, onMenuToggle, onNavigate, isCollapsed, onCollapse, onBack, pageTitle, pageSubtitle, onScrollHiddenChange }: HeaderProps) {
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [customSubtitle, setCustomSubtitle] = useState<string | null>(null)

    useEffect(() => {
        setCustomSubtitle(null)
    }, [pageTitle])

    useEffect(() => {
        const handleSubtitle = (e: any) => {
            setCustomSubtitle(e.detail || null)
        }
        window.addEventListener('acca:set-page-subtitle' as any, handleSubtitle)
        return () => {
            window.removeEventListener('acca:set-page-subtitle' as any, handleSubtitle)
        }
    }, [])

    const { isDark, canUseDarkMode, forcedTheme, toggleDarkMode } = useDarkMode(user)
    const userMenuRef = useRef<HTMLDivElement>(null)
    const isAnyModalOpen = useDetectModalOpen()

    // Header hide-on-scroll & scrolled background container
    const [scrollHidden, setScrollHidden] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)

    const updateScrollHidden = (hidden: boolean) => {
        setScrollHidden(hidden)
        onScrollHiddenChange?.(hidden)
    }

    useEffect(() => {
        let lastY = 0
        let ticking = false

        const getScrollPos = (target?: any): number => {
            if (target && target.scrollTop !== undefined && target !== document && target !== window) {
                return target.scrollTop
            }
            const scroller = document.querySelector('.main-content')
            if (scroller && scroller.scrollTop > 0) return scroller.scrollTop
            return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
        }

        const onScroll = (e: Event) => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentY = getScrollPos(e.target)
                    // Aktifkan container kaca saat posisi halaman bergeser dari atas
                    setIsScrolled(currentY > 10)
                    ticking = false
                })
                ticking = true
            }
        }

        // Global capture listener catches scroll on any element in the DOM
        window.addEventListener('scroll', onScroll, { capture: true, passive: true })
        document.addEventListener('scroll', onScroll, { capture: true, passive: true })

        return () => {
            window.removeEventListener('scroll', onScroll, { capture: true })
            document.removeEventListener('scroll', onScroll, { capture: true })
        }
    }, [])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false)
            }
        }
        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showUserMenu])

    const handleLogout = async () => {
        const { clearUserCache } = await import('@/lib/auth-client')
        clearUserCache()
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
        } catch { }

        // Arahkan ke login lokal saat di localhost, atau ke acca.icgowa.sch.id jika di produksi
        const isLocal =
            process.env.NODE_ENV === 'development' ||
            (typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.endsWith('.local') ||
                window.location.hostname.startsWith('192.168.')
            ))

        const targetUrl = isLocal
            ? '/login'
            : (process.env.NEXT_PUBLIC_LOGIN_URL || 'https://acca.icgowa.sch.id/login')

        window.location.href = targetUrl
    }

    const handleBack = () => {
        if (onBack) {
            onBack()
            return
        }
        if (typeof window !== 'undefined') {
            if (window.history.length > 1) {
                window.history.back()
            } else {
                onNavigate('dashboard')
            }
        }
    }

    return (
        <header className={`header ${isCollapsed ? 'collapsed' : ''} ${isScrolled ? 'is-scrolled' : ''} ${isAnyModalOpen ? 'blur-when-modal-open' : ''} ${scrollHidden ? 'scroll-hidden' : ''}`}>
            <div className="header-inner content-container">
                <div className="header-left">
                    <button className="menu-toggle" onClick={onMenuToggle}>
                        <Menu size={19} />
                    </button>
                    {/* Tombol kembali ke halaman sebelumnya */}
                    <button
                        type="button"
                        className="header-back-btn header-collapse-toggle"
                        onClick={handleBack}
                        title="Kembali ke halaman sebelumnya"
                        aria-label="Kembali ke halaman sebelumnya"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    {/* Dua judul dirender bersama dan dipilih lewat CSS, bukan
                        JS: `useIsMobile` akan menyebabkan judul salah tampil satu
                        frame di tiap muat halaman karena server tidak tahu lebar
                        layar. Bebannya cuma satu node teks. */}
                    <div className="header-title-wrapper">
                        <h1 className="header-title" title={pageTitle === 'Dashboard' ? 'Selamat Datang 👋' : (pageTitle || "Academic Center & Administration")}>
                            {pageTitle === 'Dashboard' ? 'Selamat Datang 👋' : (pageTitle || "Academic Center & Administration")}
                        </h1>
                        {/* Subjudul HANYA dirender kalau memang ada isinya —
                            label tab aktif (lewat event `acca:set-page-subtitle`
                            dari components/Tab.tsx) atau subjudul khusus halaman.

                            Dulu di sini ada fallback "MAN Insan Cendekia Gowa"
                            yang tampil di SETIAP halaman tanpa tab, jadi baris
                            kedua header nyaris selalu terisi nama sekolah yang
                            sama — mengulang informasi yang sudah ada di sidebar
                            dan tidak menerangkan halaman yang sedang dibuka.

                            Blok mobile di bawah sudah lebih dulu memakai pola
                            ini; sekarang keduanya sepaham. */}
                        {(() => {
                            const subjudul = pageTitle === 'Dashboard'
                                ? user.nama
                                : (pageSubtitle || customSubtitle)
                            if (!subjudul) return null
                            return (
                                <span
                                    className={`header-subtitle ${pageTitle === 'Dashboard' ? 'header-subtitle--name' : ''}`}
                                    title={subjudul}
                                >
                                    {subjudul}
                                </span>
                            )
                        })()}
                    </div>
                    {/* Mobile: judul halaman + tombol menu sidebar */}
                    <div className="header-pageTitle-wrap">
                        <button
                            type="button"
                            className="header-mobile-menu-btn"
                            onClick={onMenuToggle}
                            aria-label="Buka Menu Sidebar"
                            title="Buka Menu"
                        >
                            <Menu size={18} />
                        </button>
                        {pageTitle === 'Dashboard' ? (
                            <div className="header-greeting-container">
                                <div className="header-greeting-title">
                                    <h1 className="header-pageTitle header-pageTitle--stacked" title="Selamat Datang 👋">
                                        Selamat Datang 👋
                                    </h1>
                                </div>
                                <span className="header-greeting-name header-pageSubtitle header-pageSubtitle--name" title={user.nama}>
                                    {user.nama}
                                </span>
                            </div>
                        ) : (pageSubtitle || customSubtitle) ? (
                            <div className="header-greeting-container">
                                <div className="header-greeting-title">
                                    <h1 className="header-pageTitle header-pageTitle--stacked" title={pageTitle}>{pageTitle}</h1>
                                </div>
                                <span className="header-greeting-name header-pageSubtitle" title={pageSubtitle || customSubtitle || ''}>
                                    {pageSubtitle || customSubtitle}
                                </span>
                            </div>
                        ) : (
                            <h1 className="header-pageTitle" title={pageTitle}>{pageTitle}</h1>
                        )}
                    </div>
                </div>

                <div className="header-right">
                    <NotificationBell user={user} />

                    {canUseDarkMode && !forcedTheme && (
                        <button
                            type="button"
                            onClick={toggleDarkMode}
                            className="dark-mode-toggle"
                            title={isDark ? "Mode Terang" : "Mode Gelap"}
                            aria-label="Toggle Theme"
                        >
                            {isDark ? <Sun size={17} /> : <Moon size={17} />}
                        </button>
                    )}

                    <div className="user-menu-wrapper" ref={userMenuRef}>
                        <button className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                            <div className="user-avatar-small">
                                {user.photoUrl ? (
                                    <img src={getProxiedImageUrl(user.photoUrl)} alt={user.nama} />
                                ) : (
                                    <UserIcon size={16} />
                                )}
                            </div>
                            <div className="user-info-header">
                                <span className="user-name-header">{user.nama}</span>
                                <span className="user-role-header">{user.nip || 'N/A'} • {user.roles[0] || 'User'}</span>
                            </div>
                        </button>

                        {showUserMenu && (
                            <div className="user-menu-dropdown">
                                <div className="user-menu-info">
                                    <div className="user-menu-name">{user.nama}</div>
                                    <div className="user_menu_nip" style={{ fontSize: '0.75rem', color: 'var(--n-muted, rgba(255,255,255,0.7))', margin: '2px 0 0 0' }}>NIP/NISN: {user.nip || 'N/A'}</div>
                                </div>
                                {canUseDarkMode && !forcedTheme && (
                                    <button
                                        type="button"
                                        className="user-menu-item user-menu-theme-btn"
                                        onClick={() => {
                                            toggleDarkMode();
                                            setShowUserMenu(false);
                                        }}
                                    >
                                        {isDark ? (
                                            <Sun size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                        ) : (
                                            <Moon size={16} style={{ color: '#3083FF', flexShrink: 0 }} />
                                        )}
                                        <span>{isDark ? "Mode Terang" : "Mode Gelap"}</span>
                                    </button>
                                )}
                                <button className="user-menu-item" onClick={() => { onNavigate('ProfileSaya'); setShowUserMenu(false); }}>
                                    <Shield size={16} style={{ flexShrink: 0 }} />
                                    <span>Profil & Keamanan</span>
                                </button>
                                <div style={{ borderTop: '1px solid var(--header-border)', margin: '4px 0' }}></div>
                                <button className="user-menu-item" onClick={handleLogout} style={{ color: '#ef4444' }}>
                                    <LogOut size={16} style={{ flexShrink: 0 }} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
