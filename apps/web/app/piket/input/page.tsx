'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { createPortal } from 'react-dom';
import { getCurrentUser } from '@/lib/auth-client';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { useTimezone } from '@/hooks/use-timezone';
import { useFileViewer } from '@/components/useFileViewer';
import { MobileFab } from '@/components/mobile';
import { InlineSelect } from '@/components/ui/InlineSelect';

// ─── Piket Input Page Interfaces ─────────────────────────────────────────────
interface JadwalItem {
    jam_ke: string;
    kelas: string;
    mapel: string;
    nama_guru?: string;
    hari?: string;
    tanggal?: string;
    ruang?: string;
}

interface ClassData {
    kelas: string;
    guru: string;
    guru_override: string;
    status: string;
    status_tambahan_1: string;
    status_tambahan_2: string;
    status_tambahan_3: string;
    dokumentasi_url: string;
    jams?: string[];
}

function createInitialClassData(schedule: JadwalItem[]): Record<string, ClassData> {
    const group: Record<string, { guru?: string; kelas: string; jams: string[] }> = {};
    schedule.forEach(item => {
        const teacher = item.nama_guru || 'Tanpa Guru';
        const displayName = (!item.ruang || item.kelas === item.ruang) ? item.kelas : `${item.kelas} (${item.ruang})`;
        const fKey = `${teacher}-${displayName}`;
        if (!group[fKey]) group[fKey] = { guru: item.nama_guru, kelas: displayName, jams: [] };
        group[fKey].jams.push(item.jam_ke);
    });

    const res: Record<string, ClassData> = {};
    Object.entries(group).forEach(([fKey, fg]) => {
        res[fKey] = {
            kelas: fg.kelas,
            jams: fg.jams,
            guru: fg.guru || '',
            guru_override: '',
            status: '',
            status_tambahan_1: '',
            status_tambahan_2: '',
            status_tambahan_3: '',
            dokumentasi_url: ''
        };
    });
    return res;
}

/**
 * Kompres dan konversi gambar/foto (dari kamera atau galeri) ke format WebP.
 * Menghasilkan berkas WebP (~80 - 180 KB) dengan dimensi maksimal 1280px.
 */
async function compressImageToWebP(fileOrBlob: File | Blob): Promise<{ blob: Blob; ext: string; mime: string }> {
    try {
        const bitmap = await createImageBitmap(fileOrBlob);
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { blob: fileOrBlob, ext: 'webp', mime: 'image/webp' };
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        let blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
        let ext = 'webp';
        let mime = 'image/webp';

        if (!blob || blob.type !== 'image/webp') {
            blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
            ext = 'jpg';
            mime = 'image/jpeg';
        }

        if (!blob) {
            return { blob: fileOrBlob, ext: 'webp', mime: 'image/webp' };
        }

        return { blob, ext, mime };
    } catch {
        return { blob: fileOrBlob, ext: 'webp', mime: 'image/webp' };
    }
}

// ─── Camera Modal ────────────────────────────────────────────────────────────
interface CameraModalProps {
    cameraStream: MediaStream | null;
    setCameraStream: (s: MediaStream | null) => void;
    capturePreview: string;
    setCapturePreview: (s: string) => void;
    cameraError: string;
    setCameraError: (s: string) => void;
    onCaptureSubmit: (blob: Blob) => void;
    onClose: () => void;
    onRetake: () => void;
    retakeVersion: number;
}

function CameraModalWrapper(props: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewBlobRef = useRef<Blob | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Start camera on mount and on retake (when retakeVersion increments).
    // Always stop any prior stream first before acquiring a new one.
    useEffect(() => {
        // Stop any prior stream before starting a new one
        const priorStream = streamRef.current;
        if (priorStream) {
            priorStream.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        let cancelled = false;
        navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: { ideal: 'environment' } }, audio: false })
            ?.then(s => {
                if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = s;
                props.setCameraStream(s);
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                }
            })
            ?.catch(() => {
                if (cancelled) return;
                props.setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser/perangkat Anda.');
            });

        return () => {
            cancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.retakeVersion]);

    const onBlobReady = (blob: Blob) => {
        previewBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        props.setCapturePreview(url);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        props.setCameraStream(null);
    };

    const handleCapture = () => {
        const video = videoRef.current;
        const stream = streamRef.current;
        if (!video || !stream) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) {
                canvas.toBlob(fbBlob => {
                    if (!fbBlob) { props.setCameraError('Gagal mengambil foto'); return; }
                    onBlobReady(fbBlob);
                }, 'image/jpeg', 0.82);
                return;
            }
            onBlobReady(blob);
        }, 'image/webp', 0.82);
    };

    const handleConfirm = () => {
        if (!previewBlobRef.current) return;
        props.onCaptureSubmit(previewBlobRef.current);
    };

    const handleRetake = () => {
        props.setCapturePreview('');
        previewBlobRef.current = null;
        props.setCameraError('');
        props.onRetake();
    };

    const modalContent = (
        <div className="pk__cameraOverlay">
            <div className="pk__cameraTitle">
                <i className="fa-solid fa-camera" style={{ marginRight: 8 }}></i>
                Ambil Foto Dokumentasi Langsung (Live)
            </div>

            {props.cameraError && !props.capturePreview && (
                <div className="pk__cameraError" style={{ textAlign: 'center', padding: '16px' }}>
                    <p style={{ margin: 0 }}>{props.cameraError}</p>
                </div>
            )}

            {props.capturePreview ? (
                <>
                    <img src={props.capturePreview} alt="Preview" className="pk__cameraPreview" />
                    <div className="pk__cameraActions">
                        <button className="pk__cameraBtn pk__cameraBtnRetake" onClick={handleRetake}>
                            <i className="fa-solid fa-rotate-left"></i> Ambil Ulang
                        </button>
                        <button className="pk__cameraBtn pk__cameraBtnConfirm" onClick={handleConfirm}>
                            <i className="fa-solid fa-check"></i> Gunakan Foto
                        </button>
                        <button className="pk__cameraBtn pk__cameraBtnCancel" onClick={props.onClose}>
                            <i className="fa-solid fa-xmark"></i> Batal
                        </button>
                    </div>
                </>
            ) : !props.cameraError ? (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="pk__cameraVideo"
                    />
                    <div className="pk__cameraActions">
                        <button className="pk__cameraBtn pk__cameraBtnCapture" onClick={handleCapture}>
                            <i className="fa-solid fa-camera"></i> Ambil Foto Langsung
                        </button>
                        <button className="pk__cameraBtn pk__cameraBtnCancel" onClick={props.onClose}>
                            <i className="fa-solid fa-xmark"></i> Batal
                        </button>
                    </div>
                </>
            ) : (
                <div className="pk__cameraActions" style={{ justifyContent: 'center' }}>
                    <button className="pk__cameraBtn pk__cameraBtnCancel" onClick={props.onClose}>
                        <i className="fa-solid fa-xmark"></i> Tutup
                    </button>
                </div>
            )}
        </div>
    );

    // Portal ke body agar selalu di atas dan centered
    return createPortal(modalContent, document.body);
}

// ─── Piket Input Page ─────────────────────────────────────────────────────────

// Desktop upload cell — always camera, red icon
function DesktopUploadCell({
    keyName, data, hasStatus, uploading, uploadProgress, onOpenCamera
}: {
    keyName: string; data: any; hasStatus: boolean;
    uploading: Record<string, boolean>; uploadProgress: Record<string, number>;
    onOpenCamera: (key: string) => void;
}) {
    if (uploading[keyName]) {
        return (
            <span className="pk__uploadBtn uploading">
                <i className="fa-solid fa-spinner fa-spin"></i> {uploadProgress[keyName]}%
            </span>
        );
    }
    if (hasStatus && data.dokumentasi_url) {
        return (
            <button type="button" className="pk__uploadBtn has-file"
                onClick={(e) => { e.stopPropagation(); onOpenCamera(keyName); }} title="Ambil ulang foto">
                <i className="fa-solid fa-check"></i>
            </button>
        );
    }
    if (hasStatus) {
        return (
            <button type="button" className="pk__uploadBtn pk__uploadBtnRequired"
                onClick={(e) => { e.stopPropagation(); onOpenCamera(keyName); }} title="Ambil foto dokumentasi">
                <i className="fa-solid fa-camera"></i>
            </button>
        );
    }
    return (
        <span className="pk__uploadBtn pk__uploadBtnDisabled" title="Pilih status kehadiran terlebih dahulu">
            <i className="fa-solid fa-camera"></i>
        </span>
    );
}

// Mobile card upload cell — always camera
function MobileUploadCell({
    keyName, data, hasStatus, uploading, uploadProgress, onOpenCamera
}: {
    keyName: string; data: any; hasStatus: boolean;
    uploading: Record<string, boolean>; uploadProgress: Record<string, number>;
    onOpenCamera: (key: string) => void;
}) {
    if (uploading[keyName]) {
        return (
            <span className="pk__cardUploadBtn uploading">
                <i className="fa-solid fa-spinner fa-spin"></i> {uploadProgress[keyName]}%
            </span>
        );
    }
    if (hasStatus && data.dokumentasi_url) {
        return (
            <button type="button" className="pk__cardUploadBtn has-file"
                onClick={(e) => { e.stopPropagation(); onOpenCamera(keyName); }}>
                <i className="fa-solid fa-check-circle"></i> Tersimpan — Ambil Ulang
            </button>
        );
    }
    if (hasStatus) {
        return (
            <button type="button" className="pk__cardUploadBtn pk__cardUploadBtnAmbil"
                onClick={(e) => { e.stopPropagation(); onOpenCamera(keyName); }}>
                <i className="fa-solid fa-camera"></i> Ambil Foto
            </button>
        );
    }
    return (
        <span className="pk__cardUploadBtn pk__cardUploadBtnDisabled">
            <i className="fa-solid fa-camera"></i> Ambil Foto
        </span>
    );
}

export default function PiketInputPage(props?: any) {
    const isTabMode = Boolean(props?.isTabMode);
    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    // Admin check — computed from user data (roles array + raw role string fallback)
    const isAdmin = !!(
        user && (
            (user.roles || []).some((r: string) => r.toUpperCase() === 'ADMIN') ||
            (user.role || '').toUpperCase().split(/[,_]/).includes('ADMIN')
        )
    );
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [guruList, setGuruList] = useState<{ nip: string; nama_lengkap: string }[]>([]);
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

    // Master waktu for today (to check jam active window)
    const [masterWaktu, setMasterWaktu] = useState<Record<string, { mulai: string; selesai: string }>>({});

    // Camera capture state
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraKey, setCameraKey] = useState(''); // classData key being captured
    const [isTidakEfektif, setIsTidakEfektif] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState('');
    const [capturePreview, setCapturePreview] = useState<string>(''); // blob URL preview
    const [retakeVersion, setRetakeVersion] = useState(0); // starts at 0 (effect starts camera); increments on retake to trigger restart

    // Additional status count (0-3) per class
    const [additionalStatusCount, setAdditionalStatusCount] = useState<Record<string, number>>({});

    // Mobile detection (touch device = mobile)
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(pointer: coarse)');
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Timezone from settings
    const { getCurrentDate: getTzDate } = useTimezone();

    const openCamera = (key: string) => {
        setCameraKey(key);
        setCameraError('');
        setCapturePreview('');
        setCameraOpen(true);
    };

    const closeCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setCameraOpen(false);
        setCameraKey('');
        setCapturePreview('');
        setCameraError('');
        setRetakeVersion(0); // reset to 0 so next open triggers camera start via useEffect
    };

    const retakePhoto = () => {
        setCapturePreview('');
        setCameraError('');
        setRetakeVersion(v => v + 1);
    };

    // Additional status functions (per class key)
    const addAdditionalStatus = (key: string) => {
        const current = additionalStatusCount[key] || 0;
        if (current < 3) {
            setAdditionalStatusCount(prev => ({ ...prev, [key]: current + 1 }));
        }
    };

    const removeAdditionalStatus = (key: string, num: number) => {
        updateClassData(key, `status_tambahan_${num}` as keyof ClassData, '');
        const current = additionalStatusCount[key] || 0;
        const newCount = current - 1;
        setAdditionalStatusCount(prev => {
            const next = { ...prev, [key]: newCount };
            if (newCount === 0) delete next[key];
            return next;
        });
    };

    // Get unique jam options for dropdown
    const jamOptions = useMemo(() => {
        return Object.keys(fullSchedule).sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numA - numB;
        });
    }, [fullSchedule]);

    // Disabled jam options:
    // - USER: hanya hari ini (timezone) yang bisa dipilih; hanya jam yang sedang berjalan bisa dipilih.
    // - ADMIN: bypass restrictif tanggal & jam (bisa isi semua jam termasuk yang sudah lewat).
    const disabledJam = useMemo(() => {
        if (isAdmin) return {};

        const result: Record<string, boolean> = {};
        const todayTz = getTzDate();

        // Jika BUKAN hari ini — block SEMUA jam pada jadwal.
        // Sebelumnya hanya jam yang ada di masterWaktu yang di-block, sehingga jam
        // terjadwal tanpa data waktu bisa lolos dan dipilih untuk tanggal lampau/mendatang.
        if (!selectedDate || selectedDate !== todayTz) {
            jamOptions.forEach(jam => { result[jam] = true; });
            return result;
        }

        // Hari ini: disable jam yang belum waktunya DAN yang sudah lewat (bukan jam aktif)
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        Object.entries(masterWaktu).forEach(([jam, times]) => {
            const [h, m] = times.mulai.split(':').map(Number);
            const mulaiMinutes = h * 60 + m;
            const [hs, ms] = times.selesai.split(':').map(Number);
            const selesaiMinutes = hs * 60 + ms;
            // Disable jika jam BELUM mulai ATAU SUDAH selesai
            result[jam] = currentMinutes < mulaiMinutes || currentMinutes > selesaiMinutes;
        });
        return result;
    }, [selectedDate, masterWaktu, isAdmin, jamOptions]);

    // Get filled class count
    const filledClassCount = useMemo(() => {
        return Object.entries(classData)
            .filter(([key, d]) => {
                return d.kelas && d.jams && d.jams.includes(selectedJam) && (d.guru || d.status);
            })
            .length;
    }, [classData, selectedJam]);

    // Get all schedule items for table display (Grouping by teacher AND class/room)
    const scheduleItems = useMemo(() => {
        const filtered = selectedJam !== ''
            ? allClassesForDate.filter(item => selectedJam === item.jam_ke)
            : [];

        // Group by (guru, kelas/ruang)
        const finalGroup: Record<string, any> = {};
        filtered.forEach(item => {
            const teacher = item.nama_guru || 'Tanpa Guru';
            const displayName = (!item.ruang || item.kelas === item.ruang) ? item.kelas : `${item.kelas} (${item.ruang})`;
            const fKey = `${teacher}-${displayName}`;

            if (!finalGroup[fKey]) {
                finalGroup[fKey] = {
                    key: fKey,
                    guru: item.nama_guru,
                    kelas: displayName,
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
            const userData = await getCurrentUser();
            if (userData) {
                setUser(userData);
                setGuruPiket(userData.nama || userData.nama_lengkap || '');
                setNip(userData.nip || '');
            }
            await loadKelas();
            await loadGuruList();
            await loadMasterDropdown();
            setSelectedDate(getTzDate());
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
            const initial = createInitialClassData(allClassesForDate);
            setClassData(prev => {
                const next: Record<string, ClassData> = {};
                Object.entries(initial).forEach(([fKey, base]) => {
                    const existing = prev[fKey];
                    next[fKey] = {
                        ...base,
                        guru_override: existing?.guru_override || '',
                        status: existing?.status || '',
                        status_tambahan_1: existing?.status_tambahan_1 || '',
                        status_tambahan_2: existing?.status_tambahan_2 || '',
                        status_tambahan_3: existing?.status_tambahan_3 || '',
                        dokumentasi_url: existing?.dokumentasi_url || ''
                    };
                });
                return next;
            });
        } else {
            setClassData({});
        }
    }, [allClassesForDate]);

    const selectJam = (jam: string) => {
        setSelectedJam(prev => prev === jam ? '' : jam);
        document.getElementById('jamMultiSelect')?.classList.remove('show');
    };

    const loadScheduleForDate = async (date: string) => {
        try {
            const dateObj = new Date(date + 'T12:00:00');
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const dayName = dayNames[dateObj.getDay()];

            const [jadwalRes, waktuRes] = await Promise.all([
                fetch(`/api/jadwal?hari=${encodeURIComponent(dayName)}&aktif=true`),
                fetch(`/api/master/waktu?hari=${encodeURIComponent(dayName)}&program=Reguler`)
            ]);

            const jadwalJson = await jadwalRes.json();
            const waktuJson = await waktuRes.json();

            if (jadwalJson.ok && jadwalJson.data) {
                const schedule = jadwalJson.data as JadwalItem[];

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

            // Load master waktu for jam active window check
            if (waktuJson.ok && waktuJson.data) {
                const waktuMap: Record<string, { mulai: string; selesai: string }> = {};
                waktuJson.data.forEach((w: any) => {
                    waktuMap[String(w.jam_ke)] = { mulai: w.mulai, selesai: w.selesai };
                });
                setMasterWaktu(waktuMap);
            } else {
                setMasterWaktu({});
            }
        } catch (e) {
            console.error('Error loading schedule:', e);
            setFullSchedule({});
            setAllClassesForDate([]);
            setMasterWaktu({});
        }
    };

    const loadKelas = async () => {
        try {
            const res = await fetch('/api/master/kelas');
            const json = await res.json().catch(() => null);
            if (json && json.ok && Array.isArray(json.data)) {
                setKelasList(json.data.map((k: any) => k.nama_kelas || k.nama || '').filter(Boolean));
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
            const existing = prev[fKey];

            let baseData = existing;
            if (!baseData || !baseData.kelas || !baseData.jams || baseData.jams.length === 0) {
                // Cari data dasar dari allClassesForDate berdasarkan fKey yang persis sama
                const matchingItems = allClassesForDate.filter(item => {
                    const teacher = item.nama_guru || 'Tanpa Guru';
                    const displayName = (!item.ruang || item.kelas === item.ruang) ? item.kelas : `${item.kelas} (${item.ruang})`;
                    return `${teacher}-${displayName}` === fKey;
                });

                if (matchingItems.length > 0) {
                    const first = matchingItems[0];
                    const displayName = (!first.ruang || first.kelas === first.ruang) ? first.kelas : `${first.kelas} (${first.ruang})`;
                    baseData = {
                        ...(baseData || {}),
                        kelas: displayName,
                        jams: matchingItems.map(item => item.jam_ke),
                        guru: first.nama_guru || '',
                        guru_override: baseData?.guru_override || '',
                        status: baseData?.status || '',
                        status_tambahan_1: baseData?.status_tambahan_1 || '',
                        status_tambahan_2: baseData?.status_tambahan_2 || '',
                        status_tambahan_3: baseData?.status_tambahan_3 || '',
                        dokumentasi_url: baseData?.dokumentasi_url || ''
                    };
                } else {
                    baseData = baseData || {
                        kelas: '',
                        jams: [],
                        guru: '',
                        guru_override: '',
                        status: '',
                        status_tambahan_1: '',
                        status_tambahan_2: '',
                        status_tambahan_3: '',
                        dokumentasi_url: ''
                    };
                }
            }

            const updated = { ...baseData, [field]: value };
            return { ...prev, [fKey]: updated };
        });
    };

    // ─── Upload via centralized API route ─────────────────────────────
    const handleFileUpload = async (key: string, file: File | Blob) => {
        if (!file) return;

        try {
            setUploading(prev => ({ ...prev, [key]: true }));
            setUploadProgress(prev => ({ ...prev, [key]: 0 }));

            // Kompresi dan konversi otomatis ke WebP di browser (~80-180 KB)
            const { blob: compressedBlob, ext } = await compressImageToWebP(file);

            // Upload via centralized API route (handles all storage types)
            const sanitizedKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
            const formData = new FormData();
            formData.append('file', compressedBlob, `piket_${sanitizedKey}_${Date.now()}.${ext}`);
            formData.append('folder', 'piket');

            // Simulate progress (since API doesn't support streaming progress)
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 15;
                if (progress <= 90) {
                    setUploadProgress(prev => ({ ...prev, [key]: progress }));
                }
            }, 150);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            setUploadProgress(prev => ({ ...prev, [key]: 100 }));

            const json = await res.json();

            if (!json.ok) {
                throw new Error(json.error || 'Upload gagal');
            }

            const finalUrl = json.publicUrl || json.url;
            updateClassData(key, 'dokumentasi_url', finalUrl);
        } catch (err: any) {
            console.error('Upload error:', err);
            Swal.fire('Error', err.message, 'error');
        } finally {
            setUploading(prev => ({ ...prev, [key]: false }));
            setUploadProgress(prev => ({ ...prev, [key]: 0 }));
        }
    };

    // Upload fallback (with WebP compression)
    const uploadToSupabaseStorage = async (key: string, file: Blob): Promise<string | null> => {
        const timestamp = Date.now();
        const sanitizedKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
        const { blob: compressedBlob, ext } = await compressImageToWebP(file);
        const formData = new FormData();
        formData.append('file', compressedBlob, `piket_${sanitizedKey}_${timestamp}.${ext}`);
        formData.append('folder', 'piket');

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.ok || !json.publicUrl) {
            console.error('Storage fallback error:', json.error);
            return null;
        }
        return json.publicUrl;
    };

    // Upload captured photo blob from camera modal
    const handleCaptureSubmit = async (blob: Blob) => {
        const key = cameraKey;
        await handleFileUpload(key, blob);
        closeCamera();
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();

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
                // If Tidak Efektif, include all classes for the selected jam regardless of individual status
                if (isTidakEfektif) return jams.includes(selectedJam);
                // Otherwise only include entries where status is filled
                return fData.status && fData.kelas && jams.includes(selectedJam);
            })
            .flatMap(([key, d]) => {
                const fData = d as any;
                const jams = fData.jams || [];

                const relevantJams = jams.filter((j: string) => j === selectedJam);
                return relevantJams.map((j: string) => ({
                    kelas: fData.kelas,
                    jam_ke: j,
                    guru_jadwal: fData.guru,
                    guru_pengganti: fData.guru_override?.trim() || null,
                    guru: fData.guru_override?.trim() || fData.guru,
                    status: isTidakEfektif ? 'Tidak Efektif' : fData.status,
                    status_tambahan_1: fData.status_tambahan_1 || null,
                    status_tambahan_2: fData.status_tambahan_2 || null,
                    status_tambahan_3: fData.status_tambahan_3 || null,
                    dokumentasi_url: fData.dokumentasi_url || null
                }));
            });

        const filledDetails = details;

        // Validasi: jika status dipilih, dokumentasi wajib diisi (kecuali Tidak Efektif)
        if (!isTidakEfektif) {
            const missingDokumentasi = filledDetails.find(d => d.status && !d.dokumentasi_url);
            if (missingDokumentasi) {
                Swal.fire('Peringatan', `Dokumentasi wajib diisi untuk kelas ${missingDokumentasi.kelas}!`, 'warning');
                return;
            }
        }

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
                if (result.wa && result.wa.status === 'failed') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Tersimpan (WA Gagal Terkirim)',
                        html: `Laporan Piket berhasil disimpan ke database.<br/><br/><div style="text-align:left;background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:6px;font-size:0.85rem;color:#b91c1c;"><strong>Notifikasi WA tidak terkirim:</strong><br/>${result.wa.error || 'Provider WhatsApp belum terhubung atau gagal.'}</div>`,
                    });
                } else if (result.wa && result.wa.status === 'skipped') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: result.message || 'Laporan Piket berhasil disimpan (Notifikasi WA nonaktif).',
                        timer: 3000
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: result.message || 'Laporan Piket berhasil disimpan!',
                        timer: 3000
                    });
                }
                setSelectedJam('');
                setKeteranganTambahan('');
                setAdditionalStatusCount({});
                if (allClassesForDate.length > 0) {
                    setClassData(createInitialClassData(allClassesForDate));
                } else {
                    setClassData({});
                }
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
        return <PageLoader label="Memuat data…" />;
    }

    return (
        <>
            {/* Mobile: tombol kirim dipindah jadi ikon tengah bottom-nav,
                menggantikan ikon Menu — komponen ini sendiri tidak merender
                apa pun, cuma mendaftarkan aksinya. Tombol aslinya (.pk__submitBtn)
                disembunyikan di mobile lewat CSS (lihat <style jsx global> di bawah). */}
            <MobileFab label="Kirim Laporan" icon="send-fill" onClick={() => { if (!submitting) handleSubmit(); }} />
            <div className="pk">
                {/* Header */}
                {!isTabMode && (
                    <div className="pk__pageHeader">
                        <div className="pk__titleArea">
                            <h1>Laporan Piket</h1>
                            <p>Input kehadiran kelas - {guruPiket}</p>
                        </div>
                    </div>
                )}

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

                        {/* Tanggal & Jam Piket (1 Baris di Desktop, 2 Kolom) */}
                        <div className="pk__formRow">
                            <div className="pk__section pk__sectionCol">
                                <h3 className="pk__sectionTitle"><i className="fa-solid fa-calendar"></i> Pilih Tanggal</h3>
                                <DatePicker
                                    className="pk__dateInput"
                                    value={selectedDate}
                                    onChange={setSelectedDate}
                                />
                            </div>

                            <div className="pk__section pk__sectionCol">
                                <h3 className="pk__sectionTitle">
                                    <i className="fa-solid fa-clock"></i> Pilih Jam Piket
                                </h3>
                                <InlineSelect
                                    value={selectedJam}
                                    onChange={(val) => setSelectedJam(val)}
                                    minWidth="100%"
                                    height="38px"
                                >
                                    <option value="">-- Pilih Jam --</option>
                                    {jamOptions.map(jam => {
                                        const isDisabled = disabledJam[jam];
                                        const todayTz = getTzDate();
                                        const isToday = selectedDate === todayTz;
                                        const count = fullSchedule[jam]?.length || 0;
                                        const timeRange = masterWaktu[jam] ? ` (${masterWaktu[jam].mulai} - ${masterWaktu[jam].selesai})` : '';
                                        const statusText = isDisabled ? (!isToday ? ' [Tidak tersedia]' : ' [Belum waktunya]') : ` (${count} kelas)`;

                                        return (
                                            <option key={jam} value={jam} disabled={isDisabled}>
                                                Jam Ke-{jam}{timeRange}{statusText}
                                            </option>
                                        );
                                    })}
                                </InlineSelect>
                            </div>
                        </div>

                        {/* Opsi Tidak Efektif */}
                        <div className="pk__section">
                            <label className="pk__toggleCard">
                                <div className="pk__toggleInfo">
                                    <span className="pk__toggleLabel">Hari Tidak Efektif</span>
                                </div>
                                <div className="pk__toggleSwitch">
                                    <input
                                        type="checkbox"
                                        checked={isTidakEfektif}
                                        onChange={(e) => setIsTidakEfektif(e.target.checked)}
                                    />
                                    <span className="pk__toggleSlider"></span>
                                </div>
                            </label>
                        </div>

                        {/* Keterangan */}
                        <div className="pk__section">
                            <h3 className="pk__sectionTitle">
                                <i className="fa-solid fa-note-sticky"></i> Keterangan Tambahan
                            </h3>
                            <textarea
                                className="pk__textarea"
                                placeholder="Catatan umum piket hari ini..."
                                rows={3}
                                value={keteranganTambahan}
                                onChange={(e) => setKeteranganTambahan(e.target.value)}
                            />
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
                                                {!isTidakEfektif && <th>Dokumentasi <span className="pk__required">*Wajib</span></th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scheduleItems.map((group: any) => {
                                                const key = group.key;
                                                const scheduledGuru = group.guru || 'Tanpa Guru';
                                                const data = (classData as any)[key] || {
                                                    kelas: group.kelas,
                                                    guru: scheduledGuru,
                                                    guru_override: '',
                                                    status: '',
                                                    status_tambahan_1: '',
                                                    status_tambahan_2: '',
                                                    status_tambahan_3: '',
                                                    dokumentasi_url: ''
                                                };
                                                const hasStatus = !!data.status;
                                                const statusCount = additionalStatusCount[key] || 0;
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
                                                            <div className="pk__statusCell">
                                                                <div className="pk__statusMainRow">
                                                                    <select
                                                                        className="pk__tableSelect"
                                                                        value={isTidakEfektif ? 'Tidak Efektif' : data.status}
                                                                        onChange={(e) => updateClassData(key, 'status', e.target.value)}
                                                                        disabled={isTidakEfektif}
                                                                    >
                                                                        {isTidakEfektif ? (
                                                                            <option value="Tidak Efektif">Tidak Efektif</option>
                                                                        ) : (
                                                                            <>
                                                                                <option value="">Pilih...</option>
                                                                                {kehadiranOptions.map(opt => (
                                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                                ))}
                                                                            </>
                                                                        )}
                                                                    </select>
                                                                    {!isTidakEfektif && hasStatus && statusCount < 3 && (
                                                                        <button type="button" className="pk__addStatusBtn" onClick={() => addAdditionalStatus(key)} title="Tambah Status">
                                                                            <i className="fa-solid fa-plus"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {/* Status Tambahan 1 */}
                                                                {!isTidakEfektif && statusCount >= 1 && (
                                                                    <div className="pk__statusTambahanRow pk__slideDown">
                                                                        <select
                                                                            className="pk__tableSelect pk__statusTambahanSelect"
                                                                            value={data.status_tambahan_1 || ''}
                                                                            onChange={(e) => updateClassData(key, 'status_tambahan_1', e.target.value)}
                                                                        >
                                                                            <option value="">Status Tambahan 1...</option>
                                                                            {kehadiranOptions.map(opt => (
                                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button type="button" className="pk__removeStatusBtn" onClick={() => removeAdditionalStatus(key, 1)} title="Hapus Status 1">
                                                                            <i className="fa-solid fa-xmark"></i>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {/* Status Tambahan 2 */}
                                                                {!isTidakEfektif && statusCount >= 2 && (
                                                                    <div className="pk__statusTambahanRow pk__slideDown">
                                                                        <select
                                                                            className="pk__tableSelect pk__statusTambahanSelect"
                                                                            value={data.status_tambahan_2 || ''}
                                                                            onChange={(e) => updateClassData(key, 'status_tambahan_2', e.target.value)}
                                                                        >
                                                                            <option value="">Status Tambahan 2...</option>
                                                                            {kehadiranOptions.map(opt => (
                                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button type="button" className="pk__removeStatusBtn" onClick={() => removeAdditionalStatus(key, 2)} title="Hapus Status 2">
                                                                            <i className="fa-solid fa-xmark"></i>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {/* Status Tambahan 3 */}
                                                                {!isTidakEfektif && statusCount >= 3 && (
                                                                    <div className="pk__statusTambahanRow pk__slideDown">
                                                                        <select
                                                                            className="pk__tableSelect pk__statusTambahanSelect"
                                                                            value={data.status_tambahan_3 || ''}
                                                                            onChange={(e) => updateClassData(key, 'status_tambahan_3', e.target.value)}
                                                                        >
                                                                            <option value="">Status Tambahan 3...</option>
                                                                            {kehadiranOptions.map(opt => (
                                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button type="button" className="pk__removeStatusBtn" onClick={() => removeAdditionalStatus(key, 3)} title="Hapus Status 3">
                                                                            <i className="fa-solid fa-xmark"></i>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
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
                                                        {!isTidakEfektif && (
                                                            <td>
                                                                <div className="pk__uploadCell">
                                                                    <DesktopUploadCell
                                                                        keyName={key}
                                                                        data={data}
                                                                        hasStatus={hasStatus}
                                                                        uploading={uploading}
                                                                        uploadProgress={uploadProgress}
                                                                        onOpenCamera={openCamera}
                                                                    />
                                                                </div>
                                                            </td>
                                                        )}
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
                                            kelas: group.kelas,
                                            guru: scheduledGuru,
                                            guru_override: '',
                                            status: '',
                                            status_tambahan_1: '',
                                            status_tambahan_2: '',
                                            status_tambahan_3: '',
                                            dokumentasi_url: ''
                                        };
                                        const hasStatus = !!data.status;
                                        const statusCount = additionalStatusCount[key] || 0;
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
                                                            value={isTidakEfektif ? 'Tidak Efektif' : data.status}
                                                            onChange={(e) => updateClassData(key, 'status', e.target.value)}
                                                            disabled={isTidakEfektif}
                                                        >
                                                            {isTidakEfektif ? (
                                                                <option value="Tidak Efektif">Tidak Efektif</option>
                                                            ) : (
                                                                <>
                                                                    <option value="">Pilih...</option>
                                                                    {kehadiranOptions.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </select>
                                                    </div>
                                                    {/* Status Tambahan 1 - Mobile */}
                                                    {!isTidakEfektif && statusCount >= 1 && (
                                                        <div className="pk__cardField pk__slideDown">
                                                            <label>Status Tambahan 1</label>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <select
                                                                    className="pk__cardSelect"
                                                                    value={data.status_tambahan_1 || ''}
                                                                    onChange={(e) => updateClassData(key, 'status_tambahan_1', e.target.value)}
                                                                    style={{ flex: 1 }}
                                                                >
                                                                    <option value="">Pilih...</option>
                                                                    {kehadiranOptions.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </select>
                                                                {statusCount < 3 && (
                                                                    <button type="button" className="pk__addStatusBtn" onClick={() => addAdditionalStatus(key)} title="Tambah Status">
                                                                        <i className="fa-solid fa-plus"></i>
                                                                    </button>
                                                                )}
                                                                <button type="button" className="pk__removeStatusBtn" onClick={() => removeAdditionalStatus(key, 1)} title="Hapus">
                                                                    <i className="fa-solid fa-xmark"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Status Tambahan 2 - Mobile */}
                                                    {!isTidakEfektif && statusCount >= 2 && (
                                                        <div className="pk__cardField pk__slideDown">
                                                            <label>Status Tambahan 2</label>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <select
                                                                    className="pk__cardSelect"
                                                                    value={data.status_tambahan_2 || ''}
                                                                    onChange={(e) => updateClassData(key, 'status_tambahan_2', e.target.value)}
                                                                    style={{ flex: 1 }}
                                                                >
                                                                    <option value="">Pilih...</option>
                                                                    {kehadiranOptions.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </select>
                                                                {statusCount < 3 && (
                                                                    <button type="button" className="pk__addStatusBtn" onClick={() => addAdditionalStatus(key)} title="Tambah Status">
                                                                        <i className="fa-solid fa-plus"></i>
                                                                    </button>
                                                                )}
                                                                <button type="button" className="pk__removeStatusBtn" onClick={() => removeAdditionalStatus(key, 2)} title="Hapus">
                                                                    <i className="fa-solid fa-xmark"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Status Tambahan 3 - Mobile */}
                                                    {!isTidakEfektif && statusCount >= 3 && (
                                                        <div className="pk__cardField pk__slideDown">
                                                            <label>Status Tambahan 3</label>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <select
                                                                    className="pk__cardSelect"
                                                                    value={data.status_tambahan_3 || ''}
                                                                    onChange={(e) => updateClassData(key, 'status_tambahan_3', e.target.value)}
                                                                    style={{ flex: 1 }}
                                                                >
                                                                    <option value="">Pilih...</option>
                                                                    {kehadiranOptions.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </select>
                                                                <button type="button" className="pk__removeStatusBtn" onClick={() => removeAdditionalStatus(key, 3)} title="Hapus">
                                                                    <i className="fa-solid fa-xmark"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
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
                                                    {!isTidakEfektif && (
                                                        <div className="pk__cardField">
                                                            <label>Dokumentasi <span className={hasStatus ? 'pk__required' : 'pk__optionalHint'}>{hasStatus ? '*Wajib' : '(Opsional)'}</span></label>
                                                            <div className="pk__cardUpload">
                                                                <MobileUploadCell
                                                                    keyName={key}
                                                                    data={data}
                                                                    hasStatus={hasStatus}
                                                                    uploading={uploading}
                                                                    uploadProgress={uploadProgress}
                                                                    onOpenCamera={openCamera}
                                                                />
                                                                {data.dokumentasi_url && (
                                                                    <button type="button" className="pk__cardViewLink"
                                                                        onClick={(e) => { e.stopPropagation(); openFile(data.dokumentasi_url, 'Dokumentasi Piket'); }}>
                                                                        <i className="fa-solid fa-eye"></i> Lihat
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
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

                <style jsx global>{`
                    .pk { display: flex; flex-direction: column; gap: 16px; padding: 0; max-width: 100%; margin: 0; }

                    .pk__loading { display: flex; align-items: center; justify-content: center; padding: 40px; gap: 10px; color: var(--n-muted); }
                    .pk__loading i { font-size: 1.3rem; color: var(--n-primary); }

                    .pk__pageHeader { background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%))); padding: 22px 32px; border-radius: 16px; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                    .pk__titleArea h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
                    .pk__titleArea p { font-size: 0.85rem; opacity: 0.9; margin: 4px 0 0; }

                    .pk__card { background: var(--n-card); border-radius: 12px; border: 1px solid var(--n-border); padding: 18px 20px; }
                    .pk__section { margin-bottom: 20px; }
                    .pk__section:last-child { margin-bottom: 0; }
                    .pk__formRow { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
                    .pk__sectionCol { margin-bottom: 0 !important; }
                    .pk__sectionTitle { font-size: 0.78rem; font-weight: 700; color: var(--n-ink); margin: 0 0 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; text-transform: uppercase; letter-spacing: 0.02em; }
                    .pk__sectionTitle i { color: var(--n-primary); font-size: 0.82rem; }

                    .pk__infoBox { background: var(--n-soft); padding: 8px 10px; border-radius: 8px; }
                    .pk__infoRow { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--n-border); }
                    .pk__infoRow:last-child { border-bottom: none; }
                    .pk__infoLabel { color: var(--n-muted); font-size: 0.72rem; }
                    .pk__infoValue { font-weight: 600; color: var(--n-ink); font-size: 0.82rem; }

                    .pk__dateInput, .pk__select { width: 100%; height: 36px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--n-border); font-size: 0.82rem; background-color: var(--n-card); color: var(--n-ink); -webkit-appearance: none !important; appearance: none !important; }
                    .pk__textarea { width: 100%; min-height: 76px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--n-border); font-size: 0.82rem; font-family: inherit; line-height: 1.5; background-color: var(--n-card); color: var(--n-ink); box-sizing: border-box; resize: vertical; }
                    .pk__select { background-color: var(--n-card) !important; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 7'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M1 2l4 3 4-3'/%3e%3c/svg%3e") !important; background-repeat: no-repeat !important; background-position: right 10px center !important; background-size: 10px 7px !important; padding-right: 28px !important; }
                    .pk__select:focus, .pk__textarea:focus { outline: none; border-color: var(--n-primary); }
                    .pk__hint { font-size: 0.7rem; color: var(--n-muted); margin-top: 6px; display: flex; align-items: center; gap: 4px; }

                    .pk__formGroup { margin-bottom: 10px; }
                    .pk__label { display: block; font-size: 0.75rem; font-weight: 600; color: var(--n-ink); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.02em; }

                    .pk__required { color: #ef4444; font-size: 0.65rem; font-weight: 500; margin-left: 4px; text-transform: none; }
                    .pk__optionalHint { color: var(--n-muted); font-weight: 400; font-size: 0.7rem; }

                    /* Multi Select Dropdown */
                    .pk__multiSelect { position: relative; }
                    .pk__multiSelectBtn {
                        width: 100%;
                        height: 36px;
                        padding: 6px 12px;
                        border: 1px solid var(--n-border);
                        border-radius: 8px;
                        background: var(--n-card);
                        color: var(--n-ink);
                        font-size: 0.82rem;
                        text-align: left;
                        cursor: pointer;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 8px;
                    }
                    .pk__multiSelectBtn:hover { border-color: var(--n-primary); }
                    .pk__multiSelectBtn i { color: var(--n-muted); transition: transform 0.2s; font-size: 0.8rem; }
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
                        padding: 10px 12px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--n-border);
                        color: var(--n-ink);
                    }
                    .pk__multiSelectOption:last-child { border-bottom: none; }
                    .pk__multiSelectOption:hover { background: var(--n-soft); }
                    .pk__multiSelectOption input[type="checkbox"] {
                        width: 16px;
                        height: 16px;
                        accent-color: var(--n-primary);
                    }
                    .pk__multiSelectLabel {
                        flex: 1;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 0.82rem;
                    }
                    .pk__multiSelectLabel strong { color: var(--n-ink); }
                    .pk__multiSelectCount { color: var(--n-muted); font-size: 0.75rem; }
                    .pk__multiSelectOption--disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .pk__multiSelectOption--disabled:hover { background: transparent; }
                    .pk__multiSelectCount--disabled { color: #dc2626; font-style: italic; }

                    /* Toggle Switch */
                    .pk__toggleCard {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 12px;
                        background: var(--n-soft);
                        border-radius: 10px;
                        cursor: pointer;
                        transition: background 0.2s;
                        border: 1px solid var(--n-border);
                    }
                    .pk__toggleCard:hover { background: rgba(59, 130, 246, 0.05); }
                    .pk__toggleInfo { flex: 1; margin-right: 20px; }
                    .pk__toggleLabel { font-size: 0.82rem; font-weight: 700; color: var(--n-ink); display: block; }
                    .pk__toggleDesc { font-size: 0.72rem; color: var(--n-muted); margin-top: 2px; line-height: 1.4; }
                    
                    .pk__toggleSwitch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
                    .pk__toggleSwitch input { opacity: 0; width: 0; height: 0; }
                    .pk__toggleSlider {
                        position: absolute; cursor: pointer; inset: 0;
                        background-color: #cbd5e1; transition: .3s; border-radius: 22px;
                    }
                    .pk__toggleSlider:before {
                        position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
                        background-color: white; transition: .3s; border-radius: 50%;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    }
                    input:checked + .pk__toggleSlider { background-color: var(--n-primary); }
                    input:checked + .pk__toggleSlider:before { transform: translateX(18px); }

                    /* Table - Desktop */
                    .pk__tableWrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .pk__table { width: 100%; border-collapse: collapse; }
                    .pk__table th { background: var(--n-soft); padding: 8px 6px; text-align: left; font-size: 0.6rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; border-bottom: 1px solid var(--n-border); white-space: nowrap; }
                    .pk__table td { padding: 8px 6px; border-bottom: 1px solid var(--n-border); vertical-align: middle; font-size: 0.8rem; }
                    .pk__table tr:last-child td { border-bottom: none; }
                    .pk__table tr:hover { background: rgba(59, 130, 246, 0.03); }
                    .pk__mapelLabel { font-size: 0.6rem; color: var(--n-muted); margin-top: 2px; display: block; }
                    .pk__tableSelect, .pk__tableInput {
                        width: 100%;
                        height: 34px;
                        padding: 4px 28px 4px 8px;
                        border-radius: 6px;
                        border: 1px solid var(--n-border);
                        font-size: 0.78rem;
                        background-color: var(--n-card) !important;
                        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 7'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M1 2l4 3 4-3'/%3e%3c/svg%3e") !important;
                        background-repeat: no-repeat !important;
                        background-position: right 8px center !important;
                        background-size: 10px 7px !important;
                        color: var(--n-ink);
                        -webkit-appearance: none !important;
                        appearance: none !important;
                    }
                    .pk__tableSelect:focus, .pk__tableInput:focus { outline: none; border-color: var(--n-primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15); }
                    .pk__guruJadwalSmall { font-size: 0.72rem; font-weight: 400; color: var(--n-muted); margin-top: 2px; }

                    .pk__uploadCell { display: flex; align-items: center; gap: 6px; }
                    .pk__statusCell { display: flex; flex-direction: column; gap: 4px; }
                    .pk__statusMainRow { display: flex; align-items: center; gap: 6px; }
                    .pk__statusTambahanRow { display: flex; align-items: center; gap: 6px; }
                    .pk__statusTambahanSelect { background: var(--n-soft) !important; }
                    .pk__addStatusBtn { width: 28px; height: 28px; border-radius: 6px; border: none; background: var(--n-primary); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 12px; flex-shrink: 0; }
                    .pk__addStatusBtn:hover { background: var(--n-primary-light); transform: scale(1.05); }
                    .pk__removeStatusBtn { width: 24px; height: 24px; border-radius: 6px; border: none; background: rgba(239,68,68,0.1); color: #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 12px; flex-shrink: 0; }
                    .pk__removeStatusBtn:hover { background: rgba(239,68,68,0.2); }
                    .pk__slideDown { animation: pkSlideDown 0.3s ease-out; }
                    @keyframes pkSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                    .pk__uploadBtn { width: 34px; height: 34px; border-radius: 6px; border: 1px solid var(--n-border); background: var(--n-card); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; flex-shrink: 0; color: var(--n-ink); }
                    .pk__uploadBtn:hover { border-color: var(--n-primary); color: var(--n-primary); }
                    .pk__uploadBtn.has-file { background: #dcfce7; border-color: #10b981; color: #10b981; }
                    .pk__uploadBtn.uploading { background: var(--n-soft); }
                    .pk__uploadBtnRequired { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #dc2626 !important; background: #dc2626 !important; color: #ffffff !important; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; box-shadow: 0 2px 6px rgba(220,38,38,0.3); }
                    .pk__uploadBtnRequired i { color: #ffffff !important; }
                    .pk__uploadBtnRequired:hover { background: #b91c1c !important; border-color: #b91c1c !important; transform: scale(1.05); box-shadow: 0 3px 8px rgba(220,38,38,0.4); }
                    .pk__uploadBtnDisabled { width: 34px; height: 34px; border-radius: 6px; border: 1px solid var(--n-border); background: #f8f8f8; color: var(--n-muted); display: flex; align-items: center; justify-content: center; opacity: 0.5; cursor: not-allowed; }
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

                    /* Di mobile aksi kirim sudah pindah ke tombol tengah
                       bottom-nav (lihat <MobileFab> di atas) — sembunyikan
                       tombol aslinya supaya tidak dobel. Ambang sama dengan
                       tampilnya bottom-nav (components/bottom-nav.css). */
                    @media (max-width: 767.98px) {
                        .pk__submitBtn { display: none !important; }
                    }

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

                        .pk__pageHeader { padding: 16px 16px 20px; border-radius: 16px; }
                        .pk__titleArea h1 { font-size: 1.2rem; }

                        .pk__card { padding: 16px 14px; border-radius: 12px; }
                        .pk__section { margin-bottom: 18px; }
                        .pk__formRow { grid-template-columns: 1fr; gap: 14px; margin-bottom: 18px; }
                        .pk__sectionTitle { font-size: 0.78rem; margin-bottom: 8px; }

                        .pk__infoBox { padding: 8px 10px; }
                        .pk__infoRow { padding: 4px 0; }

                        .pk__dateInput, .pk__select { padding: 10px 10px; font-size: 16px; }
                        .pk__textarea { padding: 10px 12px; font-size: 16px; min-height: 80px; }

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
                        .pk__cardHeader { background: linear-gradient(135deg, var(--n-primary) 0%, #3083FF 100%); padding: 12px 10px; color: white; }
                        .pk__cardKelas { font-size: 1.1rem; font-weight: 700; }
                        .pk__cardMapel { font-size: 0.8rem; opacity: 0.9; margin-top: 3px; }
                        .pk__cardGuru { display: flex; align-items: center; gap: 10px; padding: 12px 10px; background: var(--n-soft); font-size: 0.9rem; color: var(--n-ink); border-bottom: 1px solid var(--n-border); }
                        .pk__cardGuru i { color: var(--n-primary); font-size: 1rem; }
                        .pk__cardGuru span { font-weight: 600; }

                        .pk__cardForm { padding: 12px 10px; display: flex; flex-direction: column; gap: 14px; }
                        .pk__cardField { display: flex; flex-direction: column; gap: 6px; }
                        .pk__cardField label { font-size: 0.75rem; font-weight: 600; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.3px; }
                        .pk__cardSelect { width: 100%; padding: 12px 32px 12px 14px; border-radius: 10px; border: 1px solid var(--n-border); font-size: 0.9rem; background-color: var(--n-card) !important; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 7'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M1 2l4 3 4-3'/%3e%3c/svg%3e") !important; background-repeat: no-repeat !important; background-position: right 12px center !important; background-size: 10px 7px !important; color: var(--n-ink); -webkit-appearance: none !important; appearance: none !important; }
                        .pk__cardSelect:focus { outline: none; border-color: var(--n-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

                        .pk__cardUpload { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                        .pk__cardUploadBtn { display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 10px; border: 1.5px solid var(--n-border); background: var(--n-card); font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; color: var(--n-ink); }
                        .pk__cardUploadBtn:hover { border-color: var(--n-primary); color: var(--n-primary); transform: translateY(-1px); }
                        .pk__cardUploadBtn.has-file { background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-color: #10b981; color: #059669; }
                        .pk__cardUploadBtn.uploading { background: var(--n-soft); }
                        .pk__cardUploadBtnAmbil { display: flex; align-items: center; gap: 8px; padding: 11px 20px; border-radius: 50px; border: none; background: #dc2626; font-size: 0.88rem; font-weight: 600; cursor: pointer; color: #ffffff; box-shadow: 0 2px 8px rgba(220,38,38,0.35); transition: background 0.2s, box-shadow 0.2s, transform 0.1s; }
                        .pk__cardUploadBtnAmbil:hover { background: #b91c1c; box-shadow: 0 4px 12px rgba(220,38,38,0.45); transform: translateY(-1px); }
                        .pk__cardUploadBtnAmbil:active { transform: translateY(0); box-shadow: 0 1px 4px rgba(220,38,38,0.3); }
                        .pk__cardUploadBtnDisabled { display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 10px; border: 1.5px solid var(--n-border); background: #f8f8f8; font-size: 0.9rem; font-weight: 600; color: var(--n-muted); opacity: 0.5; cursor: not-allowed; }
                        .pk__cardViewLink { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--n-primary); font-weight: 600; text-decoration: none; padding: 0; border: none; background: none; cursor: pointer; font-family: inherit; }

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

                    /* ===== DARK MODE — THEME OVERRIDES ===== */
                    :global(.dark) .pk__loading { color: #94a3b8; }
                    :global(.dark) .pk__loading i { color: #60a5fa; }

                    :global(.dark) .pk__pageHeader {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        border-radius: 24px !important;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    }
                    :global(.dark) .pk__titleArea h1 {
                        background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
                        -webkit-background-clip: text !important;
                        -webkit-text-fill-color: transparent !important;
                        background-clip: text !important;
                        color: transparent !important;
                        display: inline-block;
                    }
                    :global(.dark) .pk__titleArea p { color: #94a3b8 !important; }

                    :global(.dark) .pk__card {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        border-radius: 16px !important;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    }

                    :global(.dark) .pk__sectionTitle { color: #f1f5f9 !important; }
                    :global(.dark) .pk__sectionTitle i { color: #60a5fa !important; }

                    :global(.dark) .pk__infoBox {
                        background: rgba(26, 115, 232, 0.06) !important;
                        border: 1px solid rgba(59, 130, 246, 0.25) !important;
                        border-radius: 10px !important;
                    }
                    :global(.dark) .pk__infoRow { border-bottom-color: rgba(59, 130, 246, 0.15) !important; }
                    :global(.dark) .pk__infoLabel { color: #94a3b8 !important; }
                    :global(.dark) .pk__infoValue { color: #f1f5f9 !important; }

                    :global(.dark) .pk__label { color: #f1f5f9 !important; }
                    :global(.dark) .pk__optionalHint { color: #94a3b8 !important; }
                    :global(.dark) .pk__hint { color: #94a3b8 !important; }
                    :global(.dark) .pk__hint i { color: #60a5fa !important; }

                    :global(.dark) .pk__dateInput,
                    :global(.dark) .pk__select,
                    :global(.dark) .pk__cardSelect,
                    :global(.dark) .pk__textarea {
                        background-color: #0b1329 !important;
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        color: #f1f5f9 !important;
                        border-radius: 10px !important;
                    }
                    :global(.dark) .pk__select,
                    :global(.dark) .pk__cardSelect {
                        appearance: none !important;
                        -webkit-appearance: none !important;
                        background-color: #0b1329 !important;
                        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 7'%3e%3cpath stroke='%233b82f6' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.8' d='M1 2l4 3 4-3'/%3e%3c/svg%3e") !important;
                        background-size: 10px 7px !important;
                        background-position: right 10px center !important;
                        background-repeat: no-repeat !important;
                        padding-right: 28px !important;
                    }
                    :global(.dark) .pk__dateInput:focus,
                    :global(.dark) .pk__select:focus,
                    :global(.dark) .pk__textarea:focus {
                        border-color: #3b82f6 !important;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
                    }

                    /* MultiSelect */
                    :global(.dark) .pk__multiSelectBtn {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        color: #f1f5f9 !important;
                        border-radius: 10px !important;
                    }
                    :global(.dark) .pk__multiSelectBtn i { color: #60a5fa !important; }
                    :global(.dark) .pk__multiSelectDropdown {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        border-radius: 14px !important;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7) !important;
                    }
                    :global(.dark) .pk__multiSelectOption {
                        background: #0b1329 !important;
                        border-bottom-color: rgba(59, 130, 246, 0.15) !important;
                        color: #f1f5f9 !important;
                    }
                    :global(.dark) .pk__multiSelectOption:hover {
                        background: rgba(26, 115, 232, 0.12) !important;
                    }
                    :global(.dark) .pk__multiSelectLabel strong { color: #f1f5f9 !important; }
                    :global(.dark) .pk__multiSelectCount { color: #94a3b8 !important; }
                    :global(.dark) .pk__multiSelectOption--disabled { opacity: 0.4; }
                    :global(.dark) .pk__multiSelectCount--disabled { color: #f87171 !important; }

                    /* Toggle Card */
                    :global(.dark) .pk__toggleCard {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        border-radius: 14px !important;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    }
                    :global(.dark) .pk__toggleLabel { color: #f1f5f9 !important; }
                    :global(.dark) .pk__toggleDesc { color: #94a3b8 !important; }
                    :global(.dark) .pk__toggleSlider { background-color: rgba(59, 130, 246, 0.3) !important; }
                    :global(.dark) input:checked + .pk__toggleSlider { background-color: #1a73e8 !important; }

                    /* Table Desktop */
                    :global(.dark) .pk__table th {
                        background: rgba(37, 99, 235, 0.15) !important;
                        color: #93c5fd !important;
                        border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
                    }
                    :global(.dark) .pk__table td {
                        background: #0b1329 !important;
                        border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                        color: #f1f5f9 !important;
                    }
                    :global(.dark) .pk__table tr:hover td {
                        background: rgba(26, 115, 232, 0.08) !important;
                    }
                    :global(.dark) .pk__mapelLabel { color: #94a3b8 !important; }
                    :global(.dark) .pk__tableSelect,
                    :global(.dark) .pk__tableInput {
                        background-color: #0b1329 !important;
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        color: #f1f5f9 !important;
                        border-radius: 8px !important;
                    }
                    :global(.dark) .pk__tableSelect {
                        appearance: none !important;
                        -webkit-appearance: none !important;
                        background-color: #0b1329 !important;
                        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 7'%3e%3cpath stroke='%233b82f6' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.8' d='M1 2l4 3 4-3'/%3e%3c/svg%3e") !important;
                        background-size: 10px 7px !important;
                        background-position: right 8px center !important;
                        background-repeat: no-repeat !important;
                        padding-right: 28px !important;
                    }
                    :global(.dark) .pk__guruJadwalSmall { color: #94a3b8 !important; }

                    :global(.dark) .pk__uploadBtn {
                        background: rgba(59, 130, 246, 0.12) !important;
                        border: 1px solid rgba(59, 130, 246, 0.35) !important;
                        color: #60a5fa !important;
                    }
                    :global(.dark) .pk__uploadBtn.has-file {
                        background: rgba(16, 185, 129, 0.18) !important;
                        border-color: #10b981 !important;
                        color: #34d399 !important;
                    }
                    :global(.dark) .pk__uploadBtn.uploading { background: rgba(255,255,255,0.06) !important; }
                    :global(.dark) .pk__uploadBtnRequired {
                        background: #dc2626 !important;
                        border-color: #dc2626 !important;
                        color: #ffffff !important;
                        box-shadow: 0 2px 8px rgba(220,38,38,0.5) !important;
                    }
                    :global(.dark) .pk__uploadBtnRequired i { color: #ffffff !important; }
                    :global(.dark) .pk__uploadBtnRequired:hover { background: #b91c1c !important; border-color: #b91c1c !important; }
                    :global(.dark) .pk__uploadBtnDisabled {
                        background: #0b1329 !important;
                        border-color: rgba(255,255,255,0.1) !important;
                        color: #64748b !important;
                    }
                    :global(.dark) .pk__statusTambahanSelect {
                        background: rgba(26, 115, 232, 0.08) !important;
                        border: 1px solid rgba(59, 130, 246, 0.3) !important;
                        color: #f1f5f9 !important;
                    }
                    :global(.dark) .pk__addStatusBtn { background: #1a73e8 !important; }
                    :global(.dark) .pk__addStatusBtn:hover { background: #3b82f6 !important; }
                    :global(.dark) .pk__removeStatusBtn { background: rgba(239,68,68,0.15) !important; color: #f87171 !important; }
                    :global(.dark) .pk__removeStatusBtn:hover { background: rgba(239,68,68,0.25) !important; }
                    :global(.dark) .pk__rowActive { background: rgba(26, 115, 232, 0.06) !important; }
                    :global(.dark) .pk__rowInactive { opacity: 0.6; }

                    :global(.dark) .pk__empty { color: #94a3b8 !important; }
                    :global(.dark) .pk__empty i { opacity: 0.3; }
                    :global(.dark) .pk__empty p { color: #f1f5f9 !important; }
                    :global(.dark) .pk__infoText { color: #94a3b8 !important; }
                    :global(.dark) .pk__submitBtn {
                        background: #1a73e8 !important;
                        border: 1.5px solid #3b82f6 !important;
                        color: #ffffff !important;
                        border-radius: 10px !important;
                        box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important;
                    }
                    :global(.dark) .pk__submitBtn:hover:not(:disabled) {
                        background: #3b82f6 !important;
                    }

                    /* Mobile Class Cards */
                    :global(.dark) .pk__classCard {
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        border-radius: 16px !important;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
                        transition: all 0.2s ease !important;
                    }
                    :global(.dark) .pk__classCard:hover {
                        border-color: rgba(59, 130, 246, 0.6) !important;
                        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                    }
                    :global(.dark) .pk__cardKelas { color: #ffffff !important; }
                    :global(.dark) .pk__cardMapel { color: rgba(255,255,255,0.85) !important; }
                    :global(.dark) .pk__cardGuru {
                        background: rgba(26, 115, 232, 0.06) !important;
                        border-bottom: 1px solid rgba(59, 130, 246, 0.2) !important;
                        color: #f1f5f9 !important;
                    }
                    :global(.dark) .pk__cardGuru span { color: #f1f5f9 !important; }
                    :global(.dark) .pk__cardGuru i { color: #60a5fa !important; }
                    :global(.dark) .pk__cardField label { color: #94a3b8 !important; }
                    :global(.dark) .pk__cardSelect {
                        background-color: #0b1329 !important;
                        background: #0b1329 !important;
                        border: 1px solid rgba(26, 115, 232, 0.35) !important;
                        color: #f1f5f9 !important;
                        border-radius: 10px !important;
                    }
                    :global(.dark) .pk__cardSelect:focus {
                        border-color: #3b82f6 !important;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
                    }
                    :global(.dark) .pk__cardUploadBtn {
                        background: rgba(59, 130, 246, 0.12) !important;
                        border: 1px solid rgba(59, 130, 246, 0.35) !important;
                        color: #60a5fa !important;
                    }
                    :global(.dark) .pk__cardUploadBtn:hover {
                        border-color: #3b82f6 !important;
                        color: #93c5fd !important;
                    }
                    :global(.dark) .pk__cardUploadBtn.has-file {
                        background: rgba(16, 185, 129, 0.18) !important;
                        border-color: #10b981 !important;
                        color: #34d399 !important;
                    }
                    :global(.dark) .pk__cardUploadBtn.uploading { background: rgba(255,255,255,0.06) !important; }
                    :global(.dark) .pk__cardUploadBtnAmbil {
                        background: #dc2626 !important;
                        color: #ffffff !important;
                        box-shadow: 0 2px 8px rgba(220,38,38,0.5) !important;
                    }
                    :global(.dark) .pk__cardUploadBtnAmbil:hover { background: #b91c1c !important; }
                    :global(.dark) .pk__cardUploadBtnDisabled {
                        background: #0b1329 !important;
                        border-color: rgba(255,255,255,0.1) !important;
                        color: #64748b !important;
                    }
                    :global(.dark) .pk__cardInactive { opacity: 0.55; }
                    :global(.dark) .pk__cardViewLink { color: #60a5fa !important; }

                    /* ===== CAMERA MODAL ===== */
                    .pk__cameraOverlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.88);
                        z-index: 9999;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 16px;
                        padding: 20px;
                    }
                    .pk__cameraTitle {
                        color: #ffffff;
                        font-size: 1.1rem;
                        font-weight: 600;
                        text-align: center;
                    }
                    .pk__cameraVideo {
                        width: 100%;
                        max-width: 480px;
                        border-radius: 12px;
                        background: #000;
                        aspect-ratio: 4/3;
                        object-fit: cover;
                    }
                    .pk__cameraPreview {
                        width: 100%;
                        max-width: 480px;
                        border-radius: 12px;
                        background: #000;
                        aspect-ratio: 4/3;
                        object-fit: cover;
                    }
                    .pk__cameraError {
                        color: #f87171;
                        font-size: 0.9rem;
                        text-align: center;
                    }
                    .pk__cameraActions {
                        display: flex;
                        gap: 12px;
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                    .pk__cameraBtn {
                        padding: 10px 24px;
                        border-radius: 8px;
                        border: none;
                        font-size: 0.9rem;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .pk__cameraBtnCapture {
                        background: var(--n-primary);
                        color: #ffffff;
                    }
                    .pk__cameraBtnCapture:hover { opacity: 0.9; }
                    .pk__cameraBtnRetake {
                        background: #374151;
                        color: #ffffff;
                    }
                    .pk__cameraBtnRetake:hover { background: #4b5563; }
                    .pk__cameraBtnConfirm {
                        background: #10b981;
                        color: #ffffff;
                    }
                    .pk__cameraBtnConfirm:hover { opacity: 0.9; }
                    .pk__cameraBtnCancel {
                        background: #dc2626;
                        color: #ffffff;
                    }
                    .pk__cameraBtnCancel:hover { opacity: 0.9; }
                    :global(.dark) .pk__cameraTitle { color: #f9fafb; }
                    :global(.dark) .pk__cameraBtnRetake { background: #374151; }
                `}</style>

                {/* Camera Modal */}
                {cameraOpen && (
                    <CameraModalWrapper
                        cameraStream={cameraStream}
                        setCameraStream={setCameraStream}
                        capturePreview={capturePreview}
                        setCapturePreview={setCapturePreview}
                        cameraError={cameraError}
                        setCameraError={setCameraError}
                        onCaptureSubmit={handleCaptureSubmit}
                        onClose={closeCamera}
                        onRetake={retakePhoto}
                        retakeVersion={retakeVersion}
                    />
                )}
            </div>
            <MaintenanceBanner pageKey="maintenance_piket" />
            {viewer}
        </>
    );
}
