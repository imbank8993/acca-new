'use client';

import { useCallback, useEffect, useState } from 'react';
import Tab, { TabItem } from '@/components/ui/Tab';
import { Spinner } from '@/components/ui/Spinner';
import { useTabParam } from '@/hooks/useTabParam';
import { useCapabilities } from '@/hooks/use-capabilities';
import Swal from 'sweetalert2';

import ExportModal from './components/ExportModal';
import RiwayatTab from './tabs/RiwayatTab';
import PengaturanTab from './tabs/PengaturanTab';
import type { DatasetKatalog } from './types';
import './bank-data.css';

export default function BankDataView() {
  const { can, siap: capsSiap } = useCapabilities();
  const bolehKelola = can('bank_data.kelola');

  const [katalog, setKatalog] = useState<DatasetKatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [ditolak, setDitolak] = useState(false);
  const [datasetAktif, setDatasetAktif] = useState<DatasetKatalog | null>(null);

  const tabDiizinkan = [
    'ekspor',
    ...(bolehKelola ? ['riwayat', 'pengaturan'] : []),
  ] as const;

  const [activeTab, setActiveTab] = useTabParam<'ekspor' | 'riwayat' | 'pengaturan'>(
    'ekspor', ['ekspor', 'riwayat', 'pengaturan']
  );

  const tabAktif = (tabDiizinkan as readonly string[]).includes(activeTab) ? activeTab : 'ekspor';
  useEffect(() => {
    if (capsSiap && activeTab !== tabAktif) setActiveTab(tabAktif as any);
  }, [capsSiap, activeTab, tabAktif, setActiveTab]);

  const muatKatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bank-data?action=catalog');
      if (res.status === 403) { setDitolak(true); setKatalog([]); return; }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal memuat katalog');
      setDitolak(false);
      setKatalog(json.data || []);
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Daftar data tidak dapat dimuat', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muatKatalog(); }, [muatKatalog]);

  const tabs: TabItem<'ekspor' | 'riwayat' | 'pengaturan'>[] = [
    { key: 'ekspor', label: 'Ekspor Data', icon: 'download' },
    ...(bolehKelola ? [
      { key: 'riwayat' as const, label: 'Riwayat', icon: 'clock-history' },
      { key: 'pengaturan' as const, label: 'Pengaturan', icon: 'gear' },
    ] : []),
  ];

  return (
    <div className="bd-container">
      {tabs.length > 1 && (
        <Tab
          tabs={tabs}
          activeTab={tabAktif as any}
          onChange={(key) => setActiveTab(key as any)}
          ariaLabel="Navigasi Bank Data"
          variant="slider"
        />
      )}

      {tabAktif === 'pengaturan' ? (
        <PengaturanTab onTersimpan={muatKatalog} />
      ) : tabAktif === 'riwayat' ? (
        <RiwayatTab />
      ) : loading || !capsSiap ? (
        <div className="bd-loading">
          <Spinner variant="trace" label="Memuat katalog..." />
        </div>
      ) : ditolak ? (
        <div className="bd-empty">
          <i className="bi bi-shield-lock" />
          <h3>Akses Terbatas</h3>
        </div>
      ) : katalog.length === 0 ? (
        <div className="bd-empty">
          <i className="bi bi-inbox" />
          <h3>Belum ada data tersedia</h3>
        </div>
      ) : (
        <div className="bd-grid">
          {katalog.map(d => (
            <button
              key={d.id}
              type="button"
              className="bd-card"
              onClick={() => setDatasetAktif(d)}
            >
              <div className="bd-card__icon">
                <i className={`bi ${d.ikon}`} />
              </div>
              <span className="bd-card__name">{d.label}</span>
            </button>
          ))}
        </div>
      )}

      {datasetAktif && (
        <ExportModal dataset={datasetAktif} onClose={() => setDatasetAktif(null)} />
      )}
    </div>
  );
}
