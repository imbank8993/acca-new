'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import HistorySiswaModal from '@/app/ketidakhadiran/log-components/HistorySiswaModal';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { ActionButton } from '@/components/ui/ActionButtons';

interface GuruAsuhTabKehadiranProps { user?: any; }

interface SiswaAsuh {
    nisn: string;
    nama: string;
    kelas: string;
    ketidakhadiran: any[];
    total_izin: number;
    total_sakit: number;
    total_entries: number;
    status: 'hadir' | 'pending' | 'tidak_hadir';
}

interface Summary {
    total_siswa_asuh: number;
    total_tidak_hadir: number;
    total_izin: number;
    total_sakit: number;
    total_pending: number;
    hadir: number;
}

const REFRESH_INTERVAL = 30000;

export default function GuruAsuhTabKehadiran({ user }: GuruAsuhTabKehadiranProps) {
    const nip = user?.nip || user?.username || '';
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        has_asuhan: boolean;
        guru_info: any;
        siswa_list: SiswaAsuh[];
        summary: Summary | null;
        today: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [selectedSiswaNisn, setSelectedSiswaNisn] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const { registerModal } = useModalBlur();

    // Filter tahun ajaran: pilihan = tahun ajaran AKTIF, default sesuai tanggal hari ini.
    // Menentukan roster anak asuh tahun mana yang ditampilkan.
    const ta = useTahunAjaranFilter();

    useEffect(() => {
        if (selectedSiswaNisn) return registerModal();
    }, [selectedSiswaNisn, registerModal]);

    const loadData = useCallback(async () => {
        if (!nip) { setLoading(false); setError('NIP guru tidak ditemukan.'); return; }
        try {
            const t = Date.now();
            const taParam = ta.selected && ta.selected !== 'Semua' ? `&tahun_ajaran=${encodeURIComponent(ta.selected)}` : '';
            const res = await fetch(`/api/ketidakhadiran/log/guru-asuh?nip=${encodeURIComponent(nip)}&_t=${t}${taParam}`);
            if (!res.ok) throw new Error('Gagal memuat data');
            const result = await res.json();
            setData(result);
            setError(null);
            setLastRefresh(new Date());
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    }, [nip, ta.selected]);

    useEffect(() => {
        loadData();
        intervalRef.current = setInterval(loadData, REFRESH_INTERVAL);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [loadData]);

    if (loading) return <PageLoader minHeight="300px" />;

    if (!data?.has_asuhan) {
        return (
            <div>
                <div className="gak__empty">
                <div className="gak__empty-icon"><i className="bi bi-person-hearts" /></div>
                <h3>Anda belum mengklaim anak asuh untuk tahun ajaran ini</h3>
                <p>Pergi ke tab "Klaim Anak Asuh" untuk mengklaim siswa yang akan menjadi anak asuh Anda.</p>
                <style jsx>{`
                    .gak__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; text-align: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 24px; }
                    .gak__empty-icon { width: 80px; height: 80px; background: var(--n-soft); color: var(--n-primary); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin-bottom: 24px; }
                    .gak__empty h3 { font-size: 1.5rem; font-weight: 800; color: var(--n-ink); margin: 0 0 10px; }
                    .gak__empty p { font-size: 0.95rem; color: var(--n-muted); max-width: 420px; line-height: 1.6; margin: 0; }
                    :global(.dark) .gak__empty-icon { background: rgba(59,130,246,0.1); color: #60a5fa; }
                    :global(.dark) .gak__empty h3 { color: #e8edf5; }
                `}</style>
                </div>
            </div>
        );
    }

    const { summary, guru_info, siswa_list, today } = data;

    return (
        <div className="gak__wrap">
            <div className="gak__summaryGrid">
                <div className="gak__summaryCard gak__total">
                    <div className="gak__summaryNum">{summary?.total_siswa_asuh ?? 0}</div>
                    <div className="gak__summaryLbl">Total Siswa Asuh</div>
                </div>
                <div className="gak__summaryCard gak__hadir">
                    <div className="gak__summaryNum">{summary?.hadir ?? 0}</div>
                    <div className="gak__summaryLbl">Hadir</div>
                </div>
                <div className="gak__summaryCard gak__izin">
                    <div className="gak__summaryNum">{summary?.total_izin ?? 0}</div>
                    <div className="gak__summaryLbl">Izin</div>
                </div>
                <div className="gak__summaryCard gak__sakit">
                    <div className="gak__summaryNum">{summary?.total_sakit ?? 0}</div>
                    <div className="gak__summaryLbl">Sakit</div>
                </div>
            </div>

            <div className="gak__progressBar">
                <div className="gak__progressInfo">
                    <span>Kehadiran Siswa Asuh</span>
                    <span>{summary?.hadir ?? 0}/{summary?.total_siswa_asuh ?? 0} hadir</span>
                </div>
                <div className="gak__progressTrack">
                    <div className="gak__progressFill" style={{ width: `${summary?.total_siswa_asuh ? Math.round((summary.hadir / summary.total_siswa_asuh) * 100) : 0}%` }} />
                </div>
            </div>

            <div className="gak__siswaList">
                {siswa_list.map((siswa, idx) => (
                    <div key={idx} className={`gak__siswaCard ${getCardClass(siswa.status)}`}>
                        <div className="gak__siswaAvatar"><i className="bi bi-person-fill" /></div>
                        <div className="gak__siswaInfo">
                            <div className="gak__siswaNama">{siswa.nama}</div>
                            <div className="gak__siswaMeta">
                                <span className="gak__kelasChip">{siswa.kelas}</span>
                                <span className="gak__nisnChip">NISN: {siswa.nisn}</span>
                            </div>
                        </div>
                        <div className="gak__siswaFooter">
                            <div className="gak__siswaStatus">
                                {siswa.status === 'hadir' && <span className="gak__statusBadge gak__statusHadir"><i className="bi bi-check-circle-fill" />Hadir</span>}
                                {siswa.status === 'pending' && <span className="gak__statusBadge gak__statusPending"><i className="bi bi-hourglass-split" />Pending</span>}
                                {siswa.status === 'tidak_hadir' && <span className="gak__statusBadge gak__statusTidakHadir"><i className="bi bi-x-circle-fill" />Tidak Hadir</span>}
                            </div>
                            <div className="gak__siswaActions">
                                <ActionButton action="view" label="Detail" iconOnly={false} onClick={() => setSelectedSiswaNisn(siswa.nisn)} title="Lihat Detail Ketidakhadiran" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedSiswaNisn && (
                <HistorySiswaModal nisn={selectedSiswaNisn} onClose={() => setSelectedSiswaNisn(null)} />
            )}

            <style jsx>{`
                .gak__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 24px; color: var(--n-muted); }
                .gak__spinner { width: 36px; height: 36px; border: 3px solid var(--n-border); border-top-color: var(--n-primary); border-radius: 50%; animation: gakSpin 0.8s linear infinite; }
                @keyframes gakSpin { to { transform: rotate(360deg); } }

                .gak__wrap { display: flex; flex-direction: column; gap: 16px; animation: gakFadeIn 0.4s ease-out; }
                @keyframes gakFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .gak__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: white; border: 1px solid var(--n-border); border-radius: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); flex-wrap: wrap; }
                .gak__headerLeft { display: flex; align-items: center; gap: 12px; }
                .gak__heroIcon { width: 42px; height: 42px; border-radius: 12px; background: #faf5ff; border: 1px solid #eff6ff; display: flex; align-items: center; justify-content: center; color: #3083FF; font-size: 1.25rem; flex-shrink: 0; }
                .gak__info { display: flex; flex-direction: column; justify-content: center; line-height: 1.2; }
                .gak__info strong { font-size: 1.02rem; font-weight: 800; color: var(--n-ink); letter-spacing: -0.01em; margin-bottom: 2px; }
                .gak__infoMeta { display: flex; flex-direction: column; gap: 0; }
                .gak__date { font-size: 0.75rem; color: var(--n-muted); font-weight: 600; }

                .gak__taFilterWrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; background: white; border: 1px solid var(--n-border); border-radius: 12px !important; padding: 0 12px !important; height: 38px !important; box-sizing: border-box !important; flex-shrink: 0; }
                .gak__taIcon { color: var(--n-muted); font-size: 0.9rem !important; flex-shrink: 0; }
                select.gak__taSelect,
                .gak__taSelect { border: 0 !important; border-style: none !important; outline: none !important; box-shadow: none !important; background: transparent !important; background-color: transparent !important; font-size: 0.85rem !important; font-weight: 700; color: var(--n-text); cursor: pointer; text-align: center; appearance: none !important; -webkit-appearance: none !important; -moz-appearance: none !important; padding: 0 16px 0 0 !important; margin: 0 !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%2360a5fa' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E") !important; background-repeat: no-repeat !important; background-position: right center !important; }

                :global(.dark) .gak__taFilterWrap { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; border-radius: 12px !important; }
                :global(.dark) .gak__taIcon { color: #60a5fa !important; }
                :global(.dark) select.gak__taSelect,
                :global(.dark) .gak__taSelect { border: 0 !important; border-style: none !important; outline: none !important; box-shadow: none !important; background: transparent !important; background-color: transparent !important; color: #ffffff !important; }
                :global(.dark) .gak__taSelect option { background-color: #000000 !important; color: #ffffff !important; }

                .gak__summaryGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                .gak__summaryCard { display: flex; flex-direction: column; align-items: center; padding: 16px 12px; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); text-align: center; transition: all 0.2s; }
                .gak__summaryCard:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.07); border-color: #3083FF; }
                .gak__summaryNum { font-size: 2rem; font-weight: 900; line-height: 1; }
                .gak__summaryLbl { font-size: 0.75rem; font-weight: 700; color: var(--n-muted); margin-top: 4px; }
                .gak__summaryBreakdown { display: flex; gap: 6px; margin-top: 4px; }
                .gak__total .gak__summaryNum { color: #3b82f6; }
                .gak__hadir .gak__summaryNum { color: #1d6bf3; }
                .gak__izin .gak__summaryNum { color: #10b981; }
                .gak__sakit .gak__summaryNum { color: #d97706; }
                .gak__izinTag { font-size: 0.68rem; font-weight: 700; background: #f0fdf4; color: #15803d; padding: 2px 7px; border-radius: 50px; }
                .gak__sakitTag { font-size: 0.68rem; font-weight: 700; background: #fffbeb; color: #b45309; padding: 2px 7px; border-radius: 50px; }

                .gak__progressBar { display: flex; flex-direction: column; gap: 6px; }
                .gak__progressInfo { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700; color: var(--n-muted); }
                .gak__progressTrack { height: 10px; border-radius: 50px; background: var(--n-border); overflow: hidden; }
                .gak__progressFill { height: 100%; border-radius: 50px; background: linear-gradient(90deg, #1d6bf3, #60a5fa); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }

                .gak__siswaList { display: flex; flex-direction: column; gap: 10px; }
                .gak__siswaCard { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 12px 18px; align-items: center; padding: 12px 18px; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); transition: all 0.2s; position: relative; }
                .gak__siswaCard:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); transform: translateY(-1px); border-color: #3083FF; }
                .gak__cardHadir { border-left: 5px solid #1d6bf3; }
                .gak__cardPending { border-left: 5px solid #10b981; }
                .gak__cardTidakHadir { border-left: 5px solid #f59e0b; }
                .gak__siswaAvatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; color: white; background: linear-gradient(135deg, #3083FF, #3b82f6); flex-shrink: 0; }
                .gak__siswaInfo { display: flex; flex-direction: column; gap: 4px; }
                .gak__siswaNama { font-size: 0.95rem; font-weight: 800; color: var(--n-ink); line-height: 1.2; }
                .gak__siswaMeta { display: flex; align-items: center; gap: 7px; }
                .gak__kelasChip { font-size: 0.72rem; font-weight: 700; background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 50px; }
                .gak__nisnChip { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; }
                .gak__statusBadge { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; line-height: 1; }
                .gak__statusHadir { background: #eff6ff; color: #1d4ed8; }
                .gak__statusPending { background: #f0fdf4; color: #15803d; }
                .gak__statusTidakHadir { background: #fffbeb; color: #b45309; }
                .gak__siswaFooter { display: contents; }
                .gak__siswaStatus, .gak__siswaSummary { display: flex; align-items: center; }
                .gak__siswaSummary { justify-content: flex-end; }
                .gak__siswaActions { display: flex; align-items: center; }
                .gak__detailBtn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--n-border); background: var(--n-soft); color: var(--n-primary); font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; line-height: 1; }
                .gak__detailBtn:hover { background: var(--n-primary); color: white; border-color: var(--n-primary); }
                .gak__detailBtn i { font-size: 0.9rem; }
                .gak__badgeCount { background: rgba(96,165,250,0.2); color: var(--n-primary); padding: 1px 6px; border-radius: 50px; font-size: 0.65rem; font-weight: 800; }
                .gak__detailBtn:hover .gak__badgeCount { background: rgba(255,255,255,0.3); color: white; }

                :global(.dark) .gak__header { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.75) !important; border-radius: 18px !important; }
                :global(.dark) .gak__taFilterWrap { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; border-radius: 12px !important; }
                :global(.dark) .gak__taIcon { color: #60a5fa !important; }
                :global(.dark) .gak__taSelect { border: none !important; outline: none !important; box-shadow: none !important; background-color: transparent !important; color: #ffffff !important; }
                :global(.dark) .gak__taSelect option { background-color: #000000 !important; color: #ffffff !important; }
                :global(.dark) .gak__heroIcon { background: rgba(26, 115, 232, 0.15) !important; border-color: rgba(26, 115, 232, 0.3) !important; color: #60a5fa !important; }
                :global(.dark) .gak__info strong { color: #ffffff !important; }
                :global(.dark) .gak__summaryCard { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; border-radius: 16px !important; }
                :global(.dark) .gak__total .gak__summaryNum { color: #60a5fa !important; }
                :global(.dark) .gak__hadir .gak__summaryNum { color: #60a5fa !important; }
                :global(.dark) .gak__izin .gak__summaryNum { color: #34d399 !important; }
                :global(.dark) .gak__sakit .gak__summaryNum { color: #fbbf24 !important; }
                :global(.dark) .gak__izinTag { background: rgba(52,211,153,0.15) !important; color: #34d399 !important; }
                :global(.dark) .gak__sakitTag { background: rgba(245,158,11,0.15) !important; color: #fbbf24 !important; }
                :global(.dark) .gak__siswaCard { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; border-radius: 16px !important; }
                :global(.dark) .gak__siswaNama { color: #ffffff !important; }
                :global(.dark) .gak__kelasChip { background: rgba(59,130,246,0.15) !important; color: #60a5fa !important; }
                :global(.dark) .gak__progressTrack { background: rgba(255,255,255,0.08) !important; }
                :global(.dark) .gak__detailBtn { background: rgba(96,165,250,0.1) !important; border: 1px solid rgba(96,165,250,0.3) !important; color: #60a5fa !important; }
                :global(.dark) .gak__detailBtn:hover { background: #1d6bf3 !important; border-color: #1d6bf3 !important; color: white !important; }
                :global(.dark) .gak__badgeCount { background: rgba(96,165,250,0.3) !important; color: #93c5fd !important; }

                @media (max-width: 640px) {
                    .gak__summaryGrid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
                    .gak__summaryNum { font-size: 1.6rem; }
                    .gak__siswaCard { grid-template-columns: 36px 1fr; grid-template-rows: auto auto; gap: 6px 12px; padding: 12px 14px; }
                    .gak__siswaFooter { display: flex; grid-column: 2; justify-content: flex-start; align-items: center; gap: 8px; margin-top: 2px; }
                    .gak__info strong { font-weight: 600; font-size: 0.95rem; }
                    .gak__siswaNama { font-weight: 600; font-size: 0.9rem; }
                    .gak__statusBadge { font-weight: 500; font-size: 0.72rem; padding: 4px 10px; }
                    .gak__header { flex-direction: column; align-items: stretch; padding: 12px; gap: 16px; }
                }
            `}</style>
        </div>
    );
}

function getCardClass(status: string) {
    switch (status) {
        case 'hadir': return 'gak__cardHadir';
        case 'pending': return 'gak__cardPending';
        default: return 'gak__cardTidakHadir';
    }
}

function formatTanggal(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatJam(d: Date): string {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}