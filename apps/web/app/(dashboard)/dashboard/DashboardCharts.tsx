'use client';

import React from 'react';
import {
    PieChart,
    BarChart2,
    TrendingUp,
    CheckCircle2,
    Clock,
    AlertCircle,
    UserCheck,
    UserX,
    Calendar,
    Activity
} from 'lucide-react';

interface AttendanceData {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    total: number;
}

interface JurnalData {
    sesuai: number;
    terlambat: number;
    kosong: number;
    tanpaPendampingan?: number;
    lainnya?: number;
    total: number;
}

interface WeeklyTrend {
    day: string;
    hadir: number;
    sakitIzin: number;
    /** Tanggal 'YYYY-MM-DD' — dipakai sebagai key React yang stabil. */
    tanggal?: string;
}

interface DashboardChartsProps {
    attendance?: AttendanceData;
    jurnalStats?: JurnalData;
    weeklyTrends?: WeeklyTrend[];
    roleTitle?: string;
    /** Selama true, angka ringkasan ditampilkan sebagai "—". */
    loading?: boolean;
}

export default function DashboardCharts({
    attendance = { hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0 },
    jurnalStats = { sesuai: 0, terlambat: 0, kosong: 0, tanpaPendampingan: 0, lainnya: 0, total: 0 },
    weeklyTrends = [],
    loading = false,
}: DashboardChartsProps) {
    const totalAtt = attendance.total || (attendance.hadir + attendance.sakit + attendance.izin + attendance.alpa) || 1;
    const calcPctStr = (n: number) => ((n / totalAtt) * 100).toFixed(2);
    const hadirPctNum = (attendance.hadir / totalAtt) * 100;
    const hadirPct = calcPctStr(attendance.hadir);
    const sakitPct = calcPctStr(attendance.sakit);
    const izinPct = calcPctStr(attendance.izin);
    const alpaPct = calcPctStr(attendance.alpa);

    // Circumference calculation for SVG Donut (r = 40 => C = 2 * PI * 40 = 251.32)
    const strokeDash = 251.32;
    const offsetHadir = strokeDash * (1 - hadirPctNum / 100);

    // Sesi yang benar-benar terlaksana = seluruh jurnal KECUALI yang berkategori "Kosong"
    const totalJurnal = jurnalStats.total || 1;
    const jurnalPctNum = Math.min(100, ((jurnalStats.total - jurnalStats.kosong) / totalJurnal) * 100);
    const jurnalPct = jurnalPctNum.toFixed(2);

    return (
        <div className="db-charts-grid">
            {/* 1. Donut Chart - Ringkasan Kehadiran Hari Ini */}
            <div className="db-chart-card db-chart-card--donut">
                <div className="db-chart-card__head">
                    <div className="db-chart-card__title-group">
                        <span className="db-chart-card__icon-badge db-chart-card__icon-badge--blue">
                            <PieChart size={18} />
                        </span>
                        <div>
                            <h3 className="db-chart-card__title">Statistik Kehadiran</h3>
                        </div>
                    </div>
                    <span className="db-chart-card__live-pill">
                        <span className="db-chart-card__dot" /> Realtime
                    </span>
                </div>

                <div className="db-chart-donut-body">
                    {/* SVG Donut Visual */}
                    <div className="db-chart-donut-wrap">
                        <svg className="db-chart-donut-svg" viewBox="0 0 100 100">
                            {/* Track Background */}
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                className="db-chart-donut-track"
                            />
                            {/* Segment: Hadir */}
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                className="db-chart-donut-segment db-chart-donut-segment--hadir"
                                strokeDasharray={strokeDash}
                                strokeDashoffset={offsetHadir}
                            />
                        </svg>
                        <div className="db-chart-donut-center">
                            <span className="db-chart-donut-value">{loading ? '—' : `${hadirPct}%`}</span>
                        </div>
                    </div>

                    {/* Breakdown List */}
                    <div className="db-chart-legend">
                        <div className="db-chart-legend-item">
                            <span className="db-chart-dot db-chart-dot--hadir" />
                            <span className="db-chart-legend-name">Hadir</span>
                            <span className="db-chart-legend-count">{attendance.hadir} siswa</span>
                            <span className="db-chart-legend-pct">{hadirPct}%</span>
                        </div>
                        <div className="db-chart-legend-item">
                            <span className="db-chart-dot db-chart-dot--sakit" />
                            <span className="db-chart-legend-name">Sakit</span>
                            <span className="db-chart-legend-count">{attendance.sakit} siswa</span>
                            <span className="db-chart-legend-pct">{sakitPct}%</span>
                        </div>
                        <div className="db-chart-legend-item">
                            <span className="db-chart-dot db-chart-dot--izin" />
                            <span className="db-chart-legend-name">Izin</span>
                            <span className="db-chart-legend-count">{attendance.izin} siswa</span>
                            <span className="db-chart-legend-pct">{izinPct}%</span>
                        </div>
                        <div className="db-chart-legend-item">
                            <span className="db-chart-dot db-chart-dot--alpa" />
                            <span className="db-chart-legend-name">Alpa</span>
                            <span className="db-chart-legend-count">{attendance.alpa} siswa</span>
                            <span className="db-chart-legend-pct">{alpaPct}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Bar Chart - Tren Kehadiran Mingguan */}
            <div className="db-chart-card db-chart-card--bar">
                <div className="db-chart-card__head">
                    <div className="db-chart-card__title-group">
                        <span className="db-chart-card__icon-badge db-chart-card__icon-badge--teal">
                            <BarChart2 size={18} />
                        </span>
                        <div>
                            <h3 className="db-chart-card__title">Tren Kehadiran Mingguan</h3>
                        </div>
                    </div>
                </div>

                <div className="db-chart-bar-container">
                    {weeklyTrends.length === 0 ? (
                        <div className="db-chart-bar-empty">
                            {loading ? 'Memuat tren…' : 'Belum ada data kehadiran'}
                        </div>
                    ) : (
                        <div className="db-chart-bar-grid">
                            {weeklyTrends.map(t => (
                                <div key={t.tanggal ?? t.day} className="db-chart-bar-col">
                                    <div className="db-chart-bar-val-popup">{typeof t.hadir === 'number' ? `${t.hadir.toFixed(2)}%` : `${t.hadir}%`}</div>
                                    <div className="db-chart-bar-track">
                                        <div
                                            className="db-chart-bar-fill"
                                            style={{ height: `${t.hadir}%` }}
                                        />
                                    </div>
                                    <span className="db-chart-bar-label">{t.day}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Progress Gauge - Keterisian Jurnal KBM */}
            <div className="db-chart-card db-chart-card--gauge">
                <div className="db-chart-card__head">
                    <div className="db-chart-card__title-group">
                        <span className="db-chart-card__icon-badge db-chart-card__icon-badge--purple">
                            <Activity size={18} />
                        </span>
                        <div>
                            <h3 className="db-chart-card__title">Keterisian Jurnal KBM</h3>
                        </div>
                    </div>
                </div>

                <div className="db-chart-gauge-body">
                    <div className="db-chart-gauge-bar-wrap">
                        {/* Label lama "Terisi & Diverifikasi" menjanjikan verifikasi
                            yang tidak ada di data; yang benar-benar diukur adalah
                            berapa sesi terlaksana (bukan berkategori "Kosong"). */}
                        <div className="db-chart-gauge-info">
                            <span className="db-chart-gauge-label">Sesi Tercatat</span>
                            <span className="db-chart-gauge-pct">{loading ? '—' : `${jurnalPct}%`}</span>
                        </div>
                        <div className="db-chart-gauge-progress">
                            <div
                                className="db-chart-gauge-fill"
                                style={{ width: `${jurnalPct}%` }}
                            />
                        </div>
                    </div>

                    <div className="db-chart-gauge-stats">
                        {/* 1. Sesuai */}
                        <div className="db-chart-gauge-stat-item">
                            <CheckCircle2 size={16} className="text-emerald-500" style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                                <div className="db-chart-gauge-num">{jurnalStats.sesuai}</div>
                                <div className="db-chart-gauge-sub">Sesuai</div>
                            </div>
                        </div>

                        {/* 2. Kosong */}
                        <div className="db-chart-gauge-stat-item">
                            <AlertCircle size={16} className="text-rose-500" style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                                <div className="db-chart-gauge-num">{jurnalStats.kosong}</div>
                                <div className="db-chart-gauge-sub">Kosong</div>
                            </div>
                        </div>

                        {/* 3. Tanpa Pendampingan */}
                        <div className="db-chart-gauge-stat-item">
                            <Calendar size={16} className="text-purple-500" style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                                <div className="db-chart-gauge-num">{jurnalStats.tanpaPendampingan ?? (jurnalStats as any).tanpa_pendampingan ?? jurnalStats.lainnya ?? 0}</div>
                                <div className="db-chart-gauge-sub" title="Tanpa Pendampingan">Tanpa Pendampingan</div>
                            </div>
                        </div>

                        {/* 4. Terlambat */}
                        <div className="db-chart-gauge-stat-item">
                            <Clock size={16} className="text-amber-500" style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                                <div className="db-chart-gauge-num">{jurnalStats.terlambat}</div>
                                <div className="db-chart-gauge-sub">Terlambat</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .db-charts-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    margin-bottom: 0;
                    width: 100%;
                    box-sizing: border-box;
                }

                .db-chart-card {
                    background: #ffffff;
                    border: 1px solid #E1E2E9;
                    border-radius: 16px;
                    padding: 16px 18px;
                    box-shadow: 0 4px 18px rgba(0, 32, 90, 0.04);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .db-chart-card:hover {
                    box-shadow: 0 8px 24px rgba(0, 32, 90, 0.08);
                }

                :global(.dark) .db-chart-card {
                    background: #000000;
                    border-color: rgba(37, 99, 235, 0.4);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                }

                .db-chart-card__head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .db-chart-card__title-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .db-chart-card__icon-badge {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    background: var(--n-soft, #E0ECFF);
                    color: var(--n-primary, #3083FF);
                }

                .db-chart-card__icon-badge--blue,
                .db-chart-card__icon-badge--teal,
                .db-chart-card__icon-badge--purple {
                    background: var(--n-soft, #E0ECFF);
                    color: var(--n-primary, #3083FF);
                }

                :global(.dark) .db-chart-card__icon-badge--blue,
                :global(.dark) .db-chart-card__icon-badge--teal,
                :global(.dark) .db-chart-card__icon-badge--purple {
                    background: var(--n-soft, #162a4d);
                    color: var(--n-primary, #3083FF);
                }

                .db-chart-card__title {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #0f172a;
                }

                :global(.dark) .db-chart-card__title {
                    color: #f8fafc;
                }

                .db-chart-card__subtitle {
                    margin: 0;
                    font-size: 0.75rem;
                    color: #64748b;
                }

                :global(.dark) .db-chart-card__subtitle {
                    color: #94a3b8;
                }

                .db-chart-card__live-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #3083FF;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                :global(.dark) .db-chart-card__live-pill {
                    color: #60a5fa;
                }

                .db-chart-card__dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #3083FF;
                    animation: pulseDot 1.8s infinite;
                }

                :global(.dark) .db-chart-card__dot {
                    background: #60a5fa;
                }

                @keyframes pulseDot {
                    0% { transform: scale(0.95); opacity: 1; }
                    50% { transform: scale(1.3); opacity: 0.5; }
                    100% { transform: scale(0.95); opacity: 1; }
                }

                /* Donut Chart Layout */
                .db-chart-donut-body {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding-top: 4px;
                }

                .db-chart-donut-wrap {
                    position: relative;
                    width: 110px;
                    height: 110px;
                    flex-shrink: 0;
                }

                .db-chart-donut-svg {
                    width: 100%;
                    height: 100%;
                    transform: rotate(-90deg);
                }

                .db-chart-donut-track {
                    fill: none;
                    stroke: #f1f5f9;
                    stroke-width: 12;
                }

                :global(.dark) .db-chart-donut-track {
                    stroke: rgba(255, 255, 255, 0.08);
                }

                .db-chart-donut-segment {
                    fill: none;
                    stroke-width: 12;
                    stroke-linecap: round;
                    transition: stroke-dashoffset 0.8s ease;
                }

                .db-chart-donut-segment--hadir {
                    stroke: #3083FF;
                }

                .db-chart-donut-center {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }

                .db-chart-donut-value {
                    font-size: 0.92rem;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.1;
                }

                :global(.dark) .db-chart-donut-value {
                    color: #ffffff;
                }

                /* Legend */
                .db-chart-legend {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex: 1;
                }

                .db-chart-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                }

                .db-chart-dot {
                    width: 9px;
                    height: 9px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .db-chart-dot--hadir { background: #3083FF; }
                .db-chart-dot--sakit { background: #f59e0b; }
                .db-chart-dot--izin { background: #06b6d4; }
                .db-chart-dot--alpa { background: #ef4444; }

                .db-chart-legend-name {
                    color: #334155;
                    font-weight: 600;
                    flex: 1;
                }

                :global(.dark) .db-chart-legend-name {
                    color: #cbd5e1;
                }

                .db-chart-legend-count {
                    color: #64748b;
                    font-size: 0.75rem;
                }

                .db-chart-legend-pct {
                    font-weight: 700;
                    color: #0f172a;
                    width: 56px;
                    text-align: right;
                }

                :global(.dark) .db-chart-legend-pct {
                    color: #ffffff;
                }

                /* Bar Chart Layout */
                .db-chart-bar-container {
                    padding-top: 10px;
                }

                .db-chart-bar-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 110px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--n-muted, #94a3b8);
                    text-align: center;
                }

                .db-chart-bar-grid {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    height: 110px;
                    gap: 8px;
                }

                .db-chart-bar-col {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    flex: 1;
                    height: 100%;
                }

                .db-chart-bar-val-popup {
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: #3083FF;
                }

                .db-chart-bar-track {
                    width: 100%;
                    max-width: 24px;
                    flex: 1;
                    background: #f1f5f9;
                    border-radius: 999px;
                    overflow: hidden;
                    display: flex;
                    align-items: flex-end;
                }

                :global(.dark) .db-chart-bar-track {
                    background: rgba(255, 255, 255, 0.08);
                }

                .db-chart-bar-fill {
                    width: 100%;
                    background: linear-gradient(180deg, #3083FF 0%, #112e59 100%);
                    border-radius: 999px;
                    transition: height 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .db-chart-bar-label {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: #64748b;
                }

                /* Gauge Progress Layout */
                .db-chart-gauge-body {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding-top: 4px;
                }

                .db-chart-gauge-bar-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .db-chart-gauge-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .db-chart-gauge-label {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: #334155;
                }

                :global(.dark) .db-chart-gauge-label {
                    color: #cbd5e1;
                }

                .db-chart-gauge-pct {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #3083FF;
                }

                .db-chart-gauge-progress {
                    height: 10px;
                    background: #f1f5f9;
                    border-radius: 999px;
                    overflow: hidden;
                }

                :global(.dark) .db-chart-gauge-progress {
                    background: rgba(255, 255, 255, 0.08);
                }

                .db-chart-gauge-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #112e59 0%, #3083FF 100%);
                    border-radius: 999px;
                    transition: width 0.8s ease;
                }

                /* auto-fit, bukan repeat(4, 1fr): dengan empat kategori, kartu
                   yang sempit menumpuk jadi 2x2 alih-alih memaksa empat kolom
                   yang angkanya saling berdempet. */
                .db-chart-gauge-stats {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 6px;
                    padding-top: 4px;
                }

                .db-chart-gauge-stat-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 6px;
                    border-radius: 12px;
                    background: #f8fafc;
                    border: 1px solid #f1f5f9;
                    min-width: 0;
                    box-sizing: border-box;
                }

                :global(.dark) .db-chart-gauge-stat-item {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(255, 255, 255, 0.06);
                }

                .db-chart-gauge-num {
                    font-size: 0.95rem;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.1;
                }

                :global(.dark) .db-chart-gauge-num {
                    color: #ffffff;
                }

                .db-chart-gauge-sub {
                    font-size: 0.63rem;
                    font-weight: 600;
                    color: #64748b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* ─────────────────────────────────────────────────────────────
                   MOBILE
                   Sebelum ini komponennya TIDAK punya satu pun media query, jadi
                   seluruh ukurannya ukuran desktop (padding kartu 20px, donat
                   110px, ikon 38px). Di layar 360px sisa ruang untuk legenda
                   tinggal ~166px padahal satu barisnya butuh ~183px, sehingga
                   isinya meluber keluar kartu — itulah "kartu terpotong" yang
                   terlihat: pill Realtime dan batang hari terakhir terpangkas.

                   Selain mengecilkan ukuran, dua deklarasi min-width: 0 di bawah
                   yang menyelesaikan akar masalahnya: flex item bawaannya
                   min-width: auto, sehingga TIDAK BOLEH menyusut di bawah
                   lebar kontennya dan mendorong saudaranya keluar kartu.
                   (Tanpa backtick: blok ini template literal styled-jsx.)
                   ───────────────────────────────────────────────────────────── */
                @media (max-width: 767.98px) {
                    .db-charts-grid {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }

                    .db-chart-card {
                        padding: 14px;
                        border-radius: 16px;
                        gap: 12px;
                    }

                    .db-chart-card__head {
                        gap: 8px;
                    }

                    /* Tanpa ini, judul panjang menolak menyusut dan mendorong
                       pill "Realtime" keluar dari tepi kanan kartu. */
                    .db-chart-card__title-group {
                        min-width: 0;
                    }

                    .db-chart-card__title {
                        font-size: 0.88rem;
                    }

                    .db-chart-card__icon-badge {
                        width: 32px;
                        height: 32px;
                        border-radius: 10px;
                    }

                    .db-chart-card__live-pill {
                        flex-shrink: 0;
                        padding: 3px 8px;
                        font-size: 0.66rem;
                    }

                    .db-chart-donut-body {
                        gap: 14px;
                    }

                    .db-chart-donut-wrap {
                        width: 92px;
                        height: 92px;
                    }

                    .db-chart-legend {
                        min-width: 0;
                        gap: 6px;
                    }

                    .db-chart-legend-item {
                        font-size: 0.74rem;
                        gap: 6px;
                        min-width: 0;
                    }

                    .db-chart-legend-count {
                        font-size: 0.68rem;
                        white-space: nowrap;
                    }

                    .db-chart-legend-pct {
                        width: 48px;
                    }

                    /* Tujuh kolom dengan label dua desimal ("83.00%") tidak muat
                       pada gap 8px; min-width: 0 memastikan kolom benar-benar
                       bisa menyusut, bukan meluber. */
                    .db-chart-bar-grid {
                        gap: 4px;
                    }

                    .db-chart-bar-col {
                        min-width: 0;
                    }

                    .db-chart-bar-val-popup {
                        font-size: 0.58rem;
                    }

                    .db-chart-bar-label {
                        font-size: 0.66rem;
                    }
                }
            `}</style>
        </div>
    );
}
