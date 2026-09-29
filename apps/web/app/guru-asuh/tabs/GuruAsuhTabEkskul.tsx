'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { getActiveSettings } from '@/lib/settings-client';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';

import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { getProxiedImageUrl } from '@/lib/image-utils';

interface GuruAsuhTabProps { user?: any; }

interface SiswaEkskul {
    nisn: string;
    nama: string;
    kelas: string;
    foto_profil?: string | null;
    ekskul: { nama_ekskul: string }[];
}

export default function GuruAsuhTabEkskul({ user }: GuruAsuhTabProps) {
    const nip = user?.nip || user?.username || '';
    const isAdmin = user?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN') || user?.role === 'ADMIN';

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SiswaEkskul[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const ta = useTahunAjaranFilter();
    const activeTa = ta.selected;
    const [activeSem, setActiveSem] = useState('Ganjil');

    useEffect(() => {
        const init = async () => {
            const active = await getActiveSettings();
            setActiveSem(active?.semester || 'Ganjil');
        };
        init();
    }, []);

    const loadData = useCallback(async () => {
        if (!nip && !isAdmin) return;
        if (!activeTa) return;
        
        setLoading(true);
        try {
            let params = new URLSearchParams();
            params.append('nip', nip);
            params.append('isAdmin', isAdmin ? 'true' : 'false');
            params.append('tahun_ajaran', activeTa);
            params.append('semester', activeSem);
            
            const res = await fetch(`/api/guru-asuh/ekskul?${params.toString()}`);
            const result = await res.json();
            if (res.ok && !result.error) setData(result.data || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [nip, isAdmin, activeTa, activeSem]);

    useEffect(() => { if (activeTa) loadData(); }, [activeTa, activeSem, loadData]);

    const handleExport = async () => {
        if (!data || data.length === 0) return;
        const XLSX = await import('xlsx-js-style');
        const wb = XLSX.utils.book_new();

        // Sheet 1: Siswa
        const wsSiswa = XLSX.utils.aoa_to_sheet([]);
        const headerSiswa = [
            { v: 'NO', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "059669" } }, alignment: { horizontal: 'center', vertical: 'center' } } },
            { v: 'NISN', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "059669" } }, alignment: { horizontal: 'center', vertical: 'center' } } },
            { v: 'NAMA SISWA', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "059669" } }, alignment: { horizontal: 'center', vertical: 'center' } } },
            { v: 'NAMA EKSTRAKURIKULER', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "059669" } }, alignment: { horizontal: 'center', vertical: 'center' } } }
        ];
        XLSX.utils.sheet_add_aoa(wsSiswa, [headerSiswa], { origin: 'A1' });

        let rowIdx = 2; 
        const mergesSiswa: any[] = [];
        const sortedDataSiswa = [...data].sort((a, b) => a.nama.localeCompare(b.nama));
        
        let studentCounter = 1;
        sortedDataSiswa.forEach(s => {
            const sortedEkskul = [...s.ekskul].sort((a, b) => a.nama_ekskul.localeCompare(b.nama_ekskul));
            const ekskulList = sortedEkskul.length > 0 ? sortedEkskul.map(e => e.nama_ekskul) : ['-'];
            
            const startRow = rowIdx;
            ekskulList.forEach((ekName, i) => {
                const isFirst = i === 0;
                XLSX.utils.sheet_add_aoa(wsSiswa, [[
                    isFirst ? studentCounter : '',
                    isFirst ? s.nisn : '',
                    isFirst ? s.nama : '',
                    ekName
                ]], { origin: `A${rowIdx}` });
                rowIdx++;
            });
            if (ekskulList.length > 1) {
                mergesSiswa.push({ s: { r: startRow - 1, c: 0 }, e: { r: rowIdx - 2, c: 0 } });
                mergesSiswa.push({ s: { r: startRow - 1, c: 1 }, e: { r: rowIdx - 2, c: 1 } });
                mergesSiswa.push({ s: { r: startRow - 1, c: 2 }, e: { r: rowIdx - 2, c: 2 } });
            }
            studentCounter++;
        });
        
        const rangeSiswa = XLSX.utils.decode_range(wsSiswa['!ref'] || 'A1:D1');
        for (let R = rangeSiswa.s.r; R <= rangeSiswa.e.r; R++) {
            for (let C = rangeSiswa.s.c; C <= rangeSiswa.e.c; C++) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (!wsSiswa[cellRef]) wsSiswa[cellRef] = { v: '', t: 's' };
                if (!wsSiswa[cellRef].s) wsSiswa[cellRef].s = {};
                wsSiswa[cellRef].s.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                if (R > 0 && C < 3) wsSiswa[cellRef].s.alignment = { vertical: 'center' };
            }
        }
        
        if (mergesSiswa.length > 0) wsSiswa['!merges'] = mergesSiswa;
        wsSiswa['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 35 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsSiswa, "Siswa");

        // Sheet 2: Ekskul
        const wsEkskul = XLSX.utils.aoa_to_sheet([]);
        const headerEkskul = [
            { v: 'NO', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } }, alignment: { horizontal: 'center', vertical: 'center' } } },
            { v: 'NAMA EKSTRAKURIKULER', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } }, alignment: { horizontal: 'center', vertical: 'center' } } },
            { v: 'NAMA SISWA', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } }, alignment: { horizontal: 'center', vertical: 'center' } } },
            { v: 'NISN', t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } }, alignment: { horizontal: 'center', vertical: 'center' } } }
        ];
        XLSX.utils.sheet_add_aoa(wsEkskul, [headerEkskul], { origin: 'A1' });

        const ekskulMap = new Map<string, any[]>();
        data.forEach(s => {
            s.ekskul.forEach(e => {
                if (!ekskulMap.has(e.nama_ekskul)) ekskulMap.set(e.nama_ekskul, []);
                ekskulMap.get(e.nama_ekskul)!.push(s);
            });
        });
        const sortedEkskulNames = Array.from(ekskulMap.keys()).sort();

        let rowIdxEk = 2;
        const mergesEkskul: any[] = [];
        let ekCounter = 1;
        sortedEkskulNames.forEach(ekName => {
            const students = ekskulMap.get(ekName)!.sort((a, b) => a.nama.localeCompare(b.nama));
            const startRow = rowIdxEk;
            students.forEach((s, i) => {
                const isFirst = i === 0;
                XLSX.utils.sheet_add_aoa(wsEkskul, [[
                    isFirst ? ekCounter : '',
                    isFirst ? ekName : '',
                    s.nama,
                    s.nisn
                ]], { origin: `A${rowIdxEk}` });
                rowIdxEk++;
            });
            if (students.length > 1) {
                mergesEkskul.push({ s: { r: startRow - 1, c: 0 }, e: { r: rowIdxEk - 2, c: 0 } });
                mergesEkskul.push({ s: { r: startRow - 1, c: 1 }, e: { r: rowIdxEk - 2, c: 1 } });
            }
            ekCounter++;
        });

        const rangeEkskul = XLSX.utils.decode_range(wsEkskul['!ref'] || 'A1:D1');
        for (let R = rangeEkskul.s.r; R <= rangeEkskul.e.r; R++) {
            for (let C = rangeEkskul.s.c; C <= rangeEkskul.e.c; C++) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (!wsEkskul[cellRef]) wsEkskul[cellRef] = { v: '', t: 's' };
                if (!wsEkskul[cellRef].s) wsEkskul[cellRef].s = {};
                wsEkskul[cellRef].s.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                if (R > 0 && C < 2) wsEkskul[cellRef].s.alignment = { vertical: 'center' };
            }
        }

        if (mergesEkskul.length > 0) wsEkskul['!merges'] = mergesEkskul;
        wsEkskul['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 35 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsEkskul, "Ekskul");

        XLSX.writeFile(wb, `Data_Ekstrakurikuler_Anak_Asuh_${activeTa?.replace(/\//g, '-') || 'TA'}.xlsx`);
    };

    return (
        <div className="gae-wrap">
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
                <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama/NISN..." />
                <FilterActions>
                    <button className="ftb-btn ftb-btn--export ftb-btn-icon-mobile" onClick={handleExport} disabled={loading || data.length === 0} title="Export Excel">
                        <i className="bi bi-file-earmark-excel" /> <span className="hidden-mobile">Export Excel</span>
                    </button>
                </FilterActions>
            </FilterToolbar>

            <div className="gae-content">
                {loading ? (
                    <div className="gae-loading">
                        <Spinner variant="buble" size={18} />
                    </div>
                ) : (
                    <div className="gae-list">
                        {data.filter(s => {
                            if (!searchQuery) return true;
                            const q = searchQuery.toLowerCase();
                            return s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q);
                        }).map((s, idx) => (
                            <div key={s.nisn} className="gae-item">
                                <div className="gae-item-left">
                                    <div className="gae-item-avatar">
                                        {s.foto_profil && (
                                            <img
                                                src={getProxiedImageUrl(s.foto_profil)}
                                                alt={s.nama}
                                                className="gae-avatar-img"
                                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                            />
                                        )}
                                        <span>{s.nama.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div className="gae-item-info">
                                        <span className="gae-item-name">{s.nama}</span>
                                        <span className="gae-item-nisn">{s.nisn} • Kelas {s.kelas}</span>
                                    </div>
                                </div>
                                <div className="gae-item-right">
                                    {s.ekskul.length > 0 ? (
                                        <div className="gae-badges">
                                            {[...s.ekskul].sort((a, b) => a.nama_ekskul.localeCompare(b.nama_ekskul)).map((ek, eidx) => (
                                                <span key={eidx} className="gae-badge">
                                                    {eidx + 1}. {ek.nama_ekskul}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="gae-badge gae-badge-none">Belum ada ekskul</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {data.length === 0 && (
                            <div className="gae-empty">
                                <i className="bi bi-inbox" />
                                <p>Tidak ada data anak asuh.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .gae-wrap { display: flex; flex-direction: column; gap: 14px; }
                .gae-toolbar { display: flex; flex-direction: column; gap: 12px; padding: 0; background: transparent; border: none; }
                
                .gae-content { background: var(--n-card); border-radius: 16px; border: 1px solid var(--n-border); overflow: hidden; }
                .gae-list { display: flex; flex-direction: column; }
                
                .gae-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--n-border); transition: all 0.2s; }
                .gae-item:hover { background: var(--n-soft); }
                .gae-item-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
                .gae-item-avatar { width: 42px; height: 42px; border-radius: 12px; background: rgba(26, 115, 232, 0.08); border: 1px solid #1a73e8; color: #1a73e8; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 800; text-transform: uppercase; position: relative; overflow: hidden; flex-shrink: 0; }
                .gae-avatar-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
                .gae-item-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
                .gae-item-name { font-weight: 700; color: var(--n-ink); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .gae-item-nisn { font-size: 0.75rem; color: var(--n-muted); }
                
                .gae-item-right { display: flex; align-items: center; justify-content: flex-end; flex: 1; }
                .gae-badges { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
                .gae-badge { background: #d1fae5; color: #047857; padding: 6px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }
                .gae-badge-none { background: #f1f5f9; color: #64748b; font-weight: 600; border: 1px dashed #cbd5e1; }
                
                .gae-empty { text-align: center; padding: 40px; color: #64748b; display: flex; flex-direction: column; gap: 10px; align-items: center; }
                .gae-empty i { font-size: 2rem; opacity: 0.5; }
                
                .gae-loading { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 60px 20px; color: var(--n-muted); }
                .gae-spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Base (Mobile) */
                .gae-toolbar { display: flex; flex-direction: column; gap: 12px; }
                .gae-left-panel { display: flex; flex-direction: column; gap: 12px; }
                .gae-filters { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .gae-btn-export { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; background: #10b981; color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; height: 44px; grid-column: 1 / -1; }
                .gae-btn-export:hover:not(:disabled) { background: #059669; }
                .gae-btn-export:disabled { opacity: 0.5; cursor: not-allowed; }

                .gae-search { position: relative; display: flex; align-items: center; width: 100%; }
                .gae-search i { position: absolute; left: 12px; font-size: 0.9rem; color: var(--n-muted); }
                .gae-search input { width: 100%; min-height: 44px; padding: 0 12px 0 36px; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; font-size: 0.85rem; font-weight: 600; color: var(--n-ink); outline: none; transition: all 0.2s; }
                .gae-search input:focus { border-color: #3b82f6; }
                .gae-select-group { position: relative; display: flex; align-items: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; padding: 0 12px; gap: 8px; min-height: 44px; transition: all 0.2s; }
                .gae-select-group i { font-size: 0.9rem; color: var(--n-muted); }
                .gae-select-group select { flex: 1; border: none; background: transparent; padding: 12px 4px; font-size: 0.85rem; font-weight: 600; color: var(--n-ink); outline: none; -webkit-appearance: none; cursor: pointer; }
                .gae-select-group:hover, .gae-search input:hover { border-color: var(--n-muted); }

                @media (max-width: 639px) {
                    .gae-item { flex-direction: column; align-items: flex-start; gap: 12px; }
                    .gae-item-right { width: 100%; justify-content: flex-start; padding-left: 0; }
                    .gae-badges { justify-content: flex-start; }
                    .gae-item-avatar { display: none; }
                }

                /* Desktop - Small desktop (1024px+) */
                @media (min-width: 1024px) {
                    .gae-toolbar { flex-direction: row; align-items: center; justify-content: space-between; width: 100%; gap: 16px; padding: 0; }
                    .gae-left-panel { flex-direction: row; align-items: center; gap: 16px; flex: 1; margin-left: 12px; }
                    .gae-filters { display: contents; }
                    .gae-search { flex: 2; order: 5; }
                    .gae-select-group { flex: 1; min-width: 130px; }
                    .gae-btn-export { width: auto; order: 10; margin-left: auto; }
                }

                :global(.dark) .gae-content { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gae-item { border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .gae-item:hover { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .gae-item-avatar { background: rgba(26, 115, 232, 0.15) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gae-item-name { color: #ffffff !important; }
                :global(.dark) .gae-item-nisn { color: #94a3b8 !important; }
                :global(.dark) .gae-search input,
                :global(.dark) .gae-select-group { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; color: #ffffff !important; }
                :global(.dark) .gae-select-group i { color: #60a5fa !important; }
                :global(.dark) .gae-select-group select {
                    background-color: transparent !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2360a5fa' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 10px center !important;
                    padding-right: 28px !important;
                    border: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                    color: #ffffff !important;
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                }
            `}</style>
        </div>
    );
}
