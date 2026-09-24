'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';

interface KeuanganTabPengaturanProps {
    officerForm: any;
    setOfficerForm: React.Dispatch<React.SetStateAction<any>>;
    handleSaveOfficer: (e: React.FormEvent) => void;
    usersList: any[];
    divisions: any[];
    officers: any[];
    handleDeleteOfficer: (id: string) => void;
}

export default function KeuanganTabPengaturan({
    officerForm,
    setOfficerForm,
    handleSaveOfficer,
    usersList,
    divisions,
    officers,
    handleDeleteOfficer,
}: KeuanganTabPengaturanProps) {
    return (
        <div>
            <form className="form-box" onSubmit={handleSaveOfficer}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700 }}>Tambah Pejabat Keuangan</h3>
                <div className="form-grid">
                    <div className="form-group">
                        <label>Role</label>
                        <select className="form-control" value={officerForm.role_type} onChange={e => setOfficerForm({ ...officerForm, role_type: e.target.value })}>
                            <option value="Kepala Divisi">Kepala Divisi</option>
                            <option value="KTU">KTU</option>
                            <option value="PPK">PPK</option>
                            <option value="Bendahara">Bendahara</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>User (Guru/TU)</label>
                        <select className="form-control" value={officerForm.user_id} onChange={e => setOfficerForm({ ...officerForm, user_id: e.target.value })} required>
                            <option value="">-- Pilih User --</option>
                            {usersList.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                        </select>
                    </div>
                    {officerForm.role_type === 'Kepala Divisi' && (
                        <div className="form-group">
                            <label>Divisi</label>
                            <select className="form-control" value={officerForm.division_id} onChange={e => setOfficerForm({ ...officerForm, division_id: e.target.value })}>
                                <option value="">-- Pilih Divisi --</option>
                                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <Button type="submit" variant="primary" size="sm" style={{ marginTop: '16px' }} leftIcon={<i className="bi bi-save" />}>
                    Simpan Pejabat
                </Button>
            </form>

            <table className="data-table">
                <thead>
                    <tr><th>Nama Pegawai</th><th>Role</th><th>Divisi</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
                </thead>
                <tbody>
                    {officers.map(o => (
                        <tr key={o.id}>
                            <td>{o.users?.nama}</td>
                            <td><span className="status-badge status-draft">{o.role_type}</span></td>
                            <td>{o.divisions?.name || '-'}</td>
                            <td style={{ textAlign: 'right' }}>
                                <ActionGroup>
                                    <ActionButton action="delete" title="Hapus Pejabat" onClick={() => handleDeleteOfficer(o.id)} />
                                </ActionGroup>
                            </td>
                        </tr>
                    ))}
                    {officers.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center' }}>Belum ada data pejabat</td></tr>}
                </tbody>
            </table>
        </div>
    );
}
