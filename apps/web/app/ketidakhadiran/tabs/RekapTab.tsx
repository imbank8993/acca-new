'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
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
import ModalPortal from '@/components/ui/ModalPortal';
import { formatJpDurasi } from '@/lib/ketidakhadiran-jp';

import { ActionButton } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import DetailHeader from '@/components/ui/DetailHeader';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Semua field durasi di bawah bersatuan MENIT — API merekapnya dari selisih
// tgl+waktu riil, jadi izin 08:00–17:00 = 540 menit (9 jam), bukan 1 hari.
interface RekapStudent {
    nisn: string;
    nama: string;
    kelas: string;
    izin_menit?: number;
    sakit_menit?: number;
    // Breakdown for Izin
    izin_madrasah?: number;
    izin_personal?: number;
    // Breakdown for Sakit
    sakit_ringan?: number;
    sakit_sedang?: number;
    sakit_berat?: number;
    sakit_kontrol?: number;
    izin_entries?: any[];
    sakit_entries?: any[];
    rank: number;
}

// 1 JP = 1 jam (60 menit); 24 JP = 1 hari — satuan yang sama dipakai di semua
// rekap ketidakhadiran lain (lihat lib/ketidakhadiran-jp.ts).
function formatDurasi(menit: number): string {
    return formatJpDurasi(menit / 60);
}

function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Nilai batang chart: JP (jam), supaya izin setengah hari tetap terbandingkan
function menitKeJam(menit: number): number {
    return Math.round((menit / 60) * 10) / 10;
}

interface RekapTabProps {
    type: 'izin' | 'sakit';
}

const REFRESH_INTERVAL = 60000;

// Status breakdown options
const IZIN_STATUS_OPTIONS = [
    { value: 'all', label: 'Semua', color: '#059669', bgColor: 'rgba(5, 150, 105, 0.1)' },
    { value: 'madrasah', label: 'Madrasah', color: '#0891b2', bgColor: 'rgba(8, 145, 178, 0.1)' },
    { value: 'personal', label: 'Personal', color: '#3083FF', bgColor: 'rgba(0, 56, 168, 0.1)' },
];

const SAKIT_STATUS_OPTIONS = [
    { value: 'all', label: 'Semua', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
    { value: 'ringan', label: 'Ringan', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
    { value: 'sedang', label: 'Sedang', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' },
    { value: 'berat', label: 'Berat', color: '#ea580c', bgColor: 'rgba(234, 88, 12, 0.15)' },
    { value: 'kontrol', label: 'Kontrol', color: '#3083FF', bgColor: 'rgba(99, 102, 241, 0.15)' },
];

// Generate academic year options (current year to 5 years back)
function getTahunAjaranOptions() {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        options.push(`${year}/${year + 1}`);
    }
    return options;
}

const BULAN_OPTIONS = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
];

const SEMESTER_OPTIONS = [
    { value: '1', label: 'Semester 1 (Jul - Des)' },
    { value: '2', label: 'Semester 2 (Jan - Jun)' },
];

export default function RekapTab({ type }: RekapTabProps) {
    const [apiResult, setApiResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<RekapStudent | null>(null);

    // Filter state
    const [filterType, setFilterType] = useState<'bulan' | 'semester' | 'tahun' | 'custom'>('bulan');

    // Status breakdown state
    const [subStatus, setSubStatus] = useState<'all' | 'madrasah' | 'personal' | 'ringan' | 'sedang' | 'berat' | 'kontrol'>('all');

    const isIzin = type === 'izin';

    const [searchQuery, setSearchQuery] = useState('');

    // Dynamically derive current ranked data based on selected subStatus
    const data = useMemo<RekapStudent[]>(() => {
        if (!apiResult) return [];
        if (isIzin) {
            if (subStatus === 'madrasah') return apiResult.izin_madrasah || [];
            if (subStatus === 'personal') return apiResult.izin_personal || [];
            return apiResult.izin || [];
        } else {
            if (subStatus === 'ringan') return apiResult.sakit_ringan || [];
            if (subStatus === 'sedang') return apiResult.sakit_sedang || [];
            if (subStatus === 'berat') return apiResult.sakit_berat || [];
            if (subStatus === 'kontrol') return apiResult.sakit_kontrol || [];
            return apiResult.sakit || [];
        }
    }, [apiResult, isIzin, subStatus]);

    const filteredData = useMemo<RekapStudent[]>(() => {
        if (!data) return [];
        if (!searchQuery.trim()) return data;
        const q = searchQuery.toLowerCase();
        return data.filter(item =>
            (item.nama && item.nama.toLowerCase().includes(q)) ||
            (item.nisn && item.nisn.toLowerCase().includes(q)) ||
            (item.kelas && item.kelas.toLowerCase().includes(q))
        );
    }, [data, searchQuery]);

    const top10 = filteredData.slice(0, 10);
    const [tahunAjaran, setTahunAjaran] = useState(() => {
        const currentYear = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
        return `${currentYear}/${currentYear + 1}`;
    });
    const [semester, setSemester] = useState(() => {
        const currentMonth = new Date().getMonth() + 1;
        return currentMonth >= 7 ? '1' : '2';
    });
    const [tahun, setTahun] = useState(() => new Date().getFullYear().toString());
    const [bulan, setBulan] = useState(() => (new Date().getMonth() + 1).toString());
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');


    const statusOptions = isIzin ? IZIN_STATUS_OPTIONS : SAKIT_STATUS_OPTIONS;
    const currentStatus = statusOptions.find(s => s.value === subStatus) || statusOptions[0];
    const color = currentStatus.color;
    const bgColor = currentStatus.bgColor;
    const icon = isIzin ? 'bi-brightness-alt-high-fill' : 'bi-thermometer-half';
    const label = isIzin ? 'Izin' : 'Sakit';

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('filter_type', filterType);

            if (filterType === 'bulan') {
                params.set('tahun', tahun);
                params.set('bulan', bulan);
            } else if (filterType === 'semester') {
                params.set('tahun_ajaran', tahunAjaran);
                params.set('semester', semester);
            } else if (filterType === 'tahun') {
                params.set('tahun_ajaran', tahunAjaran);
            } else if (filterType === 'custom') {
                if (customFrom) params.set('from', customFrom);
                if (customTo) params.set('to', customTo);
            }

            const res = await fetch(`/api/ketidakhadiran/rekap?${params.toString()}`);
            const result = await res.json();
            if (result.success) {
                setApiResult(result);
            }
        } catch (err) {
            console.error('Failed to fetch rekap data:', err);
        } finally {
            setLoading(false);
        }
    }, [filterType, tahunAjaran, semester, tahun, bulan, customFrom, customTo, isIzin]);

    const handleFilterTypeChange = (newFilterType: 'bulan' | 'semester' | 'tahun' | 'custom') => {
        setFilterType(newFilterType);
        // Reset other filters when switching
        if (newFilterType === 'bulan') {
            setBulan((new Date().getMonth() + 1).toString());
            setTahun(new Date().getFullYear().toString());
        } else if (newFilterType === 'semester') {
            const currentMonth = new Date().getMonth() + 1;
            setSemester(currentMonth >= 7 ? '1' : '2');
            const currentYear = currentMonth >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1;
            setTahunAjaran(`${currentYear}/${currentYear + 1}`);
        } else if (newFilterType === 'tahun') {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = currentMonth >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1;
            setTahunAjaran(`${currentYear}/${currentYear + 1}`);
        }
    };

    const handleSubStatusChange = (newStatus: 'all' | 'madrasah' | 'personal' | 'ringan' | 'sedang' | 'berat' | 'kontrol') => {
        setSubStatus(newStatus);
    };

    const resetFilters = () => {
        handleFilterTypeChange('bulan');
        setCustomFrom('');
        setCustomTo('');
    };

    const getFilterLabel = () => {
        if (filterType === 'bulan') {
            const bulanName = BULAN_OPTIONS.find(b => b.value === bulan)?.label || '';
            return `${bulanName} ${tahun}`;
        } else if (filterType === 'semester') {
            return `Semester ${semester} TA ${tahunAjaran}`;
        } else if (filterType === 'tahun') {
            return `TA ${tahunAjaran}`;
        }
        return 'Kustom';
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    const [chartStyle, setChartStyle] = useState({ grid: '#e2e8f0', xTicks: '#64748b', yTicks: '#1e293b' });

    useEffect(() => {
        const update = () => {
            const isDark = document.documentElement.classList.contains('dark');
            setChartStyle(isDark ? { grid: '#374151', xTicks: '#9ca3af', yTicks: '#ffffff' } : { grid: '#e2e8f0', xTicks: '#64748b', yTicks: '#1e293b' });
        };

        update();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    update();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    // Entri disaring mengikuti subStatus, supaya daftar riwayat konsisten
    // dengan total durasi yang juga sudah difilter per status.
    const getEntries = (student: RekapStudent) => {
        const entries = (isIzin ? student.izin_entries : student.sakit_entries) || [];
        if (subStatus === 'all') return entries;
        return entries.filter(e => (e.status || '').toUpperCase().trim() === subStatus.toUpperCase());
    };

    // Total durasi (menit) sesuai subStatus yang dipilih
    const getMenit = (student: RekapStudent) => {
        if (isIzin) {
            if (subStatus === 'madrasah') return student.izin_madrasah || 0;
            if (subStatus === 'personal') return student.izin_personal || 0;
            return student.izin_menit || 0;
        } else {
            if (subStatus === 'ringan') return student.sakit_ringan || 0;
            if (subStatus === 'sedang') return student.sakit_sedang || 0;
            if (subStatus === 'berat') return student.sakit_berat || 0;
            if (subStatus === 'kontrol') return student.sakit_kontrol || 0;
            return student.sakit_menit || 0;
        }
    };

    const chartData = {
        labels: top10.map(item => item.nama),
        datasets: [
            {
                label: `Top 10 Siswa ${label}`,
                data: top10.map(item => menitKeJam(getMenit(item))),
                backgroundColor: top10.map((_, index) => {
                    if (index === 0) return color;
                    return `${color}80`;
                }),
                borderColor: color,
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
                        const student = top10[context.dataIndex];
                        return `${label}: ${formatDurasi(getMenit(student))}`;
                    },
                },
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Durasi (JP)',
                    color: chartStyle.xTicks,
                    font: { size: 10 },
                },
                grid: { color: chartStyle.grid },
                border: { display: false },
                ticks: {
                    color: chartStyle.xTicks,
                    font: { size: 10 },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 6,
                },
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: chartStyle.yTicks,
                    autoSkip: false,
                    font: {
                        size: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 12,
                        weight: 'bold',
                    },
                    padding: 8,
                    callback: function(value, index) {
                        let label = this.getLabelForValue(value as number);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                            if (label.length > 18) {
                                return label.substring(0, 17) + '...';
                            }
                        }
                        return label;
                    }
                },
            },
        },
    };


    return (
        <div className="rekap-tab">
            {/* Standard FilterToolbar */}
            <FilterToolbar className="rekap-toolbar">
                <FilterSearch
                    label="Cari Siswa"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari nama / NISN..."
                    grow={2}
                />
                <FilterSelect
                    label="Periode"
                    icon="calendar-event"
                    value={filterType}
                    onChange={(val) => handleFilterTypeChange(val as 'bulan' | 'semester' | 'tahun' | 'custom')}
                    options={[
                        { value: 'bulan', label: 'Per Bulan' },
                        { value: 'semester', label: 'Per Semester' },
                        { value: 'tahun', label: 'Per Tahun' },
                        { value: 'custom', label: 'Kustom Tanggal' },
                    ]}
                />

                {filterType === 'bulan' && (
                    <>
                        <FilterSelect
                            label="Bulan"
                            value={bulan}
                            onChange={setBulan}
                            options={BULAN_OPTIONS.map(b => ({ value: b.value, label: b.label }))}
                        />
                        <FilterSelect
                            label="Tahun"
                            value={tahun}
                            onChange={setTahun}
                            options={[...Array(5)].map((_, i) => {
                                const y = String(new Date().getFullYear() - i);
                                return { value: y, label: y };
                            })}
                        />
                    </>
                )}

                {filterType === 'semester' && (
                    <>
                        <FilterSelect
                            label="Tahun Ajaran"
                            value={tahunAjaran}
                            onChange={setTahunAjaran}
                            options={getTahunAjaranOptions().map(ta => ({ value: ta, label: ta }))}
                        />
                        <FilterSelect
                            label="Semester"
                            value={semester}
                            onChange={setSemester}
                            options={SEMESTER_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
                        />
                    </>
                )}

                {filterType === 'tahun' && (
                    <FilterSelect
                        label="Tahun Ajaran"
                        value={tahunAjaran}
                        onChange={setTahunAjaran}
                        options={getTahunAjaranOptions().map(ta => ({ value: ta, label: ta }))}
                    />
                )}

                {filterType === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DatePicker value={customFrom} onChange={setCustomFrom} />
                        <span style={{ color: 'var(--n-muted)' }}>—</span>
                        <DatePicker value={customTo} onChange={setCustomTo} />
                    </div>
                )}

                <FilterSelect
                    label="Status"
                    value={subStatus}
                    onChange={(val) => handleSubStatusChange(val as typeof subStatus)}
                    options={statusOptions.map(opt => ({
                        value: opt.value,
                        label: opt.value === 'all' ? 'Semua Status' : opt.label,
                    }))}
                />
            </FilterToolbar>

            {/* Summary Cards */}
            <div className="rekap-summary">
                <div className="summary-card" style={{ borderLeftColor: color }}>
                    <div className="summary-icon" style={{ background: bgColor, color }}>
                        <i className={`bi ${icon}`}></i>
                    </div>
                    <div className="summary-content">
                        <span className="summary-value">{filteredData.length}</span>
                        <span className="summary-label">Total Siswa {label}</span>
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
                    <div className="summary-card top-performer" style={{ borderLeftColor: color }}>
                        <div className="summary-icon" style={{ background: `${color}20`, color }}>
                            <i className="bi bi-person-fill"></i>
                        </div>
                        <div className="summary-content">
                            <span className="summary-value top-name">{top10[0].nama.split(' ').slice(0, 2).join(' ')}</span>
                            <span className="summary-label">Peringkat 1 ({formatDurasi(getMenit(top10[0]))})</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Chart Section */}
            <div className="chart-section">
                <div className="chart-header">
                    <div className="chart-title">
                        <i className={`bi ${icon}`} style={{ color }}></i>
                        <h2>Chart {label}</h2>
                    </div>
                    <span className="chart-subtitle">Top 10 Siswa · {getFilterLabel()}</span>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Spinner size={34} />
                    </div>
                ) : top10.length > 0 ? (
                    <div className="chart-container">
                        <Bar data={chartData} options={chartOptions} />
                    </div>
                ) : (
                    <div className="empty-state">
                        <i className="bi bi-inbox"></i>
                        <p>Belum ada data {label.toLowerCase()} untuk periode ini</p>
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
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center', width: '100px' }}>Peringkat</th>
                                    <th>Nama Siswa</th>
                                    <th style={{ textAlign: 'center' }}>Kelas</th>
                                    <th style={{ textAlign: 'center' }}>Total Durasi</th>
                                    <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {top10.map((item, index) => (
                                    <tr key={`${item.nisn}-${index}`}>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                                                {index + 1}
                                            </span>
                                        </td>
                                        <td className="name-cell">{item.nama}</td>
                                        <td className="kelas-cell" style={{ textAlign: 'center' }}>{item.kelas}</td>
                                        <td className="count-cell" style={{ textAlign: 'center' }}>
                                            <span className="count-badge" style={{ background: index === 0 ? bgColor : '#f1f5f9', color: index === 0 ? color : '#64748b' }}>
                                                {formatDurasi(getMenit(item))}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <ActionButton
                                                action="view"
                                                size="sm"
                                                onClick={() => setSelectedStudent(item)}
                                                label="Detail"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* Mobile Card List */}
                        <div className="card-list">
                            {top10.map((item, index) => (
                                <div className="card-item" key={`${item.nisn}-${index}`}>
                                    <div className={`card-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}`}>
                                        {index + 1}
                                    </div>
                                    <div className="card-info">
                                        <div className="card-name">{item.nama}</div>
                                        <div className="card-meta">{item.kelas}</div>
                                    </div>
                                    <div className="card-count" style={{ background: index === 0 ? bgColor : '#f1f5f9', color: index === 0 ? color : '#64748b' }}>
                                        {formatDurasi(getMenit(item))}
                                    </div>
                                    <div className="card-action">
                                        <ActionButton
                                            action="view"
                                            size="sm"
                                            onClick={() => setSelectedStudent(item)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedStudent && (
                <Modal size="lg" onClose={() => setSelectedStudent(null)} labelledBy="rekap-student-detail-title">
                    <ModalHeader
                        id="rekap-student-detail-title"
                        icon={isIzin ? 'brightness-alt-high-fill' : 'thermometer-half'}
                        title={`Detail ${label}`}
                        onClose={() => setSelectedStudent(null)}
                    />
                    <ModalBody>
                        <DetailHeader
                            name={selectedStudent.nama}
                            meta={`NISN ${selectedStudent.nisn} · Kelas ${selectedStudent.kelas}`}
                        />
                        <div className="student-info" style={{ marginTop: '12px' }}>
                            <span><strong>Total {label}:</strong> {formatDurasi(getMenit(selectedStudent))}</span>
                            <span><strong>Kejadian:</strong> {getEntries(selectedStudent)?.length || 0} kali</span>
                        </div>
                        <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>Riwayat {label}</h4>
                        <div className="entry-list">
                            {getEntries(selectedStudent)?.map((entry: any, idx: number) => (
                                <div key={idx} className="entry-item" style={{ borderLeftColor: color }}>
                                    <div className="entry-header">
                                        <div className="entry-date-badge">
                                            <i className="bi bi-calendar3"></i>
                                            <span>{formatDate(entry.tgl_mulai)}{entry.tgl_mulai !== entry.tgl_selesai ? ` — ${formatDate(entry.tgl_selesai)}` : ''}</span>
                                            {entry.waktu_mulai_real && entry.waktu_selesai_real && (
                                                // Entri kontinu: jamnya batas rentang lintas hari (panah),
                                                // bukan jam yang berulang tiap hari (en dash)
                                                <span className="entry-time">
                                                    {entry.waktu_mulai_real.substring(0, 5)}{entry.is_kontinu ? ' → ' : '–'}{entry.waktu_selesai_real.substring(0, 5)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="entry-count-badge" style={{ background: bgColor, color }}>
                                            {formatDurasi(entry.menit)}
                                        </span>
                                    </div>
                                    <div className="entry-keterangan">
                                        <i className="bi bi-card-text"></i>
                                        <span>{entry.keterangan || '—'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => setSelectedStudent(null)} leftIcon={<i className="bi bi-x-lg" />}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .rekap-tab {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    animation: fadeIn 0.4s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Unified Toolbar */
                .rekap-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: var(--n-card);
                    padding: 10px 14px;
                    border-radius: 16px;
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                    box-shadow: 0 4px 14px rgba(0,0,0,0.03);
                    flex-wrap: wrap;
                }
                .toolbar-section {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: rgba(26, 115, 232, 0.25);
                }
                .toolbar-spacer { flex: 1; min-width: 10px; }
                .toolbar-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .action-btn {
                    width: 34px;
                    height: 34px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--n-card);
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 1rem;
                }
                .action-btn:hover:not(:disabled) {
                    background: rgba(26, 115, 232, 0.08);
                    color: ${color};
                    border-color: ${color};
                    transform: translateY(-1px);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .action-btn i.spinning {
                    display: inline-block;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .period-select-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #f8fafc;
                    padding: 0 4px 0 12px !important;
                    border-radius: 12px;
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                    height: 42px !important;
                    box-sizing: border-box !important;
                }
                .period-select-icon { color: #1d6bf3; font-size: 0.85rem; }
                .period-select {
                    border: none !important;
                    background: transparent !important;
                    padding: 0 32px 0 4px !important;
                    color: var(--n-ink);
                    font-weight: 700;
                    height: 42px !important;
                }
                .filter-row {
                    display: flex;
                    gap: 8px;
                }
                .filter-select {
                    padding: 0 32px 0 14px !important;
                    border-radius: 12px;
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                    background: var(--n-card);
                    color: var(--n-ink);
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    outline: none;
                    height: 42px !important;
                    box-sizing: border-box !important;
                }
                .date-range {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #f8fafc;
                    padding: 0 12px !important;
                    border-radius: 12px;
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                    height: 42px !important;
                    box-sizing: border-box !important;
                }
                .date-range input {
                    border: none;
                    background: transparent;
                    font-size: 0.78rem;
                    color: var(--n-ink);
                    font-weight: 600;
                    outline: none;
                }
                .date-sep { color: var(--n-muted); font-size: 0.7rem; }

                .status-select {
                    padding: 0 32px 0 14px !important;
                    border-radius: 12px;
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                    background: var(--n-card);
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                    outline: none;
                    height: 42px !important;
                    box-sizing: border-box !important;
                }

                /* Summary Cards */
                .rekap-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                }
                .summary-card {
                    background: var(--n-card);
                    border-radius: 16px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                    border-left: 4px solid;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.03);
                }
                .summary-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    flex-shrink: 0;
                }
                .summary-content {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }
                .summary-value {
                    font-size: 1.6rem;
                    font-weight: 800;
                    color: #1d6bf3;
                    line-height: 1.2;
                }
                .summary-label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    margin-top: 2px;
                }
                .top-name {
                    font-size: 1rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 150px;
                }

                /* Chart Section */
                .chart-section {
                    background: var(--n-card);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.03);
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                }
                .chart-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                .chart-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .chart-title i {
                    font-size: 1.4rem;
                }
                .chart-title h2 {
                    font-size: 1.1rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--n-ink);
                }
                .chart-subtitle {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #1d6bf3;
                    background: #eff6ff;
                    padding: 4px 12px;
                    border-radius: 99px;
                }
                .chart-container {
                    height: 400px;
                    position: relative;
                    overflow: hidden;
                    padding-left: 4px;
                }

                /* Loading & Empty */
                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 300px;
                    color: var(--n-muted);
                }
                .spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid var(--n-border);
                    border-top-color: ${color};
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 12px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 250px;
                    color: var(--n-muted);
                }
                .empty-state i {
                    font-size: 3.5rem;
                    margin-bottom: 12px;
                }
                .empty-state p {
                    font-size: 0.95rem;
                    margin: 0;
                }

                /* Table Section */
                .table-section {
                    background: var(--n-card);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.03);
                    border: 1.8px solid rgba(26, 115, 232, 0.45);
                }
                .table-header {
                    padding: 16px 20px;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.2);
                }
                .table-header h3 {
                    font-size: 1rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--n-ink);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .table-header h3 i {
                    color: #1d6bf3;
                }
                .table-container {
                    overflow-x: auto;
                }
                .card-list {
                    display: none;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th {
                    background: linear-gradient(135deg, #f0f7ff 0%, #e8f2fe 100%);
                    padding: 14px 16px;
                    text-align: left;
                    font-weight: 700;
                    font-size: 0.75rem;
                    color: #1e40af;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.2);
                }
                td {
                    padding: 14px 16px;
                    border-top: 1px solid rgba(26, 115, 232, 0.15);
                    font-size: 0.875rem;
                    color: var(--n-ink);
                }
                tr:hover td {
                    background: #fafafa;
                }
                .rank-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    font-weight: 700;
                    font-size: 0.8rem;
                    color: white;
                    margin: 0 auto;
                }
                .rank-badge.gold { background: #f59e0b; }
                .rank-badge.silver { background: #9ca3af; }
                .rank-badge.bronze { background: #d97706; }
                .name-cell {
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 200px;
                }
                .kelas-cell {
                    white-space: nowrap;
                }
                .count-cell {
                    white-space: nowrap;
                }
                .count-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-weight: 700;
                    font-size: 0.8rem;
                }
                .detail-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    background: var(--n-soft);
                    border: none;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .detail-btn:hover {
                    background: #e2e8f0;
                    color: var(--n-ink);
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    padding: 20px;
                }
                .modal-content {
                    background: var(--n-card);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--n-border);
                    border-left: 4px solid;
                    background: var(--n-soft);
                }
                .modal-header h3 {
                    font-size: 1rem;
                    font-weight: 700;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--n-ink);
                }
                .modal-close {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: var(--n-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                }
                .modal-close:hover {
                    background: var(--n-border);
                    color: var(--n-ink);
                }
                .modal-body {
                    padding: 20px;
                    overflow-y: auto;
                }
                .student-info {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 16px;
                    margin-bottom: 20px;
                    padding: 14px;
                    background: var(--n-soft);
                    border-radius: 12px;
                }
                .student-info span {
                    font-size: 0.85rem;
                    color: var(--n-ink);
                }
                .student-info strong {
                    color: var(--n-muted);
                    margin-right: 4px;
                }
                .modal-body h4 {
                    font-size: 0.9rem;
                    font-weight: 700;
                    margin: 0 0 12px;
                    color: var(--n-ink);
                }
                .entry-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                .entry-item {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 14px 16px;
                    background: var(--n-soft);
                    border-radius: 12px;
                    border-left: 4px solid;
                }
                .entry-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                }
                .entry-date-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--n-ink);
                }
                .entry-date-badge i {
                    color: ${color};
                    font-size: 1rem;
                }
                .entry-time {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    background: var(--n-card);
                    padding: 2px 8px;
                    border-radius: 6px;
                }
                .entry-count-badge {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }
                .entry-keterangan {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 10px 14px;
                    background: var(--n-card);
                    border-radius: 10px;
                    font-size: 0.82rem;
                    color: var(--n-ink);
                    line-height: 1.5;
                }
                .entry-keterangan i {
                    color: var(--n-muted);
                    font-size: 0.9rem;
                    margin-top: 2px;
                    flex-shrink: 0;
                }
                .entry-keterangan span {
                    font-style: italic;
                    color: var(--n-muted);
                }

                /* Dark Mode
                   Panel & kartu memakai var(--n-card); elemen di dalamnya memakai
                   lapisan putih transparan supaya kedalamannya konsisten dengan
                   tab Log. Sebelumnya dipakai hex lepas #1e293b/#0f172a yang bukan
                   bagian dari palet aplikasi. */
                /* Pola referensi master/pengaturan-data. Palet biru bersama, aksen #60a5fa (sama di semua halaman). */
                :global(.dark) .rekap-toolbar {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
                }
                :global(.dark) .action-btn { background: #0b1329; color: #94a3b8; border-color: rgba(26, 115, 232, 0.35); }
                :global(.dark) .action-btn:hover { background: rgba(96, 165, 250, 0.15); color: #60a5fa; border-color: #60a5fa; }
                :global(.dark) .filter-tabs { background: #0b1329; border: 1px solid rgba(26, 115, 232, 0.35); }
                :global(.dark) .filter-tab { color: #94a3b8; }
                :global(.dark) .filter-tab:hover { color: #60a5fa; background: rgba(96, 165, 250, 0.12); }
                :global(.dark) .filter-tab.active {
                    background: rgba(96, 165, 250, 0.18);
                    color: #60a5fa;
                    box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.45);
                }
                /* select & input[type=date] dipaksa var(--n-surface) !important oleh
                   globals.css, jadi warna kontrol di sini disamakan ke sana supaya
                   satu baris toolbar tidak belang. */
                :global(.dark) .filter-select {
                    background: #0b1329; color: #ffffff;
                    border: 1px solid rgba(26, 115, 232, 0.35); border-radius: 12px; color-scheme: dark;
                    padding: 0 32px 0 14px !important;
                }
                :global(.dark) .period-select-wrap {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 12px !important;
                    padding: 0 4px 0 12px !important;
                }
                :global(.dark) .filter-select.period-select,
                :global(.dark) .period-select {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 32px 0 4px !important;
                }
                :global(.dark) .date-range {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35); border-radius: 12px;
                    padding: 0 12px !important;
                }
                :global(.dark) .date-range input { background: transparent !important; border-color: transparent !important; color: #ffffff; color-scheme: dark; }
                :global(.dark) .date-range input::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.55; }
                :global(.dark) .status-select {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35); border-radius: 12px; color-scheme: dark;
                    padding: 0 32px 0 14px !important;
                }
                :global(.dark) .summary-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .summary-value { color: #60a5fa; }
                :global(.dark) .chart-section {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .table-section {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .chart-title h2 { color: #ffffff; }
                :global(.dark) .chart-subtitle { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
                :global(.dark) th {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25));
                    color: #94a3b8;
                    border-bottom-color: rgba(26, 115, 232, 0.35);
                }
                :global(.dark) td { color: #ffffff; border-color: rgba(26, 115, 232, 0.2); }
                :global(.dark) tr:hover td { background: rgba(26, 115, 232, 0.08); }
                :global(.dark) .count-badge { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
                :global(.dark) .detail-btn { background: #0b1329; border: 1px solid rgba(26, 115, 232, 0.35); color: #94a3b8; }
                :global(.dark) .detail-btn:hover { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
                :global(.dark) .modal-content {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 20px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
                }
                :global(.dark) .modal-header {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25));
                    border-bottom-color: rgba(26, 115, 232, 0.4);
                }
                :global(.dark) .modal-header h3 { color: #ffffff; }
                :global(.dark) .modal-body { background: #0b1329; }
                :global(.dark) .student-info { background: rgba(26, 115, 232, 0.08); }
                :global(.dark) .student-info span { color: #ffffff; }
                :global(.dark) .entry-item {
                    background: #0b1329;
                    border: 1px solid rgba(37, 99, 235, 0.4);
                    border-radius: 12px;
                }
                :global(.dark) .entry-date-badge { color: #60a5fa; }
                :global(.dark) .entry-time { background: rgba(26, 115, 232, 0.12); color: #94a3b8; }
                :global(.dark) .entry-keterangan { background: rgba(26, 115, 232, 0.08); }
                :global(.dark) .entry-keterangan span { color: #94a3b8; }

                /* Responsive */
                @media (max-width: 768px) {
                    .rekap-toolbar {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                        padding: 12px;
                    }
                    .toolbar-divider { display: none; }
                    .toolbar-spacer { display: none; }
                    .toolbar-section { width: 100%; }
                    .toolbar-period { flex-direction: column; align-items: stretch; gap: 8px; }
                    .filter-tabs { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
                    .filter-tabs::-webkit-scrollbar { display: none; }
                    .filter-tab { flex: 1 0 auto; justify-content: center; font-size: 0.7rem; }
                    .filter-row { width: 100%; }
                    .filter-select { flex: 1; width: 50%; }
                    .status-select { width: 100%; padding: 8px 10px; }
                    .toolbar-actions { display: flex; width: 100%; gap: 8px; }
                    .action-btn { flex: 1; height: 36px; }

                    .rekap-summary {
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                    }
                    .summary-card {
                        flex-direction: column;
                        text-align: center;
                        gap: 8px;
                        border-left: none;
                        border-top: 3px solid;
                    }
                    .hide-on-mobile {
                        display: none;
                    }
                    .summary-icon {
                        width: 40px;
                        height: 40px;
                        font-size: 1rem;
                    }
                    .summary-value {
                        font-size: 1.2rem;
                    }
                    .top-name {
                        font-size: 0.85rem !important;
                        max-width: 100%;
                    }
                    .chart-container {
                        height: 300px;
                    }
                    table {
                        display: none;
                    }
                    .card-list {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        padding: 0 14px 14px;
                    }
                    .card-item {
                        background: var(--n-soft);
                        border: 1px solid var(--n-border);
                        border-radius: 12px;
                        padding: 12px 14px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .card-rank {
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 800;
                        font-size: 0.8rem;
                        color: white;
                        flex-shrink: 0;
                    }
                    .card-rank.gold { background: linear-gradient(135deg, #f59e0b, #d97706); }
                    .card-rank.silver { background: linear-gradient(135deg, #9ca3af, #6b7280); }
                    .card-rank.bronze { background: linear-gradient(135deg, #d97706, #b45309); }
                    .card-rank.default { background: #e2e8f0; color: var(--n-muted); }
                    .card-info {
                        flex: 1;
                        min-width: 0;
                    }
                    .card-name {
                        font-weight: 700;
                        font-size: 0.82rem;
                        color: var(--n-ink);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .card-meta {
                        font-size: 0.72rem;
                        color: var(--n-muted);
                        margin-top: 2px;
                    }
                    .card-count {
                        font-size: 0.7rem;
                        font-weight: 800;
                        padding: 4px 8px;
                        border-radius: 8px;
                        flex-shrink: 0;
                        white-space: nowrap;
                    }
                    .detail-btn {
                        padding: 6px 10px;
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
}
