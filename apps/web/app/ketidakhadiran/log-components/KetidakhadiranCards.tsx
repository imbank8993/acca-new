'use client';

import React from 'react';
import { KetidakhadiranRow } from './KetidakhadiranTable';
import { ActionButton } from '@/components/ui/ActionButtons';
import { getProxiedImageUrl } from '@/lib/image-utils';

interface KetidakhadiranCardsProps {
    rows: KetidakhadiranRow[];
    hideKeterangan?: boolean; // For privacy - hide sick keterangan for students
    onViewHistory?: (nisn: string) => void;
}

function JenisBadge({ jenis }: { jenis: string }) {
    const cls = jenis === 'IZIN'
        ? 'kc__badge kc__badgeIzin'
        : 'kc__badge kc__badgeSakit';
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
        MADRASAH: { label: 'Madrasah', cls: 'kc__badge kc__badgeMadrasah' },
        PERSONAL: { label: 'Personal', cls: 'kc__badge kc__badgePersonal' },
        // Sakit status
        RINGAN: { label: 'Ringan', cls: 'kc__badge kc__badgeRingan' },
        SEDANG: { label: 'Sedang', cls: 'kc__badge kc__badgeSedang' },
        BERAT: { label: 'Berat', cls: 'kc__badge kc__badgeBerat' },
        KONTROL: { label: 'Kontrol', cls: 'kc__badge kc__badgeKontrol' },
        // Legacy/pending status
        pending: { label: 'Pending', cls: 'kc__badge kc__badgePending' },
        approved: { label: 'Approved', cls: 'kc__badge kc__badgeApproved' },
        rejected: { label: 'Ditolak', cls: 'kc__badge kc__badgeRejected' },
    };
    const { label, cls } = map[status?.toUpperCase()] || { label: status, cls: 'kc__badge kc__badgePending' };
    return <span className={cls}>{label}</span>;
}

function formatPeriodeWithYear(tglMulai: string, tglSelesai: string): string {
    if (!tglMulai) return '—';
    const fmt = (d: string) => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length === 3) {
            const [y, m, day] = parts.map(Number);
            return new Date(y, m - 1, day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    if (!tglSelesai || tglMulai === tglSelesai) return fmt(tglMulai);
    return `${fmt(tglMulai)} — ${fmt(tglSelesai)}`;
}

export default function KetidakhadiranCards({ rows, hideKeterangan = false, onViewHistory }: KetidakhadiranCardsProps) {
    if (rows.length === 0) {
        return (
            <div className="kc__empty">
                <i className="bi bi-inbox" />
                <div className="kc__emptyTitle">Tidak ada data ketidakhadiran</div>
                <style jsx>{`
                    .kc__empty {
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        padding: 40px 20px; text-align: center; color: var(--n-muted); gap: 8px;
                        background: var(--n-card); border-radius: 16px; border: 1px solid var(--n-border);
                    }
                    .kc__empty i { font-size: 2rem; opacity: 0.5; }
                    .kc__emptyTitle { font-size: 0.9rem; font-weight: 600; color: var(--n-ink); }
                    :global(.dark) .kc__emptyTitle { color: #e8edf5; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="kc__cards">
            {rows.map(r => (
                <div key={r.id} className="kc__card">
                    {/* Header */}
                    <div className="kc__head">
                        <div className="kc__guru">
                            <div className="kc__avatar">
                                {r.foto_profil ? (
                                    <img src={getProxiedImageUrl(r.foto_profil)} alt="" className="kc__avatar-img" />
                                ) : (
                                    r.nama?.charAt(0) || '?'
                                )}
                            </div>
                            <div className="kc__info">
                                <div className="kc__nama">{r.nama}</div>
                                <div className="kc__nisn">{r.nisn}</div>
                            </div>
                        </div>
                        {onViewHistory && (
                            <div className="kc__actionTop">
                                <ActionButton
                                    action="view"
                                    size="sm"
                                    onClick={() => onViewHistory(r.nisn)}
                                    tooltip="Lihat Riwayat"
                                />
                            </div>
                        )}
                    </div>

                    {/* Body */}
                    <div className="kc__body">
                        {/* Row 1: Kelas (Kiri) & Badge Status/Kategori (Kanan) */}
                        <div className="kc__row kc__rowKelas">
                            <div className="kc__kelasGroup">
                                <span className="kc__label"><i className="bi bi-door-open" /></span>
                                <span className="kc__kelasChip">{r.kelas}</span>
                            </div>
                            <div className="kc__statusBadges">
                                <JenisBadge jenis={r.jenis} />
                                <span className="kc__sep">/</span>
                                <StatusBadge status={r.status} />
                            </div>
                        </div>
                        <div className="kc__row">
                            <span className="kc__label"><i className="bi bi-calendar-range" /></span>
                            <span className="kc__value">
                                {r.periode || formatPeriodeWithYear(r.tgl_mulai, r.tgl_selesai)}
                                <span className="kc__sep">/</span>
                                <div className="kc__rowBadges">
                                    {r.is_time_specific ? (
                                        <span className="kc__jpBadge">{r.display_hari}</span>
                                    ) : (
                                        <span className="kc__hariBadge">{r.display_hari}</span>
                                    )}
                                </div>
                            </span>
                        </div>
                        {(!hideKeterangan || r.jenis !== 'SAKIT') && (
                            <div className="kc__row">
                                <span className="kc__label"><i className="bi bi-chat-left-text" /></span>
                                <span className="kc__value kc__keterangan">{r.keterangan}</span>
                            </div>
                        )}
                        {hideKeterangan && r.jenis === 'SAKIT' && (
                            <div className="kc__row">
                                <span className="kc__label"><i className="bi bi-chat-left-text" /></span>
                                <span className="kc__value kc__keterangan" style={{ fontStyle: 'italic', color: 'var(--n-muted)' }}>(rahasia)</span>
                            </div>
                        )}
                        {r.petugas_nama && (
                            <div className="kc__row">
                                <span className="kc__label"><i className="bi bi-person-badge" /></span>
                                <span className="kc__value">{r.petugas_nama}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            <style jsx>{`
                .kc__cards { display: none; flex-direction: column; gap: 10px; }
                .kc__empty { display: none; }
                .kc__card {
                    background: var(--n-card); border: 1px solid var(--n-border);
                    border-radius: 16px; overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    transition: all 0.2s;
                }
                .kc__card:hover { border-color: var(--n-primary); box-shadow: 0 4px 12px rgba(0,56,168,0.08); transform: translateY(-1px); }

                /* Head */
                .kc__head {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 10px 14px; border-bottom: 1px solid var(--n-border);
                    background: var(--n-soft); gap: 10px;
                }
                .kc__guru { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
                .kc__info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
                .kc__avatar {
                    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
                    background: linear-gradient(135deg, var(--n-primary), #60a5fa);
                    color: white; font-weight: 800; font-size: 0.85rem;
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden;
                }
                .kc__avatar-img {
                    width: 100%; height: 100%; object-fit: cover; border-radius: 10px;
                }
                .kc__nama { font-weight: 700; color: var(--n-ink); font-size: 0.83rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .kc__nisn { font-size: 0.68rem; color: var(--n-muted); font-family: monospace; margin-top: 1px; }
                .kc__actionTop { flex-shrink: 0; }

                /* Body */
                .kc__body { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
                .kc__row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
                .kc__rowKelas { display: flex; align-items: center; justify-content: space-between; width: 100%; }
                .kc__kelasGroup { display: flex; align-items: center; gap: 8px; }
                .kc__statusBadges { display: flex; align-items: center; gap: 4px; margin-left: auto; }
                .kc__label {
                    display: flex; align-items: center; justify-content: center;
                    color: var(--n-muted); font-weight: 600;
                    min-width: 24px; font-size: 0.72rem; flex-shrink: 0;
                }
                .kc__label i { font-size: 0.85rem; }
                .kc__value { color: var(--n-ink); font-weight: 500; flex: 1; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; }
                .kc__keterangan { font-size: 0.78rem; line-height: 1.4; color: var(--n-ink); }
                .kc__rowBadges { display: flex; align-items: center; gap: 2px; margin-left: auto; }
                .kc__sep { font-size: 0.7rem; color: var(--n-border); font-weight: 400; }
                .kc__kelasChip {
                    display: inline-flex; padding: 1px 7px; border-radius: 5px;
                    background: var(--n-soft); border: 1px solid var(--n-border);
                    font-size: 0.73rem; font-weight: 700;
                }
                .kc__hariBadge {
                    display: inline-flex; padding: 1px 7px; border-radius: 5px;
                    background: rgba(59,130,246,0.1); color: var(--n-primary);
                    font-size: 0.72rem; font-weight: 800;
                }
                .kc__jpBadge {
                    display: inline-flex; padding: 1px 7px; border-radius: 5px;
                    background: rgba(59,130,246,0.1); color: #3083FF;
                    font-size: 0.7rem; font-weight: 800;
                }

                /* Badges (now plain text) */
                :global(.kc__badge) {
                    display: inline-flex; align-items: center; gap: 3px;
                    padding: 0; background: none;
                    font-size: 0.68rem; font-weight: 700;
                }
                :global(.kc__badge i) { font-size: 0.75rem; }
                /* Izin */
                :global(.kc__badgeIzin) { color: #065f46; }
                :global(.kc__badgeMadrasah) { color: #05472a; }
                :global(.kc__badgePersonal) { color: #4d7c0f; }
                /* Sakit */
                :global(.kc__badgeSakit) { color: #c2410c; }
                :global(.kc__badgeRingan) { color: #c2410c; }
                :global(.kc__badgeSedang) { color: #d9531e; }
                :global(.kc__badgeBerat) { color: #c22a1e; }
                :global(.kc__badgeKontrol) { color: #8b3a00; }
                /* Legacy */
                :global(.kc__badgePending) { color: #d97706; }
                :global(.kc__badgeApproved) { color: #059669; }
                :global(.kc__badgeRejected) { color: #dc2626; }

                /* Dark */
                :global(.dark) .kc__card {
                    background: #000000;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
                }
                :global(.dark) .kc__card:hover { border-color: #60a5fa; box-shadow: 0 4px 18px rgba(96, 165, 250, 0.22); }
                :global(.dark) .kc__head {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25));
                    border-bottom-color: rgba(26, 115, 232, 0.4);
                }
                :global(.dark) .kc__nama { color: #ffffff; }
                :global(.dark) .kc__kelasChip {
                    background: rgba(96, 165, 250, 0.15);
                    border-color: rgba(96, 165, 250, 0.35);
                    color: #60a5fa;
                }
                :global(.dark) .kc__hariBadge { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
                :global(.dark) .kc__jpBadge { background: rgba(96, 165, 250, 0.15); color: #93c5fd; }
                /* Izin */
                :global(.dark .kc__badgeIzin) { background: none; color: #6ee7b7; }
                :global(.dark .kc__badgeMadrasah) { background: none; color: #4ade80; }
                :global(.dark .kc__badgePersonal) { background: none; color: #b5e7a0; }
                /* Sakit */
                :global(.dark .kc__badgeSakit) { background: none; color: #FF7A29; }
                :global(.dark .kc__badgeRingan) { background: none; color: #ffbd80; }
                :global(.dark .kc__badgeSedang) { background: none; color: #ff9d5c; }
                :global(.dark .kc__badgeBerat) { background: none; color: #ff786b; }
                :global(.dark .kc__badgeKontrol) { background: none; color: #ff8c5a; }
                /* Legacy */
                :global(.dark .kc__badgePending) { background: none; color: #fbbf24; }
                :global(.dark .kc__badgeApproved) { background: none; color: #34d399; }
                :global(.dark .kc__badgeRejected) { background: none; color: #f87171; }

                @media (max-width: 640px) {
                    .kc__cards { display: flex !important; }
                    .kc__empty { display: flex !important; }
                }
            `}</style>
        </div>
    );
}
