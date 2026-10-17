'use client';

import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { Modal, ModalHeader, ModalBody, ModalViewFooter, ModalDetailGrid, ModalDetailField } from '@/components/ui/Modal';
import { exportToExcel } from '@/lib/excel-utils';
import { useTimezone } from '@/hooks/use-timezone';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { ActionGroup, ActionButton } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { isUserAdmin } from '@/lib/auth-client';

interface JurnalEntry {
    id: string;
    tanggal: string;
    hari: string;
    jam_ke: string;
    jam_ke_id?: string;
    mata_pelajaran: string;
    materi: string;
    refleksi?: string;
    nama_guru: string;
    guru_pengganti?: string;
    nip?: string;
    kategori_kehadiran: string;
    kelas: string;
    filled_by?: string;
    allIds?: number[];
}

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function WaliKelasTabJurnal({ user }: { user?: any }) {
    const [loading, setLoading] = useState(true);
    const [jurnals, setJurnals] = useState<JurnalEntry[]>([]);
    const [myClass, setMyClass] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(1);
    const [selectedJournal, setSelectedJournal] = useState<JurnalEntry | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter tahun ajaran (pilihan = tahun ajaran aktif); tahun kalender diturunkan
    // dari tahun ajaran + bulan (Jul-Des = tahun pertama, Jan-Jun = tahun kedua).
    const ta = useTahunAjaranFilter();
    const taStartYear = parseInt((ta.selected || '').split('/')[0]);
    const selectedYear = isNaN(taStartYear)
        ? new Date().getFullYear()
        : (selectedMonth >= 7 ? taStartYear : taStartYear + 1);
    const selectedSemester = selectedMonth >= 7 ? 'Ganjil' : 'Genap';

    const [allKelas, setAllKelas] = useState<string[]>([]);
    const [allWaktu, setAllWaktu] = useState<any[]>([]);
    const isAdmin = isUserAdmin(user);

    // Timezone
    const { getCurrentDate: getTzDate } = useTimezone();

    // Initialize month from timezone on mount (tahun mengikuti tahun ajaran terpilih)
    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            if (today) {
                const [, m] = today.split('-').map(Number);
                setSelectedMonth(m);
            }
        };
        init();
    }, [getTzDate]);

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const baseUrl = window.location.origin;
            const url = new URL('/api/wali-kelas/absensi-akumulasi', baseUrl);
            url.searchParams.append('mode', 'kelas_list');
            if (ta.selected) url.searchParams.append('tahun_ajaran', ta.selected);

            const [kelasRes, waktuRes] = await Promise.all([
                fetch(url.toString()),
                fetch('/api/master/waktu?limit=1000')
            ]);

            const [kelasJson, waktuJson] = await Promise.all([kelasRes.json(), waktuRes.json().catch(() => ({ ok: false, data: [] }))]);

            if (waktuJson.ok && waktuJson.data) {
                setAllWaktu(waktuJson.data);
            }

            if (kelasJson.ok && kelasJson.kelas_list) {
                const classes = kelasJson.kelas_list;

                if (isAdmin) {
                    setAllKelas(classes);
                    if (classes.length > 0) {
                        setMyClass(prev => (!prev || !classes.includes(prev) ? classes[0] : prev));
                    } else {
                        setMyClass('');
                    }
                } else {
                    const nipOrUser = user?.nip || user?.username || '';
                    let waliClasses: string[] = [];
                    if (nipOrUser && ta.selected) {
                        try {
                            const res = await fetch(`/api/settings/wali-kelas?nip=${encodeURIComponent(nipOrUser)}&tahun_ajaran=${encodeURIComponent(ta.selected)}`);
                            const data = await res.json();
                            if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
                                waliClasses = Array.from(new Set(data.data.map((w: any) => w.nama_kelas))) as string[];
                            }
                        } catch (e) {
                            console.error('Gagal memuat wali_kelas', e);
                        }
                    }
                    if (waliClasses.length > 0) {
                        setAllKelas(waliClasses);
                        setMyClass(prev => (!prev || !waliClasses.includes(prev) ? waliClasses[0] : prev));
                    } else if (classes.length > 0) {
                        setAllKelas(classes);
                        setMyClass(prev => (!prev || !classes.includes(prev) ? classes[0] : prev));
                    } else {
                        setAllKelas([]);
                        setMyClass('');
                    }
                }
            } else {
                setAllKelas([]);
                setMyClass('');
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [user?.nip, user?.username, isAdmin, ta.selected]);

    const loadJurnal = useCallback(async () => {
        if (!myClass) return;
        setLoading(true);
        try {
            const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            // A homeroom can split into parallel peminatan/UTBK groups per period — pull jurnal
            // for the homeroom itself PLUS every kelompok its students are also enrolled in, so
            // those sessions show up alongside the homeroom's own reguler sessions.
            let kelasParam = myClass;
            
            const peminatanKeywords = ['sosiologi', 'biologi', 'bahasa', 'ekonomi', 'fisika', 'kimia', 'geografi', 'informatika', 'matematika', 'sejarah', 'peminatan', 'program', 'lintas minat', 'lanjut', 'utbk'];
            const isReguler = !peminatanKeywords.some(k => myClass.toLowerCase().includes(k));

            if (isReguler) {
                try {
                    const relParams = new URLSearchParams({ related_kelas: myClass });
                    if (ta.selected) relParams.set('tahun_ajaran', ta.selected);
                    relParams.set('semester', selectedSemester);
                    const relRes = await fetch(`/api/settings/siswa-kelas?${relParams.toString()}`);
                    const relJson = await relRes.json();
                    if (relJson.ok && relJson.kelasList?.length > 0) {
                        kelasParam = relJson.kelasList.join(',');
                    }
                } catch (e) {
                    console.error('Gagal memuat kelas terkait, fallback ke homeroom saja', e);
                }
            }

            const res = await fetch(`/api/jurnal?kelas=${encodeURIComponent(kelasParam)}&startDate=${startDate}&endDate=${endDate}&limit=500`);
            const json = await res.json();
            if (json.ok || json.success) {
                setJurnals(json.data || []);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [myClass, selectedMonth, selectedYear, ta.selected, selectedSemester]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    useEffect(() => {
        if (myClass) loadJurnal();
    }, [myClass, loadJurnal]);

    const { registerModal } = useModalBlur();

    useEffect(() => {
        if (showDetailModal) return registerModal();
    }, [showDetailModal, registerModal]);

    // Dialog pilih bulan (multiselect). Return array bulan (kosong = semua) atau null bila batal.
    const askExportMonths = async (): Promise<number[] | null> => {
        const orderMonths = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]; // urutan tahun ajaran (Jul–Jun)
        const labelStyle = 'display:block;text-align:left;font-size:0.78rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;margin:16px 0 10px;';
        const hintStyle = 'display:block;text-align:left;font-size:0.75rem;color:#64748b;margin:14px 0 0;font-style:italic;';
        const infoStyle = 'display:flex;align-items:center;gap:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 14px;font-size:0.85rem;font-weight:600;color:#1e40af;';
        
        const styleBlock = `
            <style>
                .wkj-dropdown {
                    width: 100%;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    background: #fff;
                    position: relative;
                }
                .wkj-dropdown[open] {
                    border-color: #93c5fd;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                }
                .wkj-dropdown-summary {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 14px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #334155;
                    cursor: pointer;
                    list-style: none;
                    user-select: none;
                }
                .wkj-dropdown-summary::-webkit-details-marker {
                    display: none;
                }
                .wkj-dropdown-summary i {
                    transition: transform 0.2s ease;
                    color: #64748b;
                }
                .wkj-dropdown[open] .wkj-dropdown-summary i {
                    transform: rotate(180deg);
                }
                .wkj-dropdown-content {
                    border-top: 1px solid #e2e8f0;
                    padding: 12px;
                    max-height: 220px;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                    gap: 8px;
                }
                .wkj-dropdown-content::-webkit-scrollbar {
                    width: 6px;
                }
                .wkj-dropdown-content::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 4px;
                }
                .wkj-month-label {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 10px;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    user-select: none;
                    margin: 0;
                }
                .wkj-month-label:hover {
                    background: #f8fafc;
                }
                .wkj-month-label:has(input:checked) {
                    background: #eff6ff;
                    border-color: #bfdbfe;
                }
                .wkj-month-label input {
                    width: 16px;
                    height: 16px;
                    accent-color: #3083FF;
                    cursor: pointer;
                    margin: 0;
                }
                .wkj-month-label span {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: #475569;
                }
                .wkj-month-label:has(input:checked) span {
                    color: #3083FF;
                    font-weight: 600;
                }
            </style>
        `;

        const result = await Swal.fire({
            title: 'Export Jurnal',
            html: `
                ${styleBlock}
                <div style="text-align:left">
                    <div style="${infoStyle}"><i class="bi bi-mortarboard-fill"></i> Tahun Ajaran: ${ta.selected} · Kelas: ${myClass}</div>
                    <label style="${labelStyle}">Pilih Bulan</label>
                    
                    <details class="wkj-dropdown">
                        <summary class="wkj-dropdown-summary">
                            <span>Pilih bulan...</span>
                            <i class="bi bi-chevron-down"></i>
                        </summary>
                        <div class="wkj-dropdown-content">
                            ${orderMonths.map(m => `
                                <label class="wkj-month-label">
                                    <input type="checkbox" value="${m}" class="wkj-exp-cb">
                                    <span>${BULAN[m - 1]}</span>
                                </label>
                            `).join('')}
                        </div>
                    </details>

                    <span style="${hintStyle}"><i class="bi bi-info-circle" style="margin-right: 4px;"></i> Biarkan kosong untuk export semua bulan.</span>
                </div>
            `,
            didOpen: (popup) => {
                const details = popup.querySelector('.wkj-dropdown');
                if (!details) return;
                const summaryText = details.querySelector('.wkj-dropdown-summary span');
                const checkboxes = details.querySelectorAll<HTMLInputElement>('.wkj-exp-cb');

                const updateText = () => {
                    const checked = Array.from(checkboxes).filter(cb => cb.checked);
                    if (!summaryText) return;
                    if (checked.length === 0) {
                        summaryText.textContent = 'Pilih bulan...';
                    } else if (checked.length === checkboxes.length) {
                        summaryText.textContent = 'Semua Bulan Terpilih';
                    } else {
                        summaryText.textContent = checked.length + ' Bulan Terpilih';
                    }
                };

                checkboxes.forEach(cb => {
                    cb.addEventListener('change', updateText);
                });
            },
            showCancelButton: true,
            confirmButtonText: 'Export',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#10b981',
            width: '500px',
            focusConfirm: false,
            preConfirm: () => {
                const checkboxes = document.querySelectorAll('.wkj-exp-cb:checked') as NodeListOf<HTMLInputElement>;
                return Array.from(checkboxes).map(cb => parseInt(cb.value));
            }
        });
        if (!result.isConfirmed) return null;
        return (result.value || []) as number[];
    };

    const handleExport = async () => {
        if (!myClass || !ta.selected) return;
        const months = await askExportMonths();
        if (months === null) return; // batal

        // Export mengikuti tahun ajaran yang dipilih di toolbar; ambil satu tahun penuh
        // lalu saring ke bulan-bulan terpilih (multiselect).
        const yStart = parseInt(ta.selected.split('/')[0]);
        const startDate = `${yStart}-07-01`;
        const endDate = `${yStart + 1}-06-30`;

        Swal.fire({ title: 'Menyiapkan Data...', text: 'Mengambil jurnal tahun ajaran', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
        // Kelas terkait (reguler + peminatan) lintas semester → tanpa param semester.
        let kelasParam = myClass;
        const peminatanKeywords = ['sosiologi', 'biologi', 'bahasa', 'ekonomi', 'fisika', 'kimia', 'geografi', 'informatika', 'matematika', 'sejarah', 'peminatan', 'program', 'lintas minat', 'lanjut', 'utbk'];
        const isReguler = !peminatanKeywords.some(k => myClass.toLowerCase().includes(k));

        if (isReguler) {
            try {
                const relParams = new URLSearchParams({ related_kelas: myClass, tahun_ajaran: ta.selected });
                const relRes = await fetch(`/api/settings/siswa-kelas?${relParams.toString()}`);
                const relJson = await relRes.json();
                if (relJson.ok && relJson.kelasList?.length > 0) kelasParam = relJson.kelasList.join(',');
            } catch (e) { console.error('Gagal memuat kelas terkait, fallback ke homeroom saja', e); }
        }

            const res = await fetch(`/api/jurnal?kelas=${encodeURIComponent(kelasParam)}&startDate=${startDate}&endDate=${endDate}&limit=5000`);
            const json = await res.json();
            let rows: JurnalEntry[] = (json.ok || json.success) ? (json.data || []) : [];

            // Saring bulan (kosong = semua). Rentang di atas sudah membatasi ke tahun ajaran.
            if (months.length > 0) {
                const set = new Set(months);
                rows = rows.filter(j => set.has(parseInt(String(j.tanggal).split('-')[1])));
            }
            rows.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || (parseInt(a.jam_ke) || 0) - (parseInt(b.jam_ke) || 0));
            Swal.close();

            if (rows.length === 0) {
                Swal.fire('Info', 'Tidak ada data jurnal untuk kriteria ini.', 'info');
                return;
            }

            const formatExportDate = (dateStr?: string | null): string => {
                if (!dateStr) return '';
                const clean = String(dateStr).includes('T') ? String(dateStr).split('T')[0] : String(dateStr);
                const parts = clean.split('-');
                if (parts.length === 3) {
                    const [y, m, d] = parts;
                    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
                }
                return clean;
            };

            const data = rows.map((j, idx) => ({
                No: idx + 1,
                Hari: j.hari,
                Tanggal: formatExportDate(j.tanggal),
                Jam: j.jam_ke,
                Mapel: j.mata_pelajaran,
                Guru: j.nama_guru,
                'Guru Pengganti': j.guru_pengganti || '-',
                Materi: j.materi,
                Refleksi: j.refleksi || '',
                Kehadiran: j.kategori_kehadiran,
                'Diisi Oleh': j.filled_by || 'System'
            }));

            let fname = `Jurnal_Kelas_${myClass}_${ta.selected.replace('/', '-')}`;
            if (months.length === 1) fname += `_${BULAN[months[0] - 1]}`;
            else if (months.length > 1) fname += `_${months.length}bulan`;
            exportToExcel(data, fname);
        } catch (e: any) {
            Swal.close();
            Swal.fire('Error', e?.message || 'Gagal mengekspor jurnal', 'error');
        }
    };

    const getCategoryClass = (kategori: string) => {
        switch (kategori) {
            case 'Sesuai': return 'cat-on';
            case 'Terlambat': return 'cat-warning';
            case 'Diganti': return 'cat-info';
            default: return 'cat-off';
        }
    };

    const getTimeDisplay = (jurnal: any): string => {
        let jamStr = String(jurnal.jam_ke || '').trim();
        const parts = jamStr.split('-').map(s => s.trim());
        const startJam = parts[0];
        const endJam = parts.length > 1 ? parts[1] : startJam;
        const isNumeric = !isNaN(Number(startJam));
        if (isNumeric && allWaktu && allWaktu.length > 0) {
            const dayWaktu = allWaktu.filter((w: any) => 
                w.hari?.toLowerCase() === jurnal.hari?.toLowerCase()
            );
            const startSch = dayWaktu.find((w: any) => String(w.jam_ke) === startJam && w.program === 'Reguler')
                          || dayWaktu.find((w: any) => String(w.jam_ke) === startJam);
            const endSch = dayWaktu.find((w: any) => String(w.jam_ke) === endJam && w.program === (startSch?.program || 'Reguler'))
                        || dayWaktu.find((w: any) => String(w.jam_ke) === endJam);

            if (startSch?.mulai && endSch?.selesai) {
                const sMulai = String(startSch.mulai).includes('T') ? String(startSch.mulai).substring(11, 16) : String(startSch.mulai).slice(0, 5);
                const sSelesai = String(endSch.selesai).includes('T') ? String(endSch.selesai).substring(11, 16) : String(endSch.selesai).slice(0, 5);
                return `${sMulai} - ${sSelesai}`;
            }
        }
        return jamStr ? `Jam ${jamStr}` : '-';
    };

    const formatDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [y, m, d] = clean.split('-').map(Number);
        if (y && m && d) {
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        const dObj = new Date(dateStr);
        return isNaN(dObj.getTime()) ? dateStr : dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getFilledByLabel = (filled_by?: string) => {
        if (filled_by === 'SISWA') return 'Siswa';
        if (filled_by === 'GURU') return 'Guru';
        return 'System';
    };

    return (
        <div className="wkj-wrap">
            {/* Toolbar - Mobile Stack */}
            <FilterToolbar actionsInline>
                <FilterSelect
                    label="Tahun Ajaran"
                    icon="mortarboard"
                    value={ta.selected}
                    onChange={ta.setSelected}
                    title="Tahun Ajaran (aktif)"
                    options={ta.years.map(y => ({ value: y, label: `TA ${y}` }))}
                />
                <FilterSelect
                    label="Bulan"
                    icon="calendar-event"
                    value={String(selectedMonth)}
                    onChange={v => setSelectedMonth(parseInt(v))}
                    options={BULAN.map((b, i) => ({ value: String(i + 1), label: b }))}
                />
                {allKelas.length > 0 && (
                    <FilterSelect
                        label="Kelas"
                        icon="door-open"
                        value={myClass}
                        onChange={setMyClass}
                        options={allKelas.map(k => ({ value: k, label: k }))}
                    />
                )}
                <FilterSearch
                    label="Pencarian"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari guru, mapel, materi..."
                />
                <FilterActions>
                    <Button
                        variant="outline"
                        icon="export"
                        onClick={handleExport}
                        disabled={!myClass}
                        className="ftb-btn-icon-mobile"
                    >
                        Export
                    </Button>
                </FilterActions>
            </FilterToolbar>

            {/* Mobile Card List */}
            {(() => {
                const filteredJurnals = jurnals.filter(j => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (j.nama_guru || '').toLowerCase().includes(q) ||
                           (j.mata_pelajaran || '').toLowerCase().includes(q) ||
                           (j.materi || '').toLowerCase().includes(q) ||
                           (j.refleksi || '').toLowerCase().includes(q) ||
                           (j.kelas || '').toLowerCase().includes(q) ||
                           (j.hari || '').toLowerCase().includes(q);
                });
                return (
                    <>
                        <div className="wkj-cards">
                            {loading ? (
                                <div className="wkj-state">
                                    <Spinner variant="buble" size={28} />
                                </div>
                            ) : filteredJurnals.length === 0 ? (
                                <div className="wkj-state">
                                    <i className="bi bi-journal-x" />
                                    <p>Tidak ada data jurnal</p>
                                    <small>Coba ubah filter atau pencarian</small>
                                </div>
                            ) : filteredJurnals.map((jurnal) => (
                                <div key={jurnal.id} className="wkj-card" onClick={() => { setSelectedJournal(jurnal); setShowDetailModal(true); }}>
                                    <div className="wkj-card-top">
                                        <div className="wkj-card-date">
                                            <span className="wkj-day">{jurnal.hari || '---'}</span>
                                            <span className="wkj-tgl">{formatDate(jurnal.tanggal)}</span>
                                        </div>
                                        <span className={`wkj-cat ${getCategoryClass(jurnal.kategori_kehadiran)}`}>
                                            {(jurnal.kategori_kehadiran || '').toLowerCase() === 'penugasan dengan pendampingan' ? 'Penugasan DP' :
                                             (jurnal.kategori_kehadiran || '').toLowerCase() === 'penugasan tanpa pendampingan' ? 'Penugasan TP' :
                                             jurnal.kategori_kehadiran}
                                        </span>
                                    </div>
                                    <div className="wkj-card-info">
                                        <div className="wkj-row">
                                            <i className="bi bi-clock" />
                                            <span>{getTimeDisplay(jurnal)}</span>
                                        </div>
                                        <div className="wkj-row">
                                            <i className="bi bi-book" />
                                            <strong>{jurnal.mata_pelajaran}</strong>
                                        </div>
                                        {jurnal.kelas && jurnal.kelas !== myClass && (
                                            <div className="wkj-row">
                                                <i className="bi bi-door-open" />
                                                <span>{jurnal.kelas}</span>
                                            </div>
                                        )}
                                        <div className="wkj-row">
                                            <i className="bi bi-person" />
                                            <span>{jurnal.nama_guru}</span>
                                        </div>
                                        {jurnal.materi && (
                                            <div className="wkj-row wkj-materi">
                                                <i className="bi bi-card-text" />
                                                <span>{jurnal.materi}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="wkj-card-bottom">
                                        <span className="wkj-filledby">
                                            <i className="bi bi-shield-check" />
                                            {getFilledByLabel(jurnal.filled_by)}
                                        </span>
                                        <Button size="sm" variant="ghost" leftIcon={<i className="bi bi-eye" />} onClick={(e) => { e.stopPropagation(); setSelectedJournal(jurnal); setShowDetailModal(true); }}>
                                            Detail
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table - Hidden on Mobile */}
                        <div className="wkj-table-wrap">
                            <table className="wkj-table">
                                <thead>
                                    <tr>
                                        <th>Hari/Tanggal</th>
                                        <th>Jam Ke</th>
                                        <th>Guru & Mapel</th>
                                        <th>Kelas</th>
                                        <th>Kategori</th>
                                        <th className="hidden-lg">Materi & Refleksi</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredJurnals.map((jurnal) => (
                                        <tr key={jurnal.id}>
                                            <td>
                                                <div className="wkj-day">{jurnal.hari || '---'}</div>
                                                <div className="wkj-date">{formatDate(jurnal.tanggal)}</div>
                                            </td>
                                            <td className="wkj-time">{getTimeDisplay(jurnal)}</td>
                                            <td>
                                                <div className="wkj-guru">{jurnal.nama_guru}</div>
                                                <div className="wkj-mapel">{jurnal.mata_pelajaran}</div>
                                            </td>
                                            <td className="wkj-kelas">{jurnal.kelas}</td>
                                            <td>
                                                <span className={`wkj-cat ${getCategoryClass(jurnal.kategori_kehadiran)}`}>
                                                    {jurnal.kategori_kehadiran}
                                                </span>
                                            </td>
                                            <td className="hidden-lg wkj-matref">
                                                <div>{jurnal.materi || '-'}</div>
                                                {jurnal.refleksi && <small>"{jurnal.refleksi}"</small>}
                                            </td>
                                            <td>
                                                <ActionGroup>
                                                    <ActionButton action="view" onClick={() => { setSelectedJournal(jurnal); setShowDetailModal(true); }} title="Detail Jurnal" />
                                                </ActionGroup>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredJurnals.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--n-muted)' }}>
                                                Tidak ada data jurnal
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                );
            })()}

            {/* Detail Modal */}
            {showDetailModal && selectedJournal && (
                <Modal size="lg" onClose={() => setShowDetailModal(false)} labelledBy="wkj-detail-title">
                    <ModalHeader id="wkj-detail-title" icon="journal-text" title="Detail Jurnal" subtitle={selectedJournal.kelas} onClose={() => setShowDetailModal(false)} />
                    <ModalBody>
                        <ModalDetailGrid>
                            <ModalDetailField label="Hari / Tanggal">{selectedJournal.hari}, {formatDate(selectedJournal.tanggal)}</ModalDetailField>
                            <ModalDetailField label="Jam Ke">{getTimeDisplay(selectedJournal)}</ModalDetailField>
                            <ModalDetailField label="Mata Pelajaran">{selectedJournal.mata_pelajaran}</ModalDetailField>
                            <ModalDetailField label="Guru">{selectedJournal.nama_guru}</ModalDetailField>
                            {selectedJournal.guru_pengganti && selectedJournal.guru_pengganti !== '-' && (
                                <ModalDetailField label="Guru Pengganti">{selectedJournal.guru_pengganti}</ModalDetailField>
                            )}
                            <ModalDetailField label="Status">
                                <span className={`wkj-cat ${getCategoryClass(selectedJournal.kategori_kehadiran)}`}>{selectedJournal.kategori_kehadiran}</span>
                            </ModalDetailField>
                            <ModalDetailField label="Materi" full>{selectedJournal.materi || '-'}</ModalDetailField>
                            {selectedJournal.refleksi && (
                                <ModalDetailField label="Refleksi" full><span className="italic">"{selectedJournal.refleksi}"</span></ModalDetailField>
                            )}
                            <ModalDetailField label="Diisi Oleh">{getFilledByLabel(selectedJournal.filled_by)}</ModalDetailField>
                        </ModalDetailGrid>
                    </ModalBody>
                    <ModalViewFooter onClose={() => setShowDetailModal(false)} />
                </Modal>
            )}

            <style jsx>{`
                .wkj-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                /* Toolbar filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                /* Mobile Cards */
                .wkj-cards {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .wkj-card {
                    background: var(--n-card);
                    border-radius: 16px;
                    border: 1.5px solid var(--n-border);
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.25s;
                }
                .wkj-card:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 6px 20px rgba(59,130,246,0.12);
                }
                .wkj-card:active {
                    transform: scale(0.98);
                }
                .wkj-card-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 14px 16px;
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                }
                .wkj-card-date {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .wkj-day {
                    font-size: 0.82rem;
                    font-weight: 800;
                    color: var(--n-text);
                }
                .wkj-tgl {
                    font-size: 0.7rem;
                    color: var(--n-muted);
                }
                .wkj-card-info {
                    padding: 14px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .wkj-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    color: var(--n-muted);
                }
                .wkj-row i {
                    font-size: 0.9rem;
                    color: var(--n-muted);
                    flex-shrink: 0;
                }
                .wkj-row strong {
                    color: var(--n-text);
                }
                .wkj-materi {
                    color: var(--n-muted);
                    font-size: 0.72rem;
                    line-height: 1.4;
                }
                .wkj-materi span {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .wkj-card-bottom {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: #fafbff;
                    border-top: 1px solid var(--n-border);
                }
                .wkj-filledby {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }
                .wkj-btn-detail {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border-radius: 10px;
                    border: none;
                    background: #3b82f6;
                    color: white;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                }

                /* Category Badge */
                .wkj-cat {
                    display: inline-block;
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 0.72rem;
                    font-weight: 700;
                }
                .cat-on { background: rgba(26, 115, 232, 0.15); color: #3083FF; }
                .cat-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
                .cat-info { background: #eff6ff; color: #3083FF; }
                .cat-off { background: var(--n-soft); color: var(--n-muted); }

                /* State */
                .wkj-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 48px 20px;
                    color: var(--n-muted);
                }
                .wkj-state i { font-size: 2.5rem; color: #cbd5e1; }
                .wkj-state p { font-size: 0.9rem; font-weight: 700; color: var(--n-muted); margin: 0; }
                .wkj-state small { font-size: 0.75rem; }
                .wkj-spinner {
                    width: 28px;
                    height: 28px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Desktop Table */
                .wkj-table-wrap {
                    display: none;
                    overflow-x: auto;
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                }
                .wkj-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 800px;
                }
                .wkj-table thead th {
                    background: var(--n-soft);
                    padding: 14px 12px;
                    text-align: left;
                    font-weight: 800;
                    color: var(--n-muted);
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    border-bottom: 1px solid var(--n-border);
                }
                .wkj-table td {
                    padding: 14px 12px;
                    border-bottom: 1px solid var(--n-border);
                    font-size: 0.85rem;
                    vertical-align: middle;
                }
                .wkj-table tbody tr:hover td {
                    background: #fafbff;
                }
                .wkj-day { font-weight: 700; color: var(--n-text); }
                .wkj-date { font-size: 0.75rem; color: var(--n-muted); }
                .wkj-time { color: #3b82f6; font-weight: 700; }
                .wkj-guru { font-weight: 700; color: var(--n-text); }
                .wkj-mapel { font-size: 0.75rem; color: var(--n-muted); }
                .wkj-kelas { font-weight: 700; }
                .wkj-matref { font-size: 0.75rem; color: var(--n-muted); }
                .wkj-matref small { font-style: italic; color: var(--n-muted); display: block; margin-top: 4px; }
                .wkj-btn-view {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* Desktop Breakpoint */
                @media (min-width: 768px) {
                    .wkj-cards {
                        display: none;
                    }
                    .wkj-table-wrap {
                        display: block;
                    }
                    .hidden-lg {
                        display: none;
                    }
                }

                /* Dark Mode */
                :global(.dark) .wkj-card {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wkj-card-top {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
                }
                :global(.dark) .wkj-card-bottom {
                    background: #000000 !important;
                    border-color: rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .wkj-day { color: #ffffff !important; }
                :global(.dark) .wkj-row strong { color: #ffffff !important; }
                :global(.dark) .wkj-table-wrap {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wkj-table thead th {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    color: #94a3b8 !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .wkj-table td {
                    color: #ffffff !important;
                    border-bottom-color: rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .wkj-table tbody tr:hover td {
                    background: rgba(26, 115, 232, 0.08) !important;
                }
                :global(.dark) .wkj-cat { font-weight: 800 !important; letter-spacing: 0.3px !important; }
                :global(.dark) .cat-on { background: rgba(29, 107, 243, 0.35) !important; color: #ffffff !important; border: 1.5px solid #1d6bf3 !important; box-shadow: 0 0 12px rgba(29, 107, 243, 0.45) !important; }
                :global(.dark) .cat-warning { background: rgba(245, 158, 11, 0.25) !important; color: #fbbf24 !important; border: 1.5px solid #f59e0b !important; box-shadow: 0 0 10px rgba(245, 158, 11, 0.3) !important; }
                :global(.dark) .cat-info { background: rgba(14, 165, 233, 0.25) !important; color: #38bdf8 !important; border: 1.5px solid #0ea5e9 !important; box-shadow: 0 0 10px rgba(14, 165, 233, 0.3) !important; }
                :global(.dark) .cat-off { background: rgba(148, 163, 184, 0.18) !important; color: #cbd5e1 !important; border: 1.5px solid #64748b !important; }
            `}</style>
        </div>
    );
}
