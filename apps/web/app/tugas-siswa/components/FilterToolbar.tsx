'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import SearchableSelect from '@/components/ui/SearchableSelect';
import DatePicker from '@/components/ui/DatePicker';

/**
 * Nilai semu untuk opsi "Tahun Ajaran Aktif" — mewakili seluruh tahun ajaran
 * yang berstatus AKTIF di Master > Tahun Ajaran (bisa lebih dari satu).
 */
export const TA_AKTIF = '__AKTIF__';

interface MasterData {
    guru: { guru_id: string; nama_lengkap: string }[];
    mapel: { id: number; kode: string; nama: string }[];
    kelas: { id: number; nama: string; tingkat: number }[];
}

interface FilterToolbarProps {
    masterData: MasterData;
    filters: {
        kelas: string;
        guru: string;
        mapel: string;
        search: string;
        tanggalAwal?: string;
        tanggalAkhir?: string;
        jenis?: string;
        tahunAjaran?: string;
    };
    onFilterChange: (key: string, value: string) => void;
    onReset: () => void;
    isAdmin: boolean;
    isSiswa?: boolean;
    userKelas?: string[];
    /** Tahun ajaran aktif, terbaru dulu (dari useTahunAjaranFilter). */
    tahunAjaranList?: string[];
}

export default function FilterToolbar({
    masterData,
    filters,
    onFilterChange,
    onReset,
    isAdmin,
    isSiswa = false,
    userKelas = [],
    tahunAjaranList = []
}: FilterToolbarProps) {
    const [localSearch, setLocalSearch] = useState(filters.search || '');

    // Debounce search input to prevent immediate heavy fetch on every keystroke
    useEffect(() => {
        const handler = setTimeout(() => {
            if (localSearch !== filters.search) {
                onFilterChange('search', localSearch);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [localSearch, filters.search, onFilterChange]);

    // Sync localSearch when filters.search is reset or changed from parent
    useEffect(() => {
        setLocalSearch(filters.search || '');
    }, [filters.search]);

    const guruOptions = [
        { value: '', label: 'Semua Guru' },
        ...(masterData?.guru || []).map(g => ({ value: g.nama_lengkap, label: g.nama_lengkap }))
    ];

    const mapelOptions = [
        { value: '', label: 'Semua Mapel' },
        ...(masterData?.mapel || []).map(m => ({ value: m.nama, label: `${m.nama} (${m.kode})` }))
    ];

    const kelasOptions = [
        { value: '', label: 'Semua Kelas' },
        ...(isSiswa && userKelas.length > 0
            ? userKelas.map(k => ({ value: k, label: k }))
            : (masterData?.kelas || []).map(k => ({ value: k.nama, label: k.nama })))
    ];

    const tipeOptions = [
        { value: '', label: 'Semua Tipe' },
        { value: 'tugas', label: 'Tugas' },
        { value: 'pengingat', label: 'Pengingat' }
    ];

    // Isi dropdown mengikuti Master > Tahun Ajaran:
    // - 2 tahun aktif atau lebih → "Semua" + satu opsi per tahun aktif
    // - hanya 1 tahun aktif      → langsung tahun itu saja, tanpa "Semua"
    //   (tidak ada yang perlu dipilih, jadi tidak perlu ditawarkan)
    const tahunAjaranOptions = tahunAjaranList.length <= 1
        ? tahunAjaranList.map(t => ({ value: t, label: t }))
        : [
            { value: TA_AKTIF, label: 'Semua' },
            ...tahunAjaranList.map(t => ({ value: t, label: t }))
        ];

    // Saat cuma ada 1 tahun aktif, nilai default TA_AKTIF ditampilkan sebagai
    // tahun itu sendiri — hasil query-nya memang sama.
    const tahunAjaranValue = filters.tahunAjaran === TA_AKTIF && tahunAjaranList.length === 1
        ? tahunAjaranList[0]
        : (filters.tahunAjaran ?? TA_AKTIF);

    const hasActiveFilters = filters.kelas || filters.guru || filters.mapel || filters.search
        || filters.tanggalAwal || filters.jenis
        || (filters.tahunAjaran !== undefined && filters.tahunAjaran !== TA_AKTIF);

    return (
        <div className="ft__container">
            {/* Baris 1 — pencarian, rentang tanggal, reset */}
            <div className="ft__rowTop">
                <div className="ft__searchSection">
                    <label className="ft__label">Pencarian</label>
                    <div className="ft__searchWrap">
                        <i className="bi bi-search ft__searchIcon"></i>
                        <input
                            type="text"
                            className="ft__search"
                            placeholder="Cari judul atau deskripsi tugas..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                        />
                        {localSearch && (
                            <button className="ft__clearSearch" onClick={() => setLocalSearch('')} title="Hapus pencarian">
                                <i className="bi bi-x"></i>
                            </button>
                        )}
                    </div>
                </div>

                <div className="ft__taGroup">
                    <SearchableSelect
                        label="Tahun Ajaran"
                        options={tahunAjaranOptions}
                        value={tahunAjaranValue}
                        onChange={(val) => onFilterChange('tahunAjaran', String(val))}
                        placeholder="Semua"
                    />
                </div>

                <div className="ft__dateGroup">
                    <label className="ft__label">Tanggal</label>
                    <div className="ft__dateRangeCompact">
                        <DatePicker
                            className="ft__dateInput"
                            value={filters.tanggalAwal || ''}
                            onChange={(v) => onFilterChange('tanggalAwal', v)}
                            title="Tanggal awal"
                        />
                        {filters.tanggalAwal && (
                            <>
                                <span className="ft__dateSep">—</span>
                                <DatePicker
                                    className="ft__dateInput"
                                    value={filters.tanggalAkhir || ''}
                                    onChange={(v) => onFilterChange('tanggalAkhir', v)}
                                    min={filters.tanggalAwal}
                                    title="Tanggal akhir"
                                />
                                <button
                                    className="ft__clearDate"
                                    onClick={() => {
                                        onFilterChange('tanggalAwal', '');
                                        onFilterChange('tanggalAkhir', '');
                                    }}
                                    title="Hapus filter tanggal"
                                >
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {hasActiveFilters && (
                    <button className="ft__resetBtn" onClick={onReset} title="Reset semua filter">
                        <i className="bi bi-arrow-counterclockwise"></i>
                        <span className="ft__resetLabel">Reset</span>
                    </button>
                )}
            </div>

            {/* Baris 2 — dropdown filter */}
            <div className="ft__rowSelects">
                <div className="ft__selectGroup">
                    <SearchableSelect
                        label="Kelas"
                        options={kelasOptions}
                        value={filters.kelas}
                        onChange={(val) => onFilterChange('kelas', String(val))}
                        placeholder="Semua Kelas"
                    />
                </div>

                <div className="ft__selectGroup">
                    <SearchableSelect
                        label="Guru"
                        options={guruOptions}
                        value={filters.guru}
                        onChange={(val) => onFilterChange('guru', String(val))}
                        placeholder="Semua Guru"
                    />
                </div>

                <div className="ft__selectGroup">
                    <SearchableSelect
                        label="Mapel"
                        options={mapelOptions}
                        value={filters.mapel}
                        onChange={(val) => onFilterChange('mapel', String(val))}
                        placeholder="Semua Mapel"
                    />
                </div>

                <div className="ft__selectGroup">
                    <SearchableSelect
                        label="Tipe"
                        options={tipeOptions}
                        value={filters.jenis || ''}
                        onChange={(val) => onFilterChange('jenis', String(val))}
                        placeholder="Semua Tipe"
                    />
                </div>
            </div>

            <style jsx>{`
                .ft__container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding: 20px;
                    /* backdrop-filter membuat stacking context sendiri, jadi z-index
                       dropdown di dalamnya tidak bisa naik melewati kartu tabel di
                       bawahnya — elemen tabel (badge kelas, tombol centang) menembus
                       ke atas dropdown. Angkat seluruh toolbar-nya. */
                    position: relative;
                    z-index: 30;
                    background: linear-gradient(to bottom right, var(--n-card), rgba(255,255,255,0.8));
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    border: 1px solid var(--n-border);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
                    transition: all 0.3s ease;
                }

                :global(.dark) .ft__container {
                    background: linear-gradient(to bottom right, #1a2235, #111827);
                    border-color: rgba(255,255,255,0.08);
                }

                /* Tata letak 2 baris:
                   Baris 1 — pencarian (melar) + tahun ajaran + tanggal + reset
                   Baris 2 — 4 dropdown filter dengan lebar sama rata.
                   Tahun ajaran sengaja ditaruh di baris atas: pilihannya cuma dua
                   dan jarang diubah, jadi baris bawah bisa dibagi 4 (bukan 5) dan
                   kolom Kelas/Mapel dapat ruang lebih lebar.                     */
                .ft__rowTop {
                    display: flex;
                    align-items: flex-end;
                    gap: 12px;
                }

                .ft__searchSection {
                    flex: 1 1 auto;
                    min-width: 0;
                }

                .ft__taGroup {
                    flex: 0 0 200px;
                }

                .ft__dateGroup {
                    flex: 0 0 auto;
                }

                .ft__rowSelects {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 10px;
                }

                .ft__selectGroup {
                    min-width: 0;
                }

                /* Label seragam untuk pencarian & tanggal — mengikuti gaya label
                   bawaan SearchableSelect supaya satu baris terlihat sejajar. */
                .ft__label {
                    display: block;
                    margin: 0 0 6px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: rgba(15, 23, 42, 0.8);
                }

                :global(.dark) .ft__label { color: #cbd5e1; }

                /* Tablet: pencarian ambil satu baris penuh, tahun ajaran +
                   tanggal + reset turun ke baris berikutnya. Tahun ajaran tetap
                   dikunci 200px — kalau dibiarkan melar, dropdown dua pilihan
                   itu jadi selebar setengah layar dan terlihat janggal. */
                @media (max-width: 1100px) {
                    .ft__rowTop { flex-wrap: wrap; }
                    .ft__searchSection { flex: 1 1 100%; }
                }

                @media (max-width: 900px) {
                    .ft__rowSelects { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }


                .ft__searchWrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                    width: 100%;
                }

                .ft__searchIcon {
                    position: absolute;
                    left: 16px;
                    color: var(--n-muted);
                    font-size: 1rem;
                    pointer-events: none;
                    transition: color 0.2s ease;
                }

                .ft__search {
                    width: 100%;
                    height: 38px;
                    padding: 0 44px 0 48px;
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    font-size: 0.9rem;
                    background: rgba(255,255,255,0.8);
                    color: var(--n-ink);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }

                .ft__search:focus {
                    outline: none;
                    border-color: var(--n-primary);
                    background: #fff;
                    box-shadow: 0 0 0 4px rgba(0,63,136,0.1), inset 0 2px 4px rgba(0,0,0,0.01);
                }

                .ft__search:focus + .ft__searchIcon {
                    color: var(--n-primary);
                }

                .ft__search::placeholder {
                    color: var(--n-muted);
                    opacity: 0.7;
                }

                .ft__clearSearch {
                    position: absolute;
                    right: 12px;
                    background: rgba(0,0,0,0.05);
                    border: none;
                    color: var(--n-muted);
                    cursor: pointer;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .ft__clearSearch:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #dc2626;
                }

                .ft__dateRangeCompact {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .ft__dateInput {
                    height: 38px;
                    padding: 0 12px;
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    font-size: 0.85rem;
                    background: rgba(255,255,255,0.8);
                    color: var(--n-ink);
                    transition: all 0.3s ease;
                    width: 150px;
                    cursor: pointer;
                }

                .ft__dateInput:focus {
                    outline: none;
                    border-color: var(--n-primary);
                    background: #fff;
                    box-shadow: 0 0 0 4px rgba(0,63,136,0.1);
                }

                .ft__dateSep {
                    color: var(--n-muted);
                    font-size: 0.9rem;
                    font-weight: 600;
                }

                .ft__clearDate {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    background: rgba(239,68,68,0.1);
                    border: 1px solid rgba(239,68,68,0.2);
                    border-radius: 10px;
                    color: #dc2626;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ft__container :global(.ss__trigger) {
                    height: 38px !important;
                }

                .ft__clearDate:hover {
                    background: #dc2626;
                    color: white;
                    transform: scale(1.05);
                }

                .ft__resetBtn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    height: 38px;
                    flex-shrink: 0;
                    padding: 0 14px;
                    background: rgba(239, 68, 68, 0.08);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 10px;
                    color: #dc2626;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s, color 0.2s, border-color 0.2s;
                }

                .ft__resetBtn i { font-size: 0.95rem; }

                /* Selalu menempel ke kanan, termasuk saat barisnya membungkus */
                .ft__resetBtn { margin-left: auto; }

                .ft__resetBtn:hover {
                    background: #dc2626;
                    color: white;
                    border-color: #dc2626;
                }

                /* Mobile: pencarian sebaris penuh, lalu tahun ajaran + tanggal,
                   lalu 4 dropdown sisanya dalam 2 kolom. */
                @media (max-width: 768px) {
                    .ft__container { padding: 14px; gap: 12px; }

                    .ft__rowTop { flex-wrap: wrap; gap: 10px; }
                    .ft__searchSection { flex: 1 1 100%; }
                    /* Tahun ajaran & tanggal berbagi satu baris supaya toolbar
                       tidak menghabiskan terlalu banyak layar ponsel. */
                    .ft__taGroup { flex: 1 1 140px; }
                    .ft__dateGroup { flex: 1 1 140px; min-width: 0; }

                    .ft__dateRangeCompact { flex-wrap: wrap; }
                    .ft__dateInput { width: auto; flex: 1 1 130px; min-width: 0; }
                    .ft__dateSep { display: none; }

                    .ft__rowSelects {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 8px;
                    }
                }

                /* Dark Mode Overrides */
                :global(.dark) .ft__search {
                    background: rgba(30,41,59,0.7);
                    border-color: rgba(255,255,255,0.1);
                    color: #e2e8f0;
                }
                :global(.dark) .ft__search:focus {
                    background: rgba(30,41,59,0.9);
                    border-color: var(--n-primary);
                }
                :global(.dark) .ft__dateInput {
                    background: rgba(30,41,59,0.7);
                    border-color: rgba(255,255,255,0.1);
                    color: #e2e8f0;
                }
                :global(.dark) .ft__dateInput:focus {
                    background: rgba(30,41,59,0.9);
                }
                :global(.dark) .ft__clearSearch {
                    background: rgba(255,255,255,0.05);
                }

                /* -- Dark Mode: pola referensi master/pengaturan-data.
                   Palet biru bersama (sama di semua halaman): aksen #60a5fa
                   diletakkan paling akhir agar menang atas aturan dark di
                   atasnya (urutan cascade + !important). -- */
                :global(.dark) .ft__container { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 16px !important; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important; }
                :global(.dark) .ft__label { color: #94a3b8 !important; }
                :global(.dark) .ft__search, :global(.dark) .ft__dateInput { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 12px !important; color: #ffffff !important; color-scheme: dark; }
                :global(.dark) .ft__search:focus, :global(.dark) .ft__dateInput:focus { border-color: #60a5fa !important; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2) !important; }
                :global(.dark) .ft__search::placeholder { color: #64748b !important; }
                :global(.dark) .ft__clearSearch { color: #94a3b8 !important; }
                :global(.dark) .ft__clearSearch:hover { color: #60a5fa !important; background: rgba(96, 165, 250, 0.15) !important; }
            `}</style>
        </div>
    );
}