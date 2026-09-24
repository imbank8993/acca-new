'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { supabase } from '@/lib/supabase';
import { getUserByAuthId } from '@/lib/auth';
import PermissionGuard from '@/components/PermissionGuard';

interface User {
    id: number;
    auth_id: string;
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
        tanggal: new Date().toISOString().split('T')[0],
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
        keterangan_terlambat: '-',
        durasi_terlambat: '',
        keterangan_tambahan: '-',
        guru_piket: '-'
    });

    const [selectedHours, setSelectedHours] = useState<number[]>([]);
    const [jamOptions, setJamOptions] = useState<any[]>([]);
    const [mapelOptions, setMapelOptions] = useState<any[]>([]);
    const [kelasOptions, setKelasOptions] = useState<any[]>([]);
    const [teacherDaySchedule, setTeacherDaySchedule] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isSiswa, setIsSiswa] = useState(false);
    const [userKelasList, setUserKelasList] = useState<string[]>([]);
    const [kelasWarning, setKelasWarning] = useState('');

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            const userData = await getUserByAuthId(session.user.id);
            if (userData) {
                setUser(userData);
                const siswa = userData.role === 'SISWA' || userData.role === 'WALI_SISWA';
                setIsSiswa(siswa);
                setFormData(prev => ({
                    ...prev,
                    created_by: userData.nama,
                    nisn: userData.nip || '',
                    filled_by: siswa ? 'SISWA' : 'GURU'
                }));
                // Ambil kelas scope user untuk dropdown kelas
                const nip = userData.nip;
                if (nip) {
                    try {
                        // Untuk siswa: cari kelas dari siswa_kelas berdasarkan NISN
                        if (siswa) {
                            const { data: siswaData } = await supabase
                                .from('siswa_kelas')
                                .select('kelas')
                                .eq('nisn', nip)
                                .eq('aktif', true)
                                .limit(1);
                            if (siswaData && siswaData.length > 0) {
                                const siswaKelas = [...new Set(siswaData.map((s: any) => s.kelas))];
                                setUserKelasList(siswaKelas);
                                setFormData((prev: any) => ({ ...prev, kelas: siswaKelas[0] }));
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

        const activeSchedules = (masterData.jadwal || []).filter((j: any) => {
            const matchGuru = (j.nip && formData.nip && String(j.nip) === String(formData.nip)) || 
                             (j.nama_guru?.trim().toLowerCase() === formData.nama_guru?.trim().toLowerCase());
            return matchGuru &&
                j.hari?.trim().toLowerCase() === dayName.toLowerCase() &&
                j.aktif &&
                (!j.berlaku_mulai || j.berlaku_mulai <= formData.tanggal) &&
                (!j.berlaku_selesai || j.berlaku_selesai >= formData.tanggal);
        });

        const scheduleMap = new Map<string, any>();
        activeSchedules.forEach((j: any) => {
            const jam = parseInt(j.jam_ke);
            const key = `${jam}-${j.kelas?.trim()}`;
            // Jika jam dan kelas sama, gunakan jadwal dengan berlaku_mulai terbaru
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
            const classSchedules = (masterData.jadwal || []).filter((j: any) =>
                j.kelas?.trim().toLowerCase() === formData.kelas?.trim().toLowerCase() &&
                j.hari?.trim().toLowerCase() === dayName.toLowerCase() &&
                j.aktif &&
                (!j.berlaku_mulai || j.berlaku_mulai <= formData.tanggal) &&
                (!j.berlaku_selesai || j.berlaku_selesai >= formData.tanggal)
            );
            const classMap = new Map<number, any>();
            classSchedules.forEach((j: any) => {
                const jam = parseInt(j.jam_ke);
                if (!classMap.has(jam) || (j.berlaku_mulai && j.berlaku_mulai > (classMap.get(jam).berlaku_mulai || ''))) {
                    classMap.set(jam, j);
                }
            });
            const uniqueMapels = [...new Set(Array.from(classMap.values()).map(s => s.mata_pelajaran || s.mapel))].sort();
            if (uniqueMapels.length > 0) {
                availableMapels = uniqueMapels.map(m => ({ value: m, label: m }));
            }
        }
        setMapelOptions(availableMapels);

        let availableJams: any[] = [];
        if (formData.kelas && formData.mata_pelajaran) {
            const classSchedules = (masterData.jadwal || []).filter((j: any) =>
                j.kelas === formData.kelas &&
                j.hari === dayName &&
                j.aktif &&
                (!j.berlaku_mulai || j.berlaku_mulai <= formData.tanggal)
            );
            const classMap = new Map<number, any>();
            classSchedules.forEach((j: any) => {
                const jam = parseInt(j.jam_ke);
                if (!classMap.has(jam) || (j.berlaku_mulai && j.berlaku_mulai > (classMap.get(jam).berlaku_mulai || ''))) {
                    classMap.set(jam, j);
                }
            });
            const classDaySchedule = Array.from(classMap.values());
            const sessions = classDaySchedule.filter(s => (s.mata_pelajaran || s.mapel) === formData.mata_pelajaran);
            const classProgram = masterData.kelas.find((k: any) => k.nama === formData.kelas)?.program || 'Reguler';

            if (sessions.length > 0) {
                availableJams = sessions.sort((a, b) => parseInt(a.jam_ke) - parseInt(b.jam_ke)).map(s => {
                    const jamNum = parseInt(s.jam_ke);
                    const timeSlot = (masterData.waktu || []).find(
                        (w: any) => String(w.jam_ke) === String(s.jam_ke) &&
                            w.hari === dayName &&
                            (w.program || 'Reguler') === (classProgram || 'Reguler')
                    );
                    const timeStr = timeSlot ? `${timeSlot.mulai?.slice(0, 5)} - ${timeSlot.selesai?.slice(0, 5)}` : 'Waktu?';
                    return { value: jamNum.toString(), label: `Jam Ke-${jamNum}`, id: jamNum, timeStr: timeStr };
                });
            } else {
                const programWaktu = (masterData.waktu || []).filter((w: any) =>
                    w.hari === dayName && (w.program || 'Reguler') === (classProgram || 'Reguler')
                );
                availableJams = Array.from(new Set(programWaktu.map((w: any) => w.jam_ke)))
                    .sort((a: any, b: any) => parseInt(a) - parseInt(b))
                    .map((jam: any) => {
                        const slot = programWaktu.find((w: any) => w.jam_ke === jam);
                        return {
                            value: jam.toString(), label: `Jam Ke-${jam}`, id: parseInt(jam),
                            timeStr: slot ? `${slot.mulai?.slice(0, 5)} - ${slot.selesai?.slice(0, 5)}` : '--:--'
                        };
                    });
            }
        }
        setJamOptions(availableJams.length > 1 ? [{ value: 'all', label: '--- PILIH SEMUA JAM ---', isAll: true }, ...availableJams] : availableJams);
    }, [formData.tanggal, formData.nama_guru, formData.kelas, formData.mata_pelajaran, masterData, loadingMaster, userKelasList]);

    const [existingJurnal, setExistingJurnal] = useState<any>(null);

    useEffect(() => {
        const checkExisting = async () => {
            if (!formData.nip || !formData.tanggal || !formData.kelas || selectedHours.length === 0) {
                setExistingJurnal(null);
                return;
            }

            try {
                const jamParam = selectedHours.join(',');
                const res = await fetch(`/api/jurnal/check-slot?tanggal=${formData.tanggal}&kelas=${formData.kelas}&jam_ke_id=${jamParam}`);
                const result = await res.json();

                if (result.ok && result.data) {
                    setExistingJurnal(result.data);
                    setFormData((prev: any) => ({
                        ...prev,
                        materi: !isEmpty(result.data.materi) ? result.data.materi : prev.materi,
                        refleksi: !isEmpty(result.data.refleksi) ? result.data.refleksi : prev.refleksi,
                        kategori_kehadiran: result.data.kategori_kehadiran || prev.kategori_kehadiran,
                        guru_pengganti: result.data.guru_pengganti || prev.guru_pengganti,
                        status_pengganti: result.data.status_pengganti || prev.status_pengganti,
                        keterangan_terlambat: result.data.keterangan_terlambat || prev.keterangan_terlambat,
                        keterangan_tambahan: result.data.keterangan_tambahan || prev.keterangan_tambahan,
                        guru_piket: result.data.guru_piket || prev.guru_piket
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

    const updateForm = (key: string, value: any) => {
        setFormData((prev: any) => {
            const next = { ...prev, [key]: value };
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

    const handleJamChange = (selectedOptions: any) => {
        if (!selectedOptions) { setSelectedHours([]); return; }
        const allOption = selectedOptions.find((o: any) => o.isAll);
        if (allOption) {
            const allHours = jamOptions.filter(o => !o.isAll).map(o => parseInt(o.value));
            setSelectedHours(allHours);
        } else {
            setSelectedHours(selectedOptions.map((o: any) => parseInt(o.value)));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nip || !formData.tanggal || selectedHours.length === 0 || !formData.kelas || !formData.mata_pelajaran) {
            Swal.fire('Perhatian', 'Mohon lengkapi data wajib (Guru, Tanggal, Jam, Kelas, Mapel)!', 'warning');
            return;
        }

        const currentKategori = (formData.kategori_kehadiran || 'Sesuai').toLowerCase().trim();
        const exceptions = ['sesuai', 'kosong', 'penugasan tanpa pendampingan', 'digabung', 'terlambat'];
        const isPenggantiRequired = !exceptions.includes(currentKategori);

        if (isPenggantiRequired && (formData.guru_pengganti === '-' || formData.status_pengganti === '-')) {
            Swal.fire('Perhatian', 'Guru Pengganti dan Status Kehadiran wajib diisi!', 'warning');
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
            if (result.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jurnal Pembelajaran berhasil disimpan', timer: 2000, showConfirmButton: false });

                // Reload data from DB after successful submit
                const reloadRes = await fetch(`/api/jurnal/check-slot?tanggal=${formData.tanggal}&kelas=${formData.kelas}&jam_ke_id=${selectedHours.join(',')}`);
                const reloadResult = await reloadRes.json();

                if (reloadResult.ok && reloadResult.data) {
                    setExistingJurnal(reloadResult.data);
                    setFormData((prev: any) => ({
                        ...prev,
                        materi: !isEmpty(reloadResult.data.materi) ? reloadResult.data.materi : prev.materi,
                        refleksi: !isEmpty(reloadResult.data.refleksi) ? reloadResult.data.refleksi : prev.refleksi,
                        kategori_kehadiran: reloadResult.data.kategori_kehadiran || prev.kategori_kehadiran,
                        guru_pengganti: reloadResult.data.guru_pengganti || prev.guru_pengganti,
                        status_pengganti: reloadResult.data.status_pengganti || prev.status_pengganti,
                        keterangan_terlambat: reloadResult.data.keterangan_terlambat || prev.keterangan_terlambat,
                        keterangan_tambahan: reloadResult.data.keterangan_tambahan || prev.keterangan_tambahan,
                        guru_piket: reloadResult.data.guru_piket || prev.guru_piket
                    }));
                }
            } else {
                throw new Error(result.error);
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
            { value: 'Diganti', label: 'Diganti' },
            { value: 'Tidak Hadir', label: 'Tidak Hadir' }
        ];

    const statusPenggantiOptions = kategoriKehadiranOptions.filter(
        (opt: any) => (opt.value || '').toLowerCase().trim() !== (formData.kategori_kehadiran || '').toLowerCase().trim()
    );

    const isPenggantiCategory = !['sesuai', 'kosong', 'penugasan tanpa pendampingan', 'digabung', 'terlambat'].includes(
        (formData.kategori_kehadiran || '').toLowerCase().trim()
    );

    const guruOptions = masterData.guru.map((g: any) => ({ value: g.nama_lengkap, label: g.nama_lengkap, nip: g.nip }));

    // Hide the vertical separator line between value and dropdown arrow in all Select instances
    const HideSeparator = () => null;
    const customComponents = { Separator: HideSeparator };

    const filterOption = (candidate: any, rawInput: string) => {
        if (!rawInput) return true;
        const input = rawInput.toLowerCase();
        return candidate.label.toLowerCase().includes(input);
    };

    const customSelectStyles = {
        control: (base: any, state: any) => ({
            ...base,
            borderRadius: '12px',
            border: state.isFocused ? '1.5px solid var(--n-primary)' : '1.5px solid var(--n-border)',
            padding: '2px 4px',
            fontSize: '14px',
            backgroundColor: 'var(--n-card)',
            color: 'var(--n-ink)',
            boxShadow: state.isFocused ? '0 0 0 4px rgba(79, 142, 247, 0.12)' : 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: '45px',
            '&:hover': {
                borderColor: state.isFocused ? 'var(--n-primary)' : 'var(--n-muted)'
            }
        }),
        menu: (base: any) => ({
            ...base,
            backgroundColor: 'var(--n-card)',
            border: '1px solid var(--n-border)',
            borderRadius: '14px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            zIndex: 9999,
            overflow: 'hidden',
            marginTop: '8px',
            animation: 'scaleIn 0.2s ease-out'
        }),
        menuList: (base: any) => ({ ...base, padding: '6px' }),
        option: (base: any, state: any) => ({
            ...base,
            backgroundColor: state.isSelected ? 'var(--n-primary)' : state.isFocused ? 'var(--n-soft)' : 'transparent',
            color: state.isSelected ? '#fff' : 'var(--n-ink)',
            fontSize: '14px',
            fontWeight: state.isSelected ? '600' : '400',
            borderRadius: '10px',
            margin: '2px 0',
            padding: '10px 12px',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
            '&:active': {
                backgroundColor: 'var(--n-soft)'
            }
        }),
        singleValue: (base: any) => ({
            ...base,
            color: 'var(--n-ink)',
            fontSize: '14px'
        }),
        placeholder: (base: any) => ({
            ...base,
            color: 'var(--n-muted)',
            fontSize: '14px'
        }),
        dropdownIndicator: (base: any) => ({ ...base, color: 'var(--n-muted)', '&:hover': { color: 'var(--n-primary)' } }),
        clearIndicator: (base: any) => ({ ...base, color: 'var(--n-muted)', '&:hover': { color: '#ef4444' } }),
        input: (base: any) => ({ ...base, color: 'var(--n-ink)', fontSize: '14px' }),
        multiValue: (base: any) => ({
            ...base,
            backgroundColor: 'var(--n-soft)',
            borderRadius: '8px',
            border: '1px solid var(--n-border)',
            padding: '2px'
        }),
        multiValueLabel: (base: any) => ({
            ...base,
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--n-primary)',
            padding: '0 8px'
        }),
        multiValueRemove: (base: any) => ({
            ...base,
            color: 'var(--n-muted)',
            borderRadius: '6px',
            marginLeft: '4px',
            '&:hover': {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
            }
        })
    };

    if (loading) {
        return (
            <div className="jp">
                <div className="jp__loadingCard">
                    <div className="jp-spinner"></div>
                    <span className="jp-loading-text">Memuat data...</span>
                </div>
            </div>
        );
    }

    return (
        <PermissionGuard requiredPermission={{ resource: 'jurnal', action: 'create' }}>
            <div className="jp">
                <div className="jp__header">
                    <div>
                        <h1>Jurnal Pembelajaran</h1>
                        <p>{isSiswa ? 'Laporkan pembelajaran yang diikuti' : 'Catat kegiatan belajar mengajar harian'}</p>
                    </div>
                </div>

                <div className="jp__card">
                    <form onSubmit={handleSubmit} className="jp__form">
                        <div className="jp__grid">
                            <div className="jp__section">
                                <h3 className="jp__sectionTitle"><i className="bi bi-person-badge"></i> Identitas Pengisi</h3>

                                <div className="jp__identityBadge">
                                    <i className="bi bi-person-fill"></i>
                                    <div className="jp__badgeContent">
                                        <span className="jp__badgeName">{formData.created_by}</span>
                                        <span className="jp__badgeId">{formData.nisn}</span>
                                    </div>
                                </div>

                                <h3 className="jp__sectionTitle" style={{marginTop: '16px'}}><i className="bi bi-chalkboard-teacher"></i> Pilih Guru & Jadwal</h3>

                                <div className="jp__field">
                                    <label>Nama Guru</label>
                                    <Select
                                        instanceId="select-guru-jurnal"
                                        options={guruOptions}
                                        placeholder={loadingMaster ? "Memuat..." : "Ketik nama guru..."}
                                        value={guruOptions.find((g: any) => g.value === formData.nama_guru)}
                                        onChange={(opt: any) => updateForm('nama_guru', opt?.value)}
                                        isLoading={loadingMaster}
                                        styles={customSelectStyles}
                                        components={customComponents}
                                        filterOption={filterOption}
                                        menuPlacement="auto"
                                    />
                                </div>

                                <div className="jp__row">
                                    <div className="jp__field">
                                        <label>Tanggal</label>
                                        <input
                                            type="date"
                                            className="jp__input"
                                            value={formData.tanggal}
                                            onChange={(e) => updateForm('tanggal', e.target.value)}
                                        />
                                    </div>
                                    <div className="jp__field">
                                        <label>Kelas</label>
                                        <Select
                                            instanceId="select-kelas-jurnal"
                                            options={kelasOptions}
                                            value={kelasOptions.find((k: any) => k.value === formData.kelas)}
                                            placeholder="Ketik nama kelas..."
                                            onChange={(opt: any) => updateForm('kelas', opt?.value)}
                                            styles={customSelectStyles}
                                            components={customComponents}
                                            isDisabled={kelasOptions.length === 0}
                                            filterOption={filterOption}
                                            menuPlacement="auto"
                                        />
                                        {kelasWarning && (
                                            <div className="jp__kelasWarning jp__slideDown">{kelasWarning}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="jp__field">
                                    <label>Mata Pelajaran</label>
                                    <Select
                                        instanceId="select-mapel-jurnal"
                                        options={mapelOptions}
                                        value={mapelOptions.find((m: any) => m.value === formData.mata_pelajaran)}
                                        placeholder="Ketik nama mapel..."
                                        onChange={(opt: any) => updateForm('mata_pelajaran', opt?.value)}
                                        styles={customSelectStyles}
                                        components={customComponents}
                                        isDisabled={!formData.kelas || mapelOptions.length === 0}
                                        isLoading={loadingMaster}
                                        filterOption={filterOption}
                                        menuPlacement="auto"
                                    />
                                </div>

                                <div className="jp__field">
                                    <label>Jam Ke</label>
                                    <Select
                                        instanceId="select-jam-jurnal"
                                        isMulti
                                        options={jamOptions}
                                        value={jamOptions.filter(o => !o.isAll && selectedHours.includes(parseInt(o.value)))}
                                        onChange={handleJamChange}
                                        placeholder="Pilih jam..."
                                        styles={customSelectStyles}
                                        filterOption={filterOption}
                                        components={customComponents}
                                        isDisabled={!formData.mata_pelajaran || jamOptions.length === 0}
                                        isLoading={loadingMaster}
                                        menuPlacement="auto"
                                        formatOptionLabel={(opt: any) => (
                                            <div className="jp__jamOption">
                                                <span className={opt.isAll ? "jp__jamAll" : ""}>{opt.label}</span>
                                                {!opt.isAll && <span className="jp__jamTime">{opt.timeStr}</span>}
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="jp__section">
                                <h3 className="jp__sectionTitle"><i className="bi bi-check2-circle"></i> Status Kehadiran</h3>

                                <div className="jp__field">
                                    <label>Status</label>
                                    <Select
                                        instanceId="select-kategori-jurnal"
                                        options={kategoriKehadiranOptions}
                                        value={kategoriKehadiranOptions.find((k: any) => k.value === formData.kategori_kehadiran)}
                                        onChange={(opt: any) => updateForm('kategori_kehadiran', opt?.value)}
                                        styles={customSelectStyles}
                                        components={customComponents}
                                        filterOption={filterOption}
                                    />
                                </div>

                                {formData.kategori_kehadiran === 'Terlambat' && (
                                    <div className="jp__field jp__slideDown">
                                        <label>Durasi Terlambat <span className="jp__optional">(menit)</span></label>
                                        <input
                                            type="number"
                                            className="jp__input"
                                            value={formData.durasi_terlambat}
                                            onChange={(e) => updateForm('durasi_terlambat', e.target.value)}
                                            placeholder="Contoh: 15"
                                            min="1"
                                            max="480"
                                        />
                                    </div>
                                )}

                                {isPenggantiCategory && (
                                    <div className="jp__penggantiSection jp__slideDown">
                                        <div className="jp__field">
                                            <label>Guru Pengganti / Mitra</label>
                                            <Select
                                                instanceId="select-pengganti-jurnal"
                                                options={guruOptions}
                                                value={guruOptions.find((g: any) => g.value === formData.guru_pengganti)}
                                                onChange={(opt: any) => updateForm('guru_pengganti', opt?.value)}
                                                styles={customSelectStyles}
                                                components={customComponents}
                                                filterOption={filterOption}
                                            />
                                        </div>
                                        <div className="jp__field">
                                            <label>Status Kehadiran Pengganti</label>
                                            <Select
                                                instanceId="select-status-pengganti-jurnal"
                                                options={statusPenggantiOptions}
                                                value={statusPenggantiOptions.find((s: any) => s.value === formData.status_pengganti)}
                                                onChange={(opt: any) => updateForm('status_pengganti', opt?.value)}
                                                styles={customSelectStyles}
                                                components={customComponents}
                                                filterOption={filterOption}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="jp__field">
                                    <label>Guru Piket <span className="jp__optional">(Opsional)</span></label>
                                    <Select
                                        instanceId="select-piket-jurnal"
                                        options={guruOptions}
                                        value={guruOptions.find((g: any) => g.value === formData.guru_piket)}
                                        onChange={(opt: any) => updateForm('guru_piket', opt?.value)}
                                        placeholder="Ketik nama guru piket..."
                                        styles={customSelectStyles}
                                        components={customComponents}
                                        isClearable
                                        filterOption={filterOption}
                                    />
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
                                    onChange={(e) => updateForm('materi', e.target.value)}
                                    placeholder="Contoh: Bab 3 - Persamaan Kuadrat..."
                                    rows={3}
                                    disabled={isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') && !isEmpty(existingJurnal?.materi)}
                                />
                            </div>

                            <div className="jp__field">
                                <label>Refleksi / Catatan Tambahan</label>
                                <textarea
                                    className={`jp__textarea ${isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') && !isEmpty(existingJurnal?.refleksi) ? 'jp__disabled' : ''}`}
                                    value={formData.refleksi}
                                    onChange={(e) => updateForm('refleksi', e.target.value)}
                                    placeholder="Catatan hasil belajar atau hal penting lainnya..."
                                    rows={3}
                                    disabled={isSiswa && (existingJurnal?.filled_by === 'GURU' || existingJurnal?.filled_by === 'ADMIN') && !isEmpty(existingJurnal?.refleksi)}
                                />
                            </div>

                            <div className="jp__field">
                                <label>Keterangan Lainnya <span className="jp__optional">(Opsional)</span></label>
                                <input
                                    type="text"
                                    className="jp__input"
                                    value={formData.keterangan_tambahan}
                                    onChange={(e) => updateForm('keterangan_tambahan', e.target.value)}
                                    placeholder="Catatan tambahan..."
                                />
                            </div>
                        </div>

                        <div className="jp__footer">
                            <div className="jp__info">
                                <i className="bi bi-info-circle"></i>
                                {selectedHours.length > 0 ? ` Menyimpan ${selectedHours.length} blok jam.` : ' Lengkapi data untuk mengirim.'}
                            </div>
                            <button
                                type="submit"
                                className="jp__submit"
                                disabled={submitting || selectedHours.length === 0}
                            >
                                {submitting ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> Memproses...</>
                                ) : (
                                    <><i className="bi bi-send-fill"></i> Submit Jurnal</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .jp {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 24px 16px;
                    animation: fadeIn 0.4s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .jp__header {
                    margin-bottom: 16px;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%);
                    border-radius: 20px;
                    color: white;
                }
                .jp__header h1 {
                    font-size: 1.35rem;
                    font-weight: 800;
                    margin: 0;
                    letter-spacing: -0.02em;
                }
                .jp__header p {
                    font-size: 0.85rem;
                    opacity: 0.9;
                    margin: 6px 0 0;
                    font-weight: 500;
                }

                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.98) translateY(-10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .jp__card {
                    background: var(--n-card);
                    border-radius: 24px;
                    padding: 28px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
                    border: 1px solid var(--n-border);
                    transition: all 0.3s ease;
                }
                :global(.dark) .jp__card {
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
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
                    font-size: 0.85rem;
                    font-weight: 600;
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
                    font-size: 0.9rem;
                }
                .jp__identityBadge i {
                    color: var(--n-primary);
                    font-size: 1rem;
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                }
                .jp__badgeContent {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .jp__badgeName {
                    font-weight: 600;
                    color: var(--n-ink);
                    font-size: 0.9rem;
                    text-align: left;
                }
                .jp__badgeId {
                    color: var(--n-muted);
                    font-size: 0.78rem;
                    text-align: left;
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
                    border-color: #94a3b8;
                }
                .jp__input:focus {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.08);
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
                    border-color: #94a3b8;
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
                .jp__submit {
                    background: linear-gradient(135deg, var(--n-primary) 0%, var(--n-primary-light) 100%);
                    color: white;
                    border: none;
                    padding: 14px 32px;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s;
                }
                .jp__submit:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(79, 142, 247, 0.35);
                }
                .jp__submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
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

                .jp__loadingCard {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 60vh;
                    gap: 14px;
                    background: var(--n-card);
                    border-radius: 24px;
                    box-shadow: var(--n-shadow);
                    border: 1px solid var(--n-border);
                }

                .jp-spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid rgba(79, 142, 247, 0.12);
                    border-top-color: var(--n-primary);
                    border-radius: 50%;
                    animation: jpSpin 0.8s linear infinite;
                }

                .jp-loading-text {
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }

                @keyframes jpSpin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 768px) {
                    .jp {
                        padding: 12px 6px;
                    }
                    .jp__header {
                        padding: 14px;
                        border-radius: 14px;
                    }
                    .jp__header h1 {
                        font-size: 1.2rem;
                    }
                    .jp__card {
                        padding: 14px;
                        border-radius: 14px;
                    }
                    .jp__grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    .jp__row {
                        grid-template-columns: 1fr;
                    }
                    .jp__input[type="date"] {
                        width: 100%;
                        min-width: 0;
                    }
                    .jp__detailSection {
                        padding: 16px;
                        border-radius: 14px;
                    }
                    .jp__footer {
                        flex-direction: column;
                        gap: 16px;
                        align-items: stretch;
                    }
                    .jp__info {
                        justify-content: center;
                    }
                    .jp__submit {
                        width: 100%;
                        justify-content: center;
                    }
                }

                @media (min-width: 1024px) {
                    .jp__card {
                        padding: 32px;
                    }
                }
                :global(.dark) .jp__penggantiSection { background: var(--n-card); }
                :global(.dark) .jp__identityBadge { background: #1e293b; border-color: rgba(255,255,255,0.1); }
                :global(.dark) .jp__kelasWarning {
                    background: rgba(239, 68, 68, 0.15);
                    border-color: rgba(239, 68, 68, 0.4);
                    color: #fca5a5;
                }
                :global(.dark) .jp__badgeId { color: #94a3b8; }
                :global(.dark) .jp__textarea { background: #1e293b; border-color: rgba(255,255,255,0.12); color: #e8edf5; }
                :global(.dark) .jp__textarea::placeholder { color: #94a3b8; }
                :global(.dark) .jp__textarea.jp__disabled { background: rgba(255,255,255,0.04); }
                :global(.dark) .jp__detailSection { background: rgba(255,255,255,0.03); }
                :global(.dark) .jp__jamAll { color: #60a5fa; }
                :global(.dark) .jp__jamTime { background: rgba(255,255,255,0.06); color: #94a3b8; }
                :global(.dark) .jp__locked { background: rgba(239,68,68,0.12); color: #f87171; }
                :global(.dark) .jp__editable { background: rgba(34,197,94,0.12); color: #4ade80; }
                :global(.dark) .jp__lockedInfo { color: #94a3b8; }
                :global(.dark) .jp__editInfo { color: #4ade80; }
                :global(.dark) .jp__loadingCard { background: #0f172a; border-color: rgba(255,255,255,0.1); }
                :global(.dark) .jp-loading-text { color: #94a3b8; }
                :global(.dark) .jp__penggantiSection { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.1); }
                :global(.dark) .jp__info { color: #94a3b8; }
                :global(.dark) .jp__sectionTitle { color: #94a3b8; }
                :global(.dark) .jp__sectionTitle i { color: #60a5fa; }
                :global(.dark) .jp__label { color: #94a3b8; }
                :global(.dark) .jp__value { color: #e8edf5; }
            `}</style>
        </PermissionGuard>
    );
}
