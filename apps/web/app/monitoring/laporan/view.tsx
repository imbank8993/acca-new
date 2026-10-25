'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { APP_BRAND } from '@/lib/branding';
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { Spinner } from '@/components/ui/Spinner';
import { Tab } from '@/components/ui/Tab';
import HtmlPreviewModal from '@/components/ui/HtmlPreviewModal';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalDetailGrid, ModalDetailField } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import InlineSelect from '@/components/ui/InlineSelect';
import Swal from 'sweetalert2';
import { swalError, swalSuccess } from '@/lib/swal-premium';
import { getProxiedImageUrl } from '@/lib/image-utils';
import './monitoring-laporan.css';

const BULAN = [
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

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PAGE_SIZE = 12;

function fmtDate(d?: string | Date | null): string {
    if (!d) return '-';
    try {
        const dateObj = typeof d === 'string' ? new Date(d) : d;
        return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '-';
    }
}

export default function MonitoringLaporanView() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [activeTab, setActiveTab] = useState<'GURU_ASUH' | 'KLINIK' | 'EKSKUL'>('GURU_ASUH');
    const [selectedBulan, setSelectedBulan] = useState<string>('ALL');
    const [selectedTahun, setSelectedTahun] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);

    const [loading, setLoading] = useState<boolean>(false);
    const [dataList, setDataList] = useState<any[]>([]);
    const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

    // Download modal period selection state
    const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
    const [downloadBulan, setDownloadBulan] = useState<string>('ALL');
    const [downloadTahun, setDownloadTahun] = useState<string>('ALL');
    const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'html'>('pdf');

    // Track broken avatars to fallback gracefully to initials
    const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});

    // Dark mode state for public visitor
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Selected row for mobile full detail modal (Modal.tsx)
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

    // Document preview modal state
    const [docPreview, setDocPreview] = useState<{
        open: boolean;
        title: string;
        html?: string;
    } | null>(null);

    // Synchronize Dark Mode safely after mount
    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('darkMode');
            const isDarkNow = saved === '1' || document.documentElement.classList.contains('dark');
            setIsDark(isDarkNow);
            if (isDarkNow) {
                document.documentElement.classList.add('dark');
            }
        }
    }, []);

    const toggleDark = () => {
        const nextDark = !isDark;
        setIsDark(nextDark);
        if (nextDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', '1');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', '0');
        }
    };

    // Tabs matching pembayaran (minus Rekapan & Nominal)
    const TABS = useMemo(() => [
        { key: 'GURU_ASUH' as const, label: 'Guru Asuh', shortLabel: 'Guru Asuh', icon: 'bi-person-heart' },
        { key: 'KLINIK' as const, label: 'Klinik Pembelajaran', shortLabel: 'Klinik', icon: 'bi-heart-pulse' },
        { key: 'EKSKUL' as const, label: 'Ekstrakurikuler', shortLabel: 'Ekskul', icon: 'bi-person-plus' },
    ], []);

    // Year options generator with 'Semua Tahun' option
    const yearOptions = useMemo(() => {
        const years = [{ value: 'ALL', label: 'Semua Tahun' }];
        for (let y = currentYear + 1; y >= currentYear - 3; y--) {
            years.push({ value: String(y), label: `Tahun ${y}` });
        }
        return years;
    }, [currentYear]);

    // Fetch data based on active tab & filters
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let endpoint = '/api/monitoring/laporan/guru-asuh';
            if (activeTab === 'KLINIK') endpoint = '/api/monitoring/laporan/klinik';
            if (activeTab === 'EKSKUL') endpoint = '/api/monitoring/laporan/ekskul';

            const params = new URLSearchParams();
            if (selectedBulan) params.set('bulan', selectedBulan);
            if (selectedTahun) params.set('tahun', selectedTahun);
            if (searchQuery.trim()) params.set('q', searchQuery.trim());

            const res = await fetch(`${endpoint}?${params.toString()}`);
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                console.warn(`[monitoring/laporan] Endpoint ${endpoint} returned non-JSON response (status ${res.status}): ${contentType}`);
                setDataList([]);
                return;
            }

            const json = await res.json().catch((err) => {
                console.warn('[monitoring/laporan] JSON parse error:', err);
                return null;
            });

            if (json && json.ok) {
                setDataList(json.data || []);
            } else {
                setDataList([]);
            }
        } catch (err) {
            console.error('Error fetching monitoring data:', err);
            setDataList([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab, selectedBulan, selectedTahun, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Sort data newest first
    const sortedDataList = useMemo(() => {
        return [...dataList].sort((a, b) => {
            if (activeTab === 'KLINIK') {
                const dateA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
                const dateB = b.tanggal ? new Date(b.tanggal).getTime() : 0;
                return dateB - dateA;
            }
            // GURU_ASUH & EKSKUL
            const thnA = Number(a.tahun) || 0;
            const thnB = Number(b.tahun) || 0;
            if (thnB !== thnA) return thnB - thnA;

            const blnA = Number(a.bulan) || 0;
            const blnB = Number(b.bulan) || 0;
            if (blnB !== blnA) return blnB - blnA;

            const timeA = new Date(a.submitted_at || a.approved_at || a.created_at || 0).getTime();
            const timeB = new Date(b.submitted_at || b.approved_at || b.created_at || 0).getTime();
            return timeB - timeA;
        });
    }, [dataList, activeTab]);

    const pageCount = Math.ceil(sortedDataList.length / PAGE_SIZE);
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const paginatedDataList = sortedDataList.slice(pageStart, pageStart + PAGE_SIZE);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, selectedBulan, selectedTahun, searchQuery]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, Math.max(1, pageCount)));
    }, [pageCount]);

    const activeBulanLabel = useMemo(() => {
        if (!selectedBulan || selectedBulan === 'ALL') return 'Semua Bulan';
        const num = parseInt(selectedBulan, 10);
        return NAMA_BULAN[num - 1] || selectedBulan;
    }, [selectedBulan]);

    const activePeriodeLabel = useMemo(() => {
        const isAllBulan = !selectedBulan || selectedBulan === 'ALL';
        const isAllTahun = !selectedTahun || selectedTahun === 'ALL';
        if (isAllBulan && isAllTahun) return 'Semua Periode';
        if (isAllBulan) return `Semua Bulan ${selectedTahun}`;
        if (isAllTahun) return `${activeBulanLabel} (Semua Thn)`;
        return `${activeBulanLabel} ${selectedTahun}`;
    }, [selectedBulan, selectedTahun, activeBulanLabel]);

    const shortPeriodeLabel = useMemo(() => {
        const isAllBulan = !selectedBulan || selectedBulan === 'ALL';
        const isAllTahun = !selectedTahun || selectedTahun === 'ALL';
        if (isAllBulan && isAllTahun) return 'Semua';
        const shortBulan = isAllBulan ? '' : (BULAN.find(b => b.value === selectedBulan)?.label.substring(0, 3) || selectedBulan);
        if (isAllBulan) return `Thn ${selectedTahun}`;
        if (isAllTahun) return shortBulan;
        return `${shortBulan} ${selectedTahun}`;
    }, [selectedBulan, selectedTahun]);

    const getModulLabel = () => {
        if (activeTab === 'GURU_ASUH') return 'Guru Asuh';
        if (activeTab === 'KLINIK') return 'Klinik Pembelajaran';
        return 'Ekstrakurikuler';
    };

    // Open Download Modal
    const handleOpenDownloadModal = () => {
        setDownloadBulan(selectedBulan || 'ALL');
        setDownloadTahun(selectedTahun || 'ALL');
        setShowDownloadModal(true);
    };

    // Execute bulk PDF/HTML ZIP download
    const handleExecuteDownloadZip = async () => {
        try {
            setDownloadingZip(true);
            const dlBulanLabel = (!downloadBulan || downloadBulan === 'ALL')
                ? 'Semua Bulan'
                : (NAMA_BULAN[parseInt(downloadBulan, 10) - 1] || downloadBulan);
            const dlTahunLabel = (!downloadTahun || downloadTahun === 'ALL')
                ? 'Semua Tahun'
                : downloadTahun;
            const fmtLabel = downloadFormat.toUpperCase();

            Swal.fire({
                title: `Menyiapkan Berkas ${fmtLabel}...`,
                html: downloadFormat === 'html'
                    ? `Mengompilasi berkas laporan <b>${getModulLabel()}</b> periode <b>${dlBulanLabel} ${dlTahunLabel}</b> ke format <b>HTML Ringan</b> dalam arsip ZIP.<br/><small style="color:#64748b">Proses ini cepat (~1 detik)...</small>`
                    : `Mengonversi berkas laporan <b>${getModulLabel()}</b> periode <b>${dlBulanLabel} ${dlTahunLabel}</b> ke format <b>PDF</b> dan mengompres ke ZIP.<br/><small style="color:#64748b">Mohon tunggu sejenak hingga proses selesai...</small>`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                },
            });

            const queryParams = new URLSearchParams({
                modul: activeTab,
                bulan: downloadBulan,
                tahun: downloadTahun,
                format: downloadFormat,
            });

            const res = await fetch(`/api/monitoring/laporan/download-zip?${queryParams.toString()}`);
            if (!res.ok) {
                const contentType = res.headers.get('content-type') || '';
                let errMessage = `Gagal mengunduh arsip laporan (${res.status})`;
                if (contentType.includes('application/json')) {
                    const errJson = await res.json().catch(() => null);
                    if (errJson?.error) errMessage = errJson.error;
                }
                throw new Error(errMessage);
            }

            const blob = await res.blob();
            Swal.close();

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const modulLabelCode = activeTab === 'GURU_ASUH' ? 'Guru_Asuh' : activeTab === 'KLINIK' ? 'Klinik_Pembelajaran' : 'Ekstrakurikuler';
            const safeBulanStr = dlBulanLabel.replace(/\s+/g, '_');
            const safeTahunStr = dlTahunLabel.replace(/\s+/g, '_');
            a.download = `Semua_Laporan_${modulLabelCode}_${fmtLabel}_${safeBulanStr}_${safeTahunStr}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            setShowDownloadModal(false);
            swalSuccess('Unduhan Selesai', `Arsip ZIP laporan (${fmtLabel}) ${getModulLabel()} berhasil disimpan.`);
        } catch (err: any) {
            Swal.close();
            swalError('Gagal Mengunduh Laporan', err?.message || 'Terjadi kesalahan sistem saat membuat arsip laporan.');
        } finally {
            setDownloadingZip(false);
        }
    };

    // Open Document Preview Modal
    const handlePreviewDoc = async (id: string, title: string) => {
        try {
            Swal.fire({
                title: 'Memuat Dokumen...',
                text: 'Sedang mengambil berkas laporan resmi bersertifikasi...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            const res = await fetch('/api/monitoring/laporan/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: activeTab, id }),
            });

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                Swal.close();
                throw new Error(`Server mengembalikan respons tidak valid (${res.status})`);
            }

            const json = await res.json().catch(() => null);
            Swal.close();

            if (!res.ok || !json || !json.ok) {
                throw new Error(json?.error || 'Gagal memuat pratinjau dokumen laporan.');
            }

            setDocPreview({
                open: true,
                title,
                html: json.html,
            });
        } catch (err: any) {
            Swal.close();
            swalError('Gagal Membuka Dokumen', err.message || 'Terjadi kesalahan saat memuat dokumen.');
        }
    };

    // Helper rendering teacher avatar with graceful fallback
    const renderAvatar = (rowId: string, name: string | null | undefined, photo: string | null | undefined) => {
        // Exclude broken domains like file.icgowa.sch.id
        const validPhoto = photo && !photo.includes('file.icgowa.sch.id') ? photo.trim() : null;
        const proxiedUrl = validPhoto ? getProxiedImageUrl(validPhoto) : null;
        const isBroken = Boolean(brokenAvatars[rowId]);
        const initial = (name || 'G').trim().charAt(0).toUpperCase();

        return (
            <div className="mon-avatar">
                {proxiedUrl && !isBroken ? (
                    <img
                        src={proxiedUrl}
                        alt={name || 'Guru'}
                        className="mon-avatar-img"
                        onError={() => setBrokenAvatars(prev => ({ ...prev, [rowId]: true }))}
                    />
                ) : null}
                <span style={{ display: (!proxiedUrl || isBroken) ? 'inline-flex' : 'none' }}>
                    {initial}
                </span>
            </div>
        );
    };

    return (
        <div className="mon-lap-wrap" suppressHydrationWarning>
            {/* Top Navigation Header with ACCA Logo (compact & elegant) */}
            <header className="mon-lap-header">
                <div className="mon-lap-header-inner">
                    <Link href="/monitoring/laporan" className="mon-lap-brand" title="Portal Monitoring Laporan ACCA">
                        {/* Logo ACCA lebar tetapi proporsional */}
                        <img
                            src={APP_BRAND.wordmark}
                            alt="Logo ACCA"
                            className="mon-lap-logo-img light-logo"
                        />
                        <img
                            src={APP_BRAND.wordmarkDark}
                            alt="Logo ACCA"
                            className="mon-lap-logo-img dark-logo"
                        />
                        <div className="mon-lap-brand-divider" />
                        <div className="mon-lap-brand-text">
                            <span className="mon-lap-brand-title">
                                Monitoring Laporan<br className="mon-mobile-br" /> Kegiatan
                            </span>
                        </div>
                    </Link>

                    <div className="mon-lap-header-right">
                        <button
                            type="button"
                            onClick={toggleDark}
                            className="mon-lap-dark-btn"
                            title={mounted && isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
                            aria-label="Toggle theme"
                            suppressHydrationWarning
                        >
                            <i className={`bi bi-${mounted && isDark ? 'sun' : 'moon-stars'}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Body */}
            <main className="mon-lap-main">
                {/* Tabs — Same as Pembayaran minus Rekapan & Nominal */}
                <div className="mon-tab-container">
                    <Tab
                        tabs={TABS}
                        activeTab={activeTab}
                        onChange={(k) => {
                            setActiveTab(k as any);
                            setSelectedDetail(null);
                        }}
                        variant="slider"
                        ariaLabel="Modul Laporan Monitoring"
                    />
                </div>

                {/* Stats Summary Cards */}
                <div className="gap-stats">
                    <div className="gap-stat-item">
                        <div className="gap-stat-val">{sortedDataList.length}</div>
                        <div className="gap-stat-lbl">Total Laporan</div>
                    </div>
                    <div className="gap-stat-item blue-primary">
                        <div className="gap-stat-val">
                            {activeTab === 'GURU_ASUH'
                                ? sortedDataList.reduce((acc, curr) => acc + (curr.total_laporan || 0), 0)
                                : activeTab === 'KLINIK'
                                ? sortedDataList.reduce((acc, curr) => acc + (curr.total_peserta || 0), 0)
                                : sortedDataList.reduce((acc, curr) => acc + (curr.total_pertemuan || 0), 0)
                            }
                        </div>
                        <div className="gap-stat-lbl">
                            {activeTab === 'GURU_ASUH' ? 'Total Kegiatan' : activeTab === 'KLINIK' ? 'Siswa Terlayani' : 'Pertemuan Ekskul'}
                        </div>
                    </div>
                    <div className="gap-stat-item blue-secondary">
                        <div className="gap-stat-val" title={activePeriodeLabel}>{shortPeriodeLabel}</div>
                        <div className="gap-stat-lbl">Periode</div>
                    </div>
                </div>

                {/* Filter Toolbar & Actions (with actionsInline for mobile circular button) */}
                <div className="gap-table-card">
                    <FilterToolbar actionsInline={true}>
                        <FilterSelect
                            label="Bulan"
                            icon="calendar-month"
                            value={selectedBulan}
                            onChange={setSelectedBulan}
                            options={[
                                { value: 'ALL', label: 'Semua Bulan' },
                                ...BULAN,
                            ]}
                            width={150}
                        />

                        <FilterSelect
                            label="Tahun"
                            icon="calendar3"
                            value={selectedTahun}
                            onChange={setSelectedTahun}
                            options={yearOptions}
                            width={130}
                        />

                        <FilterSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={
                                activeTab === 'GURU_ASUH'
                                    ? 'Cari nama guru atau NIP...'
                                    : activeTab === 'KLINIK'
                                    ? 'Cari nama guru, mapel, topik...'
                                    : 'Cari pembina, NIP, atau ekskul...'
                            }
                            grow={2}
                        />

                        <button
                            type="button"
                            data-action="true"
                            className="btn-zip-download ftb-btn-icon-mobile"
                            onClick={handleOpenDownloadModal}
                            disabled={downloadingZip || loading}
                            title={`Unduh Laporan ${getModulLabel()}`}
                            aria-label="Unduh Laporan"
                            suppressHydrationWarning
                        >
                            <i className="bi bi-download" />
                            <span className="btn-text-desktop">Unduh Laporan</span>
                            <span className="btn-text-mobile">Unduh</span>
                        </button>
                    </FilterToolbar>

                    {/* Content View: Loading, Empty, or Data (Desktop Table + Mobile List) */}
                    {loading ? (
                        <div className="mon-loading-card">
                            <Spinner size={36} />
                            <span style={{ color: 'var(--n-muted)', fontSize: '0.85rem' }}>Memuat daftar laporan...</span>
                        </div>
                    ) : sortedDataList.length === 0 ? (
                        <div className="mon-empty-card">
                            <i className="bi bi-file-earmark-x" />
                            <div className="mon-empty-title">Tidak ada laporan yang ditemukan</div>
                            <p className="mon-empty-desc">
                                Belum ada laporan disahkan untuk periode {activePeriodeLabel} dengan kriteria filter saat ini.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="gap-table-wrap">
                                <table className="gap-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 50, textAlign: 'center' }}>No</th>
                                            <th>
                                                {activeTab === 'GURU_ASUH' ? 'Guru Asuh' : activeTab === 'KLINIK' ? 'Guru Pengajar' : 'Pembina / Pelatih'}
                                            </th>
                                            {activeTab === 'KLINIK' && <th>Mata Pelajaran & Topik</th>}
                                            {activeTab === 'EKSKUL' && <th>Ekstrakurikuler</th>}
                                            <th>
                                                {activeTab === 'KLINIK' ? 'Tanggal Pelaksanaan' : 'Periode'}
                                            </th>
                                            <th>
                                                {activeTab === 'GURU_ASUH' ? 'Total Kegiatan' : activeTab === 'KLINIK' ? 'Peserta' : 'Pertemuan'}
                                            </th>
                                            {activeTab === 'GURU_ASUH' && <th>Disahkan oleh</th>}
                                            <th style={{ width: 140, textAlign: 'center', whiteSpace: 'nowrap' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 1. TAB GURU ASUH */}
                                        {activeTab === 'GURU_ASUH' && paginatedDataList.map((row, idx) => (
                                            <tr key={row.id}>
                                                <td style={{ textAlign: 'center', color: 'var(--n-muted)' }}>{pageStart + idx + 1}</td>
                                                <td>
                                                    <div className="mon-avatar-cell">
                                                        {renderAvatar(row.id, row.nama_guru_snap, row.foto_profil)}
                                                        <div>
                                                            <div className="gap-td-name">{row.nama_guru_snap || '-'}</div>
                                                            <div className="gap-td-nip">NIP. {row.nip || '-'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong>{NAMA_BULAN[row.bulan - 1] || row.bulan} {row.tahun}</strong>
                                                </td>
                                                <td>
                                                    <span className="gap-badge gap-badge--per-bulan">
                                                        {row.total_laporan || 0} Kegiatan
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                                        {row.approved_by_name || 'WKM Keasramaan'}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>
                                                        {fmtDate(row.approved_at || row.submitted_at)}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-action-view"
                                                        onClick={() => handlePreviewDoc(row.id, `Laporan Guru Asuh - ${row.nama_guru_snap || 'Guru'} (${NAMA_BULAN[row.bulan - 1] || row.bulan} ${row.tahun})`)}
                                                        title="Pratinjau Dokumen Laporan"
                                                    >
                                                        <i className="bi bi-eye" />
                                                        <span>Lihat Laporan</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* 2. TAB KLINIK PEMBELAJARAN */}
                                        {activeTab === 'KLINIK' && paginatedDataList.map((row, idx) => (
                                            <tr key={row.id}>
                                                <td style={{ textAlign: 'center', color: 'var(--n-muted)' }}>{pageStart + idx + 1}</td>
                                                <td>
                                                    <div className="mon-avatar-cell">
                                                        {renderAvatar(row.id, row.nama_guru, row.foto_profil)}
                                                        <div>
                                                            <div className="gap-td-name">{row.nama_guru || '-'}</div>
                                                            <div className="gap-td-nip">NIP. {row.nip || '-'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: 'var(--n-ink)' }}>{row.mapel || '-'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: 2 }}>{row.topik || '-'}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{fmtDate(row.tanggal)}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>
                                                        {row.jam_mulai && row.jam_selesai ? `${row.jam_mulai} - ${row.jam_selesai}` : 'Sesi Klinik'}
                                                        {row.ruangan ? ` (${row.ruangan})` : ''}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="gap-badge gap-badge--per-bulan">
                                                        {row.total_peserta || 0} Siswa
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-action-view"
                                                        onClick={() => handlePreviewDoc(row.id, `Laporan Klinik - ${row.nama_guru || 'Guru'} (${row.mapel || 'Klinik'})`)}
                                                        title="Pratinjau Dokumen Laporan"
                                                    >
                                                        <i className="bi bi-eye" />
                                                        <span>Lihat Laporan</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* 3. TAB EKSTRAKURIKULER */}
                                        {activeTab === 'EKSKUL' && paginatedDataList.map((row, idx) => (
                                            <tr key={row.id}>
                                                <td style={{ textAlign: 'center', color: 'var(--n-muted)' }}>{pageStart + idx + 1}</td>
                                                <td>
                                                    <div className="mon-avatar-cell">
                                                        {renderAvatar(row.id, row.pembina_nama, row.foto_profil)}
                                                        <div>
                                                            <div className="gap-td-name">{row.pembina_nama || '-'}</div>
                                                            <div className="gap-td-nip">NIP. {row.pembina_nip || '-'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong style={{ color: '#1e40af' }}>{row.ekskul?.nama_ekskul || '-'}</strong>
                                                </td>
                                                <td>
                                                    <strong>{NAMA_BULAN[row.bulan - 1] || row.bulan} {row.tahun}</strong>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 700 }}>{row.total_pertemuan || 0} Pertemuan</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>
                                                        Internal: {row.jml_internal || 0} | Eksternal: {row.jml_eksternal || 0}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-action-view"
                                                        onClick={() => handlePreviewDoc(row.id, `Laporan Ekskul - ${row.ekskul?.nama_ekskul || 'Ekskul'} (${row.pembina_nama || 'Pembina'})`)}
                                                        title="Pratinjau Dokumen Laporan"
                                                    >
                                                        <i className="bi bi-eye" />
                                                        <span>Lihat Laporan</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Only: List data menampilkan avatar, nama guru, dan sub-informasi */}
                            <div className="mon-mobile-list">
                                {paginatedDataList.map((row, idx) => {
                                    const teacherName = activeTab === 'GURU_ASUH'
                                        ? row.nama_guru_snap
                                        : activeTab === 'KLINIK'
                                        ? row.nama_guru
                                        : row.pembina_nama;

                                    return (
                                        <div
                                            key={row.id || idx}
                                            role="button"
                                            tabIndex={0}
                                            className="mon-mobile-item"
                                            onClick={() => setSelectedDetail(row)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedDetail(row);
                                                }
                                            }}
                                        >
                                            <div className="mon-mobile-item-left">
                                                {renderAvatar(row.id, teacherName, row.foto_profil)}
                                                <div className="mon-mobile-info">
                                                    <div className="mon-mobile-name">{teacherName || '-'}</div>
                                                    <div className="mon-mobile-sub">
                                                        {activeTab === 'GURU_ASUH' && `${row.total_laporan || 0} Kegiatan · ${NAMA_BULAN[row.bulan - 1] || row.bulan} ${row.tahun}`}
                                                        {activeTab === 'KLINIK' && `${row.mapel || 'Klinik'} · ${row.total_peserta || 0} Siswa`}
                                                        {activeTab === 'EKSKUL' && `${row.ekskul?.nama_ekskul || 'Ekskul'} · ${row.total_pertemuan || 0} Pertemuan`}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {pageCount > 1 && (
                                <nav className="mon-pagination" aria-label="Pagination laporan">
                                    <span className="mon-pagination-summary">
                                        Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sortedDataList.length)} dari {sortedDataList.length} laporan
                                    </span>
                                    <div className="mon-pagination-controls">
                                        <button
                                            type="button"
                                            className="mon-pagination-button"
                                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                            disabled={currentPage === 1}
                                            aria-label="Halaman sebelumnya"
                                        >
                                            <i className="bi bi-chevron-left" />
                                            <span>Sebelumnya</span>
                                        </button>
                                        <span className="mon-pagination-page" aria-live="polite">
                                            Halaman {currentPage} dari {pageCount}
                                        </span>
                                        <button
                                            type="button"
                                            className="mon-pagination-button"
                                            onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                                            disabled={currentPage === pageCount}
                                            aria-label="Halaman berikutnya"
                                        >
                                            <span>Berikutnya</span>
                                            <i className="bi bi-chevron-right" />
                                        </button>
                                    </div>
                                </nav>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Modal Detail Lengkap (menggunakan modal.tsx) saat item diklik di mobile */}
            {selectedDetail && (
                <Modal
                    open={Boolean(selectedDetail)}
                    onClose={() => setSelectedDetail(null)}
                    size="md"
                    labelledBy="detail-modal-title"
                >
                    <ModalHeader
                        id="detail-modal-title"
                        icon="file-earmark-text"
                        title="Detail Laporan"
                        subtitle={
                            activeTab === 'GURU_ASUH'
                                ? selectedDetail.nama_guru_snap
                                : activeTab === 'KLINIK'
                                ? selectedDetail.nama_guru
                                : selectedDetail.pembina_nama
                        }
                        onClose={() => setSelectedDetail(null)}
                    />
                    <ModalBody>
                        <div className="mon-modal-teacher-card">
                            {renderAvatar(
                                selectedDetail.id,
                                activeTab === 'GURU_ASUH' ? selectedDetail.nama_guru_snap : activeTab === 'KLINIK' ? selectedDetail.nama_guru : selectedDetail.pembina_nama,
                                selectedDetail.foto_profil
                            )}
                            <div>
                                <div className="mon-modal-teacher-name">
                                    {activeTab === 'GURU_ASUH' ? selectedDetail.nama_guru_snap : activeTab === 'KLINIK' ? selectedDetail.nama_guru : selectedDetail.pembina_nama}
                                </div>
                                <div className="mon-modal-teacher-nip">
                                    NIP. {selectedDetail.nip || selectedDetail.pembina_nip || '-'}
                                </div>
                            </div>
                        </div>

                        <ModalDetailGrid>
                            {activeTab === 'GURU_ASUH' && (
                                <>
                                    <ModalDetailField label="Modul">
                                        Guru Asuh
                                    </ModalDetailField>
                                    <ModalDetailField label="Periode">
                                        <strong>{NAMA_BULAN[selectedDetail.bulan - 1] || selectedDetail.bulan} {selectedDetail.tahun}</strong>
                                    </ModalDetailField>
                                    <ModalDetailField label="Total Kegiatan">
                                        <span className="gap-badge gap-badge--per-bulan">
                                            {selectedDetail.total_laporan || 0} Kegiatan
                                        </span>
                                    </ModalDetailField>
                                    <ModalDetailField label="Disahkan oleh">
                                        <div style={{ fontWeight: 600 }}>{selectedDetail.approved_by_name || 'WKM Keasramaan'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>{fmtDate(selectedDetail.approved_at || selectedDetail.submitted_at)}</div>
                                    </ModalDetailField>
                                </>
                            )}

                            {activeTab === 'KLINIK' && (
                                <>
                                    <ModalDetailField label="Mata Pelajaran">
                                        {selectedDetail.mapel || '-'}
                                    </ModalDetailField>
                                    <ModalDetailField label="Topik" full>
                                        {selectedDetail.topik || '-'}
                                    </ModalDetailField>
                                    <ModalDetailField label="Tanggal Pelaksanaan">
                                        {fmtDate(selectedDetail.tanggal)}
                                    </ModalDetailField>
                                    <ModalDetailField label="Waktu & Ruangan">
                                        {selectedDetail.jam_mulai && selectedDetail.jam_selesai ? `${selectedDetail.jam_mulai} - ${selectedDetail.jam_selesai}` : 'Sesi Klinik'}
                                        {selectedDetail.ruangan ? ` (${selectedDetail.ruangan})` : ''}
                                    </ModalDetailField>
                                    <ModalDetailField label="Total Peserta">
                                        <span className="gap-badge gap-badge--per-bulan">
                                            {selectedDetail.total_peserta || 0} Siswa
                                        </span>
                                    </ModalDetailField>
                                </>
                            )}

                            {activeTab === 'EKSKUL' && (
                                <>
                                    <ModalDetailField label="Ekstrakurikuler">
                                        <strong style={{ color: '#1d4ed8' }}>{selectedDetail.ekskul?.nama_ekskul || '-'}</strong>
                                    </ModalDetailField>
                                    <ModalDetailField label="Periode">
                                        <strong>{NAMA_BULAN[selectedDetail.bulan - 1] || selectedDetail.bulan} {selectedDetail.tahun}</strong>
                                    </ModalDetailField>
                                    <ModalDetailField label="Total Pertemuan" full>
                                        <div style={{ fontWeight: 700 }}>{selectedDetail.total_pertemuan || 0} Pertemuan</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: 2 }}>
                                            Internal: {selectedDetail.jml_internal || 0} | Eksternal: {selectedDetail.jml_eksternal || 0}
                                        </div>
                                    </ModalDetailField>
                                </>
                            )}
                        </ModalDetailGrid>
                    </ModalBody>
                    <ModalFooter align="between">
                        <Button variant="cancel" onClick={() => setSelectedDetail(null)}>
                            Tutup
                        </Button>
                        <Button
                            variant="primary"
                            leftIcon={<i className="bi bi-eye" />}
                            onClick={() => {
                                const id = selectedDetail.id;
                                const docTitle = activeTab === 'GURU_ASUH'
                                    ? `Laporan Guru Asuh - ${selectedDetail.nama_guru_snap || 'Guru'} (${NAMA_BULAN[selectedDetail.bulan - 1] || selectedDetail.bulan} ${selectedDetail.tahun})`
                                    : activeTab === 'KLINIK'
                                    ? `Laporan Klinik - ${selectedDetail.nama_guru || 'Guru'} (${selectedDetail.mapel || 'Klinik'})`
                                    : `Laporan Ekskul - ${selectedDetail.ekskul?.nama_ekskul || 'Ekskul'} (${selectedDetail.pembina_nama || 'Pembina'})`;
                                handlePreviewDoc(id, docTitle);
                            }}
                        >
                            Lihat Laporan
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Modal Unduh Laporan: Pilih Periode Bulan dan Tahun */}
            {showDownloadModal && (
                <Modal
                    open={showDownloadModal}
                    onClose={() => !downloadingZip && setShowDownloadModal(false)}
                    size="sm"
                    labelledBy="download-modal-title"
                >
                    <ModalHeader
                        id="download-modal-title"
                        icon="file-earmark-pdf"
                        title="Unduh Laporan"
                        onClose={() => !downloadingZip && setShowDownloadModal(false)}
                    />
                    <ModalBody>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: 6, color: 'var(--n-ink)' }}>
                                    Pilih Bulan
                                </label>
                                <InlineSelect
                                    value={downloadBulan}
                                    onChange={(val) => setDownloadBulan(val)}
                                    options={[
                                        { value: 'ALL', label: 'Semua Bulan' },
                                        ...BULAN,
                                    ]}
                                    disabled={downloadingZip}
                                    minWidth="100%"
                                    height="40px"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: 6, color: 'var(--n-ink)' }}>
                                    Pilih Tahun
                                </label>
                                <InlineSelect
                                    value={downloadTahun}
                                    onChange={(val) => setDownloadTahun(val)}
                                    options={yearOptions}
                                    disabled={downloadingZip}
                                    minWidth="100%"
                                    height="40px"
                                />
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter align="between">
                        <Button
                            variant="cancel"
                            onClick={() => setShowDownloadModal(false)}
                            disabled={downloadingZip}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            leftIcon={<i className={`bi ${downloadingZip ? 'bi-hourglass-split' : 'bi-download'}`} />}
                            onClick={handleExecuteDownloadZip}
                            disabled={downloadingZip}
                        >
                            {downloadingZip ? 'Menyiapkan PDF...' : 'Unduh Laporan'}
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Document Preview Modal */}
            {docPreview?.open && docPreview.html && (
                <HtmlPreviewModal
                    html={docPreview.html}
                    title={docPreview.title}
                    onClose={() => setDocPreview(null)}
                />
            )}
        </div>
    );
}
