'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import HistorySiswaModal from '@/app/ketidakhadiran/log-components/HistorySiswaModal';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { ActionButton } from '@/components/ui/ActionButtons';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { getProxiedImageUrl } from '@/lib/image-utils';

interface GuruAsuhTabKehadiranProps { user?: any; }

interface SiswaAsuh {
    nisn: string;
    nama: string;
    kelas: string;
    foto_profil?: string | null;
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
    const [selectedSiswaNisn, setSelectedSiswaNisn] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
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
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    }, [nip, ta.selected]);

    useEffect(() => {
        loadData();
        intervalRef.current = setInterval(loadData, REFRESH_INTERVAL);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [loadData]);

    const allYearOptions: string[] = useMemo(() => {
        const set = new Set<string>();
        (ta.years || []).filter(y => y !== 'Semua').forEach(y => set.add(y));
        ((data as any)?.available_tahun_ajaran || []).filter(Boolean).forEach((y: string) => set.add(y));
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [ta.years, data]);

    if (loading) return <PageLoader minHeight="300px" />;

    const filteredSiswaList = (data?.siswa_list || []).filter((s) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const nisn = (s.nisn || (s as any).nisn_siswa || '').toLowerCase();
        const nama = (s.nama || (s as any).nama_siswa || '').toLowerCase();
        const kelas = (s.kelas || '').toLowerCase();
        return nisn.includes(q) || nama.includes(q) || kelas.includes(q);
    });

    const toolbarNode = (
        <FilterToolbar actionsInline>
            {allYearOptions.length > 0 && (
                <FilterSelect
                    label="Tahun Ajaran"
                    icon="mortarboard"
                    value={ta.selected || 'Semua'}
                    onChange={ta.setSelected}
                    title="Tahun Ajaran"
                    options={[
                        { value: 'Semua', label: 'Semua TA' },
                        ...allYearOptions.map(y => ({ value: y, label: `TA ${y}` }))
                    ]}
                />
            )}
            <FilterSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Cari nama / NISN..."
            />
        </FilterToolbar>
    );

    if (!data?.has_asuhan) {
        return (
            <div className="gak__wrap">
                {toolbarNode}
                <div className="gak__empty">
                    <div className="gak__empty-icon"><i className="bi bi-person-hearts" /></div>
                    <h3>Anda belum mengklaim anak asuh untuk tahun ajaran ini</h3>
                    <p>Pilih tahun ajaran lain di atas atau buka tab "Klaim Anak Asuh" untuk mengklaim siswa yang akan menjadi anak asuh Anda.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="gak__wrap">
            {toolbarNode}

            {filteredSiswaList.length === 0 ? (
                <div className="gak__empty">
                    <div className="gak__empty-icon"><i className="bi bi-people" /></div>
                    <h3>Tidak ada siswa yang cocok</h3>
                    <p>Coba gunakan kata kunci pencarian yang lain.</p>
                </div>
            ) : (
                <div className="gak__siswaList">
                    {filteredSiswaList.map((siswa, idx) => {
                        const nisn = siswa.nisn || (siswa as any).nisn_siswa || '';
                        const nama = siswa.nama || (siswa as any).nama_siswa || '-';
                        const status = siswa.status || ((siswa.ketidakhadiran && siswa.ketidakhadiran.length > 0) ? 'tidak_hadir' : 'hadir');
                        return (
                            <div key={idx} className={`gak__siswaCard ${getCardClass(status)}`}>
                                <div className="gak__siswaAvatar">
                                    {siswa.foto_profil && (
                                        <img
                                            src={getProxiedImageUrl(siswa.foto_profil)}
                                            alt={nama}
                                            className="gak__avatarImg"
                                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                        />
                                    )}
                                    <i className="bi bi-person-fill" />
                                </div>
                                <div className="gak__siswaInfo">
                                    <div className="gak__siswaNama">{nama}</div>
                                    <div className="gak__siswaMeta">
                                        <span className="gak__kelasChip">{siswa.kelas}</span>
                                        <span className="gak__nisnChip">NISN: {nisn}</span>
                                    </div>
                                </div>
                                <div className="gak__siswaFooter">
                                    <div className="gak__siswaStatus">
                                        {status === 'hadir' && <span className="gak__statusBadge gak__statusHadir"><i className="bi bi-check-circle-fill" />Hadir</span>}
                                        {status === 'pending' && <span className="gak__statusBadge gak__statusPending"><i className="bi bi-hourglass-split" />Pending</span>}
                                        {status === 'tidak_hadir' && <span className="gak__statusBadge gak__statusTidakHadir"><i className="bi bi-x-circle-fill" />Tidak Hadir</span>}
                                    </div>
                                    <div className="gak__siswaActions">
                                        <ActionButton action="view" label="Detail" iconOnly={false} onClick={() => setSelectedSiswaNisn(nisn)} title="Lihat Detail Ketidakhadiran" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedSiswaNisn && (
                <HistorySiswaModal nisn={selectedSiswaNisn} onClose={() => setSelectedSiswaNisn(null)} />
            )}

            <style jsx>{`
                .gak__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 24px; color: var(--n-muted); }
                .gak__spinner { width: 36px; height: 36px; border: 3px solid var(--n-border); border-top-color: var(--n-primary); border-radius: 50%; animation: gakSpin 0.8s linear infinite; }
                @keyframes gakSpin { to { transform: rotate(360deg); } }

                .gak__wrap { display: flex; flex-direction: column; gap: 16px; animation: gakFadeIn 0.4s ease-out; }
                @keyframes gakFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .gak__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 20px; }
                .gak__empty-icon { width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: var(--n-primary); margin-bottom: 14px; }
                .gak__empty h3 { font-size: 1.05rem; font-weight: 800; color: var(--n-ink); margin: 0 0 6px; }
                .gak__empty p { font-size: 0.85rem; color: var(--n-muted); max-width: 380px; line-height: 1.5; margin: 0; }

                .gak__siswaList { display: flex; flex-direction: column; gap: 10px; }
                .gak__siswaCard { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 12px 18px; align-items: center; padding: 12px 18px; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); transition: all 0.2s; position: relative; }
                .gak__siswaCard:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); transform: translateY(-1px); border-color: #3083FF; }
                .gak__cardHadir { border-left: 5px solid #1d6bf3; }
                .gak__cardPending { border-left: 5px solid #10b981; }
                .gak__cardTidakHadir { border-left: 5px solid #f59e0b; }
                .gak__siswaAvatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; color: white; background: linear-gradient(135deg, #3083FF, #3b82f6); flex-shrink: 0; position: relative; overflow: hidden; }
                .gak__avatarImg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
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

                :global(.dark) .gak__empty { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 20px !important; }
                :global(.dark) .gak__empty-icon { background: rgba(26, 115, 232, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .gak__empty h3 { color: #ffffff !important; }
                :global(.dark) .gak__siswaCard { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gak__siswaNama { color: #ffffff !important; }
                :global(.dark) .gak__kelasChip { background: rgba(59,130,246,0.15) !important; color: #60a5fa !important; }

                @media (max-width: 640px) {
                    .gak__siswaCard { grid-template-columns: 36px 1fr; grid-template-rows: auto auto; gap: 6px 12px; padding: 12px 14px; }
                    .gak__siswaFooter { display: flex; grid-column: 2; justify-content: flex-start; align-items: center; gap: 8px; margin-top: 2px; }
                    .gak__siswaNama { font-weight: 600; font-size: 0.9rem; }
                    .gak__statusBadge { font-weight: 500; font-size: 0.72rem; padding: 4px 10px; }
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