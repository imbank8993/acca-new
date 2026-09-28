'use client'
import { useTabParam } from '@/hooks/useTabParam';

import { useMemo, useState, useEffect } from 'react'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import { PageLoader } from '@/components/ui/Spinner'
import { Tab, type TabItem } from '@/components/ui/Tab'
import { usePengaturanTugasAccess, type PengaturanTugasTab } from '@/lib/use-pengaturan-tugas-access'
import WaliKelasTab from './tabs/WaliKelasTab'
import GuruAsuhTab from './tabs/GuruAsuhTab'
import PlotingTugasTambahanTab from './tabs/PlotingTugasTambahanTab'
import EkskulTab from './tabs/EkskulTab'

type TabType = 'wali_kelas' | 'guru_asuh' | 'ploting_tugas' | 'ekskul'

export default function TaskSettingsPage({ user }: { user?: any }) {
  /**
   * Wewenang tab datang dari server lewat `usePengaturanTugasAccess()`.
   *
   * Sebelumnya `allowedTabs = tabs` — keempat tab tampil bagi siapa pun yang bisa
   * membuka halaman ini, dan gerbang sesungguhnya tersebar di empat mekanisme
   * berbeda di backend. Sekarang satu aturan: hanya ADMIN yang melekat di kode,
   * pengelola tiap tab ditunjuk di Pengaturan Users → Hak Akses Fitur.
   */
  const akses = usePengaturanTugasAccess()

  const ALL_TABS = useMemo<TabItem<TabType>[]>(
    () => [
      { key: 'wali_kelas', label: 'Wali Kelas', icon: 'person-workspace' },
      { key: 'guru_asuh', label: 'Guru Asuh', icon: 'heart-fill' },
      { key: 'ploting_tugas', label: 'Tugas Tambahan', icon: 'person-vcard' },
      { key: 'ekskul', label: 'Pembina Ekskul', icon: 'people-fill' }
    ],
    []
  )

  // Kunci tab di layar ini tidak seluruhnya sama dengan kunci `site_settings`.
  const TAB_KEY: Record<TabType, PengaturanTugasTab> = useMemo(() => ({
    wali_kelas: 'wali_kelas',
    guru_asuh: 'guru_asuh',
    ploting_tugas: 'ploting_tugas',
    ekskul: 'pembina_ekskul',
  }), [])

  const allowedTabs = useMemo(
    () => ALL_TABS.filter((tab) => akses.boleh(TAB_KEY[tab.key])),
    [ALL_TABS, TAB_KEY, akses],
  )
  const kunciTampil = useMemo(() => allowedTabs.map((t) => t.key), [allowedTabs])

  const [activeTab, setActiveTab] = useTabParam<TabType>(
    (kunciTampil[0] as TabType) ?? 'wali_kelas',
    kunciTampil.length > 0 ? (kunciTampil as TabType[]) : (['wali_kelas'] as TabType[]),
  )

  // Pindahkan tab aktif kalau yang sedang dibuka ternyata tidak dipegang.
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.find(t => t.key === activeTab)) {
      setActiveTab(allowedTabs[0].key as TabType)
    }
  }, [allowedTabs, activeTab])

  if (akses.memuat) {
    return <PageLoader variant="buble" size={56} />
  }

  if (!user) {
    return <div className="p-8 text-center text-red-500">Akses ditolak. Silakan login kembali.</div>
  }

  if (!akses.adaAkses) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--n-muted)' }}>
        Anda tidak berwenang atas halaman ini. Minta Admin menunjuk akun atau role Anda
        di Pengaturan Users → Hak Akses Fitur.
      </div>
    )
  }

  return (
    <MaintenanceBanner pageKey="maintenance_pengaturan_tugas">
    <div className="ts-page">
        {/* Header */}
        

        {/* Tabs — Premium Pill Tabs */}
        <Tab
          tabs={allowedTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel="Task settings tabs"
          variant="slider"
        />

        <div className="ts-content" role="tabpanel">
          {activeTab === 'wali_kelas' && <WaliKelasTab user={user} />}
          {activeTab === 'guru_asuh' && <GuruAsuhTab user={user} />}
          {activeTab === 'ploting_tugas' && <PlotingTugasTambahanTab user={user} />}
          {activeTab === 'ekskul' && <EkskulTab user={user} />}
        </div>

      </div>

      <style jsx>{`
        /* =====================================================
           PENGATURAN TUGAS PAGE — PREMIUM TAB DESIGN
        ===================================================== */

        /* HEADER */
        .ts-header {
          background: var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%));
          padding: 22px 32px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: none;
          font-family: 'Poppins', sans-serif;
        }

        .ts-titleArea h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: white;
          margin: 0 0 4px 0;
          letter-spacing: -0.02em;
        }

        .ts-titleArea p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.85rem;
          margin: 0;
          font-weight: 500;
        }


        .ts-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Dark mode - Pitch Black & Electric Blue Standard */
        :global(.dark) .ts-header {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
        }
        :global(.dark) .ts-titleArea h1 {
          background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          display: inline-block !important;
        }
        :global(.dark) .ts-titleArea p { color: #94a3b8 !important; }

        /* CONTENT AREA */
        .ts-content {
          padding: 0;
          min-height: 500px;
          background: transparent;
        }

        /* MOBILE RESPONSIVE */
        @media (max-width: 768px) {
          .ts-header { padding: 16px 16px 20px; border-radius: 16px; }
          .ts-titleArea h1 { font-size: 1.5rem; }
          .ts-titleArea p { font-size: 0.85rem; }
          .ts-content { padding: 0; }
        }
      `}</style>
    </MaintenanceBanner>
  )
}

