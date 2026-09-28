'use client';

import { usePengaturanTugasAccess } from '@/lib/use-pengaturan-tugas-access'
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import Swal from 'sweetalert2';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import Button from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import DesktopFab from '@/components/ui/DesktopFab';

interface PlotingTugasTambahanTabProps {
    user?: any
}

interface Guru {
    nip: string;
    nama_lengkap: string;
}

interface TugasTambahan {
    id: string;
    nip: string;
    nama_guru: string;
    jabatan: string;
    keterangan: string;
    tahun_ajaran: string;
    semester: number;
    approver_role?: string;
}

const APPROVER_OPTIONS = [
    { value: 'WKM_AKADEMIK', label: 'WKM Akademik' },
    { value: 'WKM_KESISWAAN', label: 'WKM Kesiswaan' },
    { value: 'SEMUA_WKM', label: 'Semua WKM' },
    { value: 'KEPALA_MADRASAH', label: 'Kepala Madrasah (langsung, tanpa WKM)' },
];

const APPROVER_LABELS: Record<string, string> = {
    WKM_AKADEMIK: 'WKM Akademik',
    WKM_KESISWAAN: 'WKM Kesiswaan',
    SEMUA_WKM: 'Semua WKM',
    KEPALA_MADRASAH: 'Kepala Madrasah',
};

function approverBadgeVariant(role?: string) {
    if (role === 'WKM_KESISWAAN') return 'kesiswaan';
    if (role === 'WKM_AKADEMIK') return 'akademik';
    if (role === 'KEPALA_MADRASAH') return 'kamad';
    return 'semua';
}

// Jabatan hasil sinkronisasi otomatis (Wali Kelas / Pembina Ekskul) approver-nya paten.
function lockedApprover(jabatan: string): string | null {
    if (/^wali kelas/i.test(jabatan)) return 'WKM_AKADEMIK';
    if (/^pembina ekstrakurikuler/i.test(jabatan)) return 'WKM_KESISWAAN';
    return null;
}

// Preset jabatan umum agar dropdown tidak kosong saat belum ada penugasan manual.
const PRESET_JABATAN = [
    'Kepala Laboratorium',
    'Kepala Perpustakaan',
    'Pembina OSIM',
    'Pembina Pramuka',
    'Koordinator BK',
    'Operator',
];

const customSelectStyles = {
    control: (base: any) => ({
        ...base,
        borderRadius: '10px',
        border: '1.8px solid var(--select-border, #e2e8f0)',
        padding: '2px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--select-text, var(--n-text))',
        background: 'var(--select-bg, #f8fafc)',
        boxShadow: 'none',
        '&:hover': { borderColor: '#3b82f6' },
        '&:focus-within': { borderColor: '#3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,0.15)' }
    }),
    menu: (base: any) => ({
        ...base,
        borderRadius: '10px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
        zIndex: 9999,
        background: 'var(--select-menu-bg, #ffffff)',
        border: '1px solid var(--select-border, #e2e8f0)'
    }),
    menuList: (base: any) => ({ ...base, padding: '4px' }),
    option: (base: any, state: any) => ({
        ...base,
        fontSize: '0.85rem',
        fontWeight: 500,
        padding: '8px 12px',
        borderRadius: '6px',
        color: state.isSelected ? '#ffffff' : 'var(--select-text, var(--n-text))',
        background: state.isSelected ? '#1d6bf3' : state.isFocused ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
        cursor: 'pointer'
    }),
    singleValue: (base: any) => ({ ...base, fontWeight: 600, color: 'var(--select-text, var(--n-text))' }),
    input: (base: any) => ({ ...base, color: 'var(--select-text, var(--n-text))' }),
    placeholder: (base: any) => ({ ...base, fontWeight: 500, color: 'var(--n-muted)' }),
};


const customSelectDarkStyles = {
    control: (base: any) => ({
        ...base,
        borderRadius: '10px',
        border: '1.5px solid rgba(255,255,255,0.1)',
        padding: '2px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#e8edf5',
        background: 'rgba(255,255,255,0.04)',
        boxShadow: 'none',
        '&:hover': { borderColor: 'rgba(79,142,247,0.6)' },
        '&:focus-within': { borderColor: 'var(--n-primary)', boxShadow: '0 0 0 3px rgba(79,142,247,0.15)' }
    }),
    menu: (base: any) => ({ ...base, borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)', zIndex: 9999, background: '#1a2035' }),
    menuList: (base: any) => ({ ...base, padding: '4px' }),
    option: (base: any) => ({ ...base, fontSize: '0.85rem', fontWeight: 500, padding: '8px 12px', borderRadius: '6px', color: '#e8edf5', background: 'transparent' }),
    singleValue: (base: any) => ({ ...base, fontWeight: 600, color: '#e8edf5' }),
    placeholder: (base: any) => ({ ...base, fontWeight: 500, color: 'var(--n-muted)' }),
};

function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getAvatarColor(name: string) {
    const colors = [
        ['#dbeafe', '#1d4ed8'], ['#fce7f3', '#be185d'], ['#d1fae5', '#065f46'],
        ['#fef3c7', '#92400e'], ['#eff6ff', '#00287a'], ['#ffedd5', '#9a3412'],
        ['#cffafe', '#0e7490'], ['#eff6ff', '#1e40af']
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanTugasAccess(), bukan dari objek user. Propnya tetap diterima agar
// pemanggil (view.tsx) tidak perlu diubah.
export default function PlotingTugasTambahanTab(_props: PlotingTugasTambahanTabProps) {
    /**
     * Wewenang dari server (Hak Akses Fitur per tab), bukan dari objek user.
     * `user?.role === 'ADMIN'` adalah perbandingan string UTUH, sedangkan ketiga
     * akun admin di basis data ini berrole gabungan (`ADMIN,GURU`, dst).
     */
    const { boleh } = usePengaturanTugasAccess()
    const bolehKelola = boleh('ploting_tugas')

    const canCreate = bolehKelola;
    const canUpdate = bolehKelola;
    const canDelete = bolehKelola;

    const [tugasList, setTugasList] = useState<TugasTambahan[]>([]);
    const [guruOptions, setGuruOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTugas, setEditingTugas] = useState<TugasTambahan | null>(null);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
    const [deleteItemData, setDeleteItemData] = useState<TugasTambahan | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);

    const [selectedGuru, setSelectedGuru] = useState<any>(null);
    const [selectedJabatan, setSelectedJabatan] = useState<any>(null);
    const [tahunAjaran, setTahunAjaran] = useState('2025/2026');
    const [semester, setSemester] = useState(2);
    const [searchQuery, setSearchQuery] = useState('');
    // Semester khusus form modal, terpisah dari filter; 0 = 'Semua' → simpan 2 baris (Ganjil & Genap)
    const [formSemester, setFormSemester] = useState(1);
    const [tahunOptions, setTahunOptions] = useState<string[]>([]);
    const [keterangan, setKeterangan] = useState('');
    const [approverRole, setApproverRole] = useState('SEMUA_WKM');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // approver terkunci jika jabatan hasil sinkronisasi otomatis
    const lockedRole = useMemo(
        () => (selectedJabatan ? lockedApprover(selectedJabatan.value) : null),
        [selectedJabatan]
    );
    const effectiveApprover = lockedRole ?? approverRole;

    const { registerModal } = useModalBlur()

    useEffect(() => {
        if (showModal || deleteItemId !== null) return registerModal()
    }, [showModal, deleteItemId, registerModal])

    // Opsi jabatan dibangun dari penugasan manual yang sudah ada + preset umum.
    // Jabatan otomatis (Wali Kelas / Pembina Ekskul) tidak boleh dibuat manual di sini.
    const jabatanOptions = useMemo(() => {
        const fromData = tugasList
            .map(t => t.jabatan)
            .filter(j => typeof j === 'string' && !lockedApprover(j));
        const uniqueNames = Array.from(new Set([...PRESET_JABATAN, ...fromData]));
        return uniqueNames.map(name => ({ value: name, label: name }));
    }, [tugasList]);

    const filteredList = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return tugasList.filter(t => {
            const matchTA = t.tahun_ajaran === tahunAjaran;
            const tSem = Number(t.semester);
            const matchSem = semester === 0 ? true : (tSem === semester || tSem === 0);
            const matchSearch = query ? 
                (t.nama_guru?.toLowerCase().includes(query) || t.jabatan?.toLowerCase().includes(query)) 
                : true;
            return matchTA && matchSem && matchSearch;
        });
    }, [tugasList, tahunAjaran, semester, searchQuery]);

    // Dikelompokkan per jabatan, grup terurut alfabetis, anggota terurut alfabetis by nama.
    const groupedByJabatan = useMemo(() => {
        const groups: Record<string, TugasTambahan[]> = {};
        filteredList.forEach(t => {
            if (!groups[t.jabatan]) groups[t.jabatan] = [];
            groups[t.jabatan].push(t);
        });
        const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true });
        return Object.keys(groups)
            .sort((a, b) => collator.compare(a, b))
            .map(jabatan => ({
                jabatan,
                items: groups[jabatan].sort((a, b) => collator.compare(a.nama_guru || '', b.nama_guru || '')),
            }));
    }, [filteredList]);

    const stats = useMemo(() => ({
        total: filteredList.length,
        uniqueJabatan: groupedByJabatan.length,
    }), [filteredList, groupedByJabatan]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tugasRes, guruRes, tahunRes] = await Promise.all([
                fetch('/api/tugas-tambahan'),
                fetch('/api/master/guru?limit=500'),
                fetch('/api/admin/tahun-ajaran')
            ]);
            const tugasData = await tugasRes.json();
            const guruData = await guruRes.json();
            const tahunData = await tahunRes.json();

            if (tahunData.ok && tahunData.data) {
                const activeTahun = tahunData.data.filter((t: any) => t.is_active);
                const uniqueYears = Array.from(new Set(activeTahun.map((t: any) => t.tahun_ajaran))) as string[];
                setTahunOptions(uniqueYears.sort((a, b) => b.localeCompare(a)));
                const active = activeTahun.length > 0 ? activeTahun[0] : tahunData.data.find((t: any) => t.is_active);
                if (active) {
                    setTahunAjaran(active.tahun_ajaran);
                }
            }

            if (tugasData.ok) setTugasList(tugasData.data);
            if (guruData.ok) {
                setGuruOptions(guruData.data.map((g: any) => ({
                    value: g.nip,
                    label: `${g.nama_lengkap} (${g.nip})`,
                    nama: g.nama_lengkap
                })));
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingTugas ? !canUpdate : !canCreate) return;
        if (!selectedGuru || !selectedJabatan) {
            Swal.fire('Error', 'Guru dan Jabatan wajib dipilih', 'error');
            return;
        }
        // 'Semua' (0, hanya mode tambah) = simpan untuk semester Ganjil DAN Genap
        const targetSemesters = !editingTugas && formSemester === 0 ? [1, 2] : [formSemester];
        try {
            const results = await Promise.all(targetSemesters.map((sem) => {
                const payload = {
                    nip: selectedGuru.value,
                    nama_guru: selectedGuru.nama,
                    jabatan: selectedJabatan.value,
                    keterangan,
                    tahun_ajaran: tahunAjaran,
                    semester: sem,
                    approver_role: effectiveApprover,
                    id: editingTugas?.id
                };
                return fetch('/api/tugas-tambahan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Gagal terhubung ke server' }));
            }));

            const failed = results.filter((r) => !r.ok);
            if (failed.length > 0) {
                throw new Error(failed.map((f) => f.error).filter(Boolean).join(', ') || 'Gagal menyimpan sebagian data');
            }
            Swal.fire('Berhasil', targetSemesters.length > 1
                ? '2 penugasan tersimpan (semester Ganjil & Genap)'
                : 'Penugasan berhasil disimpan', 'success');
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error: any) {
            Swal.fire('Error', 'Gagal menyimpan penugasan: ' + error.message, 'error');
        }
    };

    const confirmDelete = async () => {
        if (!deleteItemId) return;
        setDeleting(true);
        try {
            await fetch(`/api/tugas-tambahan?id=${deleteItemId}`, { method: 'DELETE' });
            Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data berhasil dihapus.', timer: 1500, showConfirmButton: false });
            setDeleteItemId(null);
            setDeleteItemData(null);
            setShowDeleteConfirm(false);
            loadData();
        } catch {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat menghubungi server.' });
        } finally {
            setDeleting(false);
        }
    };

    const resetForm = () => {
        setEditingTugas(null);
        setSelectedGuru(null);
        setSelectedJabatan(null);
        setKeterangan('');
        setApproverRole('SEMUA_WKM');
        setFormSemester(semester); // ikuti filter (0 = Semua)
    };

    const openEdit = (tugas: TugasTambahan) => {
        if (!bolehKelola) return;
        setEditingTugas(tugas);
        setSelectedGuru(guruOptions.find(o => o.value === tugas.nip));
        setTahunAjaran(tugas.tahun_ajaran);
        let sem: number | string = tugas.semester;
        if (typeof sem === 'string') {
            if (sem === 'Ganjil') sem = 1;
            else if (sem === 'Genap') sem = 2;
            else sem = Number(sem);
        }
        setSemester(sem as number);
        setFormSemester(sem as number);
        setSelectedJabatan({ value: tugas.jabatan, label: tugas.jabatan });
        setKeterangan(tugas.keterangan);
        setApproverRole(tugas.approver_role || 'SEMUA_WKM');
        setShowModal(true);
    };

    const openDelete = (tugas: TugasTambahan) => {
        if (!bolehKelola) return;
        setDeleteItemId(tugas.id);
        setDeleteItemData(tugas);
        setShowDeleteConfirm(true);
    };

    const isDark = false; // will be handled via CSS class

    const sortedList = useMemo(() => {
        return groupedByJabatan.flatMap(g => g.items);
    }, [groupedByJabatan]);

    return (
        <div className="ptt-root">


            {/* ===== STATS CARDS ===== */}
            <div className="ptt-stats">
                <div className="ptt-stat">
                    <div className="ptt-stat__icon ptt-stat__icon--blue">
                        <i className="bi bi-people-fill"></i>
                    </div>
                    <div className="ptt-stat__body">
                        <div className="ptt-stat__value">{stats.total}</div>
                        <div className="ptt-stat__label">Total Penugasan</div>
                    </div>
                </div>
                <div className="ptt-stat">
                    <div className="ptt-stat__icon ptt-stat__icon--blue">
                        <i className="bi bi-award-fill"></i>
                    </div>
                    <div className="ptt-stat__body">
                        <div className="ptt-stat__value">{stats.uniqueJabatan}</div>
                        <div className="ptt-stat__label">Jenis Jabatan</div>
                    </div>
                </div>
                <div className="ptt-stat ptt-stat--period">
                    <div className="ptt-stat__icon ptt-stat__icon--blue">
                        <i className="bi bi-calendar-event-fill"></i>
                    </div>

                    <div className="ptt-stat__body">
                        <div className="ptt-stat__value">{tahunAjaran}</div>
                        <div className="ptt-stat__label">{semester === 0 ? 'Semua Semester' : `Semester ${semester}`}</div>
                    </div>
                </div>
            </div>

            {/* ===== FILTER BAR ===== */}
            <FilterToolbar>
                <FilterSelect
                    label="Tahun Ajaran"
                    value={tahunAjaran}
                    onChange={val => setTahunAjaran(val)}
                >
                    {(tahunOptions.length > 0 ? tahunOptions : [tahunAjaran]).map(ta => (
                        <option key={ta} value={ta}>{ta}</option>
                    ))}
                </FilterSelect>
                <FilterSelect
                    label="Semester"
                    value={semester.toString()}
                    onChange={val => setSemester(Number(val))}
                >
                    <option value={0}>Semua Semester</option>
                    <option value={1}>Ganjil (1)</option>
                    <option value={2}>Genap (2)</option>
                </FilterSelect>
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari guru atau tugas..."
                />
            </FilterToolbar>

            {bolehKelola && (
                <DesktopFab
                    label="Tambah Penugasan"
                    icon="plus-lg"
                    onClick={() => { resetForm(); setShowModal(true); }}
                />
            )}

            {/* ===== CONTENT AREA ===== */}
            <div className="ptt-content">
                {loading ? (
                    <div className="ptt-empty">
                        <Spinner variant="buble" />
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="ptt-empty">
                        <div className="ptt-empty__icon">
                            <i className="bi bi-clipboard-x"></i>
                        </div>
                        <div className="ptt-empty__title">Belum ada penugasan</div>
                        <div className="ptt-empty__sub">Tambahkan penugasan guru untuk semester ini.</div>
                        {bolehKelola && (
                            <Button variant="primary" icon="add" onClick={() => { resetForm(); setShowModal(true); }}>
                                Tambah Penugasan
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop: satu tabel, satu header; flat list */}
                        <div className="ptt-tableWrap">
                            <table className="ptt-table">
                                <thead>
                                    <tr>
                                        <th className="ptt-col-no">No</th>
                                        <th>Guru</th>
                                        <th>Jabatan</th>
                                        <th className="ptt-col-appr">Disetujui Oleh</th>
                                        <th>Keterangan</th>
                                        {bolehKelola && <th className="ptt-col-aksi">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedList.map((t, idx) => {
                                        const [bg, fg] = getAvatarColor(t.nama_guru);
                                        return (
                                            <tr key={t.id}>
                                                <td className="ptt-td-center">{idx + 1}</td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                        <span className="ptt-guruCell__name" style={{ lineHeight: 1 }}>{t.nama_guru}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--n-muted)', fontFamily: 'monospace' }}>NIP: {t.nip}</span>
                                                    </div>
                                                </td>
                                                <td><span className="ptt-badge ptt-badge--jabatan">{t.jabatan}</span></td>
                                                <td>
                                                    <span className={`ptt-approver-badge ptt-approver-badge--${approverBadgeVariant(t.approver_role)}`}>
                                                        {APPROVER_LABELS[t.approver_role || 'SEMUA_WKM']}
                                                    </span>
                                                </td>
                                                <td className="ptt-ketCell">{t.keterangan || '—'}</td>
                                                {bolehKelola && (
                                                    <td>
                                                        <ActionGroup>
                                                            <ActionButton action="edit" onClick={() => openEdit(t)} />
                                                            <ActionButton action="delete" onClick={() => openDelete(t)} />
                                                        </ActionGroup>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: kartu berkelompok */}
                        <div className="ptt-mobileGroups">
                            {groupedByJabatan.map(({ jabatan, items }) => (
                                <div key={jabatan} className="ptt-group">
                                    <div className="ptt-group__header">
                                        <div className="ptt-group__badge">
                                            <i className="bi bi-award"></i>
                                            {jabatan}
                                        </div>
                                        <span className="ptt-group__count">{items.length} orang</span>
                                    </div>
                                    <div className="ptt-group__list">
                                        {items.map(t => {
                                            return (
                                                <div key={t.id} className="ptt-card">
                                                    <div className="ptt-card__body">
                                                        <div className="ptt-card__name">{t.nama_guru}</div>
                                                        <div className="ptt-card__meta">
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--n-muted)', fontFamily: 'monospace' }}>NIP: {t.nip}</span>
                                                            <span className="ptt-card__dot">•</span>
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--n-muted)' }}>
                                                                Disetujui: <span style={{fontWeight: 600}}>{APPROVER_LABELS[t.approver_role || 'SEMUA_WKM']}</span>
                                                            </span>
                                                            {t.keterangan && (
                                                                <>
                                                                    <span className="ptt-card__dot">•</span>
                                                                    <span className="ptt-card__note">{t.keterangan}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {bolehKelola && (
                                                        <ActionGroup>
                                                            <ActionButton action="edit" onClick={() => openEdit(t)} />
                                                            <ActionButton action="delete" onClick={() => openDelete(t)} />
                                                        </ActionGroup>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ===== DELETE CONFIRMATION SHEET ===== */}
            {showDeleteConfirm && deleteItemData && (
                <Modal size="sm" variant="delete" onClose={() => { setShowDeleteConfirm(false); setDeleteItemId(null); }} labelledBy="modal-ptt-del">
                    <ModalHeader
                        id="modal-ptt-del"
                        title={deleteItemData.nama_guru}
                        icon="trash3"
                        onClose={() => { setShowDeleteConfirm(false); setDeleteItemId(null); }}
                    />
                    <ModalFooter>
                            <Button variant="cancel" type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteItemId(null); }} leftIcon={<i className="bi bi-x-lg" />}>
                            Batal
                        </Button>
                            <Button variant="danger" type="button" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>
                            {deleting ? null : 'Ya, Hapus'}
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* ===== FORM MODAL ===== */}
            {showModal && (
                <Modal size="lg" variant={editingTugas ? "edit" : "add"} onClose={() => setShowModal(false)} labelledBy="modal-ptt-title">
                    <ModalHeader
                        id="modal-ptt-title"
                        title={editingTugas ? 'Edit Penugasan' : 'Tambah Penugasan'}
                        subtitle="Lengkapi data penugasan guru"
                        icon={editingTugas ? "pencil-square" : "plus-circle-fill"}
                        onClose={() => setShowModal(false)}
                    />
                    <form onSubmit={handleSave}>
                        <ModalBody>
                            <div className="sk__field">
                                <label>
                                    <i className="bi bi-person-fill"></i> Guru
                                </label>
                                <Select
                                    options={guruOptions}
                                    value={selectedGuru}
                                    onChange={setSelectedGuru}
                                    styles={customSelectStyles}
                                    placeholder="Ketik nama atau NIP guru..."
                                />
                            </div>
                            <div className="sk__field">
                                <label>
                                    <i className="bi bi-award"></i> Jabatan / Tugas
                                </label>
                                <CreatableSelect
                                    options={jabatanOptions}
                                    value={selectedJabatan}
                                    onChange={setSelectedJabatan}
                                    styles={customSelectStyles}
                                    placeholder="Pilih atau ketik jabatan baru..."
                                    formatCreateLabel={(input) => `Tambah "${input}"`}
                                    isValidNewOption={(input) => !!input && !lockedApprover(input)}
                                />
                            </div>
                            <div className="sk__field">
                                <label>
                                    <i className="bi bi-shield-check"></i> Disetujui Oleh (Approval LCKH)
                                </label>
                                {lockedRole ? (
                                    <div className="ptt-locked">
                                        <span className={`ptt-approver-badge ptt-approver-badge--${lockedRole === 'WKM_KESISWAAN' ? 'kesiswaan' : 'akademik'}`}>
                                            <i className="bi bi-lock-fill"></i> {APPROVER_LABELS[lockedRole]}
                                        </span>
                                        <span className="ptt-locked__hint">Paten mengikuti jenis tugas otomatis, tidak dapat diubah.</span>
                                    </div>
                                ) : (
                                    <Select
                                        options={APPROVER_OPTIONS}
                                        value={APPROVER_OPTIONS.find(o => o.value === approverRole) || APPROVER_OPTIONS[2]}
                                        onChange={(opt: any) => setApproverRole(opt?.value || 'SEMUA_WKM')}
                                        styles={customSelectStyles}
                                        placeholder="Pilih WKM penyetuju..."
                                    />
                                )}
                            </div>
                            <div className="sk__grid2">
                                <div className="sk__field">
                                    <label>
                                        <i className="bi bi-calendar-event"></i> Tahun Ajaran
                                    </label>
                                    <select
                                        className="ptt-select"
                                        style={{ width: '100%', padding: '10px 36px 10px 14px', fontSize: '0.88rem' }}
                                        value={tahunAjaran}
                                        onChange={e => setTahunAjaran(e.target.value)}
                                    >
                                        {(tahunOptions.length > 0 ? tahunOptions : [tahunAjaran]).map(ta => (
                                            <option key={ta} value={ta}>{ta}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="sk__field">
                                    <label>
                                        <i className="bi bi-hash"></i> Semester
                                    </label>
                                    <select
                                        className="ptt-select"
                                        style={{ width: '100%', padding: '10px 36px 10px 14px', fontSize: '0.88rem' }}
                                        value={formSemester}
                                        onChange={e => setFormSemester(Number(e.target.value))}
                                    >
                                        <option value={1}>Ganjil (1)</option>
                                        <option value={2}>Genap (2)</option>
                                        {!editingTugas && <option value={0}>Semua (Ganjil & Genap)</option>}
                                    </select>
                                </div>
                            </div>
                            {!editingTugas && formSemester === 0 && (
                                <small style={{ fontSize: '0.74rem', color: 'var(--n-muted)' }}>
                                    <i className="bi bi-info-circle" /> 2 penugasan akan ditambahkan: semester Ganjil dan Genap.
                                </small>
                            )}
                            <div className="sk__field sk__fieldFull">
                                <label>
                                    <i className="bi bi-info-circle"></i> Keterangan <span className="ptt-field__opt">(opsional)</span>
                                </label>
                                <textarea
                                    className="ptt-textarea"
                                    value={keterangan}
                                    onChange={e => setKeterangan(e.target.value)}
                                    rows={2}
                                    placeholder="Contoh: Wali Kelas X IPA 1, Divisi Kurikulum..."
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="cancel" type="button" onClick={() => setShowModal(false)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                            {(editingTugas ? canUpdate : canCreate) && (
                                <Button variant="primary" type="submit" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                                    {saving ? null : (editingTugas ? 'Simpan Perubahan' : 'Simpan Penugasan')}
                                </Button>
                            )}
                        </ModalFooter>
                    </form>
                </Modal>
            )}

            <style jsx>{`
                /* ===== ROOT ===== */
                .ptt-root {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding-bottom: 24px;
                }



                /* ===== STATS ===== */
                .ptt-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                .ptt-stat {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 16px;
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .ptt-stat:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
                }
                .ptt-stat__icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }
                .ptt-stat__icon--blue { background: #dbeafe; color: #1d4ed8; }
                .ptt-stat__icon--blue { background: #eff6ff; color: #00287a; }
                .ptt-stat__icon--amber { background: #fef3c7; color: #92400e; }
                .ptt-stat__body {}
                .ptt-stat__value {
                    font-size: 1.2rem;
                    font-weight: 800;
                    color: var(--n-text);
                    line-height: 1.2;
                }
                .ptt-stat__label {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin-top: 2px;
                }

                /* ===== FILTER BAR ===== */
                .ptt-filterbar {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 16px;
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    flex-wrap: wrap;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                .ptt-filterbar__left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .ptt-filterbar__right { display: flex; align-items: center; gap: 12px; }
                .ptt-select {
                    padding: 8px 40px 8px 12px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.84rem;
                    font-weight: 600;
                    color: var(--n-text);
                    background: var(--n-card);
                    cursor: pointer;
                    outline: none;
                    appearance: none;
                    -webkit-appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 16px center;
                    transition: border-color 0.2s;
                }
                .ptt-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
                .ptt-select--input {
                    background: var(--n-soft);
                    width: 100%;
                }
                .ptt-count {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #2563eb;
                }

                .ptt-count i { font-size: 0.9rem; }
                
                /* Search Input */
                .ptt-search {
                    display: flex;
                    align-items: center;
                    background: var(--n-soft);
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    padding: 0 12px;
                    height: 38px;
                    min-width: 220px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .ptt-search:focus-within {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                    background: var(--n-card);
                }
                .ptt-search__icon {
                    color: var(--n-muted);
                    font-size: 0.85rem;
                    margin-right: 8px;
                }
                .ptt-search__input {
                    border: none;
                    background: transparent;
                    outline: none;
                    color: var(--n-text);
                    font-size: 0.84rem;
                    font-weight: 600;
                    width: 100%;
                }
                .ptt-search__input::placeholder {
                    color: var(--n-muted);
                    font-weight: 500;
                }
                .ptt-search__clear {
                    background: transparent;
                    border: none;
                    color: var(--n-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    margin-left: 8px;
                    font-size: 0.9rem;
                    transition: color 0.2s;
                }
                .ptt-search__clear:hover {
                    color: #dc2626;
                }

                /* ===== CONTENT ===== */
                .ptt-content {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                /* ===== EMPTY STATE ===== */
                .ptt-empty {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 20px;
                    padding: 56px 24px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                .ptt-empty__icon {
                    width: 72px;
                    height: 72px;
                    border-radius: 20px;
                    background: var(--n-soft);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                    color: var(--n-muted);
                    margin-bottom: 4px;
                }
                .ptt-empty__title {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--n-text);
                }
                .ptt-empty__sub {
                    font-size: 0.85rem;
                    color: var(--n-muted);
                    margin-bottom: 8px;
                }

                /* ===== GROUP ===== */
                .ptt-group {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .ptt-group__header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 0 4px;
                }
                .ptt-group__badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.78rem;
                    font-weight: 800;
                    color: var(--n-text);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }
                .ptt-group__badge i { color: #3083FF; font-size: 0.85rem; }
                .ptt-group__count {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    background: var(--n-soft);
                    padding: 3px 10px;
                    border-radius: 999px;
                    border: 1px solid var(--n-border);
                }

                /* ===== TABLE (desktop) ===== */
                .ptt-tableWrap {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                .ptt-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.86rem;
                }
                .ptt-table thead tr { background: rgba(124,58,237,0.05); }
                .ptt-table th {
                    padding: 10px 14px;
                    text-align: left;
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--n-border);
                    white-space: nowrap;
                }
                .ptt-table td {
                    padding: 10px 14px;
                    color: var(--n-text);
                    border-bottom: 1px solid var(--n-border);
                    vertical-align: middle;
                }
                .ptt-table tbody tr:last-child td { border-bottom: none; }
                .ptt-table tbody tr:hover { background: rgba(124,58,237,0.03); }
                .ptt-col-no { width: 48px; text-align: center; }
                .ptt-td-center { text-align: center; color: var(--n-muted); font-weight: 600; }
                .ptt-col-nip { width: 170px; }
                .ptt-col-appr { width: 150px; }
                .ptt-col-aksi { width: 90px; }
                .ptt-guruCell { display: flex; align-items: center; gap: 10px; }
                .ptt-guruCell__avatar {
                    width: 34px; height: 34px; border-radius: 9px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.78rem; font-weight: 800; flex-shrink: 0;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                }
                .ptt-guruCell__name { font-weight: 700; }
                .ptt-nipTag {
                    font-family: monospace; font-size: 0.76rem; font-weight: 600;
                    color: var(--n-muted); background: var(--n-soft);
                    padding: 2px 8px; border-radius: 5px; white-space: nowrap;
                }
                .ptt-ketCell {
                    font-size: 0.8rem; color: var(--n-muted); font-style: italic;
                    max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .ptt-rowActions { display: flex; gap: 6px; }

                /* ===== CARD (mobile) — disembunyikan di desktop ===== */
                .ptt-mobileGroups {
                    display: none;
                }
                .ptt-group__list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .ptt-card {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
                }
                .ptt-card:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 16px rgba(59,130,246,0.1);
                    transform: translateY(-1px);
                }
                .ptt-card__avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                    font-weight: 800;
                    flex-shrink: 0;
                    letter-spacing: 0.02em;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .ptt-card__body {
                    flex: 1;
                    min-width: 0;
                }
                .ptt-card__name {
                    font-size: 0.92rem;
                    font-weight: 700;
                    color: var(--n-text);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 3px;
                }
                .ptt-card__meta {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    flex-wrap: wrap;
                }
                .ptt-card__nip {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    font-family: monospace;
                    background: var(--n-soft);
                    padding: 1px 6px;
                    border-radius: 4px;
                }
                .ptt-card__dot { color: #cbd5e1; font-size: 0.7rem; }
                .ptt-approver-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 0.68rem;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                }
                .ptt-approver-badge--akademik { background: rgba(59,130,246,0.1); color: #2563eb; border: 1px solid rgba(59,130,246,0.2); }
                .ptt-approver-badge--kesiswaan { background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
                .ptt-approver-badge--semua { background: rgba(59,130,246,0.1); color: #3083FF; border: 1px solid rgba(59,130,246,0.2); }
                .ptt-approver-badge--kamad { background: rgba(245,158,11,0.12); color: #b45309; border: 1px solid rgba(245,158,11,0.25); }
                .ptt-locked {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 10px 12px;
                    border: 1.5px dashed var(--n-border);
                    border-radius: 10px;
                    background: var(--n-soft);
                }
                .ptt-locked__hint { font-size: 0.72rem; color: var(--n-muted); }
                .ptt-card__note {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    font-style: italic;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 200px;
                }
                .ptt-card__actions {
                    display: flex;
                    gap: 6px;
                    flex-shrink: 0;
                }

                /* ===== BUTTONS ===== */
                .ptt-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 10px 18px;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    white-space: nowrap;
                    text-decoration: none;
                }
                .ptt-btn i { font-size: 0.95rem; }
                .ptt-btn--primary {
                    background: linear-gradient(135deg, #0f172a, #1e3a8a);
                    color: white;
                    box-shadow: 0 4px 14px rgba(15,23,42,0.25);
                    position: relative;
                    z-index: 1;
                }
                .ptt-btn--primary:hover {
                    background: linear-gradient(135deg, #1e3a8a, #2563eb);
                    box-shadow: 0 6px 20px rgba(30,58,138,0.35);
                    transform: translateY(-1px);
                }
                .ptt-btn--primary:active { transform: translateY(0); }
                .ptt-btn--ghost {
                    background: var(--n-soft);
                    color: var(--n-muted);
                    border: 1.5px solid var(--n-border);
                }
                .ptt-btn--ghost:hover {
                    background: #e2e8f0;
                    color: var(--n-text);
                }
                .ptt-btn--danger {
                    background: linear-gradient(135deg, #dc2626, #ef4444);
                    color: white;
                    box-shadow: 0 4px 14px rgba(220,38,38,0.25);
                }
                .ptt-btn--danger:hover:not(:disabled) {
                    box-shadow: 0 6px 20px rgba(220,38,38,0.35);
                    transform: translateY(-1px);
                }
                .ptt-btn--danger:disabled { opacity: 0.6; cursor: not-allowed; }

                /* Icon Button */
                .ptt-iconBtn {
                    width: 34px;
                    height: 34px;
                    border-radius: 9px;
                    border: 1.5px solid var(--n-border);
                    background: var(--n-soft);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 0.8rem;
                    transition: all 0.2s;
                    color: var(--n-muted);
                }
                .ptt-iconBtn:hover { border-color: #3b82f6; color: #3b82f6; background: #eff6ff; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(59,130,246,0.15); }
                .ptt-iconBtn--danger:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2; box-shadow: 0 3px 8px rgba(220,38,38,0.15); }
                .ptt-iconBtn--edit:hover { border-color: #3083FF; color: #3083FF; background: #eff6ff; box-shadow: 0 3px 8px rgba(124,58,237,0.15); }

                /* Spinners */
                .ptt-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: ttSpin 0.8s linear infinite;
                }
                .ptt-spin {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.4);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: ttSpin 0.8s linear infinite;
                }
                .ptt-spin--sm { width: 14px; height: 14px; border-width: 2px; }
                @keyframes ttSpin { to { transform: rotate(360deg); } }

                /* ===== SHEET (DELETE) ===== */
                .ptt-sheet-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15,23,42,0.5);
                    backdrop-filter: blur(4px);
                    z-index: 99998;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .ptt-sheet {
                    background: var(--n-card);
                    width: 100%;
                    max-width: 480px;
                    border-radius: 24px;
                    padding: 24px;
                    animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                }
                .ptt-sheet__handle {
                    display: none;
                }
                .ptt-sheet__header {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 20px;
                }
                .ptt-sheet__header--danger {}
                .ptt-sheet__icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.3rem;
                    flex-shrink: 0;
                }
                .ptt-sheet__icon--danger { background: #fef2f2; color: #dc2626; }
                .ptt-sheet__title { font-size: 1.05rem; font-weight: 800; color: var(--n-text); margin-bottom: 2px; }
                .ptt-sheet__subtitle { font-size: 0.8rem; color: var(--n-muted); }
                .ptt-sheet__body { margin-bottom: 20px; }
                .ptt-delete-card {
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    padding: 14px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .ptt-delete-card__avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                    font-weight: 800;
                    flex-shrink: 0;
                }
                .ptt-delete-card__info {}
                .ptt-delete-card__name { font-size: 0.92rem; font-weight: 700; color: var(--n-text); margin-bottom: 4px; }
                .ptt-delete-card__meta { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--n-muted); }
                .ptt-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .ptt-badge--jabatan { background: #eff6ff; color: #00287a; }
                .ptt-sheet__foot {
                    display: flex;
                    gap: 10px;
                    padding-top: 16px;
                    border-top: 1px solid var(--n-border);
                }
                .ptt-sheet__foot .ptt-btn { flex: 1; }

                /* ===== MODAL ===== */
                .ptt-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15,23,42,0.5);
                    backdrop-filter: blur(4px);
                    z-index: 99998;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .ptt-modal {
                    background: var(--n-card);
                    width: 100%;
                    max-width: 520px;
                    border-radius: 24px;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.2);
                    overflow: hidden;
                    animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    max-height: 90vh;
                    overflow-y: auto;
                }
                @keyframes zoomIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .ptt-modal__head {
                    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
                    padding: 20px 24px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }
                .ptt-modal__head-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.12);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 1.2rem;
                    flex-shrink: 0;
                }
                .ptt-modal__head-title { font-size: 1rem; font-weight: 800; color: white; margin-bottom: 2px; }
                .ptt-modal__head-sub { font-size: 0.75rem; color: rgba(255,255,255,0.55); font-weight: 500; }
                .ptt-modal__close {
                    margin-left: auto;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.1);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 0.9rem;
                    flex-shrink: 0;
                    transition: background 0.2s;
                }
                .ptt-modal__close:hover { background: rgba(255,255,255,0.2); }
                .ptt-modal__body {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }
                .ptt-input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: var(--n-text);
                    background: var(--n-soft);
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-sizing: border-box;
                }
                .ptt-input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                }
                .ptt-textarea {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.88rem;
                    font-weight: 500;
                    color: var(--n-text);
                    background: var(--n-soft);
                    outline: none;
                    resize: none;
                    line-height: 1.5;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-sizing: border-box;
                }
                .ptt-textarea:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                }
                .ptt-modal__foot {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding-top: 8px;
                    border-top: 1px solid var(--n-border);
                }

                /* ===== MOBILE RESPONSIVE ===== */
                @media (max-width: 768px) {

                    .ptt-tableWrap { display: none; }
                    .ptt-mobileGroups { display: flex; flex-direction: column; gap: 16px; }
                    .ptt-group__list { display: flex; }

                    .ptt-stats {
                        grid-template-columns: 1fr 1fr;
                    }
                    .ptt-stat--period {
                        grid-column: 1 / -1;
                    }
                    .ptt-filterbar {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 10px;
                        padding: 12px;
                        border-radius: 14px;
                    }
                    .ptt-stat { padding: 10px 12px; gap: 10px; border-radius: 12px; }
                    .ptt-stat__icon { width: 36px; height: 36px; border-radius: 10px; font-size: 0.95rem; }
                    .ptt-stat__value { font-size: 1.05rem; }
                    .ptt-stat__label { font-size: 0.65rem; }
                    .ptt-filterbar__left { flex-direction: column; align-items: stretch; }
                    .ptt-filterbar__right { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
                    .ptt-grid2 { grid-template-columns: 1fr; }
                    .ptt-modal-overlay { padding: 0; align-items: flex-end; }
                    .ptt-modal { max-width: 100%; border-radius: 24px 24px 0 0; max-height: 92vh; }
                    .ptt-modal__body { padding: 18px; gap: 14px; }
                    .ptt-modal__foot { flex-direction: column-reverse; }
                    .ptt-modal__foot .ptt-btn { width: 100%; justify-content: center; }
                    .ptt-sheet__foot { flex-direction: column-reverse; }
                }

                @media (max-width: 480px) {
                    .ptt-root { gap: 12px; }
                    .ptt-stats { grid-template-columns: 1fr; }
                    .ptt-stat--period { grid-column: span 1; }
                    .ptt-card { padding: 12px; gap: 12px; }
                    .ptt-card__actions { gap: 4px; }
                    .ptt-iconBtn { width: 30px; height: 30px; border-radius: 8px; font-size: 0.75rem; }
                    .ptt-group__badge { font-size: 0.72rem; }
                    .ptt-empty { padding: 40px 16px; }
                }

                /* ===== DARK MODE STANDARD ===== */
                :global(.dark) {
                    --select-bg: #000000;
                    --select-border: rgba(26, 115, 232, 0.75);
                    --select-text: #e2e8f0;
                    --select-menu-bg: #000000;
                }
                :global(.dark) .ptt-count {
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-stat,
                :global(.dark) .ptt-filterbar,
                :global(.dark) .ptt-tableWrap,
                :global(.dark) .ptt-card,
                :global(.dark) .ptt-sheet,
                :global(.dark) .ptt-modal,
                :global(.dark) .ptt-empty {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
                }
                :global(.dark) .ptt-search input,
                :global(.dark) input.ptt-search__input,
                :global(.dark) .ptt-search__input {
                    background: transparent !important;
                    background-color: transparent !important;
                    border: none !important;
                    outline: none !important;
                    box-shadow: none !important;
                    color: #e2e8f0 !important;
                }

                :global(.dark) .ptt-select,
                :global(.dark) .ptt-search,
                :global(.dark) .ptt-input,
                :global(.dark) .ptt-textarea {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 12px !important;
                    color: #e2e8f0 !important;
                }
                :global(.dark) .ptt-select {
                    height: 40px !important;
                    background-color: #000000 !important;
                    background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjYgOSAxMiAxNSAxOCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 12px center !important;
                    background-size: 16px 16px !important;
                    padding-right: 36px !important;
                    -webkit-appearance: none !important;
                    appearance: none !important;
                }
                :global(.dark) .ptt-badge--jabatan {
                    background: rgba(26, 115, 232, 0.18) !important;
                    border: 1px solid rgba(59, 130, 246, 0.45) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-approver-badge--akademik,
                :global(.dark) .ptt-approver-badge--semua {
                    background: rgba(59, 130, 246, 0.15) !important;
                    border: 1px solid rgba(59, 130, 246, 0.4) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-approver-badge--kesiswaan {
                    background: rgba(16, 185, 129, 0.15) !important;
                    border: 1px solid rgba(16, 185, 129, 0.4) !important;
                    color: #34d399 !important;
                }
                :global(.dark) .ptt-approver-badge--kamad {
                    background: rgba(245, 158, 11, 0.15) !important;
                    border: 1px solid rgba(245, 158, 11, 0.4) !important;
                    color: #fbbf24 !important;
                }
                :global(.dark) .ptt-table thead tr,
                :global(.dark) .ptt-table th {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .ptt-table td {
                    background: #000000 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                    color: #cbd5e1 !important;
                }
                :global(.dark) .ptt-table tbody tr:hover td {
                    background: rgba(26, 115, 232, 0.08) !important;
                }
                :global(.dark) .ptt-stat__value,
                :global(.dark) .ptt-group__badge,
                :global(.dark) .ptt-card__name,
                :global(.dark) .ptt-sheet__title,
                :global(.dark) .ptt-delete-card__name,
                :global(.dark) .ptt-empty__title {
                    color: #e2e8f0 !important;
                }
                :global(.dark) .ptt-stat__icon--blue { background: rgba(26, 115, 232, 0.2) !important; color: #60a5fa !important; }
                :global(.dark) .ptt-btn--primary {
                    background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
                    color: #ffffff !important;
                    border: 1px solid rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
                }
                :global(.dark) .ptt-btn--ghost {
                    background: #000000 !important;
                    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .ptt-btn--ghost:hover {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .ptt-iconBtn {
                    background: #000000 !important;
                    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-iconBtn:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .ptt-iconBtn--danger {
                    background: #000000 !important;
                    border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .ptt-iconBtn--danger:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .ptt-modal__head,
                :global(.dark) .ptt-sheet__header {
                    background: #000000 !important;
                    border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
                }
                :global(.dark) .ptt-modal__head-icon {
                    background: rgba(26, 115, 232, 0.2) !important;
                    border: 1px solid rgba(59, 130, 246, 0.4) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-modal__head-title,
                :global(.dark) .ptt-sheet__title {
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-modal__head-sub,
                :global(.dark) .ptt-sheet__subtitle,
                :global(.dark) .ptt-delete-card__meta,
                :global(.dark) .ptt-field__label {
                    color: #94a3b8 !important;
                }
                :global(.dark) .ptt-field__label i {
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-sheet__icon--danger {
                    background: rgba(239, 68, 68, 0.2) !important;
                    border: 1px solid rgba(239, 68, 68, 0.4) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .ptt-delete-card {
                    background: #000000 !important;
                    border: 1px solid rgba(37, 99, 235, 0.4) !important;
                }
                :global(.dark) .ptt-delete-card__avatar {
                    background: rgba(26, 115, 232, 0.2) !important;
                    border: 1px solid rgba(59, 130, 246, 0.4) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-modal__close {
                    background: #000000 !important;
                    border: 1px solid rgba(37, 99, 235, 0.4) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt-modal__close:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                }

                :global(.dark) .ptt-modal__body { background: #000000 !important; }
                :global(.dark) .ptt-modal__foot,
                :global(.dark) .ptt-sheet__foot {
                    background: #000000 !important;
                    border-top-color: rgba(26, 115, 232, 0.4) !important;
                }
                /* ===== END DARK MODE STANDARD ===== */


            `}</style>
        </div>
    );
}
