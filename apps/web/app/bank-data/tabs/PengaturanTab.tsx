'use client';

import { useCallback, useEffect, useState } from 'react';
import { InlineSelect } from '@/components/ui/InlineSelect';
import Swal from 'sweetalert2';
import { capabilitiesByPage } from '@/lib/capabilities';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useCapabilities } from '@/hooks/use-capabilities';
import type { DatasetKonfig } from '../types';

interface UserItem { id: number; nama?: string; username?: string; role?: string }
interface Opsi { value: string; label: string }

const FUNGSI_BANK_DATA = (capabilitiesByPage()['bank-data'] || []).filter(
  f => f.key !== 'bank_data.kelola'
);

export default function PengaturanTab({ onTersimpan }: { onTersimpan?: () => void }) {
  const { isAdmin } = useCapabilities();
  const [datasets, setDatasets] = useState<DatasetKonfig[]>([]);
  const [opsiUser, setOpsiUser] = useState<Opsi[]>([]);
  const [petugas, setPetugas] = useState<Record<string, number[]>>({});
  const [awalPetugas, setAwalPetugas] = useState('');
  const [loading, setLoading] = useState(true);
  const [menyimpanKap, setMenyimpanKap] = useState(false);
  const [menyimpanDataset, setMenyimpanDataset] = useState<string | null>(null);
  const [terbuka, setTerbuka] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const resKonfig = await fetch('/api/bank-data/config');
      const jsonKonfig = await resKonfig.json();
      if (!jsonKonfig.ok) throw new Error(jsonKonfig.error || 'Gagal memuat pengaturan dataset');
      setDatasets(jsonKonfig.data || []);

      if (isAdmin) {
        try {
          const resUser = await fetch('/api/admin/users');
          const jsonUser = await resUser.json();
          const list: UserItem[] = jsonUser?.ok ? (jsonUser.data || []) : [];
          setOpsiUser(list.filter(u => !!u.id).map(u => ({
            value: String(u.id),
            label: `${u.nama || u.username || `#${u.id}`}${u.role ? ` — ${u.role}` : ''}`,
          })));

          const hasil: Record<string, number[]> = {};
          for (const f of FUNGSI_BANK_DATA) {
            const res = await fetch(`/api/admin/capabilities?capability=${encodeURIComponent(f.key)}`);
            const json = await res.json();
            hasil[f.key] = json?.ok ? (json.grants || []).map((g: any) => Number(g.user_id)) : [];
          }
          setPetugas(hasil);
          setAwalPetugas(JSON.stringify(hasil));
        } catch {
          // Abaikan jika tidak diizinkan
        }
      }
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Pengaturan tidak dapat dimuat', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { muat(); }, [muat]);

  const petugasBerubah = awalPetugas !== '' && JSON.stringify(petugas) !== awalPetugas;

  const ubah = (id: string, patch: Partial<DatasetKonfig>) => {
    setDatasets(ds => ds.map(d => (d.id === id ? { ...d, ...patch } : d)));
  };

  async function simpanDataset(d: DatasetKonfig) {
    setMenyimpanDataset(d.id);
    try {
      const res = await fetch('/api/bank-data/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: d.id,
          aktif: d.aktif,
          kolomDiizinkan: d.kolomDiizinkan,
          batasBaris: d.batasBaris,
          catatan: d.catatan,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal menyimpan');
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: d.label, timer: 1200, showConfirmButton: false });
      onTersimpan?.();
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Pengaturan dataset tidak tersimpan', 'error');
    } finally {
      setMenyimpanDataset(null);
    }
  }

  async function simpanPetugas() {
    setMenyimpanKap(true);
    try {
      for (const f of FUNGSI_BANK_DATA) {
        const res = await fetch('/api/admin/capabilities', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capability: f.key, userIds: petugas[f.key] || [], mode: 'grant' }),
        });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Gagal menyimpan');
      }
      setAwalPetugas(JSON.stringify(petugas));
      Swal.fire({ icon: 'success', title: 'Tersimpan', timer: 1200, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Izin tidak tersimpan', 'error');
    } finally {
      setMenyimpanKap(false);
    }
  }

  const daftarKolom = (d: DatasetKonfig, list: DatasetKonfig['kolom']) => (
    <div className="bd-kolom">
      {list.map(k => (
        <label key={k.key} className="bd-kolom__item">
          <input
            type="checkbox"
            className="ui-checkbox"
            checked={d.kolomDiizinkan.includes(k.key)}
            onChange={() => ubah(d.id, {
              kolomDiizinkan: d.kolomDiizinkan.includes(k.key)
                ? d.kolomDiizinkan.filter(x => x !== k.key)
                : [...d.kolomDiizinkan, k.key],
            })}
          />
          <span>{k.label}</span>
        </label>
      ))}
    </div>
  );

  if (loading) {
    return <div className="bd-loading"><Spinner variant="buble" label="Memuat pengaturan..." /></div>;
  }

  return (
    <div className="bd-panel">
      <div className="bd-panel__head">
        <h3 className="bd-panel__title">Pengaturan Dataset</h3>
      </div>

      <section className="bd-konfig-list">
        {datasets.map(d => {
          const buka = terbuka === d.id;
          const kolomInduk = d.kolom.filter(k => !k.pendukung);
          const kolomPendukung = d.kolom.filter(k => k.pendukung);
          return (
            <div key={d.id} className="bd-konfig">
              <div className="bd-konfig__bar">
                <label className="bd-switch">
                  <input
                    type="checkbox"
                    className="ui-checkbox"
                    checked={d.aktif}
                    onChange={e => ubah(d.id, { aktif: e.target.checked })}
                  />
                  <span className="bd-konfig__label">{d.label}</span>
                </label>
                <div className="bd-konfig__meta">
                  <span className="bd-konfig__count">{d.kolomDiizinkan.length}/{d.kolom.length} Kolom</span>
                  <button type="button" className="bd-btn-subtle" onClick={() => setTerbuka(buka ? null : d.id)}>
                    {buka ? 'Tutup' : 'Ubah'}
                  </button>
                </div>
              </div>

              {buka && (
                <div className="bd-konfig__isi">
                  <div className="bd-sec__bar">
                    <span className="bd-sec__title">Kolom Diizinkan</span>
                    <div className="bd-sec__act">
                      <button type="button" className="bd-link"
                        onClick={() => ubah(d.id, { kolomDiizinkan: d.kolom.map(k => k.key) })}>
                        Semua
                      </button>
                      <span className="bd-sep">·</span>
                      <button type="button" className="bd-link"
                        onClick={() => ubah(d.id, { kolomDiizinkan: d.kolom.filter(k => !k.sensitif).map(k => k.key) })}>
                        Kecuali Sensitif
                      </button>
                      <span className="bd-sep">·</span>
                      <button type="button" className="bd-link"
                        onClick={() => ubah(d.id, { kolomDiizinkan: [] })}>
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  {daftarKolom(d, kolomInduk)}

                  {kolomPendukung.length > 0 && (
                    <>
                      <span className="bd-sec__sub">Data Tambahan</span>
                      {daftarKolom(d, kolomPendukung)}
                    </>
                  )}

                  <div className="bd-filters" style={{ marginTop: 8 }}>
                    <label className="bd-field">
                      <span>Batas Baris</span>
                      <input
                        type="number"
                        min={1}
                        max={d.batasBarisKatalog}
                        placeholder={String(d.batasBarisKatalog)}
                        value={d.batasBaris ?? ''}
                        onChange={e => ubah(d.id, { batasBaris: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </label>
                    <label className="bd-field bd-field--grow">
                      <span>Catatan Pengekspor</span>
                      <input
                        type="text"
                        value={d.catatan}
                        onChange={e => ubah(d.id, { catatan: e.target.value })}
                        placeholder="Opsional"
                      />
                    </label>
                  </div>

                  <div className="bd-konfig__aksi">
                    <Button
                      variant="primary"
                      icon="save"
                      isLoading={menyimpanDataset === d.id}
                      onClick={() => simpanDataset(d)}
                    >
                      Simpan
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {isAdmin && (
        <>
          <div className="bd-panel__head" style={{ marginTop: 16 }}>
            <h3 className="bd-panel__title">Izin Tambahan</h3>
            <Button variant="primary" icon="save" disabled={!petugasBerubah} isLoading={menyimpanKap} onClick={simpanPetugas}>
              Simpan Izin
            </Button>
          </div>

          <div className="bd-caps-grid">
            {FUNGSI_BANK_DATA.map(f => (
              <div key={f.key} className="bd-field">
                <span>{f.label}</span>
                <InlineSelect
                  value={String(petugas[f.key]?.[0] || '')}
                  onChange={(val) =>
                    setPetugas(p => ({
                      ...p,
                      [f.key]: val ? [Number(val)] : [],
                    }))
                  }
                  options={[
                    { value: '', label: 'Pilih pengguna...' },
                    ...opsiUser,
                  ]}
                  style={{ width: '100%' }}
                  minWidth="100%"
                  height="38px"
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
