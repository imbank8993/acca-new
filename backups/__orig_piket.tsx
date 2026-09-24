'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserByAuthId } from '@/lib/auth';
import Swal from 'sweetalert2';
import PermissionGuard from '@/components/PermissionGuard';

interface JadwalItem {
    jam_ke: string;
    kelas: string;
    mapel: string;
    nama_guru?: string;
    hari?: string;
    tanggal?: string;
}

interface ClassData {
    kelas: string;
    guru: string;
    guru_override: string;
    status: string;
    dokumentasi_url: string;
}

const PHP_HANDLER_URL = process.env.NEXT_PUBLIC_PHP_HANDLER_URL || 'https://icgowa.sch.id/akademik.icgowa.sch.id/upload_handler.php';

export default function PiketInputPage() {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [guruList, setGuruList] = useState<{nip: string; nama_lengkap: string}[]>([]);
    const [kehadiranOptions, setKehadiranOptions] = useState<any[]>([
        { value: 'Hadir', label: 'Hadir' },
        { value: 'Sakit', label: 'Sakit' },
        { value: 'Izin', label: 'Izin' },
        { value: 'Tanpa Keterangan', label: 'Tanpa Keterangan' },
        { value: 'Tugas', label: 'Tugas' },
        { value: 'Kelas Kosong', label: 'Kelas Kosong' }
    ]);

    // Guru piket terdeteksi otomatis
    const [guruPiket, setGuruPiket] = useState('');
    const [nip, setNip] = useState('');

    // Form state
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedJam, setSelectedJam] = useState<string>('');
    const [keteranganTambahan, setKeteranganTambahan] = useState('');

    // Full schedule data grouped by jam_ke
    const [fullSchedule, setFullSchedule] = useState<Record<string, JadwalItem[]>>({});

    // All classes for selected date (regardless of jam)
    const [allClassesForDate, setAllClassesForDate] = useState<JadwalItem[]>([]);

    // Per-Kelas Data - keyed by kelas-jamKe
    const [classData, setClassData] = useState<Record<string, ClassData>>({});

    // Submission
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState<Record<string, boolean>>({});
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    // Get unique jam options for dropdown
    const jamOptions = useMemo(() => {
        return Object.keys(fullSchedule).sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numA - numB;
        });
    }, [fullSchedule]);

    // Get filled class count
    const filledClassCount = useMemo(() => {
        return Object.entries(classData)
            .filter(([key, d]) => {
                const [, jamKe] = key.split('-');
                return d.kelas && selectedJam === jamKe && (d.guru || d.status);
            })
            .length;
    }, [classData, selectedJam]);

    // Get all schedule items for table display (Grouping by teacher AND class)
    const scheduleItems = useMemo(() => {
        const filtered = selectedJam !== ''
            ? allClassesForDate.filter(item => selectedJam === item.jam_ke)
            : [];

        // Group by (guru, kelas)
        const finalGroup: Record<string, any> = {};
        filtered.forEach(item => {
            const teacher = item.nama_guru || 'Tanpa Guru';
            const fKey = `${teacher}-${item.kelas}`;

            if (!finalGroup[fKey]) {
                finalGroup[fKey] = {
                    key: fKey,
                    guru: item.nama_guru,
                    kelas: item.kelas,
                    jams: [],
                    mapels: new Set()
                };
            }
            finalGroup[fKey].jams.push(item.jam_ke);
            if (item.mapel) finalGroup[fKey].mapels.add(item.mapel);
        });

        return Object.values(finalGroup).map(fg => ({
            ...fg,
            jam_display: fg.jams.sort((a: any, b: any) => parseInt(a) - parseInt(b)).join(', ')
        })).sort((a, b) => {
            const firstJamA = parseInt(a.jams[0]) || 0;
            const firstJamB = parseInt(b.jams[0]) || 0;
            if (firstJamA !== firstJamB) return firstJamA - firstJamB;

            // Then sort by grade/kelas
            const gradeOrder: Record<string, number> = { 'X': 1, 'XI': 2, 'XII': 3 };
            const getGrade = (kelas: string) => {
                const match = kelas.match(/^(X|XI|XII)/i);
                return match ? gradeOrder[match[0].toUpperCase()] || 99 : 99;
            };
            const gradeA = getGrade(a.kelas);
            const gradeB = getGrade(b.kelas);
            if (gradeA !== gradeB) return gradeA - gradeB;
            return a.kelas.localeCompare(b.kelas);
        });
    }, [selectedJam, allClassesForDate]);

    useEffect(() => {
        const init = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const userData = await getUserByAuthId(authUser.id);
                if (userData) {
                    setUser(userData);
                    setGuruPiket(userData.nama || userData.nama_lengkap || '');
                    setNip(userData.nip || '');
                }
            }
            await loadKelas();
            await loadGuruList();
            await loadMasterDropdown();
            setSelectedDate(new Date().toISOString().split('T')[0]);
            setLoading(false);
        };
        init();
    }, []);

    // Load schedule when date changes
    useEffect(() => {
        if (selectedDate) {
            loadScheduleForDate(selectedDate);
        }
    }, [selectedDate]);

    // Auto-fill classData when schedule loads
    useEffect(() => {
        if (allClassesForDate.length > 0) {
            const newClassData: Record<string, any> = {};
            
            // Build the SAME grouping (guru, kelas) as useMemo
            const finalGroup: Record<string, any> = {};
            allClassesForDate.forEach(item => {
                const teacher = item.nama_guru || 'Tanpa Guru';
                const fKey = `${teacher}-${item.kelas}`;
                if (!finalGroup[fKey]) finalGroup[fKey] = { guru: item.nama_guru, kelas: item.kelas, jams: [] };
                finalGroup[fKey].jams.push(item.jam_ke);
            });

            Object.entries(finalGroup).forEach(([fKey, fg]) => {
                const existing = (classData as any)[fKey];
                newClassData[fKey] = {
                    kelas: fg.kelas,
                    jams: fg.jams,
                    guru: fg.guru || '',
                    guru_override: existing?.guru_override || '',
                    status: existing?.status || '',
                    dokumentasi_url: existing?.dokumentasi_url || ''
                };
            });
            setClassData(newClassData as any);
        }
    }, [allClassesForDate]);

    const selectJam = (jam: string) => {
        setSelectedJam(prev => prev === jam ? '' : jam);
        document.getElementById('jamMultiSelect')?.classList.remove('show');
    };

    const loadScheduleForDate = async (date: string) => {
        try {
            const dateObj = new Date(date);
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const dayName = dayNames[dateObj.getDay()];

            const res = await fetch(`/api/jadwal?hari=${encodeURIComponent(dayName)}&aktif=true`);
            const json = await res.json();

            if (json.ok && json.data) {
                const schedule = json.data as JadwalItem[];

                const grouped: Record<string, JadwalItem[]> = {};
                schedule.forEach(item => {
                    if (!grouped[item.jam_ke]) {
                        grouped[item.jam_ke] = [];
                    }
                    grouped[item.jam_ke].push(item);
                });
                setFullSchedule(grouped);
                setAllClassesForDate(schedule);
            } else {
                setFullSchedule({});
                setAllClassesForDate([]);
            }
        } catch (e) {
            console.error('Error loading schedule:', e);
            setFullSchedule({});
            setAllClassesForDate([]);
        }
    };

    const loadKelas = async () => {
        try {
            const { data } = await supabase
                .from('master_kelas')
                .select('nama_kelas')
                .eq('aktif', true)
                .order('nama_kelas');

            if (data) {
                setKelasList(data.map(k => k.nama_kelas));
            }
        } catch (e) {
            console.error('Error loading kelas:', e);
        }
    };

    const loadGuruList = async () => {
        try {
            const res = await fetch('/api/master/guru?limit=500');
            const json = await res.json();
            if (json.ok && json.data) {
                setGuruList(json.data);
            }
        } catch (e) {
            console.error('Error loading guru:', e);
        }
    };

    const loadMasterDropdown = async () => {
        try {
            const res = await fetch('/api/master/dropdown');
            const json = await res.json();
            if (json.ok && json.data?.kategori_kehadiran) {
                setKehadiranOptions(json.data.kategori_kehadiran);
            }
        } catch (e) {
            console.error('Error loading master dropdown:', e);
        }
    };

    const updateClassData = (fKey: string, field: keyof ClassData, value: string) => {
        setClassData(prev => {
            // Jika data belum ada (misal setelah reset atau upload foto duluan), 
            // cari data dasarnya dari allClassesForDate berdasarkan fKey
            const existing = (prev as any)[fKey];
            
            let baseData = existing || { 
                kelas: '', 
                jams: [], 
                guru: '', 
                guru_override: '', 
                status: '', 
                dokumentasi_url: '' 
            };

            // Jika baseData belum punya info kelas/jams, cari di allClassesForDate
            if (!baseData.kelas || baseData.jams.length === 0) {
                const parts = fKey.split('-');
                const teacherName = parts[0];
                const className = parts.slice(1).join('-');
                
                const match = allClassesForDate.find(item => 
                    (item.nama_guru || 'Tanpa Guru') === teacherName && 
                    item.kelas === className
                );

                if (match) {
                    // Cari semua jam untuk guru & kelas ini
                    const allJams = allClassesForDate
                        .filter(item => (item.nama_guru || 'Tanpa Guru') === teacherName && item.kelas === className)
                        .map(item => item.jam_ke);
                    
                    baseData = {
                        ...baseData,
                        kelas: match.kelas,
                        jams: allJams,
                        guru: match.nama_guru || ''
                    };
                }
            }

            const updated = { ...baseData, [field]: value };
            return { ...prev, [fKey]: updated };
        });
    };

    const handleFileUpload = async (key: string, file: File) => {
        if (!file || file.size > 10 * 1024 * 1024) {
            Swal.fire('Error', 'Ukuran file maksimal 10 MB', 'error');
            return;
        }

        try {
            setUploading(prev => ({ ...prev, [key]: true }));
            setUploadProgress(prev => ({ ...prev, [key]: 0 }));

            const result = await new Promise<any>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        setUploadProgress(prev => ({ ...prev, [key]: Math.round((event.loaded / event.total) * 100) }));
                    }
                });
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try { resolve(JSON.parse(xhr.responseText)); }
                            catch (e) { reject(new Error('Invalid response')); }
                        } else {
                            reject(new Error(`Upload failed (${xhr.status})`));
                        }
                    }
                };
                const formData = new FormData();
                formData.append('file', file);
                formData.append('category', 'piket');
                formData.append('kelas', key);
                xhr.open('POST', PHP_HANDLER_URL);
                xhr.send(formData);
            });

            if (result.status === 'success' || result.ok) {
                const fileUrl = result.file_url || result.publicUrl;
                // Simpan URL dokumentasi ke state tanpa filter regex yang membatasi
                updateClassData(key, 'dokumentasi_url', fileUrl);
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setUploading(prev => ({ ...prev, [key]: false }));
            setUploadProgress(prev => ({ ...prev, [key]: 0 }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDate) {
            Swal.fire('Peringatan', 'Pilih tanggal terlebih dahulu!', 'warning');
            return;
        }

        if (!selectedJam) {
            Swal.fire('Peringatan', 'Pilih jam piket!', 'warning');
            return;
        }

        const details = Object.entries(classData)
            .filter(([key, d]) => {
                const fData = classData[key] as any;
                const jams = fData.jams || [];
                // Only include entries where the selected jam is in this class's jams AND status is filled
                return fData.status && fData.kelas && jams.includes(selectedJam);
            })
            .flatMap(([key, d]) => {
                const fData = d as any;
                const jams = fData.jams || [];

                // Only expand to rows for the SELECTED jam, not all jams
                const relevantJams = jams.filter((j: string) => j === selectedJam);
                return relevantJams.map((j: string) => ({
                    kelas: fData.kelas,
                    jam_ke: j,
                    guru_jadwal: fData.guru,
                    guru_pengganti: fData.guru_override?.trim() || null,
                    guru: fData.guru_override?.trim() || fData.guru,
                    status: fData.status,
                    dokumentasi_url: fData.dokumentasi_url
                }));
            });

        const filledDetails = details.filter(d => d.status);
        if (filledDetails.length === 0) {
            Swal.fire('Peringatan', 'Pilih status kehadiran minimal untuk satu kelas!', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                guruPiket: guruPiket,
                nip: nip,
                tanggal: selectedDate,
                jamPiket: selectedJam,
                keteranganTambahan: keteranganTambahan,
                details
            };

            const res = await fetch('/api/laporan/piket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (result.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: result.message || 'Laporan Piket berhasil disimpan!',
                    timer: 3000
                });
                setSelectedJam('');
                setKeteranganTambahan('');
                setClassData({});
            } else {
                throw new Error(result.error || 'Gagal mengirim laporan');
            }
        } catch (err: any) {
            console.error("Submit error:", err);
            Swal.fire('Gagal', err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="pk__loading">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Memuat data...</span>
            </div>
        );
    }

    return (
        <PermissionGuard requiredPermission={{ resource: 'piket_input', action: 'input' }}>
            <div className="pk">
                {/* Header */}
                <div className="pk__pageHeader">
                    <div className="pk__titleArea">
                        <h1>Laporan Piket</h1>
                        <p>Input kehadiran kelas - {guruPiket}</p>
                    </div>
                </div>

                {/* Form */}
                <div className="pk__card">
                    <form onSubmit={handleSubmit}>
                        {/* Info Guru */}
                        <div className="pk__section">
                            <h3 className="pk__sectionTitle"><i className="fa-solid fa-user"></i> Identitas Petugas</h3>
                            <div className="pk__infoBox">
                                <div className="pk__infoRow">
                                    <span className="pk__infoLabel">Nama Guru Piket</span>
                                    <span className="pk__infoValue">{guruPiket}</span>
                                </div>
                                {nip && (
                                    <div className="pk__infoRow">
                                        <span className="pk__infoLabel">NIP</span>
                                        <span className="pk__infoValue">{nip}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tanggal */}
                        <div className="pk__section">
                            <h3 className="pk__sectionTitle"><i className="fa-solid fa-calendar"></i> Pilih Tanggal</h3>
                            <input
                                type="date"
                                className="pk__dateInput"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                            {selectedDate && (
                                <p className="pk__hint">
                                    <i className="fa-solid fa-info-circle"></i>
                                    Menampilkan jadwal untuk {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            )}
                        </div>

                        {/* Jam Piket - Multi Select Dropdown */}
                        <div className="pk__section">
                            <h3 className="pk__sectionTitle">
                                <i className="fa-solid fa-clock"></i> Pilih Jam Piket
                                <span className="pk__required">*Piket dilaporkan per JP</span>
                            </h3>
                            <div className="pk__multiSelect">
                                <button
                                    type="button"
                                    className="pk__multiSelectBtn"
                                    onClick={() => document.getElementById('jamMultiSelect')?.classList.toggle('show')}
                                >
                                    <span>
                                        {!selectedJam
                                            ? '-- Pilih Jam --'
                                            : `Jam Ke-${selectedJam}`}
                                    </span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>
                                <div id="jamMultiSelect" className="pk__multiSelectDropdown">
                                    {jamOptions.map(jam => (
                                        <label key={jam} className="pk__multiSelectOption">
                                            <input
                                                type="radio"
                                                name="jamSelect"
                                                checked={selectedJam === jam}
                                                onChange={() => selectJam(jam)}
                                            />
                                            <span className="pk__multiSelectLabel">
                                                <strong>Jam Ke-{jam}</strong>
                                                <span className="pk__multiSelectCount">{fullSchedule[jam]?.length || 0} kelas</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Keterangan */}
                        <div className="pk__section">
                            <div className="pk__formGroup">
                                <label className="pk__label">Keterangan Tambahan</label>
                                <textarea
                                    className="pk__textarea"
                                    placeholder="Catatan umum piket hari ini..."
                                    rows={2}
                                    value={keteranganTambahan}
                                    onChange={(e) => setKeteranganTambahan(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Data Per Kelas - Table Desktop / Cards Mobile */}
                        {selectedJam && scheduleItems.length > 0 && (
                            <div className="pk__section">
                                <h3 className="pk__sectionTitle">
                                    <i className="fa-solid fa-school"></i> Data Kelas ({scheduleItems.length})
                                </h3>

                                {/* Desktop Table View */}
                                <div className="pk__tableWrap pk__tableDesktop">
                                    <table className="pk__table">
                                        <thead>
                                            <tr>
                                                <th>Kelas/Guru</th>
                                                <th>Status Kehadiran</th>
                                                <th>Guru Pengganti/Pendamping</th>
                                                <th>Dokumentasi <span className="pk__optionalHint">(Opsional)</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scheduleItems.map((group: any) => {
                                                const key = group.key;
                                                const scheduledGuru = group.guru || 'Tanpa Guru';
                                                const data = (classData as any)[key] || {
                                                    kelas: group.classes,
                                                    guru: scheduledGuru,
                                                    guru_override: '',
                                                    status: '',
                                                    dokumentasi_url: ''
                                                };
                                                const hasStatus = !!data.status;
                                                return (
                                                    <tr key={key} className={hasStatus ? 'pk__rowActive' : 'pk__rowInactive'}>
                                                        <td>
                                                            <strong>{group.kelas}</strong>
                                                            <div className="pk__guruJadwalSmall">
                                                                {group.mapels.size > 0 && <span className="pk__mapelLabel">{Array.from(group.mapels).join(', ')}</span>}
                                                                {scheduledGuru} (Jam {group.jam_display})
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="pk__tableSelect"
                                                                value={data.status}
                                                                onChange={(e) => updateClassData(key, 'status', e.target.value)}
                                                            >
                                                                <option value="">Pilih...</option>
                                                                {kehadiranOptions.map(opt => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="pk__tableSelect pk__guruSelect"
                                                                value={data.guru_override}
                                                                onChange={(e) => updateClassData(key, 'guru_override', e.target.value)}
                                                            >
                                                                <option value="">-- Pilih --</option>
                                                                {guruList.map(g => (
                                                                    <option key={g.nip} value={g.nama_lengkap}>{g.nama_lengkap}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <div className="pk__uploadCell">
                                                                <input
                                                                    type="file"
                                                                    id={`file-${key}`}
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(key, e.target.files[0])}
                                                                    hidden
                                                                />
                                                                <label
                                                                    htmlFor={`file-${key}`}
                                                                    className={`pk__uploadBtn ${uploading[key] ? 'uploading' : ''} ${data.dokumentasi_url ? 'has-file' : ''}`}
                                                                >
                                                                    {uploading[key] ? (
                                                                        <><i className="fa-solid fa-spinner fa-spin"></i> {uploadProgress[key]}%</>
                                                                    ) : data.dokumentasi_url ? (
                                                                        <><i className="fa-solid fa-check"></i></>
                                                                    ) : (
                                                                        <><i className="fa-solid fa-camera"></i></>
                                                                    )}
                                                                </label>
                                                                {data.dokumentasi_url && (
                                                                    <a href={data.dokumentasi_url} target="_blank" rel="noreferrer" className="pk__viewLink">
                                                                        <i className="fa-solid fa-eye"></i>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="pk__cardList pk__cardListMobile">
                                    {scheduleItems.map((group: any, idx: number) => {
                                        const key = group.key;
                                        const scheduledGuru = group.guru || 'Tanpa Guru';
                                        const data = (classData as any)[key] || {
                                            kelas: group.classes,
                                            guru: scheduledGuru,
                                            guru_override: '',
                                            status: '',
                                            dokumentasi_url: ''
                                        };
                                        const hasStatus = !!data.status;
                                        return (
                                            <div key={`card-${key}-${idx}`} className={`pk__classCard ${hasStatus ? 'pk__cardActive' : 'pk__cardInactive'}`}>
                                                <div className="pk__cardHeader">
                                                    <div className="pk__cardKelas">{group.kelas}</div>
                                                    <div className="pk__cardMapel">{Array.from(group.mapels).join(', ')}</div>
                                                </div>
                                                <div className="pk__cardGuru">
                                                    <i className="fa-solid fa-chalkboard-user"></i>
                                                    <span>{scheduledGuru} (Jam {group.jam_display})</span>
                                                </div>
                                                <div className="pk__cardForm">
                                                    <div className="pk__cardField">
                                                        <label>Status Kehadiran</label>
                                                        <select
                                                            className="pk__cardSelect"
                                                            value={data.status}
                                                            onChange={(e) => updateClassData(key, 'status', e.target.value)}
                                                        >
                                                            <option value="">Pilih...</option>
                                                            {kehadiranOptions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="pk__cardField">
                                                        <label>Guru Pengganti/Pendamping</label>
                                                        <select
                                                            className="pk__cardSelect"
                                                            value={data.guru_override}
                                                            onChange={(e) => updateClassData(key, 'guru_override', e.target.value)}
                                                        >
                                                            <option value="">-- Pilih --</option>
                                                            {guruList.map(g => (
                                                                <option key={g.nip} value={g.nama_lengkap}>{g.nama_lengkap}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="pk__cardField">
                                                        <label>Dokumentasi <span className="pk__optionalHint">(Opsional)</span></label>
                                                        <div className="pk__cardUpload">
                                                            <input
                                                                type="file"
                                                                id={`file-mobile-${key}`}
                                                                accept="image/*"
                                                                capture="environment"
                                                                onChange={(e) => e.target.files?.[0] && handleFileUpload(key, e.target.files[0])}
                                                                hidden
                                                            />
                                                            <label
                                                                htmlFor={`file-mobile-${key}`}
                                                                className={`pk__cardUploadBtn ${uploading[key] ? 'uploading' : ''} ${data.dokumentasi_url ? 'has-file' : ''}`}
                                                            >
                                                                {uploading[key] ? (
                                                                    <><i className="fa-solid fa-spinner fa-spin"></i> {uploadProgress[key]}%</>
                                                                ) : data.dokumentasi_url ? (
                                                                    <><i className="fa-solid fa-check-circle"></i> Tersimpan</>
                                                                ) : (
                                                                    <><i className="fa-solid fa-camera"></i> Ambil Foto</>
                                                                )}
                                                            </label>
                                                            {data.dokumentasi_url && (
                                                                <a href={data.dokumentasi_url} target="_blank" rel="noreferrer" className="pk__cardViewLink">
                                                                    <i className="fa-solid fa-eye"></i> Lihat
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {selectedJam && scheduleItems.length === 0 && (
                            <div className="pk__empty">
                                <i className="fa-solid fa-calendar-xmark"></i>
                                <p>Tidak ada jadwal mengajar untuk jam yang dipilih</p>
                            </div>
                        )}

                        {!selectedJam && selectedDate && (
                            <div className="pk__empty">
                                <i className="fa-solid fa-hand-pointer"></i>
                                <p>Pilih jam piket di atas untuk menampilkan data</p>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="pk__footer">
                            <div className="pk__infoText">
                                <i className="fa-solid fa-info-circle"></i>
                                {filledClassCount} kelas diisi
                            </div>
                            <button type="submit" className="pk__submitBtn" disabled={submitting || !selectedJam}>
                                {submitting ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> Mengirim...</>
                                ) : (
                                    <><i className="fa-solid fa-paper-plane"></i> Kirim Laporan</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                <style jsx>{`
                    .pk { display: flex; flex-direction: column; gap: 16px; padding: 12px; max-width: 1100px; margin: 0 auto; }

                    .pk__loading { display: flex; align-items: center; justify-content: center; padding: 40px; gap: 10px; color: var(--n-muted); }
                    .pk__loading i { font-size: 1.3rem; color: var(--n-primary); }

                    .pk__pageHeader { background: linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%); padding: 14px 16px; border-radius: 10px; color: white; }
                    .pk__titleArea h1 { font-size: 1.1rem; font-weight: 700; margin: 0; }
                    .pk__titleArea p { font-size: 0.75rem; opacity: 0.85; margin: 4px 0 0; }

                    .pk__card { background: var(--n-card); border-radius: 10px; border: 1px solid var(--n-border); padding: 14px; }
                    .pk__section { margin-bottom: 16px; }
                    .pk__section:last-child { margin-bottom: 0; }
                    .pk__sectionTitle { font-size: 0.85rem; font-weight: 700; color: var(--n-ink); margin: 0 0 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                    .pk__sectionTitle i { color: var(--n-primary); font-size: 0.9rem; }

                    .pk__infoBox { background: var(--n-soft); padding: 10px 12px; border-radius: 8px; }
                    .pk__infoRow { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--n-border); }
                    .pk__infoRow:last-child { border-bottom: none; }
                    .pk__infoLabel { color: var(--n-muted); font-size: 0.75rem; }
                    .pk__infoValue { font-weight: 600; color: var(--n-ink); font-size: 0.85rem; }

                    .pk__dateInput, .pk__select, .pk__textarea { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--n-border); font-size: 0.9rem; background: var(--n-card); color: var(--n-ink); -webkit-appearance: none; appearance: none; }
                    .pk__select:focus, .pk__textarea:focus { outline: none; border-color: var(--n-primary); }
                    .pk__hint { font-size: 0.7rem; color: var(--n-muted); margin-top: 6px; display: flex; align-items: center; gap: 4px; }

                    .pk__formGroup { margin-bottom: 12px; }
                    .pk__label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--n-ink); margin-bottom: 4px; }

                    .pk__required { color: #ef4444; font-size: 0.65rem; font-weight: 500; margin-left: 4px; }
                    .pk__optionalHint { color: #64748b; font-weight: 400; font-size: 0.7rem; }

                    /* Multi Select Dropdown */
                    .pk__multiSelect { position: relative; }
                    .pk__multiSelectBtn {
                        width: 100%;
                        padding: 12px 14px;
                        border: 1px solid var(--n-border);
                        border-radius: 8px;
                        background: var(--n-card);
                        color: var(--n-ink);
                        font-size: 0.9rem;
                        text-align: left;
                        cursor: pointer;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 8px;
                    }
                    .pk__multiSelectBtn:hover { border-color: var(--n-primary); }
                    .pk__multiSelectBtn i { color: var(--n-muted); transition: transform 0.2s; }
                    .pk__multiSelectDropdown {
                        display: none;
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        background: var(--n-card);
                        border: 1px solid var(--n-border);
                        border-radius: 8px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                        z-index: 100;
                        max-height: 300px;
                        overflow-y: auto;
                        margin-top: 4px;
                    }
                    .pk__multiSelectDropdown.show { display: block; }
                    .pk__multiSelectOption {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 12px 14px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--n-border);
                        color: var(--n-ink);
                    }
                    .pk__multiSelectOption:last-child { border-bottom: none; }
                    .pk__multiSelectOption:hover { background: var(--n-soft); }
                    .pk__multiSelectOption input[type="checkbox"] {
                        width: 18px;
                        height: 18px;
                        accent-color: var(--n-primary);
                    }
                    .pk__multiSelectLabel {
                        flex: 1;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 0.9rem;
                    }
                    .pk__multiSelectLabel strong { color: var(--n-ink); }
                    .pk__multiSelectCount { color: var(--n-muted); font-size: 0.8rem; }

                    /* Table - Desktop */
                    .pk__tableWrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .pk__table { width: 100%; border-collapse: collapse; }
                    .pk__table th { background: var(--n-soft); padding: 8px 6px; text-align: left; font-size: 0.6rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; border-bottom: 1px solid var(--n-border); white-space: nowrap; }
                    .pk__table td { padding: 8px 6px; border-bottom: 1px solid var(--n-border); vertical-align: middle; font-size: 0.8rem; }
                    .pk__table tr:last-child td { border-bottom: none; }
                    .pk__table tr:hover { background: rgba(59, 130, 246, 0.03); }
                    .pk__mapelLabel { font-size: 0.6rem; color: var(--n-muted); margin-top: 2px; display: block; }
                    .pk__tableSelect, .pk__tableInput { width: 100%; padding: 8px 6px; border-radius: 6px; border: 1px solid var(--n-border); font-size: 0.8rem; background: var(--n-card); color: var(--n-ink); }
                    .pk__tableSelect:focus, .pk__tableInput:focus { outline: none; border-color: var(--n-primary); }
                    .pk__guruJadwalSmall { font-size: 0.72rem; font-weight: 400; color: var(--n-muted); margin-top: 2px; }

                    .pk__uploadCell { display: flex; align-items: center; gap: 6px; }
                    .pk__uploadBtn { width: 34px; height: 34px; border-radius: 6px; border: 1px solid var(--n-border); background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; flex-shrink: 0; color: var(--n-ink); }
                    .pk__uploadBtn:hover { border-color: var(--n-primary); color: var(--n-primary); }
                    .pk__uploadBtn.has-file { background: #dcfce7; border-color: #10b981; color: #10b981; }
                    .pk__uploadBtn.uploading { background: #f1f5f9; }
                    .pk__viewLink { color: var(--n-primary); font-size: 0.85rem; }
                    .pk__rowActive { background: rgba(59, 130, 246, 0.03); }
                    .pk__rowInactive { opacity: 0.7; }

                    .pk__empty { text-align: center; padding: 30px; color: var(--n-muted); }
                    .pk__empty i { font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 8px; }
                    .pk__empty p { font-size: 0.85rem; margin: 0; }

                    .pk__footer { display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--n-border); margin-top: 14px; gap: 10px; flex-wrap: wrap; }
                    .pk__infoText { color: var(--n-muted); font-size: 0.75rem; display: flex; align-items: center; gap: 4px; }
                    .pk__submitBtn { padding: 12px 20px; background: var(--n-primary); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.9rem; flex-shrink: 0; }
                    .pk__submitBtn:hover:not(:disabled) { background: #1d4ed8; }
                    .pk__submitBtn:disabled { opacity: 0.6; cursor: not-allowed; }

                    /* Mobile Card Styles - hidden on desktop */
                    .pk__cardList { display: none; }
                    .pk__cardListMobile { display: none; }

                    /* Desktop: show table, hide cards */
                    @media (min-width: 641px) {
                        .pk__cardListMobile { display: none !important; }
                    }

                    /* Mobile: show cards, hide table */
                    @media (max-width: 640px) {
                        .pk { padding: 10px 6px; gap: 10px; }
                        .pk__loading { padding: 30px; }

                        .pk__pageHeader { padding: 12px 10px; border-radius: 8px; }
                        .pk__titleArea h1 { font-size: 1rem; }

                        .pk__card { padding: 12px 10px; border-radius: 8px; }
                        .pk__section { margin-bottom: 12px; }
                        .pk__sectionTitle { font-size: 0.8rem; margin-bottom: 8px; }

                        .pk__infoBox { padding: 8px 10px; }
                        .pk__infoRow { padding: 4px 0; }

                        .pk__dateInput, .pk__select, .pk__textarea { padding: 10px 10px; font-size: 16px; }

                        /* Multi select mobile */
                        .pk__multiSelectBtn { padding: 12px 14px; font-size: 16px; }
                        .pk__multiSelectDropdown { max-height: 250px; }

                        /* Hide desktop table on mobile */
                        .pk__tableDesktop { display: none; }

                        /* Show mobile card list */
                        .pk__cardListMobile { display: flex !important; }
                        .pk__cardList { display: flex !important; }

                        /* Mobile Card Styles */
                        .pk__cardList { flex-direction: column; gap: 12px; }

                        .pk__classCard { background: var(--n-card); border-radius: 12px; border: 1px solid var(--n-border); overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                        .pk__cardHeader { background: linear-gradient(135deg, var(--n-primary) 0%, #6366f1 100%); padding: 12px 10px; color: white; }
                        .pk__cardKelas { font-size: 1.1rem; font-weight: 700; }
                        .pk__cardMapel { font-size: 0.8rem; opacity: 0.9; margin-top: 3px; }
                        .pk__cardGuru { display: flex; align-items: center; gap: 10px; padding: 12px 10px; background: var(--n-soft); font-size: 0.9rem; color: var(--n-ink); border-bottom: 1px solid var(--n-border); }
                        .pk__cardGuru i { color: var(--n-primary); font-size: 1rem; }
                        .pk__cardGuru span { font-weight: 600; }

                        .pk__cardForm { padding: 12px 10px; display: flex; flex-direction: column; gap: 14px; }
                        .pk__cardField { display: flex; flex-direction: column; gap: 6px; }
                        .pk__cardField label { font-size: 0.75rem; font-weight: 600; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.3px; }
                        .pk__cardSelect { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--n-border); font-size: 0.9rem; background: white; color: var(--n-ink); -webkit-appearance: none; appearance: none; }
                        .pk__cardSelect:focus { outline: none; border-color: var(--n-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

                        .pk__cardUpload { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                        .pk__cardUploadBtn { display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 10px; border: 1.5px solid var(--n-border); background: white; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; color: var(--n-ink); }
                        .pk__cardUploadBtn:hover { border-color: var(--n-primary); color: var(--n-primary); transform: translateY(-1px); }
                        .pk__cardUploadBtn.has-file { background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-color: #10b981; color: #059669; }
                        .pk__cardUploadBtn.uploading { background: #f1f5f9; }
                        .pk__cardViewLink { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--n-primary); font-weight: 600; text-decoration: none; }

                        /* Card states */
                        .pk__cardActive { border-color: var(--n-primary); }
                        .pk__cardInactive { opacity: 0.7; filter: grayscale(20%); }

                        .pk__footer { flex-direction: column-reverse; gap: 10px; padding-top: 12px; margin-top: 12px; }
                        .pk__submitBtn { width: 100%; justify-content: center; padding: 16px 20px; font-size: 1rem; border-radius: 12px; }
                        .pk__infoText { width: 100%; justify-content: center; }
                    }

                    /* Very small screens */
                    @media (max-width: 380px) {
                        .pk__cardKelas { font-size: 1rem; }
                        .pk__cardHeader { padding: 12px 10px; }
                        .pk__cardForm { padding: 12px 10px; gap: 12px; }
                        .pk__cardGuru { font-size: 0.85rem; }
                    }

                    /* ===== DARK MODE ===== */
                    :global(.dark) .pk__loading { color: #8496b2; }
                    :global(.dark) .pk__loading i { color: var(--n-primary); }

                    :global(.dark) .pk__sectionTitle { color: #d5dce8; }

                    :global(.dark) .pk__infoLabel { color: #8496b2; }
                    :global(.dark) .pk__infoValue { color: #c8d6ec; }

                    :global(.dark) .pk__label { color: #c8d6ec; }
                    :global(.dark) .pk__optionalHint { color: #8496b2; }

                    :global(.dark) .pk__multiSelectBtn { background: #1c2439; color: #c8d6ec; }
                    :global(.dark) .pk__multiSelectBtn i { color: #8496b2; }
                    :global(.dark) .pk__multiSelectDropdown { background: #1c2439; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
                    :global(.dark) .pk__multiSelectOption { color: #c8d6ec; }
                    :global(.dark) .pk__multiSelectOption:hover { background: rgba(255,255,255,0.06); }
                    :global(.dark) .pk__multiSelectLabel strong { color: #d5dce8; }
                    :global(.dark) .pk__multiSelectCount { color: #8496b2; }

                    :global(.dark) .pk__table th { background: rgba(255,255,255,0.04); color: #8496b2; }
                    :global(.dark) .pk__table td { color: #c8d6ec; }
                    :global(.dark) .pk__table tr:hover { background: rgba(79,142,247,0.05); }
                    :global(.dark) .pk__mapelLabel { color: #8496b2; }
                    :global(.dark) .pk__tableSelect, :global(.dark) .pk__tableInput { background: #1c2439; color: #d5dce8; }
                    :global(.dark) .pk__guruJadwalSmall { color: #8496b2; }

                    :global(.dark) .pk__uploadBtn { background: #1c2439; color: #c8d6ec; }
                    :global(.dark) .pk__uploadBtn.has-file { background: rgba(16,185,129,0.15); border-color: #10b981; color: #10b981; }
                    :global(.dark) .pk__uploadBtn.uploading { background: rgba(255,255,255,0.04); }
                    :global(.dark) .pk__rowActive { background: rgba(79,142,247,0.05); }
                    :global(.dark) .pk__rowInactive { opacity: 0.6; }

                    :global(.dark) .pk__empty { color: #8496b2; }
                    :global(.dark) .pk__empty i { opacity: 0.25; }
                    :global(.dark) .pk__empty p { color: #a8b8d4; }
                    :global(.dark) .pk__infoText { color: #8496b2; }
                    :global(.dark) .pk__submitBtn:hover:not(:disabled) { background: var(--n-primary-light); }

                    :global(.dark) .pk__classCard { background: #1c2439; border-color: rgba(79,142,247,0.18); }
                    :global(.dark) .pk__cardKelas { color: #ffffff; }
                    :global(.dark) .pk__cardMapel { color: rgba(255,255,255,0.8); }
                    :global(.dark) .pk__cardGuru { background: rgba(255,255,255,0.04); color: #c8d6ec; }
                    :global(.dark) .pk__cardGuru span { color: #d5dce8; }
                    :global(.dark) .pk__cardField label { color: #8496b2; }
                    :global(.dark) .pk__cardSelect { background: #1c2439; color: #d5dce8; }
                    :global(.dark) .pk__cardSelect:focus { border-color: var(--n-primary); box-shadow: 0 0 0 3px rgba(79,142,247,0.12); }
                    :global(.dark) .pk__cardUploadBtn { background: #1c2439; color: #c8d6ec; }
                    :global(.dark) .pk__cardUploadBtn:hover { border-color: var(--n-primary); color: var(--n-primary); }
                    :global(.dark) .pk__cardUploadBtn.has-file { background: linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%); border-color: #10b981; color: #34d399; }
                    :global(.dark) .pk__cardUploadBtn.uploading { background: rgba(255,255,255,0.04); }
                    :global(.dark) .pk__cardInactive { opacity: 0.55; filter: none; }

                    :global(.dark) .pk__hint { color: #8496b2; }
                    :global(.dark) .pk__hint i { color: #8496b2; }
                    :global(.dark) .pk__textarea { background: #1c2439; color: #c8d6ec; }
                    :global(.dark) .pk__dateInput { background: #1c2439; color: #c8d6ec; }
                `}</style>
            </div>
        </PermissionGuard>
    );
}
