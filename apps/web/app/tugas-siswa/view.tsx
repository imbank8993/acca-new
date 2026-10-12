'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { FilterActions, FilterField, FilterSearch, FilterSelect, FilterToolbar } from '@/components/ui/FilterToolbar';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import Pagination from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import TugasSiswaTable from './components/TugasSiswaTable';
import MobileCards from './components/MobileCards';
import TugasSiswaForm from './components/TugasSiswaForm';
import { Modal, ModalHeader, ModalBody, ModalViewFooter } from '@/components/ui/Modal';
import { ensureAbsoluteUrl } from '@/lib/url';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { getCurrentAcademicYear } from '@/lib/date-utils';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { MobileFab } from '@/components/mobile';

const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false });
const TA_AKTIF = '__AKTIF__';

interface User {
    id: number;
    auth_id: string | null;
    username: string;
    nip: string;
    nama: string;
    role: string;
    roles: string[];
    aktif: boolean;
    kelasList?: string[];
}

interface MasterData {
    guru: { guru_id: string; nama_lengkap: string }[];
    mapel: { id: number; kode: string; nama: string }[];
    kelas: { id: number; nama: string; tingkat: number }[];
}

interface TugasSiswaPageProps {
    user?: User | null;
}

export default function TugasSiswaPage({ user: propUser }: TugasSiswaPageProps) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(propUser || null);
    const [isAuthDataReady, setIsAuthDataReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMaster, setLoadingMaster] = useState(true);

    // Data state
    const [data, setData] = useState<any[]>([]);
    const dataVersion = useRef(0);
    const statsVersion = useRef(0);
    const pendingChecklist = useRef(new Set<number>());
    const [totalData, setTotalData] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Master data
    const [masterData, setMasterData] = useState<MasterData>({
        guru: [],
        mapel: [],
        kelas: []
    });

    // Filter state
    // tahunAjaran wajib: nama kelas dipakai ulang tiap tahun (peserta XI A 2025/2026
    // ≠ 2026/2027). Default TA_AKTIF = seluruh tahun ajaran yang di-AKTIF-kan di
    // Master > Tahun Ajaran, bukan "semua tahun".
    const [filters, setFilters] = useState({
        kelas: '',
        guru: '',
        mapel: '',
        search: '',
        tanggalAwal: '',
        tanggalAkhir: '',
        jenis: '',
        tahunAjaran: TA_AKTIF
    });

    // Daftar tahun ajaran aktif (bisa >1: mis. tahun lalu terkunci + tahun berjalan)
    const taFilter = useTahunAjaranFilter();

    // Nilai yang benar-benar dikirim ke API: TA_AKTIF dijabarkan jadi daftar tahun
    // aktif dipisah koma. Selama daftar belum termuat, pakai tahun berjalan supaya
    // tidak sempat menampilkan tugas tahun lama.
    const tahunAjaranParam = filters.tahunAjaran === TA_AKTIF
        ? (taFilter.years.join(',') || getCurrentAcademicYear())
        : filters.tahunAjaran;

    // Modal states
    const [showForm, setShowForm] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [editData, setEditData] = useState<any | null>(null);
    const [selectedTugas, setSelectedTugas] = useState<any | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<{ url: string; title: string } | null>(null);
    const [checklistedIds, setChecklistedIds] = useState<number[]>([]);

    // User scope
    // Full enrollment list: { kelas, tahun_ajaran } — used by the form to filter kelas by date
    const [userKelasAll, setUserKelasAll] = useState<{ kelas: string; tahun_ajaran: string }[]>([]);

    // Kelas yang dipakai untuk badge, filter, dan scope API: HANYA enrolment pada
    // tahun ajaran yang sedang dipilih di filter. Tanpa penyaringan ini
    // siswa yang tahun ajarannya sudah dinonaktifkan tetap terbaca di kelas lamanya
    // (mis. "XI D" dari 2025/2026) karena satu siswa punya banyak baris siswa_kelas.
    const selectedYears = useMemo(() => tahunAjaranParam.split(',').filter(Boolean), [tahunAjaranParam]);
    const userKelas = useMemo(
        () => [...new Set(
            userKelasAll.filter(e => selectedYears.includes(e.tahun_ajaran)).map(e => e.kelas)
        )] as string[],
        [userKelasAll, selectedYears.join(',')]
    );

    const [userNisn, setUserNisn] = useState<string>('');
    const [isSiswa, setIsSiswa] = useState(false);
    const [isPengurusKelas, setIsPengurusKelas] = useState(false);
    const [stats, setStats] = useState({ totalActive: 0, upcoming: 0, done: 0 });

    // Auto-pilih kelas siswa di dropdown filter — sekali tiap kali scope kelasnya
    // berubah, supaya pilihan manual pengguna tidak terus-menerus ditimpa.
    const autoKelasRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isSiswa && !isPengurusKelas) return;
        const sig = userKelas.join(',');
        if (autoKelasRef.current === sig) return;
        autoKelasRef.current = sig;
        setFilters(prev => {
            const next = userKelas.length === 1
                ? userKelas[0]
                : (prev.kelas && !userKelas.includes(prev.kelas) ? '' : prev.kelas);
            return next === prev.kelas ? prev : { ...prev, kelas: next };
        });
    }, [isSiswa, isPengurusKelas, userKelas]);

    // Modal blur tracking
    const { registerModal } = useModalBlur();

    // Register modal open/close state with ModalBlurProvider. `registerModal()`
    // mengembalikan fungsi cleanup yang otomatis dipanggil React SEBELUM efek ini
    // jalan ulang — jadi transisi showDetail→showForm dalam satu batch (klik
    // "Edit Data") selalu unregister-lalu-register bersih, tidak pernah numpuk
    // counter blur seperti pola openModal()/closeModal() manual sebelumnya.
    useEffect(() => {
        if (showForm || showDetail) {
            return registerModal();
        }
    }, [showForm, showDetail, registerModal]);

    // Auth check
    useEffect(() => {
        if (propUser) {
            setUser(propUser);
            checkUserScope(propUser);
        } else {
            checkAuth();
        }
    }, [propUser]);

    const checkUserScope = async (userData: User) => {
        const siswa = userData.role === 'SISWA' || userData.role === 'PENGURUS_KELAS' || (userData.roles || []).includes('SISWA');
        setIsSiswa(siswa);

        // Detect PENGURUS_KELAS role
        const roleStr = userData.role || '';
        const roleParts = roleStr.split(/[,|]/).map((r: string) => r.trim().toUpperCase());
        const pk = roleParts.includes('PENGURUS_KELAS') || roleStr.toUpperCase().includes('PENGURUS KELAS') || (userData.roles || []).includes('PENGURUS_KELAS');
        setIsPengurusKelas(pk);

        // Ambil kelas scope user (dengan tahun_ajaran agar form bisa filter per tanggal)
        const nip = userData.nip;
        if (nip) setUserNisn(nip);
        if (nip && (siswa || pk)) {
            try {
                const res = await fetch(`/api/siswa/${encodeURIComponent(nip)}/kelas`);
                const json = await res.json();
                const siswaData = json.ok ? json.data : [];

                if (siswaData && siswaData.length > 0) {
                    // Store full enrollment list for date-based filtering in the form.
                    // Penyaringan ke tahun ajaran aktif dilakukan di `userKelas`.
                    setUserKelasAll(siswaData.map((s: any) => ({ kelas: s.kelas, tahun_ajaran: s.tahun_ajaran })));
                }
            } catch (err) {
                console.error('Failed to load user scopes', err);
            }
        }
        setIsAuthDataReady(true);
        setLoading(false);
    };

    const checkAuth = async () => {
        console.log('[TugasSiswa] Starting auth check...');
        try {
            const meRes = await fetch('/api/auth/me');
            const meData = await meRes.json();
            if (!meData.ok || !meData.user) {
                router.push('/login');
                return;
            }

            const userData = meData.user;
            setUser(userData);
            await checkUserScope(userData);
        } catch (e) {
            console.error('Auth error:', e);
            setLoading(false);
        }
    };

    // Load master data
    useEffect(() => {
        const fetchMaster = async () => {
            setLoadingMaster(true);
            try {
                console.log('[Page] Fetching master data...');
                const res = await fetch('/api/tugas-siswa/master');
                const result = await res.json();
                if (result.ok || result.guru || result.data) {
                    const master = result.data || result;
                    const parsedMaster: MasterData = {
                        guru: Array.isArray(master.guru) ? master.guru : [],
                        mapel: Array.isArray(master.mapel) ? master.mapel : [],
                        kelas: Array.isArray(master.kelas) ? master.kelas : [],
                    };
                    setMasterData(parsedMaster);
                    console.log('[Page] masterData set, guru count:', parsedMaster.guru.length);
                } else {
                    console.error('[Page] Master API error:', result.error, result.details);
                }
            } catch (err) {
                console.error('[Page] Failed to load master data', err);
            } finally {
                setLoadingMaster(false);
            }
        };
        fetchMaster();
    }, []);

    // Debug: log masterData changes
    useEffect(() => {
        console.log('[Page] masterData updated:', {
            guru: masterData?.guru?.length,
            mapel: masterData?.mapel?.length,
            kelas: masterData?.kelas?.length
        });
    }, [masterData]);

    // Load data
    const fetchData = useCallback(async () => {
        if (!user) return;
        const version = ++dataVersion.current;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('limit', limit.toString());
            params.append('userId', user.id.toString());

            // Kelas dikirim untuk semua role (dulu hanya siswa/pengurus kelas,
            // sehingga dropdown Kelas tidak berefek apa-apa bagi admin & guru).
            if (filters.kelas) params.append('kelas', filters.kelas);
            if (filters.guru) params.append('guru', filters.guru);
            if (filters.mapel) params.append('mapel', filters.mapel);
            if (filters.search) params.append('search', filters.search);
            if (filters.tanggalAwal) params.append('tanggalAwal', filters.tanggalAwal);
            if (filters.tanggalAkhir) params.append('tanggalAkhir', filters.tanggalAkhir);
            if (filters.jenis) params.append('jenis', filters.jenis);
            if (tahunAjaranParam) params.append('tahunAjaran', tahunAjaranParam);
            // Pass siswa scope to API so it only returns tugas for student's kelas.
            // siswaRole tetap dikirim walau kelasnya kosong: API menutup hasil (tidak
            // mengembalikan apa-apa) untuk role siswa tanpa kelas. Kalau parameternya
            // dihilangkan, siswa tanpa enrolment aktif justru melihat tugas semua kelas.
            if (isSiswa || isPengurusKelas) {
                params.append('siswaRole', isPengurusKelas ? 'PENGURUS_KELAS' : 'SISWA');
                params.append('siswaKelas', userKelas.join(','));
            }

            const res = await fetch(`/api/tugas-siswa?${params.toString()}`);
            if (version !== dataVersion.current) return;
            if (!res.ok) {
                const errorText = await res.text();
                console.error('API HTTP Error:', res.status, errorText);
                setErrorMessage(`Gagal memuat data (${res.status})`);
                Swal.fire('Error', `Gagal memuat data (${res.status})`, 'error');
                setLoading(false);
                return;
            }
            const result = await res.json();
            if (version !== dataVersion.current || pendingChecklist.current.size) return;

            if (result.ok) {
                setData(result.data);
                setTotalData(result.total);
                setTotalPages(result.totalPages);
                setErrorMessage(null);
                const doneIds = (result.data || [])
                    .filter((t: any) => t.checklist && t.checklist.length > 0 && t.checklist[0].is_done)
                    .map((t: any) => t.id);
                setChecklistedIds(doneIds);
            } else {
                console.error('API Error:', result);
                setErrorMessage(result.error || 'Gagal memuat data');
                Swal.fire('Error', result.error || 'Gagal memuat data', 'error');
            }
        } catch (err) {
            if (version !== dataVersion.current) return;
            console.error('Fetch data error:', err);
            Swal.fire('Error', 'Gagal memuat data tugas', 'error');
        } finally {
            if (version === dataVersion.current) setLoading(false);
        }
    }, [user, currentPage, limit, filters, tahunAjaranParam, isSiswa, isPengurusKelas, userKelas]);

    const fetchStats = useCallback(async () => {
        if (!user) return;
        const version = ++statsVersion.current;
        try {
            const params = new URLSearchParams();
            params.append('userId', user.id.toString());
            if (isSiswa || isPengurusKelas) {
                params.append('siswaRole', isPengurusKelas ? 'PENGURUS_KELAS' : 'SISWA');
                params.append('siswaKelas', userKelas.join(','));
            }
            // Statistik memakai filter yang sama persis dengan tabel supaya
            // angkanya ikut berubah saat filter apa pun diubah.
            if (filters.kelas) params.append('kelas', filters.kelas);
            if (filters.guru) params.append('guru', filters.guru);
            if (filters.mapel) params.append('mapel', filters.mapel);
            if (filters.search) params.append('search', filters.search);
            if (filters.tanggalAwal) params.append('tanggalAwal', filters.tanggalAwal);
            if (filters.tanggalAkhir) params.append('tanggalAkhir', filters.tanggalAkhir);
            if (filters.jenis) params.append('jenis', filters.jenis);
            if (tahunAjaranParam) params.append('tahunAjaran', tahunAjaranParam);

            const res = await fetch(`/api/tugas-siswa/action?${params.toString()}`);
            const json = await res.json();
            if (version === statsVersion.current && json.ok) setStats(json.stats);
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    }, [user, userKelas, isSiswa, isPengurusKelas, filters, tahunAjaranParam]);

    useEffect(() => {
        if (user && isAuthDataReady) {
            fetchData();
            fetchStats();
        }
        // fetchData/fetchStats sudah memuat seluruh filter di dependency-nya,
        // jadi setiap perubahan filter otomatis memicu pemuatan ulang.
    }, [user, isAuthDataReady, fetchData, fetchStats]);

    // Handle filter change
    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    // Handle reset filters
    const handleResetFilters = () => {
        setFilters({
            kelas: '', guru: '', mapel: '', search: '', tanggalAwal: '', tanggalAkhir: '', jenis: '',
            // Reset kembali ke tahun ajaran aktif, bukan ke "semua tahun"
            tahunAjaran: TA_AKTIF
        });
        setCurrentPage(1);
        // Reset ke kelas siswa jika siswa atau pengurus kelas
        if ((isSiswa || isPengurusKelas) && userKelas.length === 1) {
            setFilters(prev => ({ ...prev, kelas: userKelas[0] }));
        }
    };

    // Handle checklist toggle
    const handleToggleChecklist = async (id: number, current: boolean) => {
        if (!user) return;
        if (pendingChecklist.current.size) return;
        pendingChecklist.current.add(id);
        ++dataVersion.current;
        ++statsVersion.current;

        // OPTIMISTIC UPDATE: tampilkan centang seketika, sinkron ke server di belakang.
        // Sebelumnya state menunggu getSession + POST + parse selesai → terasa delay.
        setChecklistedIds(prev =>
            current ? prev.filter(i => i !== id) : [...prev, id]
        );

        const revert = () => setChecklistedIds(prev =>
            current ? [...prev, id] : prev.filter(i => i !== id)
        );

        try {
            const res = await fetch('/api/tugas-siswa/action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tugas_id: id,
                    siswa_id: user.id.toString(),
                    is_done: !current
                })
            });
            const result = await res.json();

            if (result.ok) {
                pendingChecklist.current.delete(id);
                fetchData();
                fetchStats();
            } else {
                revert();
                Swal.fire('Gagal', result.error || 'Gagal update checklist', 'error');
            }
        } catch (err) {
            console.error('Checklist error:', err);
            revert();
            Swal.fire('Gagal', 'Gagal update checklist', 'error');
        } finally {
            pendingChecklist.current.delete(id);
        }
    };

    // Handle add new
    const handleAdd = () => {
        setEditData(null);
        setShowForm(true);
    };

    // Handle edit
    const handleEdit = (tugas: any) => {
        setEditData(tugas);
        setShowForm(true);
    };

    // Handle view detail
    const handleView = (tugas: any) => {
        setSelectedTugas(tugas);
        setShowDetail(true);
    };

    // Handle view file in PDFViewer
    const handleViewFile = (url: string, name: string) => {
        setSelectedDoc({ url, title: name });
    };

    // Handle delete
    const handleDelete = async (id: number) => {
        try {
            // Optimistic update: instantly remove from UI
            setData(prev => prev.filter(t => t.id !== id));
            setTotalData(prev => Math.max(0, prev - 1));

            const res = await fetch(`/api/tugas-siswa/${id}`, {
                method: 'DELETE'
            });
            const result = await res.json();

            if (result.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: 'Tugas berhasil dihapus',
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchData();
                fetchStats();
            } else {
                // Revert on error
                fetchData();
                Swal.fire('Gagal', result.error || 'Gagal menghapus tugas', 'error');
            }
        } catch (err) {
            console.error('Delete error:', err);
            fetchData();
            Swal.fire('Gagal', 'Gagal menghapus tugas', 'error');
        }
    };

    // Handle form submit
    const handleFormSubmit = async (formData: any) => {
        try {
            if (editData) {
                // Update existing
                const res = await fetch(`/api/tugas-siswa/${editData.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ...formData, expected_updated_at: editData.updated_at ?? null })
                });
                const result = await res.json();

                if (result.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: 'Tugas berhasil diperbarui',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    fetchData();
                    fetchStats();
                } else {
                    throw new Error(result.error);
                }
            } else {
                // Create new
                const res = await fetch('/api/tugas-siswa', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                const result = await res.json();

                if (result.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: 'Tugas berhasil ditambahkan',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    fetchData();
                    fetchStats();
                } else {
                    throw new Error(result.error);
                }
            }
        } catch (err: any) {
            throw err;
        }
    };


    // Check permissions
    const isAdmin = user?.roles.some(role => ['ADMIN', 'ADMINISTRATOR'].includes(role));
    const isGuru = user?.roles.includes('GURU');
    // ADMIN can do everything, GURU and PENGURUS_KELAS can create/edit
    const canCreate = isAdmin || isGuru || isPengurusKelas;
    const canEdit = isAdmin || isGuru || isPengurusKelas;
    const canDelete = isAdmin || isGuru || isPengurusKelas;

    if (loading && !user) {
        return (
            <div className="tsp__loading">
                <Spinner size={36} />
                <span>Memuat...</span>
            </div>
        );
    }

    return (
        <MaintenanceBanner pageKey="maintenance_tugas_siswa" isAdmin={isAdmin}>
            <div className="tsp__container">
                {/* Hero Banner */}
                

                {/* 3 Cards Terpisah dalam 1 Baris */}
                <div className="tsp__statsGrid">
                    <div className="tsp__statCard active">
                        <div className="stat__icon">
                            <i className="bi bi-lightning-charge-fill"></i>
                        </div>
                        <div className="stat__info">
                            <span className="stat__val">{stats.totalActive}</span>
                            <span className="stat__label">Aktif</span>
                        </div>
                    </div>

                    <div className="tsp__statCard urgent">
                        <div className="stat__icon">
                            <i className="bi bi-alarm-fill"></i>
                        </div>
                        <div className="stat__info">
                            <span className="stat__val">{stats.upcoming}</span>
                            <span className="stat__label">Deadline</span>
                        </div>
                    </div>

                    <div className="tsp__statCard done">
                        <div className="stat__icon">
                            <i className="bi bi-check-circle-fill"></i>
                        </div>
                        <div className="stat__info">
                            <span className="stat__val">{stats.done}</span>
                            <span className="stat__label">Selesai</span>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className="tsp__error">
                        <i className="bi bi-exclamation-triangle"></i>
                        <span>{errorMessage}</span>
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            leftIcon={<i className="bi bi-arrow-clockwise" />}
                            onClick={() => { setErrorMessage(null); fetchData(); }}
                        >
                            Coba Lagi
                        </Button>
                    </div>
                )}

                {/* Filter Toolbar */}
                {loadingMaster ? (
                    <FilterToolbar>
                        <div className="tsp__loadingFilterContent">
                            <Spinner variant="buble" size={20} />
                            <span>Memuat filter...</span>
                        </div>
                    </FilterToolbar>
                ) : (masterData?.guru || []).length === 0 && (masterData?.mapel || []).length === 0 ? (
                    <div className="tsp__noMaster">
                        <i className="bi bi-database-exclamation"></i>
                        <span>Data master belum tersedia. Pastikan migration sudah dijalankan.</span>
                    </div>
                ) : (
                    <FilterToolbar>
                        <FilterSearch
                            value={filters.search}
                            onChange={(value) => handleFilterChange('search', value)}
                            label="Pencarian"
                            placeholder="Cari judul atau deskripsi tugas..."
                            grow={2}
                            width={240}
                        />

                        <FilterSelect
                            label="Tahun Ajaran"
                            icon="mortarboard"
                            value={filters.tahunAjaran}
                            onChange={(value) => handleFilterChange('tahunAjaran', value)}
                            options={[
                                ...(taFilter.years.length > 1 ? [{ value: TA_AKTIF, label: 'Semua' }] : []),
                                ...taFilter.years.map(year => ({ value: year, label: year }))
                            ]}
                            width={140}
                        />

                        <FilterField label="Tanggal" bare width={220} className="ftb-field--date-range">
                            <div className="tsp__globalDateRange">
                                <DatePicker
                                    value={filters.tanggalAwal}
                                    onChange={(value) => handleFilterChange('tanggalAwal', value)}
                                    title="Tanggal awal"
                                />
                                {filters.tanggalAwal && (
                                    <DatePicker
                                        value={filters.tanggalAkhir}
                                        onChange={(value) => handleFilterChange('tanggalAkhir', value)}
                                        min={filters.tanggalAwal}
                                        title="Tanggal akhir"
                                    />
                                )}
                            </div>
                        </FilterField>

                        <FilterSelect
                            label="Kelas"
                            icon="door-open"
                            value={filters.kelas}
                            width={140}
                            onChange={(value) => handleFilterChange('kelas', value)}
                            options={[
                                { value: '', label: 'Semua Kelas' },
                                ...(isSiswa || isPengurusKelas
                                    ? userKelas.map(kelas => ({ value: kelas, label: kelas }))
                                    : (masterData?.kelas || []).map(kelas => ({ value: kelas.nama, label: kelas.nama })))
                            ]}
                        />

                        {/* Flex Break to start Row 2 */}
                        <div style={{ flexBasis: '100%', width: '100%', height: 0 }} />

                        <FilterSelect
                            label="Guru"
                            icon="person-badge"
                            value={filters.guru}
                            width={180}
                            onChange={(value) => handleFilterChange('guru', value)}
                            options={[
                                { value: '', label: 'Semua Guru' },
                                ...(masterData?.guru || []).map(guru => ({ value: guru.nama_lengkap, label: guru.nama_lengkap }))
                            ]}
                        />

                        <FilterSelect
                            label="Mapel"
                            icon="book"
                            value={filters.mapel}
                            width={160}
                            onChange={(value) => handleFilterChange('mapel', value)}
                            options={[
                                { value: '', label: 'Semua Mapel' },
                                ...(masterData?.mapel || []).map(mapel => ({ value: mapel.nama, label: `${mapel.nama} (${mapel.kode})` }))
                            ]}
                        />

                        <FilterSelect
                            label="Tipe"
                            icon="tag"
                            value={filters.jenis}
                            width={130}
                            onChange={(value) => handleFilterChange('jenis', value)}
                            options={[
                                { value: '', label: 'Semua Tipe' },
                                { value: 'tugas', label: 'Tugas' },
                                { value: 'pengingat', label: 'Pengingat' }
                            ]}
                        />

                    </FilterToolbar>
                )}

                {/* Floating Action Button (FAB) untuk Tambah Tugas */}
                {canCreate && (
                    <>
                        <DesktopFab label="Tambah Tugas" mobileLabel="Tambah" icon="plus-lg" onClick={handleAdd} />
                        <MobileFab label="Tambah Tugas" icon="plus-lg" onClick={handleAdd} />
                    </>
                )}

                {/* User scope badge */}
                {(isSiswa || isPengurusKelas) && userKelas.length > 0 && (
                    <div className="tsp__scopeBadge">
                        <i className="bi bi-person-badge"></i>
                        <span>
                            {isPengurusKelas ? 'Kelas Anda (Pengurus Kelas): ' : 'Kelas Anda: '}
                            <strong>{userKelas.join(', ')}</strong>
                        </span>
                    </div>
                )}

                {/* Siswa terdaftar, tapi tidak di satu pun tahun ajaran aktif */}
                {(isSiswa || isPengurusKelas) && isAuthDataReady && userKelas.length === 0 && (
                    <div className="tsp__scopeBadge tsp__scopeBadge--warn">
                        <i className="bi bi-exclamation-triangle"></i>
                        <span>
                            Anda belum terdaftar di kelas mana pun pada tahun ajaran aktif
                            {taFilter.years.length > 0 && <strong> ({taFilter.years.join(', ')})</strong>}.
                            Hubungi wali kelas atau admin.
                        </span>
                    </div>
                )}

                {/* Table / Cards */}
                <div className="tsp__content">
                    {/* Desktop Table */}
                    <div className="tsp__desktopView">
                        <TugasSiswaTable
                            data={data}
                            loading={loading}
                            isAdmin={isAdmin || false}
                            isSiswa={isSiswa || isPengurusKelas}
                            isPengurusKelas={isPengurusKelas}
                            isGuru={user?.roles.includes('GURU') || false}
                            userNip={user?.nip || ''}
                            userNama={user?.nama || ''}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onView={handleView}
                            onViewFile={handleViewFile}
                            checklistedIds={checklistedIds}
                            onToggleChecklist={handleToggleChecklist}
                        />
                    </div>

                    {/* Mobile Cards */}
                    <div className="tsp__mobileView">
                        <MobileCards
                            data={data}
                            isAdmin={isAdmin || false}
                            isSiswa={isSiswa || isPengurusKelas}
                            isPengurusKelas={isPengurusKelas}
                            isGuru={user?.roles.includes('GURU') || false}
                            userNip={user?.nip || ''}
                            userNama={user?.nama || ''}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onView={handleView}
                            onViewFile={handleViewFile}
                            checklistedIds={checklistedIds}
                            onToggleChecklist={handleToggleChecklist}
                        />
                    </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="tsp__bottomBar">
                    {totalData > 0 && (
                        <Pagination itemLabel="tugas"
                            currentPage={currentPage}
                            totalPages={totalPages}
                            limit={limit}
                            totalItems={totalData}
                            onPageChange={setCurrentPage}
                            onLimitChange={(newLimit) => {
                                setLimit(newLimit);
                                setCurrentPage(1);
                            }}
                        />
                    )}
                </div>

                {/* Form Modal */}
                <TugasSiswaForm
                    isOpen={showForm}
                    onClose={() => {
                        setShowForm(false);
                        setEditData(null);
                    }}
                    onSubmit={handleFormSubmit}
                    masterData={masterData}
                    editData={editData}
                    userKelas={userKelas}
                    userKelasAll={userKelasAll}
                    userNisn={userNisn}
                    userRole={Array.isArray(user?.roles) ? user.roles.join(',') : user?.role || ''}
                    isSiswa={isSiswa || isPengurusKelas}
                    isGuru={isGuru || false}
                    userGuruId={user?.nip || ''}
                    userGuruNama={user?.nama || ''}
                />

                {/* Detail / View Modal using standard Modal component */}
                {showDetail && selectedTugas && (
                    <Modal
                        size="lg"
                        onClose={() => {
                            setShowDetail(false);
                            setSelectedTugas(null);
                        }}
                    >
                        <ModalHeader
                            title={selectedTugas.judul_tugas}
                            icon={selectedTugas.jenis === 'pengingat' ? 'bell-fill' : 'clipboard-check-fill'}
                            onClose={() => {
                                setShowDetail(false);
                                setSelectedTugas(null);
                            }}
                            subtitle={
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                                    {(() => {
                                        let kelasArr: string[] = [];
                                        if (selectedTugas.kelas_list) {
                                            if (typeof selectedTugas.kelas_list === 'string') {
                                                try { kelasArr = JSON.parse(selectedTugas.kelas_list); } catch { kelasArr = []; }
                                            } else if (Array.isArray(selectedTugas.kelas_list)) {
                                                kelasArr = selectedTugas.kelas_list;
                                            }
                                        }
                                        if (kelasArr.length === 0 && selectedTugas.kelas) {
                                            kelasArr = selectedTugas.kelas.split(',').map((k: string) => k.trim()).filter(Boolean);
                                        }
                                        return kelasArr.map((k: string, i: number) => (
                                            <span key={i} className="tsp__badge">{k}</span>
                                        ));
                                    })()}
                                    {selectedTugas.jenis === 'pengingat' && (
                                        <span className="tsp__jenisTag">Pengingat</span>
                                    )}
                                </div>
                            }
                        />

                        <ModalBody>
                            <div className="tsp__detailGrid">
                                {/* Target Kelas & Siswa */}
                                <div className="tsp__detailItem tsp__detailItemFull">
                                    <div className="tsp__detailIcon"><i className="bi bi-people-fill"></i></div>
                                    <div className="tsp__detailContent">
                                        <div className="tsp__detailLabel">Target Kelas & Siswa</div>
                                        <div className="tsp__targetList">
                                            {(() => {
                                                let kelasArr: string[] = [];
                                                if (selectedTugas.kelas_list) {
                                                    if (typeof selectedTugas.kelas_list === 'string') {
                                                        try { kelasArr = JSON.parse(selectedTugas.kelas_list); } catch { kelasArr = []; }
                                                    } else if (Array.isArray(selectedTugas.kelas_list)) {
                                                        kelasArr = selectedTugas.kelas_list;
                                                    }
                                                }
                                                if (kelasArr.length === 0 && selectedTugas.kelas) {
                                                    kelasArr = selectedTugas.kelas.split(',').map((k: string) => k.trim()).filter(Boolean);
                                                }
                                                return kelasArr.map((k: string, i: number) => {
                                                    const targetArr = selectedTugas.target_siswa?.[k];
                                                    const isSpecific = targetArr && targetArr.length > 0;
                                                    return (
                                                        <span key={i} className="tsp__targetBadge">
                                                            <strong>{k}</strong>: {isSpecific ? `${targetArr.length} Siswa Terpilih` : 'Semua Siswa'}
                                                        </span>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Guru */}
                                <div className="tsp__detailItem">
                                    <div className="tsp__detailIcon"><i className="bi bi-person-badge-fill"></i></div>
                                    <div className="tsp__detailContent">
                                        <div className="tsp__detailLabel">Guru Pengampu</div>
                                        <div className="tsp__detailValue">{selectedTugas.nama_guru}</div>
                                    </div>
                                </div>

                                {/* Mapel */}
                                <div className="tsp__detailItem">
                                    <div className="tsp__detailIcon"><i className="bi bi-journal-bookmark-fill"></i></div>
                                    <div className="tsp__detailContent">
                                        <div className="tsp__detailLabel">Mata Pelajaran</div>
                                        <div className="tsp__detailValue">{selectedTugas.nama_mapel}</div>
                                    </div>
                                </div>

                                {/* Tanggal */}
                                <div className="tsp__detailItem tsp__detailItemFull">
                                    <div className="tsp__detailIcon"><i className="bi bi-calendar3-event-fill"></i></div>
                                    <div className="tsp__detailContent">
                                        <div className="tsp__detailLabel">Tanggal & Deadline</div>
                                        <div className="tsp__detailValue">
                                            {selectedTugas.is_range && selectedTugas.tanggal_selesai ? (
                                                <div className="tsp__dateRange">
                                                    <span>{selectedTugas.tanggal_mulai}</span>
                                                    <i className="bi bi-arrow-right"></i>
                                                    <span>{selectedTugas.tanggal_selesai}</span>
                                                </div>
                                            ) : (
                                                selectedTugas.tanggal_mulai
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Field tambahan untuk pengingat */}
                                {selectedTugas.jenis === 'pengingat' && (selectedTugas.ruangan || selectedTugas.durasi || selectedTugas.sifat_ujian) && (
                                    <>
                                        {selectedTugas.ruangan && (
                                            <div className="tsp__detailItem">
                                                <div className="tsp__detailIcon"><i className="bi bi-geo-alt-fill"></i></div>
                                                <div className="tsp__detailContent">
                                                    <div className="tsp__detailLabel">Ruangan</div>
                                                    <div className="tsp__detailValue">{selectedTugas.ruangan}</div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedTugas.durasi && (
                                            <div className="tsp__detailItem">
                                                <div className="tsp__detailIcon"><i className="bi bi-stopwatch-fill"></i></div>
                                                <div className="tsp__detailContent">
                                                    <div className="tsp__detailLabel">Durasi</div>
                                                    <div className="tsp__detailValue">{selectedTugas.durasi}</div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedTugas.sifat_ujian && (
                                            <div className="tsp__detailItem">
                                                <div className="tsp__detailIcon"><i className="bi bi-award-fill"></i></div>
                                                <div className="tsp__detailContent">
                                                    <div className="tsp__detailLabel">Sifat Ujian</div>
                                                    <div className="tsp__detailValue">{selectedTugas.sifat_ujian}</div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Deskripsi */}
                                {selectedTugas.deskripsi && (
                                    <div className="tsp__detailItem tsp__detailItemFull">
                                        <div className="tsp__detailIcon"><i className="bi bi-text-paragraph"></i></div>
                                        <div className="tsp__detailContent">
                                            <div className="tsp__detailLabel">Deskripsi / Petunjuk</div>
                                            <div className="tsp__deskripsi">{selectedTugas.deskripsi}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Lampiran */}
                                {selectedTugas.file_url && (
                                    <div className="tsp__detailItem tsp__detailItemFull">
                                        <div className="tsp__detailIcon"><i className="bi bi-paperclip"></i></div>
                                        <div className="tsp__detailContent">
                                            <div className="tsp__detailLabel">Lampiran File</div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                leftIcon={<i className="bi bi-file-earmark-arrow-down" />}
                                                onClick={() => handleViewFile(ensureAbsoluteUrl(selectedTugas.file_url!), selectedTugas.file_name || 'Lampiran')}
                                            >
                                                {selectedTugas.file_name || 'Lihat Lampiran'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ModalBody>

                        <ModalViewFooter
                            onClose={() => {
                                setShowDetail(false);
                                setSelectedTugas(null);
                            }}
                            onEdit={canEdit && (isAdmin || selectedTugas.created_by === String(user?.id) || (!selectedTugas.created_by && selectedTugas.created_by_nip === user?.nip)) ? () => {
                                const t = selectedTugas;
                                setShowDetail(false);
                                setSelectedTugas(null);
                                handleEdit(t);
                            } : undefined}
                        />
                    </Modal>
                )}

                {/* PDF Viewer Modal */}
                {selectedDoc && (
                    <PDFViewer
                        url={selectedDoc.url}
                        title={selectedDoc.title}
                        onClose={() => setSelectedDoc(null)}
                    />
                )}

                <style jsx>{`
                /* Horizontal padding is handled by .content-container (dashboard shell)
                   OR by the standalone override below (when accessed directly at /tugas-siswa). */
                .tsp__container {
                    max-width: 100%;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding-bottom: 32px;
                    font-family: 'Poppins', sans-serif;
                }

                .tsp__detailGrid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .tsp__detailItem {
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                }
                .tsp__detailItemFull {
                    grid-column: 1 / -1;
                }
                .tsp__detailIcon {
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,63,136,0.08);
                    border-radius: 10px;
                    color: var(--n-primary);
                    font-size: 1rem;
                    flex-shrink: 0;
                }
                .tsp__detailContent {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .tsp__detailLabel {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .tsp__detailValue {
                    font-size: 0.9rem;
                    color: var(--n-ink);
                    font-weight: 500;
                }
                .tsp__badge {
                    display: inline-block;
                    padding: 3px 10px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .tsp__jenisTag {
                    display: inline-block;
                    padding: 3px 10px;
                    background: rgba(251,191,36,0.3);
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #fbbf24;
                }
                .tsp__targetBadge {
                    background: rgba(0,63,136,0.06);
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    display: inline-block;
                    margin-right: 6px;
                    margin-top: 4px;
                }
                .tsp__deskripsi {
                    font-size: 0.88rem;
                    color: var(--n-ink);
                    line-height: 1.6;
                    background: rgba(0,63,136,0.04);
                    padding: 12px 14px;
                    border-radius: 10px;
                    border-left: 3px solid var(--n-primary);
                }
                @media (max-width: 639px) {
                    .tsp__detailGrid {
                        grid-template-columns: 1fr;
                    }
                }



                .tsp__loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 60vh;
                    gap: 16px;
                    color: var(--n-muted);
                }

                .tsp__spinner {
                    font-size: 2rem;
                    color: var(--n-primary);
                }

                .tsp__spinner i {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Hero Banner — kept as-is (header colors preserved) */
                .tsp__hero {
                    position: relative;
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    color: white;
                    padding: 16px 32px;
                    border-radius: 16px;
                    border: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    overflow: hidden;
                    gap: 16px;
                }

                .tsp__hero::before, .tsp__hero::after { display: none; }

                .tsp__heroLeft {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    z-index: 1;
                }

                .tsp__heroIcon {
                    width: 48px;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.15);
                    border-radius: 14px;
                    font-size: 1.5rem;
                    flex-shrink: 0;
                }

                .tsp__heroContent {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    z-index: 1;
                }

                .tsp__heroStats {
                    display: flex;
                    align-items: center;
                    gap: 0;
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    border-radius: 16px;
                    padding: 8px 16px;
                    flex-shrink: 0;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
                }
                .tsp__heroStat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    padding: 0 16px;
                }
                .tsp__heroStatDivider {
                    width: 1px;
                    height: 32px;
                    background: rgba(255, 255, 255, 0.25);
                }
                .tsp__heroStatIcon { font-size: 1.1rem; margin-bottom: 2px; }
                .tsp__heroStatIcon--active { color: #60a5fa; }
                .tsp__heroStatIcon--urgent { color: #fde68a; }
                .tsp__heroStatIcon--done { color: #34d399; }
                .tsp__heroStatVal { font-size: 1.25rem; font-weight: 800; color: #ffffff; line-height: 1; }
                .tsp__heroStatLabel { font-size: 0.65rem; color: rgba(255, 255, 255, 0.85); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }

                .tsp__heroTitle {
                    font-family: 'Poppins', sans-serif;
                    font-size: 1.25rem;
                    font-weight: 800;
                    margin: 0;
                    letter-spacing: -0.02em;
                    color: white;
                    line-height: 1.2;
                }

                .tsp__heroSub {
                    font-size: 0.78rem;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.75);
                    margin: 2px 0 0 0;
                    line-height: 1.5;
                }

                .tsp__heroBadge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: white;
                    z-index: 1;
                    white-space: nowrap;
                    min-width: 90px;
                    justify-content: center;
                }

                /* Stats Grid */
                .tsp__statsGrid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-top: 4px;
                }
                .tsp__statCard {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 20px;
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    transition: 0.3s;
                }
                .tsp__statCard:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
                .stat__icon {
                    width: 44px; height: 44px;
                    border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.2rem;
                }
                .tsp__statCard.active .stat__icon { background: rgba(99, 102, 241, 0.12); color: #3083FF; }
                .tsp__statCard.urgent .stat__icon { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
                .tsp__statCard.done .stat__icon { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
                .stat__val { display: block; font-size: 1.3rem; font-weight: 850; color: var(--n-ink); line-height: 1; margin-bottom: 2px; }
                .stat__label { font-size: 0.75rem; font-weight: 650; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.02em; }

                .tsp__scopeBadge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    padding: 0 2px;
                }

                .tsp__scopeBadge i {
                    color: var(--n-primary);
                    font-size: 0.9rem;
                }

                .tsp__scopeBadge strong {
                    color: var(--n-ink);
                }

                .tsp__scopeBadge--warn {
                    align-items: flex-start;
                    padding: 10px 14px;
                    border-radius: 12px;
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid rgba(245, 158, 11, 0.25);
                    color: #b45309;
                }
                .tsp__scopeBadge--warn i { color: #f59e0b; }
                .tsp__scopeBadge--warn strong { color: inherit; }
                :global(.dark) .tsp__scopeBadge--warn {
                    background: rgba(245, 158, 11, 0.12);
                    border-color: rgba(245, 158, 11, 0.3);
                    color: #fcd34d;
                }

                .tsp__content {
                    background: var(--n-card);
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                }

                .tsp__desktopView {
                    display: block;
                }

                .tsp__mobileView {
                    display: none;
                }

                /* Bottom Action Bar */
                .tsp__bottomBar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 4px 0;
                }

                /* Fixed FAB — bottom right */
                .tsp__fab {
                    position: fixed;
                    bottom: 24px;
                    right: 40px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-size: 0.88rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 20px rgba(0, 63, 136, 0.4);
                    white-space: nowrap;
                    z-index: 100;
                }

                .tsp__fab:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 24px rgba(0, 63, 136, 0.5);
                }

                .tsp__fab i {
                    font-size: 1.1rem;
                }

                .tsp__error {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    border-radius: 12px;
                    color: #dc2626;
                    font-size: 0.85rem;
                }

                .tsp__error i:first-child {
                    font-size: 1rem;
                }

                .tsp__error button {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    background: #dc2626;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.78rem;
                    cursor: pointer;
                }

                .tsp__loadingFilterContent {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 4px 8px;
                    color: var(--n-muted);
                    font-size: 0.85rem;
                    font-weight: 600;
                }

                .tsp__noMaster {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 20px;
                    background: rgba(251, 191, 36, 0.08);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    border-radius: 16px;
                    color: #d97706;
                    font-size: 0.85rem;
                }

                /* Standalone mode (no .content-container parent) — restore padding */
                @media (min-width: 641px) {
                    .tsp__container {
                        padding-left: 24px;
                        padding-right: 32px;
                        max-width: 1400px;
                    }
                }

                /* Mobile */
                @media (max-width: 640px) {
                    .tsp__container {
                        padding: 0 14px;
                        gap: 6px;
                    }

                    .tsp__hero {
                        flex-direction: column;
                        align-items: flex-start;
                        padding: 16px 16px 20px;
                        border-radius: 16px;
                    }

                    .tsp__heroBadge {
                        align-self: flex-start;
                    }

                    .tsp__heroLeft {
                        gap: 12px;
                    }

                    .tsp__heroIcon {
                        width: 40px;
                        height: 40px;
                        font-size: 1.2rem;
                        border-radius: 12px;
                    }

                    .tsp__heroTitle {
                        font-size: 1.15rem;
                    }

                    .tsp__heroSub {
                        font-size: 0.75rem;
                    }

                    .tsp__heroBadge {
                        font-size: 0.75rem;
                        padding: 6px 12px;
                        align-self: flex-start;
                    }

                    .tsp__statsGrid {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 8px;
                    }

                    .tsp__statCard {
                        padding: 10px 8px;
                        gap: 8px;
                        border-radius: 14px;
                    }

                    .stat__icon {
                        width: 34px;
                        height: 34px;
                        font-size: 1rem;
                        border-radius: 10px;
                        flex-shrink: 0;
                    }

                    .stat__val {
                        font-size: 1.05rem;
                    }

                    .stat__label {
                        font-size: 0.65rem;
                    }

                    .tsp__desktopView {
                        display: none;
                    }

                    .tsp__mobileView {
                        display: block;
                    }

                    .tsp__content {
                        background: transparent;
                        border: none;
                        box-shadow: none;
                        overflow: visible;
                        border-radius: 0;
                    }

                    .tsp__bottomBar {
                        flex-direction: column-reverse;
                        gap: 8px;
                    }

                    .tsp__fab {
                        position: fixed;
                        bottom: 20px;
                        right: 50%;
                        transform: translateX(50%);
                        border-radius: 12px;
                        padding: 12px 24px;
                    }

                    .tsp__fab:hover {
                        transform: translateX(50%) translateY(-2px);
                    }
                }

                /* Dark Mode */
                /* Catatan: hero SEKARANG di-override (lihat blok HERO di bawah) —
                   diseragamkan dengan Master Data. Halaman Klinik Pembelajaran
                   (app/klinik/view.tsx .klinik-hero) masih memakai gradasi lama,
                   jadi keduanya kini berbeda. */
                :global(.dark) .tsp__heroBadge {
                    background: rgba(96, 165, 250, 0.15);
                    border-color: rgba(96, 165, 250, 0.4);
                }
                /* Pola referensi master/pengaturan-data: permukaan hitam + bingkai
                   #1a73e8. Palet biru bersama (sama di semua halaman): aksen #60a5fa
                   Sebelumnya #1a2235 — slate di luar palet, membuat kartu halaman
                   ini terlihat lebih terang dari halaman lain. */
                :global(.dark) .tsp__statCard {
                    background: var(--n-card);
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
                }
                :global(.dark) .tsp__statCard:hover {
                    border-color: rgba(26, 115, 232, 0.7);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px rgba(26, 115, 232, 0.2);
                }
                :global(.dark) .tsp__content {
                    background: var(--n-card);
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                    overflow: hidden;
                }
                @media (max-width: 640px) {
                    :global(.dark) .tsp__content {
                        background: transparent !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                }
                :global(.dark) .tsp__scopeBadge {
                    color: #94a3b8;
                }
                :global(.dark) .tsp__scopeBadge strong {
                    color: #60a5fa;
                }
                :global(.dark) .tsp__fab {
                    background: var(--n-card) !important;
                    border: 1px solid rgba(26, 115, 232, 0.5) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 14px rgba(26, 115, 232, 0.3) !important;
                }
                :global(.dark) .tsp__fab:hover {
                    background: var(--n-surface-2) !important;
                    color: #60a5fa !important;
                    border-color: #3b82f6 !important;
                    box-shadow: 0 6px 24px rgba(26, 115, 232, 0.6) !important;
                }
                :global(.dark) .tsp__loadingMaster {
                    background: var(--n-card);
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 16px;
                    color: #94a3b8;
                }
                :global(.dark) .tsp__noMaster {
                    background: rgba(251,191,36,0.06);
                    border-color: rgba(251,191,36,0.2);
                }
                :global(.dark) .tsp__error {
                    background: rgba(248,113,113,0.1);
                    border-color: rgba(248,113,113,0.25);
                    color: #f87171;
                }
                :global(.dark) .tsp__error button {
                    background: #dc2626;
                }

                /* HERO — diseragamkan dengan Master Data */
                :global(.dark) .tsp__hero {
                  background: var(--n-card) !important;
                  border: 1px solid rgba(26, 115, 232, 0.35) !important;
                  border-radius: 18px !important;
                  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
                }
                :global(.dark) .tsp__hero::before, :global(.dark) .tsp__hero::after { display: none !important; }
                :global(.dark) .tsp__heroTitle {
                  background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
                  -webkit-background-clip: text !important;
                  -webkit-text-fill-color: transparent !important;
                  background-clip: text !important;
                  display: inline-block !important;
                }
                :global(.dark) .tsp__heroSub { color: #94a3b8 !important; }
                :global(.dark) .tsp__heroIcon { background: rgba(96, 165, 250, 0.15) !important; border-color: rgba(96, 165, 250, 0.4) !important; color: #60a5fa !important; }
                :global(.dark) .tsp__heroBadge { background: rgba(96, 165, 250, 0.15) !important; border-color: rgba(96, 165, 250, 0.4) !important; color: #60a5fa !important; }

            `}</style>
            </div>
        </MaintenanceBanner>
    );
}
