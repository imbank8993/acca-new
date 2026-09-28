'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { User, PageNode } from '@/lib/types'
import { useModalBlur } from './ModalBlurProvider'
import { swalError } from '@/lib/swal-premium'
import { buildSidebarGroups, humanize, effectiveMenuRoles, type MenuGroupDef } from '@/lib/sidebar-menu'
import { RiArrowDropDownFill } from 'react-icons/ri'
import './sidebar.css'

// Detect if any modal is open via ModalBlurContext
function useDetectModalOpen() {
  const { isAnyModalOpen } = useModalBlur()
  return isAnyModalOpen
}

// Page config type
interface PageConfig {
  id: string
  label: string
  icon: string
  color: string
}

// Default labels/icons used to resolve a page's display label/icon
const DEFAULT_PAGE_CONFIG: Record<string, PageConfig> = {
  'dashboard': { id: 'dashboard', label: 'Dashboard', icon: 'bi-house', color: '#3b82f6' },
  'jurnal': { id: 'jurnal', label: 'Jurnal Guru', icon: 'bi-journal-text', color: '#10b981' },
  'jurnal-banding': { id: 'jurnal-banding', label: 'Banding Jurnal', icon: 'bi-arrow-left-right', color: '#10b981' },
  'absensi': { id: 'absensi', label: 'Absensi Siswa', icon: 'bi-clipboard-check', color: '#f59e0b' },
  'nilai': { id: 'nilai', label: 'Nilai', icon: 'bi-graph-up', color: '#ec4899' },
  'piket': { id: 'piket', label: 'Laporan Piket', icon: 'bi-calendar-week', color: '#14b8a6' },
  'lckh': { id: 'lckh', label: 'LCKH', icon: 'bi-file-earmark-check', color: '#06b6d4' },
  'lckh-approval': { id: 'lckh-approval', label: 'LCKH Approval', icon: 'bi-clipboard-check-fill', color: '#0ea5e9' },
  'informasi': { id: 'informasi', label: 'Informasi', icon: 'bi-info-circle', color: '#6366f1' },
  'ketidakhadiran': { id: 'ketidakhadiran', label: 'Ketidakhadiran', icon: 'bi-calendar-x', color: '#f97316' },
  'rekam-medis': { id: 'rekam-medis', label: 'Rekam Medis Siswa', icon: 'bi-clipboard2-pulse', color: '#059669' },
  'master': { id: 'master', label: 'Master Data', icon: 'bi-database', color: 'var(--n-muted)' },
  'pengaturan-umum': { id: 'pengaturan-umum', label: 'Pengaturan Umum', icon: 'bi-gear', color: '#78716c' },
  'pengaturan-data': { id: 'pengaturan-data', label: 'Pengaturan Data', icon: 'bi-gear', color: '#78716c' },
  'pengaturan-tugas': { id: 'pengaturan-tugas', label: 'Pengaturan Tugas', icon: 'bi-person-check', color: '#a78bfa' },
  'pengaturan-users': { id: 'pengaturan-users', label: 'Pengaturan Users', icon: 'bi-people', color: '#fb7185' },
  'audit-log': { id: 'audit-log', label: 'Log Audit', icon: 'bi-shield-check', color: '#6366f1' },
  'monitoring': { id: 'monitoring', label: 'Monitoring', icon: 'bi-eye', color: '#0ea5e9' },
  'tugas-tambahan': { id: 'tugas-tambahan', label: 'Tugas Tambahan', icon: 'bi-star', color: '#eab308' },
  'kinerja-guru': { id: 'kinerja-guru', label: 'Kinerja Guru', icon: 'bi-graph-up-arrow', color: '#f97316' },
  'guru-asuh': { id: 'guru-asuh', label: 'Guru Asuh', icon: 'bi-person-heart', color: '#06b6d4' },
  'wali-kelas': { id: 'wali-kelas', label: 'Wali Kelas', icon: 'bi-mortarboard-fill', color: '#8b5cf6' },
  'nilai-siswa': { id: 'nilai-siswa', label: 'Nilai Siswa', icon: 'bi-award', color: '#10b981' },
  'tugas-siswa': { id: 'tugas-siswa', label: 'Tugas Siswa', icon: 'bi-list-task', color: '#ec4899' },
  'izin-guru': { id: 'izin-guru', label: 'Izin Guru', icon: 'bi-calendar-plus', color: '#8b5cf6' },
  'surat': { id: 'surat', label: 'Generate Surat', icon: 'bi-file-earmark-word', color: '#3083FF' },
  'permintaan-surat': { id: 'permintaan-surat', label: 'Permintaan Surat', icon: 'bi-file-earmark-plus', color: '#1e40af' },
  'surat-daftar': { id: 'surat-daftar', label: 'Daftar Surat', icon: 'bi-list-check', color: '#3083FF' },
  'um-kelulusan': { id: 'um-kelulusan', label: 'UM & Kelulusan', icon: 'bi-files', color: '#8b5cf6' },
  'dokumen': { id: 'dokumen', label: 'Pusat Dokumen', icon: 'bi-folder2-open', color: '#3b82f6' },
  'catatan-keuangan': { id: 'catatan-keuangan', label: 'Catatan Keuangan', icon: 'bi-wallet2', color: '#10b981' },
  'e-supervisi': { id: 'e-supervisi', label: 'E-Supervisi', icon: 'bi-clipboard-data', color: '#7c3aed' },
  'layanan-ptsp': { id: 'layanan-ptsp', label: 'Layanan PTSP', icon: 'bi-file-text', color: '#3083FF' },
  'klinik': { id: 'klinik', label: 'Klinik Pembelajaran', icon: 'bi-plus-square', color: '#ef4444' },
  'observasi-kelas': { id: 'observasi-kelas', label: 'Observasi Kelas', icon: 'bi-clipboard-check', color: '#10b981' },
}

// Collect every page id the user can reach from their pagesTree
function getUserPageIds(pagesTree: PageNode[]): Set<string> {
  const ids = new Set<string>()
  const walk = (nodes: PageNode[]) => {
    nodes?.forEach(node => {
      if (node.page) ids.add(node.page)
      if (node.children) walk(node.children)
    })
  }
  walk(pagesTree || [])
  return ids
}

interface SidebarProps {
  user: User
  currentPage: string
  onNavigate: (page: string) => void
  onPrefetch?: (page: string) => void
  isOpen: boolean
  onToggle: () => void
  isCollapsed: boolean
  onCollapse: () => void
  appMode?: 'home' | 'cbt'
  onAppModeChange?: (mode: 'home' | 'cbt') => void
  /** { [pageId]: jumlah antrean yang menunggu tindakan user }; lihat lib/sidebar-badges.ts */
  badges?: Record<string, number>
}

/**
 * Penanda jumlah antrean, ditempel di pojok kanan atas nama menu.
 *
 * Sengaja inline (bukan absolute) supaya tidak menabrak tombol bintang "sematkan"
 * yang menempati sisi kanan baris submenu; efek "pojok kanan atas" didapat dari
 * pergeseran ke atas di CSS, jadi tetap aman di lebar sidebar berapa pun.
 */
function MenuBadge({ n }: { n: number }) {
  if (!n) return null
  const label = `${n} menunggu tindakan Anda`
  return (
    <span className="menu-badge" title={label} aria-label={label}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

/**
 * Nama menu + badge-nya.
 *
 * Teksnya dibungkus sendiri supaya CSS bisa membuat NAMA yang menyusut dan
 * ber-elipsis sementara badge tetap utuh. Kalau keduanya dibiarkan sebagai satu
 * aliran teks, nama panjang akan memakan badge-nya sampai hilang.
 */
function MenuName({ label, n }: { label: string; n?: number }) {
  return (
    <>
      <span className="menu-name-text">{label}</span>
      <MenuBadge n={n || 0} />
    </>
  )
}

const getMenuIcon = (page: string | null | undefined, title: string) => {
  const DEFAULT_ICON = 'fa-folder'

  if (page) {
    const pp = page.toLowerCase()
    if (pp === 'dashboard') return 'fa-house'
    if (pp === 'ketidakhadiran') return 'fa-user-xmark'
    if (pp === 'rekam-medis') return 'fa-notes-medical'
    if (pp === 'manage-dokumen' || pp === 'dokumen-siswa') return 'fa-folder-open'
    if (pp === 'surat') return 'fa-file-signature'
    if (pp === 'permintaan-surat') return 'fa-envelope-open-text'
    if (pp === 'surat-daftar' || pp === 'daftar-surat') return 'fa-list-check'
    if (pp === 'laporan') return 'fa-file-lines'
    if (pp === 'informasi') return 'fa-graduation-cap'
    if (pp.includes('manage-dokumen') || pp.includes('manage-file') || pp.includes('penyimpanan-file')) return 'fa-folder-open'
    if (pp.includes('lckh-approval')) return 'fa-clipboard-check'
    if (pp.includes('klinik')) return 'fa-square-plus'
    if (pp.includes('lckh')) return 'fa-file-lines'
    if (pp.includes('izin-guru')) return 'fa-calendar'
    if (pp.includes('kehadiran-siswa')) return 'fa-check-circle'
    if (pp.includes('catatan-keuangan')) return 'fa-wallet'
    if (pp.includes('dokumen-siswa')) return 'fa-folder-open'
    if (pp.includes('personal-documents')) return 'fa-file'
    if (pp.includes('guru-asuh')) return 'fa-users'
    if (pp.includes('wali-kelas')) return 'fa-user-tie'
    if (pp.includes('jurnal-banding')) return 'fa-right-left'
    if (pp.includes('absensi')) return 'fa-square-check'
    if (pp.includes('nilai')) return 'fa-graduation-cap'
    if (pp.includes('tugas-tambahan')) return 'fa-list-check'
    if (pp.includes('piket')) return 'fa-shield'
    if (pp.includes('master')) return 'fa-database'
    if (pp.includes('pengaturan-data')) return 'fa-sliders'
    if (pp.includes('pengaturan-tugas')) return 'fa-calendar-plus'
    if (pp.includes('pengaturan-users')) return 'fa-users-gear'
    if (pp.includes('pengaturan-umum')) return 'fa-gear'
    if (pp.includes('reset-data')) return 'fa-trash'
    if (pp.includes('analisis-beban-kerja')) return 'fa-chart-column'
    if (pp.includes('agenda-madrasah')) return 'fa-calendar'
    if (pp.includes('monitoring')) return 'fa-desktop'
    if (pp.includes('kinerja-guru')) return 'fa-chart-line'
    if (pp.includes('e-supervisi')) return 'fa-clipboard-list'
    if (pp.includes('tugas-siswa')) return 'fa-clipboard'
    if (pp.includes('ptsp') || pp.includes('layanan-ptsp')) return 'fa-file-lines'
    if (pp.includes('um-kelulusan')) return 'fa-files'
    if (pp.includes('observasi-kelas')) return 'fa-chalkboard-user'
    if (pp.includes('jadwal')) return 'fa-calendar'
    if (pp.includes('user')) return 'fa-users'
    if (pp.includes('dokumen')) return 'fa-folder-open'
    if (pp.includes('laporan')) return 'fa-file-lines'
    if (pp.includes('jurnal')) return 'fa-book'
    if (pp.includes('permintaan-surat')) return 'fa-envelope-open-text'
    if (pp.includes('surat-daftar') || pp.includes('daftar-surat')) return 'fa-list-check'
    if (pp.includes('surat')) return 'fa-envelope'
  }

  const p = title.toLowerCase()
  if (p.includes('beranda')) return 'fa-house'
  if (p.includes('akademik')) return 'fa-graduation-cap'
  if (p.includes('kesiswaan')) return 'fa-users'
  if (p.includes('layanan') || p.includes('surat')) return 'fa-envelope'
  if (p.includes('laporan') || p.includes('monitoring')) return 'fa-chart-line'
  if (p.includes('administrasi') || p.includes('data')) return 'fa-database'
  if (p.includes('pengaturan')) return 'fa-gear'
  if (p.includes('siswa')) return 'fa-id-card'
  if (p.includes('lainnya') || p.includes('lain-lain') || p.includes('lain')) return 'fa-ellipsis'
  return DEFAULT_ICON
}

// Simpan pin ke DB per user (fire-and-forget; localStorage tetap jadi cache lokal)
function savePinsToServer(pinned: string[], silent = false) {
  fetch('/api/user/pinned-pages', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned }),
  }).then(async r => {
    if (!r.ok) {
      if (r.status === 401) return; // Abaikan secara diam-diam jika sesi belum siap/401
      const d = await r.json().catch(() => ({}))
      // Backend bisa mengembalikan 'error' atau 'message' — tangani keduanya
      const msg = d.error || d.message || `HTTP ${r.status}`
      console.warn('Failed to save pins:', msg)
      // Jangan tampilkan popup jika 401 (sesi belum siap saat pertama load)
      if (!silent) swalError('Gagal Menyimpan Pin', 'Sistem gagal menyimpan pin. Hubungi administrator jika masalah berlanjut.')
    }
  }).catch(() => { 
    /* Abaikan galat jaringan/offline secara diam-diam */
  })
}

export default function Sidebar({
  user,
  currentPage,
  onNavigate,
  onPrefetch,
  isOpen,
  onToggle,
  isCollapsed,
  onCollapse,
  badges,
}: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [cbtLoading, setCbtLoading] = useState(false)
  const [pinned, setPinned] = useState<string[]>([])
  // null = struktur menu belum diketahui (masih dimuat). Sengaja TIDAK diisi
  // taksonomi bawaan: sidebar lebih baik menampilkan placeholder sebentar
  // daripada daftar menu cadangan yang tidak pernah disusun di "Susun Menu".
  const [menuGroups, setMenuGroups] = useState<MenuGroupDef[] | null>(null)
  const [menuLabels, setMenuLabels] = useState<Record<string, string>>({})
  const [roleFlat, setRoleFlat] = useState<Record<string, string[]>>({})

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isAnyModalOpen = useDetectModalOpen()

  const hasCbtAccess = user.pagesArray?.includes('cbt-app') || user.roles?.includes('ADMIN')
  const hasToolsAccess = user.pagesArray?.includes('tools-app') || user.roles?.includes('ADMIN')

  // ── Load persisted UI state ──
  useEffect(() => {
    let localPins: string[] = []
    const userKey = user?.auth_id || (user as any)?.authId || (user?.id ? String(user.id) : '') || user?.username || 'default'
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
      const e = localStorage.getItem('acca_expanded_groups')
      if (e) { const arr = JSON.parse(e); if (Array.isArray(arr)) setExpandedGroups(arr) }
    } catch { /* ignore */ }

    // Sumber kebenaran pin: DB per user (permanen lintas browser & login).
    fetch('/api/user/pinned-pages')
      .then(r => r.json())
      .then(d => {
        if (!d?.ok || !Array.isArray(d.data)) {
          if (localPins.length > 0) savePinsToServer(localPins, true)
          return
        }
        if (d.data.length === 0 && localPins.length > 0) {
          // Migrasi sekali: angkat pin lama dari browser ini ke DB
          savePinsToServer(localPins, true)
        } else {
          setPinned(d.data)
          try {
            localStorage.setItem(`acca_pinned_pages_${userKey}`, JSON.stringify(d.data))
            if (user?.auth_id) localStorage.setItem(`acca_pinned_pages_${user.auth_id}`, JSON.stringify(d.data))
          } catch {}
        }
      })
      .catch(() => {
        if (localPins.length > 0) savePinsToServer(localPins, true)
      })
  }, [user?.auth_id, user?.id])

  // Load the global menu structure (cached in localStorage, revalidated from API)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('acca_menu_layout')
      if (cached) {
        const arr = JSON.parse(cached)
        if (Array.isArray(arr) && arr.length) setMenuGroups(arr)
      }
      const cachedLabels = localStorage.getItem('acca_menu_labels')
      if (cachedLabels) {
        const obj = JSON.parse(cachedLabels)
        if (obj && typeof obj === 'object') setMenuLabels(obj)
      }
      const cachedFlat = localStorage.getItem('acca_role_flat')
      if (cachedFlat) {
        const obj = JSON.parse(cachedFlat)
        if (obj && typeof obj === 'object') setRoleFlat(obj)
      }
    } catch { /* ignore */ }
    fetch('/api/menu-layout')
      .then(r => r.json())
      .then(d => {
        // Layout kosong pun diterapkan (berarti memang belum disusun). Kalau
        // request gagal / ok:false, biarkan cache lokal yang tetap tampil.
        if (d?.ok && Array.isArray(d.layout)) {
          setMenuGroups(d.layout)
          try { localStorage.setItem('acca_menu_layout', JSON.stringify(d.layout)) } catch {}
        }
        if (d?.ok && d.labels && typeof d.labels === 'object') {
          setMenuLabels(d.labels)
          try { localStorage.setItem('acca_menu_labels', JSON.stringify(d.labels)) } catch {}
        }
        if (d?.ok && d.roleFlat && typeof d.roleFlat === 'object') {
          setRoleFlat(d.roleFlat)
          try { localStorage.setItem('acca_role_flat', JSON.stringify(d.roleFlat)) } catch {}
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { try { localStorage.setItem('acca_expanded_groups', JSON.stringify(expandedGroups)) } catch {} }, [expandedGroups])

  // ── Accessible page ids + label resolver ──
  const accessibleIds = useMemo(() => {
    const set = new Set<string>()
    ;(user.pagesArray || []).forEach(p => set.add(p))
    getUserPageIds(user.pagesTree || []).forEach(p => set.add(p))
    set.delete('cbt-app')
    return set
  }, [user.pagesArray, user.pagesTree])

  const labelOf = useMemo(() => {
    const map = new Map<string, string>()
    const walk = (nodes: PageNode[]) => nodes?.forEach(n => {
      if (n.page && n.title) map.set(n.page, n.title)
      if (n.children) walk(n.children)
    })
    walk(user.pagesTree || [])
    // Custom labels from "Susun Menu" (menu_layout) take priority.
    return (id: string) => menuLabels[id] || map.get(id) || DEFAULT_PAGE_CONFIG[id]?.label || humanize(id)
  }, [user.pagesTree, menuLabels])

  // Group keys this user renders "flat" (any role flat → flat). Admin precedence
  // applies: an admin user uses only the admin config, otherwise union of roles.
  const flatGroupKeys = useMemo(() => {
    const set = new Set<string>()
    effectiveMenuRoles(user.roles || []).forEach(r => (roleFlat[r] || []).forEach(k => set.add(k)))
    return set
  }, [user.roles, roleFlat])

  const groups = useMemo(
    () => (menuGroups ? buildSidebarGroups(menuGroups, accessibleIds, labelOf, flatGroupKeys) : []),
    [menuGroups, accessibleIds, labelOf, flatGroupKeys]
  )

  // Auto-expand the group containing the current page (single-open accordion)
  useEffect(() => {
    const g = groups.find(gr => gr.children.some(c => c.id === currentPage))
    if (g) {
      setExpandedGroups(prev => prev.includes(g.key) ? prev : [...prev, g.key])
    }
  }, [currentPage, groups])

  // Cleanup unaccessible pins if roles change
  useEffect(() => {
    if (pinned.length > 0 && accessibleIds.size > 0) {
      const validPins = pinned.filter(id => accessibleIds.has(id))
      if (validPins.length !== pinned.length) {
        setPinned(validPins)
        savePinsToServer(validPins, true)
        try { if (user?.auth_id) localStorage.setItem(`acca_pinned_pages_${user.auth_id}`, JSON.stringify(validPins)) } catch {}
      }
    }
  }, [accessibleIds, user?.auth_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pinnedItems = useMemo(
    () => pinned.filter(id => accessibleIds.has(id)).map(id => ({ id, label: labelOf(id) })),
    [pinned, accessibleIds, labelOf]
  )

  // ── Badge antrean ──
  // Header grup memakai jumlah seluruh anaknya: kalau akordeon sedang tertutup,
  // badge anak tidak terlihat sama sekali, jadi grup harus mewakilinya.
  const badgeOf = (id: string) => badges?.[id] || 0
  const groupBadgeOf = (children: { id: string }[]) =>
    children.reduce((sum, c) => sum + badgeOf(c.id), 0)

  // ── Handlers ──
  const handleMouseEnter = (index: number) => {
    if (!isCollapsed) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setHoveredIdx(index)
  }
  const handleMouseLeave = () => {
    if (!isCollapsed) return
    hoverTimeoutRef.current = setTimeout(() => setHoveredIdx(null), 300)
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => (prev.includes(key) ? [] : [key]))
  }

  const togglePin = (id: string) => {
    const userKey = user?.auth_id || (user as any)?.authId || (user?.id ? String(user.id) : '') || user?.username || 'default'
    const next = pinned.includes(id) ? pinned.filter(x => x !== id) : [...pinned, id]
    setPinned(next)
    try {
      localStorage.setItem(`acca_pinned_pages_${userKey}`, JSON.stringify(next))
      if (user?.auth_id) localStorage.setItem(`acca_pinned_pages_${user.auth_id}`, JSON.stringify(next))
    } catch {}
    savePinsToServer(next, false)
    window.dispatchEvent(new Event('acca:pinned-change'))
  }

  const go = (page: string) => {
    onNavigate(page)
    if (typeof window !== 'undefined' && window.innerWidth < 992) onToggle()
  }

  const openCbt = async () => {
    if (cbtLoading) return
    setCbtLoading(true)
    const win = window.open('about:blank', '_blank')
    if (win) { try { win.opener = null } catch { /* cross-origin nanti, abaikan */ } }
    // Jalur cadangan: navigasi biasa ke route SSO. Route-nya membaca cookie
    // login server (sb-access-token.0 / sb-refresh-token.0) langsung saat tidak
    // ada header Authorization, jadi jalur ini tetap jalan ketika client
    // Supabase di browser tidak punya sesi.
    const ssoUrl = `${window.location.origin}/api/sso/cbt`
    const openViaNavigation = () => {
      if (win) win.location.href = ssoUrl
      else window.open(ssoUrl, '_blank')
    }

    try {
      const res = await fetch('/api/sso/cbt', {
        headers: {
          'Accept': 'application/json',
        },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        if (win) win.location.href = data.url
        else window.open(data.url, '_blank')
      } else if (res.status === 401) {
        // Token bearer ditolak (mis. sudah kedaluwarsa) — coba jalur cookie
        // sebelum menyerah; server bisa saja masih memegang sesi yang sah.
        openViaNavigation()
      } else {
        win?.close()
        swalError('Gagal membuka CBT', data.error || 'Tidak dapat membuat tiket SSO.')
      }
    } catch (err) {
      console.error('SSO CBT error:', err)
      win?.close()
      swalError('Gagal membuka CBT', 'Terjadi kesalahan saat menghubungi server SSO.')
    } finally {
      setCbtLoading(false)
    }
  }

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'show' : ''}`} onClick={onToggle}></div>
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''} ${isAnyModalOpen ? 'blur-when-modal-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <button
              type="button"
              className="brand-logo"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  onToggle()
                } else {
                  onCollapse()
                }
              }}
              title={isCollapsed ? 'Perbesar sidebar' : 'Kecilkan sidebar'}
              aria-label={isCollapsed ? 'Perbesar sidebar' : 'Kecilkan sidebar'}
            >
              {!isCollapsed ? (
                <>
                  <img src="/logo-sidebar.png" alt="ACCA Logo" className="brand-logo-img light-logo" />
                  <img src="/logo-sidebar-dark.png" alt="ACCA Logo" className="brand-logo-img dark-logo" />
                </>
              ) : (
                // Satu berkas untuk terang & gelap: marka transparan dengan biru
                // yang sama persis (#1D6BF3) seperti logo lebar, jadi terbaca di
                // kedua latar tanpa perlu varian kedua.
                <img src="/logo-sidebar-kecil.webp" alt="ACCA Logo" className="brand-logo-img" />
              )}
            </button>
            {/* Tombol lipat/perbesar sidebar dioperasikan langsung dengan menekan logo di atas. */}
          </div>
        </div>

        {/* SSO App Links — CBT + ACCA TOOLS side by side (only if user has access to at least one) */}
        {(hasCbtAccess || hasToolsAccess) && (
          <div className="sidebar-nav-fixed">
            <div className="sso-cbt-container">
              {hasCbtAccess && (
                <button
                  onClick={openCbt}
                  disabled={cbtLoading}
                  className="sso-cbt-btn"
                  title="Buka Aplikasi CBT"
                  aria-busy={cbtLoading}
                >
                  <i className={`fa-solid ${cbtLoading ? 'fa-spinner fa-spin' : 'fa-file-waveform'} btn-icon`}></i>
                  {!isCollapsed && <span className="btn-label">{cbtLoading ? 'Membuka…' : 'CBT'}</span>}
                </button>
              )}
              {hasToolsAccess && (
                <a
                  href="/api/sso/tools"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sso-cbt-btn"
                  title="Buka ACCA TOOLS"
                >
                  <i className="fa-solid fa-toolbox btn-icon"></i>
                  {!isCollapsed && <span className="btn-label">TOOLS</span>}
                </a>
              )}
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {/* ── PINNED ── */}
          {!isCollapsed && pinnedItems.length > 0 && (
            <>
              <div className="nav-section-label">Disematkan</div>
              {pinnedItems.map(p => (
                <div key={p.id} className="submenu-row pinned-row">
                  <button
                    className={`submenu-btn pinned-btn ${p.id === currentPage ? 'active' : ''}`}
                    onClick={() => go(p.id)}
                    onMouseEnter={() => onPrefetch?.(p.id)}
                    onFocus={() => onPrefetch?.(p.id)}
                  >
                    <i
                      className={`fa-solid ${getMenuIcon(p.id, p.label)} pinned-ico pin-ico active`}
                      title="Lepas dari pinned"
                      aria-label="Lepas dari pinned"
                      role="button"
                      onClick={e => { e.stopPropagation(); togglePin(p.id) }}
                    ></i>
                    <span className="menu-label"><MenuName label={p.label} n={badgeOf(p.id)} /></span>
                  </button>
                </div>
              ))}
              <div className="nav-divider"></div>
              <div className="nav-section-label">Menu Utama</div>
            </>
          )}

          {/* ── GROUPS ── */}
          {menuGroups === null && (
            <div className="menu-skeleton" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="menu-skeleton-row"></div>)}
            </div>
          )}
          {groups.map((g, index) => {
                const isActive = g.children.some(c => c.id === currentPage)
                const expanded = expandedGroups.includes(g.key)

                // Flat group: render children as top-level items (no header / accordion).
                // Falls back to grouped rendering when collapsed (icons need a parent).
                if (g.flat && !isCollapsed) {
                  return (
                    <div key={g.key} className="menu-group menu-group--flat">
                      {g.children.map(c => (
                        <div key={c.id} className="submenu-row">
                          <button
                            className={`submenu-btn flat-btn ${c.id === currentPage ? 'active' : ''}`}
                            onClick={() => go(c.id)}
                            onMouseEnter={() => onPrefetch?.(c.id)}
                            onFocus={() => onPrefetch?.(c.id)}
                          >
                            <i
                              className={`fa-solid ${getMenuIcon(c.id, c.label)} menu-icon pin-ico ${pinned.includes(c.id) ? 'active' : ''}`}
                              title={pinned.includes(c.id) ? 'Lepas dari pinned' : 'Sematkan'}
                              aria-label={pinned.includes(c.id) ? 'Lepas dari pinned' : 'Sematkan'}
                              role="button"
                              onClick={e => { e.stopPropagation(); togglePin(c.id) }}
                            ></i>
                            <span className="menu-label"><MenuName label={c.label} n={badgeOf(c.id)} /></span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                }

                return (
                  <div
                    key={g.key}
                    className="menu-group"
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      onClick={() => { toggleGroup(g.key); if (isCollapsed) onCollapse() }}
                      className={`menu-btn ${isActive ? 'active' : ''} ${expanded ? 'expanded' : ''}`}
                    >
                      <div className="menu-content">
                        <i className={`fa-solid ${g.icon} menu-icon`}></i>
                        {/* Saat sidebar menyempit labelnya hilang, jadi badge diwakili titik di ikon. */}
                        {isCollapsed && groupBadgeOf(g.children) > 0 && (
                          <span className="menu-badge-dot" aria-label={`${groupBadgeOf(g.children)} menunggu tindakan Anda`}></span>
                        )}
                        {!isCollapsed && (
                          <span className="menu-label">
                            <MenuName label={g.label} n={expanded ? 0 : groupBadgeOf(g.children)} />
                          </span>
                        )}
                      </div>
                      {!isCollapsed && (
                        <RiArrowDropDownFill size={20} className={`chevron ${expanded ? 'rotate' : ''}`} />
                      )}
                    </button>

                    {/* Submenu (expanded) */}
                    {!isCollapsed && (
                      <div className={`submenu ${expanded ? 'open' : ''}`}>
                        {g.children.map(c => (
                          <div key={c.id} className="submenu-row">
                            <button
                              className={`submenu-btn ${c.id === currentPage ? 'active' : ''}`}
                              onClick={() => go(c.id)}
                              onMouseEnter={() => onPrefetch?.(c.id)}
                              onFocus={() => onPrefetch?.(c.id)}
                            >
                              <span className="menu-label"><MenuName label={c.label} n={badgeOf(c.id)} /></span>
                            </button>
                            <button
                              className={`pin-star ${pinned.includes(c.id) ? 'active' : ''}`}
                              title={pinned.includes(c.id) ? 'Lepas dari pinned' : 'Sematkan'}
                              aria-label={pinned.includes(c.id) ? 'Lepas dari pinned' : 'Sematkan'}
                              onClick={e => { e.stopPropagation(); togglePin(c.id) }}
                            >
                              <i className="fa-solid fa-star"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tooltip/Popover for collapsed state */}
                    {isCollapsed && hoveredIdx === index && (
                      <div
                        className="sidebar-tooltip"
                        onMouseEnter={() => handleMouseEnter(index)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="tooltip-header">
                          <i className={`fa-solid ${g.icon}`}></i>
                          <span>{g.label}</span>
                        </div>
                        <div className="tooltip-submenu">
                          {g.children.map(c => (
                            <button
                              key={c.id}
                              onClick={() => go(c.id)}
                              onMouseEnter={() => onPrefetch?.(c.id)}
                              onFocus={() => onPrefetch?.(c.id)}
                              className={`tooltip-sub-btn ${c.id === currentPage ? 'active' : ''}`}
                              style={{ display: 'flex', alignItems: 'center' }}
                            >
                              <span><MenuName label={c.label} n={badgeOf(c.id)} /></span>
                              {pinned.includes(c.id) && (
                                <i className="fa-solid fa-star" style={{ marginLeft: 'auto', color: '#eab308', fontSize: '0.8rem' }}></i>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
        </nav>
      </aside>
    </>
  )
}
