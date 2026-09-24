'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';

interface KeuanganTabPengajuanProps {
    requestForm: any;
    setRequestForm: React.Dispatch<React.SetStateAction<any>>;
    handleCreateRequest: (e: React.FormEvent) => void;
    isTuDivisionId: (id: string) => boolean;
    divisions: any[];
    setShowImportModal: (v: boolean) => void;
    exportRequestItemsToExcel: (items: any[], activityName?: string, requestNumber?: string) => void;
    proofFile: File | null;
    setProofFile: (f: File | null) => void;
    openFile: (url: string, title?: string) => void;
    uploadingProof: boolean;
    filteredRequests: any[];
    stBadge: (status: string) => string;
    setSelectedRequest: (r: any) => void;
    setShowDetailModal: (v: boolean) => void;
    canApproveStage: (r: any) => boolean;
    openApprovalModal: (r: any) => void;
    canManageRegisters: (r: any) => boolean;
    openRegisterModal: (r: any) => void;
}

export default function KeuanganTabPengajuan({
    requestForm,
    setRequestForm,
    handleCreateRequest,
    isTuDivisionId,
    divisions,
    setShowImportModal,
    exportRequestItemsToExcel,
    proofFile,
    setProofFile,
    openFile,
    uploadingProof,
    filteredRequests,
    stBadge,
    setSelectedRequest,
    setShowDetailModal,
    canApproveStage,
    openApprovalModal,
    canManageRegisters,
    openRegisterModal,
}: KeuanganTabPengajuanProps) {
    return (
        <div>
            <form className="form-box" onSubmit={handleCreateRequest}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {requestForm.id ? 'Perbaiki Pengajuan (Revisi)' : 'Buat Pengajuan Baru'}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: '#e0e7ff', color: '#002a7a' }}>
                        Anggaran Tahun {new Date().getFullYear()}
                    </span>
                </h3>
                <div className="form-grid">
                    <div className="form-group">
                        <label>Nama Kegiatan</label>
                        <input type="text" className="form-control" required value={requestForm.activity_name} onChange={e => setRequestForm({ ...requestForm, activity_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Divisi Tujuan</label>
                        <select className="form-control" required value={requestForm.division_id} onChange={e => setRequestForm({ ...requestForm, division_id: e.target.value, route: isTuDivisionId(e.target.value) ? requestForm.route : 'normal' })}>
                            <option value="">-- Pilih Divisi --</option>
                            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                </div>

                {isTuDivisionId(requestForm.division_id) && (
                    <div style={{ marginTop: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                            Jalur Verifikasi (khusus TU)
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                                <input type="radio" name="tu-route" checked={requestForm.route === 'normal'} onChange={() => setRequestForm({ ...requestForm, route: 'normal' })} style={{ marginTop: '3px' }} />
                                <span><strong>Jalur normal</strong> — KTU → PPK → Bendahara</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                                <input type="radio" name="tu-route" checked={requestForm.route === 'bendahara'} onChange={() => setRequestForm({ ...requestForm, route: 'bendahara' })} style={{ marginTop: '3px' }} />
                                <span><strong>Jalur cepat</strong> — langsung ke Bendahara (tanpa verifikasi KTU & PPK)</span>
                            </label>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--n-muted)' }}>Rincian Item</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                size="sm" 
                                icon="import"
                                onClick={() => setShowImportModal(true)} 
                            >
                                Import
                            </Button>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                size="sm" 
                                icon="export"
                                onClick={() => exportRequestItemsToExcel(requestForm.items, requestForm.activity_name)} 
                            >
                                Export
                            </Button>
                        </div>
                    </div>
                    
                    <div style={{ overflowX: 'auto', border: '1px solid var(--n-border)', borderRadius: '8px' }}>
                        <table className="data-table" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
                            <thead style={{ background: 'var(--n-surface)' }}>
                                <tr>
                                    <th style={{ width: '5%' }}>No</th>
                                    <th style={{ width: '25%' }}>Nama Barang/Jasa</th>
                                    <th style={{ width: '15%' }}>Kategori</th>
                                    <th style={{ width: '10%' }}>Qty</th>
                                    <th style={{ width: '10%' }}>Satuan</th>
                                    <th style={{ width: '15%' }}>Harga Satuan</th>
                                    <th style={{ width: '15%' }}>Jumlah</th>
                                    <th style={{ width: '5%', textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {requestForm.items.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                                        <td style={{ padding: '8px' }}><input type="text" className="form-control" style={{ width: '100%', padding: '6px 10px' }} required value={item.item_name} onChange={e => { const items = [...requestForm.items]; items[idx].item_name = e.target.value; setRequestForm({ ...requestForm, items }); }} /></td>
                                        <td style={{ padding: '8px' }}><select className="form-control" style={{ width: '100%', padding: '6px 10px' }} value={item.category} onChange={e => { const items = [...requestForm.items]; items[idx].category = e.target.value; setRequestForm({ ...requestForm, items }); }}>
                                            <option value="Bahan">Bahan</option><option value="Transport">Transport</option><option value="Honor">Honor</option>
                                        </select></td>
                                        <td style={{ padding: '8px' }}><input type="number" className="form-control" style={{ width: '100%', padding: '6px 10px' }} required value={item.quantity} min={1} onChange={e => { const items = [...requestForm.items]; items[idx].quantity = parseInt(e.target.value) || 0; setRequestForm({ ...requestForm, items }); }} /></td>
                                        <td style={{ padding: '8px' }}><input type="text" placeholder="Pcs/Dus/Jam" className="form-control" style={{ width: '100%', padding: '6px 10px' }} required value={item.unit || ''} onChange={e => { const items = [...requestForm.items]; items[idx].unit = e.target.value; setRequestForm({ ...requestForm, items }); }} /></td>
                                        <td style={{ padding: '8px' }}><input type="number" className="form-control" style={{ width: '100%', padding: '6px 10px' }} required value={item.unit_price} min={0} onChange={e => { const items = [...requestForm.items]; items[idx].unit_price = parseInt(e.target.value) || 0; setRequestForm({ ...requestForm, items }); }} /></td>
                                        <td style={{ padding: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Rp {(item.quantity * item.unit_price).toLocaleString('id-ID')}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>
                                            <ActionGroup>
                                                <ActionButton action="delete" title="Hapus Item" onClick={() => { const items = requestForm.items.filter((_: any, i: number) => i !== idx); setRequestForm({ ...requestForm, items }); }} />
                                            </ActionGroup>
                                        </td>
                                    </tr>
                                ))}
                                {requestForm.items.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '16px' }}>Silakan tambah baris atau import dari Excel.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <Button type="button" variant="secondary" size="sm" style={{ marginTop: '8px' }} onClick={() => setRequestForm({ ...requestForm, items: [...requestForm.items, { item_name: '', category: 'Bahan', quantity: 1, unit: 'Pcs', unit_price: 0 }] })} leftIcon={<i className="bi bi-plus-lg" />}>
                        Tambah Baris
                    </Button>
                </div>

                <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--n-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                        Bukti Dukung <span style={{ textTransform: 'none', fontWeight: 500 }}>(Opsional)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            className="form-control"
                            style={{ maxWidth: '340px', padding: '7px 10px' }}
                            onChange={e => setProofFile(e.target.files?.[0] || null)}
                        />
                        {proofFile
                            ? <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}><i className="bi-paperclip"></i> {proofFile.name}</span>
                            : requestForm.proof_file_url
                                ? <>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => openFile(requestForm.proof_file_url, 'Bukti Pengajuan')} leftIcon={<i className="bi bi-eye" />}>
                                        Lihat Bukti
                                    </Button>
                                    <Button type="button" variant="danger" size="sm" onClick={() => setRequestForm({ ...requestForm, proof_file_url: '' })} leftIcon={<i className="bi bi-trash" />}>
                                        Hapus
                                    </Button>
                                  </>
                                : <span style={{ fontSize: '0.78rem', color: 'var(--n-muted)' }}>Belum ada lampiran.</span>}
                    </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                    <Button type="submit" variant="primary" isLoading={uploadingProof} leftIcon={<i className="bi bi-send-fill" />}>
                        {requestForm.id ? 'Simpan Perbaikan' : 'Kirim Pengajuan'}
                    </Button>
                </div>
            </form>

            <h3 style={{ margin: '24px 0 12px 0', fontSize: '1.1rem', fontWeight: 700 }}>Riwayat Pengajuan Saya</h3>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Nomor / Tanggal</th>
                        <th>Kegiatan</th>
                        <th>Divisi</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredRequests.map(r => (
                        <tr key={r.id}>
                            <td>
                                <div style={{ fontWeight: 700 }}>{r.request_number || '-'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>{new Date(r.created_at).toLocaleDateString('id-ID')}</div>
                            </td>
                            <td>{r.activity_name}</td>
                            <td>{r.divisions?.name}</td>
                            <td><span className={`status-badge ${stBadge(r.status)}`}>{r.status}</span></td>
                            <td style={{ textAlign: 'right' }}>
                                <ActionGroup>
                                    <ActionButton action="view" title="Lihat Rincian" onClick={() => { setSelectedRequest(r); setShowDetailModal(true); }} />
                                    <ActionButton action="export" title="Export Excel Item" onClick={() => exportRequestItemsToExcel(r.budget_request_items, r.activity_name, r.request_number)} />
                                    {r.status === 'Revisi PJ' && (
                                        <ActionButton action="edit" title="Perbaiki Pengajuan" onClick={() => setRequestForm({
                                            id: r.id, division_id: r.division_id, activity_name: r.activity_name,
                                            description: r.description || '', route: r.route || 'normal',
                                            proof_file_url: r.proof_url || '',
                                            items: r.budget_request_items.map((it: any) => ({ item_name: it.item_name, category: it.category, quantity: it.quantity, unit: it.unit || 'Pcs', unit_price: it.unit_price }))
                                        })} />
                                    )}
                                    {canApproveStage(r) && (
                                        <ActionButton action="settings" title="Verifikasi" onClick={() => openApprovalModal(r)} />
                                    )}
                                    {canManageRegisters(r) && (
                                        <ActionButton action="file" title="Kelola Nomor Register" onClick={() => openRegisterModal(r)} />
                                    )}
                                </ActionGroup>
                            </td>
                        </tr>
                    ))}
                    {filteredRequests.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center' }}>Belum ada pengajuan</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
