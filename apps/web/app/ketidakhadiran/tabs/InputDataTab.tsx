'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import '../ketidakhadiran.css';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { useModalBlur } from '@/components/ModalBlurProvider';
import AddModal from '../components/AddModal';
import ImportModal from '../components/ImportModal';
import EditModal from '../components/EditModal';
import DeleteModal from '../components/DeleteModal';
import PrintModal from '../components/PrintModal';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { generateFromTemplate, formatDataForPrint, clearTemplateCache, resolveTemplate } from '../utils/PrintHelper';
import { useTimezone } from '@/hooks/use-timezone';
import { useFileViewer } from '@/components/useFileViewer';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { FilterToolbar, FilterSelect, FilterSearch, FilterField, FilterActions, FilterMonthSelect } from '@/components/ui/FilterToolbar';
import { formatEntryWaktu, isEntryTimeSpecific } from '@/lib/ketidakhadiran-jp';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { MobileFab } from '@/components/mobile';
import { MobileList, MobileListItem, MobileAvatar } from '@/components/mobile/MobileList';
import { MobileSheet, MobileKV } from '@/components/mobile/MobileSheet';
import { getProxiedImageUrl } from '@/lib/image-utils';

interface KetidakhadiranRow {
    id: string;
    jenis: 'IZIN' | 'SAKIT';
    nisn: string;
    nama: string;
    kelas: string;
    tgl_mulai: string; // ISO Date
    tgl_selesai: string;
    status: string; // MADRASAH, PERSONAL, Ringan, Sedang, dll
    keterangan: string;
    aktif: boolean;
    file_url?: string;
    created_at: string;
    has_overlap?: boolean;
    waktu_mulai_real?: string | null;
    waktu_selesai_real?: string | null;
    is_kontinu?: boolean | null;
    seri_id?: string | null;
    tindakan?: string;
    tindak_lanjut?: string;
    petugas_nama?: string;
    // Anotasi khusus antrean "Keluar Asrama" (SAKIT Sedang/Berat/Kontrol via OP Izin)
    letter_issued?: boolean;
    letter_nomor?: string | null;
    letter_barcode?: string | null;
    letter_file_url?: string | null;
    rekom_kontrol_issued?: boolean;
    rekom_kontrol_nomor?: string | null;
    _fromAsramaQueue?: boolean;
    foto_profil?: string | null;
}

interface KPIStats {
    total: number;
    izin: number;
    sakit: number;
    madrasah: number;
    personal: number;
    ringan: number;
    sedang: number;
    berat: number;
    kontrol: number;
}

interface Siswa {
    nisn: string;
    nama: string;
    kelas: string;
}

export function InputDataTab() {
    const [rows, setRows] = useState<KetidakhadiranRow[]>([]);
    /**
     * NISN -> URL foto profil, untuk avatar daftar mobile.
     *
     * Tabel `users` TIDAK punya kolom `nisn` ΓÇö untuk siswa, NISN tersimpan di
     * `username` (tautan akun) dan `nip`. Keduanya dipetakan supaya pencarian
     * lewat NISN ketemu apa pun kolom yang terisi. Pola yang sama dipakai
     * /api/nilai dan halaman Kehadiran Siswa.
     */
    const [fotoMap, setFotoMap] = useState<Record<string, string>>({});
    /** Baris yang sedang dibuka detailnya di sheet mobile. */
    const [sheetRow, setSheetRow] = useState<KetidakhadiranRow | null>(null);
    const [loading, setLoading] = useState(true);
    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer();
    const [kpi, setKpi] = useState<KPIStats>({
        total: 0,
        izin: 0,
        sakit: 0,
        madrasah: 0,
        personal: 0,
        ringan: 0,
        sedang: 0,
        berat: 0,
        kontrol: 0
    });

    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    const { registerModal } = useModalBlur();
    const { formatDate: tzFormatDate, getCurrentDate: getTzDate, timezone: schoolTz } = useTimezone();

    useEffect(() => {
        if (isAddModalOpen || isImportModalOpen || isEditModalOpen || isDeleteModalOpen || isPrintModalOpen || isViewModalOpen) {
            return registerModal();
        }
    }, [isAddModalOpen, isImportModalOpen, isEditModalOpen, isDeleteModalOpen, isPrintModalOpen, isViewModalOpen, registerModal]);

    const [editRow, setEditRow] = useState<KetidakhadiranRow | null>(null);
    const [deleteRow, setDeleteRow] = useState<KetidakhadiranRow | null>(null);
    const [printRow, setPrintRow] = useState<KetidakhadiranRow | null>(null);
    const [viewRow, setViewRow] = useState<KetidakhadiranRow | null>(null);

    // User role for access control
    const [userRole, setUserRole] = useState<string | null>(null);

    // Filters
    const [filterKelas, setFilterKelas] = useState('');
    const [filterJenis, setFilterJenis] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterMonths, setFilterMonths] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'LIST' | 'REKAM_MEDIK' | 'ASRAMA_QUEUE'>('LIST');
    const [asramaQueueRows, setAsramaQueueRows] = useState<KetidakhadiranRow[]>([]);
    const [asramaQueueLoading, setAsramaQueueLoading] = useState(false);
    const [printAsramaOnly, setPrintAsramaOnly] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showActionMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setShowActionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionMenu]);

    // Dynamic Classes
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);

    const [userPermissions, setUserPermissions] = useState<any[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userName, setUserName] = useState('');

    // GRANULAR PERMISSIONS
    const [canViewIzin, setCanViewIzin] = useState(false);
    const [canManageIzin, setCanManageIzin] = useState(false);
    const [canExportIzin, setCanExportIzin] = useState(false);

    const [canViewSakit, setCanViewSakit] = useState(false);
    const [canManageSakit, setCanManageSakit] = useState(false);
    const [canExportSakit, setCanExportSakit] = useState(false);

    const [authCheckComplete, setAuthCheckComplete] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalRows, setTotalRows] = useState(0);
    const totalPages = Math.ceil(totalRows / pageSize);

    useEffect(() => {
        fetchClasses();
        fetchUserData(() => loadData());
    }, []);

    const fetchUserData = async (onComplete?: () => void) => {
        try {
            const { hasPermission } = require('@/lib/permissions-client');
            const meRes = await fetch('/api/auth/me');
            const meData = await meRes.json();

            if (!meData.ok || !meData.user) {
                setAuthCheckComplete(true);
                return;
            }

            const userData = meData.user;
            setUserName(userData.nama_lengkap || userData.nama || userData.username || 'Petugas');
            setUserRole(userData.role || null);
            const perms = userData.permissions || [];
            setUserPermissions(perms);

            const userRoles: string[] = Array.isArray(userData.roles) && userData.roles.length > 0
                ? userData.roles.map((r: string) => String(r).trim().toUpperCase())
                : (userData.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean);

            const adminStatus = userRoles.some(r => r === 'ADMIN' || r === 'ADMINISTRATOR') || !!userData.isAdmin;
            setIsAdmin(adminStatus);

            // Normalize user roles to uppercase with underscore
            const userRolesUpper = userRoles.map((r: string) => r.replace(/\s+/g, '_'));

            // Permission from role_permissions table
            const permViewIzin = hasPermission(perms, 'ketidakhadiran.izin', 'view', adminStatus, userRoles);
            const permViewSakit = hasPermission(perms, 'ketidakhadiran.sakit', 'view', adminStatus, userRoles);

            // Role-based override: OP_IZIN always gets izin access, OP_UKS always gets sakit access
            const roleBasedIzin = userRolesUpper.includes('OP_IZIN');
            const roleBasedSakit = userRolesUpper.includes('OP_UKS');

            // FINAL PERMISSION RESOLUTION
            let finalViewIzin = (permViewIzin || roleBasedIzin || adminStatus);
            let finalManageIzin = (hasPermission(perms, 'ketidakhadiran.izin', 'manage', adminStatus, userRoles) || roleBasedIzin || adminStatus);
            let finalExportIzin = (hasPermission(perms, 'ketidakhadiran.izin', 'export', adminStatus, userRoles) || roleBasedIzin || adminStatus);

            let finalViewSakit = (permViewSakit || roleBasedSakit || adminStatus);
            let finalManageSakit = (hasPermission(perms, 'ketidakhadiran.sakit', 'manage', adminStatus, userRoles) || roleBasedSakit || adminStatus);
            let finalExportSakit = (hasPermission(perms, 'ketidakhadiran.sakit', 'export', adminStatus, userRoles) || roleBasedSakit || adminStatus);

            // STRICT ISOLATION: If specifically in one role, block the other unless they have multiple roles or are admin
            if (!adminStatus) {
                if (roleBasedIzin && !roleBasedSakit) {
                    // Strictly only IZIN
                    finalViewSakit = false;
                    finalManageSakit = false;
                    finalExportSakit = false;
                    setFilterJenis('IZIN');
                } else if (roleBasedSakit && !roleBasedIzin) {
                    // Strictly only SAKIT
                    finalViewIzin = false;
                    finalManageIzin = false;
                    finalExportIzin = false;
                    setFilterJenis('SAKIT');
                }
            }

            setCanViewIzin(finalViewIzin);
            setCanManageIzin(finalManageIzin);
            setCanExportIzin(finalExportIzin);

            setCanViewSakit(finalViewSakit);
            setCanManageSakit(finalManageSakit);
            setCanExportSakit(finalExportSakit);
        } catch (e) {
            console.error('Error fetching user data', e);
        } finally {
            setAuthCheckComplete(true);
            if (onComplete) onComplete();
        }
    };

    const canDo = (resource: string, action: string) => {
        // Fallback or specific checks if needed elsewhere
        const { hasPermission } = require('@/lib/permissions-client');
        return hasPermission(userPermissions, resource, action, isAdmin);
    }

    const fetchClasses = async () => {
        try {
            const res = await fetch('/api/master/kelas?program=Reguler');
            const json = await res.json();
            const data = json.ok ? json.data : (Array.isArray(json) ? json : []);
            if (Array.isArray(data)) {
                const classes = Array.from(new Set(data.map((d: any) => d.nama).filter(Boolean))).sort() as string[];
                setAvailableClasses(classes);
            }
        } catch (e) {
            console.error('Error loading classes:', e);
        }
    };

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [filterKelas, filterJenis, filterStatus, filterMonths, searchQuery]);

    useEffect(() => {
        if (!authCheckComplete) return;
        loadData();
    }, [authCheckComplete, filterKelas, filterJenis, filterStatus, filterMonths, searchQuery, page, pageSize]); // Reload when permissions ready

    // Foto profil siswa untuk avatar daftar mobile. Diambil sekali saja ΓÇö
    // isinya tidak berubah antar-filter, dan barisnya sedikit (hanya user yang
    // benar-benar punya foto).
    useEffect(() => {
        if (!authCheckComplete) return;
        let batal = false;
        (async () => {
            try {
                const res = await fetch('/api/nilai/siswa/photos');
                const json = await res.json();
                if (batal) return;
                const data = json.ok ? json.data : [];
                const peta: Record<string, string> = {};
                (data || []).forEach((u: any) => {
                    if (!u.foto_profil) return;
                    const url = getProxiedImageUrl(u.foto_profil);
                    if (u.nip) peta[u.nip] = url;
                    if (u.username) peta[u.username] = url;
                });
                setFotoMap(peta);
            } catch (err: any) {
                console.warn('[ketidakhadiran] Gagal memuat foto profil:', err.message);
            }
        })();
        return () => { batal = true; };
    }, [authCheckComplete]);

    const filteredRows = useMemo(() => {
        let r = rows;
        if (viewMode === 'REKAM_MEDIK') {
            r = r.filter(row => row.jenis === 'SAKIT');
        }
        return r;
    }, [rows, viewMode]);

    // ΓöÇΓöÇ KIRIM INFO LAPORAN HARIAN ΓöÇΓöÇ
    const handleKirimInfo = async () => {
        const today = getTzDate();

        // ΓöÇΓöÇ Step 1: Pilih tanggal ΓöÇΓöÇ
        const dateResult = await Swal.fire({
            title: 'Pilih Tanggal',
            text: 'Tentukan tanggal laporan yang akan dikirim',
            input: 'date',
            inputValue: today,
            confirmButtonText: 'Lanjut',
            cancelButtonText: 'Batal',
            showCancelButton: true,
            background: 'var(--n-card, #fff)',
            color: 'var(--n-ink, #0f172a)',
            customClass: {
                popup: 'kh-swal-popup',
                title: 'kh-swal-title',
                htmlContainer: 'kh-swal-text',
                confirmButton: 'kh-swal-btn-primary',
                cancelButton: 'kh-swal-btn-ghost',
            },
        });

        if (!dateResult.isConfirmed || !dateResult.value) return;
        const selectedDate = dateResult.value as string;

        const tglFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // ΓöÇΓöÇ Step 2: Tentukan jenis berdasarkan role ΓöÇΓöÇ
        // OP_IZIN only ΓåÆ auto Izin; OP_UKS only ΓåÆ auto Sakit; Admin/mixed ΓåÆ pilih
        let jenisFilter: string | null = null;
        let roleLabel = '';

        if (canViewIzin && !canViewSakit) {
            jenisFilter = 'IZIN';
            roleLabel = 'Izin';
        } else if (canViewSakit && !canViewIzin) {
            jenisFilter = 'SAKIT';
            roleLabel = 'Sakit';
        } else if (isAdmin || (canViewIzin && canViewSakit)) {
            // Admin / role campuran ΓåÆ pilih Izin atau Sakit
            const chooseResult = await Swal.fire({
                title: 'Pilih Jenis Laporan',
                text: 'Silakan pilih kategori laporan yang ingin dikirim',
                showCancelButton: true,
                showCloseButton: true,
                confirmButtonText: 'Izin',
                cancelButtonText: 'Sakit',
                background: 'var(--n-card, #fff)',
                color: 'var(--n-ink, #0f172a)',
                customClass: {
                    popup: 'kh-swal-popup',
                    title: 'kh-swal-title',
                    confirmButton: 'kh-swal-btn-green',
                    cancelButton: 'kh-swal-btn-red',
                },
            });

            if (chooseResult.isConfirmed) {
                jenisFilter = 'IZIN';
                roleLabel = 'Izin';
            } else if (chooseResult.dismiss === 'cancel') {
                jenisFilter = 'SAKIT';
                roleLabel = 'Sakit';
            } else {
                return; // closed
            }
        }

        if (!jenisFilter) return;

        // ΓöÇΓöÇ Step 3: Filter data ΓöÇΓöÇ
        // Filter: selectedDate must be within [tgl_mulai, tgl_selesai] inclusive
        //
        // Khusus laporan HARI INI, siswa yang jam selesainya sudah lewat tidak
        // ikut dikirim ΓÇö mis. sakit sampai 12.00 tidak lagi relevan saat laporan
        // dikirim pukul 13.00. waktu_selesai_real kosong berarti "Semua Jam"
        // (sehari penuh), jadi tetap disertakan.
        //
        // Jam dibaca pada zona waktu madrasah (site_settings), bukan jam perangkat
        // pengirim, supaya petugas yang berbeda zona waktu menghasilkan daftar sama.
        const isToday = selectedDate === getTzDate();
        const nowHM = new Date().toLocaleTimeString('en-GB', {
            hourCycle: 'h23', hour: '2-digit', minute: '2-digit', timeZone: schoolTz,
        });

        const hasEnded = (r: KetidakhadiranRow) =>
            isToday && (r.tgl_selesai === selectedDate || !r.tgl_selesai) && !!r.waktu_selesai_real && r.waktu_selesai_real.substring(0, 5) < nowHM;

        let allDateRows: KetidakhadiranRow[] = [];
        try {
            const p = new URLSearchParams();
            p.append('from', selectedDate);
            p.append('to', selectedDate);
            p.append('jenis', jenisFilter);
            const resAll = await fetch(`/api/ketidakhadiran?${p.toString()}`);
            const jsonAll = await resAll.json();
            if (jsonAll.ok && Array.isArray(jsonAll.data)) {
                allDateRows = jsonAll.data;
            } else {
                allDateRows = rows.filter(r => {
                    if (selectedDate < r.tgl_mulai || selectedDate > r.tgl_selesai) return false;
                    if (r.jenis !== jenisFilter) return false;
                    return true;
                });
            }
        } catch {
            allDateRows = rows.filter(r => {
                if (selectedDate < r.tgl_mulai || selectedDate > r.tgl_selesai) return false;
                if (r.jenis !== jenisFilter) return false;
                return true;
            });
        }

        const filteredRows = allDateRows.filter(r => !hasEnded(r));

        if (filteredRows.length === 0) {
            const semuaSudahLewat = allDateRows.length > 0;
            await Swal.fire({
                title: 'Tidak Ada Data',
                html: semuaSudahLewat
                    ? `Semua data <b>${roleLabel}</b> untuk<br><b>${tglFormatted}</b><br>sudah lewat jam selesainya (sekarang ${nowHM}).`
                    : `Belum ada data <b>${roleLabel}</b> untuk<br><b>${tglFormatted}</b>.`,
                icon: 'info',
                confirmButtonColor: '#3083FF',
                background: 'var(--n-card, #fff)',
                color: 'var(--n-ink, #0f172a)',
            });
            return;
        }

        // ΓöÇΓöÇ Step 3.5: Sort data by Kelas first ΓöÇΓöÇ
        filteredRows.sort((a, b) => {
            // 1. Sort by jenjang kelas (X -> XI -> XII)
            const getGrade = (k: string) => {
                if (!k) return 99;
                if (k.startsWith('XII')) return 3;
                if (k.startsWith('XI')) return 2;
                if (k.startsWith('X')) return 1;
                return 99;
            };
            const gradeA = getGrade(a.kelas);
            const gradeB = getGrade(b.kelas);
            if (gradeA !== gradeB) return gradeA - gradeB;

            // 2. Urutkan berdasarkan nama lengkap kelas (misal X MIPA 1 vs X MIPA 2)
            const classComp = (a.kelas || '').localeCompare(b.kelas || '');
            if (classComp !== 0) return classComp;

            // 3. Jika kelas sama, urutkan berdasarkan nama siswa
            return (a.nama || '').localeCompare(b.nama || '');
        });

        // ΓöÇΓöÇ Step 4: Payload laporan ΓöÇΓöÇ
        // Baris dikirim apa adanya; penyusunan pesan (template teks / tabel gambar)
        // sepenuhnya milik server, supaya pratinjau di bawah tidak bisa berbeda dari
        // yang benar-benar diterima grup.
        const payloadRows = filteredRows.map((row) => ({
            nama: row.nama,
            nisn: row.nisn || '-',
            kelas: row.kelas,
            status: row.status === 'MADRASAH' ? 'Madrasah' : row.status === 'PERSONAL' ? 'Personal' : row.status,
            // Jam sebelah (baris hari pertama/terakhir entri kontinu) tetap
            // ditampilkan jamnya, bukan diringkas jadi "Semua Jam".
            waktu: formatEntryWaktu(row),
            keterangan: row.keterangan || '-',
        }));

        const payloadHeader = {
            tanggal: tglFormatted,
            petugas_nama: userName, // hanya informatif; server memakai nama dari sesi
            jenis: roleLabel,
            total: filteredRows.length,
        };

        // ΓöÇΓöÇ Step 5: Ambil pratinjau dari server (jalur yang sama dengan pengiriman) ΓöÇΓöÇ
        Swal.fire({
            title: 'Menyiapkan pratinjau...',
            allowOutsideClick: false,
            background: 'var(--n-card, #fff)',
            color: 'var(--n-ink, #0f172a)',
            customClass: { popup: 'kh-swal-popup', title: 'kh-swal-title' },
            didOpen: () => Swal.showLoading(),
        });

        let preview: any;
        try {
            const previewRes = await fetch('/api/ketidakhadiran/notify-wa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'preview', header: payloadHeader, rows: payloadRows }),
            });
            preview = await previewRes.json();
        } catch (err: any) {
            preview = { ok: false, error: err?.message || 'Gagal menghubungi server' };
        }

        if (!preview?.ok || !preview.parts?.length) {
            await Swal.fire({
                icon: 'error',
                title: 'Gagal Menyiapkan Pratinjau',
                html: `Laporan tidak dapat disusun.${preview?.error ? `<div class="kh-swal-line kh-swal-sub" style="margin-top:10px"><b>Detail:</b> ${String(preview.error).replace(/[<>]/g, '')}</div>` : ''}`,
                background: 'var(--n-card, #fff)',
                color: 'var(--n-ink, #0f172a)',
                customClass: { popup: 'kh-swal-popup', title: 'kh-swal-title' },
            });
            return;
        }

        // Catatan hanya tampil di pratinjau, tidak ikut ke pesan WhatsApp.
        const excludedCount = allDateRows.length - filteredRows.length;
        const excludedNote = excludedCount > 0
            ? `<div class="kh-swal-line kh-swal-sub" style="font-size:0.78rem;line-height:1.4;margin-bottom:3px"><i>${excludedCount} data tidak disertakan karena jam selesainya sudah lewat (sekarang ${nowHM}).</i></div>`
            : '';

        const escapeHtml = (s: string) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

        const partsHtml = preview.parts.map((part: any) => {
            const heading = part.label
                ? `<div class="kh-swal-line kh-swal-heading">${escapeHtml(part.label)}</div>`
                : '';
            if (part.imageDataUrl) {
                return `${heading}<img src="${part.imageDataUrl}" alt="Pratinjau laporan" style="width:100%;border-radius:10px;border:1px solid rgba(148,163,184,.35)" />` +
                    (part.caption ? `<div class="kh-swal-line kh-swal-sub" style="margin-top:6px;font-size:0.78rem;line-height:1.4">${escapeHtml(part.caption)}</div>` : '');
            }
            return `${heading}<div class="kh-swal-preview">${escapeHtml(part.text || '').split('\n').map((line: string) =>
                `<div class="kh-swal-line kh-swal-meta">${line || '&nbsp;'}</div>`
            ).join('')}</div>`;
        }).join('<div style="height:12px"></div>');

        const modeNote = preview.mode === 'image'
            ? '<div class="kh-swal-line kh-swal-sub" style="font-size:0.78rem;line-height:1.4;margin-bottom:10px">Dikirim sebagai gambar ke grup WhatsApp.</div>'
            : '';

        await Swal.fire({
            title: `Pratinjau Laporan ${roleLabel}`,
            html: `${excludedNote}${modeNote}${partsHtml}`,
            showCancelButton: true,
            confirmButtonText: 'Kirim',
            cancelButtonText: 'Tutup',
            confirmButtonColor: '#25D366',
            width: preview.mode === 'image' ? '760px' : '600px',
            background: 'var(--n-card, #fff)',
            color: 'var(--n-ink, #0f172a)',
            customClass: {
                popup: 'kh-swal-popup',
                title: 'kh-swal-title',
                confirmButton: 'kh-swal-btn-wa',
                cancelButton: 'kh-swal-btn-ghost',
                htmlContainer: 'kh-swal-html',
            },
        }).then(async (res) => {
            if (res.isConfirmed) {
                try {
                    // Payload identik dengan yang dipakai pratinjau di atas.
                    const apiRes = await fetch('/api/ketidakhadiran/notify-wa', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ header: payloadHeader, rows: payloadRows })
                    });
                    const result = await apiRes.json();

                    if (result.ok) {
                        await Swal.fire({ icon: 'success', title: 'Terkirim!', text: 'Pesan berhasil dikirim ke grup WhatsApp.', timer: 2000, showConfirmButton: false });
                    } else if (result.skipped) {
                        // Notifikasi WA sengaja dimatikan di pengaturan ΓÇö bukan kegagalan.
                        await Swal.fire({
                            icon: 'info',
                            title: 'Tidak Dikirim',
                            text: 'Notifikasi WhatsApp untuk ketidakhadiran sedang dimatikan di Pengaturan Umum ΓåÆ tab WhatsApp.',
                            background: 'var(--n-card, #fff)',
                            color: 'var(--n-ink, #0f172a)',
                            customClass: { popup: 'kh-swal-popup', title: 'kh-swal-title' },
                        });
                    } else {
                        throw new Error(result.error || 'Gagal mengirim');
                    }
                } catch (error: any) {
                    console.error('Failed to send WA via API:', error);
                    const detail = error?.message ? String(error.message) : '';
                    await Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        html: `Pesan gagal dikirim. Coba lagi atau hubungi administrator.${detail ? `<div class="kh-swal-line kh-swal-sub" style="margin-top:10px"><b>Detail:</b> ${detail.replace(/[<>]/g, '')}</div>` : ''}`,
                    });
                }
            }
        });
    };

    const handleExport = async () => {
        // ... (Export Logic with permission checks)
        try {
            const XLSX = await import('xlsx-js-style');

            // Define Styles (Same as before)
            const headerStyle = {
                fill: { fgColor: { rgb: "0B1B3A" } },
                font: { color: { rgb: "FFFFFF" }, bold: true, sz: 12 },
                alignment: { horizontal: "center", vertical: "center" },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
            const cellStyle = {
                border: { top: { style: "thin", color: { rgb: "CCCCCC" } }, bottom: { style: "thin", color: { rgb: "CCCCCC" } }, left: { style: "thin", color: { rgb: "CCCCCC" } }, right: { style: "thin", color: { rgb: "CCCCCC" } } }
            };

            const formatData = (dataRows: KetidakhadiranRow[]) => {
                return dataRows.map((row, index) => ({
                    No: index + 1,
                    NISN: row.nisn,
                    Nama: row.nama,
                    Kelas: row.kelas,
                    Jenis: row.jenis,
                    Status: row.status === 'MADRASAH' ? 'Madrasah' : row.status === 'PERSONAL' ? 'Personal' : row.status,
                    'Tgl Mulai': row.tgl_mulai,
                    'Tgl Selesai': row.tgl_selesai,
                    'Waktu (Real)': isEntryTimeSpecific(row)
                        ? formatEntryWaktu(row)
                        : '-',
                    Keterangan: row.keterangan || '-',
                    Tindakan: row.tindakan || '-',
                    'Tindak Lanjut': row.tindak_lanjut || '-',
                    Petugas: row.petugas_nama || '-',
                    'Diinput Pada': new Date(row.created_at).toLocaleDateString('id-ID')
                }));
            };

            const createStyledSheet = (data: any[]) => {
                const ws = XLSX.utils.json_to_sheet(data);
                const colWidths = [
                    { wch: 5 },  // No
                    { wch: 15 }, // NISN
                    { wch: 35 }, // Nama
                    { wch: 10 }, // Kelas
                    { wch: 10 }, // Jenis
                    { wch: 15 }, // Status
                    { wch: 15 }, // Tgl Mulai
                    { wch: 15 }, // Tgl Selesai
                    { wch: 15 }, // Waktu (Real)
                    { wch: 40 }, // Keterangan
                    { wch: 30 }, // Tindakan
                    { wch: 30 }, // Tindak Lanjut
                    { wch: 25 }, // Petugas
                    { wch: 20 }  // Diinput Pada
                ];
                ws['!cols'] = colWidths;
                if (!ws['!rows']) ws['!rows'] = [];
                ws['!rows'][0] = { hpt: 30 };
                const range = XLSX.utils.decode_range(ws['!ref'] as string);
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const address = XLSX.utils.encode_cell({ r: 0, c: C });
                    if (!ws[address]) continue;
                    ws[address].s = headerStyle;
                }
                for (let R = 1; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const address = XLSX.utils.encode_cell({ r: R, c: C });
                        if (!ws[address]) continue;
                        ws[address].s = cellStyle;
                    }
                }
                return ws;
            };

            Swal.fire({
                title: 'Menyiapkan data...',
                html: 'Mengambil seluruh data untuk diexport...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const exportParams = new URLSearchParams();
            if (filterKelas) exportParams.append('kelas', filterKelas);
            if (filterJenis) exportParams.append('jenis', filterJenis);
            if (filterStatus) exportParams.append('status', filterStatus);
            if (filterMonths.length > 0) exportParams.append('months', filterMonths.join(','));
            if (searchQuery) exportParams.append('q', searchQuery);

            let exportRows = rows;
            try {
                const resAll = await fetch(`/api/ketidakhadiran?${exportParams.toString()}`);
                const jsonAll = await resAll.json();
                if (jsonAll.ok && Array.isArray(jsonAll.data)) {
                    exportRows = jsonAll.data;
                }
            } catch (err) {
                console.warn('[handleExport] Fallback to current rows:', err);
            }
            Swal.close();

            // Filter Data based on Permission
            const visibleRows = exportRows.filter(r => {
                if (r.jenis === 'IZIN' && !canExportIzin) return false;
                if (r.jenis === 'SAKIT' && !canExportSakit) return false;
                return true;
            });

            const allData = formatData(visibleRows);
            const izinData = formatData(visibleRows.filter(r => r.jenis === 'IZIN'));
            const sakitData = formatData(visibleRows.filter(r => r.jenis === 'SAKIT'));

            const wb = XLSX.utils.book_new();

            if (canExportIzin && canExportSakit) {
                if (allData.length > 0) XLSX.utils.book_append_sheet(wb, createStyledSheet(allData), "Semua Data");
            }
            if (canExportIzin) {
                if (izinData.length > 0) XLSX.utils.book_append_sheet(wb, createStyledSheet(izinData), "Izin");
            }
            if (canExportSakit) {
                if (sakitData.length > 0) XLSX.utils.book_append_sheet(wb, createStyledSheet(sakitData), "Sakit");
            }

            if (wb.SheetNames.length === 0) {
                Swal.fire({ title: 'Info', text: 'Tidak ada data yang dapat diexport sesuai izin akses Anda.', icon: 'info' });
                return;
            }

            XLSX.writeFile(wb, `Ketidakhadiran_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

            Swal.fire({
                title: 'Berhasil',
                text: 'File Excel berhasil diunduh',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                confirmButtonColor: '#0b1b3a'
            });

        } catch (error) {
            console.error('Export error:', error);
            Swal.fire({
                title: 'Gagal',
                text: 'Gagal mengexport data.',
                icon: 'error'
            });
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterKelas) params.append('kelas', filterKelas);
            if (filterJenis) params.append('jenis', filterJenis);
            if (filterStatus) params.append('status', filterStatus);
            if (filterMonths.length > 0) params.append('months', filterMonths.join(','));
            if (searchQuery) params.append('q', searchQuery);
            params.append('page', String(page));
            params.append('limit', String(pageSize));

            // fetchUserData already called getUser() to load the session from cookies.
            // getSession() will now reliably return the token.
            const res = await fetch(`/api/ketidakhadiran?${params.toString()}`);

            if (!res.ok) {
                const errorText = await res.text();
                console.error('[loadData] API Error:', res.status, errorText);
                setRows([]);
                setTotalRows(0);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: 'Gagal Memuat Data',
                    text: `Kendala server: HTTP ${res.status}`,
                    timer: 3000,
                    showConfirmButton: false,
                });
                return;
            }

            const data = await res.json();

            if (data.ok) {
                const fetchedRows = data.data || [];
                setRows(fetchedRows);
                if (data.pagination) {
                    setTotalRows(data.pagination.total);
                }
                // KPI loads all records (no page/limit) for accurate counts
                loadKPI();
            } else {
                setRows([]);
                setTotalRows(0);
                console.warn('[loadData] API ok:false', data.error);
            }
        } catch (error) {
            console.error('Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadKPI = async () => {
        try {
            const params = new URLSearchParams();
            if (filterKelas) params.append('kelas', filterKelas);
            if (filterMonths.length > 0) params.append('months', filterMonths.join(','));
            // No page/limit ΓåÆ returns all rows for accurate KPI
            const res = await fetch(`/api/ketidakhadiran?${params.toString()}`);
            const json = await res.json();
            if (json.ok) calculateKPI(json.data || []);
        } catch {
            // Non-critical
        }
    };

    // Antrean "Keluar Asrama" ΓÇö baris SAKIT (Sedang/Berat/Kontrol) yang siswanya
    // dirawat di luar dan perlu Surat Izin Meninggalkan Asrama, khusus OP_IZIN/ADMIN
    // (bukan OP_UKS) supaya penerbitan surat tetap lewat OP Izin tanpa entri IZIN ganda.
    const loadAsramaQueue = async () => {
        try {
            setAsramaQueueLoading(true);
            const params = new URLSearchParams();
            params.append('asramaQueue', '1');
            if (filterKelas) params.append('kelas', filterKelas);
            if (viewMode === 'ASRAMA_QUEUE' && filterStatus) params.append('status', filterStatus);
            if (filterMonths.length > 0) params.append('months', filterMonths.join(','));
            if (searchQuery) params.append('q', searchQuery);
            const res = await fetch(`/api/ketidakhadiran?${params.toString()}`);
            const json = await res.json();
            if (json.ok) setAsramaQueueRows(json.data || []);
        } catch (error) {
            console.error('[loadAsramaQueue] error:', error);
        } finally {
            setAsramaQueueLoading(false);
        }
    };

    useEffect(() => {
        if (authCheckComplete && canManageIzin) loadAsramaQueue();
    }, [authCheckComplete, canManageIzin, filterKelas, filterStatus, filterMonths, searchQuery, viewMode]);

    const calculateKPI = (data: KetidakhadiranRow[]) => {
        const stats: KPIStats = {
            total: data.length,
            izin: 0,
            sakit: 0,
            madrasah: 0,
            personal: 0,
            ringan: 0,
            sedang: 0,
            berat: 0,
            kontrol: 0
        };

        data.forEach(row => {
            if (row.jenis === 'IZIN') {
                stats.izin++;
                if (row.status === 'MADRASAH') stats.madrasah++;
                if (row.status === 'PERSONAL') stats.personal++;
            } else if (row.jenis === 'SAKIT') {
                stats.sakit++;
                if (row.status === 'Ringan') stats.ringan++;
                if (row.status === 'Sedang') stats.sedang++;
                if (row.status === 'Berat') stats.berat++;
                if (row.status === 'Kontrol') stats.kontrol++;
            }
        });

        setKpi(stats);
    };

    const formatDate = (isoDate: string) => {
        if (!isoDate) return '-';
        const [y, m, d] = isoDate.split('-');
        return `${d}-${m}-${y}`;
    };

    // Entri satu tanggal ditulis sekali saja ("20-08-2026"), bukan diulang jadi
    // "20-08-2026ΓÇô20-08-2026".
    const isSatuTanggal = (row: KetidakhadiranRow) =>
        !row.tgl_selesai || row.tgl_mulai === row.tgl_selesai;

    const formatRentangTanggal = (row: KetidakhadiranRow) =>
        isSatuTanggal(row)
            ? formatDate(row.tgl_mulai)
            : `${formatDate(row.tgl_mulai)} s.d. ${formatDate(row.tgl_selesai)}`;

    // Sisi jam yang kosong pada entri kontinu berarti terbuka: awal hari / akhir
    // hari (aturan yang sama dengan entryTimeWindow di lib/ketidakhadiran-jp.ts).
    const jamHHMM = (t: string | null | undefined, kosong: string) =>
        t ? t.substring(0, 5) : kosong;

    // Entri kontinu = satu rentang tak terputus, jadi tanggal DIPASANGKAN dengan
    // jamnya di masing-masing ujung ("24-08-2026 06:00 ΓåÆ 26-08-2026 21:20").
    // Kalau jamnya ditaruh terpisah, "06:00 ΓÇô 21:20" terbaca seolah jam harian.
    // Bentuk berpasangan ini sudah cukup menjelaskan sifat kontinunya, jadi tidak
    // perlu badge tambahan.
    const renderBatasKontinu = (row: KetidakhadiranRow) => (
        <span
            className="kh-periode-kontinu"
            title="Satu rentang izin/sakit tanpa putus, dari jam mulai di tanggal awal sampai jam selesai di tanggal akhir"
        >
            <span className="kh-periode-batas">
                <span className="kh-periode-batas__tgl">{formatDate(row.tgl_mulai)}</span>
                <span className="kh-periode-batas__jam">{jamHHMM(row.waktu_mulai_real, '00:00')}</span>
            </span>
            <i className="bi bi-arrow-right kh-periode-panah" aria-label="tanpa putus sampai" />
            <span className="kh-periode-batas">
                <span className="kh-periode-batas__tgl">{formatDate(row.tgl_selesai)}</span>
                <span className="kh-periode-batas__jam">{jamHHMM(row.waktu_selesai_real, '24:00')}</span>
            </span>
            <span className="kh-periode-zona">WITA</span>
        </span>
    );

    // ΓöÇΓöÇ Ringkasan untuk baris daftar mobile ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // Baris daftar hanya memuat nama + kelas + status + waktu; sisanya di sheet.

    /** "Ringan" / "Personal" / "Madrasah" ΓÇö status apa adanya, dirapikan. */
    const labelStatus = (row: KetidakhadiranRow) =>
        row.status === 'MADRASAH' ? 'Madrasah'
            : row.status === 'PERSONAL' ? 'Personal'
                : row.status;

    /**
     * Ringkasan waktu sependek mungkin untuk baris daftar.
     *
     * Entri kontinu dipendekkan jadi rentang tanggal saja ΓÇö jam kedua ujungnya
     * tidak muat di satu baris dan sudah tampil utuh di sheet.
     */
    const labelWaktu = (row: KetidakhadiranRow) => {
        if (row.is_kontinu && !isSatuTanggal(row)) return formatRentangTanggal(row);
        if (isEntryTimeSpecific(row)) return `${formatEntryWaktu(row)} WITA`;
        return 'Semua Jam';
    };

    // ========== PRINT LOGIC ==========
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    // Berkas surat dibuka di viewer in-app, bukan tab baru. Sebelumnya URL storage
    // di-fetch lalu di-window.open; ketika fetch gagal (CORS ke bucket R2) jalurnya
    // jatuh ke window.open(url) sehingga alamat bucket terbaca di address bar
    // pengguna. Viewer mengambil berkas lewat /api/pdf-proxy, jadi alamat aslinya
    // tidak pernah tampil. Blob URL (fallback HTML mentah) tetap dibuka di tab baru
    // karena viewer mengenali jenis berkas dari ekstensi URL, yang tidak dimiliki blob.
    const openLetterFile = (url: string, title?: string) => {
        if (!url) return;
        if (url.startsWith('blob:')) {
            window.open(url, '_blank');
            return;
        }
        openFile(url, title || 'Surat');
    };

    const showPrintSuccess = async (title: string, pdfUrl?: string | null, htmlContent?: string | null) => {
        if (!pdfUrl && !htmlContent) {
            await Swal.fire({ icon: 'warning', title: 'File Tidak Tersedia', text: 'Dokumen berhasil dibuat tapi file tidak bisa dimuat. Coba cetak ulang.' });
            return;
        }

        await Swal.fire({
            icon: 'success',
            title,
            html: 'Dokumen berhasil dibuat dan diarsipkan di <b>Daftar Surat ACCA</b>.',
            confirmButtonText: 'Lihat Berkas',
            confirmButtonColor: '#3083FF',
            background: 'var(--n-card, #fff)',
            color: 'var(--n-ink, #0f172a)',
        });

        // Dibuka setelah dialog ditutup supaya modal viewer tidak tertimpa overlay SweetAlert
        if (pdfUrl) {
            openLetterFile(pdfUrl, title);
        } else if (htmlContent) {
            const blobUrl = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html' }));
            window.open(blobUrl, '_blank');
        }
    };

    const handlePrintSingle = (row: KetidakhadiranRow) => {
        setPrintAsramaOnly(false);
        setPrintRow(row);
        setIsPrintModalOpen(true);
    };

    // Cetak Surat Izin Meninggalkan Asrama dari antrean SAKIT (khusus OP_IZIN) ΓÇö
    // tandai row._fromAsramaQueue supaya printSingle tahu harus refresh antrean.
    const handlePrintAsrama = (row: KetidakhadiranRow) => {
        setPrintAsramaOnly(true);
        setPrintRow({ ...row, _fromAsramaQueue: true });
        setIsPrintModalOpen(true);
    };

    const printSingle = async (row: KetidakhadiranRow, type: 'SAKIT' | 'TUGAS' | 'IZIN' | 'MENINGGALKAN_ASRAMA' | 'REKAM_MEDIK', penandatangan?: { nama: string; jabatan: string }) => {
        // ── REKAM_MEDIK: Surat Rekam Medis via generate-letter API ──────────
        if (type === 'REKAM_MEDIK') {
            Swal.fire({ title: 'Memproses...', html: 'Menghasilkan surat rekam medis...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const genRes = await fetch('/api/ketidakhadiran/generate-letter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        letterType: 'REKAM_MEDIK',
                        row,
                        petugasNama: userName || 'Petugas UKS',
                        pejabatId: penandatangan?.nama || undefined,
                        pejabatJabatan: penandatangan?.jabatan || undefined,
                    }),
                });
                const genJson = await genRes.json();
                Swal.close();

                if (genJson.alreadyPrinted) {
                    const existing = genJson.data;

                    if (isAdmin) {
                        const adminResult = await Swal.fire({
                            icon: 'info',
                            title: 'Sudah Dicetak',
                            html: `Surat rekam medis ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b><br/><br/>Pilih aksi:`,
                            showCancelButton: true,
                            showConfirmButton: true,
                            confirmButtonText: 'Buka Dokumen',
                            cancelButtonText: 'Hapus & Cetak Ulang',
                            confirmButtonColor: '#3083FF',
                            cancelButtonColor: '#dc2626',
                        });

                        if (adminResult.isConfirmed) {
                            const targetUrl = existing?.file_url || (existing?.barcode ? `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(existing.barcode)}` : null);
                            if (targetUrl) {
                                openLetterFile(targetUrl, existing?.nomor_surat || 'Surat');
                            }
                            return;
                        }

                        if (adminResult.dismiss === 'cancel') {
                            try {
                                const delRes = await fetch(`/api/ketidakhadiran/acca-letter/${existing.id}`, { method: 'DELETE' });
                                const delJson = await delRes.json();
                                if (!delJson.ok) throw new Error(delJson.error);

                                await Swal.fire({ title: 'Dihapus', text: 'Surat berhasil dihapus. Mencetak ulang...', icon: 'success', confirmButtonColor: '#3083FF', timer: 1500 });

                                await printSingle(row, 'REKAM_MEDIK');
                            } catch (e: any) {
                                await Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonColor: '#dc2626' });
                            }
                            return;
                        }
                    }

                    await Swal.fire({
                        icon: 'info',
                        title: 'Sudah Dicetak',
                        html: `Surat rekam medis ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b>`,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#3083FF',
                    });
                    return;
                }

                if (!genJson.ok || !genJson.data) {
                    await Swal.fire({ icon: 'error', title: 'Gagal', text: genJson.error || 'Gagal menghasilkan surat rekam medis.' });
                    return;
                }

                await showPrintSuccess('Surat Rekam Medis Berhasil Dicetak', genJson.data.file_url, genJson.data.html);
            } catch (err: any) {
                Swal.close();
                await Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
            return;
        }

        // ── SAKIT: Surat Rekomendasi via generate-letter API ──────────
        if (type === 'SAKIT') {
            Swal.fire({ title: 'Memproses...', html: 'Menghasilkan surat rekomendasi...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const genRes = await fetch('/api/ketidakhadiran/generate-letter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        letterType: 'REKOMENDASI_KONTROL',
                        row,
                        petugasNama: userName || 'Petugas UKS',
                        pejabatId: penandatangan?.nama || undefined,
                        pejabatJabatan: penandatangan?.jabatan || undefined,
                    }),
                });
                const genJson = await genRes.json();
                Swal.close();

                if (genJson.alreadyPrinted) {
                    // Already printed ΓÇö offer to view existing document or delete to reprint
                    const existing = genJson.data;

                    if (isAdmin) {
                        const adminResult = await Swal.fire({
                            icon: 'info',
                            title: 'Sudah Dicetak',
                            html: `Surat ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b><br/><br/>Pilih aksi:`,
                            showCancelButton: true,
                            showConfirmButton: true,
                            confirmButtonText: 'Buka Dokumen',
                            cancelButtonText: 'Hapus & Cetak Ulang',
                            confirmButtonColor: '#3083FF',
                            cancelButtonColor: '#dc2626',
                        });

                        if (adminResult.isConfirmed) {
                            const targetUrl = existing?.file_url || (existing?.barcode ? `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(existing.barcode)}` : null);
                            if (targetUrl) {
                                openLetterFile(targetUrl, existing?.nomor_surat || 'Surat');
                            }
                            return;
                        }

                        if (adminResult.dismiss === 'cancel') {
                            // Delete and retry
                            try {
                                const delRes = await fetch(`/api/ketidakhadiran/acca-letter/${existing.id}`, { method: 'DELETE' });
                                const delJson = await delRes.json();
                                if (!delJson.ok) throw new Error(delJson.error);

                                await Swal.fire({ title: 'Dihapus', text: 'Surat berhasil dihapus. Mencetak ulang...', icon: 'success', confirmButtonColor: '#3083FF', timer: 1500 });

                                await printSingle(row, 'SAKIT');
                            } catch (e: any) {
                                await Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonColor: '#dc2626' });
                            }
                            return;
                        }
                    }

                    // Non-admin: just show info
                    await Swal.fire({
                        icon: 'info',
                        title: 'Sudah Dicetak',
                        html: `Surat ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b>`,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#3083FF',
                    });
                    return;
                }

                if (!genJson.ok || !genJson.data) {
                    await Swal.fire({ icon: 'error', title: 'Gagal', text: genJson.error || 'Gagal menghasilkan surat.' });
                    return;
                }

                await showPrintSuccess('Surat Berhasil Dicetak', genJson.data.file_url, genJson.data.html);
            } catch (err: any) {
                Swal.close();
                await Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
            return;
        }

        // ΓöÇΓöÇ MENINGGALKAN_ASRAMA: via generate-letter API ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        if (type === 'MENINGGALKAN_ASRAMA') {
            Swal.fire({ title: 'Memproses...', html: 'Menghasilkan surat izin meninggalkan asrama...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const genRes = await fetch('/api/ketidakhadiran/generate-letter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        letterType: 'MENINGGALKAN_ASRAMA',
                        row,
                        petugasNama: userName || 'Petugas UKS',
                        pejabatId: penandatangan?.nama || undefined,
                        pejabatJabatan: penandatangan?.jabatan || undefined,
                    }),
                });
                const genJson = await genRes.json();
                Swal.close();

                if (genJson.alreadyPrinted) {
                    const existing = genJson.data;
                    if (isAdmin) {
                        const adminResult = await Swal.fire({
                            icon: 'info',
                            title: 'Surat Sudah Dicetak',
                            html: `Surat ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b>`,
                            showCancelButton: true,
                            confirmButtonText: 'Buka Dokumen',
                            cancelButtonText: 'Hapus & Cetak Ulang',
                            confirmButtonColor: '#3083FF',
                            cancelButtonColor: '#dc2626',
                        });
                        if (adminResult.isConfirmed) {
                            const targetUrl = existing?.file_url || (existing?.barcode ? `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(existing.barcode)}` : null);
                            if (targetUrl) {
                                openLetterFile(targetUrl, existing?.nomor_surat || 'Surat');
                            }
                            return;
                        }
                        if (adminResult.dismiss === 'cancel') {
                            try {
                                const delRes = await fetch(`/api/ketidakhadiran/acca-letter/${existing.id}`, { method: 'DELETE' });
                                const delJson = await delRes.json();
                                if (!delJson.ok) throw new Error(delJson.error);
                                await Swal.fire({ title: 'Dihapus', text: 'Surat berhasil dihapus. Mencetak ulang...', icon: 'success', confirmButtonColor: '#3083FF', timer: 1500 });
                                await printSingle(row, 'MENINGGALKAN_ASRAMA', penandatangan);
                            } catch (e: any) {
                                await Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonColor: '#dc2626' });
                            }
                            return;
                        }
                    } else {
                        await Swal.fire({ icon: 'info', title: 'Sudah Dicetak', html: `Surat ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b>`, confirmButtonColor: '#3083FF' });
                    }
                    return;
                }

                if (!genJson.ok || !genJson.data) {
                    await Swal.fire({ icon: 'error', title: 'Gagal', text: genJson.error || 'Gagal menghasilkan surat.' });
                    return;
                }

                await showPrintSuccess('Surat Berhasil Dicetak', genJson.data.file_url, genJson.data.html);
                if (row._fromAsramaQueue) loadAsramaQueue();
            } catch (err: any) {
                Swal.close();
                await Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
            return;
        }

        // ΓöÇΓöÇ DOCX path: IZIN, TUGAS ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const templateTypeMap: Record<string, string> = {
            TUGAS: 'TUGAS_SINGLE',
            IZIN: 'IZIN_SINGLE',
        };

        const labelMap: Record<string, string> = {
            TUGAS: 'Surat Tugas Perorangan',
            IZIN: 'Surat Izin Perorangan',
        };

        const prefixMap: Record<string, string> = {
            TUGAS: 'Surat_Tugas',
            IZIN: 'Surat_Izin',
        };

        const templateType = templateTypeMap[type];
        if (!templateType) {
            await Swal.fire({ icon: 'error', title: 'Tipe Tidak Dikenal', text: `Tipe surat ${type} tidak dikenali.`, confirmButtonColor: '#dc2626' });
            return;
        }
        const resolved = await resolveTemplate(templateType);

        if (!resolved) {
            await Swal.fire({
                icon: 'warning',
                title: 'Template Belum Diatur',
                html: `Admin belum mengatur template "<b>${labelMap[type]}</b>" di halaman <b>Template Surat</b>.`,
                confirmButtonText: 'OK',
                confirmButtonColor: '#3083FF',
            });
            return;
        }

        Swal.fire({
            title: 'Memproses...',
            html: 'Menyiapkan arsip surat & QR Code...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const petugasNama = userName || 'Petugas';

            const genRes = await fetch('/api/ketidakhadiran/acca-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    row: {
                        ...row,
                        petugas_nama: petugasNama
                    },
                    pejabatId: penandatangan?.nama || undefined,
                    pejabatJabatan: penandatangan?.jabatan || undefined,
                }),
            });
            const genJson = await genRes.json();
            Swal.close();

            if (genJson.isDuplicate) {
                const existing = genJson.data;
                const adminResult = await Swal.fire({
                    icon: 'info',
                    title: 'Surat Sudah Dicetak',
                    html: `Surat ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b><br/><br/>Pilih aksi:`,
                    showCancelButton: true,
                    showConfirmButton: true,
                    confirmButtonText: 'Unduh Berkas',
                    cancelButtonText: 'Hapus & Cetak Ulang',
                    confirmButtonColor: '#3083FF',
                    cancelButtonColor: '#dc2626',
                });

                if (adminResult.isConfirmed) {
                    const barcode = existing.barcode;
                    const scanBase = window.location.origin;
                    const scanUrl = `${scanBase}/ketidakhadiran/verify/${barcode}`;
                    const qrCodeUrl = `${scanBase}/api/qrcode?data=${encodeURIComponent(scanUrl)}`;

                    const data = {
                        ...formatDataForPrint(row),
                        nomor_surat: existing.nomor_surat,
                        barcode: barcode
                    };
                    const filename = `${prefixMap[type]}_${row.nama.replace(/\s+/g, '_')}.docx`;
                    generateFromTemplate(resolved.url, data, filename, qrCodeUrl);
                    return;
                }

                if (adminResult.dismiss === 'cancel') {
                    try {
                        Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        const delRes = await fetch(`/api/ketidakhadiran/acca-letter/${existing.id}`, { method: 'DELETE' });
                        const delJson = await delRes.json();
                        Swal.close();
                        if (!delJson.ok) throw new Error(delJson.error);

                        await Swal.fire({ title: 'Dihapus', text: 'Surat berhasil dihapus. Mencetak ulang...', icon: 'success', confirmButtonColor: '#3083FF', timer: 1500 });
                        await printSingle(row, type, penandatangan);
                    } catch (e: any) {
                        await Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonColor: '#dc2626' });
                    }
                    return;
                }
                return;
            }

            if (!genJson.ok || !genJson.data) {
                await Swal.fire({ icon: 'error', title: 'Gagal', text: genJson.error || 'Gagal menyiapkan arsip surat.' });
                return;
            }

            const { barcode, nomor_surat } = genJson.data;
            const scanBase = window.location.origin;
            const scanUrl = `${scanBase}/ketidakhadiran/verify/${barcode}`;
            const qrCodeUrl = `${scanBase}/api/qrcode?data=${encodeURIComponent(scanUrl)}`;

            const data = {
                ...formatDataForPrint(row),
                nomor_surat: nomor_surat,
                barcode: barcode
            };

            const filename = `${prefixMap[type]}_${row.nama.replace(/\s+/g, '_')}.docx`;
            await generateFromTemplate(resolved.url, data, filename, qrCodeUrl);
        } catch (err: any) {
            Swal.close();
            await Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    };

    const printGroupLetter = async (groupRows: KetidakhadiranRow[], representative: KetidakhadiranRow, type: 'TUGAS' | 'IZIN') => {
        const templateType = type === 'TUGAS' ? 'TUGAS_GROUP' : 'IZIN_GROUP';
        const labelMap: Record<string, string> = { TUGAS: 'Surat Tugas Kolektif', IZIN: 'Surat Izin Kolektif' };
        const resolved = await resolveTemplate(templateType);

        if (!resolved) {
            await Swal.fire({
                icon: 'warning',
                title: 'Template Belum Diatur',
                html: `Admin belum mengatur template "<b>${labelMap[type]}</b>" di halaman <b>Template Surat</b>.`,
                confirmButtonText: 'OK',
                confirmButtonColor: '#3083FF',
            });
            return;
        }

        Swal.fire({
            title: 'Memproses...',
            html: 'Menyiapkan arsip surat & QR Code kolektif...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const petugasNama = userName || 'Petugas';

            const genRes = await fetch('/api/ketidakhadiran/acca-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    row: {
                        ...representative,
                        nama: `${representative.nama} (Kolektif)`,
                        petugas_nama: petugasNama
                    },
                    letterType: 'IZIN'
                }),
            });
            const genJson = await genRes.json();
            Swal.close();

            if (genJson.isDuplicate) {
                const existing = genJson.data;
                const adminResult = await Swal.fire({
                    icon: 'info',
                    title: 'Surat Sudah Dicetak',
                    html: `Surat kolektif ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b><br/><br/>Pilih aksi:`,
                    showCancelButton: true,
                    showConfirmButton: true,
                    confirmButtonText: 'Unduh Berkas',
                    cancelButtonText: 'Hapus & Cetak Ulang',
                    confirmButtonColor: '#3083FF',
                    cancelButtonColor: '#dc2626',
                });

                if (adminResult.isConfirmed) {
                    const barcode = existing.barcode;
                    const scanBase = window.location.origin;
                    const scanUrl = `${scanBase}/ketidakhadiran/verify/${barcode}`;
                    const qrCodeUrl = `${scanBase}/api/qrcode?data=${encodeURIComponent(scanUrl)}`;

                    const data = {
                        ...formatDataForPrint(representative),
                        nomor_surat: existing.nomor_surat,
                        barcode: barcode,
                        list: groupRows.map((r, i) => ({ ...formatDataForPrint(r), no: i + 1 }))
                    };
                    const filename = `Surat_${type === 'TUGAS' ? 'Tugas' : 'Izin'}_Kolektif_${representative.kelas.replace(/\s+/g, '_')}.docx`;
                    generateFromTemplate(resolved.url, data, filename, qrCodeUrl);
                    return;
                }

                if (adminResult.dismiss === 'cancel') {
                    try {
                        Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        const delRes = await fetch(`/api/ketidakhadiran/acca-letter/${existing.id}`, { method: 'DELETE' });
                        const delJson = await delRes.json();
                        Swal.close();
                        if (!delJson.ok) throw new Error(delJson.error);

                        await Swal.fire({ title: 'Dihapus', text: 'Surat kolektif berhasil dihapus. Mencetak ulang...', icon: 'success', confirmButtonColor: '#3083FF', timer: 1500 });
                        await printGroupLetter(groupRows, representative, type);
                    } catch (e: any) {
                        await Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonColor: '#dc2626' });
                    }
                    return;
                }
                return;
            }

            if (!genJson.ok || !genJson.data) {
                await Swal.fire({ icon: 'error', title: 'Gagal', text: genJson.error || 'Gagal menyiapkan arsip surat kolektif.' });
                return;
            }

            const { barcode, nomor_surat } = genJson.data;
            const scanBase = window.location.origin;
            const scanUrl = `${scanBase}/ketidakhadiran/verify/${barcode}`;
            const qrCodeUrl = `${scanBase}/api/qrcode?data=${encodeURIComponent(scanUrl)}`;

            const data = {
                ...formatDataForPrint(representative),
                nomor_surat: nomor_surat,
                barcode: barcode,
                list: groupRows.map((r, i) => ({ ...formatDataForPrint(r), no: i + 1 }))
            };

            const filename = `Surat_${type === 'TUGAS' ? 'Tugas' : 'Izin'}_Kolektif_${representative.kelas.replace(/\s+/g, '_')}.docx`;
            await generateFromTemplate(resolved.url, data, filename, qrCodeUrl);
        } catch (err: any) {
            Swal.close();
            await Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    };

    // Surat Izin Meninggalkan Asrama ΓÇö KOLEKTIF: 1 surat untuk >1 siswa dengan
    // rentang tanggal & keperluan yang sama (groupRows didapat dari filter siblings di PrintModal)
    const printAkhirPekanGroup = async (groupRows: KetidakhadiranRow[], representative: KetidakhadiranRow, penandatangan?: { nama: string; jabatan: string }) => {
        Swal.fire({
            title: 'Memproses...',
            html: `Menghasilkan surat izin meninggalkan asrama kolektif (${groupRows.length} siswa)...`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        try {
            const genRes = await fetch('/api/ketidakhadiran/generate-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    letterType: 'MENINGGALKAN_ASRAMA',
                    rows: groupRows,
                    petugasNama: userName || 'Petugas UKS',
                    pejabatId: penandatangan?.nama || undefined,
                    pejabatJabatan: penandatangan?.jabatan || undefined,
                }),
            });
            const genJson = await genRes.json();
            Swal.close();

            if (genJson.alreadyPrinted) {
                const existing = genJson.data;
                if (isAdmin) {
                    const adminResult = await Swal.fire({
                        icon: 'info',
                        title: 'Surat Sudah Dicetak',
                        html: `Salah satu siswa dalam grup ini sudah pernah dicetak suratnya.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b>`,
                        showCancelButton: true,
                        confirmButtonText: 'Buka Dokumen',
                        cancelButtonText: 'Hapus & Cetak Ulang',
                        confirmButtonColor: '#3083FF',
                        cancelButtonColor: '#dc2626',
                    });
                    if (adminResult.isConfirmed) {
                        const targetUrl = existing?.file_url || (existing?.barcode ? `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(existing.barcode)}` : null);
                        if (targetUrl) {
                            openLetterFile(targetUrl, existing?.nomor_surat || 'Surat');
                        }
                        return;
                    }
                    if (adminResult.dismiss === 'cancel') {
                        try {
                            const delRes = await fetch(`/api/ketidakhadiran/acca-letter/${existing.id}`, { method: 'DELETE' });
                            const delJson = await delRes.json();
                            if (!delJson.ok) throw new Error(delJson.error);
                            await Swal.fire({ title: 'Dihapus', text: 'Surat berhasil dihapus. Mencetak ulang...', icon: 'success', confirmButtonColor: '#3083FF', timer: 1500 });
                            await printAkhirPekanGroup(groupRows, representative, penandatangan);
                        } catch (e: any) {
                            await Swal.fire({ title: 'Gagal', text: e.message, icon: 'error', confirmButtonColor: '#dc2626' });
                        }
                        return;
                    }
                } else {
                    await Swal.fire({ icon: 'info', title: 'Sudah Dicetak', html: `Surat ini sudah pernah dicetak.<br/><b>Nomor: ${existing?.nomor_surat || 'tidak diketahui'}</b>`, confirmButtonColor: '#3083FF' });
                }
                return;
            }

            if (!genJson.ok || !genJson.data) {
                await Swal.fire({ icon: 'error', title: 'Gagal', text: genJson.error || 'Gagal menghasilkan surat kolektif.' });
                return;
            }

            await showPrintSuccess('Surat Kolektif Berhasil Dicetak', genJson.data.file_url, genJson.data.html);
            if (representative._fromAsramaQueue) loadAsramaQueue();
        } catch (err: any) {
            Swal.close();
            await Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    };

    // Dispatcher untuk PrintModal.onPrintGroup ΓÇö MENINGGALKAN_ASRAMA pakai pipeline PDF (generate-letter),
    // IZIN/TUGAS pakai pipeline template DOCX (acca-letter)
    const handlePrintGroup = (groupRows: KetidakhadiranRow[], representative: KetidakhadiranRow, type: 'TUGAS' | 'IZIN' | 'MENINGGALKAN_ASRAMA', penandatangan?: { nama: string; jabatan: string }) => {
        if (type === 'MENINGGALKAN_ASRAMA') {
            return printAkhirPekanGroup(groupRows, representative, penandatangan);
        }
        return printGroupLetter(groupRows, representative, type);
    };

    const handleCetakRekap = async () => {
        // 1. Pilih jenis rekap berdasarkan akses
        let jenis = '';
        if (isAdmin || (canViewIzin && canViewSakit)) {
            const res = await Swal.fire({
                title: 'Pilih Jenis Rekap',
                text: 'Silakan pilih rekapitulasi yang ingin dicetak',
                showCancelButton: true,
                confirmButtonText: 'Izin',
                cancelButtonText: 'Sakit',
                confirmButtonColor: '#059669', // Izin color
                cancelButtonColor: '#dc2626',  // Sakit color
            });
            if (res.isConfirmed) {
                jenis = 'IZIN';
            } else if (res.dismiss === 'cancel') {
                jenis = 'SAKIT';
            } else {
                return;
            }
        } else if (canViewIzin) {
            jenis = 'IZIN';
        } else if (canViewSakit) {
            jenis = 'SAKIT';
        } else {
            return Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Anda tidak memiliki akses untuk mencetak rekap.' });
        }

        // 2. Pilih Bulan & Tahun
        // Calculate current academic year years
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        // simplified logic: show y-1, y, y+1
        const availableYears = [y - 1, y, y + 1];

        const html = `
            <div style="text-align: left; margin-top: 10px;">
                <label style="font-weight: 600; display: block; margin-bottom: 5px;">Pilih Bulan</label>
                <select id="swal-month" class="kh-pill-select" style="width: 100%; margin-bottom: 15px; height: 40px; padding: 0 10px; border-radius: 8px;">
                    ${monthNames.map((mn, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${mn}</option>`).join('')}
                </select>
                <label style="font-weight: 600; display: block; margin-bottom: 5px;">Pilih Tahun</label>
                <select id="swal-year" class="kh-pill-select" style="width: 100%; height: 40px; padding: 0 10px; border-radius: 8px;">
                    ${availableYears.map(yr => `<option value="${yr}" ${yr === y ? 'selected' : ''}>${yr}</option>`).join('')}
                </select>
            </div>
        `;

        const { value: formValues } = await Swal.fire({
            title: `Rekap ${jenis === 'IZIN' ? 'Izin' : 'Sakit'}`,
            html: html,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Cetak',
            cancelButtonText: 'Batal',
            preConfirm: () => {
                const mEl = document.getElementById('swal-month') as HTMLSelectElement;
                const yEl = document.getElementById('swal-year') as HTMLSelectElement;
                return [
                    parseInt(mEl.value),
                    parseInt(yEl.value)
                ];
            }
        });

        if (!formValues) return;
        const [month, year] = formValues;

        Swal.fire({
            title: 'Menyiapkan Rekap...',
            html: 'Memproses data dan mengonversi ke PDF...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const genRes = await fetch('/api/ketidakhadiran/generate-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    letterType: jenis === 'IZIN' ? 'REKAPAN_IZIN' : 'REKAPAN_SAKIT',
                    month,
                    year,
                    petugasNama: userName || 'Petugas'
                })
            });

            const genJson = await genRes.json();
            Swal.close();

            if (genJson.alreadyPrinted) {
                const existing = genJson.data;
                const confirmRes = await Swal.fire({
                    icon: 'info',
                    title: 'Rekap Sudah Dicetak',
                    html: `Rekap periode <b>${monthNames[month - 1]} ${year}</b> sudah ada.<br/><b>Nomor: ${existing?.nomor_surat || '-'}</b>`,
                    showCancelButton: true,
                    confirmButtonText: 'Buka File Lama',
                    cancelButtonText: 'Timpa & Cetak Ulang',
                    confirmButtonColor: '#3083FF',
                    cancelButtonColor: '#dc2626',
                });

                if (confirmRes.isConfirmed) {
                    const targetUrl = existing?.file_url || (existing?.barcode ? `/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(existing.barcode)}` : null);
                    if (targetUrl) {
                        openLetterFile(targetUrl, existing?.nomor_surat || 'Surat');
                    }
                    return;
                }
                
                if (confirmRes.dismiss === 'cancel') {
                    // Force reprint
                    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    const regenRes = await fetch('/api/ketidakhadiran/generate-letter', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            letterType: jenis === 'IZIN' ? 'REKAPAN_IZIN' : 'REKAPAN_SAKIT',
                            month,
                            year,
                            petugasNama: userName || 'Petugas',
                            forceReprint: true,
                            oldLetterId: existing?.id
                        })
                    });
                    const regenJson = await regenRes.json();
                    Swal.close();
                    if (!regenJson.ok) {
                        Swal.fire({ icon: 'error', title: 'Gagal', text: regenJson.error || 'Gagal mencetak ulang.' });
                        return;
                    }
                    await showPrintSuccess(`Rekap ${jenis === 'IZIN' ? 'Izin' : 'Sakit'} Berhasil`, regenJson.data.file_url, regenJson.data.html);
                    return;
                }
                return;
            }

            if (!genJson.ok) {
                Swal.fire({ icon: 'error', title: 'Gagal', text: genJson.error || 'Gagal menghasilkan rekap.' });
                return;
            }

            await showPrintSuccess(`Rekap ${jenis === 'IZIN' ? 'Izin' : 'Sakit'} Berhasil`, genJson.data.file_url, genJson.data.html);
        } catch (err: any) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    };

    // ========== MODAL HANDLERS ==========
    const openEditModal = (row: KetidakhadiranRow) => {
        // Entri berulang (dan entri kontinu bentuk LAMA yang belum diciutkan oleh
        // merge-ketidakhadiran-kontinu.js) tersimpan sebagai beberapa baris per
        // tanggal. Baris-baris satu seri dirangkai kembali jadi satu rentang utuh
        // supaya rentang & tipenya bisa diedit sebagai kesatuan. Entri kontinu
        // bentuk baru sudah satu baris, jadi lewat begitu saja di sini.
        if (row.seri_id) {
            const seri = rows
                .filter(r => r.seri_id === row.seri_id)
                .sort((a, b) => a.tgl_mulai.localeCompare(b.tgl_mulai));
            if (seri.length > 1) {
                const first = seri[0];
                const last = seri[seri.length - 1];
                setEditRow({
                    ...row,
                    tgl_mulai: first.tgl_mulai,
                    tgl_selesai: last.tgl_selesai,
                    waktu_mulai_real: first.waktu_mulai_real ?? row.waktu_mulai_real,
                    waktu_selesai_real: last.waktu_selesai_real ?? row.waktu_selesai_real,
                });
                setIsEditModalOpen(true);
                return;
            }
        }
        setEditRow(row);
        setIsEditModalOpen(true);
    };

    const openDeleteModal = (row: KetidakhadiranRow) => {
        setDeleteRow(row);
        setIsDeleteModalOpen(true);
    };

    const openViewModal = (row: KetidakhadiranRow) => {
        setViewRow(row);
        setIsViewModalOpen(true);
    };

    const allowedTypes = useMemo(() => ({
        IZIN: canManageIzin,
        SAKIT: canManageSakit
    }), [canManageIzin, canManageSakit]);

    return (
        <MaintenanceBanner pageKey="maintenance_ketidakhadiran" isAdmin={isAdmin}>
        <div className="kh-wrap">
            {typeof document !== 'undefined' && createPortal(
                <>
                    <AddModal
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSuccess={loadData}
                        canDo={canDo}
                        allowedTypes={allowedTypes}
                    />
                    {editRow && (
                        <EditModal
                            isOpen={isEditModalOpen}
                            onClose={() => setIsEditModalOpen(false)}
                            onSuccess={loadData}
                            data={editRow}
                            canDo={canDo}
                            isAdmin={isAdmin}
                            allowedTypes={allowedTypes}
                        />
                    )}
                    {deleteRow && (
                        <DeleteModal
                            isOpen={isDeleteModalOpen}
                            onClose={() => setIsDeleteModalOpen(false)}
                            onSuccess={loadData}
                            data={deleteRow}
                            canDo={canDo}
                            allowedTypes={allowedTypes}
                        />
                    )}
                    <PrintModal
                        isOpen={isPrintModalOpen}
                        onClose={() => setIsPrintModalOpen(false)}
                        data={printRow}
                        allRows={printAsramaOnly ? asramaQueueRows : rows}
                        onPrintSingle={printSingle}
                        onPrintGroup={handlePrintGroup}
                        asramaOnly={printAsramaOnly}
                    />
                    {isViewModalOpen && viewRow && (
                        <Modal size="md" onClose={() => setIsViewModalOpen(false)}>
                            <ModalHeader
                                title="Detail Tindakan & Tindak Lanjut"
                                subtitle="Data rekam medis ketidakhadiran sakit"
                                icon="eye-fill"
                                onClose={() => setIsViewModalOpen(false)}
                            />
                            <ModalBody>
                                <div className="vm-content">
                                    <div className="vm-info-card">
                                        <div className="vm-info-grid">
                                            <div className="vm-info-row">
                                                <div className="vm-info-icon"><i className="bi bi-person-badge-fill"></i></div>
                                                <div className="vm-info-data">
                                                    <span className="vm-info-label">Nama Siswa</span>
                                                    <span className="vm-info-value">{viewRow.nama}</span>
                                                </div>
                                            </div>
                                            <div className="vm-info-row">
                                                <div className="vm-info-icon"><i className="bi bi-hash"></i></div>
                                                <div className="vm-info-data">
                                                    <span className="vm-info-label">NISN</span>
                                                    <span className="vm-info-value vm-info-value--mono">{viewRow.nisn}</span>
                                                </div>
                                            </div>
                                            <div className="vm-info-row">
                                                <div className="vm-info-icon"><i className="bi bi-door-open-fill"></i></div>
                                                <div className="vm-info-data">
                                                    <span className="vm-info-label">Kelas</span>
                                                    <span className="vm-info-value">{viewRow.kelas}</span>
                                                </div>
                                            </div>
                                            <div className="vm-info-row">
                                                <div className="vm-info-icon"><i className="bi bi-calendar-event-fill"></i></div>
                                                <div className="vm-info-data">
                                                    <span className="vm-info-label">Periode</span>
                                                    <span className="vm-info-value">{formatDate(viewRow.tgl_mulai)} s.d. {formatDate(viewRow.tgl_selesai)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="vm-section vm-section--tindakan">
                                        <div className="vm-section-header">
                                            <div className="vm-section-icon vm-section-icon--tindakan">
                                                <i className="bi bi-bandaid-fill"></i>
                                            </div>
                                            <div className="vm-section-title">Tindakan Medik / Penanganan</div>
                                        </div>
                                        <div className="vm-section-content">
                                            {viewRow.tindakan ? (
                                                <p className="vm-text">{viewRow.tindakan}</p>
                                            ) : (
                                                <p className="vm-text vm-text--empty">
                                                    <i className="bi bi-dash-circle-dotted"></i>
                                                    Tidak ada catatan tindakan
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="vm-section vm-section--tindak-lanjut">
                                        <div className="vm-section-header">
                                            <div className="vm-section-icon vm-section-icon--tindak-lanjut">
                                                <i className="bi bi-arrow-right-circle-fill"></i>
                                            </div>
                                            <div className="vm-section-title">Rencana Tindak Lanjut</div>
                                        </div>
                                        <div className="vm-section-content">
                                            {viewRow.tindak_lanjut ? (
                                                <p className="vm-text">{viewRow.tindak_lanjut}</p>
                                            ) : (
                                                <p className="vm-text vm-text--empty">
                                                    <i className="bi bi-dash-circle-dotted"></i>
                                                    Tidak ada catatan tindak lanjut
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button type="button" variant="cancel" onClick={() => setIsViewModalOpen(false)} leftIcon={<i className="bi bi-x-lg" />}>
                                    Tutup
                                </Button>
                            </ModalFooter>
                        </Modal>
                    )}
                    <ImportModal 
                        isOpen={isImportModalOpen}
                        onClose={() => setIsImportModalOpen(false)}
                        onSuccess={loadData}
                    />
                </>,
                document.body
            )}
            <div className="kh-container">

                {/* ΓöÇΓöÇ HERO HEADER ΓöÇΓöÇ */}
                

                {/* ΓöÇΓöÇ TOP SECTION: KPIs + ACTIONS (4 Cards Layout) ΓöÇΓöÇ */}
                <div className={`kh-top-section ${canManageIzin ? 'kh-top-section--asrama' : ''}`}>
                    <div className="kh-kpis">
                        {/* Total */}
                        <div 
                            className={`kh-kpi ${!filterJenis && viewMode === 'LIST' ? 'is-active' : ''}`}
                            onClick={() => {
                                setFilterJenis('');
                                setFilterStatus('');
                                setViewMode('LIST');
                            }}
                        >
                            <div className="kh-kpi-icon kh-kpi-icon--total">
                                <i className="bi bi-bar-chart-fill"></i>
                            </div>
                            <div className="kh-kpi-body">
                                <div className="kh-kpi-label">Semua</div>
                                <div className="kh-kpi-value">{kpi.total}</div>
                            </div>
                        </div>

                        {/* Izin */}
                        <div 
                            className={`kh-kpi ${filterJenis === 'IZIN' ? 'is-active' : ''}`}
                            onClick={() => {
                                setFilterJenis('IZIN');
                                setFilterStatus('');
                                setViewMode('LIST');
                            }}
                        >
                            <div className="kh-kpi-icon kh-kpi-icon--izin">
                                <i className="bi bi-envelope-open-fill"></i>
                            </div>
                            <div className="kh-kpi-body">
                                <div className="kh-kpi-label">Izin</div>
                                <div className="kh-kpi-value">{kpi.izin}</div>
                                <div className="kh-kpi-sub" style={{ gap: '8px', display: 'flex', justifyContent: 'center' }}>
                                    <div><span style={{ fontSize: '0.75rem' }}>M</span>: <span>{kpi.madrasah}</span></div>
                                    <div><span style={{ fontSize: '0.75rem' }}>P</span>: <span>{kpi.personal}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Sakit */}
                        <div 
                            className={`kh-kpi ${viewMode === 'REKAM_MEDIK' ? 'is-active' : ''}`}
                            onClick={() => {
                                setFilterJenis('SAKIT');
                                setFilterStatus('');
                                setViewMode('REKAM_MEDIK');
                            }}
                        >
                            <div className="kh-kpi-icon kh-kpi-icon--sakit">
                                <i className="bi bi-heart-pulse-fill"></i>
                            </div>
                            <div className="kh-kpi-body">
                                <div className="kh-kpi-label">Sakit</div>
                                <div className="kh-kpi-value">{kpi.sakit}</div>
                                <div className="kh-kpi-sub" style={{ gap: '6px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <div><span style={{ fontSize: '0.75rem' }}>R</span>: <span>{kpi.ringan}</span></div>
                                    <div><span style={{ fontSize: '0.75rem' }}>S</span>: <span>{kpi.sedang}</span></div>
                                    <div><span style={{ fontSize: '0.75rem' }}>B</span>: <span>{kpi.berat}</span></div>
                                    <div><span style={{ fontSize: '0.75rem' }}>K</span>: <span>{kpi.kontrol}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Antrean Keluar Asrama (SAKIT Sedang/Berat/Kontrol) ΓÇö khusus OP_IZIN/ADMIN */}
                        {canManageIzin && (
                            <div
                                className={`kh-kpi ${viewMode === 'ASRAMA_QUEUE' ? 'is-active' : ''}`}
                                onClick={() => { setFilterStatus(''); setViewMode('ASRAMA_QUEUE'); }}
                            >
                                <div className="kh-kpi-icon kh-kpi-icon--izin">
                                    <i className="bi bi-heart-pulse-fill"></i>
                                </div>
                                <div className="kh-kpi-body">
                                    <div className="kh-kpi-label">Keluar Asrama</div>
                                    <div className="kh-kpi-value">{asramaQueueRows.length}</div>
                                    <div className="kh-kpi-sub" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                        <span title="Telah Terbit"><i className="bi bi-check-circle-fill" style={{ color: '#15803d' }}></i> {asramaQueueRows.filter(r => r.letter_issued).length}</span>
                                        <span title="Menunggu"><i className="bi bi-clock-fill" style={{ color: '#f59e0b' }}></i> {asramaQueueRows.filter(r => !r.letter_issued).length}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ΓöÇΓöÇ FILTER TOOLBAR ΓöÇΓöÇ */}
                <FilterToolbar actionsInline>
                    <FilterSelect
                        label="Kelas"
                        value={filterKelas}
                        onChange={setFilterKelas}
                        options={[
                            { value: '', label: 'Semua Kelas' },
                            ...availableClasses.map(c => ({ value: c, label: c }))
                        ]}
                    />

                    {viewMode !== 'ASRAMA_QUEUE' && !filterJenis ? (
                        <FilterSelect
                            label="Jenis"
                            value={filterJenis}
                            onChange={(val) => { setFilterJenis(val); setFilterStatus(''); }}
                            disabled={!(isAdmin || (canViewIzin && canViewSakit))}
                        >
                            {(isAdmin || (canViewIzin && canViewSakit)) && <option value="">Semua</option>}
                            {(isAdmin || canViewIzin) && <option value="IZIN">IZIN</option>}
                            {(isAdmin || canViewSakit) && <option value="SAKIT">SAKIT</option>}
                        </FilterSelect>
                    ) : (
                        <FilterSelect
                            label="Status"
                            value={filterStatus}
                            onChange={setFilterStatus}
                        >
                            <option value="">Semua Status</option>
                            {viewMode === 'ASRAMA_QUEUE' && (
                                <>
                                    <option value="Sedang">Sedang</option>
                                    <option value="Berat">Berat</option>
                                    <option value="Kontrol">Kontrol</option>
                                </>
                            )}
                            {viewMode !== 'ASRAMA_QUEUE' && filterJenis === 'IZIN' && (
                                <>
                                    <option value="MADRASAH">Madrasah</option>
                                    <option value="PERSONAL">Personal</option>
                                </>
                            )}
                            {viewMode !== 'ASRAMA_QUEUE' && filterJenis === 'SAKIT' && (
                                <>
                                    <option value="Ringan">Ringan</option>
                                    <option value="Sedang">Sedang</option>
                                    <option value="Berat">Berat</option>
                                    <option value="Kontrol">Kontrol</option>
                                </>
                            )}
                        </FilterSelect>
                    )}

                    <FilterMonthSelect selectedMonths={filterMonths} onChange={setFilterMonths} />

                    <FilterSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="NISN, Nama, atau Kelas..."
                        label="Cari Siswa"
                    />

                    <FilterActions>
                        {/* Pemicu Titik 3 Mobile */}
                        <div className="sk__menuWrap" ref={actionMenuRef}>
                            <button
                                type="button"
                                className={`sk__btnActionMenu ftb-btn--iconOnlyMobile ${showActionMenu ? 'isOpen' : ''}`}
                                onClick={() => setShowActionMenu(v => !v)}
                                title="Menu Aksi"
                                aria-label="Menu Aksi"
                                aria-haspopup="menu"
                                aria-expanded={showActionMenu}
                            >
                                <i className="bi bi-three-dots" />
                                <span className="ftb-btn-label">Aksi</span>
                            </button>

                            {showActionMenu && (
                                <div className="sk__menu" role="menu">

                                    {(canManageIzin || canManageSakit) && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem"
                                            onClick={() => {
                                                setShowActionMenu(false);
                                                handleCetakRekap();
                                            }}
                                        >
                                            <span className="sk__menuIcon"><i className="bi bi-printer-fill" style={{ color: '#059669' }} /></span>
                                            <span className="sk__menuLabel">Rekap</span>
                                        </button>
                                    )}

                                    {(canManageIzin || canManageSakit) && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem"
                                            onClick={() => {
                                                setShowActionMenu(false);
                                                handleKirimInfo();
                                            }}
                                        >
                                            <span className="sk__menuIcon"><i className="bi bi-whatsapp" style={{ color: '#25D366' }} /></span>
                                            <span className="sk__menuLabel">Kirim Info WA</span>
                                        </button>
                                    )}

                                    {isAdmin && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className="sk__menuItem"
                                            onClick={() => {
                                                setShowActionMenu(false);
                                                setIsImportModalOpen(true);
                                            }}
                                        >
                                            <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel-fill" style={{ color: '#f97316' }} /></span>
                                            <span className="sk__menuLabel">Import</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="sk__menuItem"
                                        onClick={() => {
                                            setShowActionMenu(false);
                                            handleExport();
                                        }}
                                        disabled={!canExportIzin && !canExportSakit}
                                    >
                                        <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#3b82f6' }} /></span>
                                        <span className="sk__menuLabel">Export</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tombol-tombol Desktop Only */}
                        {(canManageIzin || canManageSakit) && (
                            <Button
                                variant="outline"
                                onClick={handleCetakRekap}
                                icon="print"
                                className="sk__btnDesktopOnly"
                            >
                                Rekap
                            </Button>
                        )}
                        {(canManageIzin || canManageSakit) && (
                            <Button
                                variant="outline"
                                onClick={handleKirimInfo}
                                icon="whatsapp"
                                className="sk__btnDesktopOnly"
                            >
                                Kirim Info
                            </Button>
                        )}
                        {isAdmin && (
                            <Button 
                                variant="outline" 
                                onClick={() => setIsImportModalOpen(true)}
                                icon="import"
                                className="sk__btnDesktopOnly"
                            >
                                Import
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            onClick={handleExport} 
                            disabled={!canExportIzin && !canExportSakit}
                            icon="export"
                            className="sk__btnDesktopOnly"
                        >
                            Export
                        </Button>
                    </FilterActions>
                </FilterToolbar>

                {/* Removed tabs as requested */}

                {viewMode !== 'ASRAMA_QUEUE' && (<>
                {/* ΓöÇΓöÇ TABLE CARD ΓöÇΓöÇ */}
                <div className="kh-table-wrap">
                    <div className="kh-table-inner">
                    <table className="kh-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                                <th>Jenis / Status</th>
                                <th>Nama / NISN / Kelas</th>
                                <th style={{ minWidth: viewMode === 'REKAM_MEDIK' ? '280px' : '220px' }}>
                                    {viewMode === 'REKAM_MEDIK' ? 'Informasi Klinis' : 'Periode / Keterangan'}
                                </th>
                                <th style={{ textAlign: 'right', width: '180px', minWidth: '180px' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Loading skeleton */}
                            {loading && (
                                <>
                                    {[...Array(5)].map((_, i) => (
                                        <tr key={`sk-${i}`} className="kh-loading-row">
                                            <td><div className="kh-skeleton" style={{ width: '24px' }}></div></td>
                                            <td><div className="kh-skeleton" style={{ width: '52px' }}></div></td>
                                            <td><div className="kh-skeleton"></div></td>
                                            <td><div className="kh-skeleton"></div></td>
                                            <td><div className="kh-skeleton" style={{ width: '100px', marginLeft: 'auto' }}></div></td>
                                        </tr>
                                    ))}
                                </>
                            )}

                            {/* Empty state */}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="kh-empty">
                                            <div className="kh-empty-icon">
                                                <i className="bi bi-clipboard-x"></i>
                                            </div>
                                            <div className="kh-empty-title">
                                                {!canViewIzin && !canViewSakit
                                                    ? 'Akses Dibatasi'
                                                    : 'Belum Ada Data'}
                                            </div>
                                            <div className="kh-empty-text">
                                                {!canViewIzin && !canViewSakit
                                                    ? 'Anda tidak memiliki hak akses untuk melihat data ini.'
                                                    : 'Tambahkan data ketidakhadiran dengan tombol Tambah di atas.'}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {/* Data rows */}
                            {!loading && filteredRows.map((row, idx) => (
                                <tr key={row.id}>
                                    <td data-label="No." style={{ textAlign: 'center', color: 'var(--kh-text-muted)', fontWeight: 700, fontSize: '0.8rem' }}>
                                        {(page - 1) * pageSize + idx + 1}
                                    </td>
                                    {/* Jenis (icon only) + Status ΓÇö 1 baris */}
                                    <td data-label="Jenis / Status" style={{ verticalAlign: 'middle', padding: '8px 10px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span className={`pill pill-${row.jenis.toLowerCase()}`} title={row.jenis === 'IZIN' ? 'Izin' : 'Sakit'}>
                                                {row.jenis === 'IZIN' ? (
                                                    <i className="bi bi-envelope-open"></i>
                                                ) : (
                                                    <i className="bi bi-heart-pulse"></i>
                                                )}
                                            </span>
                                            <span className={`pill pill-status pill-${row.status.toLowerCase()}`}>
                                                {row.status === 'MADRASAH' ? 'Madrasah'
                                                    : row.status === 'PERSONAL' ? 'Personal'
                                                    : row.status}
                                            </span>
                                            {row.has_overlap && (
                                                <span className="pill pill-overlap" title="Berkas tumpang tindih">
                                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Nama + NISN + Kelas ΓÇö 3 rows */}
                                    <td data-label="Nama / NISN / Kelas">
                                        <div className="kh-cell-stack">
                                            <span className="kh-cell-main">{row.nama}</span>
                                            <span className="kh-cell-sub kh-cell-mono">{row.nisn} • {row.kelas}</span>
                                        </div>
                                    </td>
                                    {/* Periode + Keterangan ΓÇö 2 baris */}
                                    <td data-label="Periode / Keterangan">
                                        <div className="kh-cell-stack">
                                            <div className="kh-periode-baris">
                                                {row.is_kontinu && !isSatuTanggal(row) ? (
                                                    renderBatasKontinu(row)
                                                ) : (
                                                    <>
                                                        <span className="kh-cell-main" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                            {formatRentangTanggal(row)}
                                                        </span>
                                                        <span style={{ color: 'var(--kh-text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>/</span>
                                                        {isEntryTimeSpecific(row) ? (
                                                            <span className="kh-cell-sub text-blue-700 dark:text-blue-400" style={{ fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                                                                {formatEntryWaktu(row)} WITA
                                                            </span>
                                                        ) : (
                                                            <span className="kh-cell-sub text-green-600 dark:text-green-400" style={{ fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                                                                SEMUA JAM
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <span className="kh-cell-sub" style={{ whiteSpace: 'normal', fontSize: '0.82rem', lineHeight: 1.4, marginTop: '2px' }}>
                                                {row.keterangan || '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td data-label="Aksi" className="kh-td-actions">
                                        <ActionGroup>
                                            {row.file_url && (
                                                <ActionButton action="file" onClick={() => openFile(row.file_url, `${row.jenis} - ${row.nama}`)} />
                                            )}
                                            {row.jenis === 'SAKIT' && (row.tindakan || row.tindak_lanjut) && (
                                                <ActionButton action="view" onClick={() => openViewModal(row)} title="Lihat Tindakan & Tindak Lanjut" />
                                            )}
                                            <ActionButton action="print" onClick={() => handlePrintSingle(row)} />
                                            {((row.jenis === 'IZIN' && canManageIzin) || (row.jenis === 'SAKIT' && canManageSakit)) && (
                                                <>
                                                    <ActionButton action="edit" onClick={() => openEditModal(row)} />
                                                    <ActionButton action="delete" onClick={() => openDeleteModal(row)} />
                                                </>
                                            )}
                                        </ActionGroup>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>{/* /kh-table-inner */}
                </div>

                {/* ΓöÇΓöÇ MOBILE CARD VIEW ΓöÇΓöÇ */}
                <div className="kh-card-list">
                    {/* Daftar mobile memakai pola .mui-* yang sama dengan halaman
                        Kehadiran Siswa: satu baris = foto + nama, dengan kelas,
                        status, dan waktu sebagai baris kedua. Sisa field (NISN,
                        periode, keterangan, tindakan) beserta seluruh aksinya
                        pindah ke MobileSheet saat baris diketuk ΓÇö kartu lama
                        menampung semuanya sekaligus sehingga satu baris data
                        memakan hampir setinggi layar. */}
                    {!loading && filteredRows.length > 0 && (
                        <MobileList label="Daftar ketidakhadiran">
                            {filteredRows.map((row) => (
                                <MobileListItem
                                    key={row.id}
                                    title={row.nama}
                                    // Rona avatar dikunci ke NISN, bukan nama: ejaan
                                    // nama bisa diperbaiki, NISN-nya tidak berubah.
                                    seed={row.nisn}
                                    avatarSrc={row.foto_profil ? getProxiedImageUrl(row.foto_profil) : (fotoMap[row.nisn] || null)}
                                    subtitle={`${row.kelas} • ${labelStatus(row)} • ${labelWaktu(row)}`}
                                    // Pil berlabel, memakai kelas .pill-* yang sama
                                    // dengan sisa halaman ini supaya penanda jenis
                                    // berbicara dengan bahasa visual yang sama di
                                    // tabel desktop maupun daftar mobile.
                                    badge={
                                        <span className={`pill pill-${row.jenis.toLowerCase()}`}>
                                            {row.jenis === 'IZIN' ? 'Izin' : 'Sakit'}
                                        </span>
                                    }
                                    onClick={() => setSheetRow(row)}
                                />
                            ))}
                        </MobileList>
                    )}

                    {/* Mobile empty state */}
                    {!loading && rows.length === 0 && (
                        <div className="kh-empty">
                            <div className="kh-empty-icon"><i className="bi bi-clipboard-x"></i></div>
                            <div className="kh-empty-title">
                                {!canViewIzin && !canViewSakit ? 'Akses Dibatasi' : 'Belum Ada Data'}
                            </div>
                            <div className="kh-empty-text">
                                {!canViewIzin && !canViewSakit
                                    ? 'Anda tidak memiliki hak akses untuk melihat data ini.'
                                    : 'Tambahkan data ketidakhadiran dengan tombol Tambah di atas.'}
                            </div>
                        </div>
                    )}
                </div>

                {/* ΓöÇΓöÇ FOOTER WITH PAGINATION (Shared Below Table & Cards) ΓöÇΓöÇ */}
                {!loading && rows.length > 0 && (
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        limit={pageSize}
                        totalItems={totalRows}
                        itemLabel="data"
                        onPageChange={setPage}
                        onLimitChange={(newLimit) => {
                            setPageSize(newLimit);
                            setPage(1);
                        }}
                    />
                )}
                </>)}

                {/* ΓöÇΓöÇ SHEET DETAIL (mobile) ΓöÇΓöÇ
                    Field yang tidak muat di baris daftar + seluruh aksinya.
                    Aksi ditaruh di footer sticky sheet, bukan di baris daftar:
                    empat tombol ikon di tiap baris membuat daftar sulit dipindai
                    dan target sentuhnya berdesakan. */}
                {sheetRow && (
                    <MobileSheet
                        title={sheetRow.nama}
                        subtitle={`${sheetRow.kelas} • ${sheetRow.nisn}`}
                        leading={
                            <MobileAvatar
                                name={sheetRow.nama}
                                seed={sheetRow.nisn}
                                src={sheetRow.foto_profil ? getProxiedImageUrl(sheetRow.foto_profil) : (fotoMap[sheetRow.nisn] || null)}
                            />
                        }
                        onClose={() => setSheetRow(null)}
                        // Satu baris aksi memakai <Button> bersama (components/ui/Button),
                        // bukan ActionButton ikon-saja maupun .mui-btn lokal.
                        // ActionButton dirancang untuk sel tabel desktop tempat ikon
                        // berbaris rapat dan artinya jelas dari kolomnya; di dasar
                        // sheet ia jadi kotak-kotak kecil tanpa keterangan padahal
                        // ruangnya lebar. Keempat label muat di 375px (sudah diukur).
                        footer={
                            <>
                                {sheetRow.file_url && (
                                    <Button
                                        variant="secondary"
                                        icon="paperclip"
                                        onClick={() => openFile(sheetRow.file_url!, `${sheetRow.jenis} - ${sheetRow.nama}`)}
                                    >
                                        Berkas
                                    </Button>
                                )}
                                {/* Sengaja TANPA tombol "lihat detail": sheet ini SUDAH
                                    detailnya. Tindakan & tindak lanjut ditampilkan
                                    langsung di atas, jadi tombol itu hanya akan membuka
                                    modal berisi hal yang sama persis. Modal tersebut
                                    tetap dipakai baris tabel di desktop, yang memang
                                    tidak menampilkan kedua field itu. */}
                                <Button
                                    variant="secondary"
                                    icon="print"
                                    onClick={() => handlePrintSingle(sheetRow)}
                                >
                                    Cetak
                                </Button>
                                {((sheetRow.jenis === 'IZIN' && canManageIzin) || (sheetRow.jenis === 'SAKIT' && canManageSakit)) && (
                                    <>
                                        {/* leftIcon, bukan icon="edit": preset `edit`
                                            memaksa ikonnya biru #3083FF, yang hilang di
                                            atas latar biru varian primary. */}
                                        <Button
                                            variant="primary"
                                            leftIcon={<i className="bi bi-pencil-fill" />}
                                            onClick={() => { const r = sheetRow; setSheetRow(null); openEditModal(r); }}
                                        >
                                            Ubah
                                        </Button>
                                        <Button
                                            variant="danger"
                                            icon="delete"
                                            onClick={() => { const r = sheetRow; setSheetRow(null); openDeleteModal(r); }}
                                        >
                                            Hapus
                                        </Button>
                                    </>
                                )}
                            </>
                        }
                    >
                        <MobileKV label="Jenis">
                            {sheetRow.jenis === 'IZIN' ? 'Izin' : 'Sakit'} • {labelStatus(sheetRow)}
                            {sheetRow.has_overlap && (
                                <span className="pill pill-overlap" title="Berkas tumpang tindih" style={{ marginLeft: 6 }}>
                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                </span>
                            )}
                        </MobileKV>
                        <MobileKV label="NISN" mono>{sheetRow.nisn}</MobileKV>
                        <MobileKV label="Periode">
                            {sheetRow.is_kontinu && !isSatuTanggal(sheetRow)
                                ? renderBatasKontinu(sheetRow)
                                : formatRentangTanggal(sheetRow)}
                        </MobileKV>
                        {!(sheetRow.is_kontinu && !isSatuTanggal(sheetRow)) && (
                            <MobileKV label="Jam">
                                {isEntryTimeSpecific(sheetRow)
                                    ? `${formatEntryWaktu(sheetRow)} WITA`
                                    : 'Semua Jam'}
                            </MobileKV>
                        )}
                        {sheetRow.keterangan && (
                            <MobileKV label="Keterangan">{sheetRow.keterangan}</MobileKV>
                        )}
                        {sheetRow.tindakan && (
                            <MobileKV label="Tindakan">{sheetRow.tindakan}</MobileKV>
                        )}
                        {sheetRow.tindak_lanjut && (
                            <MobileKV label="Tindak Lanjut">{sheetRow.tindak_lanjut}</MobileKV>
                        )}
                    </MobileSheet>
                )}

                {/* ΓöÇΓöÇ ANTREAN KELUAR ASRAMA (SAKIT via OP Izin) ΓöÇΓöÇ */}
                {viewMode === 'ASRAMA_QUEUE' && (
                    <>
                    <div className="kh-table-wrap">
                        <div className="kh-table-inner">
                            <table className="kh-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                                        <th>Status Sakit</th>
                                        <th>Nama / NISN / Kelas</th>
                                        <th>Periode / Keterangan</th>
                                        <th style={{ textAlign: 'right' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {asramaQueueLoading && (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Memuat data...</td></tr>
                                    )}
                                    {!asramaQueueLoading && asramaQueueRows.length === 0 && (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Belum ada siswa SAKIT (Sedang/Berat/Kontrol) yang perlu Surat Izin Meninggalkan Asrama.</td></tr>
                                    )}
                                    {!asramaQueueLoading && asramaQueueRows.map((row, idx) => (
                                        <tr key={row.id}>
                                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                            <td><span className={`pill pill-status pill-${row.status.toLowerCase()}`}>{row.status}</span></td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: 'var(--kh-text-primary, var(--n-ink))' }}>{row.nama}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>{row.nisn} • {row.kelas}</div>
                                            </td>
                                            <td>
                                                <div>{formatDate(row.tgl_mulai)} s.d. {formatDate(row.tgl_selesai)}</div>
                                                {row.keterangan && <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>{row.keterangan}</div>}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {row.letter_issued ? (
                                                    <span
                                                        title={row.letter_nomor || ''}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#15803d', background: '#f0fdf4', padding: '6px 10px', borderRadius: '8px' }}
                                                    >
                                                        <i className="bi bi-check-circle-fill"></i> Diterbitkan
                                                    </span>
                                                ) : !row.rekom_kontrol_issued ? (
                                                    <span
                                                        title="UKS belum menerbitkan Surat Rekomendasi untuk siswa ini"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                                                    >
                                                        <i className="bi bi-hourglass-split"></i> Menunggu Rekomendasi
                                                    </span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() => handlePrintAsrama(row)}
                                                        title="Cetak Surat Izin Meninggalkan Asrama"
                                                        leftIcon={<i className="bi bi-printer-fill"></i>}
                                                    >
                                                        Cetak
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile empty state for ASRAMA_QUEUE */}
                    {!asramaQueueLoading && asramaQueueRows.length === 0 && (
                        <div className="kh-empty" style={{ display: 'none' }}>
                            {/* Handled by table on desktop, but we add a mobile-only empty state class via CSS if we wanted to hide table on mobile. Actually let's just make the mobile view. */}
                        </div>
                    )}

                    {/* Mobile list view for ASRAMA_QUEUE */}
                    <div className="kh-card-list">
                        {asramaQueueLoading && (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--n-muted)' }}>Memuat data...</div>
                        )}
                        {!asramaQueueLoading && asramaQueueRows.length === 0 && (
                            <div className="kh-empty">
                                <div className="kh-empty-icon"><i className="bi bi-clipboard-x"></i></div>
                                <div className="kh-empty-title">Belum Ada Data</div>
                                <div className="kh-empty-text">Belum ada siswa SAKIT (Sedang/Berat/Kontrol) yang perlu Surat Izin Meninggalkan Asrama.</div>
                            </div>
                        )}
                        {!asramaQueueLoading && asramaQueueRows.map(row => (
                            <div key={row.id} className="kh-card">
                                {/* Header */}
                                <div className="kh-card-header">
                                    <div className="kh-card-title-area">
                                        <div>
                                            <div className="kh-card-name">{row.nama}</div>
                                            <div className="kh-card-nisn">{row.nisn}</div>
                                        </div>
                                    </div>
                                    <span className={`pill pill-status pill-${row.status.toLowerCase()}`}>{row.status}</span>
                                </div>

                                {/* Base Info */}
                                <div className="kh-card-info">
                                    <div className="kh-card-row">
                                        <span className="kh-card-label">Kelas</span>
                                        <span className="kh-card-value kh-card-subtext">{row.kelas}</span>
                                    </div>
                                    <div className="kh-card-row">
                                        <span className="kh-card-label">Periode</span>
                                        <span className="kh-card-value">
                                            {formatDate(row.tgl_mulai)} s.d. {formatDate(row.tgl_selesai)}
                                        </span>
                                    </div>
                                </div>

                                {/* Keterangan */}
                                {row.keterangan && (
                                    <div className="kh-card-keterangan">{row.keterangan}</div>
                                )}
                                
                                {/* Aksi */}
                                <div className="kh-card-info" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--n-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        {row.letter_issued ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#15803d', background: '#f0fdf4', padding: '6px 10px', borderRadius: '8px' }}>
                                                <i className="bi bi-check-circle-fill"></i> Diterbitkan
                                            </span>
                                        ) : !row.rekom_kontrol_issued ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                                                <i className="bi bi-hourglass-split"></i> Menunggu Rekomendasi
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => handlePrintAsrama(row)}
                                                leftIcon={<i className="bi bi-printer-fill"></i>}
                                            >
                                                Cetak Surat
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}

                {/* Transparent dropdown backdrop blocker to close the menu when clicking outside */}
                {isFabOpen && (
                    <div
                        className="kh-dropdown-backdrop"
                        onClick={() => setIsFabOpen(false)}
                    />
                )}

                {viewer}

                {(canManageIzin || canManageSakit) && (
                    <>
                        <DesktopFab
                            label="Tambah Ketidakhadiran"
                            mobileLabel="Tambah"
                            icon="plus-lg"
                            onClick={() => setIsAddModalOpen(true)}
                        />
                        <MobileFab
                            label="Tambah"
                            icon="plus-lg"
                            onClick={() => setIsAddModalOpen(true)}
                        />
                    </>
                )}

            </div>
        </div>
        </MaintenanceBanner>

        );
}
