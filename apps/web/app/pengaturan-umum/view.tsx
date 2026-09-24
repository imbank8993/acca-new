'use client'
import { useTabParam } from '@/hooks/useTabParam';
import MaintenanceBanner from '@/components/MaintenanceBanner'
import { Tab, type TabItem } from '@/components/ui/Tab'
import ProfilSekolahTab from './tabs/ProfilSekolahTab'
import WhatsAppTab from '@/app/pengaturan-umum/tabs/WhatsAppTab'
import TimezoneTab from '@/app/pengaturan-umum/tabs/TimezoneTab'
import TemplateSuratTab from '@/app/pengaturan-umum/tabs/TemplateSuratTab'
import FiturAccaTab from '@/app/pengaturan-umum/tabs/FiturAccaTab'

type TabType = 'profil_sekolah' | 'whatsapp' | 'timezone' | 'surat' | 'fitur_acca'

const tabs: TabItem<TabType>[] = [
  { key: 'profil_sekolah', label: 'Profil', icon: 'Building2' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { key: 'timezone', label: 'Zona Waktu', icon: 'Clock' },
  { key: 'surat', label: 'Surat', icon: 'FileText' },
  { key: 'fitur_acca', label: 'Fitur ACCA', icon: 'Sparkles' },
]

export default function PengaturanUmumPage({ user }: { user?: any }) {
  const [activeTab, setActiveTab] = useTabParam<TabType>('profil_sekolah', ['profil_sekolah', 'whatsapp', 'timezone', 'surat', 'fitur_acca'])

  return (
    <MaintenanceBanner pageKey="maintenance_pengaturan_umum">
      <div className="ds-page">
        {/* Header Banner */}
        

        {/* Tabs — Premium Pill Tabs */}
        <Tab
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel="Pengaturan Umum Tabs"
          variant="slider"
        />

        <div className="ds-content" role="tabpanel">
          {activeTab === 'profil_sekolah' && <ProfilSekolahTab />}
          {activeTab === 'whatsapp' && <WhatsAppTab user={user} />}
          {activeTab === 'timezone' && <TimezoneTab user={user} />}
          {activeTab === 'surat' && <TemplateSuratTab user={user} />}
          {activeTab === 'fitur_acca' && <FiturAccaTab />}
        </div>
      </div>

      <style jsx>{`
        /* =====================================================
           PENGATURAN UMUM PAGE — UNIFIED PREMIUM TAB DESIGN
        ===================================================== */

        .ds-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-bottom: 20px;
        }

        .ds-content {
          padding: 0;
          min-height: 200px;
          background: transparent;
        }

        /* MOBILE RESPONSIVE */
        @media (max-width: 768px) {
          .ds-page { gap: 12px; }
          .ds-content { padding: 0; }
        }
      `}</style>
    </MaintenanceBanner>
  )
}
