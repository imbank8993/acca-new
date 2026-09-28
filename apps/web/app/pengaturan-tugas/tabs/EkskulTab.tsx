'use client';

import { usePengaturanTugasAccess } from '@/lib/use-pengaturan-tugas-access'
import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import Button from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import DesktopFab from '@/components/ui/DesktopFab';

interface PembinaItem {
    id: string;
    ekskul_id: string;
    nip: string;
    nama_guru: string;
    tahun_ajaran: string;
    semester: number;
    aktif: boolean;
    nama_ekskul?: string;
}

interface EkskulItem {
    id: string;
    nama_ekskul: string;
    tahun_ajaran: string;
    semester: number;
    aktif: boolean;
}

interface GuruOption {
    value: string;
    label: string;
    nama: string;
}

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
export default function EkskulTab(_props: { user?: unknown }) {
    /**
     * Wewenang dari server (Hak Akses Fitur per tab), bukan dari objek user.
     * `user?.role === 'ADMIN'` adalah perbandingan string UTUH, sedangkan ketiga
     * akun admin di basis data ini berrole gabungan (`ADMIN,GURU`, dst).
     */
    const { boleh } = usePengaturanTugasAccess()
    const bolehKelola = boleh('pembina_ekskul');

    const [pembinaList, setPembinaList] = useState<PembinaItem[]>([]);
    const [ekskulList, setEkskulList] = useState<EkskulItem[]>([]);
    const [guruOptions, setGuruOptions] = useState<GuruOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

    const [deleteItemName, setDeleteItemName] = useState('');
    const [deleting, setDeleting] = useState(false);

    const [selectedEkskul, setSelectedEkskul] = useState<any>(null);
    const [selectedGuru, setSelectedGuru] = useState<any>(null);
    const [tahunAjaran, setTahunAjaran] = useState('');
    const [semester, setSemester] = useState<number | 'Semua'>('Semua');
    const [searchTerm, setSearchTerm] = useState('');
    // Pilihan semester khusus modal ('Semua' | '1' | '2'); terpisah dari filter toolbar.
    // 'Semua' = simpan 2 baris (Ganjil & Genap)
    const [formSemester, setFormSemester] = useState('1');
    const [academicYears, setAcademicYears] = useState<string[]>([]);

    const { registerModal } = useModalBlur();

    useEffect(() => {
        if (showModal || (showDeleteConfirm && deleteItemId !== null)) return registerModal();
    }, [showModal, showDeleteConfirm, deleteItemId, registerModal]);


    const filteredEkskul = useMemo(() => {
        return ekskulList.filter(e => e.aktif);
    }, [ekskulList]);

    const filteredPembina = useMemo(() => {
        let result = pembinaList.filter(p => p.tahun_ajaran === tahunAjaran && (semester === 'Semua' || p.semester === semester));
        if (searchTerm) {
            const query = searchTerm.toLowerCase();
            result = result.filter(p => 
                p.nama_guru?.toLowerCase().includes(query) || 
                p.nip?.toLowerCase().includes(query) || 
                p.nama_ekskul?.toLowerCase().includes(query)
            );
        }
        return result;
    }, [pembinaList, tahunAjaran, semester, searchTerm]);

    const groupedByEkskul = useMemo(() => {
        const groups: Record<string, PembinaItem[]> = {};
        filteredPembina.forEach(p => {
            const key = p.nama_ekskul || p.ekskul_id;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }, [filteredPembina]);

    const stats = useMemo(() => ({
        totalEkskul: filteredEkskul.length,
        totalPembina: filteredPembina.length,
        uniqueEkskul: Object.keys(groupedByEkskul).length,
    }), [filteredEkskul, filteredPembina, groupedByEkskul]);

    useEffect(() => { loadData(); }, []);

    const fetchAcademicYears = async () => {
        try {
            const { getActivePeriods, getActiveSettings } = await import('@/lib/settings-client');
            const periods = await getActivePeriods();
            const defaultSettings = await getActiveSettings();
            if (periods.length > 0) {
                const uniqueYears = Array.from(new Set(periods.map((p: any) => p.tahun_ajaran)));
                setAcademicYears(uniqueYears as string[]);
                if (defaultSettings) setTahunAjaran(defaultSettings.tahun_ajaran);
                else setTahunAjaran(periods[0].tahun_ajaran);
            }
        } catch (err) { console.error('Error fetching AY', err); }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [ekskulRes, pembinaRes, guruRes] = await Promise.all([
                fetch('/api/ekskul'),
                fetch('/api/ekskul/pembina'),
                fetch('/api/master/guru?limit=500'),
            ]);
            const ekskulData = await ekskulRes.json();
            const pembinaData = await pembinaRes.json();
            const guruData = await guruRes.json();

            if (ekskulData.ok) setEkskulList(ekskulData.data);
            if (pembinaData.ok) setPembinaList(pembinaData.data);
            if (guruData.ok) {
                setGuruOptions(guruData.data.map((g: any) => ({
                    value: g.nip,
                    label: `${g.nama_lengkap} (${g.nip})`,
                    nama: g.nama_lengkap
                })));
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
        if (!selectedEkskul || !selectedGuru) {
            Swal.fire('Error', 'Mohon pilih ekstrakurikuler dan pembina', 'error');
            return;
        }
        setSaving(true);
        try {
            // 'Semua' (hanya mode tambah) = simpan untuk semester Ganjil DAN Genap
            const targetSemesters = !editingId && formSemester === 'Semua'
                ? [1, 2]
                : [parseInt(formSemester) || (typeof semester === 'number' ? semester : 1)];

            const results = await Promise.all(targetSemesters.map((sem) => {
                const payload = {
                    ekskul_id: selectedEkskul.value,
                    nip: selectedGuru.value,
                    nama_guru: selectedGuru.nama,
                    tahun_ajaran: tahunAjaran,
                    semester: sem,
                    aktif: true,
                    id: editingId || undefined,
                };
                return fetch('/api/ekskul/pembina', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Gagal terhubung ke server' }));
            }));

            const failed = results.filter((r) => !r.ok);
            if (failed.length === 0) {
                Swal.fire('Sukses', targetSemesters.length > 1
                    ? '2 data pembina tersimpan (Ganjil & Genap)'
                    : 'Pembina berhasil disimpan', 'success');
                setShowModal(false);
                setEditingId(null);
                setSelectedEkskul(null);
                setSelectedGuru(null);
                loadData();
            } else {
                throw new Error(failed.map((f) => f.error).filter(Boolean).join(', ') || 'Gagal menyimpan sebagian data');
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
            const res = await fetch(`/api/ekskul/pembina?id=${deleteItemId}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) {
                setShowDeleteConfirm(false);
                setDeleteItemId(null);
                loadData();
                Swal.fire('Terhapus!', 'Pembina berhasil dihapus.', 'success');
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
        setSelectedGuru(null);
        setFormSemester(semester === 'Semua' ? '1' : String(semester));
        setShowModal(true);
    };

    const openEdit = (item: PembinaItem) => {
        setEditingId(item.id);
        const ekskulOpt = filteredEkskul.find(e => e.id === item.ekskul_id);
        setSelectedEkskul(item ? { value: item.ekskul_id, label: item.nama_ekskul } : null);
        setSelectedGuru(item ? { value: item.nip, label: `${item.nama_guru} (${item.nip})`, nama: item.nama_guru } : null);
        setTahunAjaran(item ? item.tahun_ajaran : (academicYears[0] || ''));
        setFormSemester(item ? String(item.semester) : '1');
        setShowModal(true);
    };

    const [saving, setSaving] = useState(false);


    return (
        <div className="ptt">


            {/* Stats */}
            <div className="ptt__stats">
                <div className="ptt__statCard">
                    <div className="ptt__statIcon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <i className="bi bi-list-task" style={{ color: '#3083FF' }}></i>
                    </div>
                    <div>
                        <div className="ptt__statVal">{stats.totalEkskul}</div>
                        <div className="ptt__statLbl">Total Ekskul</div>
                    </div>
                </div>
                <div className="ptt__statCard">
                    <div className="ptt__statIcon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <i className="bi bi-person-check-fill" style={{ color: '#10b981' }}></i>
                    </div>
                    <div>
                        <div className="ptt__statVal" style={{ color: '#10b981' }}>{stats.totalPembina}</div>
                        <div className="ptt__statLbl">Pembina Aktif</div>
                    </div>
                </div>
                <div className="ptt__statCard">
                    <div className="ptt__statIcon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <i className="bi bi-collection-fill" style={{ color: '#3b82f6' }}></i>
                    </div>
                    <div>
                        <div className="ptt__statVal" style={{ color: '#3b82f6' }}>{stats.uniqueEkskul}</div>
                        <div className="ptt__statLbl">Ekskul Terbina</div>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <FilterToolbar>
                <FilterSearch
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Cari pembina atau ekskul..."
                />
                <FilterSelect
                    label="Tahun Ajaran"
                    value={tahunAjaran}
                    onChange={val => setTahunAjaran(val)}
                >
                    {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                </FilterSelect>
                <FilterSelect
                    label="Semester"
                    value={semester.toString()}
                    onChange={val => setSemester(val === 'Semua' ? 'Semua' : parseInt(val))}
                >
                    <option value="Semua">Semua Semester</option>
                    <option value={1}>Ganjil</option>
                    <option value={2}>Genap</option>
                </FilterSelect>
            </FilterToolbar>

            {bolehKelola && (
                <DesktopFab
                    label="Tambah Pembina"
                    icon="plus-lg"
                    onClick={openAdd}
                />
            )}

            {/* Loading / Empty State */}
            {loading ? (
                <div className="ptt__loading">
                    <Spinner variant="buble" />
                </div>
            ) : Object.keys(groupedByEkskul).length === 0 ? (
                <div className="ptt__empty">
                    <div className="ptt__emptyIcon">
                        <i className="bi bi-clipboard-x" style={{ color: 'var(--n-muted)' }}></i>
                    </div>
                    <p>Belum ada pembina ekstrakurikuler untuk periode ini.</p>
                    <p className="ptt__emptyHint">Klik &quot;Tambah Pembina&quot; untuk memulai plotting.</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="ptt__desktopTable ptt__groupList">
                        <div className="ptt__group" style={{ padding: '0', background: 'var(--n-card)' }}>
                            <table className="ptt__table">
                                <thead>
                                    <tr>
                                        <th className="ptt__th">Ekskul</th>
                                        <th className="ptt__th">Pembina</th>
                                        <th className="ptt__th">Tahun Ajaran</th>
                                        <th className="ptt__th">Semester</th>
                                        <th className="ptt__th">Aktif</th>
                                        {bolehKelola && <th className="ptt__th" style={{ width: '100px', textAlign: 'right' }}>Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPembina.map((item) => {
                                        const ekskulName = item.nama_ekskul || item.ekskul_id;
                                        return (
                                            <tr key={item.id} className="ptt__tr">
                                                <td className="ptt__td" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--n-text)' }}>{ekskulName}</td>
                                                <td className="ptt__td">
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <div className="ptt__guruName">{item.nama_guru}</div>
                                                        <div className="ptt__guruNip">{item.nip}</div>
                                                    </div>
                                                </td>
                                                <td className="ptt__td" style={{ fontWeight: 500, color: 'var(--n-text)' }}>{item.tahun_ajaran}</td>
                                                <td className="ptt__td">
                                                    <span className={`ptt__metaTag ${item.semester === 1 ? 'isGanjil' : 'isGenap'}`}>{item.semester === 1 ? 'Ganjil' : 'Genap'}</span>
                                                </td>

                                                <td className="ptt__td">
                                                    <span className={`ptt__badge ${item.aktif ? 'isOn' : 'isOff'}`}>
                                                        {item.aktif ? 'Aktif' : 'Non-Aktif'}
                                                    </span>
                                                </td>
                                                {bolehKelola && (
                                                    <td className="ptt__td" style={{ textAlign: 'right' }}>
                                                        <ActionGroup>
                                                            <ActionButton action="edit" onClick={() => openEdit(item)} />
                                                            <ActionButton action="delete" onClick={() => {
                                                                setDeleteItemId(item.id);
                                                                setDeleteItemName(`${item.nama_guru} - ${ekskulName}`);
                                                                setShowDeleteConfirm(true);
                                                            }} />
                                                        </ActionGroup>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="ptt__cardGrid mobileOnly">
                        {filteredPembina.map((item) => {
                            const ekskulName = item.nama_ekskul || item.ekskul_id;
                            const [bgColor, textColor] = getAvatarColor(item.nama_guru);
                            return (
                                <div className="ptt__guruCard" key={item.id}>
                                    <div className="ptt__guruInfo">
                                        <div className="ptt__guruName">{item.nama_guru}</div>
                                        <div className="ptt__guruNip">{item.nip}</div>
                                        <div style={{ fontSize: '0.85rem', marginTop: '6px', fontWeight: 700, color: 'var(--n-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ekskulName}</div>
                                    </div>
                                    <div className="ptt__guruStatus" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                        <span className={`ptt__badge ${item.aktif ? 'isOn' : 'isOff'}`}>
                                            {item.aktif ? 'Aktif' : 'Non-Aktif'}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--n-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{item.tahun_ajaran} • {item.semester === 1 ? 'Ganjil' : 'Genap'}</span>
                                    </div>
                                    {bolehKelola && (
                                        <ActionGroup>
                                            <ActionButton action="edit" onClick={() => openEdit(item)} />
                                            <ActionButton action="delete" onClick={() => {
                                                setDeleteItemId(item.id);
                                                setDeleteItemName(`${item.nama_guru} - ${ekskulName}`);
                                                setShowDeleteConfirm(true);
                                            }} />
                                        </ActionGroup>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Modal Add/Edit */}
            {showModal && (
                <Modal size="md" variant={editingId ? "edit" : "add"} onClose={() => setShowModal(false)} labelledBy="modal-ekskul-title">
                    <ModalHeader
                        id="modal-ekskul-title"
                        title={editingId ? 'Edit Pembina' : 'Tambah Pembina'}
                        icon={editingId ? "pencil-square" : "plus-circle-fill"}
                        onClose={() => setShowModal(false)}
                    />
                    <form onSubmit={handleSave}>
                        <ModalBody>
                            <div className="sk__field">
                                <label>Ekstrakurikuler <span className="ptt__required">*</span></label>
                                <Select
                                    options={filteredEkskul.map(e => ({ value: e.id, label: e.nama_ekskul }))}
                                    value={selectedEkskul}
                                    onChange={setSelectedEkskul}
                                    placeholder="Pilih ekstrakurikuler..."
                                    styles={customSelectStyles}
                                    isSearchable
                                    required
                                />
                            </div>
                            <div className="sk__field">
                                <label>Pembina (Guru) <span className="ptt__required">*</span></label>
                                <Select
                                    options={guruOptions}
                                    value={selectedGuru}
                                    onChange={setSelectedGuru}
                                    placeholder="Pilih pembina..."
                                    styles={customSelectStyles}
                                    isSearchable
                                    required
                                />
                            </div>
                            <div className="sk__grid2">
                                <div className="sk__field">
                                    <label>Tahun Ajaran</label>
                                    <select className="ptt__select" value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)}>
                                        {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="sk__field">
                                    <label>Semester</label>
                                    <select className="ptt__select" value={formSemester} onChange={e => setFormSemester(e.target.value)}>
                                        {!editingId && <option value="Semua">Semua (Ganjil & Genap)</option>}
                                        <option value="1">Ganjil</option>
                                        <option value="2">Genap</option>
                                    </select>
                                </div>
                            </div>
                            {!editingId && formSemester === 'Semua' && (
                                <small style={{ display: 'block', marginTop: 6, fontSize: '0.74rem', color: 'var(--n-muted)' }}>
                                    <i className="bi bi-info-circle" /> 2 data akan ditambahkan: semester Ganjil dan Genap.
                                </small>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="cancel" type="button" onClick={() => setShowModal(false)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                            <Button variant="primary" type="submit" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                                {saving ? null : 'Simpan'}
                            </Button>
                        </ModalFooter>
                    </form>
                </Modal>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <Modal size="sm" variant="delete" onClose={() => { setShowDeleteConfirm(false); setDeleteItemId(null); }} labelledBy="modal-ekskul-del">
                    <ModalHeader
                        id="modal-ekskul-del"
                        title={deleteItemName}
                        icon="trash3"
                        onClose={() => { setShowDeleteConfirm(false); setDeleteItemId(null); }}
                    />
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteItemId(null); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button variant="danger" type="button" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>
                            {deleting ? null : 'Ya, Hapus'}
                        </Button>
                    </ModalFooter>
                </Modal>
            )}


            <style jsx>{`
                .ptt {
                    width: 100%; min-width: 0; display: flex; flex-direction: column; gap: 16px;
                    padding-bottom: 32px; box-sizing: border-box;
                    font-family: 'Poppins', sans-serif;
                }



                .ptt__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .ptt__statCard {
                    background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px;
                    padding: 12px 16px; display: flex; align-items: center; gap: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                .ptt__statIcon {
                    width: 36px; height: 36px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                }
                .ptt__statIcon i { font-size: 1rem; }
                .ptt__statVal { font-size: 1.3rem; font-weight: 800; color: #3083FF; line-height: 1.1; }
                .ptt__statLbl { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; margin-top: 2px; }

                .ptt__toolbar {
                    display: flex; align-items: center; justify-content: space-between; gap: 12px;
                    flex-wrap: wrap;
                }
                .ptt__filterGroup { display: flex; gap: 8px; }
                .ptt__select {
                    padding: 8px 14px; border: 1.5px solid var(--n-border); border-radius: 12px;
                    font-size: 0.85rem; font-weight: 600; color: var(--n-text); background: var(--n-card);
                    outline: none; cursor: pointer; transition: all 0.15s ease;
                }
                .ptt__select:focus { border-color: #3083FF; box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.1); }
                .ptt__toolbarActions { display: flex; gap: 8px; }

                .ptt__btn {
                    display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px;
                    border-radius: 12px; font-size: 0.85rem; font-weight: 700; cursor: pointer;
                    border: none; transition: all 0.2s ease; white-space: nowrap;
                }
                .ptt__btnPrimary { background: #3083FF; color: white; box-shadow: 0 3px 10px rgba(124,58,237,0.25); }
                .ptt__btnPrimary:hover { background: #1d4ed8; }
                .ptt__btnPrimary:disabled { opacity: 0.6; cursor: not-allowed; }
                .ptt__btnGhost { background: transparent; border: 1.5px solid var(--n-border); color: var(--n-muted); }
                .ptt__btnGhost:hover { background: var(--n-soft); }
                .ptt__btnDanger { background: #dc2626; color: white; box-shadow: 0 3px 10px rgba(220,38,38,0.25); }
                .ptt__btnDanger:hover { background: #b91c1c; }
                .ptt__btnDanger:disabled { opacity: 0.6; cursor: not-allowed; }

                .ptt__loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; }
                .ptt__spinner {
                    width: 36px; height: 36px; border: 3px solid rgba(0, 56, 168, 0.15);
                    border-top-color: #3083FF; border-radius: 50%;
                    animation: pttspin 0.7s linear infinite;
                }
                @keyframes pttspin { to { transform: rotate(360deg); } }
                .ptt__loading p { color: var(--n-muted); font-size: 0.9rem; margin: 0; }

                .ptt__empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 20px; text-align: center; }
                .ptt__emptyIcon { width: 56px; height: 56px; background: var(--n-soft); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
                .ptt__emptyIcon i { font-size: 1.5rem; }
                .ptt__empty p { margin: 0; color: var(--n-muted); font-size: 0.9rem; }
                .ptt__emptyHint { color: var(--n-muted) !important; font-size: 0.82rem !important; }

                .ptt__groupList { display: flex; flex-direction: column; gap: 16px; }
                .ptt__group { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 18px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
                .ptt__groupHeader {
                    padding: 12px 16px; background: linear-gradient(135deg, rgba(124,58,237,0.04) 0%, rgba(96,165,250,0.04) 100%);
                    border-bottom: 1px solid rgba(0, 56, 168, 0.1); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
                }
                .ptt__groupTitle { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.95rem; color: var(--n-text); }
                .ptt__groupTitle i { font-size: 1rem; }
                .ptt__groupMeta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                .ptt__metaTag {
                    padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
                    background: rgba(0, 56, 168, 0.08); color: #3083FF;
                }

                .ptt__cardGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; padding: 12px; box-sizing: border-box; }
                .ptt__guruCard {
                    background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px;
                    padding: 12px; display: flex; align-items: center; gap: 10px;
                    transition: all 0.15s ease; position: relative;
                }
                .ptt__guruCard:hover { border-color: rgba(124,58,237,0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
                .ptt__guruAvatar {
                    width: 38px; height: 38px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 800; font-size: 0.8rem; flex-shrink: 0;
                }
                .ptt__guruInfo { flex: 1; min-width: 0; padding-right: 8px; }
                .ptt__guruName { font-weight: 700; font-size: 0.85rem; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .ptt__guruNip { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .ptt__guruStatus { flex-shrink: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-end; }
                .ptt__badge {
                    padding: 3px 8px; border-radius: 8px; font-size: 0.7rem; font-weight: 700; white-space: nowrap;
                }
                .ptt__badge.isOn { background: rgba(16,185,129,0.1); color: #059669; }
                .ptt__badge.isOff { background: rgba(239,68,68,0.1); color: #dc2626; }
                .ptt__guruActions { display: flex; gap: 4px; position: absolute; top: 8px; right: 8px; }
                .ptt__iconBtn {
                    width: 28px; height: 28px; border: none; border-radius: 8px;
                    background: rgba(148,163,184,0.1); color: var(--n-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.15s; font-size: 0.8rem;
                }
                .ptt__iconBtn:hover { background: rgba(148,163,184,0.2); color: var(--n-muted); }
                .ptt__iconBtn.danger:hover { background: rgba(239,68,68,0.1); color: #dc2626; }
                
                .ptt__guruActionsInline { display: flex; gap: 4px; justify-content: flex-end; }

                /* Desktop Table */
                .ptt__desktopTable { display: block; overflow-x: auto; padding: 0 4px 12px 4px; }
                .ptt__table { width: 100%; border-collapse: collapse; }
                .ptt__th { text-align: left; padding: 12px 16px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--n-muted); font-weight: 700; border-bottom: 1px solid var(--n-border); }
                .ptt__td { padding: 12px 16px; border-bottom: 1px solid var(--n-border); vertical-align: middle; }
                .ptt__tr:last-child .ptt__td { border-bottom: none; }
                .ptt__tr:hover .ptt__td { background: rgba(148,163,184,0.02); }
                .mobileOnly { display: none; }

                /* Modal */
                .ptt__modalOverlay { pointer-events: auto !important; }
                .ptt__modal {
                    background: var(--n-card); border-radius: 20px; width: 100%; max-width: 480px;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;
                }
                .ptt__modalSm { max-width: 400px; }
                .ptt__modalHead {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 16px 20px; border-bottom: 1px solid var(--n-border);
                }
                .ptt__modalHead h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--n-text); }
                .ptt__modalClose {
                    width: 30px; height: 30px; border: none; border-radius: 8px;
                    background: rgba(148,163,184,0.1); color: var(--n-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.15s;
                }
                .ptt__modalClose:hover { background: rgba(239,68,68,0.1); color: #dc2626; }
                .ptt__required { color: #dc2626; }
                .ptt__modalFoot {
                    display: flex; justify-content: flex-end; gap: 8px;
                    padding: 16px 20px; border-top: 1px solid var(--n-border);
                }

                @media (max-width: 767px) {
                    .ptt__stats { grid-template-columns: 1fr; }

                    .ptt__toolbar { flex-direction: row; flex-wrap: nowrap; align-items: center; justify-content: space-between; gap: 8px; }
                    .ptt__filterGroup { flex: 1; min-width: 0; flex-wrap: nowrap; gap: 6px; }
                    .ptt__select { flex: 1; min-width: 0; padding: 8px 6px; font-size: 0.75rem; }
                    .ptt__toolbarActions { flex-shrink: 0; }
                    .ptt__btn { padding: 8px 12px; font-size: 0.8rem; }
                    
                    .ptt__desktopTable { display: none; }
                    .mobileOnly { display: grid; }
                    
                    .ptt__cardGrid { grid-template-columns: 1fr; }
                    .ptt__modal { margin: 0 16px; }
                }

                /* ===== DARK MODE STANDARD ===== */
                :global(.dark) .ptt__statCard,
                :global(.dark) .ptt__select,
                :global(.dark) .ptt__group,
                :global(.dark) .ptt__guruCard,
                :global(.dark) .ptt__modal,
                :global(.dark) .ptt__empty {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
                }
                :global(.dark) .ptt__select {
                    color: #e2e8f0 !important;
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
                :global(.dark) .ptt__table thead tr,
                :global(.dark) .ptt__th {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .ptt__td {
                    background: #000000 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                    color: #cbd5e1 !important;
                }
                :global(.dark) .ptt__tr:hover .ptt__td {
                    background: rgba(26, 115, 232, 0.08) !important;
                }
                :global(.dark) .ptt__statVal,
                :global(.dark) .ptt__groupTitle,
                :global(.dark) .ptt__guruName,
                :global(.dark) .ptt__modalHead h3 {
                    color: #e2e8f0 !important;
                }
                :global(.dark) .ptt__btnPrimary {
                    background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
                    color: #ffffff !important;
                    border: 1px solid rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
                }
                :global(.dark) .ptt__badge.isOn {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(59, 130, 246, 0.5) !important;
                }
                :global(.dark) .ptt__badge.isOff {
                    background: rgba(239, 68, 68, 0.15) !important;
                    color: #f87171 !important;
                    border: 1px solid rgba(239, 68, 68, 0.4) !important;
                }
                :global(.dark) .ptt__iconBtn {
                    background: #000000 !important;
                    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt__iconBtn:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .ptt__iconBtn.danger {
                    background: #000000 !important;
                    border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .ptt__iconBtn.danger:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .ptt__modalHead {
                    background: #000000 !important;
                    border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
                }
                :global(.dark) .ptt__modalHead h3 {
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt__modalClose {
                    background: #000000 !important;
                    border: 1px solid rgba(37, 99, 235, 0.4) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ptt__modalClose:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                }

                :global(.dark) {
                    --select-bg: #000000;
                    --select-border: rgba(26, 115, 232, 0.75);
                    --select-text: #e2e8f0;
                    --select-menu-bg: #000000;
                }
                :global(.dark) .ptt__btnGhost {
                    background: #000000 !important;
                    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .ptt__btnGhost:hover {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .ptt__modalBody { background: #000000 !important; }
                :global(.dark) .ptt__modalFoot {
                    background: #000000 !important;
                    border-top: 1px solid rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .ptt__formGroup label { color: #94a3b8 !important; }
                /* ===== END DARK MODE STANDARD ===== */

            `}</style>
        </div>
    );
}