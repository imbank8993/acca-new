'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentUser } from '@/lib/auth-client';

const sanitizeExcelCell = (v: any) => {
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) {
        return `'${v}`;
    }
    return v;
};
import { useModalBlur } from '@/components/ModalBlurProvider';
import { authFetch } from '@/lib/auth-fetch';
import { ApiResponse, Siswa } from '@/lib/types';
import Swal from 'sweetalert2';
import notif from '@/lib/notifications';
import * as XLSX from 'xlsx';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import Tab from '@/components/ui/Tab';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import './nilai.css';
import DesktopFab from '@/components/ui/DesktopFab';
import { MobileList, MobileListItem } from '@/components/mobile';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import {
    Info,
    MoreHorizontal,
    Plus,
    Zap,
    Sliders,
    FileSpreadsheet,
    Download,
    Upload,
    BookmarkCheck,
    ChevronUp,
    ChevronDown,
    Edit3,
    FileText,
    FileCheck,
    Award,
    Pencil,
    Trash2,
    Eye,
    Lightbulb,
    AlertCircle,
    AlertTriangle,
    UploadCloud,
    BookPlus,
    X,
} from 'lucide-react';
import { getProxiedImageUrl } from '@/lib/image-utils';
import NilaiAdminPanel from './components/NilaiAdminPanel';
import SesiApresiasiModal, { type SesiApresiasiPayload } from './components/SesiApresiasiModal';
import ApresiasiTab, { type ApresiasiSesi, type ApresiasiPoin } from './tabs/ApresiasiTab';

// --- Types ---
interface NilaiRow {
    id?: string;
    nisn: string;
    jenis: string;
    tagihan: string;
    materi_tp: string;
    nilai: number | string;
    catatan?: string;
}

interface TagihanConfig {
    id?: string;
    materi_tp: string;
    jenis: string;
    nama_tagihan: string;
    topik?: string;
}

interface BobotConfig {
    ratioHarian: { kuis: number; tugas: number; uh: number; };
    ratioRapor: { sums: number; pas: number; };
    sumCount: number;
    kkm?: number;
}

const DEFAULT_BOBOT: BobotConfig = {
    ratioHarian: { kuis: 1, tugas: 1, uh: 2 },
    ratioRapor: { sums: 3, pas: 2 },
    sumCount: 4,
    kkm: 75,
};

export default function NilaiPage() {
    const [user, setUser] = useState<any>(null);
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [mapelByKelas, setMapelByKelas] = useState<Record<string, string[]>>({});

    const isAdminRole = user?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN') || false;
    const isOPJurnal = user?.roles?.some((r: string) => r.toUpperCase() === 'OP_JURNAL') || false;
    const isPrivileged = isAdminRole || isOPJurnal;
    const isAdmin = isPrivileged;
    const canDo = (action: string) => {
        if (isPrivileged) return true;
        // 'config' diizinkan untuk guru: bobot memang milik per-guru dan tombol
        // "Tambah SUM" (yang juga menulis bobot) sudah terbuka untuk guru
        if (user?.roles?.some((r: string) => r.toUpperCase() === 'GURU') && (action === 'input' || action === 'view' || action === 'config')) return true;
        if (action === 'view') return true;
        return false;
    };

    // States
    const [kelas, setKelas] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mapel, setMapel] = useState('');
    const [semester, setSemester] = useState('Ganjil');
    const [tahunAjaran, setTahunAjaran] = useState('');
    const [tahunAjaranList, setTahunAjaranList] = useState<string[]>([]);
    const [materi, setMateri] = useState('SUM 1');
    const modes = ['KUIS', 'TUGAS', 'UH', 'PAS', 'REKAP', 'APRESIASI'];
    const [modeIndex, setModeIndex] = useState(0);
    const activeMode = modes[modeIndex] as 'REKAP' | 'KUIS' | 'TUGAS' | 'UH' | 'PAS' | 'APRESIASI';
    const [searchTerm, setSearchTerm] = useState('');

    // Nilai Apresiasi (kuis rebutan). Datanya dari tabel sendiri, sengaja TIDAK
    // digabung ke nilaiData supaya tidak pernah ikut terseret ke NA/rapor.
    const [apresiasiSesi, setApresiasiSesi] = useState<ApresiasiSesi[]>([]);
    const [apresiasiPoin, setApresiasiPoin] = useState<ApresiasiPoin[]>([]);
    const [showSesiApresiasi, setShowSesiApresiasi] = useState(false);

    const [siswa, setSiswa] = useState<Siswa[]>([]);
    const [nilaiData, setNilaiData] = useState<NilaiRow[]>([]);
    const [tagihanConfig, setTagihanConfig] = useState<TagihanConfig[]>([]);
    const [bobot, setBobot] = useState<BobotConfig>(DEFAULT_BOBOT);
    const [changes, setChanges] = useState<Record<string, string | number>>({});

    const [loading, setLoading] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    /** Siswa yang baris nilainya dibuka di modal (daftar mobile). */
    const [nilaiDetailSiswa, setNilaiDetailSiswa] = useState<any | null>(null);
    /** Menu aksi "…" di bar atas mobile — di desktop tombolnya berlabel sendiri. */
    const [showActionMenu, setShowActionMenu] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const [showTagihanModal, setShowTagihanModal] = useState(false);
    const [editingTagihan, setEditingTagihan] = useState<TagihanConfig | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [applyToClasses, setApplyToClasses] = useState<string[]>([]);
    const tableRef = useRef<HTMLTableElement>(null);
    const [showSumDropdown, setShowSumDropdown] = useState(false);
    const [showAddSumModal, setShowAddSumModal] = useState(false);
    const [newSumTopic, setNewSumTopic] = useState('');
    const [forcedVisibleTags, setForcedVisibleTags] = useState<Set<string>>(new Set());
    const [viewTopicData, setViewTopicData] = useState<{topik: string; nama_tagihan: string} | null>(null);

    // Admin mode state
    const [adminMode, setAdminMode] = useState(false);

    const { registerModal } = useModalBlur();

    // Menu aksi "…" tertutup saat mengetuk di luar panelnya.
    useEffect(() => {
        if (!showActionMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setShowActionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionMenu]);

    useEffect(() => {
        if (showConfigModal) return registerModal();
    }, [showConfigModal, registerModal]);

    useEffect(() => {
        if (showTagihanModal) return registerModal();
    }, [showTagihanModal, registerModal]);

    useEffect(() => {
        if (showImportModal) return registerModal();
    }, [showImportModal, registerModal]);

    useEffect(() => {
        setForcedVisibleTags(new Set());
    }, [materi, activeMode]);

    // Fetch guru list for admin mode
    const cleanTopic = (t?: string) => {
        if (!t || t === 'Auto-Imported') return '';
        return t;
    };

    const getNextAutoLabel = () => {
        const typePrefix = activeMode.toUpperCase();
        const typeProper = activeMode.charAt(0) + activeMode.slice(1).toLowerCase();

        // Hitung SEMUA tag di DB (termasuk kolom kosong yang tersembunyi di UI),
        // supaya label baru tidak bertabrakan dengan kolom lama lalu menimpanya
        const relevantTags = tagihanConfig.filter(t =>
            t.jenis === typeProper &&
            t.materi_tp === materi
        );

        let maxIndex = 0;
        relevantTags.forEach(t => {
            const parts = t.nama_tagihan.split('_');
            if (parts.length === 2 && parts[0] === typePrefix) {
                const idx = parseInt(parts[1]);
                if (!isNaN(idx) && idx > maxIndex) maxIndex = idx;
            }
        });

        return `${typePrefix}_${maxIndex + 1}`;
    };

    const filteredSiswa = useMemo(() => {
        if (!searchTerm) return siswa;
        const low = searchTerm.toLowerCase();
        return siswa.filter(s => {
            const name = (s.nama_siswa || (s as any).nama || "").toLowerCase();
            const nisn = (s.nisn || "").toLowerCase();
            return name.includes(low) || nisn.includes(low);
        });
    }, [siswa, searchTerm]);

    // Identifying Active Columns (Columns with at least one value across all students)
    const activeTags = useMemo(() => {
        const actives = new Set<string>();
        // Check local changes first
        Object.keys(changes).forEach(k => {
            if (changes[k] !== "") {
                const parts = k.split('||'); // [nisn, jenis, materi, tag]
                actives.add(`${parts[1]}||${parts[2]}||${parts[3]}`);
            }
        });
        // Check DB data
        nilaiData.forEach(d => {
            if (d.nilai !== null && d.nilai !== undefined && d.nilai !== "") {
                const tag = d.tagihan || '';
                actives.add(`${d.jenis}||${d.materi_tp}||${tag}`);
            }
        });
        return actives;
    }, [nilaiData, changes]);

    // Kolom nilai yang tampil untuk mode aktif.
    // Dipakai bersama oleh tabel desktop DAN kartu mobile supaya keduanya tidak
    // pernah berbeda. Sebelumnya mobile memetakan string 'UH'/'PAS' seolah objek
    // tagihan, sehingga jenis & tagihan-nya jadi `undefined` (nilai tak muncul
    // dan tersimpan dengan key rusak), dan mobile juga melewatkan filter kolom
    // aktif yang dipakai desktop.
    type NilaiColumn = {
        key: string;
        jenis: string;
        materiTp: string;
        tag: string;
        label: string;
        topik: string;
        config: TagihanConfig | null;
    };
    const visibleColumns = useMemo<NilaiColumn[]>(() => {
        if (activeMode === 'REKAP') return [];
        if (activeMode === 'UH') {
            return [{ key: 'UH', jenis: 'UH', materiTp: materi, tag: '', label: `UH ${materi}`, topik: '', config: null }];
        }
        if (activeMode === 'PAS') {
            return [{ key: 'PAS', jenis: 'PAS', materiTp: '-', tag: '', label: 'PAS', topik: '', config: null }];
        }
        const jenis = activeMode.charAt(0) + activeMode.slice(1).toLowerCase();
        return tagihanConfig
            .filter(t => t.jenis === jenis && t.materi_tp === materi)
            .filter(t =>
                activeTags.has(`${t.jenis}||${materi}||${t.nama_tagihan}`) ||
                forcedVisibleTags.has(`${t.jenis}||${materi}||${t.nama_tagihan}`) ||
                cleanTopic(t.topik)
            )
            .sort((a, b) => (parseInt(a.nama_tagihan.split('_')[1] || '0') - parseInt(b.nama_tagihan.split('_')[1] || '0')))
            .map(t => ({
                key: String(t.id ?? `${t.jenis}-${t.nama_tagihan}`),
                jenis: t.jenis,
                materiTp: materi,
                tag: t.nama_tagihan,
                label: t.nama_tagihan,
                topik: cleanTopic(t.topik),
                config: t,
            }));
    }, [activeMode, materi, tagihanConfig, activeTags, forcedVisibleTags]);

    const loadTeacherScopes = useCallback(async (ta: string, sem: string, nip: string) => {
        if (!nip || !ta || !sem) return;
        try {
            const res = await fetch(`/api/nilai/filters?nip=${encodeURIComponent(nip)}&tahun_ajaran=${encodeURIComponent(ta)}&semester=${encodeURIComponent(sem)}`);
            const json = await res.json();
            if (json.ok && json.data) {
                const kList: string[] = json.data.kelasList || [];
                const mByK: Record<string, string[]> = json.data.mapelByKelas || {};
                setKelasList(kList);
                setMapelByKelas(mByK);

                setKelas(currentKelas => {
                    const nextKelas = kList.includes(currentKelas) ? currentKelas : (kList[0] || '');
                    setMapel(currentMapel => {
                        const availableMapels = mByK[nextKelas] || [];
                        if (availableMapels.includes(currentMapel)) return currentMapel;
                        return availableMapels[0] || '';
                    });
                    return nextKelas;
                });
            }
        } catch (e) {
            console.error('Gagal memuat scope pengajaran guru:', e);
        }
    }, []);

    useEffect(() => {
        const fetchInitial = async () => {
            setLoading(true);
            try {
                const { getAllActiveAcademicYears, getActiveSettings } = await import('@/lib/settings-client');
                const [activePeriods, active] = await Promise.all([
                    getAllActiveAcademicYears(),
                    getActiveSettings()
                ]);

                const activeYears = Array.from(new Set(activePeriods.map(p => p.tahun_ajaran)));
                const years = activeYears.length > 0 ? activeYears : (active ? [active.tahun_ajaran] : []);
                setTahunAjaranList(years);
                let initialTa = years.length > 0 ? years[0] : '';
                let initialSem = 'Ganjil';
                if (active) {
                    initialTa = active.tahun_ajaran;
                    setTahunAjaran(active.tahun_ajaran);
                    // Standardize semester to Label
                    const semStr = String(active.semester);
                    initialSem = semStr === '1' ? 'Ganjil' : semStr === '2' ? 'Genap' : semStr;
                    setSemester(initialSem);
                } else if (years.length > 0) {
                    setTahunAjaran(years[0]);
                }

                const userData = await getCurrentUser();
                if (userData) {
                    setUser(userData);
                    await loadTeacherScopes(initialTa, initialSem, userData.nip);
                }
            } finally { setLoading(false); }
        };
        fetchInitial();
    }, [loadTeacherScopes]);

    const isFirstMount = useRef(true);
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        if (user?.nip && tahunAjaran && semester) {
            loadTeacherScopes(tahunAjaran, semester, user.nip);
        }
    }, [tahunAjaran, semester, user?.nip, loadTeacherScopes]);

    // Auto-load data when filters change
    useEffect(() => {
        // Only load if essential filters are set
        if (user && kelas && mapel && tahunAjaran && semester) {
            loadData();
        }
    }, [user, kelas, mapel, semester, tahunAjaran]);

    const loadData = async () => {
        if (!user || !user.nip || !kelas || !mapel || !tahunAjaran || !semester) return;
        setLoading(true);
        try {
            const url = `/api/nilai?nip=${user.nip}&kelas=${encodeURIComponent(kelas)}&mapel=${encodeURIComponent(mapel)}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}&_t=${Date.now()}`;
            const res = await authFetch(url, { cache: 'no-store' });
            const json = await res.json();
            if (json.ok && json.data) {
                setNilaiData(json.data.nilai || []);
                setSiswa(json.data.siswa || []);
                setTagihanConfig(json.data.tagihan || []);
                setBobot(json.data.bobot || DEFAULT_BOBOT);
                setChanges({});
            } else {
                notif.error(json.error || 'Gagal memuat data nilai');
            }
        } catch (err: any) {
            notif.error(err.message || 'Gagal memuat data nilai');
        } finally { setLoading(false); }

        // Query terpisah, dan kegagalannya sengaja tidak membatalkan pemuatan
        // nilai di atas: tabel apresiasi baru, jadi selama migrasinya belum
        // dijalankan halaman nilai harus tetap hidup seperti biasa.
        loadApresiasi();
    };

    const loadApresiasi = async () => {
        if (!user || !user.nip || !kelas || !mapel || !tahunAjaran || !semester) return;
        try {
            const url = `/api/nilai/apresiasi?nip=${user.nip}&kelas=${encodeURIComponent(kelas)}&mapel=${encodeURIComponent(mapel)}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}&_t=${Date.now()}`;
            const res = await authFetch(url, { cache: 'no-store' });
            const json = await res.json();
            if (json.ok && json.data) {
                setApresiasiSesi(json.data.sesi || []);
                setApresiasiPoin(json.data.poin || []);
            } else {
                setApresiasiSesi([]);
                setApresiasiPoin([]);
            }
        } catch {
            setApresiasiSesi([]);
            setApresiasiPoin([]);
        }
    };

    const handleSimpanSesiApresiasi = async (payload: SesiApresiasiPayload): Promise<boolean> => {
        try {
            const res = await authFetch('/api/nilai/apresiasi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nip: user.nip,
                    kelas,
                    mapel,
                    semester,
                    tahun_ajaran: tahunAjaran,
                    ...payload,
                }),
            });
            const json = await res.json().catch(() => ({ ok: false, error: 'Respon server tidak valid' }));
            if (res.ok && json.ok) {
                notif.success('Sesi apresiasi disimpan');
                await loadApresiasi();
                return true;
            }
            notif.error(json.error || `Gagal menyimpan sesi (HTTP ${res.status}).`);
            return false;
        } catch (err: any) {
            notif.error(err.message || 'Gagal menyimpan sesi apresiasi');
            return false;
        }
    };

    const handleHapusSesiApresiasi = async (sesi: ApresiasiSesi) => {
        const konfirmasi = await Swal.fire({
            title: 'Hapus sesi apresiasi?',
            text: `"${sesi.judul}" beserta seluruh poin siswanya akan dihapus permanen.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
        });
        if (!konfirmasi.isConfirmed) return;

        try {
            const res = await authFetch(`/api/nilai/apresiasi?sesi_id=${encodeURIComponent(sesi.id)}`, { method: 'DELETE' });
            const json = await res.json().catch(() => ({ ok: false, error: 'Respon server tidak valid' }));
            if (res.ok && json.ok) {
                notif.success('Sesi apresiasi dihapus');
                await loadApresiasi();
            } else {
                notif.error(json.error || 'Gagal menghapus sesi');
            }
        } catch (err: any) {
            notif.error(err.message || 'Gagal menghapus sesi');
        }
    };

    const getScore = (nisn: string, jenis: string, curMateri: string, tag: string = '') => {
        const key = `${nisn}||${jenis}||${curMateri}||${tag}`;
        if (changes[key] !== undefined) return changes[key];
        const found = nilaiData.find(d => d.nisn === nisn && d.jenis === jenis && d.materi_tp === curMateri && (tag ? d.tagihan === tag : (d.tagihan === '' || !d.tagihan)));
        return (found && found.nilai !== null) ? found.nilai : "";
    };

    const getAvg = (nisn: string, jenis: string, curMateri: string) => {
        const tags = tagihanConfig.filter(t => t.jenis === jenis && t.materi_tp === curMateri);

        let sum = 0, count = 0;
        let hasActive = false;

        tags.forEach(t => {
            const tagKey = `${jenis}||${curMateri}||${t.nama_tagihan}`;
            const isActive = activeTags.has(tagKey);

            if (isActive) {
                hasActive = true;
                const valStr = getScore(nisn, jenis, curMateri, t.nama_tagihan).toString();
                const val = valStr === "" ? 0 : parseFloat(valStr);
                sum += val;
                count++;
            }
        });

        // If no active columns at all for this category, return null (ignored)
        if (!hasActive) return null;

        // If active columns exist, return average (empty treated as 0)
        return count > 0 ? (sum / count) : 0;
    };

    const calculateNABab = (nisn: string, curMateri: string) => {
        let totalWeighted = 0;
        let totalRatio = 0;

        // Weights (Check if ratioHarian exists, default to 1 if not to prevent errors)
        const { kuis: wK, tugas: wT, uh: wU } = bobot.ratioHarian || { kuis: 1, tugas: 1, uh: 1 };

        // 1. Rata-rata TUGAS
        if (tagihanConfig.some(t => t.jenis === 'Tugas' && t.materi_tp === curMateri)) {
            const val = getAvg(nisn, 'Tugas', curMateri);
            if (val !== null) {
                totalWeighted += (val * wT);
                totalRatio += wT;
            }
        }

        // 2. Rata-rata KUIS
        if (tagihanConfig.some(t => t.jenis === 'Kuis' && t.materi_tp === curMateri)) {
            const val = getAvg(nisn, 'Kuis', curMateri);
            if (val !== null) {
                totalWeighted += (val * wK);
                totalRatio += wK;
            }
        }

        // 3. Nilai UH
        // Check if UH is "Active" for this materi (anyone has a grade?)
        const uhKey = `UH||${curMateri}||`;
        const uhActive = activeTags.has(uhKey);

        if (uhActive) {
            const uhStr = getScore(nisn, 'UH', curMateri).toString();
            const uhVal = uhStr === "" ? 0 : parseFloat(uhStr);
            totalWeighted += (uhVal * wU);
            totalRatio += wU;
        }

        if (totalRatio === 0) return "-";
        const result = totalWeighted / totalRatio;
        return isNaN(result) ? "-" : result;
    };

    const isDiffFromDB = (nisn: string, jenis: string, curMateri: string, tag: string = '') => {
        const key = `${nisn}||${jenis}||${curMateri}||${tag}`;
        const current = changes[key];
        if (current === undefined) return false;

        const found = nilaiData.find(d => d.nisn === nisn && d.jenis === jenis && d.materi_tp === curMateri && (tag ? d.tagihan === tag : (d.tagihan === '' || !d.tagihan)));
        const original = (found && found.nilai !== null) ? found.nilai.toString() : "";

        if (current.toString() === original.toString()) return false;
        if (parseFloat(current.toString()) === parseFloat(original.toString())) return false;
        return true;
    };

    const calculateRapor = (nisn: string) => {
        const sums = Array.from({ length: bobot.sumCount }, (_, i) => `SUM ${i + 1}`);
        let sSum = 0, sCount = 0;
        sums.forEach(s => {
            const na = calculateNABab(nisn, s);
            if (na !== "-") { sSum += (na as number); sCount++; }
        });

        const avgS = sCount > 0 ? (sSum / sCount) : null;

        const pasStr = getScore(nisn, 'PAS', '-', '').toString();
        const parsedPas = parseFloat(pasStr);
        const vPas = (pasStr !== "" && !isNaN(parsedPas)) ? parsedPas : null;

        const { sums: rS, pas: rP } = bobot.ratioRapor;

        let finalScore = 0;
        let finalDiv = 0;

        // Component 1: Average of Sums
        if (avgS !== null) {
            finalScore += (avgS * rS);
            finalDiv += rS;
        }

        // Component 2: PAS
        if (vPas !== null) {
            finalScore += (vPas * rP);
            finalDiv += rP;
        }

        // Tanpa komponen sama sekali tampilkan "-", bukan "0" yang menyesatkan
        if (finalDiv === 0) return "-";
        const result = finalScore / finalDiv;
        return isNaN(result) ? "-" : result.toFixed(0);
    };

    const handleDeleteTagihan = async (id: string, name: string) => {
        const result = await Swal.fire({
            title: `Hapus ${name}?`,
            text: "Seluruh nilai pada kolom ini akan dihapus permanen!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'YA, HAPUS'
        });
        if (result.isConfirmed) {
            const res = await authFetch(`/api/nilai/tagihan?id=${id}`, { method: 'DELETE' });
            const json = await res.json().catch(() => ({ ok: false }));
            if (!res.ok || !json.ok) notif.error(json.error || 'Gagal menghapus kolom');
            loadData();
        }
    };

    const handleDeleteSum = async (num: number) => {
        const sumName = `SUM ${num}`;
        const result = await Swal.fire({
            title: `Hapus ${sumName}?`,
            text: `Seluruh data nilai dan topik pada ${sumName} akan dihapus permanen!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'YA, HAPUS'
        });

        if (result.isConfirmed) {
            const tag = tagihanConfig.find(t => t.jenis === 'Sum' && t.materi_tp === sumName);
            if (tag?.id) {
                await authFetch(`/api/nilai/tagihan?id=${tag.id}`, { method: 'DELETE' });
            }
            const newCount = Math.max(1, bobot.sumCount - 1);
            const newBobot = { ...bobot, sumCount: newCount };
            const bobotNip = user.nip;
            await authFetch('/api/nilai/bobot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nip: bobotNip, kelas, mapel, semester, config: newBobot, tahun_ajaran: tahunAjaran }) });
            setBobot(newBobot);
            loadData();
        }
    };

    const handleAddSum = async (topic: string) => {
        if (!topic) return;

        setLoading(true);
        try {
            const newCount = bobot.sumCount + 1;
            const newBobot = { ...bobot, sumCount: newCount };
            const newSumName = `SUM ${newCount}`;
            const sumNip = user.nip;

            await authFetch('/api/nilai/bobot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nip: sumNip, kelas, mapel, semester, config: newBobot, tahun_ajaran: tahunAjaran })
            });

            await authFetch('/api/nilai/tagihan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nip: sumNip, kelas, mapel, semester, tahun_ajaran: tahunAjaran,
                    materi: newSumName,
                    jenis: 'Sum',
                    nama: newSumName,
                    topik: topic
                })
            });

            setBobot(newBobot);
            setShowAddSumModal(false);
            setNewSumTopic('');
            loadData();
            notif.success(`${newSumName} berhasil ditambahkan!`);
        } catch (err: any) {
            notif.error(err.message);
        } finally {
            setLoading(false);
        }
    };


    /** Nilai yang TERSIMPAN di DB untuk satu sel, sebagai string ("" = kosong). */
    const originalScore = (nisn: string, jenis: string, curMateri: string, tag: string = '') => {
        const found = nilaiData.find(d => d.nisn === nisn && d.jenis === jenis && d.materi_tp === curMateri && (tag ? d.tagihan === tag : (d.tagihan === '' || !d.tagihan)));
        return (found && found.nilai !== null) ? found.nilai.toString() : "";
    };

    /** "90" dan "90.0" dianggap sama; "" hanya sama dengan "". */
    const sameAsOriginal = (raw: string, original: string) => {
        if (raw === original) return true;
        if (raw === "" || original === "") return false;
        const a = parseFloat(raw);
        const b = parseFloat(original);
        return !isNaN(a) && !isNaN(b) && a === b;
    };

    const handleScoreChange = (nisn: string, jenis: string, mtr: string, tag: string, val: string) => {
        let raw = val.replace(',', '.');
        if (raw !== "") {
            if (!/^\d+\.?\d{0,2}$/.test(raw)) return;
            const num = parseFloat(raw);
            if (!isNaN(num) && num > 100) return;
            if (raw.length > 1 && raw.startsWith('0') && raw[1] !== '.') raw = raw.substring(1);
        }

        const key = `${nisn}||${jenis}||${mtr}||${tag}`;
        const original = originalScore(nisn, jenis, mtr, tag);

        // Functional update: spread dari state basi bisa menghilangkan
        // keystroke saat mengetik cepat berpindah sel.
        setChanges(prev => {
            // Kembali ke nilai semula = BUKAN perubahan. Dulu tiap sel yang
            // pernah disentuh tetap tercatat, jadi mengetik 90 lalu
            // menghapusnya lagi menyisakan peringatan "1 perubahan belum
            // disimpan" untuk sesuatu yang sebenarnya tidak berubah.
            if (sameAsOriginal(raw, original)) {
                if (prev[key] === undefined) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: raw };
        });
    };

    const handleSave = async () => {
        const updates = Object.keys(changes).map(key => {
            const [nisn, jenis, mt, tag] = key.split('||');
            return { nisn, jenis, materi: mt, tagihan: tag || '', nilai: changes[key] };
        });
        setLoading(true);
        try {
            const saveNip = user.nip;
            const res = await authFetch('/api/nilai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nip: saveNip, kelas, mapel, semester, updates, tahun_ajaran: tahunAjaran })
            });
            const json = await res.json().catch(() => ({ ok: false, error: 'Respon server tidak valid' }));
            if (res.ok && json.ok) {
                notif.success('Perubahan disimpan');
                loadData();
            } else {
                // Jangan diam saat gagal — guru harus tahu nilainya BELUM tersimpan
                notif.error(json.error || `Gagal menyimpan (HTTP ${res.status}). Perubahan Anda belum tersimpan.`);
            }
        } catch (err: any) {
            notif.error(err.message || 'Gagal menyimpan. Perubahan Anda belum tersimpan.');
        } finally { setLoading(false); }
    };

    const sortTags = (tags: any[]) => {
        return tags.sort((a, b) => {
            const partA = a.nama_tagihan.split('_')[1] || '0';
            const partB = b.nama_tagihan.split('_')[1] || '0';
            return parseInt(partA) - parseInt(partB);
        });
    };

    /**
     * Ekspor tab Apresiasi.
     *
     * Berdiri sendiri, tidak menumpang alur ekspor di bawah: alur itu memetakan
     * nama kolom (SUM_/UH_/KUIS_) ke pembaca nilai dan menempelkan blok topik
     * ala KUIS/TUGAS, sementara kolom di sini adalah sesi dan angkanya dijumlah,
     * bukan dirata-rata. Menyisipkannya ke sana hanya akan menambah cabang di
     * fungsi yang sudah padat.
     */
    const handleExportApresiasi = async () => {
        const XLSXStyle = await import('xlsx-js-style');

        if (apresiasiSesi.length === 0) {
            notif.error('Belum ada sesi apresiasi untuk diekspor');
            return;
        }

        const poinMap = new Map<string, number>();
        apresiasiPoin.forEach(p => poinMap.set(`${p.sesi_id}||${p.nisn}`, Number(p.total_poin) || 0));

        // Judul sesi TIDAK dijamin unik — guru bebas menamai dua sesi "Rebutan
        // Bab 1". Kalau dipakai mentah sebagai kunci baris, sesi kedua menimpa
        // yang pertama dan satu kolom hilang tanpa suara. Yang kembar diberi
        // akhiran urut supaya tiap sesi tetap punya kolomnya sendiri.
        const pakai = new Map<string, number>();
        const kolomSesi = apresiasiSesi.map(s => {
            const n = (pakai.get(s.judul) || 0) + 1;
            pakai.set(s.judul, n);
            return { id: s.id, label: n > 1 ? `${s.judul} (${n})` : s.judul };
        });

        const rows = filteredSiswa.map((s, idx) => {
            const row: any = {
                "NO": idx + 1,
                "NISN": sanitizeExcelCell(s.nisn),
                "NAMA": sanitizeExcelCell(s.nama_siswa || (s as any).nama || ''),
                "KELAS": sanitizeExcelCell(s.kelas || kelas),
            };
            let total = 0;
            kolomSesi.forEach(col => {
                const v = poinMap.get(`${col.id}||${s.nisn}`) || 0;
                total += v;
                // Kosong, bukan 0: siswa yang tidak pernah menang bukan berarti
                // dapat nilai nol — pembedaan yang sama seperti di tabelnya.
                row[col.label] = v > 0 ? Number(v.toFixed(2)) : "";
            });
            row["TOTAL POIN"] = total > 0 ? Number(total.toFixed(2)) : "";
            return row;
        });

        const headers = ["NO", "NISN", "NAMA", "KELAS", ...kolomSesi.map(c => c.label), "TOTAL POIN"];
        const ws = XLSXStyle.utils.json_to_sheet(rows, { header: headers });

        // Keterangan tiap sesi ditaruh di bawah tabel, mengikuti pola blok topik
        // pada ekspor KUIS/TUGAS.
        const keterangan: any[][] = [[], ["KETERANGAN SESI"], ["JUDUL", "TOPIK", "POIN PER JAWABAN", "TANGGAL"]];
        apresiasiSesi.forEach((s, i) => {
            // Label yang sama dengan header kolom, supaya baris keterangan tetap
            // bisa dicocokkan ke kolomnya saat ada judul kembar.
            keterangan.push([kolomSesi[i].label, s.topik || '-', Number(s.poin_per_soal), s.tanggal || '-']);
        });
        keterangan.push([], ["Nilai Apresiasi = poin kuis rebutan; tidak termasuk dalam NA maupun rapor."]);
        XLSXStyle.utils.sheet_add_aoa(ws, keterangan, { origin: -1 });

        ws['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 35 }, { wch: 10 },
            ...apresiasiSesi.map(() => ({ wch: 16 })), { wch: 14 }];

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "APRESIASI");
        XLSXStyle.writeFile(wb, `EXPORT_APRESIASI_${kelas}_${mapel}.xlsx`.replace(/[\s/\\]+/g, '_'));
    };

    const handleExport = async (isTemplate: boolean = false) => {
        if (activeMode === 'APRESIASI') {
            await handleExportApresiasi();
            return;
        }

        const XLSXStyle = await import('xlsx-js-style');

        // Prepare Data Columns based on Mode
        const headers = ["NO", "NISN", "NAMA", "KELAS"];
        let dynamicCols: string[] = [];

        if (activeMode === 'REKAP') {
            const count = bobot.sumCount;
            for (let i = 1; i <= count; i++) dynamicCols.push(`SUM_${i}`);
            dynamicCols.push("PAS", "RAPOR");
        } else if (activeMode === 'UH') {
            dynamicCols.push(`UH_${materi.replace(/\s/g, '_').toUpperCase()}`);
        } else if (activeMode === 'PAS') {
            dynamicCols.push("PAS");
        } else {
            // KUIS / TUGAS
            const prefix = activeMode.toUpperCase();

            if (isTemplate) {
                // Ensure 10 slots for template
                for (let i = 1; i <= 10; i++) dynamicCols.push(`${prefix}_${i}`);
            } else {
                // Export existing tags sorted
                const relevantTags = tagihanConfig.filter(t =>
                    t.jenis === (activeMode.charAt(0) + activeMode.slice(1).toLowerCase()) &&
                    t.materi_tp === materi
                );

                if (relevantTags.length === 0) {
                    for (let i = 1; i <= 5; i++) dynamicCols.push(`${prefix}_${i}`);
                } else {
                    const sorted = sortTags(relevantTags);
                    sorted.forEach(t => dynamicCols.push(t.nama_tagihan.toUpperCase()));
                }
            }
        }

        const fullHeaders = [...headers, ...dynamicCols];

        // Build Data Rows
        const data = filteredSiswa.map((s, idx) => {
            const row: any = {
                "NO": idx + 1,
                "NISN": sanitizeExcelCell(s.nisn),
                "NAMA": sanitizeExcelCell(s.nama_siswa || (s as any).nama || ''),
                "KELAS": sanitizeExcelCell(s.kelas || kelas)
            };

            dynamicCols.forEach(col => {
                let val: string | number = "";

                if (isTemplate) {
                    val = "";
                } else {
                    if (col.startsWith("SUM_")) {
                        const num = col.split('_')[1];
                        const nab = calculateNABab(s.nisn, `SUM ${num}`);
                        val = nab !== '-' ? Math.round(nab as number) : "";
                    } else if (col === "PAS") {
                        const v = getScore(s.nisn, 'PAS', '-');
                        val = (v !== null && v !== "") ? v : "";
                    } else if (col === "RAPOR") {
                        val = calculateRapor(s.nisn);
                    } else if (col.startsWith("UH_")) {
                        const v = getScore(s.nisn, 'UH', materi);
                        val = (v !== null && v !== "") ? v : "";
                    } else {
                        // KUIS_N / TUGAS_N
                        const parts = col.split('_');
                        const typeUpp = parts[0];
                        const typeProper = typeUpp.charAt(0) + typeUpp.slice(1).toLowerCase(); // Kuis

                        const v = getScore(s.nisn, typeProper, materi, col);
                        val = (v !== null && v !== "") ? v : "";
                    }
                }
                row[col] = val;
            });
            return row;
        });

        // Add Topics Row as the first data row if KUIS/TUGAS
        // Add Topics Rows if KUIS/TUGAS (Vertical Format at bottom - 2 Columns)
        const finalData = [...data];
        if (activeMode === 'KUIS' || activeMode === 'TUGAS') {
            // Add space and a clear section header aligned with NISN & NAMA
            finalData.push({ "NO": "", "NISN": "", "NAMA": "", "KELAS": "" });
            finalData.push({ "NO": "", "NISN": "", "NAMA": "", "KELAS": "" });
            finalData.push({
                "NO": "",
                "NISN": activeMode.toUpperCase(),
                "NAMA": "TOPIK/MATERI",
                "KELAS": ""
            });

            // Add one row per dynamic column
            dynamicCols.forEach(col => {
                const tag = tagihanConfig.find(t => t.nama_tagihan === col && t.materi_tp === materi);
                finalData.push({
                    "NO": "",
                    "NISN": col,
                    "NAMA": isTemplate ? "" : (cleanTopic(tag?.topik) || ""),
                    "KELAS": ""
                });
            });
        }

        // Create Sheet
        const ws = XLSXStyle.utils.json_to_sheet(finalData, { header: fullHeaders });
        const newRange = XLSXStyle.utils.decode_range(ws['!ref']!);

        // Headers Styling (Row 0)
        for (let C = newRange.s.c; C <= newRange.e.c; ++C) {
            const addr = XLSXStyle.utils.encode_cell({ r: 0, c: C });
            if (!ws[addr]) continue;
            ws[addr].s = {
                fill: { fgColor: { rgb: "1E293B" } },
                font: { color: { rgb: "FFFFFF" }, bold: true },
                alignment: { horizontal: "center", vertical: "center" },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
        }

        // Topics Styling (Vertical rows at bottom)
        if (activeMode === 'KUIS' || activeMode === 'TUGAS') {
            const topicCount = dynamicCols.length;
            const headerR = newRange.e.r - topicCount;
            const startR = headerR + 1;

            // Style Section Header (Only Column 1 & 2: NISN & NAMA)
            for (let C = 1; C <= 2; C++) {
                const addr = XLSXStyle.utils.encode_cell({ r: headerR, c: C });
                if (!ws[addr]) continue;
                ws[addr].s = {
                    fill: { fgColor: { rgb: "CBD5E1" } },
                    font: { bold: true, color: { rgb: "1E293B" }, size: 10 },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
                };
            }

            for (let R = startR; R <= newRange.e.r; R++) {
                for (let C = 1; C <= 2; C++) { // Only Column 1 & 2: NISN & NAMA
                    const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
                    if (!ws[addr]) continue;
                    ws[addr].s = {
                        fill: { fgColor: { rgb: "F8FAFC" } },
                        font: { italic: C === 2, bold: C === 1, color: { rgb: "475569" }, size: 9 },
                        alignment: { horizontal: C === 2 ? "left" : "center", vertical: "center", wrapText: true },
                        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
                    };
                }
            }
        }

        // Data Styling (All rows except header and topic rows)
        const topicRowsCount = (activeMode === 'KUIS' || activeMode === 'TUGAS') ? dynamicCols.length + 3 : 0;
        const dataEndRow = newRange.e.r - topicRowsCount;

        for (let R = 1; R <= dataEndRow; ++R) {
            for (let C = newRange.s.c; C <= newRange.e.c; ++C) {
                const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
                if (!ws[addr]) ws[addr] = { t: 's', v: '' };

                if (!ws[addr].s) ws[addr].s = {};
                ws[addr].s.border = {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                };

                if (C <= 3) {
                    ws[addr].s.alignment = { horizontal: "left" };
                    if (C === 0 || C === 1 || C === 3) ws[addr].s.alignment = { horizontal: "center" };
                } else {
                    ws[addr].s.alignment = { horizontal: "center" };
                }
            }
        }

        // Col Widths
        ws['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 35 }, { wch: 10 }];
        for (let i = 4; i <= newRange.e.c; i++) ws['!cols'].push({ wch: 15 });

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "NILAI");

        const prefix = isTemplate ? "TEMPLATE" : "EXPORT";
        const fname = `${prefix}_${activeMode}_${materi}_${kelas}.xlsx`.replace(/\s+/g, '_');
        XLSXStyle.writeFile(wb, fname);
    };


    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                // 1. Read File
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (data.length < 2) throw new Error("File Excel kosong atau format salah.");

                Swal.fire({ title: 'Validasi Data...', text: 'Memeriksa format dan data...', didOpen: () => Swal.showLoading() });

                // 2. Validate Headers (Strict Mode)
                const rawHeaders = (data[0] as any[]).map(h => String(h || '').trim());
                const required = ["NO", "NISN", "NAMA", "KELAS"];

                // Check first 4 columns strictly
                for (let i = 0; i < required.length; i++) {
                    if (rawHeaders[i] !== required[i]) {
                        throw new Error(`Struktur Header Tidak Sesuai! Kolom ke-${i + 1} harusnya '${required[i]}', terbaca '${rawHeaders[i] || 'KOSONG'}'.`);
                    }
                }
                const headers = rawHeaders; // Use raw headers for matching moving forward

                // 3. Identify Value Columns (Strict Pattern Check)
                const valueCols: { index: number, name: string }[] = [];
                headers.forEach((h, idx) => {
                    if (required.includes(h)) return;
                    if (!h) return; // Ignore completely empty trailing columns

                    let isValid = false;
                    if (activeMode === 'KUIS' || activeMode === 'TUGAS') {
                        const pattern = new RegExp(`^${activeMode}_\\d+$`);
                        if (pattern.test(h)) {
                            valueCols.push({ index: idx, name: h });
                            isValid = true;
                        } else {
                            throw new Error(`Penamaan Kolom Salah! Kolom '${h}' tidak sesuai format. Seharusnya '${activeMode}_[ANGKA]' (Contoh: ${activeMode}_1).`);
                        }
                    } else if (activeMode === 'REKAP') {
                        if (h === 'PAS' || h.match(new RegExp('^SUM_\\d+$'))) {
                            valueCols.push({ index: idx, name: h });
                            isValid = true;
                        }
                    } else if (activeMode === 'UH') {
                        if (h.startsWith('UH_')) {
                            valueCols.push({ index: idx, name: h });
                            isValid = true;
                        }
                    } else if (activeMode === 'PAS') {
                        if (h === 'PAS') {
                            valueCols.push({ index: idx, name: h });
                            isValid = true;
                        }
                    }
                });

                if (valueCols.length === 0) {
                    throw new Error(`Tidak ada kolom nilai yang valid untuk mode ${activeMode}. Pastikan gunakan format ${activeMode}_1, dst.`);
                }

                // 3b. Detect TOPIK rows (Search vertically at the end)
                const topics: Record<string, string> = {};
                const topicRowIndices: number[] = [];
                let isTopicSection = false;

                for (let i = 1; i < data.length; i++) {
                    const row = data[i] as any[] || [];
                    const colB = String(row[1] || '').trim().toUpperCase();
                    const colC = String(row[2] || '').trim();

                    // Detect Section Header: [ActiveMode] | TOPIK/MATERI
                    if (colB === activeMode.toUpperCase() && colC.toUpperCase() === 'TOPIK/MATERI') {
                        isTopicSection = true;
                        topicRowIndices.push(i);
                        continue;
                    }

                    if (isTopicSection && colB.startsWith(activeMode.toUpperCase() + '_')) {
                        topicRowIndices.push(i);
                        topics[colB] = colC;
                    }
                }

                // 3c. Filter valueCols: Only keep columns that have a topic OR at least one student score
                const validValueCols = valueCols.filter(col => {
                    const hasTopic = topics[col.name] !== undefined && topics[col.name] !== "";
                    if (hasTopic) return true;

                    // Check if at least one row has a score for this column
                    const hasAnyScore = data.some((row, idx) => {
                        if (idx === 0 || topicRowIndices.includes(idx)) return false;
                        const val = (row as any[])[col.index];
                        return val !== undefined && val !== null && val !== "";
                    });

                    return hasAnyScore;
                });

                if (validValueCols.length === 0) {
                    throw new Error(`Tidak ada kolom nilai yang valid untuk mode ${activeMode}. Pastikan minimal ada topik terisi atau ada nilai yang diinput.`);
                }

                // 4. Process Rows
                const errors: string[] = [];
                let successCount = 0;
                const updates: any[] = [];
                const newTagihans: any[] = [];
                const topicsToUpdate: any[] = [];
                const siswaMap = new Map(siswa.map(s => [s.nisn, s]));

                for (let i = 1; i < data.length; i++) {
                    if (topicRowIndices.includes(i)) continue; // Skip topic rows
                    const row = data[i] as any[];
                    if (!row || (!row[0] && !row[1])) continue; // Skip empty rows (separator)

                    const rowObj: any = {};
                    headers.forEach((h, idx) => { rowObj[h] = row[idx]; });

                    const nisn = String(rowObj["NISN"] || "").trim();
                    const cls = String(rowObj["KELAS"] || "").trim();
                    const nameRaw = String(rowObj["NAMA"] || "").trim();

                    if (!nisn) continue;

                    // Validation
                    const student = siswaMap.get(nisn);
                    if (!student) {
                        errors.push(`Baris ${i + 1}: NISN ${nisn} tidak terdaftar di kelas ini.`);
                        continue;
                    }

                    // Strict Name Match
                    const dbName = (student.nama_siswa || (student as any).nama || "").trim().toUpperCase();
                    if (nameRaw.toUpperCase() !== dbName) {
                        errors.push(`Baris ${i + 1}: Nama tidak sesuai untuk NISN ${nisn}. (Terbaca: ${nameRaw}, Seharusnya: ${dbName})`);
                        continue;
                    }

                    if (cls.toUpperCase() !== kelas.toUpperCase()) {
                        errors.push(`Baris ${i + 1}: Siswa ${nisn} salah kelas (Terbaca: ${cls}, Seharusnya: ${kelas}).`);
                        continue;
                    }

                    // Values
                    validValueCols.forEach(col => {
                        const valRaw = row[col.index];
                        const hasScore = valRaw !== undefined && valRaw !== null && valRaw !== "";
                        let topic = topics[col.name] || "";

                        // If there is a score but no topic, default topic to '-'
                        if (hasScore && !topic) {
                            topic = "-";
                            topics[col.name] = "-"; // Update local map so secondary checks find it
                        }

                        // Only process if there's either a score or a topic
                        if (!hasScore && !topic) return;

                        if (hasScore) {
                            let val = parseFloat(String(valRaw).replace(',', '.'));
                            if (isNaN(val) || val < 0 || val > 100) {
                                errors.push(`Baris ${i + 1}: Nilai kolom ${col.name} tidak valid (${valRaw}).`);
                                return;
                            }

                            // Determine Update Key
                            let updateKey = "";
                            if (col.name.startsWith("SUM_")) {
                                // Skip SUM import
                            } else if (col.name === "PAS") {
                                updateKey = `${nisn}||PAS||-||`;
                            } else if (col.name.startsWith("UH_")) {
                                updateKey = `${nisn}||UH||${materi}||`;
                            } else if (activeMode === 'KUIS' || activeMode === 'TUGAS') {
                                const typeStr = activeMode.charAt(0) + activeMode.slice(1).toLowerCase();
                                updateKey = `${nisn}||${typeStr}||${materi}||${col.name}`;
                            }
                            if (updateKey) updates.push({ key: updateKey, val });
                        }

                        // Handle Tagihan/Topic Updates (One-time check per column across rows)
                        if (activeMode === 'KUIS' || activeMode === 'TUGAS') {
                            const typeStr = activeMode.charAt(0) + activeMode.slice(1).toLowerCase();
                            const currentTag = tagihanConfig.find(t => t.nama_tagihan === col.name && t.materi_tp === materi);

                            if (currentTag) {
                                if (cleanTopic(currentTag.topik) !== topic && !topicsToUpdate.some(tu => tu.id === currentTag.id)) {
                                    topicsToUpdate.push({ ...currentTag, topik: topic });
                                }
                            } else if (!newTagihans.some(t => t.nama === col.name)) {
                                newTagihans.push({ nama: col.name, jenis: typeStr, materi: materi, topik: topic });
                            }
                        }
                    });

                    if (errors.length === 0) successCount++;
                }

                if (errors.length > 0) {
                    const listErr = errors.slice(0, 20).map(e => `<li>${e}</li>`).join('');
                    const more = errors.length > 20 ? `<li class="italic text-slate-500">... dan ${errors.length - 20} error lainnya.</li>` : '';

                    const errorHtml = `<div class="text-left text-xs text-red-600 max-h-[300px] overflow-y-auto bg-red-50 p-2 border rounded"><ul class="list-disc pl-4">${listErr}${more}</ul></div>`;

                    Swal.fire({
                        title: 'Validasi Gagal',
                        html: `<p class="mb-2">Ditemukan ${errors.length} error. Import dibatalkan.</p>${errorHtml}`,
                        icon: 'error',
                        width: '600px',
                        showConfirmButton: true,
                        confirmButtonText: 'Tutup',
                        confirmButtonColor: '#1E293B',
                        showCloseButton: true,
                        allowOutsideClick: true
                    });
                    return;
                }

                // Apply
                if (newTagihans.length > 0 || topicsToUpdate.length > 0) {
                    const impNip = user.nip;
                    for (const t of newTagihans) {
                        await authFetch('/api/nilai/tagihan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ nip: impNip, kelas, mapel, semester, materi: t.materi, jenis: t.jenis, nama: t.nama, topik: t.topik, tahun_ajaran: tahunAjaran })
                        });
                    }
                    for (const t of topicsToUpdate) {
                        await authFetch('/api/nilai/tagihan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ nip: impNip, kelas, mapel, semester, ...t, nama: t.nama_tagihan, materi: t.materi_tp, tahun_ajaran: tahunAjaran })
                        });
                    }
                    const res = await authFetch(`/api/nilai?nip=${user.nip}&kelas=${encodeURIComponent(kelas)}&mapel=${encodeURIComponent(mapel)}&semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`);
                    const json = await res.json();
                    if (json.ok) setTagihanConfig(json.data.tagihan);
                }

                setChanges(prev => {
                    const next = { ...prev };
                    updates.forEach(u => { next[u.key] = u.val; });
                    return next;
                });

                notif.success(`${successCount} data berhasil dimuat ke draf tabel. Klik "Simpan Perubahan" di bilah bawah untuk menyimpan permanen ke server.`);
                setShowImportModal(false);

            } catch (err: any) {
                Swal.fire({
                    title: 'Error',
                    text: err.message,
                    icon: 'error',
                    confirmButtonText: 'Tutup',
                    confirmButtonColor: '#1E293B',
                    showConfirmButton: true,
                    showCloseButton: true,
                    allowOutsideClick: true
                });
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleKeyDown = (e: React.KeyboardEvent, rIdx: number, cIdx: number) => {
        const inputs = Array.from(tableRef.current?.querySelectorAll('input.nl__scoreInput') || []) as HTMLInputElement[];
        if (inputs.length === 0) return;
        const currentInput = e.currentTarget as HTMLInputElement;
        const flatIdx = inputs.indexOf(currentInput);
        if (flatIdx === -1) return;
        const row = currentInput.closest('tr');
        const cols = row ? row.querySelectorAll('input.nl__scoreInput').length : 1;
        let targetIdx = -1;
        if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); targetIdx = flatIdx + cols; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); targetIdx = flatIdx - cols; }
        else if (e.key === 'ArrowRight') { if (currentInput.selectionEnd === currentInput.value.length) targetIdx = flatIdx + 1; }
        else if (e.key === 'ArrowLeft') { if (currentInput.selectionStart === 0) targetIdx = flatIdx - 1; }
        if (targetIdx >= 0 && targetIdx < inputs.length) {
            let idx = targetIdx;
            const direction = targetIdx > flatIdx ? 1 : -1;
            while (idx >= 0 && idx < inputs.length && (inputs[idx].readOnly || inputs[idx].disabled)) {
                idx += direction;
            }
            if (idx >= 0 && idx < inputs.length && !inputs[idx].readOnly && !inputs[idx].disabled) {
                inputs[idx].focus(); inputs[idx].select();
            }
        }
    };

    return (
        <div className="nl-wrapper">
                {/* Page Header (PageBanner) */}
                

                {/* Beralih ke Panel Admin Nilai (FAB hanya tampil di luar adminMode, karena di adminMode tombol Kembali sudah ada di FilterToolbar). */}
                {isPrivileged && !adminMode && (
                    <DesktopFab
                        label="Panel Admin"
                        mobileLabel="Admin"
                        icon="shield-fill"
                        onClick={() => setAdminMode(true)}
                    />
                )}

                {/* NORMAL VIEW - hidden in admin mode */}
                {!adminMode && (
                <>
                {/* ── Main Navigation & Tabs (Tab.tsx directly below Banner) ── */}
                <div className="mt-5 mb-4">
                    <Tab
                        /* variant="slider" WAJIB kalau tabnya harus terlihat di mobile:
                           tab.css menyembunyikan .actab-wrap:not(.actab-wrap--slider)
                           sepenuhnya di <= 991.98px. Tanpa ini, tab halaman ini lenyap
                           begitu layar menyempit. Semua halaman lain sudah memakainya. */
                        variant="slider"
                        tabs={[
                            { key: 'SUMATIF', label: 'Sumatif / BAB', icon: 'journal-text' },
                            { key: 'PAS', label: 'Ujian Akhir', icon: 'card-checklist' },
                            { key: 'REKAP', label: 'Rekap Nilai', icon: 'grid-3x3-gap-fill' },
                            { key: 'APRESIASI', label: 'Apresiasi', icon: 'lightning-charge-fill' }
                        ]}
                        activeTab={
                            ['KUIS', 'TUGAS', 'UH'].includes(activeMode)
                                ? 'SUMATIF'
                                : activeMode === 'PAS'
                                ? 'PAS'
                                : activeMode === 'APRESIASI'
                                ? 'APRESIASI'
                                : 'REKAP'
                        }
                        onChange={(key) => {
                            if (key === 'SUMATIF') setModeIndex(1);
                            else if (key === 'PAS') setModeIndex(3);
                            else if (key === 'REKAP') setModeIndex(4);
                            else if (key === 'APRESIASI') setModeIndex(5);
                        }}
                    />
                </div>

                {/* ── Filter Toolbar ── */}
                {/* ftb-toolbar--noSticky: persis di bawah toolbar ini ada kartu
                    sub-bar BAB. Dengan toolbar mobile yang sticky-tanpa-latar,
                    kartu itu terbaca menembus sela pil cari saat halaman digulir. */}
                <FilterToolbar className="ftb-toolbar--noSticky" actionsInline>
                    <FilterSelect
                        label="Kelas"
                        icon="mortarboard"
                        value={kelas}
                        onChange={(val) => {
                            setKelas(val);
                            setMapel(mapelByKelas[val]?.[0] || '');
                        }}
                        options={kelasList.map(k => ({ value: k, label: k }))}
                    />
                    <FilterSelect
                        label="Mata Pelajaran"
                        icon="journal-bookmark"
                        value={mapel}
                        onChange={(val) => setMapel(val)}
                        options={(mapelByKelas[kelas] || []).map(m => ({ value: m, label: m }))}
                        variant="wide"
                    />
                    <FilterSelect
                        label="Tahun Ajaran"
                        icon="calendar3"
                        value={tahunAjaran}
                        onChange={(val) => setTahunAjaran(val)}
                        options={tahunAjaranList.map(t => ({ value: t, label: t }))}
                    />
                    <FilterSelect
                        label="Semester"
                        icon="hourglass-split"
                        value={semester}
                        onChange={(val) => setSemester(val)}
                        options={[
                            { value: 'Ganjil', label: 'Ganjil' },
                            { value: 'Genap', label: 'Genap' }
                        ]}
                    />
                    <FilterSearch
                        label="Cari Siswa"
                        placeholder="Cari nama/NISN..."
                        value={searchTerm}
                        onChange={setSearchTerm}
                    />
                    <FilterActions>
                        {/* Menu "…" — HANYA tampil di mobile (.sk__menuWrap disembunyikan
                            di >= 640px). Empat tombol berlabel di bawahnya sebaliknya
                            hanya tampil di desktop lewat .sk__btnDesktopOnly. Tanpa ini,
                            keempatnya berbaris jadi dua baris pil melayang di atas konten,
                            karena toolbar mobile memang sticky tanpa kontainer. */}
                        <div className="sk__menuWrap" ref={actionMenuRef}>
                            <button
                                type="button"
                                className={`sk__btnActionMenu ftb-btn--iconOnlyMobile ${showActionMenu ? "isOpen" : ""}`}
                                onClick={() => setShowActionMenu(v => !v)}
                                title="Menu Aksi"
                                aria-label="Menu Aksi"
                                aria-haspopup="menu"
                                aria-expanded={showActionMenu}
                            >
                                <MoreHorizontal size={16} />
                                <span className="ftb-btn-label">Aksi</span>
                            </button>

                            {showActionMenu && (
                                <div className="sk__menu" role="menu">
                                    {(activeMode === 'KUIS' || activeMode === 'TUGAS') && (canDo('input') || isAdmin) && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem sk__menuItemMobileOnly"
                                            onClick={() => {
                                                setShowActionMenu(false);
                                                const jenisStr = activeMode.charAt(0) + activeMode.slice(1).toLowerCase();
                                                setEditingTagihan({ jenis: jenisStr, materi_tp: materi, nama_tagihan: getNextAutoLabel(), topik: '' });
                                                setShowTagihanModal(true);
                                            }}
                                        >
                                            <span className="sk__menuIcon"><Plus size={16} style={{ color: '#3083FF' }} /></span>
                                            <span className="sk__menuLabel">Tambah Kolom</span>
                                        </button>
                                    )}

                                    {activeMode === 'APRESIASI' && (canDo('input') || isAdmin) && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem sk__menuItemMobileOnly"
                                            onClick={() => { setShowActionMenu(false); setShowSesiApresiasi(true); }}
                                        >
                                            <span className="sk__menuIcon"><Zap size={16} style={{ color: '#3083FF' }} /></span>
                                            <span className="sk__menuLabel">Mulai Sesi</span>
                                        </button>
                                    )}

                                    {activeMode !== 'PAS' && activeMode !== 'APRESIASI' && (canDo('config') || isAdmin) && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem sk__menuItemMobileOnly"
                                            onClick={() => { setShowActionMenu(false); setShowConfigModal(true); }}
                                        >
                                            <span className="sk__menuIcon"><Sliders size={16} style={{ color: '#6366f1' }} /></span>
                                            <span className="sk__menuLabel">Bobot</span>
                                        </button>
                                    )}

                                    {activeMode !== 'REKAP' && activeMode !== 'APRESIASI' && canDo('input') && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem sk__menuItemMobileOnly"
                                            onClick={() => { setShowActionMenu(false); setShowImportModal(true); }}
                                        >
                                            <span className="sk__menuIcon"><FileSpreadsheet size={16} style={{ color: '#f97316' }} /></span>
                                            <span className="sk__menuLabel">Import</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="sk__menuItem sk__menuItemMobileOnly"
                                        onClick={() => { setShowActionMenu(false); handleExport(false); }}
                                    >
                                        <span className="sk__menuIcon"><Download size={16} style={{ color: '#3b82f6' }} /></span>
                                        <span className="sk__menuLabel">Export</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {(activeMode === 'KUIS' || activeMode === 'TUGAS') && (canDo('input') || isAdmin) && (
                            <Button
                                variant="secondary"
                                icon="add"
                                className="sk__btnDesktopOnly"
                                onClick={() => {
                                    const jenisStr = activeMode.charAt(0) + activeMode.slice(1).toLowerCase();
                                    setEditingTagihan({ jenis: jenisStr, materi_tp: materi, nama_tagihan: getNextAutoLabel(), topik: '' });
                                    setShowTagihanModal(true);
                                }}
                                title="Tambah Kolom Nilai Baru"
                            >
                                Tambah Kolom
                            </Button>
                        )}
                        {activeMode === 'APRESIASI' && (canDo('input') || isAdmin) && (
                            <Button
                                variant="primary"
                                className="sk__btnDesktopOnly"
                                leftIcon={<Zap size={15} />}
                                onClick={() => setShowSesiApresiasi(true)}
                                title="Mulai sesi kuis rebutan"
                            >
                                Mulai Sesi
                            </Button>
                        )}
                        {/* Bobot tidak berlaku untuk Apresiasi: poinnya memang tidak
                            pernah ikut dibobot ke NA maupun rapor. */}
                        {activeMode !== 'PAS' && activeMode !== 'APRESIASI' && (canDo('config') || isAdmin) && (
                            <Button
                                variant="outline"
                                className="sk__btnDesktopOnly"
                                leftIcon={<Sliders size={15} style={{ color: '#6366f1' }} />}
                                onClick={() => setShowConfigModal(true)}
                                title="Konfigurasi Bobot Penilaian"
                            >
                                Bobot
                            </Button>
                        )}
                        {/* Import Excel tidak masuk akal untuk Apresiasi: poinnya
                            lahir dari sesi live, bukan dari kolom yang diketik. */}
                        {activeMode !== 'REKAP' && activeMode !== 'APRESIASI' && (
                            <Button
                                variant="secondary"
                                icon="import"
                                className="sk__btnDesktopOnly"
                                onClick={() => setShowImportModal(true)}
                                disabled={!canDo('input')}
                            >
                                Import
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            icon="export"
                            className="sk__btnDesktopOnly"
                            onClick={() => handleExport(false)}
                        >
                            Export
                        </Button>
                    </FilterActions>
                </FilterToolbar>
                {/* Di luar FilterActions: input tersembunyi tetap terhitung sebagai anak
                    saat toolbar menentukan jumlah kolom tombol di mobile. */}
                <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleImport} />

                    {/* Row 3: Reconstructed Sub-bar BAB (Spacious 24px-32px horizontal padding, clean 36px controls) */}
                    {['KUIS','TUGAS','UH'].includes(activeMode) && (
                        <div className="nl__babBar">
                            {/* Left: BAB Selector & Action Buttons */}
                            <div className="nl__babControls">
                                {/* BAB Picker Trigger */}
                                <button
                                    type="button"
                                    className="nl__babPicker"
                                    onClick={() => setShowSumDropdown(!showSumDropdown)}
                                >
                                    <BookmarkCheck size={16} />
                                    <span>{materi}</span>
                                    {showSumDropdown ? (
                                        <ChevronUp size={14} className="nl__babPickerChevron" />
                                    ) : (
                                        <ChevronDown size={14} className="nl__babPickerChevron" />
                                    )}
                                </button>

                                {/* Quick Action Buttons: Add BAB & Edit Topik */}
                                <button
                                    type="button"
                                    className="nl__babIconBtn"
                                    onClick={(e) => { e.stopPropagation(); setShowAddSumModal(true); }}
                                    title="Tambah BAB / Sumatif Baru"
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="nl__babIconBtn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const cfg = tagihanConfig.find(t => t.jenis === 'Sum' && t.materi_tp === materi);
                                        setEditingTagihan(cfg || { jenis: 'Sum', materi_tp: materi, nama_tagihan: materi, topik: '' });
                                        setShowTagihanModal(true);
                                    }}
                                    title="Edit Nama / Topik BAB Ini"
                                >
                                    <Edit3 size={14} />
                                </button>
                            </div>

                            {/* Center: Topik Badge Info */}
                            <div className="nl__babTopik">
                                <FileText size={16} />
                                <span className="nl__babTopikLabel">Topik:</span>
                                <span className="nl__babTopikValue">
                                    {cleanTopic(tagihanConfig.find(t => t.jenis === 'Sum' && t.materi_tp === materi)?.topik) || 'Belum ada topik (klik edit untuk isi)'}
                                </span>
                            </div>

                            {/* Right: Sub-type Segmented Switcher (KUIS | TUGAS | UH) */}
                            <div className="nl__typeSwitch">
                                {[
                                    { key: 'KUIS', label: 'Kuis', icon: <Zap size={14} />, jenisKey: 'Kuis' },
                                    { key: 'TUGAS', label: 'Tugas', icon: <FileCheck size={14} />, jenisKey: 'Tugas' },
                                    { key: 'UH', label: 'UH', icon: <Award size={14} />, jenisKey: 'UH' }
                                ].map(({ key, label, icon, jenisKey }) => {
                                    const count = tagihanConfig.filter(t => t.materi_tp === materi && t.jenis === jenisKey).length;
                                    const isActive = activeMode === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            className={`nl__typeSwitchBtn ${isActive ? 'is-active' : ''}`}
                                            onClick={() => setModeIndex(modes.indexOf(key))}
                                        >
                                            {icon}
                                            <span>{label}</span>
                                            {count > 0 && <span className="nl__typeCount">{count}</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Dropdown Overlay */}
                            {showSumDropdown && (
                                <>
                                    <div className="fixed inset-0 z-[2000] bg-black/10 backdrop-blur-[1px]" onClick={() => setShowSumDropdown(false)}></div>
                                    <div className="nl__sumDropdown">
                                        <div className="nl__sumDropdownScroll">
                                            {Array.from({ length: bobot.sumCount }, (_, i) => {
                                                const sumName = `SUM ${i+1}`;
                                                return (
                                                    <button 
                                                        key={sumName} 
                                                        type="button"
                                                        className={`nl__sumOption ${materi === sumName ? 'nl__sumOption--active' : ''}`} 
                                                        onClick={() => { setMateri(sumName); setShowSumDropdown(false); }}
                                                    >
                                                        <div className="nl__sumOptionText">
                                                            <span className="nl__sumOptionName">{sumName}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                {/* Konten Utama: Loader jika sedang memuat data */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Spinner variant="buble" size={32} />
                        <span className="text-sm font-semibold text-slate-400">Memuat data nilai...</span>
                    </div>
                ) : activeMode === 'APRESIASI' ? (
                    <ApresiasiTab
                        siswa={siswa}
                        sesi={apresiasiSesi}
                        poin={apresiasiPoin}
                        searchTerm={searchTerm}
                        canDelete={canDo('input') || isAdmin}
                        onHapusSesi={handleHapusSesiApresiasi}
                    />
                ) : (
                <>
                {/* ── Mobile: daftar kartu nilai ──
                    Filter, tab mode, dan sub-bar BAB tidak lagi digandakan di sini —
                    FilterToolbar, Tab, dan .nl__babBar di atas sudah responsif dan
                    tampil di semua lebar layar. */}
                <div className="nl__mobileCards">
                        {/* Topic Manager Card (KUIS/TUGAS only) */}
                        {['KUIS', 'TUGAS'].includes(activeMode) && (
                            <div className="nl__topicCard">
                                <div className="nl__topicCardHeader">
                                    <div className="flex items-center gap-2">
                                        <FileCheck size={16} className="text-blue-500" />
                                        <span className="font-bold">Daftar {activeMode.charAt(0) + activeMode.slice(1).toLowerCase()}</span>
                                    </div>
                                </div>
                                <div className="nl__topicList mt-3 space-y-2">
                                    {tagihanConfig.filter(t => t.jenis === (activeMode.charAt(0) + activeMode.slice(1).toLowerCase()) && t.materi_tp === materi).length === 0 ? (
                                        <div className="text-[11px] text-slate-400 italic py-1 text-center">Belum ada kolom {activeMode.toLowerCase()}</div>
                                    ) : (
                                        tagihanConfig.filter(t => t.jenis === (activeMode.charAt(0) + activeMode.slice(1).toLowerCase()) && t.materi_tp === materi).map(it => (
                                            <div key={it.id} className="nl__topicItem">
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="nl__topicLabel">{it.nama_tagihan}</span>
                                                        <button className="nl__topicEditAction" onClick={() => { setEditingTagihan(it); setShowTagihanModal(true); }}>
                                                            <Pencil size={12} />
                                                        </button>
                                                    </div>
                                                    {it.topik && <span className="nl__topicText">{it.topik}</span>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                        {filteredSiswa.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">Tidak ada data siswa</div>
                        ) : (
                            /* Baris daftar, bukan kartu key-value. Kartu lama memuat
                               seluruh kolom nilai sehingga satu layar cuma memuat 2-3
                               siswa dari satu kelas; kolom nilainya kini pindah ke modal
                               yang terbuka saat baris diketuk. */
                            <MobileList label="Daftar siswa">
                                {filteredSiswa.map((s) => {
                                    const nama = s.nama_siswa || (s as any).nama || '';
                                    const terisi = visibleColumns.filter(
                                        col => String(getScore(s.nisn, col.jenis, col.materiTp, col.tag) ?? '') !== ''
                                    ).length;
                                    return (
                                        <MobileListItem
                                            key={s.nisn}
                                            title={nama}
                                            subtitle={s.nisn}
                                            // Lewat proxy: foto yang di-host di icgowa.sch.id
                                            // tidak bisa dimuat langsung dari browser.
                                            avatarSrc={getProxiedImageUrl((s as any).foto_profil)}
                                            // Cadangan saat siswa belum punya foto: ikon orang,
                                            // bukan inisial nama. Inisial di daftar sekelas banyak
                                            // yang kembar ("A" untuk Adilah, Ahmad, Andi, ...)
                                            // sehingga justru terbaca seperti pembeda padahal bukan.
                                            icon="person-fill"
                                            seed={s.nisn}
                                            /* Ringkasan di kanan: nilai rapor untuk mode Rekap,
                                               dan berapa kolom sudah terisi untuk mode input. */
                                            badge={
                                                activeMode === 'REKAP'
                                                    ? <span className="nl__listRapor">{calculateRapor(s.nisn)}</span>
                                                    : visibleColumns.length > 0
                                                        ? <span className="nl__listCount">{terisi}/{visibleColumns.length}</span>
                                                        : undefined
                                            }
                                            onClick={() => setNilaiDetailSiswa(s)}
                                        />
                                    );
                                })}
                            </MobileList>
                        )}
                    </div>

                    {/* --- DESKTOP TABLE VIEW --- */}
                    <div className="nl__tableWrap">
                    <table
                        className="nl__table"
                        ref={tableRef}
                        style={{ '--nl-score-cols': activeMode === 'REKAP' ? bobot.sumCount + 2 : Math.max(visibleColumns.length, 1) } as React.CSSProperties}
                    >
                        <thead>
                            <tr>
                                <th className="w-12 text-center">NO</th>
                                <th className="w-24 text-center">NISN</th>
                                <th className="text-left pl-5">NAMA SISWA</th>
                                {activeMode === 'REKAP' ? (
                                    <>
                                        {Array.from({ length: bobot.sumCount }, (_, i) => {
                                            const sumName = `SUM ${i+1}`;
                                            const cfg = tagihanConfig.find(t => t.jenis === 'Sum' && t.materi_tp === sumName);
                                            return (
                                                <th key={i} className="nl__colScore align-bottom">
                                                    <div className="nl__thLabel">
                                                        <span>{sumName}</span>
                                                    </div>
                                                    {cleanTopic(cfg?.topik) && <div className="nl__thTopik" title={cfg!.topik}>{cfg!.topik}</div>}
                                                    <div className="nl__thActions">
                                                        <button className="nl__editBtn" title="Edit topik SUM" onClick={() => { setEditingTagihan(cfg || { jenis: 'Sum', materi_tp: sumName, nama_tagihan: sumName }); setShowTagihanModal(true); }}><Pencil size={13} /></button>
                                                        <button className="nl__deleteBtn" title="Hapus SUM" onClick={() => handleDeleteSum(i + 1)}><Trash2 size={13} /></button>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="nl__colScore">PAS</th>
                                        <th className="nl__colScore nl__colRapor">Rapor</th>
                                    </>
                                ) : visibleColumns.length === 0 ? (
                                    <th className="nl__thEmpty">Belum ada kolom {activeMode.toLowerCase()} untuk {materi}</th>
                                ) : (
                                    visibleColumns.map(col => (
                                        <th key={col.key} className="nl__colScore align-bottom">
                                            <div className="nl__thLabel">
                                                <span>{col.label}</span>
                                            </div>
                                            {col.config && (
                                                <div className="nl__thActions">
                                                    <button className="nl__viewBtn" onClick={() => setViewTopicData({ topik: col.topik, nama_tagihan: col.label })} title="Lihat topik"><Eye size={13} /></button>
                                                    <button className="nl__editBtn" onClick={() => { setEditingTagihan(col.config!); setShowTagihanModal(true); }} title="Edit tagihan"><Pencil size={13} /></button>
                                                    <button className="nl__deleteBtn" onClick={() => handleDeleteTagihan(col.config!.id!, col.label)} title="Hapus tagihan"><Trash2 size={13} /></button>
                                                </div>
                                            )}
                                        </th>
                                    ))
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSiswa.length === 0 && (
                                <tr>
                                    <td className="nl__tableEmpty" colSpan={3 + (activeMode === 'REKAP' ? bobot.sumCount + 2 : Math.max(visibleColumns.length, 1))}>
                                        {searchTerm ? `Tidak ada siswa yang cocok dengan "${searchTerm}"` : 'Tidak ada data siswa'}
                                    </td>
                                </tr>
                            )}
                            {filteredSiswa.map((s, idx) => (
                                <tr key={s.nisn}>
                                    <td className="text-center nl__index" data-label="No">{idx + 1}</td>
                                    <td className="text-center" data-label="NISN"><span className="nl__idBadge">{s.nisn}</span></td>
                                    <td className="nl__studentName" data-label="Nama Siswa">{s.nama_siswa || (s as any).nama}</td>
                                    {activeMode === 'REKAP' ? (
                                        <>
                                            {Array.from({ length: bobot.sumCount }, (_, i) => <td key={i} className="nl__colScore text-center"><span className="nl__scoreBadge">{(() => { const v = calculateNABab(s.nisn, `SUM ${i+1}`); return (typeof v === 'number' && !isNaN(v)) ? Math.round(v) : '-'; })()}</span></td>)}
                                            <td className="nl__colScore text-center"><span className="nl__scoreBadge">{getScore(s.nisn, 'PAS', '-')}</span></td>
                                            <td className="nl__colScore nl__colRapor text-center"><span className="nl__scoreFinal">{calculateRapor(s.nisn)}</span></td>
                                        </>
                                    ) : visibleColumns.length === 0 ? (
                                        <td className="nl__tableEmpty">&mdash;</td>
                                    ) : (
                                        visibleColumns.map((col, cIdx) => (
                                            <td key={col.key} className="nl__colScore text-center">
                                                <input
                                                    className={`nl__scoreInput ${isDiffFromDB(s.nisn, col.jenis, col.materiTp, col.tag) ? 'is-changed' : ''}`}
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={getScore(s.nisn, col.jenis, col.materiTp, col.tag)}
                                                    onChange={e => handleScoreChange(s.nisn, col.jenis, col.materiTp, col.tag, e.target.value)}
                                                    onKeyDown={e => handleKeyDown(e, idx, cIdx)}
                                                    readOnly={!canDo('input') && !isAdmin}
                                                />
                                            </td>
                                        ))
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>

                    {/* Catatan rumus diletakkan DI LUAR .nl__tableWrap — wrapper itu kini
                        viewport gulir tabel, jadi isinya akan ikut tergulir bila di dalam. */}
                    {activeMode === 'REKAP' && (
                        <div className="nl__rekapInfo">
                            <div className="flex items-center gap-3">
                                <Lightbulb size={16} />
                                <div>
                                    <span className="font-bold">Rumus Rapor:</span>{' '}
                                    <span>Rata-rata SUM ({bobot.sumCount}x) &times; {bobot.ratioRapor.sums}% + PAS &times; {bobot.ratioRapor.pas}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
                )}

                </>
                )}

                {/* Admin Panel */}
                {adminMode && (
                    <NilaiAdminPanel
                        user={user}
                        onClose={() => setAdminMode(false)}
                    />
                )}


            {/* Bilah "belum tersimpan". Dulu tombol bundar melayang di sudut
                kanan bawah — tepat di bawah <DesktopFab> Mode Admin (bottom 30 /
                right 30, z-index 450), jadi FAB itu menutupinya dan dua aksi yang
                sifatnya berbeda tampak berebut satu tempat.

                Sebagai bilah melintang, ia tidak lagi bersaing dengan FAB, dan
                keadaan "ada N perubahan belum disimpan" terbaca sebagai kalimat,
                bukan cuma angka di dalam tombol. */}
            {!adminMode && typeof document !== 'undefined' && Object.keys(changes).length > 0 && (canDo('input') || isAdmin) && createPortal(
                <div className="nl__saveBar" role="status">
                    <span className="nl__saveBarText">
                        <AlertCircle size={16} aria-hidden="true" />
                        <b>{Object.keys(changes).length}</b> perubahan
                    </span>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        title="Simpan Perubahan Nilai"
                        leftIcon={<UploadCloud size={15} />}
                    >
                        Simpan
                    </Button>
                </div>,
                document.body
            )}


            {/* Sesi Nilai Apresiasi (kuis rebutan) */}
            <SesiApresiasiModal
                open={showSesiApresiasi}
                onClose={() => setShowSesiApresiasi(false)}
                siswa={siswa}
                kelas={kelas}
                mapel={mapel}
                onSimpan={handleSimpanSesiApresiasi}
            />

            {/* Import Modal */}
            {
                showImportModal && typeof document !== 'undefined' && createPortal(
                    <div className="nl__modalOverlay animate-fade">
                        <div className="nl__modalContent" style={{ maxWidth: '450px' }}>
                            <div className="nl__modalHeader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0">
                                        <FileSpreadsheet size={20} />
                                    </div>
                                    <h3 className="nl__modalTitle">Import Data Nilai</h3>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="nl__modalClose">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="nl__modalBody" style={{ padding: '20px 24px' }}>
                                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(241, 245, 249, 0.8)', border: '1px solid #e2e8f0', marginBottom: '18px' }} className="dark:bg-slate-900/60 dark:border-slate-800">
                                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }} className="dark:text-slate-300">
                                        Unduh template file Excel terlebih dahulu, isi data nilai siswa secara offline, kemudian upload kembali file tersebut ke sistem.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {/* Step 1: Download Template */}
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }} className="dark:text-slate-400">
                                            Langkah 1 — Unduh Format
                                        </div>
                                        <button 
                                            style={{ 
                                                width: '100%', 
                                                padding: '11px 16px', 
                                                borderRadius: '8px', 
                                                background: '#f0f9ff', 
                                                border: '1.5px solid #7dd3fc', 
                                                color: '#0284c7', 
                                                fontWeight: 700, 
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s ease'
                                            }}
                                            className="hover:bg-sky-100 dark:!bg-sky-950/50 dark:!border-sky-700 dark:!text-sky-300" 
                                            onClick={() => handleExport(true)}
                                        >
                                            <Download size={15} /> <span>Download Template Excel</span>
                                        </button>
                                    </div>

                                    {/* Step 2: Upload Excel */}
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }} className="dark:text-slate-400">
                                            Langkah 2 — Unggah File Nilai
                                        </div>
                                        <button 
                                            style={{ 
                                                width: '100%', 
                                                padding: '11px 16px', 
                                                borderRadius: '8px', 
                                                background: '#1d6bf3', 
                                                border: '1.5px solid #1d6bf3', 
                                                color: '#ffffff', 
                                                fontWeight: 700, 
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                boxShadow: '0 4px 12px rgba(29, 107, 243, 0.25)',
                                                transition: 'all 0.2s ease'
                                            }}
                                            className="hover:bg-blue-700 dark:!bg-blue-600 dark:!border-blue-500" 
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload size={15} /> <span>Upload File Excel</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* View Topic Modal */}
            {viewTopicData && typeof document !== 'undefined' && createPortal(
                <div className="nl__modalOverlay animate-fade" onClick={() => setViewTopicData(null)}>
                    <div className="nl__modalContent nl__viewTopicModal" onClick={e => e.stopPropagation()}>
                        <div className="nl__modalHeader">
                            <div className="flex items-center gap-2">
                                <div className="nl__viewTopicIcon">
                                    <FileText size={18} className="text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="nl__modalTitle" style={{marginBottom:0}}>{viewTopicData.nama_tagihan}</h3>
                                </div>
                            </div>
                            <button onClick={() => setViewTopicData(null)} className="nl__viewTopicClose">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="nl__modalBody">
                            <div className="nl__viewTopicLabel">Judul / Topik</div>
                            <div className="nl__viewTopicContent">
                                {viewTopicData.topik ? viewTopicData.topik : (
                                    <span className="nl__viewTopicEmpty">Belum ada judul</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Tagihan Modal */}
            {
                showTagihanModal && typeof document !== 'undefined' && createPortal(
                    <div className="nl__modalOverlay animate-fade">
                        <div className="nl__modalContent">
                            <div className="nl__modalHeader">
                                <h3 className="nl__modalTitle">{editingTagihan?.id ? 'Edit' : 'Tambah'} {editingTagihan?.jenis}</h3>
                                <button onClick={() => setShowTagihanModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                            <div className="nl__modalBody">
                                <div className="nl__formGroup">
                                    <label className="nl__formLabel">Label Kolom (Kode)</label>
                                    <input
                                        className="nl__formInput"
                                        value={editingTagihan?.nama_tagihan || ''}
                                        onChange={e => setEditingTagihan(editingTagihan ? { ...editingTagihan, nama_tagihan: e.target.value.toUpperCase().replace(/\s/g, '_') } : null)}
                                        placeholder="Contoh: KUIS_1"
                                    />
                                </div>
                                <div className="nl__formGroup">
                                    <label className="nl__formLabel">Topik / Materi</label>
                                    <textarea
                                        className="nl__formInput"
                                        rows={3}
                                        value={cleanTopic(editingTagihan?.topik)}
                                        onChange={e => setEditingTagihan(editingTagihan ? { ...editingTagihan, topik: e.target.value } : null)}
                                        placeholder="Contoh: Aljabar Linear..."
                                    />
                                </div>
                                <div className="nl__formActions">
                                    <div className="flex gap-2 mr-auto">
                                        {editingTagihan?.id && editingTagihan?.jenis === 'Sum' && (
                                            <button className="nl__btn nl__btnDanger" onClick={() => {
                                                const num = parseInt(editingTagihan.materi_tp.split(' ')[1]);
                                                handleDeleteSum(num);
                                                setShowTagihanModal(false);
                                            }}>
                                                <Trash2 size={14} className="mr-1 inline" /> Hapus SUM
                                            </button>
                                        )}
                                    </div>
                                    <button className="nl__btn nl__btnSecondary" onClick={() => setShowTagihanModal(false)}>Batal</button>
                                    <button className="nl__btn nl__btnPrimary" onClick={async () => {
                                        if (!editingTagihan) return;
                                        setLoading(true);
                                        try {
                                            const body = { nip: user.nip, kelas, mapel, semester, ...editingTagihan, nama: editingTagihan.nama_tagihan, materi: editingTagihan.materi_tp, tahun_ajaran: tahunAjaran };
                                            const res = await authFetch('/api/nilai/tagihan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                                            const json = await res.json();
                                            if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menyimpan');

                                            // Force visibility for the improved UX (so it doesn't disappear if empty)
                                            const newKey = `${body.jenis}||${body.materi}||${body.nama}`;
                                            setForcedVisibleTags(prev => new Set(prev).add(newKey));

                                            setShowTagihanModal(false); setEditingTagihan(null); loadData();
                                            notif.success('Tagihan berhasil disimpan');
                                        } catch (err: any) { notif.error(err.message); } finally { setLoading(false); }
                                    }}>
                                        {loading ? (
                                            <div className="flex items-center justify-center py-1">
                                                <Spinner variant="buble" size={16} color="#ffffff" />
                                            </div>
                                        ) : 'Simpan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
            {/* Add SUM Modal */}
            {
                showAddSumModal && typeof document !== 'undefined' && createPortal(
                    <div className="nl__modalOverlay animate-fade">
                        <div className="nl__modalContent" style={{ maxWidth: '450px' }}>
                            <div className="nl__modalHeader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0">
                                        <BookPlus size={20} />
                                    </div>
                                    <h3 className="nl__modalTitle">Tambah SUM {bobot.sumCount + 1}</h3>
                                </div>
                                <button onClick={() => setShowAddSumModal(false)} className="nl__modalClose">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="nl__modalBody">
                                <div className="nl__formGroup">
                                    <label className="nl__formLabel">Judul Bab / Topik</label>
                                    <input
                                        className="nl__formInput"
                                        placeholder="Contoh: Persamaan Kuadrat"
                                        value={newSumTopic}
                                        onChange={e => setNewSumTopic(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="nl__formActions">
                                    <button className="nl__btn nl__btnSecondary" onClick={() => setShowAddSumModal(false)}>Batal</button>
                                    <button className="nl__btn nl__btnPrimary" onClick={() => handleAddSum(newSumTopic)} disabled={loading}>
                                        {loading ? (
                                            <div className="flex items-center justify-center py-1">
                                                <Spinner variant="buble" size={16} color="#ffffff" />
                                            </div>
                                        ) : 'Tambah SUM'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
            {/* Config Modal */}
            {
                showConfigModal && typeof document !== 'undefined' && createPortal(
                    <div className="nl__modalOverlay animate-fade">
                        <div className="nl__modalContent">
                            <div className="nl__modalHeader">
                                <h3 className="nl__modalTitle">
                                    {activeMode === 'REKAP' ? 'Konfigurasi Bobot Rapor' : 'Konfigurasi Bobot Sumatif'}
                                </h3>
                                <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                            <div className="nl__modalBody">
                                {activeMode === 'REKAP' ? (
                                    <>
                                        <p className="text-sm text-slate-500 mb-5">Atur perbandingan bobot antara rata-rata SUM dengan nilai PAS untuk menghitung nilai rapor.</p>
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            {(['sums', 'pas'] as const).map(k => {
                                                const totalRapor = (bobot.ratioRapor.sums || 0) + (bobot.ratioRapor.pas || 0);
                                                const val = bobot.ratioRapor[k] || 0;
                                                const percent = totalRapor > 0 ? Math.round((val / totalRapor) * 100) : 0;
                                                return (
                                                    <div key={k} className="nl__formGroup">
                                                        <label className="nl__formLabel">{k === 'sums' ? 'Rata-rata SUM' : 'PAS'}</label>
                                                        <input
                                                            type="number"
                                                            className="nl__formInput text-center"
                                                            value={val}
                                                            onChange={e => setBobot({ ...bobot, ratioRapor: { ...bobot.ratioRapor, [k]: parseInt(e.target.value) || 0 } })}
                                                        />
                                                        <div className="text-[10px] text-center mt-1 text-slate-400 font-bold">{percent}%</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="bg-blue-50 text-blue-700 text-xs font-medium px-4 py-3 rounded-xl border border-blue-100 mb-4">
                                            <Lightbulb size={14} className="mr-1.5 inline" />
                                            Rumus: Rata-rata SUM × {bobot.ratioRapor.sums || 0} + PAS × {bobot.ratioRapor.pas || 0} ÷ {(bobot.ratioRapor.sums || 0) + (bobot.ratioRapor.pas || 0)}
                                            {((bobot.ratioRapor.sums || 0) + (bobot.ratioRapor.pas || 0)) <= 0 && (
                                                <div className="text-red-600 text-xs mt-2 font-semibold"><AlertTriangle size={14} className="mr-1 inline" />Total bobot harus lebih dari 0</div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-slate-500 mb-5">Atur perbandingan bobot antara Kuis, Tugas, dan UH untuk menghitung nilai per SUM/BAB.</p>
                                        <div className="grid grid-cols-3 gap-4 mb-6">
                                            {['kuis', 'tugas', 'uh'].map(k => {
                                                const totalHarian = (bobot.ratioHarian.kuis || 0) + (bobot.ratioHarian.tugas || 0) + (bobot.ratioHarian.uh || 0);
                                                const val = (bobot.ratioHarian as any)[k] || 0;
                                                const percent = totalHarian > 0 ? Math.round((val / totalHarian) * 100) : 0;
                                                return (
                                                    <div key={k} className="nl__formGroup">
                                                        <label className="nl__formLabel">{k.toUpperCase()}</label>
                                                        <input
                                                            type="number"
                                                            className="nl__formInput text-center"
                                                            value={val}
                                                            onChange={e => setBobot({ ...bobot, ratioHarian: { ...bobot.ratioHarian, [k]: parseInt(e.target.value) || 0 } })}
                                                        />
                                                        <div className="text-[10px] text-center mt-1 text-slate-400 font-bold">{percent}%</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                <div className="nl__formGroup mb-4 pt-4 border-t border-slate-200">
                                    <label className="nl__formLabel font-semibold">KKM Mata Pelajaran (Kriteria Ketuntasan Minimal)</label>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <input
                                            type="number"
                                            min={50}
                                            max={100}
                                            className="nl__formInput w-28 text-center font-bold text-base"
                                            value={bobot.kkm ?? 75}
                                            onChange={e => setBobot({ ...bobot, kkm: parseInt(e.target.value) || 75 })}
                                        />
                                        <span className="text-xs text-slate-500">Standar nilai ketuntasan (default: 75)</span>
                                    </div>
                                </div>

                                <div className="nl__formActions">
                                    <button className="nl__btn nl__btnSecondary" onClick={() => setShowConfigModal(false)}>Batal</button>
                                    <button className="nl__btn nl__btnPrimary" disabled={activeMode === 'REKAP' ? ((bobot.ratioRapor.sums || 0) + (bobot.ratioRapor.pas || 0)) <= 0 : ((bobot.ratioHarian.kuis || 0) + (bobot.ratioHarian.tugas || 0) + (bobot.ratioHarian.uh || 0)) <= 0} onClick={async () => {
                                        const cfgNip = user.nip;
                                        const cfgRes = await authFetch('/api/nilai/bobot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nip: cfgNip, kelas, mapel, semester, config: bobot, tahun_ajaran: tahunAjaran }) });
                                        const cfgJson = await cfgRes.json().catch(() => ({ ok: false }));
                                        if (!cfgRes.ok || !cfgJson.ok) notif.error(cfgJson.error || 'Gagal menyimpan konfigurasi');
                                        setShowConfigModal(false); loadData();
                                    }}>Simpan Konfigurasi</button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
            {/* Nilai per siswa untuk daftar mobile. Isinya sama persis dengan
                yang dulu ditumpuk di dalam kartu; dipindah ke sini supaya
                daftarnya tetap bisa di-scan sekilas. */}
            {nilaiDetailSiswa && (
                <Modal
                    size="sm"
                    variant="edit"
                    onClose={() => setNilaiDetailSiswa(null)}
                    labelledBy="nilai-siswa-title"
                >
                    <ModalHeader
                        id="nilai-siswa-title"
                        icon={<FileText size={18} />}
                        title={nilaiDetailSiswa.nama_siswa || nilaiDetailSiswa.nama || ''}
                        subtitle={nilaiDetailSiswa.nisn}
                        onClose={() => setNilaiDetailSiswa(null)}
                    />
                    <ModalBody>
                        {/* Daftar nilai: baris label-nilai yang dipisah garis rambut,
                            bukan kotak per baris. Kelasnya sengaja BUKAN .nl__scoreRow
                            (gaya kartu mobile lama, penuh !important) supaya tidak
                            perlu adu spesifisitas dengan aturan yang sudah usang. */}
                        <div className="nl__msList">
                            {activeMode === 'REKAP' ? (
                                <>
                                    {Array.from({ length: bobot.sumCount }, (_, i) => (
                                        <div key={i} className="nl__msRow">
                                            <span className="nl__msLabel">SUM {i + 1}</span>
                                            <span className="nl__msValue">{(() => { const v = calculateNABab(nilaiDetailSiswa.nisn, `SUM ${i+1}`); return (typeof v === 'number' && !isNaN(v)) ? Math.round(v) : '-'; })()}</span>
                                        </div>
                                    ))}
                                    <div className="nl__msRow nl__msRow--total">
                                        <span className="nl__msLabel">Rapor</span>
                                        <span className="nl__msValue nl__msValue--total">{calculateRapor(nilaiDetailSiswa.nisn)}</span>
                                    </div>
                                </>
                            ) : visibleColumns.length === 0 ? (
                                <div className="nl__msEmpty">Belum ada {activeMode.toLowerCase()}</div>
                            ) : (
                                visibleColumns.map((col) => (
                                    <div key={col.key} className="nl__msRow">
                                        <span className="nl__msLabel">
                                            {col.label}
                                            {/* Ikon topik menempel pada LABEL, bukan di ujung
                                                baris: yang dijelaskannya adalah judul tagihan
                                                itu, bukan nilainya. */}
                                            {col.config && (
                                                <button
                                                    type="button"
                                                    className="nl__msTopicBtn"
                                                    title={col.topik || 'Lihat judul'}
                                                    aria-label={`Lihat judul ${col.label}`}
                                                    onClick={() => setViewTopicData({ topik: col.topik, nama_tagihan: col.label })}
                                                >
                                                    <Info size={15} strokeWidth={2} aria-hidden="true" />
                                                </button>
                                            )}
                                        </span>
                                        <input
                                            className={`nl__msInput ${isDiffFromDB(nilaiDetailSiswa.nisn, col.jenis, col.materiTp, col.tag) ? 'is-changed' : ''}`}
                                            type="number"
                                            inputMode="decimal"
                                            value={getScore(nilaiDetailSiswa.nisn, col.jenis, col.materiTp, col.tag)}
                                            onChange={e => handleScoreChange(nilaiDetailSiswa.nisn, col.jenis, col.materiTp, col.tag, e.target.value)}
                                            readOnly={!canDo('input') && !isAdmin}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => setNilaiDetailSiswa(null)} icon="cancel">
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}
            <MaintenanceBanner pageKey="maintenance_nilai" />
        </div>
    );
}
