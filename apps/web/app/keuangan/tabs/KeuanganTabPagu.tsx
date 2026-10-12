'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface KeuanganTabPaguProps {
    canManageBudget: boolean;
    handleSaveBudget: (e: React.FormEvent) => void;
    budgetForm: any;
    setBudgetForm: React.Dispatch<React.SetStateAction<any>>;
    divisions: any[];
    handleSaveMutation: (e: React.FormEvent) => void;
    mutationForm: any;
    setMutationForm: React.Dispatch<React.SetStateAction<any>>;
    savingMutation: boolean;
    budgets: Array<{ id: string; divisions?: { name?: string }; category: string; total_budget: number | string; used_budget: number | string; remaining_budget: number | string }>;
    mutations: Array<{ id: string; created_at: string; divisions?: { name?: string }; counterpart?: { name?: string }; category: string; mutation_type: string; amount: number | string; reason: string }>;
    selectedYear: string;
    onYearChange: (year: string) => void;
}

export default function KeuanganTabPagu({
    canManageBudget,
    handleSaveBudget,
    budgetForm,
    setBudgetForm,
    divisions,
    handleSaveMutation,
    mutationForm,
    setMutationForm,
    savingMutation,
    budgets,
    mutations,
    selectedYear,
    onYearChange,
}: KeuanganTabPaguProps) {
    const rupiah = (value: number | string) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Kelola & Ringkasan Pagu Anggaran</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--n-muted)' }}>Pagu anggaran divisi dan riwayat mutasi anggaran.</p>
            <label className="form-group" style={{ maxWidth: 180 }}>
                Tahun Anggaran
                <input type="number" className="form-control" min={2000} max={2100} value={selectedYear} onChange={event => onYearChange(event.target.value)} />
            </label>
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead><tr><th>Divisi</th><th>Kategori</th><th>Pagu</th><th>Terpakai / Dicadangkan</th><th>Sisa</th></tr></thead>
                    <tbody>
                        {budgets.map(budget => <tr key={budget.id}><td>{budget.divisions?.name || '-'}</td><td>{budget.category}</td><td>{rupiah(budget.total_budget)}</td><td>{rupiah(budget.used_budget)}</td><td>{rupiah(budget.remaining_budget)}</td></tr>)}
                        {!budgets.length && <tr><td colSpan={5}>Belum ada pagu untuk tahun ini.</td></tr>}
                    </tbody>
                </table>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {canManageBudget && (
                    <form className="form-box" onSubmit={handleSaveBudget} style={{ flex: '1 1 350px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Atur Pagu Awal</h4>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Divisi</label>
                                <select className="form-control" required value={budgetForm.division_id} onChange={e => setBudgetForm({ ...budgetForm, division_id: e.target.value })}>
                                    <option value="">-- Pilih --</option>
                                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Kategori</label>
                                <select className="form-control" required value={budgetForm.category} onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value as any })}>
                                    <option value="Bahan">Bahan</option>
                                    <option value="Transport">Transport</option>
                                    <option value="Honor">Honor</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Nominal Pagu (Rp)</label>
                                <input type="number" className="form-control" required min={0} value={budgetForm.total_budget} onChange={e => setBudgetForm({ ...budgetForm, total_budget: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <Button type="submit" variant="primary" size="sm" style={{ marginTop: '16px' }} leftIcon={<i className="bi bi-save" />}>
                            Simpan Pagu
                        </Button>
                    </form>
                )}

                {canManageBudget && (
                    <form className="form-box" onSubmit={handleSaveMutation} style={{ flex: '1 1 350px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Mutasi / Transfer Anggaran</h4>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Jenis</label>
                                <select className="form-control" value={mutationForm.type} onChange={e => setMutationForm({ ...mutationForm, type: e.target.value as any })}>
                                    <option value="Penyesuaian">Penyesuaian</option>
                                    <option value="Transfer">Transfer</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Kategori</label>
                                <select className="form-control" required value={mutationForm.category} onChange={e => setMutationForm({ ...mutationForm, category: e.target.value as any })}>
                                    <option value="Bahan">Bahan</option>
                                    <option value="Transport">Transport</option>
                                    <option value="Honor">Honor</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Divisi Asal</label>
                                <select className="form-control" required value={mutationForm.division_id} onChange={e => setMutationForm({ ...mutationForm, division_id: e.target.value })}>
                                    <option value="">-- Pilih --</option>
                                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Nominal (Rp)</label>
                                <input type="number" className="form-control" required min={1} value={mutationForm.amount} onChange={e => setMutationForm({ ...mutationForm, amount: parseInt(e.target.value) || 0 })} />
                            </div>
                            {mutationForm.type === 'Transfer' ? (
                                <div className="form-group">
                                    <label>Divisi Tujuan</label>
                                    <select className="form-control" required value={mutationForm.to_division_id} onChange={event => setMutationForm({ ...mutationForm, to_division_id: event.target.value })}>
                                        <option value="">-- Pilih Tujuan --</option>
                                        {divisions.filter(division => division.id !== mutationForm.division_id).map(division => <option key={division.id} value={division.id}>{division.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label>Arah Penyesuaian</label>
                                    <select className="form-control" value={mutationForm.direction} onChange={event => setMutationForm({ ...mutationForm, direction: event.target.value })}>
                                        <option value="add">Tambah Pagu</option><option value="subtract">Kurangi Pagu</option>
                                    </select>
                                </div>
                            )}
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Alasan</label>
                                <textarea className="form-control" rows={2} required value={mutationForm.reason} onChange={e => setMutationForm({ ...mutationForm, reason: e.target.value })}></textarea>
                            </div>
                        </div>
                        <Button type="submit" variant="primary" size="sm" isLoading={savingMutation} style={{ marginTop: '16px' }} leftIcon={<i className="bi bi-arrow-left-right" />}>
                            Proses Mutasi
                        </Button>
                    </form>
                )}
            </div>
            <div style={{ overflowX: 'auto' }}>
                <h4>Riwayat Mutasi Tahun {selectedYear}</h4>
                <table className="data-table">
                    <thead><tr><th>Tanggal</th><th>Divisi</th><th>Kategori</th><th>Jenis</th><th>Nominal</th><th>Alasan</th></tr></thead>
                    <tbody>
                        {mutations.map(mutation => <tr key={mutation.id}><td>{new Date(mutation.created_at).toLocaleDateString('id-ID')}</td><td>{mutation.divisions?.name || '-'}{mutation.counterpart?.name ? ` ↔ ${mutation.counterpart.name}` : ''}</td><td>{mutation.category}</td><td>{mutation.mutation_type}</td><td>{rupiah(mutation.amount)}</td><td>{mutation.reason}</td></tr>)}
                        {!mutations.length && <tr><td colSpan={6}>Belum ada mutasi untuk tahun ini.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
