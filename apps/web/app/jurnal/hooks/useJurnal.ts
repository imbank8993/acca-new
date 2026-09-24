'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { Journal, JournalFilters } from '../types';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';

export function useJurnal(user: any) {
    const searchParams = useSearchParams();
    const tahunAjaranFilter = useTahunAjaranFilter();

    // UI States
    const [journals, setJournals] = useState<Journal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [masterDataState, setMasterDataState] = useState<any>(null);

    /**
     * Wewenang pengelola jurnal, dikirim backend bersama data.
     *
     * Sebelumnya layar ini menyimpulkannya sendiri dari `isAdmin || isOPJurnal`,
     * sementara API memakai Hak Akses Fitur `jurnal_access_config`. Dua sumber
     * yang bisa menyimpang: pengelola yang ditunjuk lewat layar Hak Akses Fitur
     * tidak akan pernah melihat tombolnya. Bawaannya false — gagal-tertutup
     * selagi data belum termuat.
     */
    const [bolehKelola, setBolehKelola] = useState(false);

    const permissions = user?.permissions || [];
    const roles = user?.roles?.map((r: string) => r.toUpperCase()) || [];

    const isGuru = roles.includes('GURU');
    const isAdmin = roles.includes('ADMIN');
    const isOPJurnal = roles.includes('OP_JURNAL');
    const isSiswa = roles.includes('SISWA') || roles.includes('PENGURUS_KELAS') || roles.includes('PENGURUS KELAS') || user?.role?.toUpperCase() === 'SISWA' || user?.role?.toUpperCase() === 'PENGURUS_KELAS' || user?.role?.toUpperCase() === 'PENGURUS KELAS';
    const isWali = roles.includes('WALI_KELAS') || roles.includes('WALI KELAS');
    const isPrivileged = isAdmin || isOPJurnal || bolehKelola;

    /**
     * Hanya pengelola jurnal yang boleh membuat, mengubah, dan menghapus.
     *
     * Guru, siswa, dan wali kelas HANYA MELIHAT jurnalnya — itu aturan yang
     * ditegakkan backend juga (`update`, `remove`, dan `create` semuanya menuntut
     * pengelola). Guru yang perlu koreksi menempuh jalur banding.
     *
     * Sumbernya `bolehKelola` dari backend, bukan tebakan dari daftar peran.
     */
    const canDo = useCallback((action: string) => {
        if (action === 'export') return true; // semua boleh mengekspor data yang terlihat
        return bolehKelola;
    }, [bolehKelola]);

    const normalize = (s: any) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const checkNameMatch = useCallback((name1: string, name2: string) => {
        if (!name1 || !name2) return false;
        const n1 = normalize(name1);
        const n2 = normalize(name2);
        return n1 === n2 || (n1.length > 3 && n2.includes(n1)) || (n2.length > 3 && n1.includes(n2));
    }, []);

    const isJournalRelated = useCallback((j: Journal, nip: string, name: string) => {
        if (!nip && !name) return false;
        const uNip = String(nip || '').trim();
        const matchNip = uNip && String(j.nip || '').trim() === uNip;
        const matchOrigName = checkNameMatch(j.nama_guru, name);
        const matchSubName = checkNameMatch(j.guru_pengganti || '', name);
        return !!(matchNip || matchOrigName || matchSubName);
    }, [checkNameMatch]);

    const fetchJournals = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const queryParams = new URLSearchParams();

            // Determine access based on role
            // ADMIN & OP_JURNAL / Pengelola: see all journals (full access)
            // GURU: see only journals where their name appears in nama_guru or guru_pengganti or nip
            // SISWA: see only journals for their class (reguler & pilihan)
            // Other roles: return empty data (no access)

            if (isPrivileged) {
                // ADMIN & OP_JURNAL / Pengelola - see all journals
                const filters = ['kelas', 'startDate', 'endDate', 'kategori', 'search', 'nip'];
                filters.forEach(f => {
                    const val = searchParams.get(f);
                    if (val) queryParams.append(f, val);
                });
            } else if (isGuru) {
                // GURU: see only their own journals (backend handles NIP + substitute matching)
                const filters = ['kelas', 'startDate', 'endDate', 'kategori', 'search'];
                filters.forEach(f => {
                    const val = searchParams.get(f);
                    if (val) queryParams.append(f, val);
                });
            } else if (isSiswa && user) {
                // SISWA: see journals for their class (reguler & pilihan)
                const filters = ['kelas', 'startDate', 'endDate', 'kategori', 'search'];
                filters.forEach(f => {
                    const val = searchParams.get(f);
                    if (val) queryParams.append(f, val);
                });
            } else {
                // Other roles: no access, return empty data
                setJournals([]);
                setLoading(false);
                return;
            }

            const response = await fetch(`/api/jurnal?${queryParams}`);
            if (!response.ok) throw new Error('Failed to fetch journals');

            const data = await response.json();
            setJournals(data.data || []);
            if (data.akses) setBolehKelola(Boolean(data.akses.kelola));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [searchParams, isSiswa, isGuru, isPrivileged, user]);

    const handleDelete = async (ids: number | number[]) => {
        const idsArray = Array.isArray(ids) ? ids : [ids];

        const result = await Swal.fire({
            title: `<div class="text-left flex items-center gap-2 text-lg font-extrabold text-[#0f172a]">
                      <i class="bi bi-exclamation-triangle text-red-600"></i>
                      <span>Hapus Jurnal?</span>
                    </div>`,
            html: `
                <div class="text-left">
                    <p class="text-[0.95rem] font-medium text-[#475569] mb-2 leading-relaxed">
                        Yakin ingin menghapus ${idsArray.length > 1 ? `<strong>${idsArray.length}</strong> data jurnal ini sekaligus?` : 'data jurnal ini?'}
                    </p>
                    <p class="text-[0.88rem] font-bold text-red-600 mt-3">
                        Data yang sudah dihapus tidak dapat dikembalikan!
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
            width: '400px',
            padding: '0',
            showCloseButton: true,
            customClass: {
                popup: 'rounded-[20px] overflow-hidden border-none shadow-2xl bg-white dark:bg-[#0f172a]',
                title: 'border-b border-slate-100 dark:border-slate-800 p-5 m-0 w-full',
                htmlContainer: 'p-6 m-0',
                actions: 'm-0 p-5 bg-slate-50 dark:bg-slate-900/50 w-full flex justify-end items-center gap-3',
                confirmButton: 'm-0 rounded-lg h-12 px-8 min-w-[120px] text-sm font-bold bg-gradient-to-br from-red-600 to-red-500 text-white border-none shadow-md hover:brightness-110 active:scale-95 transition-all order-2 flex items-center justify-center',
                cancelButton: 'm-0 rounded-lg h-12 px-8 min-w-[120px] text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 active:scale-95 transition-all order-1 flex items-center justify-center',
                closeButton: 'text-slate-400 hover:text-slate-600 outline-none shadow-none'
            },
            buttonsStyling: false
        });

        if (!result.isConfirmed) return;

        try {
            for (const id of idsArray) {
                const response = await fetch(`/api/jurnal/${id}`, { method: 'DELETE' });
                const json = await response.json().catch(() => null);
                if (!response.ok || (json && json.ok === false && json.success === false)) {
                    throw new Error(json?.error || json?.message || 'Gagal menghapus data dengan ID ' + id);
                }
            }

            Swal.fire({
                title: 'Berhasil',
                text: 'Data jurnal berhasil dihapus',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                width: '280px',
                padding: '1rem',
                customClass: {
                    popup: 'rounded-[1.25rem] shadow-xl',
                    title: 'text-base font-bold text-slate-800',
                    htmlContainer: 'text-sm text-slate-500',
                    icon: 'scale-75 mb-0'
                }
            });
            fetchJournals();
        } catch (err: any) {
            Swal.fire('Gagal', 'Terjadi kesalahan: ' + err.message, 'error');
        }
    };

    const formatJamRange = (group: any) => {
        const ids = group.jamIds.sort((a: number, b: number) => a - b);
        if (ids.length === 0) return;

        const result = [];
        let start = ids[0];
        let prev = ids[0];

        for (let i = 1; i <= ids.length; i++) {
            const current = ids[i];
            if (current === prev + 1) {
                prev = current;
            } else {
                if (start === prev) {
                    result.push(start.toString());
                } else {
                    result.push(`${start}-${prev}`);
                }
                start = current;
                prev = current;
            }
        }
        group.jam_ke = result.join(', ');
    };

    const displayGroups = useCallback((filteredData: Journal[]) => {
        if (filteredData.length === 0) return [];

        const groups: any[] = [];
        let currentGroup: any = null;

        const sorted = [...filteredData].sort((a, b) => {
            if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
            if (a.nama_guru !== b.nama_guru) return a.nama_guru.localeCompare(b.nama_guru);
            if (a.kelas !== b.kelas) return a.kelas.localeCompare(b.kelas);
            return (a.jam_ke_id || 0) - (b.jam_ke_id || 0);
        });

        sorted.forEach(j => {
            if (!currentGroup) {
                currentGroup = { ...j, allIds: [j.id], jamIds: [j.jam_ke_id] };
            } else {
                const isSameContext =
                    j.nip === currentGroup.nip &&
                    j.tanggal === currentGroup.tanggal &&
                    j.kelas === currentGroup.kelas &&
                    j.mata_pelajaran === currentGroup.mata_pelajaran &&
                    j.kategori_kehadiran === currentGroup.kategori_kehadiran &&
                    j.materi === currentGroup.materi &&
                    j.refleksi === currentGroup.refleksi &&
                    j.guru_pengganti === currentGroup.guru_pengganti &&
                    j.status_pengganti === currentGroup.status_pengganti;

                if (isSameContext) {
                    currentGroup.allIds.push(j.id);
                    currentGroup.jamIds.push(j.jam_ke_id);
                } else {
                    formatJamRange(currentGroup);
                    groups.push(currentGroup);
                    currentGroup = { ...j, allIds: [j.id], jamIds: [j.jam_ke_id] };
                }
            }
        });

        if (currentGroup) {
            formatJamRange(currentGroup);
            groups.push(currentGroup);
        }
        return groups;
    }, []);

    const filteredJournals = journals.filter(j => {
        // Filter Tahun Ajaran (pilihan dari tahun ajaran aktif)
        const taRange = tahunAjaranFilter.range;
        if (taRange && (j.tanggal < taRange.start || j.tanggal > taRange.end)) return false;

        // GURU: additional client-side filter to ensure they only see their own journals
        if (isGuru && !isPrivileged) {
            const matchNip = user?.nip && (j.nip === user.nip || j.nip === user.nip.padStart(10, '0'));
            const matchOrig = user?.nama ? checkNameMatch(j.nama_guru, user.nama) : false;
            const matchSub = user?.nama ? checkNameMatch(j.guru_pengganti || '', user.nama) : false;
            if (!matchNip && !matchOrig && !matchSub) return false;
        }

        if (selectedTeacher) {
            const matchOrig = checkNameMatch(j.nama_guru, selectedTeacher);
            const matchSub = checkNameMatch(j.guru_pengganti || '', selectedTeacher);
            if (!matchOrig && !matchSub) return false;
        }
        if (selectedSubject) {
            const dbMapel = String(j.mata_pelajaran || '').toLowerCase();
            const filterMapel = String(selectedSubject).toLowerCase();
            if (!dbMapel.includes(filterMapel)) return false;
        }
        if (selectedClass && j.kelas !== selectedClass) return false;
        if (selectedCategory && j.kategori_kehadiran !== selectedCategory) return false;
        if (selectedDate && j.tanggal !== selectedDate) return false;

        if (searchTerm) {
            const ls = searchTerm.toLowerCase();
            const fieldsToSearch = [
                j.nama_guru, j.guru_pengganti, j.mata_pelajaran, j.kelas, j.materi,
                j.refleksi, j.hari, j.tanggal, j.jam_ke, j.kategori_kehadiran,
                j.keterangan_terlambat, j.keterangan_tambahan, j.guru_piket, j.nip
            ];
            if (!fieldsToSearch.some(field => String(field || '').toLowerCase().includes(ls))) return false;
        }

        return true;
    });

    const finalDisplayData = displayGroups(filteredJournals);

    useEffect(() => {
        if (user?.id || user?.nip || user?.username) fetchJournals();
    }, [fetchJournals, user?.id, user?.nip, user?.username]);

    const [minDate, setMinDate] = useState<string>('');
    const [maxDate, setMaxDate] = useState<string>('');

    useEffect(() => {
        const getBounds = async () => {
            try {
                const { getAllActiveAcademicYears } = await import('@/lib/settings-client');
                const activePeriods = await getAllActiveAcademicYears();
                if (activePeriods && activePeriods.length > 0) {
                    const years = activePeriods.map(p => p.tahun_ajaran);
                    const startYears = years.map(y => parseInt(y.split('/')[0])).filter(y => !isNaN(y));
                    if (startYears.length > 0) {
                        const minYear = Math.min(...startYears);
                        const maxYear = Math.max(...startYears) + 1;
                        setMinDate(`${minYear}-07-01`);
                        setMaxDate(`${maxYear}-06-30`);
                    }
                }
            } catch (e) {
                console.error('Failed to get bounds', e);
            }
        };
        getBounds();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredJournals.length, searchTerm, selectedTeacher, selectedSubject, selectedClass, selectedCategory, selectedDate, tahunAjaranFilter.selected]);

    return {
        journals,
        loading,
        error,
        selectedTeacher, setSelectedTeacher,
        selectedSubject, setSelectedSubject,
        selectedClass, setSelectedClass,
        selectedCategory, setSelectedCategory,
        selectedDate, setSelectedDate,
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        itemsPerPage, setItemsPerPage,
        finalDisplayData,
        filteredJournals,
        canDo,
        isAdmin,
        isGuru,
        isSiswa,
        isWali,
        isPrivileged,
        isOPJurnal,
        fetchJournals,
        handleDelete,
        checkNameMatch,
        isJournalRelated,
        displayGroups,
        masterDataState,
        setMasterDataState,
        minDate,
        maxDate,
        tahunAjaranFilter
    };
}
