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

/**
 * BANK DATA — pusat ekspor data ACCA.
 *
 * Isinya tiga subjek dan hanya tiga: Siswa, Guru, Tendik. Karena daftarnya
 * sependek itu, halaman ini SENGAJA tidak punya kolom cari maupun filter
 * kelompok — mencari di antara tiga kartu yang seluruhnya terlihat sekaligus
 * hanya menambah satu baris kontrol yang tidak pernah dipakai.
 *
 * Siapa yang boleh membuka halaman ini diatur lewat Akses per Role
 * (role_pages), dan itu SEKALIGUS izin mengunduh — tidak ada kapabilitas ekspor
 * maupun penunjukan petugas lagi. Halaman tetap tidak boleh menganggap dirinya
 * gerbang: katalog datang dari server sudah tersaring, dan /api/bank-data
 * memeriksa ulang akses halaman di setiap permintaan.
 */
export default function BankDataView() {
  // `siap`, bukan `loading` — hook ini tidak pernah punya `loading`. Selama
  // salah nama, nilainya undefined: keadaan "izin belum diketahui" tidak pernah
  // terpasang dan halaman sempat memperlihatkan "Anda belum diberi izin" ke
  // orang yang sebenarnya berhak.
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
  // Tab yang tidak berhak tidak cukup disembunyikan — `?tab=pengaturan` di URL
  // harus ikut ditolak, bukan cuma tombolnya yang hilang.
  const tabAktif = (tabDiizinkan as readonly string[]).includes(activeTab) ? activeTab : 'ekspor';
  useEffect(() => {
    if (capsSiap && activeTab !== tabAktif) setActiveTab(tabAktif as any);
  }, [capsSiap, activeTab, tabAktif, setActiveTab]);

  const muatKatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bank-data?action=catalog');
      // 403 = rolenya tidak diberi akses halaman ini. Bukan kegagalan sistem,
      // jadi ditampilkan sebagai keadaan halaman, bukan dialog error.
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
      

      <Tab
        tabs={tabs}
        activeTab={tabAktif as any}
        onChange={(key) => setActiveTab(key as any)}
        ariaLabel="Navigasi Bank Data"
        variant="slider"
      />

      {tabAktif === 'pengaturan' ? (
        <PengaturanTab onTersimpan={muatKatalog} />
      ) : tabAktif === 'riwayat' ? (
        <RiwayatTab />
      ) : loading || !capsSiap ? (
        <div className="bd-loading">
          <Spinner variant="trace" label="Memuat katalog dataset..." />
        </div>
      ) : ditolak ? (
        <div className="bd-empty">
          <i className="bi bi-shield-lock" />
          <h3>Role Anda tidak diberi akses Bank Data</h3>
          <p>Hubungi admin untuk menambahkan halaman ini di Akses per Role.</p>
        </div>
      ) : katalog.length === 0 ? (
        <div className="bd-empty">
          <i className="bi bi-inbox" />
          <h3>Belum ada data yang tersedia</h3>
          <p>Admin menyalakan Siswa, Guru, atau Tendik di tab Pengaturan lalu mencentang kolom yang boleh keluar.</p>
        </div>
      ) : (
        <div className="bd-grid">
          {katalog.map(d => {
            const pendukung = d.kolom.filter(k => k.pendukung);
            return (
              <article key={d.id} className="bd-card">
                <div className="bd-card__head">
                  <i className={`bi ${d.ikon} bd-card__ikon`} />
                  <h4>{d.label}</h4>
                </div>
                <p className="bd-card__desc">{d.deskripsi}</p>
                <div className="bd-card__meta">
                  <span><i className="bi bi-layout-three-columns" /> {d.kolom.length} kolom</span>
                  {pendukung.length > 0 && (
                    <span><i className="bi bi-diagram-2" /> {pendukung.map(k => k.label).join(', ')}</span>
                  )}
                  {d.kolom.some(k => k.sensitif) && (
                    <span className="bd-card__sensitif"><i className="bi bi-eye-slash" /> memuat kolom sensitif</span>
                  )}
                </div>
                <button className="bd-card__btn" onClick={() => setDatasetAktif(d)}>
                  <i className="bi bi-download" /> Ekspor
                </button>
              </article>
            );
          })}
        </div>
      )}

      {datasetAktif && (
        <ExportModal dataset={datasetAktif} onClose={() => setDatasetAktif(null)} />
      )}
    </div>
  );
}
