'use client';

import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { getAllAcademicYears } from '@/lib/settings-client';
import type { DatasetKatalog } from '../types';

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

function formatTampilanNilai(val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Ya' : 'Tidak';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}(T|\b)/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
      return d.toLocaleDateString('id-ID', hasTime 
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } 
        : { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  return String(val);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterPayload = useMemo(() => ({
    tahun_ajaran: tahunAjaran || undefined,
    semester: semester || undefined,
    kelas: kelas.length > 0 ? kelas : undefined,
  }), [tahunAjaran, semester, kelas]);

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
      Swal.fire('Pilih Kolom', 'Centang minimal satu kolom untuk diekspor.', 'info');
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
      Swal.fire('Pilih Kolom', 'Centang minimal satu kolom untuk diekspor.', 'info');
      return;
    }
    setMengunduh(true);
    try {
      const res = await kirim('export');

      if (!res.ok) {
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
        </label>
      ))}
    </div>
  );

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={`Ekspor ${dataset.label}`}
      icon="download"
      className="bd-modal"
    >
      <ModalBody>
        {/* ── Filter ─────────────────────────────────────────────── */}
        {dataset.filter.length > 0 && (
          <section className="bd-sec">
            <span className="bd-sec__title">Filter</span>
            <div className="bd-filters">
              {punya('tahun_ajaran') && (
                <div className="bd-field">
                  <span>Tahun Ajaran</span>
                  <InlineSelect
                    value={tahunAjaran}
                    onChange={setTahunAjaran}
                    options={[
                      { value: '', label: 'Semua Tahun Ajaran' },
                      ...opsiTA.map(t => ({ value: t, label: t })),
                    ]}
                    style={{ width: '100%' }}
                    minWidth="100%"
                    height="36px"
                  />
                </div>
              )}
              {punya('semester') && (
                <div className="bd-field">
                  <span>Semester</span>
                  <InlineSelect
                    value={semester}
                    onChange={setSemester}
                    options={[
                      { value: '', label: 'Semua Semester' },
                      { value: 'Ganjil', label: 'Ganjil' },
                      { value: 'Genap', label: 'Genap' },
                    ]}
                    style={{ width: '100%' }}
                    minWidth="100%"
                    height="36px"
                  />
                </div>
              )}
              {punya('kelas') && (
                <div className="bd-field">
                  <span>Kelas</span>
                  <InlineSelect
                    value={kelas[0] || ''}
                    onChange={val => setKelas(val ? [val] : [])}
                    options={[
                      { value: '', label: 'Semua Kelas' },
                      ...opsiKelas.map(k => ({ value: k, label: k })),
                    ]}
                    style={{ width: '100%' }}
                    minWidth="100%"
                    height="36px"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Kolom ──────────────────────────────────────────────── */}
        <section className="bd-sec">
          <div className="bd-sec__bar">
            <span className="bd-sec__title">Kolom</span>
            <div className="bd-sec__act">
              <button type="button" className="bd-link" onClick={() => setDipilih(dataset.kolom.map(k => k.key))}>Semua</button>
              <span className="bd-sep">·</span>
              <button type="button" className="bd-link" onClick={() => setDipilih([])}>Kosongkan</button>
            </div>
          </div>
          {daftarKolom(kolomInduk)}

          {kolomPendukung.length > 0 && (
            <>
              <span className="bd-sec__sub">Data Tambahan</span>
              {daftarKolom(kolomPendukung)}
            </>
          )}
        </section>

        {/* ── Pratinjau ──────────────────────────────────────────── */}
        {memuatPratinjau ? (
          <div className="bd-loading"><Spinner variant="buble" label="Memuat pratinjau..." /></div>
        ) : pratinjau && (
          <section className="bd-sec">
            <div className="bd-sec__bar">
              <span className="bd-sec__title">Pratinjau ({pratinjau.total.toLocaleString('id-ID')} baris)</span>
            </div>
            {pratinjau.terpotong && (
              <div className="bd-alert-notice">
                Maksimal {pratinjau.batas.toLocaleString('id-ID')} baris pertama yang dapat diunduh.
              </div>
            )}
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
                          {formatTampilanNilai(r[k.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {pratinjau.data.length === 0 && (
                    <tr><td colSpan={pratinjau.kolom.length} className="bd-table__kosong">Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="cancel" onClick={onClose}>Batal</Button>
        <Button variant="secondary" onClick={jalankanPratinjau} isLoading={memuatPratinjau} icon="preview">
          Pratinjau
        </Button>
        <Button variant="primary" onClick={unduh} isLoading={mengunduh} icon="download">
          Unduh Excel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
