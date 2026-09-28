'use client';

import React from 'react';
import { BandingItem } from '../lib/bandingApi';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { formatDateId } from '@/lib/date-utils';

interface BandingTableProps {
    bandings: BandingItem[];
    isReviewer: boolean;
    onRowClick: (b: BandingItem) => void;
    onDelete?: (id: number) => void;
    loading?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
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

function getFieldLabel(field: string): string {
    return FIELD_LABELS[field] || field.replace(/_/g, ' ');
}

function parseKoreksi(koreksi: any): Array<{ field: string; nilai_lama: any; nilai_baru: any }> {
    if (!koreksi) return [];
    if (Array.isArray(koreksi)) return koreksi;
    if (typeof koreksi === 'string') {
        try {
            const parsed = JSON.parse(koreksi);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string; icon: string }> = {
        PENDING:   { label: 'Pending',   cls: 'bt__badge bt__badgePending',   icon: 'bi-clock-history' },
        APPROVED:  { label: 'Disetujui', cls: 'bt__badge bt__badgeApproved',  icon: 'bi-check-circle-fill' },
        REJECTED:  { label: 'Ditolak',  cls: 'bt__badge bt__badgeRejected',  icon: 'bi-x-circle-fill' },
    };
    const { label, cls, icon } = map[status] || { label: status, cls: 'bt__badge bt__badgePending', icon: 'bi-clock' };
    return <span className={cls}><i className={`bi ${icon}`} />{label}</span>;
}

function SkeletonRow() {
    return (
        <div className="bt__skeleton">
            {[1,2,3,4].map(i => (
                <div key={i} className="bt__skeletonBar" style={{ width: `${50 + i * 10}%` }} />
            ))}
        </div>
    );
}

export default function BandingTable({ bandings, isReviewer, onRowClick, onDelete, loading }: BandingTableProps) {
    if (loading) {
        return (
            <div className="bt__wrap">
                <div className="bt__cards">
                    {[1,2,3].map(i => <div key={i} className="bt__cardSkeleton"><SkeletonRow /></div>)}
                </div>
                <style jsx>{`.bt__skeleton { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
                    .bt__skeletonBar { height: 14px; border-radius: 6px; background: linear-gradient(90deg, var(--n-soft) 25%, var(--n-border) 50%, var(--n-soft) 75%); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
                    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                    .bt__cards { display: flex; flex-direction: column; gap: 10px; }
                    .bt__cardSkeleton { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; overflow: hidden; }
                    :global(.dark) .bt__skeletonBar { background: linear-gradient(90deg, #1e293b 25%, rgba(255,255,255,0.05) 50%, #1e293b 75%); background-size: 200% 100%; }
                    :global(.dark) .bt__cardSkeleton { border-color: rgba(255,255,255,0.07); }`}</style>
            </div>
        );
    }

    if (bandings.length === 0) {
        return (
            <div className="bt__emptyState">
                <div className="bt__emptyIcon"><i className="bi bi-inbox-fill" /></div>
                <p className="bt__emptyTitle">Belum Ada Pengajuan</p>
                <p className="bt__emptySub">Tidak ada data banding pada filter ini.</p>
                <style jsx>{`.bt__emptyState { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
                    .bt__emptyIcon { width: 72px; height: 72px; border-radius: 20px; background: var(--n-soft); border: 1px solid var(--n-border); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
                    .bt__emptyIcon i { font-size: 2rem; color: var(--n-muted); }
                    .bt__emptyTitle { font-size: 0.95rem; font-weight: 700; color: var(--n-ink); margin: 0 0 4px; }
                    .bt__emptySub { font-size: 0.8rem; color: var(--n-muted); margin: 0; }
                    :global(.dark) .bt__emptyIcon { background: #1e293b; border-color: rgba(255,255,255,0.08); }
                    :global(.dark) .bt__emptyIcon i { color: var(--n-muted); }
                    :global(.dark) .bt__emptyTitle { color: #e8edf5; }`}</style>
            </div>
        );
    }

    return (
        <div className="bt__wrap">
            {/* Desktop table */}
            <div className="bt__tableWrap">
                <table className="bt__table">
                    <thead>
                        <tr>
                            {isReviewer && <th className="bt__thNum">#</th>}
                            <th className="bt__thGuru">Guru</th>
                            <th className="bt__thJurnal">Jurnal & Permintaan Ganti</th>
                            <th className="bt__thAlasan">Alasan Banding</th>
                            <th className="bt__thStatus">Status & Review</th>
                            <th className="bt__thAction">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bandings.map((b, idx) => {
                            const jurnal = b.jurnal || (b as any).jurnal_guru;
                            const koreksiList = parseKoreksi(b.koreksi);
                            return (
                                <tr key={b.id} className="bt__row" onClick={() => onRowClick(b)}>
                                    {isReviewer && <td className="bt__tdNum">{idx + 1}</td>}
                                    <td>
                                        <div className="bt__guruInfo">
                                            <span className="bt__guruName">{b.nama_guru}</span>
                                            {b.nip && <span className="bt__guruNip">{b.nip}</span>}
                                            {jurnal?.kelas && <span className="bt__kelasChip">{jurnal.kelas}</span>}
                                            <span className="bt__guruDate" title="Tanggal Diajukan">
                                                <i className="bi bi-clock" />
                                                {new Date(b.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="bt__tdJurnal">
                                        <div className="bt__jurnalCol">
                                            {jurnal ? (
                                                <div className="bt__jurnalMeta">
                                                    <span className="bt__jurnalDate">
                                                        <i className="bi bi-calendar3" />
                                                        {formatDateId(jurnal.tanggal)}
                                                    </span>
                                                    <span className="bt__jurnalJam">jk-{jurnal.jam_ke}</span>
                                                    {jurnal.mata_pelajaran && (
                                                        <span className="bt__jurnalMapel">{jurnal.mata_pelajaran}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bt__jurnalMeta">
                                                    <span className="bt__muted">ID Jurnal #{b.jurnal_id}</span>
                                                </div>
                                            )}

                                            {koreksiList.length > 0 ? (
                                                <div className="bt__koreksiBox">
                                                    <div className="bt__koreksiTitle">
                                                        <i className="bi bi-arrow-left-right" />
                                                        <span>Permintaan Ganti:</span>
                                                    </div>
                                                    <div className="bt__koreksiItems">
                                                        {koreksiList.map((k, kIdx) => (
                                                            <div key={kIdx} className="bt__koreksiItem">
                                                                <span className="bt__koreksiField">{getFieldLabel(k.field)}:</span>
                                                                <div className="bt__koreksiDiff">
                                                                    <span className="bt__diffOld" title="Nilai Asli Sebelumnya">
                                                                        {k.nilai_lama !== null && k.nilai_lama !== undefined && k.nilai_lama !== '' 
                                                                            ? String(k.nilai_lama) 
                                                                            : '(kosong)'}
                                                                    </span>
                                                                    <i className="bi bi-arrow-right bt__diffArrow" />
                                                                    <span className="bt__diffNew" title="Permintaan Nilai Baru">
                                                                        {k.nilai_baru !== null && k.nilai_baru !== undefined && k.nilai_baru !== '' 
                                                                            ? String(k.nilai_baru) 
                                                                            : '(kosong)'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bt__koreksiEmpty">
                                                    <i className="bi bi-info-circle" />
                                                    <span>Tanpa rincian kolom (lihat alasan)</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="bt__tdAlasan">
                                        <div className="bt__alasanText">{b.alasan}</div>
                                    </td>
                                    <td>
                                        <div className="bt__statusCell">
                                            <StatusBadge status={b.status} />
                                            {b.reviewed_by_name && (
                                                <div className="bt__reviewerInfo">
                                                    {b.reviewed_by_name}{' '}
                                                    <small>({new Date(b.reviewed_at!).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})</small>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="bt__tdAction">
                                        <ActionGroup>
                                            <ActionButton
                                                action="view"
                                                title="Detail Pengajuan"
                                                onClick={e => { e.stopPropagation(); onRowClick(b); }}
                                            />
                                            {isReviewer && (
                                                <ActionButton
                                                    action="delete"
                                                    title="Hapus Data"
                                                    onClick={e => { e.stopPropagation(); onDelete?.(b.id); }}
                                                />
                                            )}
                                        </ActionGroup>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .bt__wrap { width: 100%; }

                /* ---- Desktop Table ---- */
                .bt__tableWrap {
                    overflow: hidden;
                    background: #ffffff;
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    border-radius: 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
                    width: 100%;
                }
                .bt__table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.83rem;
                    table-layout: auto;
                }
                .bt__table thead tr {
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                }
                .bt__table th {
                    padding: 12px 14px;
                    text-align: left;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .bt__thNum { width: 32px; white-space: nowrap; }
                .bt__thGuru { width: 20%; }
                .bt__thJurnal { width: 34%; }
                .bt__thAlasan { width: 24%; }
                .bt__thStatus { width: 14%; }
                .bt__thAction { width: 80px; text-align: center; }

                .bt__row {
                    border-bottom: 1px solid var(--n-border);
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .bt__row:hover { background: var(--n-soft); }
                .bt__row:last-child { border-bottom: none; }
                .bt__table td {
                    padding: 14px;
                    vertical-align: top;
                    color: var(--n-ink);
                }

                .bt__tdNum { color: var(--n-muted); font-size: 0.78rem; font-weight: 600; }
                .bt__tdAction { width: 80px; padding: 14px 8px; }

                /* Guru cell */
                .bt__guruInfo {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    align-items: flex-start;
                }
                .bt__guruName {
                    font-weight: 700;
                    color: var(--n-ink);
                    font-size: 0.83rem;
                }
                .bt__guruNip {
                    font-size: 0.68rem;
                    color: var(--n-muted);
                    font-family: monospace;
                }
                .bt__guruDate {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.68rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    margin-top: 2px;
                }
                .bt__guruDate i {
                    font-size: 0.72rem;
                }

                /* Jurnal & Koreksi cell */
                .bt__jurnalCol { display: flex; flex-direction: column; gap: 6px; }
                .bt__jurnalMeta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
                .bt__jurnalDate {
                    display: inline-flex; align-items: center; gap: 4px;
                    font-size: 0.8rem; font-weight: 700; color: var(--n-ink);
                }
                .bt__jurnalDate i { font-size: 0.75rem; color: var(--n-primary); }
                .bt__jurnalJam {
                    display: inline-flex; align-items: center;
                    font-size: 0.68rem; font-weight: 700;
                    padding: 1px 6px; border-radius: 5px;
                    background: rgba(59,130,246,0.1); color: var(--n-primary);
                    width: fit-content;
                }
                .bt__jurnalMapel { font-size: 0.74rem; font-weight: 600; color: var(--n-muted); }

                /* Koreksi Box */
                .bt__koreksiBox {
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    padding: 6px 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .bt__koreksiTitle {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--n-primary);
                }
                .bt__koreksiItems {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .bt__koreksiItem {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 4px;
                    font-size: 0.72rem;
                    line-height: 1.35;
                }
                .bt__koreksiField {
                    font-weight: 700;
                    color: var(--n-ink);
                    white-space: nowrap;
                }
                .bt__koreksiDiff {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    flex-wrap: wrap;
                }
                .bt__diffOld {
                    display: inline-flex;
                    align-items: center;
                    padding: 1px 5px;
                    border-radius: 4px;
                    background: rgba(239, 68, 68, 0.08);
                    color: #dc2626;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    font-size: 0.7rem;
                    font-weight: 500;
                    max-width: 140px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .bt__diffArrow {
                    font-size: 0.7rem;
                    color: var(--n-muted);
                    flex-shrink: 0;
                }
                .bt__diffNew {
                    display: inline-flex;
                    align-items: center;
                    padding: 1px 5px;
                    border-radius: 4px;
                    background: rgba(16, 185, 129, 0.1);
                    color: #059669;
                    border: 1px solid rgba(16, 185, 129, 0.25);
                    font-size: 0.7rem;
                    font-weight: 700;
                    max-width: 140px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .bt__koreksiEmpty {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.7rem;
                    color: var(--n-muted);
                    font-style: italic;
                    margin-top: 2px;
                }

                /* Kelas chip */
                .bt__kelasChip {
                    display: inline-flex; padding: 1px 7px; border-radius: 5px;
                    background: var(--n-soft); border: 1px solid var(--n-border);
                    font-size: 0.7rem; font-weight: 700; color: var(--n-primary);
                    width: fit-content; margin-top: 1px;
                }

                /* Alasan */
                .bt__tdAlasan {
                    vertical-align: top;
                }
                .bt__alasanText {
                    font-size: 0.82rem;
                    line-height: 1.45;
                    color: var(--n-ink);
                    white-space: normal;
                    word-break: break-word;
                }

                /* Status & Review cell (Strict 2-line column) */
                .bt__statusCell {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    justify-content: center;
                    gap: 5px;
                }
                .bt__reviewerInfo {
                    display: block;
                    font-size: 0.73rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    line-height: 1.3;
                    white-space: nowrap;
                }
                .bt__reviewerInfo small { color: var(--n-muted); font-weight: 400; }
                .bt__muted { color: var(--n-muted); }

                /* Detail button */
                .bt__detailBtn {
                    width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--n-border);
                    background: var(--n-card); color: var(--n-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.15s; font-size: 0.75rem;
                }
                .bt__detailBtn:hover { background: var(--n-primary); color: white; border-color: var(--n-primary); }
                .bt__actions { display: flex; gap: 6px; align-items: center; }
                .bt__deleteBtn {
                    width: 28px; height: 28px; border-radius: 8px; border: 1px solid #fee2e2;
                    background: #fef2f2; color: #ef4444; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.15s; font-size: 0.75rem;
                }
                .bt__deleteBtn:hover { background: #ef4444; color: white; border-color: #ef4444; }

                /* ---- Status Badges ---- */
                :global(.bt__badge) {
                    display: inline-flex; align-items: center; gap: 5px;
                    padding: 4px 10px; border-radius: 20px;
                    font-size: 0.72rem; font-weight: 800; white-space: nowrap;
                }
                :global(.bt__badge i) { font-size: 0.8rem; }
                :global(.bt__badgePending) { background: rgba(245,158,11,0.12); color: #d97706; }
                :global(.bt__badgeApproved) { background: rgba(34,197,94,0.12); color: #16a34a; }
                :global(.bt__badgeRejected) { background: rgba(239,68,68,0.12); color: #dc2626; }

                /* ---- Dark Mode ---- */
                :global(.dark) .bt__tableWrap {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    background-clip: padding-box !important;
                    transition: all 0.2s ease !important;
                }
                :global(.dark) .bt__tableWrap:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }
                :global(.dark) .bt__table thead tr {
                    background: rgba(37, 99, 235, 0.15) !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                :global(.dark) .bt__table th { color: #93c5fd !important; }
                :global(.dark) .bt__row { border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .bt__row:hover { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .bt__table td { color: #f1f5f9 !important; background: #0b1329 !important; }
                :global(.dark) .bt__guruName { color: #f1f5f9 !important; }
                :global(.dark) .bt__jurnalDate { color: #f1f5f9 !important; }
                :global(.dark) .bt__kelasChip {
                    background: #0b1329 !important;
                    border-color: rgba(26, 115, 232, 0.35) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .bt__jurnalJam {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .bt__reviewerInfo { color: #f1f5f9 !important; }
                :global(.dark) .bt__detailBtn {
                    background: #0b1329 !important;
                    border-color: rgba(26, 115, 232, 0.35) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .bt__detailBtn:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .bt__deleteBtn {
                    background: #0b1329 !important;
                    border-color: rgba(239, 68, 68, 0.35) !important;
                    color: #f87171 !important;
                }
                .bt__cardDeleteBtn {
                    padding: 2px 8px; border-radius: 6px; border: 1px solid #fb7185;
                    background: #fff1f2; color: #e11d48; font-size: 0.7rem; font-weight: 700;
                    cursor: pointer;
                }
                :global(.dark) .bt__cardDeleteBtn { background: rgba(225,29,72,0.1); border-color: rgba(225,29,72,0.2); }
                :global(.dark .bt__badgePending) { background: rgba(245,158,11,0.12); color: #fbbf24; }
                :global(.dark .bt__badgeApproved) { background: rgba(34,197,94,0.12); color: #4ade80; }
                :global(.dark .bt__badgeRejected) { background: rgba(239,68,68,0.12); color: #f87171; }

                :global(.dark) .bt__koreksiBox {
                    background: rgba(0, 0, 0, 0.4) !important;
                    border-color: rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .bt__koreksiTitle {
                    color: #60a5fa !important;
                }
                :global(.dark) .bt__koreksiField {
                    color: #e2e8f0 !important;
                }
                :global(.dark) .bt__diffOld {
                    background: rgba(239, 68, 68, 0.15) !important;
                    color: #fca5a5 !important;
                    border-color: rgba(239, 68, 68, 0.3) !important;
                }
                :global(.dark) .bt__diffNew {
                    background: rgba(16, 185, 129, 0.15) !important;
                    color: #6ee7b7 !important;
                    border-color: rgba(16, 185, 129, 0.3) !important;
                }

                /* ---- Mobile ---- */
                @media (max-width: 640px) {
                    .bt__tableWrap { display: none; }
                    .bt__cards { display: flex !important; flex-direction: column; gap: 10px; padding: 0 0 8px; }
                }
            `}</style>

            {/* Mobile cards */}
            <div className="bt__cards">
                {bandings.map(b => {
                    const jurnal = b.jurnal || (b as any).jurnal_guru;
                    const koreksiList = parseKoreksi(b.koreksi);
                    return (
                        <div key={b.id} className="bt__card" onClick={() => onRowClick(b)}>
                            <div className="bt__cardHead">
                                <div className="bt__cardGuru">
                                    <div>
                                        <div className="bt__guruName">{b.nama_guru}</div>
                                        {isReviewer && <div className="bt__guruNip">{b.nip}</div>}
                                    </div>
                                </div>
                                <StatusBadge status={b.status} />
                            </div>
                            <div className="bt__cardBody">
                                <div className="bt__cardRow">
                                    <span className="bt__cardLabel"><i className="bi bi-calendar3" />Jurnal</span>
                                    <span className="bt__cardValue">
                                        {jurnal ? <>{formatDateId(jurnal.tanggal)} · jk-{jurnal.jam_ke} · {jurnal.mata_pelajaran}</> : '—'}
                                    </span>
                                </div>
                                <div className="bt__cardRow">
                                    <span className="bt__cardLabel"><i className="bi bi-door-open" />Kelas</span>
                                    <span className="bt__cardValue">{jurnal?.kelas || '—'}</span>
                                </div>
                                {koreksiList.length > 0 && (
                                    <div className="bt__cardRow">
                                        <span className="bt__cardLabel"><i className="bi bi-arrow-left-right" />Ganti</span>
                                        <div className="bt__cardValue bt__cardKoreksiList">
                                            {koreksiList.map((k, kIdx) => (
                                                <div key={kIdx} className="bt__cardKoreksiItem">
                                                    <span className="bt__koreksiField">{getFieldLabel(k.field)}:</span>
                                                    <span className="bt__diffOld">{String(k.nilai_lama ?? '(kosong)')}</span>
                                                    <i className="bi bi-arrow-right bt__diffArrow" />
                                                    <span className="bt__diffNew">{String(k.nilai_baru ?? '(kosong)')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {isReviewer && (
                                    <div className="bt__cardRow">
                                        <span className="bt__cardLabel"><i className="bi bi-trash3" />Kelola</span>
                                        <button className="bt__cardDeleteBtn" onClick={e => { e.stopPropagation(); onDelete?.(b.id); }}>Hapus Data</button>
                                    </div>
                                )}
                                <div className="bt__cardRow">
                                    <span className="bt__cardLabel"><i className="bi bi-chat-left-text" />Alasan</span>
                                    <span className="bt__cardValue bt__cardAlasan">{b.alasan}</span>
                                </div>
                                {isReviewer && b.reviewed_by_name && (
                                    <div className="bt__cardRow">
                                        <span className="bt__cardLabel"><i className="bi bi-shield-check" />Review</span>
                                        <span className="bt__cardValue">{b.reviewed_by_name}</span>
                                    </div>
                                )}
                            </div>
                            <div className="bt__cardFoot">
                                <span className="bt__cardDate"><i className="bi bi-clock" />{new Date(b.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                <span className="bt__cardTap"><i className="bi bi-chevron-right" /></span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                /* ---- Mobile Cards ---- */
                .bt__cards { display: none; flex-direction: column; gap: 10px; }
                .bt__card {
                    background: var(--n-card); border: 1px solid var(--n-border);
                    border-radius: 16px; overflow: hidden;
                    cursor: pointer; transition: all 0.2s;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .bt__card:hover { border-color: var(--n-primary); box-shadow: 0 4px 12px rgba(0,56,168,0.08); transform: translateY(-1px); }
                .bt__cardHead {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 12px 14px 10px;
                    border-bottom: 1px solid var(--n-border);
                    background: var(--n-soft);
                }
                .bt__cardGuru { display: flex; align-items: center; gap: 8px; }
                .bt__cardBody { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
                .bt__cardRow { display: flex; align-items: flex-start; gap: 8px; font-size: 0.8rem; }
                .bt__cardLabel {
                    display: flex; align-items: center; gap: 4px;
                    color: var(--n-muted); font-weight: 600; min-width: 60px;
                    font-size: 0.72rem; flex-shrink: 0; padding-top: 1px;
                }
                .bt__cardLabel i { font-size: 0.85rem; }
                .bt__cardValue { color: var(--n-ink); font-weight: 500; flex: 1; }
                .bt__cardAlasan { -webkit-line-clamp: 2; -webkit-box-orient: vertical; display: -webkit-box; overflow: hidden; }
                .bt__cardKoreksiList {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .bt__cardKoreksiItem {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 4px;
                    font-size: 0.72rem;
                }
                .bt__cardFoot {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 8px 14px; border-top: 1px solid var(--n-border);
                    background: var(--n-soft);
                }
                .bt__cardDate {
                    display: flex; align-items: center; gap: 4px;
                    font-size: 0.72rem; color: var(--n-muted);
                }
                .bt__cardTap { color: var(--n-muted); font-size: 0.9rem; }

                /* Avatar reuse */
                .bt__avatar {
                    width: 34px; height: 34px; border-radius: 10px;
                    background: linear-gradient(135deg, var(--n-primary), #60a5fa);
                    color: white; font-weight: 800; font-size: 0.85rem;
                    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                }
                .bt__guruName { font-weight: 700; color: var(--n-ink); font-size: 0.83rem; }
                .bt__guruNip { font-size: 0.68rem; color: var(--n-muted); font-family: monospace; }

                /* Dark mobile */
                :global(.dark) .bt__card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    transition: all 0.2s ease !important;
                }
                :global(.dark) .bt__cardHead {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .bt__cardFoot {
                    background: #0b1329 !important;
                    border-top: 1px solid rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .bt__cardValue { color: #f1f5f9 !important; }
                :global(.dark) .bt__card:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }
                :global(.dark) .bt__cardTap { color: #38bdf8 !important; }
            `}</style>
        </div>
    );
}
