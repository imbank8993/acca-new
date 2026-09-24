'use client';

import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { getAllAcademicYears } from '@/lib/settings-client';
import type { DatasetKatalog } from '../types';

/**
 * Modal ekspor satu subjek: pilih tahun ajaran, pilih kolom, pratinjau, unduh.
 *
 * Kolom yang tampil di sini SUDAH disaring server (katalog × pengaturan admin ×
 * izin sensitif). Centangnya hanya mempersempit lagi — mengirim kolom yang tak
 * ada di daftar ini tetap ditolak /api/bank-data.
 */

interface Props {
  dataset: DatasetKatalog;
  onClose: () => void;
}

interface HasilPratinjau {
  total: number;
  batas: number;
  terpotong: boolean;
  kolom: { key: string; label: string }[];
  data: Record<string, any>[];
}

export default function ExportModal({ dataset, onClose }: Props) {
  const [dipilih, setDipilih] = useState<string[]>(() => dataset.kolom.map(k => k.key));
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [semester, setSemester] = useState('');
  const [kelas, setKelas] = useState<string[]>([]);

  const [opsiTA, setOpsiTA] = useState<string[]>([]);
  const [opsiKelas, setOpsiKelas] = useState<string[]>([]);
  const [pratinjau, setPratinjau] = useState<HasilPratinjau | null>(null);
  const [memuatPratinjau, setMemuatPratinjau] = useState(false);
  const [mengunduh, setMengunduh] = useState(false);

  const punya = (f: string) => dataset.filter.includes(f as any);

  const kolomInduk = useMemo(() => dataset.kolom.filter(k => !k.pendukung), [dataset]);
  const kolomPendukung = useMemo(() => dataset.kolom.filter(k => k.pendukung), [dataset]);

  useEffect(() => {
    if (punya('tahun_ajaran')) getAllAcademicYears().then(setOpsiTA).catch(() => setOpsiTA([]));
    if (punya('kelas')) {
      fetch('/api/master/kelas?limit=200')
        .then(r => r.json())
        .then(j => setOpsiKelas(j?.ok ? (j.data || []).map((k: any) => k.nama).filter(Boolean) : []))
        .catch(() => setOpsiKelas([]));
    }
    // Dataset tidak berubah selama modal terbuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterPayload = useMemo(() => ({
    tahun_ajaran: tahunAjaran || undefined,
    semester: semester || undefined,
    kelas: kelas.length > 0 ? kelas : undefined,
  }), [tahunAjaran, semester, kelas]);

  // Filter berubah ⇒ angka pratinjau lama tidak lagi menggambarkan apa yang
  // akan terunduh. Dibuang supaya tidak ada yang menekan Unduh berdasarkan
  // hitungan yang sudah basi.
  useEffect(() => { setPratinjau(null); }, [filterPayload, dipilih]);

  const toggleKolom = (key: string) => {
    setDipilih(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  };

  async function kirim(action: 'preview' | 'export') {
    return fetch('/api/bank-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, dataset_id: dataset.id, kolom: dipilih, filter: filterPayload }),
    });
  }

  async function jalankanPratinjau() {
    if (dipilih.length === 0) {
      Swal.fire('Pilih kolom', 'Centang minimal satu kolom untuk diekspor.', 'info');
      return;
    }
    setMemuatPratinjau(true);
    try {
      const res = await kirim('preview');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Pratinjau gagal');
      setPratinjau(json);
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Pratinjau tidak dapat dimuat', 'error');
    } finally {
      setMemuatPratinjau(false);
    }
  }

  async function unduh() {
    if (dipilih.length === 0) {
      Swal.fire('Pilih kolom', 'Centang minimal satu kolom untuk diekspor.', 'info');
      return;
    }
    setMengunduh(true);
    try {
      const res = await kirim('export');

      if (!res.ok) {
        // Route mengembalikan JSON saat gagal, file saat berhasil.
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Ekspor gagal (${res.status})`);
      }

      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const nama = /filename="([^"]+)"/.exec(cd)?.[1] || `${dataset.id}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nama;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      onClose();
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Ekspor tidak dapat diselesaikan', 'error');
    } finally {
      setMengunduh(false);
    }
  }

  const daftarKolom = (list: typeof dataset.kolom) => (
    <div className="bd-kolom">
      {list.map(k => (
        <label key={k.key} className="bd-kolom__item">
          <input
            type="checkbox"
            className="ui-checkbox"
            checked={dipilih.includes(k.key)}
            onChange={() => toggleKolom(k.key)}
          />
          <span>{k.label}</span>
          {k.sensitif && <i className="bi bi-eye-slash bd-kolom__sensitif" title="Kolom sensitif" />}
        </label>
      ))}
    </div>
  );

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={`Ekspor — ${dataset.label}`}
      subtitle={dataset.deskripsi}
      icon="download"
      className="bd-modal"
    >
      <ModalBody>
        {/* ── Filter ─────────────────────────────────────────────── */}
        {dataset.filter.length > 0 && (
          <section className="bd-sec">
            <h4 className="bd-sec__title">Tahun Ajaran</h4>
            <div className="bd-filters">
              {punya('tahun_ajaran') && (
                <label className="bd-field">
                  <span>Tahun Ajaran</span>
                  <select value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)}>
                    <option value="">Semua</option>
                    {opsiTA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              )}
              {punya('semester') && (
                <label className="bd-field">
                  <span>Semester</span>
                  <select value={semester} onChange={e => setSemester(e.target.value)}>
                    <option value="">Semua</option>
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </label>
              )}
            </div>
            {kolomPendukung.length > 0 && (
              <p className="bd-hint">
                {punya('kelas')
                  ? 'Menentukan siapa yang ikut terdaftar sekaligus isi kolom pendukung. Kosongkan untuk mengambil seluruh tahun ajaran.'
                  : `Menentukan isi kolom pendukung (${kolomPendukung.map(k => k.label).join(', ')}). Daftar orangnya tetap utuh walau belum punya penugasan di tahun itu.`}
              </p>
            )}

            {punya('kelas') && (
              <div className="bd-kelas">
                <div className="bd-kelas__head">
                  <span>Kelas {kelas.length > 0 && <b>({kelas.length} dipilih)</b>}</span>
                  {kelas.length > 0 && (
                    <button type="button" className="bd-link" onClick={() => setKelas([])}>Kosongkan</button>
                  )}
                </div>
                <div className="bd-chips">
                  {opsiKelas.map(k => (
                    <button
                      key={k}
                      type="button"
                      className={`bd-chip ${kelas.includes(k) ? 'bd-chip--on' : ''}`}
                      onClick={() => setKelas(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])}
                    >
                      {k}
                    </button>
                  ))}
                  {opsiKelas.length === 0 && <span className="bd-hint">Daftar kelas tidak tersedia — kosongkan untuk mengambil semua.</span>}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Kolom ──────────────────────────────────────────────── */}
        <section className="bd-sec">
          <div className="bd-sec__bar">
            <h4 className="bd-sec__title">Kolom ({dipilih.length}/{dataset.kolom.length})</h4>
            <div className="bd-sec__act">
              <button type="button" className="bd-link" onClick={() => setDipilih(dataset.kolom.map(k => k.key))}>Pilih semua</button>
              <button type="button" className="bd-link" onClick={() => setDipilih([])}>Kosongkan</button>
            </div>
          </div>
          {daftarKolom(kolomInduk)}

          {kolomPendukung.length > 0 && (
            <>
              <h5 className="bd-sec__sub">Data pendukung</h5>
              {daftarKolom(kolomPendukung)}
            </>
          )}
        </section>

        {/* ── Pratinjau ──────────────────────────────────────────── */}
        {memuatPratinjau ? (
          <div className="bd-loading"><Spinner variant="trace" label="Menghitung baris..." /></div>
        ) : pratinjau && (
          <section className="bd-sec">
            <h4 className="bd-sec__title">Pratinjau</h4>
            <p className="bd-summary">
              <b>{pratinjau.total.toLocaleString('id-ID')}</b> baris cocok dengan filter ini.
              {pratinjau.terpotong && (
                <span className="bd-warn">
                  {' '}Hanya {pratinjau.batas.toLocaleString('id-ID')} baris pertama yang akan terunduh — persempit filternya.
                </span>
              )}
            </p>
            <div className="bd-tablewrap">
              <table className="bd-table">
                <thead>
                  <tr>{pratinjau.kolom.map(k => <th key={k.key}>{k.label}</th>)}</tr>
                </thead>
                <tbody>
                  {pratinjau.data.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      {pratinjau.kolom.map(k => (
                        <td key={k.key}>
                          {typeof r[k.key] === 'boolean' ? (r[k.key] ? 'Ya' : 'Tidak') : (r[k.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {pratinjau.data.length === 0 && (
                    <tr><td colSpan={pratinjau.kolom.length} className="bd-table__kosong">Tidak ada baris yang cocok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pratinjau.data.length > 10 && (
              <p className="bd-hint">Menampilkan 10 baris pertama sebagai contoh.</p>
            )}
          </section>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Tutup</Button>
        <Button variant="secondary" onClick={jalankanPratinjau} isLoading={memuatPratinjau} icon="eye">
          Pratinjau
        </Button>
        <Button variant="primary" onClick={unduh} isLoading={mengunduh} icon="download">
          Unduh Excel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
