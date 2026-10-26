'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import InlineSelect from '@/components/ui/InlineSelect';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    userRole: string;
    nip?: string;
    namaGuru?: string;
    isSubstitute?: boolean;
    teacherClasses?: string[];
    permissions?: any[];
    isAdmin?: boolean;
    roles?: string[];
    initialMode?: 'GURU' | 'WALI' | 'ADMIN';
    initialKelas?: string;
    initialTahunAjaran?: string;
    lockMode?: boolean;
    simpleMode?: boolean;
    format?: 'xlsx' | 'pdf';
    onSuccess?: () => void;
}

const MONTHS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
];

const formatCase = (str: string) => {
    if (!str) return '';
    const s = str.trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const MODES = [
    { key: 'GURU', label: 'Guru', icon: 'bi-person', color: 'from-blue-500 to-blue-600' },
    { key: 'ADMIN', label: 'Admin', icon: 'bi-shield-lock', color: 'from-slate-500 to-slate-600' }
];

const getInitialMode = (props: { initialMode?: 'GURU' | 'WALI' | 'ADMIN', isAdmin?: boolean, userRole?: string, roles?: string[], lockMode?: boolean }) => {
    if (props.initialMode) return props.initialMode;

    const isAdminUser = props.isAdmin || props.roles?.includes('ADMIN') || props.roles?.includes('ADMINISTRATOR');
    const isWaliKelas = props.roles?.includes('WALI_KELAS');

    // When locked (wali-kelas page)
    if (props.lockMode) {
        if (isAdminUser) return 'ADMIN';
        return 'WALI';
    }

    // Not locked
    if (isAdminUser) return 'ADMIN';
    return 'GURU';
};

export default function ExportModal({
    isOpen, onClose, userRole, nip, namaGuru, isSubstitute = false, teacherClasses = [], permissions = [], isAdmin = false, roles = [],
    initialMode, initialKelas, initialTahunAjaran, lockMode = false, simpleMode = false, format = 'pdf', onSuccess
}: ExportModalProps) {
    const [academicYears, setAcademicYears] = useState<string[]>([]);
    const [academicYear, setAcademicYear] = useState(initialTahunAjaran || '');
    const [selectedKelas, setSelectedKelas] = useState(initialKelas || 'ALL');
    const [selectedKelasGuru, setSelectedKelasGuru] = useState<string[]>([]);
    const [selectedKelasAdmin, setSelectedKelasAdmin] = useState<string[]>([]);
    const [exporting, setExporting] = useState(false);
    const [exportMode, setExportMode] = useState<'GURU' | 'WALI' | 'ADMIN'>(initialMode || 'GURU');
    const [guruOption, setGuruOption] = useState<'BULAN' | 'KELAS'>('BULAN');
    const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [kelasListGuru, setKelasListGuru] = useState<string[]>([]);

    useEffect(() => {
        if (Array.isArray(teacherClasses) && teacherClasses.length > 0) {
            setKelasListGuru(prev => {
                if (prev.length === 0) return [...teacherClasses].sort();
                return prev;
            });
            setSelectedKelasGuru(prev => {
                if (prev.length === 0) return [...teacherClasses].sort();
                return prev;
            });
        }
    }, [teacherClasses]);
    
    // Add effect for simpleMode
    useEffect(() => {
        if (isOpen && simpleMode) {
            triggerSimpleExport();
        }
    }, [isOpen, simpleMode]);

    const triggerSimpleExport = async () => {
        const orderMonths = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]; 
        
        const styleBlock = `
            <style>
                .wka-dropdown {
                    margin-top: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: #fff;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    text-align: left;
                }
                .wka-dropdown-summary {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 14px 16px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #1e293b;
                    cursor: pointer;
                    list-style: none;
                }
                .wka-dropdown-summary::-webkit-details-marker {
                    display: none;
                }
                .wka-dropdown-content {
                    border-top: 1px solid #e2e8f0;
                    padding: 12px;
                    max-height: 220px;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                    gap: 8px;
                }
                .wka-month-label {
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
                .wka-month-label:hover { background: #f8fafc; }
                .wka-month-label:has(input:checked) { background: #eff6ff; border-color: #bfdbfe; }
                .wka-month-label input { width: 16px; height: 16px; accent-color: #3083FF; cursor: pointer; margin: 0; }
                .wka-month-label span { font-size: 0.85rem; font-weight: 500; color: #475569; }
                .wka-month-label:has(input:checked) span { color: #3083FF; font-weight: 600; }
            </style>
        `;

        const result = await Swal.fire({
            title: format === 'pdf' ? 'Export Absensi PDF A4' : 'Export Absensi',
            html: `
                ${styleBlock}
                <div style="text-align:left">
                    <div style="padding: 12px; background: #f1f5f9; border-radius: 12px; font-size: 0.9rem; color: #334155; margin-bottom: 16px; font-weight: 600;">
                        <i class="bi bi-door-open-fill" style="color: #64748b; margin-right: 6px;"></i> Kelas: ${initialKelas}
                    </div>
                    <label style="font-size: 0.85rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Pilih Bulan</label>
                    <details class="wka-dropdown">
                        <summary class="wka-dropdown-summary">
                            <span>Pilih bulan...</span>
                            <i class="bi bi-chevron-down"></i>
                        </summary>
                        <div class="wka-dropdown-content">
                            ${orderMonths.map(m => `
                                <label class="wka-month-label">
                                    <input type="checkbox" value="${m}" class="wka-exp-cb">
                                    <span>${MONTHS.find(x => x.value === m)?.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    </details>
                    <span style="font-size: 0.8rem; color: #94a3b8; display: block; margin-top: 12px;">
                        <i class="bi bi-info-circle" style="margin-right: 4px;"></i> Biarkan kosong untuk export semua bulan.
                    </span>
                </div>
                <script>
                    (function() {
                        const details = document.querySelector('.wka-dropdown');
                        const summaryText = details.querySelector('.wka-dropdown-summary span');
                        const checkboxes = details.querySelectorAll('.wka-exp-cb');
                        function updateText() {
                            const checked = Array.from(checkboxes).filter(cb => cb.checked);
                            if (checked.length === 0) summaryText.textContent = 'Pilih bulan...';
                            else if (checked.length === checkboxes.length) summaryText.textContent = 'Semua Bulan Terpilih';
                            else summaryText.textContent = checked.length + ' Bulan Terpilih';
                        }
                        checkboxes.forEach(cb => cb.addEventListener('change', updateText));
                    })();
                </script>
            `,
            showCancelButton: true,
            confirmButtonText: format === 'pdf' ? 'Unduh PDF' : 'Export',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#3b82f6',
            width: '500px',
            focusConfirm: false,
            preConfirm: () => {
                const checkboxes = document.querySelectorAll('.wka-exp-cb:checked') as NodeListOf<HTMLInputElement>;
                return Array.from(checkboxes).map(cb => parseInt(cb.value));
            }
        });

        if (result.isConfirmed) {
            const months = result.value || [];
            // For simpleMode, force using ADMIN mode so it targets the selectedKelas properly
            const yearStr = initialTahunAjaran || await fetchActiveYear();
            if (!yearStr) {
                 Swal.fire('Error', 'Tahun ajaran tidak ditemukan', 'error');
                 onClose();
                 return;
            }
            doExportWithParams('ADMIN', yearStr, initialKelas || 'ALL', months);
        } else {
            onClose(); // dialog canceled
        }
    };

    const fetchActiveYear = async () => {
        try {
            const { getActivePeriods, getRecommendedSettings } = await import('@/lib/settings-client');
            const recommended = await getRecommendedSettings();
            if (recommended) return recommended.tahun_ajaran;
            const periods = await getActivePeriods();
            if (periods.length > 0) return periods[0].tahun_ajaran;
            return '';
        } catch (e) {
            return '';
        }
    };

    const doExportWithParams = async (mode: string, year: string, kelas: string | string[], months: number[]) => {
        setExporting(true);
        Swal.fire({ title: 'Menyiapkan Data...', text: 'Mengambil data absensi', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const body: any = {
                year: year,
                mode: mode,
                role: userRole,
                nip: nip,
                months: months.length > 0 ? months : [1,2,3,4,5,6,7,8,9,10,11,12]
            };
            
            if (mode === 'ADMIN' && kelas !== 'ALL') body.kelas = kelas;
            
            await performExportRequest(body);
        } catch (error: any) {
            console.error('Export Failed', error);
            Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
            onClose();
        } finally {
            setExporting(false);
        }
    };

    const performExportRequest = async (body: any) => {
        const res = await fetch('/api/absensi/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Gagal menarik data');
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Terjadi kesalahan');
        
        const sessions: any[] = json.data;
        const allSessions: any[] = json.allSessions || [];
        const ketidakhadiran: any[] = json.ketidakhadiran || [];
        const holidays: any[] = json.holidays || [];

        if (!sessions || sessions.length === 0) {
            Swal.fire('Kosong', 'Tidak ada data absensi untuk diexport pada bulan tersebut.', 'info');
            return;
        }

        let finalSessions = sessions.filter((s: any) => s.status_sesi === 'FINAL' || s.sesi_id?.startsWith('rekap-'));

        // Filter by selected classes if specified
        if (body.kelas) {
            const allowedK = Array.isArray(body.kelas) ? new Set(body.kelas) : new Set([body.kelas]);
            if (!allowedK.has('ALL')) {
                finalSessions = finalSessions.filter((s: any) => allowedK.has(s.kelas));
            }
        }

        // Filter by selected months if specified
        if (Array.isArray(body.months) && body.months.length > 0) {
            const allowedM = new Set(body.months.map((m: any) => Number(m)));
            finalSessions = finalSessions.filter((s: any) => {
                const parts = (s.tanggal || '').split('-');
                if (parts.length >= 2) {
                    const m = parseInt(parts[1], 10);
                    return allowedM.has(m);
                }
                return true;
            });
        }

        if (!finalSessions.length) {
            Swal.fire('Kosong', 'Tidak ada absensi final untuk pilihan kelas dan bulan tersebut.', 'info');
            return;
        }

        if (format === 'pdf') {
            const [{ createAbsensiPdf }, { getTimezone }] = await Promise.all([
                import('@/lib/absensi-pdf'), import('@/lib/timezone'),
            ]);
            const doc = createAbsensiPdf({ sessions: finalSessions, ketidakhadiran, holidays }, {
                tahunAjaran: body.year, timezone: await getTimezone(), mode: body.mode,
                namaGuru: body.mode === 'GURU' ? namaGuru : undefined,
                nip: body.mode === 'GURU' ? nip : undefined,
            });
            const classes = Array.from(new Set(finalSessions.map((s: any) => s.kelas)));
            const className = (classes.length === 1 ? String(classes[0]) : 'Semua_Kelas').replace(/[^\w-]+/g, '_');
            const teacher = body.mode === 'GURU' && namaGuru ? `_${namaGuru.replace(/[^\p{L}\p{N}-]+/gu, '_')}` : '';
            doc.save(`Absensi_${className}${teacher}_${String(body.year).replace('/', '-')}.pdf`);
            onClose();
            if (onSuccess) onSuccess();
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'PDF A4 berhasil diunduh', timer: 1500, showConfirmButton: false });
            return;
        }

        const XLSX = await import('xlsx-js-style');
        const finalAllSessions = allSessions.filter((s: any) => s.status_sesi === 'FINAL');
        const classesInExport: string[] = Array.from(new Set(finalSessions.map((s: any) => s.kelas || 'Tanpa Kelas')));

        const exportTeacherName = namaGuru || finalSessions.find((s: any) => s.nama_guru)?.nama_guru || '';
        const cleanTeacherName = exportTeacherName.replace(/[/\\?%*:|"<>,]/g, '').trim().replace(/\s+/g, '_');
        const teacherPart = cleanTeacherName ? `_${cleanTeacherName}` : '';
        const yearSafe = String(body.year || '').replace('/', '-');

        // Zip if exporting multiple classes
        if (classesInExport.length > 1) {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            // Group sessions by class
            const classesMap = new Map<string, any[]>();
            finalSessions.forEach((s: any) => {
                const kName = s.kelas || 'Tanpa Kelas';
                if (!classesMap.has(kName)) classesMap.set(kName, []);
                classesMap.get(kName)?.push(s);
            });

            for (const [kName, classSessions] of classesMap.entries()) {
                const wb = XLSX.utils.book_new();
                const groupedByMonth = new Map<string, any[]>();
                
                classSessions.forEach((s: any) => {
                    const dateParts = s.tanggal.split('-');
                    const mIdx = parseInt(dateParts[1]) - 1;
                    const mName = MONTHS[mIdx].label;
                    const sheetName = mName.substring(0, 31);
                    
                    if (!groupedByMonth.has(sheetName)) groupedByMonth.set(sheetName, []);
                    groupedByMonth.get(sheetName)?.push(s);
                });

                groupedByMonth.forEach((sheetSessions, sheetName) => {
                    const ws = generateWorksheet(sheetSessions, holidays, ketidakhadiran, XLSX);
                    XLSX.utils.book_append_sheet(wb, ws, sheetName);
                });

                const classFinalSessions = classSessions.filter((s: any) => s.status_sesi === 'FINAL');
                const classFinalAllSessions = finalAllSessions.filter((s: any) => s.kelas === kName);
                const classKetidakhadiran = ketidakhadiran.filter((k: any) => k.kelas === kName);
                
                const ktSheet = generateKeteranganWorksheet(classKetidakhadiran, classFinalSessions, classFinalAllSessions, body.mode, XLSX);
                if (ktSheet) {
                    XLSX.utils.book_append_sheet(wb, ktSheet, 'Keterangan');
                }

                const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const safeClassName = kName.replace(/[/\\?%*:|"<>]/g, '-');
                zip.file(`Absensi_${body.mode}${teacherPart}_${safeClassName}_${yearSafe}.xlsx`, excelBuffer);
            }

            const zipContent = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipContent);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Absensi_${body.mode}${teacherPart}_SemuaKelas_${yearSafe}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } else {
            const wb = XLSX.utils.book_new();
            const groupedData = new Map<string, any[]>();

            finalSessions.forEach((s: any) => {
                const dateParts = s.tanggal.split('-');
                const mIdx = parseInt(dateParts[1]) - 1;
                const mName = MONTHS[mIdx].label;
                const kName = s.kelas;

                let sheetName = "";
                if (body.mode === 'WALI') {
                    sheetName = mName; // Wali only has 1 class, split sheets by month
                } else if (body.mode === 'ADMIN' || body.mode === 'GURU') {
                    // For single class export, split sheets by month.
                    // (If multiple classes, it goes to ZIP logic instead and is split per class per month)
                    sheetName = mName; 
                } else {
                    sheetName = `${kName}_${mName}`;
                }

                if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);

                if (!groupedData.has(sheetName)) groupedData.set(sheetName, []);
                groupedData.get(sheetName)?.push(s);
            });

            groupedData.forEach((sheetSessions, sheetName) => {
                const ws = generateWorksheet(sheetSessions, holidays, ketidakhadiran, XLSX);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            const ktSheet = generateKeteranganWorksheet(ketidakhadiran, finalSessions, finalAllSessions, body.mode, XLSX);
            if (ktSheet) {
                XLSX.utils.book_append_sheet(wb, ktSheet, 'Keterangan');
            }

            const kNameSafe = (classesInExport[0] || 'SemuaKelas').replace(/[/\\?%*:|"<>]/g, '-');
            XLSX.writeFile(wb, `Absensi_${body.mode}${teacherPart}_${kNameSafe}_${yearSafe}.xlsx`);
        }

        onClose();
        if (onSuccess) onSuccess();
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'File berhasil diunduh', timer: 1500, showConfirmButton: false });
    };

    useEffect(() => {
        if (isOpen) {
            loadYears();

            // Set initial state from props or roles - use helper to get initial mode
            setExportMode(getInitialMode({ initialMode, isAdmin, userRole, roles, lockMode }));

            if (initialKelas) {
                setSelectedKelas(initialKelas);
            }
        }
    }, [isOpen]);

    const loadYears = async () => {
        try {
            const { getActivePeriods, getRecommendedSettings } = await import('@/lib/settings-client');
            const periods = await getActivePeriods();
            const recommended = await getRecommendedSettings();

            if (periods.length > 0) {
                const uniqueYears = Array.from(new Set(periods.map(p => p.tahun_ajaran)));
                setAcademicYears(uniqueYears);

                setAcademicYear(prev => {
                    const currentYearIsValid = uniqueYears.includes(prev);
                    if (initialTahunAjaran && uniqueYears.includes(initialTahunAjaran)) {
                        return initialTahunAjaran;
                    } else if (!currentYearIsValid && recommended) {
                        return recommended.tahun_ajaran;
                    } else if (!currentYearIsValid && periods.length > 0) {
                        return periods[0].tahun_ajaran;
                    }
                    return prev;
                });
            } else {
                setAcademicYears([]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchInitialData = async (targetYear: string) => {
        try {
            const res = await fetch(`/api/master/kelas`, { credentials: 'same-origin' });
            const json = await res.json().catch(() => null);
            let allNames: string[] = [];

            if (json?.ok && json?.data) {
                allNames = Array.from(new Set(json.data.map((k: any) => k.nama || k.nama_kelas))).filter(Boolean) as string[];
                allNames.sort();
            }

            setKelasList(allNames);

            // Fetch classes strictly for this teacher in the target academic year
            if (nip) {
                let guruClasses: string[] = [];

                try {
                    const resClasses = await fetch(`/api/absensi/classes?nip=${encodeURIComponent(nip)}&tahun_ajaran=${encodeURIComponent(targetYear)}`, { credentials: 'same-origin' });
                    if (resClasses.ok) {
                        const jsonClasses = await resClasses.json().catch(() => null);
                        if (jsonClasses?.ok && Array.isArray(jsonClasses.data)) {
                            guruClasses = jsonClasses.data;
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch teacher classes for academic year", err);
                }

                // Fallback to teacherClasses prop only if endpoint returned nothing and targetYear matches initial
                if (guruClasses.length === 0 && Array.isArray(teacherClasses) && teacherClasses.length > 0 && (!initialTahunAjaran || targetYear === initialTahunAjaran)) {
                    guruClasses = [...teacherClasses].sort();
                }

                setKelasListGuru(guruClasses);
                setSelectedKelasGuru(guruClasses);
            } else {
                setKelasListGuru([]);
                setSelectedKelasGuru([]);
            }

            if (allNames.length > 0 && !selectedKelas) setSelectedKelas(allNames[0]);
        } catch (e) {
            console.error("Failed to fetch classes", e);
        }
    };

    useEffect(() => {
        if (isOpen && academicYear) {
            fetchInitialData(academicYear);
        }
    }, [isOpen, academicYear]);

    if (!isOpen) return null;

    const toggleMonth = (val: number) => {
        if (selectedMonths.includes(val)) {
            setSelectedMonths(selectedMonths.filter(m => m !== val));
        } else {
            setSelectedMonths([...selectedMonths, val].sort((a, b) => a - b));
        }
    };

    const getDayInitial = (date: Date) => {
        const initials = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
        return initials[date.getDay()];
    };

    const handleExport = async () => {
        if (!academicYear) {
            Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih tahun ajaran terlebih dahulu.' });
            return;
        }
        setExporting(true);
        try {
            const body: any = {
                year: academicYear,
                mode: exportMode,
                role: userRole,
                nip: nip
            };

            if (exportMode === 'GURU') {
                if (kelasListGuru.length === 0) {
                    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Tidak ada kelas yang diajar untuk diexport.' });
                    setExporting(false);
                    return;
                }
                if (selectedKelasGuru.length === 0) {
                    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih minimal satu kelas terlebih dahulu.' });
                    setExporting(false);
                    return;
                }
                body.months = selectedMonths;
                body.kelas = selectedKelasGuru;
            } else if (exportMode === 'WALI') {
                body.months = selectedMonths;
            } else if (exportMode === 'ADMIN') {
                body.months = selectedMonths;
                if (selectedKelasAdmin.length > 0) body.kelas = selectedKelasAdmin;
            }

            await performExportRequest(body);

        } catch (error: any) {
            console.error('Export Failed', error);
            Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
        } finally {
            setExporting(false);
        }
    };

    const formatCase = (str: string) => {
        if (!str) return '';
        const s = str.trim();
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    };

    // Helper to generate a single worksheet from a set of sessions
    const generateWorksheet = (sessions: any[], holidays: any[], ketidakhadiran: any[], XLSX: any) => {
        // Build holiday lookup sets/maps
        const holidaySet = new Set(holidays.map((h: any) => h.tanggal));
        const holidayMap = new Map(holidays.map((h: any) => [h.tanggal, h.keterangan]));

        const students = new Map<string, any>();
        sessions.forEach(s => {
            s.absensi_detail?.forEach((d: any) => {
                if (!students.has(d.nisn)) {
                    students.set(d.nisn, { nisn: d.nisn, nama: d.nama_snapshot, att: {} });
                }
                const day = parseInt(s.tanggal.split('-')[2]);
                students.get(d.nisn).att[day] = d.status;
            });
        });

        const sortedStudents = Array.from(students.values()).sort((a, b) => a.nama.localeCompare(b.nama));

        const firstSesi = sessions[0];
        const dateParts = firstSesi.tanggal.split('-');
        const y = parseInt(dateParts[0]);
        const m = parseInt(dateParts[1]);
        const daysInMonth = new Date(y, m, 0).getDate();
        const monthName = MONTHS[m - 1].label;

        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth() + 1;
        const maxDay = (y === todayY && m === todayM) ? today.getDate() : daysInMonth;

        // Collect holidays in this month as a list with date and description
        const monthHolidayList: { tanggal: string; keterangan: string }[] = Array.from(holidayMap.entries())
            .filter(([date]) => date.startsWith(`${y}-${String(m).padStart(2, '0')}`))
            .map(([tanggal, keterangan]) => ({ tanggal, keterangan }));

        const aoa = [
            ["DAFTAR HADIR SISWA"],
            [`Kelas: ${firstSesi.kelas}`, "", "", `Bulan: ${monthName} ${y}`],
            [""],
            ["No", "NISN", "Nama", "Tanggal"]
        ];
        let rightCol = 3 + maxDay + 3;
        const headerRow2 = [`Kelas: ${firstSesi.kelas}`, "", "", ""];
        headerRow2[4] = `Bulan: ${monthName} ${y}`;
        // Fill the rest to match rightCol
        for (let i = 5; i <= rightCol; i++) headerRow2.push("");
        aoa[1] = headerRow2;

        for (let i = 1; i < maxDay; i++) aoa[3].push("");
        aoa[3].push("Jumlah");
        aoa[3].push("", "", "");

        const headerMid = ["", "", ""];
        for (let d = 1; d <= maxDay; d++) headerMid.push(d.toString());
        headerMid.push("H", "I", "S", "A");
        aoa.push(headerMid);

        const headerBot = ["", "", ""];
        for (let d = 1; d <= maxDay; d++) {
            headerBot.push(getDayInitial(new Date(y, m - 1, d)));
        }
        headerBot.push("", "", "", "");
        aoa.push(headerBot);

        sortedStudents.forEach((st, idx) => {
            const row = [idx + 1, st.nisn, st.nama];
            let h = 0, iCount = 0, sCount = 0, a = 0;
            for (let d = 1; d <= maxDay; d++) {
                const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                // Skip holiday from count — mark as "L" (Libur)
                if (holidaySet.has(dateStr)) {
                    row.push("L");
                } else {
                    const status = st.att[d] || "";
                    let init = "";
                    if (status === 'HADIR') { init = 'H'; h++; }
                    else if (status === 'IZIN') { init = 'I'; iCount++; }
                    else if (status === 'SAKIT') { init = 'S'; sCount++; }
                    else if (status === 'ALPHA') { init = 'A'; a++; }
                    row.push(init);
                }
            }
            row.push(h, iCount, sCount, a);
            aoa.push(row);
        });

        // Footer: holiday list (each on its own row)
        if (monthHolidayList.length > 0) {
            aoa.push([]);
            aoa.push([]);
            aoa.push([]); // 3 rows of gap
            aoa.push(["DAFTAR HARI LIBUR / KEGIATAN"]);
            aoa.push(["Tanggal", "", "Keterangan", "", "", "", "", "", "", "", ""]);
            monthHolidayList.forEach(h => {
                aoa.push([h.tanggal, "", h.keterangan, "", "", "", "", "", "", "", ""]);
            });
        }

        const totalStudentRows = sortedStudents.length;
        // Row indices (0-based)
        // 0 = title, 1 = kelas/bulan, 2 = blank
        // 3,4,5 = header rows, 6..6+N-1 = student rows
        const footerStartRow = 6 + totalStudentRows + 3;
        const footerTitleRow = footerStartRow;
        const footerHeaderRow = footerStartRow + 1;
        const footerDataStartRow = footerHeaderRow + 1;

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        const navyHeader = {
            fill: { fgColor: { rgb: "1A237E" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" },
            border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
        };
        const softRedFill = { fgColor: { rgb: "FEE2E2" } };
        const softRedText = { font: { color: { rgb: "DC2626" }, bold: true } };
        const centerCell = { alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
        const leftCell = { ...centerCell, alignment: { horizontal: "left", vertical: "center" } };
        const holidayCellStyle = { ...centerCell, ...softRedFill, ...softRedText };

        rightCol = 3 + maxDay + 3;
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: rightCol } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Kelas merge (A-D)
            { s: { r: 1, c: 4 }, e: { r: 1, c: rightCol } }, // Bulan merge (E-end)
            { s: { r: 3, c: 0 }, e: { r: 5, c: 0 } },
            { s: { r: 3, c: 1 }, e: { r: 5, c: 1 } },
            { s: { r: 3, c: 2 }, e: { r: 5, c: 2 } },
            { s: { r: 3, c: 3 }, e: { r: 3, c: 3 + maxDay - 1 } },
            { s: { r: 3, c: 3 + maxDay }, e: { r: 3, c: 3 + maxDay + 3 } },
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[addr]) continue;
                if (R >= 3 && R <= 5) ws[addr].s = navyHeader;
                else if (R > 5 && C <= 3 + maxDay) {
                    const cellVal = ws[addr].v;
                    if (String(cellVal).toUpperCase() === 'L') {
                        ws[addr].s = holidayCellStyle;
                    } else {
                        ws[addr].s = (C === 2) ? leftCell : centerCell;
                    }
                }
            }
        }

        // Style and add holiday footer rows explicitly
        if (monthHolidayList.length > 0) {
            const footerHeaderStyle = {
                fill: { fgColor: { rgb: "FEE2E2" } },
                font: { color: { rgb: "DC2626" }, bold: true },
                alignment: { horizontal: "center", vertical: "center" },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
            const footerTanggalStyle = {
                fill: { fgColor: { rgb: "FEF2F2" } },
                font: { color: { rgb: "DC2626" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
            const footerKeteranganStyle = {
                fill: { fgColor: { rgb: "FEF2F2" } },
                font: { color: { rgb: "DC2626" } },
                alignment: { horizontal: "left", vertical: "center" },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };

            // Title "DAFTAR HARI LIBUR"
            ws[XLSX.utils.encode_cell({ r: footerTitleRow, c: 0 })] = { t: 's', v: 'DAFTAR HARI LIBUR / KEGIATAN BULAN INI', s: { font: { bold: true, color: { rgb: "DC2626" } } } };
            ws['!merges'].push({ s: { r: footerTitleRow, c: 0 }, e: { r: footerTitleRow, c: rightCol } });

            // Header row: Tanggal (A-B) | Keterangan (C-end)
            for (let C = 0; C <= rightCol; C++) {
                const addr = XLSX.utils.encode_cell({ r: footerHeaderRow, c: C });
                let val = "";
                if (C === 0) val = "Tanggal";
                else if (C === 2) val = "Keterangan";
                ws[addr] = { t: 's', v: val, s: footerHeaderStyle };
            }
            ws['!merges'].push({ s: { r: footerHeaderRow, c: 0 }, e: { r: footerHeaderRow, c: 1 } });
            ws['!merges'].push({ s: { r: footerHeaderRow, c: 2 }, e: { r: footerHeaderRow, c: rightCol } });

            // Data rows: tanggal | keterangan
            monthHolidayList.forEach((h, i) => {
                const dataRow = footerDataStartRow + i;
                for (let C = 0; C <= rightCol; C++) {
                    const addr = XLSX.utils.encode_cell({ r: dataRow, c: C });
                    if (C === 0) {
                        ws[addr] = { t: 's', v: h.tanggal, s: footerTanggalStyle };
                    } else if (C === 1) {
                        ws[addr] = { t: 's', v: '', s: footerTanggalStyle };
                    } else if (C === 2) {
                        ws[addr] = { t: 's', v: h.keterangan, s: footerKeteranganStyle };
                    } else {
                        ws[addr] = { t: 's', v: '', s: footerKeteranganStyle };
                    }
                }
                ws['!merges'].push({ s: { r: dataRow, c: 0 }, e: { r: dataRow, c: 1 } });
                ws['!merges'].push({ s: { r: dataRow, c: 2 }, e: { r: dataRow, c: rightCol } });
            });
        }

        // Update !ref for holidays if they exist
        if (monthHolidayList.length > 0) {
            const holidayEndRow = footerDataStartRow + monthHolidayList.length - 1;
            ws['!ref'] = XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: holidayEndRow, c: Math.max(rightCol, 3) }
            });
        }

        // Extract catatan izin/sakit/alpha
        const catatanList: any[] = [];
        const seenCatatan = new Set<string>();

        sessions.forEach(s => {
            if (s.status_sesi !== 'FINAL' && !s.sesi_id?.startsWith('rekap-')) return;
            s.absensi_detail?.forEach((d: any) => {
                const rawStatus = (d.status || '').toUpperCase();
                if (['IZIN', 'SAKIT', 'ALPHA'].includes(rawStatus)) {
                    const dedupKey = `${s.tanggal}_${d.nisn}`;
                    if (seenCatatan.has(dedupKey)) return;
                    seenCatatan.add(dedupKey);

                    const sDate = s.tanggal;
                    const kRec = ketidakhadiran.find((k: any) => {
                        if (d.ref_ketidakhadiran_id && k.id === d.ref_ketidakhadiran_id) return true;
                        const kStart = (k.tgl_mulai || '').slice(0, 10);
                        const kEnd = (k.tgl_selesai || '').slice(0, 10);
                        return k.nisn === d.nisn && kStart <= sDate && kEnd >= sDate;
                    });

                    let kategori = '';
                    let keterangan = '';
                    const rawNote = (d.catatan || d.keterangan || '').trim();
                    const kRecKet = kRec?.keterangan && kRec.keterangan !== '-' ? kRec.keterangan.trim() : '';

                    if (rawStatus === 'SAKIT') {
                        let sub = kRec?.status ? formatCase(kRec.status) : '';
                        if (!sub) {
                            if (/ringan/i.test(rawNote)) sub = 'Ringan';
                            else if (/sedang/i.test(rawNote)) sub = 'Sedang';
                            else if (/berat/i.test(rawNote)) sub = 'Berat';
                            else if (/kontrol/i.test(rawNote)) sub = 'Kontrol';
                        }
                        kategori = sub ? `Sakit (${sub})` : 'Sakit';
                        const noteToUse = kRecKet || rawNote.replace(/^(sakit\s*)?(ringan|sedang|berat|kontrol)\s*[-:]?\s*/i, '').trim();
                        keterangan = noteToUse && noteToUse !== '-' ? noteToUse : '-';
                    } else if (rawStatus === 'IZIN') {
                        let sub = kRec?.status ? formatCase(kRec.status) : '';
                        if (!sub) {
                            if (/madrasah/i.test(rawNote)) sub = 'Madrasah';
                            else if (/personal|pribadi/i.test(rawNote)) sub = 'Personal';
                        }
                        kategori = sub ? `Izin (${sub})` : 'Izin';
                        const noteToUse = kRecKet || rawNote.replace(/^(izin\s*)?(madrasah|personal|pribadi)\s*[-:]?\s*/i, '').trim();
                        keterangan = noteToUse && noteToUse !== '-' ? noteToUse : '-';
                    } else { // ALPHA
                        kategori = 'Alpha';
                        const noteToUse = kRecKet || rawNote;
                        keterangan = noteToUse && noteToUse !== '-' ? noteToUse : 'Tanpa keterangan';
                    }

                    catatanList.push({
                        tanggal: s.tanggal,
                        nama: d.nama_snapshot,
                        kategori,
                        keterangan
                    });
                }
            });
        });
        
        // Sort by date then name
        catatanList.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama));

        if (catatanList.length > 0) {
            const range = XLSX.utils.decode_range(ws['!ref']);
            const currentBottom = range.e.r;
            
            const catatanTitleRow = currentBottom + 2;
            const catatanHeaderRow = catatanTitleRow + 1;
            const catatanDataStartRow = catatanTitleRow + 2;
            
            const catatanTitleStyle = { font: { bold: true, color: { rgb: "0038A8" } } };
            const catatanHeaderStyle = {
                fill: { fgColor: { rgb: "DBEAFE" } },
                font: { color: { rgb: "1E3A8A" }, bold: true },
                alignment: { horizontal: "center", vertical: "center" },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
            const catatanDataStyle = {
                fill: { fgColor: { rgb: "EFF6FF" } },
                font: { color: { rgb: "1E3A8A" } },
                alignment: { horizontal: "left", vertical: "center" },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
            const catatanCenterStyle = {
                ...catatanDataStyle,
                alignment: { horizontal: "center", vertical: "center" }
            };
            
            ws[XLSX.utils.encode_cell({ r: catatanTitleRow, c: 0 })] = { t: 's', v: 'CATATAN IZIN / SAKIT / ALPHA', s: catatanTitleStyle };
            ws['!merges'].push({ s: { r: catatanTitleRow, c: 0 }, e: { r: catatanTitleRow, c: rightCol } });

            for (let C = 0; C <= rightCol; C++) {
                const addr = XLSX.utils.encode_cell({ r: catatanHeaderRow, c: C });
                let val = "";
                if (C === 0) val = "Tanggal";
                else if (C === 2) val = "Nama Siswa";
                else if (C === 3) val = "Status / Kategori";
                else if (C === 8) val = "Keterangan";
                ws[addr] = { t: 's', v: val, s: catatanHeaderStyle };
            }
            ws['!merges'].push({ s: { r: catatanHeaderRow, c: 0 }, e: { r: catatanHeaderRow, c: 1 } });
            ws['!merges'].push({ s: { r: catatanHeaderRow, c: 3 }, e: { r: catatanHeaderRow, c: 7 } });
            ws['!merges'].push({ s: { r: catatanHeaderRow, c: 8 }, e: { r: catatanHeaderRow, c: rightCol } });

            catatanList.forEach((c, i) => {
                const row = catatanDataStartRow + i;
                for (let C = 0; C <= rightCol; C++) {
                    const addr = XLSX.utils.encode_cell({ r: row, c: C });
                    if (C === 0) {
                        ws[addr] = { t: 's', v: c.tanggal, s: catatanCenterStyle };
                    } else if (C === 1) {
                        ws[addr] = { t: 's', v: '', s: catatanCenterStyle };
                    } else if (C === 2) {
                        ws[addr] = { t: 's', v: c.nama, s: catatanDataStyle };
                    } else if (C === 3) {
                        ws[addr] = { t: 's', v: c.kategori, s: catatanCenterStyle };
                    } else if (C >= 4 && C <= 7) {
                        ws[addr] = { t: 's', v: '', s: catatanCenterStyle };
                    } else if (C === 8) {
                        ws[addr] = { t: 's', v: c.keterangan, s: catatanDataStyle };
                    } else {
                        ws[addr] = { t: 's', v: '', s: catatanDataStyle };
                    }
                }
                ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: 1 } });
                ws['!merges'].push({ s: { r: row, c: 3 }, e: { r: row, c: 7 } });
                ws['!merges'].push({ s: { r: row, c: 8 }, e: { r: row, c: rightCol } });
            });
            
            // update !ref
            ws['!ref'] = XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: catatanDataStartRow + catatanList.length - 1, c: Math.max(rightCol, 3) }
            });
        }

        ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 30 }];
        for (let i = 0; i < maxDay; i++) ws['!cols'].push({ wch: 3 });
        ws['!cols'].push({ wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 });

        return ws;
    };

    // Helper to generate Keterangan worksheet
    const generateKeteranganWorksheet = (ketidakhadiran: any[], sessions: any[], allSessions: any[], mode: string, XLSX: any) => {
        if (!ketidakhadiran && (!allSessions || allSessions.length === 0)) return null;

        const studentMap = new Map<string, string>();
        sessions.forEach((s: any) => {
            s.absensi_detail?.forEach((d: any) => {
                if (!studentMap.has(d.nisn)) {
                    studentMap.set(d.nisn, d.nama_snapshot);
                }
            });
        });

        const keteranganRows: any[] = [];

        if (mode === 'GURU') {
            allSessions.forEach((s: any) => {
                if (s.status_sesi !== 'FINAL') return;
                s.absensi_detail?.forEach((d: any) => {
                    const rawStatus = (d.status || '').toUpperCase();
                    if (['IZIN', 'SAKIT', 'ALPHA'].includes(rawStatus)) {
                        const rawNote = (d.catatan || d.keterangan || '').trim();
                        if (rawStatus === 'ALPHA' && (!rawNote || rawNote === '-')) return;

                        const sDate = s.tanggal;
                        const kRec = ketidakhadiran.find((k: any) => {
                            if (d.ref_ketidakhadiran_id && k.id === d.ref_ketidakhadiran_id) return true;
                            const kStart = (k.tgl_mulai || '').slice(0, 10);
                            const kEnd = (k.tgl_selesai || '').slice(0, 10);
                            return k.nisn === d.nisn && kStart <= sDate && kEnd >= sDate;
                        });

                        let jenisDisplay = rawStatus;
                        if (rawStatus === 'SAKIT') {
                            const sub = kRec?.status ? formatCase(kRec.status) : (/ringan/i.test(rawNote) ? 'Ringan' : /sedang/i.test(rawNote) ? 'Sedang' : /berat/i.test(rawNote) ? 'Berat' : /kontrol/i.test(rawNote) ? 'Kontrol' : '');
                            jenisDisplay = sub ? `SAKIT (${sub})` : 'SAKIT';
                        } else if (rawStatus === 'IZIN') {
                            const sub = kRec?.status ? formatCase(kRec.status) : (/madrasah/i.test(rawNote) ? 'Madrasah' : /personal|pribadi/i.test(rawNote) ? 'Personal' : '');
                            jenisDisplay = sub ? `IZIN (${sub})` : 'IZIN';
                        }

                        const kRecKet = kRec?.keterangan && kRec.keterangan !== '-' ? kRec.keterangan.trim() : '';
                        const ketToUse = kRecKet || (rawNote && rawNote !== '-' ? rawNote : '-');

                        keteranganRows.push({
                            no: 0,
                            nisn: d.nisn,
                            nama: d.nama_snapshot,
                            kelas: s.kelas || '-',
                            jenis: jenisDisplay,
                            tgl_mulai: s.tanggal,
                            tgl_selesai: s.tanggal,
                            keterangan: ketToUse,
                            sumber: 'absensi'
                        });
                    }
                });
            });
        } else {
            const izinSakitDb = (ketidakhadiran || []).filter(k =>
                k.jenis && ['IZIN', 'SAKIT', 'ALPHA'].includes(k.jenis.toUpperCase())
            );

            const nisnFromDb = new Set(izinSakitDb.map((k: any) => `${k.nisn}-${k.tgl_mulai}-${k.tgl_selesai}`));

            const absensiIzinSakitMap = new Map<string, any>();
            const guruJpMap = new Map<string, { nip: string, jp: number, keterangan: string }>();

            allSessions.forEach((s: any) => {
                if (s.status_sesi !== 'FINAL') return;
                const guruNip = s.nip || s.guru_pengganti_nip || 'unknown';
                const jp = s.jp || 1;

                s.absensi_detail?.forEach((d: any) => {
                    const rawStatus = (d.status || '').toUpperCase();
                    if (['IZIN', 'SAKIT', 'ALPHA'].includes(rawStatus)) {
                        const rawNote = (d.catatan || d.keterangan || '').trim();
                        if (rawStatus === 'ALPHA' && (!rawNote || rawNote === '-')) return;
                        const key = `${d.nisn}-${s.tanggal}`;
                        const guruKey = `${key}-${guruNip}`;
                        const statusPriority: Record<string, number> = { 'HADIR': 0, 'IZIN': 1, 'SAKIT': 2, 'ALPHA': 3 };
                        const currentPriority = statusPriority[rawStatus] ?? 4;

                        if (!absensiIzinSakitMap.has(key)) {
                            absensiIzinSakitMap.set(key, {
                                nisn: d.nisn,
                                nama: d.nama_snapshot,
                                kelas: s.kelas,
                                status: rawStatus,
                                tgl_mulai: s.tanggal,
                                tgl_selesai: s.tanggal,
                                keterangan: rawNote || '-',
                                bestGuruNip: guruNip,
                                count: 1,
                                priority: currentPriority
                            });
                            guruJpMap.set(guruKey, {
                                nip: guruNip,
                                jp: jp,
                                keterangan: rawNote || '-'
                            });
                        } else {
                            const existing = absensiIzinSakitMap.get(key);
                            existing.count++;

                            if (!guruJpMap.has(guruKey)) {
                                guruJpMap.set(guruKey, { nip: guruNip, jp: jp, keterangan: rawNote || '-' });
                            } else {
                                guruJpMap.get(guruKey)!.jp += jp;
                            }

                            if (currentPriority < existing.priority) {
                                existing.status = rawStatus;
                                existing.priority = currentPriority;
                            }
                        }
                    }
                });
            });

            izinSakitDb.forEach((k: any) => {
                const sub = k.status ? ` (${formatCase(k.status)})` : '';
                keteranganRows.push({
                    no: 0,
                    nisn: k.nisn || '-',
                    nama: studentMap.get(k.nisn) || k.nama_siswa || '-',
                    kelas: k.kelas || '-',
                    jenis: `${k.jenis.toUpperCase()}${sub}`,
                    tgl_mulai: (k.tgl_mulai || '').slice(0, 10),
                    tgl_selesai: (k.tgl_selesai || '').slice(0, 10),
                    keterangan: k.keterangan || '-',
                    sumber: 'ketidakhadiran'
                });
            });

            absensiIzinSakitMap.forEach((item: any) => {
                const key = `${item.nisn}-${item.tgl_mulai}-${item.tgl_selesai}`;
                if (!nisnFromDb.has(key)) {
                    let bestKeterangan = '-';
                    let maxJp = 0;

                    guruJpMap.forEach((guruData, guruKey) => {
                        if (guruKey.startsWith(key)) {
                            if (guruData.jp > maxJp) {
                                maxJp = guruData.jp;
                                bestKeterangan = guruData.keterangan || '-';
                            }
                        }
                    });

                    keteranganRows.push({
                        no: 0,
                        nisn: item.nisn,
                        nama: item.nama,
                        kelas: item.kelas || '-',
                        jenis: item.status,
                        tgl_mulai: item.tgl_mulai,
                        tgl_selesai: item.tgl_selesai,
                        keterangan: `${bestKeterangan} (Guru)`,
                        sumber: `absensi (${item.count}x)`
                    });
                }
            });
        }

        if (keteranganRows.length === 0) return null;

        keteranganRows.sort((a, b) => {
            if (a.nisn !== b.nisn) return a.nisn.localeCompare(b.nisn);
            return String(a.tgl_mulai).localeCompare(String(b.tgl_mulai));
        });

        keteranganRows.forEach((row, idx) => {
            row.no = idx + 1;
        });

        const aoa = [
            ["DAFTAR KETERANGAN IJIN/Sakit"],
            [""],
            ["No", "NISN", "Nama Siswa", "Kelas", "Jenis", "Keterangan", "Tanggal Mulai", "Tanggal Selesai"]
        ];

        keteranganRows.forEach((row: any) => {
            aoa.push([
                row.no,
                row.nisn,
                row.nama,
                row.kelas,
                row.jenis,
                row.keterangan,
                row.tgl_mulai,
                row.tgl_selesai
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        const navyHeader = {
            fill: { fgColor: { rgb: "1A237E" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" },
            border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
        };
        const centerCell = { alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
        const leftCell = { ...centerCell, alignment: { horizontal: "left", vertical: "center" } };
        const izinCell = { ...centerCell, fill: { fgColor: { rgb: "FEF3C7" } } };
        const sakitCell = { ...centerCell, fill: { fgColor: { rgb: "FEE2E2" } } };
        const alphaCell = { ...centerCell, fill: { fgColor: { rgb: "FFEBEE" } }, font: { color: { rgb: "D32F2F" } } };

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[addr]) continue;
                if (R >= 2 && R <= 2) ws[addr].s = navyHeader;
                else if (R > 2) {
                    const jenisCell = XLSX.utils.encode_cell({ r: R, c: 4 });
                    const jenis = ((ws[jenisCell]?.v as string) || '').toUpperCase();
                    const isLeft = (C === 2 || C === 5);
                    const baseStyle = isLeft ? leftCell : centerCell;

                    if (jenis.startsWith('IZIN')) {
                        ws[addr].s = { ...baseStyle, fill: { fgColor: { rgb: "FEF3C7" } } };
                    } else if (jenis.startsWith('SAKIT')) {
                        ws[addr].s = { ...baseStyle, fill: { fgColor: { rgb: "FEE2E2" } } };
                    } else if (jenis.startsWith('ALPHA')) {
                        ws[addr].s = { ...baseStyle, fill: { fgColor: { rgb: "FFEBEE" } }, font: { color: { rgb: "D32F2F" } } };
                    } else {
                        ws[addr].s = baseStyle;
                    }
                }
            }
        }

        ws['!cols'] = [
            { wch: 5 },  // No
            { wch: 15 }, // NISN
            { wch: 30 }, // Nama Siswa
            { wch: 10 }, // Kelas
            { wch: 18 }, // Jenis (Sakit (Ringan), Izin (Madrasah), dll)
            { wch: 40 }, // Keterangan
            { wch: 15 }, // Tanggal Mulai
            { wch: 15 }  // Tanggal Selesai
        ];

        return ws;
    };

    // Determine available modes based on user role and lockMode
    const isAdminUser = isAdmin || roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const isWaliKelas = roles.includes('WALI_KELAS');

    const availableModes = (() => {
        if (lockMode) {
            const m = MODES.find(mode => mode.key === (initialMode || exportMode));
            return m ? [m] : [MODES.find(mode => mode.key === 'ADMIN')!];
        }
        // Not locked - show modes based on roles
        const modes = [];
        if (isAdminUser) {
            modes.push(MODES.find(m => m.key === 'ADMIN')!);
            modes.push(MODES.find(m => m.key === 'GURU')!);
        } else {
            modes.push(MODES.find(m => m.key === 'GURU')!);
        }
        return modes;
    })();

    // Show mode tabs only if there are multiple modes available
    const showModeTabs = !lockMode && availableModes.length > 1;

    if (!isOpen || simpleMode) return null;

    return (
        <Modal
            open={isOpen}
            size="md"
            onClose={onClose}
            labelledBy="modal-export-absensi-title"
        >
            <ModalHeader
                id="modal-export-absensi-title"
                icon={format === 'pdf' ? 'file-earmark-pdf' : 'file-earmark-excel-fill'}
                title={format === 'pdf' ? 'Export Absensi PDF A4' : 'Export Data Absensi'}
                subtitle={exportMode === 'GURU' && namaGuru ? `${namaGuru}${nip ? ` (${nip})` : ''}` : undefined}
                onClose={onClose}
            />

            <ModalBody className="em-modal-body">
                {/* Mode Tabs - Show for admins or when not locked */}
                {showModeTabs && (
                    <div className="em-tabs">
                        {availableModes.map(m => (
                            <button
                                key={m.key}
                                type="button"
                                onClick={() => setExportMode(m.key as any)}
                                className={`em-tab ${exportMode === m.key ? 'active' : ''}`}
                            >
                                <i className={`bi ${m.icon}`}></i>
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Form Section */}
                <div className="em-section">
                    {/* 1. Tahun Ajaran (Paling Atas dengan InlineSelect) */}
                    <div className="em-field">
                        <label style={{ margin: 0, fontWeight: 600, display: 'block', marginBottom: '3px', fontSize: '0.85rem' }}>Tahun Ajaran</label>
                        <InlineSelect
                            value={academicYear}
                            onChange={(val) => setAcademicYear(val)}
                            options={academicYears.map(y => ({ value: y, label: y }))}
                            minWidth="100%"
                            height="40px"
                        />
                    </div>

                    {exportMode === 'GURU' && (
                        <div className="em-mode-content">
                            {/* 2. Pilih Kelas (MultiSelectDropdown - Vertikal 1 Kolom) */}
                            <div>
                                <MultiSelectDropdown
                                    label="Pilih Kelas"
                                    options={kelasListGuru.map(k => ({ value: k, label: k }))}
                                    value={selectedKelasGuru}
                                    onChange={setSelectedKelasGuru}
                                    placeholder={kelasListGuru.length === 0 ? "Tidak ada kelas yang diajar" : "Pilih kelas..."}
                                    allSelectedText="Semua Kelas Terpilih"
                                    columns={1}
                                    height="40px"
                                />
                                {kelasListGuru.length === 0 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                        <i className="bi bi-exclamation-circle mr-1"></i>
                                        Tidak ditemukan jadwal mengajar aktif untuk guru ini.
                                    </p>
                                )}
                            </div>

                            {/* 3. Pilih Bulan (MultiSelectDropdown - Vertikal 1 Kolom) */}
                            <div>
                                <MultiSelectDropdown
                                    label="Pilih Bulan"
                                    options={MONTHS.map(m => ({ value: m.value, label: m.label }))}
                                    value={selectedMonths}
                                    onChange={setSelectedMonths}
                                    placeholder="Pilih bulan..."
                                    allSelectedText="Semua Bulan Terpilih"
                                    columns={1}
                                    height="40px"
                                />
                            </div>
                        </div>
                    )}

                    {exportMode === 'WALI' && (
                        <div className="em-mode-content">
                            <div className="em-info-box">
                                <i className="bi bi-info-circle"></i>
                                <span>Merekap absensi kelas Anda untuk bulan yang dipilih</span>
                            </div>
                            <div>
                                <MultiSelectDropdown
                                    label="Pilih Bulan"
                                    options={MONTHS.map(m => ({ value: m.value, label: m.label }))}
                                    value={selectedMonths}
                                    onChange={setSelectedMonths}
                                    placeholder="Pilih bulan..."
                                    allSelectedText="Semua Bulan Terpilih"
                                    columns={1}
                                    height="40px"
                                />
                            </div>
                        </div>
                    )}

                    {exportMode === 'ADMIN' && (
                        <div className="em-mode-content">
                            <div>
                                <MultiSelectDropdown
                                    label="Pilih Kelas"
                                    options={kelasList.map(k => ({ value: k, label: k }))}
                                    value={selectedKelasAdmin}
                                    onChange={setSelectedKelasAdmin}
                                    placeholder="Pilih kelas..."
                                    allSelectedText="Semua Kelas Terpilih"
                                    columns={1}
                                    height="40px"
                                />
                            </div>

                            <div>
                                <MultiSelectDropdown
                                    label="Pilih Bulan"
                                    options={MONTHS.map(m => ({ value: m.value, label: m.label }))}
                                    value={selectedMonths}
                                    onChange={setSelectedMonths}
                                    placeholder="Pilih bulan..."
                                    allSelectedText="Semua Bulan Terpilih"
                                    columns={1}
                                    height="40px"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </ModalBody>

            <ModalFooter>
                <Button
                    variant="cancel"
                    type="button"
                    onClick={onClose}
                >
                    Batal
                </Button>
                <Button
                    variant="primary"
                    type="button"
                    onClick={handleExport}
                    isLoading={exporting}
                    icon="download"
                >
                    {exporting ? (format === 'pdf' ? 'Menyiapkan PDF...' : 'Mengexport...') : (format === 'pdf' ? 'Unduh PDF' : 'Download Excel')}
                </Button>
            </ModalFooter>

            <style>{`
                .em-modal-body {
                    padding-bottom: 24px;
                }

                .em-tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                    background: var(--n-soft);
                    padding: 6px;
                    border-radius: 14px;
                }

                .em-tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 10px 16px;
                    border: none;
                    background: transparent;
                    border-radius: 10px;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .em-tab:hover {
                    color: var(--n-ink);
                    background: var(--n-elevated);
                }

                .em-tab.active {
                    background: var(--n-card);
                    color: var(--n-text);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }

                .em-tab i {
                    font-size: 16px;
                }

                .em-section {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                .em-mode-content {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    animation: fadeIn 0.2s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .em-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .em-field label {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--n-muted);
                    letter-spacing: -0.01em;
                }

                .em-info-box {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: rgba(245, 158, 11, 0.12);
                    border: 1px solid rgba(245, 158, 11, 0.35);
                    border-radius: 12px;
                    font-size: 13px;
                    color: var(--n-ink);
                }

                .em-info-box i {
                    font-size: 18px;
                    color: #f59e0b;
                }

                /* ── Dark Mode ── */
                :global(.dark) .em-tabs {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                :global(.dark) .em-tab {
                    color: #94a3b8 !important;
                }
                :global(.dark) .em-tab.active {
                    background: #1a73e8 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.45) !important;
                }
                :global(.dark) .em-field label {
                    color: #94a3b8 !important;
                }
                :global(.dark) .em-info-box {
                    background: rgba(59, 130, 246, 0.12) !important;
                    border-color: rgba(59, 130, 246, 0.35) !important;
                    color: #93c5fd !important;
                }
            `}</style>
        </Modal>
    );
}
