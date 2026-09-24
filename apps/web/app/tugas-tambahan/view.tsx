'use client';

import { useState, useEffect, useRef } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import DatePicker from '@/components/ui/DatePicker';
import { exportToExcel } from '@/lib/excel-utils';
import { getAcademicYearFromDate, getSemesterFromDate } from '@/lib/date-utils';
import ImportModal from '@/components/ui/ImportModal';
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import './tugas-tambahan.css';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useFileViewer } from '@/components/useFileViewer';

interface TugasTambahan {
    id: string;
    nip: string;
    nama_guru: string;
    jabatan: string;
    keterangan: string;
    tahun_ajaran: string;
    semester: number;
}

interface JurnalTugas {
    id: string;
    tugas_id: string;
    nip: string;
    nama_guru?: string;
    tanggal: string;
    kegiatan: string;
    hasil: string;
    foto_url?: string;
    tugas?: TugasTambahan;
}

function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Tahun ajaran & semester yang sedang berjalan.
 *
 * Dulu diambil dari `/api/settings/active-academic-year` — route yang tidak pernah
 * ada. Karena catch-all `app/(dashboard)/[...pageId]` menangkap path /api/ yang tak
 * dikenal dan membalasnya dengan HTML berstatus 200, `res.json()` melempar dan
 * `.catch()` menelannya: `activeSemester` diam-diam tetap null selamanya.
 *
 * Semester diturunkan dari tanggal, bukan dari DB, karena `master_tahun_ajaran.semester`
 * bertipe TEXT ('Ganjil'/'Genap') sedangkan `tugas_tambahan.semester` berupa angka 1/2.
 */
async function getPeriodeBerjalan(): Promise<{ tahun_ajaran: string; semester: number }> {
    const today = new Date();
    const semester = getSemesterFromDate(today);
    const tahunDariTanggal = getAcademicYearFromDate(today);

    try {
        const res = await fetch('/api/admin/tahun-ajaran', { cache: 'no-store' });
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
            // is_active bisa lebih dari satu baris (Ganjil + Genap, bahkan dua tahun
            // ajaran sekaligus di masa transisi), jadi jangan ambil satu baris saja.
            const aktif: string[] = Array.from(new Set(
                json.data.filter((t: any) => t.is_active).map((t: any) => String(t.tahun_ajaran))
            ));
            aktif.sort().reverse();
            if (aktif.length > 0) {
                return {
                    tahun_ajaran: aktif.includes(tahunDariTanggal) ? tahunDariTanggal : aktif[0],
                    semester,
                };
            }
        }
    } catch (e) {
        console.warn('Gagal memuat tahun ajaran aktif, memakai turunan tanggal:', e);
    }

    return { tahun_ajaran: tahunDariTanggal, semester };
}

export default function TugasTambahanPage() {
    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer();
    const [user, setUser] = useState<any>(null);
    const [myTugas, setMyTugas] = useState<TugasTambahan[]>([]);
    const [jurnalList, setJurnalList] = useState<JurnalTugas[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingJurnal, setEditingJurnal] = useState<JurnalTugas | null>(null);

    const [selectedTugasId, setSelectedTugasId] = useState<string>('');
    const [customTugasName, setCustomTugasName] = useState<string>('');

    const [showImport, setShowImport] = useState(false);
    const { openModal, closeModal } = useModalBlur();
    const [uploading, setUploading] = useState(false);
    const [uploadedFileUrl, setUploadedFileUrl] = useState('');
    const [dokumenText, setDokumenText] = useState('');
    const [tanggalValue, setTanggalValue] = useState(new Date().toISOString().split('T')[0]);
    const [filterTugas, setFilterTugas] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [showActionMenu, setShowActionMenu] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showActionMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setShowActionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionMenu]);

    const [allTugas, setAllTugas] = useState<TugasTambahan[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeSemester, setActiveSemester] = useState<number | null>(null);

    // Jabatan sama bisa punya 2 baris (semester Ganjil + Genap tahun ajaran aktif);
    // digabung jadi satu entri supaya chip/dropdown tidak dobel — filter mencakup semua id grup
    const tugasGroups = (() => {
        const map = new Map<string, { key: string; jabatan: string; items: TugasTambahan[] }>();
        for (const t of myTugas) {
            const key = (t.jabatan || '').trim().toLowerCase();
            const existing = map.get(key);
            if (existing) existing.items.push(t);
            else map.set(key, { key, jabatan: t.jabatan, items: [t] });
        }
        return Array.from(map.values());
    })();

    const activeGroup = tugasGroups.find(g => g.key === filterTugas);
    const filteredJurnalList = jurnalList.filter(j => {
        if (activeGroup && !activeGroup.items.some(t => t.id === j.tugas_id)) {
            return false;
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase().trim();
            const fields = [
                j.kegiatan,
                j.hasil,
                j.tanggal,
                formatDate(j.tanggal),
                j.tugas?.jabatan,
                j.foto_url
            ];
            if (!fields.some(f => String(f || '').toLowerCase().includes(q))) {
                return false;
            }
        }
        return true;
    });

    const pickGroupTugasId = (g: { items: TugasTambahan[] }) =>
        (g.items.find(t => Number(t.semester) === Number(activeSemester)) || g.items[0]).id;

    // Stats
    const totalReports = jurnalList.length;
    const thisMonth = jurnalList.filter(j => {
        const d = new Date(j.tanggal);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const uniqueTasks = [...new Set(jurnalList.map(j => (j.tugas?.jabatan || j.tugas_id || '').toString().trim().toLowerCase()))].length;

    useEffect(() => {
        const loadUser = async () => {
            const profile = await getCurrentUser();
            if (profile) {
                setUser(profile);
                const adminStatus = profile.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) || !!(profile as any).isAdmin;
                setIsAdmin(adminStatus);
                loadInitialData(profile.nip, adminStatus);
            }
        };
        loadUser();
    }, []);

    const loadInitialData = async (nip: string, adminMode: boolean) => {
        setLoading(true);
        try {
            const tugasRes = await fetch(`/api/tugas-tambahan?nip=${nip}`);
            const tugasData = await tugasRes.json();
            if (tugasData.ok) setMyTugas(tugasData.data);

            const jurnalRes = await fetch(`/api/tugas-tambahan/jurnal?nip=${nip}`);
            const jurnalData = await jurnalRes.json();
            if (jurnalData.ok) setJurnalList(jurnalData.data);

            const periode = await getPeriodeBerjalan();
            setActiveSemester(periode.semester);

            if (adminMode) {
                const allRes = await fetch('/api/tugas-tambahan');
                const allData = await allRes.json();
                if (allData.ok) setAllTugas(allData.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'laporan_tugas_tambahan');
            if (uploadedFileUrl) formData.append('old_file', uploadedFileUrl);

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok || !data.ok) throw new Error(data.error || 'Upload gagal');
            setUploadedFileUrl(data.publicUrl || data.url);
            setDokumenText(data.publicUrl || data.url);
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'File berhasil diupload', timer: 1500, showConfirmButton: false });
        } catch (error: any) {
            Swal.fire('Upload Gagal', error.message || 'Gagal upload', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleExport = () => {
        const data = jurnalList.map(j => ({
            Tanggal: j.tanggal,
            'Jabatan / Tugas': j.tugas?.jabatan || '-',
            Kegiatan: j.kegiatan,
            Hasil: j.hasil,
            'Foto Bukti': j.foto_url
        }));
        exportToExcel(data, `Laporan_Tugas_Tambahan_${user?.nama_lengkap || 'Export'}`);
    };

    const mapImportRow = (row: any) => {
        const jabatanName = (row['Jabatan'] || row['Jabatan / Tugas'] || row['Tugas'] || '').toLowerCase().trim();
        const tugas = myTugas.find(t => t.jabatan.toLowerCase().includes(jabatanName));
        if (!tugas) return null;
        return {
            tugas_id: tugas.id,
            nip: user.nip,
            tanggal: row['Tanggal'] ? new Date(row['Tanggal']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            kegiatan: row['Kegiatan'],
            hasil: row['Hasil'],
            foto_url: row['Foto Bukti'] || row['Foto URL'] || ''
        };
    };

    const handleSaveJurnal = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        let finalTugasId = selectedTugasId;

        try {
            // If custom task option selected or user entered custom task
            if (selectedTugasId === 'CUSTOM' || !selectedTugasId) {
                if (!customTugasName.trim()) {
                    Swal.fire('Peringatan', 'Silakan isi rincian/nama tugas tambahan kustom Anda', 'warning');
                    return;
                }
                const { tahun_ajaran: targetTA, semester: targetSem } = await getPeriodeBerjalan();

                const createTugasRes = await fetch('/api/tugas-tambahan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nip: user.nip,
                        nama_guru: user.nama_lengkap,
                        jabatan: customTugasName.trim(),
                        keterangan: 'Tugas Tambahan Kustom Guru',
                        tahun_ajaran: targetTA,
                        semester: targetSem
                    })
                });
                const createTugasData = await createTugasRes.json();
                if (!createTugasData.ok) {
                    throw new Error(createTugasData.error || 'Gagal menyimpan tugas tambahan kustom');
                }
                finalTugasId = createTugasData.data.id;
            }

            const data = {
                id: editingJurnal?.id,
                tugas_id: finalTugasId,
                nip: user.nip,
                tanggal: formData.get('tanggal'),
                kegiatan: formData.get('kegiatan'),
                hasil: formData.get('hasil'),
                foto_url: dokumenText || ''
            };

            const res = await fetch('/api/tugas-tambahan/jurnal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.ok) {
                Swal.fire('Berhasil', 'Laporan berhasil disimpan', 'success');
                handleCloseModal();
                setEditingJurnal(null);
                setUploadedFileUrl('');
                setDokumenText('');
                loadInitialData(user.nip, isAdmin);
            } else {
                throw new Error(result.error || 'Gagal menyimpan');
            }
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Gagal menyimpan laporan', 'error');
        }
    };

    const handleDeleteJurnal = async (id: string) => {
        const confirm = await Swal.fire({
            title: 'Hapus Laporan?',
            text: 'Data yang dihapus tidak bisa dikembalikan',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444'
        });
        if (confirm.isConfirmed) {
            await fetch(`/api/tugas-tambahan/jurnal?id=${id}`, { method: 'DELETE' });
            loadInitialData(user.nip, isAdmin);
        }
    };

    const openCreate = () => {
        setEditingJurnal(null);
        setSelectedTugasId(tugasGroups.length > 0 ? pickGroupTugasId(tugasGroups[0]) : 'CUSTOM');
        setCustomTugasName('');
        setUploadedFileUrl('');
        setDokumenText('');
        setTanggalValue(new Date().toISOString().split('T')[0]);
        openModal();
        setShowForm(true);
    };

    const openEdit = (j: JurnalTugas) => {
        setEditingJurnal(j);
        setSelectedTugasId(j.tugas_id || 'CUSTOM');
        setCustomTugasName(j.tugas?.jabatan || '');
        setUploadedFileUrl(j.foto_url || '');
        setDokumenText(j.foto_url || '');
        setTanggalValue(j.tanggal || new Date().toISOString().split('T')[0]);
        openModal();
        setShowForm(true);
    };

    const handleCloseModal = () => {
        closeModal();
        setShowForm(false);
    };

    const currentTaskName = activeGroup?.jabatan || null;

    return (
        <>
            <MaintenanceBanner pageKey="maintenance_tugas_tambahan">
                <div className="tt-page">

                    {/* ── PAGE BANNER (Standard Header) ── */}
                    

                    {/* ── STATS ROW ── */}
                    <div className="tt-stats mt-4">
                        <div className="tt-stat-card">
                            <div className="tt-stat-icon blue">
                                <i className="bi bi-journal-text"></i>
                            </div>
                            <div className="tt-stat-info">
                                <span className="tt-stat-value">{totalReports}</span>
                                <span className="tt-stat-label">Total Laporan</span>
                            </div>
                        </div>
                        <div className="tt-stat-card">
                            <div className="tt-stat-icon green">
                                <i className="bi bi-calendar-check"></i>
                            </div>
                            <div className="tt-stat-info">
                                <span className="tt-stat-value">{thisMonth}</span>
                                <span className="tt-stat-label">Bulan Ini</span>
                            </div>
                        </div>
                        <div className="tt-stat-card">
                            <div className="tt-stat-icon amber">
                                <i className="bi bi-briefcase"></i>
                            </div>
                            <div className="tt-stat-info">
                                <span className="tt-stat-value">{tugasGroups.length}</span>
                                <span className="tt-stat-label">Tugas Aktif</span>
                            </div>
                        </div>
                        <div className="tt-stat-card">
                            <div className="tt-stat-icon cyan">
                                <i className="bi bi-layers"></i>
                            </div>
                            <div className="tt-stat-info">
                                <span className="tt-stat-value">{uniqueTasks}</span>
                                <span className="tt-stat-label">Jenis Tugas</span>
                            </div>
                        </div>
                    </div>

                    {/* ── FILTER TOOLBAR (Standard Filter & Action Bar) ── */}
                    <FilterToolbar className="my-4" actionsInline={true}>
                        <FilterSearch
                            label="Pencarian"
                            placeholder="Cari kegiatan, hasil, tanggal, atau tugas..."
                            value={searchTerm}
                            onChange={setSearchTerm}
                            grow={2}
                        />
                        {myTugas.length > 0 && (
                            <FilterSelect
                                label="Filter Tugas Tambahan"
                                icon="briefcase"
                                value={filterTugas}
                                onChange={setFilterTugas}
                                options={[
                                    { value: '', label: `Semua Tugas (${tugasGroups.length})` },
                                    ...tugasGroups.map(g => ({ value: g.key, label: g.jabatan }))
                                ]}
                                grow={1}
                            />
                        )}
                        <FilterActions>
                            {/* Menu titik 3 — HANYA tampil di mobile */}
                            <div className="sk__menuWrap" ref={actionMenuRef}>
                                <button
                                    type="button"
                                    className={`sk__btnActionMenu ftb-btn--iconOnlyMobile ${showActionMenu ? 'isOpen' : ''}`}
                                    onClick={() => setShowActionMenu(v => !v)}
                                    title="Menu Aksi"
                                    aria-label="Menu Aksi"
                                    aria-haspopup="menu"
                                    aria-expanded={showActionMenu}
                                    style={{ position: 'relative', width: '42px', height: '42px', borderRadius: '50%', padding: 0 }}
                                >
                                    <i className="bi bi-three-dots" />
                                    <span className="ftb-btn-label">Aksi</span>
                                </button>

                                {showActionMenu && (
                                    <div className="sk__menu" role="menu">
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem"
                                            onClick={() => {
                                                setShowActionMenu(false);
                                                openModal();
                                                setShowImport(true);
                                            }}
                                        >
                                            <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel-fill" style={{ color: '#f97316' }} /></span>
                                            <span className="sk__menuLabel">Import</span>
                                        </button>

                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem"
                                            onClick={() => {
                                                setShowActionMenu(false);
                                                handleExport();
                                            }}
                                        >
                                            <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#3b82f6' }} /></span>
                                            <span className="sk__menuLabel">Export</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="outline"
                                size="md"
                                icon="import"
                                onClick={() => { openModal(); setShowImport(true); }}
                                className="sk__btnDesktopOnly"
                            >
                                Import
                            </Button>
                            <Button
                                variant="outline"
                                size="md"
                                icon="export"
                                onClick={handleExport}
                                className="sk__btnDesktopOnly"
                            >
                                Export
                            </Button>
                        </FilterActions>
                    </FilterToolbar>

                    {/* Aksi utama halaman: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
                    <DesktopFab label="Buat Laporan Baru" icon="plus-lg" mobileLabel="Laporan Baru" onClick={openCreate} />

                    {/* ── MAIN CONTENT — Full Table ── */}
                    <div className="tt-content">
                        <div className="tt-content-header">
                            <h3>
                                <i className="bi bi-table"></i>
                                {currentTaskName
                                    ? `Riwayat: ${currentTaskName}`
                                    : 'Semua Riwayat Kegiatan'}
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--n-muted)', fontWeight: 600 }}>
                                {filteredJurnalList.length} data
                            </span>
                        </div>

                        {loading ? (
                            <div className="tt-empty py-12 flex flex-col items-center justify-center gap-3">
                                <Spinner size={36} label="Memuat data..." />
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Memuat data laporan tugas tambahan...</span>
                            </div>
                        ) : filteredJurnalList.length === 0 ? (
                            <div className="tt-empty">
                                <div className="tt-empty-icon">
                                    <i className="bi bi-journal-x"></i>
                                </div>
                                <h4>Belum ada riwayat</h4>
                            </div>
                        ) : (
                            <div className="tt-table-wrap">
                                <table className="tt-table">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Tugas</th>
                                            <th>Kegiatan</th>
                                            <th>Hasil</th>
                                            <th>Dokumen</th>
                                            <th style={{ textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredJurnalList.map((j) => (
                                            <tr key={j.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            borderRadius: '10px',
                                                            background: 'rgba(99,102,241,0.06)',
                                                            color: 'var(--tt-primary)',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 800,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}>
                                                            <span style={{ lineHeight: 1 }}>{new Date(j.tanggal).getDate()}</span>
                                                            <span style={{ lineHeight: 1, fontSize: '0.55rem', color: '#60a5fa' }}>
                                                                {new Date(j.tanggal).toLocaleDateString('id-ID', { month: 'short' }).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                            {formatDate(j.tanggal)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge-tt">
                                                        <i className="bi bi-briefcase"></i>
                                                        {j.tugas?.jabatan || '-'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600, color: 'var(--n-text)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                                                        {j.kegiatan}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ color: 'var(--n-muted)', fontSize: '0.82rem', lineHeight: 1.5, maxWidth: '200px' }}>
                                                        {j.hasil || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Tidak ada hasil</span>}
                                                    </div>
                                                </td>
                                                <td>
                                                    {(j.foto_url && (j.foto_url.startsWith('http') || j.foto_url.startsWith('/'))) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openFile(j.foto_url, `Dokumen — ${j.kegiatan || ''}`)}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                padding: '5px 10px',
                                                                borderRadius: '8px',
                                                                background: 'rgba(6,182,212,0.08)',
                                                                color: '#0891b2',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                textDecoration: 'none',
                                                                transition: 'all 0.2s',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            <i className="bi bi-paperclip"></i> Dokumen
                                                        </button>
                                                    ) : j.foto_url ? (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', maxWidth: '120px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {j.foto_url}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic' }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <ActionGroup>
                                                        <ActionButton action="edit" onClick={() => openEdit(j)} title="Edit Laporan" />
                                                        <ActionButton action="delete" onClick={() => handleDeleteJurnal(j.id)} title="Hapus Laporan" />
                                                    </ActionGroup>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── MODAL FORM (Standard Component Modal) ── */}
                    <Modal
                        open={showForm}
                        onClose={handleCloseModal}
                        title={editingJurnal ? 'Edit Laporan' : 'Laporan Baru'}
                        subtitle="Dokumentasi kegiatan tugas tambahan"
                        icon={editingJurnal ? 'pencil-square' : 'plus-circle-dotted'}
                        size="lg"
                        variant={editingJurnal ? 'edit' : 'add'}
                    >
                        <form onSubmit={handleSaveJurnal}>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="tt-form-group">
                                        <label className="tt-form-label">
                                            <i className="bi bi-briefcase"></i> Tugas Tambahan
                                        </label>
                                        <select
                                            name="tugas_id"
                                            className="tt-form-select"
                                            value={selectedTugasId}
                                            onChange={e => setSelectedTugasId(e.target.value)}
                                            required
                                        >
                                            <option value="">-- Pilih Tugas --</option>
                                            {tugasGroups.map(g => {
                                                const value = editingJurnal && g.items.some(t => t.id === editingJurnal.tugas_id)
                                                    ? editingJurnal.tugas_id
                                                    : pickGroupTugasId(g);
                                                return <option key={g.key} value={value}>{g.jabatan}</option>;
                                            })}
                                            <option value="CUSTOM">+ Tambah Tugas Kustom / Lainnya...</option>
                                        </select>
                                    </div>
                                    <div className="tt-form-group">
                                        <label className="tt-form-label">
                                            <i className="bi bi-calendar-event"></i> Tanggal
                                        </label>
                                        <DatePicker
                                            name="tanggal"
                                            className="tt-form-input"
                                            value={tanggalValue}
                                            onChange={setTanggalValue}
                                            required
                                        />
                                    </div>
                                </div>

                                {selectedTugasId === 'CUSTOM' && (
                                    <div className="tt-form-group mt-3" style={{ background: 'rgba(99,102,241,0.05)', padding: '14px 16px', borderRadius: '12px', border: '1px dashed rgba(99,102,241,0.25)' }}>
                                        <label className="tt-form-label" style={{ color: '#3083FF' }}>
                                            <i className="bi bi-pencil-fill"></i> Rincian / Nama Tugas Tambahan Kustom
                                        </label>
                                        <input
                                            type="text"
                                            className="tt-form-input"
                                            value={customTugasName}
                                            onChange={e => setCustomTugasName(e.target.value)}
                                            placeholder="Contoh: Pembina Pramuka, Panitia Ujian, Koordinator..."
                                            required={selectedTugasId === 'CUSTOM'}
                                        />
                                    </div>
                                )}

                                <div className="tt-form-group mt-3">
                                    <label className="tt-form-label">
                                        <i className="bi bi-activity"></i> Kegiatan / Aktivitas
                                    </label>
                                    <textarea
                                        name="kegiatan"
                                        className="tt-form-textarea"
                                        defaultValue={editingJurnal?.kegiatan}
                                        placeholder="Jelaskan detail kegiatan yang dilakukan..."
                                        required
                                    />
                                </div>

                                <div className="tt-form-group">
                                    <label className="tt-form-label">
                                        <i className="bi bi-check-circle"></i> Hasil / Output
                                    </label>
                                    <textarea
                                        name="hasil"
                                        className="tt-form-textarea"
                                        defaultValue={editingJurnal?.hasil}
                                        placeholder="Hasil kegiatan atau tindak lanjut..."
                                        style={{ minHeight: '80px' }}
                                    />
                                </div>

                                <div style={{ paddingTop: '8px', borderTop: '1px solid var(--tt-border)' }}>
                                    <label className="tt-form-label">
                                        <i className="bi bi-paperclip"></i> Bukti Dokumen
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            className="tt-form-input"
                                            style={{ flex: 1 }}
                                            value={dokumenText}
                                            onChange={e => setDokumenText(e.target.value)}
                                            placeholder="Paste Link Google Drive, PDF, atau ketik keterangan..."
                                        />
                                        <div className="relative">
                                            <input
                                                type="file"
                                                id="fileUpload"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                accept="image/*,application/pdf"
                                            />
                                            <label
                                                htmlFor="fileUpload"
                                                className="tt-file-upload-btn"
                                                style={{
                                                    opacity: uploading ? 0.6 : 1,
                                                    pointerEvents: uploading ? 'none' : 'auto',
                                                }}
                                                title="Upload File"
                                            >
                                                {uploading
                                                    ? <i className="bi bi-arrow-repeat animate-spin"></i>
                                                    : <i className="bi bi-cloud-upload"></i>}
                                            </label>
                                        </div>
                                    </div>
                                    <p className="tt-form-hint">
                                        *Ketik teks, paste link, atau upload file (otomatis menjadi link)
                                    </p>
                                </div>
                            </ModalBody>
                            <ModalFooter align="end">
                                <Button variant="cancel" type="button" onClick={handleCloseModal}>
                                    Batal
                                </Button>
                                <Button variant="primary" icon="save" type="submit" disabled={uploading}>
                                    {uploading ? 'Mengupload...' : 'Simpan Laporan'}
                                </Button>
                            </ModalFooter>
                        </form>
                    </Modal>

                    <ImportModal
                        isOpen={showImport}
                        onClose={() => { closeModal(); setShowImport(false); }}
                        onImportSuccess={() => {
                            loadInitialData(user.nip, isAdmin);
                            closeModal();
                            setShowImport(false);
                        }}
                        mapRowData={mapImportRow}
                        templateColumns={['Tanggal', 'Jabatan', 'Kegiatan', 'Hasil', 'Foto URL']}
                        templateName="Template_Laporan_Tugas"
                        apiEndpoint="/api/tugas-tambahan/jurnal"
                    />
                </div>
            </MaintenanceBanner>

            {viewer}
        </>
    );
}
