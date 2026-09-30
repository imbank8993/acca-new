'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
    Trophy,
    Ghost,
    FileText,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Calendar
} from 'lucide-react';

interface WinnerItem {
    nama: string;
}

interface KinerjaGuruApiResponse {
    success: boolean;
    data: {
        jamKosong: WinnerItem[];
        penugasanTanpa: WinnerItem[];
        terlambat: WinnerItem[];
    };
}

type CategoryKey = 'jamKosong' | 'penugasanTanpa' | 'terlambat';

export default function DashboardKinerjaCard() {
    const [data, setData] = useState<Record<CategoryKey, WinnerItem[]>>({
        jamKosong: [],
        penugasanTanpa: [],
        terlambat: []
    });

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const gridRef = useRef<HTMLDivElement>(null);
    const [activeSlide, setActiveSlide] = useState(0);

    const categoriesConfig = useMemo<{ key: CategoryKey; title: string; icon: typeof Ghost; color: string; bgBadge: string; sarcasticAlias: string; emptyText: string }[]>(() => [
        {
            key: 'jamKosong',
            title: 'Jam Kosong',
            icon: Ghost,
            color: '#ef4444',
            bgBadge: 'rgba(239, 68, 68, 0.1)',
            sarcasticAlias: 'Grand Master Ghosting',
            emptyText: 'Belum ada data'
        },
        {
            key: 'penugasanTanpa',
            title: 'Penugasan Tanpa Pendampingan',
            icon: FileText,
            color: '#f59e0b',
            bgBadge: 'rgba(245, 158, 11, 0.1)',
            sarcasticAlias: 'Duta Lempar Tugas',
            emptyText: 'Belum ada data'
        },
        {
            key: 'terlambat',
            title: 'Terlambat',
            icon: Clock,
            color: '#06b6d4',
            bgBadge: 'rgba(6, 182, 212, 0.1)',
            sarcasticAlias: 'Juara OTW Abadi',
            emptyText: 'Belum ada data'
        }
    ], []);

    const handleTrackScroll = () => {
        if (!gridRef.current) return;
        const container = gridRef.current;
        const card = container.querySelector('.category-card') as HTMLElement | null;
        const cardWidth = card ? card.offsetWidth + 10 : 250;
        const newIdx = Math.round(container.scrollLeft / cardWidth);
        setActiveSlide(Math.min(Math.max(newIdx, 0), categoriesConfig.length - 1));
    };

    const scrollToSlide = (idx: number) => {
        if (!gridRef.current) return;
        const container = gridRef.current;
        const card = container.querySelector('.category-card') as HTMLElement | null;
        const cardWidth = card ? card.offsetWidth + 10 : 250;
        container.scrollTo({
            left: idx * cardWidth,
            behavior: 'smooth'
        });
    };

    const currentMonthStr = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const currentMonthName = useMemo(() => {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return months[new Date().getMonth()];
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const params = new URLSearchParams();
            params.set('start_month', currentMonthStr);
            params.set('end_month', currentMonthStr);

            const res = await fetch(`/api/kinerja-guru/dashboard?${params.toString()}`);
            if (!res.ok) {
                setErrorMsg(`Server status ${res.status}`);
                setLoading(false);
                return;
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                setErrorMsg('Respons bukan JSON');
                setLoading(false);
                return;
            }

            const rawText = await res.text();
            let json: KinerjaGuruApiResponse;
            try {
                json = JSON.parse(rawText);
            } catch {
                setErrorMsg('Format data tidak valid');
                setLoading(false);
                return;
            }

            if (json && json.success && json.data) {
                setData({
                    jamKosong: json.data.jamKosong || [],
                    penugasanTanpa: json.data.penugasanTanpa || [],
                    terlambat: json.data.terlambat || []
                });
            } else {
                setErrorMsg('Data tidak lengkap');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal memuat data';
            setErrorMsg(message);
        } finally {
            setLoading(false);
        }
    }, [currentMonthStr]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="db__kinerja-clean-wrapper">
            <div className="db__widget-card kinerja-card">
                {/* Header Row */}
                <div className="kinerja-header">
                    <div className="kinerja-title-area">
                        <div className="kinerja-trophy-icon">
                            <Trophy size={18} />
                        </div>
                        <div>
                            <h3 className="kinerja-title">Kinerja Guru</h3>
                            <p className="kinerja-subtitle">
                                Menampilkan champion untuk masing-masing kategori.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error Box */}
                {errorMsg && (
                    <div className="kinerja-error">
                        <AlertTriangle size={15} />
                        <span>{errorMsg}.</span>
                        <button type="button" onClick={fetchData} className="btn-retry">
                            Muat Ulang
                        </button>
                    </div>
                )}

                {/* 3 Columns Grid */}
                {!errorMsg && (
                    <div
                        ref={gridRef}
                        onScroll={handleTrackScroll}
                        className="kinerja-grid"
                    >
                        {categoriesConfig.map((cat) => {
                            const list = data[cat.key];
                            const topItems = list.slice(0, 3);
                            const IconComp = cat.icon;

                            return (
                                <div key={cat.key} className="category-card">
                                    {/* Category Header */}
                                    <div className="cat-top">
                                        <span className="cat-icon-chip" style={{ color: cat.color, background: cat.bgBadge }}>
                                            <IconComp size={16} />
                                        </span>
                                        <div className="cat-category-name">{cat.title}</div>
                                    </div>

                                    {/* Content: Cukup Nama Saja (Tanpa Klik) */}
                                    {loading ? (
                                        <div className="skeleton-wrap">
                                            <div className="skel-bar" />
                                            <div className="skel-bar" />
                                            <div className="skel-bar" />
                                        </div>
                                    ) : topItems.length > 0 ? (
                                        <div className="leaderboard-list">
                                            {topItems.map((item, idx) => {
                                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                                                return (
                                                    <div
                                                        key={`${item.nama}-${idx}`}
                                                        className="leaderboard-row"
                                                    >
                                                        <span className="row-rank">{medal}</span>
                                                        <span className="row-name">{item.nama}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="empty-box">
                                            <CheckCircle2 size={18} color="#10b981" />
                                            <span>{cat.emptyText}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer Toolbar: Month (pojok kiri bawah) | Dots (tengah) | Selengkapnya (pojok kanan bawah) */}
                <div className="kinerja-footer">
                    {/* Pojok kiri bawah: Badge Bulan */}
                    <div className="kinerja-month-tag">
                        <Calendar size={12} />
                        <span>{currentMonthName}</span>
                    </div>

                    {/* Tengah: Indikator Titik Geser */}
                    <div className="kinerja-dots">
                        {categoriesConfig.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => scrollToSlide(i)}
                                className={`kinerja-dot ${activeSlide === i ? 'is-active' : ''}`}
                                aria-label={`Kategori ${i + 1}`}
                            />
                        ))}
                    </div>

                    {/* Pojok kanan bawah: Tautan Selengkapnya */}
                    <Link
                        href="/kinerja-guru"
                        className="footer-link"
                        style={{
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            color: '#3083FF',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Selengkapnya
                    </Link>
                </div>
            </div>

            <style jsx>{`
                .db__kinerja-clean-wrapper {
                    width: 100%;
                    margin-bottom: 2px;
                }

                .kinerja-card {
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 16px;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
                }

                :global(.dark) .kinerja-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }

                /* Header */
                .kinerja-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .kinerja-title-area {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .kinerja-trophy-icon {
                    width: 34px;
                    height: 34px;
                    border-radius: 10px;
                    background: #E0ECFF;
                    color: #2563eb;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                :global(.dark) .kinerja-trophy-icon {
                    background: rgba(48, 131, 255, 0.18);
                    color: #60a5fa;
                }

                .kinerja-title {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                    letter-spacing: -0.01em;
                }

                :global(.dark) .kinerja-title {
                    color: #f8fafc;
                }

                .kinerja-subtitle {
                    margin: 2px 0 0 0;
                    font-size: 0.78rem;
                    color: var(--n-muted, #64748b);
                    font-weight: 400;
                }

                :global(.dark) .kinerja-subtitle {
                    color: #94a3b8;
                }

                /* Dots Indicator (Tengah) */
                .kinerja-dots {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .kinerja-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #cbd5e1;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .kinerja-dot.is-active {
                    width: 16px;
                    border-radius: 9999px;
                    background: #3083FF;
                }

                :global(.dark) .kinerja-dot {
                    background: rgba(255, 255, 255, 0.25);
                }

                :global(.dark) .kinerja-dot.is-active {
                    background: #60a5fa;
                }

                /* Pojok kiri bawah: badge bulan */
                .kinerja-month-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: var(--n-soft, rgba(0, 0, 0, 0.04));
                    border: 1px solid var(--n-border, #e2e8f0);
                    padding: 2px 8px;
                    border-radius: 999px;
                    font-size: 0.66rem;
                    font-weight: 600;
                    color: var(--n-muted, #64748b);
                    flex-shrink: 0;
                }

                :global(.dark) .kinerja-month-tag {
                    background: rgba(15, 23, 42, 0.8);
                    border-color: rgba(26, 115, 232, 0.4);
                    color: #94a3b8;
                }

                /* Error */
                .kinerja-error {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    background: rgba(239, 68, 68, 0.08);
                    color: #ef4444;
                    font-size: 0.76rem;
                }

                .btn-retry {
                    margin-left: auto;
                    border: none;
                    background: #ef4444;
                    color: #fff;
                    padding: 3px 8px;
                    border-radius: 5px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    cursor: pointer;
                }

                /* 3-Col Grid */
                .kinerja-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    width: 100%;
                }

                @media (max-width: 860px) {
                    .kinerja-subtitle {
                        display: none !important;
                    }

                    .kinerja-dots {
                        display: flex;
                    }

                    .kinerja-card {
                        padding: 14px 16px;
                    }

                    .kinerja-grid {
                        display: flex;
                        gap: 12px;
                        overflow-x: auto;
                        scroll-snap-type: x mandatory;
                        -webkit-overflow-scrolling: touch;
                        scrollbar-width: none;
                        padding-bottom: 4px;
                        width: 100%;
                    }

                    .kinerja-grid::-webkit-scrollbar {
                        display: none;
                    }

                    .category-card {
                        flex: 0 0 calc(100% - 44px);
                        scroll-snap-align: start;
                        box-sizing: border-box;
                    }

                    .kinerja-footer {
                        justify-content: space-between;
                    }
                }

                /* Category Card */
                .category-card {
                    background: var(--n-soft, #f8fafc);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                :global(.dark) .category-card {
                    background: rgba(15, 23, 42, 0.6) !important;
                    border-color: rgba(26, 115, 232, 0.3) !important;
                }

                .cat-top {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                }

                .cat-icon-chip {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .cat-category-name {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                    line-height: 1.2;
                }

                :global(.dark) .cat-category-name {
                    color: #f1f5f9;
                }

                /* Leaderboard List: Hanya nama (tanpa cursor pointer atau klik) */
                .leaderboard-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .leaderboard-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 8px;
                    border-radius: 6px;
                    background: transparent;
                }

                .row-rank {
                    font-size: 0.95rem;
                    line-height: 1;
                    flex-shrink: 0;
                }

                .row-name {
                    flex: 1;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-ink, #0f172a);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                :global(.dark) .row-name {
                    color: #f1f5f9;
                }

                /* Empty state */
                .empty-box {
                    padding: 20px 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    color: var(--n-muted, #64748b);
                    font-size: 0.74rem;
                }

                /* Skeletons */
                .skeleton-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 4px 0;
                }

                .skel-bar {
                    height: 32px;
                    background: rgba(150, 150, 150, 0.1);
                    border-radius: 6px;
                    animation: pulse 1.2s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 0.3; }
                }

                /* Footer */
                .kinerja-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding-top: 10px;
                    border-top: 1px solid var(--n-border, #f1f5f9);
                }

                :global(.dark) .kinerja-footer {
                    border-top-color: rgba(255, 255, 255, 0.06) !important;
                }

                .footer-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    font-family: inherit;
                    font-size: 0.62rem !important;
                    font-weight: 600;
                    color: #3083FF !important;
                    text-decoration: none;
                    white-space: nowrap;
                    flex-shrink: 0;
                    transition: color 0.15s ease, opacity 0.15s ease;
                }

                .footer-link:hover {
                    text-decoration: underline;
                    color: #1e56d3 !important;
                }

                :global(.dark) .footer-link {
                    color: #3083FF !important;
                }

                :global(.dark) .footer-link:hover {
                    color: #60a5fa !important;
                }
            `}</style>
        </div>
    );
}
