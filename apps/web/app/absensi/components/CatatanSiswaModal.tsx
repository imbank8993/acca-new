'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import type { CatatanSiswa } from '@/lib/types';

interface CatatanSiswaModalProps {
    isOpen: boolean;
    onClose: () => void;
    sesiId: string;
    nisn: string;
    namaSiswa: string;
    kelas?: string;
    mapel?: string;
    readOnly?: boolean;
    currentNip: string;
    /** Dipanggil setelah tambah/hapus catatan, supaya parent bisa refresh badge di tabel */
    onChanged?: () => void;
}

async function authFetch(url: string, options: RequestInit = {}) {
    return fetch(url, options);
}

export default function CatatanSiswaModal({
    isOpen, onClose, sesiId, nisn, namaSiswa, kelas, mapel, readOnly, currentNip, onChanged
}: CatatanSiswaModalProps) {
    const [items, setItems] = useState<CatatanSiswa[]>([]);
    const [loading, setLoading] = useState(false);
    const [jenis, setJenis] = useState<'POSITIF' | 'NEGATIF' | null>(null);
    const [teks, setTeks] = useState('');
    const [saving, setSaving] = useState(false);

    async function loadItems() {
        setLoading(true);
        try {
            const res = await authFetch(`/api/catatan-siswa?sesi_id=${encodeURIComponent(sesiId)}&nisn=${encodeURIComponent(nisn)}`);
            const json = await res.json();
            if (json.ok) setItems(json.data || []);
        } catch (e) {
            console.error('Gagal memuat catatan siswa:', e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (isOpen && sesiId && nisn) {
            loadItems();
        } else {
            setItems([]);
            setJenis(null);
            setTeks('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, sesiId, nisn]);

    if (!isOpen) return null;

    async function handleAdd() {
        if (!jenis) {
            Swal.fire({ icon: 'warning', title: 'Pilih jenis catatan', text: 'Pilih Positif atau Negatif terlebih dahulu.' });
            return;
        }
        if (!teks.trim()) {
            Swal.fire({ icon: 'warning', title: 'Catatan kosong', text: 'Tulis catatan terlebih dahulu.' });
            return;
        }
        setSaving(true);
        try {
            const res = await authFetch('/api/catatan-siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sesi_id: sesiId, nisn, nama_snapshot: namaSiswa, jenis, catatan: teks.trim() })
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menyimpan catatan');
            setTeks('');
            setJenis(null);
            await loadItems();
            onChanged?.();
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        const confirm = await Swal.fire({
            icon: 'warning', title: 'Hapus catatan?', text: 'Catatan yang dihapus tidak bisa dikembalikan.',
            showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'
        });
        if (!confirm.isConfirmed) return;
        try {
            const res = await authFetch(`/api/catatan-siswa/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menghapus catatan');
            await loadItems();
            onChanged?.();
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
        }
    }

    return typeof document !== 'undefined' ? createPortal(
        <div className="csm-overlay" onClick={onClose}>
            <div className="csm-modal" onClick={e => e.stopPropagation()}>
                <div className="csm-header">
                    <div className="csm-header-icon"><i className="bi bi-journal-plus"></i></div>
                    <div className="csm-header-text">
                        <h2>Catatan Pembelajaran</h2>
                        {/* Nama saja — kelas & mapel sudah terlihat di toolbar
                            halaman, dan di layar sempit keduanya cuma memangkas
                            nama siswa jadi terpotong ellipsis. */}
                        <p>{namaSiswa}</p>
                    </div>
                    <button className="csm-close" onClick={onClose} aria-label="Tutup"><i className="bi bi-x-lg" /></button>
                </div>

                <div className="csm-body">
                    {loading ? (
                        <div className="csm-loading"><i className="bi bi-arrow-repeat"></i> Memuat catatan...</div>
                    ) : items.length === 0 ? (
                        <div className="csm-empty"><i className="bi bi-inbox"></i> Belum ada catatan.</div>
                    ) : (
                        <div className="csm-list">
                            {items.map(it => (
                                <div key={it.id} className={`csm-card csm-card--${it.jenis.toLowerCase()}`}>
                                    <div className="csm-card-top">
                                        <span className="csm-card-badge">
                                            <i className={`bi ${it.jenis === 'POSITIF' ? 'bi-emoji-smile-fill' : 'bi-emoji-frown-fill'}`}></i>
                                            {it.jenis === 'POSITIF' ? 'Positif' : 'Negatif'}
                                        </span>
                                        {it.status !== 'BARU' ? (
                                            <span className="csm-card-status">
                                                <i className="bi bi-check2-circle"></i> {it.status === 'SELESAI' ? 'Selesai ditindaklanjuti BK' : 'Ditindaklanjuti BK'}
                                            </span>
                                        ) : (it.nip === currentNip && !readOnly) ? (
                                            <button className="csm-card-delete" onClick={() => handleDelete(it.id)} title="Hapus catatan">
                                                <i className="bi bi-trash3"></i>
                                            </button>
                                        ) : null}
                                    </div>
                                    <p className="csm-card-text">{it.catatan}</p>
                                    <span className="csm-card-time">
                                        {it.nama_guru} • {new Date(it.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {!readOnly && (
                        <div className="csm-form">
                            <div className="csm-jenis-toggle">
                                <button
                                    type="button"
                                    className={`csm-jenis-btn csm-jenis-btn--positif ${jenis === 'POSITIF' ? 'active' : ''}`}
                                    onClick={() => setJenis('POSITIF')}
                                >
                                    <i className="bi bi-emoji-smile-fill"></i> Positif
                                </button>
                                <button
                                    type="button"
                                    className={`csm-jenis-btn csm-jenis-btn--negatif ${jenis === 'NEGATIF' ? 'active' : ''}`}
                                    onClick={() => setJenis('NEGATIF')}
                                >
                                    <i className="bi bi-emoji-frown-fill"></i> Negatif
                                </button>
                            </div>
                            <textarea
                                className="csm-textarea"
                                placeholder="Tulis catatan perilaku siswa..."
                                value={teks}
                                onChange={e => setTeks(e.target.value)}
                                rows={3}
                            />
                            <button className="csm-submit" onClick={handleAdd} disabled={saving}>
                                {saving ? <><i className="bi bi-arrow-repeat"></i> Menyimpan...</> : <><i className="bi bi-plus-lg"></i> Tambah</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .csm-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 16px;
                    backdrop-filter: blur(8px);
                }

                .csm-modal {
                    width: min(520px, 100%);
                    max-height: 90vh;
                    background: var(--n-card);
                    border-radius: 20px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: csmSlideUp 0.25s ease-out;
                }

                @keyframes csmSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .csm-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px 24px;
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                    flex-shrink: 0;
                }

                .csm-header-icon {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    border-radius: 14px;
                    font-size: 20px;
                    color: white;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                    flex-shrink: 0;
                }

                .csm-header-text { flex: 1; min-width: 0; }
                /* Judul dikunci satu baris. Tanpa ini "Catatan Pembelajaran"
                   patah jadi dua baris di layar sempit dan menaikkan tinggi
                   header. min-width: 0 pada .csm-header-text di atas yang
                   membuat ellipsis ini bekerja di dalam flex. */
                .csm-header-text h2 {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--n-text);
                    margin: 0;
                    letter-spacing: -0.02em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .csm-header-text p {
                    font-size: 12px;
                    color: var(--n-muted);
                    margin: 3px 0 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .csm-close {
                    width: 34px;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    border: none;
                    background: transparent;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 16px;
                    flex-shrink: 0;
                }
                .csm-close:hover { background: var(--n-border); color: #ef4444; }

                .csm-body {
                    padding: 20px 24px 24px;
                    overflow-y: auto;
                }

                /* Padding dikecilkan dari 24px: teksnya cuma satu baris pendek,
                   jadi 48px ruang kosong atas-bawah membuat modal terasa
                   berlubang di antara header dan form di bawahnya. */
                .csm-loading, .csm-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 0 14px;
                    color: var(--n-muted);
                    font-size: 13px;
                    text-align: center;
                }

                .csm-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .csm-card {
                    border-radius: 12px;
                    padding: 12px 14px;
                    border: 1px solid;
                }
                .csm-card--positif {
                    background: rgba(59, 130, 246, 0.06);
                    border-color: rgba(59, 130, 246, 0.25);
                }
                .csm-card--negatif {
                    background: rgba(239, 68, 68, 0.06);
                    border-color: rgba(239, 68, 68, 0.25);
                }

                .csm-card-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    margin-bottom: 6px;
                }

                .csm-card-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .csm-card--positif .csm-card-badge { color: #2563eb; }
                .csm-card--negatif .csm-card-badge { color: #dc2626; }

                .csm-card-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 10px;
                    font-weight: 600;
                    color: var(--n-muted);
                }

                .csm-card-delete {
                    border: none;
                    background: transparent;
                    color: var(--n-muted);
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 6px;
                    transition: all 0.15s;
                }
                .csm-card-delete:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

                .csm-card-text {
                    font-size: 13px;
                    color: var(--n-text);
                    margin: 0 0 6px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                }

                .csm-card-time {
                    font-size: 11px;
                    color: var(--n-muted);
                }

                .csm-form {
                    border-top: 1px solid var(--n-border);
                    padding-top: 12px;
                }

                .csm-jenis-toggle {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .csm-jenis-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1.5px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-muted);
                    font-size: 12.5px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .csm-jenis-btn--positif.active {
                    border-color: #3b82f6;
                    background: rgba(59, 130, 246, 0.1);
                    color: #2563eb;
                }
                .csm-jenis-btn--negatif.active {
                    border-color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                    color: #dc2626;
                }

                .csm-textarea {
                    width: 100%;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    padding: 10px 12px;
                    font-size: 13px;
                    color: var(--n-text);
                    background: var(--n-card);
                    resize: vertical;
                    margin-bottom: 12px;
                    font-family: inherit;
                }
                .csm-textarea:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
                }

                .csm-submit {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 11px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                }
                .csm-submit:hover { filter: brightness(1.05); }
                .csm-submit:disabled { opacity: 0.6; cursor: not-allowed; }

                /* ── Dark Mode ── */
                :global(.dark) .csm-overlay {
                    background: rgba(0, 0, 0, 0.85) !important;
                    backdrop-filter: blur(8px) !important;
                }
                :global(.dark) .csm-modal {
                    background: #0b1329 !important;
                    background-image: linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(11, 19, 41, 0.4) 30%, #0b1329 100%) !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 20px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                }
                :global(.dark) .csm-header {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .csm-header-icon {
                    background: #1a73e8 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.5) !important;
                }
                :global(.dark) .csm-header-text h2 {
                    background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                    background-clip: text !important;
                    color: transparent !important;
                    display: inline-block;
                }
                :global(.dark) .csm-header-text p { color: #94a3b8 !important; }
                :global(.dark) .csm-close {
                    background: rgba(255, 255, 255, 0.06) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .csm-close:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .csm-tabs {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .csm-tab {
                    color: #94a3b8 !important;
                }
                :global(.dark) .csm-tab.active {
                    color: #38bdf8 !important;
                    border-bottom: 2px solid #3b82f6 !important;
                }
                :global(.dark) .csm-body { background: #0b1329 !important; color: #f1f5f9 !important; }
                :global(.dark) .csm-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                :global(.dark) .csm-card-text { color: #f1f5f9 !important; }
                :global(.dark) .csm-card-meta { color: #94a3b8 !important; }
                :global(.dark) .csm-textarea {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #f1f5f9 !important;
                }
                :global(.dark) .csm-textarea:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 10px rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .csm-jenis-btn {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .csm-jenis-btn--positif.active {
                    border-color: #3b82f6 !important;
                    background: rgba(59, 130, 246, 0.15) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .csm-jenis-btn--negatif.active {
                    border-color: #ef4444 !important;
                    background: rgba(239, 68, 68, 0.15) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .csm-submit {
                    background: #1a73e8 !important;
                    border: 1.5px solid #3b82f6 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.45) !important;
                }

                /* Di layar sempit semua padding dirampingkan supaya kolom teks
                   selebar mungkin — judul satu baris harus muat utuh, bukan
                   langsung terpotong ellipsis. Ambangnya 640px (bukan 480px)
                   karena pada 481-640px pun sisa lebarnya masih kurang. */
                @media (max-width: 640px) {
                    .csm-overlay { padding: 10px; }

                    .csm-header {
                        gap: 10px;
                        padding: 14px 12px;
                    }
                    .csm-header-icon {
                        width: 38px;
                        height: 38px;
                        border-radius: 12px;
                        font-size: 17px;
                    }
                    .csm-header-text h2 { font-size: 15px; }
                    .csm-close { width: 30px; height: 30px; }

                    .csm-body { padding: 16px 12px 18px; }
                }
            `}</style>
        </div>,
        document.body
    ) : null;
}
