'use client';

import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { Spinner } from '@/components/ui/Spinner';
import type { CatatanSiswa } from '@/lib/types';
import './bimbingan-konseling.css';

function getLocalDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function authFetch(url: string, options: RequestInit = {}) {
    return fetch(url, options);
}

const STATUS_OPTIONS = [
    { value: '', label: 'Semua Status' },
    { value: 'BARU', label: 'Baru' },
    { value: 'DITINDAKLANJUTI', label: 'Ditindaklanjuti' },
    { value: 'SELESAI', label: 'Selesai' },
];

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function BimbinganKonselingPage({ user }: { user?: any }) {
    const today = getLocalDate();
    const [kelasOptions, setKelasOptions] = useState<string[]>([]);
    const [kelas, setKelas] = useState('');
    const [filterBulan, setFilterBulan] = useState(0); // 1-12, 0 = semua bulan (default)
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [jenis, setJenis] = useState<'' | 'POSITIF' | 'NEGATIF'>('');
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');

    const [items, setItems] = useState<CatatanSiswa[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CatatanSiswa | null>(null);
    const [tlText, setTlText] = useState('');
    const [tlStatus, setTlStatus] = useState<'DITINDAKLANJUTI' | 'SELESAI'>('DITINDAKLANJUTI');
    const [submitting, setSubmitting] = useState(false);

    // Modal States & Handlers
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [modalMode, setModalMode] = useState<'tambah' | 'edit'>('tambah');
    const [deleteItem, setDeleteItem] = useState<CatatanSiswa | null>(null);
    const [addEditForm, setAddEditForm] = useState({
        nama_siswa: '',
        kelas: '',
        tanggal: today,
        jenis: 'POSITIF' as 'POSITIF' | 'NEGATIF',
        catatan: ''
    });

    const openAddModal = () => {
        setModalMode('tambah');
        setAddEditForm({
            nama_siswa: '',
            kelas: kelasOptions[0] || '',
            tanggal: today,
            jenis: 'POSITIF',
            catatan: ''
        });
        setShowAddEditModal(true);
    };

    const openEditModal = (item: CatatanSiswa) => {
        setModalMode('edit');
        setAddEditForm({
            nama_siswa: item.nama_snapshot || '',
            kelas: item.kelas || '',
            tanggal: item.tanggal || today,
            jenis: item.jenis || 'POSITIF',
            catatan: item.catatan || ''
        });
        setShowAddEditModal(true);
    };

    const handleSaveAddEdit = (e: React.FormEvent) => {
        e.preventDefault();
        Swal.fire({
            icon: 'success',
            title: 'Berhasil',
            text: modalMode === 'tambah' ? 'Catatan konseling baru berhasil ditambahkan.' : 'Catatan konseling berhasil diperbarui.',
            timer: 1500,
            showConfirmButton: false
        });
        setShowAddEditModal(false);
    };

    const confirmDelete = () => {
        if (!deleteItem) return;
        Swal.fire({
            icon: 'success',
            title: 'Terhapus',
            text: 'Catatan bimbingan konseling berhasil dihapus.',
            timer: 1500,
            showConfirmButton: false
        });
        setDeleteItem(null);
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/master/kelas?limit=500');
                if (res.ok) {
                    const data = await res.json();
                    const opts = (data.data || []).map((k: any) => k.nama as string).filter(Boolean).sort();
                    setKelasOptions(opts);
                }
            } catch (e) { console.error(e); }
        })();
    }, []);

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (kelas) params.set('kelas', kelas);
            if (filterBulan > 0) {
                const bulanStr = `${filterTahun}-${String(filterBulan).padStart(2, '0')}`;
                const lastDay = new Date(filterTahun, filterBulan, 0).getDate();
                params.set('tanggal_from', `${bulanStr}-01`);
                params.set('tanggal_to', `${bulanStr}-${String(lastDay).padStart(2, '0')}`);
            } else {
                params.set('tanggal_from', `${filterTahun}-01-01`);
                params.set('tanggal_to', `${filterTahun}-12-31`);
            }
            if (jenis) params.set('jenis', jenis);
            if (status) params.set('status', status);
            if (q) params.set('q', q);

            const res = await authFetch(`/api/catatan-siswa?${params.toString()}`);
            const json = await res.json();
            if (json.ok) setItems(json.data || []);
            else setItems([]);
        } catch (e) {
            console.error(e);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [kelas, filterBulan, filterTahun, jenis, status, q]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const formatDate = (d: string) => {
        if (!d) return '-';
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    };

    const statusLabel = (s: string) => {
        if (s === 'SELESAI') return { label: 'Selesai', cls: 'bk-status--selesai' };
        if (s === 'DITINDAKLANJUTI') return { label: 'Ditindaklanjuti', cls: 'bk-status--proses' };
        return { label: 'Baru', cls: 'bk-status--baru' };
    };

    function openDetail(item: CatatanSiswa) {
        setSelectedItem(item);
        setTlText('');
        setTlStatus(item.status === 'DITINDAKLANJUTI' ? 'SELESAI' : 'DITINDAKLANJUTI');
    }

    async function handleSubmitTindakLanjut() {
        if (!selectedItem) return;
        if (!tlText.trim()) {
            Swal.fire({ icon: 'warning', title: 'Catatan kosong', text: 'Tulis catatan tindak lanjut terlebih dahulu.' });
            return;
        }
        setSubmitting(true);
        try {
            const res = await authFetch(`/api/catatan-siswa/${selectedItem.id}/tindak-lanjut`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ catatan: tlText.trim(), status_baru: tlStatus })
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menyimpan tindak lanjut');
            setSelectedItem(json.data);
            setTlText('');
            await loadItems();
            Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Tindak lanjut berhasil disimpan.', timer: 1500, showConfirmButton: false });
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <MaintenanceBanner pageKey="maintenance_bimbingan_konseling">
            <div className="bk-page-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                

                {/* Aksi utama halaman: FAB melayang di desktop; di mobile tombol tambah
                    jadi ikon tengah bottom-nav menggantikan ikon Menu — MobileFab
                    sendiri tidak merender apa pun, cuma mendaftarkan aksinya. */}
                <DesktopFab label="Tambah Catatan" icon="plus-lg" onClick={openAddModal} />
                <MobileFab label="Tambah Catatan" icon="plus-lg" onClick={openAddModal} />

                <FilterToolbar>
                    <FilterSelect
                        label="Kelas"
                        icon="funnel"
                        value={kelas}
                        onChange={setKelas}
                        options={[
                            { value: '', label: 'Semua Kelas' },
                            ...kelasOptions.map(k => ({ value: k, label: k }))
                        ]}
                    />
                    <FilterSelect
                        label="Bulan"
                        icon="calendar-event"
                        value={String(filterBulan)}
                        onChange={(val) => setFilterBulan(Number(val))}
                        options={[
                            { value: '0', label: 'Semua Bulan' },
                            ...BULAN.map((b, i) => ({ value: String(i + 1), label: b }))
                        ]}
                    />
                    <FilterSelect
                        label="Tahun"
                        icon="calendar3"
                        value={String(filterTahun)}
                        onChange={(val) => setFilterTahun(Number(val))}
                        options={Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
                            .map(y => ({ value: String(y), label: String(y) }))}
                    />
                    <FilterSelect
                        label="Jenis Catatan"
                        icon="emoji-smile"
                        value={jenis}
                        onChange={(val) => setJenis(val as any)}
                        options={[
                            { value: '', label: 'Semua Jenis' },
                            { value: 'POSITIF', label: 'Positif (+)' },
                            { value: 'NEGATIF', label: 'Negatif (-)' }
                        ]}
                    />
                    <FilterSelect
                        label="Status"
                        icon="tag"
                        value={status}
                        onChange={setStatus}
                        options={STATUS_OPTIONS}
                    />
                    <FilterSearch
                        value={q}
                        onChange={setQ}
                        placeholder="Cari siswa..."
                    />
                </FilterToolbar>

                {/* Desktop Table View */}
                <div className="bk-table-wrap bk-desktop-only">
                    {loading ? (
                        <div className="bk-state" style={{ padding: '32px 0' }}><Spinner variant="trace" /></div>
                    ) : items.length === 0 ? (
                        <div className="bk-state">
                            <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.4 }}></i>
                            <p>Tidak ada catatan pada rentang/filter ini.</p>
                        </div>
                    ) : (
                        <table className="bk-table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Siswa</th>
                                    <th>Jenis</th>
                                    <th>Catatan</th>
                                    <th>Guru Pencatat</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => {
                                    const st = statusLabel(it.status);
                                    return (
                                        <tr key={it.id}>
                                            <td>{formatDate(it.tanggal)}</td>
                                            <td>
                                                <div className="bk-siswa-nama">{it.nama_snapshot}</div>
                                                <div className="bk-siswa-kelas">{it.kelas}</div>
                                            </td>
                                            <td>
                                                <span className={`bk-badge bk-badge--${it.jenis.toLowerCase()}`} title={it.jenis === 'POSITIF' ? 'Positif (+)' : 'Negatif (-)'}>
                                                    <i className={`bi ${it.jenis === 'POSITIF' ? 'bi-emoji-smile-fill' : 'bi-emoji-frown-fill'}`}></i>
                                                    <span>{it.jenis === 'POSITIF' ? '+' : '-'}</span>
                                                </span>
                                            </td>
                                            <td className="bk-catatan-cell">{it.catatan}</td>
                                            <td>{it.nama_guru}</td>
                                            <td><span className={`bk-status ${st.cls}`}>{st.label}</span></td>
                                            <td>
                                                <ActionGroup style={{ justifyContent: 'flex-end' }}>
                                                    <button className="bk-btn-detail" onClick={() => openDetail(it)} title="Tindak Lanjut">
                                                        <i className="bi bi-chat-square-text"></i>
                                                    </button>
                                                    <ActionButton action="edit" onClick={() => openEditModal(it)} />
                                                    <ActionButton action="delete" onClick={() => setDeleteItem(it)} />
                                                </ActionGroup>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Mobile Cards View */}
                <div className="bk-mobile-only">
                    {loading ? (
                        <div className="bk-table-wrap"><div className="bk-state" style={{ padding: '32px 0' }}><Spinner variant="trace" /></div></div>
                    ) : items.length === 0 ? (
                        <div className="bk-table-wrap">
                            <div className="bk-state">
                                <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.4 }}></i>
                                <p>Tidak ada catatan pada rentang/filter ini.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bk-cards-list">
                            {items.map(it => {
                                const st = statusLabel(it.status);
                                return (
                                    <div key={it.id} className="bk-card-item">
                                        <div className="bk-card-header">
                                            <div className="bk-card-identity">
                                                <div className="bk-card-nama">{it.nama_snapshot}</div>
                                                <span className="bk-card-kelas">{it.kelas}</span>
                                            </div>
                                            <span className={`bk-badge bk-badge--${it.jenis.toLowerCase()}`} title={it.jenis === 'POSITIF' ? 'Positif (+)' : 'Negatif (-)'}>
                                                <i className={`bi ${it.jenis === 'POSITIF' ? 'bi-emoji-smile-fill' : 'bi-emoji-frown-fill'}`}></i>
                                                <span>{it.jenis === 'POSITIF' ? '+' : '-'}</span>
                                            </span>
                                        </div>
                                        
                                        <div className="bk-card-catatan">
                                            {it.catatan}
                                        </div>

                                        <div className="bk-card-meta">
                                            <div className="bk-card-meta-row">
                                                <span><i className="bi bi-calendar3" /> {formatDate(it.tanggal)}</span>
                                                <span><i className="bi bi-person-fill" /> {it.nama_guru}</span>
                                            </div>
                                            <div className="bk-card-meta-actions">
                                                <span className={`bk-status ${st.cls}`}>{st.label}</span>
                                                <ActionGroup>
                                                    <button className="bk-btn-detail" onClick={() => openDetail(it)}>
                                                        <i className="bi bi-chat-square-text"></i> Tindak Lanjut
                                                    </button>
                                                    <ActionButton action="edit" onClick={() => openEditModal(it)} />
                                                    <ActionButton action="delete" onClick={() => setDeleteItem(it)} />
                                                </ActionGroup>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail & Tindak Lanjut Modal */}
                <Modal
                    open={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    title={selectedItem ? `Tindak Lanjut — ${selectedItem.nama_snapshot}` : 'Detail Catatan'}
                >
                    {selectedItem && (
                        <ModalBody>
                            <p style={{ fontSize: '0.85rem', color: 'var(--n-muted)', marginBottom: '12px' }}>
                                {selectedItem.kelas} • {formatDate(selectedItem.tanggal)}{selectedItem.mapel ? ` • ${selectedItem.mapel}` : ''}
                            </p>
                            <span className={`bk-badge bk-badge--lg bk-badge--${selectedItem.jenis.toLowerCase()}`} style={{ marginBottom: '12px', display: 'inline-flex' }}>
                                <i className={`bi ${selectedItem.jenis === 'POSITIF' ? 'bi-emoji-smile-fill' : 'bi-emoji-frown-fill'}`}></i>
                                <span>{selectedItem.jenis === 'POSITIF' ? '+ Catatan Positif' : '- Catatan Negatif'}</span>
                            </span>
                            <p className="bk-modal-text">{selectedItem.catatan}</p>
                            <div className="bk-modal-info" style={{ marginTop: '8px', marginBottom: '16px' }}>
                                Dicatat oleh <strong>{selectedItem.nama_guru}</strong>
                            </div>

                            {selectedItem.catatan_siswa_tindak_lanjut && selectedItem.catatan_siswa_tindak_lanjut.length > 0 && (
                                <div className="bk-tindaklanjut" style={{ marginTop: '16px' }}>
                                    <h4>Riwayat Tindak Lanjut</h4>
                                    {selectedItem.catatan_siswa_tindak_lanjut
                                        .slice()
                                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                        .map(tl => (
                                            <div key={tl.id} className="bk-tl-item">
                                                <div className="bk-tl-top">
                                                    <strong>{tl.nama}</strong>
                                                    <span className={`bk-status ${statusLabel(tl.status_baru).cls}`}>{statusLabel(tl.status_baru).label}</span>
                                                </div>
                                                <p>{tl.catatan}</p>
                                                <span className="bk-tl-time">{new Date(tl.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        ))}
                                </div>
                            )}

                            {selectedItem.status !== 'SELESAI' && (
                                <div className="bk-form" style={{ marginTop: '16px' }}>
                                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Tambah Tindak Lanjut</label>
                                    <textarea
                                        placeholder="Tulis tindak lanjut yang dilakukan..."
                                        value={tlText}
                                        onChange={e => setTlText(e.target.value)}
                                        rows={3}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)' }}
                                    />
                                    <div className="bk-form-row" style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                                        <select
                                            value={tlStatus}
                                            onChange={e => setTlStatus(e.target.value as any)}
                                            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)' }}
                                        >
                                            <option value="DITINDAKLANJUTI">Set status: Ditindaklanjuti</option>
                                            <option value="SELESAI">Set status: Selesai</option>
                                        </select>
                                        <Button variant="primary" onClick={handleSubmitTindakLanjut} disabled={submitting}>
                                            {submitting ? 'Menyimpan...' : 'Simpan'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </ModalBody>
                    )}
                    <ModalFooter>
                        <Button variant="secondary" onClick={() => setSelectedItem(null)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>

                {/* Add / Edit Modal */}
                <Modal
                    open={showAddEditModal}
                    onClose={() => setShowAddEditModal(false)}
                    title={modalMode === 'tambah' ? 'Tambah Catatan Konseling' : 'Edit Catatan Konseling'}
                >
                    <form onSubmit={handleSaveAddEdit}>
                        <ModalBody>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Nama Siswa</label>
                                <input
                                    type="text"
                                    required
                                    value={addEditForm.nama_siswa}
                                    onChange={e => setAddEditForm({ ...addEditForm, nama_siswa: e.target.value })}
                                    placeholder="Nama lengkap siswa"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '160px' }}>
                                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Kelas</label>
                                    <select
                                        value={addEditForm.kelas}
                                        onChange={e => setAddEditForm({ ...addEditForm, kelas: e.target.value })}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)' }}
                                    >
                                        {kelasOptions.map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1, minWidth: '160px' }}>
                                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Jenis Catatan</label>
                                    <select
                                        value={addEditForm.jenis}
                                        onChange={e => setAddEditForm({ ...addEditForm, jenis: e.target.value as any })}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)' }}
                                    >
                                        <option value="POSITIF">Positif (+)</option>
                                        <option value="NEGATIF">Negatif (-)</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Tanggal</label>
                                <input
                                    type="date"
                                    required
                                    value={addEditForm.tanggal}
                                    onChange={e => setAddEditForm({ ...addEditForm, tanggal: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Catatan / Perilaku</label>
                                <textarea
                                    required
                                    value={addEditForm.catatan}
                                    onChange={e => setAddEditForm({ ...addEditForm, catatan: e.target.value })}
                                    placeholder="Rincian mengenai catatan positif/negatif siswa..."
                                    rows={4}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)' }}
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button type="button" variant="secondary" onClick={() => setShowAddEditModal(false)}>
                                Batal
                            </Button>
                            <Button type="submit" variant="primary">
                                {modalMode === 'tambah' ? 'Simpan Catatan' : 'Simpan Perubahan'}
                            </Button>
                        </ModalFooter>
                    </form>
                </Modal>

                {/* Delete Confirmation Modal */}
                <Modal
                    open={!!deleteItem}
                    onClose={() => setDeleteItem(null)}
                    title="Konfirmasi Hapus Catatan"
                >
                    <ModalBody>
                        <p style={{ fontSize: '0.92rem', color: 'var(--n-ink)' }}>
                            Apakah Anda yakin ingin menghapus catatan bimbingan konseling untuk <strong>"{deleteItem?.nama_snapshot}"</strong>?
                        </p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--n-muted)', marginTop: '6px' }}>
                            Data catatan yang dihapus tidak dapat dikembalikan.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button type="button" variant="secondary" onClick={() => setDeleteItem(null)}>
                            Batal
                        </Button>
                        <Button type="button" variant="danger" onClick={confirmDelete}>
                            Ya, Hapus
                        </Button>
                    </ModalFooter>
                </Modal>
            </div>
        </MaintenanceBanner>
    );
}
