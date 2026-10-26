'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { getActiveSettings } from '@/lib/settings-client';
import { isUserAdmin } from '@/lib/auth-client';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import ReportPdfButton from '../components/ReportPdfButton';
import { loadEkskulReport } from '@/lib/wali-kelas-report-data';

interface WaliKelasTabProps { user?: any; }

interface SiswaEkskul {
    nisn: string;
    nama: string;
    kelas: string;
    ekskul: { nama_ekskul: string }[];
}

export default function WaliKelasTabEkskul({ user }: WaliKelasTabProps) {
    const nip = user?.nip || user?.username || '';
    const isAdmin = isUserAdmin(user);

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SiswaEkskul[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedKelas, setSelectedKelas] = useState<string>('');
    const [kelasList, setKelasList] = useState<string[]>([]);
    // Filter tahun ajaran: pilihan = tahun ajaran AKTIF, default sesuai tanggal hari ini
    const ta = useTahunAjaranFilter();
    const activeTa = ta.selected;
    // Semester disimpan apa adanya ('Ganjil'/'Genap'); route yang menormalkan ke angka.
    const [activeSem, setActiveSem] = useState('Ganjil');

    useEffect(() => {
        const init = async () => {
            const active = await getActiveSettings();
            setActiveSem(active?.semester || 'Ganjil');
        };
        init();
    }, []);

    const loadKelasList = useCallback(async () => {
        if (!nip && !isAdmin) return;
        try {
            const params = new URLSearchParams();
            params.append('nip', nip || '');
            params.append('mode', 'kelas_list');
            if (activeTa) params.append('tahun_ajaran', activeTa);
            const res = await fetch(`/api/wali-kelas/absensi-akumulasi?${params.toString()}`);
            const result = await res.json();
            if (result.ok && result.kelas_list) {
                const uniqueKelas = Array.from(new Set(result.kelas_list)) as string[];
                setKelasList(uniqueKelas);
                if (uniqueKelas.length > 0) {
                    if (!selectedKelas || !uniqueKelas.includes(selectedKelas)) {
                        setSelectedKelas(uniqueKelas[0]);
                    }
                } else {
                    setSelectedKelas('');
                }
            } else {
                setKelasList([]);
                setSelectedKelas('');
            }
        } catch (err) { console.error(err); }
    }, [nip, isAdmin, selectedKelas, activeTa]);

    const loadData = useCallback(async () => {
        if (!nip && !isAdmin) return;
        if (!selectedKelas || !activeTa) return;
        
        setLoading(true);
        try {
            let params = new URLSearchParams();
            params.append('kelas', selectedKelas);
            params.append('tahun_ajaran', activeTa);
            params.append('semester', activeSem);
            
            const res = await fetch(`/api/wali-kelas/ekskul?${params.toString()}`);
            const result = await res.json();
            if (res.ok && !result.error) setData(result.data || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [nip, isAdmin, selectedKelas, activeTa, activeSem]);

    useEffect(() => { loadKelasList(); }, [loadKelasList]);
    useEffect(() => { if (selectedKelas && activeTa) loadData(); }, [selectedKelas, activeTa, activeSem, loadData]);

    return (
        <div className="wke-wrap">
            {/* Toolbar Filters & Search */}
            <FilterToolbar actionsInline>
                {ta.years.length > 0 && (
                    <FilterSelect
                        label="Tahun Ajaran"
                        icon="mortarboard"
                        value={ta.selected}
                        onChange={ta.setSelected}
                        title="Tahun Ajaran (aktif)"
                        options={ta.years.map(y => ({ value: y, label: `TA ${y}` }))}
                    />
                )}
                <FilterSelect
                    label="Semester"
                    icon="clock-history"
                    value={activeSem}
                    onChange={setActiveSem}
                    options={[
                        { value: 'Semua', label: 'Semua' },
                        { value: 'Ganjil', label: 'Ganjil' },
                        { value: 'Genap', label: 'Genap' },
                    ]}
                />
                <FilterSelect
                    label="Kelas"
                    icon="door-open"
                    value={selectedKelas}
                    onChange={setSelectedKelas}
                    disabled={kelasList.length <= 1}
                    options={(kelasList.length > 0 ? kelasList : [selectedKelas]).map(k => ({ value: k, label: k }))}
                />
                <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama/NISN..." />
                <FilterActions>
                    <ReportPdfButton disabled={loading || !selectedKelas || !activeTa || !data.length}
                        filename={`Laporan_Ekstrakurikuler_${selectedKelas}_${activeTa}_${activeSem}`}
                        contextKey={JSON.stringify([selectedKelas, activeTa, activeSem, searchQuery])}
                        load={signal => loadEkskulReport({ kelas: selectedKelas, tahun: activeTa, semester: activeSem, query: searchQuery, wali: user?.nama }, signal)} />
                </FilterActions>
            </FilterToolbar>

            <div className="wke-content">
                {loading ? (
                    <div className="wke-loading">
                        <Spinner variant="buble" size={28} />
                    </div>
                ) : (
                    <div className="wke-list">
                        {data.filter(s => {
                            if (!searchQuery) return true;
                            const q = searchQuery.toLowerCase();
                            return s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q);
                        }).map((s, idx) => (
                            <div key={s.nisn} className="wke-item">
                                <div className="wke-item-left">
                                    <div className="wke-item-avatar">{s.nama.charAt(0).toUpperCase()}</div>
                                    <div className="wke-item-info">
                                        <span className="wke-item-name">{s.nama}</span>
                                        <span className="wke-item-nisn">{s.nisn}</span>
                                    </div>
                                </div>
                                <div className="wke-item-right">
                                    {s.ekskul.length > 0 ? (
                                        <div className="wke-badges">
                                            {[...s.ekskul].sort((a, b) => a.nama_ekskul.localeCompare(b.nama_ekskul)).map((ek, eidx) => (
                                                <span key={eidx} className="wke-badge">
                                                    {eidx + 1}. {ek.nama_ekskul}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="wke-badge wke-badge-none">Belum ada ekskul</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {data.length === 0 && (
                            <div className="wke-empty">
                                <i className="bi bi-inbox" />
                                <p>Tidak ada data siswa untuk kelas ini.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .wke-wrap { display: flex; flex-direction: column; gap: 14px; }
                /* Toolbar filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                .wke-loading { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 60px 20px; color: var(--n-muted); }
                .wke-spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                
                .wke-content { background: var(--n-card); border-radius: 16px; border: 1px solid var(--n-border); overflow: hidden; }
                
                .wke-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--n-border); transition: all 0.2s; }
                .wke-item:hover { background: var(--n-soft); }
                .wke-item-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
                .wke-item-num { width: 28px; height: 28px; border-radius: 8px; background: var(--n-soft); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: var(--n-muted); flex-shrink: 0; }
                .wke-item-avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #3083FF, #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 800; text-transform: uppercase; flex-shrink: 0; }
                .wke-item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
                .wke-item-name { font-weight: 700; color: var(--n-ink); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .wke-item-nisn { font-size: 0.75rem; color: var(--n-muted); }
                
                .wke-item-right { display: flex; align-items: center; justify-content: flex-end; flex: 1; }
                .wke-badges { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
                .wke-badge { background: #d1fae5; color: #047857; padding: 6px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }
                .wke-badge-none { background: #f1f5f9; color: #64748b; font-weight: 600; border: 1px dashed #cbd5e1; }
                
                .wke-empty { text-align: center; padding: 40px; color: #64748b; display: flex; flex-direction: column; gap: 10px; align-items: center; }
                .wke-empty i { font-size: 2rem; opacity: 0.5; }
                
                @media (max-width: 639px) {
                    .wke-item { flex-direction: column; align-items: flex-start; gap: 12px; }
                    .wke-item-right { width: 100%; justify-content: flex-start; padding-left: 0; }
                    .wke-badges { justify-content: flex-start; }
                    .wke-item-num { display: none; }
                    .wke-item-avatar { width: 32px; height: 32px; font-size: 0.8rem; border-radius: 8px; }
                }

                /* Dark Mode */
                :global(.dark) .wke-content {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    overflow: hidden !important;
                }
                :global(.dark) .wke-item {
                    border-bottom-color: rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .wke-item:hover { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .wke-item-avatar { background: linear-gradient(135deg, #1d6bf3, #3083FF) !important; color: #ffffff !important; }
                :global(.dark) .wke-item-name { color: #ffffff !important; }
                :global(.dark) .wke-item-num { background: rgba(26, 115, 232, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .wke-badge-none { background: rgba(148, 163, 184, 0.15) !important; color: #cbd5e1 !important; border-color: rgba(148, 163, 184, 0.3) !important; }
            `}</style>
        </div>
    );
}
