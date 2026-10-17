'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { TimeField } from '@/components/ui/TimeField';
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { swalSuccess, swalError, swalWarning, swalConfirm } from '@/lib/swal-premium';
import { useModalBlur } from '@/components/ModalBlurProvider';
import type { User } from '@/lib/types';
import { useTimezone } from '@/hooks/use-timezone';
import { SASARAN_AGENDA, sasaranAgenda, fetchAgendaList, formatWaktuAgenda } from '@/lib/agenda';
import SasaranAgenda from '../components/SasaranAgenda';
import { getCurrentAcademicYear, getAcademicYearFromDate, getSemesterFromDate } from '@/lib/date-utils';

interface AgendaFoto {
    url: string;
    caption: string | null;
    tanggal?: string | null;
}

interface Agenda {
    id: number | string;
    judul: string;
    deskripsi: string | null;
    tanggal_mulai: string;
    tanggal_selesai: string | null;
    waktu_mulai: string | null;
    waktu_selesai: string | null;
    lokasi: string | null;
    kategori: string;
    warna: string;
    is_publik: boolean;
    skip_hari_libur: boolean;
    sasaran?: string[];
    foto?: AgendaFoto[] | null;
    created_at: string;
}

const MAX_FOTO = 10;

/** Kompres gambar di browser: resize maks 1600px & konversi ke JPEG agar upload ringan */
async function compressImage(file: File): Promise<File> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size < 500 * 1024) return file;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        if (!blob || blob.size >= file.size) return file;
        const baseName = file.name.replace(/\.[^.]+$/, '');
        return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

interface Category {
    id: number | string;
    nama: string;
    color: string;
    icon: string;
}

const DEFAULT_CATEGORY: Category = { id: 0, nama: 'Umum', color: '#3083FF', icon: 'bi-calendar-event' };

function getKategoriStyle(kategori: string, categories: Category[]) {
    return categories.find(k => k.nama === kategori) || DEFAULT_CATEGORY;
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(startStr: string | null, endStr?: string | null) {
    if (!startStr) return '-';
    if (!endStr || endStr === startStr) return formatDate(startStr);

    const d1 = new Date(startStr + 'T00:00:00');
    const d2 = new Date(endStr + 'T00:00:00');
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return formatDate(startStr);

    const m1 = d1.toLocaleDateString('id-ID', { month: 'short' });
    const m2 = d2.toLocaleDateString('id-ID', { month: 'short' });
    const y1 = d1.getFullYear();
    const y2 = d2.getFullYear();

    if (y1 === y2 && m1 === m2) {
        return `${d1.getDate()} – ${d2.getDate()} ${m1} ${y1}`;
    } else if (y1 === y2) {
        return `${d1.getDate()} ${m1} – ${d2.getDate()} ${m2} ${y1}`;
    }
    return `${formatDate(startStr)} – ${formatDate(endStr)}`;
}

const EMPTY_FORM = {
    judul: '', deskripsi: '', tanggal_mulai: '', tanggal_selesai: '',
    waktu_mulai: '', waktu_selesai: '', lokasi: '', kategori: 'Umum',
    warna: '#3083FF', is_publik: true, skip_hari_libur: false, sasaran: ['UMUM'] as string[],
};

export interface KelolaAgendaTabProps {
    user?: User | null;
    onBack?: () => void;
    headerTabs?: React.ReactNode;
    canManage: boolean;
}

export default function KelolaAgendaTab({ user, onBack, headerTabs, canManage }: KelolaAgendaTabProps) {

    const { getCurrentDate } = useTimezone();
    const today = getCurrentDate();

    const [agendas, setAgendas] = useState<Agenda[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [filterKategori, setFilterKategori] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // State for three dots menu on agenda cards
    const [openCardMenu, setOpenCardMenu] = useState<number | string | null>(null);
    useEffect(() => {
        if (!openCardMenu) return;
        const onPointerDown = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.pm-card-menu-wrap')) setOpenCardMenu(null);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [openCardMenu]);

    // Academic Filters
    const [academicYears, setAcademicYears] = useState<string[]>([]);
    const [filterTahunAjaran, setFilterTahunAjaran] = useState<string>('');
    const [filterSemester, setFilterSemester] = useState<'Semua' | 'Ganjil' | 'Genap'>('Semua');

    const [showModal, setShowModal] = useState(false);
    const [showCatModal, setShowCatModal] = useState(false);
    const [editingId, setEditingId] = useState<number | string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);

    // Foto dokumentasi: foto tersimpan (sudah di storage) + file baru (belum diupload)
    const [existingFoto, setExistingFoto] = useState<AgendaFoto[]>([]);
    const [newFoto, setNewFoto] = useState<{ file: File; preview: string; caption: string; tanggal: string }[]>([]);
    const totalFoto = existingFoto.length + newFoto.length;
    const [fotoDragging, setFotoDragging] = useState(false);

    const { registerModal } = useModalBlur();

    useEffect(() => {
        if (showModal || showCatModal) {
            return registerModal();
        }
    }, [showModal, showCatModal, registerModal]);

    // Category Management State
    const [catForm, setCatForm] = useState<{ id: number | string | null; nama: string; color: string; icon: string }>({ id: null, nama: '', color: '#3083FF', icon: 'bi-calendar-event' });
    const [savingCat, setSavingCat] = useState(false);

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/agenda-madrasah/kategori');
            const json = await res.json();
            setCategories(json.data || []);
        } catch {
            console.error('Gagal memuat kategori');
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            setAgendas(await fetchAgendaList());
            setLoadError(null);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Gagal memuat data agenda.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        async function loadAcademicData() {
            try {
                const { getAllActiveAcademicYears } = await import('@/lib/settings-client');
                const activePeriods = await getAllActiveAcademicYears();
                const activeYears = Array.from(new Set(activePeriods.map(p => p.tahun_ajaran)));
                setAcademicYears(activeYears.length > 0 ? activeYears : [getCurrentAcademicYear()]);
            } catch (err) {
                console.error('Gagal memuat data akademis:', err);
            }
        }
        
        loadAcademicData();
        fetchData();
        fetchCategories();
    }, [fetchData]);

    const resetFotoState = () => {
        newFoto.forEach(f => URL.revokeObjectURL(f.preview));
        setNewFoto([]);
        setExistingFoto([]);
    };

    const openAdd = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        resetFotoState();
        setShowModal(true);
    };

    const openEdit = (a: Agenda) => {
        setEditingId(a.id);
        setForm({
            judul: a.judul, deskripsi: a.deskripsi || '', tanggal_mulai: a.tanggal_mulai,
            tanggal_selesai: a.tanggal_selesai || '', waktu_mulai: a.waktu_mulai?.slice(0, 5) || '',
            waktu_selesai: a.waktu_selesai?.slice(0, 5) || '', lokasi: a.lokasi || '',
            kategori: a.kategori, warna: a.warna, is_publik: a.is_publik,
            skip_hari_libur: a.skip_hari_libur || false,
            sasaran: sasaranAgenda(a.sasaran),
        });
        resetFotoState();
        setExistingFoto(Array.isArray(a.foto) ? a.foto : []);
        setShowModal(true);
    };

    const addFoto = (files: File[]) => {
        if (files.length === 0) return;

        const slots = MAX_FOTO - totalFoto;
        if (files.length > slots) {
            swalWarning('Perhatian', `Maksimal ${MAX_FOTO} foto per agenda. Sisa slot: ${slots}`);
        }
        const accepted = files.slice(0, slots).filter(f => {
            if (!f.type.startsWith('image/')) {
                swalWarning('Perhatian', `"${f.name}" bukan file gambar`);
                return false;
            }
            return true;
        });
        setNewFoto(prev => [...prev, ...accepted.map(f => ({
            file: f,
            preview: URL.createObjectURL(f),
            caption: '',
            tanggal: ''
        }))]);
    };

    const handlePickFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        addFoto(files);
    };

    const removeNewFoto = (index: number) => {
        setNewFoto(prev => {
            URL.revokeObjectURL(prev[index].preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const removeExistingFoto = async (url: string) => {
        if (!editingId) return;
        const result = await swalConfirm({
            title: 'Hapus Foto?',
            text: 'Foto akan dihapus permanen dari agenda ini.',
            icon: 'warning',
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch(`/api/agenda-madrasah/foto?agenda_id=${editingId}&url=${encodeURIComponent(url)}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menghapus foto');
            setExistingFoto(json.data);
            fetchData();
        } catch (e: any) {
            swalError('Error', e.message);
        }
    };

    const syncFoto = async (agendaId: number | string) => {
        if (editingId && existingFoto.length > 0) {
            const response = await fetch('/api/agenda-madrasah/foto', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agenda_id: agendaId, foto: existingFoto }),
            });
            const json = await response.json();
            if (!response.ok || !json.success) throw new Error(json.error || json.message || 'Gagal menyimpan keterangan foto');
            setExistingFoto(json.data);
        }
        if (newFoto.length === 0) return;

        const formData = new FormData();
        formData.append('agenda_id', String(agendaId));
        for (const f of newFoto) {
            formData.append('files', await compressImage(f.file));
            formData.append('captions', f.caption || '');
            formData.append('tanggals', f.tanggal || '');
        }
        const res = await fetch('/api/agenda-madrasah/foto', { method: 'POST', body: formData });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengunggah foto');
    };

    const handleSave = async () => {
        if (!form.judul || !form.tanggal_mulai) {
            return swalWarning('Perhatian', 'Judul dan tanggal mulai wajib diisi');
        }
        if (form.tanggal_selesai && form.tanggal_selesai < form.tanggal_mulai) {
            return swalWarning('Perhatian', 'Tanggal selesai tidak boleh sebelum tanggal mulai');
        }
        if (saving) return;
        if (!form.sasaran.length) return swalWarning('Perhatian', 'Pilih minimal satu sasaran agenda.');
        setSaving(true);
        let agendaSaved = false;
        try {
            const method = editingId ? 'PUT' : 'POST';
            const body = editingId ? { ...form, id: editingId } : form;
            const res = await fetch('/api/agenda-madrasah', {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menyimpan');

            const agendaId = editingId || json.data?.id;
            if (!agendaId) throw new Error('ID agenda tidak diterima. Perbarui daftar sebelum mencoba lagi.');
            agendaSaved = true;
            setEditingId(agendaId);
            if (agendaId) {
                await syncFoto(agendaId);
            }

            resetFotoState();
            setShowModal(false);
            fetchData();
            swalSuccess(editingId ? 'Berhasil diperbarui!' : 'Agenda ditambahkan!');
        } catch (e: any) {
            if (agendaSaved) {
                void fetchData();
                swalError('Foto belum tersimpan', 'Agenda sudah tersimpan. ' + e.message + '. Klik Simpan lagi untuk mencoba foto tanpa membuat agenda baru.');
            } else swalError('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number | string, judul: string) => {
        const result = await swalConfirm({
            title: 'Hapus Agenda?',
            text: `"${judul}" akan dihapus permanen.`,
            icon: 'warning',
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch(`/api/agenda-madrasah?id=${id}`, { method: 'DELETE' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.success === false) {
                throw new Error(json.error || json.message || 'Gagal menghapus agenda');
            }
            fetchData();
            swalSuccess('Agenda berhasil dihapus!');
        } catch (e: any) {
            swalError('Error', e.message || 'Gagal menghapus agenda');
        }
    };

    const handleSaveCat = async () => {
        if (!catForm.nama) return swalWarning('Perhatian', 'Nama kategori wajib diisi');
        setSavingCat(true);
        try {
            const method = catForm.id ? 'PUT' : 'POST';
            const res = await fetch('/api/agenda-madrasah/kategori', {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal menyimpan kategori');
            fetchCategories();
            setCatForm({ id: null, nama: '', color: '#3083FF', icon: 'bi-calendar-event' });
            swalSuccess('Kategori berhasil disimpan!');
        } catch (e: any) {
            swalError('Error', e.message);
        } finally {
            setSavingCat(false);
        }
    };

    const handleDeleteCat = async (id: number | string, nama: string) => {
        const result = await swalConfirm({
            title: 'Hapus Kategori?',
            text: `Kategori "${nama}" akan dihapus. Agenda dengan kategori ini mungkin perlu disesuaikan.`,
            icon: 'warning',
            confirmText: 'Ya, Hapus',
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch(`/api/agenda-madrasah/kategori?id=${id}`, { method: 'DELETE' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.success === false) {
                throw new Error(json.error || json.message || 'Gagal menghapus kategori');
            }
            fetchCategories();
            swalSuccess('Kategori berhasil dihapus!');
        } catch (e: any) {
            swalError('Error', e.message || 'Gagal menghapus kategori');
        }
    };

    const categoryColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        categories.forEach(c => {
            if (c.nama && c.color) {
                map[c.nama.toLowerCase().trim()] = c.color;
            }
        });
        return map;
    }, [categories]);

    const filteredAgendas = useMemo(() => {
        return agendas
            .map(a => {
                const effectiveWarna = categoryColorMap[a.kategori?.toLowerCase().trim()] || a.warna || '#3083FF';
                return { ...a, warna: effectiveWarna };
            })
            .filter(a => {
                if (filterKategori && a.kategori !== filterKategori) return false;

                if (filterTahunAjaran) {
                    const agendaYear = getAcademicYearFromDate(a.tanggal_mulai);
                    if (agendaYear !== filterTahunAjaran) return false;
                }

                if (filterSemester !== 'Semua') {
                    const agendaSem = getSemesterFromDate(a.tanggal_mulai);
                    const targetSem = filterSemester === 'Ganjil' ? 1 : 2;
                    if (agendaSem !== targetSem) return false;
                }

                if (searchQuery.trim() !== '') {
                    const q = searchQuery.toLowerCase().trim();
                    const judul = (a.judul || '').toLowerCase();
                    const deskripsi = (a.deskripsi || '').toLowerCase();
                    const lokasi = (a.lokasi || '').toLowerCase();
                    if (!judul.includes(q) && !deskripsi.includes(q) && !lokasi.includes(q)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const endA = a.tanggal_selesai || a.tanggal_mulai;
                const endB = b.tanggal_selesai || b.tanggal_mulai;
                const isPastA = endA < today;
                const isPastB = endB < today;

                // 1. Tempatkan agenda kadaluarsa di bagian paling akhir
                if (isPastA !== isPastB) {
                    return isPastA ? 1 : -1;
                }

                // 2. Agenda aktif (belum kadaluarsa): disusun dari yang terdekat (tanggal_mulai asc)
                if (!isPastA) {
                    const startA = a.tanggal_mulai || '';
                    const startB = b.tanggal_mulai || '';
                    if (startA !== startB) return startA.localeCompare(startB);
                    const idA = typeof a.id === 'number' ? a.id : (parseInt(String(a.id), 10) || 0);
                    const idB = typeof b.id === 'number' ? b.id : (parseInt(String(b.id), 10) || 0);
                    return idA - idB;
                }

                // 3. Agenda kadaluarsa: disusun dari yang paling baru berlalu (tanggal_mulai desc)
                const startA = a.tanggal_mulai || '';
                const startB = b.tanggal_mulai || '';
                if (startA !== startB) return startB.localeCompare(startA);
                const idA = typeof a.id === 'number' ? a.id : (parseInt(String(a.id), 10) || 0);
                const idB = typeof b.id === 'number' ? b.id : (parseInt(String(b.id), 10) || 0);
                return idB - idA;
            });
    }, [agendas, categoryColorMap, filterKategori, filterTahunAjaran, filterSemester, searchQuery, today]);

    const availableYears = useMemo(() => {
        const setYears = new Set<string>(academicYears);
        agendas.forEach(a => {
            const yr = getAcademicYearFromDate(a.tanggal_mulai);
            if (yr) setYears.add(yr);
        });
        return Array.from(setYears).filter(Boolean).sort().reverse();
    }, [academicYears, agendas]);

    return (
        <div className="page-wrapper">
            {headerTabs}

            {loadError && <div className="ag-load-error" role="alert"><span>{loadError}</span>
                <Button variant="secondary" onClick={fetchData} disabled={loading}>Coba lagi</Button></div>}
            {/* ── FILTER BAR ── */}
            <FilterToolbar 
                style={{ marginBottom: '16px' }} 
                actionsInline={true}
                leading={onBack && (
                    <Button 
                        variant="secondary" 
                        onClick={onBack} 
                        title="Kembali ke Kalender" 
                        style={{ marginRight: '12px' }}
                    >
                        <i className="bi bi-arrow-left"></i>
                    </Button>
                )}
            >
                <FilterSearch
                    label="Pencarian"
                    placeholder="Cari judul, deskripsi, atau lokasi…"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    grow={1}
                />
                {availableYears.length > 0 && (
                    <FilterSelect
                        label="Tahun Ajaran"
                        icon="calendar-check"
                        value={filterTahunAjaran}
                        onChange={setFilterTahunAjaran}
                        options={[
                            { value: '', label: 'Semua Tahun' },
                            ...availableYears.map(y => ({ value: y, label: y }))
                        ]}
                        width="160px"
                    />
                )}
                <FilterSelect
                    label="Semester"
                    icon="bookmark-star"
                    value={filterSemester}
                    onChange={val => setFilterSemester(val as any)}
                    options={[
                        { value: 'Semua', label: 'Semua Semester' },
                        { value: 'Ganjil', label: 'Ganjil' },
                        { value: 'Genap', label: 'Genap' },
                    ]}
                    width="150px"
                />
                <FilterSelect
                    label="Kategori"
                    icon="tags"
                    value={filterKategori}
                    onChange={setFilterKategori}
                    options={[
                        { value: '', label: 'Semua Kategori' },
                        ...categories.map(k => ({ value: k.nama, label: k.nama }))
                    ]}
                    width="160px"
                />
                {canManage && (
                    <FilterActions>
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => setShowCatModal(true)}
                            title="Kelola Kategori"
                            className="ftb-btn-icon-mobile"
                            leftIcon={<i className="bi bi-tags" />}
                        >
                            <span className="btn-text-desktop">Kategori</span>
                        </Button>
                    </FilterActions>
                )}
            </FilterToolbar>

            {/* ── AGENDA ── */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                    <Spinner variant="buble" />
                </div>
            ) : loadError && agendas.length === 0 ? null : filteredAgendas.length === 0 ? (
                <div className="empty-state">
                    <i className="bi bi-calendar-x"></i>
                    <p>Belum ada agenda.</p>
                </div>
            ) : (
                <>
                    {/* ── TAMPILAN DESKTOP: TABEL ── */}
                    <div className="ag-desktop-only">
                        <div className="ag-table-container">
                            <table className="ag-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '44px', textAlign: 'center' }}>No</th>
                                        <th style={{ minWidth: '190px' }}>Tanggal & Waktu</th>
                                        <th style={{ minWidth: '280px' }}>Agenda</th>
                                        <th style={{ width: '140px' }}>Kategori</th>
                                        <th style={{ width: '90px', textAlign: 'center' }}>Status</th>
                                        <th style={{ width: '80px', textAlign: 'center' }}>Foto</th>
                                        {canManage && <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAgendas.map((a, idx) => {
                                        const endDay = a.tanggal_selesai || a.tanggal_mulai;
                                        const isPast = endDay < today;
                                        const isToday = a.tanggal_mulai === today || (today > a.tanggal_mulai && today <= endDay);
                                        const isOngoing = today > a.tanggal_mulai && today <= endDay;
                                        const startsToday = a.tanggal_mulai === today;

                                        return (
                                            <tr key={a.id} className={`${isToday ? 'is-today' : ''} ${isPast ? 'is-past-row' : ''}`}>
                                                <td style={{ textAlign: 'center', color: 'var(--n-muted)', fontWeight: 600 }}>
                                                    {idx + 1}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 650, fontSize: '0.84rem', color: 'var(--n-ink)', lineHeight: '1.35', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <i className="bi bi-calendar3" style={{ color: 'var(--n-primary, #3083ff)', fontSize: '0.82rem', flexShrink: 0 }} />
                                                        <span>{formatDateRange(a.tanggal_mulai, a.tanggal_selesai)}</span>
                                                    </div>
                                                    {(a.waktu_mulai || (startsToday && !isPast) || (isOngoing && !isPast)) && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                            {a.waktu_mulai && (
                                                                <span className="ag-time-chip">
                                                                    <i className="bi bi-clock" /> {formatWaktuAgenda(a.waktu_mulai, a.waktu_selesai)}
                                                                </span>
                                                            )}
                                                            {startsToday && !isPast && (
                                                                <span className="ag-status-pill" style={{ background: `${a.warna}20`, color: a.warna }}>Hari Ini</span>
                                                            )}
                                                            {isOngoing && !isPast && (
                                                                <span className="ag-status-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#15803d' }}>Berlangsung</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--n-ink)', lineHeight: '1.35' }}>{a.judul}</div>
                                                    <SasaranAgenda sasaran={a.sasaran} />
                                                    {a.deskripsi && (
                                                        <div 
                                                            title={a.deskripsi}
                                                            style={{ 
                                                                fontSize: '0.76rem', 
                                                                color: 'var(--n-muted)', 
                                                                marginTop: '3px', 
                                                                lineHeight: '1.35',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden',
                                                                maxWidth: '380px',
                                                            }}
                                                        >
                                                            {a.deskripsi}
                                                        </div>
                                                    )}
                                                    {a.lokasi && (
                                                        <div style={{ marginTop: '4px', fontSize: '0.78rem' }}>
                                                            {a.lokasi.trim().toLowerCase().startsWith('http') ? (
                                                                <a href={a.lokasi.trim()} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <i className="bi bi-box-arrow-up-right" />
                                                                    {a.lokasi}
                                                                </a>
                                                            ) : (
                                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--n-muted)' }}>
                                                                    <i className="bi bi-geo-alt-fill" style={{ fontSize: '0.8rem', color: 'var(--n-muted)', flexShrink: 0 }} />
                                                                    <span>{a.lokasi}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--n-ink)' }}>
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: a.warna, flexShrink: 0 }} />
                                                        <span>{a.kategori}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 600, color: a.is_publik ? '#2563eb' : 'var(--n-muted)' }}>
                                                        <i className={`bi ${a.is_publik ? 'bi-globe' : 'bi-lock-fill'}`} style={{ fontSize: '0.85rem' }} />
                                                        <span>{a.is_publik ? 'Publik' : 'Privat'}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {Array.isArray(a.foto) && a.foto.length > 0 ? (
                                                        <span className="ag-foto-badge" title={`${a.foto.length} foto dokumentasi`}>
                                                            <i className="bi bi-images" /> {a.foto.length}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--n-muted)', fontSize: '0.8rem' }}>-</span>
                                                    )}
                                                </td>
                                                {canManage && (
                                                    <td style={{ textAlign: 'center' }}>
                                                        <ActionGroup>
                                                            <ActionButton action="edit" onClick={() => openEdit(a)} title="Edit Agenda" />
                                                            <ActionButton action="delete" onClick={() => handleDelete(a.id, a.judul)} title="Hapus Agenda" />
                                                        </ActionGroup>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── TAMPILAN MOBILE: KARTU TIMELINE ── */}
                    <div className="ag-mobile-only">
                        <div className="timeline-view">
                            {filteredAgendas.map(a => {
                                    const endDay = a.tanggal_selesai || a.tanggal_mulai;
                                    const isPast = endDay < today;
                                    const isTodayCard = a.tanggal_mulai === today || (today > a.tanggal_mulai && today <= endDay);

                                    return (
                                        <div key={a.id} className="timeline-item">
                                            <div className={`timeline-dot ${isTodayCard ? 'today-dot' : isPast ? 'past-dot' : 'active-dot'}`}
                                                style={!isPast && !isTodayCard ? { background: a.warna, borderColor: a.warna } : {}}>
                                            </div>
                                            <div className="timeline-content">
                                                <div className={`timeline-card ${isPast ? 'past' : ''} ${isTodayCard ? 'today' : ''}`}
                                                    style={{
                                                        borderColor: isTodayCard ? a.warna : '',
                                                        boxShadow: isTodayCard ? `0 4px 15px -3px ${a.warna}25` : ''
                                                    }}>
                                                    <div className="timeline-color" style={{ background: a.warna }}></div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div className="tl-card-meta">
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 650, color: a.warna }}>
                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: a.warna, flexShrink: 0 }} />
                                                                {a.kategori}
                                                            </span>
                                                            {isTodayCard && !isPast && <span className="status-badge" style={{ background: `${a.warna}25`, color: a.warna, padding: '1px 7px' }}>Hari Ini</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}><div className="tl-card-title" style={{ margin: 0 }}>{a.judul}</div>
                                                                <SasaranAgenda sasaran={a.sasaran} /></div>
                                                            {canManage && (
                                                                <div className="pm-card-menu-wrap" style={{ marginTop: '-4px', marginRight: '-8px' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="pm-card-menu-btn"
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenCardMenu(prev => prev === a.id ? null : a.id); }}
                                                                        aria-haspopup="menu"
                                                                        aria-expanded={openCardMenu === a.id}
                                                                        aria-label="Menu aksi"
                                                                    >
                                                                        <i className="bi bi-three-dots-vertical" />
                                                                    </button>
                                                                    {openCardMenu === a.id && (
                                                                        <div className="pm-card-menu" role="menu">
                                                                            <button type="button" role="menuitem" className="pm-card-menu-item" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenCardMenu(null); openEdit(a); }}>
                                                                                <i className="bi bi-pencil" /> Edit
                                                                            </button>
                                                                            <button type="button" role="menuitem" className="pm-card-menu-item danger" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenCardMenu(null); handleDelete(a.id, a.judul); }}>
                                                                                <i className="bi bi-trash3" /> Hapus
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="tl-card-details">
                                                            <div className="detail-item">
                                                                <i className="bi bi-calendar-range" style={{ color: a.warna }}></i>
                                                                <span>{formatDateRange(a.tanggal_mulai, a.tanggal_selesai)}</span>
                                                            </div>
                                                            {a.lokasi && (
                                                                <div className="detail-item">
                                                                    <i className="bi bi-geo-alt" style={{ color: a.warna }}></i>
                                                                    {a.lokasi.trim().toLowerCase().startsWith('http') ? (
                                                                        <a href={a.lokasi.trim()} target="_blank" rel="noopener noreferrer" className="location-link">{a.lokasi}</a>
                                                                    ) : (
                                                                        <span style={{ fontWeight: 600, color: 'var(--n-ink)' }}>{a.lokasi}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {Array.isArray(a.foto) && a.foto.length > 0 && (
                                                                <div className="detail-item">
                                                                    <i className="bi bi-images" style={{ color: a.warna }}></i>
                                                                    <span>{a.foto.length} foto dokumentasi</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </>
            )}

            {/* Aksi utama halaman: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
            {canManage && (
                <>
                    <DesktopFab label="Tambah Agenda" icon="plus-lg" onClick={openAdd} />
                    <MobileFab label="Tambah" icon="plus-lg" onClick={openAdd} />
                </>
            )}

            {/* ── MODAL AGENDA ── */}
            <Modal
                open={showModal}
                size="lg"
                variant={editingId ? 'edit' : 'add'}
                onClose={() => { if (!saving) setShowModal(false); }}
                labelledBy="modal-agenda-title"
            >
                <ModalHeader
                    id="modal-agenda-title"
                    title={editingId ? 'Edit Agenda' : 'Tambah Agenda Baru'}
                    icon={editingId ? 'pencil-square' : 'calendar-plus'}
                    onClose={() => { if (!saving) setShowModal(false); }}
                />

                <ModalBody>
                    <div className="form-row">
                        <div className="form-col full">
                            <label>Judul Agenda <span className="required">*</span></label>
                            <input className="form-input" placeholder="Contoh: Ujian Tengah Semester Ganjil"
                                value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-col" style={{ flex: 2 }}>
                            <label>Tanggal Agenda <span className="required">*</span></label>
                            <DatePicker
                                value={form.tanggal_mulai}
                                valueEnd={form.tanggal_selesai}
                                isRange={true}
                                onChangeRange={(start, end) => setForm(prev => ({ ...prev, tanggal_mulai: start, tanggal_selesai: end }))}
                                onChange={v => setForm(prev => ({ ...prev, tanggal_mulai: v, tanggal_selesai: v }))}
                                placeholder="Pilih tanggal / rentang tanggal agenda..."
                            />
                        </div>
                        <div className="form-col">
                            <label>Waktu Mulai</label>
                            <TimeField label="Waktu Mulai" value={form.waktu_mulai}
                                onChange={v => setForm({ ...form, waktu_mulai: v })} />
                        </div>
                        <div className="form-col">
                            <label>Waktu Selesai</label>
                            <TimeField label="Waktu Selesai" value={form.waktu_selesai}
                                onChange={v => setForm({ ...form, waktu_selesai: v })} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-col">
                            <label>Kategori</label>
                            <InlineSelect
                                value={form.kategori}
                                onChange={(val) => {
                                    const foundCat = categories.find(c => c.nama === val);
                                    setForm(prev => ({
                                        ...prev,
                                        kategori: val,
                                        warna: foundCat ? foundCat.color : prev.warna
                                    }));
                                }}
                                options={categories.map(c => ({ value: c.nama, label: c.nama }))}
                                minWidth="100%"
                                height="42px"
                            />
                        </div>
                        <div className="form-col">
                            <label>Lokasi / Tempat</label>
                            <input className="form-input" placeholder="Contoh: Aula Utama, Lapangan, Zoom"
                                value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} />
                        </div>
                    </div>

                    <fieldset className="ag-sasaran-field">
                        <legend>Sasaran agenda</legend>
                        <p>Pilih satu atau lebih kelompok yang dituju.</p>
                        <div className="ag-sasaran-options">
                            {SASARAN_AGENDA.map(option => <label key={option.value}>
                                <input type="checkbox" checked={form.sasaran.includes(option.value)} disabled={saving}
                                    onChange={e => setForm(prev => ({ ...prev, sasaran: e.target.checked
                                        ? [...prev.sasaran, option.value] : prev.sasaran.filter(value => value !== option.value) }))} />
                                {option.label}
                            </label>)}
                        </div>
                    </fieldset>
                    <div className="form-row">
                        <div className="form-col">
                            <div className="toggle-row" onClick={() => setForm(prev => ({ ...prev, is_publik: !prev.is_publik }))}>
                                <div className={`toggle ${form.is_publik ? 'on' : ''}`}>
                                    <div className="toggle-thumb"></div>
                                </div>
                                <div className="toggle-text">
                                    <div className="toggle-label">{form.is_publik ? 'Publik' : 'Privat'}</div>
                                </div>
                            </div>
                        </div>
                        <div className="form-col">
                            <div className="toggle-row" onClick={() => setForm(prev => ({ ...prev, skip_hari_libur: !prev.skip_hari_libur }))}>
                                <div className={`toggle ${form.skip_hari_libur ? 'on' : ''}`}>
                                    <div className="toggle-thumb"></div>
                                </div>
                                <div className="toggle-text">
                                    <div className="toggle-label">Lewati Hari Libur</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-col full">
                            <label>Deskripsi</label>
                            <textarea className="form-input" rows={3} placeholder="Keterangan tambahan tentang agenda ini..."
                                value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-col full">
                            <label>Foto Dokumentasi <span className="foto-counter">{totalFoto}/{MAX_FOTO}</span></label>
                            <div
                                className={`foto-grid ${fotoDragging ? 'is-dragging' : ''}`.trim()}
                                onDragOver={e => {
                                    if (totalFoto >= MAX_FOTO) return;
                                    e.preventDefault();
                                    setFotoDragging(true);
                                }}
                                onDragLeave={e => {
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                    setFotoDragging(false);
                                }}
                                onDrop={e => {
                                    e.preventDefault();
                                    setFotoDragging(false);
                                    if (totalFoto >= MAX_FOTO) return;
                                    addFoto(Array.from(e.dataTransfer.files || []));
                                }}
                            >
                                {existingFoto.map(f => (
                                    <div key={f.url} className="foto-item">
                                        <img src={f.url} alt={f.caption || 'Foto dokumentasi'} />
                                        <button type="button" className="foto-remove" title="Hapus foto"
                                            onClick={() => removeExistingFoto(f.url)}>
                                            <i className="bi bi-x-lg"></i>
                                        </button>
                                        <input className="foto-caption" placeholder="Keterangan foto..."
                                            value={f.caption || ''}
                                            onChange={e => setExistingFoto(prev =>
                                                prev.map(p => p.url === f.url ? { ...p, caption: e.target.value } : p))} />
                                        <DatePicker className="foto-date"
                                            title="Pilih tanggal jika agenda lebih dari 1 hari"
                                            value={f.tanggal || ''}
                                            onChange={v => setExistingFoto(prev =>
                                                prev.map(p => p.url === f.url ? { ...p, tanggal: v } : p))} />
                                    </div>
                                ))}
                                {newFoto.map((f, i) => (
                                    <div key={f.preview} className="foto-item is-new">
                                        <img src={f.preview} alt="Foto baru" />
                                        <span className="foto-new-badge">Baru</span>
                                        <button type="button" className="foto-remove" title="Batalkan foto"
                                            onClick={() => removeNewFoto(i)}>
                                            <i className="bi bi-x-lg"></i>
                                        </button>
                                        <input className="foto-caption" placeholder="Keterangan foto..."
                                            value={f.caption}
                                            onChange={e => setNewFoto(prev =>
                                                prev.map((p, pi) => pi === i ? { ...p, caption: e.target.value } : p))} />
                                        <DatePicker className="foto-date"
                                            title="Pilih tanggal jika agenda lebih dari 1 hari"
                                            value={f.tanggal}
                                            onChange={v => setNewFoto(prev =>
                                                prev.map((p, pi) => pi === i ? { ...p, tanggal: v } : p))} />
                                    </div>
                                ))}
                                {totalFoto < MAX_FOTO && (
                                    <label className="foto-add">
                                        <input type="file" accept="image/*" multiple hidden onChange={handlePickFoto} />
                                        <i className="bi bi-camera"></i>
                                        <span>Tambah Foto</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button variant="cancel" onClick={() => setShowModal(false)}>Batal</Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={saving}
                        style={{ background: form.warna, borderColor: form.warna }}
                    >
                        {editingId ? 'Simpan Perubahan' : 'Tambah'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* ── MODAL KATEGORI ── */}
            <Modal
                open={showCatModal}
                size="md"
                variant={catForm.id ? 'edit' : 'default'}
                onClose={() => setShowCatModal(false)}
                labelledBy="modal-cat-title"
            >
                <ModalHeader
                    id="modal-cat-title"
                    title="Kelola Kategori"
                    icon="tags"
                    onClose={() => setShowCatModal(false)}
                />
                <ModalBody>
                    <div className="cat-form-card" style={{ background: 'var(--n-soft, #f8fafc)', padding: '16px', borderRadius: '14px', border: '1px solid var(--n-border, #e2e8f0)' }}>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--n-muted)' }}>
                            {catForm.id ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input className="form-input" placeholder="Nama kategori..."
                                value={catForm.nama} onChange={e => setCatForm({ ...catForm, nama: e.target.value })} />
                            <Button 
                                variant="primary" 
                                size="md" 
                                onClick={handleSaveCat} 
                                isLoading={savingCat}
                                style={{ whiteSpace: 'nowrap', background: catForm.id ? '#F59E0B' : undefined, borderColor: catForm.id ? '#F59E0B' : undefined }}
                            >
                                {catForm.id ? 'Simpan Edit' : 'Tambah'}
                            </Button>
                            {catForm.id && (
                                <Button 
                                    variant="cancel" 
                                    size="md"
                                    onClick={() => setCatForm({ id: null, nama: '', color: '#3083FF', icon: 'bi-calendar-event' })}
                                >
                                    Batal
                                </Button>
                            )}
                        </div>
                        <div className="color-picker" style={{ marginTop: '12px' }}>
                            {[
                                '#3083FF', '#EF4444', '#22C55E', '#F59E0B', '#3b82f6', '#06B6D4',
                                '#EC4899', '#F97316', '#14B8A6', '#64748B', '#475569', '#0F172A'
                            ].map(c => (
                                <button key={c} type="button" className={`color-dot ${catForm.color === c ? 'selected' : ''}`}
                                    style={{ background: c }} onClick={() => setCatForm({ ...catForm, color: c })} />
                            ))}
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <label htmlFor="cat-custom-color" className={`color-custom-btn ${![
                                    '#3083FF', '#EF4444', '#22C55E', '#F59E0B', '#3b82f6', '#06B6D4',
                                    '#EC4899', '#F97316', '#14B8A6', '#64748B', '#475569', '#0F172A'
                                ].includes(catForm.color) ? 'selected' : ''}`} title="Pilih Warna Kustom"
                                style={![
                                    '#3083FF', '#EF4444', '#22C55E', '#F59E0B', '#3b82f6', '#06B6D4',
                                    '#EC4899', '#F97316', '#14B8A6', '#64748B', '#475569', '#0F172A'
                                ].includes(catForm.color) ? { background: catForm.color } : undefined}>
                                    <i className="bi bi-palette-fill"></i>
                                    <input id="cat-custom-color" type="color" className="color-custom-input" value={catForm.color}
                                        onChange={e => setCatForm({ ...catForm, color: e.target.value })} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--n-muted)' }}>
                            Daftar Kategori ({categories.length})
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px' }}>
                            {categories.map((k, i) => (
                                <div key={k.id} className="cat-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 4px', borderBottom: i < categories.length - 1 ? '1px solid var(--n-border, #f1f5f9)' : 'none', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: k.color, flexShrink: 0 }}></div>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--n-ink)' }}>{k.nama}</span>
                                    </div>
                                    <ActionGroup>
                                        <ActionButton action="edit" onClick={() => setCatForm({ id: k.id, nama: k.nama, color: k.color, icon: k.icon })} title="Edit Kategori" />
                                        <ActionButton action="delete" onClick={() => handleDeleteCat(k.id, k.nama)} title="Hapus Kategori" />
                                    </ActionGroup>
                                </div>
                            ))}
                        </div>
                    </div>
                </ModalBody>
            </Modal>

        </div>
    );
}
