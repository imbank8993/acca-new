'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    AlertCircle
} from 'lucide-react';
import { InlineSelect, type InlineSelectOption } from '@/components/ui/InlineSelect';

interface ExamAttempt {
    id: string;
    status: string;
    score: number | null;
    started_at: string | null;
    finished_at: string | null;
}

interface ExamStats {
    totalAttempts: number;
    finishedAttempts: number;
    activeAttempts: number;
}

interface ExamItem {
    id: string;
    title: string;
    description?: string | null;
    subject: string | null;
    exam_type: string;
    duration_minutes: number;
    start_time: string | null;
    end_time: string | null;
    status: string;
    category: 'active' | 'upcoming' | 'completed';
    creator_name?: string | null;
    isCreator?: boolean;
    canMonitor?: boolean;
    isDirectlyDesignated?: boolean;
    attempt?: ExamAttempt | null;
    isCompleted?: boolean;
    isInProgress?: boolean;
    target_classes?: string[];
    participants_count?: number;
    stats?: ExamStats;
    cbtUrl?: string;
}

interface DashboardExamsResponse {
    ok: boolean;
    role: 'SISWA' | 'GURU' | 'ADMIN' | 'OTHER';
    counts: {
        active: number;
        upcoming: number;
        completed: number;
        total: number;
    };
    hasActiveExam: boolean;
    exams: {
        active: ExamItem[];
        upcoming: ExamItem[];
        completed: ExamItem[];
        all: ExamItem[];
    };
}

interface DashboardExamCardProps {
    user?: any;
    isSiswa?: boolean;
    isGuru?: boolean;
    isAdmin?: boolean;
}

export default function DashboardExamCard({ user, isSiswa, isGuru, isAdmin }: DashboardExamCardProps) {
    const [data, setData] = useState<DashboardExamsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');
    const trackRef = useRef<HTMLDivElement>(null);

    const loadExams = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/dashboard/cbt-exams');
            if (!res.ok) return;
            const json: DashboardExamsResponse = await res.json();
            if (json.ok) {
                setData(json);
                if (json.hasActiveExam) {
                    setActiveTab('active');
                } else if (json.counts.upcoming > 0) {
                    setActiveTab('upcoming');
                } else if (json.counts.completed > 0) {
                    setActiveTab('completed');
                } else {
                    setActiveTab('all');
                }
            }
        } catch (err) {
            console.error('[DashboardExamCard] Gagal memuat data ujian:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadExams();
    }, [loadExams]);

    const handleScroll = (direction: 'left' | 'right') => {
        if (!trackRef.current) return;
        const scrollAmount = 320;
        trackRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    };

    const formatDateRange = (startStr: string | null, endStr: string | null) => {
        if (!startStr) return 'Waktu Fleksibel';
        try {
            const startDate = new Date(startStr);
            const startDay = startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const startTime = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');

            if (!endStr) return `${startDay}, ${startTime}`;

            const endDate = new Date(endStr);
            const endDay = endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const endTime = endDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');

            if (startDay === endDay) {
                return `${startDay}, ${startTime} – ${endTime}`;
            }
            return `${startDay} – ${endDay}`;
        } catch {
            return 'Jadwal Ditentukan';
        }
    };

    const filterOptions: InlineSelectOption[] = useMemo(() => {
        if (!data) return [];
        return [
            { value: 'all', label: `Semua (${data.counts.total})` },
            { value: 'active', label: `Aktif (${data.counts.active})` },
            { value: 'upcoming', label: `Mendatang (${data.counts.upcoming})` },
            { value: 'completed', label: `Selesai (${data.counts.completed})` },
        ];
    }, [data]);

    // Semua Hook tetap dipanggil ketika loading selesai tanpa data ujian.
    if (!loading && (!data || data.counts.total === 0)) {
        return null;
    }

    const displayedExams = data
        ? activeTab === 'all'
            ? data.exams.all
            : data.exams[activeTab] || []
        : [];

    return (
        <div className="db__exam-clean-wrapper">
            <div className="db__widget-card exam-card">
                {/* Header Row — Bersih & Minimalis */}
                <div className="exam-header">
                    <div className="exam-title-area">
                        <span className="exam-icon-badge">
                            <BookOpen size={18} />
                        </span>
                        <div className="exam-title-row">
                            <h3 className="exam-title">Daftar Ujian</h3>
                            {data?.hasActiveExam && (
                                <span className="exam-active-pill">
                                    <span className="pulse-dot"></span>
                                    {data.counts.active} Aktif
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="exam-header-actions">
                        {/* Dropdown Filter Kategori Ujian */}
                        {data && (
                            <InlineSelect
                                value={activeTab}
                                onChange={(val) => setActiveTab(val as 'all' | 'active' | 'upcoming' | 'completed')}
                                options={filterOptions}
                                height="28px"
                                minWidth="135px"
                            />
                        )}

                        {/* Scroll buttons */}
                        {!loading && displayedExams.length > 3 && (
                            <div className="exam-nav-btns">
                                <button
                                    type="button"
                                    onClick={() => handleScroll('left')}
                                    title="Geser ke kiri"
                                    aria-label="Geser ke kiri"
                                    className="exam-scroll-btn"
                                >
                                    <ChevronLeft size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleScroll('right')}
                                    title="Geser ke kanan"
                                    aria-label="Geser ke kanan"
                                    className="exam-scroll-btn"
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Horizontal Track List */}
                {loading ? (
                    <div className="exam-track">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="exam-item exam-item--skeleton" />
                        ))}
                    </div>
                ) : displayedExams.length === 0 ? (
                    <div className="exam-empty-state">
                        <AlertCircle size={15} className="text-slate-400" />
                        <span>Tidak ada ujian pada kategori ini.</span>
                    </div>
                ) : (
                    <div ref={trackRef} className="exam-track">
                        {displayedExams.map((exam) => {
                            const isActive = exam.category === 'active';
                            const isUpcoming = exam.category === 'upcoming';
                            const isCompleted = exam.category === 'completed';

                            return (
                                <div
                                    key={exam.id}
                                    className={`exam-item ${isActive ? 'is-active-exam' : ''}`}
                                >
                                    {/* Line 1: Status Dot + Durasi + Mapel (Tanpa Kotak Berlebih) */}
                                    <div className="exam-item-top">
                                        <div className="exam-meta-line">
                                            <span className={`exam-dot exam-dot--${exam.category}`} />
                                            <span className={`exam-status-text exam-status-text--${exam.category}`}>
                                                {isActive ? 'Aktif' : isUpcoming ? 'Akan Datang' : 'Selesai'}
                                            </span>
                                            <span className="exam-sep">•</span>
                                            <span className="exam-duration">{exam.duration_minutes}m</span>
                                            {exam.subject && (
                                                <>
                                                    <span className="exam-sep">•</span>
                                                    <span className="exam-subject" title={exam.subject}>
                                                        {exam.subject}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Line 2 & 3: Judul & Jadwal Bersih */}
                                    <div className="exam-item-body">
                                        <h4 className="exam-item-title" title={exam.title}>
                                            {exam.title}
                                        </h4>
                                        <p className="exam-item-schedule">
                                            {formatDateRange(exam.start_time, exam.end_time)}
                                        </p>
                                    </div>

                                    {/* Line 4: Info Sasaran / Nilai & Tombol Aksi */}
                                    <div className="exam-item-foot">
                                        {isSiswa ? (
                                            /* Siswa View */
                                            <>
                                                {isCompleted ? (
                                                    <div className="exam-foot-row">
                                                        <span className="exam-foot-meta">
                                                            {exam.attempt?.score != null ? (
                                                                <>Nilai: <strong>{exam.attempt.score}</strong>/100</>
                                                            ) : (
                                                                'Sudah dikerjakan'
                                                            )}
                                                        </span>
                                                        <a
                                                            href="/api/sso/cbt"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="exam-action-btn exam-action-btn--ghost"
                                                        >
                                                            Hasil
                                                        </a>
                                                    </div>
                                                ) : isActive ? (
                                                    <div className="exam-foot-row">
                                                        <span className="exam-foot-meta text-emerald-600">
                                                            {exam.isInProgress ? 'Sedang dikerjakan' : 'Siap dikerjakan'}
                                                        </span>
                                                        <a
                                                            href="/api/sso/cbt"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="exam-action-btn exam-action-btn--primary"
                                                        >
                                                            {exam.isInProgress ? 'Lanjut' : 'Mulai'}
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="exam-foot-row">
                                                        <span className="exam-foot-meta text-slate-400">Terjadwal</span>
                                                        <span className="exam-action-disabled">Menunggu</span>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* Guru / Admin View */
                                            <div className="exam-foot-row">
                                                <div className="exam-foot-meta" title={exam.target_classes?.join(', ')}>
                                                    {exam.target_classes && exam.target_classes.length > 0 ? (
                                                        <span>
                                                            {exam.target_classes.slice(0, 2).join(', ')}
                                                            {exam.target_classes.length > 2 ? ` +${exam.target_classes.length - 2}` : ''}
                                                        </span>
                                                    ) : exam.participants_count ? (
                                                        <span>{exam.participants_count} Siswa</span>
                                                    ) : (
                                                        <span>Semua Siswa</span>
                                                    )}
                                                </div>

                                                {exam.canMonitor !== false ? (
                                                    <a
                                                        href="/api/sso/cbt"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="exam-action-btn exam-action-btn--primary"
                                                        title="Pantau pelaksanaan ujian di CBT"
                                                    >
                                                        Pantau
                                                    </a>
                                                ) : (
                                                    <span
                                                        className="exam-creator-tag"
                                                        title={`Ujian dibuat oleh ${exam.creator_name || 'Guru lain'}`}
                                                    >
                                                        Oleh {exam.creator_name ? exam.creator_name.split(',')[0] : 'Guru lain'}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style jsx>{`
                .db__exam-clean-wrapper {
                    width: 100%;
                    margin-bottom: 2px;
                }

                .exam-card {
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 16px;
                    padding: 16px 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
                    color: var(--n-ink);
                    transition: border-color 0.25s ease, box-shadow 0.25s ease;
                }

                .exam-card:hover {
                    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.05);
                    border-color: rgba(99, 102, 241, 0.25);
                }

                :global(.dark) .exam-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }

                /* Header */
                .exam-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .exam-title-area {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .exam-icon-badge {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    background: var(--n-soft, #E0ECFF) !important;
                    color: var(--n-primary, #3083FF) !important;
                }

                :global(.dark) .exam-icon-badge {
                    background: var(--n-soft, #162a4d) !important;
                    color: var(--n-primary, #3083FF) !important;
                }

                .exam-title-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .exam-title {
                    font-size: 0.95rem;
                    font-weight: 700;
                    margin: 0;
                    color: var(--n-ink, #0f172a);
                    line-height: 1.2;
                }

                :global(.dark) .exam-title {
                    color: #f8fafc !important;
                }

                .exam-active-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: #ecfdf5;
                    color: #059669;
                    border: 1px solid #a7f3d0;
                    border-radius: 20px;
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 2px 7px;
                }

                :global(.dark) .exam-active-pill {
                    background: rgba(16, 185, 129, 0.15) !important;
                    color: #34d399 !important;
                    border-color: rgba(16, 185, 129, 0.3) !important;
                }

                .pulse-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #10b981;
                    display: inline-block;
                }

                /* Header Actions */
                .exam-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .exam-nav-btns {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .exam-scroll-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 1px solid #E2E8F0;
                    background: #ffffff;
                    color: #64748B;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .exam-scroll-btn:hover {
                    background: #E0ECFF;
                    color: #2563eb;
                    border-color: #BFDBFE;
                }

                :global(.dark) .exam-scroll-btn {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.12);
                    color: #cbd5e1;
                }

                :global(.dark) .exam-scroll-btn:hover {
                    background: rgba(48, 131, 255, 0.2);
                    color: #60a5fa;
                }

                /* Horizontal Track */
                .exam-track {
                    display: flex;
                    gap: 12px;
                    overflow-x: auto;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                    padding-bottom: 2px;
                    width: 100%;
                }

                .exam-track::-webkit-scrollbar {
                    display: none;
                }

                .exam-item {
                    flex: 0 0 calc((100% - 24px) / 3.10);
                    scroll-snap-align: start;
                    box-sizing: border-box;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 10px 14px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    min-height: 98px;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
                    transition: all 0.2s ease;
                }

                @media (max-width: 991.98px) {
                    .exam-item {
                        flex: 0 0 calc((100% - 12px) / 2.15);
                    }
                }

                @media (max-width: 767.98px) {
                    .exam-item {
                        flex: 0 0 calc((100% - 12px) / 1.25) !important;
                    }
                }

                .exam-item:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                    border-color: #cbd5e1;
                }

                .exam-item.is-active-exam {
                    background: #ffffff;
                    border-color: #a7f3d0;
                }

                :global(.dark) .exam-item {
                    background: #101e38 !important;
                    border-color: rgba(26, 115, 232, 0.25) !important;
                }

                :global(.dark) .exam-item.is-active-exam {
                    background: #11264a !important;
                    border-color: rgba(16, 185, 129, 0.4) !important;
                }

                /* Line 1: Meta */
                .exam-item-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .exam-meta-line {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.68rem;
                    line-height: 1.2;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }

                .exam-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .exam-dot--active {
                    background: #10b981;
                }

                .exam-dot--upcoming {
                    background: #3b82f6;
                }

                .exam-dot--completed {
                    background: #94a3b8;
                }

                .exam-status-text {
                    font-weight: 700;
                }

                .exam-status-text--active {
                    color: #059669;
                }

                .exam-status-text--upcoming {
                    color: #2563eb;
                }

                .exam-status-text--completed {
                    color: #64748b;
                }

                :global(.dark) .exam-status-text--active {
                    color: #34d399;
                }

                :global(.dark) .exam-status-text--upcoming {
                    color: #60a5fa;
                }

                :global(.dark) .exam-status-text--completed {
                    color: #94a3b8;
                }

                .exam-sep {
                    color: #cbd5e1;
                    font-size: 0.65rem;
                }

                :global(.dark) .exam-sep {
                    color: #475569;
                }

                .exam-duration {
                    color: #64748b;
                    font-weight: 600;
                }

                :global(.dark) .exam-duration {
                    color: #94a3b8;
                }

                .exam-subject {
                    color: #475569;
                    font-weight: 600;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 90px;
                }

                :global(.dark) .exam-subject {
                    color: #cbd5e1;
                }

                /* Line 2 & 3: Body */
                .exam-item-body {
                    margin: 4px 0 2px 0;
                }

                .exam-item-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    margin: 0 0 2px 0;
                    color: #1e293b;
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                :global(.dark) .exam-item-title {
                    color: #f1f5f9 !important;
                }

                .exam-item-schedule {
                    font-size: 0.70rem;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                :global(.dark) .exam-item-schedule {
                    color: #94a3b8 !important;
                }

                /* Line 4: Foot */
                .exam-item-foot {
                    padding-top: 4px;
                    border-top: 1px solid #f1f5f9;
                }

                :global(.dark) .exam-item-foot {
                    border-top-color: rgba(255, 255, 255, 0.06) !important;
                }

                .exam-foot-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 6px;
                }

                .exam-foot-meta {
                    font-size: 0.68rem;
                    color: #64748b;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                :global(.dark) .exam-foot-meta {
                    color: #94a3b8;
                }

                .exam-foot-meta strong {
                    font-weight: 700;
                    color: #059669;
                }

                :global(.dark) .exam-foot-meta strong {
                    color: #34d399;
                }

                .exam-action-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2.5px 8px;
                    border-radius: 6px;
                    font-size: 0.68rem;
                    font-weight: 700;
                    text-decoration: none;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }

                .exam-action-btn--primary {
                    background: #3083FF;
                    color: #ffffff;
                }

                .exam-action-btn--primary:hover {
                    background: #2563eb;
                }

                .exam-action-btn--ghost {
                    background: #f1f5f9;
                    color: #3083FF;
                }

                .exam-action-btn--ghost:hover {
                    background: #e2e8f0;
                }

                :global(.dark) .exam-action-btn--ghost {
                    background: rgba(255, 255, 255, 0.08);
                    color: #60a5fa;
                }

                .exam-action-disabled {
                    font-size: 0.65rem;
                    color: #94a3b8;
                    font-weight: 500;
                }

                .exam-creator-tag {
                    display: inline-flex;
                    align-items: center;
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 0.67rem;
                    font-weight: 600;
                    color: #64748b;
                    background: #f1f5f9;
                    padding: 2.5px 7px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }

                :global(.dark) .exam-creator-tag {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.1);
                    color: #94a3b8;
                }

                /* Skeletons & Empty State */
                .exam-item--skeleton {
                    border-radius: 12px;
                    background: #f1f5f9;
                    animation: pulse 1.5s infinite;
                }

                :global(.dark) .exam-item--skeleton {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border: 1px solid rgba(37, 99, 235, 0.25) !important;
                }

                .exam-empty-state {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 20px;
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 12px;
                    font-size: 0.76rem;
                    color: #64748b;
                    font-weight: 500;
                }

                :global(.dark) .exam-empty-state {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(255, 255, 255, 0.12);
                    color: #94a3b8;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
