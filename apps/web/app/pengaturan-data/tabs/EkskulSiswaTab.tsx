'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Spinner, PageLoader } from '@/components/ui/Spinner'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import Select from 'react-select'
import { useModalBlur } from '@/components/ModalBlurProvider'
import Pagination from '@/components/ui/Pagination'
import Button from '@/components/ui/Button'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { usePengaturanDataAccess } from '@/lib/use-pengaturan-data-access'

interface EkskulSiswaItem {
    id: string
    ekskul_id: string
    siswa_id: string
    nama_siswa: string
    tahun_ajaran: string
    semester: number
    aktif: boolean
    nama_ekskul?: string
}

interface EkskulItem {
    id: string
    nama_ekskul: string
    tahun_ajaran: string
    semester: number
    aktif: boolean
}

interface SiswaOption {
    value: string
    label: string
    nama: string
    nisn: string
    kelas?: string
}

const getCustomSelectStyles = (isDark: boolean) => ({
    control: (base: any, state: any) => ({
        ...base,
        borderRadius: '12px',
        border: isDark ? '1.8px solid rgba(26, 115, 232, 0.75)' : '1.5px solid #e2e8f0',
        padding: '2px 4px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: isDark ? '#ffffff' : '#0f172a',
        background: isDark ? '#000000' : '#ffffff',
        boxShadow: state.isFocused ? (isDark ? '0 0 12px rgba(26, 115, 232, 0.4)' : '0 0 0 3px rgba(79,142,247,0.12)') : 'none',
        '&:hover': {
            borderColor: isDark ? '#3b82f6' : 'var(--n-primary)',
        }
    }),
    valueContainer: (base: any) => ({
        ...base,
        padding: '2px 8px',
    }),
    input: (base: any) => ({
        ...base,
        margin: '0',
        padding: '0',
        color: isDark ? '#ffffff' : '#0f172a',
        caretColor: isDark ? '#60a5fa' : '#1a73e8',
    }),
    menu: (base: any) => ({
        ...base,
        borderRadius: '12px',
        background: isDark ? '#000000' : '#ffffff',
        border: isDark ? '1.8px solid rgba(26, 115, 232, 0.75)' : '1px solid #e2e8f0',
        boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.85)' : '0 10px 25px rgba(0,0,0,0.1)',
        zIndex: 99999,
        overflow: 'hidden'
    }),
    menuList: (base: any) => ({
        ...base,
        padding: '4px',
        background: isDark ? '#000000' : '#ffffff',
    }),
    option: (base: any, state: any) => ({
        ...base,
        fontSize: '0.85rem',
        fontWeight: 500,
        padding: '8px 12px',
        borderRadius: '8px',
        background: state.isFocused
            ? (isDark ? 'rgba(26, 115, 232, 0.2)' : 'rgba(79, 142, 247, 0.1)')
            : (isDark ? '#000000' : '#ffffff'),
        color: state.isFocused
            ? (isDark ? '#60a5fa' : '#1a73e8')
            : (isDark ? '#e2e8f0' : '#0f172a'),
        cursor: 'pointer',
    }),
    singleValue: (base: any) => ({
        ...base,
        fontWeight: 600,
        color: isDark ? '#ffffff' : '#0f172a',
    }),
    placeholder: (base: any) => ({
        ...base,
        fontWeight: 500,
        color: isDark ? '#94a3b8' : '#94a3b8',
    }),
    dropdownIndicator: (base: any) => ({
        ...base,
        padding: '4px',
        color: isDark ? '#60a5fa' : '#94a3b8',
        '&:hover': {
            color: isDark ? '#3b82f6' : '#1a73e8',
        }
    }),
    indicatorSeparator: () => ({ display: 'none' }),
});


function getAvatarColor(name: string) {
    const colors = [
        ['#dbeafe', '#1d4ed8'], ['#fce7f3', '#be185d'], ['#d1fae5', '#065f46'],
        ['#fef3c7', '#92400e'], ['#eff6ff', '#00287a'], ['#ffedd5', '#9a3412'],
        ['#cffafe', '#0e7490'], ['#eff6ff', '#1e40af']
    ];
    let hash = 0;
    const safeName = name || '?';
    for (let i = 0; i < safeName.length; i++) hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
    return (name || '?').split(' ').map(n => n?.[0] || '').slice(0, 2).join('').toUpperCase();
}

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanDataAccess(), bukan dari objek user. Propnya tetap diterima
// agar pemanggil (view.tsx) tidak perlu diubah.
export default function EkskulSiswaTab(_props: { user?: unknown }) {
    /**
     * Wewenang dari server (Hak Akses Fitur per tab). Pendaftaran mandiri oleh
     * siswa TIDAK lewat sini — endpoint `/ekskul/siswa` punya pemeriksaan
     * kepemilikan per baris sendiri, dan sengaja tidak digerbangi kunci tab ini.
     */
    const { boleh } = usePengaturanDataAccess();
    const bolehKelola = boleh('ekskul_siswa');

    const [ekskulSiswaList, setEkskulSiswaList] = useState<EkskulSiswaItem[]>([]);
    const [ekskulList, setEkskulList] = useState<EkskulItem[]>([]);
    const [siswaOptions, setSiswaOptions] = useState<SiswaOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
    const [deleteItemName, setDeleteItemName] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [selectedEkskul, setSelectedEkskul] = useState<any>(null);
    const [selectedSiswa, setSelectedSiswa] = useState<any>(null);
    const [tahunAjaran, setTahunAjaran] = useState('');
    const [semester, setSemester] = useState(1);
    const [academicYears, setAcademicYears] = useState<string[]>([]);
    const [filterTA, setFilterTA] = useState('');
    const [filterSem, setFilterSem] = useState('');
    const [filterEkskul, setFilterEkskul] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalItems, setTotalItems] = useState(0);

    // Mobile Action State
    const [mobileAction, setMobileAction] = useState<{ open: boolean; item: EkskulSiswaItem | null }>({ open: false, item: null })

    // Mobile Touch Gesture Swipe Navigation
    const touchStartX = useRef<number | null>(null)
    const touchEndX = useRef<number | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX
        touchEndX.current = e.targetTouches[0].clientX
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX
    }

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return
        const diff = touchStartX.current - touchEndX.current
        const minSwipeDistance = 50

        if (diff > minSwipeDistance) {
            if (currentPage < Math.ceil(totalItems / pageSize)) {
                setCurrentPage(prev => prev + 1)
            }
        } else if (diff < -minSwipeDistance) {
            if (currentPage > 1) {
                setCurrentPage(prev => prev - 1)
            }
        }
        touchStartX.current = null
        touchEndX.current = null
    }

    // Action Menu State (Mobile)
    const [showActionMenu, setShowActionMenu] = useState(false)
    const actionMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!showActionMenu) return
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setShowActionMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showActionMenu])

    const { registerModal } = useModalBlur();

    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
        checkDark();
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    const selectStyles = useMemo(() => getCustomSelectStyles(isDark), [isDark]);

    useEffect(() => {
        if (showModal || deleteItemId) return registerModal();
    }, [showModal, deleteItemId, registerModal]);


    const filteredEkskul = useMemo(() => {
        return ekskulList.filter(e => e.aktif);
    }, [ekskulList]);

    const filteredList = useMemo(() => {
        return ekskulSiswaList.filter(p => {
            const matchTA = !filterTA || p.tahun_ajaran === filterTA;
            const matchSem = !filterSem || String(p.semester) === filterSem;
            const matchEkskul = !filterEkskul || p.ekskul_id === filterEkskul;
            
            let matchSearch = true;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const nama = (p.nama_siswa || '').toLowerCase();
                const nisn = (siswaOptions.find(opt => opt.value === p.siswa_id)?.nisn || '').toLowerCase();
                matchSearch = nama.includes(q) || nisn.includes(q);
            }

            return matchTA && matchSem && matchEkskul && matchSearch;
        });
    }, [ekskulSiswaList, filterTA, filterSem, filterEkskul, searchQuery, siswaOptions]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredList.slice(start, start + pageSize);
    }, [filteredList, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [filterTA, filterSem, filterEkskul, searchQuery]);
    useEffect(() => { setTotalItems(filteredList.length); }, [filteredList]);

    const groupedByEkskul = useMemo(() => {
        const groups: Record<string, EkskulSiswaItem[]> = {};
        filteredList.forEach(p => {
            const key = p.nama_ekskul || p.ekskul_id;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }, [filteredList]);

    const stats = useMemo(() => ({
        totalEkskul: filteredEkskul.length,
        totalSiswa: filteredList.length,
        uniqueEkskul: Object.keys(groupedByEkskul).length,
    }), [filteredEkskul, filteredList, groupedByEkskul]);

    useEffect(() => { loadData(); }, []);

    const fetchAcademicYears = async () => {
        try {
            const { getActivePeriods, getActiveSettings } = await import('@/lib/settings-client');
            const periods = await getActivePeriods();
            const defaultSettings = await getActiveSettings();
            if (periods.length > 0) {
                const uniqueYears = Array.from(new Set(periods.map((p: any) => p.tahun_ajaran)));
                setAcademicYears(uniqueYears as string[]);
                if (defaultSettings) {
                    setTahunAjaran(defaultSettings.tahun_ajaran);
                    setFilterTA(defaultSettings.tahun_ajaran);
                } else {
                    setTahunAjaran(periods[0].tahun_ajaran);
                }
            }
        } catch (err) { console.error('Error fetching AY', err); }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [ekskulRes, siswaEksRes, siswaRes, siswaKelasRes, kelasRes] = await Promise.all([
                fetch('/api/ekskul'),
                fetch('/api/ekskul/siswa'),
                fetch('/api/master/students?limit=5000'),
                fetch('/api/settings/siswa-kelas'),
                fetch('/api/master/kelas')
            ]);
            const ekskulData = await ekskulRes.json();
            const siswaEksData = await siswaEksRes.json();
            const siswaData = await siswaRes.json();
            const siswaKelasData = await siswaKelasRes.json();
            const kelasData = await kelasRes.json();

            const regulerClasses = new Set<string>();
            if (kelasData.ok) {
                kelasData.data.forEach((k: any) => {
                    if (k.program === 'Reguler') regulerClasses.add(k.nama);
                });
            }

            const kelasMap = new Map<string, string>();
            if (siswaKelasData.ok) {
                siswaKelasData.data.forEach((r: any) => {
                    if (r.nisn && r.kelas && regulerClasses.has(r.kelas)) {
                        kelasMap.set(r.nisn, r.kelas);
                    }
                });
            }

            if (ekskulData.ok) setEkskulList(ekskulData.data);
            if (siswaEksData.ok) setEkskulSiswaList(siswaEksData.data);
            if (siswaData.ok) {
                setSiswaOptions(siswaData.data.map((s: any) => {
                    const nisn = s.nisn || s.nip;
                    return {
                        value: s.id,
                        label: `${s.nama_lengkap} (${nisn})`,
                        nama: s.nama_lengkap,
                        nisn: nisn,
                        kelas: kelasMap.get(nisn) || s.kelas || '',
                    };
                }));
            }
            await fetchAcademicYears();
        } catch (err) {
            console.error('Failed load data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEkskul || !selectedSiswa) {
            Swal.fire('Error', 'Mohon pilih ekstrakurikuler dan siswa', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ekskul_id: selectedEkskul.value,
                siswa_id: selectedSiswa.value,
                tahun_ajaran: tahunAjaran,
                semester,
                aktif: true,
                id: editingId || undefined,
            };
            const res = await fetch('/api/ekskul/siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await res.json();
            if (result.ok) {
                Swal.fire('Sukses', 'Pendaftaran berhasil disimpan', 'success');
                setShowModal(false);
                setEditingId(null);
                setSelectedEkskul(null);
                setSelectedSiswa(null);
                loadData();
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteItemId) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/ekskul/siswa?id=${deleteItemId}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) {
                setShowDeleteConfirm(false);
                setDeleteItemId(null);
                loadData();
                Swal.fire('Terhapus!', 'Pendaftaran berhasil dihapus.', 'success');
            } else {
                Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Gagal', 'Terjadi kesalahan', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const openAdd = () => {
        setEditingId(null);
        setSelectedEkskul(null);
        setSelectedSiswa(null);
        setShowModal(true);
    };

    const openEdit = (item: EkskulSiswaItem) => {
        setEditingId(item.id);
        const ekskulOpt = filteredEkskul.find(e => e.id === item.ekskul_id);
        setSelectedEkskul(ekskulOpt ? { value: ekskulOpt.id, label: ekskulOpt.nama_ekskul } : null);
        setSelectedSiswa({ value: item.siswa_id, label: `${item.nama_siswa} (${item.siswa_id})`, nama: item.nama_siswa });
        setShowModal(true);
    };

    return (
        <div className="est">


            {/* Stats */}
            <div className="est__stats">
                <div className="est__statCard">
                    <div className="est__statIcon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <i className="bi bi-list-task" style={{ color: '#10b981' }}></i>
                    </div>
                    <div>
                        <div className="est__statVal" style={{ color: '#10b981' }}>{stats.totalEkskul}</div>
                        <div className="est__statLbl">Total Ekskul</div>
                    </div>
                </div>
                <div className="est__statCard">
                    <div className="est__statIcon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <i className="bi bi-people-fill" style={{ color: '#3b82f6' }}></i>
                    </div>
                    <div>
                        <div className="est__statVal" style={{ color: '#3b82f6' }}>{stats.totalSiswa}</div>
                        <div className="est__statLbl">Total Siswa</div>
                    </div>
                </div>
                <div className="est__statCard">
                    <div className="est__statIcon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <i className="bi bi-collection-fill" style={{ color: '#3083FF' }}></i>
                    </div>
                    <div>
                        <div className="est__statVal" style={{ color: '#3083FF' }}>{stats.uniqueEkskul}</div>
                        <div className="est__statLbl">Ekskul Aktif</div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <FilterToolbar actionsInline>
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari siswa / NISN..."
                />

                <FilterSelect
                    label="Tahun Ajaran"
                    value={filterTA}
                    onChange={setFilterTA}
                    options={[
                        { value: '', label: 'Semua TA' },
                        ...academicYears.map(y => ({ value: y, label: y }))
                    ]}
                />

                <FilterSelect
                    label="Semester"
                    value={filterSem}
                    onChange={setFilterSem}
                    options={[
                        { value: '', label: 'Semua Semester' },
                        { value: '1', label: 'Ganjil' },
                        { value: '2', label: 'Genap' }
                    ]}
                />

                <FilterSelect
                    label="Ekstrakurikuler"
                    value={filterEkskul}
                    onChange={setFilterEkskul}
                    options={[
                        { value: '', label: 'Semua Ekskul' },
                        ...ekskulList.map(e => ({ value: e.id, label: e.nama_ekskul }))
                    ]}
                />

            </FilterToolbar>

            {/* Content */}
            {loading ? (
                <PageLoader minHeight="300px" dotsOnly size={18} />
            ) : Object.keys(groupedByEkskul).length === 0 ? (
                <div className="est__empty">
                    <div className="est__emptyIcon">
                        <i className="bi bi-clipboard-x" style={{ color: 'var(--n-muted)' }}></i>
                    </div>
                    <p>Belum ada pendaftaran siswa.</p>
                    <p className="est__emptyHint">Klik "Tambah Siswa" untuk mendaftarkan siswa ke ekskul.</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="est__tableWrap">
                        <table className="est__table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>No</th>
                                    <th>Nama Siswa</th>
                                    <th>Ekstrakurikuler</th>
                                    <th>Tahun Ajaran</th>
                                    <th>Status</th>
                                    {bolehKelola && <th style={{ width: '100px' }}>Aksi</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, index) => {
                                    const safeNama = item.nama_siswa || 'Siswa Tidak Diketahui';
                                    const ekskulName = item.nama_ekskul || ekskulList.find(e => e.id === item.ekskul_id)?.nama_ekskul || '-';
                                    const siswaOpt = siswaOptions.find(opt => opt.value === item.siswa_id);
                                    return (
                                        <tr key={item.id}>
                                            <td style={{ color: 'var(--n-muted)', fontWeight: 600 }}>{(currentPage - 1) * pageSize + index + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{safeNama}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>{siswaOpt?.nisn || '-'} / {siswaOpt?.kelas || '-'}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{ekskulName}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>Semester {item.semester === 1 ? 'Ganjil' : 'Genap'}</div>
                                            </td>
                                            <td>{item.tahun_ajaran}</td>
                                            <td>
                                                <span className={`est__badge ${item.aktif ? 'isOn' : 'isOff'}`}>
                                                    {item.aktif ? 'Aktif' : 'Non-Aktif'}
                                                </span>
                                            </td>
                                            {bolehKelola && (
                                                <td>
                                                    <ActionGroup>
                                                        <ActionButton
                                                            action="edit"
                                                            onClick={() => openEdit(item)}
                                                        />
                                                        <ActionButton
                                                            action="delete"
                                                            onClick={() => {
                                                                setDeleteItemId(item.id);
                                                                setDeleteItemName(`${item.nama_siswa} - ${ekskulName}`);
                                                                setShowDeleteConfirm(true);
                                                            }}
                                                        />
                                                    </ActionGroup>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div
                        className="sk__cards"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {paginatedData.map((item) => {
                            const safeNama = item.nama_siswa || 'Siswa Tidak Diketahui';
                            const ekskulName = item.nama_ekskul || ekskulList.find(e => e.id === item.ekskul_id)?.nama_ekskul || '-';
                            const siswaOpt = siswaOptions.find(opt => opt.value === item.siswa_id);
                            return (
                                <div
                                    className="sk__cardCompact"
                                    key={item.id}
                                    onClick={() => setMobileAction({ open: true, item })}
                                >
                                    <div className="sk__avatar">
                                        <span className="sk__avatarText">{getInitials(safeNama)}</span>
                                    </div>
                                    <div className="sk__cardCompactLeft">
                                        <div className="sk__cardName">
                                            {safeNama}
                                        </div>
                                        <div className="sk__cardNip">
                                            <span>Ekskul: {ekskulName}</span>
                                            <span>· {siswaOpt?.kelas ? `Kelas ${siswaOpt.kelas}` : (siswaOpt?.nisn ? `NISN ${siswaOpt.nisn}` : '')}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Aksi utama tab: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
                    {bolehKelola && <DesktopFab label="Tambah Siswa" icon="plus-lg" onClick={openAdd} />}
                    {bolehKelola && <MobileFab label="Tambah Peserta" icon="plus-lg" onClick={openAdd} />}

                    {/* Sheet */}
                    {mobileAction.open && mobileAction.item && (
                        <div className="sk__sheetOverlay" onClick={e => e.target === e.currentTarget && setMobileAction({ open: false, item: null })}>
                            <div className="sk__sheet">
                                <div className="sk__sheetHandle"></div>
                                <div className="sk__sheetTitle">
                                    <div className="sk__sheetName">{mobileAction.item.nama_siswa || 'Tanpa Nama'}</div>
                                    <div className="sk__sheetSub">
                                        Ekskul: {mobileAction.item.nama_ekskul || ekskulList.find(e => e.id === mobileAction.item!.ekskul_id)?.nama_ekskul || '-'}
                                    </div>
                                </div>
                                <div className="sk__sheetActions">
                                    {bolehKelola && <button className="sk__sheetBtn" onClick={() => { const item = mobileAction.item!; setMobileAction({ open: false, item: null }); openEdit(item); }}>
                                        <i className="bi bi-pencil"></i> Edit Pendaftaran
                                    </button>}
                                    {bolehKelola && <button className="sk__sheetBtn danger" onClick={() => { const item = mobileAction.item!; setMobileAction({ open: false, item: null }); setDeleteItemId(item.id); setDeleteItemName(`${item.nama_siswa} - ${item.nama_ekskul}`); setShowDeleteConfirm(true); }}>
                                        <i className="bi bi-trash"></i> Hapus Pendaftaran
                                    </button>}
                                </div>
                                <button className="sk__sheetCancel" onClick={() => setMobileAction({ open: false, item: null })}>Batal</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Pagination */}
            {totalItems > 0 && (
                <Pagination itemLabel="peserta"
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalItems / pageSize)}
                    limit={pageSize}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    onLimitChange={(newLimit) => { setCurrentPage(1); setPageSize(newLimit); }}
                />
            )}

            {/* Modal Add/Edit */}
            {showModal && (
                <Modal size="md" variant={editingId ? 'edit' : 'add'} onClose={() => setShowModal(false)} labelledBy="ekskul-siswa-modal-title">
                    <ModalHeader
                        id="ekskul-siswa-modal-title"
                        icon={editingId ? 'pencil-square' : 'plus-lg'}
                        title={editingId ? 'Edit Pendaftaran' : 'Daftarkan Siswa'}
                        onClose={() => setShowModal(false)}
                    />
                    <form onSubmit={handleSave}>
                        <ModalBody>
                            <div className="est__formGroup">
                                <label>Ekstrakurikuler <span className="est__required">*</span></label>
                                <Select
                                    options={filteredEkskul.map(e => ({ value: e.id, label: e.nama_ekskul }))}
                                    value={selectedEkskul}
                                    onChange={setSelectedEkskul}
                                    placeholder="Pilih ekstrakurikuler..."
                                    styles={selectStyles}
                                    isSearchable
                                    required
                                />
                            </div>
                            <div className="est__formGroup" style={{ marginTop: '12px' }}>
                                <label>Siswa <span className="est__required">*</span></label>
                                <Select
                                    options={siswaOptions}
                                    value={selectedSiswa}
                                    onChange={setSelectedSiswa}
                                    placeholder="Ketik nama atau NISN..."
                                    styles={selectStyles}
                                    isSearchable
                                    required
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                <div className="est__formGroup">
                                    <label>Tahun Ajaran</label>
                                    <select className="est__select" value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)}>
                                        {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="est__formGroup">
                                    <label>Semester</label>
                                    <select className="est__select" value={semester} onChange={e => setSemester(parseInt(e.target.value))}>
                                        <option value={1}>Ganjil</option>
                                        <option value={2}>Genap</option>
                                    </select>
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="cancel" type="button" onClick={() => setShowModal(false)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                            <Button variant="primary" type="submit" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>Simpan</Button>
                        </ModalFooter>
                    </form>
                </Modal>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <Modal size="sm" variant="delete" onClose={() => setShowDeleteConfirm(false)} labelledBy="delete-ekskul-siswa-title">
                    <ModalHeader
                        id="delete-ekskul-siswa-title"
                        icon="trash3"
                        title={deleteItemName}
                        onClose={() => setShowDeleteConfirm(false)}
                    />
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => setShowDeleteConfirm(false)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button variant="danger" type="button" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>Ya, Hapus</Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .est { width: 100%; display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; }



                .est__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .est__statCard {
                    background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px;
                    padding: 12px 16px; display: flex; align-items: center; gap: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                .est__statIcon {
                    width: 36px; height: 36px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                }
                .est__statIcon i { font-size: 1rem; }
                .est__statVal { font-size: 1.3rem; font-weight: 800; color: #10b981; line-height: 1.1; }
                .est__statLbl { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; margin-top: 2px; }

                .est__toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .est__filterRow { display: flex; gap: 8px; align-items: center; }
                .est__searchWrap { position: relative; display: flex; align-items: center; flex: 1; min-width: 250px; }
                .est__searchWrap i { position: absolute; left: 12px; color: var(--n-muted); font-size: 0.85rem; }
                .est__searchInput {
                    padding: 10px 16px 10px 36px; border: 1.5px solid var(--n-border); border-radius: 12px;
                    font-size: 0.8rem; font-weight: 500; color: var(--n-text); background: var(--n-card);
                    outline: none; transition: all 0.15s ease; width: 100%;
                }
                .est__searchInput:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
                
                .est__select {
                    padding: 10px 14px; border: 1.5px solid var(--n-border); border-radius: 12px;
                    font-size: 0.8rem; font-weight: 600; color: var(--n-text); background: var(--n-card);
                    outline: none; cursor: pointer; transition: all 0.15s ease;
                    appearance: none;
                    -webkit-appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: right 16px center;
                    background-size: 14px;
                    padding-right: 40px;
                }
                .est__select:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }

                .est__btn {
                    display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;
                    border-radius: 12px; font-size: 0.85rem; font-weight: 700; cursor: pointer;
                    border: none; transition: all 0.2s ease; white-space: nowrap;
                }
                .est__btnPrimary { background: #10b981; color: white; box-shadow: 0 3px 10px rgba(16,185,129,0.25); }
                .est__btnPrimary:hover { background: #059669; }
                .est__btnPrimary:disabled { opacity: 0.6; cursor: not-allowed; }
                .est__btnGhost { background: transparent; border: 1.5px solid var(--n-border); color: var(--n-muted); }
                .est__btnGhost:hover { background: var(--n-soft); }
                .est__btnDanger { background: #dc2626; color: white; box-shadow: 0 3px 10px rgba(220,38,38,0.25); }
                .est__btnDanger:hover { background: #b91c1c; }
                .est__btnDanger:disabled { opacity: 0.6; cursor: not-allowed; }

                .est__loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; }
                .est__spinner {
                    width: 36px; height: 36px; border: 3px solid rgba(16,185,129,0.15);
                    border-top-color: #10b981; border-radius: 50%;
                    animation: estspin 0.7s linear infinite;
                }
                @keyframes estspin { to { transform: rotate(360deg); } }

                .est__empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 20px; text-align: center; }
                .est__emptyIcon { width: 56px; height: 56px; background: var(--n-soft); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
                .est__emptyIcon i { font-size: 1.5rem; }
                .est__empty p { margin: 0; color: var(--n-muted); font-size: 0.9rem; }
                .est__emptyHint { color: var(--n-muted) !important; font-size: 0.82rem !important; }

                .est__tableWrap { display: block; overflow-x: auto; background: var(--n-card); border-radius: 16px; border: 1px solid var(--n-border); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
                .est__table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 800px; text-align: left; }
                .est__table th { background: rgba(16,185,129,0.05); padding: 14px 16px; font-size: 0.8rem; font-weight: 700; color: var(--n-muted); border-bottom: 2px solid rgba(16,185,129,0.1); white-space: nowrap; }
                .est__table td { padding: 14px 16px; font-size: 0.85rem; color: var(--n-text); border-bottom: 1px solid var(--n-border); vertical-align: middle; }
                .est__table tbody tr:last-child td { border-bottom: none; }
                .est__table tbody tr:hover td { background: var(--n-soft); }
                .est__table .est__badge { display: inline-block; }
                .est__table .est__siswaActions { position: static; margin-left: 0; display: flex; gap: 8px; }

                .est__groupList { display: none; flex-direction: column; gap: 16px; min-width: 0; }
                .est__group {
                    box-sizing: border-box;
                    background: var(--n-card); border: 1px solid var(--n-border); border-radius: 18px;
                    overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); min-width: 0;
                }
                .est__groupHeader {
                    box-sizing: border-box;
                    padding: 12px 16px; background: linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(5,150,105,0.04) 100%);
                    border-bottom: 1px solid rgba(16, 185, 129, 0.1);
                    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
                }
                .est__groupTitle { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.95rem; color: var(--n-text); }
                .est__groupTitle i { font-size: 1rem; color: #10b981; }
                .est__groupCount {
                    padding: 2px 8px; border-radius: 8px; font-size: 0.72rem; font-weight: 700;
                    background: rgba(16,185,129,0.1); color: #10b981;
                }
                .est__groupMeta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                .est__metaTag {
                    padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
                    background: rgba(16,185,129,0.08); color: #10b981;
                }

                .est__cardGrid { box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; padding: 12px; min-width: 0; }
                .est__siswaCard {
                    box-sizing: border-box;
                    background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px;
                    padding: 12px; display: flex; flex-direction: column; gap: 12px;
                    transition: all 0.15s ease; position: relative; min-width: 0;
                }
                .est__siswaCardTop {
                    display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0;
                }
                .est__siswaCardBottom {
                    display: flex; justify-content: flex-end; align-items: center; gap: 12px; width: 100%;
                    border-top: 1px dashed var(--n-border); padding-top: 10px;
                }
                .est__siswaCard:hover { border-color: rgba(16,185,129,0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
                .est__siswaAvatar {
                    width: 38px; height: 38px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 800; font-size: 0.8rem; flex-shrink: 0;
                }
                .est__siswaInfo { flex: 1; min-width: 0; }
                .est__siswaName { font-weight: 700; font-size: 0.85rem; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .est__siswaId { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; margin-top: 1px; }
                .est__siswaStatus { flex-shrink: 0; }
                .est__badge {
                    padding: 3px 10px; border-radius: 6px !important; font-size: 0.76rem; font-weight: 600; white-space: nowrap;
                }
                .est__badge.isOn { background: rgba(0, 56, 168, 0.08); border: 1px solid rgba(0, 56, 168, 0.25); color: #3083FF; }
                :global(.dark) .est__badge.isOn { background: rgba(14, 165, 233, 0.15) !important; border: 1.5px solid rgba(56, 189, 248, 0.5) !important; color: #38bdf8 !important; }
                .est__badge.isOff { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #dc2626; }
                :global(.dark) .est__badge.isOff { background: rgba(239, 68, 68, 0.15) !important; border: 1.5px solid rgba(239, 68, 68, 0.4) !important; color: #f87171 !important; }
                .est__siswaActions { display: flex; gap: 4px; flex-shrink: 0; margin-left: auto; }
                .est__iconBtn {
                    width: 28px; height: 28px; border: none; border-radius: 8px;
                    background: rgba(148,163,184,0.1); color: var(--n-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.15s; font-size: 0.8rem;
                }
                .est__iconBtn:hover { background: rgba(148,163,184,0.2); color: var(--n-muted); }
                .est__iconBtn.danger:hover { background: rgba(239,68,68,0.1); color: #dc2626; }

                /* Modal */
                .est__modalOverlay { pointer-events: auto !important; }
                .est__modal {
                    background: var(--n-card); border-radius: 20px; width: 100%; max-width: 480px;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;
                }
                .est__modalSm { max-width: 400px; }
                .est__modalHead {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 16px 20px; border-bottom: 1px solid var(--n-border);
                }
                .est__modalHead h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--n-text); }
                .est__modalClose {
                    width: 30px; height: 30px; border: none; border-radius: 8px;
                    background: rgba(148,163,184,0.1); color: var(--n-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
                }
                .est__modalClose:hover { background: rgba(239,68,68,0.1); color: #dc2626; }
                .est__modalBody { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
                .est__formGroup { display: flex; flex-direction: column; gap: 6px; }
                .est__formGroup label { font-size: 0.82rem; font-weight: 600; color: var(--n-muted); }
                .est__required { color: #dc2626; }
                .est__modalFoot {
                    display: flex; justify-content: flex-end; gap: 8px;
                    padding: 16px 20px; border-top: 1px solid var(--n-border);
                }

                /* ========= ACTION MENU (MOBILE) ========= */
                .sk__menuWrap {
                  position: relative;
                  display: inline-block;
                }

                .sk__btnActionMenu,
                .sk__btnMore {
                  min-width: 42px;
                  height: 36px;
                  min-height: 36px;
                  padding: 0 16px;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  background: #ffffff;
                  border: 1px solid #E1E2E9;
                  border-radius: 9999px;
                  color: #112E59;
                  font-size: 0.82rem;
                  font-weight: 600;
                  box-shadow: 0 1px 3px rgba(17, 46, 89, 0.04);
                  box-sizing: border-box;
                  cursor: pointer;
                  transition: all 0.15s ease;
                }

                .sk__btnActionMenu:hover,
                .sk__btnActionMenu.isOpen,
                .sk__btnMore:hover,
                .sk__btnMore.isOpen {
                  background: #E0ECFF;
                  border-color: #3083FF;
                  color: #112E59;
                }

                .sk__btnActionMenu i,
                .sk__btnMore i {
                  font-size: 1.1rem;
                  color: #112E59;
                  transition: color 0.15s ease;
                }

                .sk__menu {
                  position: absolute;
                  top: calc(100% + 6px);
                  left: 0;
                  z-index: 1000;
                  min-width: 190px;
                  width: max-content;
                  max-width: calc(100vw - 32px);
                  display: flex;
                  flex-direction: column;
                  gap: 6px;
                  padding: 8px;
                  border-radius: 16px;
                  background: #ffffff;
                  border: 1px solid #E1E2E9;
                  box-shadow: 0 12px 32px rgba(17, 46, 89, 0.12);
                  animation: skMenuIn 0.14s ease-out;
                }

                @keyframes skMenuIn {
                  from { opacity: 0; transform: translateY(-6px); }
                  to { opacity: 1; transform: translateY(0); }
                }

                .sk__menuItem {
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  width: 100%;
                  padding: 9px 14px;
                  border: 1px solid #E1E2E9;
                  background: #ffffff;
                  border-radius: 9999px;
                  text-align: left;
                  cursor: pointer;
                  font-size: 0.84rem;
                  font-weight: 600;
                  color: #112E59;
                  transition: all 0.15s ease;
                }

                .sk__menuItem:hover,
                .sk__menuItem:active {
                  background: #f8fafc;
                  border-color: #3083FF;
                  transform: translateY(-1px);
                }

                .sk__menuSep {
                  height: 1px;
                  background: #EBECF1;
                  margin: 2px 4px;
                }

                .sk__menuIcon {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 24px;
                  height: 24px;
                  flex-shrink: 0;
                }

                .sk__menuIcon i {
                  font-size: 1.05rem;
                  line-height: 1;
                  display: block;
                }

                .sk__menuLabel {
                  font-size: 0.84rem;
                  font-weight: 600;
                  color: var(--n-text, #0f172a);
                  white-space: nowrap;
                  flex: 1;
                }

                .sk__menuItemMobileOnly {
                  display: none !important;
                }

                @media (min-width: 640px) {
                  .sk__menuWrap { display: none !important; }
                }

                @media (max-width: 639px) {
                  .sk__menuItemMobileOnly {
                    display: flex !important;
                  }
                  .sk__menuSep.sk__menuItemMobileOnly {
                    display: block !important;
                  }
                  .sk__menu {
                    left: auto;
                    right: 0;
                  }
                  .sk__menuWrap .sk__btnActionMenu {
                    width: 42px !important;
                    min-width: 42px !important;
                    height: 42px !important;
                    min-height: 42px !important;
                    border-radius: 9999px !important;
                    flex: 0 0 auto !important;
                    padding: 0 !important;
                  }
                }

                @media (min-width: 768px) {
                    .est__tableWrap { display: block; }
                    .sk__cards { display: none !important; }
                }
                @media (max-width: 767px) {
                    .est__tableWrap { display: none; }
                    .sk__cards {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        background: #ffffff;
                        border: 1px solid #E1E2E9;
                        border-radius: 16px;
                        box-shadow: 0 1px 4px rgba(17, 46, 89, 0.04);
                        padding: 6px;
                        overflow: hidden;
                        touch-action: pan-y;
                    }

                    .sk__cardCompact {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 12px;
                        padding: 11px 12px;
                        background: transparent;
                        border: none !important;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: background 0.15s ease;
                        box-sizing: border-box;
                    }

                    .sk__cardCompact:hover,
                    .sk__cardCompact:active {
                        background: #E0ECFF;
                    }

                    .sk__avatar {
                        width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #E0ECFF;
                        color: #1d6bf3;
                        font-weight: 700;
                        font-size: 0.82rem;
                        flex-shrink: 0;
                    }

                    .sk__avatarText {
                        line-height: 1;
                    }

                    .sk__cardCompactLeft {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        min-width: 0;
                        flex: 1 1 auto;
                    }

                    .sk__cardCompact:not(:last-child) .sk__cardCompactLeft {
                        border-bottom: 1px solid #E1E2E9;
                        padding-bottom: 9px;
                    }

                    :global(.dark) .sk__cardCompact:not(:last-child) .sk__cardCompactLeft {
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    }

                    .sk__cardCompactLeft .sk__cardName {
                        font-weight: 700;
                        font-size: 0.84rem;
                        line-height: 1.25;
                        color: #112E59;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .sk__cardCompactLeft .sk__cardNip {
                        font-size: 0.72rem;
                        color: #64748b;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex-wrap: wrap;
                    }

                    .est__stats { grid-template-columns: repeat(3, 1fr); gap: 8px; }
                    .est__statCard { flex-direction: column; text-align: center; padding: 10px 4px; gap: 4px; border-radius: 12px; }
                    .est__statIcon { width: 32px; height: 32px; border-radius: 8px; }
                    .est__statIcon i { font-size: 0.9rem; }
                    .est__statVal { font-size: 1.1rem; }
                    .est__statLbl { font-size: 0.65rem; }

                    .est__toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
                    .est__searchWrap { width: 100%; min-width: 0; }
                    .est__filterRow { width: 100%; }
                    .est__filterRow > * { flex: 1; min-width: 0; }
                    .est__select { font-size: 0.8rem; padding: 9px 12px; padding-right: 40px; }
                    .est__toolbar .est__btnPrimary { padding: 10px 16px; justify-content: center; }
                    .est__cardGrid { grid-template-columns: 1fr; }
                    .est__modal { margin: 0 16px; }
                }

                :global(.dark) .sk__cards {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.65) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
                }

                :global(.dark) .sk__cardCompact {
                    background: transparent !important;
                    border: none !important;
                    border-bottom: 1px solid rgba(59, 130, 246, 0.18) !important;
                }

                :global(.dark) .sk__cardCompact:last-child {
                    border-bottom: none !important;
                }

                :global(.dark) .sk__cardCompact:hover,
                :global(.dark) .sk__cardCompact:active {
                    background: rgba(26, 115, 232, 0.12) !important;
                }

                :global(.dark) .sk__avatar {
                    background: rgba(26, 115, 232, 0.18) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(26, 115, 232, 0.5) !important;
                }

                :global(.dark) .sk__cardCompactLeft .sk__cardName {
                    color: #ffffff !important;
                }
                :global(.dark) .sk__cardCompactLeft .sk__cardNip {
                    color: #94a3b8 !important;
                }
            `}</style>
        </div>
    )
}