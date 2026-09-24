'use client';

import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import notif from '@/lib/notifications';
import { authFetch } from '@/lib/auth-fetch';
import FilterToolbar, { FilterSelect, FilterField, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalField } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Spinner } from '@/components/ui/Spinner';
import InlineSelect from '@/components/ui/InlineSelect';
import { MobileList, MobileListItem, MobileEmpty } from '@/components/mobile';
import {
    ArrowLeft,
    ArrowLeftRight,
    AlertTriangle,
    RotateCw,
    Inbox,
    Eye,
    ChevronLeft,
    ChevronRight,
    FileText,
    CalendarRange,
    UserCheck,
    Layers,
    Search,
} from 'lucide-react';

interface AdminNilaiRow {
    id: string;
    nip: string;
    nama_guru: string;
    kelas: string;
    mapel: string;
    semester: number;
    tahun_ajaran: string;
    nisn: string;
    nama_siswa: string;
    jenis: string;
    materi_tp: string;
    tagihan: string;
    nilai: number | null;
    catatan: string | null;
    updated_at: string;
}

export interface GroupedTask {
    id: string;
    guru: string;
    nip: string;
    kelas: string;
    mapel: string;
    semester: number;
    tahun_ajaran: string;
    jenis: string;
    materi_tp: string;
    tagihan: string;
    count: number;
    updated_at: string;
    students: AdminNilaiRow[];
}

interface NilaiAdminPanelProps {
    user: any;
    onClose: () => void;
}

export default function NilaiAdminPanel({ user, onClose }: NilaiAdminPanelProps) {
    const [adminData, setAdminData] = useState<AdminNilaiRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [nipFilter, setNipFilter] = useState('');
    const [kelasFilter, setKelasFilter] = useState('');
    const [mapelFilter, setMapelFilter] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('');
    const [tahunAjaranFilter, setTahunAjaranFilter] = useState('');
    const [activePeriodLabel, setActivePeriodLabel] = useState('');
    const [searchText, setSearchText] = useState('');
    const [guruList, setGuruList] = useState<any[]>([]);
    const [allGuruList, setAllGuruList] = useState<any[]>([]);
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [mapelList, setMapelList] = useState<string[]>([]);

    // Transfer Modal state
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [transferForm, setTransferForm] = useState({
        tahun_ajaran: '',
        semester: '1',
        kelas: '',
        mapel: '',
        fromNip: '',
        toNip: '',
    });
    
    // Selection state for Tasks
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set<string>());
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    // Modal state for viewing a specific task
    const [viewingTask, setViewingTask] = useState<GroupedTask | null>(null);
    
    // Edit state for students within a task
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editCatatan, setEditCatatan] = useState('');

    function doFetch() {
        setLoading(true);
        setFetchError(null);
        const params = new URLSearchParams();
        if (nipFilter) params.set('nip', nipFilter);
        if (kelasFilter) params.set('kelas', kelasFilter);
        if (mapelFilter) params.set('mapel', mapelFilter);
        if (semesterFilter) params.set('semester', semesterFilter);
        if (tahunAjaranFilter) params.set('tahun_ajaran', tahunAjaranFilter);
        if (searchText) params.set('search', searchText);
        authFetch(`/api/nilai/admin?${params}`)
            .then(r => r.json())
            .then(json => {
                if (json.ok) setAdminData(Array.isArray(json.data) ? json.data : []);
                else setFetchError(String(json.error));
            })
            .catch(e => setFetchError(String(e)))
            .finally(() => setLoading(false));
    }

    const [isInitialLoaded, setIsInitialLoaded] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Load active academic year from settings
                const { getActiveSettings } = await import('@/lib/settings-client');
                const active = await getActiveSettings();
                let activeTahun = '';
                let activeSem = '';
                if (active) {
                    activeTahun = active.tahun_ajaran || '';
                    const rawSem = String(active.semester).toLowerCase();
                    const semNum = (rawSem === '1' || rawSem === 'ganjil') ? '1' : (rawSem === '2' || rawSem === 'genap') ? '2' : '';
                    activeSem = semNum;
                    const semLabel = semNum === '1' ? 'Ganjil' : semNum === '2' ? 'Genap' : 'Semua';
                    setActivePeriodLabel(`${activeTahun}${semNum ? ` • Sem. ${semLabel}` : ''}`);
                    setTahunAjaranFilter(activeTahun);
                    setSemesterFilter(semNum);
                }

                // Load dropdown lists
                const [guruJson, filterJson, allGuruJson] = await Promise.all([
                    authFetch(`/api/nilai/guru-list?tahun_ajaran=${encodeURIComponent(activeTahun)}&semester=`).then(r => r.json()),
                    authFetch(`/api/nilai/filters?tahun_ajaran=${encodeURIComponent(activeTahun)}&semester=`).then(r => r.json()),
                    authFetch('/api/master/guru?limit=1000').then(r => r.json()).catch(() => ({ ok: false, data: [] })),
                ]);
                if (guruJson.ok) setGuruList(Array.isArray(guruJson.data) ? guruJson.data : []);
                if (filterJson.ok) {
                    setKelasList(Array.isArray(filterJson.data?.kelasList) ? filterJson.data.kelasList : []);
                    setMapelList(Array.isArray(filterJson.data?.mapelList) ? filterJson.data.mapelList : []);
                }
                if (allGuruJson.ok && Array.isArray(allGuruJson.data)) {
                    setAllGuruList(allGuruJson.data);
                }

                // Fetch with active year pre-applied
                setLoading(true);
                setFetchError(null);
                const params = new URLSearchParams();
                if (activeTahun) params.set('tahun_ajaran', activeTahun);
                if (activeSem) params.set('semester', activeSem);
                const res = await authFetch(`/api/nilai/admin?${params}`);
                const json = await res.json();
                if (json.ok) setAdminData(Array.isArray(json.data) ? json.data : []);
                else setFetchError(String(json.error));
            } catch (e) {
                setFetchError(String(e));
            } finally {
                setLoading(false);
                setIsInitialLoaded(true);
            }
        };
        init();
    }, []);

    // Filter & pencarian sama-sama memicu pengambilan data.
    //
    // Diberi jeda 350ms karena `searchText` ikut di sini: tanpa jeda, tiap
    // ketikan jadi satu permintaan ke server. Jeda ini juga meredam ledakan
    // permintaan saat user mengubah dua dropdown beruntun.
    useEffect(() => {
        if (!isInitialLoaded) return;
        const timer = setTimeout(() => doFetch(), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nipFilter, kelasFilter, mapelFilter, semesterFilter, searchText]);

    const groupedTasks = useMemo(() => {
        const groups = new Map<string, GroupedTask>();
        for (const row of adminData) {
            const key = `${row.nip}_${row.kelas}_${row.mapel}_${row.semester}_${row.tahun_ajaran}_${row.jenis}_${row.materi_tp}_${row.tagihan}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    id: key,
                    guru: row.nama_guru,
                    nip: row.nip,
                    kelas: row.kelas,
                    mapel: row.mapel,
                    semester: row.semester,
                    tahun_ajaran: row.tahun_ajaran,
                    jenis: row.jenis,
                    materi_tp: row.materi_tp,
                    tagihan: row.tagihan,
                    count: 0,
                    updated_at: row.updated_at,
                    students: []
                });
            }
            const g = groups.get(key)!;
            g.students.push(row);
            g.count++;
            if (new Date(row.updated_at) > new Date(g.updated_at)) {
                g.updated_at = row.updated_at;
            }
        }
        return Array.from(groups.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }, [adminData]);

    // Reset page to 1 on filter/search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [nipFilter, kelasFilter, mapelFilter, semesterFilter, searchText, adminData]);

    const totalItems = groupedTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const paginatedTasks = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return groupedTasks.slice(start, start + pageSize);
    }, [groupedTasks, currentPage, pageSize]);

    // Whenever adminData updates, refresh viewingTask if modal is open
    useEffect(() => {
        if (viewingTask) {
            const updated = groupedTasks.find(t => t.id === viewingTask.id);
            if (updated) setViewingTask(updated);
            else setViewingTask(null); // Task deleted or filtered out
        }
    }, [groupedTasks]);

    function handleSelectAllTasks() {
        const next: Set<string> = selectedTaskIds.size === groupedTasks.length ? new Set<string>() : new Set<string>(groupedTasks.map(t => t.id));
        setSelectedTaskIds(next);
    }

    function handleSelectOneTask(id: string) {
        const next = new Set(selectedTaskIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedTaskIds(next);
    }

    async function handleDeleteSelectedTasks() {
        if (selectedTaskIds.size === 0) return;
        const ok = await Swal.fire({ title: `Hapus ${selectedTaskIds.size} Penilaian?`, text: 'Semua nilai siswa dalam penilaian ini akan dihapus permanen!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'YA, HAPUS' });
        if (!ok.isConfirmed) return;
        setLoading(true);
        try {
            let deleted = 0, failed = 0;
            const tasksToDelete = groupedTasks.filter(t => selectedTaskIds.has(t.id));
            for (const task of tasksToDelete) {
                for (const student of task.students) {
                    try {
                        const res = await authFetch(`/api/nilai/admin?id=${student.id}`, { method: 'DELETE' });
                        const json = await res.json().catch(() => ({ ok: false }));
                        if (res.ok && json.ok) deleted++;
                        else failed++;
                    } catch { failed++; }
                }
            }
            setSelectedTaskIds(new Set());
            doFetch();
            if (failed > 0) notif.error(`${deleted} nilai terhapus, ${failed} gagal`);
            else notif.success(`Berhasil menghapus seluruh data penilaian terpilih`);
        } catch { Swal.fire({ icon: 'error', text: 'Gagal menghapus data' }); }
        finally { setLoading(false); }
    }

    async function handleDeleteTask(task: GroupedTask) {
        const ok = await Swal.fire({ title: 'Hapus Penilaian?', text: `Semua nilai siswa untuk tugas ini akan dihapus permanen!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'YA, HAPUS' });
        if (!ok.isConfirmed) return;
        
        // Show loading via SweetAlert
        Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        
        let deleted = 0, failed = 0;
        for (const student of task.students) {
            try {
                const res = await authFetch(`/api/nilai/admin?id=${student.id}`, { method: 'DELETE' });
                const json = await res.json().catch(() => ({ ok: false }));
                if (res.ok && json.ok) deleted++;
                else failed++;
            } catch { failed++; }
        }
        doFetch();
        Swal.close();
        if (failed > 0) notif.error(`Gagal menghapus beberapa data (${failed})`);
        else notif.success('Data penilaian berhasil dihapus');
    }

    function handleStartEdit(row: AdminNilaiRow) {
        setEditingId(row.id);
        setEditValue(row.nilai != null ? String(row.nilai) : '');
        setEditCatatan(row.catatan || '');
    }

    async function handleSaveEdit(id: string) {
        const res = await authFetch('/api/nilai/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nilai: editValue, catatan: editCatatan }) });
        const json = await res.json().catch(() => ({ ok: false }));
        setEditingId(null);
        doFetch();
        if (res.ok && json.ok) notif.success('Data berhasil disimpan');
        else notif.error(json.error || 'Gagal menyimpan perubahan');
    }

    async function handleDeleteOneStudent(id: string) {
        const ok = await Swal.fire({ title: 'Hapus Nilai Siswa?', text: 'Tdk dpt dikembalikan!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'YA, HAPUS' });
        if (!ok.isConfirmed) return;
        const res = await authFetch(`/api/nilai/admin?id=${id}`, { method: 'DELETE' });
        const json = await res.json().catch(() => ({ ok: false }));
        doFetch();
        if (res.ok && json.ok) notif.success('Nilai siswa berhasil dihapus');
        else notif.error(json.error || 'Gagal menghapus data');
    }

    // Jenis penilaian -> suffix class warna teks di kolom Materi/Bab.
    const jenisKey = (jenis: string, materi?: string, tagihan?: string) => {
        const fullText = `${jenis || ''} ${materi || ''} ${tagihan || ''}`.trim().toUpperCase();
        if (fullText.includes('SUM 1') || fullText.includes('SUM1')) return 'sum-1';
        if (fullText.includes('SUM 2') || fullText.includes('SUM2')) return 'sum-2';
        if (fullText.includes('SUM 3') || fullText.includes('SUM3')) return 'sum-3';
        if (fullText.includes('SUM 4') || fullText.includes('SUM4')) return 'sum-4';
        if (fullText.includes('SUM 5') || fullText.includes('SUM5')) return 'sum-5';
        if (fullText.includes('SUM 6') || fullText.includes('SUM6')) return 'sum-6';
        if (fullText.includes('SUM 7') || fullText.includes('SUM7')) return 'sum-7';
        if (fullText.includes('SUM 8') || fullText.includes('SUM8')) return 'sum-8';

        const v = (jenis || '').trim().toUpperCase();
        if (v === 'KUIS') return 'kuis';
        if (v === 'TUGAS') return 'tugas';
        if (v === 'UH') return 'uh';
        if (v === 'PAS' || v === 'PTS' || v === 'SUM') return 'sum';
        return 'lain';
    };
    const tagClass = (tagihan?: string, jenis?: string) => {
        const text = `${tagihan || ''} ${jenis || ''}`.toUpperCase();
        if (text.includes('KUIS')) return 'nl__tag-kuis';
        if (text.includes('TUGAS')) return 'nl__tag-tugas';
        if (text.includes('UH')) return 'nl__tag-uh';
        return 'nl__tag-tugas';
    };
    const formatDate = (iso: string) => {
        try { return iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
        catch { return '-'; }
    };

    const availableTahunAjaran = useMemo(() => {
        const set = new Set<string>();
        if (tahunAjaranFilter) set.add(tahunAjaranFilter);
        for (const d of adminData) {
            if (d.tahun_ajaran) set.add(d.tahun_ajaran);
        }
        if (set.size === 0) {
            set.add('2026/2027');
            set.add('2025/2026');
            set.add('2024/2025');
        }
        return Array.from(set).sort().reverse();
    }, [tahunAjaranFilter, adminData]);

    function handleOpenTransfer(task?: GroupedTask) {
        if (task) {
            setTransferForm({
                tahun_ajaran: task.tahun_ajaran || tahunAjaranFilter || (availableTahunAjaran[0] || ''),
                semester: String(task.semester || semesterFilter || '1'),
                kelas: task.kelas || '',
                mapel: task.mapel || '',
                fromNip: task.nip || '',
                toNip: '',
            });
        } else {
            setTransferForm({
                tahun_ajaran: tahunAjaranFilter || (availableTahunAjaran[0] || ''),
                semester: semesterFilter || '1',
                kelas: kelasFilter || (kelasList[0] || ''),
                mapel: mapelFilter || (mapelList[0] || ''),
                fromNip: nipFilter || '',
                toNip: '',
            });
        }
        setShowTransferModal(true);
    }

    async function handleExecuteTransfer() {
        const { fromNip, toNip, kelas, mapel, tahun_ajaran, semester } = transferForm;
        if (!fromNip || !toNip || !kelas || !mapel || !tahun_ajaran || !semester) {
            notif.error('Harap lengkapi semua bidang transfer pengampu');
            return;
        }
        if (fromNip === toNip) {
            notif.error('Guru Asal dan Guru Pengganti tidak boleh sama');
            return;
        }

        const teacherPool = allGuruList.length > 0 ? allGuruList : guruList;
        const fromTeacher = teacherPool.find((g: any) => String(g.nip) === fromNip);
        const toTeacher = teacherPool.find((g: any) => String(g.nip) === toNip);
        const fromName = fromTeacher?.nama_lengkap || fromNip;
        const toName = toTeacher?.nama_lengkap || toNip;

        const confirm = await Swal.fire({
            title: 'Konfirmasi Pengalihan Pengampu',
            html: `
                <div style="text-align: left; font-size: 0.9rem; line-height: 1.5;">
                    <p>Anda akan mengalihkan seluruh nilai dan konfigurasi pengampu berikut:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li><strong>Kelas:</strong> ${kelas}</li>
                        <li><strong>Mata Pelajaran:</strong> ${mapel}</li>
                        <li><strong>Periode:</strong> Semester ${semester === '1' ? 'Ganjil' : 'Genap'} (TA ${tahun_ajaran})</li>
                        <li><strong>Guru Asal:</strong> ${fromName} (${fromNip})</li>
                        <li><strong>Guru Pengganti:</strong> <span style="color: #2563eb; font-weight: bold;">${toName} (${toNip})</span></li>
                    </ul>
                    <p style="color: #ef4444; font-size: 0.8rem; margin-top: 8px;">
                        * Seluruh data nilai siswa, tagihan tugas, bobot penilaian, dan sesi apresiasi akan dialihkan ke guru baru. Tindakan ini dicatat ke log audit sistem.
                    </p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Ya, Alihkan Pengampu',
            cancelButtonText: 'Batal',
        });

        if (!confirm.isConfirmed) return;

        setTransferring(true);
        try {
            const res = await authFetch('/api/nilai/admin/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromNip,
                    toNip,
                    kelas,
                    mapel,
                    tahun_ajaran,
                    semester,
                }),
            });
            const json = await res.json();
            if (res.ok && json.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Pengalihan Berhasil!',
                    text: json.message || 'Data pengampu nilai berhasil dialihkan.',
                    confirmButtonColor: '#2563eb',
                });
                setShowTransferModal(false);
                doFetch();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Pengalihan Gagal',
                    text: json.error || 'Terjadi kesalahan saat memproses transfer.',
                    confirmButtonColor: '#ef4444',
                });
            }
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Kesalahan Jaringan',
                text: String(err?.message || err),
                confirmButtonColor: '#ef4444',
            });
        } finally {
            setTransferring(false);
        }
    }

    return (
        <div className="nl__adminPanel">
            {/* Top Container: Header & Filters */}
            <FilterToolbar
                className="ftb-toolbar--noSticky"
                actionsInline
                leading={
                    <button
                        type="button"
                        className="ftb-backBtn"
                        onClick={onClose}
                        title="Kembali ke Rekap Nilai"
                        aria-label="Kembali ke Rekap Nilai"
                    >
                        <ArrowLeft size={16} />
                    </button>
                }
            >
                <FilterSelect
                    label="Semester"
                    icon={<CalendarRange size={15} />}
                    value={semesterFilter}
                    onChange={setSemesterFilter}
                    options={[
                        { value: '', label: 'Semua' },
                        { value: '1', label: 'Ganjil' },
                        { value: '2', label: 'Genap' },
                    ]}
                    grow={1}
                    width={140}
                />

                <FilterSelect
                    label="Guru"
                    icon={<UserCheck size={15} />}
                    value={nipFilter}
                    onChange={setNipFilter}
                    options={[
                        { value: '', label: 'Semua Guru' },
                        ...guruList.map((g: any) => ({ value: String(g.nip), label: String(g.nama_lengkap || g.nip) })),
                    ]}
                    grow={2}
                    width={200}
                />

                <FilterSelect
                    label="Kelas"
                    icon={<Layers size={15} />}
                    value={kelasFilter}
                    onChange={setKelasFilter}
                    options={[
                        { value: '', label: 'Semua' },
                        ...kelasList.map(k => ({ value: k, label: k })),
                    ]}
                    grow={1}
                    width={140}
                />

                <FilterSearch
                    label="Cari"
                    icon={<Search size={15} />}
                    value={searchText}
                    onChange={setSearchText}
                    placeholder="Nama Guru / Materi..."
                    /* Pencarian berjalan sendiri setelah jeda mengetik (lihat
                       efek auto-fetch). Enter cuma jalan pintas untuk mencari
                       SEKARANG tanpa menunggu jeda itu. */
                    onKeyDown={e => { if (e.key === 'Enter') doFetch(); }}
                    grow={2}
                    width={220}
                />

                <FilterActions>
                    <Button
                        type="button"
                        variant="primary"
                        leftIcon={<ArrowLeftRight size={16} />}
                        onClick={() => handleOpenTransfer()}
                        title="Alihkan Pengampu Nilai (Pergantian Guru)"
                        className="ftb-btn-icon-mobile"
                    >
                        Alihkan Pengampu
                    </Button>
                </FilterActions>
            </FilterToolbar>

            {/* Bottom Container: Data Table */}
            <div className="nl__adminTableCard">
                {/* Error */}
                {fetchError ? (
                    <div className="nl__adminErrorBanner">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                        <span>{fetchError}</span>
                        <button onClick={doFetch}><RotateCw size={14} /> Ulangi</button>
                    </div>
                ) : null}

                {/* Content Table */}
                <div className="nl__adminTableWrap">
                    {loading ? (
                        <div className="nl__adminLoading">
                            <Spinner variant="buble" size={28} />
                            <p>Memuat data...</p>
                        </div>
                    ) : groupedTasks.length === 0 ? (
                        <div className="nl__adminEmpty">
                            <Inbox size={42} className="text-slate-300 dark:text-slate-600 mb-2" />
                            <p>Belum ada data penilaian</p>
                            <span>Data akan muncul setelah guru membuat penugasan/penilaian.</span>
                            <button className="nl__adminRetryBtn" onClick={doFetch}><RotateCw size={14} /> Refresh</button>
                        </div>
                    ) : (
                        <>
                            {/* Mobile List View */}
                            <div className="nl__adminMobileList">
                                <MobileList label="Daftar Penilaian Admin">
                                    {paginatedTasks.map(task => (
                                        <MobileListItem
                                            key={task.id}
                                            title={task.guru || 'Tanpa Nama Guru'}
                                            subtitle={task.tagihan || task.materi_tp || '-'}
                                            badge={
                                                <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 shrink-0 ml-2">
                                                    {task.kelas}
                                                </span>
                                            }
                                            seed={task.guru}
                                            onClick={() => setViewingTask(task)}
                                        />
                                    ))}
                                </MobileList>
                            </div>

                            {/* Desktop Table View */}
                            <div className="nl__adminTableScroll">
                                <table className="nl__adminTable">
                                    <thead>
                                        <tr>
                                            <th>Guru / Mapel</th>
                                            <th>Kelas</th>
                                            <th style={{ textAlign: 'center' }}>Semester / TA</th>
                                            <th>Materi / Bab</th>
                                            <th style={{ textAlign: 'center' }}>Siswa</th>
                                            <th>Update Terakhir</th>
                                            <th style={{ textAlign: 'center' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedTasks.map(task => {
                                            const isSelected = selectedTaskIds.has(task.id);
                                            return (
                                                <tr key={task.id}>
                                                    <td>
                                                        <div className="nl__adminGuruCell">
                                                            <span className="nl__adminGuruName">{String(task.guru || '')}</span>
                                                            <span className="nl__adminGuruMapel">{String(task.mapel || '-')}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="nl__adminKelasCell">{String(task.kelas || '')}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div className="nl__adminPeriodeCell">
                                                            <span className="nl__adminSemText">
                                                                {task.semester === 1 ? 'Ganjil' : 'Genap'}
                                                            </span>
                                                            <span className="nl__adminTACell">{String(task.tahun_ajaran || '-')}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="nl__adminMateriCell" title={`${String(task.jenis || '')} • ${(task.materi_tp || '-').length > 60 ? String(task.materi_tp || '-').slice(0, 60) + '...' : String(task.materi_tp || '-')}`}>
                                                            <span className="nl__adminMateriName">{String(task.materi_tp || '-')}</span>
                                                            {task.tagihan && (
                                                                <span className={`nl__adminTagCell ${tagClass(task.tagihan, task.jenis)}`}>
                                                                    {String(task.tagihan)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--n-ink)' }}>
                                                        {task.count}
                                                    </td>
                                                    <td>
                                                        <span className="nl__adminDate">{formatDate(task.updated_at)}</span>
                                                    </td>
                                                    <td>
                                                        <ActionGroup align="center">
                                                            <ActionButton
                                                                action="view"
                                                                size="sm"
                                                                title="Lihat Nilai Siswa"
                                                                tooltip="Lihat Nilai Siswa"
                                                                icon={<Eye size={15} />}
                                                                onClick={() => setViewingTask(task)}
                                                            />
                                                            <ActionButton
                                                                action="move"
                                                                size="sm"
                                                                title="Alihkan Pengampu Penilaian Ini"
                                                                tooltip="Alihkan Pengampu Penilaian Ini"
                                                                icon={<ArrowLeftRight size={15} />}
                                                                onClick={() => handleOpenTransfer(task)}
                                                            />
                                                        </ActionGroup>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Pagination Bar */}
                {!loading && totalItems > 0 && (
                    <div className="nl__adminPagination">
                        <div className="nl__adminPaginationInfo">
                            Menampilkan <strong>{Math.min((currentPage - 1) * pageSize + 1, totalItems)}</strong>–<strong>{Math.min(currentPage * pageSize, totalItems)}</strong> dari <strong>{totalItems}</strong> penilaian
                        </div>

                        <div className="nl__adminPaginationControls">
                            <div className="nl__adminPageSizeSelect">
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginRight: 6, color: 'var(--n-muted)' }}>Baris:</span>
                                <select
                                    value={pageSize}
                                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                    className="nl__adminPageSizeSelectElem"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            <div className="nl__adminPageBtns">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="nl__adminPageBtn"
                                    title="Sebelumnya"
                                >
                                    <ChevronLeft size={14} />
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => {
                                        if (totalPages <= 7) return true;
                                        if (page === 1 || page === totalPages) return true;
                                        if (Math.abs(page - currentPage) <= 1) return true;
                                        return false;
                                    })
                                    .reduce((acc: (number | string)[], page, idx, arr) => {
                                        if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                                            acc.push('...');
                                        }
                                        acc.push(page);
                                        return acc;
                                    }, [])
                                    .map((item, idx) => {
                                        if (item === '...') {
                                            return <span key={`dots-${idx}`} style={{ padding: '0 4px', fontSize: '0.75rem', color: 'var(--n-muted)' }}>...</span>;
                                        }
                                        return (
                                            <button
                                                key={`page-${item}`}
                                                onClick={() => setCurrentPage(Number(item))}
                                                className={`nl__adminPageBtn ${currentPage === item ? 'active' : ''}`}
                                            >
                                                {item}
                                            </button>
                                        );
                                    })
                                }

                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="nl__adminPageBtn"
                                    title="Selanjutnya"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Detail Penilaian */}
            {viewingTask && (
                <Modal
                    open={Boolean(viewingTask)}
                    size="lg"
                    variant="default"
                    onClose={() => { setViewingTask(null); setEditingId(null); }}
                    labelledBy="modal-detail-penilaian-title"
                >
                    <ModalHeader
                        id="modal-detail-penilaian-title"
                        icon={<FileText size={18} />}
                        title="Detail Penilaian Siswa"
                        subtitle={`${viewingTask.guru || 'Guru'} • ${viewingTask.mapel || '-'} • Kelas ${viewingTask.kelas} • Sem. ${viewingTask.semester === 1 ? 'Ganjil' : 'Genap'} (TA ${viewingTask.tahun_ajaran})`}
                        onClose={() => { setViewingTask(null); setEditingId(null); }}
                    />
                    <ModalBody>
                        <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <span style={{ fontWeight: 700, color: 'var(--n-ink)' }}>{viewingTask.materi_tp || '-'}</span>
                                {viewingTask.tagihan && (
                                    <span className="nl__adminTagCell" style={{ marginLeft: '8px' }}>{viewingTask.tagihan}</span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--n-muted)' }}>
                                Total Siswa: <strong>{viewingTask.students.length}</strong>
                            </div>
                        </div>
                        <div className="nl__adminTableScroll" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                            <table className="nl__adminTable">
                                <thead>
                                    <tr>
                                        <th>Siswa</th>
                                        <th>NISN</th>
                                        <th style={{ textAlign: 'center' }}>Nilai</th>
                                        <th>Catatan</th>
                                        <th>Update Terakhir</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewingTask.students.map(student => (
                                        <tr key={student.id}>
                                            <td><span className="nl__adminSiswaName">{student.nama_siswa}</span></td>
                                            <td><span className="nl__adminNisn">{student.nisn}</span></td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`nl__adminNilai ${student.nilai == null ? 'nl__nilai-empty' : student.nilai >= 80 ? 'nl__nilai-tinggi' : student.nilai >= 60 ? 'nl__nilai-sedang' : 'nl__nilai-rendah'}`}>
                                                    {student.nilai != null ? student.nilai : '-'}
                                                </span>
                                            </td>
                                            <td><span className="nl__adminCatatan">{student.catatan || '-'}</span></td>
                                            <td><span className="nl__adminDate">{formatDate(student.updated_at)}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ModalBody>
                    <ModalFooter align="between">
                        <Button
                            type="button"
                            variant="primary"
                            leftIcon={<ArrowLeftRight size={16} />}
                            onClick={() => {
                                const t = viewingTask;
                                setViewingTask(null);
                                handleOpenTransfer(t);
                            }}
                            title="Alihkan Pengampu Penilaian Ini"
                        >
                            Alihkan Pengampu
                        </Button>
                        <Button
                            type="button"
                            variant="cancel"
                            onClick={() => { setViewingTask(null); setEditingId(null); }}
                        >
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Modal Alihkan Pengampu */}
            {showTransferModal && (
                <Modal
                    open={showTransferModal}
                    size="md"
                    variant="edit"
                    onClose={() => !transferring && setShowTransferModal(false)}
                    labelledBy="modal-transfer-title"
                >
                    <ModalHeader
                        id="modal-transfer-title"
                        icon={<ArrowLeftRight size={18} />}
                        title="Alihkan Pengampu Nilai"
                        onClose={() => !transferring && setShowTransferModal(false)}
                    />
                    <ModalBody>
                        <div className="nl__transferForm" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                <ModalField label={<span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Tahun Ajaran</span>} required>
                                    <InlineSelect
                                        value={transferForm.tahun_ajaran}
                                        onChange={val => setTransferForm(prev => ({ ...prev, tahun_ajaran: val }))}
                                        options={availableTahunAjaran.map(ta => ({ value: ta, label: `TA ${ta}` }))}
                                    />
                                </ModalField>

                                <ModalField label={<span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Semester</span>} required>
                                    <InlineSelect
                                        value={transferForm.semester}
                                        onChange={val => setTransferForm(prev => ({ ...prev, semester: val }))}
                                        options={[
                                            { value: '1', label: 'Semester 1 (Ganjil)' },
                                            { value: '2', label: 'Semester 2 (Genap)' },
                                        ]}
                                    />
                                </ModalField>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                <ModalField label={<span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Kelas</span>} required>
                                    <InlineSelect
                                        value={transferForm.kelas}
                                        onChange={val => setTransferForm(prev => ({ ...prev, kelas: val }))}
                                        options={[
                                            { value: '', label: '-- Pilih Kelas --' },
                                            ...kelasList.map(k => ({ value: k, label: k })),
                                        ]}
                                    />
                                </ModalField>

                                <ModalField label={<span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Mata Pelajaran</span>} required>
                                    <InlineSelect
                                        value={transferForm.mapel}
                                        onChange={val => setTransferForm(prev => ({ ...prev, mapel: val }))}
                                        options={[
                                            { value: '', label: '-- Pilih Mata Pelajaran --' },
                                            ...mapelList.map(m => ({ value: m, label: m })),
                                        ]}
                                    />
                                </ModalField>
                            </div>

                            <ModalField
                                label={<span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Guru Asal</span>}
                                required
                            >
                                <InlineSelect
                                    value={transferForm.fromNip}
                                    onChange={val => setTransferForm(prev => ({ ...prev, fromNip: val }))}
                                    options={[
                                        { value: '', label: '-- Pilih Guru Asal --' },
                                        ...(allGuruList.length > 0 ? allGuruList : guruList).map((g: any) => ({
                                            value: String(g.nip),
                                            label: `${String(g.nama_lengkap || g.nip)} (${String(g.nip)})`,
                                        })),
                                    ]}
                                />
                            </ModalField>

                            <ModalField
                                label={<span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Guru Pengganti</span>}
                                required
                            >
                                <InlineSelect
                                    value={transferForm.toNip}
                                    onChange={val => setTransferForm(prev => ({ ...prev, toNip: val }))}
                                    options={[
                                        { value: '', label: '-- Pilih Guru Pengganti --' },
                                        ...(allGuruList.length > 0 ? allGuruList : guruList)
                                            .filter((g: any) => String(g.nip) !== transferForm.fromNip)
                                            .map((g: any) => ({
                                                value: String(g.nip),
                                                label: `${String(g.nama_lengkap || g.nip)} (${String(g.nip)})`,
                                            })),
                                    ]}
                                />
                            </ModalField>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            type="button"
                            variant="cancel"
                            onClick={() => setShowTransferModal(false)}
                            disabled={transferring}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            leftIcon={<ArrowLeftRight size={16} />}
                            onClick={handleExecuteTransfer}
                            isLoading={transferring}
                            disabled={!transferForm.fromNip || !transferForm.toNip || !transferForm.kelas || !transferForm.mapel || !transferForm.tahun_ajaran}
                        >
                            Alihkan Pengampu Sekarang
                        </Button>
                    </ModalFooter>
                </Modal>
            )}
        </div>
    );
}
