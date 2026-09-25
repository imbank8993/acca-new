'use client'

/**
 * Shell dashboard persisten (App Router layout).
 * Sidebar + Header + auth hidup di sini dan TIDAK remount saat pindah halaman.
 * Halaman dirender sebagai route asli di dalam group ini:
 *   /dashboard            → app/(dashboard)/dashboard/page.tsx (beranda)
 *   /<pageId>             → app/(dashboard)/[...pageId]/page.tsx (registry)
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { resolvePageLabel } from '@/lib/sidebar-menu'
import type { User, PageNode } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { useSidebarBadges } from '@/hooks/use-sidebar-badges'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import UserHeartbeat from '@/components/UserHeartbeat'
import { applyThemeColor } from '@/lib/theme-color'
import { Spinner } from '@/components/ui/Spinner'
import { DashboardUserContext } from '@/components/UserContext'
import '../dokumen/dokumen.css'
import '../jadwal/jadwal.css'

export default function DashboardShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Warna chrome browser (bilah status atas & bilah alamat bawah) ikut
  // lapisan yang sedang memenuhi layar. Saat sidebar mobile terbuka itu panel
  // sidebar; saat tertutup, bilah nav bawah / header.
  //
  // Dipicu DARI SINI, bukan dari MutationObserver di ModalBlurProvider:
  // observer itu mengamati class di <html>, sedangkan penanda sidebar
  // ('sidebar-mobile-open') dipasang di <div class="dashboard-layout">.
  // Jadi membuka sidebar tidak pernah menghasilkan mutasi yang diamatinya, dan
  // warna chrome tertinggal sampai halaman dimuat ulang.
  //
  // Komponen inilah satu-satunya yang memegang state sidebarOpen, jadi di sini
  // pula tempat yang benar untuk memicunya — tanpa perlu membuat
  // topOverlayColor() menyapu lebih dalam ke dalam pohon DOM.
  const scrollPosRef = useRef(0)
  useEffect(() => {
    applyThemeColor()
    if (sidebarOpen) {
      scrollPosRef.current = window.scrollY || window.pageYOffset || 0
    } else if (scrollPosRef.current > 0) {
      window.scrollTo(0, scrollPosRef.current)
    }
  }, [sidebarOpen])
  const [headerHidden, setHeaderHidden] = useState(false)
  const [appMode, setAppMode] = useState<'home' | 'cbt'>('home')
  const { isAnyModalOpen } = useModalBlur()

  // Badge antrean sidebar. Diambil di layout (bukan di dalam Sidebar) karena layout
  // ini tidak remount saat pindah halaman, jadi langganan realtime-nya tetap hidup.
  const { counts: badgeCounts } = useSidebarBadges(!!user)

  // Id halaman aktif untuk highlight sidebar, diturunkan dari URL
  const currentPage = decodeURIComponent(pathname.replace(/^\//, '')) || 'dashboard'

  // Judul halaman untuk header mobile (menggantikan nama aplikasi yang konstan).
  // Label kustom "Susun Menu" dibaca dari cache localStorage yang ditulis Sidebar,
  // bukan lewat fetch kedua ke /api/menu-layout — Sidebar sudah menyegarkannya
  // tiap mount, dan bila cache belum ada PAGE_LABELS sudah benar untuk semua
  // halaman bawaan.
  const [menuLabels, setMenuLabels] = useState<Record<string, string>>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem('acca_menu_labels')
      if (raw) setMenuLabels(JSON.parse(raw) || {})
    } catch { /* cache rusak/diblokir — jatuh ke PAGE_LABELS */ }
  }, [])

  const treeTitles = useMemo(() => {
    const map: Record<string, string> = {}
    const walk = (nodes?: PageNode[]) => nodes?.forEach(n => {
      if (n.page && n.title) map[n.page] = n.title
      if (n.children) walk(n.children)
    })
    walk(user?.pagesTree || [])
    return map
  }, [user?.pagesTree])

  const pageTitle = useMemo(
    () => resolvePageLabel(currentPage, { menuLabels, treeTitles }),
    [currentPage, menuLabels, treeTitles]
  )

  // Sync appMode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('app_mode') as 'home' | 'cbt' | null
    if (saved === 'home' || saved === 'cbt') setAppMode(saved)
  }, [])

  const resolvePath = useCallback((page: string) => {
    return '/' + page.split('/').map(encodeURIComponent).join('/')
  }, [])

  const handleNavigate = useCallback((page: string) => {
    setSidebarOpen(false)
    scrollPosRef.current = 0
    router.push(resolvePath(page))
  }, [router, resolvePath])

  const prefetchedPagesRef = useRef<Set<string>>(new Set())

  const handlePrefetch = useCallback((page: string) => {
    if (typeof window !== 'undefined' && (navigator as any).connection?.saveData) {
      return
    }
    const path = resolvePath(page)
    if (prefetchedPagesRef.current.has(path)) {
      return
    }
    prefetchedPagesRef.current.add(path)
    router.prefetch(path)
  }, [router, resolvePath])

  const checkAuth = useCallback(async () => {
    try {
      // Langsung cek via /api/auth/me — membaca cookie acca_session di server.
      // JANGAN gunakan supabase.auth.getSession() karena customStorage.setItem adalah no-op,
      // sehingga getSession() selalu mengembalikan null setelah login.
      const userData = await getCurrentUser()

      if (!userData) {
        console.warn('[dashboard-layout] No user session found, redirecting to login...')
        router.push('/login')
        return
      }

      setUser(userData)

      // Log login activity if not already logged in this session (simple check)
      const lastLog = sessionStorage.getItem('last_login_log')
      const now = new Date().getTime()

      if (!lastLog || now - parseInt(lastLog) > 30 * 60 * 1000) {
        fetch('/api/user/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'LOGIN',
            details: `User logged in or refreshed dashboard. Role: ${userData?.role}`
          })
        }).catch(err => console.error('Failed to log login:', err))
        sessionStorage.setItem('last_login_log', now.toString())
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    checkAuth()

    const handleRefresh = () => checkAuth()
    window.addEventListener('refresh-user', handleRefresh)

    const handleCustomNavigate = (e: any) => {
      if (e.detail) handleNavigate(e.detail)
    }
    window.addEventListener('navigate-to-page' as any, handleCustomNavigate)

    return () => {
      window.removeEventListener('refresh-user', handleRefresh)
      window.removeEventListener('navigate-to-page' as any, handleCustomNavigate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Log page views setiap kali route berganti
  useEffect(() => {
    if (!user) return

    const logPageView = async () => {
      try {
        await fetch('/api/user/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'VIEW_PAGE',
            details: `User viewed module: ${currentPage}`
          })
        })
      } catch (err) {
        console.error('Failed to log page view:', err)
      }
    }

    const timeoutId = setTimeout(logPageView, 1000)
    return () => clearTimeout(timeoutId)
  }, [currentPage, user])

  if (loading) {
    return (
      /* Gaya di sini WAJIB inline, bukan <style jsx>.
         styled-jsx menyuntikkan <style>-nya setelah render pertama, sedangkan
         layar ini justru yang tampil di frame paling awal. Di jendela itu
         `.loading-screen` sempat tanpa gaya sama sekali — terukur tinggi 21px
         dengan background rgba(0,0,0,0) — sehingga min-height, flex-centering,
         dan latar gelapnya belum berlaku: spinner menempel di atas layar
         dengan latar terang. Inline style berlaku seketika di render pertama. */
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
            color: '#eaf2ff',
          }}
        >
          <Spinner variant="trace" />
        </div>
      </div>
    )
  }

  const userContextValue = useMemo(() => ({
    user: user!,
    refreshUser: async () => { window.dispatchEvent(new Event('refresh-user')) }
  }), [user])

  if (!user) return null

  return (
    <DashboardUserContext.Provider value={userContextValue}>
      <UserHeartbeat />
      <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-mobile-open' : ''}`}>
        <Sidebar
          user={user}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onPrefetch={handlePrefetch}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isCollapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          appMode={appMode}
          onAppModeChange={setAppMode}
          badges={badgeCounts}
        />

        <div className="dashboard-content-wrapper">
          <Header
            user={user}
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            onNavigate={handleNavigate}
            isCollapsed={sidebarCollapsed}
            onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            pageTitle={pageTitle}
            onScrollHiddenChange={setHeaderHidden}
          />

          <div className={`main-content ${sidebarCollapsed ? 'collapsed' : ''} ${isAnyModalOpen ? 'modal-blur' : ''} ${headerHidden ? 'header-hidden' : ''}`}>
            <main className="content-area">
              <div className="content-container">
                {(!user.email || user.email.endsWith('@acca.local')) && (
                  <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ffeeba' }}>
                    <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.2rem' }}></i>
                    <div>
                      <strong>Perhatian:</strong> Anda belum mengatur alamat Email. Segera atur email Anda di pengaturan profil agar fitur pemulihan password dapat berfungsi.
                    </div>
                  </div>
                )}
                <MaintenanceBanner pageKey="maintenance_dashboard">
                  {children}
                </MaintenanceBanner>
              </div>
            </main>
          </div>

          <BottomNav
            user={user}
            currentPage={currentPage}
            pageTitle={pageTitle}
            onNavigate={handleNavigate}
            onOpenMenu={() => setSidebarOpen(true)}
            badges={badgeCounts}
          />

          {sidebarOpen && (
            <div
              className="sidebar-mobile-backdrop"
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup Menu"
            />
          )}
        </div>
      </div>

      <style jsx>{`
        /* =========================================
           DESKTOP (>= 992px): Fixed App Shell
           ========================================= */
        @media (min-width: 768px) {
          .dashboard-content-wrapper {
            display: contents;
          }

          .sidebar-mobile-backdrop {
            display: none;
          }

          .dashboard-layout {
            width: 100%;
            height: 100dvh;
            overflow: hidden;
            background: #EBECF1 !important;
            background-color: #EBECF1 !important;
            position: fixed;
            inset: 0;
          }

          :global(.dark) .dashboard-layout {
            background: 
              radial-gradient(ellipse 120% 90% at 50% 15%, rgba(29, 78, 216, 0.45) 0%, rgba(17, 44, 122, 0.35) 45%, rgba(5, 14, 45, 0.75) 80%, #020718 100%),
              radial-gradient(ellipse 120% 90% at 50% 85%, rgba(29, 78, 216, 0.38) 0%, rgba(17, 44, 122, 0.3) 45%, rgba(5, 14, 45, 0.75) 80%, #020718 100%),
              radial-gradient(circle at 50% 50%, rgba(30, 64, 175, 0.3) 0%, rgba(10, 25, 75, 0.5) 50%, transparent 85%),
              #020718 fixed !important;
          }

          :global(.dark) .main-content {
            background: transparent !important;
            box-shadow: none !important;
          }

          .main-content {
            background: transparent;
            position: fixed;
            top: calc(var(--app-header-h) + env(safe-area-inset-top));
            left: calc(var(--app-sidebar-w) + env(safe-area-inset-left));
            right: env(safe-area-inset-right);
            bottom: env(safe-area-inset-bottom);
            overflow-y: auto;
            overflow-x: hidden;
            transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease, -webkit-filter 0.3s ease;
            border-radius: 0;
            box-shadow: none;
            -webkit-overflow-scrolling: touch;
          }

          /* Dashboard tidak merender <Header> — konten mulai sejajar dengan
             puncak sidebar, tanpa ruang kosong bekas tinggi Header. */
          .main-content.no-header {
            top: env(safe-area-inset-top);
          }

          .main-content.modal-blur {
            filter: blur(2px) brightness(0.8);
            -webkit-filter: blur(2px) brightness(0.8);
            transition: filter 0.3s ease;
          }

          .main-content.collapsed {
            left: calc(var(--app-sidebar-w-collapsed) + env(safe-area-inset-left));
          }

          .content-area {
            padding-top: 16px;
            padding-bottom: 32px;
            min-height: 100%;
          }

          .content-container {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            padding: 0 16px;
          }
        }

        /* =========================================
           MOBILE (< 992px): Natural Document Scroll (Edge-to-Edge)
           ========================================= */
        @media (max-width: 767.98px) {
          .dashboard-layout,
          :global(.dashboard-layout) {
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
            height: auto !important;
            overflow: visible !important;
            overflow-x: clip !important;
            background: transparent !important;
            z-index: 1 !important;
          }

          :global(.dark) :global(.dashboard-layout),
          :global(.dark) .dashboard-layout {
            background: transparent !important;
          }

          .dashboard-content-wrapper {
            position: relative;
            width: 100%;
            min-height: 100vh;
            min-height: 100dvh;
            background: var(--n-bg, #EBECF1);
            transform: none !important;
            border-radius: 0;
            overflow: visible;
            z-index: 100;
            transition: transform .35s cubic-bezier(0.32, 0.72, 0, 1),
                        border-radius .35s cubic-bezier(0.32, 0.72, 0, 1),
                        box-shadow .35s cubic-bezier(0.32, 0.72, 0, 1);
          }

          :global(.dark) .dashboard-content-wrapper {
            background: #020718;
          }

          /* Push effect: seluruh halaman (Header + Konten + BottomNav) bergeser ke kanan
             seperti drawer pada aplikasi X (Twitter), menampilkan sudut lengkung presisi (border-radius 28px)
             di sisi kiri yang menyentuh langsung bilah status (top: 0), dibingkai kanvas sidebar serta bayangan lembut. */
          .dashboard-layout.sidebar-mobile-open {
            position: fixed !important;
            inset: 0 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            height: 100dvh !important;
            overflow: hidden !important;
            background: #ffffff !important;
            touch-action: none;
            z-index: 1000 !important;
          }

          :global(.dark) .dashboard-layout.sidebar-mobile-open {
            background: #000000 !important;
          }

          .dashboard-layout.sidebar-mobile-open .dashboard-content-wrapper {
            position: absolute !important;
            inset: 0 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: 100% !important;
            height: 100dvh !important;
            transform: translate3d(var(--app-sidebar-mobile-w, min(calc(100vw - 64px), 320px)), 0, 0) !important;
            border-top-left-radius: 28px !important;
            border-bottom-left-radius: 28px !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
            border-right: none !important;
            box-shadow: -10px 0 28px rgba(0, 0, 0, 0.16), -1px 0 0 rgba(0, 0, 0, 0.06) !important;
            overflow: hidden !important;
            pointer-events: none;
            -webkit-mask-image: -webkit-radial-gradient(white, black);
            mask-image: radial-gradient(white, black);
          }

          :global(.dark) .dashboard-layout.sidebar-mobile-open .dashboard-content-wrapper {
            background: #000000 !important;
            border: 1px solid rgba(255, 255, 255, 0.16) !important;
            border-right: none !important;
            box-shadow: -12px 0 32px rgba(0, 0, 0, 0.8), -1px 0 0 rgba(255, 255, 255, 0.12) !important;
          }

          /* Area klik untuk menutup sidebar saat halaman tergeser sekaligus memberi efek pudar lembut (soft dim) */
          .sidebar-mobile-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.18);
            z-index: 1200;
            cursor: pointer;
            pointer-events: auto !important;
            border-top-left-radius: 28px;
            border-bottom-left-radius: 28px;
            opacity: 0;
            animation: fadeInBackdrop 0.25s forwards;
            -webkit-tap-highlight-color: transparent;
            touch-action: none;
          }

          :global(.dark) .sidebar-mobile-backdrop {
            background: rgba(0, 0, 0, 0.35);
          }

          @keyframes fadeInBackdrop {
            to {
              opacity: 1;
            }
          }

          .main-content,
          .main-content.collapsed {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            border-radius: 0 !important;
            -webkit-clip-path: none !important;
            clip-path: none !important;
            background: transparent !important;
            box-shadow: none !important;
            transform: none !important;
          }

          .main-content.header-hidden {
            -webkit-clip-path: none !important;
            clip-path: none !important;
          }

          /* Jarak atas/bawah = persis setinggi header & bottom nav, tanpa
             tambahan. Keduanya position:fixed dan tembus pandang, jadi konten
             memang dimaksudkan lewat DI BELAKANGNYA saat di-scroll; sisa
             padding hanya memastikan baris pertama/terakhir tetap terjangkau
             saat halaman diam. */
          .content-area {
            /* Plus 12px, JANGAN negatif: header mobile kini kontainer putih
               solid, jadi apa pun yang mulai di atas tepi bawahnya akan
               tertutup — bukan sekadar lewat di belakang seperti dulu saat
               header transparan. 12px menyisakan 6px setelah dikurangi
               margin-top -6px pada sapaan di DashboardContent.
               (Tanpa backtick: blok ini template literal styled-jsx.) */
            padding-top: calc(var(--app-header-h, 56px) + env(safe-area-inset-top) + 12px) !important;
            /* Cuma 12px: bilah nav kini position:sticky sehingga memesan
               ruangnya sendiri di ujung dokumen — baris terakhir pasti berhenti
               di atasnya. Menyisakan tinggi nav di sini menumpuk ruang kosong
               dua kali. Sinkron dengan .content-area di app/globals.css. */
            padding-bottom: 12px !important;
            padding-left: calc(8px + env(safe-area-inset-left)) !important;
            padding-right: calc(8px + env(safe-area-inset-right)) !important;
            min-height: calc(100vh - var(--app-bottomnav-h, 62px) - env(safe-area-inset-bottom)) !important;
            min-height: calc(100dvh - var(--app-bottomnav-h, 62px) - env(safe-area-inset-bottom)) !important;
            box-sizing: border-box !important;
          }

          /* Dashboard tidak merender <Header> mobile — jangan sisakan ruang
             untuk tingginya, konten mulai persis dari tepi atas (aman).
             Padding kiri/kanan sengaja tetap dinolkan di sini: gutter dashboard
             diatur oleh .db di DashboardContent (0 12px), disamakan dengan
             gutter 12px halaman ber-header. Kalau shell ikut memberi padding,
             keduanya bertumpuk jadi 22px. */
          .main-content.no-header .content-area {
            padding-top: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .main-content.no-header .content-container {
            padding: 0 !important;
          }

          .content-container {
            padding: 0;
            max-width: 100%;
          }
        }
      `}</style>
    </DashboardUserContext.Provider>
  )
}
