'use client';

import { useState, useEffect, useRef } from 'react';
import { getActiveSettings } from '@/lib/settings-client';

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

    // Search state
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Siswa[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<Siswa[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

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
            setQuery('');
            setResults([]);
            setShowDropdown(false);
            setSelectedClass('');
        }
    }, [selectedNisns.length]);

    const init = async () => {
        const settings = await getActiveSettings();
        if (settings) {
            setActivePeriod(settings);
            // We'll call fetchClasses inside searchSiswa or here after state set
            // For safety, let's just make fetchClasses aware of settings
            fetchClasses(settings.tahun_ajaran, settings.semester);
        } else {
            fetchClasses();
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

    // Trigger search when Query OR Class OR activePeriod changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            searchSiswa();
        }, 300);
        return () => clearTimeout(timeout);
    }, [query, selectedClass, activePeriod]);

    const searchSiswa = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedClass) params.set('kelas', selectedClass);
            if (query) params.set('q', query);
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
                    kelas: s.kelas,
                })));
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const [dropUp, setDropUp] = useState(false);

    // Smart direction detection: find largest available space (Above vs Below)
    const calculateDirection = () => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setDropUp(spaceBelow < 240 && spaceAbove > spaceBelow);
        }
    };

    useEffect(() => {
        if (showDropdown) {
            calculateDirection();
        }
    }, [showDropdown]);

    const notifyChange = (newNisns: string[], newStudents: Siswa[]) => {
        const classMap: Record<string, string> = {};
        newStudents.forEach(s => {
            if (s.nisn && s.kelas && s.kelas !== '-') classMap[s.nisn] = s.kelas;
        });
        onSelectionChange(newNisns, classMap);
    };

    const handleSelect = (siswa: Siswa) => {
        if (selectedNisns.includes(siswa.nisn)) {
            // Uncheck
            const newNisns = selectedNisns.filter(n => n !== siswa.nisn);
            const newStudents = selectedStudents.filter(s => s.nisn !== siswa.nisn);
            setSelectedStudents(newStudents);
            notifyChange(newNisns, newStudents);
        } else {
            // Check
            const newNisns = [...selectedNisns, siswa.nisn];
            const newStudents = [...selectedStudents, siswa];
            setSelectedStudents(newStudents);
            notifyChange(newNisns, newStudents);
        }
    };

    const removeStudent = (nisn: string) => {
        const newNisns = selectedNisns.filter(n => n !== nisn);
        const newStudents = selectedStudents.filter(s => s.nisn !== nisn);
        setSelectedStudents(newStudents);
        notifyChange(newNisns, newStudents);
    };

    const toggleDropdown = (e: React.MouseEvent) => {
        // Prevent toggle if clicking specifically on the input (let input focus handle it or stay open)
        if ((e.target as HTMLElement).tagName === 'INPUT') {
            if (!showDropdown) setShowDropdown(true);
            return;
        }
        setShowDropdown(!showDropdown);
        if (!showDropdown) searchSiswa(); // Refresh list on open
    };

    return (
        <div className="student-select-wrapper" ref={wrapperRef}>

            {/* 1. Class Filter & Trigger */}
            <div className="control-row">
                <select
                    className="form-select class-select"
                    value={selectedClass}
                    onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setShowDropdown(true); // Auto open results when class changes
                    }}
                >
                    <option value="">Semua Kelas</option>
                    {availableClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                    ))}
                </select>

                <div className="search-trigger" onClick={toggleDropdown}>
                    <input
                        type="text"
                        placeholder={selectedClass ? `Cari siswa di ${selectedClass}...` : "Cari nama / NISN..."}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="trigger-input"
                        onClick={(e) => {
                            e.stopPropagation(); // Stop bubble to wrapper
                            if (!showDropdown) setShowDropdown(true);
                        }}
                    />
                    <div className="trigger-icon">
                        {loading ? <div className="spinner-xs"></div> : <i className="bi bi-chevron-down"></i>}
                    </div>
                </div>
            </div>

            {/* 2. Dropdown List */}
            {showDropdown && (
                <div className={`student-dropdown ${dropUp ? 'drop-up' : 'drop-down'}`}>
                    {results.length === 0 ? (
                        <div className="empty-state">Tidak ada data ditemukan</div>
                    ) : (
                        results.map(siswa => {
                            const isSelected = selectedNisns.includes(siswa.nisn);
                            return (
                                <div
                                    key={siswa.id}
                                    className={`student-option ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelect(siswa)}
                                >
                                    <div className={`checkbox-custom ${isSelected ? 'checked' : ''}`}>
                                        {isSelected && <i className="bi bi-check"></i>}
                                    </div>
                                    <div className="student-info">
                                        <div className="student-name">{siswa.nama_siswa}</div>
                                        <div className="student-meta">{siswa.nisn} • {siswa.kelas}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* 3. Selected Chips (Below) */}
            {selectedStudents.length > 0 && (
                <div className="selected-list">
                    <div className="selected-label">Terpilih: {selectedStudents.length} Siswa</div>
                    <div className="chips-grid">
                        {selectedStudents.map(s => (
                            <div key={s.id} className="student-chip">
                                <span>{s.nama_siswa}</span>
                                <button onClick={() => removeStudent(s.nisn)} className="remove-chip">×</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style jsx>{`
        .student-select-wrapper {
          position: relative;
          color: var(--n-text);
        }

        .control-row {
          display: flex;
          gap: 10px;
        }

        .class-select {
          width: 140px;
          flex-shrink: 0;
          border: 1px solid var(--n-border);
          border-radius: 8px;
          font-size: 0.9rem;
          color: var(--n-text);
          background-color: var(--n-surface);
          cursor: pointer;
        }

        .search-trigger {
          flex: 1;
          display: flex;
          align-items: center;
          border: 1px solid var(--n-border);
          border-radius: 8px;
          padding: 0 12px;
          background-color: var(--n-surface);
          cursor: pointer;
          transition: all 0.2s;
        }

        .search-trigger:hover, .search-trigger:focus-within {
          border-color: #3aa6ff;
          box-shadow: 0 0 0 2px rgba(58, 166, 255, 0.1);
        }

        .trigger-input {
          flex: 1;
          border: none;
          outline: none;
          padding: 10px 0;
          font-size: 0.9rem;
          color: var(--n-text);
          background: transparent;
        }

        .trigger-input::placeholder {
           color: var(--n-muted);
        }

        .trigger-icon {
          color: var(--n-muted);
          font-size: 0.75rem;
          margin-left: 8px;
          display: flex;
          align-items: center;
        }

        .student-dropdown {
          position: absolute;
          left: 0;
          right: 0;
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #cbd5e1);
          border-radius: 12px;
          box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.25), 0 8px 16px -4px rgba(0, 0, 0, 0.12);
          max-height: 230px;
          overflow-y: auto;
          z-index: 9999;
        }

        .student-dropdown.drop-up {
          bottom: 100%;
          margin-bottom: 6px;
        }

        .student-dropdown.drop-down {
          top: 100%;
          margin-top: 6px;
        }

        .student-option {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid var(--n-border);
          cursor: pointer;
          transition: background 0.1s;
        }

        .student-option:hover {
          background: var(--n-soft);
        }

        .student-option.selected {
          background: #eff6ff;
        }

        .checkbox-custom {
          width: 20px;
          height: 20px;
          border: 2px solid #cbd5e1;
          border-radius: 6px;
          margin-right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: white;
          transition: all 0.2s;
          background: var(--n-card);
        }

        .checkbox-custom.checked {
          background: #3aa6ff;
          border-color: #3aa6ff;
        }

        .student-info { 
           flex: 1;
        }

        .student-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--n-text);
        }

        .student-meta {
          font-size: 0.75rem;
          color: var(--n-muted);
        }

        .empty-state {
          padding: 20px;
          text-align: center;
          color: var(--n-muted);
          font-size: 0.9rem;
        }

        .selected-list {
          margin-top: 12px;
        }

        .selected-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--n-muted);
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

        .spinner-xs {
          width: 14px;
          height: 14px;
          border: 2px solid #cbd5e1;
          border-top-color: #3aa6ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .control-row {
            flex-direction: column;
            gap: 6px;
          }
          .class-select {
            width: 100%;
          }
          .search-trigger {
            padding: 0 10px;
          }
          .student-dropdown {
            left: 0;
            right: 0;
          }
        }
      `}</style>
        </div>
    );
}
