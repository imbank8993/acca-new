'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Pagination from '@/components/ui/Pagination';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { Spinner } from '@/components/ui/Spinner';
import { DetailHeader, DetailHeaderSelect } from '@/components/ui/DetailHeader';
import { getSemesterFromDate, normalizeSemester } from '@/lib/date-utils';
import { isUserAdmin } from '@/lib/auth-client';

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

interface SiswaKelas {
    nisn: string;
    nama_siswa: string;
    kelas: string;
}

export default function WaliKelasTabNilai({ user }: { user?: any }) {
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<SiswaKelas[]>([]);
    const [myClass, setMyClass] = useState<string>('');
    const [allKelas, setAllKelas] = useState<string[]>([]);
    const isAdmin = isUserAdmin(user);

    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedNisn, setSelectedNisn] = useState<string>('');
    const [nilaiData, setNilaiData] = useState<GroupedData | null>(null);
    const [nilaiLoading, setNilaiLoading] = useState(false);
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('');
    const [selectedSemester, setSelectedSemester] = useState<string>(() =>
        String(getSemesterFromDate(new Date()))
    );
    const [availableTahunAjaran, setAvailableTahunAjaran] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Sinkronisasi semester aktif yang direkomendasikan dari pengaturan sistem
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { getRecommendedSettings } = await import('@/lib/settings-client');
                const rec = await getRecommendedSettings();
                if (!cancelled && rec?.semester) {
                    const norm = normalizeSemester(rec.semester);
                    setSelectedSemester(String(norm.num));
                }
            } catch {
                // Gunakan default berbasis tanggal
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Filter tahun ajaran: pilihan = tahun ajaran AKTIF, default sesuai tanggal hari ini
    const ta = useTahunAjaranFilter();

    const loadWaliInfo = useCallback(async () => {
        if (isAdmin) {
            try {
                const url = new URL('/api/wali-kelas/absensi-akumulasi', window.location.origin);
                url.searchParams.append('mode', 'kelas_list');
                if (ta.selected) url.searchParams.append('tahun_ajaran', ta.selected);

                const res = await fetch(url.toString());
                const json = await res.json();
                if (json.ok && json.kelas_list) {
                    const classes = json.kelas_list;
                    setAllKelas(classes);
                    if (classes.length > 0) {
                        setMyClass(prev => (!prev || !classes.includes(prev) ? classes[0] : prev));
                    } else {
                        setMyClass('');
                    }
                } else {
                    setAllKelas([]);
                    setMyClass('');
                }
            } catch (e) { console.error(e); setLoading(false); }
        } else {
            if (!user?.nip) return;
            try {
                // Kelas perwalian sesuai tahun ajaran terpilih; fallback tanpa filter tahun
                let waliRows: any[] | null = null;
                if (ta.selected) {
                    const res = await fetch(`/api/settings/wali-kelas?nip=${user.nip}&tahun_ajaran=${encodeURIComponent(ta.selected)}`);
                    const data = await res.json();
                    if (data.ok && data.data?.length > 0) waliRows = data.data;
                }
                if (waliRows && waliRows.length > 0) {
                    const waliClasses = Array.from(new Set(waliRows.map((w: any) => w.nama_kelas))) as string[];
                    setAllKelas(waliClasses);
                    setMyClass(prev => (!prev || !waliClasses.includes(prev) ? waliClasses[0] : prev));
                } else {
                    setAllKelas([]);
                    setMyClass('');
                }
            } catch (e) { console.error(e); setLoading(false); }
        }
    }, [user?.nip, isAdmin, ta.selected]);

    const loadStudents = useCallback(async (cls: string) => {
        setLoading(true);
        try {
            const taParam = ta.selected ? `&tahun_ajaran=${encodeURIComponent(ta.selected)}` : '';
            const res = await fetch(`/api/settings/siswa-kelas?kelas=${cls}${taParam}`);
            const json = await res.json();
            if (json.ok) {
                const rawData: SiswaKelas[] = json.data || [];
                const uniqueData = rawData.filter((v, i, a) => a.findIndex(t => t.nisn === v.nisn) === i);
                setStudents(uniqueData);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [ta.selected]);

    // Muat siswa saat kelas atau tahun ajaran berganti
    useEffect(() => {
        if (myClass) loadStudents(myClass);
    }, [myClass, loadStudents]);

    const fetchNilai = useCallback(async (nisn: string) => {
        setNilaiLoading(true);
        try {
            const res = await fetch(`/api/nilai/siswa?nisn=${encodeURIComponent(nisn)}`);
            const json = await res.json();
            if (json.ok) {
                setNilaiData(json.data);
                if (json.data?.grouped) {
                    const tahunList = Object.keys(json.data.grouped).sort((a: string, b: string) => b.localeCompare(a));
                    // Pastikan tahun ajaran yang sedang aktif tetap ada di pilihan
                    const availableYears = Array.from(new Set([...tahunList, ta.selected])).sort((a, b) => b.localeCompare(a));
                    setAvailableTahunAjaran(availableYears);
                    // Tetap gunakan tahun ajaran dari filter sebelumnya
                    setSelectedTahunAjaran(ta.selected);

                    // Jika tahun ajaran terpilih memiliki data tetapi semester yang aktif tidak memiliki nilai,
                    // beralih otomatis ke semester yang memiliki data
                    const yearData = json.data.grouped[ta.selected];
                    if (yearData) {
                        const availableSems = Object.keys(yearData);
                        setSelectedSemester(prev => (availableSems.length > 0 && !availableSems.includes(prev)) ? availableSems[0] : prev);
                    }
                }
            }
        } catch (e) { console.error(e); }
        finally { setNilaiLoading(false); }
    }, [ta.selected]);

    useEffect(() => { loadWaliInfo(); }, [loadWaliInfo]);

    const handleSelectSiswa = (s: SiswaKelas) => {
        setSelectedNisn(s.nisn);
        setView('detail');
        fetchNilai(s.nisn);
    };

    const handleBack = () => {
        setView('list');
        setSelectedNisn('');
        setNilaiData(null);
        setSearchQuery('');
        setCurrentPage(1);
    };

    const filteredStudents = useMemo(() => {
        if (!searchQuery) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(s => s.nisn.toLowerCase().includes(q) || s.nama_siswa.toLowerCase().includes(q));
    }, [students, searchQuery]);

    const totalPages = Math.ceil(filteredStudents.length / limit);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * limit;
        return filteredStudents.slice(start, start + limit);
    }, [filteredStudents, currentPage, limit]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery]);

    const currentItems = useMemo(() => {
        if (!nilaiData?.grouped || !selectedTahunAjaran || !selectedSemester) return nilaiData?.all || [];
        return nilaiData.grouped[selectedTahunAjaran]?.[selectedSemester] || [];
    }, [nilaiData, selectedTahunAjaran, selectedSemester]);

    const isEmptyResult = currentItems.length === 0 && nilaiData?.grouped && Object.keys(nilaiData.grouped).length > 0;
    const suggestedTA = Object.keys(nilaiData?.grouped || {}).filter(t => t !== selectedTahunAjaran);

    const groupedByMapel = useMemo(() => {
        const grouped: Record<string, NilaiItem[]> = {};
        const priority: Record<string, number> = {
            'PAS': 1, 'SUM': 2, 'TUGAS': 3, 'KUIS': 4, 'UH': 10,
        };

        currentItems.forEach(item => {
            if (!grouped[item.mapel]) grouped[item.mapel] = [];
            grouped[item.mapel].push(item);
        });

        Object.keys(grouped).forEach(mapel => {
            grouped[mapel].sort((a, b) => {
                const pA = priority[a.jenis] || 5;
                const pB = priority[b.jenis] || 5;
                if (pA !== pB) return pA - pB;
                return b.updated_at.localeCompare(a.updated_at);
            });
        });

        return grouped;
    }, [currentItems]);

    const mapelList = useMemo(() => Object.keys(groupedByMapel).sort(), [groupedByMapel]);
    const selectedSiswaInfo = useMemo(() => students.find(s => s.nisn === selectedNisn), [selectedNisn, students]);

    const stats = useMemo(() => {
        const validItems = currentItems.filter(i => i.nilai !== null);
        const avg = validItems.length > 0 ? validItems.reduce((sum, i) => sum + (i.nilai || 0), 0) / validItems.length : null;
        return { total: currentItems.length, mapel: mapelList.length, avg };
    }, [currentItems, mapelList]);

    const getNilaiColor = (nilai: number | null): string => {
        if (nilai === null) return 'gray';
        if (nilai >= 90) return 'emerald';
        if (nilai >= 80) return 'teal';
        if (nilai >= 70) return 'amber';
        if (nilai >= 60) return 'orange';
        return 'rose';
    };

    const parseSumInfo = (item: NilaiItem) => {
        const full = item.materi_tp || item.tagihan || '-';
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
            return a.jenis.localeCompare(b.jenis);
        });

        const rows: any[] = [];
        let i = 0;
        while (i < withInfo.length) {
            const currentSum = withInfo[i].info.sumGroup;
            if (currentSum !== '-') {
                let j = i;
                while (j < withInfo.length && withInfo[j].info.sumGroup === currentSum) j++;
                const count = j - i;
                for (let k = i; k < j; k++) rows.push({ ...withInfo[k], rowSpan: k === i ? count : 0 });
                i = j;
            } else {
                rows.push({ ...withInfo[i], rowSpan: 1 });
                i++;
            }
        }
        return rows;
    };

    // === LIST VIEW ===
    if (view === 'list') {
        return (
            <div className="wkn-wrap">
                {/* Toolbar */}
                <FilterToolbar>
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
                    {allKelas.length > 0 && (
                        <FilterSelect
                            label="Kelas"
                            icon="door-open"
                            value={myClass}
                            onChange={setMyClass}
                            options={allKelas.map(k => ({ value: k, label: k }))}
                        />
                    )}
                    <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama/NISN..." />
                </FilterToolbar>

                {/* Student List */}
                <div className="wkn-list">
                    {loading ? (
                        <div className="wkn-loading">
                            <Spinner variant="buble" size={28} />
                        </div>
                    ) : paginatedStudents.length === 0 ? (
                        <div className="wkn-empty">
                            <i className="bi bi-people" />
                            <p>Tidak ada siswa</p>
                        </div>
                    ) : paginatedStudents.map((s) => (
                        <button key={s.nisn} className="wkn-card" onClick={() => handleSelectSiswa(s)}>
                            <div className="wkn-avatar">{s.nama_siswa?.[0] || '?'}</div>
                            <div className="wkn-info">
                                <span className="wkn-name">{s.nama_siswa || 'Tanpa Nama'}</span>
                                <span className="wkn-nisn">{s.nisn}</span>
                            </div>
                            <i className="bi bi-chevron-right" />
                        </button>
                    ))}
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    limit={limit}
                    totalItems={filteredStudents.length}
                    onPageChange={setCurrentPage}
                    onLimitChange={setLimit}
                    itemLabel="siswa"
                />

                <style jsx>{`
                    .wkn-wrap {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }

                    /* Toolbar filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                    /* List */
                    .wkn-list {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    .wkn-card {
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 14px 16px;
                        background: var(--n-card);
                        border: 1.5px solid var(--n-border);
                        border-radius: 16px;
                        cursor: pointer;
                        transition: all 0.25s;
                        text-align: left;
                    }
                    .wkn-card:hover {
                        border-color: #3083FF;
                        box-shadow: 0 8px 24px rgba(99,102,241,0.15);
                        transform: translateY(-2px);
                    }
                    .wkn-card:active { transform: scale(0.98); }
                    .wkn-avatar {
                        width: 46px;
                        height: 46px;
                        border-radius: 12px;
                        background: linear-gradient(135deg, #3083FF, #3b82f6);
                        color: white;
                        font-size: 1.1rem;
                        font-weight: 800;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }
                    .wkn-info {
                        flex: 1;
                        min-width: 0;
                    }
                    .wkn-name {
                        display: block;
                        font-size: 0.9rem;
                        font-weight: 700;
                        color: var(--n-text);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .wkn-nisn {
                        display: block;
                        font-size: 0.68rem;
                        color: var(--n-muted);
                        margin-top: 2px;
                    }
                    .wkn-card > i {
                        font-size: 1.1rem;
                        color: #cbd5e1;
                        transition: all 0.2s;
                    }
                    .wkn-card:hover > i {
                        color: #3083FF;
                        transform: translateX(3px);
                    }

                    /* Loading & Empty */
                    .wkn-loading, .wkn-empty {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                        padding: 48px 20px;
                        color: var(--n-muted);
                    }
                    .wkn-spinner {
                        width: 28px;
                        height: 28px;
                        border: 3px solid #e2e8f0;
                        border-top-color: #3083FF;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .wkn-empty i { font-size: 2.5rem; color: #cbd5e1; }

                    /* Pagination */
                    .wkn-pagination {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        gap: 8px;
                    }
                    .wkn-pagination button {
                        width: 36px;
                        height: 36px;
                        border-radius: 10px;
                        border: 1.5px solid var(--n-border);
                        background: var(--n-card);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .wkn-pagination button:hover {
                        border-color: #3083FF;
                        color: #3083FF;
                        background: #eff6ff;
                    }
                    .wkn-pagination button:disabled {
                        opacity: 0.4;
                        cursor: not-allowed;
                    }
                    .wkn-pagination span {
                        font-size: 0.78rem;
                        color: var(--n-muted);
                        min-width: 50px;
                        text-align: center;
                        font-weight: 600;
                    }

                    /* Dark Mode */
                    :global(.dark) .wkn-card {
                        background: #000000 !important;
                        border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                        border-radius: 16px !important;
                    }
                    :global(.dark) .wkn-card:hover {
                        border-color: #60a5fa !important;
                        box-shadow: 0 0 16px rgba(29, 107, 243, 0.35) !important;
                    }
                    :global(.dark) .wkn-name { color: #ffffff !important; font-weight: 700; }
                    :global(.dark) .wkn-nisn { color: #94a3b8 !important; }
                    :global(.dark) .wkn-card > i { color: #60a5fa !important; }
                    :global(.dark) .wkn-avatar {
                        background: linear-gradient(135deg, #1d6bf3, #3083FF) !important;
                        color: #ffffff !important;
                    }
                    :global(.dark) .wkn-pagination button {
                        background: #000000 !important;
                        border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                        color: #60a5fa !important;
                    }
                `}</style>
            </div>
        );
    }

    // === DETAIL VIEW ===
    return (
        <div className="wkn-wrap">
            {/* Detail Header */}
            <DetailHeader
                onBack={handleBack}
                name={selectedSiswaInfo?.nama_siswa || 'Siswa'}
                meta={`NISN: ${selectedNisn} • ${myClass}`}
            >
                <DetailHeaderSelect
                    icon="mortarboard"
                    value={selectedTahunAjaran}
                    onChange={e => {
                        const newTA = e.target.value;
                        setSelectedTahunAjaran(newTA);
                        const yearData = nilaiData?.grouped?.[newTA];
                        if (yearData) {
                            const availableSems = Object.keys(yearData);
                            if (availableSems.length > 0 && !availableSems.includes(selectedSemester)) {
                                setSelectedSemester(availableSems[0]);
                            }
                        }
                    }}
                    title="Tahun Ajaran"
                >
                    {availableTahunAjaran.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </DetailHeaderSelect>
                <DetailHeaderSelect
                    icon="clock-history"
                    value={selectedSemester}
                    onChange={e => setSelectedSemester(e.target.value)}
                    title="Semester"
                >
                    <option value="1">Ganjil</option>
                    <option value="2">Genap</option>
                </DetailHeaderSelect>
            </DetailHeader>

            {nilaiLoading ? (
                <div className="wkn-loading">
                    <Spinner variant="buble" size={28} />
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="wkn-stats">
                        <div className="wkn-stat">
                            <span className="wkn-stat-val">{stats.total}</span>
                            <span className="wkn-stat-lbl">Total</span>
                        </div>
                        <div className="wkn-stat">
                            <span className="wkn-stat-val">{stats.mapel}</span>
                            <span className="wkn-stat-lbl">Mapel</span>
                        </div>
                        <div className="wkn-stat">
                            <span className="wkn-stat-val">{stats.avg !== null ? stats.avg.toFixed(1) : '-'}</span>
                            <span className="wkn-stat-lbl">Rata</span>
                        </div>
                    </div>

                    {/* Mapel List */}
                    {mapelList.length === 0 ? (
                        <div className="wkn-empty">
                            <i className="bi bi-clipboard-x" />
                            <p>Belum ada nilai</p>
                        </div>
                    ) : (
                        <div className="wkn-mapel-list">
                            {mapelList.map(mapel => {
                                const items = groupedByMapel[mapel];
                                const validNilai = items.filter(i => i.nilai !== null);
                                const avg = validNilai.length > 0 ? validNilai.reduce((sum, i) => sum + (i.nilai || 0), 0) / validNilai.length : null;
                                const tableRows = buildTableRows(items);

                                return (
                                    <div key={mapel} className="wkn-mapel">
                                        <div className="wkn-mapel-hdr">
                                            <span className="wkn-mapel-name"><i className="bi bi-book" />{mapel}</span>
                                            {avg !== null && (
                                                <span className={`wkn-mapel-avg avg-${getNilaiColor(avg)}`}>
                                                    {avg.toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="wkn-mapel-body">
                                            {tableRows.map((item, idx) => (
                                                <div key={item.id || idx} className="wkn-nilai-row">
                                                    {item.rowSpan > 0 && (
                                                        <div className="wkn-sum-cell">
                                                            <span className="wkn-sum-label">{item.info.sumGroup}</span>
                                                        </div>
                                                    )}
                                                    <div className="wkn-jenis-cell">
                                                        <span className={`wkn-jenis-badge jenis-${item.jenis}`}>
                                                            {item.jenis}
                                                        </span>
                                                    </div>
                                                    <div className="wkn-nilai-cell">
                                                        <span className={`wkn-nilai-badge nilai-${getNilaiColor(item.nilai)}`}>
                                                            {item.nilai !== null ? item.nilai : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <style jsx>{`
                .wkn-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                /* Detail Header */
                .wkn-detail-hdr {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px;
                    background: linear-gradient(135deg, #3083FF, #3b82f6);
                    border-radius: 16px;
                    box-shadow: 0 8px 24px rgba(99,102,241,0.25);
                }
                .wkn-back-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: none;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }
                .wkn-back-btn:hover { background: rgba(255,255,255,0.3); }
                .wkn-back-btn i { font-size: 1.2rem; }
                .wkn-student-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                }
                .wkn-student-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.25);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    font-weight: 800;
                    color: white;
                }
                .wkn-student-info h3 {
                    font-size: 0.95rem;
                    font-weight: 800;
                    color: white;
                    margin: 0;
                }
                .wkn-student-info p {
                    font-size: 0.68rem;
                    color: rgba(255,255,255,0.8);
                    margin: 2px 0 0;
                }

                /* Filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                /* Stats */
                .wkn-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
                .wkn-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 14px 10px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                }
                .wkn-stat-val {
                    font-size: 1.4rem;
                    font-weight: 900;
                    color: #3083FF;
                    letter-spacing: -0.02em;
                }
                .wkn-stat-lbl {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    margin-top: 2px;
                }

                /* Loading & Empty */
                .wkn-loading, .wkn-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 48px 20px;
                    color: var(--n-muted);
                }
                .wkn-spinner {
                    width: 28px;
                    height: 28px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #3083FF;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .wkn-empty i { font-size: 2.5rem; color: #cbd5e1; }

                /* Mapel List */
                .wkn-mapel-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .wkn-mapel {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    overflow: hidden;
                }
                .wkn-mapel-hdr {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 14px;
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                }
                .wkn-mapel-name {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    font-weight: 800;
                    color: var(--n-text);
                }
                .wkn-mapel-name i { color: #3083FF; }
                .wkn-mapel-avg {
                    padding: 4px 12px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 800;
                }
                .avg-emerald { background: #d1fae5; color: #065f46; }
                .avg-teal { background: #ccfbf1; color: #0f766e; }
                .avg-amber { background: #fef3c7; color: #92400e; }
                .avg-orange { background: #ffedd5; color: #9a3412; }
                .avg-rose { background: #ffe4e6; color: #9f1239; }
                .avg-gray { background: var(--n-soft); color: var(--n-muted); }

                /* Nilai Rows */
                .wkn-mapel-body {
                    display: flex;
                    flex-direction: column;
                }
                .wkn-nilai-row {
                    display: grid;
                    grid-template-columns: 80px 1fr 50px;
                    align-items: center;
                    padding: 10px 14px;
                    border-bottom: 1px solid var(--n-border);
                }
                .wkn-nilai-row:last-child { border-bottom: none; }
                .wkn-sum-cell {
                    background: var(--n-soft);
                    padding: 4px 8px;
                    border-radius: 6px;
                }
                .wkn-sum-label {
                    font-size: 0.72rem;
                    font-weight: 800;
                    color: var(--n-text);
                }
                .wkn-jenis-badge {
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 0.65rem;
                    font-weight: 800;
                }
                .jenis-PAS { background: #eff6ff; color: #1d4ed8; }
                .jenis-SUM { background: #ffe4e6; color: #be123c; }
                .jenis-TUGAS { background: #d1fae5; color: #065f46; }
                .jenis-KUIS { background: #fef3c7; color: #92400e; }
                .jenis-UH { background: #dbeafe; color: #1d4ed8; }
                .wkn-nilai-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    min-width: 40px;
                    text-align: center;
                }
                .nilai-emerald { background: #10b981; color: white; }
                .nilai-teal { background: #14b8a6; color: white; }
                .nilai-amber { background: #f59e0b; color: white; }
                .nilai-orange { background: #f97316; color: white; }
                .nilai-rose { background: #f43f5e; color: white; }
                .nilai-gray { background: var(--n-soft); color: var(--n-muted); }

                /* Dark Mode */
                :global(.dark) .wkn-detail-hdr {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: none !important;
                }
                :global(.dark) .wkn-back-btn {
                    background: rgba(26, 115, 232, 0.2) !important;
                    border: 1px solid rgba(26, 115, 232, 0.5) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .wkn-student-avatar {
                    background: linear-gradient(135deg, #1d6bf3, #3083FF) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .wkn-student-info h3 { color: #ffffff !important; }
                :global(.dark) .wkn-student-info p { color: #94a3b8 !important; }
                :global(.dark) .wkn-empty-info {
                    background: #000000 !important;
                    border: 1.8px solid rgba(245, 158, 11, 0.6) !important;
                    color: #fbbf24 !important;
                }
                :global(.dark) .wkn-empty-info b { color: #ffffff !important; }
                :global(.dark) .wkn-stat {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wkn-stat-val { color: #60a5fa !important; }
                :global(.dark) .wkn-mapel {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wkn-mapel-hdr {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .wkn-mapel-name { color: #ffffff !important; }
                :global(.dark) .wkn-nilai-row { border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .wkn-sum-cell { background: rgba(26, 115, 232, 0.15) !important; }
                :global(.dark) .wkn-sum-label { color: #ffffff !important; }
            `}</style>
        </div>
    );
}
