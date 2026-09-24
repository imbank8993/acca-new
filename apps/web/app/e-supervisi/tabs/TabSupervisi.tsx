'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStickyState } from '@/hooks/useStickyState';
import type { User } from '@/lib/types';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import { cachedGet, invalidateSvCache } from '../svCache';

const PremiumPDFViewer = dynamic(() => import('../components/PremiumPDFViewer'), { ssr: false });

export default function TabSupervisi({ user, tahunAjaranId }: { user: User, tahunAjaranId: number | null }) {
    const [penugasans, setPenugasans] = useState<any[]>([]);
    const [selectedPenugasan, setSelectedPenugasan] = useStickyState<any>(null, 'esv_selectedPenugasan');
    const [tahap, setTahap] = useStickyState('administrasi', 'sv_active_tab');
    const [semuaDokumen, setSemuaDokumen] = useState<any[]>([]);
    const [dokumen, setDokumen] = useState<any[]>([]);
    const [selectedDocId, setSelectedDocId] = useStickyState<number | null>(null, 'esv_selectedDocId');
    
    // Uploads & Previews
    const [unggahan, setUnggahan] = useState<any[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useStickyState(false, 'esv_isFullscreen');
    
    // Form state
    const [scores, setScores] = useState<Record<number, { nilai_mentah: string, catatan: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeout = React.useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (tahunAjaranId && user.nip) {
            fetchPenugasan();
        }
    }, [tahunAjaranId, user.nip]);

    useEffect(() => {
        if (tahunAjaranId) {
            fetchDokumen();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tahunAjaranId]);
    
    useEffect(() => {
        if (selectedPenugasan) {
            fetchUnggahan();
            fetchNilai();
        } else {
            setUnggahan([]);
            setScores({});
            setPreviewUrl(null);
            setSelectedDocId(null);
        }
    }, [selectedPenugasan]);

    useEffect(() => {
        if (dokumen.length > 0) {
            if (!selectedDocId || !dokumen.find(d => d.id === selectedDocId)) {
                setSelectedDocId(dokumen[0].id);
            }
        } else {
            setSelectedDocId(null);
        }
    }, [dokumen]);

    useEffect(() => {
        if (selectedDocId) {
            const fileUploaded = unggahan.find(u => u.dokumen_id === selectedDocId);
            if (fileUploaded) {
                setPreviewUrl(fileUploaded.file_url);
            } else {
                setPreviewUrl(null);
            }
        }
    }, [selectedDocId, unggahan]);

    const fetchPenugasan = async (force = false) => {
        try {
            const role = user.role || '';
            const isAdmin = role.includes('ADMIN') || role.includes('KAMAD');
            const url = isAdmin
                ? `/api/e-supervisi/penugasan?tahun_ajaran_id=${tahunAjaranId}`
                : `/api/e-supervisi/penugasan?tahun_ajaran_id=${tahunAjaranId}&supervisor_nip=${user.nip}`;
            if (force) invalidateSvCache('/api/e-supervisi/penugasan');
            const json = await cachedGet(url);
            if (json.ok) {
                setPenugasans(json.data);
                // Only set default if we don't already have a valid selectedPenugasan from session storage
                if (json.data.length > 0) {
                    setSelectedPenugasan((prev: any) => {
                        if (prev && json.data.find((p: any) => p.id === prev.id)) {
                            return prev;
                        }
                        return json.data[0];
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchDokumen = async () => {
        if (!tahunAjaranId) return;
        try {
            const json = await cachedGet(`/api/e-supervisi/dokumen?tahun_ajaran_id=${tahunAjaranId}`);
            if (json.ok) {
                setSemuaDokumen(json.data);
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    useEffect(() => {
        if (semuaDokumen.length > 0) {
            const filtered = semuaDokumen.filter(d => d.tahap === tahap);
            setDokumen(filtered);
            
            const allTahap = [...new Set(semuaDokumen.map(d => d.tahap))];
            if (!allTahap.includes(tahap) && allTahap.length > 0) {
                setTahap(allTahap[0] as string);
            }
        } else {
            setDokumen([]);
        }
    }, [semuaDokumen, tahap]);
    
    const fetchUnggahan = async () => {
        try {
            const json = await cachedGet(`/api/e-supervisi/unggahan?tahun_ajaran_id=${tahunAjaranId}&guru_nip=${selectedPenugasan.guru_nip}`);
            if (json.ok) setUnggahan(json.data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchNilai = async () => {
        try {
            const json = await cachedGet(`/api/e-supervisi/nilai?penugasan_id=${selectedPenugasan.id}`, 15_000);
            if (json.ok) {
                const loadedScores: Record<number, any> = {};
                json.data.forEach((n: any) => {
                    loadedScores[n.indikator_id] = {
                        nilai_mentah: n.nilai_mentah,
                        catatan: n.catatan || ''
                    };
                });
                setScores(loadedScores);
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    const saveData = async (currentScores: Record<number, any>) => {
        setIsSaving(true);
        const payloadScores = Object.keys(currentScores).map(id => ({
            indikator_id: Number(id),
            nilai_mentah: currentScores[Number(id)].nilai_mentah,
            catatan: currentScores[Number(id)].catatan
        })).filter(s => s.nilai_mentah !== '' || s.catatan !== '');
        
        if (payloadScores.length > 0) {
            try {
                await fetch('/api/e-supervisi/nilai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        penugasan_id: selectedPenugasan.id,
                        scored_by: user.nip,
                        scores: payloadScores
                    })
                });
                // Data nilai/rekap/progres berubah — buang cache agar tab lain memuat data terbaru
                invalidateSvCache('/api/e-supervisi/nilai');
                invalidateSvCache('/api/e-supervisi/rekap');
                invalidateSvCache('/api/e-supervisi/penugasan');
            } catch (e) {
                console.error('Failed to auto-save', e);
            }
        }
        setIsSaving(false);
    };

    const handleScoreChange = (id: number, field: 'nilai_mentah' | 'catatan', value: string) => {
        setScores(prev => {
            const next = { ...prev, [id]: { ...prev[id] || { nilai_mentah: '', catatan: '' }, [field]: value } };
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
            saveTimeout.current = setTimeout(() => {
                saveData(next);
            }, 800);
            return next;
        });
    };
    
    const calculateTotalScore = () => {
        let total = 0;
        let maxTotal = 0;
        
        const processIndicator = (ind: any) => {
            const config = ind.skala_config || {};
            const hasSub = ind.sub_indikators && ind.sub_indikators.length > 0;
            
            if (config.tipe === 'group' || hasSub) {
                if (hasSub) {
                    ind.sub_indikators.forEach(processIndicator);
                }
                return;
            }
            
            const val = scores[ind.id]?.nilai_mentah;
            let max = 4;
            let current = 0;
            
            if (config.tipe === 'huruf' || config.tipe === 'yatidak') {
                max = 100;
                if (val === 'A' || val === '100' || val === 'Ya') current = 100;
                else if (val === 'B') current = 85;
                else if (val === 'C') current = 70;
                else if (val === 'D') current = 50;
                else if (val === '0' || val === 'Tidak') current = 0;
            } else {
                max = config.max || 4;
                current = Number(val) || 0;
            }
            
            total += current;
            maxTotal += max;
        };

        semuaDokumen.forEach(doc => {
            doc.indikators?.forEach(processIndicator);
        });
        
        if (maxTotal === 0) return '0.00';
        return ((total / maxTotal) * 100).toFixed(2);
    };
    


    if (penugasans.length === 0) {
        return <div className="sv-card sv-empty">
            <i className="bi bi-people"></i>
            <h3>Belum Ada Guru yang Dinilai</h3>
            <p>Anda belum memiliki guru yang dinilai yang ditugaskan pada tahun ajaran ini.</p>
        </div>;
    }

    return (
        <div className="sv-card">
            <div style={{marginBottom: '24px'}}>
                <h3 style={{fontSize: '16px', marginBottom: '16px'}}>Daftar Guru yang Dinilai</h3>
                {penugasans.length === 0 ? (
                    <div className="sv-empty">Belum ada guru yang dinilai yang ditugaskan kepada Anda.</div>
                ) : (
                    <table className="sv-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Nama Guru</th>
                                <th>Mata Pelajaran</th>
                                <th>Kelas</th>
                                <th>Status</th>
                                <th style={{width: '200px'}}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {penugasans.map((p, i) => (
                                <tr key={p.id}>
                                    <td data-label="No">{i + 1}</td>
                                    <td data-label="Nama Guru">
                                        <div style={{fontWeight: 600, fontSize: '15px'}}>{p.guru_nama}</div>
                                        <div style={{fontSize: '13px', color: 'var(--n-muted)'}}>{p.guru_nip || '-'}</div>
                                    </td>
                                    <td data-label="Mata Pelajaran">{p.guru_mapel || '-'}</td>
                                    <td data-label="Kelas">{p.guru_kelas || '-'}</td>
                                    <td data-label="Status">
                                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px', width: '100%'}}>
                                            {p.progres === 0 ? (
                                                <span className="sv-badge" style={{background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444'}}>Belum dinilai</span>
                                            ) : (
                                                <div style={{display: 'flex', alignItems: 'center', gap: '8px', flex: 1}}>
                                                    <div style={{height: '6px', flex: 1, background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden'}}>
                                                        <div style={{height: '100%', width: `${p.progres}%`, background: p.progres === 100 ? '#0284c7' : 'var(--n-primary)', borderRadius: '3px'}}></div>
                                                    </div>
                                                    <span style={{fontSize: '12px', fontWeight: 600, color: p.progres === 100 ? '#0284c7' : 'var(--n-primary)'}}>{p.progres}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td data-label="Aksi">
                                        <button 
                                            className="sv-btn sv-btn-primary"
                                            onClick={() => {
                                                setSelectedPenugasan(p);
                                                setIsFullscreen(true);
                                            }}
                                            style={{width: '100%', justifyContent: 'center'}}
                                        >
                                            <i className="bi bi-check-square"></i> Nilai
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isFullscreen && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999, background: 'var(--n-card)', display: 'flex', flexDirection: 'column'
                }}>
                    <div className="esv-fs-header" style={{padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--n-border)', background: 'var(--n-bg)', gap: '12px', flexWrap: 'wrap'}}>
                        <div className="esv-fs-headerLeft" style={{display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                <h3 style={{margin: 0, fontSize: '18px'}}>Penilaian:</h3>
                                <select 
                                    className="sv-select" 
                                    value={selectedPenugasan?.id || ''} 
                                    onChange={(e) => setSelectedPenugasan(penugasans.find(p => p.id === Number(e.target.value)))}
                                    style={{padding: '6px 12px', fontSize: '14px', background: 'var(--n-bg)', border: '1px solid var(--n-border)', borderRadius: '6px', minWidth: '200px'}}
                                >
                                    {penugasans.map(p => (
                                        <option key={p.id} value={p.id}>{p.guru_nama} {p.status === 'terkunci' ? '(Terkunci)' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="sv-stage-tabs" style={{marginBottom: 0}}>
                                {[...new Set(semuaDokumen.map(d => d.tahap))].map((t: any) => (
                                    <button key={t} className={`sv-stage-tab ${tahap === t ? 'active' : ''}`} onClick={() => setTahap(t)}>{t}</button>
                                ))}
                            </div>
                        </div>
                        <div className="esv-fs-headerRight" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                            <div style={{background: 'var(--n-primary)', color: 'white', padding: '6px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                <div style={{fontSize: '11px', opacity: 0.9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'}}>Total Skor</div>
                                <div style={{fontSize: '20px', fontWeight: 700, lineHeight: '1.2'}}>{calculateTotalScore()}</div>
                            </div>
                            <button className="sv-btn sv-btn-outline" onClick={() => { setIsFullscreen(false); fetchPenugasan(); }} style={{background: 'var(--n-card)'}}>
                                <i className="bi bi-x-lg"></i> Tutup
                            </button>
                        </div>
                    </div>

                    <div className="esv-fs-body" style={{flex: 1, display: 'flex', overflow: 'hidden'}}>
                        <div className="esv-fs-left" style={{width: '45%', flexShrink: 0, borderRight: '1px solid var(--n-border)', overflowY: 'auto', padding: '24px', background: 'var(--n-card)', display: 'flex', flexDirection: 'column'}}>
                            <div style={{fontWeight: 600, fontSize: '18px', marginBottom: '24px'}}>Borang Penilaian</div>
                            
                            <div style={{marginBottom: '20px'}}>
                                <label style={{fontWeight: 600, display: 'block', marginBottom: '8px'}}>Pilih Dokumen:</label>
                                <select 
                                    className="sv-select" 
                                    value={selectedDocId || ''} 
                                    onChange={(e) => setSelectedDocId(Number(e.target.value))}
                                >
                                    {dokumen.map(doc => {
                                        const isUploaded = unggahan.some(u => u.dokumen_id === doc.id);
                                        return (
                                            <option key={doc.id} value={doc.id}>
                                                {doc.nama_dokumen} {isUploaded ? '✓' : '(Belum Diunggah)'}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {dokumen.map(doc => {
                                if (doc.id !== selectedDocId) return null;
                                const fileUploaded = unggahan.find(u => u.dokumen_id === doc.id);
                                return (
                                    <div key={doc.id} style={{marginBottom: '24px'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                                            <h4 style={{margin: 0, fontSize: '15px'}}>{doc.nama_dokumen}</h4>
                                            {!fileUploaded && (
                                                <span className="sv-badge" style={{background: '#fef2f2', color: '#ef4444', fontSize: '12px'}}>Belum diunggah</span>
                                            )}
                                        </div>

                                        <table className="sv-table" style={{width: '100%', fontSize: '13px'}}>
                                            <thead>
                                                <tr>
                                                    <th style={{width: '40px', textAlign: 'center'}}>No</th>
                                                    <th>Indikator</th>
                                                    <th style={{width: '200px', textAlign: 'center'}}>Skor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {doc.indikators?.map((ind: any, idx: number) => {
                                                    const renderIndicatorRow = (indicator: any, index: number, isChild: boolean) => {
                                                        const val = scores[indicator.id] || { nilai_mentah: '', catatan: '' };
                                                        const config = indicator.skala_config || { min: 1, max: 4 };
                                                        const hasSubIndicators = indicator.sub_indikators && indicator.sub_indikators.length > 0;
                                                        const isGroup = config.tipe === 'group' || hasSubIndicators;
                                                        const isLocked = selectedPenugasan?.status === 'terkunci';
                                                        
                                                        // Determine options
                                                        let options: any[] = [];
                                                        if (config.tipe === 'huruf') {
                                                            options = [
                                                                { label: 'A', value: 'A' },
                                                                { label: 'B', value: 'B' },
                                                                { label: 'C', value: 'C' },
                                                                { label: 'D', value: 'D' }
                                                            ];
                                                        } else if (config.tipe === 'yatidak') {
                                                            options = [
                                                                { label: 'Ya', value: '100' },
                                                                { label: 'Tidak', value: '0' }
                                                            ];
                                                        } else if (!isGroup) {
                                                            const min = config.min || 1;
                                                            const max = config.max || 4;
                                                            options = Array.from({length: max - min + 1}, (_, i) => ({
                                                                label: String(min + i),
                                                                value: String(min + i)
                                                            }));
                                                        }
                                                        
                                                        return (
                                                            <tr key={indicator.id} style={{background: isGroup ? 'rgba(0,0,0,0.02)' : 'transparent'}}>
                                                                <td data-label="No" style={{width: '40px', textAlign: 'center', color: 'var(--n-muted)'}}>{isChild ? '' : index + 1}</td>
                                                                <td data-label="Indikator" style={{paddingLeft: isChild ? '32px' : '16px'}}>
                                                                    <div style={{fontWeight: isChild ? 400 : 600, fontSize: '14px', color: 'var(--n-ink)'}}>
                                                                        {isChild && <i className="bi bi-arrow-return-right" style={{marginRight: '8px', color: 'var(--n-muted)'}}></i>}
                                                                        {indicator.nama_indikator}
                                                                    </div>
                                                                </td>
                                                                <td data-label="Skor" style={{width: '200px', textAlign: 'right'}}>
                                                                    {!isGroup && (
                                                                        <div className="sv-scoring-options" style={{display: 'flex', gap: '8px', justifyContent: 'flex-end', opacity: isLocked ? 0.6 : 1, pointerEvents: isLocked ? 'none' : 'auto'}}>
                                                                            {options.map((opt, oidx) => (
                                                                                <label key={opt.value} style={{margin: 0}}>
                                                                                    <input 
                                                                                        type="radio" 
                                                                                        name={`score_${indicator.id}`} 
                                                                                        value={opt.value} 
                                                                                        checked={String(val.nilai_mentah) === opt.value}
                                                                                        onChange={(e) => handleScoreChange(indicator.id, 'nilai_mentah', e.target.value)}
                                                                                        style={{display: 'none'}}
                                                                                        disabled={isLocked}
                                                                                    />
                                                                                    <div className="sv-square-check" style={{cursor: isLocked ? 'not-allowed' : 'pointer', width: config.tipe === 'yatidak' ? '50px' : '32px'}}>
                                                                                        {opt.label}
                                                                                    </div>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    };
                                                    
                                                    return (
                                                        <React.Fragment key={ind.id}>
                                                            {renderIndicatorRow(ind, idx + 1, false)}
                                                            {ind.sub_indikators?.map((subInd: any) => renderIndicatorRow(subInd, 0, true))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {doc.indikators?.length > 0 && (
                                            <div style={{marginTop: '24px', background: 'var(--n-bg)', padding: '16px', borderRadius: '8px'}}>
                                                <label style={{fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '8px', color: 'var(--n-muted)'}}>
                                                    Catatan Tambahan untuk Dokumen ini:
                                                </label>
                                                <textarea 
                                                    className="sv-textarea" 
                                                    placeholder="Opsional..." 
                                                    rows={3} 
                                                    value={scores[doc.indikators[0].id]?.catatan || ''}
                                                    onChange={(e) => handleScoreChange(doc.indikators[0].id, 'catatan', e.target.value)}
                                                    style={{fontSize: '13px'}}
                                                    disabled={selectedPenugasan?.status === 'terkunci'}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            
                            <div style={{marginTop: 'auto', textAlign: 'center', padding: '16px 0 0 0', opacity: 0.6}}>
                                {isSaving ? (
                                    <span style={{fontSize: '13px', color: 'var(--n-muted)'}}><i className="bi bi-arrow-repeat"></i> Menyimpan otomatis...</span>
                                ) : (
                                    <span style={{fontSize: '13px', color: 'var(--n-muted)'}}><i className="bi bi-cloud-check"></i> Tersimpan otomatis</span>
                                )}
                            </div>
                        </div>

                        <div className="esv-fs-right" style={{flex: 1, display: 'flex', flexDirection: 'column', background: '#333'}}>
                            {previewUrl ? (
                                <PremiumPDFViewer url={previewUrl} />
                            ) : (
                                <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', flexDirection: 'column'}}>
                                    <i className="bi bi-file-earmark-pdf" style={{fontSize: '64px', marginBottom: '16px', opacity: 0.5}}></i>
                                    <p style={{fontSize: '18px'}}>Pilih dokumen dari panel kiri untuk melihat pratinjau</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <style jsx global>{`
                .sv-square-check {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: 1px solid var(--n-border);
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    color: var(--n-muted);
                    background: var(--n-bg);
                    transition: all 0.2s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                input[type="radio"]:checked + .sv-square-check {
                    background: var(--n-primary);
                    color: white;
                    border-color: var(--n-primary);
                    box-shadow: 0 4px 6px -1px rgba(var(--n-primary-rgb), 0.3);
                }
                input[type="radio"]:hover + .sv-square-check {
                    border-color: var(--n-primary);
                }
                @media (max-width: 900px) {
                    .esv-fs-header {
                        padding: 12px 16px !important;
                        align-items: stretch !important;
                    }
                    .esv-fs-headerLeft {
                        width: 100%;
                        gap: 12px !important;
                    }
                    .esv-fs-headerLeft .sv-stage-tabs {
                        width: 100%;
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                    }
                    .esv-fs-headerRight {
                        width: 100%;
                        justify-content: space-between !important;
                    }
                    .esv-fs-body {
                        flex-direction: column !important;
                        overflow-y: auto !important;
                    }
                    .esv-fs-left {
                        width: 100% !important;
                        border-right: none !important;
                        border-bottom: 1px solid var(--n-border);
                        overflow-y: visible !important;
                        padding: 16px !important;
                    }
                    .esv-fs-right {
                        min-height: 70vh;
                    }
                }
            `}</style>
        </div>
    );
}
