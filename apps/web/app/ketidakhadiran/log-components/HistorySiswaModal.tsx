'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import DetailHeader from '@/components/ui/DetailHeader';

interface HistorySiswaModalProps {
    nisn: string;
    onClose: () => void;
}

import { formatJpDurasi } from '@/lib/ketidakhadiran-jp';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';

import { Spinner } from '@/components/ui/Spinner';

export default function HistorySiswaModal({ nisn, onClose }: HistorySiswaModalProps) {
    const ta = useTahunAjaranFilter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        siswa: { nisn: string; nama: string; kelas: string };
        stat: any;
        riwayat: any[];
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const t = Date.now();
            const url = `/api/ketidakhadiran/log/siswa/${nisn}?_t=${t}${ta.selected && ta.selected !== 'Semua' ? `&tahun_ajaran=${encodeURIComponent(ta.selected)}` : ''}`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.ok || result.success) {
                setData(result.data || result);
            } else {
                throw new Error(result.error || 'Gagal memuat riwayat');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [nisn, ta.selected]);

    useEffect(() => {
        if (nisn) loadHistory();
    }, [nisn, ta.selected, loadHistory]);

    const renderJpWithDays = (jp: number) => {
        const display = formatJpDurasi(jp);
        if (display === `${jp} JP` || jp === 0) return `${jp} JP`;
        return `${jp} JP (${display})`;
    };

    return (
        <Modal size="lg" onClose={onClose} labelledBy="history-siswa-title">
            <ModalHeader
                id="history-siswa-title"
                icon="clock-history"
                title="Riwayat Ketidakhadiran"
                onClose={onClose}
            />
            <ModalBody className="hsm__body">
                        {data?.siswa && (
                            <DetailHeader
                                name={data.siswa.nama}
                                meta={`NISN ${data.siswa.nisn || nisn} · Kelas ${data.siswa.kelas || '-'}`}
                            />
                        )}
                        {ta.years.length > 0 && (
                            <div className="hsm__taFilterContainer">
                                <div className="hsm__taFilterWrap">
                                    <i className="bi bi-mortarboard" />
                                    <select
                                        value={ta.selected}
                                        onChange={e => ta.setSelected(e.target.value)}
                                        title="Tahun Ajaran"
                                        className="hsm__taSelect"
                                    >
                                        <option value="Semua">Semua Riwayat</option>
                                        {ta.years.map(y => <option key={y} value={y}>TA {y}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        {loading ? (
                            <div className="hsm__loading">
                                <Spinner variant="buble" size={24} />
                            </div>
                        ) : error ? (
                            <div className="hsm__error">
                                <i className="bi bi-exclamation-circle" />
                                <span>{error}</span>
                            </div>
                        ) : (
                            <>
                                {/* Stats Cards */}
                                <div className="hsm__stats">
                                    <div className="hsm__statCard hsm__statIzin">
                                        <span className="hsm__statNum">
                                            {data?.stat?.total_izin_hari_kalender || 0} hari
                                            <small className="hsm__statJp">{renderJpWithDays(data?.stat?.total_izin_jp || 0)}</small>
                                        </span>
                                        <span className="hsm__statLbl">Total Izin</span>
                                    </div>
                                    <div className="hsm__statCard hsm__statSakit">
                                        <span className="hsm__statNum">
                                            {data?.stat?.total_sakit_hari_kalender || 0} hari
                                            <small className="hsm__statJp">{renderJpWithDays(data?.stat?.total_sakit_jp || 0)}</small>
                                        </span>
                                        <span className="hsm__statLbl">Total Sakit</span>
                                    </div>
                                </div>

                                {/* Timeline */}
                                <div className="hsm__timeline">
                                    {data?.riwayat && data.riwayat.length > 0 ? (
                                        data.riwayat.map((item, idx) => (
                                            <div key={item.id} className="hsm__item">
                                                <div className="hsm__itemBadge">
                                                    <span className={`hsm__badge hsm__badge-${item.jenis?.toLowerCase()}`}>
                                                        {item.jenis}
                                                    </span>
                                                </div>
                                                <div className="hsm__itemContent">
                                                    <div className="hsm__itemHeader">
                                                        <span className="hsm__itemDate">{formatPeriode(item.tgl_mulai, item.tgl_selesai)}</span>
                                                        <span className="hsm__itemDur">{item.display_durasi}</span>
                                                    </div>
                                                    <div className="hsm__itemDesc">
                                                        {item.keterangan || 'Tanpa keterangan'}
                                                        {item.waktu_mulai_real && item.waktu_selesai_real && (
                                                            // Entri kontinu: jamnya batas rentang lintas hari (panah),
                                                            // bukan jam yang berulang tiap hari (em dash)
                                                            <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '6px', opacity: 0.85, fontWeight: 500 }}>
                                                                <i className="bi bi-clock" style={{ marginRight: '4px' }} />
                                                                {item.waktu_mulai_real.slice(0, 5)} {item.is_kontinu ? '→' : '—'} {item.waktu_selesai_real.slice(0, 5)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="hsm__itemFooter">
                                                        <span className={`hsm__status hsm__status-${item.status?.toLowerCase()}`}>
                                                            {item.status}
                                                        </span>
                                                        <span className="hsm__createdAt">Dicatat: {formatFullDate(item.created_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="hsm__empty">Belum ada riwayat ketidakhadiran.</div>
                                    )}
                                </div>
                            </>
                        )}
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="cancel" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>Tutup</Button>
            </ModalFooter>

            <style jsx>{`
                .hsm__taFilterContainer { display: flex; justify-content: center; width: 100%; }

                .hsm__body { overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
                .hsm__loading, .hsm__error, .hsm__empty { padding: 40px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--n-muted); font-size: 0.9rem; }
                .hsm__spinner { width: 32px; height: 32px; border: 3px solid #f1f5f9; border-top-color: #3083FF; border-radius: 50%; animation: spin 0.8s linear infinite; }
                .hsm__error i { font-size: 2rem; color: #ef4444; }

                .hsm__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .hsm__statCard { padding: 12px 16px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; border: 1px solid transparent; }
                .hsm__statIzin { background: #f0fdf4; border-color: #dcfce7; color: #15803d; }
                .hsm__statSakit { background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2); color: #d97706; }
                .hsm__statNum { font-size: 1.15rem; font-weight: 900; line-height: 1.2; }
                .hsm__statJp { display: block; font-size: 0.75rem; font-weight: 700; opacity: 0.8; margin-top: 2px; }
                .hsm__statLbl { font-size: 0.7rem; font-weight: 700; opacity: 0.9; margin-top: 2px; }

                .hsm__timeline { display: flex; flex-direction: column; gap: 16px; }
                .hsm__item { display: flex; gap: 12px; }
                .hsm__itemBadge { display: flex; flex-direction: column; align-items: center; }
                .hsm__badge { padding: 4px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                .hsm__badge-izin { background: #10b981; color: white; }
                .hsm__badge-sakit { background: #d97706; color: white; }

                .hsm__itemContent { flex: 1; padding: 12px 16px; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .hsm__itemHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
                .hsm__itemDate { font-size: 0.85rem; font-weight: 700; color: var(--n-text); }
                .hsm__itemDur { font-size: 0.72rem; font-weight: 600; background: var(--n-soft); padding: 2px 8px; border-radius: 50px; color: var(--n-muted); }
                .hsm__itemDesc { font-size: 0.85rem; color: var(--n-muted); line-height: 1.5; margin-bottom: 8px; font-style: italic; }
                .hsm__itemFooter { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--n-border); padding-top: 8px; margin-top: 4px; }
                .hsm__status { padding: 4px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; background: var(--n-soft); color: var(--n-text); }
                .hsm__status-pending { background: rgba(217,119,6,0.15); color: #d97706; }
                .hsm__status-approved { background: rgba(16,185,129,0.15); color: #10b981; }
                .hsm__status-rejected { background: rgba(239,68,68,0.15); color: #ef4444; }
                .hsm__status-ringan { background: rgba(59,130,246,0.15); color: #3b82f6; }
                .hsm__status-sedang { background: rgba(245,158,11,0.15); color: #f59e0b; }
                .hsm__status-berat { background: rgba(239,68,68,0.15); color: #ef4444; }
                .hsm__createdAt { font-size: 0.65rem; color: var(--n-muted); }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Pola referensi master/pengaturan-data. Palet biru bersama, aksen #60a5fa (sama di semua halaman).
                   Sebelumnya memakai slate (#0f172a/#1e293b/#334155) yang di luar
                   palet, sehingga modal ini terlihat lebih terang & lebih biru
                   dingin dibanding halaman lain. */
                :global(.dark) .hsm__content {
                    background: #0b1329;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 20px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
                }
                :global(.dark) .hsm__header {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25));
                    border-bottom-color: rgba(26, 115, 232, 0.4);
                }
                :global(.dark) .hsm__title { color: #ffffff; }
                :global(.dark) .hsm__subtitle { color: #94a3b8; }
                :global(.dark) .hsm__titleIcon {
                    background: rgba(96, 165, 250, 0.15);
                    border-color: rgba(96, 165, 250, 0.4);
                    color: #60a5fa;
                }
                :global(.dark) .hsm__closeBtn { background: #0b1329; border: 1px solid rgba(26, 115, 232, 0.4); color: #94a3b8; }
                :global(.dark) .hsm__closeBtn:hover { background: rgba(26, 115, 232, 0.15); color: #ffffff; }
                :global(.dark) .hsm__itemContent {
                    background: #0b1329;
                    border: 1px solid rgba(37, 99, 235, 0.4);
                    border-radius: 12px;
                }
                :global(.dark) .hsm__itemDate { color: #ffffff; }
                :global(.dark) .hsm__itemDesc { color: #94a3b8; }
                :global(.dark) .hsm__itemDur { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
                :global(.dark) .hsm__createdAt { color: #64748b; }
                :global(.dark) .hsm__itemFooter { border-top-color: rgba(26, 115, 232, 0.25); }
                :global(.dark) .hsm__statCard { border-color: transparent; }
                :global(.dark) .hsm__statIzin { background: rgba(16,185,129,0.1); color: #34d399; }
                :global(.dark) .hsm__statSakit { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }

                .hsm__taFilterWrap { position: relative; display: flex; justify-content: center; align-items: center; gap: 6px; background: transparent; border: 1px solid var(--n-border); border-radius: 8px; padding: 4px 10px; min-height: 32px; flex-shrink: 0; }
                .hsm__taSelect { border: none; background-color: transparent !important; font-size: 0.8rem; font-weight: 600; color: var(--n-text); outline: none; cursor: pointer; text-align: center; }
                .hsm__taSelect option { color: #000; }
                :global(.dark) .hsm__taFilterWrap { border-color: rgba(96, 165, 250, 0.4); }
                :global(.dark) .hsm__taSelect { color: #ffffff; color-scheme: dark; }
                :global(.dark) .hsm__taSelect option { color: #ffffff; background: #0b1329; }
            `}</style>
        </Modal>
    );
}

function formatPeriode(tglMulai: string, tglSelesai: string): string {
    if (!tglMulai) return '—';
    const fmt = (d: string) => {
        // Parse YYYY-MM-DD manually to avoid timezone issues
        const [y, mo, day] = d.split('-').map(Number);
        const dt = new Date(y, mo - 1, day);
        return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    if (!tglSelesai || tglMulai === tglSelesai) return fmt(tglMulai);
    return `${fmt(tglMulai)} — ${fmt(tglSelesai)}`;
}

function formatFullDate(dateStr: string): string {
    if (!dateStr) return '—';
    // Handle both YYYY-MM-DD and full timestamp formats
    if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    // For YYYY-MM-DD format, parse locally
    const [y, mo, day] = dateStr.split('-').map(Number);
    const d = new Date(y, mo - 1, day);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
