'use client'

/**
 * BottomNav — navigasi utama mobile, menempel di dasar layar.
 *
 * 5 Slot dengan Tombol Tengah Menonjol (Prominent Center FAB):
 * 1. Kembali (Back)
 * 2. Beranda (Dashboard)
 * 3. MENU (Tengah Menonjol): Icon Logo ACCA yang membuka menu sidebar.
 *    Dulu slot ini berubah jadi pemilih tab halaman; sudah dilepas — tab kini
 *    hanya hidup di baris tab di bawah header (components/Tab.tsx).
 * 4. Ke Atas: menggulirkan halaman kembali ke puncak.
 * 5. Pintasan:
 *    - Selalu ada di semua halaman untuk membuka Bottom Sheet Menu Pintasan (Pinned Pages).
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import type { User, PageNode } from '@/lib/types'
import { OPEN_NOTIFICATIONS_EVENT, NOTIF_COUNT_EVENT } from '@/lib/app-events'
import { Undo2, Home, ArrowUp, X, CheckCircle2, Megaphone, Pin, UserCircle2, BellOff } from 'lucide-react'
import LucideIcon from './ui/LucideIcon'
import { getPageFab, subscribePageFab, type PageFab } from './mobile/page-fab'
import './bottom-nav.css'

interface Announcement {
    id: string | number
    title: string
    content: string
    category: string
    pinned: boolean
    created_by: string
    created_at: string
    target_roles?: string[];
}

const READ_ANN_KEY = 'read-announcements'
function loadReadAnnMap(): Record<string, number> {
    if (typeof window === 'undefined') return {}
    try {
        const raw = localStorage.getItem(READ_ANN_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        const now = Date.now()
        let map: Record<string, number> = {}
        if (Array.isArray(parsed)) parsed.forEach((id: string) => { map[String(id)] = now })
        else if (parsed && typeof parsed === 'object') map = parsed
        return map
    } catch { return {} }
}

function saveReadAnnMap(map: Record<string, number>) {
    try { localStorage.setItem(READ_ANN_KEY, JSON.stringify(map)) } catch {}
}

const PAGE_ICONS: Record<string, string> = {
    'dashboard': 'house-door-fill',
    'jurnal': 'journal-text',
    'jurnal-banding': 'arrow-left-right',
    'rekap-jurnal': 'bar-chart-fill',
    'absensi': 'clipboard-check-fill',
    'nilai': 'graph-up',
    'piket': 'calendar-week-fill',
    'jadwal': 'calendar-week-fill',
    'agenda-madrasah': 'calendar3',
    'izin-guru': 'calendar-x',
    'lckh': 'file-earmark-check-fill',
    'lckh-approval': 'clipboard2-check-fill',
    'sanggar-kurikulum': 'book-fill',
    'ketidakhadiran': 'person-x-fill',
    'rekam-medis': 'clipboard2-pulse-fill',
    'guru-asuh': 'person-heart',
    'wali-kelas': 'mortarboard-fill',
    'ekstrakurikuler': 'trophy-fill',
    'klinik': 'plus-square-fill',
    'dokumen': 'folder-fill',
    'prestasi': 'award-fill',
    'bimbingan-konseling': 'chat-heart-fill',
    'permintaan-surat': 'envelope-paper-fill',
    'surat': 'file-earmark-word-fill',
    'surat-daftar': 'card-checklist',
    'layanan-ptsp': 'file-text-fill',
    'nilai-siswa': 'graph-up-arrow',
    'tugas-siswa': 'card-checklist',
    'kokurikuler': 'compass-fill',
    'kinerja-guru': 'speedometer2',
    'monitoring': 'eye-fill',
    'e-supervisi': 'clipboard-data-fill',
    'observasi-kelas': 'search',
    'master': 'database-fill',
    'form': 'ui-radios-grid',
    'pengaturan-data': 'sliders',
    'tugas-tambahan': 'star-fill',
    'pengaturan-umum': 'gear-fill',
    'pengaturan-tugas': 'person-gear',
    'pengaturan-users': 'people-fill',
    'informasi': 'info-circle-fill',
    'pengumuman': 'megaphone-fill',
    'guru': 'user-round-pen',
    'kode-guru': 'user-cog',
    'kode_guru': 'user-cog',
    'kelas': 'school',
    'ekskul': 'volleyball',
    'tahun-ajaran': 'calendar',
    'tahun_ajaran': 'calendar',
    'waktu': 'clock',
    'mapel': 'book-open',
}

const PAGE_LABELS: Record<string, string> = {
    'dashboard': 'Beranda',
    'jurnal': 'Jurnal Guru',
    'jurnal-banding': 'Banding Jurnal',
    'rekap-jurnal': 'Rekap Jurnal',
    'absensi': 'Absensi Siswa',
    'nilai': 'Nilai',
    'piket': 'Laporan Piket',
    'jadwal': 'Jadwal Mengajar',
    'agenda-madrasah': 'Agenda Madrasah',
    'izin-guru': 'Izin Guru',
    'lckh': 'LCKH Guru',
    'lckh-approval': 'LCKH Approval',
    'sanggar-kurikulum': 'Sanggar Kurikulum',
    'ketidakhadiran': 'Ketidakhadiran',
    'rekam-medis': 'Rekam Medis',
    'guru-asuh': 'Guru Asuh',
    'wali-kelas': 'Wali Kelas',
    'ekstrakurikuler': 'Ekstrakurikuler',
    'klinik': 'Klinik Pembelajaran',
    'dokumen': 'Pusat Dokumen',
    'prestasi': 'Prestasi Siswa',
    'bimbingan-konseling': 'Bimbingan Konseling',
    'permintaan-surat': 'Permintaan Surat',
    'surat': 'Generate Surat',
    'surat-daftar': 'Daftar Surat',
    'layanan-ptsp': 'Layanan PTSP',
    'nilai-siswa': 'Nilai Siswa',
    'tugas-siswa': 'Tugas Siswa',
    'kokurikuler': 'Kokurikuler',
    'kinerja-guru': 'Kinerja Guru',
    'monitoring': 'Monitoring',
    'e-supervisi': 'E-Supervisi',
    'observasi-kelas': 'Observasi Kelas',
    'master': 'Master Data',
    'form': 'Formulir',
    'pengaturan-data': 'Pengaturan Data',
    'tugas-tambahan': 'Tugas Tambahan',
    'pengaturan-umum': 'Pengaturan Umum',
    'pengaturan-tugas': 'Pengaturan Tugas',
    'pengaturan-users': 'Pengaturan Users',
    'informasi': 'Informasi',
    'pengumuman': 'Pengumuman',
}

function collectPageIds(pagesTree?: PageNode[]): Set<string> {
    const ids = new Set<string>()
    const walk = (nodes?: PageNode[]) => nodes?.forEach(n => {
        if (n.page) ids.add(n.page)
        if (n.children) walk(n.children)
    })
    walk(pagesTree)
    return ids
}

export default function BottomNav({
    user,
    currentPage,
    pageTitle,
    onNavigate,
    onOpenMenu,
    badges = {},
}: {
    user: User
    currentPage: string
    pageTitle?: string
    onNavigate: (page: string) => void
    onOpenMenu: () => void
    /** Antrean tindakan per halaman, dari lib/sidebar-badges.ts. */
    badges?: Record<string, number>
}) {
    const [unread, setUnread] = useState(0)
    const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false)
    const [isPinnedOpen, setIsPinnedOpen] = useState(false)
    const [pinned, setPinned] = useState<string[]>([])
    const [customMenuLabels, setCustomMenuLabels] = useState<Record<string, string>>({})
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
    const [readAnnMap, setReadAnnMap] = useState<Record<string, number>>({})
    const [expandedAnn, setExpandedAnn] = useState<Record<string, boolean>>({})
    // Aksi utama halaman (dulu FAB mengambang) — mengisi tombol tengah.
    const [pageFab, setPageFab] = useState<PageFab | null>(null)

    useEffect(() => {
        setReadAnnMap(loadReadAnnMap())
    }, [])

    // Muat daftar pinned pages dari localStorage & DB
    useEffect(() => {
        const userKey = user?.auth_id || (user as any)?.authId || (user?.id ? String(user.id) : '') || user?.username || 'default'
        let localPins: string[] = []
        try {
            const keysToTry = [
                `acca_pinned_pages_${userKey}`,
                user?.auth_id ? `acca_pinned_pages_${user.auth_id}` : '',
                user?.id ? `acca_pinned_pages_${user.id}` : '',
                (user as any)?.authId ? `acca_pinned_pages_${(user as any).authId}` : '',
                'acca_pinned_pages_undefined',
            ].filter(Boolean) as string[]

            for (const k of keysToTry) {
                const p = localStorage.getItem(k)
                if (p) {
                    const arr = JSON.parse(p)
                    if (Array.isArray(arr) && arr.length > 0) {
                        localPins = arr
                        setPinned(arr)
                        break
                    }
                }
            }
            const lbls = localStorage.getItem('acca_menu_labels')
            if (lbls) {
                const obj = JSON.parse(lbls)
                if (obj && typeof obj === 'object') setCustomMenuLabels(obj)
            }
        } catch {}

        fetch('/api/user/pinned-pages')
            .then(r => r.json())
            .then(d => {
                if (d?.ok && Array.isArray(d.data)) {
                    if (d.data.length > 0) {
                        setPinned(d.data)
                        try {
                            localStorage.setItem(`acca_pinned_pages_${userKey}`, JSON.stringify(d.data))
                            if (user?.auth_id) localStorage.setItem(`acca_pinned_pages_${user.auth_id}`, JSON.stringify(d.data))
                        } catch {}
                    } else if (localPins.length > 0) {
                        // Jika di server masih kosong tapi di localStorage ada, sinkronkan ke server
                        fetch('/api/user/pinned-pages', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pinned: localPins }),
                        }).catch(() => {})
                    }
                }
            })
            .catch(() => {})
    }, [user?.auth_id, user?.id])

    // Sinkronisasi realtime saat pin diubah di sidebar
    useEffect(() => {
        const userKey = user?.auth_id || (user as any)?.authId || (user?.id ? String(user.id) : '') || user?.username || 'default'
        const handlePinChange = () => {
            try {
                const keysToTry = [
                    `acca_pinned_pages_${userKey}`,
                    user?.auth_id ? `acca_pinned_pages_${user.auth_id}` : '',
                    user?.id ? `acca_pinned_pages_${user.id}` : '',
                    (user as any)?.authId ? `acca_pinned_pages_${(user as any).authId}` : '',
                    'acca_pinned_pages_undefined',
                ].filter(Boolean) as string[]

                for (const k of keysToTry) {
                    const p = localStorage.getItem(k)
                    if (p) {
                        const arr = JSON.parse(p)
                        if (Array.isArray(arr)) {
                            setPinned(arr)
                            break
                        }
                    }
                }
                const lbls = localStorage.getItem('acca_menu_labels')
                if (lbls) {
                    const obj = JSON.parse(lbls)
                    if (obj && typeof obj === 'object') setCustomMenuLabels(obj)
                }
            } catch {}
        }
        window.addEventListener('acca:pinned-change', handlePinChange)
        window.addEventListener('storage', handlePinChange)
        return () => {
            window.removeEventListener('acca:pinned-change', handlePinChange)
            window.removeEventListener('storage', handlePinChange)
        }
    }, [user?.auth_id, user?.id])

    const fetchAnnouncements = async () => {
        try {
            setLoadingAnnouncements(true)
            const roleQuery = (user?.roles || []).join(',')
            const res = await fetch(`/api/pengumuman?role=${roleQuery}`)
            if (res.ok) {
                const json = await res.json()
                setAnnouncements(json.data || [])
            }
        } catch (e) {
            console.error('Failed to load announcements', e)
        } finally {
            setLoadingAnnouncements(false)
        }
    }

    const isDashboard = !currentPage || ['dashboard', 'beranda'].includes(currentPage.toLowerCase().trim())
    const isAdmin = user?.roles?.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) || false

    useEffect(() => {
        if (isDashboard) {
            fetchAnnouncements()
        }
    }, [isDashboard, user?.roles])

    const unreadAnnCount = announcements.filter(a => !readAnnMap[String(a.id)]).length

    const handleOpenAnnouncements = () => {
        setIsAnnouncementsOpen(true)
        if (!announcements.length) {
            fetchAnnouncements()
        }
        // Mark as read
        const map = { ...readAnnMap }
        const now = Date.now()
        announcements.forEach(a => { map[String(a.id)] = now })
        setReadAnnMap(map)
        saveReadAnnMap(map)
    }

    const toggleAnn = (id: string | number) => {
        setExpandedAnn(prev => ({ ...prev, [String(id)]: !prev[String(id)] }))
    }

    useEffect(() => {
        const onCount = (e: Event) => setUnread((e as CustomEvent<number>).detail ?? 0)
        window.addEventListener(NOTIF_COUNT_EVENT, onCount as EventListener)

        // Aksi utama halaman, didaftarkan oleh <MobileFab> (components/mobile).
        //
        // getPageFab() dipanggil DULU, baru berlangganan: halaman bisa saja
        // sudah mendaftar sebelum bilah ini mount (halaman yang tidak di-lazy,
        // atau role user sudah ada di cache sehingga tombolnya dirender di
        // render pertama). Dengan model event lama, pendaftaran seperti itu
        // lewat begitu saja dan tombol tengah diam-diam jatuh ke "Menu".
        setPageFab(getPageFab())
        const unsubscribeFab = subscribePageFab(fab => setPageFab(fab))

        return () => {
            window.removeEventListener(NOTIF_COUNT_EVENT, onCount as EventListener)
            unsubscribeFab()
        }
    }, [])

    // Dulu di sini ada efek yang mengangkat bilah nav sebesar selisih layout
    // viewport vs visualViewport, penambal `position: fixed` di Safari iOS.
    // Sudah dihapus: bilahnya kini `position: sticky` (components/bottom-nav.css),
    // yang dijaga browser sendiri terhadap scrollport — tanpa JS dan tanpa jeda
    // menyusulnya event visualViewport yang membuat bilah terpotong saat digulir.


    // Reset sheet saat pindah halaman.
    useEffect(() => {
        setIsPinnedOpen(false)
    }, [currentPage])

    /* Gulir ke puncak. Di mobile yang menggulir adalah dokumen — `.main-content`
       dipaksa `overflow: visible` di bawah 992px (lihat app/(dashboard)/layout.tsx),
       syarat agar `position: sticky` bilah ini bekerja. Tapi beberapa halaman
       memasang scroller sendiri, jadi selain window kita juga menurunkan
       scrollTop setiap leluhur yang memang sedang tergulir. */
    const scrollToTop = useCallback(() => {
        if (typeof window === 'undefined') return

        const posOf = (t: Window | HTMLElement) => (t === window ? window.scrollY : (t as HTMLElement).scrollTop)

        const targets: Array<Window | HTMLElement> = [window]
        document.querySelectorAll<HTMLElement>('.main-content, .content-area').forEach(el => {
            if (el.scrollTop > 0) targets.push(el)
        })

        const awal = targets.map(posOf)
        targets.forEach(t => t.scrollTo({ top: 0, behavior: 'smooth' }))

        /* Jaring pengaman. `behavior: 'smooth'` bukan janji: sebagian webview
           menerima panggilan ini lalu tidak menganimasikan apa pun — tombolnya
           terlihat rusak, padahal handlernya jalan.

           Yang dicek "sudah bergerak atau belum", BUKAN "sudah sampai atau
           belum": pada 400ms animasi yang sehat memang biasanya belum selesai,
           dan memaksa lompat di situ justru memotongnya. */
        window.setTimeout(() => {
            targets.forEach((t, i) => {
                if (posOf(t) > 0 && posOf(t) === awal[i]) t.scrollTo({ top: 0, behavior: 'auto' })
            })
        }, 400)
    }, [])

    const allowed = useMemo(() => {
        const set = new Set<string>(user?.pagesArray || [])
        collectPageIds(user?.pagesTree).forEach(p => set.add(p))
        set.add('dashboard')
        return set
    }, [user?.pagesArray, user?.pagesTree])

    const labelOf = useCallback((id: string) => {
        if (customMenuLabels[id]) return customMenuLabels[id]
        if (PAGE_LABELS[id]) return PAGE_LABELS[id]
        if (user?.pagesTree) {
            const findNodeTitle = (nodes?: PageNode[]): string | null => {
                if (!nodes) return null
                for (const n of nodes) {
                    if (n.page === id && n.title) return n.title
                    if (n.children) {
                        const found = findNodeTitle(n.children)
                        if (found) return found
                    }
                }
                return null
            }
            const found = findNodeTitle(user.pagesTree)
            if (found) return found
        }
        return id.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    }, [customMenuLabels, user?.pagesTree])

    const pinnedItems = useMemo(() => {
        return pinned
            .filter(id => Boolean(id) && typeof id === 'string')
            .map(id => ({
                id,
                label: labelOf(id),
                icon: PAGE_ICONS[id] || 'file-earmark-text-fill',
                active: id === currentPage,
            }))
    }, [pinned, labelOf, currentPage])


    const currentPageLabel = PAGE_LABELS[currentPage] || currentPage

    return (
        <>
            {/* Bilah Navigasi Bawah */}
            <nav className="bnav" aria-label="Navigasi Utama">
                {/* 1. Kembali */}
                <button
                    type="button"
                    className="bnav__item"
                    onClick={() => {
                        if (typeof window !== 'undefined') {
                            if (window.history.length > 1) {
                                window.history.back()
                            } else {
                                onNavigate('dashboard')
                            }
                        }
                    }}
                    title="Kembali ke halaman sebelumnya"
                    aria-label="Kembali"
                >
                    <span className="bnav__iconWrap">
                        <Undo2 size={22} strokeWidth={1.5} className="bnav__icon" aria-hidden="true" />
                    </span>
                    <span className="bnav__label">Kembali</span>
                </button>

                {/* 2. Beranda */}
                <button
                    type="button"
                    className={`bnav__item ${currentPage === 'dashboard' ? 'isActive' : ''}`}
                    onClick={() => onNavigate('dashboard')}
                    title="Beranda"
                    aria-label="Beranda"
                >
                    <span className="bnav__iconWrap">
                        <Home size={22} strokeWidth={1.5} className="bnav__icon" aria-hidden="true" />
                    </span>
                    <span className="bnav__label">Beranda</span>
                </button>

                {/* 3. TOMBOL TENGAH MENONJOL — aksi utama halaman.
                    Logo ACCA yang dulu di sini sudah dilepas: sebagai tombol ia
                    hanya mengulang hamburger di header, sementara slot paling
                    mudah dijangkau di layar ini lebih berguna untuk aksi yang
                    memang sering ditekan (Tambah ...).

                    Isinya didaftarkan halaman lewat registri
                    components/mobile/page-fab.ts (bukan CustomEvent sesaat —
                    lihat catatan di file itu): <MobileFab> secara eksplisit,
                    atau <DesktopFab> secara otomatis.

                    Halaman TANPA aksi utama menampilkan lambang bottomnav.svg
                    dan TIDAK bisa ditekan. Slot ini memang tidak boleh kosong —
                    lubang di tengah bilah terbaca sebagai bilah yang rusak —
                    tapi tombol yang isinya cuma mengulang hamburger di header
                    juga bukan jawabannya: ia menghabiskan titik paling mudah
                    dijangkau di layar untuk aksi yang sudah ada di tempat lain,
                    dan membuat user menebak-nebak apa yang akan terjadi. */}
                <div className="bnav__center-wrapper">
                    {pageFab ? (
                        <button
                            type="button"
                            className="bnav__fab"
                            onClick={() => pageFab.run()}
                            aria-label={pageFab.label}
                            title={pageFab.label}
                        >
                            {/* Lucide, BUKAN glif font Bootstrap Icons.
                                Glif `bi-*` adalah bentuk pejal yang tinggi kotak
                                barisnya ikut menentukan posisi — di dalam lingkaran
                                46px ia terbaca terlalu berat dan tidak pernah benar
                                -benar sepusat (paling kentara pada `send-fill` di
                                Laporan Piket, yang miring dan melimpah ke kanan
                                atas). LucideIcon menggambar SVG berukuran pasti
                                yang optis seimbang, sama seperti empat tombol nav
                                lain di bilah ini.

                                Nama ikon di halaman TIDAK perlu diubah: LucideIcon
                                menerjemahkan nama Bootstrap lewat ICON_MAP-nya. */}
                            <LucideIcon
                                name={pageFab.icon}
                                size={24}
                                strokeWidth={2}
                                className="bnav__fab-icon"
                                aria-hidden="true"
                            />
                        </button>
                    ) : (
                        /* <div>, bukan <button>: tidak ada aksi di sini, jadi ia
                           tidak boleh bisa difokus keyboard atau dibacakan screen
                           reader sebagai sesuatu yang bisa ditekan. */
                        <div className="bnav__fab bnav__fab--static" aria-hidden="true">
                            <img src="/bottomnav.svg" alt="" className="bnav__fab-logo" />
                        </div>
                    )}
                </div>

                {/* 4. Ke Atas — gulirkan halaman kembali ke puncak.
                    Dulu slot ini menuju halaman Jadwal (atau Ketidakhadiran untuk
                    OP_UKS/OP_IZIN), dan sesekali dipinjam sebagai tombol aksi
                    halaman. Keduanya dilepas: aksi halaman sudah punya rumah di
                    tombol tengah (registri page-fab), sedangkan Jadwal cuma satu
                    dari puluhan halaman — tidak sepadan dengan salah satu dari
                    empat slot tetap. */}
                <button
                    type="button"
                    className="bnav__item"
                    onClick={scrollToTop}
                    title="Kembali ke atas halaman"
                    aria-label="Kembali ke atas halaman"
                >
                    <span className="bnav__iconWrap">
                        <ArrowUp size={22} strokeWidth={1.5} className="bnav__icon" aria-hidden="true" />
                    </span>
                    <span className="bnav__label">Ke Atas</span>
                </button>

                {/* 5. Pintasan (Halaman Disematkan / Pinned Pages) - Selalu ada di semua halaman */}
                <button
                    type="button"
                    className={`bnav__item ${isPinnedOpen ? 'isActive' : ''}`}
                    onClick={() => setIsPinnedOpen(!isPinnedOpen)}
                    title="Pintasan Menu"
                    aria-label="Pintasan Menu"
                >
                    <span className="bnav__iconWrap">
                        <Pin size={22} strokeWidth={1.5} className="bnav__icon" aria-hidden="true" />
                        {pinnedItems.length > 0 && (
                            <span className="bnav__badge" style={{ background: '#3b82f6' }}>
                                {pinnedItems.length > 9 ? '9+' : pinnedItems.length}
                            </span>
                        )}
                    </span>
                    <span className="bnav__label">Pintasan</span>
                </button>
            </nav>

            {/* Bottom Sheet Drawer: Pintasan Menu (Pinned Pages) */}
            {isPinnedOpen && (
                <div className="bnav__sheet-backdrop" onClick={() => setIsPinnedOpen(false)}>
                    <div className="bnav__sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="bnav__sheet-handle" />
                        <div className="bnav__sheet-header">
                            <div className="bnav__sheet-title-wrap">
                                <h3 className="bnav__sheet-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Pin size={18} style={{ color: '#3083FF' }} />
                                    <span>Pintasan Menu</span>
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="bnav__sheet-close"
                                onClick={() => setIsPinnedOpen(false)}
                                aria-label="Tutup"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="bnav__sheet-body" style={{ overflowY: 'auto', padding: '14px 16px 24px' }}>
                            {pinnedItems.length === 0 ? (
                                <div className="text-center py-6" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E0ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                        <Pin size={24} />
                                    </div>
                                    <div style={{ maxWidth: 260 }}>
                                        <div style={{ fontWeight: 700, color: '#112E59', fontSize: '0.95rem', marginBottom: 4 }}>Belum Ada Pintasan</div>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                                            Buka menu sidebar dan tekan ikon pin (<Pin size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#f59e0b' }} />) pada menu favorit Anda untuk menambahkannya di sini.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        style={{ marginTop: 6, padding: '8px 18px', background: '#3083FF', color: '#fff', border: 'none', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                                        onClick={() => {
                                            setIsPinnedOpen(false);
                                            onOpenMenu();
                                        }}
                                    >
                                        Buka Semua Menu
                                    </button>
                                </div>
                            ) : (
                                <div className="bnav__sheet-grid">
                                    {pinnedItems.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`bnav__sheet-tab-btn ${item.active ? 'is-active' : ''}`}
                                            onClick={() => {
                                                setIsPinnedOpen(false);
                                                onNavigate(item.id);
                                            }}
                                        >
                                            <div className="bnav__sheet-tab-icon">
                                                <LucideIcon name={item.icon || 'file-text'} size={19} />
                                            </div>
                                            <div className="bnav__sheet-tab-info">
                                                <span className="bnav__sheet-tab-title">{item.label}</span>
                                            </div>
                                            {(badges[item.id] || 0) > 0 && (
                                                <span className="bnav__badge" style={{ position: 'static', marginLeft: 'auto', flexShrink: 0 }}>
                                                    {badges[item.id] > 9 ? '9+' : badges[item.id]}
                                                </span>
                                            )}
                                            {item.active && (
                                                <div className="bnav__sheet-tab-check-wrap">
                                                    <CheckCircle2 size={20} className="bnav__sheet-tab-check" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Sheet Drawer: Pengumuman (Khusus Dashboard) */}
            {isAnnouncementsOpen && (
                <div className="bnav__sheet-backdrop" onClick={() => setIsAnnouncementsOpen(false)}>
                    <div className="bnav__sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="bnav__sheet-handle" />
                        <div className="bnav__sheet-header">
                            <div className="bnav__sheet-title-wrap">
                                <h3 className="bnav__sheet-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Megaphone size={18} style={{ color: '#3083FF' }} />
                                    <span>Pengumuman</span>
                                </h3>
                                {unreadAnnCount > 0 && (
                                    <span className="bnav__sheet-badge">
                                        {unreadAnnCount} Baru
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        className="bnav__sheet-close"
                                        style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', background: '#E0ECFF', color: '#2563eb' }}
                                        onClick={() => {
                                            setIsAnnouncementsOpen(false)
                                            onNavigate('informasi/kelola')
                                        }}
                                    >
                                        Kelola
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="bnav__sheet-close"
                                    onClick={() => setIsAnnouncementsOpen(false)}
                                    aria-label="Tutup"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="bnav__sheet-body" style={{ overflowY: 'auto', padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {loadingAnnouncements ? (
                                <p className="text-muted text-center py-4" style={{ fontSize: '0.85rem' }}>Memuat pengumuman...</p>
                            ) : announcements.length === 0 ? (
                                <div className="text-center py-6" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                    <BellOff size={28} />
                                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Tidak ada pengumuman aktif.</p>
                                </div>
                            ) : (
                                announcements.map((ann) => (
                                    <div key={ann.id} className={`ann-card-item ${ann.pinned ? 'is-pinned' : ''}`}>
                                        <div className="ann-card-header">
                                            <span className="ann-card-tag">{ann.category}</span>
                                            <span className="ann-card-date">{new Date(ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <h4 className="ann-card-title">
                                            {ann.pinned && <Pin size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#f59e0b', marginRight: 4 }} />}
                                            {ann.title}
                                        </h4>
                                        <p className="ann-card-text">
                                            {ann.content.length > 160 && !expandedAnn[String(ann.id)]
                                                ? ann.content.substring(0, 160) + '...'
                                                : ann.content}
                                            {ann.content.length > 160 && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleAnn(ann.id); }}
                                                    className="ann-expand-btn"
                                                >
                                                    {expandedAnn[String(ann.id)] ? 'Sembunyikan' : 'Selengkapnya'}
                                                </button>
                                            )}
                                        </p>
                                        <div className="ann-card-footer">
                                            <span className="ann-card-author">
                                                <UserCircle2 size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                                {ann.created_by}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        </>
    )
}
