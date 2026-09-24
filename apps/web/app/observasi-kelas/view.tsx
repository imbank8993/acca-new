'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Spinner } from '@/components/ui/Spinner';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import * as XLSX from 'xlsx-js-style';

interface Observasi {
    id: number;
    nama_observer: string;
    jabatan_observer: string;
    kelas: string;
    nama_guru: string;
    mapel: string;
    praktik_baik: string;
    catatan_perbaikan: string;
    created_at: string;
}

export default function AdminObservasiKelas() {
    const [data, setData] = useState<Observasi[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form Modal State
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<Observasi>>({});

    // View Modal State
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewData, setViewData] = useState<Observasi | null>(null);

    // Delete Modal State
    const [deletingItem, setDeletingItem] = useState<Observasi | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/observasi-kelas');
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal mengambil data observasi');
            setData(json.data || []);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            Swal.fire('Error', 'Gagal mengambil data observasi: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(item =>
        item.nama_guru.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nama_observer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.kelas.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = (item: Observasi) => {
        setDeletingItem(item);
    };

    const confirmDelete = async () => {
        if (!deletingItem) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/observasi-kelas/${deletingItem.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menghapus data');
            Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data berhasil dihapus.', timer: 1500, showConfirmButton: false });
            setDeletingItem(null);
            fetchData();
        } catch (err: any) {
            Swal.fire('Gagal', err.message, 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleEdit = (item: Observasi) => {
        setFormData(item);
        setIsEditMode(true);
        setShowModal(true);
    };

    const handleView = (item: Observasi) => {
        setViewData(item);
        setShowViewModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (isEditMode && formData.id) {
                const { id, created_at, ...updateData } = formData as Observasi;
                const res = await fetch(`/api/observasi-kelas/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData),
                });
                const json = await res.json();
                if (!json.ok) throw new Error(json.error || 'Gagal memperbarui data');
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data berhasil diperbarui', timer: 1500, showConfirmButton: false });
            } else {
                const res = await fetch('/api/observasi-kelas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
                const json = await res.json();
                if (!json.ok) throw new Error(json.error || 'Gagal menambahkan data');
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data berhasil ditambahkan', timer: 1500, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            Swal.fire('Gagal', err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        if (data.length === 0) return Swal.fire('Kosong', 'Tidak ada data untuk di-export', 'info');

        const wsData = data.map(item => ({
            "Tanggal": new Date(item.created_at).toLocaleDateString('id-ID'),
            "Nama Observer": item.nama_observer,
            "Jabatan Observer": item.jabatan_observer,
            "Nama Guru Diobservasi": item.nama_guru,
            "Kelas": item.kelas,
            "Mata Pelajaran": item.mapel,
            "Praktik Baik": item.praktik_baik,
            "Catatan Perbaikan": item.catatan_perbaikan
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);

        const range = XLSX.utils.decode_range(ws['!ref']!);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[cellAddress]) continue;
            ws[cellAddress].s = {
                fill: { fgColor: { rgb: "FF2563EB" } },
                font: { color: { rgb: "FFFFFFFF" }, bold: true },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "FFBFDBFE" } },
                    bottom: { style: "thin", color: { rgb: "FFBFDBFE" } },
                    left: { style: "thin", color: { rgb: "FFBFDBFE" } },
                    right: { style: "thin", color: { rgb: "FFBFDBFE" } }
                }
            };
        }

        for (let R = 1; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellAddress]) continue;
                ws[cellAddress].s = {
                    alignment: { vertical: "top", wrapText: true },
                    border: {
                        top: { style: "thin", color: { rgb: "FFDDDDDD" } },
                        bottom: { style: "thin", color: { rgb: "FFDDDDDD" } },
                        left: { style: "thin", color: { rgb: "FFDDDDDD" } },
                        right: { style: "thin", color: { rgb: "FFDDDDDD" } }
                    }
                };
            }
        }

        ws['!cols'] = [
            { wch: 12 },
            { wch: 20 },
            { wch: 18 },
            { wch: 25 },
            { wch: 10 },
            { wch: 18 },
            { wch: 45 },
            { wch: 45 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Observasi Kelas");
        XLSX.writeFile(wb, "Data_Observasi_Kelas.xlsx");
    };

    return (
        <MaintenanceBanner pageKey="observasi_kelas">
            <div className="sk" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                

                <FilterToolbar style={{ marginBottom: '4px' }}>
                    <FilterSearch
                        value={searchTerm}
                        onChange={(val) => setSearchTerm(val)}
                        placeholder="Cari guru, observer, atau kelas..."
                    />
                    <FilterActions>
                        <Button
                            variant="outline"
                            icon="export"
                            onClick={handleExport}
                        >
                            Export
                        </Button>
                    </FilterActions>
                </FilterToolbar>

                <div className="sk__tableWrap">
                    <table className="sk__table">
                        <thead>
                            <tr>
                                <th style={{ width: '12%' }}>Tanggal</th>
                                <th style={{ width: '20%' }}>Observer</th>
                                <th style={{ width: '18%' }}>Guru Diobservasi</th>
                                <th style={{ width: '15%' }}>Kelas & Mapel</th>
                                <th style={{ width: '27%' }}>Catatan</th>
                                <th style={{ width: '8%', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '48px 0', textAlign: 'center' }}>
                                        <Spinner variant="trace" size={36} />
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={6} className="sk__empty sk__muted">Tidak ada data observasi.</td></tr>
                            ) : (
                                filteredData.map(item => (
                                    <tr key={item.id}>
                                        <td className="tPlain">
                                            {new Date(item.created_at).toLocaleDateString('id-ID')}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{item.nama_observer}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--n-muted)' }}>{item.jabatan_observer}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--n-primary)' }}>{item.nama_guru}</div>
                                        </td>
                                        <td>
                                            <div><span className="sk__programBadge">{item.kelas}</span></div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--n-muted)', marginTop: '4px' }}>{item.mapel}</div>
                                        </td>
                                        <td style={{ maxWidth: '300px' }}>
                                            <div style={{ marginBottom: '6px' }}><strong style={{ fontSize: '0.8rem' }}>Praktik Baik:</strong><br/><span className="line-clamp-2" title={item.praktik_baik}>{item.praktik_baik}</span></div>
                                            <div><strong style={{ fontSize: '0.8rem' }}>Perbaikan:</strong><br/><span className="line-clamp-2" title={item.catatan_perbaikan}>{item.catatan_perbaikan}</span></div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <ActionGroup>
                                                <ActionButton action="view" label="Lihat Detail" onClick={() => handleView(item)} />
                                                <ActionButton action="edit" onClick={() => handleEdit(item)} />
                                                <ActionButton action="delete" onClick={() => handleDelete(item)} />
                                            </ActionGroup>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="sk__cards">
                    {loading ? (
                        <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
                            <Spinner variant="trace" size={36} />
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="sk__empty sk__muted" style={{ padding: '24px 0', textAlign: 'center' }}>Tidak ada data observasi.</div>
                    ) : (
                        filteredData.map(item => (
                            <div className="sk__card" key={item.id}>
                                <div className="sk__cardHead">
                                    <div className="sk__cardTitle">
                                        <div className="sk__cardName">{item.nama_guru}</div>
                                        <div className="sk__cardSub">{item.kelas} • {item.mapel}</div>
                                    </div>
                                </div>
                                <div className="sk__cardBody">
                                    <div className="sk__kv">
                                        <div className="sk__k">Observer</div>
                                        <div className="sk__v" style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 600 }}>{item.nama_observer}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--n-muted)' }}>{item.jabatan_observer}</div>
                                        </div>
                                    </div>
                                    <div className="sk__kv">
                                        <div className="sk__k">Praktik Baik</div>
                                        <div className="sk__v" style={{ textAlign: 'left' }}>
                                            <span className="line-clamp-2">{item.praktik_baik}</span>
                                        </div>
                                    </div>
                                    <div className="sk__kv">
                                        <div className="sk__k">Perbaikan</div>
                                        <div className="sk__v" style={{ textAlign: 'left' }}>
                                            <span className="line-clamp-2">{item.catatan_perbaikan}</span>
                                        </div>
                                    </div>
                                    <div className="sk__statusRow" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="sk__statusLeft">
                                            <span style={{ fontSize: '0.8rem', color: 'var(--n-muted)', fontWeight: 500 }}>
                                                {new Date(item.created_at).toLocaleDateString('id-ID')}
                                            </span>
                                        </div>
                                        <div className="sk__actionsRight">
                                            <ActionGroup>
                                                <ActionButton action="view" label="Lihat Detail" onClick={() => handleView(item)} />
                                                <ActionButton action="edit" onClick={() => handleEdit(item)} />
                                                <ActionButton action="delete" onClick={() => handleDelete(item)} />
                                            </ActionGroup>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* EDIT MODAL */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title="Edit Data Observasi"
                size="lg"
            >
                <form id="obsForm" onSubmit={handleSubmit}>
                    <ModalBody>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '6px' }}>Nama Observer <span style={{ color: '#e11d48' }}>*</span></label>
                                <input type="text" className="ck-form-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)', background: 'var(--n-card)', color: 'var(--n-ink)' }} value={formData.nama_observer || ''} onChange={e => setFormData({...formData, nama_observer: e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '6px' }}>Jabatan Observer <span style={{ color: '#e11d48' }}>*</span></label>
                                <input type="text" className="ck-form-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)', background: 'var(--n-card)', color: 'var(--n-ink)' }} value={formData.jabatan_observer || ''} onChange={e => setFormData({...formData, jabatan_observer: e.target.value})} required />
                            </div>
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '6px' }}>Guru yang Diobservasi <span style={{ color: '#e11d48' }}>*</span></label>
                            <input type="text" className="ck-form-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)', background: 'var(--n-card)', color: 'var(--n-ink)' }} value={formData.nama_guru || ''} onChange={e => setFormData({...formData, nama_guru: e.target.value})} required />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '6px' }}>Kelas <span style={{ color: '#e11d48' }}>*</span></label>
                                <input type="text" className="ck-form-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)', background: 'var(--n-card)', color: 'var(--n-ink)' }} value={formData.kelas || ''} onChange={e => setFormData({...formData, kelas: e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '6px' }}>Mapel <span style={{ color: '#e11d48' }}>*</span></label>
                                <input type="text" className="ck-form-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)', background: 'var(--n-card)', color: 'var(--n-ink)' }} value={formData.mapel || ''} onChange={e => setFormData({...formData, mapel: e.target.value})} required />
                            </div>
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '6px' }}>Praktik Baik yang Bisa Ditiru <span style={{ color: '#e11d48' }}>*</span></label>
                            <textarea rows={4} className="ck-form-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)', background: 'var(--n-card)', color: 'var(--n-ink)' }} value={formData.praktik_baik || ''} onChange={e => setFormData({...formData, praktik_baik: e.target.value})} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '6px' }}>Catatan Perbaikan <span style={{ color: '#e11d48' }}>*</span></label>
                            <textarea rows={4} className="ck-form-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)', background: 'var(--n-card)', color: 'var(--n-ink)' }} value={formData.catatan_perbaikan || ''} onChange={e => setFormData({...formData, catatan_perbaikan: e.target.value})} required />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Batal</Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* DETAIL VIEW MODAL */}
            <Modal
                open={showViewModal && !!viewData}
                onClose={() => setShowViewModal(false)}
                title="Detail Data Observasi"
                size="lg"
            >
                <ModalBody>
                    {viewData && (
                        <>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Observer</div>
                                <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--n-ink)' }}>{viewData.nama_observer}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--n-muted)' }}>{viewData.jabatan_observer}</div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Guru Diobservasi</div>
                                    <div style={{ fontWeight: 600, color: 'var(--n-primary)' }}>{viewData.nama_guru}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Kelas & Mapel</div>
                                    <div><span className="sk__programBadge">{viewData.kelas}</span> <span style={{ fontSize: '0.9rem', color: 'var(--n-muted)' }}>{viewData.mapel}</span></div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px', background: 'var(--n-surface, rgba(248, 250, 252, 0.9))', padding: '14px', borderRadius: '12px', border: '1px solid var(--n-border)' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--n-ink)', fontWeight: 700, marginBottom: '6px' }}>Praktik Baik yang Bisa Ditiru</div>
                                <div style={{ fontSize: '0.88rem', color: 'var(--n-ink)', lineHeight: 1.6 }}>
                                    {viewData.praktik_baik}
                                </div>
                            </div>
                            
                            <div style={{ background: 'var(--n-surface, rgba(248, 250, 252, 0.9))', padding: '14px', borderRadius: '12px', border: '1px solid var(--n-border)' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--n-ink)', fontWeight: 700, marginBottom: '6px' }}>Catatan Perbaikan</div>
                                <div style={{ fontSize: '0.88rem', color: 'var(--n-ink)', lineHeight: 1.6 }}>
                                    {viewData.catatan_perbaikan}
                                </div>
                            </div>
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="secondary" onClick={() => setShowViewModal(false)}>
                        Tutup
                    </Button>
                </ModalFooter>
            </Modal>

            {/* DELETE CONFIRMATION MODAL */}
            <Modal
                open={!!deletingItem}
                onClose={() => setDeletingItem(null)}
                title="Konfirmasi Hapus Data"
            >
                <ModalBody>
                    <p style={{ fontSize: '0.92rem', color: 'var(--n-ink)' }}>
                        Apakah Anda yakin ingin menghapus data observasi kelas untuk guru <strong>"{deletingItem?.nama_guru}"</strong> (Observer: {deletingItem?.nama_observer})?
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--n-muted)', marginTop: '6px' }}>
                        Data yang dihapus tidak dapat dikembalikan.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="secondary" onClick={() => setDeletingItem(null)}>
                        Batal
                    </Button>
                    <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleting}>
                        {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                    </Button>
                </ModalFooter>
            </Modal>

            <style jsx>{`
:global(:root) {
  --sk-line: rgba(148, 163, 184, 0.22);
  --sk-card: rgba(255, 255, 255, 0.92);

  --sk-shadow: 0 14px 34px rgba(2, 6, 23, 0.08);
  --sk-shadow2: 0 10px 22px rgba(2, 6, 23, 0.08);

  --sk-radius: 16px;

  --sk-fs: 0.88rem;
  --sk-fs-sm: 0.82rem;
  --sk-fs-xs: 0.78rem;

  --sk-safe-b: env(safe-area-inset-bottom, 0px);
  --sk-safe-t: env(safe-area-inset-top, 0px);
}

.sk {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: var(--sk-fs);
  padding: 0;
  background: transparent;
  border-radius: 0;
  padding-bottom: calc(16px + var(--sk-safe-b));
}

/* ========= TABLE ========= */
.sk__tableWrap {
  width: 100%;
  min-width: 0;
  overflow: auto;
  border-radius: var(--sk-radius);
  border: 1px solid var(--n-border);
  background: var(--n-card);
  box-shadow: var(--sk-shadow);
}

.sk__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 720px;
}

.sk__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--n-surface);
  color: var(--n-ink);
  font-size: var(--sk-fs-xs);
  font-weight: 750;
  letter-spacing: 0.01em;
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--n-border);
  white-space: nowrap;
}

.sk__table tbody td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--n-border);
  color: var(--n-ink);
  font-size: var(--sk-fs-sm);
  font-weight: 400;
  vertical-align: middle;
}

.sk__table tbody tr:hover td {
  background: rgba(58, 166, 255, 0.055);
}

.sk__empty {
  text-align: center;
  padding: 18px 10px !important;
  font-weight: 500;
  font-size: var(--sk-fs-sm);
}

.sk__muted {
  color: var(--n-muted) !important;
  font-weight: 400 !important;
}

.tPlain { font-weight: 400; }

.sk__programBadge {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--n-soft);
  border: 1px solid var(--n-border);
  color: var(--n-primary);
  font-weight: 600;
  font-size: var(--sk-fs-xs);
  white-space: nowrap;
}

/* ========= MOBILE CARDS ========= */
.sk__cards { display: flex; flex-direction: column; gap: 10px; }

.sk__card {
  background: var(--n-card);
  border: 1px solid var(--n-border);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.sk__cardName { font-size: 0.95rem; font-weight: 700; color: var(--n-ink); }
.sk__cardSub { font-size: 0.78rem; color: var(--n-muted); }
.sk__kv { display: flex; flex-direction: column; gap: 2px; }
.sk__k { font-size: 0.72rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; }
.sk__v { font-size: 0.84rem; color: var(--n-ink); }

@media (min-width: 769px) {
  .sk__cards { display: none; }
}

:global(.dark) .sk__tableWrap {
  border: 1.8px solid rgba(26, 115, 232, 0.85) !important;
  background: #000000 !important;
}

:global(.dark) .sk__card {
  border: 1.8px solid rgba(26, 115, 232, 0.85) !important;
  background: #000000 !important;
}
            `}</style>
        </MaintenanceBanner>
    );
}
