'use client';
import Pagination from '@/components/ui/Pagination';
import { useTabParam } from '@/hooks/useTabParam';
import { useState, useEffect, useCallback } from 'react';
import { useDashboardUser } from '@/components/UserContext';
import KetidakhadiranTable, { KetidakhadiranRow } from '@/app/ketidakhadiran/log-components/KetidakhadiranTable';
import KetidakhadiranCards from '@/app/ketidakhadiran/log-components/KetidakhadiranCards';
import RekapTab from './RekapTab';
import HistorySiswaModal from '@/app/ketidakhadiran/log-components/HistorySiswaModal';
import DatePicker from '@/components/ui/DatePicker';
import MaintenanceBanner from '@/components/MaintenanceBanner';

import Tab from '@/components/ui/Tab';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';

function getLocalDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const JENIS_OPTIONS = [
    { value: '', label: 'Semua Jenis' },
    { value: 'IZIN', label: 'Izin' },
    { value: 'SAKIT', label: 'Sakit' },
];

const LOG_MODE_OPTIONS = [
    { value: 'today', label: 'Hari Ini' },
    { value: 'history', label: 'Riwayat' },
];

const TAB_OPTIONS = [
    { key: 'log', label: 'Riwayat', icon: 'clock-history' },
    { key: 'rekap-izin', label: 'Top Izin', icon: 'envelope-paper' },
    { key: 'rekap-sakit', label: 'Top Sakit', icon: 'thermometer-half' },
];

export function KetidakhadiranLogTab(props: { user?: any }) {
    const { user: ctxUser } = useDashboardUser();
    const user = props.user || ctxUser;

    const [subTab, setSubTab] = useState<'log' | 'rekap-izin' | 'rekap-sakit'>('log');
    const [mode, setMode] = useState<'today' | 'history'>('today');
    const [tanggal, setTanggal] = useState(() => getLocalDate());
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(() => getLocalDate());
    const [kelas, setKelas] = useState('');
    const [jenis, setJenis] = useState('');
    const [q, setQ] = useState('');
    const [rows, setRows] = useState<KetidakhadiranRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [kelasOptions, setKelasOptions] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [stats, setStats] = useState<any>(null);
    const [selectedNisn, setSelectedNisn] = useState<string | null>(null);
    const [limit, setLimit] = useState(10);

    const isSiswa = (user?.roles || []).some((r: string) => (r || '').toUpperCase() === 'SISWA');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ mode });
            if (mode === 'today') {
                params.set('tanggal', tanggal);
            } else {
                if (fromDate) params.set('from', fromDate);
                if (toDate) params.set('to', toDate);
            }
            if (kelas) params.set('kelas', kelas);
            if (jenis) params.set('jenis', jenis);
            if (q) params.set('q', q);
            params.set('page', String(page));
            params.set('limit', String(limit));

            const res = await fetch(`/api/ketidakhadiran/log?${params.toString()}`);
            if (!res.ok) throw new Error('Gagal memuat data');
            const data = await res.json();
            setRows(data.rows || []);
            setTotal(data.total || 0);
            setStats(mode === 'today' ? (data.stats || null) : null);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [mode, tanggal, fromDate, toDate, kelas, jenis, q, page]);

    const loadKelas = useCallback(async () => {
        try {
            const res = await fetch('/api/master/kelas?limit=500&program=Reguler');
            if (res.ok) {
                const data = await res.json();
                const opts = (data.data || []).map((k: any) => k.nama as string).filter(Boolean).sort();
                setKelasOptions(opts);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => { loadKelas(); }, [loadKelas]);
    useEffect(() => { setPage(1); }, [mode, tanggal, fromDate, toDate, kelas, jenis, q]);
    useEffect(() => { loadData(); }, [loadData]);

    const totalPages = Math.ceil(total / limit);

    return (
        <MaintenanceBanner pageKey="maintenance_ketidakhadiran_log">
            <div className="klog__wrap animate-srt-fade-in">
                {/* Tab Component */}
                <Tab
                    tabs={TAB_OPTIONS}
                    activeTab={subTab}
                    onChange={(k) => setSubTab(k as any)}
                    ariaLabel="Navigasi Log Ketidakhadiran"
                    variant="slider"
                />

                {/* CONTENT: Log Tab */}
                {subTab === 'log' && (
                    <>
                        {/* Stats Strip */}
                        {mode === 'today' && stats && (
                            <div className="klog__statStrip">
                                <div className="klog__stat klog__statTotal">
                                    <span className="klog__statNum">{stats.total_today || 0}</span>
                                    <span className="klog__statLbl">Total Aktif</span>
                                </div>
                                <span className="klog__statDiv" />
                                <div className="klog__stat klog__statMadrasah">
                                    <span className="klog__statNum">{stats.izin_madrasah_today || 0}</span>
                                    <span className="klog__statLbl">Izin Madrasah</span>
                                </div>
                                <span className="klog__statDiv" />
                                <div className="klog__stat klog__statPersonal">
                                    <span className="klog__statNum">{stats.izin_personal_today || 0}</span>
                                    <span className="klog__statLbl">Izin Personal</span>
                                </div>
                                {stats.izin_lain_today > 0 && (
                                    <>
                                        <span className="klog__statDiv" />
                                        <div className="klog__stat klog__statLain">
                                            <span className="klog__statNum">{stats.izin_lain_today}</span>
                                            <span className="klog__statLbl">Izin Lain</span>
                                        </div>
                                    </>
                                )}
                                <span className="klog__statDiv" />
                                <div className="klog__stat klog__statSakit">
                                    <span className="klog__statNum">{stats.sakit_today || 0}</span>
                                    <span className="klog__statLbl">Sakit</span>
                                </div>
                            </div>
                        )}

                        {/* FilterToolbar */}
                        <FilterToolbar className="klog__filter-toolbar">
                            <FilterSearch
                                label="Cari Siswa"
                                value={q}
                                onChange={setQ}
                                placeholder="Cari nama / NISN..."
                                grow={2}
                            />
                            <FilterSelect
                                label="Mode Log"
                                icon="calendar-event"
                                value={mode}
                                onChange={(v) => setMode(v as 'today' | 'history')}
                                options={LOG_MODE_OPTIONS}
                            />
                            <FilterSelect
                                label="Kelas"
                                icon="door-open"
                                value={kelas}
                                onChange={setKelas}
                                options={[{ value: '', label: 'Semua Kelas' }, ...kelasOptions.map(k => ({ value: k, label: k }))]}
                            />
                            <FilterSelect
                                label="Jenis"
                                icon="funnel"
                                value={jenis}
                                onChange={setJenis}
                                options={JENIS_OPTIONS}
                            />
                            {/* Date Picker Range */}
                            {mode === 'today' ? (
                                <div className="klog__dateWrap">
                                    <DatePicker
                                        className="klog__dateInput"
                                        value={tanggal}
                                        onChange={setTanggal}
                                    />
                                </div>
                            ) : (
                                <div className="klog__dateWrap">
                                    <DatePicker className="klog__dateInput" value={fromDate} onChange={setFromDate} />
                                    <span className="klog__dateSep">—</span>
                                    <DatePicker className="klog__dateInput" value={toDate} onChange={setToDate} />
                                </div>
                            )}
                        </FilterToolbar>

                        {/* Content */}
                        <div className="klog__content">
                            <KetidakhadiranTable rows={rows} loading={loading} hideKeterangan={isSiswa} onViewHistory={setSelectedNisn} />
                            <KetidakhadiranCards rows={rows} hideKeterangan={isSiswa} onViewHistory={setSelectedNisn} />
                        </div>

                        {/* Pagination */}
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            limit={limit}
                            totalItems={total}
                            onPageChange={setPage}
                            onLimitChange={setLimit}
                            itemLabel="log"
                        />
                    </>
                )}

                {/* CONTENT: Rekap Izin Tab */}
                {subTab === 'rekap-izin' && (
                    <RekapTab type="izin" />
                )}

                {/* CONTENT: Rekap Sakit Tab */}
                {subTab === 'rekap-sakit' && (
                    <RekapTab type="sakit" />
                )}

                {/* Modal component for History */}
                {selectedNisn && (
                    <HistorySiswaModal
                        nisn={selectedNisn}
                        onClose={() => setSelectedNisn(null)}
                    />
                )}

                <style jsx>{`
                .klog__wrap { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; font-family: 'Poppins', sans-serif; }

                /* Stats Strip */
                .klog__statStrip {
                    display: flex; align-items: stretch;
                    background: var(--n-card); border: 1.8px solid rgba(26, 115, 232, 0.45);
                    border-radius: 16px; padding: 10px 6px;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.03);
                    overflow-x: auto;
                }
                .klog__stat {
                    flex: 1; display: flex; align-items: baseline; justify-content: center; gap: 8px;
                    padding: 2px 12px; min-width: 0; white-space: nowrap;
                }
                .klog__statNum { font-size: 1.3rem; font-weight: 800; line-height: 1; }
                .klog__statLbl { font-size: 0.7rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.4px; }
                .klog__statDiv { width: 1px; align-self: stretch; background: rgba(26, 115, 232, 0.2); flex-shrink: 0; }

                .klog__statTotal .klog__statNum { color: #1d4ed8; }
                .klog__statMadrasah .klog__statNum { color: #1d6bf3; }
                .klog__statPersonal .klog__statNum { color: #1d4ed8; }
                .klog__statSakit .klog__statNum { color: #d97706; }
                .klog__statLain .klog__statNum { color: #c2410c; }

                /* Mode Segmented (Hari Ini / Riwayat) */
                .klog__modeSeg {
                    display: inline-flex; gap: 4px; padding: 3px;
                    background: var(--n-soft); border: 1.8px solid rgba(26, 115, 232, 0.45);
                    border-radius: 12px; flex-shrink: 0;
                }
                .klog__segBtn {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 6px 12px; border: none; border-radius: 9px;
                    background: transparent; color: var(--n-muted);
                    font-size: 0.78rem; font-weight: 700;
                    cursor: pointer; transition: all 0.15s;
                }
                .klog__segBtn i { font-size: 0.85rem; }
                .klog__segBtn:hover { color: var(--n-primary); }
                .klog__segBtnActive { background: var(--n-card); color: var(--n-primary); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }

                .klog__dateWrap {
                    display: flex; align-items: center; gap: 6px;
                    background: transparent; border: none; padding: 0;
                }
                .klog__dateSep { color: var(--n-muted); font-size: 0.85rem; }
                .klog__dateInput {
                    padding: 7px 0; border: none; background: transparent;
                    color: var(--n-ink); font-size: 0.82rem; font-weight: 600;
                    cursor: pointer; outline: none;
                }

                .klog__content { }

                /* Pagination */
                .klog__pagination {
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                }
                .klog__pageDots { display: flex; align-items: center; gap: 4px; }

                :global(.dark) .klog__statStrip {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .klog__statDiv { background: rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .klog__statTotal .klog__statNum { color: #60a5fa !important; }
                :global(.dark) .klog__statMadrasah .klog__statNum { color: #93c5fd !important; }
                :global(.dark) .klog__statPersonal .klog__statNum { color: #bfdbfe !important; }
                :global(.dark) .klog__statSakit .klog__statNum { color: #fbbf24 !important; }
                :global(.dark) .klog__statLain .klog__statNum { color: #fb923c !important; }

                :global(.dark) .klog__modeSeg {
                    background: #000000 !important;
                    border: 1.5px solid rgba(26, 115, 232, 0.5) !important;
                }
                :global(.dark) .klog__segBtn { color: #94a3b8 !important; }
                :global(.dark) .klog__segBtn:hover { color: #60a5fa !important; }
                :global(.dark) .klog__segBtnActive {
                    background: rgba(96, 165, 250, 0.18) !important;
                    color: #60a5fa !important;
                    box-shadow: inset 0 0 0 1.5px rgba(96, 165, 250, 0.55) !important;
                }

                @media (max-width: 640px) {
                    .klog__statStrip { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; overflow: visible; }
                    .klog__statDiv { display: none; }
                    .klog__stat { justify-content: flex-start; padding: 0; }
                    .klog__modeSeg { width: 100%; }
                    .klog__segBtn { flex: 1; justify-content: center; }
                    .klog__dateWrap { grid-column: span 2; display: flex; align-items: center; justify-content: space-between; padding: 0; }
                    .klog__dateInput { flex: 1; min-width: 0; text-align: center; padding: 10px 0; }
                }
            `}</style>
            </div>
        </MaintenanceBanner>
    );
}

export default KetidakhadiranLogTab;
