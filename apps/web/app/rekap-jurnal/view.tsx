'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useRouter } from 'next/navigation';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { createPortal } from 'react-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import MaintenanceBanner from '@/components/MaintenanceBanner';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function RekapJurnalPage() {
    const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
    const [showAll, setShowAll] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<any>(null);
    const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
    const [categoriesList, setCategoriesList] = useState<string[]>([]);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    const { openModal, closeModal } = useModalBlur();

    useEffect(() => {
        if (selectedTeacher) {
            openModal();
        } else {
            closeModal();
        }
    }, [selectedTeacher]);

    const categoryColors: Record<string, string> = {
        'Sesuai': '#10b981',
        'Kosong': '#ef4444',
        'Terlambat': '#f97316',
        'Tukaran': '#3b82f6',
        'Diganti': '#3083FF',
        'Digabung': '#14b8a6',
        'Tim teaching': '#3083FF',
        'Penugasan dengan pendampingan': '#3b82f6',
        'Penugasan tanpa pendampingan': '#d946ef',
        'Lainnya': '#6b7280'
    };

    const getCategoryColor = (cat: string) => categoryColors[cat] || '#6b7280';
    const router = useRouter();

    const summaryStats = useMemo(() => {
        if (!data?.globalStats) return { total: 0, topCategory: '-', topPercentage: 0 };
        const counts = Object.values(data.globalStats) as number[];
        const total = counts.reduce((a, b) => a + b, 0);

        // Find top category
        let max = 0;
        let top = '-';
        Object.entries(data.globalStats).forEach(([cat, val]: [string, any]) => {
            if (val > max) {
                max = val;
                top = cat;
            }
        });

        return {
            total,
            topCategory: top,
            topPercentage: total > 0 ? Math.round((max / total) * 100) : 0
        };
    }, [data]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/master/dropdown');
                const json = await res.json().catch(() => null);
                const rawList = json?.data?.kategori_kehadiran || json?.kategori_kehadiran || [];

                if (Array.isArray(rawList)) {
                    const cats = [...new Set(rawList.map((d: any) => typeof d === 'string' ? d : d.kategori_kehadiran || d.value || d.label).filter(Boolean))];
                    const priority = ['Sesuai', 'Terlambat', 'Kosong', 'Tukaran', 'Diganti'];
                    const sortedCats = cats.sort((a, b) => {
                        const idxA = priority.indexOf(a);
                        const idxB = priority.indexOf(b);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.localeCompare(b);
                    });
                    setCategoriesList(sortedCats);
                }
            } catch (err) {
                console.error('Error fetching categories:', err);
            }
        };
        fetchCategories();
    }, []);

    const fetchRekap = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (showAll) {
                params.append('all', 'true');
            } else {
                params.append('month', filterMonth);
                params.append('year', filterYear);
            }

            const response = await fetch(`/api/rekap-jurnal?${params.toString()}`);
            const result = await response.json();

            if (result.success) {
                setData(result.data);
            }
        } catch (error) {
            console.error('Error fetching rekap:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRekap();
    }, [filterMonth, filterYear, showAll]);

    const months = [
        { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
        { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
        { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
        { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
        { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
        { value: '11', label: 'November' }, { value: '12', label: 'Desember' }
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

    const categoryInitials: Record<string, string> = {
        'Sesuai': 'SS', 'Kosong': 'KS', 'Terlambat': 'TL', 'Tukaran': 'TK', 'Diganti': 'DG',
        'Digabung': 'DB', 'Tim teaching': 'TT', 'Penugasan dengan pendampingan': 'PDP',
        'Penugasan tanpa pendampingan': 'PTP', 'Lainnya': 'LN'
    };

    // Chart.js Horizontal Bar Chart for Mobile
    const MobileBarChart = ({ stats }: { stats: any }) => {
        if (!stats) return null;
        const chartCategories = categoriesList.length > 0 ? categoriesList : Object.keys(stats);

        const chartData = {
            labels: chartCategories.map(cat => categoryInitials[cat] || cat.substring(0, 8)),
            datasets: [{
                data: chartCategories.map(cat => stats[cat] || 0),
                backgroundColor: chartCategories.map(cat => getCategoryColor(cat)),
                borderRadius: 8,
                borderSkipped: false,
            }]
        };

        const options: any = {
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { family: 'Arial, sans-serif', size: 13, weight: 'bold' },
                    bodyFont: { family: 'Arial, sans-serif', size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items: any) => chartCategories[items[0].dataIndex] || '',
                        label: (ctx: any) => `  ${ctx.raw} entri`,
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: { font: { family: 'Arial, sans-serif', size: 11, weight: '600' }, color: 'var(--n-muted)' }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { family: 'Arial, sans-serif', size: 11, weight: '700' }, color: 'var(--n-text)' }
                }
            }
        };

        return (
            <div className="chart-container" style={{ padding: '8px' }}>
                <Bar data={chartData} options={options} />
            </div>
        );
    };

    // Chart.js Vertical Bar Chart for Desktop
    const DesktopBarChart = ({ stats }: { stats: any }) => {
        if (!stats) return null;
        const chartCategories = categoriesList.length > 0 ? categoriesList : Object.keys(stats);

        const chartData = {
            labels: chartCategories.map(cat => categoryInitials[cat] || cat.substring(0, 2).toUpperCase()),
            datasets: [{
                label: 'Jumlah',
                data: chartCategories.map(cat => stats[cat] || 0),
                backgroundColor: chartCategories.map(cat => getCategoryColor(cat) + 'cc'),
                borderColor: chartCategories.map(cat => getCategoryColor(cat)),
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
            }]
        };

        const options: any = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { family: 'Arial, sans-serif', size: 13, weight: 'bold' },
                    bodyFont: { family: 'Arial, sans-serif', size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items: any) => chartCategories[items[0].dataIndex] || '',
                        label: (ctx: any) => `  ${ctx.raw} entri`,
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Arial, sans-serif', size: 11, weight: '700' }, color: 'var(--n-text)' }
                },
                y: {
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: { font: { family: 'Arial, sans-serif', size: 11, weight: '600' }, color: 'var(--n-muted)' }
                }
            }
        };

        return (
            <div className="chart-container" style={{ padding: '8px 16px 16px' }}>
                <Bar data={chartData} options={options} />
            </div>
        );
    };

    return (
        <MaintenanceBanner pageKey="maintenance_rekap_jurnal">
            <div className="rekap-wrapper">
                {/* PREMIUM HEADER */}
                <div className="rekap-header">
                    <div className="rh-top">
                        <div className="rh-left">
                            <div className="rh-titles">
                                <h1>Rekapitulasi Jurnal</h1>
                                <p>Analisis kinerja &amp; kepatuhan pengisian jurnal</p>
                            </div>
                        </div>
                        <div className="rh-right">
                            {!showAll && (
                                <div className="rh-filters">
                                    <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="rh-select">
                                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                    <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="rh-select">
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            )}
                            <button className={`rh-mode-btn ${showAll ? 'active' : ''}`} onClick={() => setShowAll(!showAll)}>
                                <i className={`bi ${showAll ? 'bi-calendar3' : 'bi-infinity'}`}></i>
                                {showAll ? 'Bulan Ini' : 'Semua'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* STATS GRID */}
                <div className="rh-stats-grid">
                    <div className="rh-stat-card">
                        <div className="rh-stat-icon" style={{color: '#3083FF', background: 'rgba(79, 70, 229, 0.1)'}}>
                            <i className="bi bi-file-earmark-text"></i>
                        </div>
                        <div className="rh-stat-content">
                            <div className="rh-stat-num">{summaryStats.total}</div>
                            <div className="rh-stat-lbl">Total Entri</div>
                        </div>
                    </div>
                    <div className="rh-stat-card">
                        <div className="rh-stat-icon" style={{color: '#10b981', background: 'rgba(16, 185, 129, 0.1)'}}>
                            <i className="bi bi-pie-chart"></i>
                        </div>
                        <div className="rh-stat-content">
                            <div className="rh-stat-num">{summaryStats.topPercentage}%</div>
                            <div className="rh-stat-lbl">{summaryStats.topCategory}</div>
                        </div>
                    </div>
                    <div className="rh-stat-card">
                        <div className="rh-stat-icon" style={{color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)'}}>
                            <i className="bi bi-people"></i>
                        </div>
                        <div className="rh-stat-content">
                            <div className="rh-stat-num">{data?.teacherStats?.length || 0}</div>
                            <div className="rh-stat-lbl">Jumlah Guru</div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-loading">
                        <Spinner size={36} />
                        <span>Menganalisis data...</span>
                    </div>
                ) : (
                    <div className="rekap-content fade-up">
                        {/* GLOBAL CHART */}
                        <div className="p-card chart-section">
                            <div className="p-card-header">
                                <div className="header-info">
                                    <h3>Distribusi Kehadiran Global</h3>
                                    <p>Persentase kategori jurnal dari seluruh pengajar</p>
                                </div>
                            </div>
                            <div className="chart-scroll">
                                {isMobile
                                    ? <MobileBarChart stats={data?.globalStats} />
                                    : <DesktopBarChart stats={data?.globalStats} />
                                }
                            </div>
                        </div>

                        {/* TEACHER LIST */}
                        <div className="p-card list-section">
                            <div className="p-card-header">
                                <div className="header-info">
                                    <h3>Data Jurnal Guru</h3>
                                    <p>Rincian jumlah sesi berdasarkan kategori</p>
                                </div>
                            </div>

                            {/* SEARCH BAR */}
                            <div className="table-search-bar">
                                <i className="bi bi-search"></i>
                                <input
                                    type="text"
                                    placeholder="Cari nama atau NIP guru..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="table-search-input"
                                />
                                {searchQuery && (
                                    <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                                        <i className="bi bi-x"></i>
                                    </button>
                                )}
                            </div>

                            {/* DESKTOP TABLE */}
                            <div className="p-table-container desktop-only">
                                <table className="p-table">
                                    <thead>
                                        <tr>
                                            <th className="col-name">GURU</th>
                                            {categoriesList.map(cat => (
                                                <th key={cat} className="col-status">
                                                    <span className="th-abbr" title={cat}>{categoryInitials[cat] || cat.substring(0, 2)}</span>
                                                </th>
                                            ))}
                                            <th className="col-status">HASIL</th>
                                            <th className="col-status">AKSI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data?.teacherStats
                                            ?.filter((teacher: any) => {
                                                if (!searchQuery) return true;
                                                const q = searchQuery.toLowerCase();
                                                return (teacher.nama || '').toLowerCase().includes(q)
                                                    || (teacher.nip || '').toLowerCase().includes(q);
                                            })
                                            .map((teacher: any, idx: number) => (
                                                <tr key={idx} className="p-row">
                                                    <td className="col-name">
                                                        <div className="t-profile">
                                                            <div className="t-info">
                                                                <span className="t-name">{teacher.nama}</span>
                                                                <span className="t-nip">{teacher.nip || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {categoriesList.map(cat => {
                                                        const count = teacher.categories?.[cat] || 0;
                                                        return (
                                                            <td key={cat} className="col-status">
                                                                {count > 0 ? (
                                                                    <span className="p-count" style={{ borderColor: getCategoryColor(cat), color: getCategoryColor(cat) }}>{count}</span>
                                                                ) : <span className="p-zero">-</span>}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="col-status">
                                                        <div className="t-total">{teacher.total}</div>
                                                    </td>
                                                    <td className="col-status">
                                                        <button
                                                            className="p-action-btn"
                                                            onClick={() => setSelectedTeacher(teacher)}
                                                            title="Detail"
                                                        >
                                                            <i className="bi bi-eye"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* MOBILE CARDS */}
                            <div className="mobile-only">
                                <div className="m-rekap-list">
                                    {data?.teacherStats
                                        ?.filter((teacher: any) => {
                                            if (!searchQuery) return true;
                                            const q = searchQuery.toLowerCase();
                                            return (teacher.nama || '').toLowerCase().includes(q)
                                                || (teacher.nip || '').toLowerCase().includes(q);
                                        })
                                        .map((teacher: any, idx: number) => (
                                            <div key={idx} className="m-rekap-card">
                                                <div className="m-card-top" onClick={() => setSelectedTeacher(teacher)}>
                                                    <div className="t-profile">
                                                        <div className="t-info">
                                                            <span className="t-name">{teacher.nama}</span>
                                                            <span className="t-nip">{teacher.nip}</span>
                                                        </div>
                                                    </div>
                                                    <div className="t-total-box" onClick={() => setSelectedTeacher(teacher)} style={{ cursor: 'pointer' }}>
                                                        <span className="total-val"><i className="bi bi-eye"></i></span>
                                                        <span className="total-lbl">Lihat</span>
                                                    </div>
                                                </div>
                                                <div className="m-card-stats">
                                                    {categoriesList.map(cat => {
                                                        const count = teacher.categories?.[cat] || 0;
                                                        if (count === 0) return null;
                                                        return (
                                                            <div key={cat} className="m-stat-tag" style={{ background: `${getCategoryColor(cat)}15`, color: getCategoryColor(cat) }}>
                                                                {categoryInitials[cat] || cat.substring(0, 2)}: {count}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PREMIUM MODAL */}
                {selectedTeacher && typeof document !== 'undefined' && createPortal((
                    <div className="p-modal-overlay" onClick={() => setSelectedTeacher(null)}>
                        <div className="p-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="p-modal-header">
                                <div className="header-left">
                                    <div className="t-info">
                                        <h3>{selectedTeacher.nama}</h3>
                                        <p>{selectedTeacher.nip || 'NIP Tidak Tersedia'}</p>
                                    </div>
                                </div>
                                <button className="modal-close" onClick={() => setSelectedTeacher(null)}><i className="bi bi-x-lg"></i></button>
                            </div>
                            <div className="p-modal-body">
                                <div className="m-scroll-area">
                                    <table className="modal-table">
                                        <thead>
                                            <tr>
                                                <th>TANGGAL & JAM</th>
                                                <th>KELAS & MAPEL</th>
                                                <th>MATERI</th>
                                                <th>STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedTeacher.details.map((detail: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <span className="d-date">{new Date(detail.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                                                        <span className="d-time">Jam Ke-{detail.jam_ke}</span>
                                                    </td>
                                                    <td>
                                                        <span className="d-kelas">{detail.kelas}</span>
                                                        <span className="d-mapel">{detail.mata_pelajaran}</span>
                                                    </td>
                                                    <td><p className="d-materi">{detail.materi || '-'}</p></td>
                                                    <td>
                                                        <span className="p-status-chip" style={{ background: getCategoryColor(detail.kategori) }}>
                                                            {detail.kategori}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ), document.body)}

                <style jsx>{`
                .rekap-wrapper {
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                    font-family: 'Poppins', sans-serif;
                    overflow-x: hidden;
                    display: flex;
                    flex-direction: column;
                    gap: var(--page-gap);
                }

                .rekap-content {
                    display: flex;
                    flex-direction: column;
                    gap: var(--page-gap);
                }


                /* ============ PREMIUM HEADER ============ */
                .rekap-header {
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    border-radius: 20px;
                    border: none;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                    padding: 32px 36px;
                    color: white;
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .rekap-header:hover {
                    transform: translateY(-2px);
                }

                .rekap-header::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -10%;
                    width: 400px;
                    height: 400px;
                    background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 60%);
                    pointer-events: none;
                    border-radius: 50%;
                }

                .rh-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 24px;
                    z-index: 1;
                    position: relative;
                }

                .rh-left {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .rh-titles h1 {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: white;
                    letter-spacing: -0.02em;
                    line-height: 1.1;
                    margin: 0 0 8px;
                }

                .rh-titles p {
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.95);
                    font-weight: 500;
                    margin: 0;
                }

                .rh-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-shrink: 0;
                }

                .rh-filters {
                    display: flex;
                    gap: 8px;
                }

                .rh-select {
                    padding: 10px 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    background: rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(8px);
                    color: white;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    outline: none;
                    transition: all 0.2s;
                    appearance: none;
                    padding-right: 40px;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='white' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 16px center;
                }
                .rh-select:hover { border-color: rgba(255, 255, 255, 0.6); background-color: rgba(255, 255, 255, 0.3); }
                .rh-select option {
                    background: var(--n-card);
                    color: var(--n-ink);
                }

                .rh-mode-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    background: rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(8px);
                    color: white;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .rh-mode-btn:hover { border-color: rgba(255, 255, 255, 0.6); background: rgba(255, 255, 255, 0.3); }
                .rh-mode-btn.active {
                    background: white;
                    color: #3083FF;
                }

                /* ============ STATS GRID ============ */
                .rh-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }
                .rh-stat-card {
                    background: var(--n-card);
                    border-radius: 16px;
                    padding: 24px;
                    border: 1px solid var(--n-border);
                    box-shadow: 0 4px 24px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02);
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .rh-stat-card:hover {
                    box-shadow: 0 12px 32px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03);
                    transform: translateY(-2px);
                }
                .rh-stat-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.6rem;
                    flex-shrink: 0;
                }
                .rh-stat-content {
                    display: flex;
                    flex-direction: column;
                }
                .rh-stat-num {
                    font-size: 1.8rem;
                    font-weight: 900;
                    color: var(--n-ink);
                    line-height: 1.1;
                }
                .rh-stat-lbl {
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    font-weight: 600;
                    margin-top: 4px;
                }

                /* ============ PREMIUM CARD ============ */
                .p-card {
                    background: var(--n-card);
                    border-radius: 20px;
                    padding: 24px 32px;
                    border: 1px solid var(--n-border);
                    box-shadow: 0 4px 24px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02);
                }

                .p-card-header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
                .header-info h3 { font-size: 1.25rem; font-weight: 850; color: var(--n-ink); letter-spacing: -0.02em; margin: 0; }
                .header-info p { color: var(--n-muted); font-size: 0.85rem; margin: 0; }

                /* ============ SEARCH BAR ============ */
                .table-search-bar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: var(--n-surface);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    padding: 12px 20px;
                    transition: all 0.2s;
                    margin-bottom: 24px;
                    max-width: 500px;
                }
                .table-search-bar:focus-within {
                    border-color: #3083FF;
                    background: var(--n-card);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                }
                .table-search-bar i { color: var(--n-muted); font-size: 1.1rem; flex-shrink: 0; }
                .table-search-input {
                    flex: 1;
                    border: none;
                    outline: none;
                    background: transparent;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--n-ink);
                }
                .table-search-input::placeholder { color: var(--n-muted); font-weight: 400; opacity: 0.7; }
                .search-clear-btn {
                    width: 24px; height: 24px; border-radius: 50%; border: none;
                    background: var(--n-border); color: var(--n-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.8rem; transition: all 0.2s;
                }
                .search-clear-btn:hover { background: #ef4444; color: white; }

                /* ============ CHART ============ */
                .chart-section { background: var(--n-card); }
                .chart-scroll { overflow-x: auto; padding-bottom: 8px; }
                .chart-container { position: relative; min-height: 280px; }

                /* ============ TABLE ============ */
                .p-table-container {
                    background: var(--n-card);
                    border-radius: 12px;
                    overflow-x: auto;
                    border: 1px solid var(--n-border);
                    width: 100%;
                }
                .p-table {
                    width: 100%;
                    min-width: 900px;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .p-table th {
                    background: var(--n-surface);
                    padding: 16px;
                    text-align: left;
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: var(--n-muted);
                    font-weight: 800;
                    border-bottom: 1px solid var(--n-border);
                }
                .p-row td {
                    padding: 16px;
                    border-bottom: 1px solid var(--n-border);
                    vertical-align: middle;
                    background: var(--n-card);
                    transition: background 0.2s;
                }
                .p-row:last-child td { border-bottom: none; }
                .col-name { min-width: 240px; padding-left: 24px !important; }
                .col-status { width: 60px; text-align: center !important; }
                .p-table th.col-status { text-align: center !important; }
                .p-row:hover td { background: var(--n-surface); }

                .t-profile { display: flex; align-items: center; gap: 16px; }
                .t-name {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    font-weight: 750;
                    color: var(--n-ink);
                    font-size: 0.875rem;
                    line-height: 1.3;
                }
                .t-nip { font-size: 0.73rem; color: var(--n-muted); display: block; margin-top: 2px; }

                .th-abbr { cursor: help; text-decoration: underline dotted; }
                .p-count {
                    display: inline-block; padding: 4px 8px; border-radius: 8px; border: 1.5px solid;
                    font-weight: 800; font-size: 0.78rem; min-width: 30px; background: transparent;
                }
                .p-zero { color: var(--n-muted); font-weight: 400; }
                .t-total { font-weight: 900; font-size: 1.05rem; color: var(--n-primary); }

                .p-action-btn {
                    padding: 9px 16px; border-radius: 12px; border: none;
                    background: rgba(79, 142, 247, 0.1);
                    color: var(--n-primary); font-weight: 700; font-size: 0.8rem; cursor: pointer;
                    transition: all 0.2s;
                }
                .p-action-btn:hover { background: var(--n-primary); color: white; }

                /* ============ MOBILE REKAP ============ */
                .m-rekap-card {
                    background: var(--n-card); border-radius: 20px; border: 1px solid var(--n-border);
                    padding: 20px; margin-bottom: 14px;
                    box-shadow: var(--n-shadow-soft);
                }
                .m-card-top {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 16px; cursor: pointer;
                }
                .t-total-box {
                    text-align: center; background: var(--n-surface); padding: 10px 16px;
                    border-radius: 14px; border: 1px solid var(--n-border); flex-shrink: 0;
                }
                .total-val { display: block; font-size: 1rem; font-weight: 950; color: var(--n-primary); }
                .total-lbl { font-size: 0.6rem; color: var(--n-muted); text-transform: uppercase; font-weight: 700; }
                .m-card-stats { display: flex; flex-wrap: wrap; gap: 8px; }
                .m-stat-tag { padding: 6px 12px; border-radius: 8px; font-size: 0.74rem; font-weight: 750; }

                /* ============ MODAL ============ */
                .p-modal-overlay {
                    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(8px); z-index: 1000;
                    display: flex; align-items: center; justify-content: center; padding: 20px;
                }
                .p-modal-content {
                    background: var(--n-card); border-radius: 24px; width: 100%; max-width: 960px;
                    max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                    border: 1px solid var(--n-border);
                }
                .p-modal-header {
                    padding: 24px 32px; border-bottom: 1px solid var(--n-border);
                    display: flex; justify-content: space-between; align-items: center;
                    background: var(--n-surface);
                }
                .header-left { display: flex; align-items: center; gap: 20px; }
                .header-left h3 { font-size: 1.25rem; font-weight: 850; color: var(--n-ink); margin: 0; }
                .header-left p { color: var(--n-muted); font-weight: 500; font-size: 0.85rem; margin: 4px 0 0 0; }
                .modal-close {
                    width: 36px; height: 36px; border-radius: 10px; border: none;
                    background: var(--n-surface); color: var(--n-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s; border: 1px solid var(--n-border);
                }
                .modal-close:hover { background: #ef4444; color: white; border-color: #ef4444; }
                .p-modal-body { padding: 24px 32px; overflow: hidden; display: flex; flex-direction: column; }
                .m-scroll-area { overflow-y: auto; flex: 1; padding-right: 8px; }

                .modal-table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--n-border); border-radius: 12px; overflow: hidden; }
                .modal-table th {
                    text-align: left; padding: 14px 16px; background: var(--n-surface);
                    font-size: 0.72rem; font-weight: 800; color: var(--n-muted); text-transform: uppercase;
                    letter-spacing: 1px; border-bottom: 1px solid var(--n-border);
                }
                .modal-table td {
                    background: var(--n-card); padding: 16px;
                    border-bottom: 1px solid var(--n-border);
                    vertical-align: middle; color: var(--n-ink);
                }
                .modal-table tr:last-child td { border-bottom: none; }
                .modal-table tr:hover td { background: var(--n-surface); }

                .d-date { display: block; font-weight: 800; color: var(--n-ink); }
                .d-time { font-size: 0.78rem; color: var(--n-muted); }
                .d-kelas { display: block; font-weight: 750; color: var(--n-primary); font-size: 0.9rem; }
                .d-mapel { font-size: 0.78rem; color: var(--n-muted); }
                .d-materi { font-size: 0.83rem; color: var(--n-muted); max-width: 280px; white-space: normal; line-height: 1.4; }
                .p-status-chip {
                    padding: 5px 12px; border-radius: 99px; font-size: 0.73rem;
                    font-weight: 750; color: white; display: inline-block; white-space: nowrap;
                }

                /* ============ ANIMATIONS ============ */
                .fade-up { animation: fadeUp 0.6s ease-out; }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .p-loading {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    padding: 100px; gap: 20px; color: var(--n-primary);
                }
                .loader {
                    width: 44px; height: 44px; border: 4px solid var(--n-border);
                    border-top-color: var(--n-primary); border-radius: 50%; animation: spin 1s linear infinite;
                }

                .desktop-only { display: block; }
                .mobile-only { display: none; }

                /* ============ RESPONSIVE ============ */
                @media (max-width: 1024px) {
                    .rh-stats-grid { grid-template-columns: repeat(2, 1fr); }
                }

                @media (max-width: 768px) {
                    /* gap SENGAJA tidak ditimpa di sini — nilai dasarnya sudah
                       var(--page-gap). Dulu di sini ada gap: 16px, padahal di
                       mobile padding-top .content-area cuma 12px, jadi jarak
                       header -> kartu pertama (12px) tidak sama dengan jarak
                       antar-section di bawahnya (16px). */
                    .rekap-wrapper { padding: 0 0 24px; }
                    .rekap-header { padding: 24px; border-radius: 16px; }
                    .rh-top { flex-direction: column; gap: 16px; align-items: stretch; }
                    .rh-titles h1 { font-size: 1.4rem; }
                    .rh-right { flex-direction: column; align-items: stretch; }
                    .rh-filters { flex-direction: row; }
                    .rh-select { flex: 1; }
                    .rh-mode-btn { justify-content: center; }
                    
                    .rh-stats-grid { grid-template-columns: 1fr; gap: 12px; }
                    .rh-stat-card { padding: 16px; }

                    .p-card { padding: 16px; border-radius: 16px; }

                    .desktop-only { display: none; }
                    .mobile-only { display: block; }

                    .p-modal-content { border-radius: 0; max-height: 100vh; }
                    .p-modal-header { padding: 20px; }
                    .p-modal-body { padding: 16px; }
                    .modal-table tr {
                        display: flex; flex-direction: column;
                        border: 1px solid var(--n-border); border-radius: 16px;
                        padding: 14px; margin-bottom: 12px; background: var(--n-card);
                    }
                    .modal-table td { padding: 6px 0; border: none !important; background: transparent !important; }
                    .modal-table thead { display: none; }
                }
            `}</style>
            </div>
        </MaintenanceBanner>
    );
}
