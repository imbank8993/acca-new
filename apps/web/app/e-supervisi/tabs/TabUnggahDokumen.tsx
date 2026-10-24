'use client';

import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { cachedGet, invalidateSvCache } from '../svCache';

const PremiumPDFViewer = dynamic(() => import('../components/PremiumPDFViewer'), { ssr: false });

export default function TabUnggahDokumen({ user, tahunAjaranId }: { user: User, tahunAjaranId: number | null }) {
    const [tahap, setTahap] = useState('administrasi');
    const [semuaDokumen, setSemuaDokumen] = useState<any[]>([]);
    const [dokumen, setDokumen] = useState<any[]>([]);
    const [unggahan, setUnggahan] = useState<any[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    // Penilaian guru ini sudah dikunci supervisor/pengelola → dokumen final.
    const [terkunci, setTerkunci] = useState(false);

    useEffect(() => {
        if (tahunAjaranId && user.nip) {
            fetchUnggahan();
            fetchStatusKunci();
        }
    }, [tahunAjaranId, user.nip]);

    const fetchStatusKunci = async () => {
        try {
            const json = await cachedGet(`/api/e-supervisi/penugasan?tahun_ajaran_id=${tahunAjaranId}&guru_nip=${encodeURIComponent(user.nip || '')}`);
            setTerkunci(Boolean(json.ok && (json.data || []).some((p: any) => p.guru_nip === user.nip && p.status === 'terkunci')));
        } catch {
            setTerkunci(false);
        }
    };

    useEffect(() => {
        if (tahunAjaranId) {
            fetchDokumen();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tahunAjaranId]);

    const fetchUnggahan = async (force = false) => {
        try {
            if (force) invalidateSvCache('/api/e-supervisi/unggahan');
            const json = await cachedGet(`/api/e-supervisi/unggahan?tahun_ajaran_id=${tahunAjaranId}&guru_nip=${encodeURIComponent(user.nip || '')}`);
            if (json.ok) {
                setUnggahan(json.data);
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
                // Sembunyikan dokumen yang butuh_dokumen = false
                const filteredDocs = json.data.filter((d: any) => d.butuh_dokumen !== false);
                setSemuaDokumen(filteredDocs);
                const allTahap = [...new Set(filteredDocs.map((d: any) => d.tahap))];
                if (allTahap.length > 0 && (!tahap || !(allTahap as string[]).includes(tahap))) {
                    setTahap(allTahap[0] as string);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    useEffect(() => {
        if (semuaDokumen.length > 0) {
            setDokumen(semuaDokumen.filter(d => d.tahap === tahap));
        } else {
            setDokumen([]);
        }
    }, [semuaDokumen, tahap]);

    const handleUpload = (file: File, docId: number) => {
        if (!tahunAjaranId || !user.nip) return Swal.fire('Error', 'Sesi tidak valid atau Tahun Ajaran belum aktif', 'error');
        if (terkunci) return Swal.fire('Terkunci', 'Penilaian supervisi Anda sudah dikunci; dokumen tidak dapat diubah lagi.', 'info');
        if (uploadProgress[docId.toString()] !== undefined) return; // masih mengunggah
        // Penampil dokumen supervisor hanya membuka PDF.
        if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
            return Swal.fire('Format tidak didukung', 'Unggah dokumen dalam format PDF.', 'warning');
        }
        if (file.size > 20 * 1024 * 1024) {
            return Swal.fire('Berkas terlalu besar', 'Ukuran dokumen maksimal 20 MB.', 'warning');
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('guru_nip', user.nip);
        formData.append('tahun_ajaran_id', tahunAjaranId.toString());
        formData.append('dokumen_id', docId.toString());

        setUploadProgress(prev => ({ ...prev, [docId.toString()]: 0 }));
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/e-supervisi/upload', true);
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(prev => ({ ...prev, [docId.toString()]: percentComplete }));
            }
        };
        
        xhr.onload = () => {
            let json: any = null;
            try { json = JSON.parse(xhr.responseText); } catch { json = null; }
            if (!json) {
                Swal.fire('Error', xhr.status === 413 ? 'Berkas terlalu besar untuk server' : 'Terjadi kesalahan pada server', 'error');
            } else {
                try {
                    if (xhr.status === 200 && json.ok) {
                        Swal.fire({
                            title: 'Sukses',
                            text: 'Dokumen berhasil diunggah',
                            icon: 'success',
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 3000
                        });
                        setUnggahan(prev => [...prev.filter(u => u.dokumen_id !== docId), json.data]);
                        invalidateSvCache('/api/e-supervisi/unggahan');
                    } else {
                        Swal.fire('Gagal Mengunggah', json.error || json.message || 'Gagal mengunggah dokumen', 'error');
                        if (xhr.status === 403) fetchStatusKunci();
                    }
                } catch (e) {
                    Swal.fire('Error', 'Gagal memproses respons server', 'error');
                }
            }
            setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[docId.toString()];
                return newProgress;
            });
        };
        
        xhr.onerror = () => {
            Swal.fire('Error', 'Gagal menyambung ke server', 'error');
            setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[docId.toString()];
                return newProgress;
            });
        };
        
        xhr.send(formData);
    };

    const handleDelete = async (unggahanId: number) => {
        const result = await Swal.fire({
            title: 'Hapus Dokumen?',
            text: "File fisik dokumen ini juga akan dihapus secara permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/e-supervisi/unggahan?id=${unggahanId}`, { method: 'DELETE' });
                const json = await res.json();
                if (json.ok) {
                    setUnggahan(prev => prev.filter(u => u.id !== unggahanId));
                    invalidateSvCache('/api/e-supervisi/unggahan');
                    Swal.fire({
                        title: 'Terhapus!',
                        text: 'Dokumen berhasil dihapus.',
                        icon: 'success',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                } else {
                    throw new Error(json.message || json.error);
                }
            } catch (e: any) {
                Swal.fire('Error', e.message || 'Gagal menghapus dokumen', 'error');
            }
        }
    };

    if (!tahunAjaranId) {
        return <div className="sv-card sv-empty">
            <i className="bi bi-calendar-x"></i>
            <h3>Tahun Ajaran Belum Aktif</h3>
            <p>Tidak dapat mengunggah dokumen karena tidak ada tahun ajaran yang aktif.</p>
        </div>;
    }

    return (
        <div className="sv-card">
            {terkunci && (
                <div style={{background: 'rgba(100,116,139,0.1)', border: '1px solid var(--n-border)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: 'var(--n-muted)'}}>
                    <i className="bi bi-lock-fill"></i> Penilaian supervisi Anda sudah dikunci. Dokumen tetap dapat dilihat tetapi tidak dapat diganti atau dihapus.
                </div>
            )}
            <div style={{fontSize: '12px', color: 'var(--n-muted)', marginBottom: '8px'}}>
                <i className="bi bi-info-circle"></i> Format dokumen: PDF, maksimal 20 MB.
            </div>
            <div className="sv-stage-tabs">
                {[...new Set(semuaDokumen.map(d => d.tahap))].map((t: any) => (
                    <button key={t} className={`sv-stage-tab ${tahap === t ? 'active' : ''}`} onClick={() => setTahap(t)}>{t}</button>
                ))}
            </div>

            <div style={{
                background: 'var(--n-card)',
                borderRadius: '16px',
                border: '1px solid var(--n-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                marginTop: '16px'
            }}>
                <table className="sv-table">
                    <thead>
                        <tr>
                            <th style={{textAlign: 'center', width: '50px'}}>No</th>
                            <th>Dokumen & Deskripsi</th>
                            <th style={{width: '200px'}}>Status</th>
                            <th style={{width: '200px', textAlign: 'center'}}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dokumen.map((doc, index) => {
                            const uploaded = unggahan.find(u => u.dokumen_id === doc.id);
                            const progress = uploadProgress[doc.id.toString()];
                            const isUploading = progress !== undefined;
                            
                            return (
                                <tr key={doc.id}>
                                    <td data-label="No" style={{textAlign: 'center'}}>{index + 1}</td>
                                    <td data-label="Dokumen">
                                        <div>
                                            <div style={{fontWeight: 600, fontSize: '15px', color: 'var(--n-ink)'}}>{doc.nama_dokumen}</div>
                                            {doc.deskripsi && <div style={{color: 'var(--n-muted)', fontSize: '13px', marginTop: '4px'}}>{doc.deskripsi}</div>}
                                        </div>
                                    </td>
                                    <td data-label="Status">
                                        {isUploading ? (
                                            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--n-primary)', fontSize: '14px', fontWeight: 500}}>
                                                <i className="bi bi-arrow-clockwise animate-spin"></i> Mengunggah... {progress}%
                                            </div>
                                        ) : uploaded ? (
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontSize: '14px', fontWeight: 600}}>
                                                    <i className="bi bi-check-circle-fill"></i> Telah diunggah
                                                </div>
                                                <div style={{fontSize: '12px', color: 'var(--n-primary)', display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                    <i className="bi bi-file-earmark-pdf"></i> {uploaded.file_name}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '14px', fontWeight: 500}}>
                                                <i className="bi bi-x-circle-fill"></i> Belum diunggah
                                            </div>
                                        )}
                                    </td>
                                    <td data-label="Aksi" style={{textAlign: 'center'}}>
                                        <div style={{display: 'flex', justifyContent: 'center', gap: '8px'}}>
                                            <input 
                                                type="file" 
                                                id={`file-${doc.id}`} 
                                                style={{display: 'none'}} 
                                                accept=".pdf,application/pdf"
                                                disabled={terkunci || isUploading}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    // Dikosongkan agar memilih berkas yang sama lagi tetap memicu unggah.
                                                    e.target.value = '';
                                                    if (f) handleUpload(f, doc.id);
                                                }}
                                            />
                                            {uploaded ? (
                                                <>
                                                    <button onClick={() => setPreviewUrl(uploaded.file_url)} title="Lihat Dokumen" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.2s'}}>
                                                        <i className="bi bi-eye"></i>
                                                    </button>
                                                    {!terkunci && <label htmlFor={`file-${doc.id}`} title="Ganti Dokumen" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'all 0.2s'}}>
                                                        <i className="bi bi-arrow-repeat"></i>
                                                    </label>}
                                                    {!terkunci && <button onClick={() => handleDelete(uploaded.id)} title="Hapus Dokumen" style={{background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.2s'}}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>}
                                                </>
                                            ) : terkunci ? (
                                                <span style={{fontSize: '13px', color: 'var(--n-muted)'}}><i className="bi bi-lock"></i> Terkunci</span>
                                            ) : (
                                                <label htmlFor={`file-${doc.id}`} style={{background: 'var(--n-primary)', color: 'white', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, transition: 'all 0.2s'}}>
                                                    <i className="bi bi-cloud-arrow-up"></i> Unggah
                                                </label>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {dokumen.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{textAlign: 'center', padding: '32px', color: 'var(--n-muted)'}}>
                                    Belum ada dokumen yang perlu diunggah untuk tahap ini.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {previewUrl && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: '#111827',
                    zIndex: 999999,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 24px',
                        backgroundColor: '#1f2937',
                        borderBottom: '1px solid #374151',
                        color: 'white'
                    }}>
                        <h3 style={{margin: 0, fontSize: '18px', fontWeight: 600}}>Pratinjau Dokumen</h3>
                        <button 
                            onClick={() => setPreviewUrl(null)}
                            style={{
                                background: 'white', color: 'var(--n-text)', 
                                border: 'none', borderRadius: '8px',
                                width: '32px', height: '32px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: '18px',
                                transition: 'transform 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div style={{flex: 1, backgroundColor: '#f1f5f9', overflow: 'hidden'}}>
                        <PremiumPDFViewer url={previewUrl} />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
