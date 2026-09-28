'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageLoader } from './ui/Spinner'

interface PageInfo {
  id: string
  label: string
  path: string
  hasComponent: boolean
  lastChecked: number
}

// Pre-built dynamic imports map - each page is lazy loaded
const LAZY_PAGES: Record<string, () => Promise<any>> = {
  'dashboard': () => import('@/app/(dashboard)/dashboard/DashboardContent'),
  'absensi': () => import('@/app/absensi/view'),
  'ketidakhadiran': () => import('@/app/ketidakhadiran/view'),
  'rekam-medis': () => import('@/app/rekam-medis/view'),
  'jurnal': () => import('@/app/jurnal/view'),
  'jurnal-banding': () => import('@/app/jurnal/banding/view'),
  'piket': () => import('@/app/piket/view'),
  'master': () => import('@/app/master/view'),
  'pengaturan-umum': () => import('@/app/pengaturan-umum/view'),
  'pengaturan-data': () => import('@/app/pengaturan-data/view'),
  'pengaturan-tugas': () => import('@/app/pengaturan-tugas/view'),
  'lckh': () => import('@/app/lckh/view'),
  'lckh-approval': () => import('@/app/lckh-approval/view'),
  'nilai': () => import('@/app/nilai/view'),
  'izin-guru': () => import('@/app/izin-guru/view'),
  'surat': () => import('@/app/surat/view'),
  'surat-daftar': () => import('@/app/surat/daftar/view'),
  'permintaan-surat': () => import('@/app/permintaan-surat/view'),
  'tugas-tambahan': () => import('@/app/tugas-tambahan/view'),
  'tugas-siswa': () => import('@/app/tugas-siswa/view'),
  'guru-asuh': () => import('@/app/guru-asuh/view'),
  'wali-kelas': () => import('@/app/wali-kelas/view'),
  'informasi': () => import('@/app/informasi/view'),
  'informasi/kelola': () => import('@/app/informasi/kelola/view'),
  'unggah-dokumen': () => import('@/app/dokumen/view'),
  'monitoring': () => import('@/app/monitoring/view'),
  'kinerja-guru': () => import('@/app/kinerja-guru/view'),
  'agenda-madrasah': () => import('@/app/agenda-madrasah/view'),
  'um-kelulusan': () => import('@/app/um-kelulusan/view'),
  'nilai-siswa': () => import('@/app/nilai-siswa/view'),
  'catatan-keuangan': () => import('@/app/catatan-keuangan/view'),
  'layanan-ptsp': () => import('@/app/layanan-ptsp/view'),
  'klinik': () => import('@/app/klinik/view'),
  'e-supervisi': () => import('@/app/e-supervisi/view'),
  'dokumen': () => import('@/app/dokumen/view'),
}

// Labels for each page
const PAGE_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard',
  'absensi': 'Absensi',
  'ketidakhadiran': 'Ketidakhadiran',
  'rekam-medis': 'Rekam Medis Siswa',
  'jurnal': 'Jurnal Guru',
  'jurnal-banding': 'Banding Jurnal',
  'piket': 'Piket',
  'master': 'Master Data',
  'pengaturan-umum': 'Pengaturan Umum',
  'pengaturan-data': 'Pengaturan Data',
  'pengaturan-tugas': 'Pengaturan Tugas',
  'lckh': 'LCKH',
  'lckh-approval': 'LCKH Approval',
  'nilai': 'Nilai',
  'izin-guru': 'Izin Guru',
  'surat': 'Generate Surat',
  'surat-daftar': 'Daftar Surat',
  'permintaan-surat': 'Permintaan Surat',
  'tugas-tambahan': 'Tugas Tambahan',
  'tugas-siswa': 'Tugas Siswa',
  'guru-asuh': 'Guru Asuh',
  'wali-kelas': 'Wali Kelas',
  'informasi': 'Informasi',
    'monitoring': 'Monitoring',
  'kinerja-guru': 'Kinerja Guru',
  'agenda-madrasah': 'Agenda Akademik',
  'um-kelulusan': 'UM & Kelulusan',
  'nilai-siswa': 'Nilai Siswa',
  'catatan-keuangan': 'Catatan Keuangan',
  'layanan-ptsp': 'Layanan PTSP',
  'klinik': 'Klinik Pembelajaran',
  'e-supervisi': 'E-Supervisi',
  'dokumen': 'Pusat Dokumen',
}

// Hook to get and manage page registry
export function usePageRegistry() {
  const buildRegistry = useCallback((): Record<string, PageInfo> => {
    // Build registry from LAZY_PAGES
    const pages: Record<string, PageInfo> = {}
    Object.entries(LAZY_PAGES).forEach(([id]) => {
      pages[id] = {
        id,
        label: PAGE_LABELS[id] || id,
        path: `/app/${id}/page`,
        hasComponent: true,
        lastChecked: Date.now()
      }
    })
    return pages
  }, [])

  const [registry, setRegistry] = useState<Record<string, PageInfo>>(buildRegistry)
  const loadRegistry = useCallback(async () => {
    setRegistry(buildRegistry())
  }, [buildRegistry])

  const isPageKnown = (pageId: string) => !!LAZY_PAGES[pageId]
  const getPageLabel = (pageId: string) => PAGE_LABELS[pageId] || pageId

  return { registry, loading: false, refresh: loadRegistry, isPageKnown, getPageLabel }
}

// Dynamic page renderer
export default function DynamicPageRenderer({
  pageId,
  user,
  onRefreshUser
}: {
  pageId: string
  user: any
  onRefreshUser: () => void
}) {
  const [loadedPage, setLoadedPage] = useState<{
    id: string
    component: React.ComponentType<any> | null
    error: boolean
  } | null>(null)

  useEffect(() => {
    const loader = LAZY_PAGES[pageId]
    if (!loader) return

    let cancelled = false
    loader().then(
      mod => {
        if (!cancelled) {
          setLoadedPage({ id: pageId, component: mod.default || null, error: !mod.default })
        }
      },
      err => {
        console.error(`Gagal memuat halaman "${pageId}":`, err)
        if (!cancelled) setLoadedPage({ id: pageId, component: null, error: true })
      },
    )
    return () => { cancelled = true }
  }, [pageId])

  if (!LAZY_PAGES[pageId] || (loadedPage?.id === pageId && loadedPage.error)) {
    return (
      <div className="page-not-found">
        <div className="page-not-found-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h2>Halaman &quot;{pageId}&quot;</h2>
        <p>Halaman tidak ditemukan atau belum tersedia.</p>
        <style jsx>{`
          .page-not-found {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            padding: 40px;
            text-align: center;
          }
          .page-not-found-icon {
            margin-bottom: 24px;
            opacity: 0.5;
          }
          h2 {
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--n-text);
            margin: 0 0 12px;
          }
          p {
            font-size: 0.95rem;
            color: var(--n-muted);
            margin: 0;
            max-width: 400px;
          }
          .dark h2 { color: #f1f5f9; }
          .dark p { color: var(--n-muted); }
        `}</style>
      </div>
    )
  }

  if (loadedPage?.id !== pageId || !loadedPage.component) {
    return <PageLoader label="Memuat modul…" />
  }

  const Component = loadedPage.component
  return <Component user={user} onRefreshUser={onRefreshUser} />
}

// Export for compatibility
export function getKnownPages() {
  return Object.keys(LAZY_PAGES)
}
