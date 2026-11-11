'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import './committee-monitoring.css';

type CommitteeRow = {
    id: string;
    title: string;
    owner_name: string;
    start_date: string;
    end_date: string;
    proposed_total: string | null;
    item_count: number;
    total: string;
    paid: string;
};

const money = (value: string | number | null) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const date = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CommitteeMonitoring() {
    const [rows, setRows] = useState<CommitteeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [year, setYear] = useState('ALL');

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/monitoring/laporan/komite', { signal: controller.signal })
            .then(async response => {
                const result = await response.json();
                if (!response.ok || !result.ok) throw new Error(result.error || 'Data tidak dapat dimuat.');
                setRows(result.data);
            })
            .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'Data tidak dapat dimuat.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, []);

    const years = useMemo(() => [...new Set(rows.flatMap(row => [row.start_date.slice(0, 4), row.end_date.slice(0, 4)]))].sort().reverse(), [rows]);
    const filtered = useMemo(() => rows.filter(row => {
        const matchesQuery = `${row.title} ${row.owner_name}`.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID'));
        const matchesYear = year === 'ALL' || (row.start_date.slice(0, 4) <= year && row.end_date.slice(0, 4) >= year);
        return matchesQuery && matchesYear;
    }), [rows, query, year]);
    const totalProposed = filtered.reduce((sum, row) => sum + Number(row.proposed_total || 0), 0);
    const totalBudget = filtered.reduce((sum, row) => sum + Number(row.total), 0);
    const totalPaid = filtered.reduce((sum, row) => sum + Number(row.paid), 0);

    return <section className="mon-komite" aria-label="Pengajuan Komite">
        <div className="mon-komite-summary">
            <div><span>Kegiatan</span><strong>{filtered.length}</strong></div>
            <div><span>Diajukan dalam proposal</span><strong>{money(totalProposed)}</strong></div>
            <div><span>Anggaran item</span><strong>{money(totalBudget)}</strong></div>
            <div><span>Sudah dibayar</span><strong>{money(totalPaid)}</strong></div>
        </div>

        <FilterToolbar>
            <FilterSearch value={query} onChange={setQuery} placeholder="Cari kegiatan atau PJ..." grow={2} />
            <FilterSelect label="Tahun" icon="calendar3" value={year} onChange={setYear}
                options={[{ value: 'ALL', label: 'Semua tahun' }, ...years.map(value => ({ value, label: value }))]}
                width={150} />
        </FilterToolbar>

        {loading ? <div className="mon-komite-state"><Spinner size={32} /> Memuat pengajuan komite...</div>
            : error ? <div className="mon-komite-state" role="alert">{error}</div>
            : filtered.length === 0 ? <div className="mon-komite-state">Belum ada pengajuan komite untuk filter ini.</div>
            : <div className="mon-komite-list">
                {filtered.map(row => {
                    const budget = Number(row.total);
                    const paid = Number(row.paid);
                    const status = paid <= 0 ? 'Belum dibayar' : paid >= budget && budget > 0 ? 'Lunas' : 'Dibayar sebagian';
                    return <article className="mon-komite-card" key={row.id}>
                        <div className="mon-komite-card-head">
                            <div><h2>{row.title}</h2><p>PJ: {row.owner_name} · {date(row.start_date)}–{date(row.end_date)}</p></div>
                            <span className={`mon-komite-status ${paid >= budget && budget > 0 ? 'is-paid' : paid > 0 ? 'is-partial' : ''}`}>{status}</span>
                        </div>
                        <div className="mon-komite-card-data">
                            <div><span>Proposal</span><strong>{row.proposed_total ? money(row.proposed_total) : 'Belum dicatat'}</strong></div>
                            <div><span>Anggaran · {row.item_count} item</span><strong>{money(row.total)}</strong></div>
                            <div><span>Dibayar bendahara</span><strong>{money(row.paid)}</strong></div>
                            <div><span>Sisa anggaran</span><strong>{money(Math.max(0, budget - paid))}</strong></div>
                        </div>
                    </article>;
                })}
            </div>}
    </section>;
}
