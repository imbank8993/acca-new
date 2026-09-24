'use client';

import React, { useState, useEffect } from 'react';
import { BandingItem, fetchBandingDetail, reviewBanding } from '../lib/bandingApi';
import Swal from 'sweetalert2';
import { formatDateId } from '@/lib/date-utils';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface BandingDetailModalProps {
    isOpen?: boolean;
    open?: boolean;
    onClose: () => void;
    onReviewed?: () => void;
    onSuccess?: () => void;
    banding?: BandingItem | null;
    item?: BandingItem | null;
    isReviewer: boolean;
    user?: any;
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        PENDING: { label: 'Pending', cls: 'bds__pending' },
        APPROVED: { label: 'Disetujui', cls: 'bds__approved' },
        REJECTED: { label: 'Ditolak', cls: 'bds__rejected' },
    };
    const { label, cls } = map[status] || { label: status, cls: 'bds__pending' };
    return <span className={`bds__badge ${cls}`}>{label}</span>;
}

function getFieldLabel(field: string) {
    const labels: Record<string, string> = {
        kelas: 'Kelas',
        mata_pelajaran: 'Mata Pelajaran',
        jam_ke: 'Jam Ke',
        materi: 'Materi',
        refleksi: 'Refleksi',
        guru_pengganti: 'Guru Pengganti',
        kategori_kehadiran: 'Status Kehadiran',
        durasi_terlambat: 'Durasi Terlambat (Menit)',
        keterangan_terlambat: 'Ket. Terlambat',
        status_pengganti: 'Status Pengganti',
        guru_piket: 'Guru Piket',
        keterangan_tambahan: 'Ket. Tambahan',
    };
    return labels[field] || field;
}

export default function BandingDetailModal({
    isOpen,
    open,
    onClose,
    onReviewed,
    onSuccess,
    banding,
    item,
    isReviewer
}: BandingDetailModalProps) {
    const isModalOpen = Boolean(isOpen ?? open);
    const targetBanding = banding || item || null;
    const handleSuccess = onReviewed || onSuccess || (() => {});

    const [detail, setDetail] = useState<BandingItem | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [catatan, setCatatan] = useState('');

    useEffect(() => {
        if (!isModalOpen || !targetBanding) return;
        setLoading(true);
        setCatatan('');
        fetchBandingDetail(targetBanding.id)
            .then(res => {
                setDetail(res.banding);
                setHistory(res.history || []);
            })
            .catch(err => Swal.fire({
                toast: true, position: 'top', icon: 'error',
                title: 'Gagal memuat data: ' + (err.message || ''),
                showConfirmButton: false, timer: 3000,
            }))
            .finally(() => setLoading(false));
    }, [isModalOpen, targetBanding]);

    if (!isModalOpen) return null;

    const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
        const action = status === 'APPROVED' ? 'Menyetujui' : 'Menolak';
        const confirm = await Swal.fire({
            toast: true,
            position: 'top',
            icon: 'warning',
            title: `${action} Banding?`,
            text: status === 'APPROVED'
                ? 'Koreksi akan langsung diterapkan ke jurnal.'
                : 'Banding akan ditolak. Guru akan melihat catatan penolakan.',
            showCancelButton: true,
            confirmButtonText: action,
            cancelButtonText: 'Batal',
            reverseButtons: true,
        });
        if (!confirm.isConfirmed) return;

        setSubmitting(true);
        try {
            await reviewBanding(targetBanding!.id, status, catatan.trim() || undefined);
            Swal.fire({
                toast: true, position: 'top', icon: 'success',
                title: `Banding berhasil ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}!`,
                showConfirmButton: false, timer: 2000,
            });
            handleSuccess();
            onClose();
        } catch (err: any) {
            Swal.fire({
                toast: true, position: 'top', icon: 'error',
                title: 'Gagal: ' + (err.message || ''),
                showConfirmButton: false, timer: 3000,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const jurnal = detail?.jurnal || banding?.jurnal;
    const koreksi = detail?.koreksi || banding?.koreksi || [];

    return (
        <Modal
            open={isModalOpen}
            onClose={onClose}
            size="lg"
            variant="default"
            title="Detail Banding Jurnal"
            subtitle={`${targetBanding?.nama_guru || ''} · ${new Date(targetBanding?.created_at || '').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`}
            icon="journal-check"
        >
            <ModalBody className="bdm__body">
                {loading ? (
                    <div className="bdm__loading"><div className="bdm__spinner" /></div>
                ) : (
                    <>
                        {/* Info row */}
                        <div className="bdm__infoRow">
                            <div className="bdm__infoChip"><span>NIP</span><strong>{targetBanding?.nip}</strong></div>
                            <div className="bdm__infoChip"><span>Status</span><StatusBadge status={detail?.status || targetBanding?.status || 'PENDING'} /></div>
                            {detail?.reviewed_by_name && (
                                <div className="bdm__infoChip"><span>Diperiksa Oleh</span><strong>{detail.reviewed_by_name}</strong></div>
                            )}
                        </div>

                        {/* Alasan */}
                        <div className="bdm__section">
                            <div className="bdm__sectionTitle">Alasan Banding</div>
                            <div className="bdm__alasanBox">{targetBanding?.alasan}</div>
                        </div>

                        {/* Data jurnal */}
                        {jurnal && (
                            <div className="bdm__section">
                                <div className="bdm__sectionTitle">Data Jurnal Asli</div>
                                <div className="bdm__jurnalGrid">
                                    <div><span>Tanggal</span><strong>{jurnal.hari ? `${jurnal.hari}, ` : ''}{formatDateId(jurnal.tanggal)}</strong></div>
                                    <div><span>Kelas</span><strong>{jurnal.kelas}</strong></div>
                                    <div><span>Jam Ke</span><strong>{jurnal.jam_ke}</strong></div>
                                    <div><span>Mapel</span><strong>{jurnal.mata_pelajaran}</strong></div>
                                    <div><span>Guru</span><strong>{jurnal.nama_guru}</strong></div>
                                    <div><span>Status</span><strong>{jurnal.kategori_kehadiran}</strong></div>
                                </div>
                            </div>
                        )}

                        {/* Koreksi */}
                        {koreksi.length > 0 && (
                            <div className="bdm__section">
                                <div className="bdm__sectionTitle">Koreksi yang Diminta ({koreksi.length} item)</div>
                                <div className="bdm__koreksiList">
                                    {koreksi.map((k: any, i: number) => (
                                        <div key={i} className="bdm__koreksiItem">
                                            <div className="bdm__koreksiField">{getFieldLabel(k.field)}</div>
                                            <div className="bdm__koreksiDiff">
                                                <span className="bdm__diffOld">{k.nilai_lama ?? '(kosong)'}</span>
                                                <i className="bi bi-arrow-right bdm__diffArrow" />
                                                <span className="bdm__diffNew">{k.nilai_baru || '(kosong)'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Catatan reviewer (jika sudah diproses) */}
                        {detail?.catatan_reviewer && (
                            <div className="bdm__section">
                                <div className="bdm__sectionTitle">Catatan Reviewer</div>
                                <div className="bdm__catatanBox">{detail.catatan_reviewer}</div>
                            </div>
                        )}

                        {/* Review form (hanya jika PENDING dan reviewer) */}
                        {isReviewer && (detail?.status || targetBanding?.status) === 'PENDING' && (
                            <div className="bdm__reviewSection">
                                <div className="bdm__sectionTitle">Proses Banding</div>
                                <textarea
                                    className="bdm__catatanInput"
                                    placeholder="Tambahkan catatan (opsional)..."
                                    value={catatan}
                                    onChange={e => setCatatan(e.target.value)}
                                    rows={2}
                                />
                                <div className="bdm__reviewActions">
                                    <Button
                                        type="button"
                                        variant="danger"
                                        onClick={() => handleReview('REJECTED')}
                                        disabled={submitting}
                                        icon="cancel"
                                    >
                                        Tolak Banding
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => handleReview('APPROVED')}
                                        disabled={submitting}
                                        icon="save"
                                    >
                                        Terima & Terapkan
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Histori */}
                        {history.length > 0 && (
                            <div className="bdm__section">
                                <div className="bdm__sectionTitle">Riwayat</div>
                                <div className="bdm__historyList">
                                    {history.map((h: any, i: number) => (
                                        <div key={i} className="bdm__historyItem">
                                            <div className="bdm__historyDot" />
                                            <div className="bdm__historyContent">
                                                <span className="bdm__historyAction">{h.action}</span>
                                                <span className="bdm__historyMeta"> oleh {h.actor_name || h.actor} · {new Date(h.created_at).toLocaleString('id-ID')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </ModalBody>

            <ModalFooter>
                <Button variant="cancel" onClick={onClose}>
                    Tutup
                </Button>
            </ModalFooter>

            <style jsx>{`
                :global(.bdm__body) {
                    padding: 14px 18px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 12px !important;
                    overflow-y: auto !important;
                    max-height: calc(85vh - 120px);
                    scrollbar-width: thin;
                }

                .bdm__loading { display: flex; justify-content: center; padding: 40px; }
                .bdm__spinner {
                    width: 32px; height: 32px; border: 3px solid var(--n-border);
                    border-top-color: var(--n-primary); border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .bdm__infoRow { display: flex; flex-wrap: wrap; gap: 8px; }
                .bdm__infoChip {
                    display: flex; align-items: center; gap: 6px;
                    padding: 5px 10px; border-radius: 8px;
                    background: var(--n-soft); border: 1px solid var(--n-border);
                    font-size: 0.78rem;
                }
                .bdm__infoChip span { color: var(--n-muted); }
                .bdm__infoChip strong { color: var(--n-ink); font-weight: 700; }

                .bdm__badge {
                    display: inline-flex; align-items: center;
                    padding: 3px 10px; border-radius: 20px;
                    font-size: 0.72rem; font-weight: 800;
                }
                .bds__pending { background: rgba(245,158,11,0.15); color: #d97706; }
                .bds__approved { background: rgba(34,197,94,0.15); color: #16a34a; }
                .bds__rejected { background: rgba(239,68,68,0.15); color: #dc2626; }

                .bdm__section { }
                .bdm__sectionTitle {
                    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
                    font-weight: 700; color: var(--n-muted); margin-bottom: 6px;
                }
                .bdm__alasanBox {
                    padding: 10px 12px; border-radius: 10px;
                    background: var(--n-soft); border: 1px solid var(--n-border);
                    color: var(--n-ink); font-size: 0.82rem; white-space: pre-line;
                }
                .bdm__jurnalGrid {
                    display: grid; grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                }
                .bdm__jurnalGrid > div {
                    display: flex; flex-direction: column; gap: 1px;
                    padding: 7px 10px; border-radius: 8px;
                    background: var(--n-soft); border: 1px solid var(--n-border);
                }
                .bdm__jurnalGrid span { font-size: 0.68rem; color: var(--n-muted); font-weight: 600; }
                .bdm__jurnalGrid strong { font-size: 0.78rem; color: var(--n-ink); }

                .bdm__koreksiList { display: flex; flex-direction: column; gap: 6px; }
                .bdm__koreksiItem {
                    display: flex; align-items: center; gap: 10px;
                    padding: 8px 12px; border-radius: 10px;
                    background: #fff7ed; border: 1px solid #fed7aa;
                }
                :global(.dark) .bdm__koreksiItem { background: #1c1007; border-color: rgba(253,230,138,0.15); }
                .bdm__koreksiField {
                    font-size: 0.75rem; font-weight: 700; color: #92400e;
                    min-width: 100px;
                }
                :global(.dark) .bdm__koreksiField { color: #fb923c; }
                .bdm__koreksiDiff { display: flex; align-items: center; gap: 8px; flex: 1; }
                .bdm__diffOld {
                    padding: 3px 8px; border-radius: 5px; font-size: 0.75rem;
                    background: rgba(239,68,68,0.1); color: #dc2626;
                    text-decoration: line-through; font-style: italic;
                }
                :global(.dark) .bdm__diffOld { background: rgba(239,68,68,0.15); color: #f87171; }
                .bdm__diffArrow { color: var(--n-muted); font-size: 0.9rem; }
                .bdm__diffNew {
                    padding: 3px 8px; border-radius: 5px; font-size: 0.75rem;
                    background: rgba(34,197,94,0.1); color: #16a34a; font-weight: 600;
                }
                :global(.dark) .bdm__diffNew { background: rgba(34,197,94,0.15); color: #4ade80; }

                .bdm__catatanBox {
                    padding: 10px 12px; border-radius: 10px;
                    background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);
                    color: #92400e; font-size: 0.82rem; white-space: pre-line;
                }
                :global(.dark) .bdm__catatanBox { background: rgba(245,158,11,0.1); color: #fbbf24; border-color: rgba(245,158,11,0.2); }

                .bdm__reviewSection {
                    padding: 12px; border-radius: 12px;
                    background: var(--n-soft); border: 1px solid var(--n-border);
                    display: flex; flex-direction: column; gap: 10px;
                }
                .bdm__catatanInput {
                    width: 100%; padding: 8px 12px; border-radius: 8px;
                    border: 1px solid var(--n-border); background: var(--n-card);
                    color: var(--n-ink); font-size: 0.82rem;
                    font-family: inherit; resize: vertical;
                    box-sizing: border-box;
                }
                .bdm__catatanInput:focus { outline: none; border-color: var(--n-primary); box-shadow: var(--n-ring); }
                .bdm__reviewActions { display: flex; gap: 8px; justify-content: flex-end; }

                .bdm__historyList { display: flex; flex-direction: column; gap: 0; }
                .bdm__historyItem {
                    display: flex; align-items: flex-start; gap: 8px;
                    padding: 4px 0; position: relative;
                }
                .bdm__historyDot {
                    width: 8px; height: 8px; border-radius: 50%;
                    background: var(--n-primary); flex-shrink: 0; margin-top: 6px;
                }
                .bdm__historyContent { font-size: 0.78rem; }
                .bdm__historyAction { font-weight: 600; color: var(--n-ink); }
                .bdm__historyMeta { color: var(--n-muted); }

                @media (max-width: 480px) {
                    .bdm__jurnalGrid { grid-template-columns: 1fr 1fr; }
                    .bdm__koreksiItem { flex-direction: column; align-items: flex-start; }
                    .bdm__koreksiDiff { flex-direction: column; align-items: flex-start; }
                    .bdm__diffArrow { transform: rotate(90deg); }
                }
            `}</style>
        </Modal>
    );
}
