'use client';

import React from 'react';
import { ActionButton } from '@/components/ui/ActionButtons';

export interface KetidakhadiranRow {
    id: string;
    jenis: 'IZIN' | 'SAKIT';
    nisn: string;
    nama: string;
    kelas: string;
    tgl_mulai: string;
    tgl_selesai: string;
    keterangan: string;
    status: string;
    petugas_nama: string | null;
    created_at: string;
    jumlah_hari: number;
    jumlah_jp: number;
    display_hari: string;
    is_time_specific: boolean;
    periode: string;
    kelas_chip?: string;
    foto_profil?: string | null;
}

interface KetidakhadiranTableProps {
    rows: KetidakhadiranRow[];
    loading?: boolean;
    hideKeterangan?: boolean; // For privacy - hide sick keterangan for students
    onViewHistory?: (nisn: string) => void;
}

function JenisBadge({ jenis }: { jenis: string }) {
    const cls = jenis === 'IZIN'
        ? 'kl__badge kl__badgeIzin'
        : 'kl__badge kl__badgeSakit';
    return (
        <span className={cls}>
            {jenis === 'IZIN' ? <i className="bi bi-paperclip" /> : <i className="bi bi-thermometer-half" />}
            {jenis}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        // Izin status
        MADRASAH: { label: 'Madrasah', cls: 'kl__badge kl__badgeMadrasah' },
        PERSONAL: { label: 'Personal', cls: 'kl__badge kl__badgePersonal' },
        // Sakit status
        RINGAN: { label: 'Ringan', cls: 'kl__badge kl__badgeRingan' },
        SEDANG: { label: 'Sedang', cls: 'kl__badge kl__badgeSedang' },
        BERAT: { label: 'Berat', cls: 'kl__badge kl__badgeBerat' },
        KONTROL: { label: 'Kontrol', cls: 'kl__badge kl__badgeKontrol' },
        // Legacy/pending status
        pending: { label: 'Pending', cls: 'kl__badge kl__badgePending' },
        approved: { label: 'Approved', cls: 'kl__badge kl__badgeApproved' },
        rejected: { label: 'Ditolak', cls: 'kl__badge kl__badgeRejected' },
    };
    const { label, cls } = map[status?.toUpperCase()] || { label: status, cls: 'kl__badge kl__badgePending' };
    return <span className={cls}>{label}</span>;
}

function SkeletonRows() {
    return (
        <div className="kl__skeletonList">
            {[1,2,3,4,5].map(i => (
                <div key={i} className="kl__skeletonRow">
                    {[85, 120, 70, 90, 60].map((w, j) => (
                        <div key={j} className="kl__skeletonBar" style={{ width: `${w}px`, height: j === 0 ? '16px' : '12px', animationDelay: `${j * 0.1}s` }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export default function KetidakhadiranTable({ rows, loading, hideKeterangan = false, onViewHistory }: KetidakhadiranTableProps) {
    if (loading) {
        return (
            <div className="kl__wrap">
                <div className="kl__skeletonWrap">
                    <SkeletonRows />
                </div>
                <style jsx>{`
                    .kl__skeletonList { display: flex; flex-direction: column; gap: 1px; }
                    .kl__skeletonRow {
                        display: flex; align-items: center; gap: 16px;
                        padding: 14px 16px; background: var(--n-card);
                        border-bottom: 1px solid var(--n-border);
                    }
                    .kl__skeletonBar {
                        border-radius: 6px;
                        background: linear-gradient(90deg, var(--n-soft) 25%, var(--n-border) 50%, var(--n-soft) 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.4s ease-in-out infinite;
                    }
                    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                    :global(.dark) .kl__skeletonBar {
                        background: linear-gradient(90deg, #1e293b 25%, rgba(255,255,255,0.06) 50%, #1e293b 75%);
                        background-size: 200% 100%;
                    }
                `}</style>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="kl__empty">
                <div className="kl__emptyIcon"><i className="bi bi-clipboard-check" /></div>
                <p className="kl__emptyTitle">Tidak Ada Data</p>
                <p className="kl__emptySub">Belum ada catatan ketidakhadiran pada filter ini.</p>
                <style jsx>{`
                    .kl__empty {
                        display: flex; flex-direction: column; align-items: center;
                        justify-content: center; padding: 60px 20px; text-align: center;
                    }
                    .kl__emptyIcon {
                        width: 72px; height: 72px; border-radius: 20px;
                        background: var(--n-soft); border: 1px solid var(--n-border);
                        display: flex; align-items: center; justify-content: center;
                        margin-bottom: 16px;
                    }
                    .kl__emptyIcon i { font-size: 2rem; color: var(--n-muted); }
                    .kl__emptyTitle { font-size: 0.95rem; font-weight: 700; color: var(--n-ink); margin: 0 0 4px; }
                    .kl__emptySub { font-size: 0.8rem; color: var(--n-muted); margin: 0; }
                    :global(.dark) .kl__emptyIcon { background: #000000; border-color: rgba(26, 115, 232, 0.5); }
                    :global(.dark) .kl__emptyIcon i { color: #60a5fa; }
                    :global(.dark) .kl__emptyTitle { color: #ffffff; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="kl__wrap">
            {/* Desktop Table */}
            <div className="kl__tableWrap">
                <table className="kl__table">
                    <thead>
                        <tr>
                            <th className="kl__th">Nama</th>
                            <th className="kl__th" style={{ width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }}>Kelas</th>
                            <th className="kl__th">Periode</th>
                            <th className="kl__th">Durasi</th>
                            <th className="kl__th">Keterangan</th>
                            {onViewHistory && <th className="kl__th" style={{ textAlign: 'center' }}>Aksi</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, idx) => (
                            <tr key={r.id} className="kl__row">
                                <td className="kl__td">
                                    <div className="kl__namaCell">
                                        <div className="kl__avatar">{r.nama?.charAt(0) || '?'}</div>
                                        <div className="kl__namaInfo">
                                            <span className="kl__nama">{r.nama}</span>
                                            <span className="kl__nisn">NISN {r.nisn}</span>
                                            {r.petugas_nama && <span className="kl__petugasInCell"><i className="bi bi-person-check" /> {r.petugas_nama}</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="kl__td" style={{ minWidth: '110px', whiteSpace: 'nowrap' }}>
                                    <span className="kl__kelasChip">{r.kelas}</span>
                                </td>
                                <td className="kl__td">
                                    <span className="kl__periode">{r.periode}</span>
                                </td>
                                <td className="kl__td">
                                    <div className="kl__durasiCell">
                                        {r.is_time_specific ? (
                                            <span className="kl__jpBadge">{r.display_hari}</span>
                                        ) : (
                                            <span className="kl__hariBadge">{r.display_hari}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="kl__td">
                                    <div className="kl__ketCell">
                                        <div className="kl__ketBadges">
                                            <JenisBadge jenis={r.jenis} />
                                            <StatusBadge status={r.status} />
                                        </div>
                                        {(!hideKeterangan || r.jenis !== 'SAKIT') && (
                                            <span className="kl__keterangan" title={r.keterangan}>
                                                {r.keterangan}
                                            </span>
                                        )}
                                        {hideKeterangan && r.jenis === 'SAKIT' && (
                                            <span className="kl__keterangan" style={{ fontStyle: 'italic', color: 'var(--n-muted)' }}>
                                                (rahasia)
                                            </span>
                                        )}
                                    </div>
                                </td>
                                {onViewHistory && (
                                    <td className="kl__td" style={{ textAlign: 'center' }}>
                                        <ActionButton
                                            action="view"
                                            size="sm"
                                            onClick={() => onViewHistory(r.nisn)}
                                            tooltip="Lihat Riwayat"
                                        />
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .kl__wrap { width: 100%; }

                /* Table */
                .kl__tableWrap { overflow-x: auto; }
                .kl__table {
                    width: 100%; border-collapse: collapse;
                    font-size: 0.83rem;
                }
                .kl__table thead tr {
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                }
                :global(.kl__th) {
                    padding: 10px 14px; text-align: left;
                    font-size: 0.7rem; font-weight: 700;
                    color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.05em;
                    white-space: nowrap;
                }
                .kl__row {
                    border-bottom: 1px solid var(--n-border);
                    transition: background 0.15s;
                }
                .kl__row:hover { background: var(--n-soft); }
                .kl__row:last-child { border-bottom: none; }
                :global(.kl__td) { padding: 11px 14px; vertical-align: middle; color: var(--n-ink); }

                /* Nama cell */
                .kl__namaCell { display: flex; align-items: center; gap: 10px; }
                .kl__avatar {
                    width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
                    background: linear-gradient(135deg, var(--n-primary), #60a5fa);
                    color: white; font-weight: 800; font-size: 0.85rem;
                    display: flex; align-items: center; justify-content: center;
                }
                .kl__namaInfo { display: flex; flex-direction: column; }
                .kl__nama { font-weight: 700; color: var(--n-ink); font-size: 0.83rem; white-space: nowrap; }
                .kl__subInfo { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
                .kl__nisn { font-size: 0.68rem; color: var(--n-muted); font-family: monospace; }

                /* Kelas chip */
                .kl__kelasChip {
                    display: inline-flex; padding: 2px 8px; border-radius: 6px;
                    background: var(--n-soft); border: 1px solid var(--n-border);
                    font-size: 0.75rem; font-weight: 600; color: var(--n-ink);
                    white-space: nowrap;
                }

                /* Periode */
                .kl__periode { font-size: 0.83rem; font-weight: 400; color: var(--n-ink); white-space: nowrap; }

                /* Durasi */
                .kl__durasiCell { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
                .kl__hariBadge {
                    display: inline-flex; padding: 2px 8px; border-radius: 6px;
                    background: rgba(59,130,246,0.1); color: var(--n-primary);
                    font-size: 0.83rem; font-weight: 500;
                }
                .kl__jpBadge {
                    display: inline-flex; padding: 2px 7px; border-radius: 6px;
                    background: rgba(59,130,246,0.1); color: #3083FF;
                    font-size: 0.83rem; font-weight: 500;
                }

                /* Keterangan */
                .kl__keterangan { font-size: 0.68rem; color: var(--n-muted); line-height: 1.5; font-style: italic; }

                /* Petugas */
                .kl__petugas { font-size: 0.78rem; color: var(--n-muted); white-space: nowrap; }
                .kl__petugasInCell { font-size: 0.7rem; color: var(--n-muted); margin-top: 4px; display: flex; align-items: center; gap: 4px; font-weight: 500; }
                .kl__petugasInCell i { font-size: 0.8rem; color: var(--n-primary); }

                /* Jenis + Status stacked in cell */
                .kl__ketCell { display: flex; flex-direction: column; gap: 6px; min-width: 200px; padding: 4px 0; }
                .kl__ketBadges { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
                :global(.kl__ketBadges .kl__badge) { font-size: 0.65rem; padding: 2px 7px; border-radius: 6px; }

                /* Badges */
                :global(.kl__badge) {
                    display: inline-flex; align-items: center; gap: 4px;
                    padding: 3px 9px; border-radius: 20px;
                    font-size: 0.7rem; font-weight: 800; white-space: nowrap;
                }
                :global(.kl__badge i) { font-size: 0.8rem; }
                /* Izin status */
                :global(.kl__badgeIzin) { background: rgba(5, 150, 105, 0.1); color: #065f46; border: 1px solid rgba(5, 150, 105, 0.2); }
                /* Sakit status */
                :global(.kl__badgeSakit) { background: rgba(236, 88, 0, 0.12); color: #c2410c; border: 1px solid rgba(236, 88, 0, 0.25); }
                /* Izin breakdown */
                :global(.kl__badgeMadrasah) { background: rgba(5, 71, 42, 0.14); color: #05472a; border: 1px solid rgba(5, 71, 42, 0.3); }
                :global(.kl__badgePersonal) { background: rgba(147, 197, 114, 0.22); color: #4d7c0f; border: 1px solid rgba(147, 197, 114, 0.5); }
                /* Sakit breakdown */
                :global(.kl__badgeRingan) { background: rgba(253, 186, 116, 0.24); color: #c2410c; border: 1px solid rgba(251, 146, 60, 0.4); }
                :global(.kl__badgeSedang) { background: rgba(255, 117, 24, 0.18); color: #d9531e; border: 1px solid rgba(255, 117, 24, 0.4); }
                :global(.kl__badgeBerat) { background: rgba(255, 69, 0, 0.18); color: #c22a1e; border: 1px solid rgba(255, 69, 0, 0.4); }
                :global(.kl__badgeKontrol) { background: rgba(154, 52, 18, 0.18); color: #8b3a00; border: 1px solid rgba(154, 52, 18, 0.4); }
                /* Legacy status */
                :global(.kl__badgePending) { background: rgba(245,158,11,0.12); color: #d97706; }
                :global(.kl__badgeApproved) { background: rgba(16,185,129,0.1); color: #059669; }
                :global(.kl__badgeRejected) { background: rgba(239,68,68,0.1); color: #dc2626; }

                /* Dark */
                :global(.dark) .kl__table thead tr {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                }
                :global(.dark .kl__th) { color: #94a3b8; border-bottom-color: rgba(26, 115, 232, 0.4); }
                :global(.dark) .kl__row:hover { background: rgba(26, 115, 232, 0.08); }
                :global(.dark .kl__td) { color: #ffffff; border-bottom-color: rgba(26, 115, 232, 0.2); }
                :global(.dark) .kl__nama { color: #ffffff; }
                :global(.dark) .kl__kelasChip {
                    background: rgba(96, 165, 250, 0.15);
                    border-color: rgba(96, 165, 250, 0.35);
                    color: #60a5fa;
                }
                :global(.dark) .kl__hariBadge { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
                :global(.dark) .kl__jpBadge { background: rgba(96, 165, 250, 0.15); color: #93c5fd; }
                :global(.dark) .kl__keterangan { color: #ffffff; }
                /* Izin */
                :global(.dark .kl__badgeIzin) { background: rgba(5, 150, 105, 0.15); color: #6ee7b7; }
                :global(.dark .kl__badgeMadrasah) { background: rgba(34, 197, 94, 0.22); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.5); }
                :global(.dark .kl__badgePersonal) { background: rgba(147, 197, 114, 0.28); color: #b5e7a0; border: 1px solid rgba(181, 231, 160, 0.55); }
                /* Sakit */
                :global(.dark .kl__badgeSakit) { background: rgba(236, 88, 0, 0.2); color: #FF7A29; border: 1px solid rgba(255, 122, 41, 0.4); }
                :global(.dark .kl__badgeRingan) { background: rgba(251, 146, 60, 0.26); color: #ffbd80; border: 1px solid rgba(251, 146, 60, 0.55); }
                :global(.dark .kl__badgeSedang) { background: rgba(255, 117, 24, 0.3); color: #ff9d5c; border: 1px solid rgba(255, 157, 92, 0.6); }
                :global(.dark .kl__badgeBerat) { background: rgba(255, 69, 0, 0.3); color: #ff786b; border: 1px solid rgba(255, 120, 107, 0.6); }
                :global(.dark .kl__badgeKontrol) { background: rgba(154, 52, 18, 0.32); color: #ff8c5a; border: 1px solid rgba(255, 140, 90, 0.65); }
                /* Legacy */
                :global(.dark .kl__badgePending) { background: rgba(245,158,11,0.12); color: #fbbf24; }
                :global(.dark .kl__badgeApproved) { background: rgba(16,185,129,0.12); color: #34d399; }
                :global(.dark .kl__badgeRejected) { background: rgba(239,68,68,0.12); color: #f87171; }

                /* Mobile: hide table wrap + desktop empty/skeleton, show cards via parent */
                @media (max-width: 640px) {
                    .kl__tableWrap { display: none; }
                    .kl__empty { display: none; }
                    .kl__skeletonWrap { display: none; }
                }
            `}</style>
        </div>
    );
}
