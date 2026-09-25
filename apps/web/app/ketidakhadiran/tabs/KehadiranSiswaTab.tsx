'use client';
import Pagination from '@/components/ui/Pagination';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Spinner } from '@/components/ui/Spinner';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-client';
import { getActiveTahunAjaranList, tahunAjaranFromDate } from '@/lib/tahun-ajaran-client';
import { ApiResponse } from '@/lib/types';
import { getProxiedImageUrl } from '@/lib/image-utils';
import Swal from 'sweetalert2';
import type { User } from '@/lib/types';
import { DetailHeader, DetailHeaderSelect } from '@/components/ui/DetailHeader';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import Button from '@/components/ui/Button';
import { ActionButton } from '@/components/ui/ActionButtons';
import { MobileList, MobileListItem, MobileAvatar } from '@/components/mobile/MobileList';
import '../ketidakhadiran.css';
import { jpToHari, formatJpDurasi, calcHariKalender } from '@/lib/ketidakhadiran-jp';

interface StudentWithKelas {
    nisn: string;
    nama: string;
    kelas: string;
    tahun_ajaran: string;
    foto?: string | null;
}

interface KehadiranStats {
    total_izin_hari_kalender: number;
    total_sakit_hari_kalender: number;
    total_izin_hari: number;
    total_sakit_hari: number;
    total_izin_jp: number;
    total_sakit_jp: number;
    total_hari: number;
    total_jp: number;
}

interface RiwayatItem {
    id: string;
    jenis: 'IZIN' | 'SAKIT';
    tgl_mulai: string;
    tgl_selesai: string;
    keterangan: string;
    status: string;
    aktif: boolean;
    waktu_mulai_real: string | null;
    waktu_selesai_real: string | null;
    jumlah_hari: number;
    jumlah_jp: number;
    hari_kalender?: number;
    display_durasi: string;
    created_at: string;
}

interface KehadiranData {
    siswa: {
        nama: string;
        nisn: string;
        kelas: string;
    };
    stat: KehadiranStats;
    riwayat: RiwayatItem[];
}

const ITEMS_PER_PAGE = 10;

function renderJpWithDays(jp: number): string {
    const display = formatJpDurasi(jp);
    if (display === `${jp} JP` || jp === 0) return `${jp} JP`;
    return `${jp} JP (${display})`;
}

function LoadingSpinner() {
    return (
        <div className="kehadiran-page">
            <div className="kehadiran-page__spinner">
                <Spinner size={40} />
            </div>
        </div>
    );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="kehadiran-page">
            <div className="kehadiran-page__error">
                <div className="kehadiran-page__error-icon">
                    <svg className="kehadiran-page__error-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="kehadiran-page__error-title">Terjadi Kesalahan</h2>
                <p className="kehadiran-page__error-msg">{message}</p>
                <button onClick={onRetry} className="kehadiran-page__btn kehadiran-page__btn--primary">
                    Coba Lagi
                </button>
            </div>
        </div>
    );
}


export function KehadiranSiswaTab() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isOrangTua, setIsOrangTua] = useState(false);

    const [data, setData] = useState<KehadiranData | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentPageRiwayat, setCurrentPageRiwayat] = useState(1);
    const [detailTahunAjaran, setDetailTahunAjaran] = useState('');
    const [activeYearsList, setActiveYearsList] = useState<string[]>([]);

    const [allStudents, setAllStudents] = useState<StudentWithKelas[]>([]);
    const [selectedNisn, setSelectedNisn] = useState('');
    const [filterKelas, setFilterKelas] = useState('');
    const [filterTahunAjaran, setFilterTahunAjaran] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const { kelasList, tahunAjaranList } = useMemo(() => {
        const kelasSet = new Set<string>();
        const taSet = new Set<string>();
        allStudents.forEach(s => {
            if (s.kelas) kelasSet.add(s.kelas);
            if (s.tahun_ajaran) taSet.add(s.tahun_ajaran);
        });

        const filteredTaList = activeYearsList.length > 0
            ? activeYearsList
            : Array.from(taSet).sort((a, b) => b.localeCompare(a));

        return {
            kelasList: Array.from(kelasSet).sort(),
            tahunAjaranList: [...filteredTaList].sort((a, b) => b.localeCompare(a))
        };
    }, [allStudents, activeYearsList]);

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

    const filteredRiwayat = useMemo(() => {
        const rows = data?.riwayat || [];
        if (!detailTahunAjaran || detailTahunAjaran === 'ALL') return rows;
        return rows.filter(r => tahunAjaranFromDate(r.tgl_mulai) === detailTahunAjaran);
    }, [data, detailTahunAjaran]);

    const detailTahunOptions = useMemo(() => {
        if (activeYearsList.length > 0) {
            return [...activeYearsList].sort((a, b) => b.localeCompare(a));
        }
        const set = new Set<string>();
        (data?.riwayat || []).forEach(r => {
            const ta = tahunAjaranFromDate(r.tgl_mulai);
            if (ta) set.add(ta);
        });
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [activeYearsList, data]);

    const filteredStats = useMemo<KehadiranStats>(() => {
        const izin = filteredRiwayat.filter(r => r.jenis === 'IZIN');
        const sakit = filteredRiwayat.filter(r => r.jenis === 'SAKIT');
        const sumJp = (rows: RiwayatItem[]) => rows.reduce((acc, r) => acc + (r.jumlah_jp || 0), 0);
        const sumHariK = (rows: RiwayatItem[]) => rows.reduce((acc, r) => acc + (r.hari_kalender || calcHariKalender(r.tgl_mulai, r.tgl_selesai)), 0);
        
        const izinJp = sumJp(izin);
        const sakitJp = sumJp(sakit);
        const izinHariK = sumHariK(izin);
        const sakitHariK = sumHariK(sakit);
        
        return {
            total_izin_hari_kalender: izinHariK,
            total_sakit_hari_kalender: sakitHariK,
            total_izin_hari: jpToHari(izinJp),
            total_sakit_hari: jpToHari(sakitJp),
            total_izin_jp: izinJp,
            total_sakit_jp: sakitJp,
            total_hari: jpToHari(izinJp + sakitJp),
            total_jp: izinJp + sakitJp,
        };
    }, [filteredRiwayat]);

    const RIWAYAT_PER_PAGE = 10;
    const totalRiwayatPages = Math.ceil(filteredRiwayat.length / RIWAYAT_PER_PAGE);
    const paginatedRiwayat = useMemo(() => {
        const startIndex = (currentPageRiwayat - 1) * RIWAYAT_PER_PAGE;
        return filteredRiwayat.slice(startIndex, startIndex + RIWAYAT_PER_PAGE);
    }, [filteredRiwayat, currentPageRiwayat]);

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
                if (isOrangTuaUser) {
                    const res = await fetch('/api/orangtua/anak');
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const mapped = json.data.map((d: any) => ({
                            nisn: d.nisn,
                            nama: d.nama_lengkap,
                            kelas: d.kelas || '-',
                            tahun_ajaran: d.tahun_ajaran || '-',
                            foto: d.foto ? getProxiedImageUrl(d.foto) : null
                        }));
                        setAllStudents(mapped);

                        if (mapped.length === 1 && !selectedNisn) {
                            setSelectedNisn(mapped[0].nisn);
                        }
                    }
                } else {
                    try {
                        const resSiswa = await fetch('/api/settings/siswa-kelas?aktif=true');
                        if (resSiswa.ok) {
                            const jsonSiswa = await resSiswa.json().catch(() => null);
                            const list = jsonSiswa?.data || jsonSiswa || [];
                            if (Array.isArray(list)) {
                                const studentMap = new Map<string, StudentWithKelas>();
                                // Sort: kelas reguler (tidak mengandung 'Lanjut'/'Pilihan') diutamakan
                                const sorted = [...list].sort((a: any, b: any) => {
                                    const aIsLanjut = (a.kelas || '').toLowerCase().includes('lanjut') || (a.kelas || '').toLowerCase().includes('pilihan');
                                    const bIsLanjut = (b.kelas || '').toLowerCase().includes('lanjut') || (b.kelas || '').toLowerCase().includes('pilihan');
                                    return (aIsLanjut ? 1 : 0) - (bIsLanjut ? 1 : 0);
                                });
                                sorted.forEach((s: any) => {
                                    const nisn = s.nisn || s.username;
                                    if (nisn && !studentMap.has(nisn)) {
                                        studentMap.set(nisn, {
                                            nisn: nisn,
                                            nama: s.nama_siswa || s.nama || s.nama_lengkap || '',
                                            kelas: s.kelas || '-',
                                            tahun_ajaran: s.tahun_ajaran || '-',
                                            foto: s.foto ? getProxiedImageUrl(s.foto) : (s.foto_profil ? getProxiedImageUrl(s.foto_profil) : null)
                                        });
                                    }
                                });
                                setAllStudents(Array.from(studentMap.values()));
                            }
                        }
                    } catch (err) {
                        console.error('[KehadiranSiswa] Gagal memuat daftar siswa:', err);
                    }
                }
            }

            const nisn = userData.nip;
            if (isSiswaUser && !nisn) {
                setError('NISN tidak ditemukan. Hubungi administrator.');
                return;
            }

            if (isAdminUser || isOrangTuaUser) {
                if (!selectedNisn) return;
                try {
                    setLoading(true);
                    setError(null);
                    const res = await fetch(`/api/ketidakhadiran/log/siswa/${encodeURIComponent(selectedNisn)}`);
                    const json: any = await res.json();
                    if (!json.ok && !json.success) throw new Error(json.error || 'Gagal memuat data kehadiran');
                    setData(json.data || json);
                } catch (e: any) {
                    console.error('Fetch kehadiran error:', e);
                    setError(e.message);
                    Swal.fire({ icon: 'error', title: 'Error', text: e.message });
                } finally {
                    setLoading(false);
                }
            } else {
                try {
                    setLoading(true);
                    setError(null);
                    const res = await fetch(`/api/ketidakhadiran/log/siswa/${encodeURIComponent(nisn)}`);
                    const json: any = await res.json();
                    if (!json.ok && !json.success) throw new Error(json.error || 'Gagal memuat data kehadiran');
                    setData(json.data || json);
                } catch (e: any) {
                    console.error('Fetch kehadiran error:', e);
                    setError(e.message);
                    Swal.fire({ icon: 'error', title: 'Error', text: e.message });
                } finally {
                    setLoading(false);
                }
            }
        } catch (e: any) {
            console.error('Auth error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [router, selectedNisn]);

    const fetchKehadiran = useCallback(async (nisn: string) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/ketidakhadiran/log/siswa/${encodeURIComponent(nisn)}`);
            const json: any = await res.json();
            if (!json.ok && !json.success) throw new Error(json.error || 'Gagal memuat data kehadiran');

            setData(json.data || json);
        } catch (e: any) {
            console.error('Fetch kehadiran error:', e);
            setError(e.message);
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
        } finally {
            setLoading(false);
        }
    }, []);

    const handleStudentSelect = useCallback(async (nisn: string) => {
        setSelectedNisn(nisn);
        setCurrentPage(1);
        setCurrentPageRiwayat(1);
        await fetchKehadiran(nisn);
    }, [fetchKehadiran]);

    const handleResetSelection = useCallback(() => {
        setSelectedNisn('');
        setData(null);
        setFilterKelas('');
        setFilterTahunAjaran(activeYearsList[0] || '');
        setSearchQuery('');
        setCurrentPage(1);
        setCurrentPageRiwayat(1);
    }, [activeYearsList]);

    useEffect(() => { checkAuth(); }, [checkAuth]);

    useEffect(() => {
        getActiveTahunAjaranList().then(years => {
            setActiveYearsList(years);
            if (years.length > 0) {
                setDetailTahunAjaran(prev => prev || years[0]);
                setFilterTahunAjaran(prev => prev || years[0]);
            } else {
                setDetailTahunAjaran(prev => prev || 'ALL');
            }
        });
    }, []);

    useEffect(() => { setCurrentPage(1); }, [filterKelas, filterTahunAjaran, searchQuery]);
    useEffect(() => { setCurrentPageRiwayat(1); }, [selectedNisn, detailTahunAjaran]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getPeriode = (tglMulai: string, tglSelesai: string) => {
        const start = formatDate(tglMulai);
        const end = formatDate(tglSelesai);
        if (start === end) return start;
        return `${start} – ${end}`;
    };

    const getJenisBadge = (jenis: string) => {
        if (jenis === 'HADIR') return { type: 'hadir', label: 'HADIR' };
        if (jenis === 'IZIN') return { type: 'izin', label: 'IZIN' };
        if (jenis === 'SAKIT') return { type: 'sakit', label: 'SAKIT' };
        if (jenis === 'ALPA') return { type: 'alpa', label: 'ALPA' };
        return { type: 'default', label: jenis };
    };

    const getStatusBadge = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'madrasah') return { type: 'madrasah', label: 'Madrasah' };
        if (s === 'personal') return { type: 'personal', label: 'Personal' };
        if (s === 'ringan') return { type: 'ringan', label: 'Ringan' };
        if (s === 'sedang') return { type: 'sedang', label: 'Sedang' };
        if (s === 'berat') return { type: 'berat', label: 'Berat' };
        if (s === 'kontrol') return { type: 'kontrol', label: 'Kontrol' };
        return { type: 'default', label: status || '-' };
    };

    const getBadgeClass = (type: string) => {
        return `kehadiran-page__badge kehadiran-page__badge--${type}`;
    };

    if (loading) return <LoadingSpinner />;
    if (error && !data) return <ErrorView message={error} onRetry={checkAuth} />;

    if (isAdmin && !selectedNisn && !data) {
        return (
            <div className="kehadiran-page">
                <div className="kehadiran-page__inner">
                    <div className="kehadiran-page__content">
                        <FilterToolbar className="kehadiran-page__filter-toolbar">
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
                        <div className="kehadiran-page__card kehadiran-page__table-container">
                            {paginatedStudents.length === 0 ? (
                                <div className="kehadiran-page__empty-state">
                                    <h3 className="kehadiran-page__empty-title">Belum ada data</h3>
                                </div>
                            ) : (
                                <>
                                    <div className="kehadiran-page__table-wrap">
                                        <table className="kehadiran-page__table">
                                            <thead>
                                                <tr>
                                                    <th className="kehadiran-page__th">Nama Siswa</th>
                                                    <th className="kehadiran-page__th">Kelas</th>
                                                    <th className="kehadiran-page__th">Tahun Ajaran</th>
                                                    <th className="kehadiran-page__th">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedStudents.map((student) => (
                                                    <tr key={student.nisn} className="kehadiran-page__tr">
                                                        <td className="kehadiran-page__td">
                                                            <div className="kehadiran-page__student-info-row">
                                                                <MobileAvatar
                                                                    name={student.nama}
                                                                    seed={student.nisn}
                                                                    src={student.foto || null}
                                                                />
                                                                <div className="kehadiran-page__name-stack">
                                                                    <span className="kehadiran-page__student-name">{student.nama}</span>
                                                                    <span className="kehadiran-page__student-nisn">NISN: {student.nisn}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="kehadiran-page__td">
                                                            <span className="kehadiran-page__badge kehadiran-page__badge--blue">{student.kelas}</span>
                                                        </td>
                                                        <td className="kehadiran-page__td">
                                                            <span className="kehadiran-page__badge kehadiran-page__badge--blue">{student.tahun_ajaran}</span>
                                                        </td>
                                                        <td className="kehadiran-page__td">
                                                            <ActionButton
                                                                action="view"
                                                                label="Lihat Kehadiran"
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
                                            subtitle={student.nisn}
                                            avatarSrc={student.foto || null}
                                            onClick={() => handleStudentSelect(student.nisn)}
                                        />
                                    ))}
                                </MobileList>
                            )}
                        </div>

                        <Pagination currentPage={currentPage} totalPages={totalPages} limit={ITEMS_PER_PAGE} totalItems={filteredStudents.length} onPageChange={setCurrentPage} itemLabel="siswa" />
                    </div>
                </div>
            </div>
        );
    }

    const stats = filteredStats;

    return (
        <div className="kehadiran-page">
            <div className="kehadiran-page__inner">
                <DetailHeader
                    onBack={isAdmin && !(isOrangTua && allStudents.length <= 1) ? handleResetSelection : undefined}
                    backLabel="Kembali ke Daftar Siswa"
                    name={data?.siswa?.nama || 'Siswa'}
                    meta={`NISN ${data?.siswa?.nisn || user?.nip} - ${data?.siswa?.kelas || '-'}`}
                >
                    {(data?.riwayat?.length || 0) > 0 && (
                        <DetailHeaderSelect
                            icon="mortarboard"
                            value={detailTahunAjaran || 'ALL'}
                            onChange={(e) => setDetailTahunAjaran(e.target.value)}
                        >
                            <option value="ALL">Semua Tahun</option>
                            {detailTahunOptions.map(ta => (
                                <option key={ta} value={ta}>{ta}</option>
                            ))}
                        </DetailHeaderSelect>
                    )}
                </DetailHeader>

                <div className="kehadiran-page__content">
                    <div className="kehadiran-page__stats-grid">
                        <div className="kehadiran-page__stat-card">
                            <div className="kehadiran-page__stat-icon kehadiran-page__stat--green">
                                <svg className="kehadiran-page__stat-svg kehadiran-page__stat-color--green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="kehadiran-page__stat-body">
                                <p className="kehadiran-page__stat-label">Total Izin</p>
                                <p className="kehadiran-page__stat-value">
                                    {stats?.total_izin_hari_kalender || 0} hari
                                    <span className="block text-sm font-bold opacity-80 mt-1">
                                        {renderJpWithDays(stats?.total_izin_jp || 0)}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="kehadiran-page__stat-card">
                            <div className="kehadiran-page__stat-icon kehadiran-page__stat--amber">
                                <svg className="kehadiran-page__stat-svg kehadiran-page__stat-color--amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="kehadiran-page__stat-body">
                                <p className="kehadiran-page__stat-label">Total Sakit</p>
                                <p className="kehadiran-page__stat-value">
                                    {stats?.total_sakit_hari_kalender || 0} hari
                                    <span className="block text-sm font-bold opacity-80 mt-1">
                                        {renderJpWithDays(stats?.total_sakit_jp || 0)}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {paginatedRiwayat.length === 0 ? (
                        <div className="kehadiran-page__card kehadiran-page__empty-state">
                            <h3 className="kehadiran-page__empty-title">Belum ada data</h3>
                        </div>
                    ) : (
                        <div className="kehadiran-page__card">
                            <div className="kehadiran-page__table-header">
                                <h3 className="kehadiran-page__table-title">Riwayat Ketidakhadiran</h3>
                                <span className="kehadiran-page__table-count">{filteredRiwayat.length} records</span>
                            </div>
                            <div className="kehadiran-page__table-wrap">
                                <table className="kehadiran-page__table">
                                    <thead>
                                        <tr>
                                            <th className="kehadiran-page__th">Jenis</th>
                                            <th className="kehadiran-page__th">Periode</th>
                                            <th className="kehadiran-page__th">Durasi</th>
                                            <th className="kehadiran-page__th">Status</th>
                                            <th className="kehadiran-page__th">Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedRiwayat.map((item, idx) => {
                                            const jenis = getJenisBadge(item.jenis);
                                            const status = getStatusBadge(item.status);
                                            const durasi = item.display_durasi;
                                            return (
                                                <tr key={item.id || idx} className="kehadiran-page__tr">
                                                    <td className="kehadiran-page__td">
                                                        <span className={getBadgeClass(jenis.type)}>{jenis.label}</span>
                                                    </td>
                                                    <td className="kehadiran-page__td">
                                                        <span className="kehadiran-page__td-date">{getPeriode(item.tgl_mulai, item.tgl_selesai)}</span>
                                                    </td>
                                                    <td className="kehadiran-page__td">
                                                        <span className="kehadiran-page__td-durasi">{durasi}</span>
                                                    </td>
                                                    <td className="kehadiran-page__td">
                                                        <span className={getBadgeClass(status.type)}>{status.label}</span>
                                                    </td>
                                                    <td className="kehadiran-page__td kehadiran-page__td--muted">
                                                        {item.keterangan || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="kehadiran-page__mobile-cards">
                                {paginatedRiwayat.map((item, idx) => {
                                    const jenis = getJenisBadge(item.jenis);
                                    const status = getStatusBadge(item.status);
                                    const durasi = item.display_durasi;
                                    return (
                                        <div key={item.id || idx} className="kehadiran-page__mobile-card">
                                            <div className="kehadiran-page__mobile-card-header">
                                                <span className={getBadgeClass(jenis.type)}>{jenis.label}</span>
                                                <span className={getBadgeClass(status.type)}>{status.label}</span>
                                            </div>
                                            <div className="kehadiran-page__mobile-card-body">
                                                <p className="kehadiran-page__mobile-card-date">{getPeriode(item.tgl_mulai, item.tgl_selesai)}</p>
                                                <p className="kehadiran-page__mobile-card-meta">
                                                    <i className="bi bi-clock-history mr-1"></i>
                                                    {durasi}
                                                </p>
                                                <p className="kehadiran-page__mobile-card-desc">
                                                    {item.keterangan || 'Tidak ada keterangan'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {totalRiwayatPages > 1 && (
                        <Pagination currentPage={currentPageRiwayat} totalPages={totalRiwayatPages} limit={RIWAYAT_PER_PAGE} totalItems={filteredRiwayat.length} onPageChange={setCurrentPageRiwayat} itemLabel="riwayat" />
                    )}
                </div>
            </div>
        </div>
    );
}

export default KehadiranSiswaTab;
