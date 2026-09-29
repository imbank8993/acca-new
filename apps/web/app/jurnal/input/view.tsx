'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Button } from '@/components/ui/Button';
import { getCurrentUser } from '@/lib/auth-client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { useTimezone } from '@/hooks/use-timezone';
import { checkFeatureAccess, parseKonfigurasiAksesClient } from '@/lib/feature-access-client';

// Kategori yang memunculkan blok Guru Pengganti — hanya kategori ini yang
// mengubah daftar opsi Mapel & Jam Ke.
const PENGGANTI_CATEGORIES = ['tukaran', 'diganti', 'penugasan dengan pendampingan'];
const isPenggantiCat = (v: any) => PENGGANTI_CATEGORIES.includes(String(v || '').toLowerCase().trim());

interface User {
    id: number;
    auth_id: string | null;
    username: string;
    nip: string;
    nama: string;
    role: string;
    roles: string[];
    aktif: boolean;
    kelasList?: string[];
}

export default function JurnalInputPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMaster, setLoadingMaster] = useState(true);

    // Timezone
    const { getCurrentDate: getTzDate } = useTimezone();

    const [masterData, setMasterData] = useState<any>({
        guru: [],
        mapel: [],
        kelas: [],
        waktu: [],
        jadwal: [],
        dropdown: {
            terlambat: [],
            kategoriKehadiran: [],
            statusKetidakhadiran: []
        }
    });

    const [formData, setFormData] = useState<any>({
        tanggal: '', // Will be set by useEffect with timezone
        nama_guru: '',
        nip: '',
        created_by: '',
        nisn: '',
        mata_pelajaran: '',
        kelas: '',
        jam_ke: '',
        materi: '',
        refleksi: '',
        kategori_kehadiran: 'Sesuai',
        guru_pengganti: '-',
        status_pengganti: '-',
        keterangan_tambahan: '-',
        guru_piket: '-',
        durasi_terlambat: '',
        durasi_keluar_awal: '',
        // Additional statuses
        status_tambahan_1: '',
        status_tambahan_2: '',
        status_tambahan_3: ''
    });

    // Additional statuses count (0, 1, 2, or 3)
    const [additionalStatusCount, setAdditionalStatusCount] = useState(0);
    // Tracks which section added the additional status: 'main' | 'pengganti'
    const [additionalStatusSource, setAdditionalStatusSource] = useState<'main' | 'pengganti' | null>(null);

    const [selectedHours, setSelectedHours] = useState<number[]>([]);
    const [jamOptions, setJamOptions] = useState<any[]>([]);
    const [mapelOptions, setMapelOptions] = useState<any[]>([]);
    const [kelasOptions, setKelasOptions] = useState<any[]>([]);
    const [teacherDaySchedule, setTeacherDaySchedule] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isSiswa, setIsSiswa] = useState(false);
    const [userKelasList, setUserKelasList] = useState<string[]>([]);
    const [kelasWarning, setKelasWarning] = useState('');
    const [canEdit, setCanEdit] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const userData = await getCurrentUser();
            if (!userData) {
                router.push('/login');
                return;
            }
            
            setUser(userData);
            
            // Check edit permission via Hak Akses Fitur jurnal_input_access_config (default: PENGURUS_KELAS, ADMIN)
            let inputConfig = null;
            try {
                const resConfig = await fetch('/api/site-settings?key=jurnal_input_access_config');
                const jsonConfig = await resConfig.json();
                if (jsonConfig?.ok && jsonConfig.data?.value) {
                    inputConfig = parseKonfigurasiAksesClient(jsonConfig.data.value);
                }
            } catch (e) {}

            const roleStr = (userData.role || '').toUpperCase();
            const roles = userData.roles || roleStr.split(/[,|]/).map((r: string) => r.trim());
            const isPk = roles.includes('PENGURUS_KELAS') || roles.includes('PENGURUS KELAS') || roleStr.includes('PENGURUS KELAS');
            const isUserSiswa = roles.includes('SISWA') || isPk || roleStr === 'SISWA';
            setIsSiswa(isUserSiswa);

            const canEditAccess = checkFeatureAccess(userData, inputConfig, ['PENGURUS_KELAS']);
            setCanEdit(canEditAccess);

            // Get timezone-aware date
            const todayDate = await getTzDate();

            setFormData((prev: any) => ({
                ...prev,
                created_by: userData.nama,
                nisn: userData.nip || '',
                filled_by: isUserSiswa ? 'SISWA' : 'GURU',
                tanggal: todayDate || prev.tanggal || ''
            }));
            // Ambil kelas scope user untuk dropdown kelas
            const nip = userData.nip;
            if (nip) {
                    try {
                        // Untuk siswa: cari kelas dari siswa_kelas berdasarkan NISN
                        if (isUserSiswa) {
                            // Tahun ajaran aktif — bisa 2 baris (Ganjil & Genap), ambil semua yang is_active
                            let activeYears: string[] = [];
                            try {
                                const taRes = await fetch('/api/admin/tahun-ajaran');
                                const taJson = await taRes.json();
                                if (taJson.ok && Array.isArray(taJson.data)) {
                                    activeYears = [...new Set(
                                        taJson.data.filter((t: any) => t.is_active).map((t: any) => t.tahun_ajaran)
                                    )] as string[];
                                }
                            } catch (e) {
                                console.warn('Gagal memuat tahun ajaran aktif:', e);
                            }

                            try {
                                const skRes = await fetch(`/api/siswa/${encodeURIComponent(nip)}/kelas`);
                                const skJson = await skRes.json();
                                if (skJson.ok && Array.isArray(skJson.data) && skJson.data.length > 0) {
                                    let candidateRows = skJson.data;
                                    if (activeYears.length > 0) {
                                        const yearFiltered = candidateRows.filter((r: any) => activeYears.includes(r.tahun_ajaran));
                                        if (yearFiltered.length > 0) candidateRows = yearFiltered;
                                    }
                                    const siswaKelas = [...new Set(candidateRows.map((s: any) => s.kelas).filter(Boolean))] as string[];
                                    if (siswaKelas.length > 0) {
                                        setUserKelasList(siswaKelas);
                                        setFormData((prev: any) => ({ ...prev, kelas: siswaKelas[0] }));
                                    }
                                }
                            } catch (e) {
                                console.warn('Gagal memuat kelas siswa:', e);
                            }
                        } else {
                            // Untuk guru: gunakan scopes API
                            const scopeRes = await fetch(`/api/scopes?nip=${encodeURIComponent(nip)}`);
                            const scopeJson = await scopeRes.json();
                            if (scopeJson.ok && scopeJson.data?.kelasList?.length > 0) {
                                setUserKelasList(scopeJson.data.kelasList);
                                setFormData((prev: any) => ({ ...prev, kelas: scopeJson.data.kelasList[0] }));
                            }
                        }
                    } catch (err) {
                        console.error('Failed to load user scopes', err);
                    }
                }
        } catch (e) {
            console.error('Auth error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!formData.tanggal) return;
        const fetchMaster = async () => {
            setLoadingMaster(true);
            try {
                const res = await fetch(`/api/laporan/jurnal-master?valid_date=${formData.tanggal}`);
                const result = await res.json();
                if (result.ok) {
                    setMasterData(result.data);
                }
            } catch (err) {
                console.error('Failed to load master data', err);
            } finally {
                setLoadingMaster(false);
            }
        };
        fetchMaster();
    }, [formData.tanggal]);

    useEffect(() => {
        if (!masterData || loadingMaster) return;

        const [year, month, day] = formData.tanggal.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = days[dateObj.getDay()];

        const getDateOnly = (d: any) => d ? String(d).slice(0, 10) : '';

        // 1. Ambil semua jadwal yang COCOK dengan guru & aktif & belum kadaluarsa
        const allMatchingSchedules = (masterData.jadwal || []).filter((j: any) => {
            const normalizeNip = (n: any) => String(n || '').trim().replace(/^0+/, '');
            const cleanName = (n: any) => String(n || '').toLowerCase().split(',')[0].trim();
            
            const matchNip = (j.nip && formData.nip && normalizeNip(j.nip) === normalizeNip(formData.nip));
            const matchName = (j.nama_guru && formData.nama_guru && cleanName(j.nama_guru) === cleanName(formData.nama_guru));
            const matchGuru = matchNip || matchName;

            const jMulai = getDateOnly(j.berlaku_mulai);
            const jSelesai = getDateOnly(j.berlaku_selesai);

            return matchGuru &&
                j.hari?.trim().toLowerCase() === dayName.toLowerCase() &&
                (j.aktif === true || j.aktif === 'true' || j.aktif === 'ya') &&
                (!jMulai || jMulai <= formData.tanggal) &&
                (!jSelesai || jSelesai >= formData.tanggal);
        });

        // 2. Cari tanggal 'berlaku_mulai' TERBARU dari kumpulan jadwal tersebut
        let latestBerlakuMulai = '1970-01-01';
        allMatchingSchedules.forEach((j: any) => {
            const tgl = getDateOnly(j.berlaku_mulai) || '1970-01-01';
            if (tgl > latestBerlakuMulai) latestBerlakuMulai = tgl;
        });

        // 3. Hanya gunakan jadwal yang berasal dari tanggal terbaru tersebut
        const activeSchedules = allMatchingSchedules.filter((j: any) => (getDateOnly(j.berlaku_mulai) || '1970-01-01') === latestBerlakuMulai);

        const scheduleMap = new Map<string, any>();
        activeSchedules.forEach((j: any) => {
            const jam = parseInt(j.jam_ke);
            const key = `${jam}`;
            // Jika jam sama, gunakan jadwal dengan berlaku_mulai terbaru
            if (!scheduleMap.has(key) || (j.berlaku_mulai && j.berlaku_mulai > (scheduleMap.get(key).berlaku_mulai || ''))) {
                scheduleMap.set(key, j);
            }
        });
        const currentTeacherDaySchedule = Array.from(scheduleMap.values());
        setTeacherDaySchedule(currentTeacherDaySchedule);

        let availableKelas = (masterData.kelas || []).map((k: any) => ({ value: k.nama, label: k.nama }));
        if (userKelasList.length > 0) {
            // Kelas selalu dari scope user (pengisi jurnal), bukan dari jadwal guru
            availableKelas = (masterData.kelas || [])
                .filter((k: any) => userKelasList.includes(k.nama))
                .map((k: any) => ({ value: k.nama, label: k.nama }));
            if (availableKelas.length === 0) {
                availableKelas = userKelasList.map(k => ({ value: k, label: k }));
            }
        }
        setKelasOptions(availableKelas);

        // Warning: guru mengajar tapi tidak di kelas pengisi jurnal pada hari tsb
        if (formData.nama_guru && formData.kelas) {
            if (currentTeacherDaySchedule.length === 0) {
                setKelasWarning(`Guru "${formData.nama_guru}" tidak ada jadwal mengajar di hari tersebut`);
            } else {
                const guruTeachingThisClass = currentTeacherDaySchedule.some(s => s.kelas?.trim() === formData.kelas?.trim());
                if (!guruTeachingThisClass) {
                    setKelasWarning(`Guru "${formData.nama_guru}" tidak mengajar di kelas "${formData.kelas}" pada hari tersebut`);
                } else {
                    setKelasWarning('');
                }
            }
        } else {
            setKelasWarning('');
        }

        let availableMapels = (masterData.mapel || []).map((m: any) => ({ value: m.nama, label: m.nama }));
        if (formData.kelas) {
            // A. Get original teacher subjects for this class/day (filtered by latest berlaku_mulai)
            const rawOriginalSchedules = (masterData.jadwal || []).filter((j: any) => {
                const matchGuru = (j.nip && formData.nip && String(j.nip) === String(formData.nip)) ||
                    (j.nama_guru?.trim().toLowerCase() === formData.nama_guru?.trim().toLowerCase());
                
                const jMulai = getDateOnly(j.berlaku_mulai);
                const jSelesai = getDateOnly(j.berlaku_selesai);
                return matchGuru &&
                    j.kelas?.trim().toLowerCase() === formData.kelas?.trim().toLowerCase() &&
                    j.hari?.trim().toLowerCase() === dayName.toLowerCase() &&
                    (j.aktif === true || j.aktif === 'true' || j.aktif === 'ya') &&
                    (!jMulai || jMulai <= formData.tanggal) &&
                    (!jSelesai || jSelesai >= formData.tanggal);
            });

            let maxOrigMulai = '1970-01-01';
            rawOriginalSchedules.forEach((j: any) => {
                const tgl = getDateOnly(j.berlaku_mulai) || '1970-01-01';
                if (tgl > maxOrigMulai) maxOrigMulai = tgl;
            });
            const originalSchedules = rawOriginalSchedules.filter((j: any) => (getDateOnly(j.berlaku_mulai) || '1970-01-01') === maxOrigMulai);

            let combinedMapels = originalSchedules.map((s: any) => s.mata_pelajaran || s.mapel);

            // B. If there's a substitute teacher, follow specifically requested logic
            const currentCat = (formData.kategori_kehadiran || '').toLowerCase().trim();

            if (formData.guru_pengganti && formData.guru_pengganti !== '-') {
                const subGuru = masterData.guru.find((g: any) => g.nama_lengkap === formData.guru_pengganti);
                const subNip = subGuru?.nip;
                
                const substituteSchedules = (masterData.jadwal || []).filter((j: any) => {
                    const matchByNip = subNip && j.nip && String(j.nip) === String(subNip);
                    const matchByName = j.nama_guru?.trim().toLowerCase() === formData.guru_pengganti?.trim().toLowerCase();
                    return (matchByNip || matchByName) && (j.aktif === true || j.aktif === 'true' || j.aktif === 'ya');
                });
                
                const subMapels = substituteSchedules.map((s: any) => s.mata_pelajaran || s.mapel);

                if (currentCat === 'tukaran') {
                    // TUKARAN: Hanya Mapel GURU PENGGANTI
                    combinedMapels = subMapels;
                } else if (currentCat === 'diganti') {
                    // DIGANTI: Hanya Mapel GURU ASLI (Original)
                    combinedMapels = originalSchedules.map((s: any) => s.mata_pelajaran || s.mapel);
                } else {
                    // Default/Lainnya (misal Tim Teaching): Gabungkan keduanya
                    combinedMapels = [...combinedMapels, ...subMapels];
                }
            }

            const uniqueMapels = [...new Set(combinedMapels.filter((m: any) => !!m))].sort();
            if (uniqueMapels.length > 0) {
                availableMapels = uniqueMapels.map((m: any) => ({ value: m, label: m }));

                // SMART AUTO-SELECT: If only 1 mapel available for this teacher/class/day, select it automatically
                if (uniqueMapels.length === 1 && !formData.mata_pelajaran) {
                    setTimeout(() => updateForm('mata_pelajaran', uniqueMapels[0]), 50);
                }
            }
        }
        setMapelOptions(availableMapels);

        let availableJams: any[] = [];
        if (formData.kelas && formData.mata_pelajaran) {
            const allValidClassSchedules = (masterData.jadwal || []).filter((j: any) => {
                const jMulai = getDateOnly(j.berlaku_mulai);
                const jSelesai = getDateOnly(j.berlaku_selesai);
                return j.kelas === formData.kelas &&
                    j.hari === dayName &&
                    (j.aktif === true || j.aktif === 'true' || j.aktif === 'ya') &&
                    (!jMulai || jMulai <= formData.tanggal) &&
                    (!jSelesai || jSelesai >= formData.tanggal);
            });

            // Filter to only the latest berlaku_mulai schedule version for this class & day
            let maxClassMulai = '1970-01-01';
            allValidClassSchedules.forEach((j: any) => {
                const tgl = getDateOnly(j.berlaku_mulai) || '1970-01-01';
                if (tgl > maxClassMulai) maxClassMulai = tgl;
            });
            const activeClassSchedules = allValidClassSchedules.filter((j: any) => (getDateOnly(j.berlaku_mulai) || '1970-01-01') === maxClassMulai);

            const classMap = new Map<number, any>();
            activeClassSchedules.forEach((j: any) => {
                const jam = parseInt(j.jam_ke);
                if (!classMap.has(jam)) {
                    classMap.set(jam, j);
                }
            });
            const classDaySchedule = Array.from(classMap.values());
            
            const isSwap = (formData.kategori_kehadiran || '').toLowerCase().trim() === 'tukaran';
            const sessions = classDaySchedule.filter((s: any) => 
                isSwap ? true : (s.mata_pelajaran || s.mapel) === formData.mata_pelajaran
            );
            const classProgram = masterData.kelas.find((k: any) => k.nama === formData.kelas)?.program || 'Reguler';

            if (sessions.length > 0) {
                availableJams = sessions.sort((a: any, b: any) => parseInt(a.jam_ke) - parseInt(b.jam_ke)).map((s: any) => {
                    const jamNum = parseInt(s.jam_ke);
                    const timeSlot = (masterData.waktu || []).find(
                        (w: any) => String(w.jam_ke) === String(s.jam_ke) &&
                            w.hari === dayName &&
                            (w.program || 'Reguler') === (classProgram || 'Reguler')
                    );
                    const timeStr = timeSlot ? `${timeSlot.mulai?.slice(0, 5)} - ${timeSlot.selesai?.slice(0, 5)}` : 'Waktu?';
                    return { value: jamNum.toString(), label: `Jam Ke-${jamNum}`, id: jamNum, timeStr: timeStr };
                });
            }
        }
        setJamOptions(availableJams.length > 1 ? [{ value: 'all', label: '--- PILIH SEMUA JAM ---', isAll: true }, ...availableJams] : availableJams);
    }, [formData.tanggal, formData.nama_guru, formData.kelas, formData.mata_pelajaran, formData.guru_pengganti, formData.kategori_kehadiran, masterData, loadingMaster, userKelasList]);

    const [existingJurnal, setExistingJurnal] = useState<any>(null);
    // Slot (guru|tanggal|kelas|jam) yang isian formnya sudah dimuat dari DB.
    // Mencegah hasil load ulang slot yang sama menimpa perubahan user.
    const hydratedSlotRef = useRef<string>('');

    useEffect(() => {
        const checkExisting = async () => {
            if (!formData.nip || !formData.tanggal || !formData.kelas || selectedHours.length === 0) {
                setExistingJurnal(null);
                return;
            }

            const slotKey = `${formData.nip}|${formData.tanggal}|${formData.kelas}|${[...selectedHours].sort((a, b) => a - b).join(',')}`;

            try {
                const jamParam = selectedHours.join(',');
                const res = await fetch(`/api/jurnal/check-slot?nip=${formData.nip}&tanggal=${formData.tanggal}&kelas=${formData.kelas}&jam_ke_id=${jamParam}`);
                const result = await res.json();

                if (result.ok && result.data) {
                    setExistingJurnal(result.data);
                    // Slot ini sudah pernah dimuat: jangan timpa isian yang sedang diedit
                    if (hydratedSlotRef.current === slotKey) return;
                    hydratedSlotRef.current = slotKey;
                    // Set additional status count based on loaded data
                    let count = 0;
                    if (result.data.status_tambahan_1) count = 1;
                    if (result.data.status_tambahan_2) count = 2;
                    if (result.data.status_tambahan_3) count = 3;
                    setAdditionalStatusCount(count);
                    setFormData((prev: any) => ({
                        ...prev,
                        materi: !isEmpty(result.data.materi) ? result.data.materi : prev.materi,
                        refleksi: !isEmpty(result.data.refleksi) ? result.data.refleksi : prev.refleksi,
                        kategori_kehadiran: result.data.kategori_kehadiran || prev.kategori_kehadiran,
                        guru_pengganti: result.data.guru_pengganti || prev.guru_pengganti,
                        status_pengganti: result.data.status_pengganti || prev.status_pengganti,
                        keterangan_tambahan: result.data.keterangan_tambahan || prev.keterangan_tambahan,
                        guru_piket: result.data.guru_piket || prev.guru_piket,
                        durasi_terlambat: result.data.durasi_terlambat ?? prev.durasi_terlambat,
                        durasi_keluar_awal: result.data.durasi_keluar_awal ?? prev.durasi_keluar_awal,
                        status_tambahan_1: result.data.status_tambahan_1 || '',
                        status_tambahan_2: result.data.status_tambahan_2 || '',
                        status_tambahan_3: result.data.status_tambahan_3 || ''
                    }));
                } else {
                    setExistingJurnal(null);
                }
            } catch (err) {
                console.error('Check existing fail', err);
            }
        };

        const timer = setTimeout(checkExisting, 100);
        return () => clearTimeout(timer);
    }, [formData.tanggal, formData.nip, formData.kelas, selectedHours]);

    const isEmpty = (v: any) => v === null || v === undefined || String(v).trim() === '';

    const addAdditionalStatus = (source: 'main' | 'pengganti') => {
        if (additionalStatusCount < 3) {
            setAdditionalStatusSource(source);
            setAdditionalStatusCount(prev => prev + 1);
        }
    };

    const removeAdditionalStatus = (num: number) => {
        setFormData((prev: any) => {
            const next = { ...prev };
            if (num === 1) {
                next.status_tambahan_1 = '';
            } else if (num === 2) {
                next.status_tambahan_2 = '';
            } else if (num === 3) {
                next.status_tambahan_3 = '';
            }
            return next;
        });
        const newCount = additionalStatusCount - 1;
        setAdditionalStatusCount(newCount);
        if (newCount === 0) setAdditionalStatusSource(null);
    };

    const updateForm = (key: string, value: any) => {
        setFormData((prev: any) => {
            const next = { ...prev, [key]: value };

            // Reset guru_pengganti when switching away from tukaran-like categories
            if (key === 'kategori_kehadiran') {
                const noSubCategories = ['sesuai', 'terlambat', 'kosong', 'penugasan tanpa pendampingan', 'digabung'];
                if (noSubCategories.includes(String(value || '').toLowerCase().trim())) {
                    next.guru_pengganti = '-';
                    next.status_pengganti = '-';
                }
                // Reset Mapel & Jam HANYA bila perpindahan kategori benar-benar
                // mengubah daftar opsinya (kategori pengganti). Untuk kategori biasa
                // (mis. Sesuai → Terlambat) pilihan jam dipertahankan supaya jurnal
                // tidak perlu dipilih ulang — pemilihan ulang memicu load ulang slot
                // yang menimpa status yang baru saja diubah.
                if (isPenggantiCat(prev.kategori_kehadiran) || isPenggantiCat(value)) {
                    next.mata_pelajaran = '';
                    next.jam_ke = '';
                    setSelectedHours([]);
                }
            }
            if (key === 'nama_guru') {
                const guru = masterData.guru.find((g: any) => g.nama_lengkap === value);
                next.nip = guru ? guru.nip : '';
                next.mata_pelajaran = '';
                next.jam_ke = '';
                setSelectedHours([]);
                // Auto-fill kelas dari user scope jika belum ada
                if (userKelasList.length > 0 && !prev.kelas) {
                    next.kelas = userKelasList[0];
                }
            }
            if (key === 'tanggal') {
                next.mata_pelajaran = '';
                next.jam_ke = '';
                setSelectedHours([]);
            }
            if (key === 'kelas') {
                next.mata_pelajaran = '';
                next.jam_ke = '';
                setSelectedHours([]);
            }
            return next;
        });
    };

    const handleJamSelectChange = (val: string) => {
        if (!val) {
            setSelectedHours([]);
            updateForm('jam_ke', '');
            return;
        }
        if (val === 'all') {
            const allHours = jamOptions.filter((o: any) => !o.isAll).map((o: any) => parseInt(o.value, 10));
            setSelectedHours(allHours);
            updateForm('jam_ke', allHours.join(', '));
        } else {
            const h = parseInt(val, 10);
            if (!isNaN(h)) {
                setSelectedHours([h]);
                updateForm('jam_ke', String(h));
            }
        }
    };

    const currentJamValue = useMemo(() => {
        const validJams = jamOptions.filter((o: any) => !o.isAll).map((o: any) => parseInt(o.value, 10));
        if (validJams.length > 1 && selectedHours.length === validJams.length && validJams.every(h => selectedHours.includes(h))) {
            return 'all';
        }
        if (selectedHours.length === 1) {
            return String(selectedHours[0]);
        }
        if (selectedHours.length > 1) {
            return 'all';
        }
        return '';
    }, [selectedHours, jamOptions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nip || !formData.tanggal || selectedHours.length === 0 || !formData.kelas || !formData.mata_pelajaran) {
            Swal.fire('Perhatian', 'Mohon lengkapi data wajib (Guru, Tanggal, Jam, Kelas, Mapel)!', 'warning');
            return;
        }

        // Validation: if Tukaran is selected, guru_pengganti and status_pengganti are required
        if (isPenggantiCategory && (formData.guru_pengganti === '-' || !formData.guru_pengganti)) {
            Swal.fire('Perhatian', 'Guru Pengganti wajib diisi untuk kategori ini!', 'warning');
            return;
        }
        if (isPenggantiCategory && (formData.status_pengganti === '-' || !formData.status_pengganti)) {
            Swal.fire('Perhatian', 'Status Kehadiran Pengganti wajib diisi!', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const [y, m, d] = formData.tanggal.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const hari = days[dateObj.getDay()];

            const payload: any = {
                ...formData,
                jam_ke: selectedHours.sort((a, b) => a - b).join(','),
                jam_ke_id: selectedHours[0],
                hari,
                selected_hours: selectedHours,
                filled_by: formData.filled_by || 'SISWA',
                created_by: formData.created_by,
                nisn: formData.nisn || null
            };

            const res = await fetch('/api/jurnal/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.ok || result.success) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jurnal Pembelajaran berhasil disimpan', timer: 2000, showConfirmButton: false });

                // Reload data from DB after successful submit
                const reloadRes = await fetch(`/api/jurnal/check-slot?nip=${formData.nip}&tanggal=${formData.tanggal}&kelas=${formData.kelas}&jam_ke_id=${selectedHours.join(',')}`);
                const reloadResult = await reloadRes.json();

                if ((reloadResult.ok || reloadResult.success) && reloadResult.data) {
                    setExistingJurnal(reloadResult.data);
                    hydratedSlotRef.current = `${formData.nip}|${formData.tanggal}|${formData.kelas}|${[...selectedHours].sort((a, b) => a - b).join(',')}`;
                    setFormData((prev: any) => ({
                        ...prev,
                        materi: !isEmpty(reloadResult.data.materi) ? reloadResult.data.materi : prev.materi,
                        refleksi: !isEmpty(reloadResult.data.refleksi) ? reloadResult.data.refleksi : prev.refleksi,
                        kategori_kehadiran: reloadResult.data.kategori_kehadiran || prev.kategori_kehadiran,
                        guru_pengganti: reloadResult.data.guru_pengganti || prev.guru_pengganti,
                        status_pengganti: reloadResult.data.status_pengganti || prev.status_pengganti,
                        keterangan_tambahan: reloadResult.data.keterangan_tambahan || prev.keterangan_tambahan,
                        guru_piket: reloadResult.data.guru_piket || prev.guru_piket,
                        durasi_terlambat: reloadResult.data.durasi_terlambat ?? prev.durasi_terlambat,
                        durasi_keluar_awal: reloadResult.data.durasi_keluar_awal ?? prev.durasi_keluar_awal,
                        status_tambahan_1: reloadResult.data.status_tambahan_1 || '',
                        status_tambahan_2: reloadResult.data.status_tambahan_2 || '',
                        status_tambahan_3: reloadResult.data.status_tambahan_3 || ''
                    }));
                }
            } else {
                throw new Error(result.error || result.message || 'Gagal menyimpan jurnal');
            }
        } catch (error: any) {
            Swal.fire('Gagal', error.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const kategoriKehadiranOptions = masterData.dropdown.kategoriKehadiran.length > 0
        ? masterData.dropdown.kategoriKehadiran
        : [
            { value: 'Sesuai', label: 'Sesuai' },
            { value: 'Terlambat', label: 'Terlambat' },
            { value: 'Keluar Sebelum Waktunya', label: 'Keluar Sebelum Waktunya' },
            { value: 'Tukaran', label: 'Tukaran' },
            { value: 'Diganti', label: 'Diganti' },
            { value: 'Tidak Hadir', label: 'Tidak Hadir' },
            { value: 'Mengambil Waktu Istirahat', label: 'Mengambil Waktu Istirahat' }
        ];

    // Status pengganti options - same as main kategori_kehadiran dropdown
    const statusPenggantiOptions = kategoriKehadiranOptions;

    // Show Guru Pengganti section if kategori_kehadiran is Tukaran, Diganti, or Penugasan Dengan Pendampingan
    const isPenggantiCategory = isPenggantiCat(formData.kategori_kehadiran);

    // Determine where to show the "+" button - always on the LAST active status field
    const showAddButtonOn = additionalStatusCount >= 3
        ? null // Max reached
        : isPenggantiCategory
            ? 'status_pengganti'
            : additionalStatusCount >= 2
                ? 'status_tambahan_2'
                : additionalStatusCount >= 1
                    ? 'status_tambahan_1'
                    : 'status_kehadiran';

    const guruOptions = masterData.guru.map((g: any) => ({ value: g.nama_lengkap, label: g.nama_lengkap, nip: g.nip }));

    if (loading) {
        return <PageLoader />;
    }

    return (
        <>
            <div className="jp">


                {!canEdit && (
                    <div className="jp__viewOnlyNotice">
                        <i className="bi bi-info-circle"></i>
                        <span>Anda memiliki akses <strong>view only</strong>. Hanya Admin dan Pengurus Kelas yang dapat mengedit jurnal pembelajaran.</span>
                    </div>
                )}

                <div className="jp__card">
                    <form onSubmit={handleSubmit} className="jp__form">
                        <div className="jp__grid">
                            <div className="jp__section">
                                <h3 className="jp__sectionTitle"><i className="bi bi-person-badge"></i> Identitas Pengisi</h3>

                                <div className="jp__identityBadge">
                                    <i className="bi bi-person-fill"></i>
                                    <div className="jp__badgeContent">
                                        <span className="jp__badgeName">{formData.created_by}</span>
                                        <span className="jp__badgeSub">
                                            {formData.nisn}
                                            {isSiswa && formData.kelas && (
                                                <> &nbsp;•&nbsp; {formData.kelas}</>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="jp__sectionTitle" style={{ marginTop: '16px' }}><i className="bi bi-person-video3"></i> Pilih Guru & Jadwal</h3>

                                <div className="jp__field">
                                    <label>Nama Guru</label>
                                    <InlineSelect
                                        value={formData.nama_guru}
                                        onChange={(val) => canEdit && updateForm('nama_guru', val)}
                                        disabled={!canEdit || loadingMaster}
                                        minWidth="100%"
                                        height="42px"
                                        title="Pilih Guru"
                                    >
                                        <option value="">{loadingMaster ? "Memuat..." : "-- Pilih Guru --"}</option>
                                        {guruOptions.map((g: any) => (
                                            <option key={g.value} value={g.value}>{g.label}</option>
                                        ))}
                                    </InlineSelect>
                                </div>

                                <div className="jp__row">
                                    <div className="jp__field">
                                        <label>Tanggal</label>
                                        <DatePicker
                                            className="jp__input"
                                            value={formData.tanggal}
                                            onChange={(v) => canEdit && updateForm('tanggal', v)}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                    <div className="jp__field">
                                        <label>Kelas</label>
                                        <InlineSelect
                                            value={formData.kelas}
                                            onChange={(val) => canEdit && updateForm('kelas', val)}
                                            disabled={!canEdit || kelasOptions.length === 0}
                                            minWidth="100%"
                                            height="42px"
                                            title="Pilih Kelas"
                                        >
                                            <option value="">-- Pilih Kelas --</option>
                                            {kelasOptions.map((k: any) => (
                                                <option key={k.value} value={k.value}>{k.label}</option>
                                            ))}
                                        </InlineSelect>
                                        {kelasWarning && (
                                            <div className="jp__kelasWarning jp__slideDown">{kelasWarning}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="jp__field">
                                    <label>Mata Pelajaran</label>
                                    <InlineSelect
                                        value={formData.mata_pelajaran}
                                        onChange={(val) => canEdit && updateForm('mata_pelajaran', val)}
                                        disabled={!canEdit || !formData.kelas || mapelOptions.length === 0}
                                        minWidth="100%"
                                        height="42px"
                                        title="Pilih Mata Pelajaran"
                                    >
                                        <option value="">{mapelOptions.length === 0 ? "-- Tidak ada mapel tersedia --" : "-- Pilih Mata Pelajaran --"}</option>
                                        {mapelOptions.map((m: any) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </InlineSelect>
                                </div>

                                <div className="jp__field">
                                    <label>Jam Ke</label>
                                    <InlineSelect
                                        value={currentJamValue}
                                        onChange={canEdit ? handleJamSelectChange : () => {}}
                                        disabled={!canEdit || !formData.mata_pelajaran || jamOptions.length === 0}
                                        minWidth="100%"
                                        height="42px"
                                        title="Pilih Jam"
                                    >
                                        <option value="">{jamOptions.length === 0 ? "-- Tidak ada jam tersedia --" : "-- Pilih Jam --"}</option>
                                        {jamOptions.map((opt: any) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.isAll ? opt.label : `${opt.label} (${opt.timeStr})`}
                                            </option>
                                        ))}
                                    </InlineSelect>
                                    {selectedHours.length > 1 && (
                                        <div className="jp__jamInfoBadge jp__slideDown">
                                            <i className="bi bi-check2-all"></i>
                                            <span>Jam terpilih: <strong>{selectedHours.sort((a,b)=>a-b).map(h => `Jam Ke-${h}`).join(', ')}</strong></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="jp__section">
                                <h3 className="jp__sectionTitle"><i className="bi bi-check2-circle"></i> Status Kehadiran</h3>

                                {/* ——— Status Kehadiran Utama ——— */}
                                <div className="jp__field">
                                    <label>Status Kehadiran</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                        <div style={{ flex: 1 }}>
                                            <InlineSelect
                                                value={formData.kategori_kehadiran}
                                                onChange={(val) => canEdit && updateForm('kategori_kehadiran', val)}
                                                disabled={!canEdit}
                                                minWidth="100%"
                                                height="42px"
                                                title="Pilih Status Kehadiran"
                                            >
                                                {kategoriKehadiranOptions.map((k: any) => (
                                                    <option key={k.value} value={k.value}>{k.label}</option>
                                                ))}
                                            </InlineSelect>
                                        </div>
                                        {showAddButtonOn === 'status_kehadiran' && canEdit && (
                                            <button type="button" className="jp__addStatusBtn" onClick={() => addAdditionalStatus('main')} title="Tambah Status">
                                                <i className="bi bi-plus-lg"></i>
                                            </button>
                                        )}
                                    </div>
                                    {/* Durasi nested below Status Kehadiran Utama */}
                                    {(formData.kategori_kehadiran || '').toLowerCase().trim() === 'terlambat' && (
                                        <div className="jp__durationRow jp__slideDown">
                                            <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                            <label>Durasi Terlambat</label>
                                            <input
                                                type="number"
                                                className="jp__input"
                                                value={formData.durasi_terlambat}
                                                onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                placeholder="menit"
                                                min="1"
                                                max="480"
                                                disabled={!canEdit}
                                            />
                                            <span className="jp__optional">menit</span>
                                        </div>
                                    )}
                                    {(formData.kategori_kehadiran || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                        <div className="jp__durationRow jp__slideDown">
                                            <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                            <label>Durasi Keluar</label>
                                            <input
                                                type="number"
                                                className="jp__input"
                                                value={formData.durasi_keluar_awal}
                                                onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                placeholder="menit"
                                                min="1"
                                                max="480"
                                                disabled={!canEdit}
                                            />
                                            <span className="jp__optional">menit</span>
                                        </div>
                                    )}
                                </div>

                                {/* ——— Status Tambahan dari Utama (di luar Guru Pengganti) ——— */}
                                {!isPenggantiCategory && additionalStatusCount >= 1 && additionalStatusSource === 'main' && (
                                    <>
                                        {additionalStatusCount >= 1 && (
                                            <div className="jp__field jp__slideDown">
                                                <label>Status Tambahan 1</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <InlineSelect
                                                            value={formData.status_tambahan_1}
                                                            onChange={(val) => canEdit && updateForm('status_tambahan_1', val)}
                                                            disabled={!canEdit}
                                                            minWidth="100%"
                                                            height="42px"
                                                            title="Pilih Status Tambahan 1"
                                                        >
                                                            <option value="">-- Pilih Status Tambahan --</option>
                                                            {kategoriKehadiranOptions.map((k: any) => (
                                                                <option key={k.value} value={k.value}>{k.label}</option>
                                                            ))}
                                                        </InlineSelect>
                                                    </div>
                                                    {showAddButtonOn === 'status_tambahan_1' && canEdit && (
                                                        <button type="button" className="jp__addStatusBtn" onClick={() => addAdditionalStatus('main')} title="Tambah Status">
                                                            <i className="bi bi-plus-lg"></i>
                                                        </button>
                                                    )}
                                                    <button type="button" className="jp__removeStatusBtn" onClick={() => removeAdditionalStatus(1)} title="Hapus">
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </div>
                                                {/* Durasi nested inside Status Tambahan 1 */}
                                                {(formData.status_tambahan_1 || '').toLowerCase().trim() === 'terlambat' && (
                                                    <div className="jp__durationRow jp__slideDown">
                                                        <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                        <label>Durasi Terlambat</label>
                                                        <input
                                                            type="number"
                                                            className="jp__input"
                                                            value={formData.durasi_terlambat}
                                                            onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                            placeholder="menit"
                                                            min="1"
                                                            max="480"
                                                            disabled={!canEdit}
                                                        />
                                                        <span className="jp__optional">menit</span>
                                                    </div>
                                                )}
                                                {(formData.status_tambahan_1 || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                                    <div className="jp__durationRow jp__slideDown">
                                                        <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                        <label>Durasi Keluar</label>
                                                        <input
                                                            type="number"
                                                            className="jp__input"
                                                            value={formData.durasi_keluar_awal}
                                                            onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                            placeholder="menit"
                                                            min="1"
                                                            max="480"
                                                            disabled={!canEdit}
                                                        />
                                                        <span className="jp__optional">menit</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {additionalStatusCount >= 2 && (
                                            <div className="jp__field jp__slideDown">
                                                <label>Status Tambahan 2</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <InlineSelect
                                                            value={formData.status_tambahan_2}
                                                            onChange={(val) => canEdit && updateForm('status_tambahan_2', val)}
                                                            disabled={!canEdit}
                                                            minWidth="100%"
                                                            height="42px"
                                                            title="Pilih Status Tambahan 2"
                                                        >
                                                            <option value="">-- Pilih Status Tambahan --</option>
                                                            {kategoriKehadiranOptions.map((k: any) => (
                                                                <option key={k.value} value={k.value}>{k.label}</option>
                                                            ))}
                                                        </InlineSelect>
                                                    </div>
                                                    {showAddButtonOn === 'status_tambahan_2' && canEdit && (
                                                        <button type="button" className="jp__addStatusBtn" onClick={() => addAdditionalStatus('main')} title="Tambah Status">
                                                            <i className="bi bi-plus-lg"></i>
                                                        </button>
                                                    )}
                                                    <button type="button" className="jp__removeStatusBtn" onClick={() => removeAdditionalStatus(2)} title="Hapus">
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </div>
                                                {/* Durasi nested inside Status Tambahan 2 */}
                                                {(formData.status_tambahan_2 || '').toLowerCase().trim() === 'terlambat' && (
                                                    <div className="jp__durationRow jp__slideDown">
                                                        <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                        <label>Durasi Terlambat</label>
                                                        <input
                                                            type="number"
                                                            className="jp__input"
                                                            value={formData.durasi_terlambat}
                                                            onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                            placeholder="menit"
                                                            min="1"
                                                            max="480"
                                                            disabled={!canEdit}
                                                        />
                                                        <span className="jp__optional">menit</span>
                                                    </div>
                                                )}
                                                {(formData.status_tambahan_2 || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                                    <div className="jp__durationRow jp__slideDown">
                                                        <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                        <label>Durasi Keluar</label>
                                                        <input
                                                            type="number"
                                                            className="jp__input"
                                                            value={formData.durasi_keluar_awal}
                                                            onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                            placeholder="menit"
                                                            min="1"
                                                            max="480"
                                                            disabled={!canEdit}
                                                        />
                                                        <span className="jp__optional">menit</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {additionalStatusCount >= 3 && (
                                            <div className="jp__field jp__slideDown">
                                                <label>Status Tambahan 3</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <InlineSelect
                                                            value={formData.status_tambahan_3}
                                                            onChange={(val) => canEdit && updateForm('status_tambahan_3', val)}
                                                            disabled={!canEdit}
                                                            minWidth="100%"
                                                            height="42px"
                                                            title="Pilih Status Tambahan 3"
                                                        >
                                                            <option value="">-- Pilih Status Tambahan --</option>
                                                            {kategoriKehadiranOptions.map((k: any) => (
                                                                <option key={k.value} value={k.value}>{k.label}</option>
                                                            ))}
                                                        </InlineSelect>
                                                    </div>
                                                    <button type="button" className="jp__removeStatusBtn" onClick={() => removeAdditionalStatus(3)} title="Hapus">
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </div>
                                                {/* Durasi nested inside Status Tambahan 3 */}
                                                {(formData.status_tambahan_3 || '').toLowerCase().trim() === 'terlambat' && (
                                                    <div className="jp__durationRow jp__slideDown">
                                                        <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                        <label>Durasi Terlambat</label>
                                                        <input
                                                            type="number"
                                                            className="jp__input"
                                                            value={formData.durasi_terlambat}
                                                            onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                            placeholder="menit"
                                                            min="1"
                                                            max="480"
                                                            disabled={!canEdit}
                                                        />
                                                        <span className="jp__optional">menit</span>
                                                    </div>
                                                )}
                                                {(formData.status_tambahan_3 || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                                    <div className="jp__durationRow jp__slideDown">
                                                        <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                        <label>Durasi Keluar</label>
                                                        <input
                                                            type="number"
                                                            className="jp__input"
                                                            value={formData.durasi_keluar_awal}
                                                            onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                            placeholder="menit"
                                                            min="1"
                                                            max="480"
                                                            disabled={!canEdit}
                                                        />
                                                        <span className="jp__optional">menit</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ——— Guru Pengganti Section ——— */}
                                {isPenggantiCategory && (
                                    <div className="jp__penggantiSection jp__slideDown">
                                        <div className="jp__field">
                                            <label>Nama Guru Pengganti / Mitra</label>
                                            <InlineSelect
                                                value={formData.guru_pengganti || '-'}
                                                onChange={(val) => canEdit && updateForm('guru_pengganti', val || '-')}
                                                disabled={!canEdit}
                                                minWidth="100%"
                                                height="42px"
                                                title="Pilih Guru Pengganti / Mitra"
                                            >
                                                <option value="-">-- Pilih Guru Pengganti --</option>
                                                {guruOptions.map((g: any) => (
                                                    <option key={g.value} value={g.value}>{g.label}</option>
                                                ))}
                                            </InlineSelect>
                                        </div>
                                        <div className="jp__field">
                                            <label>Status Kehadiran Pengganti</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                <div style={{ flex: 1 }}>
                                                    <InlineSelect
                                                        value={formData.status_pengganti || '-'}
                                                        onChange={(val) => canEdit && updateForm('status_pengganti', val || '-')}
                                                        disabled={!canEdit}
                                                        minWidth="100%"
                                                        height="42px"
                                                        title="Pilih Status Kehadiran Pengganti"
                                                    >
                                                        <option value="-">-- Pilih Status Pengganti --</option>
                                                        {statusPenggantiOptions.map((s: any) => (
                                                            <option key={s.value} value={s.value}>{s.label}</option>
                                                        ))}
                                                    </InlineSelect>
                                                </div>
                                                {showAddButtonOn === 'status_pengganti' && canEdit && (
                                                    <button type="button" className="jp__addStatusBtn" onClick={() => addAdditionalStatus('pengganti')} title="Tambah Status">
                                                        <i className="bi bi-plus-lg"></i>
                                                    </button>
                                                )}
                                            </div>
                                            {/* Durasi nested below Status Kehadiran Pengganti */}
                                            {(formData.status_pengganti || '').toLowerCase().trim() === 'terlambat' && (
                                                <div className="jp__durationRow jp__slideDown">
                                                    <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                    <label>Durasi Terlambat</label>
                                                    <input
                                                        type="number"
                                                        className="jp__input"
                                                        value={formData.durasi_terlambat}
                                                        onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                        placeholder="menit"
                                                        min="1"
                                                        max="480"
                                                        disabled={!canEdit}
                                                    />
                                                    <span className="jp__optional">menit</span>
                                                </div>
                                            )}
                                            {(formData.status_pengganti || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                                <div className="jp__durationRow jp__slideDown">
                                                    <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                    <label>Durasi Keluar</label>
                                                    <input
                                                        type="number"
                                                        className="jp__input"
                                                        value={formData.durasi_keluar_awal}
                                                        onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                        placeholder="menit"
                                                        min="1"
                                                        max="480"
                                                        disabled={!canEdit}
                                                    />
                                                    <span className="jp__optional">menit</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* ——— Status Tambahan dari Guru Pengganti (di dalam card) ——— */}
                                        {additionalStatusSource === 'pengganti' && (
                                            <>
                                                {additionalStatusCount >= 1 && (
                                                    <div className="jp__field jp__slideDown">
                                                        <label>Status Tambahan 1</label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                            <div style={{ flex: 1 }}>
                                                        <InlineSelect
                                                            value={formData.status_tambahan_1}
                                                            onChange={(val) => canEdit && updateForm('status_tambahan_1', val)}
                                                            disabled={!canEdit}
                                                            minWidth="100%"
                                                            height="42px"
                                                            title="Pilih Status Tambahan 1"
                                                        >
                                                            <option value="">-- Pilih Status Tambahan --</option>
                                                            {kategoriKehadiranOptions.map((k: any) => (
                                                                <option key={k.value} value={k.value}>{k.label}</option>
                                                            ))}
                                                        </InlineSelect>
                                                            </div>
                                                            {showAddButtonOn === 'status_tambahan_1' && canEdit && (
                                                                <button type="button" className="jp__addStatusBtn" onClick={() => addAdditionalStatus('pengganti')} title="Tambah Status">
                                                                    <i className="bi bi-plus-lg"></i>
                                                                </button>
                                                            )}
                                                            <button type="button" className="jp__removeStatusBtn" onClick={() => removeAdditionalStatus(1)} title="Hapus">
                                                                <i className="bi bi-x-lg"></i>
                                                            </button>
                                                        </div>
                                                        {/* Durasi nested inside Status Tambahan 1 (pengganti) */}
                                                        {(formData.status_tambahan_1 || '').toLowerCase().trim() === 'terlambat' && (
                                                            <div className="jp__durationRow jp__slideDown">
                                                                <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                                <label>Durasi Terlambat</label>
                                                                <input
                                                                    type="number"
                                                                    className="jp__input"
                                                                    value={formData.durasi_terlambat}
                                                                    onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                                    placeholder="menit"
                                                                    min="1"
                                                                    max="480"
                                                                    disabled={!canEdit}
                                                                />
                                                                <span className="jp__optional">menit</span>
                                                            </div>
                                                        )}
                                                        {(formData.status_tambahan_1 || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                                            <div className="jp__durationRow jp__slideDown">
                                                                <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                                <label>Durasi Keluar</label>
                                                                <input
                                                                    type="number"
                                                                    className="jp__input"
                                                                    value={formData.durasi_keluar_awal}
                                                                    onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                                    placeholder="menit"
                                                                    min="1"
                                                                    max="480"
                                                                    disabled={!canEdit}
                                                                />
                                                                <span className="jp__optional">menit</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {additionalStatusCount >= 2 && (
                                                    <div className="jp__field jp__slideDown">
                                                        <label>Status Tambahan 2</label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                            <div style={{ flex: 1 }}>
                                                        <InlineSelect
                                                            value={formData.status_tambahan_2}
                                                            onChange={(val) => canEdit && updateForm('status_tambahan_2', val)}
                                                            disabled={!canEdit}
                                                            minWidth="100%"
                                                            height="42px"
                                                            title="Pilih Status Tambahan 2"
                                                        >
                                                            <option value="">-- Pilih Status Tambahan --</option>
                                                            {kategoriKehadiranOptions.map((k: any) => (
                                                                <option key={k.value} value={k.value}>{k.label}</option>
                                                            ))}
                                                        </InlineSelect>
                                                            </div>
                                                            {showAddButtonOn === 'status_tambahan_2' && canEdit && (
                                                                <button type="button" className="jp__addStatusBtn" onClick={() => addAdditionalStatus('pengganti')} title="Tambah Status">
                                                                    <i className="bi bi-plus-lg"></i>
                                                                </button>
                                                            )}
                                                            <button type="button" className="jp__removeStatusBtn" onClick={() => removeAdditionalStatus(2)} title="Hapus">
                                                                <i className="bi bi-x-lg"></i>
                                                            </button>
                                                        </div>
                                                        {/* Durasi nested inside Status Tambahan 2 (pengganti) */}
                                                        {(formData.status_tambahan_2 || '').toLowerCase().trim() === 'terlambat' && (
                                                            <div className="jp__durationRow jp__slideDown">
                                                                <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                                <label>Durasi Terlambat</label>
                                                                <input
                                                                    type="number"
                                                                    className="jp__input"
                                                                    value={formData.durasi_terlambat}
                                                                    onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                                    placeholder="menit"
                                                                    min="1"
                                                                    max="480"
                                                                    disabled={!canEdit}
                                                                />
                                                                <span className="jp__optional">menit</span>
                                                            </div>
                                                        )}
                                                        {(formData.status_tambahan_2 || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                                            <div className="jp__durationRow jp__slideDown">
                                                                <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                                <label>Durasi Keluar</label>
                                                                <input
                                                                    type="number"
                                                                    className="jp__input"
                                                                    value={formData.durasi_keluar_awal}
                                                                    onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                                    placeholder="menit"
                                                                    min="1"
                                                                    max="480"
                                                                    disabled={!canEdit}
                                                                />
                                                                <span className="jp__optional">menit</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {additionalStatusCount >= 3 && (
                                                    <div className="jp__field jp__slideDown">
                                                        <label>Status Tambahan 3</label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                            <div style={{ flex: 1 }}>
                                                        <InlineSelect
                                                            value={formData.status_tambahan_3}
                                                            onChange={(val) => canEdit && updateForm('status_tambahan_3', val)}
                                                            disabled={!canEdit}
                                                            minWidth="100%"
                                                            height="42px"
                                                            title="Pilih Status Tambahan 3"
                                                        >
                                                            <option value="">-- Pilih Status Tambahan --</option>
                                                            {kategoriKehadiranOptions.map((k: any) => (
                                                                <option key={k.value} value={k.value}>{k.label}</option>
                                                            ))}
                                                        </InlineSelect>
                                                            </div>
                                                            <button type="button" className="jp__removeStatusBtn" onClick={() => removeAdditionalStatus(3)} title="Hapus">
                                                                <i className="bi bi-x-lg"></i>
                                                            </button>
                                                        </div>
                                                        {/* Durasi nested inside Status Tambahan 3 (pengganti) */}
                                                        {(formData.status_tambahan_3 || '').toLowerCase().trim() === 'terlambat' && (
                                                            <div className="jp__durationRow jp__slideDown">
                                                                <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                                <label>Durasi Terlambat</label>
                                                                <input
                                                                    type="number"
                                                                    className="jp__input"
                                                                    value={formData.durasi_terlambat}
                                                                    onChange={(e) => canEdit && updateForm('durasi_terlambat', e.target.value)}
                                                                    placeholder="menit"
                                                                    min="1"
                                                                    max="480"
                                                                    disabled={!canEdit}
                                                                />
                                                                <span className="jp__optional">menit</span>
                                                            </div>
                                                        )}
                                                        {(formData.status_tambahan_3 || '').toLowerCase().trim() === 'keluar sebelum waktunya' && (
                                                            <div className="jp__durationRow jp__slideDown">
                                                                <i className="bi bi-arrow-return-right" style={{ color: 'var(--n-muted)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                                                                <label>Durasi Keluar</label>
                                                                <input
                                                                    type="number"
                                                                    className="jp__input"
                                                                    value={formData.durasi_keluar_awal}
                                                                    onChange={(e) => canEdit && updateForm('durasi_keluar_awal', e.target.value)}
                                                                    placeholder="menit"
                                                                    min="1"
                                                                    max="480"
                                                                    disabled={!canEdit}
                                                                />
                                                                <span className="jp__optional">menit</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Guru Piket */}
                                <div className="jp__field">
                                    <label>Guru Piket <span className="jp__optional">(Opsional)</span></label>
                                    <InlineSelect
                                        value={formData.guru_piket || '-'}
                                        onChange={(val) => canEdit && updateForm('guru_piket', val || '-')}
                                        disabled={!canEdit}
                                        minWidth="100%"
                                        height="42px"
                                        title="Pilih Guru Piket (Opsional)"
                                    >
                                        <option value="-">-- Pilih Guru Piket (Opsional) --</option>
                                        {guruOptions.map((g: any) => (
                                            <option key={g.value} value={g.value}>{g.label}</option>
                                        ))}
                                    </InlineSelect>
                                </div>
                            </div>
                        </div>

                        <div className="jp__detailSection">
                            <h3 className="jp__sectionTitle">
                                <i className="bi bi-card-text"></i> Detail Pembelajaran
                                {(existingJurnal?.materi || existingJurnal?.refleksi) && (
                                    <span className={isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') ? 'jp__locked' : 'jp__editable'}>
                                        <i className={`bi bi-${isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') ? 'lock-fill' : 'pencil-fill'}`}></i>
                                        {isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') ? 'Diisi Guru' : 'Sudah Ada'}
                                    </span>
                                )}
                            </h3>

                            {(existingJurnal?.materi || existingJurnal?.refleksi) && (
                                <div className={isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') ? 'jp__lockedInfo' : 'jp__editInfo'}>
                                    <i className={`bi bi-${isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') ? 'info-circle-fill' : 'check-circle-fill'}`}></i>
                                    <p>
                                        {isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN')
                                            ? 'Materi dan Refleksi sudah diisi oleh Guru. Kamu tidak bisa mengubah isian tersebut.'
                                            : 'Data sudah ada. Kamu bisa mengedit Materi dan Refleksi sebelum disimpan.'}
                                    </p>
                                </div>
                            )}

                            <div className="jp__field">
                                <label>Materi Pembelajaran</label>
                                <textarea
                                    className={`jp__textarea ${isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') && !isEmpty(existingJurnal?.materi) ? 'jp__disabled' : ''}`}
                                    value={formData.materi}
                                    onChange={(e) => canEdit && updateForm('materi', e.target.value)}
                                    placeholder="Contoh: Bab 3 - Persamaan Kuadrat..."
                                    rows={3}
                                    disabled={!canEdit || (isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') && !isEmpty(existingJurnal?.materi))}
                                />
                            </div>

                            <div className="jp__field">
                                <label>Refleksi / Catatan Tambahan</label>
                                <textarea
                                    className={`jp__textarea ${isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') && !isEmpty(existingJurnal?.refleksi) ? 'jp__disabled' : ''}`}
                                    value={formData.refleksi}
                                    onChange={(e) => canEdit && updateForm('refleksi', e.target.value)}
                                    placeholder="Catatan hasil belajar atau hal penting lainnya..."
                                    rows={3}
                                    disabled={!canEdit || (isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') && !isEmpty(existingJurnal?.refleksi))}
                                />
                            </div>

                            <div className="jp__field">
                                <label>Keterangan Lainnya <span className="jp__optional">(Opsional)</span></label>
                                <input
                                    type="text"
                                    className="jp__input"
                                    value={formData.keterangan_tambahan}
                                    onChange={(e) => canEdit && updateForm('keterangan_tambahan', e.target.value)}
                                    placeholder="Catatan tambahan..."
                                    disabled={!canEdit}
                                />
                            </div>
                        </div>

                        <div className="jp__footer">
                            <div className="jp__info">
                                <i className="bi bi-info-circle"></i>
                                {selectedHours.length > 0 ? ` Menyimpan ${selectedHours.length} blok jam.` : ' Lengkapi data untuk mengirim.'}
                            </div>
                            <Button
                                type="submit"
                                variant="primary"
                                size="md"
                                isLoading={submitting}
                                disabled={selectedHours.length === 0 || !canEdit}
                                icon="send"
                            >
                                Submit
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .jp {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                    animation: fadeIn 0.4s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.98) translateY(-10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .jp__card {
                    margin-top: 4px;
                    background: var(--n-card);
                    border-radius: 24px;
                    padding: 28px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
                    border: 1px solid var(--n-border);
                    transition: all 0.3s ease;
                }
                :global(.dark) .jp__card {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                    transition: all 0.2s ease;
                }
                :global(.dark) .jp__card:hover {
                    border-color: rgba(59, 130, 246, 0.6);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15);
                }

                .jp__grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 32px;
                    margin-bottom: 32px;
                }

                .jp__section {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .jp__sectionTitle {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    margin: 0 0 8px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                @media (max-width: 767.98px) {
                    .jp {
                        gap: 0 !important;
                    }
                    .jp__card {
                        margin-top: 0 !important;
                        padding: 20px 16px !important;
                    }
                    .jp__grid {
                        grid-template-columns: 1fr;
                        gap: 24px;
                    }
                }

                @media (max-width: 640px) {
                    .jp__grid {
                        gap: 16px;
                        margin-bottom: 20px;
                    }
                    .jp__section {
                        gap: 12px;
                    }
                }

                @media (max-width: 480px) {
                    .jp__durationRow {
                        flex-wrap: wrap;
                        gap: 4px;
                    }
                    .jp__durationRow .jp__input {
                        max-width: 80px;
                    }
                    .jp__durationRow label {
                        font-size: 0.75rem;
                    }
                }
                .jp__sectionTitle i {
                    color: var(--n-primary);
                    font-size: 1.1rem;
                }

                .jp__row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .jp__field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .jp__field label {
                    font-size: 0.8rem;
                    font-weight: 400;
                    color: var(--n-muted);
                }
                .jp__optional {
                    font-weight: 400;
                    color: var(--n-muted);
                    font-size: 0.75rem;
                }

                .jp__identityBadge {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                }
                .jp__identityBadge > i {
                    color: var(--n-primary);
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }
                .jp__badgeContent {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }
                .jp__badgeName {
                    font-weight: 700;
                    color: var(--n-ink);
                    font-size: 0.88rem;
                    line-height: 1.3;
                }
                .jp__badgeSub {
                    color: var(--n-muted);
                    font-size: 0.75rem;
                    line-height: 1.3;
                }

                .jp__input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    -webkit-appearance: none;
                    appearance: none;
                }
                .jp__input[type="date"] {
                    min-width: 0;
                    max-width: 100%;
                }
                .jp__input:hover {
                    border-color: var(--n-muted);
                }
                .jp__input:focus {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.08);
                }

                :global(.jp .uisel) {
                    width: 100%;
                }
                :global(.jp .uisel select.uisel-input) {
                    border-radius: 10px !important;
                    font-size: 0.88rem !important;
                    font-weight: 500 !important;
                    padding: 0 34px 0 14px !important;
                    border: 1.5px solid #cbd5e1 !important;
                    background-color: var(--n-card) !important;
                    color: var(--n-ink) !important;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                :global(.jp .uisel select.uisel-input:hover) {
                    border-color: var(--n-muted) !important;
                }
                :global(.jp .uisel select.uisel-input:focus) {
                    border-color: var(--n-primary) !important;
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.08) !important;
                }
                :global(.jp .uisel select.uisel-input:disabled) {
                    background-color: var(--n-surface-2) !important;
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                :global(.jp .uisel-icon) {
                    right: 14px;
                    font-size: 13px;
                }

                .jp__jamInfoBadge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    color: var(--n-primary);
                    background: var(--n-soft);
                    padding: 6px 10px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    margin-top: 4px;
                }
                .jp__jamInfoBadge i {
                    font-size: 0.95rem;
                }

                .jp__textarea {
                    width: 100%;
                    padding: 12px 14px;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    font-family: inherit;
                    resize: vertical;
                    min-height: 80px;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    line-height: 1.5;
                }
                .jp__textarea:hover {
                    border-color: var(--n-muted);
                }
                .jp__textarea:focus {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.08);
                }
                .jp__textarea.jp__disabled {
                    background: var(--n-surface-2);
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .jp__detailSection {
                    background: var(--n-surface-2);
                    padding: 20px;
                    border-radius: 16px;
                    margin-bottom: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .jp__lockedInfo {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px 16px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    color: var(--n-primary);
                    font-size: 0.8rem;
                }
                .jp__lockedInfo i {
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }
                .jp__lockedInfo p {
                    margin: 0;
                    line-height: 1.5;
                }
                .jp__editInfo {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px 16px;
                    background: rgba(34, 197, 94, 0.08);
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    border-radius: 12px;
                    color: #22c55e;
                    font-size: 0.8rem;
                }
                .jp__editInfo i {
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }
                .jp__editInfo p {
                    margin: 0;
                    line-height: 1.5;
                }
                .jp__locked {
                    margin-left: auto;
                    font-size: 0.7rem;
                    font-weight: 600;
                    padding: 3px 10px;
                    background: rgba(79, 142, 247, 0.15);
                    color: var(--jp-white-accent);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .jp__editable {
                    margin-left: auto;
                    font-size: 0.7rem;
                    font-weight: 600;
                    padding: 3px 10px;
                    background: rgba(34, 197, 94, 0.12);
                    color: #4ade80;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .jp__penggantiSection {
                    background: var(--n-surface-2);
                    padding: 14px;
                    border-radius: 12px;
                    border: 1px dashed var(--n-border);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .jp__slideDown {
                    animation: slideDown 0.3s ease-out;
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .jp__jamOption {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                    padding: 2px 0;
                }
                .jp__jamAll {
                    font-weight: 700;
                    color: var(--n-primary);
                }
                .jp__jamTime {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    background: var(--n-surface-2);
                    padding: 2px 8px;
                    border-radius: 6px;
                }

                .jp__footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 20px;
                    border-top: 1.5px solid var(--n-border);
                }
                .jp__info {
                    color: var(--n-muted);
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .jp__kelasWarning {
                    margin-top: 6px;
                    padding: 8px 12px;
                    background: rgba(239, 68, 68, 0.08);
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    border-radius: 8px;
                    font-size: 12px;
                    color: #ef4444;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .jp__kelasWarning::before {
                    content: '⚠';
                    font-size: 14px;
                }

                .jp__addStatusBtn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border: none;
                    border-radius: 8px;
                    background: var(--n-primary);
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .jp__addStatusBtn:hover {
                    background: var(--n-primary-light);
                    transform: scale(1.05);
                }

                .jp__durationRow {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding-left: 4px;
                }
                .jp__durationRow label {
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    white-space: nowrap;
                }
                .jp__durationRow .jp__input {
                    max-width: 100px;
                    padding: 6px 10px;
                    font-size: 0.85rem;
                }

                .jp__removeStatusBtn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border: none;
                    border-radius: 6px;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .jp__removeStatusBtn:hover {
                    background: rgba(239, 68, 68, 0.2);
                }

                :global(.dark) .jp__penggantiSection { background: #0b1329; }
                :global(.dark) .jp__identityBadge {
                    background: rgba(59, 130, 246, 0.15);
                    border-color: rgba(26, 115, 232, 0.35);
                    color: #3b82f6;
                }
                :global(.dark) .jp__kelasWarning {
                    background: rgba(239, 68, 68, 0.15);
                    border-color: rgba(239, 68, 68, 0.4);
                    color: #fca5a5;
                }
                :global(.dark) .jp__badgeId { color: #94a3b8; }
                :global(.dark) .jp__textarea {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 12px;
                    color: #ffffff;
                }
                :global(.dark) .jp__textarea:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                }
                :global(.dark) .jp__textarea::placeholder { color: #64748b; }
                :global(.dark) .jp__textarea.jp__disabled { background: rgba(26, 115, 232, 0.06); color: #94a3b8; }
                :global(.dark) .jp__detailSection {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 12px;
                }
                :global(.dark) .jp__jamAll { color: #3b82f6; }
                :global(.dark) .jp__jamTime { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
                :global(.dark) .jp__jamInfoBadge {
                    background: rgba(59, 130, 246, 0.15);
                    border-color: rgba(26, 115, 232, 0.35);
                    color: #60a5fa;
                }
                :global(.dark .jp .uisel select.uisel-input) {
                    background-color: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #ffffff !important;
                }
                :global(.dark .jp .uisel select.uisel-input:focus) {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
                }
                :global(.dark .jp .uisel-icon) {
                    color: #60a5fa;
                }
                :global(.dark) .jp__locked { background: rgba(239,68,68,0.12); color: #f87171; }
                :global(.dark) .jp__editable { background: rgba(34,197,94,0.12); color: #4ade80; }
                :global(.dark) .jp__lockedInfo { color: #94a3b8; }
                :global(.dark) .jp__editInfo { color: #4ade80; }
                :global(.dark) .jp__penggantiSection {
                    background: #0b1329;
                    border: 1px solid rgba(26, 115, 232, 0.35);
                    border-radius: 12px;
                }
                :global(.dark) .jp__info { color: #94a3b8; }
                :global(.dark) .jp__sectionTitle { color: #94a3b8; }
                :global(.dark) .jp__sectionTitle i { color: #3b82f6; }

                /* Badge ini dulu duduk di atas gradien PageBanner, jadi warnanya
                   putih-transparan. Bannernya kini tidak punya latar sama sekali
                   (components/page-banner.css), sehingga putih di atas kanvas
                   terang berarti tidak terbaca. Dipindah ke palet amber yang
                   sama dengan .jp__viewOnlyNotice di bawahnya. */
                .jp__viewOnlyBadge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(245, 158, 11, 0.12);
                    border: 1px solid rgba(245, 158, 11, 0.35);
                    padding: 6px 12px;
                    border-radius: 20px;
                    color: #b45309;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .jp__viewOnlyBadge i {
                    font-size: 0.9rem;
                }

                .jp__viewOnlyNotice {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    border-radius: 12px;
                    margin-bottom: 20px;
                    font-size: 0.85rem;
                    color: #d97706;
                }
                .jp__viewOnlyNotice i {
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }
                :global(.dark) .jp__viewOnlyBadge {
                    background: rgba(59, 130, 246, 0.15);
                    border-color: rgba(59, 130, 246, 0.4);
                    color: #3b82f6;
                }
                :global(.dark) .jp__viewOnlyNotice {
                    background: rgba(245, 158, 11, 0.15);
                    border-color: rgba(245, 158, 11, 0.4);
                    color: #fbbf24;
                }
            `}</style>
            <MaintenanceBanner pageKey="maintenance_jurnal_input" />
        </>
    );
}
