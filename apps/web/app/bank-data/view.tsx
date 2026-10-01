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
          <Spinner variant="buble" label="Memuat katalog data..." />
        </div>
      ) : ditolak ? (
        <div className="bd-empty bd-empty--denied">
          <div className="bd-empty__icon">
            <i className="bi bi-shield-lock-fill" />
          </div>
          <h3>Akses Bank Data Terbatas</h3>
          <p>
            Akun Anda belum memiliki izin untuk mengakses modul Bank Data. Hubungi Administrator untuk memberikan akses melalui menu <strong>Pengaturan Users &gt; Akses Halaman</strong>.
          </p>
          <button type="button" className="bd-btn-retry" onClick={muatKatalog}>
            <i className="bi bi-arrow-clockwise" /> Coba Lagi
          </button>
        </div>
      ) : katalog.length === 0 ? (
        <div className="bd-empty">
          <div className="bd-empty__icon">
            <i className="bi bi-inbox-fill" />
          </div>
          <h3>Belum ada dataset yang diaktifkan</h3>
          <p>
            {bolehKelola
              ? 'Silakan aktifkan dataset dan pilih kolom yang diizinkan melalui tab Pengaturan.'
              : 'Belum ada dataset yang dibuka oleh Administrator. Silakan hubungi pengelola.'}
          </p>
          {bolehKelola && (
            <button
              type="button"
              className="bd-btn-primary-subtle"
              onClick={() => setActiveTab('pengaturan')}
            >
              <i className="bi bi-gear-fill" /> Buka Pengaturan Dataset
            </button>
          )}
        </div>
      ) : (
        <div className="bd-grid">
          {katalog.map(d => (
            <div
              key={d.id}
              className="bd-card"
              onClick={() => setDatasetAktif(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDatasetAktif(d); }}
            >
              <div className="bd-card__top">
                <div className="bd-card__icon">
                  <i className={`bi ${d.ikon}`} />
                </div>
                <span className="bd-card__pill">
                  <i className="bi bi-table" /> {d.kolom.length} Kolom
                </span>
              </div>
              <div className="bd-card__body">
                <h3 className="bd-card__name">{d.label}</h3>
                <p className="bd-card__desc">{d.deskripsi}</p>
              </div>
              <div className="bd-card__footer">
                <div className="bd-card__filters">
                  {d.filter.includes('tahun_ajaran') && (
                    <span className="bd-filter-tag" title="Mendukung filter Tahun Ajaran">TA</span>
                  )}
                  {d.filter.includes('semester') && (
                    <span className="bd-filter-tag" title="Mendukung filter Semester">Sem</span>
                  )}
                  {d.filter.includes('kelas') && (
                    <span className="bd-filter-tag" title="Mendukung filter Kelas">Kelas</span>
                  )}
                </div>
                <button
                  type="button"
                  className="bd-card__btn"
                  onClick={(e) => { e.stopPropagation(); setDatasetAktif(d); }}
                >
                  <span>Ekspor</span>
                  <i className="bi bi-download" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {datasetAktif && (
        <ExportModal dataset={datasetAktif} onClose={() => setDatasetAktif(null)} />
      )}
    </div>
  );
}
