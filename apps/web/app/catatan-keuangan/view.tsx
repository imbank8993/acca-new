'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { getCurrentUser } from '@/lib/auth-client';
import { ApiResponse } from '@/lib/types';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import './catatan-keuangan.css';

interface CatatanKeuangan {
    id: string;
    nama_guru: string;
    nip: string | null;
    nama_kegitan: string;
    item: string;
    nominal: number;
    keterangan: string | null;
    status: 'BELUM_TERGANTI' | 'TERGANTI';
    tahun_ajaran: string | null;
    tanggal?: string | null;
    created_at: string;
}

interface Guru {
    nip: string;
    nama_lengkap: string;
}

function parseNominal(val: any): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    }
    if (val && typeof val === 'object') {
        if (Array.isArray(val.d) && typeof val.e === 'number') {
            const sign = val.s < 0 ? -1 : 1;
            const digits = val.d.join('');
            return sign * Number(digits) * Math.pow(10, (val.e ?? 0) - (digits.length - 1));
        }
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }
    return 0;
}

export default function CatatanKeuanganPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<CatatanKeuangan[]>([]);
    const [guruList, setGuruList] = useState<Guru[]>([]);
    const [guruSearch, setGuruSearch] = useState('');
    const [showGuruDropdown, setShowGuruDropdown] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [deletingItem, setDeletingItem] = useState<CatatanKeuangan | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState<string>('');
    const guruDropdownRef = useRef<HTMLDivElement>(null);
    const { openModal, closeModal } = useModalBlur();

    const ta = useTahunAjaranFilter();

    const tahunOptions = useMemo(() => {
        const setYears = new Set<string>();
        ta.years.forEach(y => setYears.add(y));
        setYears.add('2025/2026');
        setYears.add('2026/2027');
        const sorted = Array.from(setYears).sort((a, b) => b.localeCompare(a));
        return [
            { value: '', label: 'Semua Tahun' },
            ...sorted.map(y => ({ value: y, label: y }))
        ];
    }, [ta.years]);

    const isBendaharaOrAdmin = useMemo(() => {
        if (!user) return false;
        const roles: string[] = (Array.isArray(user.roles) ? user.roles : [user.role || ''])
            .filter(Boolean).map((r: string) => r.toString().toUpperCase());
        return roles.some(r => r.includes('ADMIN')) || roles.includes('BENDAHARA_KOMITE') || !!(user as any).isAdmin;
    }, [user]);

    useEffect(() => {
        if (showModal) openModal(); else closeModal();
    }, [showModal, openModal, closeModal]);

    const [formData, setFormData] = useState({
        nama_guru: '', nip: '', nama_kegitan: '', item: '',
        nominal: '', keterangan: '', status: 'BELUM_TERGANTI', tanggal: ''
    });

    const filteredGuru = useMemo(() => {
        if (!guruSearch) return guruList;
        const search = guruSearch.toLowerCase();
        return guruList.filter(g =>
            (g.nama_lengkap || '').toLowerCase().includes(search) ||
            (g.nip || '').toLowerCase().includes(search)
        );
    }, [guruList, guruSearch]);

    const totals = useMemo(() => {
        const filtered = filterStatus ? data.filter(d => d.status === filterStatus) : data;
        return {
            total: filtered.reduce((sum, item) => sum + parseNominal(item.nominal), 0),
            terganti: filtered.filter(d => d.status === 'TERGANTI').reduce((sum, item) => sum + parseNominal(item.nominal), 0),
            belum: filtered.filter(d => d.status === 'BELUM_TERGANTI').reduce((sum, item) => sum + parseNominal(item.nominal), 0)
        };
    }, [data, filterStatus]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedTahunAjaran && selectedTahunAjaran !== 'Semua') {
                params.set('tahun_ajaran', selectedTahunAjaran);
            }
            if (filterStatus) {
                params.set('status', filterStatus);
            }
            const res = await fetch(`/api/catatan-keuangan?${params.toString()}`);
            const json: ApiResponse & { data?: { records: CatatanKeuangan[] } } = await res.json();
            if (json.ok) {
                const records = (json.data?.records || []).map((r: CatatanKeuangan) => ({
                    ...r,
                    nominal: parseNominal(r.nominal)
                }));
                setData(records);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedTahunAjaran, filterStatus]);

    useEffect(() => {
        const init = async () => {
            const userData = await getCurrentUser();
            if (userData) {
                setUser(userData);
            }
            loadGuru();
        };
        init();
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (guruDropdownRef.current && !guruDropdownRef.current.contains(event.target as Node)) {
                setShowGuruDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadGuru = async () => {
        try {
            const res = await fetch('/api/master/guru?limit=500');
            const json = await res.json();
            if (json.ok) setGuruList(json.data || []);
        } catch (e) { console.error(e); }
    };

    const handleSelectGuru = (guru: Guru) => {
        setFormData(prev => ({ ...prev, nama_guru: guru.nama_lengkap, nip: guru.nip }));
        setGuruSearch(guru.nama_lengkap);
        setShowGuruDropdown(false);
    };

    const resetForm = () => {
        setEditingId(null);
        setGuruSearch('');
        const todayStr = new Date().toISOString().split('T')[0];
        setFormData({
            nama_guru: isBendaharaOrAdmin ? '' : (user?.nama || user?.nama_lengkap || ''),
            nip: isBendaharaOrAdmin ? '' : (user?.nip || ''),
            nama_kegitan: '',
            item: '',
            nominal: '',
            keterangan: '',
            status: 'BELUM_TERGANTI',
            tanggal: todayStr
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const namaGuru = isBendaharaOrAdmin ? formData.nama_guru.trim() : (user?.nama || user?.nama_lengkap || formData.nama_guru || '').trim();
        const nipGuru = isBendaharaOrAdmin ? (formData.nip ? formData.nip.trim() : null) : (user?.nip || null);
        const nominalNum = parseFloat(formData.nominal);

        if (!namaGuru || !formData.nama_kegitan.trim() || !formData.item.trim() || isNaN(nominalNum) || nominalNum <= 0) {
            Swal.fire({ icon: 'warning', text: 'Mohon lengkapi formulir dengan nominal angka lebih dari 0' });
            return;
        }

        const payload = {
            nama_guru: namaGuru,
            nip: nipGuru,
            nama_kegitan: formData.nama_kegitan.trim(),
            item: formData.item.trim(),
            nominal: nominalNum,
            keterangan: formData.keterangan ? formData.keterangan.trim() : '',
            status: isBendaharaOrAdmin ? formData.status : 'BELUM_TERGANTI',
            tahun_ajaran: selectedTahunAjaran || ta.selected || user?.tahun_ajaran || '2025/2026',
            tanggal: formData.tanggal || ''
        };

        try {
            let res;
            if (editingId) {
                res = await fetch('/api/catatan-keuangan', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingId, ...payload })
                });
            } else {
                res = await fetch('/api/catatan-keuangan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            const json = await res.json();
            if (json.ok) {
                Swal.fire({ icon: 'success', title: editingId ? 'Berhasil diubah' : 'Berhasil ditambahkan', timer: 1500 });
                setShowModal(false);
                resetForm();
                loadData();
            } else {
                throw new Error(json.error || 'Terjadi kesalahan');
            }
        } catch (err: any) {
            Swal.fire({ icon: 'error', text: err.message });
        }
    };

    const handleEdit = (item: CatatanKeuangan) => {
        if (item.status === 'TERGANTI' && !isBendaharaOrAdmin) {
            Swal.fire({ icon: 'warning', text: 'Catatan yang sudah terganti (cair) tidak dapat diubah.' });
            return;
        }
        setEditingId(item.id);
        const parsedNom = parseNominal(item.nominal);
        setFormData({
            nama_guru: item.nama_guru,
            nip: item.nip || '',
            nama_kegitan: item.nama_kegitan,
            item: item.item,
            nominal: parsedNom > 0 ? String(parsedNom) : '',
            keterangan: item.keterangan || '',
            status: item.status,
            tanggal: item.tanggal ? item.tanggal.split('T')[0] : ''
        });
        setGuruSearch(item.nama_guru);
        setShowModal(true);
    };

    const handleDelete = (item: CatatanKeuangan) => {
        if (item.status === 'TERGANTI' && !isBendaharaOrAdmin) {
            Swal.fire({ icon: 'warning', text: 'Catatan yang sudah terganti (cair) tidak dapat dihapus karena dana telah keluar dari kas.' });
            return;
        }
        setDeletingItem(item);
    };

    const confirmDelete = async () => {
        if (!deletingItem) return;
        try {
            const res = await fetch(`/api/catatan-keuangan?id=${deletingItem.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (res.ok && json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
                setDeletingItem(null);
                loadData();
            } else {
                Swal.fire({ icon: 'error', text: json.error || 'Gagal menghapus' });
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', text: e.message || 'Gagal menghapus' });
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        if (!isBendaharaOrAdmin) return;
        try {
            const res = await fetch('/api/catatan-keuangan', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            });
            const json = await res.json();
            if (res.ok && json.ok) {
                loadData();
            } else {
                Swal.fire({ icon: 'error', text: json.error || 'Gagal mengubah status' });
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', text: e.message || 'Gagal mengubah status' });
        }
    };

    const formatCurrency = (num: any) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseNominal(num));

    const filteredData = useMemo(() => {
        let result = data;
        if (filterStatus) {
            result = result.filter(d => d.status === filterStatus);
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(d => 
                (d.nama_guru && d.nama_guru.toLowerCase().includes(query)) ||
                (d.nama_kegitan && d.nama_kegitan.toLowerCase().includes(query)) ||
                (d.item && d.item.toLowerCase().includes(query))
            );
        }
        return result;
    }, [data, filterStatus, searchQuery]);

    if (loading && data.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Spinner variant="trace" />
            </div>
        );
    }

    return (
        <>
            <MaintenanceBanner pageKey="maintenance_catatan_keuangan">
            <div className="ck">
                {/* Aksi utama halaman */}
                <DesktopFab label="Tambah Catatan" icon="plus-lg" onClick={() => { resetForm(); setShowModal(true); }} />
                <MobileFab label="Tambah Catatan" icon="plus-lg" onClick={() => { resetForm(); setShowModal(true); }} />

                {/* CONTENT CONTAINER */}
                <div className="ck-container">

                    {/* STATS */}
                    <div className="ck-stats">
                        <div className="ck-stat">
                            <div className="ck-stat-icon ck-stat-icon--blue">
                                <i className="fa-solid fa-wallet"></i>
                            </div>
                            <div className="ck-stat-info">
                                <span className="ck-stat-value">{formatCurrency(totals.total)}</span>
                                <span className="ck-stat-label">Total Pengeluaran</span>
                            </div>
                        </div>
                        <div className="ck-stat">
                            <div className="ck-stat-icon ck-stat-icon--green">
                                <i className="fa-solid fa-check-circle"></i>
                            </div>
                            <div className="ck-stat-info">
                                <span className="ck-stat-value">{formatCurrency(totals.terganti)}</span>
                                <span className="ck-stat-label">Terganti (Cair)</span>
                            </div>
                        </div>
                        <div className="ck-stat">
                            <div className="ck-stat-icon ck-stat-icon--red">
                                <i className="fa-solid fa-clock"></i>
                            </div>
                            <div className="ck-stat-info">
                                <span className="ck-stat-value">{formatCurrency(totals.belum)}</span>
                                <span className="ck-stat-label">Belum Diganti</span>
                            </div>
                        </div>
                    </div>

                    {/* FILTER TOOLBAR */}
                    <FilterToolbar>
                        <FilterSelect
                            label="Tahun Ajaran"
                            icon="mortarboard"
                            value={selectedTahunAjaran}
                            onChange={(val) => setSelectedTahunAjaran(val)}
                            options={tahunOptions}
                        />
                        <FilterSelect
                            label="Status"
                            icon="funnel"
                            value={filterStatus}
                            onChange={(val) => setFilterStatus(val)}
                            options={[
                                { value: '', label: 'Semua Status' },
                                { value: 'BELUM_TERGANTI', label: 'Belum Terganti' },
                                { value: 'TERGANTI', label: 'Terganti (Cair)' }
                            ]}
                        />
                        <FilterSearch 
                            value={searchQuery}
                            onChange={(val) => setSearchQuery(val)}
                            placeholder="Cari guru, kegiatan, atau item..."
                        />
                    </FilterToolbar>

                    {/* CONTENT AREA */}
                    <div className="ck-content">

                    {/* DESKTOP TABLE */}
                    <div className="ck-table-wrap">
                        <table className="ck-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Tgl Transaksi</th>
                                    <th>Nama Guru</th>
                                    <th>Kegiatan & Item</th>
                                    <th>Nominal</th>
                                    <th>Status</th>
                                    <th>Keterangan</th>
                                    <th className="ck-th-action text-center" style={{ width: '110px' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={8} className="ck-empty"><i className="fa-solid fa-inbox"></i><p>Belum ada data catatan keuangan</p></td></tr>
                                ) : filteredData.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td><span className="ck-no">{idx + 1}</span></td>
                                        <td><span className="ck-cell">{item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                                        <td>
                                            <div className="ck-name-wrap">
                                                <span className="ck-name-wrap-name">{item.nama_guru}</span>
                                                {item.nip && <span className="ck-name-wrap-nip">{item.nip}</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span className="ck-cell" style={{ fontWeight: 600 }}>{item.nama_kegitan}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--n-muted)' }}>{item.item}</span>
                                            </div>
                                        </td>
                                        <td><span className="ck-nominal">{formatCurrency(item.nominal)}</span></td>
                                        <td>
                                            {isBendaharaOrAdmin ? (
                                                <span
                                                    className={`ck-badge ${item.status === 'TERGANTI' ? 'ck-badge--green' : 'ck-badge--red'}`}
                                                    onClick={() => handleStatusChange(item.id, item.status === 'TERGANTI' ? 'BELUM_TERGANTI' : 'TERGANTI')}
                                                    style={{ cursor: 'pointer' }}
                                                    title="Klik untuk mengubah status pembayaran"
                                                >
                                                    {item.status === 'TERGANTI' ? 'Terganti' : 'Belum'}
                                                </span>
                                            ) : (
                                                <span
                                                    className={`ck-badge ${item.status === 'TERGANTI' ? 'ck-badge--green' : 'ck-badge--red'}`}
                                                    style={{ cursor: 'default' }}
                                                    title={item.status === 'TERGANTI' ? 'Telah diganti oleh Bendahara Komite' : 'Menunggu penggantian dari Bendahara'}
                                                >
                                                    {item.status === 'TERGANTI' ? 'Terganti' : 'Belum'}
                                                </span>
                                            )}
                                        </td>
                                        <td><span className="ck-cell">{item.keterangan || '-'}</span></td>
                                        <td className="ck-td-action text-center">
                                            {item.status === 'TERGANTI' && !isBendaharaOrAdmin ? (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontStyle: 'italic' }}>Terkunci</span>
                                            ) : (
                                                <ActionGroup>
                                                    <ActionButton action="edit" tooltipPos="bottom" onClick={() => handleEdit(item)} />
                                                    <ActionButton action="delete" tooltipPos="bottom" onClick={() => handleDelete(item)} />
                                                </ActionGroup>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* MOBILE LIST */}
                    <div className="ck-mobile-only">
                        <div className="ck-mobile-list">
                            {filteredData.length === 0 ? (
                                <div className="text-center py-4 text-muted"><i className="bi bi-inbox fa-2x mb-2 d-block"></i>Belum ada data catatan keuangan</div>
                            ) : filteredData.map((item) => (
                                <div key={item.id} className="ck-list-item">
                                    <div className="ck-list-item-main">
                                        <h3 className="ck-list-item-title">{item.nama_kegitan}</h3>
                                        <div className="ck-list-item-meta">
                                            {item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} • {item.nama_guru}
                                            {isBendaharaOrAdmin ? (
                                                <span
                                                    className={`ck-badge ${item.status === 'TERGANTI' ? 'ck-badge--green' : 'ck-badge--red'}`}
                                                    onClick={() => handleStatusChange(item.id, item.status === 'TERGANTI' ? 'BELUM_TERGANTI' : 'TERGANTI')}
                                                    style={{ cursor: 'pointer', marginLeft: '6px' }}
                                                    title="Klik untuk mengubah status pembayaran"
                                                >
                                                    {item.status === 'TERGANTI' ? 'Terganti' : 'Belum'}
                                                </span>
                                            ) : (
                                                <span
                                                    className={`ck-badge ${item.status === 'TERGANTI' ? 'ck-badge--green' : 'ck-badge--red'}`}
                                                    style={{ cursor: 'default', marginLeft: '6px' }}
                                                    title={item.status === 'TERGANTI' ? 'Telah diganti oleh Bendahara Komite' : 'Menunggu penggantian dari Bendahara'}
                                                >
                                                    {item.status === 'TERGANTI' ? 'Terganti' : 'Belum'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="ck-list-item-meta" style={{ marginTop: '4px', fontWeight: 600, color: 'var(--n-ink)' }}>
                                            {item.item} • {formatCurrency(item.nominal)}
                                        </div>
                                    </div>
                                    <div className="ck-list-item-action">
                                        {item.status === 'TERGANTI' && !isBendaharaOrAdmin ? (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontStyle: 'italic' }}>Terkunci</span>
                                        ) : (
                                            <>
                                                <button className="ck-list-menu-btn" onClick={() => handleEdit(item)}><i className="bi bi-pencil" /></button>
                                                <button className="ck-list-menu-btn text-danger" onClick={() => handleDelete(item)}><i className="bi bi-trash" /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>

                {/* ADD / EDIT MODAL */}
                <Modal
                    open={showModal}
                    onClose={() => setShowModal(false)}
                    title={editingId ? 'Edit Catatan Keuangan' : 'Tambah Catatan Keuangan'}
                >
                    <form onSubmit={handleSubmit}>
                        <ModalBody>
                            {isBendaharaOrAdmin ? (
                                <div className="ck-form-group" ref={guruDropdownRef} style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Nama Guru *</label>
                                    <input
                                        type="text"
                                        className="ck-form-input"
                                        value={guruSearch}
                                        onChange={e => {
                                            setGuruSearch(e.target.value);
                                            setShowGuruDropdown(true);
                                            const selected = guruList.find(g => g.nama_lengkap === e.target.value);
                                            if (selected) setFormData(prev => ({ ...prev, nama_guru: selected.nama_lengkap, nip: selected.nip }));
                                        }}
                                        onFocus={() => setShowGuruDropdown(true)}
                                        placeholder="Cari nama guru..."
                                        required
                                    />
                                    {showGuruDropdown && filteredGuru.length > 0 && (
                                        <div className="ck-dropdown">
                                            {filteredGuru.slice(0, 10).map(g => (
                                                <div key={g.nip} className="ck-dropdown-item" onClick={() => handleSelectGuru(g)}>
                                                    <div className="ck-dropdown-name">{g.nama_lengkap}</div>
                                                    <div className="ck-dropdown-nip">{g.nip}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Nama Guru</label>
                                    <input
                                        type="text"
                                        className="ck-form-input"
                                        value={user?.nama || user?.nama_lengkap || formData.nama_guru}
                                        readOnly
                                        disabled
                                        style={{ backgroundColor: 'var(--n-card-hover)', cursor: 'not-allowed' }}
                                    />
                                    <small style={{ color: 'var(--n-muted)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                                        Identitas terisi otomatis sesuai akun guru yang sedang login.
                                    </small>
                                </div>
                            )}

                            <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>NIP</label>
                                <input
                                    type="text"
                                    className="ck-form-input"
                                    value={isBendaharaOrAdmin ? formData.nip : (user?.nip || formData.nip || '-')}
                                    readOnly
                                    disabled
                                    placeholder="Otomatis"
                                    style={{ backgroundColor: 'var(--n-card-hover)', cursor: 'not-allowed' }}
                                />
                            </div>

                            <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Tanggal Transaksi</label>
                                <input
                                    type="date"
                                    className="ck-form-input"
                                    value={formData.tanggal || ''}
                                    onChange={e => setFormData({ ...formData, tanggal: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Nama Kegiatan *</label>
                                <input
                                    type="text"
                                    className="ck-form-input"
                                    value={formData.nama_kegitan}
                                    onChange={e => setFormData({ ...formData, nama_kegitan: e.target.value })}
                                    placeholder="Contoh: Study Tour / Pembelian ATK Ujian"
                                    maxLength={255}
                                    required
                                />
                            </div>

                            <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Item Pengeluaran / Pembayaran *</label>
                                <input
                                    type="text"
                                    className="ck-form-input"
                                    value={formData.item}
                                    onChange={e => setFormData({ ...formData, item: e.target.value })}
                                    placeholder="Contoh: Tiket Masuk / Kertas HVS 5 Rim"
                                    maxLength={255}
                                    required
                                />
                            </div>

                            <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Nominal (Rp) *</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="1000000000"
                                    className="ck-form-input"
                                    value={formData.nominal}
                                    onChange={e => setFormData({ ...formData, nominal: e.target.value })}
                                    placeholder="Contoh: 150000"
                                    required
                                />
                            </div>

                            {isBendaharaOrAdmin ? (
                                <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Status Penggantian</label>
                                    <select
                                        className="ck-form-input"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    >
                                        <option value="BELUM_TERGANTI">Belum Terganti</option>
                                        <option value="TERGANTI">Terganti (Cair)</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="ck-form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Status</label>
                                    <input
                                        type="text"
                                        className="ck-form-input"
                                        value={formData.status === 'TERGANTI' ? 'Terganti (Cair)' : 'Belum Terganti (Menunggu Verifikasi)'}
                                        readOnly
                                        disabled
                                        style={{ backgroundColor: 'var(--n-card-hover)', cursor: 'not-allowed' }}
                                    />
                                </div>
                            )}

                            <div className="ck-form-group">
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Keterangan Tambahan</label>
                                <textarea
                                    className="ck-form-input"
                                    value={formData.keterangan || ''}
                                    onChange={e => setFormData({ ...formData, keterangan: e.target.value })}
                                    placeholder="Rincian nota atau keterangan pendukung (opsional)"
                                    maxLength={2000}
                                    rows={3}
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                                Batal
                            </Button>
                            <Button type="submit" variant="primary">
                                {editingId ? 'Simpan Perubahan' : 'Simpan'}
                            </Button>
                        </ModalFooter>
                    </form>
                </Modal>

                {/* DELETE MODAL */}
                <Modal
                    open={!!deletingItem}
                    onClose={() => setDeletingItem(null)}
                    title="Konfirmasi Hapus Catatan"
                >
                    <ModalBody>
                        <p style={{ fontSize: '0.92rem', color: 'var(--n-ink)' }}>
                            Apakah Anda yakin ingin menghapus catatan kegiatan <strong>"{deletingItem?.nama_kegitan}"</strong> ({deletingItem?.nama_guru})?
                        </p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--n-muted)', marginTop: '6px' }}>
                            Data yang dihapus tidak dapat dikembalikan.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button type="button" variant="secondary" onClick={() => setDeletingItem(null)}>
                            Batal
                        </Button>
                        <Button type="button" variant="danger" onClick={confirmDelete}>
                            Ya, Hapus
                        </Button>
                    </ModalFooter>
                </Modal>
            </div>
            </MaintenanceBanner>
        </>
    );
}
