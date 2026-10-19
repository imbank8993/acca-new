'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { RiArrowDropDownFill } from 'react-icons/ri';
import type { Option } from '@/components/ui/SearchableSelect';

interface PesertaRapatSelectProps {
    value: string;
    onChange: (val: string) => void;
    guruOptions: Option[];
    stafOptions: Option[];
    siswaOptions?: Option[];
    disabled?: boolean;
}

const PRESET_OPTIONS = [
    { key: 'Semua Guru', label: 'Semua Guru', icon: 'bi-people-fill', desc: 'Seluruh dewan guru', type: 'guru-all' },
    { key: 'Semua Staf', label: 'Semua Staf', icon: 'bi-building-fill', desc: 'Seluruh tenaga kependidikan & staf', type: 'staf-all' },
    { key: 'Semua Siswa', label: 'Semua Siswa', icon: 'bi-mortarboard-fill', desc: 'Seluruh siswa madrasah', type: 'siswa-all' },
] as const;

export default function PesertaRapatSelect({
    value,
    onChange,
    guruOptions = [],
    stafOptions = [],
    siswaOptions = [],
    disabled = false,
}: PesertaRapatSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isFreeTextMode, setIsFreeTextMode] = useState(false);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Parse value string (comma separated) into tokens
    const selectedTokens = useMemo(() => {
        if (!value || typeof value !== 'string') return [];
        return value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }, [value]);

    const updateTokens = useCallback((tokens: string[]) => {
        // deduplicate while preserving order
        const unique = Array.from(new Set(tokens.map(t => t.trim()).filter(Boolean)));
        onChange(unique.join(', '));
    }, [onChange]);

    const toggleToken = useCallback((token: string) => {
        const clean = token.trim();
        if (!clean) return;
        const exists = selectedTokens.includes(clean);
        if (exists) {
            updateTokens(selectedTokens.filter(t => t !== clean));
        } else {
            updateTokens([...selectedTokens, clean]);
        }
    }, [selectedTokens, updateTokens]);

    const addToken = useCallback((token: string) => {
        const clean = token.trim();
        if (!clean) return;
        if (!selectedTokens.includes(clean)) {
            updateTokens([...selectedTokens, clean]);
        }
    }, [selectedTokens, updateTokens]);

    const removeToken = useCallback((token: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        updateTokens(selectedTokens.filter(t => t !== token));
    }, [selectedTokens, updateTokens]);

    // Handle outside clicks
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Filter options based on search
    const q = search.trim().toLowerCase();

    const filteredGuru = useMemo(() => {
        if (!q) return guruOptions;
        return guruOptions.filter(o =>
            o.label.toLowerCase().includes(q) || (o.subLabel && o.subLabel.toLowerCase().includes(q))
        );
    }, [guruOptions, q]);

    const filteredStaf = useMemo(() => {
        if (!q) return stafOptions;
        return stafOptions.filter(o =>
            o.label.toLowerCase().includes(q) || (o.subLabel && o.subLabel.toLowerCase().includes(q))
        );
    }, [stafOptions, q]);

    const filteredSiswa = useMemo(() => {
        if (!q) return siswaOptions;
        return siswaOptions.filter(o =>
            o.label.toLowerCase().includes(q) || (o.subLabel && o.subLabel.toLowerCase().includes(q))
        );
    }, [siswaOptions, q]);

    const isExactMatch = useMemo(() => {
        if (!q) return false;
        if (PRESET_OPTIONS.some(p => p.key.toLowerCase() === q)) return true;
        if (guruOptions.some(g => g.label.toLowerCase() === q)) return true;
        if (stafOptions.some(s => s.label.toLowerCase() === q)) return true;
        if (siswaOptions.some(s => s.label.toLowerCase() === q)) return true;
        return false;
    }, [q, guruOptions, stafOptions, siswaOptions]);

    const handleAddManual = () => {
        const clean = search.trim();
        if (clean) {
            addToken(clean);
            setSearch('');
            searchInputRef.current?.focus();
        }
    };

    const handleSelectAllGuru = () => {
        toggleToken('Semua Guru');
    };

    const handleSelectAllStaf = () => {
        toggleToken('Semua Staf');
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateTokens([]);
        setSearch('');
    };

    const getBadgeStyle = (token: string) => {
        if (token === 'Semua Guru') return 'prs-chip prs-chip--guru-all';
        if (token === 'Semua Staf') return 'prs-chip prs-chip--staf-all';
        if (token === 'Semua Siswa') return 'prs-chip prs-chip--siswa-all';
        return 'prs-chip prs-chip--normal';
    };

    return (
        <div ref={wrapperRef} className={`prs-wrapper ${disabled ? 'prs--disabled' : ''}`}>
            {/* Quick Actions / Preset Pills Toolbar */}
            <div className="prs-presets-row">
                <span className="prs-presets-title">Opsi Cepat:</span>
                <div className="prs-presets-group">
                    {PRESET_OPTIONS.map(preset => {
                        const active = selectedTokens.includes(preset.key);
                        return (
                            <button
                                key={preset.key}
                                type="button"
                                disabled={disabled}
                                onClick={() => toggleToken(preset.key)}
                                className={`prs-preset-btn prs-preset-btn--${preset.type} ${active ? 'is-active' : ''}`}
                                title={preset.desc}
                            >
                                <i className={`bi ${active ? 'bi-check-circle-fill' : preset.icon}`} />
                                <span>{preset.label}</span>
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    className="prs-mode-btn"
                    onClick={() => setIsFreeTextMode(prev => !prev)}
                    title={isFreeTextMode ? 'Beralih ke mode pilihan / tag' : 'Ketik kalimat panjang secara manual'}
                >
                    <i className={`bi ${isFreeTextMode ? 'bi-tags-fill' : 'bi-pencil-square'}`} />
                    <span>{isFreeTextMode ? 'Mode Pilihan' : 'Ketik Manual'}</span>
                </button>
            </div>

            {isFreeTextMode ? (
                /* Free-text input mode for manual custom typing */
                <div className="prs-freetext-box">
                    <input
                        type="text"
                        className="nr-form-input prs-freetext-input"
                        placeholder="Contoh: Seluruh Guru & Staf, 10 Orang Pengurus OSIS, Komite Madrasah"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        disabled={disabled}
                    />
                    <span className="prs-freetext-hint">
                        <i className="bi bi-info-circle" /> Anda sedang dalam mode ketik manual bebas. Pisahkan nama dengan koma jika ada lebih dari satu peserta.
                    </span>
                </div>
            ) : (
                /* MultiSelect Dropdown with Tag Chips and Search */
                <div className={`prs-container ${isOpen ? 'is-open' : ''}`}>
                    {/* Trigger Box with Selected Chips */}
                    <div
                        className="prs-trigger"
                        onClick={() => {
                            if (disabled) return;
                            setIsOpen(prev => !prev);
                            if (!isOpen) {
                                setTimeout(() => searchInputRef.current?.focus(), 50);
                            }
                        }}
                    >
                        <div className="prs-chips-list">
                            {selectedTokens.length === 0 ? (
                                <span className="prs-placeholder">
                                    Pilih dari master guru/staf atau opsi cepat di atas...
                                </span>
                            ) : (
                                selectedTokens.map(token => (
                                    <span key={token} className={getBadgeStyle(token)}>
                                        <span className="prs-chip-text">{token}</span>
                                        {!disabled && (
                                            <button
                                                type="button"
                                                className="prs-chip-remove"
                                                onClick={e => removeToken(token, e)}
                                                title={`Hapus ${token}`}
                                            >
                                                <i className="bi bi-x" />
                                            </button>
                                        )}
                                    </span>
                                ))
                            )}
                        </div>

                        <div className="prs-trigger-actions">
                            {selectedTokens.length > 0 && !disabled && (
                                <button
                                    type="button"
                                    className="prs-clear-all-btn"
                                    onClick={handleClearAll}
                                    title="Kosongkan semua peserta"
                                >
                                    <i className="bi bi-x-circle-fill" />
                                </button>
                            )}
                            <RiArrowDropDownFill
                                size={22}
                                className={`prs-chevron ${isOpen ? 'rot' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Dropdown Menu Portal */}
                    {isOpen && (
                        <div className="prs-dropdown" role="listbox">
                            {/* Search bar inside dropdown */}
                            <div className="prs-search-bar" onClick={e => e.stopPropagation()}>
                                <i className="bi bi-search prs-search-icon" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="prs-search-input"
                                    placeholder="Cari nama guru, staf, siswa, atau ketik nama peserta manual..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddManual();
                                        }
                                    }}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        className="prs-search-clear"
                                        onClick={() => setSearch('')}
                                    >
                                        <i className="bi bi-x-circle-fill" />
                                    </button>
                                )}
                            </div>

                            {/* Manual typing action button if search has input */}
                            {search.trim() && !isExactMatch && (
                                <button
                                    type="button"
                                    className="prs-item prs-item--manual"
                                    onClick={handleAddManual}
                                >
                                    <i className="bi bi-plus-circle-fill prs-item-manual-icon" />
                                    <div className="prs-item-info">
                                        <div className="prs-item-name" style={{ color: '#2563eb' }}>
                                            Tambah peserta manual: <strong>"{search.trim()}"</strong>
                                        </div>
                                        <div className="prs-item-sub">Tekan Enter atau klik untuk menambahkan nama ini</div>
                                    </div>
                                </button>
                            )}

                            {/* Scrollable list */}
                            <div className="prs-scroll-list">
                                {/* Group: Opsi Cepat */}
                                <div className="prs-group-header">
                                    <i className="bi bi-lightning-charge-fill" />
                                    <span>Opsi Grup / Kategori Umum</span>
                                </div>
                                <div className="prs-group-items">
                                    {PRESET_OPTIONS.map(preset => {
                                        const isSelected = selectedTokens.includes(preset.key);
                                        return (
                                            <button
                                                key={preset.key}
                                                type="button"
                                                className={`prs-item ${isSelected ? 'is-selected' : ''}`}
                                                onClick={() => toggleToken(preset.key)}
                                            >
                                                <span className={`prs-item-check ${isSelected ? 'is-checked' : ''}`}>
                                                    {isSelected && <i className="bi bi-check-lg" />}
                                                </span>
                                                <div className="prs-item-info">
                                                    <div className="prs-item-name">{preset.label}</div>
                                                    <div className="prs-item-sub">{preset.desc}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Group: Dewan Guru */}
                                {filteredGuru.length > 0 && (
                                    <>
                                        <div className="prs-group-header">
                                            <i className="bi bi-person-badge" />
                                            <span>Dewan Guru ({filteredGuru.length})</span>
                                        </div>
                                        <div className="prs-group-items">
                                            {filteredGuru.map(g => {
                                                const isSelected = selectedTokens.includes(String(g.value));
                                                return (
                                                    <button
                                                        key={g.value}
                                                        type="button"
                                                        className={`prs-item ${isSelected ? 'is-selected' : ''}`}
                                                        onClick={() => toggleToken(String(g.value))}
                                                    >
                                                        <span className={`prs-item-check ${isSelected ? 'is-checked' : ''}`}>
                                                            {isSelected && <i className="bi bi-check-lg" />}
                                                        </span>
                                                        <div className="prs-item-info">
                                                            <div className="prs-item-name">{g.label}</div>
                                                            {g.subLabel && <div className="prs-item-sub">{g.subLabel}</div>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* Group: Tenaga Kependidikan / Staf */}
                                {filteredStaf.length > 0 && (
                                    <>
                                        <div className="prs-group-header">
                                            <i className="bi bi-briefcase" />
                                            <span>Tenaga Kependidikan / Staf ({filteredStaf.length})</span>
                                        </div>
                                        <div className="prs-group-items">
                                            {filteredStaf.map(s => {
                                                const isSelected = selectedTokens.includes(String(s.value));
                                                return (
                                                    <button
                                                        key={s.value}
                                                        type="button"
                                                        className={`prs-item ${isSelected ? 'is-selected' : ''}`}
                                                        onClick={() => toggleToken(String(s.value))}
                                                    >
                                                        <span className={`prs-item-check ${isSelected ? 'is-checked' : ''}`}>
                                                            {isSelected && <i className="bi bi-check-lg" />}
                                                        </span>
                                                        <div className="prs-item-info">
                                                            <div className="prs-item-name">{s.label}</div>
                                                            {s.subLabel && <div className="prs-item-sub">{s.subLabel}</div>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* Group: Siswa (if searched or available) */}
                                {filteredSiswa.length > 0 && q.length > 1 && (
                                    <>
                                        <div className="prs-group-header">
                                            <i className="bi bi-mortarboard" />
                                            <span>Siswa ({filteredSiswa.length})</span>
                                        </div>
                                        <div className="prs-group-items">
                                            {filteredSiswa.slice(0, 30).map(s => {
                                                const isSelected = selectedTokens.includes(String(s.value));
                                                return (
                                                    <button
                                                        key={s.value}
                                                        type="button"
                                                        className={`prs-item ${isSelected ? 'is-selected' : ''}`}
                                                        onClick={() => toggleToken(String(s.value))}
                                                    >
                                                        <span className={`prs-item-check ${isSelected ? 'is-checked' : ''}`}>
                                                            {isSelected && <i className="bi bi-check-lg" />}
                                                        </span>
                                                        <div className="prs-item-info">
                                                            <div className="prs-item-name">{s.label}</div>
                                                            {s.subLabel && <div className="prs-item-sub">{s.subLabel}</div>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {filteredGuru.length === 0 && filteredStaf.length === 0 && (!search || !search.trim()) && (
                                    <div className="prs-empty">
                                        <i className="bi bi-inbox" />
                                        <span>Data master guru dan staf sedang dimuat...</span>
                                    </div>
                                )}
                            </div>

                            {/* Dropdown Bottom Bar */}
                            <div className="prs-dropdown-footer">
                                <span>{selectedTokens.length} peserta terpilih</span>
                                <div className="prs-footer-actions">
                                    <button
                                        type="button"
                                        className="prs-footer-btn"
                                        onClick={handleSelectAllGuru}
                                    >
                                        + Semua Guru
                                    </button>
                                    <button
                                        type="button"
                                        className="prs-footer-btn"
                                        onClick={handleSelectAllStaf}
                                    >
                                        + Semua Staf
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
