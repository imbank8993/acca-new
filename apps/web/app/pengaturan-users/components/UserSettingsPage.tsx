'use client'
import { useTabParam } from '@/hooks/useTabParam';

import { useMemo } from 'react'
import UserDataTab from '../tabs/UserDataTab'
import RolePageAccessTab from '../tabs/RolePageAccessTab'
import MenuLayoutTab from '../tabs/MenuLayoutTab'
import RoleManagementTab from '../tabs/RoleManagementTab'
import MaintenanceTab from '../tabs/MaintenanceTab'
import FeatureAccessTab from '../tabs/FeatureAccessTab'
import { Tab, type TabItem } from '@/components/ui/Tab'
import { PageLoader } from '@/components/ui/Spinner'
import { parseRoles } from '@/lib/auth'
import type { User } from '@/lib/types'

type TabType = 'user_data' | 'role_pages' | 'feature_access' | 'menu_layout' | 'role_permissions' | 'atur_halaman'

export default function UserSettingsPage({ initialTab, user }: { initialTab?: string, user?: User }) {
  /**
   * Halaman ini HANYA untuk ADMIN, dan itu ditegakkan di dua tempat.
   *
   * Server adalah yang menentukan: `UsersController.assertCanManageUsers` dan
   * `assertAdmin` di site-settings menolak siapa pun selain ADMIN/ADMINISTRATOR.
   * Gerbang di sini menutup sisi tampilannya, yang sebelumnya terbuka: keenam tab
   * dirender tanpa memeriksa siapa pemakainya, jadi mengetik URL-nya langsung
   * memberi layar lengkap berisi daftar seluruh akun, role, dan Hak Akses Fitur —
   * lalu baru gagal saat menyimpan.
   *
   * `page-requirements.ts` sudah mencantumkan `'pengaturan-users': ['ADMIN']`,
   * tetapi nilai itu tidak pernah dipakai sebagai gerbang halaman — hanya untuk
   * menampilkan peringatan di dalam tab "Akses per Role".
   *
   * Dicocokkan per ELEMEN daftar role, bukan sebagai substring, supaya role
   * seperti `ADMINISTRASI` tidak ikut lolos.
   */
  const isAdmin = useMemo(() => {
    if (!user) return false
    const daftar = Array.isArray(user.roles)
      ? user.roles.map((r: string) => String(r).trim().toUpperCase())
      : parseRoles(String(user.role || ''))
    return daftar.some((r: string) => r === 'ADMIN' || r === 'ADMINISTRATOR')
  }, [user])

  const [activeTab, setActiveTab] = useTabParam<TabType>(
    (initialTab as TabType) || 'user_data',
    ['user_data', 'role_pages', 'feature_access', 'menu_layout', 'role_permissions', 'atur_halaman']
  )

  const tabs = useMemo<TabItem<TabType>[]>(
    () => [
      { key: 'user_data', label: 'Data & Status User', icon: 'bi-person-gear' },
      { key: 'role_pages', label: 'Akses Halaman', icon: 'bi-layout-text-window-reverse' },
      { key: 'feature_access', label: 'Hak Akses Fitur', icon: 'bi-sliders2' },
      { key: 'menu_layout', label: 'Susun Menu', icon: 'bi-list-nested' },
      { key: 'role_permissions', label: 'Daftar Role', icon: 'bi-shield-check' },
      { key: 'atur_halaman', label: 'Mode Maintenance', icon: 'bi-cone-striped' },
    ],
    []
  )

  const allowedTabs = tabs;

  if (!user) return <PageLoader minHeight="50vh" variant="buble" />

  if (!isAdmin) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--n-muted)' }}>
        <i className="bi bi-shield-lock" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}></i>
        Halaman ini hanya untuk Admin. Pengelolaan akun, role, dan hak akses tidak bisa
        didelegasikan lewat pengaturan mana pun.
      </div>
    )
  }

  return (
    <>
      <div className="us-page">
        {/* Header */}
        

        {/* Tabs — Premium Pill Tabs */}
        <Tab
          tabs={allowedTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel="User settings tabs"
          variant="slider"
        />

        <div className="us-content" role="tabpanel">
          {activeTab === 'user_data' && <UserDataTab user={user} />}
          {activeTab === 'role_pages' && <RolePageAccessTab />}
          {activeTab === 'feature_access' && <FeatureAccessTab />}
          {activeTab === 'menu_layout' && <MenuLayoutTab />}
          {activeTab === 'role_permissions' && <RoleManagementTab />}
          {activeTab === 'atur_halaman' && <MaintenanceTab user={user} />}
        </div>

      </div>

      <style jsx>{`
        /* =====================================================
           USER SETTINGS PAGE — PREMIUM TAB DESIGN
        ===================================================== */

        /* HEADER */
        .us-header {
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

        .us-titleArea h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: white;
          margin: 0 0 4px 0;
          letter-spacing: -0.02em;
        }

        .us-titleArea p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.85rem;
          margin: 0;
          font-weight: 500;
        }


        .us-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Dark mode - Dark Navy & Electric Blue Standard */
        :global(.dark) .us-header {
          background: #0b1329 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
        }
        :global(.dark) .us-titleArea h1 {
          background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          display: inline-block !important;
        }
        :global(.dark) .us-titleArea p { color: #94a3b8 !important; }

        :global(.dark) .us-titleArea h1 { color: #e2e8f0 !important; }
        :global(.dark) .us-titleArea p { color: rgba(255, 255, 255, 0.8) !important; }


        /* CONTENT AREA */
        .us-content {
          padding: 0;
          min-height: 500px;
          background: transparent;
        }

        /* MOBILE RESPONSIVE */
        @media (max-width: 768px) {
          .us-header { padding: 16px 16px 20px; border-radius: 16px; }
          .us-titleArea h1 { font-size: 1.5rem; }
          .us-content { padding: 0; }
        }
      `}</style>
    </>
  )
}

