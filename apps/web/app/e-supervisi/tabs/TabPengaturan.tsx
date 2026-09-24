'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@/lib/types';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { cachedGet, invalidateSvCache } from '../svCache';
import FilterToolbar, { FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';

// ==============================
// DOKUMEN & INDIKATOR
// ==============================
export function DokumenSettings({ 
    tahunAjaranId, 
    setTahunAjaranId,
    tahunAjaranList = [],
    allTahunAjaran = [], 
    onDataAdded 
}: { 
    tahunAjaranId: number | null, 
    setTahunAjaranId?: (id: number | null) => void,
    tahunAjaranList?: any[],
    allTahunAjaran?: any[], 
    onDataAdded?: (id: number) => void 
}) {
    const [semuaDokumen, setSemuaDokumen] = useState<any[]>([]);
    const [dokumen, setDokumen] = useState<any[]>([]);
    const [tahap, setTahap] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingDoc, setViewingDoc] = useState<any>(null);
    const [editingPenugasanId, setEditingPenugasanId] = useState<number | null>(null);
    const [modalTahunAjaranId, setModalTahunAjaranId] = useState<number | null>(null);
    const [namaDokumen, setNamaDokumen] = useState('');
    const [deskripsi, setDeskripsi] = useState('');
    const [butuhDokumen, setButuhDokumen] = useState(true);
    const [indikators, setIndikators] = useState<any[]>([]);
    
    useEffect(() => {
        if (tahunAjaranId) {
            fetchDokumen();
        } else {
            setSemuaDokumen([]);
            setDokumen([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tahunAjaranId]);
    
    const fetchDokumen = async (force = false) => {
        if (!tahunAjaranId) return;
        try {
            if (force) invalidateSvCache('/api/e-supervisi/dokumen');
            const json = await cachedGet(`/api/e-supervisi/dokumen?tahun_ajaran_id=${tahunAjaranId}`);
            if (json.ok) {
                setSemuaDokumen(json.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        // Derive all tahap
        const stages = [...new Set(semuaDokumen.map(d => d.tahap))].filter(Boolean) as string[];
        let currentTahap = tahap;
        
        if (stages.length > 0) {
            // Check if currentTahap exists in stages (case-insensitive)
            const matchedStage = stages.find(s => s.toLowerCase() === currentTahap.toLowerCase());
            
            if (matchedStage) {
                if (currentTahap !== matchedStage) {
                    currentTahap = matchedStage;
                    setTahap(currentTahap);
                }
            } else {
                currentTahap = stages[0];
                setTahap(currentTahap);
            }
        } else if (!currentTahap && stages.length > 0) {
            currentTahap = stages[0];
            setTahap(currentTahap);
        }

        const filtered = semuaDokumen.filter(d => d.tahap === currentTahap);
        setDokumen(filtered);
    }, [semuaDokumen, tahap]);
    
    const openAddModal = () => {
        setEditingDoc(null);
        setNamaDokumen('');
        setDeskripsi('');
        setButuhDokumen(true);
        setIndikators([]);
        setModalTahunAjaranId(tahunAjaranId);
        setIsModalOpen(true);
    };
    
    const openEditModal = (doc: any) => {
        setEditingDoc(doc);
        setTahap(doc.tahap);
        setNamaDokumen(doc.nama_dokumen);
        setDeskripsi(doc.deskripsi || '');
        setButuhDokumen(doc.butuh_dokumen !== undefined ? doc.butuh_dokumen : true);
        setIndikators(doc.indikators || []);
        setModalTahunAjaranId(doc.tahun_ajaran_id || tahunAjaranId);
        setIsModalOpen(true);
    };

    const openViewModal = (doc: any) => {
        setViewingDoc(doc);
        setIsViewModalOpen(true);
    };
    
    const addIndikator = () => {
        setIndikators([...indikators, { 
            id: null, 
            nama_indikator: '', 
            deskripsi: '', 
            skala_config: { tipe: 'angka', min: 1, max: 4 },
            sub_indikators: []
        }]);
    };
    
    const addSubIndikator = (parentIndex: number) => {
        const newInds = [...indikators];
        if (!newInds[parentIndex].sub_indikators) newInds[parentIndex].sub_indikators = [];
        newInds[parentIndex].sub_indikators.push({
            id: null,
            nama_indikator: '',
            deskripsi: '',
            skala_config: { tipe: 'angka', min: 1, max: 4 }
        });
        setIndikators(newInds);
    };
    
    const updateIndikator = (index: number, field: string, value: any, subIndex?: number) => {
        const newInds = [...indikators];
        const target = subIndex !== undefined ? newInds[index].sub_indikators[subIndex] : newInds[index];
        
        if (field === 'tipe') {
            target.skala_config = { ...target.skala_config, tipe: value };
            if (value === 'huruf') {
                target.skala_config.opsi = { "A": 100, "B": 85, "C": 70, "D": 50 };
            } else if (value === 'yatidak') {
                target.skala_config.opsi = { "Ya": 100, "Tidak": 0 };
            }
        } else if (field === 'min' || field === 'max') {
            target.skala_config = { ...target.skala_config, [field]: Number(value) };
        } else {
            target[field] = value;
        }
        setIndikators(newInds);
    };
    
    const removeIndikator = (index: number, subIndex?: number) => {
        if (subIndex !== undefined) {
            const newInds = [...indikators];
            newInds[index].sub_indikators.splice(subIndex, 1);
            setIndikators(newInds);
        } else {
            setIndikators(indikators.filter((_, i) => i !== index));
        }
    };

    const saveDokumen = async () => {
        if (!namaDokumen) return Swal.fire('Error', 'Nama dokumen wajib diisi', 'error');
        if (!modalTahunAjaranId) return Swal.fire('Error', 'Tahun ajaran belum dipilih', 'error');
        
        try {
            const res = await fetch('/api/e-supervisi/dokumen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: editingDoc?.id,
                    tahap, 
                    nama_dokumen: namaDokumen, 
                    deskripsi,
                    butuh_dokumen: butuhDokumen,
                    indikators,
                    tahun_ajaran_id: modalTahunAjaranId
                })
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menyimpan dokumen');
            setIsModalOpen(false);
            if (onDataAdded && modalTahunAjaranId) {
                onDataAdded(modalTahunAjaranId);
            }
            setTimeout(() => fetchDokumen(true), 500);
            Swal.fire('Berhasil', 'Dokumen tersimpan', 'success');
        } catch (e: any) {
            Swal.fire('Error', e.message || 'Gagal menyimpan', 'error');
        }
    };
    
    const deleteDokumen = async (id: number) => {
        const result = await Swal.fire({
            title: 'Hapus Dokumen?',
            text: 'Tindakan ini tidak dapat dibatalkan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus'
        });
        if (result.isConfirmed) {
            await fetch(`/api/e-supervisi/dokumen?id=${id}`, { method: 'DELETE' });
            fetchDokumen(true);
        }
    };

    const handleExportDokumen = () => {
        if (dokumen.length === 0) {
            Swal.fire('Info', 'Tidak ada dokumen untuk diekspor pada tahap ini.', 'info');
            return;
        }
        const exportData = dokumen.flatMap(d => {
            const base = {
                Tahap: d.tahap,
                Nama_Dokumen: d.nama_dokumen,
                Deskripsi_Dokumen: d.deskripsi || '',
                Butuh_Dokumen: d.butuh_dokumen === false ? 'Tidak' : 'Ya',
                Urutan_Dokumen: d.urutan || 0
            };
            const indikatorRow = (i: any, parentName: string) => ({
                ...base,
                Parent_Indikator: parentName,
                Nama_Indikator: i.nama_indikator,
                Deskripsi_Indikator: i.deskripsi || '',
                Tipe_Skala: i.skala_config?.tipe || 'angka',
                Min_Skala: i.skala_config?.min ?? 1,
                Max_Skala: i.skala_config?.max ?? 4,
                Urutan_Indikator: i.urutan || 0
            });
            const rows: any[] = [];
            (d.indikators || []).forEach((i: any) => {
                rows.push(indikatorRow(i, ''));
                (i.sub_indikators || []).forEach((sub: any) => {
                    rows.push(indikatorRow(sub, i.nama_indikator));
                });
            });
            if (rows.length === 0) {
                rows.push({
                    ...base,
                    Parent_Indikator: '',
                    Nama_Indikator: '',
                    Deskripsi_Indikator: '',
                    Tipe_Skala: '',
                    Min_Skala: '',
                    Max_Skala: '',
                    Urutan_Indikator: ''
                });
            }
            return rows;
        });
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dokumen");
        XLSX.writeFile(workbook, `master-dokumen-${tahap}.xlsx`);
    };

    const handleImportDokumen = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!tahunAjaranId) {
            Swal.fire('Error', 'Pilih tahun ajaran terlebih dahulu sebelum mengimpor.', 'error');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // raw:false agar semua sel dibaca sebagai teks terformat (NIP/angka besar tidak rusak)
                const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

                if (rows.length === 0) {
                    Swal.fire('Info', 'File tidak berisi data.', 'info');
                    return;
                }

                const grouped: Record<string, any> = {};
                rows.forEach(r => {
                    const nama = String(r.Nama_Dokumen || '').trim();
                    if (!nama) return;
                    const tahapRow = String(r.Tahap || tahap || '').trim();
                    const key = `${tahapRow}|${nama}`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            tahap: tahapRow,
                            nama_dokumen: nama,
                            deskripsi: r.Deskripsi_Dokumen || '',
                            butuh_dokumen: String(r.Butuh_Dokumen || 'Ya').trim().toLowerCase() !== 'tidak',
                            urutan: Number(r.Urutan_Dokumen) || 0,
                            indikators: []
                        };
                    }
                    const namaIndikator = String(r.Nama_Indikator || '').trim();
                    if (namaIndikator) {
                        const ind = {
                            nama_indikator: namaIndikator,
                            deskripsi: r.Deskripsi_Indikator || '',
                            skala_config: { tipe: r.Tipe_Skala || 'angka', min: Number(r.Min_Skala) || 1, max: Number(r.Max_Skala) || 4 },
                            urutan: Number(r.Urutan_Indikator) || 0,
                            sub_indikators: [] as any[]
                        };
                        const parentName = String(r.Parent_Indikator || '').trim();
                        const parent = parentName
                            ? grouped[key].indikators.find((x: any) => x.nama_indikator === parentName)
                            : null;
                        if (parent) {
                            parent.sub_indikators.push(ind);
                        } else {
                            grouped[key].indikators.push(ind);
                        }
                    }
                });

                const docsToSave = Object.values(grouped);
                if (docsToSave.length === 0) {
                    Swal.fire('Error', 'Tidak ada baris valid. Pastikan kolom Nama_Dokumen terisi.', 'error');
                    return;
                }

                let okCount = 0;
                let failCount = 0;
                for (const d of docsToSave) {
                    try {
                        const res = await fetch('/api/e-supervisi/dokumen', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...d, tahun_ajaran_id: tahunAjaranId })
                        });
                        const json = await res.json();
                        if (json.ok) okCount++; else failCount++;
                    } catch {
                        failCount++;
                    }
                }
                if (failCount === 0) {
                    Swal.fire('Berhasil', `${okCount} dokumen berhasil diimpor`, 'success');
                } else {
                    Swal.fire('Selesai dengan Catatan', `${okCount} dokumen berhasil, ${failCount} gagal diimpor`, 'warning');
                }
                fetchDokumen(true);
            } catch(err) {
                Swal.fire('Error', 'Gagal memproses file XLSX', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const allTahap = [...new Set(semuaDokumen.map(d => d.tahap))];
    const activeTahunAjaran = allTahunAjaran.find(ta => ta.id === modalTahunAjaranId);

    const displayDokumen = useMemo(() => {
        if (!searchQuery.trim()) return dokumen;
        const q = searchQuery.toLowerCase();
        return dokumen.filter(doc =>
            (doc.nama_dokumen && doc.nama_dokumen.toLowerCase().includes(q)) ||
            (doc.deskripsi && doc.deskripsi.toLowerCase().includes(q)) ||
            (doc.indikators && doc.indikators.some((ind: any) =>
                ind.nama_indikator && ind.nama_indikator.toLowerCase().includes(q)
            ))
        );
    }, [dokumen, searchQuery]);

    return (
        <div>
            <FilterToolbar actionsInline={true} style={{ marginBottom: '24px' }}>
                {tahunAjaranList.length > 0 && setTahunAjaranId && (
                    <FilterSelect
                        label="Tahun Ajaran"
                        icon="calendar-event"
                        value={tahunAjaranId ? String(tahunAjaranId) : ''}
                        onChange={(val) => setTahunAjaranId(val ? Number(val) : null)}
                        width={200}
                        options={tahunAjaranList.map(ta => ({
                            value: String(ta.id),
                            label: `${ta.tahun_ajaran} - Sem ${ta.semester}`
                        }))}
                    />
                )}
                <FilterSelect
                    label="Tahap"
                    icon="folder2-open"
                    value={tahap}
                    onChange={(val) => setTahap(val)}
                    width={180}
                    options={
                        allTahap.length > 0
                            ? allTahap.map(t => ({ value: String(t), label: String(t) }))
                            : [{ value: '', label: 'Semua Tahap' }]
                    }
                />
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari dokumen..."
                    grow={1}
                />
                <FilterActions>
                    <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleImportDokumen} 
                        style={{ display: 'none' }} 
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        icon="export"
                        onClick={handleExportDokumen}
                        title="Export Excel"
                    >
                        Export
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        icon="import"
                        onClick={() => fileInputRef.current?.click()}
                        title="Import Excel"
                    >
                        Import
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        icon="add"
                        onClick={openAddModal}
                    >
                        Tambah Dokumen
                    </Button>
                </FilterActions>
            </FilterToolbar>
            
            <div className="sv-table-card" style={{
                overflow: 'hidden'
            }}>
                <table className="sv-table">
                    <thead>
                        <tr>
                            <th style={{ width: '35%' }}>Dokumen</th>
                            <th style={{ width: '45%' }}>Deskripsi</th>
                            <th style={{ width: '150px' }}>Indikator</th>
                            <th style={{ width: '120px' }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayDokumen.map(doc => (
                            <tr key={doc.id}>
                                <td data-label="Dokumen">{doc.nama_dokumen}</td>
                                <td data-label="Deskripsi">{doc.deskripsi}</td>
                                <td data-label="Indikator">{doc.indikators?.length || 0} Indikator</td>
                                <td data-label="Aksi">
                                    <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
                                        <button onClick={() => openViewModal(doc)} style={{background: 'transparent', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', transition: 'transform 0.2s'}} title="Lihat Indikator" onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                                            <i className="bi bi-eye"></i>
                                        </button>
                                        <button onClick={() => openEditModal(doc)} style={{background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', transition: 'transform 0.2s'}} title="Edit Dokumen" onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                                            <i className="bi bi-pencil"></i>
                                        </button>
                                        <button onClick={() => deleteDokumen(doc.id)} style={{background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', transition: 'transform 0.2s'}} title="Hapus Dokumen" onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {displayDokumen.length === 0 && (
                            <tr>
                                <td colSpan={4} className="sv-empty">
                                    {dokumen.length === 0 ? 'Belum ada dokumen' : 'Tidak ada dokumen yang cocok dengan pencarian'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {isModalOpen && createPortal(
                <div className="sv-modal-overlay">
                    <div className="sv-modal" style={{maxWidth: '700px'}}>
                        <div className="sv-modal-header">
                            <h3 className="sv-modal-title">{editingDoc ? 'Edit Dokumen' : 'Tambah Dokumen'}</h3>
                            <button className="sv-modal-close" onClick={() => setIsModalOpen(false)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="sv-form-group">
                            <label>Tahun Ajaran</label>
                            <select 
                                className="sv-input" 
                                value={modalTahunAjaranId || ''} 
                                onChange={(e) => setModalTahunAjaranId(Number(e.target.value))}
                            >
                                <option value="" disabled>Pilih Tahun Ajaran...</option>
                                {allTahunAjaran.map(ta => (
                                    <option key={ta.id} value={ta.id}>
                                        {ta.tahun_ajaran} - Semester {ta.semester}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sv-form-group">
                            <label>Tahap Penilaian (Ketik untuk buat baru)</label>
                            <input 
                                className="sv-input" 
                                list="tahap-list"
                                value={tahap} 
                                onChange={e => setTahap(e.target.value)} 
                                placeholder="Pilih atau ketik tahap baru..."
                            />
                            <datalist id="tahap-list">
                                {allTahap.map(t => <option key={t as string} value={t as string} />)}
                            </datalist>
                        </div>
                        <div className="sv-form-group">
                            <label>Nama Dokumen</label>
                            <input className="sv-input" value={namaDokumen} onChange={e => setNamaDokumen(e.target.value)} placeholder="Contoh: RPP / Modul Ajar" />
                        </div>
                        <div className="sv-form-group">
                            <label>Deskripsi</label>
                            <textarea className="sv-textarea" value={deskripsi} onChange={e => setDeskripsi(e.target.value)} placeholder="Opsional" rows={2} />
                        </div>
                        <div className="sv-form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', cursor: 'pointer' }} onClick={() => setButuhDokumen(!butuhDokumen)}>
                            <input 
                                type="checkbox" 
                                checked={butuhDokumen} 
                                onChange={e => setButuhDokumen(e.target.checked)} 
                                style={{ width: '18px', height: '18px', accentColor: 'var(--n-primary)', cursor: 'pointer' }}
                            />
                            <label style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>Butuh Dokumen Fisik?</label>
                        </div>
                        
                        <div style={{marginTop: '24px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h4 style={{margin: 0}}>Indikator Penilaian</h4>
                            <Button type="button" variant="outline" size="sm" icon="add" onClick={addIndikator}>Indikator</Button>
                        </div>
                        
                        {indikators.map((ind, i) => (
                            <div key={i} style={{background: 'var(--n-bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px', position: 'relative'}}>
                                <button 
                                    className="sv-btn sv-btn-danger" 
                                    onClick={() => removeIndikator(i)}
                                    style={{position: 'absolute', top: '16px', right: '16px', padding: '4px 8px'}}
                                    title="Hapus Indikator Utama"
                                >
                                    <i className="bi bi-trash"></i>
                                </button>
                                <div className="sv-form-group" style={{marginRight: '40px'}}>
                                    <label>Indikator Induk {i+1}</label>
                                    <input className="sv-input" value={ind.nama_indikator} onChange={e => updateIndikator(i, 'nama_indikator', e.target.value)} placeholder="Nama indikator..." />
                                </div>
                                <div style={{display: 'flex', gap: '16px'}}>
                                    {ind.sub_indikators && ind.sub_indikators.length > 0 ? (
                                        <div className="sv-form-group" style={{flex: 1}}>
                                            <div style={{padding: '10px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', color: 'var(--n-muted)', fontSize: '13px', border: '1px solid var(--n-border)'}}>
                                                <i className="bi bi-info-circle" style={{marginRight: '6px'}}></i> Indikator induk ini memiliki sub-indikator, sehingga skor akan dinilai pada tingkat sub-indikator.
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="sv-form-group" style={{flex: 1}}>
                                                <label>Tipe Penilaian</label>
                                                <select className="sv-select" value={ind.skala_config?.tipe || 'angka'} onChange={e => updateIndikator(i, 'tipe', e.target.value)}>
                                                    <option value="angka">Skala Angka (Custom)</option>
                                                    <option value="yatidak">Pilihan Ya / Tidak</option>
                                                    <option value="huruf">Skala Huruf (A/B/C/D)</option>
                                                    <option value="group">Hanya Label (Punya Sub-Indikator)</option>
                                                </select>
                                            </div>
                                            {ind.skala_config?.tipe === 'angka' && (
                                                <>
                                                    <div className="sv-form-group" style={{width: '100px'}}>
                                                        <label>Min</label>
                                                        <input type="number" className="sv-input" value={ind.skala_config.min || 1} onChange={e => updateIndikator(i, 'min', e.target.value)} />
                                                    </div>
                                                    <div className="sv-form-group" style={{width: '100px'}}>
                                                        <label>Max</label>
                                                        <input type="number" className="sv-input" value={ind.skala_config.max || 4} onChange={e => updateIndikator(i, 'max', e.target.value)} />
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                                
                                {/* Render Sub-Indikators */}
                                {ind.sub_indikators && ind.sub_indikators.map((sub: any, subI: number) => (
                                    <div key={subI} style={{marginLeft: '32px', borderLeft: '2px solid var(--n-border)', paddingLeft: '16px', marginTop: '16px'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                            <label style={{margin: 0}}>Sub-Indikator {i+1}.{subI+1}</label>
                                            <button className="sv-btn sv-btn-danger" onClick={() => removeIndikator(i, subI)} style={{padding: '2px 6px', fontSize: '12px'}} title="Hapus Sub">
                                                <i className="bi bi-x-lg"></i>
                                            </button>
                                        </div>
                                        <input className="sv-input" style={{marginBottom: '12px'}} value={sub.nama_indikator} onChange={e => updateIndikator(i, 'nama_indikator', e.target.value, subI)} placeholder="Nama sub-indikator..." />
                                        <div style={{display: 'flex', gap: '16px'}}>
                                            <div className="sv-form-group" style={{flex: 1, margin: 0}}>
                                                <select className="sv-select" value={sub.skala_config?.tipe || 'angka'} onChange={e => updateIndikator(i, 'tipe', e.target.value, subI)}>
                                                    <option value="angka">Skala Angka (Custom)</option>
                                                    <option value="yatidak">Pilihan Ya / Tidak</option>
                                                    <option value="huruf">Skala Huruf (A/B/C/D)</option>
                                                </select>
                                            </div>
                                            {sub.skala_config?.tipe === 'angka' && (
                                                <>
                                                    <div className="sv-form-group" style={{width: '80px', margin: 0}}>
                                                        <input type="number" className="sv-input" value={sub.skala_config.min || 1} onChange={e => updateIndikator(i, 'min', e.target.value, subI)} placeholder="Min" />
                                                    </div>
                                                    <div className="sv-form-group" style={{width: '80px', margin: 0}}>
                                                        <input type="number" className="sv-input" value={sub.skala_config.max || 4} onChange={e => updateIndikator(i, 'max', e.target.value, subI)} placeholder="Max" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <Button type="button" variant="outline" size="sm" icon="add" onClick={() => addSubIndikator(i)} style={{marginTop: '16px'}}>
                                    Tambah Sub-Indikator
                                </Button>
                            </div>
                        ))}
                        
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px'}}>
                            <Button type="button" variant="cancel" onClick={() => setIsModalOpen(false)}>Batal</Button>
                            <Button type="button" variant="primary" icon="save" onClick={saveDokumen}>Simpan Dokumen</Button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Modal View Indikator */}
            {isViewModalOpen && viewingDoc && createPortal(
                <div className="sv-modal-overlay">
                    <div className="sv-modal" style={{maxWidth: '600px'}}>
                        <div className="sv-modal-header">
                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px',
                                    background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem'
                                }}>
                                    <i className="bi bi-card-checklist"></i>
                                </div>
                                <div>
                                    <h3 className="sv-modal-title" style={{marginBottom: '4px'}}>{viewingDoc.nama_dokumen}</h3>
                                    <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--n-muted)'}}>Daftar Indikator Penilaian</p>
                                </div>
                            </div>
                            <button className="sv-modal-close" onClick={() => setIsViewModalOpen(false)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px'}}>
                            {!viewingDoc.indikators || viewingDoc.indikators.length === 0 ? (
                                <div className="sv-empty" style={{padding: '30px'}}>Belum ada indikator.</div>
                            ) : (
                                viewingDoc.indikators.map((ind: any, i: number) => (
                                    <div key={i} style={{background: 'var(--n-bg)', border: '1px solid var(--n-border)', borderRadius: '12px', padding: '16px'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px'}}>
                                            <h4 style={{margin: 0, fontSize: '1rem', color: 'var(--n-ink)'}}>{i+1}. {ind.nama_indikator}</h4>
                                            <span className="sv-badge" style={{background: 'rgba(0, 56, 168, 0.1)', color: 'var(--n-primary)'}}>
                                                {ind.skala_config?.tipe === 'angka' ? `Skala (${ind.skala_config.min}-${ind.skala_config.max})` : 
                                                 ind.skala_config?.tipe === 'huruf' ? 'Huruf (A-D)' : 
                                                 ind.skala_config?.tipe === 'yatidak' ? 'Ya / Tidak' : 'Label'}
                                            </span>
                                        </div>
                                        {ind.deskripsi && <p style={{margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--n-muted)'}}>{ind.deskripsi}</p>}
                                        
                                        {/* Sub Indicators if any */}
                                        {ind.sub_indikators && ind.sub_indikators.length > 0 && (
                                            <div style={{marginTop: '12px', paddingLeft: '16px', borderLeft: '2px solid var(--n-border)'}}>
                                                <h5 style={{margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--n-muted)', textTransform: 'uppercase'}}>Sub Indikator</h5>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                                    {ind.sub_indikators.map((sub: any, j: number) => (
                                                        <div key={j} style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', background: 'var(--n-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--n-border)'}}>
                                                            <span>{i+1}.{j+1} {sub.nama_indikator}</span>
                                                            <span style={{fontSize: '0.8rem', color: 'var(--n-muted)'}}>{sub.skala_config?.tipe}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
}

// ==============================
// PENUGASAN
// ==============================
export function PenugasanSettings({ 
    tahunAjaranId, 
    setTahunAjaranId,
    tahunAjaranList = [],
    allTahunAjaran = [], 
    onDataAdded 
}: { 
    tahunAjaranId: number | null, 
    setTahunAjaranId?: (id: number | null) => void,
    tahunAjaranList?: any[],
    allTahunAjaran?: any[], 
    onDataAdded?: (id: number) => void 
}) {
    const [penugasan, setPenugasan] = useState<any[]>([]);
    const [guruList, setGuruList] = useState<any[]>([]);
    const [supervisorList, setSupervisorList] = useState<any[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGurus, setSelectedGurus] = useState<string[]>([]);
    const [selectedSupervisor, setSelectedSupervisor] = useState('');
    const [guruSearch, setGuruSearch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const penugasanFileRef = useRef<HTMLInputElement>(null);
    
    const [isEditMode, setIsEditMode] = useState(false);
    const [initialGurusMap, setInitialGurusMap] = useState<any>({});
    const [modalTahunAjaranId, setModalTahunAjaranId] = useState<number | null>(tahunAjaranId);
    
    
    useEffect(() => {
        if (tahunAjaranId) fetchPenugasan();
        fetchGuruList();
    }, [tahunAjaranId]);
    
    const fetchPenugasan = async (force = false) => {
        try {
            if (force) invalidateSvCache('/api/e-supervisi/penugasan');
            const json = await cachedGet(`/api/e-supervisi/penugasan?tahun_ajaran_id=${tahunAjaranId}`);
            if (json.ok) setPenugasan(json.data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchGuruList = async () => {
        try {
            // Daftar guru jarang berubah — cache lebih lama (5 menit)
            const json = await cachedGet(`/api/master/guru?limit=1000`, 300_000);
            if (json.ok) setGuruList(json.data);
            
            const supJson = await cachedGet(`/api/e-supervisi/supervisor-list`, 300_000);
            if (supJson.ok) setSupervisorList(supJson.data);
        } catch (e) {
            console.error(e);
        }
    };

    const savePenugasan = async () => {
        if (selectedGurus.length === 0 || !selectedSupervisor || !modalTahunAjaranId) {
            return Swal.fire('Error', 'Pilih supervisor, setidaknya 1 guru, dan pastikan tahun ajaran terpilih', 'error');
        }
        try {
            if (isEditMode) {
                const initialNips = Object.keys(initialGurusMap);
                const additions = selectedGurus.filter(nip => !initialNips.includes(nip));
                const deletions = initialNips.filter(nip => !selectedGurus.includes(nip));

                for (const nip of additions) {
                    const res = await fetch('/api/e-supervisi/penugasan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ guru_nip: nip, supervisor_nip: selectedSupervisor, tahun_ajaran_id: modalTahunAjaranId })
                    });
                    const json = await res.json();
                    if (!json.ok) throw new Error(json.error);
                }
                for (const nip of deletions) {
                    const id = initialGurusMap[nip];
                    await fetch(`/api/e-supervisi/penugasan?id=${id}`, { method: 'DELETE' });
                }
                
                setIsModalOpen(false);
                if (onDataAdded && modalTahunAjaranId) {
                    onDataAdded(modalTahunAjaranId);
                }
                setTimeout(() => fetchPenugasan(true), 500);
                setIsEditMode(false);
                setSelectedGurus([]);
                setSelectedSupervisor('');
                setInitialGurusMap({});
                Swal.fire('Berhasil', 'Penugasan diperbarui', 'success');
            } else {
                let successCount = 0;
                for (const nip of selectedGurus) {
                    const res = await fetch('/api/e-supervisi/penugasan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ guru_nip: nip, supervisor_nip: selectedSupervisor, tahun_ajaran_id: modalTahunAjaranId })
                    });
                    if (res.ok) successCount++;
                }
                if (successCount > 0) {
                    setIsModalOpen(false);
                    if (onDataAdded && modalTahunAjaranId) {
                        onDataAdded(modalTahunAjaranId);
                    }
                    setTimeout(() => fetchPenugasan(true), 500);
                    setSelectedGurus([]);
                    setSelectedSupervisor('');
                    Swal.fire('Berhasil', `${successCount} Penugasan ditambahkan`, 'success');
                } else {
                    Swal.fire('Error', 'Gagal menyimpan', 'error');
                }
            }
        } catch (e) {
            Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
        }
    };

    const toggleGuruSelection = (nip: string) => {
        if (selectedGurus.includes(nip)) {
            setSelectedGurus(selectedGurus.filter(g => g !== nip));
        } else {
            setSelectedGurus([...selectedGurus, nip]);
        }
    };
    
    const selectAllGurus = (filteredList: any[]) => {
        const nips = filteredList.map(g => g.nip && g.nip !== '-' ? g.nip : g.id);
        const allSelected = nips.every(n => selectedGurus.includes(n));
        if (allSelected) {
            setSelectedGurus(selectedGurus.filter(n => !nips.includes(n)));
        } else {
            const newSelections = [...selectedGurus];
            nips.forEach(n => { if (!newSelections.includes(n)) newSelections.push(n); });
            setSelectedGurus(newSelections);
        }
    };
    
    const deletePenugasan = async (id: number) => {
        const result = await Swal.fire({
            title: 'Hapus Penugasan?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus'
        });
        if (result.isConfirmed) {
            await fetch(`/api/e-supervisi/penugasan?id=${id}`, { method: 'DELETE' });
            fetchPenugasan(true);
        }
    };

    const toggleLock = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'terkunci' ? 'aktif' : 'terkunci';
        try {
            await fetch('/api/e-supervisi/penugasan', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            });
            fetchPenugasan(true);
            Swal.fire('Berhasil', `Nilai telah ${newStatus === 'terkunci' ? 'dikunci' : 'dibuka'}`, 'success');
        } catch (e) {
            Swal.fire('Error', 'Gagal mengubah status', 'error');
        }
    };

    const editPenugasan = (group: any) => {
        setIsEditMode(true);
        setSelectedSupervisor(group.supervisor_nip);
        setSelectedGurus(group.gurus.map((g: any) => g.nip));
        setModalTahunAjaranId(group.gurus[0]?.tahun_ajaran_id || tahunAjaranId);
        
        const initMap: Record<string, number> = {};
        group.gurus.forEach((g: any) => initMap[g.guru_nip] = g.id);
        setInitialGurusMap(initMap);
        
        setIsModalOpen(true);
    };
    
    const handleExportPenugasan = () => {
        if (penugasan.length === 0) {
            Swal.fire('Info', 'Tidak ada penugasan untuk diekspor pada tahun ajaran ini.', 'info');
            return;
        }
        const exportData = penugasan.map(p => ({
            Guru_NIP: p.guru_nip,
            Guru_Nama: p.guru_nama,
            Supervisor_NIP: p.supervisor_nip,
            Supervisor_Nama: p.supervisor_nama
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Penugasan");
        XLSX.writeFile(workbook, "penugasan-supervisi.xlsx");
    };

    const handleImportPenugasan = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!tahunAjaranId) {
            Swal.fire('Error', 'Pilih tahun ajaran terlebih dahulu sebelum mengimpor.', 'error');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // raw:false agar NIP dibaca sebagai teks — mencegah NIP panjang rusak karena presisi angka Excel
                const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

                if (rows.length === 0) {
                    Swal.fire('Info', 'File tidak berisi data.', 'info');
                    return;
                }

                let successCount = 0;
                let failCount = 0;
                let skippedCount = 0;
                for (const r of rows) {
                    const guru_nip = String(r.Guru_NIP || '').trim();
                    const supervisor_nip = String(r.Supervisor_NIP || '').trim();
                    if (!guru_nip || !supervisor_nip) {
                        skippedCount++;
                        continue;
                    }
                    try {
                        const res = await fetch('/api/e-supervisi/penugasan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ guru_nip, supervisor_nip, tahun_ajaran_id: tahunAjaranId })
                        });
                        const json = await res.json();
                        if (json.ok) successCount++; else failCount++;
                    } catch {
                        failCount++;
                    }
                }
                if (failCount === 0 && skippedCount === 0) {
                    Swal.fire('Berhasil', `${successCount} penugasan berhasil diimpor`, 'success');
                } else {
                    const detail = [`${successCount} berhasil`];
                    if (failCount) detail.push(`${failCount} gagal`);
                    if (skippedCount) detail.push(`${skippedCount} dilewati (NIP kosong)`);
                    Swal.fire('Selesai dengan Catatan', detail.join(', '), successCount > 0 ? 'warning' : 'error');
                }
                fetchPenugasan(true);
            } catch(err) {
                Swal.fire('Error', 'Gagal memproses file XLSX', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const displayPenugasan = useMemo(() => {
        if (!searchQuery.trim()) return penugasan;
        const q = searchQuery.toLowerCase();
        return penugasan.filter(p =>
            (p.supervisor_nama && p.supervisor_nama.toLowerCase().includes(q)) ||
            (p.supervisor_nip && p.supervisor_nip.toLowerCase().includes(q)) ||
            (p.guru_nama && p.guru_nama.toLowerCase().includes(q)) ||
            (p.guru_nip && p.guru_nip.toLowerCase().includes(q))
        );
    }, [penugasan, searchQuery]);

    return (
        <div>
            <FilterToolbar actionsInline={true} style={{ marginBottom: '24px' }}>
                {tahunAjaranList.length > 0 && setTahunAjaranId && (
                    <FilterSelect
                        label="Tahun Ajaran"
                        icon="calendar-event"
                        value={tahunAjaranId ? String(tahunAjaranId) : ''}
                        onChange={(val) => setTahunAjaranId(val ? Number(val) : null)}
                        width={200}
                        options={tahunAjaranList.map(ta => ({
                            value: String(ta.id),
                            label: `${ta.tahun_ajaran} - Sem ${ta.semester}`
                        }))}
                    />
                )}
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari supervisor atau guru..."
                    grow={1}
                />
                <FilterActions>
                    <input
                        ref={penugasanFileRef}
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleImportPenugasan}
                        style={{ display: 'none' }}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        icon="export"
                        onClick={handleExportPenugasan}
                        title="Export Excel"
                    >
                        Export
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        icon="import"
                        onClick={() => penugasanFileRef.current?.click()}
                        title="Import Excel"
                    >
                        Import
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        icon="add"
                        onClick={() => {
                            setIsEditMode(false);
                            setSelectedSupervisor('');
                            setSelectedGurus([]);
                            setInitialGurusMap({});
                            setModalTahunAjaranId(tahunAjaranId);
                            setIsModalOpen(true);
                        }}
                    >
                        Tambah Penugasan
                    </Button>
                </FilterActions>
            </FilterToolbar>
            <div className="sv-table-card" style={{
                overflow: 'hidden'
            }}>
                <table className="sv-table">
                    <thead>
                        <tr>
                            <th style={{textAlign: 'center', width: '14%'}}>No</th>
                            <th style={{width: '43%'}}>Supervisor</th>
                            <th style={{width: '43%'}}>Daftar Guru yang Dinilai</th>
                        </tr>
                    </thead>
                    <tbody>
                    {Object.values(displayPenugasan.reduce((acc: any, curr: any) => {
                        if (!acc[curr.supervisor_nip]) {
                            acc[curr.supervisor_nip] = {
                                supervisor_nip: curr.supervisor_nip,
                                supervisor_nama: curr.supervisor_nama,
                                gurus: []
                            };
                        }
                        acc[curr.supervisor_nip].gurus.push(curr);
                        return acc;
                    }, {})).map((group: any, i: number) => (
                        <tr key={group.supervisor_nip}>
                            <td data-label="No" style={{textAlign: 'center', verticalAlign: 'top', paddingTop: '16px'}}>{i+1}</td>
                            <td data-label="Supervisor" style={{verticalAlign: 'top', paddingTop: '16px', fontWeight: 600}}>{group.supervisor_nama}</td>
                            <td data-label="Guru yang Dinilai" style={{padding: '12px'}}>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                    {group.gurus.map((g: any, index: number) => (
                                        <div key={g.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: index < group.gurus.length - 1 ? '1px solid var(--n-border)' : 'none'}}>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                                <div style={{width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0, 56, 168, 0.1)', color: 'var(--n-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px'}}>
                                                    {g.guru_nama.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{fontWeight: 600, fontSize: '14px', color: 'var(--n-ink)'}}>{g.guru_nama}</div>
                                                    <div style={{fontSize: '12px', color: 'var(--n-muted)'}}>{g.guru_nip}</div>
                                                </div>
                                            </div>
                                            <div style={{display: 'flex', gap: '12px'}}>
                                                <button onClick={() => editPenugasan(group)} style={{background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', transition: 'transform 0.2s'}} title="Edit" onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                                <button onClick={() => deletePenugasan(g.id)} style={{background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', transition: 'transform 0.2s'}} title="Hapus" onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {displayPenugasan.length === 0 && (
                        <tr>
                            <td colSpan={3} style={{textAlign:'center', padding:'32px 16px', color:'var(--n-muted,#64748b)'}}>
                                {penugasan.length === 0 ? 'Belum ada penugasan di tahun ajaran ini' : 'Tidak ada penugasan yang cocok dengan pencarian'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            </div>
            
            {isModalOpen && createPortal(
                <div className="sv-modal-overlay">
                    <div className="sv-modal">
                        <div className="sv-modal-header">
                            <h3 className="sv-modal-title">{isEditMode ? 'Edit Penugasan Supervisor' : 'Tambah Penugasan Baru'}</h3>
                            <button className="sv-modal-close" onClick={() => setIsModalOpen(false)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="sv-form-group">
                            <label>Tahun Ajaran</label>
                            <select 
                                className="sv-input" 
                                value={modalTahunAjaranId || ''} 
                                onChange={(e) => setModalTahunAjaranId(Number(e.target.value))}
                                disabled={isEditMode}
                            >
                                <option value="" disabled>Pilih Tahun Ajaran...</option>
                                {allTahunAjaran.map(ta => (
                                    <option key={ta.id} value={ta.id}>
                                        {ta.tahun_ajaran} - Semester {ta.semester}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sv-form-group">
                            <label>Pilih Supervisor</label>
                            <select className="sv-select" value={selectedSupervisor} onChange={e => setSelectedSupervisor(e.target.value)} disabled={isEditMode}>
                                <option value="">-- Pilih Supervisor --</option>
                                {supervisorList.map(g => {
                                    const value = g.nip && g.nip !== '-' ? g.nip : g.id;
                                    return <option key={`sup-${g.id}`} value={value}>{g.nama_lengkap} {g.nip ? `(${g.nip})` : ''}</option>;
                                })}
                            </select>
                        </div>
                        <div className="sv-form-group">
                            <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span>Pilih Guru yang Dinilai (Multiselect)</span>
                                <input 
                                    className="sv-input" 
                                    style={{width: '200px', padding: '4px 8px', fontSize: '12px'}} 
                                    placeholder="Cari guru..." 
                                    value={guruSearch}
                                    onChange={e => setGuruSearch(e.target.value)}
                                />
                            </label>
                            <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--n-border)', borderRadius: '8px', padding: '12px', background: 'var(--n-bg)', marginTop: '8px'}}>
                                {(() => {
                                    const filtered = guruList.filter(g => g.nama_lengkap.toLowerCase().includes(guruSearch.toLowerCase()));
                                    const allFilteredSelected = filtered.length > 0 && filtered.every(g => selectedGurus.includes(g.nip && g.nip !== '-' ? g.nip : g.id));
                                    
                                    return (
                                        <>
                                            {filtered.length > 0 && (
                                                <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer', fontWeight: 600, borderBottom: '1px solid var(--n-border)', paddingBottom: '8px'}}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={allFilteredSelected}
                                                        onChange={() => selectAllGurus(filtered)}
                                                    />
                                                    <span>Pilih Semua Hasil Pencarian ({filtered.length})</span>
                                                </label>
                                            )}
                                            {filtered.map(g => {
                                                const value = g.nip && g.nip !== '-' ? g.nip : g.id;
                                                return (
                                                    <label key={`guru-${g.id}`} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer'}}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedGurus.includes(value)}
                                                            onChange={() => toggleGuruSelection(value)}
                                                        />
                                                        <span>{g.nama_lengkap} {g.nip ? `(${g.nip})` : ''}</span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                        
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px'}}>
                            <Button type="button" variant="cancel" onClick={() => setIsModalOpen(false)}>Batal</Button>
                            <Button type="button" variant="primary" icon="save" onClick={savePenugasan}>Simpan Penugasan</Button>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}


