'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getActiveSettings } from '@/lib/settings-client';
import { InlineSelect, InlineSelectOption } from '@/components/ui/InlineSelect';
import SearchableSelect, { Option } from '@/components/ui/SearchableSelect';

interface Siswa {
    id: number;
    nisn: string;
    nama_siswa: string;
    kelas: string;
}

interface StudentSelectProps {
    onSelectionChange: (selectedNisns: string[], studentClassMap?: Record<string, string>) => void;
    selectedNisns: string[];
}

export default function StudentSelect({ onSelectionChange, selectedNisns }: StudentSelectProps) {
    // Filter Class specific state
    const [selectedClass, setSelectedClass] = useState('');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);

    // Active Period State
    const [activePeriod, setActivePeriod] = useState<{ tahun_ajaran: string, semester: string } | null>(null);

    // Search / Students state
    const [results, setResults] = useState<Siswa[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<Siswa[]>([]);
    const [dropUp, setDropUp] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Init: Fetch active period, classes and initial student details
    useEffect(() => {
        init();
        if (selectedNisns.length > 0 && selectedStudents.length === 0) {
            fetchSelectedDetails();
        }
    }, []);

    // Reset internal state ketika parent mengosongkan selectedNisns (mis. modal ditutup)
    useEffect(() => {
        if (selectedNisns.length === 0) {
            setSelectedStudents([]);
            setSelectedClass('');
        }
    }, [selectedNisns.length]);

    const init = async () => {
        const settings = await getActiveSettings();
        if (settings) {
            setActivePeriod(settings);
            fetchClasses(settings.tahun_ajaran, settings.semester);
        } else {
            fetchClasses();
            searchSiswa();
        }
    };

    const fetchClasses = async (tahun?: string, semester?: string) => {
        try {
            const res = await fetch('/api/master/kelas?program=Reguler');
            const json = await res.json();
            const data = json.ok ? json.data : (Array.isArray(json) ? json : []);
            if (Array.isArray(data)) {
                const classes = Array.from(new Set(data.map((d: any) => d.nama).filter(Boolean))).sort() as string[];
                setAvailableClasses(classes);
            }
        } catch (e) {
            console.error('Error fetching classes', e);
        }
    };

    const fetchSelectedDetails = async () => {
        if (selectedNisns.length === 0) return;
        try {
            const promises = selectedNisns.map(n => fetch(`/api/siswa/${encodeURIComponent(n)}/kelas`).then(r => r.json()));
            const responses = await Promise.all(promises);
            const found: Siswa[] = [];
            responses.forEach((res, i) => {
                if (res.ok && res.data && res.data.length > 0) {
                    const first = res.data[0];
                    found.push({
                        id: i + 1,
                        nisn: selectedNisns[i],
                        nama_siswa: first.nama_siswa || selectedNisns[i],
                        kelas: first.kelas || '-',
                    });
                }
            });
            if (found.length > 0) setSelectedStudents(found);
        } catch (e) {
            console.error('Error fetching selected details:', e);
        }
    };

    // Trigger fetch when Class or activePeriod changes
    useEffect(() => {
        if (activePeriod) {
            searchSiswa();
        }
    }, [selectedClass, activePeriod]);

    const searchSiswa = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedClass) params.set('kelas', selectedClass);
            if (activePeriod) {
                if (activePeriod.tahun_ajaran) params.set('tahun_ajaran', activePeriod.tahun_ajaran);
                if (activePeriod.semester) params.set('semester', activePeriod.semester);
            }
            // Hanya ambil kelas reguler (bukan kelas Lanjutan/Pilihan Kurikulum Merdeka)
            params.set('reguler', 'true');
            const res = await fetch(`/api/settings/siswa-kelas?${params.toString()}`);
            const json = await res.json();
            const list = json.ok ? json.data : (Array.isArray(json) ? json : []);
            if (Array.isArray(list)) {
                // Deduplicate by NISN: ambil baris kelas reguler per siswa
                const seen = new Set<string>();
                const regulerList = list.filter((s: any) => {
                    const kelasName: string = s.kelas || '';
                    if (kelasName.toLowerCase().includes('lanjut') || kelasName.toLowerCase().includes('pilihan')) return false;
                    if (seen.has(s.nisn)) return false;
                    seen.add(s.nisn);
                    return true;
                });
                setResults(regulerList.map((s: any, idx: number) => ({
                    id: s.id || idx + 1,
                    nisn: s.nisn,
                    nama_siswa: s.nama_siswa || s.nama || s.nisn,
                    kelas: s.kelas || '-',
                })));
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Smart direction detection: find largest available space (Above vs Below)
    const calculateDirection = () => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setDropUp(spaceBelow < 280 && spaceAbove > spaceBelow);
        }
    };

    useEffect(() => {
        calculateDirection();
        window.addEventListener('resize', calculateDirection);
        return () => window.removeEventListener('resize', calculateDirection);
    }, []);

    const notifyChange = (newNisns: string[], newStudents: Siswa[]) => {
        const classMap: Record<string, string> = {};
        newStudents.forEach(s => {
            if (s.nisn && s.kelas && s.kelas !== '-') classMap[s.nisn] = s.kelas;
        });
        onSelectionChange(newNisns, classMap);
    };

    // Map to lookup Siswa object by nisn
    const knownStudentsMap = useMemo(() => {
        const map = new Map<string, Siswa>();
        results.forEach(s => map.set(s.nisn, s));
        selectedStudents.forEach(s => map.set(s.nisn, s));
        return map;
    }, [results, selectedStudents]);

    const studentOptions: Option[] = useMemo(() => {
        const studentMap = new Map<string, Siswa>();
        results.forEach(s => studentMap.set(s.nisn, s));
        // Pastikan siswa yang sudah terpilih tetap ada di opsi agar badge dan ringkasan tidak hilang
        selectedStudents.forEach(s => {
            if (!studentMap.has(s.nisn)) {
                studentMap.set(s.nisn, s);
            }
        });
        return Array.from(studentMap.values()).map(s => ({
            value: s.nisn,
            label: s.nama_siswa,
            subLabel: s.kelas && s.kelas !== '-' ? `${s.nisn} • ${s.kelas}` : s.nisn
        }));
    }, [results, selectedStudents]);

    const classOptions: InlineSelectOption[] = useMemo(() => [
        { value: '', label: 'Semua Kelas' },
        ...availableClasses.map(cls => ({ value: cls, label: cls }))
    ], [availableClasses]);

    const handleSelectionChange = (newNisns: string[]) => {
        const newStudents: Siswa[] = newNisns.map(nisn => {
            const found = knownStudentsMap.get(nisn);
            if (found) return found;
            return {
                id: 0,
                nisn,
                nama_siswa: nisn,
                kelas: '-'
            };
        });
        setSelectedStudents(newStudents);
        notifyChange(newNisns, newStudents);
    };

    const removeStudent = (nisn: string) => {
        const newNisns = selectedNisns.filter(n => n !== nisn);
        const newStudents = selectedStudents.filter(s => s.nisn !== nisn);
        setSelectedStudents(newStudents);
        notifyChange(newNisns, newStudents);
    };

    return (
        <div className="student-select-wrapper" ref={wrapperRef}>
            <div className="control-row">
                <div className="class-select-wrap">
                    <InlineSelect
                        value={selectedClass}
                        onChange={(val) => {
                            setSelectedClass(val);
                            calculateDirection();
                        }}
                        options={classOptions}
                        minWidth="100%"
                        height="38px"
                    />
                </div>

                <div className="student-search-wrap" onClick={calculateDirection}>
                    <SearchableSelect
                        options={studentOptions}
                        value={selectedNisns}
                        onChange={(vals) => {
                            const newNisns = Array.isArray(vals) ? vals.map(String) : [String(vals)];
                            handleSelectionChange(newNisns);
                        }}
                        placeholder={loading ? 'Memuat data siswa...' : (selectedClass ? `Cari siswa di ${selectedClass}...` : 'Cari nama / NISN...')}
                        disabled={loading && studentOptions.length === 0}
                        multiple={true}
                        itemLabel="siswa"
                        placement={dropUp ? 'top' : 'bottom'}
                    />
                </div>
            </div>

            {/* Selected Chips */}
            {selectedStudents.length > 0 && (
                <div className="selected-list">
                    <div className="selected-label">Terpilih: {selectedStudents.length} Siswa</div>
                    <div className="chips-grid">
                        {selectedStudents.map(s => (
                            <div key={s.nisn} className="student-chip">
                                <span>{s.nama_siswa}</span>
                                <button
                                    type="button"
                                    onClick={() => removeStudent(s.nisn)}
                                    className="remove-chip"
                                    title="Hapus"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style jsx>{`
                .student-select-wrapper {
                    position: relative;
                    width: 100%;
                }

                .control-row {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    width: 100%;
                }

                .class-select-wrap {
                    width: 150px;
                    flex-shrink: 0;
                }

                .student-search-wrap {
                    flex: 1;
                    min-width: 0;
                }

                .selected-list {
                    margin-top: 10px;
                }

                .selected-label {
                    font-size: 0.70rem;
                    font-weight: 700;
                    color: var(--n-muted, #64748b);
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .chips-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .student-chip {
                    display: inline-flex;
                    align-items: center;
                    background: #e0f2fe;
                    color: #0369a1;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                :global(.dark) .student-chip {
                    background: rgba(14, 165, 233, 0.2);
                    color: #38bdf8;
                    border: 1px solid rgba(56, 189, 248, 0.3);
                }

                .remove-chip {
                    background: none;
                    border: none;
                    color: #0369a1;
                    margin-left: 6px;
                    cursor: pointer;
                    font-size: 1.1rem;
                    line-height: 1;
                    opacity: 0.6;
                    padding: 0;
                }

                .remove-chip:hover {
                    opacity: 1;
                }

                :global(.dark) .remove-chip {
                    color: #38bdf8;
                }

                @media (max-width: 540px) {
                    .control-row {
                        flex-direction: column;
                        gap: 8px;
                        align-items: stretch;
                    }
                    .class-select-wrap {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
}
