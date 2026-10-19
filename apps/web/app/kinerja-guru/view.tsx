'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { Spinner } from '@/components/ui/Spinner';
import Tab from '@/components/ui/Tab';
import { FilterToolbar, FilterSelect, FilterInput, FilterSearch } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import KinerjaGuruDetailModal from './components/KinerjaGuruDetailModal';
import { useModalBlur } from '@/components/ModalBlurProvider';
import './kinerja-guru.css';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Winner {
    nip: string;
    nama: string;
    count: number;
    total_jp: number;
    details: any[];
}

interface KinerjaGuruData {
    jamKosong: Winner[];
    penugasanTanpa: Winner[];
    penugasanDengan: Winner[];
    digabung: Winner[];
    terlambat: Winner[];
    daring: Winner[];
    mengambilIstirahat: Winner[];
    keluarSebelumWaktu: Winner[];
    piket: Winner[];
}

const TAB_OPTIONS = [
    { value: 'mengambilIstirahat', label: 'Mengambil Waktu Istirahat', icon: 'bi-cup-hot', color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.1)' },
    { value: 'keluarSebelumWaktu', label: 'Keluar Sebelum Waktunya', icon: 'bi-box-arrow-right', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
    { value: 'jamKosong', label: 'Jam Kosong', icon: 'bi-calendar-x', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
    { value: 'terlambat', label: 'Terlambat', icon: 'bi-alarm', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.1)' },
    { value: 'penugasanTanpa', label: 'Tanpa Pendampingan', icon: 'bi-journal-x', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
    { value: 'penugasanDengan', label: 'Dengan Pendampingan', icon: 'bi-journal-check', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
    { value: 'digabung', label: 'Digabung', icon: 'bi-intersect', color: '#3083FF', bgColor: 'rgba(99, 102, 241, 0.1)' },
    { value: 'piket', label: 'Tidak Piket', icon: 'bi-shield-x', color: 'var(--n-muted)', bgColor: 'rgba(100, 116, 139, 0.1)' },
];

const MONTH_OPTIONS = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
];

export default function KinerjaGuruPage() {
    const [activeTab, setActiveTab] = useTabParam<'jamKosong' | 'penugasanTanpa' | 'penugasanDengan' | 'digabung' | 'terlambat' | 'daring' | 'mengambilIstirahat' | 'keluarSebelumWaktu' | 'piket'>('jamKosong', ['jamKosong', 'penugasanTanpa', 'penugasanDengan', 'digabung', 'terlambat', 'daring', 'mengambilIstirahat', 'keluarSebelumWaktu', 'piket']);
    const [data, setData] = useState<KinerjaGuruData>({ jamKosong: [], penugasanTanpa: [], penugasanDengan: [], digabung: [], terlambat: [], daring: [], mengambilIstirahat: [], keluarSebelumWaktu: [], piket: [] });
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Filter toolbar state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'Bulan' | 'Tahun'>('Bulan');

    // Default to current month & current year for Mode Bulan
    const [selectedMonthVal, setSelectedMonthVal] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
    const [selectedYearVal, setSelectedYearVal] = useState(() => String(new Date().getFullYear()));

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear; y >= currentYear - 3; y--) {
            years.push({ value: String(y), label: String(y) });
        }
        return years;
    }, []);

    // Academic Year & Semester state for Mode Tahun
    const [selectedTa, setSelectedTa] = useState('2026/2027');
    const [selectedSemester, setSelectedSemester] = useState<'' | 'Ganjil' | 'Genap'>('');
    const [taOptions, setTaOptions] = useState<string[]>(['2026/2027']);

    // Fetch master_tahun_ajaran (HANYA tahun ajaran yang aktif)
    useEffect(() => {
        fetch('/api/admin/tahun-ajaran')
            .then(res => res.json())
            .then(json => {
                if (json.ok && Array.isArray(json.data)) {
                    // Filter HANYA tahun ajaran yang aktif (is_active === true)
                    const activeItems = json.data.filter((item: any) => item.is_active === true);
                    const activeYears = [...new Set(activeItems.map((item: any) => item.tahun_ajaran).filter(Boolean))] as string[];
                    
                    if (activeYears.length > 0) {
                        setTaOptions(activeYears);
                        setSelectedTa(activeYears[0]);
                    } else {
                        // Fallback ke tahun ajaran pertama jika tidak ada flag active
                        const allYears = [...new Set(json.data.map((item: any) => item.tahun_ajaran).filter(Boolean))] as string[];
                        if (allYears.length > 0) {
                            setTaOptions([allYears[0]]);
                            setSelectedTa(allYears[0]);
                        }
                    }
                }
            })
            .catch(() => {});
    }, []);

    // Derive start_month and end_month for API query based on filterMode
    const { periodStart, periodEnd } = useMemo(() => {
        if (filterMode === 'Bulan') {
            const m = `${selectedYearVal}-${selectedMonthVal}`;
            return { periodStart: m, periodEnd: m };
        } else {
            const parts = selectedTa.split('/');
            const startYear = parseInt(parts[0], 10) || new Date().getFullYear();
            const endYear = parseInt(parts[1], 10) || (startYear + 1);

            if (selectedSemester === 'Ganjil') {
                return { periodStart: `${startYear}-07`, periodEnd: `${startYear}-12` };
            } else if (selectedSemester === 'Genap') {
                return { periodStart: `${endYear}-01`, periodEnd: `${endYear}-06` };
            } else {
                return { periodStart: `${startYear}-07`, periodEnd: `${endYear}-06` };
            }
        }
    }, [filterMode, selectedMonthVal, selectedYearVal, selectedTa, selectedSemester]);

    useEffect(() => {
        fetchAdminStatus();
    }, []);

    const fetchAdminStatus = async () => {
        try {
            const { getCurrentUser } = await import('@/lib/auth-client');
            const userData = await getCurrentUser();
            if (userData) {
                const roles = userData.roles || [];
                const normalizedRoles = roles.map((r: string) => r.toUpperCase().trim());
                const isAdminUser = normalizedRoles.includes('ADMIN') || normalizedRoles.includes('ADMINISTRATOR') || !!(userData as any).isAdmin;
                setIsAdmin(isAdminUser);
            }
        } catch (e) {
            console.error('Failed to fetch admin status:', e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (periodStart) params.set('start_month', periodStart);
            if (periodEnd) params.set('end_month', periodEnd);
            const res = await fetch(`/api/kinerja-guru?${params.toString()}`);
            const result = await res.json();
            if (result.success) {
                setData(result.data);
            }
        } catch (err) {
            console.error('Failed to fetch kinerja guru data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (periodStart && periodEnd) {
            fetchData();
        }
    }, [periodStart, periodEnd]);

    useEffect(() => {
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [periodStart, periodEnd]);

    const getCurrentList = () => {
        const rawList = data[activeTab] || [];
        if (!searchQuery.trim()) return rawList;
        const q = searchQuery.toLowerCase().trim();
        return rawList.filter(item =>
            (item.nama || '').toLowerCase().includes(q) ||
            (item.nip || '').toLowerCase().includes(q)
        );
    };

    const getAllTeachersCount = () => {
        const allTeacherKeys = new Set<string>();
        Object.values(data).forEach((categoryData: any[]) => {
            categoryData.forEach((item: any) => {
                if (item.nip || item.nama) {
                    allTeacherKeys.add(item.nip || item.nama);
                }
            });
        });
        return allTeacherKeys.size;
    };

    const getTabLabel = () => {
        switch (activeTab) {
            case 'jamKosong': return 'Jam Kosong';
            case 'penugasanTanpa': return 'Penugasan Tanpa Pendampingan';
            case 'penugasanDengan': return 'Penugasan Dengan Pendampingan';
            case 'digabung': return 'Digabung';
            case 'terlambat': return 'Terlambat';
            case 'daring': return 'Daring';
            case 'mengambilIstirahat': return 'Mengambil Waktu Istirahat';
            case 'keluarSebelumWaktu': return 'Keluar Sebelum Waktunya';
            case 'piket': return 'Tidak Piket';
            default: return '';
        }
    };

    const getTabConfig = () => {
        return TAB_OPTIONS.find(t => t.value === activeTab) || TAB_OPTIONS[0];
    };

    const currentList = getCurrentList();
    const top10 = currentList.slice(0, 10);
    const allTeachersCount = getAllTeachersCount();

    const [selectedTeacher, setSelectedTeacher] = useState<Winner | null>(null);
    const { registerModal } = useModalBlur();

    useEffect(() => {
        if (selectedTeacher) {
            return registerModal();
        }
    }, [selectedTeacher, registerModal]);

    const chartConfig = getTabConfig();
    const [chartStyle, setChartStyle] = useState({ grid: '#e2e8f0', xTicks: '#64748b', yTicks: '#1e293b' });

    useEffect(() => {
        const update = () => {
            const isDark = document.documentElement.classList.contains('dark');
            setChartStyle(isDark ? { grid: '#374151', xTicks: '#9ca3af', yTicks: '#ffffff' } : { grid: '#e2e8f0', xTicks: '#64748b', yTicks: '#1e293b' });
        };
        update();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') update();
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const chartData = {
        labels: top10.map(item => item.nama),
        datasets: [
            {
                label: getTabLabel(),
                data: top10.map(item => item.count),
                backgroundColor: top10.map((_, index) => {
                    if (index === 0) return chartConfig.color;
                    return `${chartConfig.color}80`;
                }),
                borderColor: chartConfig.color,
                borderWidth: 1,
                borderRadius: 6,
                barThickness: typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 32,
            },
        ],
    };

    const chartOptions: ChartOptions<'bar'> = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                left: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 10,
                right: 20
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#e8edf5',
                bodyColor: '#e8edf5',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    label: (context) => {
                        const unit = (activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu') ? ' Menit' : 'x';
                        return `${context.parsed.x}${unit} ${getTabLabel()}`;
                    },
                },
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                grid: { color: chartStyle.grid },
                border: { display: false },
                ticks: { color: chartStyle.xTicks, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: chartStyle.yTicks,
                    autoSkip: false,
                    font: { size: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 12, weight: 'bold' },
                    padding: 8,
                    callback: function(value) {
                        let label = this.getLabelForValue(value as number);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                            label = label.split(',')[0];
                            if (label.length > 18) return label.substring(0, 17) + '...';
                        }
                        return label;
                    }
                },
            },
        },
    };

    return (
        <MaintenanceBanner pageKey="maintenance_kinerja_guru" isAdmin={isAdmin}>
            <div className="kinerja-guru-page kg-scope">
                <KinerjaGuruDetailModal
                    isOpen={!!selectedTeacher}
                    onClose={() => setSelectedTeacher(null)}
                    teacherName={selectedTeacher?.nama || ''}
                    details={selectedTeacher?.details || []}
                    category={activeTab}
                />

                

                <FilterToolbar>
                    <FilterSelect
                        label="Mode"
                        icon="sliders"
                        value={filterMode}
                        onChange={(val) => setFilterMode(val as 'Bulan' | 'Tahun')}
                        options={[
                            { value: 'Bulan', label: 'Bulan' },
                            { value: 'Tahun', label: 'Tahun' },
                        ]}
                        width="140px"
                    />

                    {filterMode === 'Bulan' ? (
                        <>
                            <FilterSelect
                                label="Bulan"
                                icon="calendar-month"
                                value={selectedMonthVal}
                                onChange={setSelectedMonthVal}
                                options={MONTH_OPTIONS}
                                width="160px"
                            />
                            <FilterSelect
                                label="Tahun"
                                icon="calendar"
                                value={selectedYearVal}
                                onChange={setSelectedYearVal}
                                options={yearOptions}
                                width="120px"
                            />
                        </>
                    ) : (
                        <>
                            <FilterSelect
                                label="Tahun Ajaran"
                                icon="mortarboard"
                                value={selectedTa}
                                onChange={setSelectedTa}
                                options={taOptions.map(ta => ({ value: ta, label: `TA ${ta}` }))}
                                width="180px"
                            />

                            <FilterSelect
                                label="Semester"
                                icon="calendar2-week"
                                value={selectedSemester}
                                onChange={(val) => setSelectedSemester(val as '' | 'Ganjil' | 'Genap')}
                                options={[
                                    { value: '', label: 'Semua Semester' },
                                    { value: 'Ganjil', label: 'Semester Ganjil' },
                                    { value: 'Genap', label: 'Semester Genap' },
                                ]}
                                width="180px"
                            />
                        </>
                    )}

                    <FilterSelect
                        label="Kategori"
                        icon="grid"
                        value={activeTab}
                        onChange={(val) => setActiveTab(val as any)}
                        options={[
                            { value: 'jamKosong', label: 'Jam Kosong' },
                            { value: 'mengambilIstirahat', label: 'Mengambil Waktu Istirahat' },
                            { value: 'keluarSebelumWaktu', label: 'Keluar Sebelum Waktunya' },
                            { value: 'terlambat', label: 'Terlambat' },
                            { value: 'penugasanTanpa', label: 'Tanpa Pendampingan' },
                            { value: 'penugasanDengan', label: 'Dengan Pendampingan' },
                            { value: 'digabung', label: 'Digabung' },
                            { value: 'piket', label: 'Tidak Piket' },
                        ]}
                        width="220px"
                    />

                    <FilterSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Cari Nama / NIP Guru..."
                    />
                </FilterToolbar>

                {/* Summary Cards */}
                <div className="summary-cards">
                    <div className="summary-card" style={{ borderLeftColor: chartConfig.color }}>
                        <div className="summary-icon" style={{ background: chartConfig.bgColor, color: chartConfig.color }}>
                            <i className={`bi ${chartConfig.icon}`}></i>
                        </div>
                        <div className="summary-content">
                            <span className="summary-value">{allTeachersCount}</span>
                            <span className="summary-label">Total Guru</span>
                        </div>
                    </div>

                    <div className="summary-card hide-on-mobile" style={{ borderLeftColor: '#3b82f6' }}>
                        <div className="summary-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                            <i className="bi bi-list-ol"></i>
                        </div>
                        <div className="summary-content">
                            <span className="summary-value">{top10.length}</span>
                            <span className="summary-label">Dalam Chart</span>
                        </div>
                    </div>

                    {top10[0] && (
                        <div className="summary-card top-performer" style={{ borderLeftColor: chartConfig.color }}>
                            <div className="summary-icon" style={{ background: `${chartConfig.color}20`, color: chartConfig.color }}>
                                <i className="bi bi-person-fill"></i>
                            </div>
                            <div className="summary-content">
                                <span className="summary-value top-name">{top10[0].nama.split(' ').slice(0, 2).join(' ')}</span>
                                <span className="summary-label">
                                    Peringkat 1 ({top10[0].count}{activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu' ? ' Menit' : 'x'})
                                    {top10[0].total_jp > 0 && activeTab !== 'piket' && ` • ${activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu' ? `${top10[0].total_jp * 40} Mnt (${top10[0].total_jp} JP)` : `${top10[0].total_jp} JP`}`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Note Banner */}
                {activeTab !== 'piket' && (
                    <div className="note-banner">
                        <i className="bi bi-info-circle-fill"></i>
                        <span>
                            {activeTab === 'penugasanTanpa'
                                ? 'Mulai tahun ajaran 2026/2027, setiap penugasan yang diberikan tanpa disertai LKPD akan dikategorikan sebagai Jam Kosong. Jika Bapak/Ibu merasa data tersebut tidak sesuai, silakan ajukan banding melalui halaman Jurnal.'
                                : 'Jika Bapak/Ibu merasa data tersebut tidak sesuai, silakan ajukan banding melalui halaman Jurnal.'}
                        </span>
                    </div>
                )}

                {/* Chart Section */}
                <div className="chart-section">
                    <div className="chart-header">
                        <div className="chart-title">
                            <i className={`bi ${chartConfig.icon}`} style={{ color: chartConfig.color }}></i>
                            <h2>{getTabLabel()}</h2>
                        </div>
                        <span className="chart-subtitle">Top 10 Guru</span>
                    </div>

                    {loading ? (
                        <div className="loading-state">
                            <Spinner size={36} />
                        </div>
                    ) : top10.length > 0 ? (
                        <div className="chart-container">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    ) : (
                        <div className="empty-state">
                            <i className="bi bi-inbox"></i>
                            <p>Belum ada data untuk kategori ini</p>
                        </div>
                    )}
                </div>

                {/* Table Section */}
                {top10.length > 0 && (
                    <div className="table-section">
                        <div className="table-header">
                            <h3><i className="bi bi-table"></i> Detail Peringkat</h3>
                        </div>
                        <div className="table-container">
                            <table className="desktop-only">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Peringkat</th>
                                        <th style={{ width: '30%' }}>Nama Guru</th>
                                        <th style={{ width: '160px' }}>
                                            {activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu' ? 'Total Durasi' : 'Jumlah Kejadian'}
                                        </th>
                                        {activeTab !== 'piket' && <th style={{ width: '150px' }}>Total JP</th>}
                                        <th style={{ textAlign: 'center', width: '130px' }}>Izin / Sakit</th>
                                        {activeTab !== 'piket' && <th style={{ width: '25%' }}>Persentase</th>}
                                        <th style={{ textAlign: 'center', width: '90px' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {top10.map((item, index) => {
                                        const totalJP = item.total_jp || 0;
                                        const count = item.count || 0;
                                        const percentage = totalJP > 0
                                            ? (activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu')
                                                ? ((count / (totalJP * 40)) * 100).toFixed(1)
                                                : ((count / totalJP) * 100).toFixed(1)
                                            : '0.0';
                                        const percentageNum = parseFloat(percentage);
                                        const pctColor = percentageNum > 50 ? '#ef4444' : percentageNum > 25 ? '#f59e0b' : '#10b981';

                                        const categoryDetails = (item.details || []).filter((d: any) => {
                                            if (activeTab === 'jamKosong') return d.type === 'Jam Kosong';
                                            if (activeTab === 'penugasanTanpa') return d.type === 'Tanpa Pendampingan';
                                            if (activeTab === 'penugasanDengan') return d.type === 'Dengan Pendampingan';
                                            if (activeTab === 'digabung') return d.type === 'Digabung';
                                            if (activeTab === 'terlambat') return d.type === 'Terlambat';
                                            if (activeTab === 'mengambilIstirahat') return d.type === 'Mengambil Waktu Istirahat';
                                            if (activeTab === 'keluarSebelumWaktu') return d.type === 'Keluar Sebelum Waktunya';
                                            if (activeTab === 'piket') return d.type === 'Tidak Piket';
                                            return true;
                                        });
                                        const berizinCount = categoryDetails.filter((d: any) => d.izin && d.izin.status === 'disetujui').length;

                                        return (
                                            <tr key={`${item.nip}-${item.nama}-${index}`}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                                                        {index + 1}
                                                    </span>
                                                </td>
                                                <td className="name-cell">{item.nama}</td>
                                                <td className="count-cell">
                                                    <span className="count-badge" style={{ background: index === 0 ? chartConfig.bgColor : 'var(--n-soft)', color: index === 0 ? chartConfig.color : 'var(--n-muted)' }}>
                                                        {count}{activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu' ? ' Menit' : 'x'}
                                                    </span>
                                                </td>
                                                {activeTab !== 'piket' && (
                                                    <td className="jp-cell">
                                                        <span className="jp-badge">
                                                            {activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu' 
                                                                ? `${totalJP * 40} Menit (${totalJP} JP)` 
                                                                : `${totalJP} JP`}
                                                        </span>
                                                    </td>
                                                )}
                                                <td style={{ textAlign: 'center' }}>
                                                    {berizinCount > 0 ? (
                                                        <span className="kg-main-izin-badge" title={`${berizinCount} insiden memiliki izin resmi (disetujui)`}>
                                                            <i className="bi bi-file-earmark-check"></i> {berizinCount} Berizin
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--n-muted)', fontWeight: 600 }}>-</span>
                                                    )}
                                                </td>
                                                {activeTab !== 'piket' && (
                                                    <td className="percentage-cell">
                                                        <div className="percentage-bar-container">
                                                            <div className="percentage-bar" style={{ width: `${Math.min(percentageNum, 100)}%`, background: pctColor }}></div>
                                                        </div>
                                                        <span className="percentage-text" style={{ color: pctColor }}>{percentage}%</span>
                                                    </td>
                                                )}
                                                <td style={{ textAlign: 'center' }}>
                                                    <ActionGroup align="center">
                                                        <ActionButton
                                                            action="view"
                                                            size="sm"
                                                            onClick={() => setSelectedTeacher(item)}
                                                            title="Detail Insiden"
                                                        />
                                                    </ActionGroup>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Mobile Card List */}
                            <div className="card-list mobile-only">
                                {top10.map((item, index) => {
                                    const totalJP = item.total_jp || 0;
                                    const count = item.count || 0;
                                    const percentage = totalJP > 0
                                        ? (activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu')
                                            ? ((count / (totalJP * 40)) * 100).toFixed(1)
                                            : ((count / totalJP) * 100).toFixed(1)
                                        : '0.0';
                                    const percentageNum = parseFloat(percentage);
                                    const pctColor = percentageNum > 50 ? '#ef4444' : percentageNum > 25 ? '#f59e0b' : '#10b981';

                                    const categoryDetails = (item.details || []).filter((d: any) => {
                                        if (activeTab === 'jamKosong') return d.type === 'Jam Kosong';
                                        if (activeTab === 'penugasanTanpa') return d.type === 'Tanpa Pendampingan';
                                        if (activeTab === 'penugasanDengan') return d.type === 'Dengan Pendampingan';
                                        if (activeTab === 'digabung') return d.type === 'Digabung';
                                        if (activeTab === 'terlambat') return d.type === 'Terlambat';
                                        if (activeTab === 'mengambilIstirahat') return d.type === 'Mengambil Waktu Istirahat';
                                        if (activeTab === 'keluarSebelumWaktu') return d.type === 'Keluar Sebelum Waktunya';
                                        if (activeTab === 'piket') return d.type === 'Tidak Piket';
                                        return true;
                                    });
                                    const berizinCount = categoryDetails.filter((d: any) => d.izin && d.izin.status === 'disetujui').length;

                                    return (
                                        <div className="card-item" key={`${item.nip}-${item.nama}-${index}`}>
                                            <div className={`card-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}`}>
                                                {index + 1}
                                            </div>
                                            <div className="card-info">
                                                <div className="card-name">{item.nama}</div>
                                                <div className="card-meta">
                                                    {activeTab === 'terlambat' ? 'Total Durasi' : 'Jumlah'}: {count}{activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu' ? ' Menit' : 'x'}
                                                    {activeTab !== 'piket' && ` • ${activeTab === 'terlambat' || activeTab === 'keluarSebelumWaktu' ? `${totalJP * 40} Mnt (${totalJP} JP)` : `${totalJP} JP`}`}
                                                    {berizinCount > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}> • {berizinCount} Berizin</span>}
                                                </div>
                                                {activeTab !== 'piket' && (
                                                    <div className="card-pct" style={{ color: pctColor }}>{percentage}%</div>
                                                )}
                                            </div>
                                            <ActionGroup align="right">
                                                <ActionButton
                                                    action="view"
                                                    size="sm"
                                                    onClick={() => setSelectedTeacher(item)}
                                                    title="Detail Insiden"
                                                />
                                            </ActionGroup>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </MaintenanceBanner>
    );
}
