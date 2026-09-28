'use client'
import { useTabParam } from '@/hooks/useTabParam';

import { useMemo, useState, useEffect } from 'react'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import { usePengaturanDataAccess, type PengaturanDataTab } from '@/lib/use-pengaturan-data-access'
import { Tab, type TabItem } from '@/components/ui/Tab'
import SiswaKelasTab from './tabs/SiswaKelasTab'
import EkskulSiswaTab from './tabs/EkskulSiswaTab'
import RelasiOrangtuaTab from './tabs/RelasiOrangtuaTab'
import GuruMapelTab from './tabs/GuruMapelTab'
import BulkReplaceTab from './tabs/BulkReplaceTab'
import DropdownTab from './tabs/DropdownTab'

import { PageLoader } from '@/components/ui/Spinner'

type TabType = 'siswa_kelas' | 'guru_mapel' | 'ekskul_siswa' | 'relasi_ortu' | 'dropdown' | 'bulk_replace'

export default function DataSettingsPage({ user }: { user?: any }) {
  // `hasPermission`, `permissions`, `isAdmin`, dan `userRoles` dihapus dari sini:
  // wewenang tab kini datang dari server lewat `usePengaturanDataAccess()`. Empat
  // nilai itu dulu dipakai menyaring tab, tetapi `user.permissions` selalu larik
  // kosong (lihat lib/auth.ts), sehingga praktis hanya cabang `isAdmin` yang
  // berlaku — dan sumbernya berbeda dari yang ditegakkan backend.

  // If user prop is not provided, fetch it ourselves
  const [localUser, setLocalUser] = useState<any>(user)
  const [loading, setLoading] = useState(!user)

  useEffect(() => {
    if (user) {
      setLocalUser(user)
      setLoading(false)
      return
    }

    // Fallback: fetch current user if not provided in props
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setLocalUser(data.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const effectiveUser = localUser || user

  const akses = usePengaturanDataAccess()

  const ALL_TABS = useMemo<TabItem<TabType>[]>(() => [
    { key: 'siswa_kelas', label: 'Siswa Kelas', icon: 'people' },
    { key: 'guru_mapel', label: 'Guru Mapel', icon: 'book' },
    { key: 'ekskul_siswa', label: 'Siswa Ekskul', icon: 'volleyball' },
    { key: 'relasi_ortu', label: 'Orang Tua', icon: 'people-fill' },
    { key: 'dropdown', label: 'Dropdown', icon: 'list-columns' },
    { key: 'bulk_replace', label: 'Ganti Data Massal', icon: 'arrow-repeat' },
  ], [])

  /**
   * Kunci tab di UI vs kunci wewenang di server. Hanya satu yang berbeda nama:
   * tab `bulk_replace` memakai kunci `ganti_massal`.
   */
  const TAB_KEY: Record<TabType, PengaturanDataTab> = useMemo(() => ({
    siswa_kelas: 'siswa_kelas',
    guru_mapel: 'guru_mapel',
    ekskul_siswa: 'ekskul_siswa',
    relasi_ortu: 'relasi_ortu',
    dropdown: 'dropdown',
    bulk_replace: 'ganti_massal',
  }), [])

  /**
   * Tab yang tampil ditentukan server, per tab.
   *
   * Sebelumnya dipakai `hasPermission(permissions, ...)` dengan tiga bentuk kunci
   * sekaligus — padahal `user.permissions` selalu larik kosong (lihat lib/auth.ts),
   * jadi praktis yang berlaku hanya cabang `isAdmin`. Sekarang sumbernya sama
   * dengan yang ditegakkan backend: Hak Akses Fitur per tab.
   */
  const allowedTabs = useMemo(
    () => ALL_TABS.filter((tab) => akses.boleh(TAB_KEY[tab.key])),
    [ALL_TABS, TAB_KEY, akses],
  )
  const kunciTampil = useMemo(() => allowedTabs.map((t) => t.key), [allowedTabs])

  const [activeTab, setActiveTab] = useTabParam<TabType>(
    (kunciTampil[0] as TabType) ?? 'siswa_kelas',
    kunciTampil.length > 0 ? (kunciTampil as TabType[]) : (['siswa_kelas'] as TabType[]),
  )

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--n-surface, #0f172a)',
        zIndex: 9999,
      }}>
        <PageLoader minHeight="auto" variant="buble" size={56} />
      </div>
    )
  }

  if (!effectiveUser) {
    return <div className="p-8 text-center text-red-500">Akses ditolak. Silakan login kembali.</div>
  }

  return (
    <MaintenanceBanner pageKey="maintenance_pengaturan_data">
      <div className="ds-page">
        {/* Header Banner */}
        

        {/* Tabs — Premium Slider Pill Tabs (4 visible on mobile, scrollable) */}
        <Tab
          tabs={allowedTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="slider"
          ariaLabel="Data settings tabs"
        />

        <div className="ds-content" role="tabpanel">
          {activeTab === 'siswa_kelas' && <SiswaKelasTab user={effectiveUser} />}
          {activeTab === 'guru_mapel' && <GuruMapelTab user={effectiveUser} />}
          {activeTab === 'ekskul_siswa' && <EkskulSiswaTab user={effectiveUser} />}
          {activeTab === 'relasi_ortu' && <RelasiOrangtuaTab user={effectiveUser} />}
          {activeTab === 'dropdown' && <DropdownTab user={effectiveUser} />}
          {activeTab === 'bulk_replace' && <BulkReplaceTab />}
        </div>
      </div>


      <style jsx>{`
        /* =====================================================
           PENGATURAN DATA PAGE — PREMIUM TAB DESIGN
        ===================================================== */

        /* HEADER */
        .ds-header {
          background: var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%));
          padding: 14px 20px;
          border-radius: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: none;
          font-family: 'Poppins', sans-serif;
        }


        .ds-titleArea h1 {
          font-size: 1.25rem;
          font-weight: 800;
          color: white;
          margin: 0 0 2px 0;
          letter-spacing: -0.02em;
        }

        .ds-titleArea p {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.8rem;
          margin: 0;
          font-weight: 500;
        }

        .ds-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* CONTENT AREA */
        .ds-content {
          padding: 0;
          min-height: 500px;
          background: transparent;
        }

        /* MOBILE RESPONSIVE */
        @media (max-width: 768px) {
          .ds-content { padding: 0; }
        }
      `}</style>
    </MaintenanceBanner>
  )
}
