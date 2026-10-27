'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import DetailHeader from '@/components/ui/DetailHeader';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { ActionButton } from '@/components/ui/ActionButtons';
import FilterToolbar, { FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { getProxiedImageUrl } from '@/lib/image-utils';
import { getActiveTahunAjaranList, currentSemesterDefault } from '@/lib/tahun-ajaran-client';
import '@/app/nilai-siswa/nilai-siswa.css';

interface SiswaAsuh {
    nisn: string;
    nama: string;
    kelas: string;
    tahun_ajaran: string;
    foto_profil?: string | null;
}

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
    const [apresiasi, setApresiasi] = useState<ApresiasiItem[]>([]);
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedMapel, setSelectedMapel] = useState('');
    const [selectedSumber, setSelectedSumber] = useState('all');
    const [availableTahunAjaran, setAvailableTahunAjaran] = useState<string[]>([]);
    const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
    const [kkmMap, setKkmMap] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeSearch, setGradeSearch] = useState('');
    const nilaiRequest = useRef(0);

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
        const requestId = ++nilaiRequest.current;
        setNilaiLoading(true);
        setNilaiData(null);
        setApresiasi([]);
        try {
            const params = new URLSearchParams({ nisn });
            const res = await fetch(`/api/nilai/siswa?${params.toString()}`);
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
                    const tahunList = [...new Set<string>([...activeYears, ...dataYears])]
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

    const allYearOptions: string[] = useMemo(() => {
        const set = new Set<string>();
        (ta.years || []).filter(y => y !== 'Semua').forEach(y => set.add(y));
        ((data as any)?.available_tahun_ajaran || []).filter(Boolean).forEach((y: string) => set.add(y));
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [ta.years, data]);

    const handleSelectSiswa = (s: any) => {
        setGradeSearch('');
        const nisn = s.nisn || s.nisn_siswa || '';
        const nama = s.nama || s.nama_siswa || '';
        setSelectedNisn(nisn);
        setSelectedSiswa({
            nisn,
            nama,
            kelas: s.kelas || '',
            tahun_ajaran: s.tahun_ajaran || '',
            foto_profil: s.foto_profil || null,
        });
        setSelectedSumber('all');
        setSelectedMapel('');
        setView('detail');
        fetchNilai(nisn);
    };

    const handleBack = () => {
        setGradeSearch('');
        nilaiRequest.current++;
        setView('list');
        setSelectedNisn('');
        setSelectedSiswa(null);
        setNilaiData(null);
        setApresiasi([]);
        setSearchQuery('');
        setSelectedSumber('all');
        setSelectedMapel('');
        setAvailableSemesters([]);
        setKkmMap({});
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
        if (!data?.siswa_list) return [];
        if (!searchQuery) return data.siswa_list;
        const q = searchQuery.toLowerCase();
        return data.siswa_list.filter(s => {
            const nisn = (s.nisn || (s as any).nisn_siswa || '').toLowerCase();
            const nama = (s.nama || (s as any).nama_siswa || '').toLowerCase();
            const kelas = (s.kelas || '').toLowerCase();
            return nisn.includes(q) || nama.includes(q) || kelas.includes(q);
        });
    }, [data?.siswa_list, searchQuery]);

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

    const searchTerms = useMemo(() => gradeSearch.trim().toLowerCase().split(/\s+/).filter(Boolean), [gradeSearch]);
    const searchedItems = useMemo(() => currentItems.filter(item => {
        const text = [item.mapel, item.nama_guru, item.materi_tp, item.topik,
            item.jenis, item.tagihan, item.catatan,
            item.score_type === 'classical' ? 'Klasikal' : item.score_type?.replace(/_/g, ' ')]
            .filter(Boolean).join(' ').toLowerCase();
        return searchTerms.every(term => text.includes(term));
    }), [currentItems, searchTerms]);

    const currentApresiasi = useMemo(() => {
        const parsed = parseInt(selectedSemester);
        const semNum = isNaN(parsed) ? null : parsed;
        return apresiasi.filter(a => {
            if (selectedSumber === 'cbt') return false;
            if (selectedTahunAjaran && a.tahun_ajaran && a.tahun_ajaran !== selectedTahunAjaran) return false;
            if (semNum !== null && a.semester !== null && a.semester !== semNum) return false;
            if (selectedMapel && a.mapel && a.mapel !== selectedMapel) return false;
            const text = [a.mapel, a.nama_guru, a.judul, a.topik, a.catatan].filter(Boolean).join(' ').toLowerCase();
            return searchTerms.every(term => text.includes(term));
        });
    }, [apresiasi, selectedTahunAjaran, selectedSemester, selectedMapel, selectedSumber, searchTerms]);

    const groupedByMapel = useMemo(() => {
        const grouped: Record<string, NilaiItem[]> = {};
        searchedItems.forEach(item => {
            const key = item.mapel || 'Lainnya';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    }, [searchedItems]);

    const availableMapel = useMemo(() => [...new Set(currentItems.map(item => item.mapel || 'Lainnya'))].sort(), [currentItems]);

    const displayedMapelList = useMemo(() => {
        const mapel = Object.keys(groupedByMapel).sort();
        return selectedMapel ? mapel.filter(m => m === selectedMapel) : mapel;
    }, [groupedByMapel, selectedMapel]);

    const displayedItems = useMemo(() => {
        if (!selectedMapel) return searchedItems;
        return searchedItems.filter(i => (i.mapel || 'Lainnya') === selectedMapel);
    }, [searchedItems, selectedMapel]);

    // Reset filter mapel jika mapel terpilih tidak ada pada data baru
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

    const regularKelas = useMemo(() => {
        const normalizeSemester = (value: string | number | null) => {
            const normalized = String(value || '').trim().toLowerCase();
            return normalized === 'ganjil' ? '1' : normalized === 'genap' ? '2' : normalized;
        };
        const kelasFromData = [...new Set((nilaiData?.kelas || []).filter((item: any) =>
            (!selectedTahunAjaran || item.tahun_ajaran === selectedTahunAjaran) &&
            (!selectedSemester || normalizeSemester(item.semester) === selectedSemester)
        ).map((item: any) => item.kelas).filter(Boolean))].join(', ');
        return kelasFromData || selectedSiswa?.kelas || '-';
    }, [nilaiData?.kelas, selectedTahunAjaran, selectedSemester, selectedSiswa?.kelas]);

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

    const getSemesterLabel = (sem: string | number) => {
        const s = String(sem);
        if (s === '1') return 'Ganjil';
        if (s === '2') return 'Genap';
        if (s === '0' || s === 'Unknown') return 'Belum ditentukan';
        return s;
    };

    const formatNumber = (val: number | null | undefined): string => {
        if (val === null || val === undefined || isNaN(Number(val))) return '-';
        return Number(Number(val).toFixed(2)).toString();
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

    if (loading) return <PageLoader minHeight="300px" />;

    if (error) return (
        <div className="gan-loading">
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '2rem', color: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{error}</span>
        </div>
    );

    if (view === 'detail') {
        const studentPhoto = selectedSiswa?.foto_profil || nilaiData?.siswa?.foto_profil;
        return (
            <div className="nilai-page">
                <div className="nilai-page__inner">
                    <DetailHeader
                        onBack={handleBack}
                        backLabel="Kembali ke Daftar Siswa"
                        name={selectedSiswa?.nama || (selectedSiswa as any)?.nama_siswa || '...'}
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
                            <FilterToolbar className="nilai-page__filter-toolbar">
                                <FilterSearch
                                    label="Cari nilai"
                                    value={gradeSearch}
                                    onChange={setGradeSearch}
                                    placeholder="Cari ujian, mapel, guru, atau topik..."
                                />
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
                                    <h3 className="nilai-page__empty-title">{searchTerms.length ? 'Tidak ada nilai yang sesuai dengan pencarian' : 'Belum ada data nilai pada periode ini'}</h3>
                                </div>
                            ) : (
                                <div className="nilai-page__mapel-list">
                                    {displayedGradeGroups.map(({ key, title: mapel, items, isCbt }) => {
                                        const itemsWithInfo = items.map(i => ({
                                            ...i,
                                            info: parseSumInfo(i)
                                        }));

                                        // Sort by sumGroup then by type (SUM assessments first in group)
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

                                        // Calculate RowSpans
                                        const tableRows: any[] = [];
                                        let i = 0;
                                        while (i < itemsWithInfo.length) {
                                            let j = i;
                                            const currentSum = itemsWithInfo[i].info.sumGroup;
                                            if (currentSum !== '-') {
                                                while (j < itemsWithInfo.length && itemsWithInfo[j].info.sumGroup === currentSum) {
                                                    j++;
                                                }
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
                                                                            {/* SUM Group Header */}
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
            <div className="gan__wrap">
                {toolbarNode}
                <div className="gan__empty">
                    <div className="gan__empty-icon"><i className="bi bi-person-hearts" /></div>
                    <h3>Anda belum mengklaim anak asuh untuk tahun ajaran ini</h3>
                    <p>Pilih tahun ajaran lain di atas atau buka tab &quot;Klaim Anak Asuh&quot; untuk mengklaim siswa yang akan menjadi anak asuh Anda.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="gan__wrap">
            {toolbarNode}

            {filteredStudents.length === 0 ? (
                <div className="gan__empty">
                    <div className="gan__empty-icon"><i className="bi bi-people" /></div>
                    <h3>Tidak ada siswa yang cocok</h3>
                    <p>Coba gunakan kata kunci pencarian yang lain.</p>
                </div>
            ) : (
                <div className="gan__siswaList">
                    {filteredStudents.map((siswa, idx) => {
                        const sName = siswa.nama || (siswa as any).nama_siswa || '-';
                        const sNisn = siswa.nisn || (siswa as any).nisn_siswa || '';
                        return (
                            <div
                                key={`siswa-${idx}`}
                                className="gan__siswaCard"
                                onClick={() => handleSelectSiswa(siswa)}
                            >
                                <div className="gan__siswaAvatar">
                                    {siswa.foto_profil && (
                                        <img
                                            src={getProxiedImageUrl(siswa.foto_profil)}
                                            alt={sName}
                                            className="gan__avatarImg"
                                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                        />
                                    )}
                                    <span>{(sName.charAt(0) || '?').toUpperCase()}</span>
                                </div>
                                <div className="gan__siswaInfo">
                                    <div className="gan__siswaNama">{sName}</div>
                                    <div className="gan__siswaMeta">
                                        <span className="gan__kelasChip">{siswa.kelas}</span>
                                        <span className="gan__nisnChip">NISN: {sNisn}</span>
                                    </div>
                                </div>
                                <div className="gan__siswaFooter">
                                    <div className="gan__siswaActions">
                                        <ActionButton
                                            action="view"
                                            label="Lihat Nilai"
                                            iconOnly={false}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectSiswa(siswa);
                                            }}
                                            title="Lihat Detail Nilai Siswa"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                .gan-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 24px; color: var(--n-muted); }

                .gan__wrap { display: flex; flex-direction: column; gap: 16px; animation: ganFadeIn 0.4s ease-out; }
                @keyframes ganFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .gan__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 20px; }
                .gan__empty-icon { width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: var(--n-primary); margin-bottom: 14px; }
                .gan__empty h3 { font-size: 1.05rem; font-weight: 800; color: var(--n-ink); margin: 0 0 6px; }
                .gan__empty p { font-size: 0.85rem; color: var(--n-muted); max-width: 380px; line-height: 1.5; margin: 0; }

                .gan__siswaList { display: flex; flex-direction: column; gap: 10px; }
                .gan__siswaCard { display: grid; grid-template-columns: 44px 1fr auto; gap: 12px 18px; align-items: center; padding: 12px 18px; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); cursor: pointer; transition: all 0.2s; position: relative; }
                .gan__siswaCard:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); transform: translateY(-1px); border-color: #3083FF; }
                .gan__siswaAvatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; color: white; background: linear-gradient(135deg, #3083FF, #3b82f6); flex-shrink: 0; position: relative; overflow: hidden; }
                .gan__avatarImg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
                .gan__siswaInfo { display: flex; flex-direction: column; gap: 4px; }
                .gan__siswaNama { font-size: 0.95rem; font-weight: 800; color: var(--n-ink); line-height: 1.2; }
                .gan__siswaMeta { display: flex; align-items: center; gap: 7px; }
                .gan__kelasChip { font-size: 0.72rem; font-weight: 700; background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 50px; }
                .gan__nisnChip { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; }
                .gan__siswaFooter { display: contents; }
                .gan__siswaActions { display: flex; align-items: center; justify-content: flex-end; }

                :global(.dark) .gan__empty { background: #0b1329 !important; border: 1px solid rgba(37, 99, 235, 0.35) !important; border-radius: 20px !important; }
                :global(.dark) .gan__empty-icon { background: rgba(26, 115, 232, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .gan__empty h3 { color: #ffffff !important; }
                :global(.dark) .gan__siswaCard { background: #0b1329 !important; border: 1px solid rgba(37, 99, 235, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gan__siswaCard:hover { background: rgba(26, 115, 232, 0.12) !important; }
                :global(.dark) .gan__siswaNama { color: #ffffff !important; }
                :global(.dark) .gan__kelasChip { background: rgba(59,130,246,0.15) !important; color: #60a5fa !important; }

                @media (max-width: 640px) {
                    .gan__siswaCard { grid-template-columns: 36px 1fr; grid-template-rows: auto auto; gap: 6px 12px; padding: 12px 14px; }
                    .gan__siswaFooter { display: flex; grid-column: 2; justify-content: flex-start; align-items: center; gap: 8px; margin-top: 2px; }
                    .gan__siswaNama { font-weight: 600; font-size: 0.9rem; }
                }
            `}</style>
        </div>
    );
}