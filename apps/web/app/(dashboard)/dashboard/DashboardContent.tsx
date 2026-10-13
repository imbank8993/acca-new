'use client';

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTimezone } from '@/hooks/use-timezone';
import { getActivePeriods } from '@/lib/settings-client';
import { getAcademicYearFromDate } from '@/lib/date-utils';
import type { User } from '@/lib/types';
import { getProxiedImageUrl } from '@/lib/image-utils';
import DOMPurify from 'isomorphic-dompurify';
import DashboardCharts from './DashboardCharts';
import DashboardKinerjaCard from './DashboardKinerjaCard';
import DashboardExamCard from './DashboardExamCard';
import Modal, { ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
    Megaphone,
    ChevronsRight,
    ChevronLeft,
    ChevronRight,
    Users,
    BookOpen,
    Briefcase,
    ListTodo,
    GraduationCap,
    Book,
    Trophy,
    CheckCircle2,
    Clock,
    Calendar,
    ClipboardList,
    UserX,
    Building2,
    BellOff,
    Pin,
    UserCircle2,
    X,
    HeartPulse,
    Mail,
    Sun,
    Moon,
    User as UserIcon
} from 'lucide-react';

export default function DashboardContent({ user, headerExtra }: { user: User; headerExtra?: ReactNode }) {
    // Birthday state
    const [isBirthdayOpen, setIsBirthdayOpen] = useState(false);

    const [dashboardSummary, setDashboardSummary] = useState<any>(null);

    useEffect(() => {
        const loadSummary = async () => {
            if (!user) return;
            try {
                const targetNisn = user.nisn || (user.roles?.includes('SISWA') || user.role === 'SISWA' ? user.nip || user.username : '');
                const url = targetNisn ? `/api/dashboard/summary?nisn=${encodeURIComponent(targetNisn)}` : '/api/dashboard/summary';
                const res = await fetch(url);
                if (!res.ok) return;
                const json = await res.json().catch(() => null);
                if (json?.ok && json?.data) {
                    setDashboardSummary(json.data);

                    if (json.data.age !== null) {
                        setAge(json.data.age);
                        const today = new Date();
                        const bdayKey = `bday_${user.id}_${today.getFullYear()}`;
                        if (!sessionStorage.getItem(bdayKey)) {
                            setIsBirthdayOpen(true);
                            sessionStorage.setItem(bdayKey, 'true');
                        }
                    }

                    if (json.data.siswaData) {
                        setSiswaKelas(json.data.siswaData.kelasSekarang);
                        setAllStudentClasses(json.data.siswaData.kelasHistory);
                        setWaliKelasName(json.data.siswaData.waliKelas);
                        if (json.data.siswaData.guruAsuh) {
                            setGuruAsuhName(json.data.siswaData.guruAsuh.nama);
                        } else {
                            setGuruAsuhName(null);
                        }
                        if (Array.isArray(json.data.siswaData.saudaraAsuh)) {
                            setAnakAsuh(json.data.siswaData.saudaraAsuh);
                            setAnakAsuhKehadiran(json.data.siswaData.saudaraAsuhKehadiran || {});
                        }
                    }

                    if (json.data.guruData) {
                        setAnakAsuh(json.data.guruData.anakAsuh);
                        setTugasTambahan(json.data.guruData.tugasTambahan);
                        setGuruTugas(json.data.guruData.tugasDibuat);
                    }
                }
            } catch (e) {
                console.error('Error loading dashboard summary', e);
            }
        };
        loadSummary();
    }, [user]);


    const { timezone, getCurrentDate, getDayName } = useTimezone();
    const [age, setAge] = useState(0);

    // --- Strip hari (Min..Sab) pada kartu jam: tanggal minggu berjalan + penanda agenda disinkronkan ke zona waktu sekolah (WITA/site_settings) ---
    const toSchoolISO = useCallback((d: Date) => {
        try {
            return d.toLocaleDateString('en-CA', { timeZone: timezone });
        } catch {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }, [timezone]);

    const todayISO = useMemo(() => toSchoolISO(new Date()), [toSchoolISO]);

    const [agendaOffset, setAgendaOffset] = useState(0);

    const moveAgenda = (direction: number) => {
        setAgendaOffset(prev => Math.max(0, prev + direction));
        setSelectedAgendaDate(null);
    };

    // Geser strip agenda dengan jari — jarak minimum 40px, sama seperti pola
    // di app/jadwal/components/JadwalLengkapModal.tsx, supaya scroll vertikal
    // biasa tidak salah terbaca sebagai geser hari.
    const agendaTouchStartX = useRef<number | null>(null);
    const handleAgendaTouchStart = (e: TouchEvent) => { agendaTouchStartX.current = e.touches[0].clientX };
    const handleAgendaTouchEnd = (e: TouchEvent) => {
        if (agendaTouchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - agendaTouchStartX.current;
        agendaTouchStartX.current = null;
        if (Math.abs(delta) < 40) return;
        moveAgenda(delta < 0 ? 1 : -1);
    };

    // 5 Hari agenda di desktop, 4 di mobile (5th day hidden via CSS on mobile)
    const weekDays = useMemo(() => {
        const base = todayISO ? new Date(`${todayISO}T00:00:00`) : new Date();
        const validBase = isNaN(base.getTime()) ? new Date() : base;
        return Array.from({ length: 5 }, (_, i) => {
            const d = new Date(validBase);
            d.setDate(validBase.getDate() + agendaOffset + i);
            return d;
        });
    }, [todayISO, agendaOffset]);

    const [agendaDates, setAgendaDates] = useState<Set<string>>(new Set());
    const [agendaItemsList, setAgendaItemsList] = useState<any[]>([]);

    useEffect(() => {
        let aborted = false;
        const loadAgendaMingguIni = async () => {
            try {
                const months = [...new Set(weekDays.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`))];
                const results = await Promise.all(
                    months.map(m => fetch(`/api/agenda-madrasah?bulan=${m}`).then(r => r.json()).catch(() => null))
                );

                const weekISO = weekDays.map(toSchoolISO);
                const firstISO = weekISO[0];
                const lastISO = weekISO[weekISO.length - 1];
                const marked = new Set<string>();
                const fetchedItems: any[] = [];

                results.forEach((json: any) => {
                    (json?.data || []).forEach((a: any) => {
                        if (!a.tanggal_mulai) return;
                        const mulai = String(a.tanggal_mulai).slice(0, 10);
                        const selesai = String(a.tanggal_selesai || a.tanggal_mulai).slice(0, 10);
                        if (selesai < firstISO || mulai > lastISO) return;
                        weekISO.forEach(iso => {
                            if (iso >= mulai && iso <= selesai) marked.add(iso);
                        });
                        fetchedItems.push(a);
                    });
                });

                if (!aborted) {
                    setAgendaDates(prev => new Set([...prev, ...marked]));
                    // Sort items by tanggal & waktu_mulai
                    const uniqueItems = Array.from(new Map(fetchedItems.map(item => [item.id, item])).values());
                    uniqueItems.sort((a, b) => {
                        const dateA = `${a.tanggal_mulai} ${a.waktu_mulai || '00:00'}`;
                        const dateB = `${b.tanggal_mulai} ${b.waktu_mulai || '00:00'}`;
                        return dateA.localeCompare(dateB);
                    });
                    setAgendaItemsList(uniqueItems);
                }
            } catch (e) {
                console.error('Error loading agenda minggu ini:', e);
            }
        };
        loadAgendaMingguIni();
        return () => { aborted = true; };
    }, [weekDays]);

    // Core states
    const [siswaKelas, setSiswaKelas] = useState<string | null>(null);

    // Tahun ajaran aktif terbaru — is_active bisa lebih dari satu baris
    // (Ganjil+Genap, atau dua tahun berbeda); ambil tahun terbesar saja.
    // Tidak ada fallback ke tahun nonaktif: data yang tidak ada di tahun
    // aktif ditampilkan sebagai "Belum diatur" oleh pemanggilnya.
    const getNewestActiveYear = async (): Promise<string | null> => {
        const years = [...new Set((await getActivePeriods()).map(p => p.tahun_ajaran))]
            .sort((a, b) => b.localeCompare(a));
        return years[0] || null;
    };

    const [jadwalHariIni, setJadwalHariIni] = useState<any[]>([]);
    const [jadwalPiketHariIni, setJadwalPiketHariIni] = useState<any[]>([]);
    const [loadingJadwal, setLoadingJadwal] = useState(false);
    const [loadingPiket, setLoadingPiket] = useState(false);

    // GURU specific states
    const [guruJadwalSummary, setGuruJadwalSummary] = useState<{ classes: string[]; days: string[] }>({ classes: [], days: [] });
    const [guruPiketDays, setGuruPiketDays] = useState<string[]>([]);
    const [anakAsuh, setAnakAsuh] = useState<any[]>([]);
    // Status kehadiran anak asuh HARI INI: nisn -> HADIR | IZIN | SAKIT
    const [anakAsuhKehadiran, setAnakAsuhKehadiran] = useState<Record<string, { kode: string; keterangan: string }>>({});

    // Data dua kartu grafik (tren mingguan + keterisian jurnal). Sumbernya
    // /api/admin/dashboard-charts; sebelum ini tren memakai array hardcoded dan
    // kartu jurnal selalu 0% karena loadernya tidak pernah dipanggil.
    const [chartData, setChartData] = useState<{
        siswaAktif: number;
        weeklyTrends: { day: string; tanggal: string; hadir: number; sakitIzin: number }[];
        jurnalStats: { total: number; sesuai: number; terlambat: number; kosong: number; lainnya: number };
    } | null>(null);
    const [loadingCharts, setLoadingCharts] = useState(false);
    const [tugasTambahan, setTugasTambahan] = useState<any[]>([]);
    const [guruTugas, setGuruTugas] = useState<any[]>([]);
    const [pengumuman, setPengumuman] = useState<any[]>([]);
    const [loadingPengumuman, setLoadingPengumuman] = useState(true);
    const [showAllPengumuman, setShowAllPengumuman] = useState(false);
    const [expandedPengumuman, setExpandedPengumuman] = useState<Record<string, boolean>>({});
    const [selectedPengumuman, setSelectedPengumuman] = useState<any | null>(null);
    const [selectedAgendaDate, setSelectedAgendaDate] = useState<string | null>(null);
    const announcementTrackRef = useRef<HTMLDivElement>(null);

    const handleScrollAnnouncements = (direction: 'left' | 'right') => {
        if (announcementTrackRef.current) {
            const scrollAmount = direction === 'left' ? -320 : 320;
            announcementTrackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    // Selalu pastikan track pengumuman berada di posisi paling kiri (pengumuman terbaru / dipin) saat refresh atau data dimuat
    useEffect(() => {
        if (announcementTrackRef.current) {
            announcementTrackRef.current.scrollTo({ left: 0, behavior: 'instant' });
        }
    }, [pengumuman, loadingPengumuman]);
    const [showAllAnakAsuh, setShowAllAnakAsuh] = useState(false);
    const [showAllTugasTambahan, setShowAllTugasTambahan] = useState(false);

    // SISWA specific states
    const [waliKelasName, setWaliKelasName] = useState<string | null>(null);
    const [guruAsuhName, setGuruAsuhName] = useState<string | null>(null);
    const [allStudentClasses, setAllStudentClasses] = useState<any[]>([]);
    const [ekskuls, setEkskuls] = useState<any[]>([]);
    const [recentTugas, setRecentTugas] = useState<any[]>([]);

    // Other roles states
    const [adminStats, setAdminStats] = useState<{ guruCount: number; siswaCount: number; orangTuaCount: number; lainnyaCount: number; activeClasses: string[]; sakitToday: number; izinToday: number } | null>(null);
    const [loadingAdminStats, setLoadingAdminStats] = useState(false);


    // Resolve user roles robustly
    const roleStr = user?.role || '';
    const roles = user?.roles || roleStr.split(/[,|]/).map((r: string) => r.trim().toUpperCase()) || [];
    const isSiswa = roles.includes('SISWA');
    const isGuru = roles.includes('GURU');
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const isOrangTua = roles.includes('ORANGTUA') || roles.includes('ORANG_TUA') || roles.includes('WALI');
    const isOtherRole = !isSiswa && !isGuru && !isOrangTua;
    const isTU = roles.includes('TU') || roles.includes('TATA_USAHA');
    const canViewKinerjaGuru = isGuru || isSiswa || isTU || isAdmin;

    useEffect(() => {
        if (isSiswa || isOrangTua) {
            loadSiswaKelas();
            loadGuruAsuh();
            loadPengumuman();
            loadAdminStats();
        } else if (isGuru) {
            if (user?.nip || user?.nama) {
                loadJadwalHariIni();
                loadJadwalPiketHariIni();
                loadGuruJadwalSummary();
                loadGuruPiketSummary();
                loadAnakAsuh();
                loadAnakAsuhKehadiran();
                loadTugasTambahan();
                loadPengumuman();
                loadAdminStats();
            }
        } else {
            // Other roles (Staff, Admin, OP UKS, etc.)
            loadPengumuman();
            loadAdminStats();
        }

        // Di luar percabangan: kartu grafik dirender untuk semua peran (ia ada
        // di db__row2-grid yang tidak dipagari peran), dan datanya agregat
        // se-sekolah sehingga tidak bergantung pada nip/nama pengguna.
        loadChartData();
    }, [user, isSiswa, isGuru, isOrangTua]);

    // Secondary load after class is resolved (SISWA only)
    useEffect(() => {
        if (siswaKelas) {
            loadJadwalHariIni();
            loadJadwalPiketHariIni();
            loadWaliKelas();
            loadAllStudentClasses();
            loadEkskuls();
            loadRecentTugas();
        }
    }, [siswaKelas]);

    // Load ekskul segera setelah siswaData teridentifikasi (tidak tergantung kelas)
    useEffect(() => {
        if (dashboardSummary?.siswaData?.id) {
            loadEkskuls(dashboardSummary.siswaData.id);
        }
    }, [dashboardSummary?.siswaData?.id]);



    // Fireworks Canvas
    useEffect(() => {
        if (!isBirthdayOpen) return;
        const canvas = document.getElementById('fireworks-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;
        let animationId: number;
        const particles: any[] = [];

        const createFirework = (x: number, y: number) => {
            const count = 60;
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 6 + 2;
                particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1,
                    color: `hsl(${Math.random() * 360}, 100%, 60%)`
                });
            }
        };

        const handleResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
        window.addEventListener('resize', handleResize);

        const loop = () => {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(0, 0, w, h);
            if (Math.random() < 0.04) createFirework(Math.random() * w, Math.random() * (h/2));

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05; // gravity
                p.life -= 0.015; // fade speed
                if (p.life <= 0) { particles.splice(i, 1); continue; }
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            animationId = requestAnimationFrame(loop);
        };
        loop();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
        };
    }, [isBirthdayOpen]);

    const loadSiswaKelas = async () => {};;

    const loadJadwalHariIni = async () => {
        if (isSiswa && !siswaKelas) return;
        if (!isSiswa && !user?.nip) return;
        setLoadingJadwal(true);
        try {
            const dayName = getDayName();
            const todayStr = getCurrentDate();

            let url = '';
            if (isSiswa) {
                url = `/api/jadwal?kelas=${encodeURIComponent(siswaKelas!)}&hari=${encodeURIComponent(dayName)}&valid_date=${todayStr}`;
            } else {
                url = `/api/jadwal?nip=${encodeURIComponent(user.nip)}&hari=${encodeURIComponent(dayName)}&valid_date=${todayStr}`;
            }
            const res = await fetch(url);
            if (!res.ok) return;
            const json = await res.json().catch(() => null);

            if (json?.ok && json?.data) {
                const sorted = json.data.sort((a: any, b: any) => (parseInt(a.jam_ke) || 0) - (parseInt(b.jam_ke) || 0));
                setJadwalHariIni(sorted);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingJadwal(false);
        }
    };

    const loadJadwalPiketHariIni = async () => {
        if (isSiswa && !siswaKelas) return;
        if (!isSiswa && !user?.nip) return;
        setLoadingPiket(true);
        try {
            const todayStr = getCurrentDate();
            const hariIni = getDayName();

            let url = '';
            if (isSiswa) {
                url = `/api/settings/jadwal-piket?kelas=${encodeURIComponent(siswaKelas!)}&hari=${encodeURIComponent(hariIni)}&valid_date=${todayStr}`;
            } else {
                url = `/api/settings/jadwal-piket?hari=${encodeURIComponent(hariIni)}&guru=${encodeURIComponent(user.nip)}&valid_date=${todayStr}`;
            }

            const res = await fetch(url);
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (json?.ok && json?.data) {
                setJadwalPiketHariIni(json.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPiket(false);
        }
    };

    // GURU loaders
    const loadGuruJadwalSummary = async () => {
        if (!user?.nip) return;
        try {
            const res = await fetch(`/api/jadwal?nip=${encodeURIComponent(user.nip)}`);
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (json?.ok && json?.data) {
                const uniqueClasses = [...new Set(json.data.map((j: any) => j.kelas).filter(Boolean))] as string[];
                const uniqueDays = [...new Set(json.data.map((j: any) => j.hari).filter(Boolean))] as string[];

                const classOrder: Record<string, number> = { 'X': 1, 'XI': 2, 'XII': 3 };
                const getClassWeight = (cls: string) => {
                    const roman = cls.split(' ')[0];
                    return classOrder[roman] || 99;
                };
                uniqueClasses.sort((a, b) => {
                    const diff = getClassWeight(a) - getClassWeight(b);
                    if (diff !== 0) return diff;
                    return a.localeCompare(b);
                });

                const dayOrder: Record<string, number> = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
                uniqueDays.sort((a, b) => {
                    const weightA = dayOrder[a] || 99;
                    const weightB = dayOrder[b] || 99;
                    return weightA - weightB;
                });

                setGuruJadwalSummary({ classes: uniqueClasses, days: uniqueDays });
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Hari-hari guru kebagian piket pada versi jadwal piket yang sedang berlaku.
    // Tanpa parameter `hari` supaya API mengembalikan seluruh hari sekaligus.
    const loadGuruPiketSummary = async () => {
        if (!user?.nip) return;
        try {
            const todayStr = getCurrentDate();
            const res = await fetch(
                `/api/settings/jadwal-piket?guru=${encodeURIComponent(user.nip)}&valid_date=${todayStr}`
            );
            if (!res.ok) { setGuruPiketDays([]); return; }
            const json = await res.json().catch(() => null);
            if (json?.ok && json?.data) {
                const uniqueDays = [...new Set(json.data.map((p: any) => p.hari).filter(Boolean))] as string[];
                const dayOrder: Record<string, number> = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
                uniqueDays.sort((a, b) => (dayOrder[a] || 99) - (dayOrder[b] || 99));
                setGuruPiketDays(uniqueDays);
            } else {
                setGuruPiketDays([]);
            }
        } catch (e) {
            console.error(e);
            setGuruPiketDays([]);
        }
    };

    const loadAnakAsuh = async () => {};;

    // Kehadiran anak asuh hari ini — sumber: tabel ketidakhadiran
    // (endpoint yang sama dipakai halaman Guru Asuh, sudah difilter tgl_mulai..tgl_selesai)
    const loadAnakAsuhKehadiran = async (overrideNip?: string) => {
        const nip = overrideNip || user?.nip;
        if (!nip) return;
        try {
            const res = await fetch(`/api/ketidakhadiran/log/guru-asuh?nip=${encodeURIComponent(nip)}`);
            if (!res.ok) { setAnakAsuhKehadiran({}); return; }
            const json = await res.json().catch(() => null);
            if (!json?.success || !json?.has_asuhan) { setAnakAsuhKehadiran({}); return; }

            const map: Record<string, { kode: string; keterangan: string }> = {};
            (json.siswa_list || []).forEach((s: any) => {
                // Gunakan active_ketidakhadiran (entri yang sedang aktif SAAT INI):
                // entri yang jamnya sudah lewat tidak ditampilkan → siswa kembali "Hadir".
                // Ini konsisten dengan statistik realtime di DashboardCharts.
                const entries = (s.active_ketidakhadiran && s.active_ketidakhadiran.length > 0)
                    ? s.active_ketidakhadiran
                    : [];
                if (entries.length === 0) {
                    map[s.nisn] = { kode: 'HADIR', keterangan: 'Hadir hari ini' };
                    return;
                }
                // Sakit diprioritaskan bila seorang siswa punya lebih dari satu entri
                const utama = entries.find((e: any) => e.jenis === 'SAKIT') || entries[0];
                map[s.nisn] = {
                    kode: utama.jenis === 'SAKIT' ? 'SAKIT' : 'IZIN',
                    keterangan: [utama.keterangan, utama.periode].filter(Boolean).join(' • '),
                };
            });
            setAnakAsuhKehadiran(map);
        } catch (e) {
            console.error(e);
        }
    };

    const loadTugasTambahan = async () => {};;

    const loadPengumuman = async () => {
        setLoadingPengumuman(true);
        try {
            const queryRole = roles.length > 0 ? `?role=${encodeURIComponent(roles.join(','))}` : '';
            const res = await fetch(`/api/pengumuman${queryRole}`);
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (json?.ok) {
                const list = (json.data || []).slice();
                list.sort((a: any, b: any) => {
                    const aPinned = a.pinned === true || a.pinned === 1 || a.pinned === 'true' || a.pinned === '1';
                    const bPinned = b.pinned === true || b.pinned === 1 || b.pinned === 'true' || b.pinned === '1';
                    if (aPinned && !bPinned) return -1;
                    if (!aPinned && bPinned) return 1;
                    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
                    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
                    return timeB - timeA;
                });
                setPengumuman(list);
            }
        } catch (e) {
            console.error('Error loadPengumuman:', e);
        } finally {
            setLoadingPengumuman(false);
            if (announcementTrackRef.current) {
                announcementTrackRef.current.scrollTo({ left: 0, behavior: 'instant' });
            }
        }
    };

    const loadGuruTugas = async () => {};;

    // SISWA loaders
    const loadWaliKelas = async () => {};;

    const loadGuruAsuh = async () => {};;

    const loadAllStudentClasses = async () => {};;

    const loadEkskuls = async (overrideStudentId?: any) => {
        const studentId = overrideStudentId || dashboardSummary?.siswaData?.id;
        if (!studentId) return;
        try {
            const res = await fetch(`/api/ekskul/siswa?siswa_id=${studentId}&distinct=true`);
            if (!res.ok) { setEkskuls([]); return; }
            const json = await res.json().catch(() => null);
            if (json?.ok && Array.isArray(json.data)) {
                const unique = [];
                const seen = new Set();
                for (const item of json.data) {
                    const key = item.ekskul_id || item.nama_ekskul;
                    if (key && !seen.has(key)) {
                        seen.add(key);
                        unique.push(item);
                    }
                }
                setEkskuls(unique);
                return;
            }
            setEkskuls([]);
        } catch (e) {
            console.error(e);
            setEkskuls([]);
        }
    };

    const loadRecentTugas = async () => {
    if (!siswaKelas || !dashboardSummary?.siswaData?.id) return;
    try {
        const studentId = dashboardSummary.siswaData.id;
        const activePeriods = await getActivePeriods();
        const activeTa = activePeriods[0]?.tahun_ajaran || getAcademicYearFromDate(new Date());
        const res = await fetch(`/api/tugas-siswa?siswaRole=siswa&siswaKelas=${encodeURIComponent(siswaKelas)}&userId=${studentId}&limit=5&tahunAjaran=${encodeURIComponent(activeTa)}`);
        if (!res.ok) { setRecentTugas([]); return; }
        const json = await res.json().catch(() => null);
        if (json?.ok && Array.isArray(json.data)) {
            setRecentTugas(json.data);
            return;
        }
        setRecentTugas([]);
    } catch (e) {
        console.error(e);
        setRecentTugas([]);
    }
 };;

    // Other roles loaders
    const loadAdminStats = async () => {
        setLoadingAdminStats(true);
        try {
            const res = await fetch('/api/admin/dashboard-stats');
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (json?.ok) {
                setAdminStats(json.data);
            }
        } catch (e) {
            console.error('Error loading admin stats:', e);
        } finally {
            setLoadingAdminStats(false);
        }
    };

    const loadChartData = async () => {
        setLoadingCharts(true);
        try {
            const res = await fetch('/api/admin/dashboard-charts');
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (json?.ok) setChartData(json.data);
        } catch (e) {
            console.error('Error loading dashboard charts:', e);
        } finally {
            setLoadingCharts(false);
        }
    };

    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timezone
            });
        } catch {
            return isoString;
        }
    };

    return (
        <div className="db">
            {/* Header Greeting disajikan di Top App Header (<Header>) */}
            {headerExtra}

            {/* 📢 PENGUMUMAN — DESKTOP: daftar banyak pengumuman.
                Carousel hanya menampilkan satu pengumuman sekaligus; di layar
                lebar ruangnya ada, jadi bentuk daftar (5 teratas + "Lainnya",
                tiap butir bisa dibentangkan) dikembalikan seperti sebelumnya.
                Carousel tetap dipakai di mobile, di mana ruang memang sempit. */}
            {/* 📢 PENGUMUMAN — TRACK BERSUSUN KE SAMPING (3 KARTU + 4TH CARD 20% PEEKING) */}
            {(loadingPengumuman || pengumuman.length > 0) && (
                <div className="db__top-announcements">
                    <div className="db__widget-card">
                        <div className="db__widget-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span className="db__widgetIcon" style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Megaphone size={18} />
                                </span>
                                <h3>
                                    Pengumuman
                                </h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {!loadingPengumuman && pengumuman.length > 3 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleScrollAnnouncements('left')}
                                            title="Geser ke kiri"
                                            aria-label="Geser ke kiri"
                                            className="db__announcement-scroll-btn"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleScrollAnnouncements('right')}
                                            title="Geser ke kanan"
                                            aria-label="Geser ke kanan"
                                            className="db__announcement-scroll-btn"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {loadingPengumuman ? (
                            <div className="db__announcements-track">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="db__announcements-item db__announcements-item--skeleton" />
                                ))}
                            </div>
                        ) : (
                            <div ref={announcementTrackRef} className="db__announcements-track">
                                {pengumuman.map((p) => {
                                    const isPinned = p.pinned === true || p.pinned === 1 || p.pinned === 'true' || p.pinned === '1';
                                    const hasContent = p.content && p.content.trim().length > 0;
                                    const plainText = hasContent ? p.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                                    const previewText = plainText.length > 95 ? plainText.slice(0, 95) + '...' : plainText;
                                    const rawCategory = p.category || 'Umum';
                                    const categoryLabel = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).toLowerCase();

                                    return (
                                        <div
                                            key={p.id}
                                            className={`db__announcements-item ${isPinned ? "is-pinned" : ""}`}
                                        >
                                            <div>
                                                <h4 className="db__ann-title">
                                                    {p.title}
                                                </h4>
                                                {hasContent && (
                                                    <p className="db__ann-desc">
                                                        {previewText}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="db__ann-foot">
                                                <span className="db__ann-category">
                                                    {categoryLabel}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedPengumuman(p)}
                                                    className="db__ann-detail-btn"
                                                >
                                                    Detail
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 📝 UJIAN CBT — DAFTAR UJIAN AKTIF, AKAN DATANG, & SELESAI */}
            {(isSiswa || isGuru || isAdmin) && (
                <DashboardExamCard user={user} isSiswa={isSiswa} isGuru={isGuru} isAdmin={isAdmin} />
            )}

            {/* 🏆 KINERJA GURU — RADAR KEDISIPLINAN (JAM KOSONG, PENUGASAN TANPA PENDAMPINGAN, TERLAMBAT) */}
            {canViewKinerjaGuru && (
                <DashboardKinerjaCard />
            )}

            {/* Layout Grid */}
            <div className="db__layout">
                {/* Left Side: Role Specific Widgets */}
                <div className="db__main">
                    <div className="db__roleSection">
                        <div className="db__guruBento">

                            {/* Row 1: Agenda Madrasah + Tugas Tambahan Grid */}
                            <div className="db__top-grid">
                                {/* 1. Agenda 4 Hari & List Agenda Compact (Semua Role) */}
                                <div className="db__widget-card db__agenda-time-card db__area-agenda" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                                    <div className="db__widget-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: 0 }}>
                                            <span className="db__widgetIcon" style={{
                                                width: '38px',
                                                height: '38px',
                                                borderRadius: '12px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Calendar size={18} />
                                            </span>
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                                                Agenda Madrasah
                                            </h3>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                onClick={() => moveAgenda(-1)}
                                                disabled={agendaOffset === 0}
                                                title="Hari sebelumnya"
                                                aria-label="Hari sebelumnya"
                                                className="db__announcement-scroll-btn"
                                                style={{ width: '26px', height: '26px', opacity: agendaOffset === 0 ? 0.35 : 1, cursor: agendaOffset === 0 ? 'not-allowed' : 'pointer' }}
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveAgenda(1)}
                                                title="Hari berikutnya"
                                                aria-label="Hari berikutnya"
                                                className="db__announcement-scroll-btn"
                                                style={{ width: '26px', height: '26px', cursor: 'pointer' }}
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grafik Alur Agenda Terhubung (Connected Flow Track) */}
                                    <div
                                        className="db__agenda-flow-track"
                                        onTouchStart={handleAgendaTouchStart}
                                        onTouchEnd={handleAgendaTouchEnd}
                                    >
                                        {/* Track Line Gradient */}
                                        <div className="db__agenda-track-line" />

                                        {/* Flow Nodes Container */}
                                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {weekDays.map((d) => {
                                                const iso = toSchoolISO(d);
                                                const isToday = iso === todayISO;
                                                const activeDate = selectedAgendaDate || (weekDays[0] ? toSchoolISO(weekDays[0]) : '');
                                                const isSelected = activeDate === iso;
                                                const hasAgenda = agendaDates.has(iso);
                                                const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
                                                const isValidDate = d && !isNaN(d.getTime());
                                                const label = isValidDate ? dayNames[d.getDay()] : '-';

                                                return (
                                                    <button
                                                        key={iso}
                                                        type="button"
                                                        onClick={() => setSelectedAgendaDate(iso)}
                                                        className={`db__agenda-day-btn ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${hasAgenda ? "has-agenda" : ""}`}
                                                        title={`${isValidDate ? d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}${hasAgenda ? ' • ada agenda' : ''}`}
                                                    >
                                                        <span className="db__agenda-day-name">
                                                            {isToday ? 'Hari Ini' : label}
                                                        </span>

                                                        {/* Circle Node */}
                                                        <div className="db__agenda-circle">
                                                            {isValidDate ? d.getDate() : '-'}

                                                            {/* Dot marker for agenda */}
                                                            {hasAgenda && !isToday && !isSelected && (
                                                                <span className="db__agenda-dot-marker db__agenda-dot-marker--agenda" />
                                                            )}
                                                            {isToday && !isSelected && (
                                                                <span className="db__agenda-dot-marker db__agenda-dot-marker--today" />
                                                            )}
                                                        </div>

                                                        <span className="db__agenda-month-name">
                                                            {isValidDate ? d.toLocaleDateString('id-ID', { month: 'short' }) : ''}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Compact Agenda Items List */}
                                    {(() => {
                                        const activeDate = selectedAgendaDate || (weekDays[0] ? toSchoolISO(weekDays[0]) : '');
                                        const displayItems = agendaItemsList.filter((item) => {
                                            const mulai = item.tanggal_mulai ? String(item.tanggal_mulai).slice(0, 10) : '';
                                            const selesai = String(item.tanggal_selesai || item.tanggal_mulai || '').slice(0, 10);
                                            return activeDate >= mulai && activeDate <= selesai;
                                        });

                                        return (
                                            <div className="db__agenda-items-container">
                                                {displayItems.length > 0 ? (
                                                    displayItems.slice(0, 4).map((item) => {
                                                        const tglMulai = item.tanggal_mulai ? String(item.tanggal_mulai).slice(0, 10) : '';
                                                        const itemDate = tglMulai ? new Date(`${tglMulai}T00:00:00`) : null;
                                                        const formattedDate = itemDate && !isNaN(itemDate.getTime())
                                                            ? itemDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                                                            : (tglMulai || '-');
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="db__agenda-item-card"
                                                                style={{
                                                                    borderLeftColor: item.warna || '#3083FF'
                                                                }}
                                                            >
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                                                                        <span className="db__agenda-item-datetime">
                                                                            {formattedDate} {item.waktu_mulai ? `• ${item.waktu_mulai}` : ''}
                                                                        </span>
                                                                        <span className="db__agenda-item-badge">
                                                                            {item.kategori || 'Umum'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="db__agenda-item-title" title={item.judul}>
                                                                        {item.judul}
                                                                    </div>
                                                                    {item.lokasi && (
                                                                        <div className="db__agenda-item-location" title={item.lokasi}>
                                                                            📍 {item.lokasi}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="db__agenda-empty-state">
                                                        <Calendar size={24} style={{ opacity: 0.35, marginBottom: '6px' }} />
                                                        <span>{activeDate === todayISO ? 'Tidak ada agenda hari ini.' : 'Tidak ada agenda pada tanggal ini.'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Footer: Lihat Semua di Pojok Kanan Bawah */}
                                    <div className="db__agenda-footer">
                                        <Link
                                            href="/agenda-madrasah"
                                            className="db__agenda-see-all-link"
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                textDecoration: 'none',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            Lihat Semua
                                        </Link>
                                    </div>
                                </div>

                                {/* 2. Tugas Tambahan (Guru) / Ekstrakurikuler (Siswa, Orang Tua) */}
                                {(isGuru || isSiswa || isOrangTua) && (
                                    <div className="db__widget-card db__area-tugas" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <div className="db__widget-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span className="db__widgetIcon" style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    borderRadius: '12px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {isGuru ? <Briefcase size={18} /> : <Trophy size={18} />}
                                                </span>
                                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {isGuru ? 'Tugas Tambahan' : 'Ekstrakurikuler'}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="db__widget-body" style={{ flex: 1 }}>
                                             {isGuru ? (
                                                 tugasTambahan.length === 0 ? (
                                                     <p className="text-muted text-center py-3">Tidak ada tugas tambahan yang diampu pada tahun ajaran aktif.</p>
                                                 ) : (
                                                     <>
                                                         <div className="db__chip-grid">
                                                             {tugasTambahan.map((t, idx) => (
                                                                 <div key={idx} className={`db__chip ${!showAllTugasTambahan && idx >= 2 ? 'db__mobile-hide-tugas' : ''}`}>
                                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                                         <span
                                                                             style={{
                                                                                 width: '22px',
                                                                                 height: '22px',
                                                                                 borderRadius: '50%',
                                                                                 background: '#EFF6FF',
                                                                                 color: '#3083FF',
                                                                                 border: '1px solid #BFDBFE',
                                                                                 fontSize: '0.725rem',
                                                                                 fontWeight: 700,
                                                                                 display: 'inline-flex',
                                                                                 alignItems: 'center',
                                                                                 justifyContent: 'center',
                                                                                 flexShrink: 0
                                                                             }}
                                                                         >
                                                                             {idx + 1}
                                                                         </span>
                                                                         <span className="db__chip-name">{t.jabatan}</span>
                                                                     </div>
                                                                     {t.keterangan && !t.keterangan.toLowerCase().includes('modul') && (
                                                                         <span className="db__chip-meta">
                                                                             <span className="db__chip-class">
                                                                                 {t.keterangan}
                                                                             </span>
                                                                         </span>
                                                                     )}
                                                                 </div>
                                                             ))}
                                                         </div>
                                                         {!showAllTugasTambahan && tugasTambahan.length > 2 && (
                                                             <button
                                                                 className="db__show-more-link db__mobile-only"
                                                                 onClick={() => setShowAllTugasTambahan(true)}
                                                             >
                                                                 Lainnya
                                                             </button>
                                                         )}
                                                         {showAllTugasTambahan && tugasTambahan.length > 2 && (
                                                             <button
                                                                 className="db__show-more-link db__mobile-only"
                                                                 onClick={() => setShowAllTugasTambahan(false)}
                                                             >
                                                                 Lebih Sedikit
                                                             </button>
                                                         )}
                                                     </>
                                                 )
                                             ) : (
                                                ekskuls.length === 0 ? (
                                                    <p className="text-muted text-center py-3">Tidak ada ekstrakurikuler yang diikuti.</p>
                                                ) : (
                                                    <>
                                                        <div className="db__chip-grid">
                                                            {ekskuls.map((e, idx) => (
                                                                <div key={idx} className={`db__chip ${!showAllTugasTambahan && idx >= 2 ? 'db__mobile-hide-tugas' : ''}`}>
                                                                    <span className="db__chip-name">{e?.nama_ekskul || '-'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {!showAllTugasTambahan && ekskuls.length > 2 && (
                                                            <button
                                                                className="db__show-more-link db__mobile-only"
                                                                onClick={() => setShowAllTugasTambahan(true)}
                                                            >
                                                                Lainnya
                                                            </button>
                                                        )}
                                                        {showAllTugasTambahan && ekskuls.length > 2 && (
                                                            <button
                                                                className="db__show-more-link db__mobile-only"
                                                                onClick={() => setShowAllTugasTambahan(false)}
                                                            >
                                                                Lebih Sedikit
                                                            </button>
                                                        )}
                                                    </>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Row 2: Anak Asuh Hari Ini & 3 Card Grafik Analytics (Sejajar) */}
                            <div className="db__row2-grid">
                                {/* Saudara Asuh / Anak Asuh (Guru, Siswa, Orang Tua) */}
                                {(isGuru || isSiswa || isOrangTua) && (() => {
                                    const hadirCount = anakAsuh.filter(s => (anakAsuhKehadiran[s?.nisn_siswa]?.kode || 'HADIR').toUpperCase() === 'HADIR').length;
                                    const sakitCount = anakAsuh.filter(s => (anakAsuhKehadiran[s?.nisn_siswa]?.kode || '').toUpperCase() === 'SAKIT').length;
                                    const izinCount = anakAsuh.filter(s => (anakAsuhKehadiran[s?.nisn_siswa]?.kode || '').toUpperCase() === 'IZIN').length;

                                    const hasIzin = anakAsuh.some(s => anakAsuhKehadiran[s?.nisn_siswa]?.kode === 'IZIN');
                                    const hasSakit = anakAsuh.some(s => anakAsuhKehadiran[s?.nisn_siswa]?.kode === 'SAKIT');
                                    const blinkType = hasIzin && hasSakit ? 'both' : hasSakit ? 'sakit' : hasIzin ? 'izin' : null;
                                    const titleWidget = isGuru ? 'Anak Asuh' : 'Saudara Asuh';
                                    const blinkTitle = hasIzin && hasSakit ? `Ada ${titleWidget.toLowerCase()} yang Sakit & Izin hari ini` : hasSakit ? `Ada ${titleWidget.toLowerCase()} yang Sakit hari ini` : hasIzin ? `Ada ${titleWidget.toLowerCase()} yang Izin hari ini` : '';

                                    return (
                                        <div className="db__widget-card db__area-anakasuh" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            <div className="db__widget-header flex-between">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span className="db__widgetIcon" style={{
                                                        width: '38px',
                                                        height: '38px',
                                                        borderRadius: '12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <Users size={18} />
                                                    </span>
                                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span>{titleWidget} Hari Ini</span>
                                                        {blinkType && (
                                                            <span
                                                                className={`db__header-blink-dot ${blinkType}`}
                                                                title={blinkTitle}
                                                            />
                                                        )}
                                                    </h3>
                                                </div>
                                                <Link href="/guru-asuh" className="db__goto-btn" title={`Buka halaman ${titleWidget}`}>
                                                    <ChevronsRight size={16} style={{ color: '#3083FF' }} />
                                                </Link>
                                            </div>
                                            <div className="db__widget-body" style={{ flex: 1 }}>
                                                {anakAsuh.length === 0 ? (
                                                    <p className="text-muted text-center py-3">Belum ada {titleWidget.toLowerCase()} yang diplot.</p>
                                                ) : (
                                                    <>
                                                        {!hasIzin && !hasSakit && (
                                                            <div style={{
                                                                padding: '8px 12px',
                                                                marginBottom: '10px',
                                                                background: '#f0fdf4',
                                                                border: '1px solid #bbf7d0',
                                                                borderRadius: '10px',
                                                                fontSize: '0.8rem',
                                                                color: '#166534',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px'
                                                            }}>
                                                                <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                                                                <span>Semua {titleWidget.toLowerCase()} hadir hari ini</span>
                                                            </div>
                                                        )}
                                                        <div className="db__chip-grid">
                                                            {[...anakAsuh].sort((a, b) => {
                                                                const khA = anakAsuhKehadiran[a?.nisn_siswa]?.kode?.toUpperCase() || 'HADIR';
                                                                const khB = anakAsuhKehadiran[b?.nisn_siswa]?.kode?.toUpperCase() || 'HADIR';
                                                                const weightA = khA === 'SAKIT' ? 1 : khA === 'IZIN' ? 2 : 3;
                                                                const weightB = khB === 'SAKIT' ? 1 : khB === 'IZIN' ? 2 : 3;
                                                                if (weightA !== weightB) return weightA - weightB;
                                                                return (a?.nama_siswa || '').localeCompare(b?.nama_siswa || '');
                                                            }).map((s, idx) => {
                                                                const kh = s?.nisn_siswa ? anakAsuhKehadiran[s.nisn_siswa] : undefined;
                                                                const kode = kh?.kode ? kh.kode.toUpperCase() : 'HADIR';
                                                                const khLabel = kode === 'SAKIT' ? 'Sakit'
                                                                    : kode === 'IZIN' ? 'Izin'
                                                                    : 'Hadir';
                                                                return (
                                                                    <div key={idx} className={`db__chip ${kode === 'HADIR' && !showAllAnakAsuh ? 'db__chip-hadir' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                                            {s?.foto_profil ? (
                                                                                <img
                                                                                    src={getProxiedImageUrl(s.foto_profil)}
                                                                                    alt={s?.nama_siswa || ''}
                                                                                    style={{
                                                                                        width: '26px',
                                                                                        height: '26px',
                                                                                        borderRadius: '50%',
                                                                                        objectFit: 'cover',
                                                                                        flexShrink: 0,
                                                                                        border: '1px solid #cbd5e1'
                                                                                    }}
                                                                                    onError={(e) => {
                                                                                        e.currentTarget.style.display = 'none';
                                                                                        const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                                                                                        if (sibling) sibling.style.display = 'inline-flex';
                                                                                    }}
                                                                                />
                                                                            ) : null}
                                                                            <span className="db__avatarFallback"
                                                                                style={{
                                                                                    display: s?.foto_profil ? 'none' : 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    width: '26px',
                                                                                    height: '26px',
                                                                                    borderRadius: '50%',
                                                                                    fontSize: '0.725rem',
                                                                                    fontWeight: 700,
                                                                                    flexShrink: 0,
                                                                                    textTransform: 'uppercase'
                                                                                }}
                                                                            >
                                                                                {s?.nama_siswa ? s.nama_siswa.trim().charAt(0).toUpperCase() : 'S'}
                                                                            </span>
                                                                            <span className="db__chip-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s?.nama_siswa || '-'}</span>
                                                                        </div>
                                                                        <span className="db__chip-meta" style={{ flexShrink: 0 }}>
                                                                            <span
                                                                                className={`db__chip-status is-${kode.toLowerCase()}`}
                                                                                title={kh?.keterangan || khLabel}
                                                                            >
                                                                                {khLabel}
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {!showAllAnakAsuh && anakAsuh.length > 0 && (
                                                            <button
                                                                className="db__show-more-link db__mobile-only"
                                                                onClick={() => setShowAllAnakAsuh(true)}
                                                            >
                                                                Lainnya
                                                            </button>
                                                        )}
                                                        {showAllAnakAsuh && anakAsuh.length > 0 && (
                                                            <button
                                                                className="db__show-more-link db__mobile-only"
                                                                onClick={() => setShowAllAnakAsuh(false)}
                                                            >
                                                                Lebih Sedikit
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Visual Analytics Charts (3 Card Grafik Sejajar) */}
                                <div className="db__charts-wrapper">
                                    {(() => {
                                        const att = (chartData as any)?.attendance || {
                                            hadir: Math.max(0, (chartData?.siswaAktif || adminStats?.siswaCount || 0) - (adminStats?.sakitToday ?? 0) - (adminStats?.izinToday ?? 0)),
                                            sakit: adminStats?.sakitToday ?? 0,
                                            izin: adminStats?.izinToday ?? 0,
                                            alpa: 0,
                                            total: chartData?.siswaAktif || adminStats?.siswaCount || 0,
                                        };
                                        return (
                                            <DashboardCharts
                                                loading={loadingCharts}
                                                attendance={att}
                                                jurnalStats={chartData?.jurnalStats}
                                                weeklyTrends={chartData?.weeklyTrends}
                                            />
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Row 3: Kehadiran (Khusus Other Roles) */}
                            {isOtherRole && (
                                <div className="db__widget-card db__area-kehadiran">
                                    <div className="db__widget-header flex-between">
                                        <h3>
                                            <UserX size={18} style={{ color: '#3083FF', display: 'inline', verticalAlign: 'middle' }} />
                                            <span>Kehadiran Hari Ini</span>
                                        </h3>
                                    </div>
                                    <div className="db__widget-body">
                                        <div className="db__stats-grid db__stats-grid--3x" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                            <div className="db__stat-box" style={{ background: '#E0ECFF', borderColor: '#E1E2E9', color: '#112E59' }}>
                                                <span className="db__stat-num" style={{ color: '#3083FF' }}>{loadingAdminStats ? '-' : Math.max(0, (adminStats?.siswaCount || 0) - ((adminStats?.sakitToday || 0) + (adminStats?.izinToday || 0)))}</span>
                                                <span className="db__stat-lbl">Hadir</span>
                                            </div>
                                            <div className="db__stat-box warning" style={{ background: '#fffbeb', borderColor: '#fef3c7', color: '#b45309' }}>
                                                <span className="db__stat-num">{loadingAdminStats ? '-' : adminStats?.izinToday || 0}</span>
                                                <span className="db__stat-lbl">Izin</span>
                                            </div>
                                            <div className="db__stat-box danger" style={{ background: '#fef2f2', borderColor: '#fee2e2', color: '#b91c1c' }}>
                                                <span className="db__stat-num">{loadingAdminStats ? '-' : adminStats?.sakitToday || 0}</span>
                                                <span className="db__stat-lbl">Sakit</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <style jsx>{`
                .db {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    font-family: 'Poppins', sans-serif;
                    color: #112E59;
                    animation: fadeUp 0.4s ease-out;
                }

                .db__layout, .db > :not(.db__hero) {
                    width: 100%;
                    max-width: 1600px;
                    margin: 0 auto;
                    padding: 0;
                }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .db__roleSection {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                /* Bento guru: agenda hari ini jadi pita penuh di atas (paling
                   sering dilihat), Pengumuman jadi kolom kiri yang tinggi
                   (info terbanyak), Anak Asuh & Tugas Tambahan bertumpuk di
                   kanan (ringkas, sudah dalam bentuk chip). Satu kolom di
                   mobile mengikuti urutan DOM ini apa adanya. */
                .db__guruBento {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .db__top-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 14px;
                }
                .db__row2-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 14px;
                    align-items: start;
                }
                .db__charts-wrapper :global(.db-charts-grid) {
                    margin-bottom: 0 !important;
                }
                @media (min-width: 768px) {
                    .db__guruBento {
                        gap: 14px;
                    }
                    .db__top-grid {
                        grid-template-columns: 1fr 1fr;
                        gap: 14px;
                    }
                    .db__row2-grid {
                        grid-template-columns: 1fr 1fr;
                        gap: 14px;
                    }

                    /* Align Hero Card with the standard Header position */
                    .db__hero {
                        margin: -16px -16px 0 -16px !important;
                        border-radius: 20px !important;
                        position: sticky !important;
                        top: 0 !important;
                        z-index: 50 !important;
                    }
                    .db__layout {
                        padding-top: 0;
                    }
                }

                /* Hero greeting card */
                .db__hero {
                    position: relative;
                    background: #3083FF;
                    color: white;
                    padding: 32px 36px;
                    border-radius: 20px 20px 24px 24px;
                    margin: 0;
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    overflow: visible;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: none;
                }
                .db__heroActions {
                    position: absolute;
                    top: 20px;
                    right: 24px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    z-index: 2;
                }
                .db__heroActions :global(.notification-wrapper) {
                    position: relative;
                }
                .db__heroActions :global(.header-icon-btn),
                .db__heroThemeBtn {
                    width: 34px;
                    height: 34px;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.18);
                    border: 1px solid rgba(255, 255, 255, 0.35);
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    margin-right: 0;
                    transition: background 0.2s ease;
                }
                .db__heroActions :global(.header-icon-btn:hover),
                .db__heroThemeBtn:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                .db__heroIdentity {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                    z-index: 1;
                }
                .db__heroAvatarGroup {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    flex-shrink: 0;
                }
                .db__heroAvatar {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 76px;
                    height: 76px;
                    flex-shrink: 0;
                    border-radius: 50%;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.18);
                    border: 2px solid rgba(255, 255, 255, 0.4);
                    color: #ffffff;
                }
                .db__heroAvatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .db__heroGreeting {
                    display: block;
                    font-size: 0.78rem;
                    font-weight: 600;
                    line-height: 1.1;
                    opacity: 0.85;
                    margin: 0 0 1px;
                }
                :global(.dark) .db__heroAvatar {
                    background: rgba(26, 115, 232, 0.2) !important;
                    border-color: rgba(96, 165, 250, 0.5) !important;
                }
                :global(.dark) .db__hero {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 0 0 24px 24px !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
                }
                :global(.dark) .db__heroTitle {
                    background: linear-gradient(90deg, #1d6bf3 0%, #3083FF 30%, #60a5fa 70%, #E0ECFF 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                    display: inline-block;
                }
                :global(.dark) .db__kelasBadge {
                    background: #e2e8f0 !important;
                    color: #0f172a !important;
                    font-weight: 800 !important;
                    border-radius: 6px !important;
                    border: none !important;
                }
                .db__hero:hover {
                    /* Removed transform */
                }
                .db__hero::before {
                    display: none !important;
                }
                /* heroIdentity pakai align-items: flex-start (bukan center) karena
                   .db__heroAvatarGroup lebih tinggi dari foto sendiri (ada badge jam
                   di bawahnya) — kalau center, teks akan sejajar dengan titik tengah
                   foto+badge, bukan dengan foto saja. margin-top di sini menggeser
                   teks turun supaya pusatnya pas sejajar dengan pusat FOTO. */
                .db__heroContent { z-index: 1; display: flex; flex-direction: column; margin-top: 14px; }
                .db__heroTitle {
                    font-size: 1.8rem;
                    font-weight: 800;
                    line-height: 1.15;
                    margin: 0;
                    letter-spacing: -0.02em;
                }
                .db__heroSub {
                    font-size: 0.9rem;
                    opacity: 0.95;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .db__kelasBadge {
                    background: rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(8px);
                    padding: 4px 12px;
                    border-radius: 6px;
                    font-weight: 700;
                    border: 1px solid rgba(255,255,255,0.3);
                }
                .db__heroClock {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    background: rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(8px);
                    padding: 2px 7px;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    font-size: 0.62rem;
                    white-space: nowrap;
                }
                .db__heroClockVal {
                    font-weight: 800;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0.2px;
                }
                .db__heroIcon {
                    font-size: 4rem;
                    opacity: 0.2;
                    animation: float 4s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* Layout */
                .db__layout {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    width: 100%;
                }
                .db__main {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }


                /* Widgets */
                .db__top-announcements {
                    width: 100%;
                }
                .db__widget-card {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 16px;
                    padding: 16px 18px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02);
                    color: var(--n-ink);
                    transition: border-color 0.25s ease, box-shadow 0.25s ease;
                }
                .db__widget-card:hover {
                    box-shadow: 0 12px 32px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03);
                    border-color: rgba(99, 102, 241, 0.3);
                }
                :global(.dark) .db__widget-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }
                :global(.dark) .db__widget-card:hover {
                    border-color: #60a5fa !important;
                    box-shadow: 0 8px 28px rgba(26, 115, 232, 0.3) !important;
                    transform: none !important;
                }
                .db__widgetIcon {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    background: var(--n-soft, #E0ECFF) !important;
                    color: var(--n-primary, #3083FF) !important;
                }
                :global(.dark) .db__widgetIcon {
                    background: var(--n-soft, #162a4d) !important;
                    color: var(--n-primary, #3083FF) !important;
                }
                .db__widget-row {
                    display: flex;
                    gap: 12px;
                    width: 100%;
                }
                .db__widget-card.half {
                    flex: 1 1 0px;
                    min-width: 0;
                    width: 100%;
                    box-sizing: border-box;
                }
                /* Baris jam: dua kartu berdampingan — kiri persegi berisi waktu,
                /* Kartu gabungan waktu (atas) + agenda sepekan (bawah) */
                .db__agenda-time-card {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    justify-content: center;
                    gap: 12px;
                    padding: 18px 20px;
                    background: #FFFFFF;
                    border: 1px solid #E1E2E9;
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
                    box-sizing: border-box;
                    transition: box-shadow 0.25s ease, border-color 0.25s ease;
                }
                .db__agenda-time-card:hover {
                    border-color: #bfdbfe;
                    box-shadow: 0 10px 28px rgba(17, 46, 89, 0.06);
                }
                .db__agenda-time-card .db__widget-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    border-bottom: none;
                    padding-bottom: 4px;
                    margin-bottom: 8px;
                }
                .db__agenda-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .db__week-strip {
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 8px;
                }
                /* Kotak hari memakai :global() karena styled-jsx tidak men-scope
                   className milik komponen <Link> */
                .db__week-strip :global(.db__day-cell) {
                    position: relative;
                    min-height: 74px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                    padding: 12px 4px 10px;
                    border-radius: 14px;
                    background: #F4F8FF;
                    border: 1px solid #E0ECFF;
                    text-decoration: none;
                    color: #112E59;
                    transition: all 0.2s ease;
                }
                .db__week-strip :global(.db__day-cell:hover) {
                    background: #E0ECFF;
                    border-color: #3083FF;
                    transform: translateY(-2px);
                }
                .db__week-strip :global(.db__day-name) {
                    font-size: 0.65rem;
                    font-weight: 700;
                    white-space: nowrap;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    line-height: 1;
                    opacity: 0.65;
                }
                .db__week-strip :global(.db__day-num) {
                    font-size: 1.22rem;
                    font-weight: 800;
                    line-height: 1.1;
                    font-variant-numeric: tabular-nums;
                }
                .db__week-strip :global(.db__day-month) {
                    font-size: 0.62rem;
                    font-weight: 600;
                    opacity: 0.55;
                    line-height: 1;
                }
                .db__week-strip :global(.db__day-cell.is-today) {
                    background: #3083FF;
                    border-color: #3083FF;
                    color: #FFFFFF;
                    box-shadow: 0 4px 14px rgba(48, 131, 255, 0.28);
                }
                .db__week-strip :global(.db__day-cell.is-today:hover) {
                    background: #2472e8;
                }
                .db__week-strip :global(.db__day-cell.is-today .db__day-name),
                .db__week-strip :global(.db__day-cell.is-today .db__day-month) {
                    opacity: 0.9;
                }
                .db__week-strip :global(.db__day-dot) {
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #3083FF;
                }
                .db__week-strip :global(.db__day-cell.is-today .db__day-dot) {
                    background: #FFFFFF;
                }
                :global(.dark) .db__agenda-time-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }
                :global(.dark .db__day-cell) {
                    background: rgba(26, 115, 232, 0.12) !important;
                    border-color: rgba(37, 99, 235, 0.35) !important;
                    color: #E0ECFF !important;
                }
                :global(.dark .db__day-cell.is-today) {
                    background: #1a73e8 !important;
                    border-color: #1a73e8 !important;
                    color: #FFFFFF !important;
                }

                /* Agenda Madrasah Flow Track */
                .db__agenda-flow-track {
                    position: relative;
                    padding: 12px 4px 8px 4px;
                    margin-bottom: 12px;
                    -webkit-user-select: none;
                    user-select: none;
                    -webkit-touch-callout: none;
                }
                .db__agenda-track-line {
                    position: absolute;
                    top: 50%;
                    left: 24px;
                    right: 24px;
                    height: 4px;
                    background: linear-gradient(90deg, #3083FF 0%, #6366f1 50%, #cbd5e1 100%);
                    border-radius: 999px;
                    transform: translateY(-50%);
                    z-index: 0;
                }
                :global(.dark) .db__agenda-track-line {
                    background: linear-gradient(90deg, #1a73e8 0%, #4f46e5 50%, rgba(59, 130, 246, 0.25) 100%) !important;
                }
                .db__agenda-day-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: none;
                    border: none;
                    outline: none !important;
                    box-shadow: none !important;
                    padding: 0;
                    cursor: pointer;
                    position: relative;
                    -webkit-appearance: none !important;
                    appearance: none !important;
                    -webkit-tap-highlight-color: transparent !important;
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    user-select: none !important;
                }
                .db__agenda-day-btn:focus,
                .db__agenda-day-btn:focus-visible,
                .db__agenda-day-btn:active {
                    outline: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    -webkit-tap-highlight-color: transparent !important;
                }
                .db__agenda-day-btn::-moz-focus-inner {
                    border: 0 !important;
                }
                :global(.dark) .db__agenda-day-btn,
                :global(.dark) .db__agenda-day-btn:focus,
                :global(.dark) .db__agenda-day-btn:focus-visible,
                :global(.dark) .db__agenda-day-btn:active {
                    outline: none !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .db__agenda-day-name {
                    font-size: 0.7rem;
                    font-weight: 500;
                    color: #94a3b8;
                    margin-bottom: 4px;
                }
                .db__agenda-day-btn.is-today .db__agenda-day-name {
                    color: #3083FF;
                    font-weight: 700;
                }
                .db__agenda-day-btn.is-selected .db__agenda-day-name {
                    color: #1d4ed8;
                    font-weight: 700;
                }
                :global(.dark) .db__agenda-day-btn.is-today .db__agenda-day-name,
                :global(.dark) .db__agenda-day-btn.is-selected .db__agenda-day-name {
                    color: #60a5fa !important;
                }
                .db__agenda-circle {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #ffffff;
                    color: #64748b;
                    border: 2px solid #cbd5e1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.75rem;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    position: relative;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    -webkit-transform: translateZ(0);
                    transform: translateZ(0);
                    isolation: isolate;
                }
                .db__agenda-day-btn.has-agenda .db__agenda-circle {
                    border-color: #3083FF;
                    color: #3083FF;
                }
                .db__agenda-day-btn.is-today .db__agenda-circle {
                    width: 38px;
                    height: 38px;
                    font-size: 0.85rem;
                    background: linear-gradient(135deg, #3083FF, #4f46e5);
                    color: #ffffff;
                    border: 3px solid #e0f2fe;
                    box-shadow: 0 4px 12px rgba(48, 131, 255, 0.35);
                }
                .db__agenda-day-btn.is-selected .db__agenda-circle {
                    width: 38px;
                    height: 38px;
                    font-size: 0.85rem;
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: #ffffff;
                    border: 3px solid #bfdbfe;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3), 0 4px 12px rgba(37, 99, 235, 0.35);
                    transform: scale(1.08) translateZ(0);
                    -webkit-transform: scale(1.08) translateZ(0);
                    -webkit-mask-image: -webkit-radial-gradient(white, black);
                }
                .db__agenda-dot-marker {
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    border-radius: 50%;
                    border: 2px solid #ffffff;
                }
                .db__agenda-dot-marker--agenda {
                    width: 8px;
                    height: 8px;
                    background-color: #3083FF;
                }
                .db__agenda-dot-marker--today {
                    width: 10px;
                    height: 10px;
                    background-color: #10b981;
                }
                .db__agenda-month-name {
                    font-size: 0.65rem;
                    color: #94a3b8;
                    margin-top: 4px;
                    font-weight: 400;
                }
                .db__agenda-day-btn.is-today .db__agenda-month-name {
                    color: #3083FF;
                    font-weight: 600;
                }
                .db__agenda-day-btn.is-selected .db__agenda-month-name {
                    color: #1d4ed8;
                    font-weight: 600;
                }
                :global(.dark) .db__agenda-day-btn.is-today .db__agenda-month-name,
                :global(.dark) .db__agenda-day-btn.is-selected .db__agenda-month-name {
                    color: #60a5fa !important;
                }

                /* Dark Mode untuk Lingkaran & Elemen Agenda Madrasah */
                :global(.dark) .db__agenda-circle {
                    background: #0b1329 !important;
                    border: 2px solid rgba(59, 130, 246, 0.45) !important;
                    color: #cbd5e1 !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
                }
                .db__agenda-day-btn:hover .db__agenda-circle {
                    background: #E0ECFF;
                    border-color: #3083FF;
                    color: #1d4ed8;
                }
                :global(.dark) .db__agenda-day-btn:hover .db__agenda-circle {
                    background: #162a4d !important;
                    border-color: #60a5fa !important;
                    color: #ffffff !important;
                }
                :global(.dark) .db__agenda-day-btn.has-agenda .db__agenda-circle {
                    background: #0b1329 !important;
                    border-color: #3b82f6 !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .db__agenda-day-btn.is-today .db__agenda-circle {
                    background: linear-gradient(135deg, #1d6bf3, #4338ca) !important;
                    border-color: rgba(96, 165, 250, 0.6) !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 16px rgba(48, 131, 255, 0.5) !important;
                }
                :global(.dark) .db__agenda-day-btn.is-selected .db__agenda-circle {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
                    border-color: #60a5fa !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.4), 0 0 20px rgba(37, 99, 235, 0.6) !important;
                    transform: scale(1.08) translateZ(0) !important;
                    -webkit-transform: scale(1.08) translateZ(0) !important;
                    -webkit-mask-image: -webkit-radial-gradient(white, black) !important;
                }
                :global(.dark) .db__agenda-dot-marker {
                    border-color: #0b1329 !important;
                }

                /* Agenda list items */
                .db__agenda-items-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding-top: 8px;
                    border-top: 1px solid #f1f5f9;
                    flex: 1 1 auto;
                    min-height: 195px;
                    max-height: 245px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
                }
                .db__agenda-items-container::-webkit-scrollbar {
                    width: 4px;
                }
                .db__agenda-items-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .db__agenda-items-container::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.4);
                    border-radius: 4px;
                }
                .db__agenda-items-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(148, 163, 184, 0.7);
                }
                :global(.dark) .db__agenda-items-container {
                    border-top-color: rgba(37, 99, 235, 0.25) !important;
                    scrollbar-color: rgba(148, 163, 184, 0.25) transparent;
                }
                :global(.dark) .db__agenda-items-container::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.25);
                }
                .db__agenda-empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    min-height: 175px;
                    padding: 16px 8px;
                    color: #94a3b8;
                    font-size: 0.8rem;
                    text-align: center;
                }
                :global(.dark) .db__agenda-empty-state {
                    color: #64748b;
                }
                .db__agenda-item-card {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 8px 10px;
                    border-radius: 8px;
                    background: #f8fafc;
                    border-left-width: 4px;
                    border-left-style: solid;
                    box-sizing: border-box;
                    width: 100%;
                    min-width: 0;
                    flex-shrink: 0;
                    transition: all 0.2s ease;
                }
                :global(.dark) .db__agenda-item-card {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border-top: 1px solid rgba(37, 99, 235, 0.2);
                    border-right: 1px solid rgba(37, 99, 235, 0.2);
                    border-bottom: 1px solid rgba(37, 99, 235, 0.2);
                }
                .db__agenda-item-datetime {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: #3083FF;
                }
                :global(.dark) .db__agenda-item-datetime {
                    color: #60a5fa !important;
                }
                .db__agenda-item-badge {
                    font-size: 0.65rem;
                    background: #e0f2fe;
                    color: #0369a1;
                    padding: 1px 6px;
                    border-radius: 4px;
                    font-weight: 500;
                }
                :global(.dark) .db__agenda-item-badge {
                    background: rgba(48, 131, 255, 0.2) !important;
                    color: #93c5fd !important;
                }
                .db__agenda-item-title {
                    font-size: 0.825rem;
                    font-weight: 600;
                    color: #1e293b;
                    line-height: 1.35;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    white-space: normal;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                :global(.dark) .db__agenda-item-title {
                    color: #f1f5f9 !important;
                }
                .db__agenda-item-location {
                    font-size: 0.725rem;
                    color: #64748b;
                    margin-top: 2px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                :global(.dark) .db__agenda-item-location {
                    color: #94a3b8 !important;
                }
                .db__agenda-footer {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    margin-top: auto;
                    padding-top: 8px;
                    width: 100%;
                }
                :global(.db__agenda-see-all-link) {
                    font-size: 0.75rem !important;
                    font-weight: 600 !important;
                    color: #3083FF !important;
                    text-decoration: none !important;
                    display: inline-block;
                    transition: color 0.15s ease;
                }
                :global(.db__agenda-see-all-link:hover) {
                    color: #1d4ed8 !important;
                    text-decoration: underline !important;
                }
                :global(.dark .db__agenda-see-all-link) {
                    color: #60a5fa !important;
                }
                :global(.dark .db__agenda-see-all-link:hover) {
                    color: #93c5fd !important;
                }
                .db__widget-header {
                    border-bottom: 1px solid var(--n-border);
                    padding-bottom: 10px;
                    margin-bottom: 12px;
                }
                :global(.dark) .db__widget-header {
                    border-bottom-color: rgba(37, 99, 235, 0.25) !important;
                }
                .db__widget-header.flex-between {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .db__widget-header h3 {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    letter-spacing: -0.01em;
                }
                :global(.dark) .db__widget-header h3 {
                    background: none !important;
                    -webkit-background-clip: initial !important;
                    -webkit-text-fill-color: #60a5fa !important;
                    color: #60a5fa !important;
                }
                .db__widget-header h3 i {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    border-radius: 6px;
                    background: linear-gradient(135deg, #eff6ff, #E0ECFF);
                    color: #3083FF;
                    border: 1px solid #bfdbfe;
                    font-size: 1.25rem;
                }
                .db__widget-header h3 i.text-primary {
                    color: #3083FF !important;
                    background: linear-gradient(135deg, #eff6ff, #E0ECFF) !important;
                }
                :global(.dark) .db__widget-header h3 i {
                    -webkit-text-fill-color: #60a5fa !important;
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                .db__widget-header h3 i.db__icon-announcement {
                    color: #e11d48 !important;
                    background: linear-gradient(135deg, #eff6ff, #E0ECFF) !important;
                    border: 1px solid #bfdbfe !important;
                }
                :global(.dark) .db__widget-header h3 i.db__icon-announcement {
                    -webkit-text-fill-color: #fb7185 !important;
                    color: #fb7185 !important;
                    background: rgba(225, 29, 72, 0.15) !important;
                    border: 1px solid rgba(225, 29, 72, 0.35) !important;
                }

                .db__announcements-track {
                    display: flex;
                    gap: 14px;
                    overflow-x: auto;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                    padding-bottom: 4px;
                    width: 100%;
                }
                .db__announcements-track::-webkit-scrollbar {
                    display: none;
                }
                .db__announcements-item {
                    flex: 0 0 calc((100% - 28px) / 3.10);
                    scroll-snap-align: start;
                    box-sizing: border-box;
                    background: #f8fafc;
                    border: 1px solid #93c5fd;
                    border-radius: 12px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    min-height: 106px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
                    transition: all 0.2s ease;
                }
                @media (max-width: 767.98px) {
                    .db__announcements-item {
                        flex: 0 0 calc((100% - 14px) / 1.25) !important;
                    }
                }
                .db__announcements-item.is-pinned {
                    background: linear-gradient(135deg, #4f46e5 0%, #3083FF 100%) !important;
                    border: none !important;
                    box-shadow: 0 4px 14px rgba(48, 131, 255, 0.25) !important;
                }
                .db__ann-title {
                    font-size: 0.88rem;
                    font-weight: 700;
                    margin: 0 0 4px 0;
                    color: #1e293b;
                    line-height: 1.3;
                }
                .db__ann-desc {
                    font-size: 0.76rem;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.4;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .db__ann-foot {
                    margin-top: 8px;
                    padding-top: 6px;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .db__ann-category {
                    color: #64748b;
                    font-size: 0.78rem;
                    font-weight: 500;
                }
                .db__ann-detail-btn {
                    background: none;
                    border: none;
                    padding: 0;
                    border-radius: 0;
                    color: #3083FF;
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .db__ann-detail-btn:hover {
                    color: #1d4ed8;
                    text-decoration: underline;
                }
                .db__announcements-item.is-pinned .db__ann-title {
                    color: #ffffff !important;
                }
                .db__announcements-item.is-pinned .db__ann-desc {
                    color: rgba(255, 255, 255, 0.9) !important;
                }
                .db__announcements-item.is-pinned .db__ann-foot {
                    border-top-color: rgba(255, 255, 255, 0.2) !important;
                }
                .db__announcements-item.is-pinned .db__ann-category {
                    color: rgba(255, 255, 255, 0.85) !important;
                }
                .db__announcements-item.is-pinned .db__ann-detail-btn {
                    background: rgba(255, 255, 255, 0.25);
                    border: none;
                    padding: 4px 12px;
                    border-radius: 8px;
                    color: #ffffff !important;
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .db__announcements-item.is-pinned .db__ann-detail-btn:hover {
                    background: rgba(255, 255, 255, 0.35);
                    text-decoration: none;
                }
                .db__announcements-item--skeleton {
                    height: 140px;
                    border-radius: 12px;
                    background: #f1f5f9;
                    animation: pulse 1.5s infinite;
                    padding: 16px;
                }

                /* Dark mode untuk kartu pengumuman */
                :global(.dark) .db__announcements-item:not(.is-pinned) {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border: 1px solid rgba(37, 99, 235, 0.4) !important;
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45) !important;
                }
                :global(.dark) .db__announcements-item:not(.is-pinned):hover {
                    background: rgba(26, 115, 232, 0.16) !important;
                    border-color: rgba(96, 165, 250, 0.55) !important;
                }
                :global(.dark) .db__announcements-item:not(.is-pinned) .db__ann-title {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .db__announcements-item:not(.is-pinned) .db__ann-desc {
                    color: #94a3b8 !important;
                }
                :global(.dark) .db__announcements-item:not(.is-pinned) .db__ann-foot {
                    border-top-color: rgba(37, 99, 235, 0.25) !important;
                }
                :global(.dark) .db__announcements-item:not(.is-pinned) .db__ann-category {
                    color: #60a5fa !important;
                }
                :global(.dark) .db__announcements-item:not(.is-pinned) .db__ann-detail-btn {
                    color: #60a5fa !important;
                }
                :global(.dark) .db__announcements-item:not(.is-pinned) .db__ann-detail-btn:hover {
                    color: #93c5fd !important;
                }
                :global(.dark) .db__announcements-item--skeleton {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border: 1px solid rgba(37, 99, 235, 0.25) !important;
                }

                /* Tombol aksi/navigasi widget */
                .db__goto-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    flex-shrink: 0;
                    border-radius: 8px;
                    color: var(--n-primary, #3083FF) !important;
                    background: linear-gradient(135deg, #eff6ff, #E0ECFF);
                    border: 1px solid #bfdbfe;
                    text-decoration: none;
                    font-size: 0.95rem;
                    outline: none !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .db__goto-btn:focus,
                .db__goto-btn:focus-visible {
                    outline: none !important;
                }
                .db__goto-btn i {
                    color: var(--n-primary, #3083FF) !important;
                    font-size: 0.95rem;
                }
                .db__goto-btn:hover {
                    background: var(--n-primary, #3083FF) !important;
                    color: #ffffff !important;
                    border-color: var(--n-primary, #3083FF) !important;
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 4px 12px rgba(0, 56, 168, 0.2);
                }
                .db__goto-btn:hover i {
                    color: #ffffff !important;
                }
                :global(.dark) .db__goto-btn {
                    background: #1a73e8 !important;
                    color: #ffffff !important;
                    border: 1px solid #1a73e8 !important;
                    border-radius: 9999px !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important;
                    outline: none !important;
                }
                :global(.dark) .db__goto-btn:focus,
                :global(.dark) .db__goto-btn:focus-visible {
                    outline: none !important;
                }
                :global(.dark) .db__goto-btn i {
                    color: #ffffff !important;
                }
                :global(.dark) .db__goto-btn:hover {
                    background: #3083FF !important;
                    box-shadow: 0 0 22px rgba(37, 99, 235, 0.7) !important;
                    transform: translateY(-2px) scale(1.08) !important;
                }

                /* Tombol Scroll Pengumuman (Kiri / Kanan) */
                .db__announcement-scroll-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 1px solid #E2E8F0;
                    background: #F8FAFC;
                    color: #475569;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    outline: none !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .db__announcement-scroll-btn:focus,
                .db__announcement-scroll-btn:focus-visible {
                    outline: none !important;
                }
                .db__announcement-scroll-btn:hover {
                    background: #E0ECFF;
                    color: #2563eb;
                    border-color: #BFDBFE;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
                }
                .db__announcement-scroll-btn:active {
                    background: #2563eb;
                    color: #ffffff;
                    border-color: #1d4ed8;
                    transform: scale(0.92);
                    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
                }
                :global(.dark) .db__announcement-scroll-btn {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.12);
                    color: #cbd5e1;
                }
                :global(.dark) .db__announcement-scroll-btn:hover {
                    background: rgba(48, 131, 255, 0.2);
                    color: #60a5fa;
                    border-color: rgba(96, 165, 250, 0.4);
                }
                :global(.dark) .db__announcement-scroll-btn:active {
                    background: #3083FF;
                    color: #ffffff;
                    border-color: #2563eb;
                }
                :global(.dark) .db__goto-btn:hover i {
                    color: #ffffff !important;
                }

                /* Info Grid (Guru) */
                .db__info-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }
                .db__info-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px dashed var(--n-border);
                    padding: 12px 0;
                    min-height: 44px;
                    box-sizing: border-box;
                }
                :global(.dark) .db__info-item {
                    border-bottom: 1px dashed rgba(59, 130, 246, 0.3) !important;
                }
                .db__info-item:last-child {
                    border-bottom: none !important;
                    padding-bottom: 0;
                }
                .db__info-item:first-child {
                    padding-top: 0;
                }
                .db__info-label {
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    font-weight: 600;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    line-height: 1.2;
                }
                :global(.dark) .db__info-label {
                    color: #cbd5e1 !important;
                }
                .db__info-val {
                    font-size: 0.72rem;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    color: var(--n-ink);
                    background: var(--n-soft);
                    padding: 4px 10px;
                    border-radius: 8px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 64px;
                    text-align: center;
                    box-sizing: border-box;
                    line-height: 1.2;
                }
                /* Teks "tidak ada jadwal" bukan badge — tampil ringan sebagai keterangan */
                .db__info-empty {
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--n-muted);
                    font-style: italic;
                    display: flex;
                    align-items: center;
                    line-height: 1.2;
                }
                :global(.dark) .db__info-empty {
                    color: #94a3b8 !important;
                }
                .db__info-item--badges {
                    align-items: center;
                }
                .db__info-item--badges .db__info-label {
                    margin: 0;
                }
                .db__info-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    justify-content: flex-end;
                    align-items: center;
                    flex: 1;
                    padding-left: 12px;
                }
                .db__badge-class {
                    background: rgba(0, 56, 168, 0.08);
                    color: var(--n-primary, #3083FF);
                    border: 1px solid rgba(0, 56, 168, 0.2);
                }
                :global(.dark) .db__badge-class {
                    background: rgba(0, 56, 168, 0.2);
                    color: #60a5fa;
                    border-color: rgba(59, 130, 246, 0.35);
                }
                .db__badge-day {
                    background: #E0ECFF;
                    color: #112E59;
                    border: 1px solid #bfdbfe;
                }
                :global(.dark) .db__badge-day {
                    background: rgba(59, 130, 246, 0.18);
                    color: #E0ECFF;
                    border-color: rgba(59, 130, 246, 0.35);
                }
                .db__badge-piket {
                    background: #cffafe;
                    color: #0e7490;
                    border: 1px solid #a5f3fc;
                }
                :global(.dark) .db__badge-piket {
                    background: rgba(6, 182, 212, 0.18);
                    color: #67e8f9;
                    border-color: rgba(6, 182, 212, 0.35);
                }

                /* Stats Grid (Guru) */
                .db__stats-grid {
                    display: flex;
                    gap: 16px;
                    width: 100%;
                }
                /* Kartu Pengguna: 4 kolom di desktop, 2 kolom di mobile */
                .db__stats-grid.db__stats-grid--2x2 {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                }
                .db__stats-grid--2x2 .db__stat-box {
                    min-height: 86px;
                    padding: 14px 10px;
                    border-radius: 16px;
                    gap: 2px;
                }
                .db__stats-grid--2x2 .db__stat-num {
                    font-size: 1.75rem;
                    line-height: 1.1;
                    letter-spacing: -0.5px;
                }
                .db__stats-grid--2x2 .db__stat-lbl {
                    font-size: 0.66rem;
                    letter-spacing: 0.06em;
                    opacity: 0.75;
                }
                .db__stat-box {
                    flex: 1 1 0px;
                    min-width: 0;
                    width: 100%;
                    background: linear-gradient(145deg, #eff6ff 0%, #E0ECFF 100%);
                    border: 1px solid #bfdbfe;
                    border-radius: 12px;
                    padding: 16px 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    text-align: center;
                    transition: transform 0.2s;
                    box-sizing: border-box;
                }
                .db__stat-box:hover {
                    transform: translateY(-2px);
                }
                .db__stat-box.danger {
                    background: linear-gradient(135deg, #eff6ff 0%, #ffe4e6 50%, #fee2e2 100%);
                    border-color: #fecdd3;
                }
                .db__stat-box.warning {
                    background: linear-gradient(145deg, #ecfeff 0%, #cffafe 100%);
                    border-color: #a5f3fc;
                }
                :global(.dark) .db__stat-box {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                :global(.dark) .db__stat-box.danger {
                    background: linear-gradient(135deg, #0b1329 0%, rgba(225, 29, 72, 0.15) 100%) !important;
                    border-color: rgba(244, 63, 94, 0.5) !important;
                }
                :global(.dark) .db__stat-box.warning {
                    background: #0b1329 !important;
                    border-color: rgba(6, 182, 212, 0.5) !important;
                }

                .db__stat-num {
                    font-size: 1.6rem;
                    font-weight: 900;
                    color: var(--n-primary, #3083FF);
                    line-height: 1.2;
                }
                :global(.dark) .db__stat-num {
                    color: #60a5fa !important;
                }

                .db__stat-lbl {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                    font-weight: 700;
                    text-transform: uppercase;
                    text-align: center;
                    letter-spacing: 0.03em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                    display: block;
                }

                /* Chip Grid (Guru & Siswa) */
                .db__chip-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .db__chip {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 0;
                    background: transparent;
                    font-size: 0.85rem;
                    border: none;
                    border-bottom: 1px dashed var(--n-border);
                }
                .db__chip:last-child {
                    border-bottom: none;
                }
                .db__chip:hover {
                    background: transparent;
                }
                :global(.dark) .db__chip {
                    background: transparent !important;
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.1) !important;
                    box-shadow: none !important;
                }
                :global(.dark) .db__chip:last-child {
                    border-bottom: none !important;
                }
                :global(.dark) .db__chip:hover {
                    background: transparent !important;
                    box-shadow: none !important;
                    transform: none;
                }
                .db__chip-name {
                    font-size: 0.82rem;
                    font-weight: 650;
                    color: var(--n-ink);
                    letter-spacing: 0.01em;
                }
                :global(.dark) .db__chip-name {
                    color: #cbd5e1 !important;
                    font-weight: 600 !important;
                }
                .db__chip-class {
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: var(--n-primary, #3083FF);
                    background: rgba(0, 56, 168, 0.08);
                    border: 1px solid rgba(0, 56, 168, 0.2);
                    padding: 4px 10px;
                    border-radius: 6px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 64px;
                    text-align: center;
                    box-sizing: border-box;
                }
                :global(.dark) .db__chip-class {
                    background: rgba(37, 99, 235, 0.18) !important;
                    color: #E0ECFF !important;
                    border: 1px solid rgba(59, 130, 246, 0.4) !important;
                    box-shadow: 0 0 8px rgba(37, 99, 235, 0.2) !important;
                    border-radius: 6px !important;
                }
                .db__chip-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .db__chip-status {
                    display: inline-flex;
                    align-items: center;
                    justify-content: flex-end;
                    font-size: 0.78rem;
                    font-weight: 700;
                    padding: 0 !important;
                    border-radius: 0 !important;
                    letter-spacing: 0.01em;
                    white-space: nowrap;
                    box-sizing: border-box;
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .db__chip-status.is-hadir {
                    color: #3083FF !important; /* Biru */
                }
                .db__chip-status.is-izin {
                    color: #16a34a !important; /* Hijau */
                }
                .db__chip-status.is-sakit {
                    color: #ea580c !important; /* Orange */
                }
                :global(.dark) .db__chip-status {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                :global(.dark) .db__chip-status.is-hadir {
                    color: #60a5fa !important;
                }
                :global(.dark) .db__chip-status.is-izin {
                    color: #4ade80 !important;
                }
                :global(.dark) .db__chip-status.is-sakit {
                    color: #fb923c !important;
                }

                /* Blinking dot for Anak Asuh header */
                .db__header-blink-dot {
                    position: relative;
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-left: 6px;
                    flex-shrink: 0;
                    vertical-align: top;
                    margin-top: -6px;
                    border: 1.5px solid #ffffff;
                }
                :global(.dark) .db__header-blink-dot {
                    border-color: #0b1329;
                }
                .db__header-blink-dot.sakit {
                    background-color: #f97316;
                    animation: blinkPulseOrange 1.4s infinite ease-in-out;
                }
                .db__header-blink-dot.izin {
                    background-color: #22c55e;
                    animation: blinkPulseGreen 1.4s infinite ease-in-out;
                }
                .db__header-blink-dot.both {
                    animation: blinkAlternateOrangeGreen 2.2s infinite ease-in-out;
                }

                @keyframes blinkPulseOrange {
                    0% {
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.8), 0 0 6px rgba(249, 115, 22, 0.6);
                    }
                    50% {
                        opacity: 0.3;
                        transform: scale(0.8);
                        box-shadow: 0 0 0 5px rgba(249, 115, 22, 0);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.8), 0 0 6px rgba(249, 115, 22, 0.6);
                    }
                }

                @keyframes blinkPulseGreen {
                    0% {
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.8), 0 0 6px rgba(34, 197, 94, 0.6);
                    }
                    50% {
                        opacity: 0.3;
                        transform: scale(0.8);
                        box-shadow: 0 0 0 5px rgba(34, 197, 94, 0);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.8), 0 0 6px rgba(34, 197, 94, 0.6);
                    }
                }

                @keyframes blinkAlternateOrangeGreen {
                    0%, 45% {
                        background-color: #22c55e;
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.8), 0 0 7px rgba(34, 197, 94, 0.6);
                    }
                    22.5% {
                        opacity: 0.3;
                        transform: scale(0.8);
                        box-shadow: 0 0 0 5px rgba(34, 197, 94, 0);
                    }
                    50%, 95% {
                        background-color: #f97316;
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.8), 0 0 7px rgba(249, 115, 22, 0.6);
                    }
                    72.5% {
                        opacity: 0.3;
                        transform: scale(0.8);
                        box-shadow: 0 0 0 5px rgba(249, 115, 22, 0);
                    }
                    100% {
                        background-color: #22c55e;
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.8), 0 0 7px rgba(34, 197, 94, 0.6);
                    }
                }

                /* Lists */
                .db__list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .db__list-item {
                    font-size: 0.8rem;
                    border-bottom: 1px solid var(--n-border);
                    padding: 8px 0;
                    color: var(--n-ink);
                }
                .db__list-item:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                .db__list-item strong {
                    font-weight: 650;
                    color: var(--n-ink);
                    display: block;
                    font-size: 0.82rem;
                }
                :global(.dark) .db__list-item {
                    border-bottom-color: rgba(37, 99, 235, 0.25) !important;
                }
                :global(.dark) .db__list-item strong {
                    color: #cbd5e1 !important;
                    font-weight: 600 !important;
                }
                :global(.dark) .db__list-item span.text-muted {
                    color: #94a3b8 !important;
                }
                .db__list-item.borderless {
                    border-bottom: none;
                    padding-bottom: 0;
                }

                /* Person styling (Siswa) */
                .db__person-avatar {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #e0f2fe, #bae6fd);
                    color: #0284c7;
                    font-size: 1.8rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 12px;
                    box-shadow: 0 4px 10px rgba(2, 132, 199, 0.15);
                }
                .db__person-avatar.asuh {
                    background: linear-gradient(135deg, #dcfce7, #86efac);
                    color: #16a34a;
                    box-shadow: 0 4px 10px rgba(22, 163, 74, 0.15);
                }
                .db__person-name {
                    font-size: 1rem;
                    color: var(--n-ink);
                    font-weight: 800;
                }

                /* Class Cards Grid (Siswa) */
                .db__class-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }
                .db__class-card {
                    padding: 10px 12px;
                    border-radius: 12px;
                    border: 1px solid var(--n-border);
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    transition: all 0.2s;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
                }
                .db__class-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.06);
                }
                .db__class-card.reguler {
                    background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%);
                    border-color: #86efac;
                    padding: 10px 12px;
                }
                .db__class-card.reguler .db__class-name { font-size: 1.05rem; }
                .db__class-card.peminatan { background: linear-gradient(145deg, #eff6ff 0%, #E0ECFF 100%); border-color: #E0ECFF; }
                :global(.dark) .db__class-card.reguler { background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); }
                :global(.dark) .db__class-card.peminatan { background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.2); }

                .db__class-type {
                    font-size: 0.55rem;
                    text-transform: uppercase;
                    font-weight: 700;
                    color: var(--n-muted);
                    letter-spacing: 0.05em;
                }
                .db__class-name {
                    font-size: 0.95rem;
                    font-weight: 900;
                    color: var(--n-ink);
                }
                .db__class-year {
                    font-size: 0.6rem;
                    color: var(--n-muted);
                    font-weight: 500;
                }

                /* Subject Grid */
                .db__subject-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }
                .db__subject-card {
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    padding: 12px;
                    border-radius: 12px;
                    display: flex;
                    gap: 14px;
                    align-items: center;
                    transition: all 0.2s;
                }
                .db__subject-card:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                    transform: translateX(4px);
                }
                :global(.dark) .db__subject-card:hover {
                    background: rgba(255,255,255,0.05);
                    border-color: rgba(255,255,255,0.1);
                }
                .db__subject-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3083FF, #3083FF);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
                    flex-shrink: 0;
                }
                .db__subject-info {
                    display: flex;
                    flex-direction: column;
                }
                .db__subject-info strong {
                    font-size: 0.82rem;
                    color: var(--n-ink);
                    line-height: 1.2;
                    margin-bottom: 2px;
                }

                /* Tugas (Siswa) */
                .db__tugas-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .db__tugas-item {
                    display: flex;
                    gap: 16px;
                    align-items: center;
                }
                .db__tugas-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #3083FF;
                }
                .db__tugas-content {
                    display: flex;
                    flex-direction: column;
                }
                .db__tugas-content strong {
                    font-size: 0.8rem;
                    color: var(--n-ink);
                }

                /* Tables general */
                .db__table-wrap {
                    overflow-x: auto;
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    background: var(--n-card);
                }
                :global(.dark) .db__table-wrap {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
                }
                .db__table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.8rem;
                }
                .db__table th {
                    background: var(--n-soft);
                    padding: 11px 14px;
                    font-weight: 700;
                    color: var(--n-muted);
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-bottom: 1px solid var(--n-border);
                }
                :global(.dark) .db__table th {
                    background: rgba(37, 99, 235, 0.12) !important;
                    color: #e2e8f0 !important;
                    border-bottom: 1px solid rgba(37, 99, 235, 0.3) !important;
                }
                .db__table td {
                    padding: 12px 14px;
                    border-bottom: 1px solid var(--n-border);
                    color: var(--n-ink);
                    vertical-align: middle;
                }
                :global(.dark) .db__table td {
                    border-bottom-color: rgba(37, 99, 235, 0.18) !important;
                }
                .db__table tbody tr {
                    transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .db__table tbody tr:last-child td {
                    border-bottom: none;
                }
                :global(.dark) .db__table tbody tr:hover {
                    background: rgba(37, 99, 235, 0.08) !important;
                }

                .db__tugas-title {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--n-ink);
                }
                :global(.dark) .db__tugas-title {
                    color: #E0ECFF !important;
                }

                .db__mapel-text {
                    color: var(--n-muted);
                    font-weight: 600;
                    font-size: 0.78rem;
                }
                :global(.dark) .db__mapel-text {
                    color: #bfdbfe !important;
                }

                .db__class-badges-wrap {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    align-items: center;
                }
                .db__class-badge {
                    background: rgba(0, 56, 168, 0.08);
                    color: var(--n-primary, #3083FF);
                    border: 1px solid rgba(0, 56, 168, 0.2);
                    padding: 3px 9px;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    white-space: nowrap;
                }
                :global(.dark) .db__class-badge {
                    background: rgba(37, 99, 235, 0.18) !important;
                    color: #E0ECFF !important;
                    border: 1px solid rgba(59, 130, 246, 0.4) !important;
                    box-shadow: 0 0 8px rgba(37, 99, 235, 0.2) !important;
                    border-radius: 6px !important;
                }

                .db__creator-name {
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    display: block;
                }
                :global(.dark) .db__creator-name {
                    color: #E0ECFF !important;
                }
                .db__creator-tag {
                    font-size: 0.68rem;
                    font-weight: 600;
                    display: block;
                    margin-top: 2px;
                }
                .db__creator-tag.guru {
                    color: var(--n-primary, #3083FF);
                }
                :global(.dark) .db__creator-tag.guru {
                    color: #60a5fa !important;
                }
                .db__creator-tag.siswa {
                    color: #0284c7;
                }
                :global(.dark) .db__creator-tag.siswa {
                    color: #38bdf8 !important;
                }

                /* Activity Logs Timeline */
                .db__activity-timeline {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    position: relative;
                    padding-left: 10px;
                }
                .db__activity-timeline::before {
                    content: '';
                    position: absolute;
                    left: 21px;
                    top: 10px;
                    bottom: 10px;
                    width: 2px;
                    background: var(--n-border);
                }
                .db__activity-item {
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                    z-index: 1;
                }
                .db__activity-icon {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                }
                .db__activity-content {
                    flex: 1;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    padding: 10px 12px;
                    border-radius: 8px;
                }
                .db__activity-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2px;
                }
                .db__activity-meta strong {
                    font-size: 0.8rem;
                    color: var(--n-ink);
                }
                .db__activity-time {
                    font-size: 0.68rem;
                    color: var(--n-muted);
                }
                .db__activity-desc {
                    margin: 2px 0 0 0;
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    line-height: 1.35;
                }

                /* Papan Pengumuman Sidebar */
                .fill-height {
                    height: 100%;
                    min-height: 480px;
                    display: flex;
                    flex-direction: column;
                }
                .pm-feed {
                    flex: 1;
                    overflow-y: auto;
                    max-height: 600px;
                    padding-right: 8px;
                }
                .db__empty-feed {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 1rem;
                    text-align: center;
                }
                .db__empty-feed i {
                    font-size: 2.5rem;
                    margin-bottom: 10px;
                }
                /* Disusun MENYAMPING, bukan menumpuk ke bawah. Kartu pengumuman
                   membentang selebar dashboard, jadi satu pengumuman per baris
                   membuang hampir seluruh ruang horizontal dan mendorong isi
                   halaman lain jauh ke bawah.
                   auto-fill + minmax: jumlah kolom mengikuti lebar yang ada dan
                   turun sendiri jadi satu kolom di layar sempit, tanpa perlu
                   menghitung breakpoint satu per satu. */
                .db__announcements-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 16px;
                }

                /* "Lainnya (N)" / "Lebih Sedikit" bukan pengumuman — ia harus
                   melintang penuh di bawah kisi, bukan menempati satu sel
                   seolah-olah dirinya sebuah pengumuman. */
                .db__announcements-list > .db__show-more-link {
                    grid-column: 1 / -1;
                }
                .db__ann-item {
                    border-left: 4px solid var(--n-border);
                    background: var(--n-soft);
                    padding: 16px;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                    transition: all 0.2s;
                }
                /* Terangkat, bukan bergeser ke kanan: pada daftar menumpuk dulu
                   geseran mendatar terbaca wajar, tapi di kisi menyamping ia
                   mendorong kartu ke arah tetangganya. */
                .db__ann-item:hover {
                    transform: translateY(-2px);
                    border-left-color: #3083FF;
                    background: #f8fafc;
                }
                :global(.dark) .db__ann-item:hover {
                    background: rgba(255,255,255,0.03);
                }
                .db__ann-item.is-pinned {
                    border-left-color: #e11d48;
                    background: linear-gradient(to right, #fff1f2, transparent);
                }
                :global(.dark) .db__ann-item.is-pinned {
                    background: linear-gradient(to right, rgba(225, 29, 72, 0.08), transparent);
                }
                .db__ann-pin {
                    color: #e11d48;
                }
                :global(.dark) .db__ann-pin {
                    color: #fb7185;
                }
                .db__ann-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    align-items: center;
                }
                .db__ann-tag {
                    color: #fff;
                    background: #3083FF;
                    padding: 2px 8px;
                    border-radius: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-size: 0.65rem;
                    font-weight: 700;
                }
                :global(.dark) .db__ann-tag {
                    background: rgba(37, 99, 235, 0.18) !important;
                    color: #E0ECFF !important;
                    border: 1px solid rgba(59, 130, 246, 0.4) !important;
                    box-shadow: 0 0 8px rgba(37, 99, 235, 0.2) !important;
                    border-radius: 6px !important;
                }
                .db__ann-title {
                    font-size: 0.95rem;
                    font-weight: 800;
                    color: var(--n-ink);
                    margin: 0;
                    line-height: 1.3;
                }
                :global(.dark) .db__ann-title {
                    background: linear-gradient(90deg, #38bdf8 0%, #E0ECFF 45%, #f1f5f9 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                    color: #E0ECFF;
                    display: inline-block;
                }
                :global(.dark) .db__ann-title .db__ann-pin {
                    -webkit-text-fill-color: #fb7185 !important;
                    color: #fb7185 !important;
                }
                .db__ann-text {
                    font-size: 0.82rem;
                    color: var(--n-muted);
                    line-height: 1.6;
                    margin: 0;
                }
                .db__ann-full-content {
                    font-size: 0.82rem;
                    color: var(--n-ink);
                    line-height: 1.7;
                    margin: 0;
                }
                .db__ann-full-content p { margin: 0 0 8px 0; }
                .db__ann-full-content ul, .db__ann-full-content ol { margin: 0 0 8px 16px; }
                .db__ann-toggle-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #3083FF;
                    padding: 4px 0 0 0;
                    display: block;
                    transition: opacity 0.2s;
                }
                .db__ann-toggle-btn:hover { opacity: 0.7; }
                :global(.dark) .db__ann-toggle-btn { color: #60a5fa; }
                .db__ann-author {
                    font-size: 0.7rem;
                    color: var(--n-muted);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 4px;
                    font-weight: 600;
                }

                /* Block display helper */
                .block { display: block; }
                .text-xs { font-size: 0.68rem; }
                .text-center { text-align: center; }
                .py-3 { padding-top: 12px; padding-bottom: 12px; }
                .py-4 { padding-top: 16px; padding-bottom: 16px; }
                .mt-2 { margin-top: 8px; }
                .mr-1 { margin-right: 4px; }
                .mr-2 { margin-right: 8px; }

                /* Animations */
                .rh-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(4px);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease;
                }
                .rh-modal {
                    background: var(--n-bg);
                    border-radius: 16px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    overflow: hidden;
                    animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .rh-modal-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--n-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--n-soft);
                }
                .rh-modal-header h3 {
                    margin: 0; font-size: 1.1rem;
                }
                .rh-modal-close {
                    background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--n-muted);
                }

                .bday-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.85);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 1s ease;
                }
                .bday-fireworks {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    pointer-events: none;
                    z-index: 1;
                }
                .bday-modal {
                    background: linear-gradient(135deg, #1e1b4b, #1e3a8a, #701a75);
                    border: 2px solid rgba(255,255,255,0.1);
                    border-radius: 24px;
                    padding: 40px 30px;
                    text-align: center;
                    color: white;
                    z-index: 2;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 0 60px rgba(219, 39, 119, 0.4);
                    animation: popIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .bday-icon {
                    font-size: 4.5rem;
                    margin-bottom: 16px;
                    animation: floatIcon 3s ease-in-out infinite;
                }
                .bday-modal h2 {
                    font-size: 1.8rem;
                    font-weight: 800;
                    margin: 0 0 8px;
                    background: linear-gradient(to right, #fbcfe8, #f472b6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .bday-modal .bday-age {
                    font-size: 1.1rem;
                    color: #e2e8f0;
                    margin: 0 0 20px;
                    font-weight: 500;
                }
                .bday-msg {
                    font-size: 1rem;
                    color: #cbd5e1;
                    line-height: 1.6;
                    margin: 0 0 30px;
                }
                .bday-btn {
                    background: white;
                    color: #1e3a8a;
                    border: none;
                    padding: 12px 32px;
                    border-radius: 50px;
                    font-weight: 700;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: transform 0.2s;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                }
                .bday-btn:hover {
                    transform: scale(1.05);
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes popIn { 0% { opacity: 0; transform: scale(0.8) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }

                .animate-megaphone {
                    display: inline-block;
                    animation: megaphoneShake 2.5s infinite;
                    transform-origin: center bottom;
                }
                @keyframes megaphoneShake {
                    0%, 10% { transform: rotate(0deg) scale(1); }
                    15% { transform: rotate(-15deg) scale(1.15); color: #e11d48; }
                    20% { transform: rotate(10deg) scale(1.15); }
                    25% { transform: rotate(-10deg) scale(1.15); }
                    30% { transform: rotate(5deg) scale(1.15); }
                    35% { transform: rotate(0deg) scale(1); }
                    100% { transform: rotate(0deg) scale(1); }
                }

                /* Responsive design */
                .db__mobile-greeting {
                    display: none;
                }
                .db__mobile-ann-wrapper,
                .db__mobile-ann-capsule {
                    display: none;
                }
                .db__mobile-bento-grid,
                .db__mobile-today-strip {
                    display: none;
                }
                .db__desktop-only {
                    display: grid;
                }

                .db__show-more-link {
                    background: transparent !important;
                    border: none !important;
                    color: #3083FF !important;
                    font-size: 0.75rem !important;
                    font-weight: 600 !important;
                    text-align: right !important;
                    padding: 8px 4px 0 0 !important;
                    margin-top: 8px !important;
                    cursor: pointer !important;
                    display: block !important;
                    width: 100% !important;
                }
                .db__show-more-link:hover {
                    text-decoration: underline !important;
                    color: #2563eb !important;
                }
                :global(.dark) .db__show-more-link {
                    color: #60a5fa !important;
                }

                .db__mobile-only {
                    display: none !important;
                }

                @media (max-width: 767.98px) {
                    .db__desktop-only,
                    .db__desktop-banner {
                        display: none !important;
                    }
                    .db {
                        width: 100% !important;
                        max-width: 100% !important;
                        gap: 12px !important;
                        /* TANPA padding horizontal sendiri.
                           Gutter mobile sudah diberikan shell: 8px dari
                           .content-area + 4px dari .content-container = 12px,
                           persis seperti halaman Informasi. Aturan
                           ".main-content.no-header" yang dulu menolkan padding
                           shell TIDAK PERNAH aktif — kelas "no-header" tidak
                           pernah dipasang di layout (lihat isDashboard yang
                           tidak terpakai), dan dashboard memang merender
                           <Header>. Jadi padding di sini dulu MENUMPUK di atas
                           padding shell: 8 + 4 + 10 = 22px, dua kali lipat
                           halaman lain — itulah gap lebar yang terlihat. */
                        padding: 0 !important;
                        box-sizing: border-box !important;
                        overflow-x: clip !important;
                        animation: none !important;
                    }
                    .db__widget-card {
                        padding: 14px 14px !important;
                        /* 16px = radius .db-chart-card (Statistik Kehadiran),
                           yang tidak berubah antar mode maupun lebar layar.
                           Kartu widget dulu menyimpang di mobile: 14/18px di
                           mode terang, 6px di mode gelap. */
                        border-radius: 16px !important;
                        box-sizing: border-box !important;
                        width: 100% !important;
                    }
                    .db__top-grid, .db__row2-grid {
                        grid-template-columns: 1fr !important;
                        gap: 12px !important;
                    }
                    .db__mobile-hide {
                        display: none !important;
                    }

                    /* SLEEK NOTIFICATION CAPSULE (MOBILE ANNOUNCEMENT) */
                    .db__mobile-ann-capsule {
                        display: flex !important;
                        align-items: center !important;
                        gap: 12px !important;
                        padding: 10px 12px !important;
                        background: rgba(255, 255, 255, 0.88) !important;
                        border: 1px solid rgba(255, 255, 255, 0.85) !important;
                        border-radius: 6px !important;
                        box-shadow: 0 4px 16px rgba(0, 20, 60, 0.04) !important;
                        backdrop-filter: blur(16px) !important;
                        -webkit-backdrop-filter: blur(16px) !important;
                        cursor: pointer !important;
                        transition: transform 0.15s ease, box-shadow 0.15s ease !important;
                        margin-bottom: 2px !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .db__mobile-ann-capsule:active {
                        transform: scale(0.985);
                    }
                    :global(.dark) .db__mobile-ann-capsule {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        border-radius: 6px !important;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                    }
                    .db__mobile-ann-capsule-icon {
                        width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #f43f5e, #f59e0b);
                        color: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.95rem;
                        flex-shrink: 0;
                        box-shadow: 0 3px 10px rgba(244, 63, 94, 0.25);
                    }
                    .db__mobile-ann-capsule-text {
                        flex: 1;
                        min-width: 0;
                    }
                    .db__mobile-ann-capsule-tag {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 0.68rem;
                        font-weight: 800;
                        color: #e11d48;
                        letter-spacing: 0.04em;
                    }
                    :global(.dark) .db__mobile-ann-capsule-tag {
                        color: #fb7185;
                    }
                    .db__mobile-ann-dot {
                        width: 5px;
                        height: 5px;
                        border-radius: 50%;
                        background: #e11d48;
                        animation: pulse 1.8s infinite;
                    }
                    .db__mobile-ann-count {
                        font-size: 0.65rem;
                        font-weight: 600;
                        color: #64748b;
                    }
                    :global(.dark) .db__mobile-ann-count {
                        color: #94a3b8;
                    }
                    .db__mobile-ann-capsule-title {
                        margin: 2px 0 0;
                        font-size: 0.82rem;
                        font-weight: 700;
                        color: #0f172a;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        line-height: 1.3;
                    }
                    :global(.dark) .db__mobile-ann-capsule-title {
                        color: #f1f5f9;
                    }
                    .db__mobile-ann-capsule-snippet {
                        font-weight: 400;
                        color: #64748b;
                    }
                    :global(.dark) .db__mobile-ann-capsule-snippet {
                        color: #94a3b8;
                    }
                    .db__mobile-ann-capsule-arrow {
                        width: 26px;
                        height: 26px;
                        border-radius: 4px;
                        background: rgba(0, 0, 0, 0.04);
                        color: #64748b;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.75rem;
                        flex-shrink: 0;
                    }
                    :global(.dark) .db__mobile-ann-capsule-arrow {
                        background: rgba(255, 255, 255, 0.08);
                        color: #94a3b8;
                    }

                    /* MODERN MOBILE BENTO SCHEDULE & STATS */
                    .db__mobile-bento-grid {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 8px !important;
                        margin-top: 2px !important;
                    }
                    .db__bento-stat-card {
                        background: rgba(248, 250, 252, 0.85) !important;
                        border: 1px solid rgba(226, 232, 240, 0.9) !important;
                        border-radius: 5px !important;
                        padding: 10px 11px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 3px !important;
                    }
                    :global(.dark) .db__bento-stat-card {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    }
                    .db__bento-stat-label {
                        font-size: 0.65rem !important;
                        font-weight: 700 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.05em !important;
                        color: #64748b !important;
                    }
                    :global(.dark) .db__bento-stat-label {
                        color: #94a3b8 !important;
                    }
                    .db__bento-stat-value {
                        display: flex !important;
                        align-items: baseline !important;
                        gap: 5px !important;
                        margin: 1px 0 5px !important;
                    }
                    .db__bento-stat-num {
                        font-size: 1.3rem !important;
                        font-weight: 900 !important;
                        color: #0f172a !important;
                        line-height: 1 !important;
                    }
                    :global(.dark) .db__bento-stat-num {
                        color: #f8fafc !important;
                    }
                    .db__bento-stat-unit {
                        font-size: 0.72rem !important;
                        font-weight: 600 !important;
                        color: #64748b !important;
                    }
                    :global(.dark) .db__bento-stat-unit {
                        color: #94a3b8 !important;
                    }
                    .db__bento-chips {
                        display: flex !important;
                        flex-wrap: wrap !important;
                        gap: 4px !important;
                    }
                    .db__bento-chip {
                        padding: 2px 6px !important;
                        border-radius: 3px !important;
                        font-size: 0.68rem !important;
                        font-weight: 700 !important;
                        line-height: 1.3 !important;
                    }
                    .db__bento-chip--class {
                        background: #E0ECFF !important;
                        color: #112E59 !important;
                        border: 1px solid rgba(59, 130, 246, 0.25) !important;
                    }
                    :global(.dark) .db__bento-chip--class {
                        background: rgba(37, 99, 235, 0.25) !important;
                        color: #E0ECFF !important;
                        border-color: rgba(59, 130, 246, 0.4) !important;
                    }
                    .db__bento-chip--more {
                        background: #f1f5f9 !important;
                        color: #475569 !important;
                        border: 1px solid rgba(148, 163, 184, 0.3) !important;
                    }
                    :global(.dark) .db__bento-chip--more {
                        background: rgba(255, 255, 255, 0.1) !important;
                        color: #cbd5e1 !important;
                    }
                    .db__bento-chip--day {
                        background: #dcfce7 !important;
                        color: #15803d !important;
                        border: 1px solid rgba(34, 197, 94, 0.25) !important;
                    }
                    :global(.dark) .db__bento-chip--day {
                        background: rgba(34, 197, 94, 0.2) !important;
                        color: #86efac !important;
                        border-color: rgba(34, 197, 94, 0.35) !important;
                    }
                    .db__bento-chip--empty {
                        background: #f1f5f9 !important;
                        color: #94a3b8 !important;
                        font-style: italic !important;
                    }
                    .db__mobile-today-strip {
                        margin-top: 8px !important;
                        padding: 7px 11px !important;
                        background: linear-gradient(135deg, rgba(239, 246, 255, 0.8), rgba(240, 249, 255, 0.6)) !important;
                        border: 1px solid rgba(191, 219, 254, 0.7) !important;
                        border-radius: 5px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 8px !important;
                    }
                    :global(.dark) .db__mobile-today-strip {
                        background: rgba(30, 58, 138, 0.25) !important;
                        border-color: rgba(59, 130, 246, 0.3) !important;
                    }
                    .db__today-strip-left {
                        display: flex !important;
                        align-items: center !important;
                        gap: 7px !important;
                    }
                    .db__today-pulse-dot {
                        width: 7px !important;
                        height: 7px !important;
                        border-radius: 50% !important;
                        background: #3083FF !important;
                        box-shadow: 0 0 8px #3083FF !important;
                    }
                    .db__today-text {
                        font-size: 0.75rem !important;
                        color: #1e293b !important;
                    }
                    :global(.dark) .db__today-text {
                        color: #e2e8f0 !important;
                    }
                    .db__today-classes {
                        font-size: 0.72rem !important;
                        font-weight: 800 !important;
                        color: #112E59 !important;
                    }
                    :global(.dark) .db__today-classes {
                        color: #E0ECFF !important;
                    }

                    .db__layout {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        width: 100% !important;
                        gap: 14px !important;
                    }
                    .db__main {
                        width: 100% !important;
                        max-width: 100% !important;
                        gap: 14px !important;
                    }

                    .db__widget-row {
                        flex-direction: column !important;
                        gap: 14px !important;
                        width: 100% !important;
                    }
                    /* Dua kelas dipakai sekaligus agar menang dari aturan .db__widget-card
                       dan .db__widget-header ber-!important di bawah blok ini */
                    .db__widget-card.db__agenda-time-card {
                        border-radius: 16px !important;
                        padding: 14px 12px !important;
                        gap: 10px !important;
                    }
                    .db__agenda-time-card .db__widget-header {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 8px !important;
                        flex-wrap: nowrap !important;
                        border-bottom: none !important;
                        padding-bottom: 2px !important;
                        margin-bottom: 6px !important;
                    }
                    .db__week-strip {
                        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                        gap: 6px !important;
                    }
                    .db__week-strip :global(.db__day-5th) {
                        display: none !important;
                    }
                    .db__week-strip :global(.db__day-cell) {
                        padding: 10px 2px 8px !important;
                        border-radius: 12px !important;
                        min-height: 66px !important;
                    }
                    .db__week-strip :global(.db__day-num) {
                        font-size: 1.08rem !important;
                    }
                    .db__chip-class {
                        display: none !important;
                    }
                    .db__chip-name {
                        font-size: 0.78rem !important;
                    }
                    .db__widget-card {
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                        padding: 14px 12px !important;
                        background: #FFFFFF !important;
                        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                        backdrop-filter: blur(20px) saturate(180%) !important;
                        border: 1px solid #E1E2E9 !important;
                        box-shadow: 0 6px 24px rgba(0, 20, 60, 0.04) !important;
                        border-radius: 16px !important;
                    }
                    .db__widget-header {
                        border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
                        padding-bottom: 10px !important;
                        margin-bottom: 12px !important;
                        flex-wrap: nowrap !important;
                        align-items: center !important;
                    }
                    .db__widget-header h3 {
                        font-size: 0.92rem !important;
                        font-weight: 700 !important;
                        gap: 8px !important;
                    }
                    .db__widget-header h3 i {
                        width: 30px !important;
                        height: 30px !important;
                        font-size: 0.95rem !important;
                        border-radius: 4px !important;
                    }
                    .db__ann-item {
                        background: rgba(255, 255, 255, 0.55) !important;
                        border: 1px solid rgba(255, 255, 255, 0.6) !important;
                        border-left: 4px solid #3083FF !important;
                        backdrop-filter: blur(8px) !important;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
                        border-radius: 4px !important;
                    }
                    .db__goto-btn,
                    .db__mobile-ann-btn {
                        background: #E0ECFF !important;
                        border: 1px solid #E1E2E9 !important;
                        backdrop-filter: blur(8px) !important;
                        border-radius: 4px !important;
                        width: 28px !important;
                        height: 28px !important;
                        font-size: 0.8rem !important;
                    }
                    .db__class-card.peminatan {
                        background: rgba(219, 234, 254, 0.65) !important;
                        border: 1px solid rgba(147, 197, 253, 0.7) !important;
                        backdrop-filter: blur(6px) !important;
                        border-radius: 4px !important;
                    }
                    .db__class-card.reguler {
                        background: rgba(220, 252, 231, 0.65) !important;
                        border: 1px solid rgba(134, 239, 172, 0.7) !important;
                        backdrop-filter: blur(6px) !important;
                        border-radius: 4px !important;
                    }
                    .db__subject-card {
                        background: rgba(255, 255, 255, 0.45) !important;
                        border: 1px solid rgba(255, 255, 255, 0.5) !important;
                        backdrop-filter: blur(6px) !important;
                        border-radius: 4px !important;
                    }
                    :global(.dark) .db__widget-card {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        border-radius: 16px !important;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                    }
                    :global(.dark) .db__widget-card:hover {
                        border-color: #60a5fa !important;
                        box-shadow: 0 8px 28px rgba(26, 115, 232, 0.3) !important;
                        transform: none !important;
                    }
                    :global(.dark) .db__widget-header {
                        border-bottom-color: rgba(37, 99, 235, 0.25) !important;
                    }
                    .db__hero {
                        padding: calc(env(safe-area-inset-top) + 24px) 16px 20px 16px !important;
                        border-radius: 0 0 32px 32px !important;
                        margin: 0 0 12px 0 !important;
                    }
                    .db__heroActions {
                        top: 14px !important;
                        right: 14px !important;
                    }
                    .db__heroActions :global(.header-icon-btn),
                    .db__heroThemeBtn {
                        width: 30px !important;
                        height: 30px !important;
                    }
                    .db__heroTitle {
                        font-size: 1.3rem !important;
                    }
                    .db__heroIcon {
                        display: none !important;
                    }
                    .db__heroAvatar {
                        width: 60px !important;
                        height: 60px !important;
                    }
                    .db__heroContent {
                        margin-top: 11px !important;
                    }
                    .db__heroSub {
                        font-size: 0.8rem !important;
                    }
                    .db__class-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .db__info-item--badges {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 8px !important;
                    }
                    .db__info-label {
                        width: 100%;
                        justify-content: flex-start;
                        text-align: left;
                    }
                    .db__info-badges {
                        justify-content: flex-start;
                        padding-left: 0;
                        width: 100%;
                    }
                    .db__info-empty {
                        width: 100%;
                        justify-content: flex-start;
                        text-align: left;
                    }
                    .db__mobile-only {
                        display: none !important;
                    }

                    .db__ann-title-wrap {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 8px;
                    }

                    /* Lanjutan blok mobile yang sama — sebelumnya di sini ada
                       "@media (max-width: 767.98px) {" kedua yang ke-nest di
                       dalam blok ini tanpa sengaja (kondisinya identik, tidak
                       pernah ditutup terpisah). Itu bikin .db__mobile-only /
                       .db__mobile-hide di bawah tidak selalu ter-scope dengan
                       benar, jadi PIN "UMUM" (desktop) dan PIN judul (mobile)
                       bisa tampil berbarengan. Digabung jadi satu blok saja. */
                    .db__ann-title {
                        font-size: 0.85rem !important;
                        font-weight: 500 !important;
                    }
                    .db__ann-item {
                        padding: 12px 14px !important;
                        gap: 4px !important;
                    }
                    .db__announcements-list {
                        gap: 10px !important;
                    }
                    .db__mobile-hide {
                        display: none !important;
                    }
                    .db__mobile-only {
                        display: block !important;
                    }
                    .db__chip-hadir {
                        display: none !important;
                    }
                    .db__mobile-hide-tugas {
                        display: none !important;
                    }
                    .all-present-mobile {
                        display: none !important;
                    }
                    .db__layout, .db > :not(.db__hero) {
                        padding: 0 !important;
                    }
                    .db__hero {
                        flex-direction: column;
                        align-items: flex-start;
                        position: sticky !important;
                        top: 0 !important;
                        z-index: 50 !important;
                        margin: 0 !important;
                        border-radius: 0 0 20px 20px !important;
                    }
                    .db__stats-grid {
                        flex-direction: column;
                    }
                    .db__stats-grid.db__stats-grid--2x2 {
                        display: grid !important;
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                        gap: 10px !important;
                    }
                }
            `}</style>

            {/* Modal Ulang Tahun */}
            {isBirthdayOpen && typeof window !== 'undefined' && createPortal(
                <div className="bday-overlay">
                    <canvas id="fireworks-canvas" className="bday-fireworks" />
                    <div className="bday-modal">
                        <div className="bday-icon">🎂</div>
                        <h2>Selamat Ulang Tahun, {user.nama}!</h2>
                        <p className="bday-age">Yang ke-{age} tahun.</p>
                        <p className="bday-msg">Sukses selalu dan tetap semangat!</p>
                        <button className="bday-btn" onClick={() => setIsBirthdayOpen(false)}>Terima Kasih</button>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Detail Pengumuman */}
            {selectedPengumuman && (
                <Modal
                    size="md"
                    onClose={() => setSelectedPengumuman(null)}
                    title={selectedPengumuman.title}
                    subtitle={selectedPengumuman.created_at ? formatDate(selectedPengumuman.created_at) : undefined}
                    icon={<Megaphone size={20} style={{ color: '#3083FF' }} />}
                >
                    <ModalBody>
                        {selectedPengumuman.created_by && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--n-muted, #64748b)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <UserIcon size={14} />
                                <span>Oleh: {selectedPengumuman.created_by}</span>
                            </div>
                        )}
                        <div
                            style={{
                                fontSize: '0.875rem',
                                lineHeight: 1.6,
                                color: 'var(--n-ink, #1e293b)',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap'
                            }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedPengumuman.content || '') }}
                        />
                    </ModalBody>
                    <ModalFooter align="end">
                        <Button variant="cancel" onClick={() => setSelectedPengumuman(null)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}
        </div>
    );
}


