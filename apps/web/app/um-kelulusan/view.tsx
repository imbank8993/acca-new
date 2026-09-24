'use client';

import { useStickyState } from '@/hooks/useStickyState';
import { useTabParam } from '@/hooks/useTabParam';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Tab, { TabItem } from '@/components/ui/Tab';
import { PageLoader } from '@/components/ui/Spinner';

import { useState, useEffect } from 'react';
import KelulusanTab from './tabs/KelulusanTab';
import NilaiUMTab from './tabs/NilaiUMTab';
import NilaiIjazahTab from './tabs/NilaiIjazahTab';
import PlottingMapelTab from './tabs/PlottingMapelTab';
import './um-kelulusan.css';

type MainTab = 'kelulusan' | 'nilai-um' | 'nilai-ijazah' | 'plotting-mapel';

function UMKelulusanPage() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useTabParam<MainTab>('kelulusan', [
    'kelulusan',
    'nilai-um',
    'nilai-ijazah',
    'plotting-mapel',
  ]);

  const [tahunAjaranList, setTahunAjaranList] = useState<string[]>([]);
  const [tahunAjaran, setTahunAjaran] = useState('');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { getAllActiveAcademicYears, getActiveSettings } = await import(
          '@/lib/settings-client'
        );
        const [activePeriods, active] = await Promise.all([
          getAllActiveAcademicYears(),
          getActiveSettings(),
        ]);
        const activeYears = Array.from(
          new Set(activePeriods.map((p) => p.tahun_ajaran))
        );
        const years =
          activeYears.length > 0
            ? activeYears
            : active
            ? [active.tahun_ajaran]
            : [];
        setTahunAjaranList(years);
        if (active) setTahunAjaran(active.tahun_ajaran);
        else if (years.length > 0) setTahunAjaran(years[0]);

        const meRes = await fetch('/api/auth/me');
        const meJson = await meRes.json();
        if (!meJson.ok || !meJson.user) return;
        const userData = meJson.user;
        if (!userData) return;
        setUser(userData);
        setIsAdmin(
          userData?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) || !!(userData as any).isAdmin ||
            false
        );
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) {
    return <PageLoader label="Memuat data UM & Kelulusan…" />;
  }

  if (!isAdmin) {
    return (
      <div className="uk-access-denied">
        <div className="uk-access-denied__icon">
          <i className="bi bi-shield-exclamation" />
        </div>
        <h2>Akses Ditolak</h2>
        <p>Halaman ini hanya untuk Administrator.</p>
      </div>
    );
  }

  const tabs: TabItem<MainTab>[] = [
    { key: 'kelulusan', label: 'Kelulusan', icon: 'bi-mortarboard' },
    { key: 'nilai-um', label: 'Ujian Madrasah', icon: 'bi-file-earmark-text' },
    { key: 'nilai-ijazah', label: 'Nilai Ijazah', icon: 'bi-award' },
    { key: 'plotting-mapel', label: 'Plotting Mapel', icon: 'bi-layers' },
  ];

  return (
    <div className="uk-wrapper">
      {/* ── Page Banner ──────────────────────────────────────────────── */}
      

      {/* ── 4 Tab Navigation ─────────────────────────────────────────── */}
      <Tab
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel="Navigasi UM & Kelulusan"
        variant="slider"
      />

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      <div className="uk-content">
        {activeTab === 'kelulusan' && (
          <KelulusanTab
            tahunAjaranList={tahunAjaranList}
            tahunAjaran={tahunAjaran}
            setTahunAjaran={setTahunAjaran}
          />
        )}
        {activeTab === 'nilai-um' && (
          <NilaiUMTab
            tahunAjaranList={tahunAjaranList}
            tahunAjaran={tahunAjaran}
            setTahunAjaran={setTahunAjaran}
          />
        )}
        {activeTab === 'nilai-ijazah' && (
          <NilaiIjazahTab
            tahunAjaranList={tahunAjaranList}
            tahunAjaran={tahunAjaran}
            setTahunAjaran={setTahunAjaran}
          />
        )}
        {activeTab === 'plotting-mapel' && (
          <PlottingMapelTab
            tahunAjaranList={tahunAjaranList}
            tahunAjaran={tahunAjaran}
            setTahunAjaran={setTahunAjaran}
          />
        )}
      </div>
    </div>
  );
}

// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedUMKelulusanPage(props: any) {
  return (
    <>
      <MaintenanceBanner pageKey="maintenance_um_kelulusan" />
      <UMKelulusanPage {...props} />
    </>
  );
}




