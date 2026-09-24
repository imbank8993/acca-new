'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import { DetailHeader, DetailHeaderSelect } from '@/components/ui/DetailHeader';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';

interface SiswaAsuh {
    nisn: string;
    nama: string;
    kelas: string;
    tahun_ajaran: string;
}

interface NilaiItem {
    id: string;
    nip: string;
    kelas: string;
    mapel: string;
    semester: number;
    tahun_ajaran: string;
    nisn: string;
    jenis: string;
    materi_tp: string;
    tagihan: string;
    nilai: number | null;
    catatan: string | null;
    updated_at: string;
    nama_guru: string;
    topik?: string | null;
}

interface GroupedData {
    siswa: { nisn: string; nama_lengkap: string; foto_profil: string | null } | null;
    kelas: any[];
    grouped: Record<string, Record<string, NilaiItem[]>>;
    all: NilaiItem[];
}

const ITEMS_PER_PAGE = 15;

export default function GuruAsuhTabPenilaian({ user }: { user?: any }) {
    const nip = user?.nip || user?.username || '';
    const ta = useTahunAjaranFilter();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        has_asuhan: boolean;
        guru_info: any;
        siswa_list: SiswaAsuh[];
        today: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedNisn, setSelectedNisn] = useState<string>('');
    const [selectedSiswa, setSelectedSiswa] = useState<SiswaAsuh | null>(null);
    const [nilaiData, setNilaiData] = useState<GroupedData | null>(null);
    const [nilaiLoading, setNilaiLoading] = useState(false);
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [availableTahunAjaran, setAvailableTahunAjaran] = useState<string[]>([]);
    const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const loadData = useCallback(async () => {
        if (!nip) { setLoading(false); setError('NIP guru tidak ditemukan.'); return; }
        try {
            const params = new URLSearchParams({ nip });
            if (ta.selected && ta.selected !== 'Semua') {
                params.set('tahun_ajaran', ta.selected);
            }
            const res = await fetch(`/api/ketidakhadiran/log/guru-asuh?${params.toString()}`);
            if (!res.ok) throw new Error('Gagal memuat data');
            const result = await res.json();
            setData(result);
            setError(null);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    }, [nip, ta.selected]);

    useEffect(() => { loadData(); }, [loadData]);

    const fetchNilai = useCallback(async (nisn: string) => {
        setNilaiLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('nisn', nisn);
            // Jangan filter oleh guruNip - guru asuh harus lihat semua nilai untuk siswa nya
            const res = await fetch(`/api/nilai/siswa?${params.toString()}`);
            const json = await res.json();
            if (json.ok && json.data) {
                setNilaiData(json.data);
                if (json.data?.grouped) {
                    const tahunList = Object.keys(json.data.grouped).sort((a: string, b: string) => b.localeCompare(a));
                    setAvailableTahunAjaran(tahunList);
                    if (tahunList.length > 0) {
                        const defaultTa = (ta.selected && tahunList.includes(ta.selected)) ? ta.selected : tahunList[0];
                        setSelectedTahunAjaran(defaultTa);
                        // Set semester based on available data
                        const semesters = Object.keys(json.data.grouped[defaultTa] || {}).sort();
                        setAvailableSemesters(semesters);
                        if (semesters.length > 0) setSelectedSemester(semesters[0]);
                    }
                }
            } else {
                console.log('[DEBUG] fetchNilai response:', json);
            }
        } catch (e) { console.error(e); }
        finally { setNilaiLoading(false); }
    }, [ta.selected]);

    const handleSelectSiswa = (s: SiswaAsuh) => {
        setSelectedNisn(s.nisn);
        setSelectedSiswa(s);
        setView('detail');
        fetchNilai(s.nisn);
    };

    const handleBack = () => {
        setView('list');
        setSelectedNisn('');
        setSelectedSiswa(null);
        setNilaiData(null);
        setSearchQuery('');
        setCurrentPage(1);
        setAvailableSemesters([]);
    };

    const filteredStudents = useMemo(() => {
        if (!data?.siswa_list) return [];
        if (!searchQuery) return data.siswa_list;
        const q = searchQuery.toLowerCase();
        return data.siswa_list.filter(s => s.nisn.toLowerCase().includes(q) || s.nama.toLowerCase().includes(q));
    }, [data?.siswa_list, searchQuery]);

    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredStudents, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery]);

    const currentItems = useMemo(() => {
        if (!nilaiData?.grouped || !selectedTahunAjaran || !selectedSemester) return nilaiData?.all || [];
        return nilaiData.grouped[selectedTahunAjaran]?.[selectedSemester] || [];
    }, [nilaiData, selectedTahunAjaran, selectedSemester]);

    const groupedByMapel = useMemo(() => {
        const grouped: Record<string, NilaiItem[]> = {};
        currentItems.forEach(item => {
            const key = item.mapel || 'Lainnya';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    }, [currentItems]);

    const formatDate = (dateStr: string): string => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getNilaiBadge = (nilai: number | null) => {
        if (nilai === null) return { cls: 'badge-none', label: '-' };
        if (nilai >= 90) return { cls: 'badge-blue', label: String(nilai) };
        if (nilai >= 80) return { cls: 'badge-blue-soft', label: String(nilai) };
        if (nilai >= 70) return { cls: 'badge-amber', label: String(nilai) };
        if (nilai >= 60) return { cls: 'badge-orange', label: String(nilai) };
        return { cls: 'badge-rose', label: String(nilai) };
    };

    const getJenisBadge = (jenis: string) => {
        const map: Record<string, string> = {
            'PAS': 'jbadge-blue',
            'UH': 'jbadge-blue',
            'TUGAS': 'jbadge-emerald',
            'KUIS': 'jbadge-amber',
            'SUM': 'jbadge-rose',
        };
        return map[jenis] || 'jbadge-slate';
    };

    const getJenisLabel = (jenis: string, tagihan?: string, materiTp?: string): string => {
        if (tagihan) {
            const m = tagihan.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (m) return `${m[1].toUpperCase()} ${m[2]}`;
        }
        if (materiTp) {
            const m = materiTp.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (m) return `${m[1].toUpperCase()} ${m[2]}`;
        }
        return jenis;
    };

    const getTopikDisplay = (item: NilaiItem): string => {
        const base = item.materi_tp || item.tagihan || '-';
        if (item.topik && item.topik !== '-' && item.topik.trim() !== '') {
            return `${base}: ${item.topik}`;
        }
        return base;
    };

    const parseSumInfo = (item: NilaiItem) => {
        const full = getTopikDisplay(item);
        const sumMatch = full.match(/^(SUM\s*\d+)(?:\s*[:\-]\s*(.*))?$/i);
        if (sumMatch) {
            return { sumGroup: sumMatch[1].toUpperCase(), actualTopic: (sumMatch[2] || '').trim() || '-', isSumType: true };
        }
        if (item.jenis === 'PAS' || full.toUpperCase().startsWith('PAS')) {
            return { sumGroup: 'PAS', actualTopic: '-', isSumType: true };
        }
        return { sumGroup: '-', actualTopic: full, isSumType: false };
    };

    const buildTableRows = (items: NilaiItem[]) => {
        const withInfo = items.map(i => ({ ...i, info: parseSumInfo(i) }));

        withInfo.sort((a, b) => {
            if (a.info.sumGroup !== b.info.sumGroup) {
                if (a.info.sumGroup === '-') return 1;
                if (b.info.sumGroup === '-') return -1;
                if (a.info.sumGroup === 'PAS' && b.info.sumGroup.startsWith('SUM')) return 1;
                if (a.info.sumGroup.startsWith('SUM') && b.info.sumGroup === 'PAS') return -1;
                return a.info.sumGroup.localeCompare(b.info.sumGroup);
            }
            const pri = (j: string) => j === 'SUM' || j === 'PAS' ? 0 : j === 'KUIS' ? 10 : j === 'TUGAS' ? 20 : j === 'UH' ? 100 : 50;
            const diff = pri(a.jenis) - pri(b.jenis);
            if (diff !== 0) return diff;
            return getJenisLabel(a.jenis, a.tagihan, a.materi_tp).localeCompare(getJenisLabel(b.jenis, b.tagihan, b.materi_tp), undefined, { numeric: true });
        });

        const rows: any[] = [];
        let i = 0;
        while (i < withInfo.length) {
            const currentSum = withInfo[i].info.sumGroup;
            if (currentSum !== '-') {
                let j = i;
                while (j < withInfo.length && withInfo[j].info.sumGroup === currentSum) j++;
                const count = j - i;
                const groupItems = withInfo.slice(i, j);
                let groupTopic = '-';
                const sumRow = groupItems.find(r => r.jenis === 'SUM' && r.info.actualTopic !== '-');
                if (sumRow) groupTopic = sumRow.info.actualTopic;
                else { const f = groupItems.find(r => r.info.actualTopic !== '-'); if (f) groupTopic = f.info.actualTopic; }
                for (let k = i; k < j; k++) rows.push({ ...withInfo[k], rowSpan: k === i ? count : 0, groupTopic });
                i = j;
            } else {
                rows.push({ ...withInfo[i], rowSpan: 1 });
                i++;
            }
        }
        return rows;
    };

    if (loading) return <PageLoader minHeight="300px" />;

    if (error) return (
        <div className="gan-loading">
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '2rem', color: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{error}</span>
        </div>
    );

    if (!data?.has_asuhan) return (
        <div className="gan-empty">
            <i className="bi bi-person-hearts" />
            <h3>Belum ada anak asuh</h3>
            <p>Klaim siswa sebagai anak asuh di tab "Klaim Anak Asuh" terlebih dahulu.</p>
        </div>
    );

    if (view === 'detail') {
        return (
            <div className="gan-detail">
                <DetailHeader
                    onBack={handleBack}
                    backLabel="Kembali ke Daftar Siswa"
                    name={selectedSiswa?.nama || '...'}
                    meta={`NISN: ${selectedNisn} - ${selectedSiswa?.kelas}`}
                >
                    <DetailHeaderSelect
                        icon="mortarboard"
                        value={selectedTahunAjaran}
                        onChange={e => {
                            setSelectedTahunAjaran(e.target.value);
                            const semesters = Object.keys(nilaiData?.grouped?.[e.target.value] || {}).sort();
                            setAvailableSemesters(semesters);
                            if (semesters.length > 0) setSelectedSemester(semesters[0]);
                        }}
                    >
                        {availableTahunAjaran.map(t => <option key={t} value={t}>{t}</option>)}
                    </DetailHeaderSelect>
                    <DetailHeaderSelect
                        icon="clock-history"
                        value={selectedSemester}
                        onChange={e => setSelectedSemester(e.target.value)}
                    >
                        {availableSemesters.map(s => {
                            const semVal = String(s);
                            const label = semVal === '1' ? 'Ganjil' : 'Genap';
                            return <option key={s} value={semVal}>{label}</option>;
                        })}
                    </DetailHeaderSelect>
                </DetailHeader>

                {nilaiLoading ? (
                    <PageLoader minHeight="240px" />
                ) : (
                    <div className="nilai-content">
                        {Object.keys(groupedByMapel).length === 0 ? (
                            <div className="empty-state">
                                <i className="bi bi-clipboard-check" />
                                <p>Belum ada data nilai pada periode ini</p>
                            </div>
                        ) : (
                            Object.entries(groupedByMapel).map(([mapelName, items]) => {
                                const validItems = items.filter(i => i.nilai !== null);
                                const avg = validItems.length > 0 ? validItems.reduce((sum, i) => sum + (i.nilai || 0), 0) / validItems.length : 0;
                                const tableRows = buildTableRows(items);
                                return (
                                    <div key={mapelName} className="mapel-section">
                                        <div className="mapel-header">
                                            <i className="bi bi-book" />
                                            <span className="mapel-name">{mapelName}</span>
                                            <span className={`avg-badge avg-badge--${avg >= 90 ? 'blue' : avg >= 80 ? 'blue-soft' : avg >= 70 ? 'amber' : avg >= 60 ? 'orange' : 'rose'}`}>{avg.toFixed(1)}</span>
                                        </div>
                                        <div className="nilai-table-wrap">
                                            <table className="nilai-table">
                                                <thead>
                                                    <tr>
                                                        <th className="th-sumatif">Sumatif</th>
                                                        <th>Jenis</th>
                                                        <th>Topik</th>
                                                        <th className="th-right">Nilai</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tableRows.map((item, idx) => {
                                                        const nilaiBadge = getNilaiBadge(item.nilai);
                                                        const jenisCls = getJenisBadge(item.jenis);
                                                        return (
                                                            <tr key={item.id || idx}>
                                                                {item.rowSpan > 0 && (
                                                                    <td className="td-sumatif" rowSpan={item.rowSpan}>
                                                                        <div className="sumatif-group">
                                                                            <span className="sumatif-name">
                                                                                {item.info.sumGroup === '-' ? '-' : item.info.sumGroup}
                                                                            </span>
                                                                            {item.info.sumGroup !== '-' && item.info.sumGroup !== 'PAS' && item.groupTopic !== '-' && (
                                                                                <span className="sumatif-topic">{item.groupTopic}</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                <td className="td-jenis">
                                                                    {item.info.sumGroup !== 'PAS' ? (
                                                                        <span className={`jenis-badge ${jenisCls}`}>
                                                                            {getJenisLabel(item.jenis, item.tagihan, item.materi_tp)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="td-muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="td-topik">
                                                                    {item.info.sumGroup !== 'PAS' ? item.info.actualTopic : '-'}
                                                                </td>
                                                                <td className="td-right">
                                                                    <span className={`nilai-badge ${nilaiBadge.cls}`}>{nilaiBadge.label}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                <style jsx>{`
                    .gan-detail { display: flex; flex-direction: column; gap: 20px; padding-bottom: 2rem; }
                    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; text-align: center; color: var(--n-muted); }
                    .empty-state i { font-size: 3rem; }
                    .nilai-content { display: flex; flex-direction: column; gap: 20px; }
                    .mapel-section { background: var(--n-card); border-radius: 16px; overflow: hidden; border: 1px solid var(--n-border); }
                    .mapel-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; background: var(--n-soft); border-bottom: 1px solid var(--n-border); }
                    .mapel-header i { color: #3083FF; }
                    .mapel-name { flex: 1; font-size: 0.95rem; font-weight: 800; color: var(--n-text); }
                    /* avg-badge colors */
                    .avg-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 800; }
                    .avg-badge--blue { background: #dbeafe; color: #1e40af; }
                    .avg-badge--blue-soft { background: #e0f2fe; color: #1d4ed8; }
                    .avg-badge--amber { background: #fef3c7; color: #92400e; }
                    .avg-badge--orange { background: #ffedd5; color: #9a3412; }
                    .avg-badge--rose { background: #ffe4e6; color: #9f1239; }
                    /* Table */
                    .nilai-table-wrap { overflow-x: auto; }
                    .nilai-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                    .nilai-table thead tr { background: var(--n-soft); }
                    .nilai-table th { padding: 10px 14px; text-align: left; font-weight: 700; color: var(--n-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid var(--n-border); white-space: nowrap; }
                    .th-sumatif { width: 140px; }
                    .th-right { text-align: right; }
                    .nilai-table tbody tr { border-bottom: 1px solid var(--n-border); transition: background 0.15s; }
                    .nilai-table tbody tr:hover { background: #fafbff; }
                    /* Hover dark mode: #fafbff bikin baris jadi putih & teks putih hilang.
                       Harus didefinisikan di blok ini karena style block tampilan daftar
                       tidak ikut ter-mount saat tampilan detail dirender. */
                    :global(.dark) .nilai-table tbody tr:hover,
                    :global(.dark) .nilai-table tbody tr:hover td { background: rgba(26, 115, 232, 0.12) !important; }
                    :global(.dark) .nilai-table tbody tr:hover .td-sumatif { background: rgba(26, 115, 232, 0.2) !important; }
                    .nilai-table td { padding: 10px 14px; color: var(--n-text); vertical-align: middle; }
                    /* SUMATIF column */
                    .td-sumatif { background: var(--n-soft); border-right: 1px solid #e2e8f0; vertical-align: middle; }
                    .sumatif-group { display: flex; flex-direction: column; gap: 2px; }
                    .sumatif-name { font-weight: 800; color: var(--n-text); font-size: 0.85rem; }
                    .sumatif-topic { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; line-height: 1.3; }
                    /* JENIS column */
                    .td-jenis { }
                    .jenis-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; }
                    .jbadge-blue { background: #eff6ff; color: #1d4ed8; }
                    .jbadge-blue { background: #dbeafe; color: #1d4ed8; }
                    .jbadge-emerald { background: #d1fae5; color: #065f46; }
                    .jbadge-amber { background: #fef3c7; color: #92400e; }
                    .jbadge-rose { background: #ffe4e6; color: #9f1239; }
                    .jbadge-slate { background: var(--n-soft); color: var(--n-muted); }
                    /* TOPIK column */
                    .td-topik { color: var(--n-muted); }
                    .td-muted { color: var(--n-muted); }
                    /* NILAI column */
                    .td-right { text-align: right; }
                    .nilai-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 800; min-width: 48px; text-align: center; }
                    .badge-blue { background: #1d4ed8; color: white; }
                    .badge-blue-soft { background: #3b82f6; color: white; }
                    .badge-amber { background: #f59e0b; color: white; }
                    .badge-orange { background: #f97316; color: white; }
                    .badge-rose { background: #f43f5e; color: white; }
                    .badge-none { background: var(--n-soft); color: var(--n-muted); }
                `}</style>
            </div>
        );
    }

    return (
        <div className="gan-wrap">
            <div className="gan-filters">
                {ta.years.length > 0 && (
                    <div className="gan-select-wrap">
                        <i className="bi bi-calendar3" />
                        <select
                            value={ta.selected}
                            onChange={e => ta.setSelected(e.target.value)}
                        >
                            <option value="Semua">Semua TA</option>
                            {ta.years.filter(opt => opt !== 'Semua').map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="search-wrap">
                    <i className="bi bi-search" />
                    <input type="text" placeholder="Cari nama / NISN..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    {searchQuery && <button className="clear-btn" onClick={() => setSearchQuery('')}><i className="bi bi-x" /></button>}
                </div>
                <div className="gan-count-badge">
                    {data?.siswa_list?.length || 0} anak asuh
                </div>
            </div>

            {filteredStudents.length === 0 ? (
                <div className="empty-state">
                    <i className="bi bi-people" />
                    <p>Tidak ada anak asuh</p>
                </div>
            ) : (
                <>
                    <div className="student-grid">
                        {paginatedStudents.map((siswa, idx) => (
                            <div key={`siswa-${idx}`} className="student-card" onClick={() => handleSelectSiswa(siswa)}>
                                <div className="card-avatar">{siswa.nama.charAt(0).toUpperCase()}</div>
                                <div className="card-info">
                                    <span className="card-name">{siswa.nama}</span>
                                    <span className="card-meta">{siswa.nisn} - {siswa.kelas}</span>
                                </div>
                                <i className="bi bi-chevron-right card-arrow" />
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                                <i className="bi bi-chevron-left" />
                            </button>
                            <span className="page-info">{currentPage} / {totalPages}</span>
                            <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                <i className="bi bi-chevron-right" />
                            </button>
                        </div>
                    )}
                </>
            )}

            <style jsx>{`
                .gan-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 24px; color: var(--n-muted); }
                .gan-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; text-align: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 24px; }
                .gan-empty i { font-size: 3rem; color: var(--n-primary); margin-bottom: 16px; }
                .gan-empty h3 { font-size: 1.2rem; font-weight: 800; color: var(--n-ink); margin: 0 0 8px; }
                .gan-empty p { font-size: 0.9rem; color: var(--n-muted); max-width: 360px; line-height: 1.5; margin: 0; }

                .gan-wrap { display: flex; flex-direction: column; gap: 20px; }

                .gan-filters { display: flex; align-items: stretch; gap: 12px; }
                .search-wrap { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 10px 14px; }
                .search-wrap i { color: var(--n-muted); font-size: 0.9rem; flex-shrink: 0; }
                .search-wrap input { flex: 1; min-width: 0; border: none; background: transparent; font-size: 0.85rem; color: var(--n-text); outline: none; }
                .search-wrap input::placeholder { color: #cbd5e1; }
                .clear-btn { border: none; background: none; color: var(--n-muted); cursor: pointer; padding: 0; font-size: 0.9rem; }
                .gan-count-badge { display: flex; align-items: center; font-size: 0.85rem; font-weight: 800; color: #3083FF; background: rgba(0, 56, 168, 0.05); padding: 0 16px; border-radius: 12px; white-space: nowrap; flex-shrink: 0; border: 1px solid rgba(0, 56, 168, 0.1); }

                .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; text-align: center; color: var(--n-muted); }
                .empty-state i { font-size: 3rem; }
                .student-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
                .student-card { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; cursor: pointer; transition: all 0.2s; }
                .student-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #3083FF; }
                .card-avatar { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #3083FF, #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 800; flex-shrink: 0; }
                .card-info { flex: 1; min-width: 0; }
                .card-name { display: block; font-size: 0.9rem; font-weight: 800; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .card-meta { font-size: 0.72rem; color: var(--n-muted); }
                .card-arrow { color: #cbd5e1; font-size: 1rem; }
                .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px; }
                .page-btn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .page-btn:hover:not(:disabled) { background: var(--n-soft); color: var(--n-text); }
                .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .page-info { font-size: 0.82rem; font-weight: 700; color: var(--n-muted); }
                .gan-select-wrap { display: flex; align-items: center; gap: 8px; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 0 12px; min-width: 140px; }
                .gan-select-wrap i { color: var(--n-muted); font-size: 0.9rem; flex-shrink: 0; }
                .gan-select-wrap select { border: none; background: transparent; color: var(--n-text); font-size: 0.85rem; font-weight: 600; outline: none; cursor: pointer; width: 100%; height: 100%; padding: 10px 0; }
                :global(.dark) .gan-select-wrap { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; }
                :global(.dark) .gan-select-wrap i { color: #60a5fa !important; }
                :global(.dark) .gan-select-wrap select { color: #ffffff !important; background: #000000 !important; }
                :global(.dark) .gan-select-wrap select option { background: #000000 !important; color: #ffffff !important; }
                :global(.dark) .student-card,
                :global(.dark) .mapel-section,
                :global(.dark) .search-wrap { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 12px !important; color: #ffffff !important; }
                :global(.dark) .search-wrap i { color: #60a5fa !important; }
                :global(.dark) .search-wrap input { background: transparent !important; border: none !important; color: #ffffff !important; }
                :global(.dark) .card-name,
                :global(.dark) .mapel-name { color: #ffffff !important; }
                :global(.dark) .card-meta { color: #94a3b8 !important; }
                :global(.dark) .mapel-header,
                :global(.dark) .nilai-table thead tr { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important; }
                :global(.dark) .nilai-table th { color: #94a3b8 !important; border-bottom-color: rgba(26, 115, 232, 0.4) !important; }
                :global(.dark) .nilai-table td { color: #ffffff !important; border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .td-sumatif { background: rgba(26, 115, 232, 0.1) !important; border-right-color: rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .sumatif-name { color: #ffffff !important; }
                :global(.dark) .sumatif-topic,
                :global(.dark) .td-topik,
                :global(.dark) .td-muted { color: #94a3b8 !important; }
                :global(.dark) .student-card:hover { background: rgba(26, 115, 232, 0.12) !important; }
                :global(.dark) .page-btn { background: #000000 !important; border: 1px solid rgba(26, 115, 232, 0.4) !important; color: #60a5fa !important; }
                :global(.dark) .gan-count-badge { background: rgba(96, 165, 250, 0.15) !important; border-color: rgba(96, 165, 250, 0.3) !important; color: #60a5fa !important; }
            `}</style>
        </div>
    );
}