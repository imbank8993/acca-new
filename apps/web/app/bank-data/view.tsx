'use client';

import { useCallback, useEffect, useState } from 'react';
import Tab, { TabItem } from '@/components/ui/Tab';
import { Spinner } from '@/components/ui/Spinner';
import { useTabParam } from '@/hooks/useTabParam';
import { useCapabilities } from '@/hooks/use-capabilities';

import DataTab from './tabs/DataTab';
import RiwayatTab from './tabs/RiwayatTab';
import PengaturanTab from './tabs/PengaturanTab';
import type { DatasetKatalog } from './types';
import './bank-data.css';

export default function BankDataView() {
  const { can, siap: capsSiap } = useCapabilities();
  const [izinKelola, setIzinKelola] = useState<boolean | null>(null);
  const bolehKelola = izinKelola ?? can('bank_data.kelola');

  const [katalog, setKatalog] = useState<DatasetKatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [ditolak, setDitolak] = useState(false);
  const [errorKatalog, setErrorKatalog] = useState('');

  const tabDiizinkan = [
    'ekspor',
    ...(bolehKelola ? ['riwayat', 'pengaturan'] : []),
  ] as const;

  const [activeTab, setActiveTab] = useTabParam<'ekspor' | 'riwayat' | 'pengaturan'>(
    'ekspor', ['ekspor', 'riwayat', 'pengaturan']
  );

  const tabAktif = (tabDiizinkan as readonly string[]).includes(activeTab) ? activeTab : 'ekspor';
  useEffect(() => {
    if (capsSiap && activeTab !== tabAktif) setActiveTab(tabAktif);
  }, [capsSiap, activeTab, tabAktif, setActiveTab]);

  const muatKatalog = useCallback(async () => {
    setLoading(true);
    setErrorKatalog('');
    try {
      const res = await fetch('/api/bank-data?action=catalog');
      if (res.status === 403 || res.status === 401) { setDitolak(true); setIzinKelola(false); setKatalog([]); return; }
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || json.message || 'Gagal memuat katalog');
      setDitolak(false);
      setIzinKelola(json.bolehKelola === true);
      setKatalog(json.data || []);
    } catch (e) {
      setKatalog([]);
      setErrorKatalog(e instanceof Error ? e.message : 'Daftar data tidak dapat dimuat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muatKatalog(); }, [muatKatalog]);

  const tabs: TabItem<'ekspor' | 'riwayat' | 'pengaturan'>[] = [
    { key: 'ekspor', label: 'Data', icon: 'table' },
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
          activeTab={tabAktif}
          onChange={setActiveTab}
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
      ) : errorKatalog ? (
        <div className="bd-empty" role="alert"><p>{errorKatalog}</p><button type="button" className="bd-btn-retry" onClick={muatKatalog}>Coba Lagi</button></div>
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
        <DataTab datasets={katalog} />
      )}
    </div>
  );
}
