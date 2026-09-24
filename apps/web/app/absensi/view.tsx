'use client';

import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import Select, { components } from 'react-select';
import { RiArrowDropDownFill } from 'react-icons/ri';
import Swal from 'sweetalert2';
import ExportModal from './components/ExportModal';
import CatatanSiswaModal from './components/CatatanSiswaModal';
import KeteranganModal from './components/KeteranganModal';
import { useModalBlur } from '@/components/ModalBlurProvider';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSelect, FilterField, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { useTimezone } from '@/hooks/use-timezone';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { entryTimeWindowForDate } from '@/lib/ketidakhadiran-jp';
import { MobileList, MobileListItem } from '@/components/mobile';
import { Modal, ModalHeader, ModalBody, ModalViewFooter } from '@/components/ui/Modal';
import { Tabs, type TabItem } from '@/components/ui/Tab';
import './absensi.css';

const customSelectStyles = {
    control: (base: any, state: any) => ({
        ...base,
        background: 'transparent',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        borderRadius: '8px',
        minHeight: '38px',
        height: '38px',
        flexWrap: 'nowrap',
        padding: 0,
        width: '100%',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    placeholder: (base: any) => ({
        ...base,
        color: 'var(--n-muted)',
        fontSize: '13px',
        fontWeight: '500',
    }),
    singleValue: (base: any) => ({
        ...base,
        color: 'var(--n-ink)',
        fontSize: '13px',
        fontWeight: '500',
    }),
    input: (base: any) => ({
        ...base,
        color: 'transparent !important',
        caretColor: 'transparent !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        background: 'transparent !important',
        margin: 0,
        padding: 0,
        opacity: 0,
        width: 0,
        minWidth: 0,
        '& input': {
            color: 'transparent !important',
            caretColor: 'transparent !important',
            border: 'none !important',
            outline: 'none !important',
            boxShadow: 'none !important',
            background: 'transparent !important',
            opacity: 0,
            width: 0,
        }
    }),
    menu: (base: any) => ({
        ...base,
        background: 'var(--n-card)',
        borderRadius: '12px',
        border: '1px solid var(--n-border)',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        zIndex: 9999,
    }),
    option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected 
            ? 'var(--n-primary)' 
            : state.isFocused 
                ? 'var(--n-surface)' 
                : 'transparent',
        color: state.isSelected ? 'white' : 'var(--n-ink)',
        fontSize: '0.875rem',
        fontWeight: state.isSelected ? '600' : '500',
        padding: '10px 14px',
        cursor: 'pointer',
        '&:active': {
            backgroundColor: 'var(--n-primary)',
            color: 'white',
        },
    }),
    multiValue: (base: any) => ({
        ...base,
        backgroundColor: 'var(--n-primary)',
        borderRadius: '6px',
        color: 'white',
        flex: '0 1 auto',
        minWidth: 0,
    }),
    multiValueLabel: (base: any) => ({
        ...base,
        color: 'white',
        fontWeight: '600',
        fontSize: '0.75rem',
        padding: '2px 6px',
    }),
    multiValueRemove: (base: any) => ({
        ...base,
        color: 'white',
        opacity: 0.8,
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            opacity: 1,
        },
    }),
    valueContainer: (base: any) => ({
        ...base,
        height: '38px',
        padding: '0 8px',
        flexWrap: 'nowrap',
        overflow: 'hidden',
    }),
    dropdownIndicator: (base: any) => ({
        ...base,
        color: 'var(--n-muted)',
        '&:hover': {
            color: 'var(--n-primary)',
        },
    }),
};

// Jumlah chip yang ditampilkan sebelum diringkas jadi "+N".
// Menjaga tinggi control tetap 42px berapa pun jam yang dipilih.
const MAX_VISIBLE_CHIPS = 1;

const JamDropdownIndicator = (props: any) => {
    return (
        <components.DropdownIndicator {...props}>
            <RiArrowDropDownFill size={20} className="ftb-select-icon" style={{ position: 'static', opacity: 0.8 }} />
        </components.DropdownIndicator>
    );
};

const JamClearIndicator = (props: any) => {
    return (
        <components.ClearIndicator {...props}>
            <i className="bi bi-x-lg text-slate-400 hover:text-red-500 text-[11px] mr-1"></i>
        </components.ClearIndicator>
    );
};

const JamValueContainer = ({ children, ...props }: any) => {
    const [chips, input] = children;
    const list = Array.isArray(chips) ? chips : [];
    const hidden = list.length - MAX_VISIBLE_CHIPS;

    return (
        <components.ValueContainer {...props}>
            {hidden > 0 ? (
                <>
                    {list.slice(0, MAX_VISIBLE_CHIPS)}
                    <span className="jp__moreCount" title={`${hidden} jam lain dipilih`}>+{hidden}</span>
                </>
            ) : chips}
            {input}
        </components.ValueContainer>
    );
};

// Types
interface Scope {
    kelasList: string[];
    mapelByKelas: Record<string, string[]>;
    jamKeByKelasMapel: Record<string, { jamKe: string; hari?: string; berlaku_mulai?: string }[]>;
    guru?: { nama: string; nip: string };
    schedule?: {
        hari: string;
        jam_ke: string;
        kelas: string;
        ruang?: string;
        mata_pelajaran: string;
        berlaku_mulai?: string;
    }[];
    allJadwal?: {
        hari: string;
        jam_ke: string;
        kelas: string;
        ruang?: string;
        mata_pelajaran: string;
        berlaku_mulai?: string;
    }[];
    masterWaktu?: Record<string, { mulai: string; selesai: string }>;
    masterKelas?: Record<string, string>;
}

interface Sesi {
    sesi_id: string;
    nip: string;
    kelas: string;
    mapel: string;
    tanggal: string;
    jam_ke: string;
    nama_guru: string;
    guru_pengganti_nip?: string;
    guru_pengganti_nama?: string;
    status_sesi: 'DRAFT' | 'FINAL';
    materi?: string;
    catatan?: string;
    refleksi?: string;
    draft_type: string;
}

interface AbsensiRow {
    nisn: string;
    nama_snapshot: string;
    status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';
    otomatis: boolean;
    ref_ketidakhadiran_id?: string;
    catatan?: string;
    keterangan?: string;
    // New field to persist the original source data
    system_source?: {
        id: string;
        status: 'IZIN' | 'SAKIT';
        keterangan: string;
        source_type?: string; // e.g. 'MADRASAH', 'PONDOK'
    };
    source_type?: string; // To display on UI
}

// Escape HTML untuk konten yang dirender lewat opsi `html` SweetAlert (cegah XSS)
const escapeHtml = (s: string) =>
    String(s ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));

// Ekspansi string jam ke daftar angka; menangani format koma "1, 2" DAN range "1-3" (termasuk isi range)
const expandJamNumbers = (jamStr: string): number[] => {
    const out = new Set<number>();
    String(jamStr || '').split(',').map(p => p.trim()).filter(Boolean).forEach(part => {
        const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (range) {
            const st = parseInt(range[1]);
            const en = parseInt(range[2]);
            for (let i = Math.min(st, en); i <= Math.max(st, en); i++) out.add(i);
        } else {
            const n = parseInt(part);
            if (!isNaN(n)) out.add(n);
        }
    });
    return Array.from(out).sort((a, b) => a - b);
};

export default function AbsensiPage({ user }: { user?: any }) {
    const [nip, setNip] = useState('');

    const [namaGuru, setNamaGuru] = useState('');
    const [nipDisplay, setNipDisplay] = useState('');
    const [scope, setScope] = useState<Scope | null>(null);
    const [userScope, setUserScope] = useState<Scope | null>(null);
    const [kelas, setKelas] = useState('');
    const [mapel, setMapel] = useState('');
    const [tanggal, setTanggal] = useState('');
    const [jamKe, setJamKe] = useState('');

    const [currentSesi, setCurrentSesi] = useState<Sesi | null>(null);
    const [rows, setRows] = useState<AbsensiRow[]>([]);
    const [initialSnapshot, setInitialSnapshot] = useState<Map<string, string>>(new Map());

    // New States for Jurnal
    const [materi, setMateri] = useState('');
    const [refleksi, setRefleksi] = useState('');

    const [loading, setLoading] = useState(false);

    const [userPermissions, setUserPermissions] = useState<any[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [roles, setRoles] = useState<string[]>([]);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportInitialMode, setExportInitialMode] = useState<'GURU' | 'WALI' | 'ADMIN'>('GURU');
    const [exportLockMode, setExportLockMode] = useState<boolean>(false);
    const [userRole, setUserRole] = useState<string>('GURU');

    // Catatan Pembelajaran (Positif/Negatif)
    const [catatanModalRow, setCatatanModalRow] = useState<AbsensiRow | null>(null);
    const [keteranganModalRow, setKeteranganModalRow] = useState<AbsensiRow | null>(null);
    /** Sesi yang detailnya dibuka di modal (dari daftar mobile panel admin). */
    const [adminDetailSesi, setAdminDetailSesi] = useState<any | null>(null);
    const [catatanCounts, setCatatanCounts] = useState<Record<string, { positif: number; negatif: number }>>({});

    // Timezone
    const { getCurrentDate: getTzDate } = useTimezone();
    const [loggedInUser, setLoggedInUser] = useState({ id: '', nama: '', nip: '' });

    // Feature Access Config for Tab Kelola
    const [absensiAccessConfig, setAbsensiAccessConfig] = useState<{
        allowedRoles: string[];
        allowedUsers: any[];
    }>({
        allowedRoles: ['ADMIN', 'ADMINISTRATOR'],
        allowedUsers: []
    });

    useEffect(() => {
        fetch('/api/site-settings?key=absensi_access_config')
            .then(res => res.json())
            .then(json => {
                if (json?.ok && json.data) {
                    const raw = typeof json.data.value === 'string' ? JSON.parse(json.data.value) : json.data.value;
                    if (raw && typeof raw === 'object') {
                        setAbsensiAccessConfig({
                            allowedRoles: Array.isArray(raw.allowedRoles) ? raw.allowedRoles : ['ADMIN', 'ADMINISTRATOR'],
                            allowedUsers: Array.isArray(raw.allowedUsers) ? raw.allowedUsers : []
                        });
                    }
                }
            })
            .catch(() => {});
    }, []);

    const { registerModal } = useModalBlur();

    useEffect(() => {
        if (isExportModalOpen) {
            return registerModal();
        }
    }, [isExportModalOpen, registerModal]);

    // Substitute Mode State
    const [isSubstituteMode, setIsSubstituteMode] = useState(false);
    const [substituteSubMode, setSubstituteSubMode] = useState<'Tukaran' | 'Diganti'>('Tukaran');
    const [allTeachers, setAllTeachers] = useState<{ nip: string, nama: string, classes?: string[] }[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<{ nip: string, nama: string } | null>(null);

    // Di mode Tukaran: hanya tampilkan guru yang mengajar di kelas yang sama dengan kelas guru login
    const selectableTeachers = useMemo(() => {
        if (!isSubstituteMode) return [];
        if (substituteSubMode !== 'Tukaran') return allTeachers;
        const myClasses = new Set(userScope?.kelasList || []);
        if (myClasses.size === 0) return allTeachers;
        return allTeachers.filter(t => (t.classes || []).some(c => myClasses.has(c)));
    }, [isSubstituteMode, substituteSubMode, allTeachers, userScope?.kelasList]);

    // Active Tab & Access Control
    const [activeTab, setActiveTab] = useState<'input' | 'admin'>('input');

    // Admin Mode State
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminSessions, setAdminSessions] = useState<Sesi[]>([]);
    const [adminSelectedIds, setAdminSelectedIds] = useState<Set<string>>(new Set());
    const [adminFilterTanggal, setAdminFilterTanggal] = useState<string>('');
    const [adminFilterStatus, setAdminFilterStatus] = useState<string>('semua');
    // Kolom cari menggantikan dropdown Guru & Kelas: satu kotak menjangkau nama
    // guru, mapel, kelas, dan guru pengganti sekaligus. `adminSearch` mengikuti
    // ketikan, `adminSearchQ` yang ter-debounce yang dikirim ke server.
    const [adminSearch, setAdminSearch] = useState<string>('');
    const [adminSearchQ, setAdminSearchQ] = useState<string>('');
    // Filter tahun ajaran (pilihan = tahun ajaran aktif) + semester untuk daftar sesi
    const adminTa = useTahunAjaranFilter();
    const [adminFilterSemester, setAdminFilterSemester] = useState<string>('ALL');
    const [adminLoading, setAdminLoading] = useState(false);
    const [allGurus, setAllGurus] = useState<{ nip: string, nama: string }[]>([]);
    const [adminEditSesi, setAdminEditSesi] = useState<Sesi | null>(null);

    // Admin Pagination
    const [adminPage, setAdminPage] = useState(1);
    const [adminLimit, setAdminLimit] = useState(50);
    const [totalAdminSessions, setTotalAdminSessions] = useState(0);

    // Data user dimuat saat mount
    useEffect(() => {
        fetchUserData();
    }, []);

    // getTzDate berubah identitas saat timezone selesai dimuat dari DB;
    // hanya isi tanggal jika masih kosong agar pilihan user tidak tertimpa
    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            setTanggal(prev => prev || today);
        };
        init();
    }, [getTzDate]);

    const fetchUserData = async () => {
        try {
            const meRes = await authFetch('/api/auth/me');
            const meData = await meRes.json();

            if (!meData.ok || !meData.user) {
                console.warn('No authenticated user found');
                return;
            }

            const userData = meData.user;
            setUserRole(userData.role || 'GURU');
            // PRIORITIZE NIP
            const userNip = userData.nip || userData.username || '';
            setNip(userNip);
            setNipDisplay(userNip);

            const guruName = userData.nama_lengkap || userData.nama || userData.username || 'Guru';
            setNamaGuru(guruName);
            setLoggedInUser({
                id: String(userData.id || (userData as any).user_id || ''),
                nama: guruName,
                nip: userNip
            });

            setUserPermissions(userData.permissions || []);
            const userRoles: string[] = Array.isArray(userData.roles) && userData.roles.length > 0
                ? userData.roles.map((r: string) => String(r).trim().toUpperCase())
                : (userData.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean);
            setRoles(userRoles);
            setIsAdmin(userRoles.includes('ADMIN') || userRoles.includes('ADMINISTRATOR') || !!userData.isAdmin);
        } catch (e) {
            console.error('Error fetching user data', e);
        }
    };

    const isGuru = roles.some(r => r.toUpperCase() === 'GURU');
    const isAdminRole = roles.some(r => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'ADMINISTRATOR');
    const isOPJurnal = roles.some(r => r.toUpperCase() === 'OP_JURNAL');
    const hasAdminCap = userPermissions.includes('absensi.admin');

    const hasFeatureAccess = useMemo(() => {
        if (isAdminRole || isOPJurnal || hasAdminCap) return true;
        const userRoles = roles.map(r => String(r).toUpperCase());
        const roleAllowed = absensiAccessConfig.allowedRoles.some(r => userRoles.includes(String(r).toUpperCase()));
        if (roleAllowed) return true;

        const userIdStr = String(loggedInUser.id || '');
        const userNipStr = String(nip || loggedInUser.nip || '');

        return absensiAccessConfig.allowedUsers.some(u => {
            const uId = String(u.id || '');
            const uNip = String(u.nip || '');
            return (userIdStr && uId === userIdStr) || (userNipStr && uNip === userNipStr);
        });
    }, [isAdminRole, isOPJurnal, hasAdminCap, roles, absensiAccessConfig, loggedInUser, nip]);

    const isPrivileged = hasFeatureAccess;
    const canAccessAdminTab = isPrivileged;

    const mainTabs: TabItem<'input' | 'admin'>[] = useMemo(() => {
        const list: TabItem<'input' | 'admin'>[] = [
            { key: 'input', label: 'Absensi', icon: 'journal-check' }
        ];
        if (canAccessAdminTab) {
            list.push({ key: 'admin', label: 'Kelola', icon: 'shield-lock' });
        }
        return list;
    }, [canAccessAdminTab]);

    // ADMIN, OP_JURNAL can manage; GURU can manage their own; others view only
    const canDo = (action: string) => {
        // Roles belum termuat: tolak dulu (fail-closed); tombol aktif setelah roles ada
        if (roles.length === 0) return false;

        if (isPrivileged) return true;
        if (isGuru && (action === 'create' || action === 'update_own' || action === 'view' || action === 'take' || action === 'save_draft' || action === 'finalize' || action === 'export')) return true;
        if (action === 'view') return true;
        return false;
    };

    useEffect(() => {
        if (nip && tanggal) loadScopes();
    }, [nip, tanggal]);

    // Reload scope data (for manual refresh)
    const reloadScope = () => {
        if (nip) {
            setScope(null); // Clear first to force refresh
            loadScopes();
        }
    };

    // Reset cascading state: kelas → mapel only
    // Does NOT reset jamKe - jamKe is controlled only by dropdown selection
    // Re-runs when: scope or nip changes (after teacher switch)
    useEffect(() => {
        if (!scope || !tanggal || adminEditSesi) return;

        const availableKelas = getAvailableClasses();
        const kelasValid = kelas && availableKelas.includes(kelas);
        const targetKelas = kelasValid ? kelas : (availableKelas[0] || '');

        const mapelList = targetKelas ? getAvailableMapels(targetKelas) : [];
        const mapelValid = mapel && mapelList.includes(mapel);
        const targetMapel = mapelValid ? mapel : (mapelList[0] || '');

        // Only reset kelas and mapel, NEVER reset jamKe here
        if (targetKelas !== kelas) setKelas(targetKelas);
        if (targetMapel !== mapel) setMapel(targetMapel);
    }, [tanggal, nip, scope]); // Do NOT add kelas/mapel to avoid loops

    // Ganti kelas lewat dropdown mengosongkan mapel (lihat onChange kelas).
    // Cascade di atas tidak bergantung pada `kelas`, jadi mapel tetap kosong sampai scope
    // dimuat ulang (tombol Refresh) — akibatnya "Jam Ke" menampilkan "No options".
    // Efek ini mengisi ulang mapel begitu kelas berubah. Hanya menyentuh mapel, tidak kelas,
    // sehingga tidak menimbulkan loop dengan cascade di atas.
    useEffect(() => {
        if (!scope || !tanggal || !kelas || adminEditSesi) return;

        const mapelList = getAvailableMapels(kelas);
        if (mapelList.length === 0) return;
        if (!mapel || !mapelList.includes(mapel)) setMapel(mapelList[0]);
    }, [kelas]);

    // Auto-select jamKe whenever kelas AND mapel are both set and jamKe is empty.
    // This fires both after cascade auto-selection and after manual dropdown changes.
    useEffect(() => {
        if (!kelas || !mapel || !tanggal || !scope) return;
        
        // When in substitute mode, load the full class schedule to show ALL hours (the estafet)
        if (isSubstituteMode) {
            loadClassSchedules(kelas, tanggal);
        }

        if (jamKe) return; // already has a selection, keep it

        const availableJams = getAvailableJams();
        if (availableJams.length > 0) {
            setJamKe(availableJams[0].value);
        }
    }, [kelas, mapel, tanggal, scope]); // jamKe intentionally omitted — only triggers when kelas/mapel/tanggal changes

    // AUTO-DETECT Substitute Mode based on mapel
    useEffect(() => {
        // Only auto-detect if the user hasn't explicitly chosen a mode yet in this interaction
        // Or if we are just entering mapel selection
        if (isSubstituteMode && mapel && userScope && scope) {
            const myMapels = Object.values(userScope.mapelByKelas).flat();
            const isMyMapel = myMapels.includes(mapel);
            const newMode = isMyMapel ? 'Tukaran' : 'Diganti';
            
            // If the mapel is clearly NOT mine, we can safely suggest 'Diganti'
            // If the mapel IS mine, we suggestion 'Tukaran'
            // But we only update if it's currently empty or if we are at the mapel selection step
            if (substituteSubMode !== newMode) {
                // If the user manually chose Tukaran but picked a non-my-mapel, we might still want to respect it
                // but usually that means they picked the wrong subject or they are actually replacing.
                // However, the issue reported is about picking 'Jam' overwriting it.
                setSubstituteSubMode(newMode);
            }
        }
    }, [mapel, isSubstituteMode]);

    // Fetch teachers who have active PBM teaching schedules for the selected tanggal/hari
    const fetchScheduleTeachers = async (targetTanggal?: string) => {
        try {
            const tgl = targetTanggal || tanggal;
            if (!tgl) return;

            const dayName = getDayName(tgl);
            const queryParams = new URLSearchParams({
                valid_date: tgl,
            });
            if (dayName) queryParams.set('hari', dayName);

            const res = await authFetch(`/api/jadwal?${queryParams.toString()}`);
            const json = await res.json();

            let items: any[] = [];
            if (json.ok && Array.isArray(json.data)) {
                items = json.data;
            } else if (Array.isArray(json)) {
                items = json;
            }

            const teacherMap = new Map<string, { nip: string; nama: string; classes: string[] }>();
            items.forEach((item: any) => {
                const nipVal = String(item.nip || '').trim();
                const namaVal = item.nama_guru || item.nama || item.nip;
                const kelasVal = String(item.kelas || '').trim();
                if (nipVal && namaVal) {
                    if (!teacherMap.has(nipVal)) {
                        teacherMap.set(nipVal, { nip: nipVal, nama: namaVal, classes: [] });
                    }
                    if (kelasVal && !teacherMap.get(nipVal)!.classes.includes(kelasVal)) {
                        teacherMap.get(nipVal)!.classes.push(kelasVal);
                    }
                }
            });

            let teacherList = Array.from(teacherMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));

            // Fallback: If no schedule on specific date/day (e.g. holiday or weekend), fetch all active PBM teachers
            if (teacherList.length === 0) {
                const fallbackRes = await authFetch('/api/jadwal');
                const fallbackJson = await fallbackRes.json();
                const fallbackItems = fallbackJson.ok && Array.isArray(fallbackJson.data) ? fallbackJson.data : [];
                fallbackItems.forEach((item: any) => {
                    const nipVal = String(item.nip || '').trim();
                    const namaVal = item.nama_guru || item.nama || item.nip;
                    const kelasVal = String(item.kelas || '').trim();
                    if (nipVal && namaVal) {
                        if (!teacherMap.has(nipVal)) {
                            teacherMap.set(nipVal, { nip: nipVal, nama: namaVal, classes: [] });
                        }
                        if (kelasVal && !teacherMap.get(nipVal)!.classes.includes(kelasVal)) {
                            teacherMap.get(nipVal)!.classes.push(kelasVal);
                        }
                    }
                });
                teacherList = Array.from(teacherMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
            }

            setAllTeachers(teacherList);
            setAllGurus(teacherList);
        } catch (e) {
            console.error('Failed to fetch schedule teachers', e);
        }
    };

    // Re-fetch teachers who have PBM teaching schedules whenever tanggal or substitute mode changes
    useEffect(() => {
        if (tanggal) {
            fetchScheduleTeachers(tanggal);
        }
    }, [tanggal, isSubstituteMode]);

    const [classSchedules, setClassSchedules] = useState<any[]>([]);

    const loadClassSchedules = async (targetKelas: string, targetTanggal: string) => {
        if (!targetKelas || !targetTanggal) return;
        try {
            // Fetch schedules for the entire class to support multi-teacher swaps
            const res = await authFetch(`/api/scopes?kelas=${encodeURIComponent(targetKelas)}&tanggal=${targetTanggal}`);
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (json && json.ok && json.data) {
                // If the API returns a list of all schedules in that class
                setClassSchedules(json.data.allJadwal || []);
            }
        } catch (e) {
            console.error('Failed to load class schedules', e);
        }
    };

    const handleSubstituteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nipVal = e.target.value;
        if (!nipVal) {
            setSelectedTeacher(null);
            setNip(loggedInUser.nip);
            setNamaGuru(loggedInUser.nama);
            return;
        }

        const teacher = allTeachers.find(t => t.nip === nipVal);
        if (teacher) {
            setSelectedTeacher(teacher);
            setScope(null);
            setNip(teacher.nip);
            setNamaGuru(teacher.nama);
            // No need to reset kelas/mapel if just switching teacher, 
            // but we might want to refresh class schedules if useful.
        }
    };

    const toggleSubstituteMode = () => {
        const newMode = !isSubstituteMode;
        setIsSubstituteMode(newMode);
        if (newMode) {
            // Entering substitute mode - clear scope to reload when teacher is selected
            setScope(null);
            setKelas('');
            setMapel('');
            setJamKe('');
        }
        if (!newMode) {
            // Reset to logged in user - clear scope to reload original teacher's data
            setSelectedTeacher(null);
            setScope(null);
            setNip(loggedInUser.nip);
            setNamaGuru(loggedInUser.nama);
            setKelas('');
            setMapel('');
            setJamKe('');
        }
    };

    // Admin Mode Functions
    const toggleAdminMode = () => {
        const newMode = !isAdminMode;
        setIsAdminMode(newMode);
        if (newMode) {
            fetchAdminData();
        } else {
            // Reset admin state
            setAdminSessions([]);
            setAdminSelectedIds(new Set());
            setAdminSearch('');
            setAdminSearchQ('');
            setAdminFilterTanggal('');
            setAdminEditSesi(null);

            // Reset teacher context to admin
            setNip(loggedInUser.nip);
            setNamaGuru(loggedInUser.nama);
            setIsSubstituteMode(false);
            setSelectedTeacher(null);
        }
    };

    const handleCancelAdminEdit = () => {
        setAdminEditSesi(null);
        setCurrentSesi(null);
        setRows([]);
        setIsAdminMode(true);
        // Reset to original logged in user
        setNip(loggedInUser.nip);
        setNamaGuru(loggedInUser.nama);
        setIsSubstituteMode(false);
        setSelectedTeacher(null);
        fetchAdminSessions();
    };

    const fetchAdminData = async () => {
        setAdminLoading(true);
        try {
            // Fetch all teachers
            const guruRes = await authFetch('/api/master/guru?limit=1000');
            const guruJson = await guruRes.json();
            if (guruJson.ok) {
                setAllGurus(guruJson.data.map((g: any) => ({ nip: g.nip, nama: g.nama_lengkap })));
            }
        } catch (e) {
            console.error('Failed to fetch admin data', e);
        } finally {
            setAdminLoading(false);
        }
    };

    // Tunda kirim ketikan ke server: tanpa ini setiap huruf memicu satu request
    // sesi admin.
    useEffect(() => {
        const t = setTimeout(() => setAdminSearchQ(adminSearch.trim()), 350);
        return () => clearTimeout(t);
    }, [adminSearch]);

    // Satu-satunya pemicu fetch sesi admin; selalu reset ke halaman 1 saat filter berubah
    useEffect(() => {
        if (isAdminMode) {
            fetchAdminSessions(1);
        }
    }, [adminSearchQ, adminFilterTanggal, adminFilterStatus, isAdminMode, adminTa.selected, adminFilterSemester]);

    const fetchAdminSessions = async (page: number = 1) => {
        setAdminLoading(true);
        setAdminPage(page);
        try {
            const params = new URLSearchParams();
            if (adminSearchQ) params.set('q', adminSearchQ);
            if (adminFilterTanggal) {
                // Tanggal spesifik: biarkan API menurunkan tahun ajaran/semester dari tanggal
                params.set('tanggal', adminFilterTanggal);
            } else if (adminTa.selected) {
                // Ikuti tahun ajaran terpilih (bukan otomatis yang terbaru)
                params.set('tahun_ajaran', adminTa.selected);
                params.set('semester', adminFilterSemester); // 'ALL' = seluruh tahun ajaran
            }
            if (adminFilterStatus && adminFilterStatus !== 'semua') params.set('status_sesi', adminFilterStatus);
            
            params.set('page', page.toString());
            params.set('limit', adminLimit.toString());

            const res = await authFetch(`/api/absensi/sesi?${params.toString()}`);
            const json = await res.json();
            if (json.ok) {
                setAdminSessions(json.data || []);
                if (json.metadata) {
                    setTotalAdminSessions(json.metadata.total);
                }
            }
        } catch (e) {
            console.error('Failed to fetch admin sessions', e);
        } finally {
            setAdminLoading(false);
        }
    };

    const handleSelectSession = (sesiId: string) => {
        setAdminSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sesiId)) {
                newSet.delete(sesiId);
            } else {
                newSet.add(sesiId);
            }
            return newSet;
        });
    };

    const handleSelectAllSessions = () => {
        if (adminSelectedIds.size === adminSessions.length) {
            setAdminSelectedIds(new Set());
        } else {
            setAdminSelectedIds(new Set(adminSessions.map(s => s.sesi_id)));
        }
    };

    const handleDeleteSelectedSessions = async () => {
        if (adminSelectedIds.size === 0) {
            Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih sesi yang ingin dihapus' });
            return;
        }

        const result = await Swal.fire({
            title: 'Hapus Absensi?',
            html: `<p class="text-sm text-slate-600 mb-2">Anda akan menghapus <strong>${adminSelectedIds.size}</strong> sesi absensi beserta semua detailnya.</p><p class="text-xs text-red-500">Tindakan ini tidak dapat dibatalkan!</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            reverseButtons: true,
            padding: '2rem',
            customClass: {
                popup: 'rounded-[2rem] shadow-xl border border-slate-100',
                title: 'text-xl font-bold text-slate-800',
                actions: 'gap-3',
                confirmButton: 'rounded-xl px-6 py-3 font-semibold shadow-lg',
                cancelButton: 'rounded-xl px-6 py-3 font-semibold'
            }
        });

        if (!result.isConfirmed) return;

        Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() });

        try {
            let deletedCount = 0;
            const failures: string[] = [];
            for (const sesiId of adminSelectedIds) {
                try {
                    const res = await authFetch(`/api/absensi/sesi?sesi_id=${sesiId}`, { method: 'DELETE' });
                    const json = await res.json();
                    if (json.ok) deletedCount++;
                    else failures.push(json.error || 'Gagal tanpa pesan');
                } catch (e: any) {
                    failures.push(e.message || 'Kesalahan jaringan');
                }
            }

            Swal.close();
            if (failures.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Selesai dengan kegagalan',
                    html: `<p class="text-sm">${deletedCount} sesi terhapus, <b>${failures.length} gagal</b>.</p>
                           <p class="text-xs text-slate-500 mt-2">${escapeHtml(failures[0])}</p>`
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: `${deletedCount} sesi berhasil dihapus`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            setAdminSelectedIds(new Set());
            await fetchAdminSessions();
        } catch (error: any) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Gagal', text: error.message || 'Gagal menghapus sesi' });
        }
    };

    /**
     * Hapus satu sesi (konfirmasi + panggilan API + muat ulang daftar).
     * Diangkat jadi fungsi tersendiri karena dipakai tiga tempat: tombol di
     * baris tabel desktop, footer sheet detail mobile, dan dulu disalin utuh
     * di kartu mobile.
     */
    const handleDeleteAdminSession = async (sesi: Sesi) => {
        const result = await Swal.fire({
            title: 'Hapus Sesi?',
            text: `Hapus absensi ${sesi.kelas} - ${sesi.mapel}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626'
        });
        if (!result.isConfirmed) return;

        Swal.fire({ didOpen: () => Swal.showLoading() });
        const res = await authFetch(`/api/absensi/sesi?sesi_id=${sesi.sesi_id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            Swal.close();
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Sesi dihapus', timer: 1500, showConfirmButton: false });
            fetchAdminSessions();
        } else {
            Swal.fire({ icon: 'error', title: 'Gagal', text: json.error });
        }
    };

    const handleEditAdminSession = async (sesi: Sesi) => {
        setAdminEditSesi(sesi);
        // Load the session into the main view
        setKelas(sesi.kelas);
        setMapel(sesi.mapel);
        setTanggal(sesi.tanggal);
        setJamKe(sesi.jam_ke);
        setNip(sesi.nip);
        setNamaGuru(sesi.nama_guru);
        setCurrentSesi(sesi);
        
        // Fill Materi & Refleksi
        setMateri(sesi.materi || '');
        setRefleksi(sesi.refleksi || sesi.catatan || '');

        // Handle Substitution
        if (sesi.guru_pengganti_nip) {
            setIsSubstituteMode(true);
            // In substitute mode, the dropdown "Nama Guru yang Digantikan" should show the ORIGINAL OWNER (sesi.nip)
            const foundOwner = allGurus.find(g => g.nip === sesi.nip);
            if (foundOwner) {
                setSelectedTeacher({ nip: foundOwner.nip, nama: foundOwner.nama });
            } else {
                setSelectedTeacher({ nip: sesi.nip, nama: sesi.nama_guru });
            }
        } else {
            setIsSubstituteMode(false);
            setSelectedTeacher(null);
        }

        // Fetch details
        try {
            const detailRes = await authFetch(`/api/absensi/detail?sesi_id=${sesi.sesi_id}`);
            const detailJson = await detailRes.json();
            if (detailJson.ok && detailJson.data) {
                const loadedRows: AbsensiRow[] = detailJson.data.map((d: any) => ({
                    nisn: d.nisn,
                    nama_snapshot: d.nama_snapshot,
                    status: d.status || 'HADIR',
                    otomatis: d.otomatis ?? true,
                    catatan: d.catatan || '',
                    ref_ketidakhadiran_id: d.ref_ketidakhadiran_id
                }));
                setRows(loadedRows);
                // Snapshot awal agar indikator "berubah" berfungsi sejak sesi dibuka
                const snap = new Map<string, string>();
                loadedRows.forEach(r => snap.set(r.nisn, r.status));
                setInitialSnapshot(snap);
            }
        } catch (e) {
            console.error('Failed to fetch session details', e);
        }

        // Exit admin mode
        setIsAdminMode(false);
    };

    // Guru Pengganti / Tukaran membatalkan / menghapus sesi yang salah dibuat
    const handleCancelSubstituteSession = async () => {
        if (!currentSesi) return;
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Batalkan Sesi Tukaran / Pengganti?',
            html: `<p class="text-sm text-slate-600">Sesi tukaran / pengganti untuk <b>${escapeHtml(currentSesi.nama_guru)}</b> akan dihapus sehingga guru jadwal yang bersangkutan dapat mengisi absensinya kembali.</p>`,
            showCancelButton: true,
            confirmButtonText: 'Ya, Batalkan Sesi',
            cancelButtonText: 'Tidak',
            confirmButtonColor: '#ef4444'
        });
        if (!confirm.isConfirmed) return;

        setLoading(true);
        try {
            const res = await authFetch(`/api/absensi/sesi?sesi_id=${currentSesi.sesi_id}`, {
                method: 'DELETE'
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menghapus sesi');

            Swal.fire({
                icon: 'success',
                title: 'Sesi Dibatalkan',
                text: 'Sesi tukaran / pengganti telah dibatalkan dan dihapus.',
                timer: 1800,
                showConfirmButton: false
            });

            setCurrentSesi(null);
            setRows([]);
            setMateri('');
            setRefleksi('');
            setJamKe('');
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e.message || 'Gagal membatalkan sesi' });
        } finally {
            setLoading(false);
        }
    };

    // Guru Jadwal mengambil alih sesi jika salah ditukar/diklaim pengganti padahal guru hadir
    const handleReclaimSession = async () => {
        if (!currentSesi) return;
        const confirm = await Swal.fire({
            icon: 'question',
            title: 'Ambil Alih Sesi Absensi?',
            html: `<p class="text-sm text-slate-600">Apakah Anda ingin membatalkan status tukaran / guru pengganti (<b>${escapeHtml(currentSesi.guru_pengganti_nama || '')}</b>) dan mengambil alih sesi absensi ini untuk Anda isi sendiri?</p>`,
            showCancelButton: true,
            confirmButtonText: 'Ya, Ambil Alih',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#d97706'
        });
        if (!confirm.isConfirmed) return;

        setLoading(true);
        try {
            const res = await authFetch('/api/absensi/sesi', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sesi_id: currentSesi.sesi_id,
                    guru_pengganti_nip: null,
                    guru_pengganti_nama: null,
                    status_kehadiran: 'HADIR'
                })
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal mengambil alih sesi');

            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Status tukaran / pengganti dibatalkan. Sesi kini dapat Anda isi.',
                timer: 2000,
                showConfirmButton: false
            });

            // Refresh sesi lokal
            setCurrentSesi(prev => prev ? { ...prev, guru_pengganti_nip: undefined, guru_pengganti_nama: undefined } : null);
            await bukaSesi();
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e.message || 'Gagal mengambil alih sesi' });
        } finally {
            setLoading(false);
        }
    };

    const formatJamRange = (jams: string[]) => {
        if (!jams || jams.length === 0) return [];
        const sorted = [...jams].map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (sorted.length === 0) return jams;

        const ranges = [];
        let start = sorted[0];
        let end = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === end + 1) {
                end = sorted[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = sorted[i];
                end = sorted[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        return ranges;
    };

    // Format a jam_ke string with time range from master_waktu
    const formatJamWithTime = (jamKeStr: string, dayName: string, program: string): string => {
        const fmtTime = (t: string) => t ? t.substring(0, 5) : '';

        // Handle jam ranges like "1-2"
        if (jamKeStr.includes('-')) {
            const parts = jamKeStr.split('-').map(p => parseInt(p.trim())).filter(n => !isNaN(n));
            if (parts.length === 2) {
                const first = parts[0];
                const last = parts[1];
                const firstKey = `${program}|${dayName}|${first}`;
                const lastKey = `${program}|${dayName}|${last}`;
                const firstW = scope?.masterWaktu?.[firstKey];
                const lastW = scope?.masterWaktu?.[lastKey];
                const startTime = firstW ? fmtTime(firstW.mulai) : '';
                const endTime = lastW ? fmtTime(lastW.selesai) : '';
                if (startTime && endTime) {
                    return `Jam ${jamKeStr} (${startTime} - ${endTime})`;
                }
            }
            return `Jam ${jamKeStr}`;
        }

        // Single jam
        const numJam = parseInt(jamKeStr);
        if (isNaN(numJam)) return jamKeStr;
        const key = `${program}|${dayName}|${numJam}`;
        const w = scope?.masterWaktu?.[key];
        if (w) {
            return `Jam ${jamKeStr} (${fmtTime(w.mulai)} - ${fmtTime(w.selesai)})`;
        }
        return `Jam ${jamKeStr}`;
    };

    // Get day name from date
    const getDayName = (dateStr: string) => {
        if (!dateStr) return '';
        const cleanStr = String(dateStr).split('T')[0].trim();
        const [y, m, d] = cleanStr.split('-').map(Number);
        if (y && m && d) {
            const dateObj = new Date(y, m - 1, d, 12, 0, 0);
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            return dayNames[dateObj.getDay()] || '';
        }
        return '';
    };

    const formatDateDisplay = (d: any): string => {
        if (!d) return '-';
        const cleanStr = String(d).split('T')[0].trim();
        if (!cleanStr) return '-';
        const [y, m, day] = cleanStr.split('-').map(Number);
        if (y && m && day) {
            const dateObj = new Date(y, m - 1, day, 12, 0, 0);
            if (!isNaN(dateObj.getTime())) {
                return dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        }
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        return String(d);
    };


    // Get program for current kelas
    const getProgram = (kelasName: string) => {
        return scope?.masterKelas?.[kelasName] || 'Reguler';
    };

    const timeToMinutes = (t?: string | null): number | null => {
        if (!t) return null;
        const [h, m] = t.split(':').map(n => parseInt(n, 10));
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    };

    // Cek apakah rentang jam sesi absensi tumpang tindih dengan rentang jam
    // ketidakhadiran PADA TANGGAL sesi ini. Izin/sakit tanpa jam spesifik
    // dianggap berlaku seharian penuh; entri kontinu multi-hari punya jendela
    // berbeda di hari pertama/tengah/terakhir (lihat lib/ketidakhadiran-jp.ts).
    const isKetidakhadiranActiveForSession = (k: any, jamKeStr: string, dayName: string, program: string): boolean => {
        const kWindow = entryTimeWindowForDate(k, tanggal);
        if (!kWindow) return true; // Seharian penuh
        const kStart = kWindow.start;
        const kEnd = kWindow.end;

        const periods: number[] = [];
        (jamKeStr || '').split(',').map(p => p.trim()).filter(p => !!p).forEach(part => {
            if (part.includes('-')) {
                const [st, en] = part.split('-').map(n => parseInt(n));
                if (!isNaN(st) && !isNaN(en)) {
                    for (let i = Math.min(st, en); i <= Math.max(st, en); i++) periods.push(i);
                }
            } else {
                const n = parseInt(part);
                if (!isNaN(n)) periods.push(n);
            }
        });

        let sessionStart: number | null = null;
        let sessionEnd: number | null = null;
        periods.forEach(p => {
            const w = scope?.masterWaktu?.[`${program}|${dayName}|${p}`];
            if (!w) return;
            const mulai = timeToMinutes(w.mulai);
            const selesai = timeToMinutes(w.selesai);
            if (mulai !== null && (sessionStart === null || mulai < sessionStart)) sessionStart = mulai;
            if (selesai !== null && (sessionEnd === null || selesai > sessionEnd)) sessionEnd = selesai;
        });

        // Jam sesi tidak diketahui (master_waktu tidak ada data) -> jangan blok, anggap berlaku
        if (sessionStart === null || sessionEnd === null) return true;
        return sessionStart < kEnd && kStart < sessionEnd;
    };



    // Compute available jams for the selected date (as objects with value and label)
    // Respects berlaku_mulai: only shows schedule that is valid as of the selected tanggal

    const getAvailableClasses = () => {
        if (!scope) return [];
        const dayName = getDayName(tanggal);
        const jadwalSource = scope.schedule || [];

        const classSet = new Set<string>();
        jadwalSource.forEach(s => {
            if (s.hari === dayName) {
                classSet.add((s.kelas || '').trim());
            }
        });

        let classes = Array.from(classSet).sort();
        // Mode Tukaran: Guru hanya boleh bertukar pada kelas yang diajarnya sendiri sesuai jadwal
        if (isSubstituteMode && substituteSubMode === 'Tukaran' && userScope?.kelasList && userScope.kelasList.length > 0) {
            const myClasses = new Set(userScope.kelasList.map(c => c.trim()));
            classes = classes.filter(c => myClasses.has(c));
        }
        return classes;
    };

    const getClassLabel = (k: string) => {
        if (!scope || !tanggal) return k;
        const dayName = getDayName(tanggal);
        const jadwalSource = scope.schedule || [];
        const match = jadwalSource.find(s => 
            (s.kelas || '').trim() === k.trim() && 
            s.hari === dayName
        );
        const ruang = match?.ruang;
        return (!ruang || k === ruang) ? k : `${k} (${ruang})`;
    };

    const getAvailableMapels = (targetKelas: string) => {
        if (!scope || !targetKelas) return [];
        const dayName = getDayName(tanggal);
        const jadwalSource = scope.schedule || [];
        const trimmedKelas = targetKelas.trim();

        const mapelSet = new Set<string>();
        jadwalSource.forEach(s => {
            if ((s.kelas || '').trim() === trimmedKelas && s.hari === dayName) {
                mapelSet.add((s.mata_pelajaran || '').trim());
            }
        });

        // Mode Pengganti: Filter Mapel Berdasarkan Mode (Tukaran vs Diganti)
        if (isSubstituteMode && userScope && !isAdminMode && !adminEditSesi) {
            const myMapels = Object.values(userScope.mapelByKelas).flat();
            if (substituteSubMode === 'Tukaran') {
                // TUKARAN: Hanya Mapel SAYA
                return Array.from(new Set(myMapels)).sort();
            } else {
                // DIGANTI: Hanya Mapel PARTNER
                return Array.from(mapelSet).sort();
            }
        }

        let finalMapels = Array.from(mapelSet).sort();
        
        // Ensure currently selected mapel is in the list during admin edit
        if (adminEditSesi && !finalMapels.includes(mapel)) {
            finalMapels.push(mapel);
        }

        return finalMapels;
    };

    const getAvailableJams = (): { value: string; label: string }[] => {
        if (!kelas || !tanggal || !scope) return [];
        const dayName = getDayName(tanggal);
        const program = getProgram(kelas);
        const trimmedKelas = kelas.trim();

        // `classSchedules` is already filtered by API up to `effectiveDate`
        const source = isSubstituteMode ? classSchedules : (scope.schedule || []);
        const jamSet = new Set<string>();
        const jamOptions: { value: string; label: string, sortKey: number }[] = [];

        if (isSubstituteMode && selectedTeacher) {
            // Mode Pengganti (Tukaran/Diganti):
            const partnerSource = scope.schedule || [];
            const mySource = userScope?.schedule || [];

            const partnerJams: number[] = [];
            partnerSource.forEach((s: any) => {
                if (s.hari === dayName && (s.kelas || '').trim() === trimmedKelas) {
                    partnerJams.push(...expandJamNumbers(s.jam_ke));
                }
            });

            const myJamsForMapel: number[] = [];
            mySource.forEach((s: any) => {
                if (s.hari === dayName && (s.kelas || '').trim() === trimmedKelas && s.mata_pelajaran === mapel) {
                    myJamsForMapel.push(...expandJamNumbers(s.jam_ke));
                }
            });

            // Logic: Berdampingan (is Adjacent?)
            const isAdjacent = myJamsForMapel.some(myJ => 
                partnerJams.some(partJ => Math.abs(myJ - partJ) <= 1)
            );

            // Determine which teachers' hours to show
            const teachersToShow = isAdjacent 
                ? [{ source: partnerSource, nip: selectedTeacher.nip, nama: selectedTeacher.nama }, 
                   { source: mySource, nip: loggedInUser.nip, nama: loggedInUser.nama }]
                : [{ source: partnerSource, nip: selectedTeacher.nip, nama: selectedTeacher.nama }];

            teachersToShow.forEach(ctx => {
                ctx.source.forEach((s: any) => {
                    if (s.hari === dayName && (s.kelas || '').trim() === trimmedKelas) {
                        const m = s.mata_pelajaran || s.mapel;
                        const g = ctx.nama;
                        const nipVal = ctx.nip;

                        expandJamNumbers(s.jam_ke).forEach((num: number) => {
                            const j = String(num);
                            const uniqueKey = `${j}||${nipVal}||${m}||${g}`;
                            if (!jamSet.has(uniqueKey)) {
                                jamSet.add(uniqueKey);
                                jamOptions.push({
                                    value: uniqueKey,
                                    label: formatJamWithTime(j, dayName, program),
                                    sortKey: num
                                });
                            }
                        });
                    }
                });
            });
        } else {
            // MODE NORMAL: Hanya milik saya untuk mapel yang dipilih (blok)
            const mySource = scope.schedule || [];
            const trimmedMapel = (mapel || '').trim();
            if (!trimmedMapel) return [];

            const myRawJams = new Set<number>();
            mySource.forEach((s: any) => {
                if (s.hari === dayName && (s.kelas || '').trim() === trimmedKelas && (s.mata_pelajaran || '').trim() === trimmedMapel) {
                    expandJamNumbers(s.jam_ke).forEach(n => myRawJams.add(n));
                }
            });

            if (myRawJams.size === 0) {
                mySource.forEach((s: any) => {
                    if (s.hari === dayName && (s.kelas || '').trim() === trimmedKelas && (s.mapel || '').trim() === trimmedMapel) {
                        expandJamNumbers(s.jam_ke).forEach(n => myRawJams.add(n));
                    }
                });
            }

            const sortedNumbers = Array.from(myRawJams).sort((a,b) => a-b);
            const ranges = formatJamRange(sortedNumbers.map(String));
            ranges.forEach(r => {
                jamOptions.push({
                    value: r,
                    label: formatJamWithTime(r, dayName, program),
                    sortKey: parseInt(r.split('-')[0])
                });
            });
        }

        const finalJams = jamOptions.sort((a, b) => a.sortKey - b.sortKey).map(({ value, label }) => ({ value, label }));

        if (adminEditSesi && jamKe && !finalJams.some(j => j.value === jamKe)) {
            finalJams.push({ value: jamKe, label: `Jam Ke-${jamKe} (Manual)` });
        }

        return finalJams;
    };

    async function loadScopes() {
        if (!nip) return;
        try {
            const queryTanggal = tanggal ? `&tanggal=${tanggal}` : '';
            const res = await authFetch(`/api/scopes?nip=${nip}${queryTanggal}`);
            if (!res.ok) {
                console.warn(`[loadScopes] Server merespon dengan status ${res.status}`);
                return;
            }
            const text = await res.text();
            if (!text || !text.trim()) {
                console.warn('[loadScopes] Respon server kosong');
                return;
            }
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse API response:', text.substring(0, 200));
                return;
            }

            if (json.ok && json.data) {
                setScope(json.data);

                // Store logged-in user's scope for merging subjects later
                if (nip === loggedInUser.nip) {
                    setUserScope(json.data);
                }

                if (json.data.guru?.nama) {
                    setNamaGuru(json.data.guru.nama);
                    setNipDisplay(json.data.guru.nip);
                }
                // NOTE: Do NOT auto-select kelas/mapel here — the cascading effect handles it
                // (it also validates against the selected day's schedule; selecting here
                // caused double-updates and could pick a class not taught on that day)
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Helper for authenticated fetch (sesi cookie ikut otomatis pada same-origin fetch)
    async function authFetch(url: string, options: RequestInit = {}) {
        return fetch(url, { ...options, credentials: 'same-origin' });
    }

    async function bukaSesi() {
        // CRITICAL: Capture current values in a stable way for validation
        const currentKelas = kelas || '';
        const currentMapel = mapel || '';
        const currentTanggal = tanggal || '';
        const currentJamKe = jamKe || '';

        // Cek apakah Admin atau Substitute mode, pastikan NIP guru yang akan disubsitusi sudah dipilih
        if (isSubstituteMode && !selectedTeacher) {
            Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Silakan pilih nama guru yang digantikan terlebih dahulu.' });
            return;
        }

        const kelasOk = currentKelas.trim().length > 0;
        const mapelOk = currentMapel.trim().length > 0;
        const tanggalOk = currentTanggal.trim().length > 0;
        const jamKeOk = currentJamKe.trim().length > 0;

        if (!kelasOk || !mapelOk || !tanggalOk || !jamKeOk) {
            Swal.fire({
                icon: 'warning',
                title: 'Perhatian',
                text: 'Lengkapi data sesi'
            });
            return;
        }

        const kelasVal = currentKelas.trim();
        const mapelVal = currentMapel.trim();
        const tanggalVal = currentTanggal.trim();
        const jamKeVal = currentJamKe.trim();

        // PERMISSION & SCOPE CHECK
        if (!canDo('take')) {
            Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Anda tidak memiliki izin untuk melakukan absensi.' });
            return;
        }

        if (!isAdmin) {
            // VALIDATION: Ensure selected jam is in the available options for this kelas+mapel
            // (User can only select from dropdown which already filters valid options)
            const availableJams = getAvailableJams();
            if (availableJams.length === 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Di Luar Jadwal',
                    text: 'Tidak ada jadwal yang valid untuk kombinasi ini.'
                });
                return;
            }

            // [FIX] Validate multi-select jams and handle complex keys (||) in Substitute Mode
            const selectedHoursList = jamKeVal.split(',').map(s => s.trim()).filter(s => !!s);
            const isValid = selectedHoursList.every(hour => 
                availableJams.some(v => {
                    const availableHour = v.value.includes('||') ? v.value.split('||')[0] : v.value;
                    return availableHour === hour;
                })
            );

            if (!isValid) {
                Swal.fire({
                    icon: 'error',
                    title: 'Di Luar Jadwal',
                    text: 'Pilihan jam tidak valid untuk jadwal ini.'
                });
                return;
            }
        }


        // ADDITIONAL CHECK FOR SUBSTITUTE
        // If substitute mode is ON, we are "Taking" someone else's class.
        // We should ensure we are sending the *Original* teacher's data as ownership, 
        // but we are the one performing it.

        // The API expects `nip` to be the schedule owner (which `nip` state currently holds).
        // It expects `nama_guru` to be schedule owner's name (which `namaGuru` state currently holds).

        // We need to tell API that *I* am the one doing it if I am a substitute.

        setLoading(true);
        Swal.fire({ 
            title: 'Memuat Data...',
            html: `
                <div class="acca-loader-logo-box">
                    <svg viewBox="0 0 206.1 238.12" width="36" height="41.6" class="acca-loader-trace" aria-hidden="true">
                        <path class="acca-trace-path" pathLength="100" d="M196.19 76.92c-27.11,-13.63 -58.96,-21.47 -93.14,-21.47 -34.19,0 -66.03,7.83 -93.14,21.47 -2.18,1.1 -4.58,0.99 -6.66,-0.29 -2.08,-1.28 -3.25,-3.38 -3.25,-5.82l0 -44.22c0,-2.78 1.56,-5.16 4.1,-6.27 29.83,-13 63.45,-20.33 98.95,-20.33 35.49,0 69.12,7.33 98.95,20.33 2.55,1.11 4.1,3.49 4.1,6.27l0 44.22c0,2.44 -1.17,4.54 -3.25,5.82 -2.08,1.28 -4.48,1.38 -6.66,0.29z"></path>
                        <path class="acca-trace-path" pathLength="100" d="M206.1 186.58l-0.3 -0.17 0 44.84c0,2.44 -1.17,4.54 -3.25,5.82 -2.08,1.28 -4.48,1.38 -6.66,0.28 -14.63,-7.39 -30.26,-13.08 -46.63,-16.82 -3.14,-0.72 -5.31,-3.44 -5.31,-6.66l0 -44.54c0,-3.38 -2.4,-6.2 -5.73,-6.75 -11.36,-1.86 -23.11,-2.83 -35.16,-2.83 -12.05,0 -23.8,0.97 -35.16,2.83 -3.33,0.55 -5.73,3.37 -5.73,6.75l0 44.54c0,3.23 -2.17,5.94 -5.31,6.66 -16.37,3.75 -32,9.44 -46.63,16.82 -2.18,1.1 -4.58,1 -6.66,-0.28 -2.08,-1.28 -3.25,-3.38 -3.25,-5.82l0 -44.84 -0.3 0.17 0 -55.69c0,-2.78 1.56,-5.16 4.1,-6.27 29.83,-13 63.45,-20.33 98.95,-20.33 35.49,0 69.12,7.33 98.95,20.33 2.55,1.11 4.1,3.49 4.1,6.27l0 55.69z"></path>
                    </svg>
                </div>
                <div class="kh-swal-html">Membuka sesi & mengambil data siswa</div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: {
                popup: 'kh-swal-popup',
                title: 'kh-swal-title'
            }
        });

        try {
            // AUTO-SPLIT LOGIC: Group selected JPs by their original owner (per guru pemilik slot).
            // Mapel yang dipakai selalu mapel terpilih di form — di mode Tukaran itu mapel SAYA
            // (saya mengajar mapel saya di slot partner), di mode Diganti itu mapel partner.
            const selectedHoursList = (jamKe || '').split(',').map(s => s.trim()).filter(s => !!s);
            const allAvailable = getAvailableJams();

            // Map: "nip||nama" -> string[] of hours
            const groups = new Map<string, string[]>();

            selectedHoursList.forEach(hour => {
                const opt = allAvailable.find(o => o.value.split('||')[0] === hour);
                if (opt && opt.value.includes('||')) {
                    const [, targetNip, , targetNama] = opt.value.split('||');
                    const key = `${targetNip}||${targetNama}`;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)?.push(hour);
                } else {
                    // Fallback to current selections (normal mode)
                    const key = `${nip}||${namaGuru}`;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)?.push(hour);
                }
            });

            const results: any[] = [];
            for (const [key, hours] of Array.from(groups.entries())) {
                const [targetNip, targetNama] = key.split('||');

                let statusKehadiran = 'HADIR';
                const isReplacingSomeone = targetNip !== loggedInUser.nip;

                if (isReplacingSomeone) {
                    // Use the manual sub-mode selected
                    statusKehadiran = substituteSubMode;
                }

                const payload: any = {
                    nip: targetNip,
                    kelas: kelas,
                    mapel: mapel, // Use the CURRENT selected mapel from state
                    tanggal: tanggal,
                    jam_ke: hours.join(', '),
                    nama_guru: targetNama,
                    status_kehadiran: statusKehadiran // Send the auto-classified status
                };

                // Add substitute info ONLY if the owner is not ME
                if (isReplacingSomeone) {
                    payload.guru_pengganti_nip = loggedInUser.nip;
                    payload.guru_pengganti_nama = loggedInUser.nama;
                }

                const sesiRes = await authFetch('/api/absensi/sesi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const sesiJson = await sesiRes.json();
                if (!sesiJson.ok) throw new Error(sesiJson.error || `Gagal memuat sesi untuk ${targetNama}`);
                results.push(sesiJson.data);
            }

            if (results.length === 0) throw new Error('Tidak ada sesi yang berhasil dibuka');

            // Use the first (or latest) session to populate the table UI
            const sesi = results[0];

            // Notice if taken by substitute
            if (sesi && sesi.guru_pengganti_nip && !isAdmin) {
                if (loggedInUser.nip === sesi.nip) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Info Pengganti',
                        text: `Absensi ini telah dilakukan oleh Guru Pengganti: ${sesi.guru_pengganti_nama}.`
                    });
                }
            }

            const detailRes = await authFetch(`/api/absensi/detail?sesi_id=${sesi.sesi_id}`);
            const detailJson = await detailRes.json();
            if (!detailJson.ok) throw new Error(detailJson.error);

            let detailRows: AbsensiRow[] = detailJson.data || [];

            if (detailRows.length === 0) {
                // Kirim tahun ajaran + semester sesi agar daftar siswa tidak
                // tercampur enrollment kelas bernama sama dari tahun ajaran lain
                const siswaParams = new URLSearchParams();
                if (sesi.tahun_ajaran) siswaParams.set('tahun_ajaran', sesi.tahun_ajaran);
                if (sesi.semester) siswaParams.set('semester', String(sesi.semester));
                const siswaQs = siswaParams.toString();
                const siswaRes = await authFetch(`/api/siswa/${encodeURIComponent(kelas)}${siswaQs ? `?${siswaQs}` : ''}`);
                const siswaJson = await siswaRes.json();
                if (siswaJson.ok && siswaJson.data) {
                    detailRows = siswaJson.data.map((s: any) => ({
                        nisn: s.nisn,
                        nama_snapshot: s.nama_siswa,
                        status: 'HADIR',
                        otomatis: true,
                        catatan: ''
                    }));

                    // INTEGRATION: Fetch Ketidakhadiran Data
                    try {
                        const ketidakhadiranRes = await authFetch(`/api/ketidakhadiran?kelas=${encodeURIComponent(kelas)}&from=${tanggal}&to=${tanggal}`);
                        const ketidakhadiranJson = await ketidakhadiranRes.json();

                        if (ketidakhadiranJson.ok && ketidakhadiranJson.data) {
                            const ketidakhadiranMap = new Map<string, { status: string; keterangan: string; id: string; source_type: string }>();
                            ketidakhadiranJson.data.forEach((k: any) => {
                                ketidakhadiranMap.set(k.nisn, {
                                    status: (k.jenis || '').toUpperCase(),
                                    keterangan: k.keterangan || '-',
                                    id: k.id,
                                    source_type: (k.status || '').toUpperCase()
                                });
                            });

                            const dayNameForMatch = getDayName(tanggal);
                            const programForMatch = getProgram(kelas);
                            detailRows = detailRows.map(row => {
                                const matchingK = ketidakhadiranJson.data.filter((k: any) => {
                                    if (k.nisn !== row.nisn) return false;
                                    return isKetidakhadiranActiveForSession(k, jamKeVal, dayNameForMatch, programForMatch);
                                });

                                // Priority: IZIN > others
                                const kData = matchingK.find((k: any) => (k.jenis || '').trim().toUpperCase() === 'IZIN') || matchingK[0];

                                if (kData) {
                                    const status = (kData.jenis || '').toUpperCase();
                                    const sourceType = (kData.status || '').toUpperCase();
                                    return {
                                        ...row,
                                        status: status as any,
                                        catatan: kData.keterangan || '-',
                                        ref_ketidakhadiran_id: kData.id,
                                        otomatis: true,
                                        source_type: sourceType,
                                        system_source: {
                                            id: kData.id,
                                            status: status as any,
                                            keterangan: kData.keterangan || '-',
                                            source_type: sourceType
                                        }
                                    };
                                }
                                return row;
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to auto-fetch ketidakhadiran during init', e);
                    }

                    await saveAbsensiInternal(sesi.sesi_id, detailRows, false);
                }
            } else {
                // For EXISTING sessions (Drafts)
                try {
                    const ketidakhadiranRes = await authFetch(`/api/ketidakhadiran?kelas=${encodeURIComponent(kelas)}&from=${tanggal}&to=${tanggal}`);
                    const kJson = await ketidakhadiranRes.json();
                    if (kJson.ok && kJson.data) {
                        const kMap = new Map<string, any>();
                        kJson.data.forEach((k: any) => kMap.set(k.nisn, k));

                        const dayNameForMatch = getDayName(tanggal);
                        const programForMatch = getProgram(kelas);
                        detailRows = detailRows.map(r => {
                            // Hormati edit manual guru (otomatis === false):
                            // jangan ditimpa data integrasi saat sesi dibuka kembali
                            if (r.otomatis === false) return r;

                            const matchingK = kJson.data.filter((k: any) => {
                                if (k.nisn !== r.nisn) return false;
                                const jamKeStr = sesi?.jam_ke || jamKe || '';
                                return isKetidakhadiranActiveForSession(k, jamKeStr, dayNameForMatch, programForMatch);
                            });

                            const kData = matchingK.find((k: any) => (k.jenis || '').trim().toUpperCase() === 'IZIN') || matchingK[0];

                            if (kData) {
                                // Overwrite with system data to ensure "langsung terload"
                                const normalizedStatus = (kData.jenis || '').trim().toUpperCase() as any;
                                const sourceType = (kData.status || '').toUpperCase();
                                return {
                                    ...r,
                                    status: normalizedStatus,
                                    catatan: kData.keterangan || '-',
                                    ref_ketidakhadiran_id: kData.id,
                                    otomatis: true,
                                    source_type: sourceType,
                                    system_source: {
                                        id: kData.id,
                                        status: normalizedStatus,
                                        keterangan: kData.keterangan || '-',
                                        source_type: sourceType
                                    }
                                };
                            }
                            // If no matching ketidakhadiran but row was previously integrated, revert it
                            if (r.ref_ketidakhadiran_id) {
                                return { ...r, status: 'HADIR', catatan: '', otomatis: true, ref_ketidakhadiran_id: undefined, system_source: undefined, source_type: undefined };
                            }
                            return r;
                        });
                    }
                } catch (e: any) {
                    // Silently ignore or show small toast so it doesn't block the UI if the integration API is down
                    console.warn('[Absensi] Ketidakhadiran API integration unavailable:', e.message);
                }
                // ...
            }

            setRows(detailRows);
            // Snapshot awal agar indikator "berubah" berfungsi sejak sesi dibuka
            const snap = new Map<string, string>();
            detailRows.forEach(r => snap.set(r.nisn, r.status));
            setInitialSnapshot(snap);

            setCurrentSesi(sesi);
            setMateri(sesi.materi || '');
            setRefleksi(sesi.refleksi || (sesi.catatan && !sesi.refleksi ? sesi.catatan : ''));
            Swal.close();
            // ...
        } catch (error: any) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
        } finally {
            setLoading(false);
        }
    }



    async function refreshKetidakhadiran() {
        if (!currentSesi || !kelas || !tanggal) {
            Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Buka sesi terlebih dahulu' });
            return;
        }

        Swal.fire({ 
            title: 'Memuat Data...',
            html: `
                <div class="acca-loader-logo-box">
                    <svg viewBox="0 0 206.1 238.12" width="36" height="41.6" class="acca-loader-trace" aria-hidden="true">
                        <path class="acca-trace-path" pathLength="100" d="M196.19 76.92c-27.11,-13.63 -58.96,-21.47 -93.14,-21.47 -34.19,0 -66.03,7.83 -93.14,21.47 -2.18,1.1 -4.58,0.99 -6.66,-0.29 -2.08,-1.28 -3.25,-3.38 -3.25,-5.82l0 -44.22c0,-2.78 1.56,-5.16 4.1,-6.27 29.83,-13 63.45,-20.33 98.95,-20.33 35.49,0 69.12,7.33 98.95,20.33 2.55,1.11 4.1,3.49 4.1,6.27l0 44.22c0,2.44 -1.17,4.54 -3.25,5.82 -2.08,1.28 -4.48,1.38 -6.66,0.29z"></path>
                        <path class="acca-trace-path" pathLength="100" d="M206.1 186.58l-0.3 -0.17 0 44.84c0,2.44 -1.17,4.54 -3.25,5.82 -2.08,1.28 -4.48,1.38 -6.66,0.28 -14.63,-7.39 -30.26,-13.08 -46.63,-16.82 -3.14,-0.72 -5.31,-3.44 -5.31,-6.66l0 -44.54c0,-3.38 -2.4,-6.2 -5.73,-6.75 -11.36,-1.86 -23.11,-2.83 -35.16,-2.83 -12.05,0 -23.8,0.97 -35.16,2.83 -3.33,0.55 -5.73,3.37 -5.73,6.75l0 44.54c0,3.23 -2.17,5.94 -5.31,6.66 -16.37,3.75 -32,9.44 -46.63,16.82 -2.18,1.1 -4.58,1 -6.66,-0.28 -2.08,-1.28 -3.25,-3.38 -3.25,-5.82l0 -44.84 -0.3 0.17 0 -55.69c0,-2.78 1.56,-5.16 4.1,-6.27 29.83,-13 63.45,-20.33 98.95,-20.33 35.49,0 69.12,7.33 98.95,20.33 2.55,1.11 4.1,3.49 4.1,6.27l0 55.69z"></path>
                    </svg>
                </div>
                <div class="kh-swal-html">Singkronisasi data ketidakhadiran terbaru</div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: {
                popup: 'kh-swal-popup',
                title: 'kh-swal-title'
            }
        });

        try {
            // Fetch ketidakhadiran data
            const ketidakhadiranRes = await authFetch(`/api/ketidakhadiran?kelas=${encodeURIComponent(kelas)}&from=${tanggal}&to=${tanggal}`);
            const ketidakhadiranJson = await ketidakhadiranRes.json();

            if (ketidakhadiranJson.ok && ketidakhadiranJson.data) {
                const ketidakhadiranMap = new Map<string, { status: string; keterangan: string; id: string; source_type: string }>();

                ketidakhadiranJson.data.forEach((k: any) => {
                    ketidakhadiranMap.set(k.nisn, {
                        status: (k.jenis || '').toUpperCase(),
                        keterangan: k.keterangan || '-',
                        id: k.id,
                        source_type: (k.status || '').toUpperCase()
                    });
                });

                const dayNameForMatch = getDayName(tanggal);
                const programForMatch = getProgram(kelas);
                setRows(prev => prev.map(row => {
                    const matchingK = ketidakhadiranJson.data.filter((k: any) => {
                        if (k.nisn !== row.nisn) return false;
                        const jamKeStr = currentSesi?.jam_ke || '';
                        return isKetidakhadiranActiveForSession(k, jamKeStr, dayNameForMatch, programForMatch);
                    });

                    const kData = matchingK.find((k: any) => (k.jenis || '').trim().toUpperCase() === 'IZIN') || matchingK[0];

                    if (kData) {
                        const status = (kData.jenis || '').toUpperCase();
                        const sourceType = (kData.status || '').toUpperCase();
                        return {
                            ...row,
                            status: status as any,
                            catatan: kData.keterangan || '-',
                            otomatis: true,
                            ref_ketidakhadiran_id: kData.id,
                            source_type: sourceType,
                            system_source: {
                                id: kData.id,
                                status: status as any,
                                keterangan: kData.keterangan || '-',
                                source_type: sourceType
                            }
                        };
                    }
                    if (row.ref_ketidakhadiran_id) {
                        return { ...row, status: 'HADIR', catatan: '', otomatis: true, ref_ketidakhadiran_id: undefined, system_source: undefined, source_type: undefined };
                    }
                    return row;
                }));
                Swal.close();
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data ketidakhadiran berhasil dimuat', timer: 1500, showConfirmButton: false });
            } else {
                Swal.close();
                Swal.fire({ icon: 'info', title: 'Info', text: 'Tidak ada data ketidakhadiran untuk tanggal ini' });
            }
        } catch (error: any) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data ketidakhadiran' });
        }
    }



    async function handleSimpan(makeFinal: boolean) {
        if (!currentSesi) return;

        if (makeFinal) {
            const confirm = await Swal.fire({
                title: 'Simpan Absensi?',
                html: '<p class="text-sm text-slate-600 mb-2">Data absensi akan disimpan secara resmi. Anda dapat membukanya kembali jika diperlukan.</p>',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Simpan',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#1e3a8a',
                cancelButtonColor: '#64748b',
                reverseButtons: true,
                padding: '2rem',
                customClass: {
                    popup: 'rounded-[2rem] shadow-xl border border-slate-100',
                    title: 'text-xl font-bold text-slate-800',
                    actions: 'gap-3',
                    confirmButton: 'rounded-xl px-6 py-3 font-semibold shadow-lg shadow-blue-900/20',
                    cancelButton: 'rounded-xl px-6 py-3 font-semibold'
                }
            });
            if (!confirm.isConfirmed) return;
        }

        Swal.fire({
            title: makeFinal ? 'Menyimpan...' : 'Membuka Kunci...',
            html: `
                <div class="acca-loader-logo-box">
                    <svg viewBox="0 0 206.1 238.12" width="36" height="41.6" class="acca-loader-trace" aria-hidden="true">
                        <path class="acca-trace-path" pathLength="100" d="M196.19 76.92c-27.11,-13.63 -58.96,-21.47 -93.14,-21.47 -34.19,0 -66.03,7.83 -93.14,21.47 -2.18,1.1 -4.58,0.99 -6.66,-0.29 -2.08,-1.28 -3.25,-3.38 -3.25,-5.82l0 -44.22c0,-2.78 1.56,-5.16 4.1,-6.27 29.83,-13 63.45,-20.33 98.95,-20.33 35.49,0 69.12,7.33 98.95,20.33 2.55,1.11 4.1,3.49 4.1,6.27l0 44.22c0,2.44 -1.17,4.54 -3.25,5.82 -2.08,1.28 -4.48,1.38 -6.66,0.29z"></path>
                        <path class="acca-trace-path" pathLength="100" d="M206.1 186.58l-0.3 -0.17 0 44.84c0,2.44 -1.17,4.54 -3.25,5.82 -2.08,1.28 -4.48,1.38 -6.66,0.28 -14.63,-7.39 -30.26,-13.08 -46.63,-16.82 -3.14,-0.72 -5.31,-3.44 -5.31,-6.66l0 -44.54c0,-3.38 -2.4,-6.2 -5.73,-6.75 -11.36,-1.86 -23.11,-2.83 -35.16,-2.83 -12.05,0 -23.8,0.97 -35.16,2.83 -3.33,0.55 -5.73,3.37 -5.73,6.75l0 44.54c0,3.23 -2.17,5.94 -5.31,6.66 -16.37,3.75 -32,9.44 -46.63,16.82 -2.18,1.1 -4.58,1 -6.66,-0.28 -2.08,-1.28 -3.25,-3.38 -3.25,-5.82l0 -44.84 -0.3 0.17 0 -55.69c0,-2.78 1.56,-5.16 4.1,-6.27 29.83,-13 63.45,-20.33 98.95,-20.33 35.49,0 69.12,7.33 98.95,20.33 2.55,1.11 4.1,3.49 4.1,6.27l0 55.69z"></path>
                    </svg>
                </div>
                <div class="kh-swal-html">${makeFinal ? 'Menyimpan data absensi & jurnal...' : 'Membuka kunci sesi absensi...'}</div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: {
                popup: 'kh-swal-popup',
                title: 'kh-swal-title'
            }
        });

        try {
            if (makeFinal) {
                await saveAbsensiInternal(currentSesi.sesi_id, rows, true);
            } else {
                // BUKA KUNCI: hanya ubah status sesi ke DRAFT.
                // Jangan simpan rows — tampilan bisa berbeda dari DB (mis. hasil integrasi
                // ketidakhadiran) dan menyimpannya di sini menimpa data FINAL tanpa disadari.
                await updateSesiStatus(currentSesi.sesi_id, false);
            }

            // Update local state to reflect current status
            setCurrentSesi({ ...currentSesi, status_sesi: makeFinal ? 'FINAL' : 'DRAFT' });

            const snap = new Map<string, string>();
            rows.forEach(r => snap.set(r.nisn, r.status));
            setInitialSnapshot(snap);

            Swal.close();
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: makeFinal ? 'Data berhasil disimpan' : 'Absensi siap diedit',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error: any) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Gagal', text: error.message || 'Simpan gagal' });
        }
    }

    function handleStatusChange(nisn: string, status: string) {
        setRows(prev => prev.map(row => {
            if (row.nisn === nisn) {
                const newStatus = status.trim().toUpperCase() as any;
                let newCatatan = row.catatan || '';
                let newRefId = row.ref_ketidakhadiran_id;
                let newSystemSource = row.system_source;

                // 1. Restore from System Source logic
                if (row.system_source) {
                    const sourceStatus = (row.system_source.status || '').trim().toUpperCase();
                    if (sourceStatus === newStatus) {
                        newRefId = row.system_source.id;
                        newCatatan = row.system_source.keterangan;
                        setTimeout(() => {
                            const Toast = Swal.mixin({
                                toast: true,
                                position: 'top-end',
                                showConfirmButton: false,
                                timer: 3000,
                                timerProgressBar: true
                            });
                            Toast.fire({
                                icon: 'info',
                                title: 'Data Dipulihkan',
                                text: `Keterangan dikembalikan dari data sumber.`
                            });
                        }, 100);
                    } else if (newStatus === 'HADIR' || newStatus === 'ALPHA') {
                        newCatatan = '';
                        newRefId = undefined;
                    } else {
                        if (row.ref_ketidakhadiran_id) {
                            newCatatan = '';
                        }
                        newRefId = undefined;
                    }
                } else {
                    if (newStatus === 'HADIR' || newStatus === 'ALPHA') {
                        newCatatan = '';
                        newRefId = undefined;
                    }
                }

                return {
                    ...row,
                    status: newStatus,
                    otomatis: false,
                    catatan: newCatatan,
                    ref_ketidakhadiran_id: newRefId,
                    system_source: newSystemSource
                };
            }
            return row;
        }));
    }

    function handleCatatanChange(nisn: string, catatan: string) {
        setRows(prev => prev.map(row => {
            if (row.nisn === nisn) {
                return {
                    ...row,
                    catatan: catatan,
                    otomatis: false
                };
            }
            return row;
        }));
    }

    // Update status/materi/refleksi sesi saja (dipakai oleh Buka Kunci)
    async function updateSesiStatus(sesiId: string, makeFinal: boolean) {
        const resSesi = await authFetch('/api/absensi/sesi', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sesi_id: sesiId,
                status_sesi: makeFinal ? 'FINAL' : 'DRAFT',
                materi: materi,
                refleksi: refleksi,
                // Teruskan mode substitusi manual agar kategorisasi jurnal tidak
                // jatuh ke deteksi otomatis (pilihan Tukaran/Diganti sempat hilang)
                ...(isSubstituteMode && selectedTeacher ? { status_kehadiran: substituteSubMode } : {})
            })
        });
        if (!resSesi.ok) throw new Error('Gagal update status sesi');
    }

    async function saveAbsensiInternal(sesiId: string, data: AbsensiRow[], makeFinal: boolean) {
        const doSaveSession = () => updateSesiStatus(sesiId, makeFinal);

        const doSaveDetails = async () => {
            const resDetail = await authFetch('/api/absensi/detail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sesi_id: sesiId, items: data, details: data })
            });
            if (!resDetail.ok) {
                const errJson = await resDetail.json().catch(() => ({}));
                throw new Error(errJson.error || 'Gagal menyimpan detail absensi');
            }
        };

        if (makeFinal) {
            await doSaveDetails();
            await doSaveSession();
        } else {
            await doSaveSession();
            await doSaveDetails();
        }
    }

    async function loadCatatanCounts(sesiId: string) {
        try {
            const res = await authFetch(`/api/catatan-siswa?sesi_id=${encodeURIComponent(sesiId)}`);
            const json = await res.json();
            if (!json.ok) return;
            const counts: Record<string, { positif: number; negatif: number }> = {};
            (json.data || []).forEach((c: any) => {
                if (!counts[c.nisn]) counts[c.nisn] = { positif: 0, negatif: 0 };
                if (c.jenis === 'POSITIF') counts[c.nisn].positif += 1;
                else counts[c.nisn].negatif += 1;
            });
            setCatatanCounts(counts);
        } catch (e) {
            console.error('Gagal memuat rekap catatan siswa:', e);
        }
    }

    useEffect(() => {
        if (currentSesi?.sesi_id) {
            loadCatatanCounts(currentSesi.sesi_id);
        } else {
            setCatatanCounts({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSesi?.sesi_id]);

    /**
     * Membuka <KeteranganModal>. Dulu ini dua popup SweetAlert2 terpisah
     * (info untuk baris terintegrasi, input textarea untuk selebihnya);
     * keduanya kini jadi satu modal yang sepola dengan Catatan Pembelajaran,
     * dengan baris terintegrasi tampil sebagai mode baca-saja di dalamnya.
     */
    function handleEditKeterangan(row: AbsensiRow) {
        if (isFinal) return;
        setKeteranganModalRow(row);
    }

    const isChanged = (r: AbsensiRow) => {
        const init = initialSnapshot.get(r.nisn);
        return init && init !== r.status;
    };

    const isFinal = currentSesi?.status_sesi === 'FINAL';
    const isLockedBySubstitute = !!(!isAdmin && currentSesi?.guru_pengganti_nip && currentSesi?.nip === loggedInUser.nip);
    const isReadOnly = isFinal || isLockedBySubstitute;

    const getRowClass = (r: AbsensiRow) => {
        const statusClass = `row-${(r.status || 'hadir').toLowerCase()}`;
        const changeClass = isChanged(r) ? 'row-changed' : '';
        return `${statusClass} ${changeClass}`.trim();
    };



    return (
        <div className="absensi-page">
            {/* TOP LEVEL TAB BAR NAVIGATION (standard Tab component) */}
            <div className="absn-top-tabs flex items-center justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <Tabs
                        tabs={mainTabs}
                        activeTab={activeTab}
                        onChange={(key) => {
                            setActiveTab(key);
                            setIsAdminMode(key === 'admin');
                            if (key === 'admin') fetchAdminData();
                        }}
                        ariaLabel="Navigasi Absensi"
                        variant="slider"
                    />
                </div>
            </div>

                {/* ADMIN MODE VIEW */}
                {isAdminMode && (
                    <div className="admin-mode-container animate-fade-in">
                        {/* Header panel admin (ikon + judul + jumlah sesi) dihapus:
                            PageBanner di atasnya sudah menyatakan halaman ini, dan
                            jumlah sesi tetap terbaca di bar paginasi bawah. */}

                        <div className="admin-filters">
                            <FilterToolbar>
                                <FilterSelect
                                    label="Tahun Ajaran"
                                    icon="mortarboard"
                                    value={adminTa.selected}
                                    onChange={(val) => adminTa.setSelected(val)}
                                    disabled={!!adminFilterTanggal}
                                    title={adminFilterTanggal ? 'Nonaktif saat filter tanggal spesifik dipakai' : 'Tahun ajaran aktif'}
                                    options={adminTa.years.map(y => ({ value: y, label: y }))}
                                    grow={1}
                                    width={150}
                                />
                                <FilterSelect
                                    label="Semester"
                                    icon="journal-bookmark"
                                    value={adminFilterSemester}
                                    onChange={setAdminFilterSemester}
                                    disabled={!!adminFilterTanggal}
                                    options={[
                                        { value: 'ALL', label: 'Semua Semester' },
                                        { value: 'Ganjil', label: 'Ganjil' },
                                        { value: 'Genap', label: 'Genap' }
                                    ]}
                                    grow={1}
                                    width={150}
                                />
                                <FilterField label="Tanggal" icon="calendar3" grow={1} width={150} bare>
                                    <DatePicker
                                        value={adminFilterTanggal}
                                        onChange={setAdminFilterTanggal}
                                    />
                                </FilterField>
                                <FilterSelect
                                    label="Status"
                                    icon="check-circle"
                                    value={adminFilterStatus}
                                    onChange={setAdminFilterStatus}
                                    options={[
                                        { value: 'semua', label: 'Semua Status' },
                                        { value: 'DRAFT', label: 'Draft' },
                                        { value: 'FINAL', label: 'Final' }
                                    ]}
                                    grow={1}
                                    width={140}
                                />
                                <FilterSearch
                                    label="Pencarian"
                                    value={adminSearch}
                                    onChange={setAdminSearch}
                                    placeholder="Cari guru, mapel, atau kelas..."
                                    grow={2}
                                    width={240}
                                />
                                <FilterActions>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                         onClick={() => {
                                             setExportInitialMode('ADMIN');
                                             setExportLockMode(true);
                                             setIsExportModalOpen(true);
                                         }}
                                        disabled={!adminTa.selected}
                                        leftIcon={<i className="bi bi-download" />}
                                    >
                                        Export Rekap
                                    </Button>
                                </FilterActions>
                            </FilterToolbar>
                        </div>

                        {/* Bilah aksi. Dulu bilah ini selalu tampil dan berisi checkbox
                            "Pilih Semua (n/m)"; checkbox-nya kini pindah ke header tabel
                            (kolom pertama), jadi bilahnya hanya muncul saat ada yang
                            dipilih — kalau tidak, ia cuma baris abu-abu kosong. */}
                        {adminSelectedIds.size > 0 && (
                            <div className="admin-actions">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {adminSelectedIds.size} sesi dipilih
                                </span>
                                <button
                                    className="btn btn-danger"
                                    onClick={handleDeleteSelectedSessions}
                                >
                                    <i className="bi bi-trash3"></i>
                                    Hapus ({adminSelectedIds.size})
                                </button>
                            </div>
                        )}

                        {/* Admin Sessions Table */}
                        <div className="admin-table-container">
                            {adminLoading ? (
                                <div className="admin-loading">
                                    <Spinner size={36} />
                                    <span>Memuat data...</span>
                                </div>
                            ) : adminSessions.length === 0 ? (
                                <div className="admin-empty">
                                    <i className="bi bi-inbox-fill"></i>
                                    <p>Tidak ada sesi absensi ditemukan</p>
                                    <span>Coba ubah kata pencarian, filter, atau tanggal</span>
                                </div>
                            ) : (
                                <div className="desktop-table-container overflow-x-auto">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                {/* Kotak pilih-semua. `indeterminate` tidak punya
                                                    atribut HTML, jadi harus diset lewat ref. */}
                                                <th style={{ width: '40px' }}>
                                                    <input
                                                        type="checkbox"
                                                        className="session-checkbox"
                                                        title="Pilih semua sesi"
                                                        aria-label="Pilih semua sesi"
                                                        checked={adminSelectedIds.size === adminSessions.length && adminSessions.length > 0}
                                                        ref={el => {
                                                            if (el) el.indeterminate = adminSelectedIds.size > 0 && adminSelectedIds.size < adminSessions.length;
                                                        }}
                                                        onChange={handleSelectAllSessions}
                                                    />
                                                </th>
                                                <th style={{ width: '100px' }}>Tanggal</th>
                                                <th style={{ width: '180px' }}>Kelas</th>
                                                <th style={{ minWidth: '220px' }}>Mata Pelajaran / Guru</th>
                                                <th style={{ width: '80px' }}>Jam Ke</th>
                                                <th style={{ width: '90px' }}>Status</th>
                                                <th style={{ width: '120px' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {adminSessions.map((sesi) => (
                                                <tr key={sesi.sesi_id} className={adminSelectedIds.has(sesi.sesi_id) ? 'selected' : ''}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            className="session-checkbox"
                                                            checked={adminSelectedIds.has(sesi.sesi_id)}
                                                            onChange={() => handleSelectSession(sesi.sesi_id)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <span className="date-badge">
                                                            {formatDateDisplay(sesi.tanggal)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="kelas-badge">{sesi.kelas}</span>
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-slate-900 dark:text-slate-100 leading-tight">{sesi.mapel}</div>
                                                            {/* Nama guru apa adanya dari master data — `uppercase`
                                                                sebelumnya mengubah "Imran, S.Si." jadi "IMRAN, S.SI." */}
                                                            <div className="text-[12px] text-slate-500 dark:text-slate-400">{sesi.nama_guru}</div>
                                                            {sesi.guru_pengganti_nip && (
                                                                <div className="mt-1">
                                                                    <span className="pengganti-badge">
                                                                        <i className="bi bi-person-badge-fill text-[10px]"></i>
                                                                        {sesi.guru_pengganti_nama}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="jam-badge">{sesi.jam_ke}</span>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${sesi.status_sesi === 'FINAL' ? 'final' : 'draft'}`}>
                                                            {sesi.status_sesi === 'FINAL' ? (
                                                                <>
                                                                    <i className="bi bi-check-circle-fill"></i>
                                                                    Final
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="bi bi-pencil-fill"></i>
                                                                    Draft
                                                                </>
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <ActionGroup>
                                                            <ActionButton
                                                                action="edit"
                                                                onClick={() => handleEditAdminSession(sesi)}
                                                                title="Edit Sesi"
                                                            />
                                                            <ActionButton
                                                                action="delete"
                                                                onClick={() => handleDeleteAdminSession(sesi)}
                                                                title="Hapus Sesi"
                                                            />
                                                        </ActionGroup>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                                {/* Daftar mobile.
                                    Dulu tiap sesi jadi kartu key-value setinggi ~230px
                                    (tanggal, kelas, jam ke, tombol Edit/Hapus) sehingga
                                    satu layar cuma memuat tiga sesi. Sekarang jadi baris
                                    ringkas berisi mapel + guru + kelas saja; sisanya
                                    pindah ke sheet detail saat baris diketuk.
                                    Pola .mui-* ini dipakai bersama halaman lain
                                    (components/mobile). */}
                                <div className="md:hidden">
                                    <MobileList label="Daftar sesi absensi">
                                        {adminSessions.map((sesi) => {
                                            const isSelected = adminSelectedIds.has(sesi.sesi_id);
                                            return (
                                                <MobileListItem
                                                    key={sesi.sesi_id}
                                                    title={sesi.mapel}
                                                    subtitle={`${sesi.nama_guru} · ${sesi.kelas}`}
                                                    // Ikon mapel, bukan inisial. Ronanya diseragamkan
                                                    // lewat CSS (.admin-mode-container .mui-avatar) —
                                                    // rona per-baris bawaan MobileAvatar hanya berguna
                                                    // kalau ikonnya berbeda-beda, di sini semuanya sama.
                                                    icon="journal-bookmark"
                                                    // Badge hanya untuk yang MENYIMPANG: sesi final adalah
                                                    // keadaan yang diharapkan, jadi tidak diberi penanda.
                                                    badge={sesi.status_sesi === 'FINAL' ? undefined : (
                                                        <span className="status-badge draft">Draft</span>
                                                    )}
                                                    // Tekan-lama masuk mode seleksi; setelah ada yang
                                                    // terpilih, ketukan biasa ikut menambah/mengurangi
                                                    // seleksi alih-alih membuka detail.
                                                    selectionMode={adminSelectedIds.size > 0}
                                                    selected={isSelected}
                                                    onLongPress={() => handleSelectSession(sesi.sesi_id)}
                                                    onClick={() => {
                                                        if (adminSelectedIds.size > 0) handleSelectSession(sesi.sesi_id);
                                                        else setAdminDetailSesi(sesi);
                                                    }}
                                                />
                                            );
                                        })}
                                    </MobileList>
                                </div>


                            {/* Pagination */}
                            {!adminLoading && adminSessions.length > 0 && totalAdminSessions > adminLimit && (
                                <div className="admin-pagination">
                                    <div className="pagination-info">
                                        Menampilkan <b>{adminSessions.length}</b> dari <b>{totalAdminSessions}</b> sesi
                                    </div>
                                    <div className="pagination-controls">
                                        <button 
                                            className="pag-btn"
                                            disabled={adminPage === 1}
                                            onClick={() => fetchAdminSessions(adminPage - 1)}
                                        >
                                            <i className="bi bi-chevron-left"></i>
                                        </button>
                                        {(() => {
                                            // Jendela maks 5 nomor halaman mengikuti halaman aktif,
                                            // supaya halaman > 5 tetap bisa dijangkau
                                            const totalPages = Math.ceil(totalAdminSessions / adminLimit);
                                            const windowSize = Math.min(5, totalPages);
                                            const start = Math.max(1, Math.min(adminPage - 2, totalPages - windowSize + 1));
                                            return Array.from({ length: windowSize }, (_, i) => start + i).map(pageNum => (
                                                <button
                                                    key={pageNum}
                                                    className={`pag-btn ${adminPage === pageNum ? 'active' : ''}`}
                                                    onClick={() => fetchAdminSessions(pageNum)}
                                                >
                                                    {pageNum}
                                                </button>
                                            ));
                                        })()}
                                        <button 
                                            className="pag-btn"
                                            disabled={adminPage >= Math.ceil(totalAdminSessions / adminLimit)}
                                            onClick={() => fetchAdminSessions(adminPage + 1)}
                                        >
                                            <i className="bi bi-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* NORMAL MODE - FILTER CARD */}
                {!isAdminMode && (
                <>
                {/* FILTER CARD */}
                <div className="filter-card flex flex-col gap-2">
                    <FilterToolbar alwaysExpanded>
                        <FilterSelect
                            label="Mode Absensi"
                            icon="sliders"
                            value={!isSubstituteMode ? 'Normal' : substituteSubMode}
                            onChange={(val) => {
                                if (val === 'Normal') {
                                    if (isSubstituteMode) toggleSubstituteMode();
                                } else {
                                    if (!isSubstituteMode) {
                                        setIsSubstituteMode(true);
                                        setScope(null);
                                        setKelas('');
                                        setMapel('');
                                        setJamKe('');
                                    }
                                    setSubstituteSubMode(val as 'Tukaran' | 'Diganti');
                                    setMapel('');
                                    setJamKe('');
                                }
                            }}
                            options={[
                                { value: 'Normal', label: 'Normal' },
                                { value: 'Tukaran', label: 'Mode Tukaran' },
                                { value: 'Diganti', label: 'Mode Diganti' }
                            ]}
                            grow={1}
                            width={160}
                        />

                        {/* Tanggal di urutan ke-2: opsi Kelas/Mapel/Jam Ke semuanya
                            diturunkan dari tanggal, jadi alurnya kiri → kanan. */}
                        <FilterField label="Tanggal Mengajar" icon="calendar3" grow={1} width={160} bare>
                            <DatePicker
                                value={tanggal}
                                onChange={setTanggal}
                            />
                        </FilterField>

                        {isSubstituteMode && (
                            <FilterSelect
                                label={substituteSubMode === 'Tukaran' ? "Nama Guru yang Ditukar" : "Nama Guru yang Digantikan"}
                                icon="person-badge"
                                value={selectedTeacher?.nip || ''}
                                onChange={(val) => {
                                    const teacher = selectableTeachers.find(t => String(t.nip).trim() === String(val).trim());
                                    if (teacher) {
                                        setSelectedTeacher(teacher);
                                        setScope(null);
                                        setNip(teacher.nip);
                                        setNamaGuru(teacher.nama);
                                        setKelas('');
                                        setMapel('');
                                        setJamKe('');
                                    } else {
                                        setSelectedTeacher(null);
                                        setScope(null);
                                        setNip(loggedInUser.nip);
                                        setNamaGuru(loggedInUser.nama);
                                        setKelas('');
                                        setMapel('');
                                        setJamKe('');
                                    }
                                }}
                                options={[
                                    {
                                        value: '',
                                        label: selectableTeachers.length === 0
                                            ? (substituteSubMode === 'Tukaran' ? '-- Tidak Ada Guru dengan Kelas Sama Hari Ini --' : '-- Tidak Ada Guru Mengajar Hari Ini --')
                                            : (substituteSubMode === 'Tukaran' ? '-- Pilih Guru yang Ditukar --' : '-- Pilih Guru yang Digantikan --')
                                    },
                                    ...selectableTeachers.map(t => ({ value: t.nip, label: t.nama }))
                                ]}
                                grow={2}
                                width={220}
                            />
                        )}

                        <FilterSelect
                            label="Kelas"
                            icon="door-open"
                            value={kelas}
                            onChange={(val) => {
                                setKelas(val);
                                if (!isSubstituteMode) {
                                    setMapel('');
                                    setJamKe('');
                                }
                            }}
                            options={getAvailableClasses().map(k => ({ value: k, label: getClassLabel(k) }))}
                            grow={1}
                            width={150}
                        />

                        <FilterSelect
                            label="Mata Pelajaran"
                            icon="journal-bookmark"
                            value={mapel}
                            onChange={(val) => {
                                setMapel(val);
                                if (!isSubstituteMode) {
                                    setJamKe('');
                                }
                            }}
                            options={[
                                { value: '', label: '-- Pilih Mata Pelajaran --' },
                                ...getAvailableMapels(kelas).map(m => ({ value: m, label: m }))
                            ]}
                            grow={2}
                            width={220}
                        />

                        <FilterField label="Jam Ke" icon="clock" grow={1.5} width={240}>
                            <Select
                                id="jamKe"
                                isMulti
                                isSearchable={false}
                                instanceId="jamKe-select"
                                placeholder="Pilih Jam Pelajaran..."
                                options={getAvailableJams()}
                                value={(() => {
                                    const ops = getAvailableJams();
                                    const selectedValues = (jamKe || '').split(',').map(s => s.trim()).filter(s => !!s);
                                    return ops.filter(o => {
                                        const v = o.value.includes('||') ? o.value.split('||')[0] : o.value;
                                        return selectedValues.includes(v);
                                    });
                                })()}
                                onChange={(selected: any) => {
                                    if (!selected || selected.length === 0) {
                                        setJamKe('');
                                        return;
                                    }

                                    const jams = selected.map((s: any) => s.value.includes('||') ? s.value.split('||')[0] : s.value);
                                    setJamKe(jams.join(', '));

                                    const first = selected[0] ? selected[0].value : '';
                                    if (isSubstituteMode && first.includes('||')) {
                                        const [_, targetNip, targetMapel, targetNama] = first.split('||');
                                        const isMe = targetNip === loggedInUser.nip;
                                        const shouldUpdateTeacher =
                                            !selectedTeacher ||
                                            substituteSubMode === 'Diganti' ||
                                            (!isMe && selectedTeacher.nip !== targetNip);

                                        if (shouldUpdateTeacher) {
                                            if (nip !== targetNip) setNip(targetNip);
                                            if (namaGuru !== targetNama) setNamaGuru(targetNama);
                                            if (!selectedTeacher || selectedTeacher.nip !== targetNip) {
                                                setSelectedTeacher({ nip: targetNip, nama: targetNama });
                                            }
                                        }

                                        if (!mapel || substituteSubMode === 'Diganti') {
                                            if (mapel !== targetMapel) setMapel(targetMapel);
                                        }
                                    }
                                }}
                                styles={customSelectStyles}
                                components={{
                                    ValueContainer: JamValueContainer,
                                    DropdownIndicator: JamDropdownIndicator,
                                    ClearIndicator: JamClearIndicator
                                }}
                                className="jp__multiSelect react-select-container flex-1"
                                classNamePrefix="react-select"
                            />
                        </FilterField>

                        <FilterActions style={{ marginLeft: 'auto' }}>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={bukaSesi}
                                disabled={loading || !canDo('take')}
                                leftIcon={<i className="bi bi-box-arrow-in-right" />}
                            >
                                Buka Sesi
                            </Button>

                            {/* Refresh tetap ada sebagai jalan keluar kalau jadwal diubah
                                admin saat halaman terbuka. */}
                            <Button
                                type="button"
                                variant="secondary"
                                icon="export"
                                onClick={() => {
                                    setExportInitialMode('GURU');
                                    setExportLockMode(true);
                                    setIsExportModalOpen(true);
                                }}
                            >
                                Export
                            </Button>

                            <Button
                                type="button"
                                variant="secondary"
                                onClick={reloadScope}
                                title="Muat Ulang Jadwal"
                                leftIcon={<i className="bi bi-arrow-clockwise" />}
                            >
                                Refresh
                            </Button>

                            {currentSesi && (
                                isLockedBySubstitute ? (
                                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 animate-pulse">
                                        <i className="bi bi-info-circle-fill"></i>
                                        <span className="text-[10px] font-bold leading-tight">DIABSEN OLEH<br/>PENGGANTI</span>
                                    </div>
                                ) : isFinal ? (
                                    <Button
                                        type="button"
                                        variant="cancel"
                                        disabled={loading || !canDo('save_draft')}
                                        onClick={() => handleSimpan(false)}
                                        leftIcon={<i className="bi bi-unlock-fill" />}
                                    >
                                        Buka Kunci
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="primary"
                                        className="absn-btn-simpan"
                                        disabled={loading || !canDo('finalize')}
                                        onClick={() => handleSimpan(true)}
                                        leftIcon={<i className="bi bi-check2-circle" />}
                                    >
                                        Simpan
                                    </Button>
                                )
                            )}

                        </FilterActions>
                    </FilterToolbar>
                </div>

                    {/* DEDICATED SESI INFO BADGE ROW.
                        Spacing (margin/padding) diatur lewat kelas .absn-sesi-bar /
                        .absn-sesi-chip di absensi.css, bukan utility Tailwind:
                        globals.css punya reset `* { margin: 0; padding: 0 }` tanpa @layer
                        yang mengalahkan seluruh utility spacing Tailwind v4. */}
                    {currentSesi && (
                        <div className="absn-sesi-bar">
                            {/* Selalu satu baris, termasuk di mobile */}
                            <div className="flex flex-row items-center gap-3 sm:gap-5">
                                {/* IDENTITAS SESI */}
                                <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        {/* Kelas & mapel sengaja tidak diulang di sini — keduanya
                                            sudah tampil di FilterToolbar tepat di atas baris ini.
                                            Yang tersisa cuma status sesi (DRAFT/FINAL). */}
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase leading-none tracking-[0.14em]
                                            ${currentSesi.status_sesi === 'FINAL'
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-amber-600 dark:text-amber-400'}`}>
                                            {/* Titik berkedip hanya saat DRAFT — penanda bahwa sesi
                                                belum disimpan final. Saat FINAL titiknya diam. */}
                                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current
                                                ${currentSesi.status_sesi === 'FINAL' ? 'opacity-80' : 'animate-pulse'}`}></span>
                                            {currentSesi.status_sesi === 'FINAL' ? 'FINAL' : 'DRAFT'}
                                        </span>
                                        {currentSesi.guru_pengganti_nip && (
                                            <span className="flex items-center gap-1.5 text-[11px] font-semibold leading-none text-blue-600 dark:text-blue-300">
                                                <i className="bi bi-person-badge-fill shrink-0"></i>
                                                <span className="truncate">Dilakukan oleh: {currentSesi.guru_pengganti_nama || currentSesi.guru_pengganti_nip}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* AKSI (status sudah pindah ke label kiri) */}
                                <div className="flex shrink-0 items-center gap-2">
                                    {/* Tombol Batalkan Sesi Pengganti jika dibuat oleh user ini */}
                                    {currentSesi.guru_pengganti_nip === loggedInUser.nip && (
                                        <button
                                            type="button"
                                            onClick={handleCancelSubstituteSession}
                                            disabled={loading}
                                            className="absn-sesi-chip inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[5px] border border-red-200 dark:border-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-[11px] font-bold leading-none text-red-600 dark:text-red-300 transition-all cursor-pointer"
                                            title="Batalkan sesi tukaran / pengganti ini"
                                        >
                                            <i className="bi bi-trash"></i> Batalkan Sesi Tukaran / Pengganti
                                        </button>
                                    )}
                                    {adminEditSesi && (
                                        <button
                                            onClick={handleCancelAdminEdit}
                                            className="absn-sesi-chip inline-flex h-8 shrink-0 items-center gap-2 rounded-[5px] border border-red-200 dark:border-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-[11px] font-bold leading-none text-red-600 dark:text-red-300 transition-all"
                                        >
                                            <i className="bi bi-x-circle"></i> Batal Edit
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Old footer removed - merged above */}

                    {/* SUBSTITUTE LOCK NOTICE */}
                    {isLockedBySubstitute && (
                        <div className="md:col-span-12" style={{ marginBottom: '16px' }}>
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="bg-amber-100 dark:bg-amber-900/50 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                                        <i className="bi bi-arrow-left-right text-amber-600 dark:text-amber-400 text-xl"></i>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Sesi Absensi Ini Diambil Melalui Tukaran / Guru Pengganti</h4>
                                        <p className="text-xs text-amber-700 dark:text-amber-300 opacity-90 underline decoration-amber-300 underline-offset-2">
                                            Diisi Oleh: <strong>{currentSesi?.guru_pengganti_nama}</strong>
                                        </p>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                            Jika Anda sebenarnya hadir di kelas dan ingin mengisi absensi sendiri (misal salah pilih guru tukaran), klik tombol Ambil Alih di samping.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleReclaimSession}
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                    <i className="bi bi-person-check-fill"></i>
                                    Saya Hadir (Batalkan Tukaran & Ambil Alih)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* JURNAL INPUT SECTION */}
                    {currentSesi && (
                        <div className="mb-3 mt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60" style={{ paddingTop: '12px', paddingLeft: '14px', paddingRight: '14px', paddingBottom: '12px' }}>
                                {/* Materi */}
                                <div className="flex flex-col gap-2.5">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide" style={{ paddingLeft: '2px' }}>
                                        Materi Pembelajaran <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        className="w-full min-h-[120px] text-[0.9rem] leading-relaxed border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-y disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500"
                                        style={{ padding: '10px 14px', borderRadius: '6px' }}
                                        placeholder="Contoh: Bab 3 — Persamaan Kuadrat..."
                                        value={materi}
                                        onChange={e => setMateri(e.target.value)}
                                        disabled={isReadOnly}
                                    ></textarea>
                                </div>

                                {/* Refleksi */}
                                <div className="flex flex-col gap-2.5">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide" style={{ paddingLeft: '2px' }}>
                                        Refleksi / Catatan
                                    </label>
                                    <textarea
                                        className="w-full min-h-[120px] text-[0.9rem] leading-relaxed border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-y disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500"
                                        style={{ padding: '10px 14px', borderRadius: '6px' }}
                                        placeholder="Catatan refleksi, kendala atau tindak lanjut..."
                                        value={refleksi}
                                        onChange={e => setRefleksi(e.target.value)}
                                        disabled={isReadOnly}
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    )}

                {/* DATA TABLE */}
                <div className="data-table">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '5%', textAlign: 'center' }}>No</th>
                                <th style={{ width: '15%' }}>NISN</th>
                                <th style={{ width: '27%' }}>Nama Siswa</th>
                                <th style={{ width: '40%' }}>Status Kehadiran</th>
                                <th style={{ width: '13%', textAlign: 'center' }}>Ket / Catatan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                /* Baris kosong DIKECUALIKAN dari aturan kartu mobile lewat
                                   kelas ini: di mobile tiap <tr> jadi grid kartu dan sel
                                   pertamanya digayakan sebagai badge nomor — sel colSpan
                                   ini kena keduanya sekaligus dan pesannya jadi tak terbaca. */
                                <tr className="dt-emptyRow">
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--n-muted)' }}>
                                        <i className="bi bi-inbox" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}></i>
                                        Silakan pilih kelas dan klik <strong>Buka</strong> untuk memuat data siswa
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r, idx) => (
                                    <tr key={r.nisn} className={getRowClass(r)}>
                                        <td data-label="No" style={{ textAlign: 'center', fontWeight: 600 }}>
                                            {idx + 1}
                                        </td>
                                        <td data-label="NISN" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                            {r.nisn}
                                        </td>
                                        <td data-label="Nama Siswa" style={{ fontWeight: 600 }}>
                                            {r.nama_snapshot}
                                            {isChanged(r) && (
                                                <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>
                                                    <i className="bi bi-pencil-fill"></i>
                                                </span>
                                            )}
                                            {/* Show truncated note preview if exists */}
                                            {r.catatan && (
                                                <div className="text-xs text-slate-500 mt-1 italic truncate max-w-[200px] flex items-center gap-1">
                                                    {r.ref_ketidakhadiran_id && <i className="bi bi-link-45deg text-blue-500"></i>}
                                                    {r.source_type && (
                                                        <span
                                                            className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded bg-slate-200 text-slate-600 border border-slate-300"
                                                            title={`Sumber: ${r.source_type}`}
                                                        >
                                                            {r.source_type.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <span className="truncate">{r.catatan}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td data-label="Status Kehadiran">
                                            <StatusRadios
                                                nisn={r.nisn}
                                                index={idx}
                                                currentStatus={r.status}
                                                disabled={isReadOnly}
                                                onChange={handleStatusChange}
                                            />
                                        </td>
                                        <td data-label="Ket. / Catatan">
                                            <div className="flex items-center justify-end sm:justify-center gap-2">
                                                <ActionButton
                                                    action="catatan"
                                                    onClick={() => handleEditKeterangan(r)}
                                                    disabled={isReadOnly}
                                                    title={r.ref_ketidakhadiran_id ? "Lihat Keterangan (Terintegrasi)" : "Edit Keterangan"}
                                                    className={r.ref_ketidakhadiran_id ? '!text-blue-500 !border-blue-500/30 !bg-blue-500/10' : r.catatan ? '!text-amber-500 !border-amber-500/30 !bg-amber-500/10' : ''}
                                                />

                                                {(() => {
                                                    const cnt = catatanCounts[r.nisn];
                                                    const hasPositif = !!cnt?.positif;
                                                    const hasNegatif = !!cnt?.negatif;
                                                    const hasAny = hasPositif || hasNegatif;
                                                    return (
                                                        <div className="relative inline-flex items-center">
                                                            <ActionButton
                                                                action="catatan_pembelajaran"
                                                                onClick={() => setCatatanModalRow(r)}
                                                                title="Catatan Pembelajaran (Positif/Negatif)"
                                                                className={hasAny ? '!text-indigo-500 !border-indigo-500/30 !bg-indigo-500/10' : ''}
                                                            />
                                                            {hasPositif && (
                                                                <span style={{ position: 'absolute', top: -2, right: hasNegatif ? 8 : -2, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', border: '1.5px solid var(--n-card)', pointerEvents: 'none', zIndex: 20 }}></span>
                                                            )}
                                                            {hasNegatif && (
                                                                <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid var(--n-card)', pointerEvents: 'none', zIndex: 20 }}></span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                </>
                )}


                {isExportModalOpen && (
                    <ExportModal
                        isOpen={isExportModalOpen}
                        onClose={() => setIsExportModalOpen(false)}
                        userRole={userRole}
                        nip={loggedInUser.nip}
                        namaGuru={loggedInUser.nama}
                        isSubstitute={false}
                        teacherClasses={userScope?.kelasList || scope?.kelasList || []}
                        permissions={userPermissions}
                        isAdmin={isAdmin}
                        roles={roles}
                        initialMode={exportInitialMode}
                        lockMode={exportLockMode}
                        initialTahunAjaran={adminTa.selected}
                    />
                )}
            <CatatanSiswaModal
                isOpen={!!catatanModalRow}
                onClose={() => setCatatanModalRow(null)}
                sesiId={currentSesi?.sesi_id || ''}
                nisn={catatanModalRow?.nisn || ''}
                namaSiswa={catatanModalRow?.nama_snapshot || ''}
                kelas={currentSesi ? getClassLabel(currentSesi.kelas) : ''}
                mapel={currentSesi?.mapel}
                readOnly={isReadOnly}
                currentNip={loggedInUser.nip}
                onChanged={() => currentSesi?.sesi_id && loadCatatanCounts(currentSesi.sesi_id)}
            />
            {/* Detail sesi dari daftar mobile panel admin.
                Memakai kerangka bersama <Modal> (components/Modal.tsx), bukan
                MobileSheet: satu bentuk dialog untuk seluruh aplikasi, termasuk
                footer view/detail siap pakai (Hapus kiri, Edit kanan). */}
            {adminDetailSesi && (
                <Modal
                    size="md"
                    variant="edit"
                    onClose={() => setAdminDetailSesi(null)}
                    labelledBy="admin-sesi-view-title"
                >
                    <ModalHeader
                        id="admin-sesi-view-title"
                        icon="journal-bookmark"
                        title={adminDetailSesi.mapel}
                        subtitle={adminDetailSesi.nama_guru}
                        onClose={() => setAdminDetailSesi(null)}
                    />
                    <ModalBody>
                        <div className="sk__grid2">
                            <div className="sk__field">
                                <label>Tanggal</label>
                                <div className="sk__readInput">
                                    {formatDateDisplay(adminDetailSesi.tanggal)}
                                </div>
                            </div>

                            <div className="sk__field">
                                <label>Kelas</label>
                                <div className="sk__readInput">{adminDetailSesi.kelas}</div>
                            </div>

                            <div className="sk__field">
                                <label>Jam Ke</label>
                                <div className="sk__readInput">{adminDetailSesi.jam_ke}</div>
                            </div>

                            <div className="sk__field">
                                <label>Status</label>
                                <div className="sk__readInput">
                                    {adminDetailSesi.status_sesi === 'FINAL' ? 'Final' : 'Draft'}
                                </div>
                            </div>

                            {adminDetailSesi.guru_pengganti_nip && (
                                <div className="sk__field sk__fieldFull">
                                    <label>Digantikan</label>
                                    <div className="sk__readInput">{adminDetailSesi.guru_pengganti_nama}</div>
                                </div>
                            )}
                        </div>
                    </ModalBody>
                    <ModalViewFooter
                        onClose={() => setAdminDetailSesi(null)}
                        onDelete={() => {
                            const sesi = adminDetailSesi;
                            setAdminDetailSesi(null);
                            handleDeleteAdminSession(sesi);
                        }}
                        onEdit={() => {
                            const sesi = adminDetailSesi;
                            setAdminDetailSesi(null);
                            handleEditAdminSession(sesi);
                        }}
                    />
                </Modal>
            )}
            <KeteranganModal
                isOpen={!!keteranganModalRow}
                onClose={() => setKeteranganModalRow(null)}
                namaSiswa={keteranganModalRow?.nama_snapshot || ''}
                value={keteranganModalRow?.catatan || ''}
                terintegrasi={!!keteranganModalRow?.ref_ketidakhadiran_id}
                onSave={(text) => keteranganModalRow && handleCatatanChange(keteranganModalRow.nisn, text)}
            />
            <MaintenanceBanner pageKey="maintenance_absensi" />
        </div>
    );
}

// PREMIUM STATUS RADIOS COMPONENT
function StatusRadios({ nisn, index, currentStatus, disabled, onChange }: any) {
    const statuses = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'];
    const normalizedCurrent = (currentStatus || '').toString().trim().toUpperCase();

    return (
        <div className="status-radio-group">
            {statuses.map(status => {
                const uniqueId = `r_${nisn}_${index}_${status}`;
                const checked = normalizedCurrent === status;

                return (
                    <div key={status} className="status-radio-item">
                        <input
                            type="radio"
                            id={uniqueId}
                            name={`st_${nisn}_${index}`}
                            value={status}
                            checked={checked}
                            disabled={disabled}
                            onChange={() => onChange(nisn, status)}
                        />
                        <label
                            className="status-radio-label"
                            htmlFor={uniqueId}
                            data-status={status}
                        >
                            {status}
                        </label>
                    </div>
                );
            })}
        </div>
    );
}
