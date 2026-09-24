'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { Spinner } from '@/components/ui/Spinner';
import { isUserAdmin } from '@/lib/auth-client';

interface EnrollmentRow {
    nisn: string;
    nama_siswa: string;
    kelas: string;
    semester: string;
}

interface MasterKelas {
    id: number;
    nama: string;
    program: string | null;
    kode: string | null;
}

// Kelas reguler/homeroom = tanpa kode DAN program Reguler (sinkron dengan pengaturan-data)
const isRegularClass = (cls?: MasterKelas) =>
    !!cls && !cls.kode && (!cls.program || cls.program === 'Reguler');

export default function WaliKelasTabMapelPilihan({ user }: { user?: any }) {
    const isAdmin = isUserAdmin(user);

    const [loading, setLoading] = useState(true);
    const [myClass, setMyClass] = useState<string>('');
    const [myClasses, setMyClasses] = useState<string[]>([]);
    const [waliAssignments, setWaliAssignments] = useState<any[]>([]);
    const [masterKelas, setMasterKelas] = useState<MasterKelas[]>([]);
    const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
    const [tahunAjaran, setTahunAjaran] = useState<string>('');
    const [years, setYears] = useState<string[]>([]);
    const [semester, setSemester] = useState<string>('Ganjil');
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [noClass, setNoClass] = useState(false);
    // Kartu statistik = navigasi: tampilkan daftar siswa atau kelompok kelas pilihan
    const [view, setView] = useState<'siswa' | 'kelompok'>('siswa');
    const [subset, setSubset] = useState<'all' | 'with' | 'without'>('all');

    const loadBase = useCallback(async () => {
        setLoading(true);
        try {
            const { getActiveSettings, getActivePeriods, getRecommendedSettings } = await import('@/lib/settings-client');
            const [resKelas, periods, active] = await Promise.all([
                fetch('/api/master/kelas'),
                getActivePeriods(),
                getActiveSettings(),
            ]);
            const jsonKelas = await resKelas.json();
            const kelasData: MasterKelas[] = jsonKelas.ok ? (jsonKelas.data || []) : [];
            setMasterKelas(kelasData);
            // Pilihan tahun = tahun ajaran AKTIF saja; default mengikuti tanggal hari ini
            const activeYears = Array.from(new Set(periods.map((p) => p.tahun_ajaran)));
            setYears(activeYears);
            if (active?.semester === 'Genap') setSemester('Genap');
            let defaultYear = active?.tahun_ajaran || activeYears[0] || '';
            try {
                const rec = await getRecommendedSettings();
                if (rec && activeYears.includes(rec.tahun_ajaran)) defaultYear = rec.tahun_ajaran;
            } catch { /* pakai default di atas */ }
            setTahunAjaran(defaultYear);
            if (!defaultYear) setLoading(false);

            if (isAdmin) {
                const regularClassesList = kelasData.filter((k) => isRegularClass(k)).map((k) => k.nama);
                setMyClasses(regularClassesList);
                if (regularClassesList.length > 0) {
                    setMyClass(prev => (!prev || !regularClassesList.includes(prev) ? regularClassesList[0] : prev));
                    setNoClass(false);
                } else {
                    setMyClass('');
                    setNoClass(true);
                }
            } else {
                if (!user?.nip) { setNoClass(true); return; }
                const res = await fetch(`/api/settings/wali-kelas?nip=${user.nip}`);
                const json = await res.json();
                if (json.ok && json.data && json.data.length > 0) {
                    setWaliAssignments(json.data);
                }
                else setNoClass(true);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    }, [user?.nip, isAdmin]);

    useEffect(() => { loadBase(); }, [loadBase]);

    useEffect(() => {
        if (isAdmin) {
            const regularClassesList = masterKelas.filter((k) => isRegularClass(k)).map((k) => k.nama);
            setMyClasses(regularClassesList);
            if (regularClassesList.length > 0) {
                setMyClass(prev => (!prev || !regularClassesList.includes(prev) ? regularClassesList[0] : prev));
                setNoClass(false);
            } else {
                setMyClass('');
                setNoClass(true);
            }
            return;
        }
        if (!tahunAjaran || waliAssignments.length === 0) return;
        
        const filtered = waliAssignments.filter((w: any) => w.tahun_ajaran === tahunAjaran);
        if (filtered.length > 0) {
            const uniqueClasses = Array.from(new Set(filtered.map((w: any) => w.nama_kelas))) as string[];
            setMyClasses(uniqueClasses);
            setMyClass(prev => (!prev || !uniqueClasses.includes(prev) ? uniqueClasses[0] : prev));
            setNoClass(false);
        } else {
            setMyClasses([]);
            setMyClass('');
            setNoClass(true);
        }
    }, [tahunAjaran, waliAssignments, isAdmin, masterKelas]);

    // Muat ulang enrollment terfokus pada kelas perwalian saat kelas atau tahun ajaran berganti
    useEffect(() => {
        if (!tahunAjaran || !myClass) {
            setEnrollments([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/settings/siswa-kelas?homeroom_kelas=${encodeURIComponent(myClass)}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`);
                const json = await res.json();
                if (!cancelled) setEnrollments(json.ok ? (json.data || []) : []);
            } catch (e) {
                console.error(e);
                if (!cancelled) setEnrollments([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [tahunAjaran, myClass]);

    const kelasByName = useMemo(() => {
        const map = new Map<string, MasterKelas>();
        masterKelas.forEach((k) => map.set(k.nama, k));
        return map;
    }, [masterKelas]);

    const regularClasses = useMemo(
        () => masterKelas.filter((k) => isRegularClass(k)).map((k) => k.nama),
        [masterKelas]
    );

    const matchSemester = useCallback(
        (e: EnrollmentRow) => semester === 'Semua' || e.semester === semester,
        [semester]
    );

    // Roster kelas reguler pada semester terpilih
    const roster = useMemo(() => {
        const seen = new Map<string, EnrollmentRow>();
        enrollments
            .filter((e) => e.kelas === myClass && matchSemester(e))
            .forEach((e) => { if (!seen.has(e.nisn)) seen.set(e.nisn, e); });
        return Array.from(seen.values())
            .sort((a, b) => (a.nama_siswa || '').localeCompare(b.nama_siswa || '', 'id'));
    }, [enrollments, myClass, matchSemester]);

    // Kelas pilihan (peminatan/UTBK/dll — non-reguler) per siswa roster
    const pilihanByNisn = useMemo(() => {
        const rosterSet = new Set(roster.map((r) => r.nisn));
        const map = new Map<string, string[]>();
        enrollments.forEach((e) => {
            if (!matchSemester(e)) return;
            if (!rosterSet.has(e.nisn)) return;
            if (e.kelas === myClass) return;
            if (isRegularClass(kelasByName.get(e.kelas))) return;
            const list = map.get(e.nisn) || [];
            if (!list.includes(e.kelas)) list.push(e.kelas);
            map.set(e.nisn, list);
        });
        map.forEach((list) => list.sort((a, b) => a.localeCompare(b, 'id')));
        return map;
    }, [enrollments, roster, matchSemester, myClass, kelasByName]);

    // Kelompok: kelas pilihan → anggota dari kelas reguler ini
    const groups = useMemo(() => {
        const map = new Map<string, EnrollmentRow[]>();
        roster.forEach((s) => {
            (pilihanByNisn.get(s.nisn) || []).forEach((kelas) => {
                if (!map.has(kelas)) map.set(kelas, []);
                map.get(kelas)!.push(s);
            });
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'id'));
    }, [roster, pilihanByNisn]);

    const filteredRoster = useMemo(() => {
        if (!searchQuery) return roster;
        const q = searchQuery.toLowerCase();
        return roster.filter((s) =>
            (s.nama_siswa || '').toLowerCase().includes(q) ||
            (s.nisn || '').toLowerCase().includes(q) ||
            (pilihanByNisn.get(s.nisn) || []).some((k) => k.toLowerCase().includes(q))
        );
    }, [roster, searchQuery, pilihanByNisn]);

    // Subset dari klik kartu statistik: semua / sudah terdaftar / belum punya kelas pilihan
    const displayRoster = useMemo(() => filteredRoster.filter((s) => {
        if (subset === 'all') return true;
        const has = (pilihanByNisn.get(s.nisn) || []).length > 0;
        return subset === 'with' ? has : !has;
    }), [filteredRoster, subset, pilihanByNisn]);

    const filteredGroups = useMemo(() => {
        if (!searchQuery) return groups;
        const q = searchQuery.toLowerCase();
        return groups
            .map(([kelas, members]) => {
                if (kelas.toLowerCase().includes(q)) return [kelas, members] as [string, EnrollmentRow[]];
                const m = members.filter((s) =>
                    (s.nama_siswa || '').toLowerCase().includes(q) || (s.nisn || '').toLowerCase().includes(q));
                return [kelas, m] as [string, EnrollmentRow[]];
            })
            .filter(([, members]) => members.length > 0);
    }, [groups, searchQuery]);

    const stats = useMemo(() => {
        const withPilihan = roster.filter((s) => (pilihanByNisn.get(s.nisn) || []).length > 0).length;
        return {
            total: roster.length,
            withPilihan,
            without: roster.length - withPilihan,
            kelasPilihan: groups.length,
        };
    }, [roster, pilihanByNisn, groups]);

    const toggleExpand = (kelas: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(kelas)) next.delete(kelas); else next.add(kelas);
            return next;
        });
    };

    const programLabel = (kelas: string) => kelasByName.get(kelas)?.program || 'Pilihan';

    if (noClass) {
        return (
            <div className="wkm-wrap">
                <div className="wkm-empty">
                    <i className="bi bi-person-x" />
                    <p>{isAdmin ? 'Belum ada kelas reguler terdaftar.' : 'Anda tidak terdaftar sebagai wali kelas pada tahun ajaran ini.'}</p>
                </div>
                <style jsx>{`
                    .wkm-wrap { display: flex; flex-direction: column; gap: 12px; }
                    .wkm-empty {
                        display: flex; flex-direction: column; align-items: center; gap: 10px;
                        padding: 48px 20px; color: var(--n-muted);
                    }
                    .wkm-empty i { font-size: 2.5rem; color: #cbd5e1; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="wkm-wrap">
            {/* Toolbar */}
            <FilterToolbar>
                <FilterSelect
                    label="Tahun Ajaran"
                    icon="mortarboard"
                    value={tahunAjaran}
                    onChange={setTahunAjaran}
                    options={[
                        ...(tahunAjaran && !years.includes(tahunAjaran) ? [{ value: tahunAjaran, label: tahunAjaran }] : []),
                        ...years.map(y => ({ value: y, label: y })),
                    ]}
                />
                <FilterSelect
                    label="Semester"
                    icon="clock-history"
                    value={semester}
                    onChange={setSemester}
                    options={[
                        { value: 'Semua', label: 'Ganjil & Genap' },
                        { value: 'Ganjil', label: 'Ganjil' },
                        { value: 'Genap', label: 'Genap' },
                    ]}
                />
                {myClasses.length > 0 && (
                    <FilterSelect
                        label="Kelas"
                        icon="door-open"
                        value={myClass}
                        onChange={setMyClass}
                        options={myClasses.map(k => ({ value: k, label: k }))}
                    />
                )}
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari nama / NISN / kelas pilihan..."
                />
            </FilterToolbar>

            {loading ? (
                <div className="wkm-loading">
                    <Spinner variant="buble" size={28} />
                </div>
            ) : (
                <>
                    {/* Stats — klik untuk berpindah tampilan */}
                    <div className="wkm-stats">
                        <button
                            className={`wkm-stat ${view === 'siswa' && subset === 'all' ? 'wkm-stat--active' : ''}`}
                            onClick={() => { setView('siswa'); setSubset('all'); }}
                        >
                            <span className="wkm-stat-val">{stats.total}</span>
                            <span className="wkm-stat-lbl">Siswa {myClass}</span>
                        </button>
                        <button
                            className={`wkm-stat ${view === 'kelompok' ? 'wkm-stat--active' : ''}`}
                            onClick={() => setView('kelompok')}
                        >
                            <span className="wkm-stat-val">{stats.kelasPilihan}</span>
                            <span className="wkm-stat-lbl">Kelas Pilihan</span>
                        </button>
                        <button
                            className={`wkm-stat ${view === 'siswa' && subset === 'with' ? 'wkm-stat--active' : ''}`}
                            onClick={() => { setView('siswa'); setSubset('with'); }}
                        >
                            <span className="wkm-stat-val ok">{stats.withPilihan}</span>
                            <span className="wkm-stat-lbl">Terdaftar</span>
                        </button>
                        <button
                            className={`wkm-stat ${view === 'siswa' && subset === 'without' ? 'wkm-stat--active' : ''}`}
                            onClick={() => { setView('siswa'); setSubset('without'); }}
                        >
                            <span className={`wkm-stat-val ${stats.without > 0 ? 'warn' : ''}`}>{stats.without}</span>
                            <span className="wkm-stat-lbl">Belum Ada</span>
                        </button>
                    </div>

                    {/* Kelompok Kelas Pilihan */}
                    {view === 'kelompok' && (<>
                    <div className="wkm-section-title">
                        <i className="bi bi-collection" /> Kelas Pilihan Siswa {myClass}
                    </div>
                    {filteredGroups.length === 0 ? (
                        <div className="wkm-empty wkm-empty--soft">
                            <i className="bi bi-journal-x" />
                            <p>{searchQuery ? 'Tidak ada yang cocok dengan pencarian.' : `Belum ada siswa ${myClass} yang terdaftar di kelas pilihan pada semester ${semester === 'Semua' ? 'Ganjil & Genap' : semester}.`}</p>
                        </div>
                    ) : (
                        <div className="wkm-groups">
                            {filteredGroups.map(([kelas, members]) => {
                                const isOpen = expanded.has(kelas) || !!searchQuery;
                                return (
                                    <div key={kelas} className="wkm-group">
                                        <button className="wkm-group-hdr" onClick={() => toggleExpand(kelas)}>
                                            <div className="wkm-group-name">
                                                <i className="bi bi-journal-bookmark" />
                                                <span>{kelas}</span>
                                                <span className="wkm-program-badge">{programLabel(kelas)}</span>
                                            </div>
                                            <div className="wkm-group-meta">
                                                <span className="wkm-count">{members.length} siswa</span>
                                                <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} />
                                            </div>
                                        </button>
                                        {isOpen && (
                                            <div className="wkm-group-body">
                                                {members.map((s, i) => (
                                                    <div key={s.nisn} className="wkm-member">
                                                        <span className="wkm-member-no">{i + 1}</span>
                                                        <span className="wkm-member-name">{s.nama_siswa}</span>
                                                        <span className="wkm-member-nisn">{s.nisn}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </>)}

                    {/* Per Siswa */}
                    {view === 'siswa' && (<>
                    <div className="wkm-section-title">
                        <i className="bi bi-people" />
                        {subset === 'with' ? 'Siswa Terdaftar Kelas Pilihan'
                            : subset === 'without' ? 'Siswa Belum Punya Kelas Pilihan'
                            : 'Daftar Siswa & Kelas Pilihannya'}
                    </div>
                    {displayRoster.length === 0 ? (
                        <div className="wkm-empty wkm-empty--soft">
                            <i className="bi bi-people" />
                            <p>{searchQuery ? 'Tidak ada siswa yang cocok.'
                                : subset === 'with' ? 'Belum ada siswa yang terdaftar di kelas pilihan.'
                                : subset === 'without' ? 'Semua siswa sudah terdaftar di kelas pilihan.'
                                : 'Tidak ada siswa di kelas ini.'}</p>
                        </div>
                    ) : (
                        <div className="wkm-students">
                            {displayRoster.map((s) => {
                                const pilihan = pilihanByNisn.get(s.nisn) || [];
                                return (
                                    <div key={s.nisn} className="wkm-student">
                                        <div className="wkm-avatar">{s.nama_siswa?.[0] || '?'}</div>
                                        <div className="wkm-student-info">
                                            <span className="wkm-student-name">{s.nama_siswa || 'Tanpa Nama'}</span>
                                            <span className="wkm-student-nisn">{s.nisn}</span>
                                        </div>
                                        <div className="wkm-badges">
                                            {pilihan.length === 0 ? (
                                                <span className="wkm-badge wkm-badge--none">
                                                    <i className="bi bi-exclamation-triangle" /> Belum ada
                                                </span>
                                            ) : pilihan.map((k) => (
                                                <span key={k} className="wkm-badge">{k}</span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </>)}
                </>
            )}

            <style jsx>{`
                .wkm-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                /* Toolbar filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                /* Stats */
                .wkm-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                }
                .wkm-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 14px 10px;
                    background: var(--n-card);
                    border: 1.5px solid var(--n-border);
                    border-radius: 16px;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s ease;
                }
                .wkm-stat:hover {
                    border-color: #2563eb;
                }
                .wkm-stat--active {
                    background: var(--n-card) !important;
                    border-color: #2563eb !important;
                }
                .wkm-stat-val {
                    font-size: 1.45rem;
                    font-weight: 800;
                    color: #2563eb;
                    line-height: 1.1;
                    letter-spacing: -0.02em;
                }
                .wkm-stat-val.ok { color: #10b981; }
                .wkm-stat-val.warn { color: #d97706; }
                .wkm-stat-lbl {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    margin-top: 4px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }

                /* Section Title */
                .wkm-section-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.82rem;
                    font-weight: 800;
                    color: var(--n-text);
                    margin-top: 4px;
                }
                .wkm-section-title i { color: #3083FF; }

                /* Groups */
                .wkm-groups {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .wkm-group {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    overflow: hidden;
                }
                .wkm-group-hdr {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 12px 14px;
                    border: none;
                    background: var(--n-soft);
                    cursor: pointer;
                    text-align: left;
                }
                .wkm-group-name {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    font-size: 0.8rem;
                    font-weight: 800;
                    color: var(--n-text);
                }
                .wkm-group-name span:first-of-type {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .wkm-group-name i { color: #3083FF; flex-shrink: 0; }
                .wkm-program-badge {
                    flex-shrink: 0;
                    padding: 2px 8px;
                    border-radius: 999px;
                    background: #eff6ff;
                    color: #1d4ed8;
                    font-size: 0.62rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .wkm-group-meta {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                    color: var(--n-muted);
                }
                .wkm-count {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #3083FF;
                    background: rgba(99,102,241,0.1);
                    padding: 3px 10px;
                    border-radius: 999px;
                }
                .wkm-group-body {
                    display: flex;
                    flex-direction: column;
                }
                .wkm-member {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 9px 14px;
                    border-top: 1px solid var(--n-border);
                }
                .wkm-member-no {
                    width: 22px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    flex-shrink: 0;
                }
                .wkm-member-name {
                    flex: 1;
                    min-width: 0;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--n-text);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .wkm-member-nisn {
                    font-size: 0.68rem;
                    color: var(--n-muted);
                    font-family: ui-monospace, monospace;
                    flex-shrink: 0;
                }

                /* Students */
                .wkm-students {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .wkm-student {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    background: var(--n-card);
                    border: 1.5px solid var(--n-border);
                    border-radius: 14px;
                }
                .wkm-avatar {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #3083FF, #3b82f6);
                    color: white;
                    font-size: 0.95rem;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .wkm-student-info {
                    min-width: 0;
                    flex: 0 1 auto;
                    width: 38%;
                }
                .wkm-student-name {
                    display: block;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--n-text);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .wkm-student-nisn {
                    display: block;
                    font-size: 0.65rem;
                    color: var(--n-muted);
                    margin-top: 1px;
                }
                .wkm-badges {
                    flex: 1;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    justify-content: flex-end;
                }
                .wkm-badge {
                    padding: 4px 10px;
                    border-radius: 999px;
                    background: rgba(99,102,241,0.1);
                    border: 1px solid rgba(99,102,241,0.22);
                    color: #3083FF;
                    font-size: 0.68rem;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .wkm-badge--none {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: rgba(245,158,11,0.12);
                    border-color: rgba(245,158,11,0.3);
                    color: #b45309;
                }

                /* Loading & Empty */
                .wkm-loading, .wkm-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 48px 20px;
                    color: var(--n-muted);
                }
                .wkm-empty--soft {
                    padding: 28px 16px;
                    background: var(--n-card);
                    border: 1.5px dashed var(--n-border);
                    border-radius: 14px;
                    text-align: center;
                    font-size: 0.8rem;
                }
                .wkm-empty i { font-size: 2rem; color: #cbd5e1; }
                .wkm-empty p { margin: 0; }
                .wkm-spinner {
                    width: 28px;
                    height: 28px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #3083FF;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Dark Mode */
                :global(.dark) .wkm-stat {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wkm-stat:hover {
                    border-color: #60a5fa !important;
                }
                :global(.dark) .wkm-stat--active {
                    background: #000000 !important;
                    border-color: #60a5fa !important;
                }
                :global(.dark) .wkm-stat-val { color: #60a5fa !important; }
                :global(.dark) .wkm-stat-val.ok { color: #34d399 !important; }
                :global(.dark) .wkm-stat-val.warn { color: #fbbf24 !important; }
                :global(.dark) .wkm-section-title { color: #ffffff !important; }
                :global(.dark) .wkm-group {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    overflow: hidden !important;
                }
                :global(.dark) .wkm-group-hdr {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .wkm-group-name { color: #ffffff !important; }
                :global(.dark) .wkm-program-badge { background: rgba(26, 115, 232, 0.2) !important; color: #93c5fd !important; }
                :global(.dark) .wkm-member { border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .wkm-member-name { color: #ffffff !important; }
                :global(.dark) .wkm-student {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 14px !important;
                }
                :global(.dark) .wkm-student-name { color: #ffffff !important; }
                :global(.dark) .wkm-badge {
                    background: rgba(129,140,248,0.15) !important;
                    border-color: rgba(129,140,248,0.4) !important;
                    color: #93c5fd !important;
                }
                :global(.dark) .wkm-badge--none {
                    background: rgba(245,158,11,0.15) !important;
                    border-color: rgba(245,158,11,0.3) !important;
                    color: #fbbf24 !important;
                }
                :global(.dark) .wkm-empty--soft {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                }
            `}</style>
        </div>
    );
}
