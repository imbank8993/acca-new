'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Pagination from '@/components/ui/Pagination';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import FilterToolbar, { FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import ReportPdfButton from '../components/ReportPdfButton';
import { loadNilaiReport } from '@/lib/wali-kelas-report-data';
import { Spinner } from '@/components/ui/Spinner';
import DetailHeader from '@/components/ui/DetailHeader';
import { isUserAdmin } from '@/lib/auth-client';
import { getProxiedImageUrl } from '@/lib/image-utils';
import { getActiveTahunAjaranList, currentSemesterDefault } from '@/lib/tahun-ajaran-client';
import '@/app/nilai-siswa/nilai-siswa.css';

interface NilaiItem {
    sumber?: 'guru' | 'cbt';
    score_type?: string;
    grading_status?: string;
    periode_dari_tanggal?: boolean;
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
    kkm?: number;
}

interface ApresiasiItem {
    id: string;
    mapel: string;
    tahun_ajaran: string | null;
    semester: number | null;
    nama_guru: string | null;
    judul: string;
    topik: string | null;
    tanggal: string | null;
    poin_per_soal: number;
    jumlah_menang: number;
    total_poin: number;
    catatan: string | null;
}

interface GroupedData {
    cbt_linkage?: string;
    siswa: { nisn: string; nama_lengkap: string; foto_profil: string | null } | null;
    kelas: any[];
    grouped: Record<string, Record<string, NilaiItem[]>>;
    all: NilaiItem[];
}

interface SiswaKelas {
    nisn: string;
    nama_siswa: string;
    kelas: string;
    foto_profil?: string | null;
}

function CbtGrades({ items, getBadge }: { items: NilaiItem[]; getBadge: (nilai: number | null | undefined, kkm?: number) => { cls: string; label: string } }) {
    const scoreLabel = (item: NilaiItem) => item.score_type === 'classical' ? 'Klasikal'
        : item.score_type?.replace('_', ' ').toUpperCase() || '-';
    return (
        <>
            <div className="nilai-page__table-wrap">
                <table className="nilai-page__table nilai-page__cbt-table">
                    <thead>
                        <tr>
                            {['Nama Ujian', 'Pembuat', 'Jenis Nilai', 'Mapel', 'Nilai'].map((label, index) => (
                                <th key={label} className={`nilai-page__th${index === 4 ? ' nilai-page__th--right' : ''}`}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => {
                            const badge = getBadge(item.nilai, item.kkm);
                            return (
                                <tr key={item.id} className="nilai-page__tr">
                                    <td className="nilai-page__td">{item.materi_tp}</td>
                                    <td className="nilai-page__td nilai-page__td--muted">{item.nama_guru || '-'}</td>
                                    <td className="nilai-page__td"><span className="nilai-page__source-badge">{scoreLabel(item)}</span></td>
                                    <td className="nilai-page__td nilai-page__td--muted">{item.mapel}</td>
                                    <td className="nilai-page__td nilai-page__td--right">
                                        <span className={`nilai-page__nilai-badge ${badge.cls}`}>{badge.label}</span>
                                        {item.catatan && <small className="nilai-page__score-type">{item.catatan}</small>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="nilai-page__mobile-cards" style={{ gap: '10px' }}>
                {items.map(item => {
                    const badge = getBadge(item.nilai, item.kkm);
                    return (
                        <div key={item.id} className="nilai-page__mobile-card">
                            <div className="nilai-page__mobile-card-header">
                                <span className="nilai-page__source-badge">{scoreLabel(item)}</span>
                                <span className={`nilai-page__nilai-badge ${badge.cls}`}>{badge.label}</span>
                            </div>
                            <div className="nilai-page__mobile-card-topic">{item.materi_tp}</div>
                            <dl className="nilai-page__cbt-meta">
                                <div><dt>Pembuat</dt><dd>{item.nama_guru || '-'}</dd></div>
                                <div><dt>Mapel</dt><dd>{item.mapel}</dd></div>
                            </dl>
                            {item.catatan && <p className="nilai-page__score-type">{item.catatan}</p>}
                        </div>
                    );
                })}
            </div>
        </>
    );
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
    const [apresiasi, setApresiasi] = useState<ApresiasiItem[]>([]);
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('');
    const [selectedSemester, setSelectedSemester] = useState<string>('1');
    const [selectedMapel, setSelectedMapel] = useState('');
    const [selectedSumber, setSelectedSumber] = useState('all');
    const [availableTahunAjaran, setAvailableTahunAjaran] = useState<string[]>([]);
    const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
    const [kkmMap, setKkmMap] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const nilaiRequest = useRef(0);

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

    useEffect(() => {
        if (myClass) loadStudents(myClass);
    }, [myClass, loadStudents]);

    useEffect(() => { loadWaliInfo(); }, [loadWaliInfo]);

    const fetchNilai = useCallback(async (nisn: string) => {
        const requestId = ++nilaiRequest.current;
        setNilaiLoading(true);
        setNilaiData(null);
        setApresiasi([]);
        try {
            const res = await fetch(`/api/nilai/siswa?nisn=${encodeURIComponent(nisn)}`);
            const json = await res.json();
            if (requestId !== nilaiRequest.current) return;
            if (json.ok && json.data) {
                setNilaiData(json.data);

                // Ekstrak KKM konfigurasi guru jika ada
                const kkmDict: Record<string, number> = {};
                if (Array.isArray(json.bobot)) {
                    json.bobot.forEach((b: any) => {
                        const cfg = b.bobot_config;
                        if (b.mapel && cfg && typeof cfg.kkm === 'number' && cfg.kkm > 0) {
                            kkmDict[b.mapel] = Number(cfg.kkm);
                        }
                    });
                }
                if (Array.isArray(json.data?.all)) {
                    json.data.all.forEach((item: any) => {
                        if (item.mapel && item.kkm && !kkmDict[item.mapel]) {
                            kkmDict[item.mapel] = Number(item.kkm);
                        }
                    });
                }
                setKkmMap(kkmDict);

                if (json.data?.grouped) {
                    const activeYears = await getActiveTahunAjaranList();
                    if (requestId !== nilaiRequest.current) return;
                    const dataYears = Object.keys(json.data.grouped);
                    const tahunList = [...new Set<string>([...activeYears, ...dataYears, ta.selected])]
                        .filter(Boolean)
                        .sort((a, b) => b.localeCompare(a));
                    setAvailableTahunAjaran(tahunList);
                    if (tahunList.length > 0) {
                        const defaultTa = (ta.selected && tahunList.includes(ta.selected)) ? ta.selected : tahunList[0];
                        setSelectedTahunAjaran(defaultTa);
                    }
                }
            }

            try {
                const resApr = await fetch(`/api/nilai/siswa/apresiasi?nisn=${encodeURIComponent(nisn)}&tahun_ajaran=all`);
                const jsonApr = await resApr.json();
                if (requestId !== nilaiRequest.current) return;
                setApresiasi(jsonApr?.ok ? (jsonApr.data || []) : []);
            } catch {
                if (requestId === nilaiRequest.current) setApresiasi([]);
            }
        } catch (e) {
            if (requestId === nilaiRequest.current) console.error(e);
        } finally {
            if (requestId === nilaiRequest.current) setNilaiLoading(false);
        }
    }, [ta.selected]);

    const handleSelectSiswa = (s: SiswaKelas) => {
        setSelectedNisn(s.nisn);
        setSelectedSumber('all');
        setSelectedMapel('');
        setView('detail');
        fetchNilai(s.nisn);
    };

    const handleBack = () => {
        nilaiRequest.current++;
        setView('list');
        setSelectedNisn('');
        setNilaiData(null);
        setApresiasi([]);
        setSearchQuery('');
        setSelectedSumber('all');
        setSelectedMapel('');
        setAvailableSemesters([]);
        setKkmMap({});
        setCurrentPage(1);
    };

    useEffect(() => {
        if (nilaiData?.grouped && selectedTahunAjaran) {
            const allSemesters = ['1', '2'];
            const monthDefault = currentSemesterDefault();
            const withData = Object.keys(nilaiData.grouped[selectedTahunAjaran] || {});
            setAvailableSemesters([...new Set([...allSemesters, ...withData])]);
            setSelectedSemester(prev => {
                if (prev && (withData.includes(prev) || allSemesters.includes(prev))) return prev;
                return withData.includes(monthDefault) ? monthDefault : (withData[0] || monthDefault);
            });
        }
    }, [nilaiData, selectedTahunAjaran]);

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
        let items: NilaiItem[] = [];
        if (!nilaiData?.grouped || !selectedTahunAjaran || !selectedSemester) {
            items = nilaiData?.all || [];
        } else {
            items = nilaiData.grouped[selectedTahunAjaran]?.[selectedSemester] || [];
        }

        // Filter out empty PAS rows as requested by user
        return items.filter(i => {
            if (selectedSumber !== 'all' && (i.sumber || 'guru') !== selectedSumber) return false;
            if (i.jenis === 'PAS' && (i.nilai === null || i.nilai === undefined)) return false;
            return true;
        });
    }, [nilaiData, selectedTahunAjaran, selectedSemester, selectedSumber]);

    const currentApresiasi = useMemo(() => {
        const parsed = parseInt(selectedSemester);
        const semNum = isNaN(parsed) ? null : parsed;
        return apresiasi.filter(a => {
            if (selectedSumber === 'cbt') return false;
            if (selectedTahunAjaran && a.tahun_ajaran && a.tahun_ajaran !== selectedTahunAjaran) return false;
            if (semNum !== null && a.semester !== null && a.semester !== semNum) return false;
            if (selectedMapel && a.mapel && a.mapel !== selectedMapel) return false;
            return true;
        });
    }, [apresiasi, selectedTahunAjaran, selectedSemester, selectedMapel, selectedSumber]);

    const groupedByMapel = useMemo(() => {
        const grouped: Record<string, NilaiItem[]> = {};
        currentItems.forEach(item => {
            const key = item.mapel || 'Lainnya';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    }, [currentItems]);

    const availableMapel = useMemo(() => Object.keys(groupedByMapel).sort(), [groupedByMapel]);

    const displayedMapelList = useMemo(() => {
        if (!selectedMapel) return availableMapel;
        return availableMapel.filter(m => m === selectedMapel);
    }, [availableMapel, selectedMapel]);

    const displayedItems = useMemo(() => {
        if (!selectedMapel) return currentItems;
        return currentItems.filter(i => (i.mapel || 'Lainnya') === selectedMapel);
    }, [currentItems, selectedMapel]);

    useEffect(() => {
        if (selectedMapel && !availableMapel.includes(selectedMapel)) {
            setSelectedMapel('');
        }
    }, [availableMapel, selectedMapel]);

    const displayedGradeGroups = useMemo(() => {
        const groups = displayedMapelList.map(mapel => ({
            key: `guru:${mapel}`,
            title: mapel,
            isCbt: false,
            items: (groupedByMapel[mapel] || []).filter(item => item.sumber !== 'cbt'),
        })).filter(group => group.items.length > 0);
        const cbtItems = displayedItems.filter(item => item.sumber === 'cbt');
        if (cbtItems.length) groups.push({ key: 'cbt', title: 'Nilai ACCA-CBT', isCbt: true, items: cbtItems });
        return groups;
    }, [displayedMapelList, groupedByMapel, displayedItems]);

    const selectedSiswaInfo = useMemo(() => students.find(s => s.nisn === selectedNisn), [selectedNisn, students]);

    const regularKelas = useMemo(() => {
        const normalizeSem = (value: string | number | null) => {
            const normalized = String(value || '').trim().toLowerCase();
            return normalized === 'ganjil' ? '1' : normalized === 'genap' ? '2' : normalized;
        };
        const kelasFromData = [...new Set((nilaiData?.kelas || []).filter((item: any) =>
            (!selectedTahunAjaran || item.tahun_ajaran === selectedTahunAjaran) &&
            (!selectedSemester || normalizeSem(item.semester) === selectedSemester)
        ).map((item: any) => item.kelas).filter(Boolean))].join(', ');
        return kelasFromData || myClass || selectedSiswaInfo?.kelas || '-';
    }, [nilaiData?.kelas, selectedTahunAjaran, selectedSemester, myClass, selectedSiswaInfo?.kelas]);

    const stats = useMemo(() => {
        const validItems = displayedItems.filter(i => i.nilai !== null);
        const avg = validItems.length > 0
            ? validItems.reduce((sum, i) => sum + (i.nilai || 0), 0) / validItems.length
            : null;
        return {
            total: displayedItems.length,
            mapel: displayedMapelList.length,
            avg,
            kelas: regularKelas,
        };
    }, [displayedItems, displayedMapelList, regularKelas]);

    const formatNumber = (val: number | null | undefined): string => {
        if (val === null || val === undefined || isNaN(Number(val))) return '-';
        return Number(Number(val).toFixed(2)).toString();
    };

    const getSemesterLabel = (sem: string | number) => {
        const s = String(sem);
        if (s === '1') return 'Ganjil';
        if (s === '2') return 'Genap';
        if (s === '0' || s === 'Unknown') return 'Belum ditentukan';
        return s;
    };

    const getNilaiBadge = (nilai: number | null | undefined, kkm = 75) => {
        if (nilai === null || nilai === undefined) return { cls: 'nilai-page__nilai-badge--none', label: '-' };
        const num = Number(nilai);
        if (isNaN(num)) return { cls: 'nilai-page__nilai-badge--none', label: '-' };
        const val = Number(num.toFixed(2));
        const highThreshold = Math.max(kkm + 10, 85);
        const label = val.toString();
        if (val < kkm) return { cls: 'nilai-page__nilai-badge--merah', label };
        if (val < highThreshold) return { cls: 'nilai-page__nilai-badge--orange', label };
        return { cls: 'nilai-page__nilai-badge--biru', label };
    };

    const getAvgBadgeCls = (avg: number | null | undefined, kkm = 75) => {
        if (avg === null || avg === undefined) return 'nilai-page__avg-badge--none';
        const val = Number(avg);
        const highThreshold = Math.max(kkm + 10, 85);
        if (val < kkm) return 'nilai-page__avg-badge--merah';
        if (val < highThreshold) return 'nilai-page__avg-badge--orange';
        return 'nilai-page__avg-badge--biru';
    };

    const getJenisLabel = (jenis: string, tagihan?: string, materiTp?: string) => {
        if (tagihan) {
            const match = tagihan.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (match) return `${match[1].toUpperCase()} ${match[2]}`;
        }
        if (materiTp) {
            const match = materiTp.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (match) return `${match[1].toUpperCase()} ${match[2]}`;
        }
        return jenis;
    };

    const getTopikDisplay = (item: NilaiItem) => {
        const base = item.materi_tp || item.tagihan || '-';
        if (item.topik && item.topik !== '-' && item.topik.trim() !== '') {
            return `${base}: ${item.topik}`;
        }
        return base;
    };

    const parseSumInfo = (item: NilaiItem) => {
        if (item.sumber === 'cbt') return { sumGroup: '-', actualTopic: item.materi_tp, isSumType: false };
        const full = getTopikDisplay(item);

        const sumMatch = full.match(/^(SUM\s*\d+)(?:\s*[:\-]\s*(.*))?$/i);
        if (sumMatch) {
            return {
                sumGroup: sumMatch[1].toUpperCase(),
                actualTopic: (sumMatch[2] || '').trim() || '-',
                isSumType: true
            };
        }

        if (item.jenis === 'PAS' || full.toUpperCase().startsWith('PAS')) {
            return {
                sumGroup: 'PAS',
                actualTopic: '-',
                isSumType: true
            };
        }

        return {
            sumGroup: '-',
            actualTopic: full,
            isSumType: false
        };
    };

    // === LIST VIEW ===
    if (view === 'list') {
        return (
            <div className="wkn-wrap">
                {/* Toolbar */}
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
                    {allKelas.length > 0 && (
                        <FilterSelect
                            label="Kelas"
                            icon="door-open"
                            value={myClass}
                            onChange={setMyClass}
                            options={allKelas.map(k => ({ value: k, label: k }))}
                        />
                    )}
                    <FilterSelect label="Semester" icon="clock-history" value={selectedSemester} onChange={setSelectedSemester}
                        options={[{ value: '1', label: 'Ganjil' }, { value: '2', label: 'Genap' }]} />
                    <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama/NISN..." />
                    <FilterActions>
                        <ReportPdfButton disabled={loading || !myClass || !ta.selected || !students.length}
                            filename={`Laporan_Nilai_${myClass}_${ta.selected}_${selectedSemester}`}
                            contextKey={JSON.stringify([myClass, ta.selected, selectedSemester, searchQuery])}
                            load={signal => loadNilaiReport({ kelas: myClass, tahun: ta.selected, semester: selectedSemester, query: searchQuery, wali: user?.nama }, signal)} />
                    </FilterActions>
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
                    .wkn-empty i { font-size: 2.5rem; color: #cbd5e1; }

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
                `}</style>
            </div>
        );
    }

    // === DETAIL VIEW ===
    const studentPhoto = (nilaiData?.siswa as any)?.foto_profil || selectedSiswaInfo?.foto_profil;
    return (
        <div className="nilai-page">
            <div className="nilai-page__inner">
                <DetailHeader
                    onBack={handleBack}
                    backLabel="Kembali ke Daftar Siswa"
                    name={selectedSiswaInfo?.nama_siswa || nilaiData?.siswa?.nama_lengkap || 'Siswa'}
                    meta={`NISN ${selectedNisn}${regularKelas !== '-' ? ` - ${regularKelas}` : ''}`}
                    avatarSrc={studentPhoto ? getProxiedImageUrl(studentPhoto) : undefined}
                />

                {nilaiLoading ? (
                    <div className="nilai-page__spinner" style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
                        <Spinner variant="buble" size={32} />
                    </div>
                ) : (
                    <div className="nilai-page__content">
                        {/* Filters Toolbar */}
                        <FilterToolbar className="nilai-page__filter-toolbar" actionsInline>
                            <FilterSelect
                                label="Sumber Nilai"
                                icon="funnel"
                                value={selectedSumber}
                                onChange={setSelectedSumber}
                                options={[
                                    { value: 'all', label: 'Semua Sumber' },
                                    { value: 'guru', label: 'Input Guru' },
                                    { value: 'cbt', label: 'CBT' },
                                ]}
                            />
                            {availableTahunAjaran.length > 0 && (
                                <FilterSelect
                                    label="Tahun Ajaran"
                                    icon="mortarboard"
                                    value={selectedTahunAjaran}
                                    onChange={setSelectedTahunAjaran}
                                    options={availableTahunAjaran.map((t) => ({ value: t, label: t }))}
                                />
                            )}
                            {availableSemesters.length > 0 && (
                                <FilterSelect
                                    label="Semester"
                                    icon="journal-bookmark"
                                    value={selectedSemester}
                                    onChange={setSelectedSemester}
                                    options={availableSemesters.map((sem) => ({ value: sem, label: getSemesterLabel(sem) }))}
                                />
                            )}
                            {availableMapel.length > 0 && (
                                <FilterSelect
                                    label="Mapel"
                                    icon="book"
                                    value={selectedMapel}
                                    onChange={setSelectedMapel}
                                    options={[
                                        { value: '', label: 'Semua Mapel' },
                                        ...availableMapel.map((m) => ({ value: m, label: m }))
                                    ]}
                                />
                            )}
                            <FilterActions>
                                <ReportPdfButton disabled={nilaiLoading || !nilaiData || !selectedTahunAjaran || !selectedSemester}
                                    filename={`Laporan_Nilai_${selectedNisn}_${selectedTahunAjaran}_${selectedSemester}`}
                                    contextKey={JSON.stringify([selectedNisn, selectedTahunAjaran, selectedSemester, selectedMapel, selectedSumber])}
                                    load={signal => loadNilaiReport({ kelas: regularKelas, tahun: selectedTahunAjaran, semester: selectedSemester,
                                        mapel: selectedMapel, sumber: selectedSumber, wali: user?.nama,
                                        student: { nisn: selectedNisn, nama: selectedSiswaInfo?.nama_siswa || nilaiData?.siswa?.nama_lengkap || 'Siswa' } }, signal)} />
                            </FilterActions>
                        </FilterToolbar>

                        {selectedSumber !== 'guru' && nilaiData?.cbt_linkage === 'ambiguous' && (
                            <p className="nilai-page__source-note" role="status">Akun CBT belum dapat dicocokkan secara pasti. Hubungi administrator untuk memeriksa identitas akun.</p>
                        )}
                        {selectedSumber !== 'guru' && nilaiData?.cbt_linkage === 'unlinked' && (
                            <p className="nilai-page__source-note" role="status">Belum ditemukan akun CBT yang terhubung dengan siswa ini.</p>
                        )}

                        {/* Stats Cards */}
                        <div className="nilai-page__stats-grid">
                            {[
                                { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Total Nilai', value: stats.total },
                                { icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Mapel', value: stats.mapel },
                                { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Rata-rata', value: formatNumber(stats.avg) },
                                { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', bg: 'nilai-page__stat--blue', color: 'nilai-page__stat-color--blue', label: 'Kelas', value: stats.kelas },
                            ].map((stat, idx) => (
                                <div key={idx} className="nilai-page__stat-card">
                                    <div className={`nilai-page__stat-icon ${stat.bg}`}>
                                        <svg className={`nilai-page__stat-svg ${stat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                                        </svg>
                                    </div>
                                    <div className="nilai-page__stat-body">
                                        <p className="nilai-page__stat-label">{stat.label}</p>
                                        <p className={`nilai-page__stat-value${stat.label === 'Kelas' ? ' nilai-page__stat-value--kelas' : ''}`}>{stat.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Grades */}
                        {displayedGradeGroups.length === 0 ? (
                            <div className="nilai-page__card nilai-page__empty-state" style={{ padding: '48px', textAlign: 'center' }}>
                                <h3 className="nilai-page__empty-title">Belum ada data nilai pada periode ini</h3>
                            </div>
                        ) : (
                            <div className="nilai-page__mapel-list">
                                {displayedGradeGroups.map(({ key, title: mapel, items, isCbt }) => {
                                    const itemsWithInfo = items.map(i => ({
                                        ...i,
                                        info: parseSumInfo(i)
                                    }));

                                    itemsWithInfo.sort((a, b) => {
                                        if (a.info.sumGroup !== b.info.sumGroup) {
                                            if (a.info.sumGroup === '-') return 1;
                                            if (b.info.sumGroup === '-') return -1;
                                            if (a.info.sumGroup === 'PAS' && b.info.sumGroup.startsWith('SUM')) return 1;
                                            if (a.info.sumGroup.startsWith('SUM') && b.info.sumGroup === 'PAS') return -1;
                                            return a.info.sumGroup.localeCompare(b.info.sumGroup);
                                        }
                                        const getPriority = (j: string) => {
                                            if (j === 'SUM' || j === 'PAS') return 0;
                                            if (j === 'UH') return 100;
                                            if (j === 'KUIS') return 10;
                                            if (j === 'TUGAS') return 20;
                                            return 50;
                                        };
                                        const priA = getPriority(a.jenis);
                                        const priB = getPriority(b.jenis);
                                        if (priA !== priB) return priA - priB;
                                        const labelA = getJenisLabel(a.jenis, a.tagihan, a.materi_tp);
                                        const labelB = getJenisLabel(b.jenis, b.tagihan, b.materi_tp);
                                        return labelA.localeCompare(labelB, undefined, { numeric: true });
                                    });

                                    const tableRows: any[] = [];
                                    let i = 0;
                                    while (i < itemsWithInfo.length) {
                                        const currentSum = itemsWithInfo[i].info.sumGroup;
                                        if (currentSum !== '-') {
                                            let j = i;
                                            while (j < itemsWithInfo.length && itemsWithInfo[j].info.sumGroup === currentSum) j++;
                                            const count = j - i;
                                            let groupTopic = '-';
                                            const groupItems = itemsWithInfo.slice(i, j);
                                            const sumAssessmentRow = groupItems.find(item => item.jenis === 'SUM' && item.info.actualTopic !== '-');
                                            if (sumAssessmentRow) {
                                                groupTopic = sumAssessmentRow.info.actualTopic;
                                            } else {
                                                const firstTopicRow = groupItems.find(item => item.info.actualTopic !== '-');
                                                if (firstTopicRow) groupTopic = firstTopicRow.info.actualTopic;
                                            }

                                            for (let k = i; k < j; k++) {
                                                tableRows.push({
                                                    ...itemsWithInfo[k],
                                                    rowSpan: k === i ? count : 0,
                                                    groupTopic
                                                });
                                            }
                                            i = j;
                                        } else {
                                            tableRows.push({
                                                ...itemsWithInfo[i],
                                                rowSpan: 1
                                            });
                                            i++;
                                        }
                                    }

                                    const mapelKkm = items.find(i => i.kkm)?.kkm || kkmMap[mapel] || 75;
                                    const avg = items.filter(i => i.nilai !== null).length > 0
                                        ? items.reduce((sum, i) => sum + (i.nilai || 0), 0) / items.filter(i => i.nilai !== null).length
                                        : null;

                                    return (
                                        <div key={key} className="nilai-page__mapel-card">
                                            <div className="nilai-page__mapel-header">
                                                <div className="nilai-page__mapel-header-left">
                                                    <div className="nilai-page__mapel-icon">
                                                        <svg className="nilai-page__mapel-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                        </svg>
                                                    </div>
                                                    <div className="nilai-page__mapel-info">
                                                        <h3 className="nilai-page__mapel-title" style={{ fontWeight: 500 }}>{mapel}</h3>
                                                        {!isCbt && <p className="nilai-page__mapel-guru" style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: '2px', fontWeight: 500 }}>{Array.from(new Set(items.map(i => i.nama_guru).filter(Boolean))).join(', ')}</p>}
                                                    </div>
                                                </div>
                                                {avg !== null && (
                                                    <div className={`nilai-page__avg-badge ${getAvgBadgeCls(avg, mapelKkm)}`}>
                                                        <svg className="nilai-page__avg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                        </svg>
                                                        {formatNumber(avg)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="nilai-page__mapel-body">
                                                {isCbt ? (
                                                    <CbtGrades items={items} getBadge={getNilaiBadge} />
                                                ) : (
                                                    <>
                                                        {/* Desktop Table */}
                                                        <div className="nilai-page__table-wrap">
                                                            <table className="nilai-page__table">
                                                                <thead>
                                                                    <tr>
                                                                        <th className="nilai-page__th">Sumatif</th>
                                                                        <th className="nilai-page__th">Jenis</th>
                                                                        <th className="nilai-page__th">Topik</th>
                                                                        <th className="nilai-page__th nilai-page__th--right">Nilai</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {tableRows.map((item, idx) => {
                                                                        const itemKkm = item.kkm || mapelKkm;
                                                                        const nilai = getNilaiBadge(item.nilai, itemKkm);
                                                                        return (
                                                                            <tr key={item.id || idx} className="nilai-page__tr">
                                                                                {item.rowSpan > 0 && (
                                                                                    <td className="nilai-page__td nilai-page__td--sumatif" rowSpan={item.rowSpan}>
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                            <span style={{ fontWeight: '800', fontSize: '0.875rem' }}>
                                                                                                {item.info.sumGroup === '-' ? '-' : item.info.sumGroup}
                                                                                            </span>
                                                                                            {item.info.sumGroup !== '-' && item.info.sumGroup !== 'PAS' && item.groupTopic !== '-' && (
                                                                                                <span style={{ fontSize: '0.75rem', fontWeight: '500', opacity: 0.75, lineHeight: '1.2' }}>
                                                                                                    {item.groupTopic}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                )}
                                                                                <td className="nilai-page__td">
                                                                                    {item.info.sumGroup !== 'PAS' ? (
                                                                                        <span className={`nilai-page__jenis-badge nilai-page__jenis-badge--${item.jenis.toLowerCase()}`}>{getJenisLabel(item.jenis, item.tagihan, item.materi_tp)}</span>
                                                                                    ) : (
                                                                                        <span className="nilai-page__td--muted">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="nilai-page__td nilai-page__td--muted">
                                                                                    {item.info.sumGroup !== 'PAS' ? item.info.actualTopic : '-'}
                                                                                </td>
                                                                                <td className="nilai-page__td nilai-page__td--right">
                                                                                    <span className={`nilai-page__nilai-badge ${nilai.cls}`}>{nilai.label}</span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Mobile Cards */}
                                                        <div className="nilai-page__mobile-cards" style={{ gap: '10px' }}>
                                                            {tableRows.map((item, idx) => {
                                                                const itemKkm = item.kkm || mapelKkm;
                                                                const nilai = getNilaiBadge(item.nilai, itemKkm);
                                                                const isSumGroup = item.info.sumGroup !== '-' && item.info.sumGroup !== 'PAS';

                                                                return (
                                                                    <div key={(item.id || idx) + '_mobile_container'}>
                                                                        {isSumGroup && item.rowSpan > 0 && (
                                                                            <div style={{
                                                                                marginBottom: '10px',
                                                                                padding: '6px 4px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '10px',
                                                                                borderBottom: '2px solid #3b82f6',
                                                                                marginTop: idx > 0 ? '16px' : '0'
                                                                            }}>
                                                                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--n-primary)', background: 'rgba(59, 130, 246, 0.14)', padding: '2px 10px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                                    {item.info.sumGroup}
                                                                                </span>
                                                                                {item.groupTopic && item.groupTopic !== '-' && (
                                                                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--n-text)' }}>
                                                                                        {item.groupTopic}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        <div className="nilai-page__mobile-card" style={{
                                                                            borderLeft: isSumGroup ? '4px solid #3b82f6' : '1px solid var(--n-border)',
                                                                            paddingLeft: isSumGroup ? '12px' : '16px'
                                                                        }}>
                                                                            <div className="nilai-page__mobile-card-header">
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                    <span className="nilai-page__source-badge">Input Guru</span>
                                                                                    {item.info.sumGroup === 'PAS' && (
                                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--n-primary)', background: 'rgba(59, 130, 246, 0.14)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                                            Penilaian Akhir Semester (PAS)
                                                                                        </span>
                                                                                    )}
                                                                                    {item.info.sumGroup !== 'PAS' && (
                                                                                        <span className={`nilai-page__jenis-badge nilai-page__jenis-badge--${item.jenis.toLowerCase()}`} style={{ width: 'fit-content' }}>
                                                                                            {getJenisLabel(item.jenis, item.tagihan, item.materi_tp)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <span className={`nilai-page__nilai-badge ${nilai.cls}`}>
                                                                                    {nilai.label}
                                                                                </span>
                                                                            </div>

                                                                            {item.info.sumGroup !== 'PAS' && (
                                                                                <div className="nilai-page__mobile-card-topic" style={{ margin: 0 }}>
                                                                                    {item.info.actualTopic !== '-' ? item.info.actualTopic : <span style={{ color: 'var(--n-muted)', fontWeight: 400 }}>Tidak ada topik</span>}
                                                                                </div>
                                                                            )}

                                                                            {item.catatan && (
                                                                                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--n-border)', fontSize: '0.72rem', color: 'var(--n-muted)', fontStyle: 'italic', display: 'flex', gap: '6px' }}>
                                                                                    <svg style={{ width: '12px', height: '12px', marginTop: '1px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                                                    </svg>
                                                                                    <span>&ldquo;{item.catatan}&rdquo;</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Nilai Apresiasi */}
                        {currentApresiasi.length > 0 && (() => {
                            const totalApresiasiPoin = Number(currentApresiasi.reduce((sum, a) => sum + Number(a.total_poin || 0), 0).toFixed(2));
                            return (
                                <div className="nilai-page__mapel-card">
                                    <div className="nilai-page__mapel-header">
                                        <div className="nilai-page__mapel-header-left">
                                            <div className="nilai-page__mapel-icon">
                                                <svg className="nilai-page__mapel-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                            </div>
                                            <div className="nilai-page__mapel-info">
                                                <h3 className="nilai-page__mapel-title">Nilai Apresiasi</h3>
                                                <p className="nilai-page__mapel-guru" style={{ fontSize: '0.85rem', color: 'var(--n-muted)', marginTop: '2px', fontWeight: 500 }}>
                                                    Poin Kuis Rebutan (Cepat Tepat)
                                                </p>
                                            </div>
                                        </div>
                                        <div className="nilai-page__avg-badge">
                                            <svg className="nilai-page__avg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            +{formatNumber(totalApresiasiPoin)}
                                        </div>
                                    </div>
                                    <div className="nilai-page__mapel-body">
                                        <div className="nilai-page__table-wrap">
                                            <table className="nilai-page__table">
                                                <thead>
                                                    <tr>
                                                        <th className="nilai-page__th">Sumatif / Mapel</th>
                                                        <th className="nilai-page__th">Jenis</th>
                                                        <th className="nilai-page__th">Topik</th>
                                                        <th className="nilai-page__th nilai-page__th--right">Nilai / Poin</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentApresiasi.map((a) => (
                                                        <tr key={a.id} className="nilai-page__tr">
                                                            <td className="nilai-page__td nilai-page__td--sumatif">{a.mapel}</td>
                                                            <td className="nilai-page__td">
                                                                <span className="nilai-page__jenis-badge nilai-page__jenis-badge--kuis">KUIS</span>
                                                            </td>
                                                            <td className="nilai-page__td nilai-page__td--muted">{a.judul}{a.topik ? ` · ${a.topik}` : ''}</td>
                                                            <td className="nilai-page__td nilai-page__td--right">
                                                                <span className="nilai-page__apresiasi-poin">+{formatNumber(a.total_poin)}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="nilai-page__mobile-cards" style={{ gap: '10px' }}>
                                            {currentApresiasi.map((a) => (
                                                <div key={a.id} className="nilai-page__mobile-card">
                                                    <div className="nilai-page__mobile-card-header">
                                                        <span className="nilai-page__jenis-badge nilai-page__jenis-badge--kuis">{a.mapel}</span>
                                                        <span className="nilai-page__apresiasi-poin">+{formatNumber(a.total_poin)}</span>
                                                    </div>
                                                    <div className="nilai-page__mobile-card-topic">
                                                        {a.judul}{a.topik ? ` · ${a.topik}` : ''}
                                                    </div>
                                                    <div className="nilai-page__mobile-card-meta" style={{ marginTop: '4px' }}>
                                                        {a.jumlah_menang}x jawaban benar{a.nama_guru ? ` · ${a.nama_guru}` : ''}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Legend */}
                        <div className="nilai-page__card nilai-page__legend">
                            <h4 className="nilai-page__legend-title">
                                <svg className="nilai-page__legend-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Keterangan
                            </h4>
                            <div className="nilai-page__legend-grid">
                                {[
                                    { label: 'PAS', desc: 'Penilaian Akhir Semester', cls: 'pas' },
                                    { label: 'UH', desc: 'Ulangan Harian', cls: 'uh' },
                                    { label: 'TUGAS', desc: 'Tugas', cls: 'tugas' },
                                    { label: 'KUIS', desc: 'Kuis', cls: 'kuis' },
                                    { label: 'SUM', desc: 'Sumatif', cls: 'sum' },
                                ].map((item) => (
                                    <div key={item.label} className="nilai-page__legend-item">
                                        <span className={`nilai-page__jenis-badge nilai-page__jenis-badge--${item.cls}`}>{item.label}</span>
                                        <span className="nilai-page__legend-desc">{item.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
