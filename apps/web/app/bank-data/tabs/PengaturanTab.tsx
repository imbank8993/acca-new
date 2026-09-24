'use client';

import { useCallback, useEffect, useState } from 'react';
import Select, { type MultiValue } from 'react-select';
import Swal from 'sweetalert2';
import { capabilitiesByPage } from '@/lib/capabilities';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { DatasetKonfig } from '../types';

/**
 * Tab Pengaturan Bank Data — dua keputusan yang sengaja dipisah:
 *
 *  1. DATA      — apa yang boleh keluar sama sekali: subjek nyala/mati, kolom
 *                 mana yang ikut, batas baris.
 *  2. IZIN      — siapa yang boleh menarik kolom sensitif, dan siapa yang boleh
 *                 mengatur halaman ini.
 *
 * SIAPA YANG BOLEH MENGUNDUH tidak diatur di sini sama sekali — itu Akses per
 * Role atas halaman `bank-data`. Penunjukan petugas per subjek sudah dihapus
 * (2026-09-08): ia menjadi lapisan "siapa orangnya" yang kedua di atas
 * keputusan yang sudah diambil di Akses per Role.
 *
 * Bagian 2 menulis ke `user_capabilities` lewat /api/admin/capabilities —
 * tabel yang sama yang dibaca gerbang server, sama seperti tab Pengaturan
 * di halaman Klinik.
 */

interface UserItem { id: number; nama?: string; username?: string; role?: string }
interface Opsi { value: string; label: string }

const FUNGSI_BANK_DATA = capabilitiesByPage()['bank-data'] || [];

export default function PengaturanTab({ onTersimpan }: { onTersimpan?: () => void }) {
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
      const [resKonfig, resUser] = await Promise.all([
        fetch('/api/bank-data/config'),
        fetch('/api/admin/users'),
      ]);
      const jsonKonfig = await resKonfig.json();
      if (!jsonKonfig.ok) throw new Error(jsonKonfig.error || 'Gagal memuat pengaturan dataset');
      setDatasets(jsonKonfig.data || []);

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
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Pengaturan tidak dapat dimuat', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const petugasBerubah = awalPetugas !== '' && JSON.stringify(petugas) !== awalPetugas;

  /** Ubah satu dataset di state lokal (belum tersimpan). */
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
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: d.label, timer: 1400, showConfirmButton: false });
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
      Swal.fire({ icon: 'success', title: 'Tersimpan', timer: 1400, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Penunjukan petugas tidak tersimpan', 'error');
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
          {k.sensitif && <i className="bi bi-eye-slash bd-kolom__sensitif" title="Kolom sensitif" />}
        </label>
      ))}
    </div>
  );

  if (loading) {
    return <div className="bd-loading"><Spinner variant="trace" label="Memuat pengaturan..." /></div>;
  }

  return (
    <div className="bd-panel">
      {/* ── 1. Dataset ─────────────────────────────────────────────── */}
      <div className="bd-panel__head">
        <div>
          <h3>Data yang Boleh Diekspor</h3>
          <p>
            Subjek yang mati tidak bisa diunduh siapa pun, termasuk admin. Kolom yang tidak
            dicentang tidak akan pernah ikut ke file.
          </p>
        </div>
      </div>

      <section className="bd-konfig-list">
          {datasets.map(d => {
            const buka = terbuka === d.id;
            const kolomInduk = d.kolom.filter(k => !k.pendukung);
            const kolomPendukung = d.kolom.filter(k => k.pendukung);
            return (
              <div key={d.id} className={`bd-konfig ${d.aktif ? 'bd-konfig--on' : ''}`}>
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
                    <code>{d.table}</code>
                    <span>{d.kolomDiizinkan.length}/{d.kolom.length} kolom</span>
                  </div>
                  <button type="button" className="bd-link" onClick={() => setTerbuka(buka ? null : d.id)}>
                    {buka ? 'Tutup' : 'Atur'} <i className={`bi bi-chevron-${buka ? 'up' : 'down'}`} />
                  </button>
                </div>

                {buka && (
                  <div className="bd-konfig__isi">
                    <p className="bd-hint">{d.deskripsi}</p>

                    <div className="bd-sec__bar">
                      <h5 className="bd-sec__title">Kolom yang boleh keluar</h5>
                      <div className="bd-sec__act">
                        <button type="button" className="bd-link"
                          onClick={() => ubah(d.id, { kolomDiizinkan: d.kolom.map(k => k.key) })}>
                          Pilih semua
                        </button>
                        <button type="button" className="bd-link"
                          onClick={() => ubah(d.id, { kolomDiizinkan: d.kolom.filter(k => !k.sensitif).map(k => k.key) })}>
                          Kecuali sensitif
                        </button>
                        <button type="button" className="bd-link"
                          onClick={() => ubah(d.id, { kolomDiizinkan: [] })}>
                          Kosongkan
                        </button>
                      </div>
                    </div>

                    {daftarKolom(d, kolomInduk)}

                    {kolomPendukung.length > 0 && (
                      <>
                        <h5 className="bd-sec__sub">
                          Data pendukung
                          <span className="bd-hint"> — dirangkum dari tabel lain, mengikuti tahun ajaran yang dipilih pengekspor</span>
                        </h5>
                        {daftarKolom(d, kolomPendukung)}
                      </>
                    )}

                    <div className="bd-filters">
                      <label className="bd-field">
                        <span>Batas baris (maks {d.batasBarisKatalog.toLocaleString('id-ID')})</span>
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
                        <span>Catatan untuk pengekspor</span>
                        <input
                          type="text"
                          value={d.catatan}
                          onChange={e => ubah(d.id, { catatan: e.target.value })}
                          placeholder="opsional"
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

      {/* ── 2. Izin tambahan (kapabilitas) ─────────────────────────── */}
      <div className="bd-panel__head" style={{ marginTop: 28 }}>
        <div>
          <h3>Izin Tambahan</h3>
          <p>
            Mengunduh sendiri TIDAK diatur di sini: siapa pun yang rolenya diberi akses
            halaman Bank Data sudah bisa mengunduh. Yang di bawah ini hanya dua hal yang
            perlu ditunjuk per orang.
          </p>
        </div>
        <Button variant="primary" icon="save" disabled={!petugasBerubah} isLoading={menyimpanKap} onClick={simpanPetugas}>
          Simpan Izin
        </Button>
      </div>

      {FUNGSI_BANK_DATA.map(f => (
        <div key={f.key} className="bd-field">
          <span>{f.label}</span>
          {f.description && <span className="bd-hint">{f.description}</span>}
          <Select
            isMulti
            options={opsiUser}
            value={opsiUser.filter(o => (petugas[f.key] || []).includes(Number(o.value)))}
            onChange={(v: MultiValue<Opsi>) =>
              setPetugas(p => ({ ...p, [f.key]: (v || []).map(o => Number(o.value)) }))}
            placeholder="Pilih pengguna..."
            noOptionsMessage={() => 'Tidak ada pengguna'}
            classNamePrefix="bd-select"
          />
        </div>
      ))}
    </div>
  );
}
