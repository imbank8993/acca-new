'use client';

import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalField, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Spinner } from '@/components/ui/Spinner';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import '../informasi.css';

interface Announcement {
    id: number;
    title: string;
    content: string;
    category: string;
    pinned: boolean;
    target_roles: string[] | null;
    created_by: string;
    created_by_nip: string;
    created_at: string;
    updated_at: string;
}

const TARGET_ROLE_OPTIONS = [
    { value: 'GURU', label: 'Guru' },
    { value: 'SISWA', label: 'Siswa' },
    { value: 'ORANG_TUA', label: 'Orang Tua' },
    { value: 'TENDIK', label: 'Tenaga Kependidikan / Staf' },
    { value: 'WKM_AKADEMIK', label: 'WKM Akademik' },
    { value: 'WKM_KESISWAAN', label: 'WKM Kesiswaan' },
    { value: 'WKM_KEASRAMAAN', label: 'WKM Keasramaan' },
    { value: 'WKM_HUMAS', label: 'WKM Humas' },
];

export default function KelolaPengumumanTab({
    user,
    canManage,
    onBack,
}: {
    user: User;
    canManage?: boolean;
    onBack?: () => void;
}) {
    const [list, setList] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Semua');

    // Menu aksi kartu mobile ("...") — cuma satu yang boleh terbuka sekaligus.
    const [openCardMenu, setOpenCardMenu] = useState<number | null>(null);

    useEffect(() => {
        if (!openCardMenu) return;
        const onPointerDown = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.pm-card-menu-wrap')) setOpenCardMenu(null);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [openCardMenu]);

    // CRUD Modal State
    const [showModal, setShowModal] = useState(false);
    const [deleteModalAnn, setDeleteModalAnn] = useState<Announcement | null>(null);
    const [modalMode, setModalMode] = useState<'tambah' | 'edit'>('tambah');
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: 'Umum',
        pinned: false,
        isTargetSpecific: false,
        selectedRoles: [] as string[],
    });

    const categories = ['Semua', 'Umum', 'Akademik', 'Kesiswaan', 'Keasramaan'];

    const filteredList = list.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              item.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'Semua' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const roleParts = Array.isArray(user?.roles) ? user.roles.map(r => r.toUpperCase()) : (user?.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
    const hasAdminRole = roleParts.includes('ADMIN') || roleParts.includes('ADMINISTRATOR') || roleParts.includes('OP_PENGUMUMAN');
    const isAllowed = canManage !== undefined ? canManage : hasAdminRole;

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/pengumuman?manage=true');
            const json = await res.json();
            if (json.ok) {
                setList(json.data || []);
            } else {
                console.error(json.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getAuthHeaders = async () => {
        return {
            'Content-Type': 'application/json'
        };
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.content) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Judul dan isi pengumuman wajib diisi.' });
            return;
        }

        const roles: string[] = formData.isTargetSpecific ? formData.selectedRoles : [];

        const payload = {
            title: formData.title,
            content: formData.content,
            category: formData.category,
            pinned: formData.pinned,
            target_roles: roles.length > 0 ? roles : [],
        };

        try {
            const headers = await getAuthHeaders();
            let url = '/api/pengumuman';
            let method = 'POST';

            if (modalMode === 'edit' && selectedAnnouncement) {
                url = `/api/pengumuman/${selectedAnnouncement.id}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (json.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: modalMode === 'edit' ? 'Pengumuman diperbarui.' : 'Pengumuman dipublikasi.',
                    timer: 1500,
                    showConfirmButton: false
                });
                setShowModal(false);
                fetchData();
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error || 'Terjadi kesalahan.' });
            }
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Koneksi gagal.' });
        }
    };

    const handleTogglePin = async (ann: Announcement) => {
        const updatedList = list.map(item => item.id === ann.id ? { ...item, pinned: !item.pinned } : item);
        setList(updatedList);
        
        try {
            const payload = { ...ann, pinned: !ann.pinned };
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/pengumuman/${ann.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!json.ok) {
                setList(list);
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error || 'Terjadi kesalahan.' });
            } else {
                fetchData();
            }
        } catch (err: any) {
            setList(list);
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Koneksi gagal.' });
        }
    };

    const handleDelete = (ann: Announcement) => {
        setDeleteModalAnn(ann);
    };

    const confirmDelete = async () => {
        if (!deleteModalAnn) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/pengumuman/${deleteModalAnn.id}`, {
                method: 'DELETE',
                headers
            });
            const json = await res.json();
            if (json.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Terhapus',
                    text: 'Pengumuman telah dihapus.',
                    timer: 1500,
                    showConfirmButton: false
                });
                setDeleteModalAnn(null);
                fetchData();
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error || 'Gagal menghapus.' });
            }
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Koneksi gagal.' });
        }
    };

    const openAddModal = () => {
        setModalMode('tambah');
        setSelectedAnnouncement(null);
        setFormData({
            title: '',
            content: '',
            category: 'Umum',
            pinned: false,
            isTargetSpecific: false,
            selectedRoles: []
        });
        setShowModal(true);
    };

    const openEditModal = (ann: Announcement) => {
        setModalMode('edit');
        setSelectedAnnouncement(ann);
        const hasSpecific = Array.isArray(ann.target_roles) && ann.target_roles.length > 0;
        setFormData({
            title: ann.title,
            content: ann.content,
            category: ann.category,
            pinned: ann.pinned,
            isTargetSpecific: hasSpecific,
            selectedRoles: hasSpecific ? [...ann.target_roles!] : []
        });
        setShowModal(true);
    };

    const formatShortDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    };

    return (
        <div className="pm-page-wrap">
            {/* Access Check */}
            {!isAllowed ? (
                <div className="pm-empty" style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                    <i className="bi bi-shield-lock" style={{ fontSize: '4rem', color: 'var(--n-muted)', marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--n-ink)' }}>Akses Ditolak</h3>
                    <p style={{ color: 'var(--n-muted)' }}>Halaman ini hanya untuk Administrator dan Pengelola Pengumuman yang ditunjuk.</p>
                </div>
            ) : (
                <>
                    {/* Filter Toolbar Standard */}
                    <FilterToolbar
                        leading={onBack ? (
                            <button
                                type="button"
                                className="inf-backBtn"
                                onClick={onBack}
                                title="Kembali ke Informasi"
                                aria-label="Kembali ke Informasi"
                            >
                                <i className="bi bi-arrow-left" />
                            </button>
                        ) : undefined}
                    >
                        <FilterSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Cari pengumuman..."
                        />
                        <FilterSelect
                            label="Kategori"
                            icon="funnel"
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                            options={categories.map(c => ({ value: c, label: c }))}
                        />
                    </FilterToolbar>

                    <DesktopFab label="Tambah Pengumuman" icon="plus-lg" onClick={openAddModal} />
                    <MobileFab label="Tambah Pengumuman" icon="plus-lg" onClick={openAddModal} />

                    <div className="pm-admin-panel">
                        <div className="pm-desktop-only">
                            <div className="pm-table-container">
                            <table className="pm-table">
                                <thead>
                                    <tr>
                                        <th>Judul</th>
                                        <th>Kategori</th>
                                        <th>Target Role</th>
                                        <th>Penulis</th>
                                        <th>Tanggal Dibuat</th>
                                        <th className="text-center" style={{ width: '130px' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-4"><Spinner variant="buble" /></td>
                                        </tr>
                                    ) : filteredList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-4 text-muted">Belum ada pengumuman.</td>
                                        </tr>
                                    ) : (
                                        filteredList.map(item => (
                                            <tr key={item.id} className={item.pinned ? 'tr-pinned' : ''}>
                                                <td>
                                                    <div className="pm-title-cell">
                                                        <strong>{item.title}</strong>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`pm-table-tag ${item.category.toLowerCase()}`}>{item.category}</span>
                                                </td>
                                                <td>
                                                    {Array.isArray(item.target_roles) && item.target_roles.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {item.target_roles.map(r => (
                                                                <span key={r} className="pm-role-badge">{r}</span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted" style={{ fontSize: '0.84rem' }}>Semua Role</span>
                                                    )}
                                                </td>
                                                <td>{item.created_by}</td>
                                                <td>{formatShortDate(item.created_at)}</td>
                                                <td className="text-center">
                                                    <ActionGroup>
                                                        <button
                                                            className={`btn-action btn-pin ${item.pinned ? 'is-pinned' : ''}`}
                                                            onClick={() => handleTogglePin(item)}
                                                            title={item.pinned ? 'Lepas Sematan (Unpin)' : 'Sematkan di Atas (Pin)'}
                                                            aria-label={item.pinned ? 'Unpin' : 'Pin'}
                                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', outline: 'none' }}
                                                        >
                                                            <i className={`bi ${item.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}`} style={{ fontSize: '18px', color: item.pinned ? 'var(--n-primary, #3083FF)' : 'var(--n-muted)' }} />
                                                        </button>
                                                        <ActionButton 
                                                            action="edit" 
                                                            onClick={() => openEditModal(item)} 
                                                        />
                                                        <ActionButton 
                                                            action="delete" 
                                                            onClick={() => handleDelete(item)} 
                                                        />
                                                    </ActionGroup>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        </div>

                        <div className="pm-mobile-only">
                            <div className="pm-mobile-list">
                                {loading ? (
                                    <div className="text-center py-4"><Spinner variant="buble" /></div>
                                ) : filteredList.length === 0 ? (
                                    <div className="text-center py-4 text-muted">Belum ada pengumuman.</div>
                                ) : (
                                    filteredList.map(item => (
                                        <div key={item.id} className={`pm-list-item ${item.pinned ? 'is-pinned' : ''}`}>
                                            <div className="pm-list-item-content">
                                                <div className="pm-list-item-title-wrap">
                                                    <h3 className="pm-list-item-title">{item.title}</h3>
                                                </div>
                                                <div className="pm-list-item-meta">
                                                    <span className={`pm-card-tag ${item.category.toLowerCase()}`}>{item.category}</span>
                                                    <span className="pm-role-badge" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                                                        <i className="bi bi-people" style={{ marginRight: '4px' }} />
                                                        {Array.isArray(item.target_roles) && item.target_roles.length > 0 ? item.target_roles.join(', ') : 'Semua'}
                                                    </span>
                                                    <span className="pm-card-date">{formatShortDate(item.created_at)}</span>
                                                </div>
                                            </div>

                                            <div className="pm-list-item-actions">
                                                {item.pinned && <i className="bi bi-pin-angle-fill pm-list-pin-icon" title="Disematkan" />}
                                                <div className="pm-card-menu-wrap">
                                                <button
                                                    type="button"
                                                    className="pm-card-menu-btn pm-list-menu-btn"
                                                    onClick={() => setOpenCardMenu(prev => prev === item.id ? null : item.id)}
                                                    aria-haspopup="menu"
                                                    aria-expanded={openCardMenu === item.id}
                                                    aria-label="Menu aksi"
                                                >
                                                    <i className="bi bi-three-dots-vertical" />
                                                </button>
                                                {openCardMenu === item.id && (
                                                    <div className="pm-card-menu" role="menu">
                                                        <button type="button" role="menuitem" className="pm-card-menu-item" onClick={() => { setOpenCardMenu(null); handleTogglePin(item); }}>
                                                            <i className={`bi ${item.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}`} /> {item.pinned ? 'Lepas Sematan' : 'Sematkan'}
                                                        </button>
                                                        <button type="button" role="menuitem" className="pm-card-menu-item" onClick={() => { setOpenCardMenu(null); openEditModal(item); }}>
                                                            <i className="bi bi-pencil" /> Edit
                                                        </button>
                                                        <button type="button" role="menuitem" className="pm-card-menu-item danger" onClick={() => { setOpenCardMenu(null); handleDelete(item); }}>
                                                            <i className="bi bi-trash3" /> Hapus
                                                        </button>
                                                    </div>
                                                )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </>
            )}

            {/* Add / Edit Modal */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                size="lg"
                variant={modalMode === 'tambah' ? 'add' : 'edit'}
                icon={modalMode === 'tambah' ? 'megaphone-fill' : 'pencil-square'}
                title={modalMode === 'tambah' ? 'Tambah Pengumuman Baru' : 'Edit Pengumuman'}
                subtitle={modalMode === 'tambah' ? 'Buat pengumuman baru untuk ditampilkan di portal informasi dan dashboard.' : 'Perbarui data dan target publikasi pengumuman.'}
            >
                <form onSubmit={handleSave}>
                    <ModalBody>
                        <ModalField label="Judul Pengumuman" required>
                            <input 
                                type="text" 
                                placeholder="Contoh: Jadwal Pembagian Rapor Semester Ganjil"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </ModalField>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'flex-start' }}>
                            <ModalField label="Kategori" required>
                                <InlineSelect
                                    value={formData.category}
                                    onChange={(val) => setFormData({ ...formData, category: val })}
                                    options={[
                                        { value: 'Umum', label: 'Umum' },
                                        { value: 'Akademik', label: 'Akademik' },
                                        { value: 'Kesiswaan', label: 'Kesiswaan' },
                                        { value: 'Keasramaan', label: 'Keasramaan' },
                                    ]}
                                    minWidth="100%"
                                />
                            </ModalField>

                            <ModalField label="Pin / Prioritas">
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: 'var(--n-ink)', height: '38px' }}>
                                    <input 
                                        type="checkbox"
                                        checked={formData.pinned}
                                        onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                                        style={{ width: '16px', height: '16px', accentColor: 'var(--p-ink, #0284c7)', cursor: 'pointer' }}
                                    />
                                    <i className="bi bi-pin-angle-fill" style={{ color: formData.pinned ? 'var(--n-primary, #3083FF)' : 'var(--n-ink-muted)' }}></i>
                                    Sematkan di bagian atas
                                </label>
                            </ModalField>
                        </div>

                        <ModalField label="Target Publikasi" hint="Pilih siapa yang dapat melihat pengumuman ini">
                            <div style={{ display: 'flex', gap: '24px', margin: '4px 0 10px 0', flexWrap: 'wrap' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500, color: 'var(--n-ink)' }}>
                                    <input 
                                        type="radio" 
                                        name="targetPublikasi"
                                        checked={!formData.isTargetSpecific} 
                                        onChange={() => setFormData({ ...formData, isTargetSpecific: false, selectedRoles: [] })} 
                                        style={{ accentColor: 'var(--p-ink, #0284c7)', cursor: 'pointer' }}
                                    />
                                    Semua Pengguna (Publik)
                                </label>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500, color: 'var(--n-ink)' }}>
                                    <input 
                                        type="radio" 
                                        name="targetPublikasi"
                                        checked={formData.isTargetSpecific} 
                                        onChange={() => setFormData({ ...formData, isTargetSpecific: true })} 
                                        style={{ accentColor: 'var(--p-ink, #0284c7)', cursor: 'pointer' }}
                                    />
                                    Target Role Tertentu
                                </label>
                            </div>

                            {formData.isTargetSpecific && (
                                <div style={{ 
                                    padding: '12px 14px', 
                                    background: 'var(--n-surface-subtle, #f8fafc)', 
                                    borderRadius: '10px', 
                                    border: '1px solid var(--n-border, #e2e8f0)', 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                    gap: '10px' 
                                }}>
                                    {TARGET_ROLE_OPTIONS.map(r => {
                                        const checked = formData.selectedRoles.includes(r.value);
                                        return (
                                            <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', color: 'var(--n-ink)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const next = e.target.checked
                                                            ? [...formData.selectedRoles, r.value]
                                                            : formData.selectedRoles.filter(x => x !== r.value);
                                                        setFormData({ ...formData, selectedRoles: next });
                                                    }}
                                                    style={{ accentColor: 'var(--p-ink, #0284c7)', cursor: 'pointer' }}
                                                />
                                                {r.label}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </ModalField>

                        <ModalField label="Isi Pengumuman" required>
                            <textarea 
                                rows={6}
                                placeholder="Tuliskan isi pengumuman secara lengkap di sini..."
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                required
                            />
                        </ModalField>
                    </ModalBody>
                    <ModalFooter align="end">
                        <Button type="button" variant="cancel" onClick={() => setShowModal(false)}>
                            Batal
                        </Button>
                        <Button type="submit" variant="primary" icon="save">
                            {modalMode === 'tambah' ? 'Publikasikan' : 'Simpan Perubahan'}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Delete Modal */}
            <Modal
                open={!!deleteModalAnn}
                onClose={() => setDeleteModalAnn(null)}
                size="sm"
                variant="delete"
                icon="trash3"
                title="Hapus Pengumuman?"
            >
                <ModalBody>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                        <div><strong>Judul:</strong> {deleteModalAnn?.title}</div>
                        <div><strong>Kategori:</strong> {deleteModalAnn?.category}</div>
                        <div style={{ color: '#dc2626', fontWeight: 600, marginTop: '6px' }}>
                            Data pengumuman ini akan dihapus secara permanen. Lanjutkan?
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter align="end">
                    <Button type="button" variant="cancel" onClick={() => setDeleteModalAnn(null)}>
                        Batal
                    </Button>
                    <Button type="button" variant="danger" onClick={confirmDelete} icon="delete">
                        Hapus
                    </Button>
                </ModalFooter>
            </Modal>

            <MaintenanceBanner pageKey="maintenance_pengumuman" />
        </div>
    );
}
