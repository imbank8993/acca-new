'use client';

import { useEffect, useMemo, useState } from 'react';
import { FilterToolbar, FilterField, FilterSearch } from '@/components/ui/FilterToolbar';
import SearchableSelect from '@/components/ui/SearchableSelect';
import DesktopFab from '@/components/ui/DesktopFab';
import Pagination from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { getAllAcademicYears } from '@/lib/settings-client';
import type { DatasetKatalog } from '../types';

interface HasilData {
  total: number;
  totalTersedia: number;
  batas: number;
  terpotong: boolean;
  kolom: { key: string; label: string }[];
  data: Record<string, unknown>[];
}

function nilai(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
    const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

// Dataset selection is navigation, so toolbar reset/count applies only to filters.
function DatasetSelect({ dataset, datasets, onDataset }: { dataset: DatasetKatalog; datasets: DatasetKatalog[]; onDataset: (id: string) => void }) {
  return <FilterField label="Dataset" bare width={200}><SearchableSelect value={dataset.id} onChange={value => onDataset(String(value))} options={datasets.map(d => ({ value: d.id, label: d.label }))} placeholder="Cari dataset..." /></FilterField>;
}

function BankDataFilter({ label, value, onChange, options, placeholder }: {
  label: string; value: string[]; onChange: (value: string[]) => void;
  options: { value: string; label: string }[]; placeholder: string;
}) {
  return <FilterField label={label} bare width={210}>
    <SearchableSelect multiple value={value} onChange={next => onChange(Array.isArray(next) ? next.map(String) : [])} options={options} placeholder={placeholder} itemLabel={label.toLowerCase()} />
  </FilterField>;
}

export default function DataTab({ datasets }: { datasets: DatasetKatalog[] }) {
  const [selected, setSelected] = useState(datasets[0]?.id || '');
  const dataset = datasets.find(d => d.id === selected) || datasets[0];
  if (!dataset) return null;
  return <DatasetTable key={dataset.id} dataset={dataset} datasets={datasets} onDataset={setSelected} />;
}

function DatasetTable({ dataset, datasets, onDataset }: { dataset: DatasetKatalog; datasets: DatasetKatalog[]; onDataset: (id: string) => void }) {
  const [tahun, setTahun] = useState<string[]>([]);
  const [semester, setSemester] = useState<string[]>([]);
  const [kelas, setKelas] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [years, setYears] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [result, setResult] = useState<HasilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [reload, setReload] = useState(0);
  const has = (name: 'tahun_ajaran' | 'semester' | 'kelas') => dataset.filter.includes(name);

  useEffect(() => {
    const timeout = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(timeout);
  }, [q]);

  useEffect(() => {
    let active = true;
    if (dataset.filter.includes('tahun_ajaran')) getAllAcademicYears().then(items => { if (active) setYears(items); }).catch(() => {});
    if (dataset.filter.includes('kelas')) fetch('/api/master/kelas?limit=200').then(async response => {
      if (!response.ok) return;
      const json = await response.json();
      if (active && json.ok) setClasses(Array.from(new Set<string>((json.data || []).map((item: { nama: string }) => item.nama).filter(Boolean))).sort());
    }).catch(() => {});
    return () => { active = false; };
  }, [dataset.id, dataset.filter]);

  const payload = useMemo(() => ({
    dataset_id: dataset.id,
    kolom: dataset.kolom.map(c => c.key),
    q: search,
    filter: {
      ...(tahun.length ? { tahun_ajaran: tahun } : {}),
      ...(semester.length ? { semester } : {}),
      ...(kelas.length ? { kelas } : {}),
    },
  }), [dataset.id, dataset.kolom, search, tahun, semester, kelas]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setResult(null); setError(''); setExportError('');
    fetch('/api/bank-data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action: 'data', halaman: page, perHalaman: limit }), signal: controller.signal,
    }).then(async response => {
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || json.message || 'Data tidak dapat dimuat.');
      if (!controller.signal.aborted) {
        const pages = Math.max(1, Math.ceil(json.totalTersedia / limit));
        if (page > pages) { setPage(pages); return; }
        setResult(json);
      }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message || 'Data tidak dapat dimuat.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [payload, page, limit, reload]);

  const changeFilter = (setter: (value: string[]) => void) => (value: string[]) => { setter(Array.isArray(value) ? value : []); setPage(1); };
  const canDownload = !loading && !!result?.data.length && q.trim() === search;

  async function download() {
    if (downloading || !canDownload) return;
    setDownloading(true); setExportError('');
    try {
      const response = await fetch('/api/bank-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, action: 'export' }) });
      if (!response.ok || !response.headers.get('Content-Type')?.includes('spreadsheetml')) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || json.message || 'Ekspor tidak dapat diselesaikan.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || `Bank-Data-${dataset.id}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError(e instanceof Error ? e.message : 'Ekspor gagal.'); }
    finally { setDownloading(false); }
  }

  return <div className="bd-data">
    <FilterToolbar actionsInline>
      <DatasetSelect dataset={dataset} datasets={datasets} onDataset={onDataset} />
      {has('tahun_ajaran') && <BankDataFilter label="Tahun Ajaran" value={tahun} onChange={changeFilter(setTahun)} options={years.map(value => ({ value, label: value }))} placeholder="Semua tahun ajaran" />}
      {has('semester') && <BankDataFilter label="Semester" value={semester} onChange={changeFilter(setSemester)} options={[{ value: 'Ganjil', label: 'Ganjil' }, { value: 'Genap', label: 'Genap' }]} placeholder="Semua semester" />}
      {has('kelas') && <BankDataFilter label="Kelas" value={kelas} onChange={changeFilter(setKelas)} options={classes.map(value => ({ value, label: value }))} placeholder="Semua kelas" />}
      <FilterSearch value={q} onChange={setQ} placeholder="Cari identitas yang ditampilkan..." />
    </FilterToolbar>
    <section className="bd-data-panel" aria-label={dataset.label} aria-busy={loading}>
      <div className="bd-data-heading"><div><h3>{dataset.label}</h3><p>{dataset.deskripsi}</p></div><span className="bd-data-count">{loading ? 'Memuat...' : `${result?.totalTersedia ?? 0} data · ${result?.kolom.length ?? dataset.kolom.length} kolom`}</span></div>
      {result?.terpotong && <p className="bd-data-note" role="status">Terdapat {result.total} data. Sesuai batas pengelola, tabel dan ekspor menampilkan maksimal {result.batas} baris. Persempit filter untuk melihat data lainnya.</p>}
      {(error || exportError) && <div className="bd-data-error" role="alert">{error || exportError}{error && <button type="button" onClick={() => setReload(n => n + 1)}>Coba lagi</button>}</div>}
      {loading ? <div className="bd-loading"><Spinner variant="buble" label="Memuat data..." /></div> : result && <>
        <div className="bd-data-scroll" tabIndex={0} role="region" aria-label={`Tabel ${dataset.label}, geser untuk melihat semua kolom`}>
          <table className="bd-data-table"><caption className="bd-sr-only">{dataset.label}: hanya kolom yang diizinkan. Ekspor mencakup seluruh halaman sesuai filter.</caption><thead><tr><th scope="col">No.</th>{result.kolom.map(col => <th scope="col" key={col.key}>{col.label}</th>)}</tr></thead><tbody>
            {result.data.length ? result.data.map((row, index) => <tr key={`${page}-${index}`}><td>{(page - 1) * limit + index + 1}</td>{result.kolom.map(col => <td key={col.key}>{nilai(row[col.key])}</td>)}</tr>) : <tr><td colSpan={result.kolom.length + 1} className="bd-data-empty">Tidak ada data yang sesuai dengan filter.</td></tr>}
          </tbody></table>
        </div>
        <Pagination currentPage={page} totalPages={Math.ceil(result.totalTersedia / limit)} totalItems={result.totalTersedia} limit={limit} onPageChange={setPage} onLimitChange={value => { setLimit(value); setPage(1); }} />
      </>}
    </section>
    <p className="bd-data-hint">
      Pencarian berlaku pada kolom identitas yang diizinkan. Ekspor mencakup seluruh halaman sesuai filter, mengikuti batas baris pengelola.
      {dataset.id === 'siswa' && tahun.length !== 1 && ' Ekspor akan dipisahkan ke sheet berbeda berdasarkan tahun ajaran.'}
    </p>
    {downloading && <p className="bd-data-hint" role="status">Menyiapkan unduhan Excel...</p>}
    {canDownload && !downloading && <DesktopFab label="Ekspor Excel" icon="download" onClick={download} title="Unduh Excel sesuai filter" mobileLabel="Ekspor" />}
  </div>;
}
