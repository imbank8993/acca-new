'use client';

import React from 'react';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';

export interface TindakLanjutMappingItem {
    name: string;
    status: 'Ringan' | 'Sedang' | 'Berat' | 'Kontrol' | 'NONE';
}

type CategoryType = 'penyakit' | 'alergi' | 'keluhan' | 'tataLaksana' | 'tindakan' | 'tindakLanjut';

interface KonfigurasiMedisTabProps {
    presetPenyakit: string[];
    presetAlergi: string[];
    presetKeluhan: string[];
    presetTataLaksana: string[];
    presetTindakan: string[];
    presetTindakLanjut: string[];
    tindakLanjutMapping: TindakLanjutMappingItem[];
    newPenyakitInput: string;
    setNewPenyakitInput: (val: string) => void;
    newAlergiInput: string;
    setNewAlergiInput: (val: string) => void;
    newKeluhanInput: string;
    setNewKeluhanInput: (val: string) => void;
    newTataLaksanaInput: string;
    setNewTataLaksanaInput: (val: string) => void;
    newTindakanInput: string;
    setNewTindakanInput: (val: string) => void;
    newTindakLanjutInput: string;
    setNewTindakLanjutInput: (val: string) => void;
    newTindakLanjutStatus: 'Ringan' | 'Sedang' | 'Berat' | 'Kontrol' | 'NONE';
    setNewTindakLanjutStatus: (status: 'Ringan' | 'Sedang' | 'Berat' | 'Kontrol' | 'NONE') => void;
    handleAddPreset: (
        category: CategoryType,
        val: string,
        setVal: (s: string) => void,
        statusMapping?: 'Ringan' | 'Sedang' | 'Berat' | 'Kontrol' | 'NONE'
    ) => void;
    handleEditPreset: (category: CategoryType, oldItem: string) => void;
    handleDeletePreset: (category: CategoryType, item: string) => void;
}

export default function KonfigurasiMedisTab({
    presetPenyakit,
    presetAlergi,
    presetKeluhan,
    presetTataLaksana,
    presetTindakan,
    presetTindakLanjut,
    tindakLanjutMapping,
    newPenyakitInput,
    setNewPenyakitInput,
    newAlergiInput,
    setNewAlergiInput,
    newKeluhanInput,
    setNewKeluhanInput,
    newTataLaksanaInput,
    setNewTataLaksanaInput,
    newTindakanInput,
    setNewTindakanInput,
    newTindakLanjutInput,
    setNewTindakLanjutInput,
    newTindakLanjutStatus,
    setNewTindakLanjutStatus,
    handleAddPreset,
    handleEditPreset,
    handleDeletePreset,
}: KonfigurasiMedisTabProps) {
    return (
        <div className="kh-filter-card animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid var(--kh-accent)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                    <h3 style={{ color: 'var(--kh-accent)', margin: 0, fontWeight: 800, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="bi bi-sliders"></i> Konfigurasi Dropdown & Pemetaan Status Sakit
                    </h3>
                </div>
            </div>

            <div className="kh-preset-grid">
                
                {/* PANEL 1: RIWAYAT PENYAKIT */}
                <div className="rm-card-box" style={{ padding: '16px' }}>
                    <h4 style={{ color: 'var(--kh-accent)', margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-activity"></i> Riwayat Penyakit ({presetPenyakit.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            className="kh-pill-input"
                            placeholder="Tambah data penyakit..."
                            value={newPenyakitInput}
                            onChange={e => setNewPenyakitInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPreset('penyakit', newPenyakitInput, setNewPenyakitInput); } }}
                        />
                        <button
                            type="button"
                            className="btn-kh-navy"
                            onClick={() => handleAddPreset('penyakit', newPenyakitInput, setNewPenyakitInput)}
                            style={{ width: '38px', minWidth: '38px', height: '38px', minHeight: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
                            title="Tambah Data"
                        >
                            <i className="bi bi-plus-lg" style={{ fontSize: '1.1rem' }}></i>
                        </button>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {presetPenyakit.map(item => (
                            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--n-card)', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--kh-text-primary)' }}>{item}</span>
                                <ActionGroup>
                                    <ActionButton action="edit" title="Edit" tooltipPos="left" onClick={() => handleEditPreset('penyakit', item)} />
                                    <ActionButton action="delete" title="Hapus" tooltipPos="left" onClick={() => handleDeletePreset('penyakit', item)} />
                                </ActionGroup>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PANEL 2: ALERGI OBAT */}
                <div className="rm-card-box" style={{ padding: '16px' }}>
                    <h4 style={{ color: 'var(--kh-accent)', margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-exclamation-triangle-fill"></i> Alergi Obat ({presetAlergi.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            className="kh-pill-input"
                            placeholder="Tambah data alergi obat..."
                            value={newAlergiInput}
                            onChange={e => setNewAlergiInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPreset('alergi', newAlergiInput, setNewAlergiInput); } }}
                        />
                        <button
                            type="button"
                            className="btn-kh-navy"
                            onClick={() => handleAddPreset('alergi', newAlergiInput, setNewAlergiInput)}
                            style={{ width: '38px', minWidth: '38px', height: '38px', minHeight: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
                            title="Tambah Data"
                        >
                            <i className="bi bi-plus-lg" style={{ fontSize: '1.1rem' }}></i>
                        </button>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {presetAlergi.map(item => (
                            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--n-card)', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--kh-text-primary)' }}>{item}</span>
                                <ActionGroup>
                                    <ActionButton action="edit" title="Edit" tooltipPos="left" onClick={() => handleEditPreset('alergi', item)} />
                                    <ActionButton action="delete" title="Hapus" tooltipPos="left" onClick={() => handleDeletePreset('alergi', item)} />
                                </ActionGroup>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PANEL 3: KELUHAN SISWA */}
                <div className="rm-card-box" style={{ padding: '16px' }}>
                    <h4 style={{ color: 'var(--kh-accent)', margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-chat-square-text-fill"></i> Keluhan Siswa ({presetKeluhan.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            className="kh-pill-input"
                            placeholder="Tambah data keluhan..."
                            value={newKeluhanInput}
                            onChange={e => setNewKeluhanInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPreset('keluhan', newKeluhanInput, setNewKeluhanInput); } }}
                        />
                        <button
                            type="button"
                            className="btn-kh-navy"
                            onClick={() => handleAddPreset('keluhan', newKeluhanInput, setNewKeluhanInput)}
                            style={{ width: '38px', minWidth: '38px', height: '38px', minHeight: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
                            title="Tambah Data"
                        >
                            <i className="bi bi-plus-lg" style={{ fontSize: '1.1rem' }}></i>
                        </button>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {presetKeluhan.map(item => (
                            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--n-card)', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--kh-text-primary)' }}>{item}</span>
                                <ActionGroup>
                                    <ActionButton action="edit" title="Edit" tooltipPos="left" onClick={() => handleEditPreset('keluhan', item)} />
                                    <ActionButton action="delete" title="Hapus" tooltipPos="left" onClick={() => handleDeletePreset('keluhan', item)} />
                                </ActionGroup>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PANEL TATA LAKSANA */}
                <div className="rm-card-box" style={{ padding: '16px' }}>
                    <h4 style={{ color: 'var(--kh-accent)', margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-clipboard2-pulse"></i> Tata Laksana ({presetTataLaksana.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            className="kh-pill-input"
                            placeholder="Tambah data tata laksana..."
                            value={newTataLaksanaInput}
                            onChange={e => setNewTataLaksanaInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPreset('tataLaksana', newTataLaksanaInput, setNewTataLaksanaInput); } }}
                        />
                        <button
                            type="button"
                            className="btn-kh-navy"
                            onClick={() => handleAddPreset('tataLaksana', newTataLaksanaInput, setNewTataLaksanaInput)}
                            style={{ width: '38px', minWidth: '38px', height: '38px', minHeight: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
                            title="Tambah Data"
                        >
                            <i className="bi bi-plus-lg" style={{ fontSize: '1.1rem' }}></i>
                        </button>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {presetTataLaksana.map(item => (
                            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--n-card)', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--kh-text-primary)' }}>{item}</span>
                                <ActionGroup>
                                    <ActionButton action="edit" title="Edit" tooltipPos="left" onClick={() => handleEditPreset('tataLaksana', item)} />
                                    <ActionButton action="delete" title="Hapus" tooltipPos="left" onClick={() => handleDeletePreset('tataLaksana', item)} />
                                </ActionGroup>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PANEL 4: TINDAKAN MEDIS */}
                <div className="rm-card-box" style={{ padding: '16px' }}>
                    <h4 style={{ color: 'var(--kh-accent)', margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-bandaid-fill"></i> Tindakan Medis ({presetTindakan.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            className="kh-pill-input"
                            placeholder="Tambah data tindakan..."
                            value={newTindakanInput}
                            onChange={e => setNewTindakanInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPreset('tindakan', newTindakanInput, setNewTindakanInput); } }}
                        />
                        <button
                            type="button"
                            className="btn-kh-navy"
                            onClick={() => handleAddPreset('tindakan', newTindakanInput, setNewTindakanInput)}
                            style={{ width: '38px', minWidth: '38px', height: '38px', minHeight: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
                            title="Tambah Data"
                        >
                            <i className="bi bi-plus-lg" style={{ fontSize: '1.1rem' }}></i>
                        </button>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {presetTindakan.map(item => (
                            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--n-card)', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--kh-text-primary)' }}>{item}</span>
                                <ActionGroup>
                                    <ActionButton action="edit" title="Edit" tooltipPos="left" onClick={() => handleEditPreset('tindakan', item)} />
                                    <ActionButton action="delete" title="Hapus" tooltipPos="left" onClick={() => handleDeletePreset('tindakan', item)} />
                                </ActionGroup>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PANEL 5: TINDAK LANJUT & PEMETAAN STATUS SAKIT */}
                <div className="rm-card-box" style={{ padding: '16px' }}>
                    <h4 style={{ color: 'var(--kh-accent)', margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-arrow-right-circle-fill"></i> Tindak Lanjut & Pemetaan Status ({presetTindakLanjut.length})
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                className="kh-pill-input"
                                placeholder="Nama tindak lanjut baru..."
                                value={newTindakLanjutInput}
                                onChange={e => setNewTindakLanjutInput(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <select
                                className="kh-pill-select"
                                value={newTindakLanjutStatus}
                                onChange={e => setNewTindakLanjutStatus(e.target.value as any)}
                                style={{ width: '130px', fontSize: '0.78rem' }}
                            >
                                <option value="NONE">Tanpa Absensi</option>
                                <option value="Ringan">Sakit Ringan</option>
                                <option value="Sedang">Sakit Sedang</option>
                                <option value="Berat">Sakit Berat</option>
                                <option value="Kontrol">Kontrol</option>
                            </select>
                            <button
                                type="button"
                                className="btn-kh-navy"
                                onClick={() => handleAddPreset('tindakLanjut', newTindakLanjutInput, setNewTindakLanjutInput, newTindakLanjutStatus)}
                                style={{ width: '38px', minWidth: '38px', height: '38px', minHeight: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
                                title="Tambah & Pemetaan Status"
                            >
                                <i className="bi bi-plus-lg" style={{ fontSize: '1.1rem' }}></i>
                            </button>
                        </div>
                    </div>

                    <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {presetTindakLanjut.map(item => {
                            const mapObj = tindakLanjutMapping.find(m => m.name === item);
                            const statusVal = mapObj?.status || (item.toLowerCase().includes('kembali ke kelas') ? 'NONE' : 'Ringan');

                            return (
                                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--n-card)', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)', fontSize: '0.82rem' }}>
                                    <div>
                                        <span style={{ color: 'var(--kh-text-primary)', fontWeight: 600 }}>{item}</span>
                                        <span className="surat-badge" style={{
                                            marginLeft: '8px', fontSize: '0.7rem',
                                            background: statusVal === 'NONE' ? 'rgba(0,0,0,0.05)' : statusVal === 'Ringan' ? 'rgba(59,130,246,0.1)' : statusVal === 'Sedang' ? 'rgba(217,119,6,0.1)' : statusVal === 'Berat' ? 'rgba(220,38,38,0.1)' : 'rgba(147,51,234,0.1)',
                                            color: statusVal === 'NONE' ? 'var(--kh-text-muted)' : statusVal === 'Ringan' ? '#2563eb' : statusVal === 'Sedang' ? '#d97706' : statusVal === 'Berat' ? '#dc2626' : '#9333ea'
                                        }}>
                                            {statusVal === 'NONE' ? 'Tanpa Absensi' : `Sakit ${statusVal}`}
                                        </span>
                                    </div>
                                    <ActionGroup>
                                        <ActionButton action="edit" title="Edit preset & status" tooltipPos="left" onClick={() => handleEditPreset('tindakLanjut', item)} />
                                        <ActionButton action="delete" title="Hapus preset" tooltipPos="left" onClick={() => handleDeletePreset('tindakLanjut', item)} />
                                    </ActionGroup>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}
