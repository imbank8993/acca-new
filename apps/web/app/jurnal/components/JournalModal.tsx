'use client';

import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Journal } from '../types';
import { useTimezone } from '@/hooks/use-timezone';

interface JournalModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'add' | 'edit';
    initialData: Journal | null;
    user: any;
    masterData: {
        guru: any[];
        mapel: any[];
        kelas: any[];
        waktu: any[];
        jadwal: any[];
        dropdown: any; // { terlambat, statusPengganti, jenisKetidakhadiran, kategoriKehadiran }
    };
    onSuccess: () => void;
    limited?: boolean;
    minDate?: string;
    maxDate?: string;
}

const normalizeKategori = (val?: string) => {
    if (!val) return 'Sesuai';
    const s = val.trim().toLowerCase();
    if (s === 'normal' || s === 'sesuai' || s === 'hadir') return 'Sesuai';
    if (s === 'terlambat') return 'Terlambat';
    if (s === 'tukaran') return 'Tukaran';
    if (s === 'diganti') return 'Diganti';
    if (s === 'tidak hadir') return 'Tidak Hadir';
    if (s === 'kosong') return 'Kosong';
    return val;
};

const normalizeStatusPengganti = (val?: string) => {
    if (!val || val === '-') return '';
    const s = val.trim().toLowerCase();
    if (s === 'sesuai' || s === 'hadir' || s === 'normal') return 'Sesuai';
    if (s === 'terlambat') return 'Terlambat';
    if (s === 'tukaran') return 'Tukaran';
    if (s === 'diganti') return 'Diganti';
    if (s === 'tidak hadir') return 'Tidak Hadir';
    return val;
};

const parseInitialHours = (data: any): number[] => {
    if (!data) return [];

    // 1. Coba baca dari array jamIds (dibuat oleh grouping displayGroups di tabel)
    if (Array.isArray(data.jamIds) && data.jamIds.length > 0) {
        const valid = data.jamIds
            .map((n: any) => parseInt(String(n), 10))
            .filter(Number.isFinite);
        if (valid.length > 0) return Array.from(new Set(valid));
    }

    // 2. Coba baca dari jam_ke_id
    if (data.jam_ke_id != null && Number.isFinite(Number(data.jam_ke_id))) {
        return [Number(data.jam_ke_id)];
    }

    // 3. Coba parsing jam_ke teks (mis. "11-12", "Jam Ke-10", "1, 2")
    if (data.jam_ke) {
        const txt = String(data.jam_ke).trim();

        // Abaikan format jam dinding seperti "07:40 - 08:20"
        if (!txt.includes(':')) {
            // Rentang seperti "1-3" atau "11-12"
            const rangeMatch = txt.match(/(\d+)\s*-\s*(\d+)/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10);
                const end = parseInt(rangeMatch[2], 10);
                if (start <= end && end - start <= 15) {
                    const res: number[] = [];
                    for (let i = start; i <= end; i++) res.push(i);
                    return res;
                }
            }

            // Ekstrak semua angka di dalam teks (mis. "Jam Ke-6" -> [6], "1, 2" -> [1, 2])
            const numbers = (txt.match(/\d+/g) || [])
                .map(n => parseInt(n, 10))
                .filter(Number.isFinite);
            if (numbers.length > 0) return Array.from(new Set(numbers));
        }
    }

    return [];
};

const getInitialFormData = (data: any) => {
    if (!data) {
        return {
            tanggal: '',
            hari: '',
            kategori_kehadiran: 'Sesuai',
            nama_guru: '',
            nip: '',
            kelas: '',
            mata_pelajaran: '',
            materi: '',
            refleksi: '',
            guru_pengganti: '',
            status_pengganti: '',
            guru_piket: '',
            keterangan_tambahan: '',
            durasi_terlambat: '',
            durasi_keluar_awal: '',
            status_tambahan_1: '',
            status_tambahan_2: '',
            status_tambahan_3: '',
        };
    }
    const cleanTanggal = data.tanggal ? String(data.tanggal).split('T')[0] : '';
    return {
        ...data,
        tanggal: cleanTanggal,
        hari: data.hari || '',
        kelas: data.kelas || '',
        mata_pelajaran: data.mata_pelajaran || '',
        nama_guru: data.nama_guru || '',
        nip: data.nip || '',
        kategori_kehadiran: normalizeKategori(data.kategori_kehadiran),
        status_pengganti: normalizeStatusPengganti(data.status_pengganti),
        guru_pengganti: data.guru_pengganti === '-' ? '' : (data.guru_pengganti || ''),
        guru_piket: data.guru_piket === '-' ? '' : (data.guru_piket || ''),
        durasi_terlambat: data.durasi_terlambat != null ? String(data.durasi_terlambat) : '',
        durasi_keluar_awal: data.durasi_keluar_awal != null ? String(data.durasi_keluar_awal) : '',
        status_tambahan_1: data.status_tambahan_1 || '',
        status_tambahan_2: data.status_tambahan_2 || '',
        status_tambahan_3: data.status_tambahan_3 || '',
        keterangan_tambahan: data.keterangan_tambahan || '',
        materi: data.materi || '',
        refleksi: data.refleksi || '',
    };
};

const statusTambahanOptions = [
    { value: '', label: '-- Tidak Ada --' },
    { value: 'Sakit', label: 'Sakit' },
    { value: 'Izin', label: 'Izin' },
    { value: 'Tugas', label: 'Tugas' },
    { value: 'Meeting', label: 'Meeting' },
];

export default function JournalModal({
    isOpen,
    onClose,
    mode,
    initialData,
    user,
    masterData,
    onSuccess,
    limited = false,
    minDate,
    maxDate
}: JournalModalProps) {
    const { getCurrentDate: getTzDate } = useTimezone();

    const [formData, setFormData] = useState<any>(() => getInitialFormData(initialData));
    const [selectedHours, setSelectedHours] = useState<number[]>(() => parseInitialHours(initialData));
    const [loading, setLoading] = useState(false);

    // Sinkronisasi ulang saat modal dibuka atau initialData berganti
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData(initialData));
            setSelectedHours(parseInitialHours(initialData));
        }
    }, [isOpen, initialData]);

    // Inisialisasi tanggal jika form baru (add)
    useEffect(() => {
        const initDate = async () => {
            if (!formData.tanggal && mode === 'add') {
                const today = await getTzDate();
                if (today) {
                    let initVal = today;
                    if (minDate && initVal < minDate) initVal = minDate;
                    if (maxDate && initVal > maxDate) initVal = maxDate;
                    setFormData((prev: any) => ({ ...prev, tanggal: initVal }));
                }
            }
        };
        initDate();
    }, [getTzDate, minDate, maxDate, formData.tanggal, mode]);

    // -------------------------------------------------------------------------
    // Opsi Guru
    // -------------------------------------------------------------------------
    const guruOptions = useMemo(() => {
        const list = (masterData?.guru || []).map((g: any) => ({
            value: g.nama_lengkap,
            label: g.nama_lengkap,
            nip: g.nip
        }));
        if (formData.nama_guru && !list.some((g: any) => g.value === formData.nama_guru)) {
            list.unshift({ value: formData.nama_guru, label: formData.nama_guru, nip: formData.nip || '' });
        }
        return list;
    }, [masterData?.guru, formData.nama_guru, formData.nip]);

    const guruPenggantiOptions = useMemo(() => {
        const list = [...guruOptions];
        if (formData.guru_pengganti && formData.guru_pengganti !== '-' && !list.some((g: any) => g.value === formData.guru_pengganti)) {
            list.unshift({ value: formData.guru_pengganti, label: formData.guru_pengganti, nip: '' });
        }
        return list;
    }, [guruOptions, formData.guru_pengganti]);

    const guruPiketOptions = useMemo(() => {
        const list = [...guruOptions];
        if (formData.guru_piket && formData.guru_piket !== '-' && !list.some((g: any) => g.value === formData.guru_piket)) {
            list.unshift({ value: formData.guru_piket, label: formData.guru_piket, nip: '' });
        }
        return list;
    }, [guruOptions, formData.guru_piket]);

    // -------------------------------------------------------------------------
    // Kalkulasi Hari & Jadwal Rutin Guru
    // -------------------------------------------------------------------------
    const cleanDate = formData.tanggal ? String(formData.tanggal).split('T')[0] : '';
    const dayName = useMemo(() => {
        if (formData.hari) return formData.hari;
        if (!cleanDate) return '';
        const parts = cleanDate.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            return days[dateObj.getDay()] || '';
        }
        return '';
    }, [formData.hari, cleanDate]);

    const teacherDaySchedule = useMemo(() => {
        if (!masterData?.jadwal) return [];
        const schedules = (masterData.jadwal || []).filter((j: any) =>
            (j.nip && formData.nip ? j.nip === formData.nip : j.nama_guru === formData.nama_guru) &&
            (dayName ? j.hari === dayName : true) &&
            j.aktif &&
            (!j.berlaku_mulai || j.berlaku_mulai <= cleanDate)
        );
        const map = new Map<number, any>();
        schedules.forEach((j: any) => {
            const jam = parseInt(j.jam_ke, 10);
            if (!map.has(jam) || (j.berlaku_mulai && j.berlaku_mulai > (map.get(jam).berlaku_mulai || ''))) {
                map.set(jam, j);
            }
        });
        return Array.from(map.values());
    }, [masterData?.jadwal, formData.nip, formData.nama_guru, dayName, cleanDate]);

    // -------------------------------------------------------------------------
    // Opsi Kelas
    // -------------------------------------------------------------------------
    const kelasOptions = useMemo(() => {
        let list = (masterData?.kelas || []).map((k: any) => ({ value: k.nama, label: k.nama }));
        if (teacherDaySchedule.length > 0) {
            const unique = Array.from(new Set(teacherDaySchedule.map(s => s.kelas))).sort();
            list = unique.map(k => ({ value: k, label: k }));
        }
        // Pastikan kelas asal yang sedang diedit SELALU ada di daftar
        if (formData.kelas && !list.some(k => k.value === formData.kelas)) {
            list.unshift({ value: formData.kelas, label: formData.kelas });
        }
        return list;
    }, [masterData?.kelas, teacherDaySchedule, formData.kelas]);

    // -------------------------------------------------------------------------
    // Opsi Mata Pelajaran
    // -------------------------------------------------------------------------
    const mapelOptions = useMemo(() => {
        let list: any[] = [];
        if (formData.kelas) {
            const classSchedules = teacherDaySchedule.filter(s => s.kelas === formData.kelas);
            if (classSchedules.length > 0) {
                const uniqueMapels = Array.from(new Set(classSchedules.map(s => s.mata_pelajaran))).sort();
                list = uniqueMapels.map(m => ({ value: m, label: m }));
            } else {
                list = (masterData?.mapel || []).map((m: any) => ({ value: m.nama, label: m.nama }));
            }
        } else {
            list = (masterData?.mapel || []).map((m: any) => ({ value: m.nama, label: m.nama }));
        }
        // Pastikan mata pelajaran asal SELALU ada di daftar
        if (formData.mata_pelajaran && !list.some(m => m.value === formData.mata_pelajaran)) {
            list.unshift({ value: formData.mata_pelajaran, label: formData.mata_pelajaran });
        }
        return list;
    }, [masterData?.mapel, teacherDaySchedule, formData.kelas, formData.mata_pelajaran]);

    // -------------------------------------------------------------------------
    // Opsi Jam Ke
    // -------------------------------------------------------------------------
    const jamOptions = useMemo(() => {
        let availableJams: any[] = [];
        const classProgram = masterData?.kelas?.find((k: any) => k.nama === formData.kelas)?.program || 'Reguler';

        const formatTimeStr = (w: any) => {
            if (!w?.mulai || !w?.selesai) return '';
            const m = String(w.mulai).includes('T') ? String(w.mulai).substring(11, 16) : String(w.mulai).slice(0, 5);
            const s = String(w.selesai).includes('T') ? String(w.selesai).substring(11, 16) : String(w.selesai).slice(0, 5);
            return `${m} - ${s}`;
        };

        // 1. Jadwal rutin guru ini di kelas & mapel ini
        if (formData.kelas && formData.mata_pelajaran) {
            const matchedSchedules = teacherDaySchedule.filter(
                s => s.kelas === formData.kelas && s.mata_pelajaran === formData.mata_pelajaran
            );

            if (matchedSchedules.length > 0) {
                availableJams = matchedSchedules.map(s => {
                    const jamNum = parseInt(s.jam_ke, 10);
                    const timeSlot = (masterData?.waktu || []).find(
                        (w: any) => Number(w.jam_ke) === jamNum &&
                            (dayName ? w.hari === dayName : true) &&
                            (w.program || 'Reguler') === (classProgram || 'Reguler')
                    );
                    return {
                        value: String(jamNum),
                        label: `Jam Ke-${jamNum}`,
                        id: jamNum,
                        timeStr: timeSlot ? formatTimeStr(timeSlot) : ''
                    };
                });
            }
        }

        // 2. Fallback: jika tidak ada jadwal rutin yang cocok (mis. guru pengganti / jadwal insidental),
        // gunakan master_waktu agar pilihan jam TIDAK kosong!
        if (availableJams.length === 0 && masterData?.waktu) {
            const daySlots = (masterData.waktu || []).filter(
                (w: any) => (dayName ? w.hari === dayName : true) && (w.program || 'Reguler') === (classProgram || 'Reguler')
            );
            const slotsToUse = daySlots.length > 0 ? daySlots : (masterData.waktu || []);
            const seen = new Set<number>();
            slotsToUse.forEach((w: any) => {
                const jamNum = parseInt(String(w.jam_ke), 10);
                if (Number.isFinite(jamNum) && !seen.has(jamNum)) {
                    seen.add(jamNum);
                    availableJams.push({
                        value: String(jamNum),
                        label: `Jam Ke-${jamNum}`,
                        id: jamNum,
                        timeStr: formatTimeStr(w)
                    });
                }
            });
            availableJams.sort((a, b) => a.id - b.id);
        }

        // 3. Pastikan jam dari selectedHours SELALU ada di opsi
        if (selectedHours.length > 0) {
            selectedHours.forEach(hId => {
                if (!availableJams.find(j => j.id === hId)) {
                    const slot = (masterData?.waktu || []).find((w: any) =>
                        Number(w.jam_ke) === hId && (dayName ? w.hari === dayName : true) && (w.program || 'Reguler') === (classProgram || 'Reguler')
                    );
                    availableJams.push({
                        value: String(hId),
                        label: `Jam Ke-${hId}`,
                        id: hId,
                        timeStr: slot ? formatTimeStr(slot) : '(Sesuai Jurnal)'
                    });
                }
            });
            availableJams.sort((a, b) => a.id - b.id);
        }

        return availableJams;
    }, [masterData?.waktu, masterData?.kelas, teacherDaySchedule, formData.kelas, formData.mata_pelajaran, dayName, selectedHours]);

    const multiJamValue = useMemo(() => {
        return selectedHours.length > 1 ? selectedHours.sort((a, b) => a - b).join(',') : '';
    }, [selectedHours]);

    const currentJamValue = useMemo(() => {
        if (selectedHours.length === 0) return '';
        if (selectedHours.length === 1) return String(selectedHours[0]);
        return selectedHours.sort((a, b) => a - b).join(',');
    }, [selectedHours]);

    const handleJamSelectChange = (val: string) => {
        if (!val) {
            setSelectedHours([]);
            return;
        }
        if (val === 'all') {
            const all = jamOptions.map(o => o.id).filter(Number.isFinite);
            setSelectedHours(all);
            return;
        }
        if (val.includes(',')) {
            const ids = val.split(',').map(n => parseInt(n.trim(), 10)).filter(Number.isFinite);
            setSelectedHours(ids);
            return;
        }
        const h = parseInt(val, 10);
        if (Number.isFinite(h)) {
            setSelectedHours([h]);
        }
    };

    // -------------------------------------------------------------------------
    // Opsi Kategori Kehadiran
    // -------------------------------------------------------------------------
    const kategoriKehadiranOptions = useMemo(() => {
        const fromMaster = masterData?.dropdown?.kategoriKehadiran || [];
        if (fromMaster.length > 0) {
            return fromMaster.map((k: any) => ({ value: k.value, label: k.label }));
        }
        return [
            { value: 'Sesuai', label: 'Sesuai' },
            { value: 'Terlambat', label: 'Terlambat' },
            { value: 'Tukaran', label: 'Tukaran' },
            { value: 'Diganti', label: 'Diganti' },
            { value: 'Tidak Hadir', label: 'Tidak Hadir' },
            { value: 'Kosong', label: 'Kosong' }
        ];
    }, [masterData?.dropdown?.kategoriKehadiran]);

    const activeKategoriOptions = useMemo(() => {
        const list = [...kategoriKehadiranOptions];
        if (formData.kategori_kehadiran && !list.some(k => k.value.toLowerCase() === formData.kategori_kehadiran.toLowerCase())) {
            list.unshift({ value: formData.kategori_kehadiran, label: formData.kategori_kehadiran });
        }
        return list;
    }, [kategoriKehadiranOptions, formData.kategori_kehadiran]);

    const activeStatusPenggantiOptions = useMemo(() => {
        const currentKat = (formData.kategori_kehadiran || '').toLowerCase().trim();
        const list = kategoriKehadiranOptions.filter((k: any) => k.value.toLowerCase().trim() !== currentKat);
        if (formData.status_pengganti && formData.status_pengganti !== '-' && !list.some((s: any) => s.value.toLowerCase() === formData.status_pengganti.toLowerCase())) {
            list.unshift({ value: formData.status_pengganti, label: formData.status_pengganti });
        }
        return list;
    }, [kategoriKehadiranOptions, formData.kategori_kehadiran, formData.status_pengganti]);

    const getStatusTambahanOptions = (val?: string) => {
        const list = [...statusTambahanOptions];
        if (val && !list.some(o => o.value === val)) {
            list.push({ value: val, label: val });
        }
        return list;
    };

    const updateForm = (key: string, value: any) => {
        setFormData((prev: any) => {
            const next = { ...prev, [key]: value };

            if (key === 'kategori_kehadiran') {
                const noSubCategories = ['sesuai', 'terlambat', 'kosong', 'penugasan tanpa pendampingan', 'digabung'];
                if (noSubCategories.includes(String(value || '').toLowerCase().trim())) {
                    next.guru_pengganti = '-';
                    next.status_pengganti = '-';
                }
            }

            if (key === 'nama_guru') {
                const guru = (masterData?.guru || []).find((g: any) => g.nama_lengkap === value);
                next.nip = guru ? guru.nip : '';
                next.kelas = '';
                next.mata_pelajaran = '';
                setSelectedHours([]);
            }

            if (key === 'kelas') {
                next.mata_pelajaran = '';
                setSelectedHours([]);
            }

            if (key === 'tanggal') {
                setSelectedHours([]);
            }

            return next;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nip || !formData.tanggal || selectedHours.length === 0 || !formData.kelas || !formData.mata_pelajaran) {
            Swal.fire('Perhatian', 'Mohon lengkapi semua data wajib (Guru, Tanggal, Jam, Kelas, Mapel)!', 'warning');
            setLoading(false);
            return;
        }

        const currentKategori = (formData.kategori_kehadiran || 'Sesuai').toLowerCase().trim();
        const exceptions = ['sesuai', 'kosong', 'penugasan tanpa pendampingan', 'digabung', 'terlambat'];
        const isPenggantiRequired = !exceptions.includes(currentKategori);

        if (isPenggantiRequired) {
            if (!formData.guru_pengganti || formData.guru_pengganti === '-' || !formData.status_pengganti || formData.status_pengganti === '-') {
                Swal.fire('Perhatian', 'Guru Pengganti dan Status Kehadiran wajib diisi!', 'warning');
                setLoading(false);
                return;
            }
        }

        try {
            setLoading(true);

            let editIdMap: Record<number, number> | undefined;
            if (mode === 'edit' && initialData && initialData.jamIds && initialData.allIds) {
                const removedJamIds = initialData.jamIds.filter((h: number) => !selectedHours.includes(h));
                if (removedJamIds.length > 0) {
                    for (const jamId of removedJamIds) {
                        const idx = initialData.jamIds.indexOf(jamId);
                        const dbId = initialData.allIds[idx];
                        if (dbId) {
                            try {
                                await fetch(`/api/jurnal/${dbId}`, { method: 'DELETE' });
                            } catch (delErr) {
                                console.error(`Failed to delete removed JP ${jamId} (ID: ${dbId}):`, delErr);
                            }
                        }
                    }
                }

                editIdMap = {};
                const allIds = initialData.allIds;
                initialData.jamIds.forEach((jamId: number, idx: number) => {
                    if (selectedHours.includes(jamId)) {
                        const dbId = allIds[idx];
                        if (dbId) editIdMap![jamId] = dbId;
                    }
                });
            }

            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const cleanTgl = formData.tanggal ? String(formData.tanggal).split('T')[0] : '';
            const tglParts = cleanTgl.split('-').map(Number);
            const hari = (tglParts.length === 3 && tglParts[0] && tglParts[1] && tglParts[2])
                ? days[new Date(tglParts[0], tglParts[1] - 1, tglParts[2]).getDay()]
                : (formData.hari || days[new Date(formData.tanggal).getDay()]);

            const payload = {
                ...formData,
                tanggal: cleanTgl || formData.tanggal,
                jam_ke: selectedHours.sort((a, b) => a - b).join(','),
                jam_ke_id: selectedHours[0],
                hari,
                auth_id: user?.id,
                selected_hours: selectedHours,
                filled_by: limited ? 'GURU' : 'ADMIN',
                edit_id_map: editIdMap,
                durasi_terlambat: formData.durasi_terlambat ? parseInt(formData.durasi_terlambat) : null,
                durasi_keluar_awal: formData.durasi_keluar_awal ? parseInt(formData.durasi_keluar_awal) : null,
                status_tambahan_1: formData.status_tambahan_1 || null,
                status_tambahan_2: formData.status_tambahan_2 || null,
                status_tambahan_3: formData.status_tambahan_3 || null,
            };

            const res = await fetch('/api/jurnal/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            setLoading(false);

            if (result.success || result.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: mode === 'add' ? 'Jurnal berhasil ditambahkan' : 'Jurnal berhasil diperbarui',
                    timer: 1500,
                    showConfirmButton: false
                });
                onSuccess();
                onClose();
            } else {
                throw new Error(result.error || result.message || 'Gagal menyimpan jurnal');
            }
        } catch (err: any) {
            setLoading(false);
            Swal.fire('Gagal', err.message, 'error');
        }
    };

    const isPenggantiCategory = !['sesuai', 'kosong', 'penugasan tanpa pendampingan', 'digabung', 'terlambat'].includes(
        (formData.kategori_kehadiran || '').toLowerCase().trim()
    );

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="xl"
            variant={mode === 'add' ? 'add' : 'edit'}
            title={mode === 'add' ? 'Tulis Jurnal Baru' : 'Edit Jurnal'}
            subtitle={mode === 'add' ? 'Lengkapi form untuk mencatat pembelajaran.' : 'Perbarui data jurnal yang tersimpan.'}
            icon={mode === 'add' ? 'journal-plus' : 'pencil-square'}
        >
            <form id="journalForm" onSubmit={handleSave} className="jm__form">
                <ModalBody className="jm__body">
                    <div className="jm__cols">
                        {/* Kolom Kiri: Identitas, Waktu, & Status */}
                        <div className="jm__group">
                            <div className="jm__sectionTitle">Identitas & Waktu</div>

                            <div className="jm__field">
                                <label>Nama Guru</label>
                                <InlineSelect
                                    value={formData.nama_guru || ''}
                                    onChange={(val) => {
                                        const found = guruOptions.find((g: any) => g.value === val);
                                        updateForm('nama_guru', val);
                                        if (found?.nip) updateForm('nip', found.nip);
                                    }}
                                    disabled={limited}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Guru"
                                >
                                    <option value="">-- Pilih Guru --</option>
                                    {guruOptions.map((g: any) => (
                                        <option key={g.value} value={g.value}>{g.label}</option>
                                    ))}
                                </InlineSelect>
                                {teacherDaySchedule.length === 0 && formData.nama_guru && (
                                    <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 mt-1 mb-1 shadow-sm flex items-center gap-1.5">
                                        <i className="bi bi-exclamation-triangle"></i>
                                        <span>Info: Tidak ditemukan jadwal rutin guru ini di hari tersebut.</span>
                                    </div>
                                )}
                            </div>

                            {formData.nama_guru && (
                                <div className="jm__autoFill">
                                    <i className="bi bi-person-badge"></i>
                                    <span>NIP: <strong>{formData.nip || '-'}</strong></span>
                                </div>
                            )}

                            <div className="jm__grid2">
                                <div className="jm__field">
                                    <label>Tanggal</label>
                                    <DatePicker
                                        value={formData.tanggal ? String(formData.tanggal).split('T')[0] : ''}
                                        onChange={(v) => updateForm('tanggal', v)}
                                        disabled={limited}
                                        min={minDate}
                                        max={maxDate}
                                    />
                                </div>
                                <div className="jm__field">
                                    <label>Kelas</label>
                                    <InlineSelect
                                        value={formData.kelas || ''}
                                        onChange={(val) => updateForm('kelas', val)}
                                        disabled={limited || kelasOptions.length === 0}
                                        minWidth="100%"
                                        height="38px"
                                        title="Pilih Kelas"
                                    >
                                        <option value="">-- Pilih Kelas --</option>
                                        {kelasOptions.map((k: any) => (
                                            <option key={k.value} value={k.value}>{k.label}</option>
                                        ))}
                                    </InlineSelect>
                                </div>
                            </div>

                            <div className="jm__field">
                                <label>Mata Pelajaran</label>
                                <InlineSelect
                                    value={formData.mata_pelajaran || ''}
                                    onChange={(val) => updateForm('mata_pelajaran', val)}
                                    disabled={!formData.kelas || limited || mapelOptions.length === 0}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Mata Pelajaran"
                                >
                                    <option value="">{mapelOptions.length === 0 ? "-- Tidak ada mapel tersedia --" : "-- Pilih Mata Pelajaran --"}</option>
                                    {mapelOptions.map((m: any) => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </InlineSelect>
                            </div>

                            <div className="jm__field">
                                <label>Jam Ke</label>
                                <InlineSelect
                                    value={currentJamValue}
                                    onChange={limited ? () => {} : handleJamSelectChange}
                                    disabled={limited || jamOptions.length === 0}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Jam"
                                >
                                    <option value="">{jamOptions.length === 0 ? "-- Tidak ada jam tersedia --" : "-- Pilih Jam --"}</option>
                                    
                                    {/* Jika ada beberapa jam yang terpilih (mis. 11, 12), sediakan opsi persisnya */}
                                    {selectedHours.length > 1 && (
                                        <option value={multiJamValue}>
                                            Jam Ke-{selectedHours.sort((a, b) => a - b).join(', ')} (Terpilih)
                                        </option>
                                    )}

                                    {/* Opsi Pilih Semua jika jam yang tersedia lebih dari 1 */}
                                    {jamOptions.length > 1 && (
                                        <option value="all">
                                            --- PILIH SEMUA JAM INI ({jamOptions.map(o => o.id).join(', ')}) ---
                                        </option>
                                    )}

                                    {/* Opsi jam masing-masing */}
                                    {jamOptions.map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}{opt.timeStr ? ` (${opt.timeStr})` : ''}
                                        </option>
                                    ))}
                                </InlineSelect>

                                {selectedHours.length > 1 && (
                                    <div className="mt-1 px-2 py-1.5 bg-blue-50/50 rounded-lg border border-blue-100/50 flex items-center gap-2">
                                        <i className="bi bi-info-circle text-blue-500 text-xs"></i>
                                        <span className="text-[10px] text-blue-700 font-medium">
                                            Menyimpan <strong>{selectedHours.length} baris</strong> jurnal (Jam {selectedHours.sort((a, b) => a - b).join(', ')})
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Status Kehadiran */}
                            <div className="jm__sectionTitle mt-2">Status Kehadiran</div>

                            <div className="jm__field">
                                <label>Status</label>
                                <InlineSelect
                                    value={formData.kategori_kehadiran || 'Sesuai'}
                                    onChange={(val) => updateForm('kategori_kehadiran', val)}
                                    disabled={limited}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Status Kehadiran"
                                >
                                    {activeKategoriOptions.map((k: any) => (
                                        <option key={k.value} value={k.value}>{k.label}</option>
                                    ))}
                                </InlineSelect>
                            </div>

                            {((formData.kategori_kehadiran === 'Terlambat') || (formData.status_pengganti === 'Terlambat')) && (
                                <div className="jm__grid2">
                                    <div className="jm__field">
                                        <label>Durasi Terlambat (Menit)</label>
                                        <input
                                            type="number"
                                            value={formData.durasi_terlambat || ''}
                                            onChange={(e) => updateForm('durasi_terlambat', e.target.value)}
                                            placeholder="Contoh: 15"
                                            min="1"
                                            className="jm__input"
                                            disabled={limited}
                                        />
                                    </div>
                                    <div className="jm__field">
                                        <label>Durasi Keluar Awal (Menit)</label>
                                        <input
                                            type="number"
                                            value={formData.durasi_keluar_awal || ''}
                                            onChange={(e) => updateForm('durasi_keluar_awal', e.target.value)}
                                            placeholder="Contoh: 10"
                                            min="1"
                                            className="jm__input"
                                            disabled={limited}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Status Tambahan 1-3 */}
                            <div className="jm__field">
                                <label>Status Tambahan 1</label>
                                <InlineSelect
                                    value={formData.status_tambahan_1 || ''}
                                    onChange={(val) => updateForm('status_tambahan_1', val || null)}
                                    disabled={limited}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Status Tambahan 1"
                                >
                                    {getStatusTambahanOptions(formData.status_tambahan_1).map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </InlineSelect>
                            </div>

                            <div className="jm__field">
                                <label>Status Tambahan 2</label>
                                <InlineSelect
                                    value={formData.status_tambahan_2 || ''}
                                    onChange={(val) => updateForm('status_tambahan_2', val || null)}
                                    disabled={limited}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Status Tambahan 2"
                                >
                                    {getStatusTambahanOptions(formData.status_tambahan_2).map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </InlineSelect>
                            </div>

                            <div className="jm__field">
                                <label>Status Tambahan 3</label>
                                <InlineSelect
                                    value={formData.status_tambahan_3 || ''}
                                    onChange={(val) => updateForm('status_tambahan_3', val || null)}
                                    disabled={limited}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Status Tambahan 3"
                                >
                                    {getStatusTambahanOptions(formData.status_tambahan_3).map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </InlineSelect>
                            </div>

                            {isPenggantiCategory && (
                                <div className="jm__subSection">
                                    <div className="flex flex-col gap-2.5">
                                        <div className="jm__field">
                                            <label>Guru Pengganti/Mitra</label>
                                            <InlineSelect
                                                value={formData.guru_pengganti || ''}
                                                onChange={(val) => updateForm('guru_pengganti', val)}
                                                disabled={limited}
                                                minWidth="100%"
                                                height="38px"
                                                title="Pilih Guru Pengganti"
                                            >
                                                <option value="">-- Pilih Guru Pengganti --</option>
                                                {guruPenggantiOptions.map((g: any) => (
                                                    <option key={g.value} value={g.value}>{g.label}</option>
                                                ))}
                                            </InlineSelect>
                                        </div>
                                        <div className="jm__field">
                                            <label>Status Kehadiran Pengganti</label>
                                            <InlineSelect
                                                value={formData.status_pengganti || ''}
                                                onChange={(val) => updateForm('status_pengganti', val)}
                                                disabled={limited}
                                                minWidth="100%"
                                                height="38px"
                                                title="Pilih Status Pengganti"
                                            >
                                                <option value="">-- Pilih Status --</option>
                                                {activeStatusPenggantiOptions.map((s: any) => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </InlineSelect>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Kolom Kanan: Detail Pembelajaran & Informasi Lain */}
                        <div className="jm__group">
                            <div className="jm__sectionTitle">Detail Pembelajaran</div>

                            <div className="jm__field">
                                <label>Materi Pembelajaran</label>
                                <textarea
                                    rows={3}
                                    value={formData.materi || ''}
                                    onChange={(e) => updateForm('materi', e.target.value)}
                                    placeholder="Contoh: Bab 3 — Persamaan Kuadrat"
                                    className="jm__textarea"
                                />
                            </div>

                            <div className="jm__field">
                                <label>Refleksi / Catatan</label>
                                <textarea
                                    rows={3}
                                    value={formData.refleksi || ''}
                                    onChange={(e) => updateForm('refleksi', e.target.value)}
                                    placeholder="Catatan refleksi..."
                                    className="jm__textarea"
                                />
                            </div>

                            <div className="jm__sectionTitle mt-2">Informasi Lain</div>

                            <div className="jm__field mb-2">
                                <label>Guru Piket (Opsional)</label>
                                <InlineSelect
                                    value={formData.guru_piket || ''}
                                    onChange={(val) => updateForm('guru_piket', val)}
                                    disabled={limited}
                                    minWidth="100%"
                                    height="38px"
                                    title="Pilih Guru Piket"
                                >
                                    <option value="">-- Pilih Guru Piket (Opsional) --</option>
                                    {guruPiketOptions.map((g: any) => (
                                        <option key={g.value} value={g.value}>{g.label}</option>
                                    ))}
                                </InlineSelect>
                            </div>

                            <div className="jm__field">
                                <label>Ket. Tambahan</label>
                                <input
                                    type="text"
                                    value={formData.keterangan_tambahan || ''}
                                    onChange={(e) => updateForm('keterangan_tambahan', e.target.value)}
                                    placeholder="Catatan lain..."
                                    className="jm__input"
                                    disabled={limited}
                                />
                            </div>
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button type="button" variant="cancel" onClick={onClose} disabled={loading}>
                        Batal
                    </Button>
                    <Button type="submit" variant="primary" isLoading={loading} icon="save">
                        {mode === 'add' ? 'Simpan Jurnal' : 'Simpan Perubahan'}
                    </Button>
                </ModalFooter>
            </form>

            <style jsx>{`
                .jm__form {
                    display: flex;
                    flex-direction: column;
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow: hidden;
                }

                :global(.jm__body) {
                    padding: 14px 18px !important;
                    display: block !important;
                    overflow-y: auto !important;
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    scrollbar-width: thin;
                }

                .jm__cols {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
                @media (min-width: 768px) {
                    .jm__cols {
                        grid-template-columns: 1fr 1fr;
                        align-items: start;
                    }
                }

                .jm__group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .jm__sectionTitle {
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 600;
                    color: var(--n-muted, #64748b);
                    border-bottom: 1px solid var(--n-border, #e2e8f0);
                    padding-bottom: 4px;
                    margin-bottom: 2px;
                    margin-top: 4px;
                }

                .jm__field {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }

                .jm__field label {
                    display: block;
                    font-size: 0.74rem;
                    font-weight: 500;
                    color: var(--n-muted, #64748b);
                    margin-bottom: 1px;
                }

                .jm__input,
                .jm__textarea {
                    width: 100%;
                    padding: 6px 12px;
                    height: 38px;
                    min-height: 38px;
                    border-radius: 10px;
                    border: 1px solid var(--n-border, #e2e8f0);
                    background: var(--n-card, #ffffff);
                    color: var(--n-ink, #0f172a);
                    font-weight: 500;
                    font-size: 0.82rem;
                    outline: none;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                .jm__field input[type="date"] {
                    padding-top: 7px;
                    padding-bottom: 7px;
                    line-height: 1.2;
                }

                .jm__input:hover,
                .jm__textarea:hover {
                    border-color: rgba(58, 166, 255, 0.4);
                }

                .jm__input:focus,
                .jm__textarea:focus {
                    border-color: var(--n-primary, #0038A8);
                    box-shadow: var(--n-ring);
                }

                .jm__textarea {
                    resize: vertical;
                    min-height: 72px;
                    height: auto;
                    line-height: 1.45;
                }

                .jm__grid2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }

                .jm__subSection {
                    margin-top: 6px;
                    padding: 10px 12px;
                    background: var(--n-soft, #f8fafc);
                    border: 1px dashed var(--n-border, #e2e8f0);
                    border-radius: 10px;
                }

                .jm__autoFill {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    background: var(--n-soft, #f8fafc);
                    border: 1px solid var(--n-primary, #0038A8);
                    border-radius: 8px;
                    font-size: 0.75rem;
                    color: var(--n-primary, #0038A8);
                }

                :global(.dark) .jm__sectionTitle {
                    color: #93c5fd !important;
                    border-bottom-color: rgba(59, 130, 246, 0.2) !important;
                }
                :global(.dark) .jm__field label {
                    color: #94a3b8 !important;
                }
                :global(.dark) .jm__input,
                :global(.dark) .jm__textarea {
                    background: #000000 !important;
                    border: 1.5px solid rgba(59, 130, 246, 0.35) !important;
                    color: #f1f5f9 !important;
                }
                :global(.dark) .jm__input:focus,
                :global(.dark) .jm__textarea:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 10px rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .jm__input::placeholder,
                :global(.dark) .jm__textarea::placeholder {
                    color: #64748b !important;
                }
                :global(.dark) .jm__subSection {
                    background: #000000 !important;
                    border: 1px solid rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .jm__autoFill {
                    background: rgba(26, 115, 232, 0.15) !important;
                    border-color: rgba(59, 130, 246, 0.35) !important;
                    color: #38bdf8 !important;
                }
            `}</style>
        </Modal>
    );
}