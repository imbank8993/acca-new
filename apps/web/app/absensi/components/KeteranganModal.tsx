'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface KeteranganModalProps {
    isOpen: boolean;
    onClose: () => void;
    namaSiswa: string;
    /** Keterangan yang tersimpan saat ini */
    value: string;
    /** true kalau barisnya berasal dari modul Ketidakhadiran — tampil sebagai info, tidak bisa diedit */
    terintegrasi?: boolean;
    onSave: (text: string) => void;
}

/**
 * Modal keterangan absensi. Mengikuti pola KESELURUHAN CatatanSiswaModal
 * (header ikon + judul satu baris + nama siswa, body, tombol lebar penuh)
 * supaya dua modal yang dipanggil dari baris tabel yang sama terasa sekeluarga.
 * Sebelumnya ini popup input SweetAlert2, yang bentuknya lepas dari modal lain
 * di halaman ini.
 */
export default function KeteranganModal({
    isOpen, onClose, namaSiswa, value, terintegrasi, onSave
}: KeteranganModalProps) {
    const [teks, setTeks] = useState('');

    useEffect(() => {
        if (isOpen) setTeks(value || '');
    }, [isOpen, value]);

    if (!isOpen) return null;

    return typeof document !== 'undefined' ? createPortal(
        <div className="ktm-overlay" onClick={onClose}>
            <div className="ktm-modal" onClick={e => e.stopPropagation()}>
                <div className="ktm-header">
                    <div className="ktm-header-icon"><i className="bi bi-chat-left-text-fill" /></div>
                    <div className="ktm-header-text">
                        <h2>Keterangan Absensi</h2>
                        <p>{namaSiswa}</p>
                    </div>
                    <button className="ktm-close" onClick={onClose} aria-label="Tutup"><i className="bi bi-x-lg" /></button>
                </div>

                <div className="ktm-body">
                    {terintegrasi ? (
                        <>
                            <div className="ktm-note">
                                <i className="bi bi-info-circle-fill" />
                                <span>Status ini otomatis dari modul Ketidakhadiran. Ubah lewat menu tersebut.</span>
                            </div>
                            <div className="ktm-readonly">{value || '-'}</div>
                        </>
                    ) : (
                        <>
                            <textarea
                                className="ktm-textarea"
                                placeholder="Tulis keterangan izin / sakit / dll..."
                                value={teks}
                                onChange={e => setTeks(e.target.value)}
                                rows={3}
                                autoFocus
                            />
                            <button className="ktm-submit" onClick={() => { onSave(teks); onClose(); }}>
                                <i className="bi bi-check-lg" /> Simpan
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style jsx>{`
                .ktm-overlay {
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

                .ktm-modal {
                    width: min(520px, 100%);
                    max-height: 90vh;
                    background: var(--n-card);
                    border-radius: 20px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: ktmSlideUp 0.25s ease-out;
                }

                @keyframes ktmSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .ktm-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px 24px;
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                    flex-shrink: 0;
                }

                .ktm-header-icon {
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

                .ktm-header-text { flex: 1; min-width: 0; }

                /* Judul dikunci satu baris; min-width: 0 di atas yang membuat
                   ellipsis ini bekerja di dalam flex. */
                .ktm-header-text h2 {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--n-text);
                    margin: 0;
                    letter-spacing: -0.02em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .ktm-header-text p {
                    font-size: 12px;
                    color: var(--n-muted);
                    margin: 3px 0 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .ktm-close {
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
                .ktm-close:hover { background: var(--n-border); color: #ef4444; }

                .ktm-body {
                    padding: 20px 24px 24px;
                    overflow-y: auto;
                }

                .ktm-textarea {
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
                .ktm-textarea:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
                }

                .ktm-submit {
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
                .ktm-submit:hover { filter: brightness(1.05); }

                /* Tampilan terintegrasi (read-only) */
                .ktm-note {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    background: rgba(59, 130, 246, 0.08);
                    border: 1px solid rgba(59, 130, 246, 0.25);
                    color: #2563eb;
                    font-size: 12px;
                    line-height: 1.5;
                    margin-bottom: 12px;
                }

                .ktm-readonly {
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    padding: 10px 12px;
                    font-size: 13px;
                    color: var(--n-text);
                    background: var(--n-soft);
                    white-space: pre-wrap;
                    word-break: break-word;
                }

                :global(.dark) .ktm-modal {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                }
                :global(.dark) .ktm-header {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .ktm-header-icon {
                    background: #1a73e8 !important;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.5) !important;
                }
                :global(.dark) .ktm-header-text h2 { color: #e2e8f0 !important; }
                :global(.dark) .ktm-header-text p { color: #94a3b8 !important; }
                :global(.dark) .ktm-close {
                    background: rgba(255, 255, 255, 0.06) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .ktm-close:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .ktm-body { background: #0b1329 !important; }
                :global(.dark) .ktm-textarea {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #f1f5f9 !important;
                }
                :global(.dark) .ktm-readonly {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.25) !important;
                    color: #f1f5f9 !important;
                }
                :global(.dark) .ktm-submit {
                    background: #1a73e8 !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.45) !important;
                }

                /* Layar sempit: padding dirampingkan supaya judul satu baris muat utuh. */
                @media (max-width: 640px) {
                    .ktm-overlay { padding: 10px; }

                    .ktm-header {
                        gap: 10px;
                        padding: 14px 12px;
                    }
                    .ktm-header-icon {
                        width: 38px;
                        height: 38px;
                        border-radius: 12px;
                        font-size: 17px;
                    }
                    .ktm-header-text h2 { font-size: 15px; }
                    .ktm-close { width: 30px; height: 30px; }

                    .ktm-body { padding: 16px 12px 18px; }
                }
            `}</style>
        </div>,
        document.body
    ) : null;
}
