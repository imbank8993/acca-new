'use client';

import Swal from 'sweetalert2';
import { Journal } from '../types';

// Bulan dalam urutan tahun ajaran (Juli … Juni)
export const ACADEMIC_MONTHS = [
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
    { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
];

export interface ExportFilters {
    bulan: number[];   // kosong = semua bulan
    kelas: string[];   // kosong = semua kelas
}

/** Rentang tanggal penuh (YYYY-MM-DD) satu tahun ajaran (Juli s.d. Juni). */
const getYearRange = (tahunAjaran: string): { start: string; end: string } => {
    const yStart = parseInt(tahunAjaran.split('/')[0]);
    return { start: `${yStart}-07-01`, end: `${yStart + 1}-06-30` };
};

/** Resolusi tahun ajaran default (aktif, sesuai tanggal hari ini) bila toolbar belum menyediakan. */
const resolveDefaultTahunAjaran = async (): Promise<string> => {
    try {
        const { getActivePeriods, getRecommendedSettings } = await import('@/lib/settings-client');
        const periods = await getActivePeriods();
        const years = Array.from(new Set(periods.map(p => p.tahun_ajaran)));
        const rec = await getRecommendedSettings();
        if (rec && years.includes(rec.tahun_ajaran)) return rec.tahun_ajaran;
        if (years[0]) return years[0];
    } catch { /* fallback dari tanggal */ }
    const now = new Date();
    const y = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${y}/${y + 1}`;
};

/**
 * Dialog pilihan export: bulan & kelas (multiselect). Tahun ajaran TIDAK ditanya
 * di sini — mengikuti filter tahun ajaran yang terpilih di toolbar halaman.
 */
const askExportFilters = async (kelasChoices: string[], tahunAjaran: string): Promise<ExportFilters | null> => {
    const labelStyle = 'display:block;text-align:left;font-size:0.78rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;margin:14px 0 6px;';
    const hintStyle = 'display:block;text-align:left;font-size:0.7rem;color:#94a3b8;margin:6px 0 0;';
    const infoStyle = 'display:flex;align-items:center;gap:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 12px;font-size:0.82rem;font-weight:600;color:#1e40af;';

    // Dropdown multiselect (checkbox) — pengganti native <select multiple> agar lebih ramah sentuh
    const dropdown = (id: string, placeholder: string, options: { value: string; label: string }[]) => `
        <details class="expf-dd" id="${id}-dd">
            <summary class="expf-dd-summary">
                <span data-role="label">${placeholder}</span>
                <i class="bi bi-chevron-down"></i>
            </summary>
            <div class="expf-dd-content">
                ${options.map(o => `
                    <label class="expf-opt">
                        <input type="checkbox" value="${o.value}" class="${id}-cb">
                        <span>${o.label}</span>
                    </label>
                `).join('')}
            </div>
        </details>`;

    const styleBlock = `
        <style>
            .expf-dd { margin-top:0; border:1.5px solid #e2e8f0; border-radius:10px; background:#fff; text-align:left; }
            .expf-dd-summary { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; font-size:0.9rem; font-weight:600; color:#334155; cursor:pointer; list-style:none; user-select:none; }
            .expf-dd-summary::-webkit-details-marker { display:none; }
            .expf-dd-summary i { transition:transform .2s ease; color:#64748b; }
            .expf-dd[open] .expf-dd-summary i { transform:rotate(180deg); }
            .expf-dd-content { border-top:1px solid #e2e8f0; padding:10px; max-height:190px; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(120px,1fr)); gap:6px; }
            .expf-opt { display:flex; align-items:center; gap:8px; padding:7px 9px; border:1px solid transparent; border-radius:8px; cursor:pointer; user-select:none; margin:0; }
            .expf-opt:hover { background:#f8fafc; }
            .expf-opt:has(input:checked) { background:#eff6ff; border-color:#bfdbfe; }
            .expf-opt input { width:15px; height:15px; accent-color:#3083FF; cursor:pointer; margin:0; }
            .expf-opt span { font-size:0.83rem; font-weight:500; color:#475569; }
            .expf-opt:has(input:checked) span { color:#3083FF; font-weight:600; }
        </style>`;

    const result = await Swal.fire({
        title: 'Export Jurnal PDF A4',
        html: `
            ${styleBlock}
            <div style="text-align:left">
                <div style="${infoStyle}"><i class="bi bi-mortarboard-fill"></i> Tahun Ajaran: ${tahunAjaran}</div>
                <label style="${labelStyle}">Bulan</label>
                ${dropdown('expf-bulan', 'Semua bulan', ACADEMIC_MONTHS.map(m => ({ value: String(m.value), label: m.label })))}
                <span style="${hintStyle}">Kosongkan = semua bulan. Bisa pilih lebih dari satu.</span>
                ${kelasChoices.length > 0 ? `
                <label style="${labelStyle}">Kelas</label>
                ${dropdown('expf-kelas', 'Semua kelas', kelasChoices.map(k => ({ value: k, label: k })))}
                <span style="${hintStyle}">Kosongkan = semua kelas. Bisa pilih lebih dari satu.</span>` : ''}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Unduh PDF',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#3083FF',
        focusConfirm: false,
        didOpen: () => {
            // Perbarui label ringkasan setiap kali pilihan berubah (Swal html tidak mengeksekusi <script>)
            const wire = (id: string, placeholder: string, allLabel: string) => {
                const dd = document.getElementById(`${id}-dd`);
                if (!dd) return;
                const labelEl = dd.querySelector('[data-role="label"]') as HTMLElement | null;
                const cbs = Array.from(dd.querySelectorAll(`.${id}-cb`)) as HTMLInputElement[];
                const update = () => {
                    if (!labelEl) return;
                    const checked = cbs.filter(cb => cb.checked);
                    if (checked.length === 0) labelEl.textContent = placeholder;
                    else if (checked.length === cbs.length) labelEl.textContent = allLabel;
                    else labelEl.textContent = `${checked.length} dipilih`;
                };
                cbs.forEach(cb => cb.addEventListener('change', update));
            };
            wire('expf-bulan', 'Semua bulan', 'Semua bulan');
            wire('expf-kelas', 'Semua kelas', 'Semua kelas');
        },
        preConfirm: () => {
            const bulan = Array.from(document.querySelectorAll('.expf-bulan-cb:checked'))
                .map(el => parseInt((el as HTMLInputElement).value));
            const kelas = Array.from(document.querySelectorAll('.expf-kelas-cb:checked'))
                .map(el => (el as HTMLInputElement).value);
            return { bulan, kelas };
        }
    });

    if (!result.isConfirmed || !result.value) return null;
    return result.value as ExportFilters;
};

export const executeExport = async (
    mode: 'GURU' | 'ADMIN' | 'WALI',
    filters: ExportFilters,
    user: any,
    journals: Journal[],
    selectedTeacher: string | null,
    selectedSubject: string | null,
    selectedClass: string | null,
    searchTerm: string,
    isJournalRelated: (j: Journal, nip: string, name: string) => boolean,
    checkNameMatch: (value: any, target: any) => boolean,
    displayGroups: (data: Journal[]) => any[],
    allWaktu: any[],
    masterData?: any,
    selectedTahunAjaran?: string
) => {
    let exportRaw = [...journals];
    let filename = 'Jurnal_Export';

    // Tahun ajaran mengikuti filter toolbar; resolusi default bila belum tersedia
    const tahunAjaran = selectedTahunAjaran || await resolveDefaultTahunAjaran();
    const range = getYearRange(tahunAjaran);

    if (mode === 'WALI' && user && user.nip) {
        try {
            Swal.fire({ title: 'Menyiapkan Data...', text: 'Mengambil jurnal lintas kelas', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const apiUrl = `/api/jurnal?wali_nip=${user.nip}` +
                `&wali_tahun=${encodeURIComponent(tahunAjaran)}` +
                `&startDate=${range.start}&endDate=${range.end}`;

            const res = await fetch(apiUrl);
            const json = await res.json();
            if ((json.success || json.ok) && json.data) {
                exportRaw = json.data;
                const cleanName = (user.nama || 'Guru').replace(/[/\\?%*:|"<>]/g, '_').trim();
                filename = `Jurnal_Wali_Kelas_${cleanName}`;
            } else {
                throw new Error(json.error || json.message || 'Gagal mengambil data');
            }
            Swal.close();
        } catch (e: any) {
            Swal.fire('Error', e.message, 'error');
            return;
        }
    } else if (mode === 'GURU' && user && user.nip) {
        const teacherSchedule = (masterData?.jadwal || []).filter((j: any) => j.nip === user.nip && j.aktif);
        const expertise = new Set(teacherSchedule.map((j: any) => `${j.mata_pelajaran || j.mapel}|${j.kelas}`));

        // Union, bukan eksklusif: jadwal aktif hanya memuat kelas tahun berjalan,
        // sehingga filter expertise saja akan membuang jurnal tahun ajaran aktif sebelumnya.
        exportRaw = exportRaw.filter(j => {
            const key = `${j.mata_pelajaran}|${j.kelas}`;
            return expertise.has(key) || isJournalRelated(j, user.nip, user.nama);
        });

        const cleanName = (user.nama || 'Guru').replace(/[/\\?%*:|"<>]/g, '_').trim();
        filename = `Jurnal_${cleanName}`;
    } else {
        filename = 'Jurnal_Semua_Data';
    }

    // Batasi ke rentang tahun ajaran terpilih (berlaku semua mode)
    exportRaw = exportRaw.filter((j: any) => {
        const tgl = String(j.tanggal || '').split('T')[0];
        return tgl >= range.start && tgl <= range.end;
    });

    // Filter multiselect bulan (kosong = semua)
    if (filters.bulan && filters.bulan.length > 0) {
        const bulanSet = new Set(filters.bulan);
        exportRaw = exportRaw.filter((j: any) => {
            const tgl = String(j.tanggal || '').split('T')[0];
            const m = parseInt(tgl.split('-')[1]);
            return bulanSet.has(m);
        });
    }

    // Filter multiselect kelas (kosong = semua)
    if (filters.kelas && filters.kelas.length > 0) {
        const kelasSet = new Set(filters.kelas);
        exportRaw = exportRaw.filter((j: any) => kelasSet.has(j.kelas));
    }

    filename += `_${tahunAjaran.replace('/', '-')}`;
    if (filters.bulan && filters.bulan.length === 1) {
        filename += `_${ACADEMIC_MONTHS.find(m => m.value === filters.bulan[0])?.label || filters.bulan[0]}`;
    } else if (filters.bulan && filters.bulan.length > 1) {
        filename += `_${filters.bulan.length}bulan`;
    }
    if (filters.kelas && filters.kelas.length === 1) {
        filename += `_${filters.kelas[0].replace(/\s+/g, '_')}`;
    } else if (filters.kelas && filters.kelas.length > 1) {
        filename += `_${filters.kelas.length}kelas`;
    }

    const teacherVal = selectedTeacher && typeof selectedTeacher === 'object' ? (selectedTeacher as any).value : selectedTeacher;
    const subjectVal = selectedSubject && typeof selectedSubject === 'object' ? (selectedSubject as any).value : selectedSubject;
    const classVal = selectedClass && typeof selectedClass === 'object' ? (selectedClass as any).value : selectedClass;

    if (mode === 'ADMIN' && teacherVal) {
        exportRaw = exportRaw.filter(j => {
            const matchOrig = checkNameMatch(j.nama_guru, teacherVal);
            const matchSub = checkNameMatch(j.guru_pengganti || '', teacherVal);
            return matchOrig || matchSub;
        });
    }
    if (subjectVal) exportRaw = exportRaw.filter(j => j.mata_pelajaran === subjectVal);
    if (!filters.kelas || filters.kelas.length === 0) {
        if (classVal) exportRaw = exportRaw.filter(j => j.kelas === classVal);
    }
    if (searchTerm) {
        const ls = searchTerm.toLowerCase();
        exportRaw = exportRaw.filter(j =>
            (j.nama_guru || '').toLowerCase().includes(ls) ||
            (j.guru_pengganti || '').toLowerCase().includes(ls) ||
            (j.mata_pelajaran || '').toLowerCase().includes(ls) ||
            (j.kelas || '').toLowerCase().includes(ls) ||
            (j.materi || '').toLowerCase().includes(ls)
        );
    }

    if (exportRaw.length === 0) {
        Swal.fire('Info', 'Tidak ada data untuk diekspor pada pilihan tersebut.', 'info');
        return;
    }

    try {
    // Use displayGroups to group consecutive jam_ke entries into one row
    // e.g. jam_ke_id 2 and 3 → jam_ke="2-3", waktu="08:00 - 10:00"
    const groupedRows = displayGroups(exportRaw);

    // Build a quick lookup for allWaktu by hari|jam_ke (for time range resolve)
    const waktuByHariJam = new Map<string, any>();
    for (const w of allWaktu) {
        const key = `${w.hari}|${w.jam_ke}`;
        waktuByHariJam.set(key, w);
    }

    // Format tanggal resmi Indonesia DD/MM/YYYY bebas timezone shift
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

    // Build the export rows — one row per group (collapsed consecutive jam_ke)
    const exportRows = groupedRows.map((j: any, idx: number) => {
        // jam_ke from displayGroups is already grouped as "2-3" or "2, 3"
        let jamKeText = j.jam_ke || '';
        // Normalize: "2, 3" → "2-3" for cleaner format
        jamKeText = jamKeText.replace(/,\s*/g, '-');

        // Resolve time range from allWaktu using first/last jam_ke_id
        let waktuMulai = '';
        let waktuSelesai = '';
        const jamIds = (j.jamIds || []).sort((a: number, b: number) => a - b);
        if (jamIds.length > 0) {
            const firstJam = jamIds[0];
            const lastJam = jamIds[jamIds.length - 1];
            const firstKey = `${j.hari}|${firstJam}`;
            const lastKey = `${j.hari}|${lastJam}`;
            const firstW = waktuByHariJam.get(firstKey);
            const lastW = waktuByHariJam.get(lastKey);
            if (firstW && lastW) {
                waktuMulai = (firstW.mulai || '').slice(0, 5);
                waktuSelesai = (lastW.selesai || '').slice(0, 5);
            }
        }

        // If we have time range, embed it into jam_ke: "08:20 - 10:40 (3-5)"
        let finalJamKe = jamKeText;
        if (waktuMulai && waktuSelesai) {
            finalJamKe = `${waktuMulai} - ${waktuSelesai} (${jamKeText})`;
        }

        const tglClean = formatExportDate(j.tanggal);

        // 1. MODE GURU: Format rapi, hanya kolom substansi mengajar guru
        if (mode === 'GURU') {
            return {
                'No': idx + 1,
                'NIP': j.nip ?? '',
                'Nama Guru': j.nama_guru ?? '',
                'Hari': j.hari ?? '',
                'Tanggal': tglClean,
                'Jam Ke': finalJamKe,
                'Kelas': j.kelas ?? '',
                'Mata Pelajaran': j.mata_pelajaran ?? '',
                'Kategori Kehadiran': j.kategori_kehadiran ?? 'Sesuai',
                'Materi': j.materi ?? '',
                'Refleksi': j.refleksi ?? '',
                'Guru Pengganti': j.guru_pengganti && j.guru_pengganti !== '-' ? j.guru_pengganti : '',
                'Status Pengganti': j.status_pengganti && j.status_pengganti !== '-' ? j.status_pengganti : '',
                'Keterangan': j.keterangan_tambahan ?? ''
            };
        }

        // 2. MODE WALI KELAS: Format jurnal pemantauan kelas
        if (mode === 'WALI') {
            return {
                'No': idx + 1,
                'Hari': j.hari ?? '',
                'Tanggal': tglClean,
                'Jam Ke': finalJamKe,
                'Kelas': j.kelas ?? '',
                'Mata Pelajaran': j.mata_pelajaran ?? '',
                'Nama Guru': j.nama_guru ?? '',
                'Guru Pengganti': j.guru_pengganti && j.guru_pengganti !== '-' ? j.guru_pengganti : '',
                'Kategori Kehadiran': j.kategori_kehadiran ?? 'Sesuai',
                'Materi': j.materi ?? '',
                'Refleksi': j.refleksi ?? '',
                'Keterangan': j.keterangan_tambahan ?? ''
            };
        }

        // 3. MODE ADMIN: Format penuh untuk backup/administrasi dengan tanggal bersih
        const jamIdText = (j.jamIds || []).sort((a: number, b: number) => a - b).join(',') || (typeof j.jam_ke_id === 'number' ? j.jam_ke_id : '');

        return {
            'No': idx + 1,
            'id': (j.allIds || []).join(','),
            'nip': j.nip ?? '',
            'nama_guru': j.nama_guru ?? '',
            'hari': j.hari ?? '',
            'tanggal': tglClean,
            'jam_ke': finalJamKe,
            'jam_ke_id': jamIdText,
            'kelas': j.kelas ?? '',
            'mata_pelajaran': j.mata_pelajaran ?? '',
            'kategori_kehadiran': j.kategori_kehadiran ?? 'Sesuai',
            'materi': j.materi ?? '',
            'refleksi': j.refleksi ?? '',
            'guru_pengganti': j.guru_pengganti ?? '',
            'status_pengganti': j.status_pengganti ?? '',
            'guru_piket': j.guru_piket ?? '',
            'keterangan_tambahan': j.keterangan_tambahan ?? '',
            'durasi_terlambat': j.durasi_terlambat ?? '',
            'filled_by': j.filled_by ?? 'ADMIN'
        };
    });

    const { createJurnalPdf } = await import('@/lib/jurnal-pdf');
    const pdf = createJurnalPdf(exportRows, { mode, tahunAjaran, namaGuru: user?.nama, nip: user?.nip });
    pdf.save(filename.replace(/[/\\?%*:|"<>]/g, '_') + '.pdf');
    } catch (e: any) {
        console.error('Jurnal export gagal:', e);
        Swal.fire('Gagal Export', e?.message || 'Terjadi kesalahan saat membuat PDF.', 'error');
    }
};

export const handleExport = async (
    mode: 'GURU' | 'ADMIN' | 'WALI',
    user: any,
    journals: Journal[],
    selectedTeacher: string | null,
    selectedSubject: string | null,
    selectedClass: string | null,
    searchTerm: string,
    isJournalRelated: (j: Journal, nip: string, name: string) => boolean,
    checkNameMatch: (value: any, target: any) => boolean,
    displayGroups: (data: Journal[]) => any[],
    allWaktu: any[],
    masterData?: any,
    selectedTahunAjaran?: string
) => {
    const tahunAjaran = selectedTahunAjaran || await resolveDefaultTahunAjaran();
    let kelasChoices: string[] = [];
    if (mode === 'GURU' && user?.nip) {
        kelasChoices = Array.from(new Set(
            journals.filter((j: any) => isJournalRelated(j, user.nip, user.nama)).map((j: any) => j.kelas)
        )).filter(Boolean).sort() as string[];
    } else if (mode === 'ADMIN') {
        kelasChoices = Array.from(new Set(journals.map((j: any) => j.kelas))).filter(Boolean).sort() as string[];
    }

    const filters = await askExportFilters(kelasChoices, tahunAjaran);
    if (!filters) return;

    return executeExport(
        mode,
        filters,
        user,
        journals,
        selectedTeacher,
        selectedSubject,
        selectedClass,
        searchTerm,
        isJournalRelated,
        checkNameMatch,
        displayGroups,
        allWaktu,
        masterData,
        tahunAjaran
    );
};

export const showExportOptions = (
    canDo: (action: string) => boolean,
    onExport: (mode: 'GURU' | 'ADMIN' | 'WALI') => void,
    isWali?: boolean
) => {
    const items: any[] = [];
    if (canDo('export')) items.push({ id: 'GURU', label: 'Mode GURU', desc: 'Eksport jurnal personal saya' });
    if (canDo('export')) items.push({ id: 'ADMIN', label: 'Mode ADMIN', desc: 'Eksport seluruh data jurnal' });
    if (isWali) items.push({ id: 'WALI', label: 'Mode WALI KELAS', desc: 'Eksport jurnal kelas reguler + semua kelas peminatan siswa' });

    if (items.length === 0) {
        Swal.fire('Perhatian', 'Anda tidak memiliki hak akses untuk melakukan eksport.', 'warning');
        return;
    }

    const getExportIcon = (id: string) => {
        switch (id) {
            case 'GURU': return 'bi-person-badge';
            case 'ADMIN': return 'bi-shield-check';
            case 'WALI': return 'bi-people';
            default: return 'bi-file-earmark-spreadsheet';
        }
    };

    Swal.fire({
        title: '',
        html: `
        <div class="swal-export-header" style="margin-bottom: 25px; text-align: center;">
            <div style="width: 56px; height: 56px; background: var(--n-soft); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: var(--n-primary);">
                <i class="bi bi-file-earmark-spreadsheet-fill" style="font-size: 1.75rem;"></i>
            </div>
            <h2 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--n-ink); letter-spacing: -0.01em;">Pilih Mode Eksport</h2>
            <p style="margin: 4px 0 0; color: var(--n-muted); font-size: 0.88rem; font-weight: 500;">Pilih format laporan jurnal yang ingin diekspor</p>
        </div>
        <div class="swal-export-grid">
            ${items.map(it => `
                <div id="exp-${it.id}" class="swal-export-card">
                    <div class="swal-export-icon">
                        <i class="bi ${getExportIcon(it.id)}"></i>
                    </div>
                    <div class="swal-export-info">
                        <div class="swal-export-label">${it.label}</div>
                        <div class="swal-export-desc">${it.desc}</div>
                    </div>
                    <div class="swal-export-arrow">
                        <i class="bi bi-chevron-right"></i>
                    </div>
                </div>
            `).join('')}
        </div>
    `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Batal',
        customClass: {
            container: 'swal-export-container',
            popup: 'swal-export-popup',
            cancelButton: 'swal-export-cancel'
        },
        didOpen: () => {
            items.forEach(it => {
                const btn = document.getElementById(`exp-${it.id}`);
                if (btn) btn.onclick = () => {
                    // JANGAN panggil Swal.close() di sini. handleExport membuka dialog opsi
                    // lewat Swal.fire (Swal singleton) yang otomatis menggantikan pemilih mode
                    // ini. Memanggil Swal.close() setelah onExport justru menutup dialog opsi
                    // yang baru terbuka (saat tahun ajaran sudah terisi, tidak ada await
                    // sebelum fire) sehingga export batal diam-diam.
                    onExport(it.id);
                };
            });
        }
    });
};
