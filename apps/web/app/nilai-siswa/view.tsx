'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Spinner } from '@/components/ui/Spinner';
import DetailHeader, { DetailHeaderSelect } from '@/components/ui/DetailHeader';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import Button from '@/components/ui/Button';
import { ActionButton } from '@/components/ui/ActionButtons';
import { getProxiedImageUrl } from '@/lib/image-utils';
import { MobileList, MobileListItem, MobileAvatar } from '@/components/mobile/MobileList';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-client';
import { getActiveTahunAjaranList, currentSemesterDefault } from '@/lib/tahun-ajaran-client';
import { ApiResponse } from '@/lib/types';
import Swal from 'sweetalert2';
import type { User } from '@/lib/types';
// Dark mode halaman ini. Style dasarnya ada di globals.css; override gelap
// sengaja dipisah ke file sendiri agar tidak bentrok dengan pekerjaan lain
// di globals.css, dan karena CSS halaman dimuat setelahnya sehingga menang.
import './nilai-siswa.css';

interface NilaiItem {
    id: string;
    nip: string;
    kelas: string;
    mapel: string;
    semester: number;
    tahun_ajaran: string;
    nisn: string;
    jenis: string;
    materi_tp: string;
    tagihan: string;
    nilai: number | null;
    catatan: string | null;
    updated_at: string;
    nama_guru: string;
    topik?: string | null;
}

interface SiswaInfo {
    nisn: string;
    nama_lengkap: string;
    foto_profil: string | null;
}

interface KelasInfo {
    kelas: string;
    tahun_ajaran: string;
    semester: number;
}

interface StudentWithKelas {
    nisn: string;
    nama: string;
    kelas: string;
    tahun_ajaran: string;
    foto?: string | null;
}

/** Satu perolehan poin kuis rebutan (Nilai Apresiasi) milik siswa ini. */
interface ApresiasiItem {
    id: string;
    mapel: string;
    tahun_ajaran: string | null;
    semester: number | null;
    nama_guru: string | null;
    judul: string;
    topik: string | null;
    tanggal: string | null;
    poin_per_soal: number;
    jumlah_menang: number;
    total_poin: number;
    catatan: string | null;
}

interface GroupedData {
    siswa: SiswaInfo | null;
    kelas: KelasInfo[];
    grouped: Record<string, Record<string, NilaiItem[]>>;
    all: NilaiItem[];
}

const ITEMS_PER_PAGE = 10;

// --- Helper components defined at module scope ---
function LoadingSpinner() {
    return (
        <div className="nilai-page">
            <div className="nilai-page__spinner">
                <Spinner variant="buble" size={32} />
            </div>
        </div>
    );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="nilai-page">
            <div className="nilai-page__error">
                <div className="nilai-page__error-icon">
                    <svg className="nilai-page__error-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="nilai-page__error-title">Terjadi Kesalahan</h2>
                <p className="nilai-page__error-msg">{message}</p>
                <button
                    onClick={onRetry}
                    className="nilai-page__btn nilai-page__btn--primary"
                >
                    Coba Lagi
                </button>
            </div>
        </div>
    );
}

function Pagination({
    currentPage,
    totalPages,
    onPageChange
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="nilai-page__pagination">
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="nilai-page__page-btn nilai-page__page-btn--nav"
            >
                <svg className="nilai-page__page-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {getPageNumbers().map((page, idx) =>
                page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="nilai-page__page-ellipsis">...</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page as number)}
                        className={`nilai-page__page-btn ${currentPage === page ? 'nilai-page__page-btn--active' : ''}`}
                    >
                        {page}
                    </button>
                )
            )}

            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="nilai-page__page-btn nilai-page__page-btn--nav"
            >
                <svg className="nilai-page__page-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}

// --- Main Page Component ---
function NilaiSiswaPage() {
    const router = useRouter();

    // Auth state
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isOrangTua, setIsOrangTua] = useState(false);

    // Nilai data
    const [data, setData] = useState<GroupedData | null>(null);
    /** Poin kuis rebutan; berdiri sendiri, tidak masuk rata-rata mapel. */
    const [apresiasi, setApresiasi] = useState<ApresiasiItem[]>([]);
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [availableTahunAjaran, setAvailableTahunAjaran] = useState<string[]>([]);
    const [availableSemester, setAvailableSemester] = useState<string[]>([]);

    // Student selector state
    const [allStudents, setAllStudents] = useState<StudentWithKelas[]>([]);
    const [selectedNisn, setSelectedNisn] = useState('');
    const [filterKelas, setFilterKelas] = useState('');
    const [filterTahunAjaran, setFilterTahunAjaran] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const { kelasList, tahunAjaranList } = useMemo(() => {
        const kelasSet = new Set<string>();
        const taSet = new Set<string>();
        allStudents.forEach(s => {
            if (s.tahun_ajaran) taSet.add(s.tahun_ajaran);
            if (!filterTahunAjaran || s.tahun_ajaran === filterTahunAjaran) {
                if (s.kelas) kelasSet.add(s.kelas);
            }
        });
        return {
            kelasList: Array.from(kelasSet).sort(),
            tahunAjaranList: Array.from(taSet).sort((a, b) => b.localeCompare(a))
        };
    }, [allStudents, filterTahunAjaran]);

    useEffect(() => {
        if (filterKelas && !kelasList.includes(filterKelas)) {
            setFilterKelas('');
        }
    }, [kelasList, filterKelas]);

    const filteredStudents = useMemo(() => {
        return allStudents.filter(s => {
            if (filterKelas && s.kelas !== filterKelas) return false;
            if (filterTahunAjaran && s.tahun_ajaran !== filterTahunAjaran) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!s.nisn.toLowerCase().includes(q) && !s.nama.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [allStudents, filterKelas, filterTahunAjaran, searchQuery]);

    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
    const paginatedStudents = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredStudents, currentPage]);

    const selectedStudent = useMemo(() => {
        if (!isAdmin || !selectedNisn) return null;
        return allStudents.find(s => s.nisn === selectedNisn);
    }, [isAdmin, selectedNisn, allStudents]);

    const currentItems = useMemo(() => {
        let items: NilaiItem[] = [];
        if (!data?.grouped || !selectedTahunAjaran || !selectedSemester) {
            items = data?.all || [];
        } else {
            items = data.grouped[selectedTahunAjaran]?.[selectedSemester] || [];
        }

        // Filter out empty PAS rows as requested by user
        return items.filter(i => {
            if (i.jenis === 'PAS' && (i.nilai === null || i.nilai === undefined)) return false;
            return true;
        });
    }, [data, selectedTahunAjaran, selectedSemester]);

    /** Disaring mengikuti pemilih tahun ajaran & semester yang sama dengan tabel nilai. */
    const currentApresiasi = useMemo(() => {
        // selectedSemester berisi angka dalam bentuk string ("1"/"2") — kunci
        // grouped dibuat dengan String(r.semester) di app/api/nilai/siswa/route.ts.
        const parsed = parseInt(selectedSemester);
        const semNum = isNaN(parsed) ? null : parsed;
        return apresiasi.filter(a => {
            if (selectedTahunAjaran && a.tahun_ajaran && a.tahun_ajaran !== selectedTahunAjaran) return false;
            if (semNum !== null && a.semester !== null && a.semester !== semNum) return false;
            return true;
        });
    }, [apresiasi, selectedTahunAjaran, selectedSemester]);

    const groupedByMapel = useMemo(() => {
        const grouped: Record<string, NilaiItem[]> = {};
        currentItems.forEach(item => {
            const key = item.mapel;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    }, [currentItems]);

    const mapelList = useMemo(() => Object.keys(groupedByMapel).sort(), [groupedByMapel]);

    const stats = useMemo(() => {
        const validItems = currentItems.filter(i => i.nilai !== null);
        const avg = validItems.length > 0
            ? validItems.reduce((sum, i) => sum + (i.nilai || 0), 0) / validItems.length
            : null;
        return {
            total: currentItems.length,
            mapel: mapelList.length,
            avg,
            kelas: [...new Set(currentItems.map(i => i.kelas))].join(', ') || '-'
        };
    }, [currentItems, mapelList]);

    // --- Callbacks ---
    const checkAuth = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const userData = await getCurrentUser();
            if (!userData) { router.push('/login'); return; }

            const adminRoles = ['ADMIN', 'WALI_KELAS', 'KAMAD'];
            const isSiswaUser = userData.role === 'SISWA' || userData.roles?.includes('SISWA');
            const isOrangTuaUser = userData.role === 'ORANG_TUA' || userData.roles?.includes('ORANG_TUA');
            const isAdminUser = adminRoles.some(r => userData.roles?.includes(r));
            setIsAdmin(isAdminUser || isOrangTuaUser);
            setIsOrangTua(isOrangTuaUser);
            setUser(userData);

            if (isAdminUser || isOrangTuaUser) {
                const photoMap: Record<string, string> = {};
                try {
                    const photoRes = await fetch('/api/nilai/siswa/photos');
                    const photoJson = await photoRes.json();
                    if (photoJson.ok && Array.isArray(photoJson.data)) {
                        photoJson.data.forEach((u: any) => {
                            if (!u.foto_profil) return;
                            const url = getProxiedImageUrl(u.foto_profil);
                            if (u.nip) photoMap[u.nip] = url;
                            if (u.username) photoMap[u.username] = url;
                        });
                    }
                } catch (photoErr: any) {
                    console.warn('[NilaiSiswa] Gagal memuat foto profil:', photoErr.message);
                }

                if (isOrangTuaUser) {
                    const res = await fetch('/api/orangtua/anak');
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const mapped = json.data.map((d: any) => ({
                            nisn: d.nisn,
                            nama: d.nama_lengkap,
                            kelas: d.kelas || '-',
                            tahun_ajaran: d.tahun_ajaran || '-',
                            foto: d.foto ? getProxiedImageUrl(d.foto) : (photoMap[d.nisn] || null)
                        }));
                        setAllStudents(mapped);

                        // Auto-pilih HANYA jika anak tunggal; jika lebih dari satu,
                        // biarkan selector tampil agar orang tua bisa memilih anaknya.
                        // setSelectedNisn memicu checkAuth ulang yang memanggil fetchNilai.
                        if (mapped.length === 1 && !selectedNisn) {
                            setSelectedNisn(mapped[0].nisn);
                        }
                    }
                } else {
                    // Kelas binaan (WALI_KELAS) & hanya kelas reguler ditentukan di server —
                    // lihat app/api/nilai/siswa/students/route.ts
                    const res = await fetch('/api/nilai/siswa/students');
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const mapped = json.data.map((s: any) => ({
                            ...s,
                            foto: photoMap[s.nisn] || null
                        }));
                        setAllStudents(mapped);
                    }
                }
            }

            // Badge "nilai baru" di sidebar bukan antrean tindakan — ia hilang
            // karena halaman ini dibuka, bukan karena siswa mengerjakan sesuatu.
            // Gagal menandai sengaja dibiarkan diam: konsekuensinya cuma badge
            // yang telat padam, tidak boleh sampai menggagalkan tampilan nilai.
            if (isSiswaUser) {
                fetch('/api/sidebar-badges/seen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queue: 'nilai-siswa' }),
                }).catch(() => { });
            }

            const nisn = userData.nip;
            if (isSiswaUser && !nisn) {
                setError('NISN tidak ditemukan. Hubungi administrator.');
                return;
            }

            if ((isAdminUser || isOrangTuaUser) && !selectedNisn) return;

            const targetNisn = isSiswaUser ? nisn : selectedNisn;
            await fetchNilai(targetNisn);
        } catch (e: any) {
            console.error('Auth error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [router, selectedNisn]);

    const fetchNilai = useCallback(async (nisn: string) => {
        try {
            setLoading(true);
            setError(null);
            // Fetch all data without semester filter so all nilai (Tugas, UH, Kuis, etc.) are shown
            const res = await fetch(`/api/nilai/siswa?nisn=${encodeURIComponent(nisn)}`);
            const json: ApiResponse<GroupedData> = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal memuat data nilai');

            setData(json.data || null);
            if (json.data?.grouped) {
                // Pilihan tahun ajaran HANYA yang aktif di master_tahun_ajaran —
                // tahun nonaktif tidak ditawarkan. Fallback ke tahun yang punya
                // data hanya bila tidak ada TA aktif sama sekali.
                const activeYears = await getActiveTahunAjaranList();
                const dataYears = Object.keys(json.data.grouped);
                const tahunList = [...new Set(activeYears.length > 0 ? activeYears : dataYears)]
                    .sort((a, b) => b.localeCompare(a));
                setAvailableTahunAjaran(tahunList);
                if (tahunList.length > 0) setSelectedTahunAjaran(tahunList[0]);
            }

            // Nilai Apresiasi diambil terpisah dan SENGAJA tidak digabung ke
            // `data.grouped`: rata-rata per mapel di kartu mapel dihitung dari
            // seluruh isinya, jadi memasukkan poin apresiasi ke sana akan
            // menggeser angka yang bukan urusannya.
            // Diambil paling belakang dan kegagalannya ditelan: tabelnya baru,
            // dan sebelum migrasinya dijalankan permintaan ini memang gagal —
            // tabel nilai di atas tidak boleh ikut kosong karenanya.
            try {
                const resApr = await fetch(`/api/nilai/siswa/apresiasi?nisn=${encodeURIComponent(nisn)}&tahun_ajaran=all`);
                const jsonApr = await resApr.json();
                setApresiasi(jsonApr?.ok ? (jsonApr.data || []) : []);
            } catch {
                setApresiasi([]);
            }
        } catch (e: any) {
            console.error('Fetch nilai error:', e);
            setError(e.message);
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
        } finally {
            setLoading(false);
        }
    }, []);

    const handleStudentSelect = useCallback(async (nisn: string) => {
        setSelectedNisn(nisn);
        await fetchNilai(nisn);
    }, [fetchNilai]);

    const handleResetSelection = useCallback(() => {
        setSelectedNisn('');
        setData(null);
        setApresiasi([]);
        setFilterKelas('');
        setFilterTahunAjaran('');
        setSearchQuery('');
        setCurrentPage(1);
    }, []);

    // --- Effects ---
    useEffect(() => { checkAuth(); }, [checkAuth]);

    useEffect(() => {
        if (data?.grouped && selectedTahunAjaran) {
            // Always show both semesters 1 and 2
            const allSemesters = ['1', '2'];
            setAvailableSemester(allSemesters);
            // Default mengikuti semester berjalan (Jul–Des = Ganjil, Jan–Jun = Genap);
            // jika semester itu belum ada datanya, pakai semester yang ada datanya.
            const monthDefault = currentSemesterDefault();
            const withData = Object.keys(data.grouped[selectedTahunAjaran] || {});
            setSelectedSemester(withData.includes(monthDefault) ? monthDefault : (withData[0] || monthDefault));
        }
    }, [data, selectedTahunAjaran]);

    // Reset page when filters change
    useEffect(() => { setCurrentPage(1); }, [filterKelas, filterTahunAjaran, searchQuery]);

    // --- Helpers ---
    const getSemesterLabel = (sem: string | number) => {
        const s = String(sem);
        if (s === '1') return 'Ganjil';
        if (s === '2') return 'Genap';
        return s;
    };

    const getNilaiBadge = (nilai: number | null, kkm = 75) => {
        if (nilai === null) return { bg: 'nilai-page__nilai-badge--none', label: '-' };
        if (nilai >= kkm) return { bg: 'nilai-page__nilai-badge--tuntas', label: String(nilai) };
        return { bg: 'nilai-page__nilai-badge--remedial', label: String(nilai) };
    };

    const getJenisBadge = (jenis: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            'PAS': { bg: 'bg-blue-100', text: 'text-blue-700' },
            'UH': { bg: 'bg-blue-100', text: 'text-blue-700' },
            'TUGAS': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
            'KUIS': { bg: 'bg-amber-100', text: 'text-amber-700' },
            'SUM': { bg: 'bg-rose-100', text: 'text-rose-700' },
        };
        return badges[jenis] || { bg: 'bg-slate-100', text: 'text-slate-700' };
    };

    const getJenisLabel = (jenis: string, tagihan?: string, materiTp?: string) => {
        // Try tagihan first (e.g. "KUIS_1" or "TUGAS 2")
        if (tagihan) {
            const match = tagihan.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (match) {
                return `${match[1].toUpperCase()} ${match[2]}`;
            }
        }
        // Fallback: try materi_tp (e.g. "TUGAS 1 - Bab 1")
        if (materiTp) {
            const match = materiTp.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (match) {
                return `${match[1].toUpperCase()} ${match[2]}`;
            }
        }
        return jenis;
    };

    const getTopikDisplay = (item: NilaiItem) => {
        const base = item.materi_tp || item.tagihan || '-';
        if (item.topik && item.topik !== '-' && item.topik.trim() !== '') {
            // Priority for topic title
            return `${base}: ${item.topik}`;
        }
        return base;
    };

    const parseSumInfo = (item: NilaiItem) => {
        const full = getTopikDisplay(item);
        
        // 1. Check for SUM X pattern
        const sumMatch = full.match(/^(SUM\s*\d+)(?:\s*[:\-]\s*(.*))?$/i);
        if (sumMatch) {
            return {
                sumGroup: sumMatch[1].toUpperCase(),
                actualTopic: (sumMatch[2] || '').trim() || '-',
                isSumType: true
            };
        }
        
        // 2. Handle PAS (Penilaian Akhir Semester) - Standalone per semester
        if (item.jenis === 'PAS' || full.toUpperCase().startsWith('PAS')) {
            return {
                sumGroup: 'PAS',
                actualTopic: '-', // PAS doesn't have a topic title
                isSumType: true
            };
        }

        return {
            sumGroup: '-',
            actualTopic: full,
            isSumType: false
        };
    };

    // --- Loading / Error ---
    if (loading) return <LoadingSpinner />;
    if (error && !data) return <ErrorView message={error} onRetry={checkAuth} />;

    // --- Admin: Student Selector View ---
    if (isAdmin && !selectedNisn && !data) {
        const hasActiveFilters = filterKelas || filterTahunAjaran || searchQuery;

        return (
            <div className="nilai-page">
            <div className="nilai-page__inner">
                {/* Page Banner Header */}
                

                {/* Content */}
                <div className="nilai-page__content">
                    {/* Filters Toolbar */}
                    <FilterToolbar className="nilai-page__filter-toolbar">
                        <FilterSearch
                            label="Cari Siswa"
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Ketik nama atau NISN..."
                            grow={2}
                        />
                        <FilterSelect
                            label="Tahun Ajaran"
                            icon="mortarboard"
                            value={filterTahunAjaran}
                            onChange={setFilterTahunAjaran}
                            options={[{ value: '', label: 'Semua' }, ...tahunAjaranList.map(ta => ({ value: ta, label: ta }))]}
                        />
                        <FilterSelect
                            label="Kelas"
                            icon="door-open"
                            value={filterKelas}
                            onChange={setFilterKelas}
                            options={[{ value: '', label: 'Semua' }, ...kelasList.map(kelas => ({ value: kelas, label: kelas }))]}
                        />
                    </FilterToolbar>

                    {/* Student List - Desktop Table */}
                    <div className="nilai-page__card nilai-page__table-container">
                        {paginatedStudents.length === 0 ? (
                            <div className="nilai-page__empty-state">
                                <h3 className="nilai-page__empty-title">Belum ada data</h3>
                            </div>
                        ) : (
                            <>
                                <div className="nilai-page__table-wrap">
                                    <table className="nilai-page__table">
                                        <thead>
                                            <tr>
                                                <th className="nilai-page__th">No</th>
                                                <th className="nilai-page__th">Nama Siswa</th>
                                                <th className="nilai-page__th">NISN</th>
                                                <th className="nilai-page__th">Kelas</th>
                                                <th className="nilai-page__th">Tahun Ajaran</th>
                                                <th className="nilai-page__th">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedStudents.map((student, idx) => (
                                                <tr key={student.nisn} className="nilai-page__tr">
                                                    <td className="nilai-page__td">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                                    <td className="nilai-page__td">
                                                        <div className="nilai-page__student-info-row">
                                                            <MobileAvatar
                                                                name={student.nama}
                                                                seed={student.nisn}
                                                                src={student.foto || null}
                                                            />
                                                            <span className="nilai-page__student-name-row">{student.nama}</span>
                                                        </div>
                                                    </td>
                                                    <td className="nilai-page__td nilai-page__td--muted">{student.nisn}</td>
                                                    <td className="nilai-page__td">
                                                        <span className="nilai-page__badge nilai-page__badge--blue">{student.kelas}</span>
                                                    </td>
                                                    <td className="nilai-page__td">
                                                        <span className="nilai-page__badge nilai-page__badge--blue">{student.tahun_ajaran}</span>
                                                    </td>
                                                    <td className="nilai-page__td">
                                                        <ActionButton
                                                            action="view"
                                                            label="Lihat Nilai"
                                                            iconOnly={false}
                                                            onClick={() => handleStudentSelect(student.nisn)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Student List - Mobile */}
                    <div className="kehadiran-page__student-grid-mobile">
                        {paginatedStudents.length === 0 ? (
                            <div className="kehadiran-page__card kehadiran-page__empty-state">
                                <h3 className="kehadiran-page__empty-title">Belum ada data</h3>
                            </div>
                        ) : (
                            <MobileList label="Daftar Siswa">
                                {paginatedStudents.map((student) => (
                                    <MobileListItem
                                        key={student.nisn}
                                        title={student.nama}
                                        subtitle={`NISN: ${student.nisn}`}
                                        badge={<span className="nilai-page__badge nilai-page__badge--blue">{student.kelas}</span>}
                                        avatarSrc={student.foto || null}
                                        seed={student.nisn}
                                        onClick={() => handleStudentSelect(student.nisn)}
                                    />
                                ))}
                            </MobileList>
                        )}
                    </div>

                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
            </div>
            </div>
        );
    }

    // --- Nilai Display View ---
    return (
        <div className="nilai-page">
            <div className="nilai-page__inner">
                {/* Detail Header with Back Button and Integrated Tahun Ajaran & Semester Selectors */}
                <DetailHeader
                    onBack={isAdmin && !(isOrangTua && allStudents.length <= 1) ? handleResetSelection : undefined}
                    name={data?.siswa?.nama_lengkap || selectedStudent?.nama || 'Siswa'}
                    meta={`NISN ${data?.siswa?.nisn || (isAdmin ? selectedNisn : user?.nip)}${data?.kelas?.[0]?.kelas ? ` - ${data.kelas[0].kelas}` : ''}`}
                >
                    {availableTahunAjaran.length > 0 && (
                        <DetailHeaderSelect
                            icon="calendar-event"
                            value={selectedTahunAjaran}
                            onChange={(e) => setSelectedTahunAjaran(e.target.value)}
                        >
                            {availableTahunAjaran.map((ta) => (
                                <option key={ta} value={ta}>{ta}</option>
                            ))}
                        </DetailHeaderSelect>
                    )}
                    {availableSemester.length > 0 && (
                        <DetailHeaderSelect
                            icon="journal-bookmark"
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(e.target.value)}
                        >
                            {availableSemester.map((sem) => (
                                <option key={sem} value={sem}>{getSemesterLabel(sem)}</option>
                            ))}
                        </DetailHeaderSelect>
                    )}
                </DetailHeader>

                {/* Content */}
                <div className="nilai-page__content">
                    {/* Stats Cards */}
                    <div className="nilai-page__stats-grid">
                        {[
                            { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Total Nilai', value: stats.total },
                            { icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Mapel', value: stats.mapel },
                            { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Rata-rata', value: stats.avg !== null ? stats.avg.toFixed(1) : '-' },
                            { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Kelas', value: stats.kelas },
                        ].map((stat, idx) => (
                            <div key={idx} className="nilai-page__stat-card">
                                <div className={`nilai-page__stat-icon ${stat.bg}`}>
                                    <svg className={`nilai-page__stat-svg ${stat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                                    </svg>
                                </div>
                                <div className="nilai-page__stat-body">
                                    <p className="nilai-page__stat-label">{stat.label}</p>
                                    <p className="nilai-page__stat-value">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Grades */}
                    {mapelList.length === 0 ? (
                        <div className="nilai-page__card nilai-page__empty-state">
                            <h3 className="nilai-page__empty-title">Belum ada data</h3>
                        </div>
                    ) : (
                    <div className="nilai-page__mapel-list">
                        {mapelList.map((mapel) => {
                            const items = groupedByMapel[mapel];
                            const itemsWithInfo = items.map(i => ({
                                ...i,
                                info: parseSumInfo(i)
                            }));

                            // Sort by sumGroup then by type (SUM assessments first in group)
                            itemsWithInfo.sort((a, b) => {
                                if (a.info.sumGroup !== b.info.sumGroup) {
                                    if (a.info.sumGroup === '-') return 1;
                                    if (b.info.sumGroup === '-') return -1;
                                    
                                    // Custom order: SUM groups first, then PAS
                                    if (a.info.sumGroup === 'PAS' && b.info.sumGroup.startsWith('SUM')) return 1;
                                    if (a.info.sumGroup.startsWith('SUM') && b.info.sumGroup === 'PAS') return -1;
                                    
                                    return a.info.sumGroup.localeCompare(b.info.sumGroup);
                                }
                                // If same group, define internal priority
                                const getPriority = (j: string) => {
                                    if (j === 'SUM' || j === 'PAS') return 0;
                                    if (j === 'UH') return 100; // Bottom
                                    if (j === 'KUIS') return 10;
                                    if (j === 'TUGAS') return 20;
                                    return 50;
                                };
                                const priA = getPriority(a.jenis);
                                const priB = getPriority(b.jenis);
                                if (priA !== priB) return priA - priB;
                                
                                // Internal sort by name/number (e.g., Kuis 2 comes before Kuis 3)
                                const labelA = getJenisLabel(a.jenis, a.tagihan, a.materi_tp);
                                const labelB = getJenisLabel(b.jenis, b.tagihan, b.materi_tp);
                                return labelA.localeCompare(labelB, undefined, { numeric: true });
                            });

                            // Calculate RowSpans
                            const tableRows: any[] = [];
                            let i = 0;
                            while (i < itemsWithInfo.length) {
                                let j = i;
                                const currentSum = itemsWithInfo[i].info.sumGroup;
                                if (currentSum !== '-') {
                                    while (j < itemsWithInfo.length && itemsWithInfo[j].info.sumGroup === currentSum) {
                                        j++;
                                    }
                                    const count = j - i;
                                    
                                    // Find the "Judul" for this SUM group
                                    // Priority: row with jenis 'SUM', then any row with non-empty topic
                                    let groupTopic = '-';
                                    const groupItems = itemsWithInfo.slice(i, j);
                                    const sumAssessmentRow = groupItems.find(item => item.jenis === 'SUM' && item.info.actualTopic !== '-');
                                    if (sumAssessmentRow) {
                                        groupTopic = sumAssessmentRow.info.actualTopic;
                                    } else {
                                        const firstTopicRow = groupItems.find(item => item.info.actualTopic !== '-');
                                        if (firstTopicRow) groupTopic = firstTopicRow.info.actualTopic;
                                    }

                                    for (let k = i; k < j; k++) {
                                        tableRows.push({
                                            ...itemsWithInfo[k],
                                            rowSpan: k === i ? count : 0,
                                            groupTopic
                                        });
                                    }
                                    i = j;
                                } else {
                                    tableRows.push({
                                        ...itemsWithInfo[i],
                                        rowSpan: 1
                                    });
                                    i++;
                                }
                            }

                            const avg = items.filter(i => i.nilai !== null).length > 0
                                ? items.reduce((sum, i) => sum + (i.nilai || 0), 0) / items.filter(i => i.nilai !== null).length
                                : null;

                            return (
                                <div key={mapel} className="nilai-page__mapel-card">
                                    <div className="nilai-page__mapel-header">
                                        <div className="nilai-page__mapel-header-left">
                                            <div className="nilai-page__mapel-icon">
                                                <svg className="nilai-page__mapel-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                            </div>
                                            <div className="nilai-page__mapel-info">
                                                <h3 className="nilai-page__mapel-title">{mapel}</h3>
                                                <p className="nilai-page__mapel-guru" style={{ fontSize: '0.85rem', color: 'var(--n-muted)', marginTop: '2px', fontWeight: 500 }}>{Array.from(new Set(items.map(i => i.nama_guru).filter(Boolean))).join(', ')}</p>
                                            </div>
                                        </div>
                                        {avg !== null && (
                                            <div className={`nilai-page__avg-badge ${avg >= 75 ? 'nilai-page__avg-badge--tuntas' : 'nilai-page__avg-badge--remedial'}`}>
                                                <svg className="nilai-page__avg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                {avg.toFixed(1)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="nilai-page__mapel-body">
                                        {/* Desktop Table */}
                                        <div className="nilai-page__table-wrap">
                                            <table className="nilai-page__table">
                                                <thead>
                                                    <tr>
                                                        <th className="nilai-page__th">Sumatif</th>
                                                        <th className="nilai-page__th">Jenis</th>
                                                        <th className="nilai-page__th">Topik</th>
                                                        <th className="nilai-page__th nilai-page__th--right">Nilai</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tableRows.map((item, idx) => {
                                                        const jenis = getJenisBadge(item.jenis);
                                                        const nilai = getNilaiBadge(item.nilai);
                                                        return (
                                                            <tr key={item.id || idx} className="nilai-page__tr">
                                                                {item.rowSpan > 0 && (
                                                                    <td className="nilai-page__td nilai-page__td--sumatif" rowSpan={item.rowSpan}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            <span style={{ fontWeight: '800', fontSize: '0.875rem' }}>
                                                                                {item.info.sumGroup === '-' ? '-' : item.info.sumGroup}
                                                                            </span>
                                                                            {item.info.sumGroup !== '-' && item.info.sumGroup !== 'PAS' && item.groupTopic !== '-' && (
                                                                                <span style={{ fontSize: '0.75rem', fontWeight: '500', opacity: 0.75, lineHeight: '1.2' }}>
                                                                                    {item.groupTopic}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                <td className="nilai-page__td">
                                                                    {item.info.sumGroup !== 'PAS' ? (
                                                                        <span className={`nilai-page__jenis-badge nilai-page__jenis-badge--${item.jenis.toLowerCase()}`}>{getJenisLabel(item.jenis, item.tagihan, item.materi_tp)}</span>
                                                                    ) : (
                                                                        <span className="nilai-page__td--muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="nilai-page__td nilai-page__td--muted">
                                                                    {item.info.sumGroup !== 'PAS' ? item.info.actualTopic : '-'}
                                                                </td>
                                                                <td className="nilai-page__td nilai-page__td--right">
                                                                    <span className={`nilai-page__nilai-badge ${nilai.bg}`}>{nilai.label}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Cards */}
                                        <div className="nilai-page__mobile-cards" style={{ gap: '10px' }}>
                                            {tableRows.map((item, idx) => {
                                                const nilai = getNilaiBadge(item.nilai);
                                                const isSumGroup = item.info.sumGroup !== '-' && item.info.sumGroup !== 'PAS';
                                                
                                                return (
                                                    <div key={(item.id || idx) + '_mobile_container'}>
                                                        {/* SUM Group Header - Separate Parent Element */}
                                                        {isSumGroup && item.rowSpan > 0 && (
                                                            <div style={{
                                                                marginBottom: '10px',
                                                                padding: '6px 4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                borderBottom: '2px solid #3b82f6',
                                                                marginTop: idx > 0 ? '16px' : '0'
                                                            }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--n-primary)', background: 'rgba(59, 130, 246, 0.14)', padding: '2px 10px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    {item.info.sumGroup}
                                                                </span>
                                                                {item.groupTopic && item.groupTopic !== '-' && (
                                                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--n-text)' }}>
                                                                        {item.groupTopic}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="nilai-page__mobile-card" style={{
                                                            borderLeft: isSumGroup ? '4px solid #3b82f6' : '1px solid var(--n-border)',
                                                            paddingLeft: isSumGroup ? '12px' : '16px'
                                                        }}>
                                                            <div className="nilai-page__mobile-card-header">
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    {item.info.sumGroup === 'PAS' && (
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--n-primary)', background: 'rgba(59, 130, 246, 0.14)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                            Penilaian Akhir Semester (PAS)
                                                                        </span>
                                                                    )}
                                                                    {item.info.sumGroup !== 'PAS' && (
                                                                        <span className={`nilai-page__jenis-badge nilai-page__jenis-badge--${item.jenis.toLowerCase()}`} style={{ width: 'fit-content' }}>
                                                                            {getJenisLabel(item.jenis, item.tagihan, item.materi_tp)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className={`nilai-page__nilai-badge ${nilai.bg}`}>
                                                                    {nilai.label}
                                                                </span>
                                                            </div>
                                                            
                                                            {item.info.sumGroup !== 'PAS' && (
                                                                <div className="nilai-page__mobile-card-topic" style={{ margin: 0 }}>
                                                                    {item.info.actualTopic !== '-' ? item.info.actualTopic : <span style={{ color: 'var(--n-muted)', fontWeight: 400 }}>Tidak ada topik</span>}
                                                                </div>
                                                            )}

                                                            {item.catatan && (
                                                                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--n-border)', fontSize: '0.72rem', color: 'var(--n-muted)', fontStyle: 'italic', display: 'flex', gap: '6px' }}>
                                                                    <svg style={{ width: '12px', height: '12px', marginTop: '1px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                                    </svg>
                                                                    <span>&ldquo;{item.catatan}&rdquo;</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Nilai Apresiasi — kartu TERPISAH dari daftar mapel di atas.
                    Poin ini tidak boleh ikut ke rata-rata mapel: ia bukan nilai
                    capaian, dan siswa yang tidak muncul di sini bukan berarti
                    nilainya nol — ia hanya belum pernah menang rebutan. */}
                {currentApresiasi.length > 0 && (() => {
                    const totalApresiasiPoin = Number(currentApresiasi.reduce((sum, a) => sum + Number(a.total_poin || 0), 0).toFixed(2));
                    return (
                        <div className="nilai-page__mapel-card">
                            <div className="nilai-page__mapel-header">
                                <div className="nilai-page__mapel-header-left">
                                    <div className="nilai-page__mapel-icon">
                                        <svg className="nilai-page__mapel-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <div className="nilai-page__mapel-info">
                                        <h3 className="nilai-page__mapel-title">Nilai Apresiasi</h3>
                                        <p className="nilai-page__mapel-guru" style={{ fontSize: '0.85rem', color: 'var(--n-muted)', marginTop: '2px', fontWeight: 500 }}>
                                            Poin Kuis Rebutan (Cepat Tepat)
                                        </p>
                                    </div>
                                </div>
                                <div className="nilai-page__avg-badge">
                                    <svg className="nilai-page__avg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    +{totalApresiasiPoin}
                                </div>
                            </div>
                            <div className="nilai-page__mapel-body">
                                {/* Desktop Table */}
                                <div className="nilai-page__table-wrap">
                                    <table className="nilai-page__table">
                                        <thead>
                                            <tr>
                                                <th className="nilai-page__th">Sumatif / Mapel</th>
                                                <th className="nilai-page__th">Jenis</th>
                                                <th className="nilai-page__th">Topik</th>
                                                <th className="nilai-page__th nilai-page__th--right">Nilai / Poin</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentApresiasi.map((a, idx) => (
                                                <tr key={a.id || idx} className="nilai-page__tr">
                                                    <td className="nilai-page__td nilai-page__td--sumatif">
                                                        {a.mapel}
                                                    </td>
                                                    <td className="nilai-page__td">
                                                        <span className="nilai-page__jenis-badge nilai-page__jenis-badge--kuis">
                                                            KUIS
                                                        </span>
                                                    </td>
                                                    <td className="nilai-page__td nilai-page__td--muted">
                                                        {a.judul}{a.topik ? ` · ${a.topik}` : ''} ({a.jumlah_menang}x jawaban benar{a.nama_guru ? ` · ${a.nama_guru}` : ''})
                                                    </td>
                                                    <td className="nilai-page__td nilai-page__td--right">
                                                        +{Number(Number(a.total_poin).toFixed(2))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="nilai-page__mobile-cards" style={{ gap: '10px' }}>
                                    {currentApresiasi.map((a, idx) => (
                                        <div key={(a.id || idx) + '_apr_mobile'} className="nilai-page__mobile-card">
                                            <div className="nilai-page__mobile-card-header">
                                                <span className="nilai-page__jenis-badge nilai-page__jenis-badge--kuis">
                                                    {a.mapel}
                                                </span>
                                                <span className="nilai-page__nilai-badge">
                                                    +{Number(Number(a.total_poin).toFixed(2))}
                                                </span>
                                            </div>
                                            <div className="nilai-page__mobile-card-topic" style={{ margin: 0 }}>
                                                {a.judul}{a.topik ? ` · ${a.topik}` : ''}
                                            </div>
                                            <div className="nilai-page__mobile-card-meta" style={{ marginTop: '4px' }}>
                                                {a.jumlah_menang}x jawaban benar{a.nama_guru ? ` · ${a.nama_guru}` : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Legend */}
                <div className="nilai-page__card nilai-page__legend">
                    <h4 className="nilai-page__legend-title">
                        <svg className="nilai-page__legend-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Keterangan
                    </h4>
                    <div className="nilai-page__legend-grid">
                        {[
                            { label: 'PAS', desc: 'Penilaian Akhir Semester', cls: 'pas' },
                            { label: 'UH', desc: 'Ulangan Harian', cls: 'uh' },
                            { label: 'TUGAS', desc: 'Tugas', cls: 'tugas' },
                            { label: 'KUIS', desc: 'Kuis', cls: 'kuis' },
                            { label: 'SUM', desc: 'Sumatif', cls: 'sum' },
                        ].map((item) => (
                            <div key={item.label} className="nilai-page__legend-item">
                                <span className={`nilai-page__jenis-badge nilai-page__jenis-badge--${item.cls}`}>{item.label}</span>
                                <span className="nilai-page__legend-desc">{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}


// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedNilaiSiswaPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_nilai_siswa" />
            <NilaiSiswaPage {...props} />
        </>
    );
}
