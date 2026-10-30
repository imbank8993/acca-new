'use client';
import Pagination from '@/components/ui/Pagination';
import { canDeleteLetter, isSakitLetter } from '../letter-access';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { useState, useEffect, useMemo } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import Swal from 'sweetalert2';
import { useFileViewer } from '@/components/useFileViewer';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import '../../surat/surat.css';
import '../ketidakhadiran.css';
import { createPortal } from 'react-dom';
import { getPublicOrigin } from '@/lib/public-url';

interface AccaLetter {
    id: string;
    nomor_surat: string;
    nomor_urut: number;
    barcode: string;
    jenis_izin: string;
    siswa_nama: string;
    siswa_nisn: string;
    siswa_kelas: string;
    tgl_mulai: string;
    tgl_selesai: string;
    keterangan: string;
    file_url: string;
    file_name: string;
    generated_by: string;
    generated_at: string;
    penjabat_nama?: string;
    penjabat_jabatan?: string;
    /** Kategori dari baris ketidakhadiran tertaut: MADRASAH/PERSONAL atau Ringan/Sedang/Berat/Kontrol. */
    kategori?: string | null;
    kategori_jenis?: string | null;
}

export function DaftarSuratTab(props: any) {
    return (
        <div className="daftar-surat-wrap-custom animate-srt-fade-in">
            <DaftarAccaContent />
            <style jsx>{`
                .daftar-surat-wrap-custom {
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                    font-family: 'Poppins', sans-serif;
                    display: flex;
                    flex-direction: column;
                    min-height: 100%;
                }
                :global(.srt-modal .detail-value),
                :global(.srt-modal .verify-id) {
                    text-align: left !important;
                    padding-left: 1rem !important;
                    flex: 1;
                }
                :global(.srt-modal .detail-row label) {
                    min-width: 130px;
                }
                @media (max-width: 767px) {
                    :global(.srt-table) { display: none; }
                    :global(.srt-table-wrapper) { 
                        border: none !important; 
                        padding: 0 !important; 
                        background: transparent !important; 
                        box-shadow: none !important;
                    }
                    :global(.daftar-surat-desktop-tabs) {
                        display: none !important;
                    }
                    :global(.daftar-surat-desktop-search) {
                        display: none !important;
                    }
                    :global(.daftar-surat-mobile-toolbar) {
                        display: block !important;
                        margin-bottom: 12px !important;
                    }
                }
                @media (min-width: 768px) {
                    :global(.daftar-surat-mobile-toolbar) {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}

function DaftarAccaContent() {
    const [letters, setLetters] = useState<AccaLetter[]>([]);
    const [loading, setLoading] = useState(true);
    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLetter, setSelectedLetter] = useState<AccaLetter | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [canManageIzin, setCanManageIzin] = useState(false);
    const [canManageSakit, setCanManageSakit] = useState(false);
    const [userData, setUserData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'ALL' | 'MENINGGALKAN_ASRAMA' | 'REKOMENDASI_KONTROL' | 'REKAM_MEDIK' | 'REKAPAN'>('ALL');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(10);

    useEffect(() => {
        const init = async () => {
            const fetchPromise = fetchLetters();
            const uData = await getCurrentUser();
            if (uData) {
                setUserData(uData);
                const roles = (Array.isArray(uData.roles) ? uData.roles : String(uData.role || '').split(/[,|]/)).map((r: string) => r.trim().toUpperCase().replace(/\s+/g, '_'));
                const adminCheck = roles.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r));
                setIsAdmin(adminCheck);
                // OP_IZIN kelola surat izin (Meninggalkan Asrama); OP_UKS kelola surat sakit (Rekom Kontrol & Rekam Medik)
                setCanManageIzin(adminCheck || roles.includes('OP_IZIN'));
                setCanManageSakit(adminCheck || roles.includes('OP_UKS'));
            }
            await fetchPromise;
        };
        init();
    }, []);

    const fetchLetters = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/ketidakhadiran/acca-letter?limit=200');
            const json = await res.json();
            if (json.ok && json.data) {
                setLetters(json.data);
            } else {
                setLetters([]);
            }
        } catch (e: any) {
            setLetters([]);
        } finally {
            setLoading(false);
        }
    };

    const isIzinAsramaLetter = (j: string) => ['MENINGGALKAN_ASRAMA', 'P', 'M'].includes(j);
    const canManageLetter = (l: AccaLetter) => canDeleteLetter(l, { isAdmin, canManageIzin, canManageSakit });

    // Isolasi ketat: operator tunggal hanya melihat surat jenisnya sendiri
    const soloIzin = !isAdmin && canManageIzin && !canManageSakit;
    const soloSakit = !isAdmin && canManageSakit && !canManageIzin;
    const visibleLetters = letters.filter(l => {
        if (soloIzin) return !isSakitLetter(l.jenis_izin, l.nomor_surat);
        if (soloSakit) return isSakitLetter(l.jenis_izin, l.nomor_surat);
        return true;
    });

    const filterOptions = useMemo(() => {
        const opts: { value: string; label: string }[] = [
            { value: 'ALL', label: `Semua (${visibleLetters.length})` }
        ];
        if (!soloSakit) {
            const count = visibleLetters.filter(l => isIzinAsramaLetter(l.jenis_izin)).length;
            opts.push({ value: 'MENINGGALKAN_ASRAMA', label: `Izin Asrama (${count})` });
        }
        if (!soloIzin) {
            const rekomCount = visibleLetters.filter(l => l.jenis_izin === 'REKOMENDASI_KONTROL').length;
            const medikCount = visibleLetters.filter(l => l.jenis_izin === 'REKAM_MEDIK').length;
            opts.push({ value: 'REKOMENDASI_KONTROL', label: `Rekomendasi (${rekomCount})` });
            opts.push({ value: 'REKAM_MEDIK', label: `Rekam Medik (${medikCount})` });
        }
        const rekapanCount = visibleLetters.filter(l => l.jenis_izin.startsWith('REKAPAN')).length;
        opts.push({ value: 'REKAPAN', label: `Rekapan (${rekapanCount})` });
        return opts;
    }, [visibleLetters, soloSakit, soloIzin]);

    const filtered = visibleLetters.filter(l => {
        if (activeTab && activeTab !== 'ALL') {
            if (activeTab === 'MENINGGALKAN_ASRAMA') {
                if (!isIzinAsramaLetter(l.jenis_izin)) return false;
            } else if (activeTab === 'REKAPAN') {
                if (!l.jenis_izin.startsWith('REKAPAN')) return false;
            } else {
                if (l.jenis_izin !== activeTab) return false;
            }
        }
        const q = searchQuery.toLowerCase();
        return (
            l.nomor_surat?.toLowerCase().includes(q) ||
            l.siswa_nama?.toLowerCase().includes(q) ||
            l.siswa_nisn?.toLowerCase().includes(q) ||
            l.barcode?.toLowerCase().includes(q)
        );
    });

    // Pagination helpers
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const startIdx = (currentPage - 1) * limit;
    const endIdx = Math.min(startIdx + limit, totalItems);
    const paged = filtered.slice(startIdx, endIdx);

    // Reset to page 1 when filter/search changes
    useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

    const formatDate = (d: string) => {
        if (!d) return '-';
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatDateTime = (d: string) => {
        if (!d) return '-';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '-';
        return dt.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const formatDateRange = (start: string, end: string) => {
        if (!start || !end) return '-';
        const d1 = new Date(start + 'T00:00:00');
        const d2 = new Date(end + 'T00:00:00');
        
        const day1 = d1.getDate();
        const month1 = d1.toLocaleDateString('id-ID', { month: 'long' });
        const year1 = d1.getFullYear();
        
        const day2 = d2.getDate();
        const month2 = d2.toLocaleDateString('id-ID', { month: 'long' });
        const year2 = d2.getFullYear();

        if (year1 !== year2) {
            return `${day1} ${month1} ${year1} - ${day2} ${month2} ${year2}`;
        } else if (month1 !== month2) {
            return `${day1} ${month1} - ${day2} ${month2} ${year1}`;
        } else if (day1 !== day2) {
            return `${day1} - ${day2} ${month1} ${year1}`;
        } else {
            return `${day1} ${month1} ${year1}`;
        }
    };

    // Kolom "Jenis" menampilkan KATEGORI izin yang sebenarnya, bukan jenis surat.
    // Tidak ada kategori bernama "Meninggalkan Asrama" ΓÇö itu nama tab/jenis surat;
    // kategorinya tetap Madrasah atau Personal (untuk izin) dan Ringan/Sedang/
    // Berat/Kontrol (untuk sakit). Surat lama menyimpan kodenya langsung di
    // jenis_izin sebagai 'M'/'P', jadi keduanya ikut dipetakan.
    const KATEGORI_LABEL: Record<string, string> = {
        MADRASAH: 'Madrasah', M: 'Madrasah',
        PERSONAL: 'Personal', P: 'Personal',
        RINGAN: 'Ringan', SEDANG: 'Sedang', BERAT: 'Berat', KONTROL: 'Kontrol',
    };

    const KATEGORI_COLOR: Record<string, string> = {
        Madrasah: '#0e7490', Personal: '#6d28d9',
        Ringan: '#b45309', Sedang: '#dc2626', Berat: '#991b1b', Kontrol: '#4338ca',
    };

    /** Kategori surat, atau null bila surat tidak punya (mis. Rekam Medik bulanan). */
    const getKategori = (l: AccaLetter): string | null =>
        KATEGORI_LABEL[(l.kategori || '').toUpperCase()] ||
        KATEGORI_LABEL[(l.jenis_izin || '').toUpperCase()] ||
        null;

    const getJenisLabel = (j: string) => {
        const map: Record<string, string> = {
            'MENINGGALKAN_ASRAMA': 'Meninggalkan Asrama',
            'P': 'Meninggalkan Asrama',
            'M': 'Meninggalkan Asrama',
            'REKAM_MEDIK': 'Rekam Medik',
            'REKOMENDASI_KONTROL': 'Rekom Kontrol',
            'REKAPAN_IZIN': 'Rekapan Izin',
            'REKAPAN_SAKIT': 'Rekapan Sakit',
        };
        return map[j] || j;
    };

    const getJenisColor = (j: string) => {
        const map: Record<string, string> = {
            'MENINGGALKAN_ASRAMA': '#d97706',
            'P': '#d97706',
            'M': '#d97706',
            'REKAM_MEDIK': '#059669',
            'REKOMENDASI_KONTROL': '#dc2626',
            'REKAPAN_IZIN': '#0284c7',
            'REKAPAN_SAKIT': '#7c3aed',
        };
        return map[j] || '#059669';
    };

    const getBadgeLabel = (l: AccaLetter) => getKategori(l) || getJenisLabel(l.jenis_izin);
    const getBadgeColor = (l: AccaLetter) => {
        const kategori = getKategori(l);
        return kategori ? KATEGORI_COLOR[kategori] : getJenisColor(l.jenis_izin);
    };

    const handleDelete = async (letter: AccaLetter) => {
        const result = await Swal.fire({
            title: 'Hapus Surat ACCA?',
            html: `<div style="text-align:left;">
                <p><strong>Nomor:</strong> ${letter.nomor_surat}</p>
                <p><strong>Siswa:</strong> ${letter.siswa_nama}</p>
                <p><strong>Barcode:</strong> ${letter.barcode}</p>
                <hr style="margin:12px 0"/>
                <p style="color:#dc2626;font-weight:600;">PERINGATAN: Tindakan ini tidak bisa dibatalkan!</p>
            </div>`,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
        });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`/api/ketidakhadiran/acca-letter/${letter.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error);
            setLetters(prev => prev.filter(l => l.id !== letter.id));
            if (selectedLetter?.id === letter.id) setSelectedLetter(null);
            await Swal.fire({ title: 'Dihapus!', text: 'Surat ACCA berhasil dihapus.', icon: 'success', confirmButtonText: 'OK', confirmButtonColor: '#0038A8' });
        } catch (e: any) {
            await Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonText: 'OK', confirmButtonColor: '#dc2626' });
        }
    };

    return (
        <>
            {/* Tab Filter Desktop (Hanya Dekstop) */}
            <div className="kh-tabs daftar-surat-desktop-tabs" style={{ margin: '0 0 1rem 0', padding: 0 }}>
                <button className={`kh-tab ${activeTab === 'ALL' ? 'is-active' : ''}`} onClick={() => setActiveTab('ALL')}>
                    <div className="kh-tab-icon"><i className="bi bi-grid"></i></div>
                    <span className="kh-tab-text">Semua</span>
                    <span className="kh-tab-count">{visibleLetters.length}</span>
                </button>
                {!soloSakit && (
                    <button className={`kh-tab ${activeTab === 'MENINGGALKAN_ASRAMA' ? 'is-active' : ''}`} onClick={() => setActiveTab('MENINGGALKAN_ASRAMA')}>
                        <div className="kh-tab-icon"><i className="bi bi-calendar-event"></i></div>
                        <span className="kh-tab-text">Izin Asrama</span>
                        <span className="kh-tab-count">{visibleLetters.filter(l => isIzinAsramaLetter(l.jenis_izin)).length}</span>
                    </button>
                )}
                {!soloIzin && (
                    <>
                        <button className={`kh-tab ${activeTab === 'REKOMENDASI_KONTROL' ? 'is-active' : ''}`} onClick={() => setActiveTab('REKOMENDASI_KONTROL')}>
                            <div className="kh-tab-icon"><i className="bi bi-heart-pulse"></i></div>
                            <span className="kh-tab-text">Rekomendasi</span>
                            <span className="kh-tab-count">{visibleLetters.filter(l => l.jenis_izin === 'REKOMENDASI_KONTROL').length}</span>
                        </button>
                        <button className={`kh-tab ${activeTab === 'REKAM_MEDIK' ? 'is-active' : ''}`} onClick={() => setActiveTab('REKAM_MEDIK')}>
                            <div className="kh-tab-icon"><i className="bi bi-clipboard-pulse"></i></div>
                            <span className="kh-tab-text">Rekam Medik</span>
                            <span className="kh-tab-count">{visibleLetters.filter(l => l.jenis_izin === 'REKAM_MEDIK').length}</span>
                        </button>
                    </>
                )}
                <button className={`kh-tab ${activeTab === 'REKAPAN' ? 'is-active' : ''}`} onClick={() => setActiveTab('REKAPAN')}>
                    <div className="kh-tab-icon"><i className="bi bi-file-earmark-bar-graph"></i></div>
                    <span className="kh-tab-text">Rekapan</span>
                    <span className="kh-tab-count">{visibleLetters.filter(l => l.jenis_izin.startsWith('REKAPAN')).length}</span>
                </button>
            </div>

            {/* Desktop Search (Hanya Dekstop) */}
            <div className="daftar-surat-search daftar-surat-desktop-search">
                <i className="bi bi-search"></i>
                <input
                    type="text"
                    placeholder="Cari surat (nomor, nama siswa, NISN, barcode)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="srt-input"
                    suppressHydrationWarning
                />
            </div>

            {/* FilterToolbar Khusus Mobile: Mengatur jenis daftar surat dan pencarian ke toolbar mobile */}
            <div className="daftar-surat-mobile-toolbar">
                <FilterToolbar className="daftar-surat-filter-toolbar">
                    <FilterSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Cari surat (nomor, nama, NISN)..."
                    />
                    <FilterSelect
                        label="Jenis Surat"
                        icon="envelope-paper"
                        value={activeTab || 'ALL'}
                        onChange={(val) => setActiveTab((val || 'ALL') as any)}
                        options={filterOptions}
                    />
                </FilterToolbar>
            </div>

            {/* ΓöÇΓöÇ Tabel Daftar Surat ΓöÇΓöÇ */}
            <div className="srt-table-wrapper acca-letter-table-wrap">
                {loading ? (
                    <div className="srt-empty">
                        <div className="srt-empty-icon"><i className="bi bi-hourglass-split"></i></div>
                        <div className="srt-empty-title">Memuat data...</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="srt-empty">
                        <div className="srt-empty-icon"><i className="bi bi-inbox"></i></div>
                        <div className="srt-empty-title">Belum ada surat</div>
                        <div className="srt-empty-desc">
                            {activeTab === 'ALL' && 'Surat ACCA yang dicetak dari ketidakhadiran akan muncul di sini.'}
                            {activeTab === 'MENINGGALKAN_ASRAMA' && 'Izin Keasramaan belum ada.'}
                            {activeTab === 'REKOMENDASI_KONTROL' && 'Surat Rekomendasi (SAKIT) belum ada.'}
                            {activeTab === 'REKAM_MEDIK' && 'Rekam Medik bulanan belum ada.'}
                        </div>
                    </div>
                ) : (
                    <>
                        <table className="srt-table acca-letter-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                    <th style={{ minWidth: '220px' }}>Nomor & Jenis</th>
                                    <th style={{ minWidth: '280px' }}>Identitas Siswa</th>
                                    <th style={{ minWidth: '200px' }}>Keterangan & Periode</th>
                                    <th style={{ textAlign: 'center', width: '70px' }}>Berkas</th>
                                    <th style={{ textAlign: 'center', width: '160px' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((letter, idx) => (
                                    <tr key={letter.id}>
                                        <td style={{ textAlign: 'center', color: 'var(--srt-muted)', fontSize: '0.8rem' }}>
                                            {startIdx + idx + 1}
                                        </td>
                                        <td>
                                            <div className="srt-table-nomor" style={{ marginBottom: '6px' }}>{letter.nomor_surat}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span
                                                    className="srt-badge"
                                                    style={{ background: `${getBadgeColor(letter)}18`, color: getBadgeColor(letter) }}
                                                >
                                                    {getBadgeLabel(letter)}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--srt-ink)', marginBottom: '4px' }}>
                                                {letter.siswa_nama}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--srt-muted)' }}>
                                                {letter.siswa_nisn} • {letter.siswa_kelas || '-'}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--srt-ink)', marginBottom: '4px' }}>
                                                {letter.keterangan || '-'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--srt-muted)' }}>
                                                <i className="bi bi-calendar3" style={{ marginRight: '4px' }}></i>
                                                {formatDate(letter.tgl_mulai)} s.d. {formatDate(letter.tgl_selesai)}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const targetUrl = letter.file_url || `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(letter.barcode)}`;
                                                    openFile(targetUrl, `${letter.nomor_surat || 'Surat'} — ${letter.siswa_nama || ''}`);
                                                }}
                                                className="pdf-indicator"
                                                title="Lihat / Cetak Surat Resmi"
                                                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                                            >
                                                <i className="bi bi-file-earmark-text-fill" style={{ color: letter.file_url ? '#dc2626' : '#059669', fontSize: '1.25rem' }}></i>
                                            </button>
                                        </td>
                                        <td>
                                            <div className="srt-table-actions">
                                                <button
                                                    onClick={() => setSelectedLetter(letter)}
                                                    className="srt-btn srt-btn-secondary srt-btn-sm"
                                                    title="Detail"
                                                >
                                                    <i className="bi bi-eye"></i>
                                                </button>
                                                <button
                                                    onClick={() => window.open(`/ketidakhadiran/verify/${letter.barcode}`, '_blank')}
                                                    className="srt-btn srt-btn-secondary srt-btn-sm"
                                                    title="Verifikasi QR"
                                                >
                                                    <i className="bi bi-qr-code"></i>
                                                </button>
                                                {canManageLetter(letter) && (
                                                    <button
                                                        onClick={() => handleDelete(letter)}
                                                        className="srt-btn srt-btn-danger srt-btn-sm"
                                                        title="Hapus"
                                                        aria-label={`Hapus surat ${letter.nomor_surat}`}
                                                        type="button"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile Cards */}
                        <div className="kh-card-list">
                            {paged.map((letter) => (
                                <div key={letter.id} className="kh-card">
                                    <div className="kh-card-header">
                                        <div className="kh-card-title-area">
                                            <div>
                                                <div className="kh-card-name" style={{ fontWeight: 600 }}>{letter.siswa_nama}</div>
                                                <div className="kh-card-nisn">{letter.siswa_nisn}</div>
                                            </div>
                                        </div>
                                        <div className="kh-card-badges">
                                            <span className="srt-badge" style={{ background: `${getBadgeColor(letter)}18`, color: getBadgeColor(letter) }}>
                                                {getBadgeLabel(letter)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="kh-card-info">
                                        <div className="kh-card-row">
                                            <span className="kh-card-label">Nomor Surat</span>
                                            <span className="kh-card-value kh-card-value--mono">{letter.nomor_surat}</span>
                                        </div>
                                        <div className="kh-card-row">
                                            <span className="kh-card-label">Kelas</span>
                                            <span className="kh-card-value kh-card-subtext">{letter.siswa_kelas || '-'}</span>
                                        </div>
                                        <div className="kh-card-row">
                                            <span className="kh-card-label">Periode</span>
                                            <span className="kh-card-value">
                                                {formatDate(letter.tgl_mulai)} - {formatDate(letter.tgl_selesai)}
                                            </span>
                                        </div>
                                        {letter.keterangan && (
                                            <div className="kh-card-keterangan">{letter.keterangan}</div>
                                        )}
                                        <div className="kh-card-info" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--n-border)' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button onClick={() => setSelectedLetter(letter)} className="srt-btn srt-btn-secondary srt-btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                                                    <i className="bi bi-eye"></i> Detail
                                                </button>
                                                <button onClick={() => window.open(`/ketidakhadiran/verify/${letter.barcode}`, '_blank')} className="srt-btn srt-btn-secondary srt-btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                                                    <i className="bi bi-qr-code"></i> QR
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const targetUrl = letter.file_url || `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(letter.barcode)}`;
                                                        openFile(targetUrl, `${letter.nomor_surat || 'Surat'} — ${letter.siswa_nama || ''}`);
                                                    }}
                                                    className="srt-btn srt-btn-secondary srt-btn-sm"
                                                    style={{ flex: 1, justifyContent: 'center', color: letter.file_url ? '#dc2626' : '#059669' }}
                                                    title="Lihat Dokumen Surat"
                                                >
                                                    <i className="bi bi-file-earmark-text"></i> Surat
                                                </button>
                                                {canManageLetter(letter) && (
                                                    <button type="button" aria-label={`Hapus surat ${letter.nomor_surat}`} title="Hapus" onClick={() => handleDelete(letter)} className="srt-btn srt-btn-danger srt-btn-sm" style={{ flex: '0 0 auto' }}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            limit={limit}
                            totalItems={totalItems}
                            onPageChange={setCurrentPage}
                            onLimitChange={setLimit}
                            itemLabel="surat"
                        />
                    </>
                )}
            </div>

            {/* Detail Modal */}
            {selectedLetter && typeof document !== 'undefined' && createPortal(
                <div className="srt-modal-overlay" onClick={() => setSelectedLetter(null)}>
                    <div className="srt-modal srt-modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="srt-modal-header">
                            <h3><i className="bi bi-qr-code"></i> Detail Surat ACCA</h3>
                            <div className="modal-header-actions">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const targetUrl = selectedLetter.file_url || `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(selectedLetter.barcode)}`;
                                        openFile(targetUrl, `${selectedLetter.nomor_surat || 'Surat'} — ${selectedLetter.siswa_nama || ''}`);
                                    }}
                                    className="srt-btn srt-btn-success srt-btn-sm"
                                    title="Buka atau cetak lembar surat resmi"
                                >
                                    <i className="bi bi-printer"></i> Buka / Cetak
                                </button>
                                <button onClick={() => window.open(`/ketidakhadiran/verify/${selectedLetter.barcode}`, '_blank')} className="srt-btn srt-btn-primary srt-btn-sm">
                                    <i className="bi bi-qr-code"></i> Verifikasi
                                </button>
                                <button onClick={() => setSelectedLetter(null)} className="srt-btn srt-btn-icon srt-btn-secondary">
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>
                        <div className="srt-modal-body">
                            <div className="detail-grid">
                                <div className="detail-row">
                                    <label>Nomor Surat</label>
                                    <span className="detail-value detail-value-highlight">{selectedLetter.nomor_surat}</span>
                                </div>
                                <div className="detail-row">
                                    <label>Jenis Izin</label>
                                    <span className="detail-value" style={{ color: getBadgeColor(selectedLetter), fontWeight: 600 }}>
                                        {getBadgeLabel(selectedLetter)}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <label>Jenis Surat</label>
                                    <span className="detail-value" style={{ color: getJenisColor(selectedLetter.jenis_izin), fontWeight: 600 }}>
                                        {getJenisLabel(selectedLetter.jenis_izin)}
                                    </span>
                                </div>
                                <div className="detail-row detail-row-full">
                                    <label>Nama Siswa</label>
                                    <span className="detail-value detail-value-lg">{selectedLetter.siswa_nama}</span>
                                </div>
                                <div className="detail-row">
                                    <label>NISN</label>
                                    <span className="detail-value">{selectedLetter.siswa_nisn}</span>
                                </div>
                                <div className="detail-row">
                                    <label>Kelas</label>
                                    <span className="detail-value">{selectedLetter.siswa_kelas || '-'}</span>
                                </div>
                                <div className="detail-row detail-row-full">
                                    <label>Periode</label>
                                    <span className="detail-value">{formatDateRange(selectedLetter.tgl_mulai, selectedLetter.tgl_selesai)}</span>
                                </div>
                                {selectedLetter.keterangan && (
                                    <div className="detail-row detail-row-full">
                                        <label>Keterangan</label>
                                        <span className="detail-value">{selectedLetter.keterangan}</span>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <label>Dibuat Oleh</label>
                                    <span className="detail-value">{selectedLetter.generated_by || '-'}</span>
                                </div>
                                <div className="detail-row">
                                    <label>Tanggal Dibuat</label>
                                    <span className="detail-value">{formatDateTime(selectedLetter.generated_at)}</span>
                                </div>
                                {selectedLetter.penjabat_nama && (
                                    <>
                                        <div className="detail-row">
                                            <label>Penandatangan</label>
                                            <span className="detail-value">{selectedLetter.penjabat_nama}</span>
                                        </div>
                                        <div className="detail-row">
                                            <label>Jabatan</label>
                                            <span className="detail-value">{selectedLetter.penjabat_jabatan || '-'}</span>
                                        </div>
                                    </>
                                )}
                                <div className="detail-row detail-row-full" style={{ alignItems: 'flex-start' }}>
                                    <label style={{ paddingTop: '0.25rem' }}>Barcode</label>
                                    <div className="verify-id" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <span style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>{selectedLetter.barcode}</span>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div className="detail-qr-wrapper" style={{ position: 'relative', display: 'inline-block', flexShrink: 0, marginBottom: 0 }}>
                                                <img
                                                    src={`/api/qrcode?data=${encodeURIComponent(`${getPublicOrigin()}/ketidakhadiran/verify/${selectedLetter.barcode}`)}`}
                                                    alt="QR Verifikasi"
                                                    className="detail-qr-image"
                                                    style={{ width: '110px', height: '110px', padding: '0.25rem' }}
                                                />
                                                <img
                                                    src="/logo-sidebar-kecil.webp"
                                                    alt="Logo"
                                                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '22px', height: '22px', borderRadius: '4px', background: 'white', padding: '2px', objectFit: 'contain' }}
                                                />
                                            </div>
                                            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <div className="detail-link-box" style={{ marginBottom: 0, padding: '0.5rem' }}>
                                                    <code style={{ fontSize: '0.7rem' }}>{typeof window !== 'undefined' ? window.location.origin : ''}/ketidakhadiran/verify/{selectedLetter.barcode}</code>
                                                </div>
                                                <button
                                                    onClick={() => window.open(`/ketidakhadiran/verify/${selectedLetter.barcode}`, '_blank')}
                                                    className="srt-btn srt-btn-primary srt-btn-block"
                                                    style={{ padding: '0.5rem' }}
                                                >
                                                    <i className="bi bi-qr-code"></i> Buka Mode Verifikasi
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {viewer}
        </>
    );
}

export default function MaintenanceWrappedDaftarAccaPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_ketidakhadiran_daftar" />
            <DaftarSuratTab {...props} />
        </>
    );
}
