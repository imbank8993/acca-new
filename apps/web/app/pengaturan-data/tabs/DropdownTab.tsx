'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Spinner, PageLoader } from '@/components/ui/Spinner'
import { usePengaturanDataAccess } from '@/lib/use-pengaturan-data-access'
import { useModalBlur } from '@/components/ModalBlurProvider'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

// Use a type that matches the columns in the database
type DropdownItem = {
    id: number
    kategori_kehadiran?: string | null
    keterangan_terlambat?: string | null
    jenis_ketidakhadiran?: string | null
    status_ketidakhadiran?: string | null
    golongan?: string | null
    pangkat?: string | null
    tugas_tambahan?: string | null
    jenis_surat?: string | null
    aktif?: boolean
    [key: string]: any
}

// Define the structure for our UI columns
export interface ColumnDef {
    key: string
    label: string
}

// Default columns that cannot be deleted (system columns)
const SYSTEM_COLUMNS = ['id', 'created_at', 'updated_at', 'urutan', 'aktif']

/**
 * Kolom kategori yang benar-benar ada di tabel `master_dropdown`.
 *
 * Daftar ini menjadi penjaga karena kolom yang ditampilkan tab ini disimpan di
 * localStorage, bukan di server. Dua hal bisa menyelipkan kolom yang tidak ada:
 * `keterangan_terlambat`, yang tercantum sebagai kolom bawaan padahal sudah
 * dihapus dari tabelnya; dan kolom apa pun yang dulu "berhasil" ditambahkan lewat
 * tombol Tambah Kolom, yang sebenarnya tidak pernah menyentuh database.
 *
 * Keduanya menghasilkan kolom yang tampil normal tapi menolak setiap nilai yang
 * dicoba disimpan ke dalamnya. Kolom seperti itu disaring saat dibaca dari
 * localStorage supaya sisa di browser lama ikut bersih dengan sendirinya.
 */
const KNOWN_COLUMNS = [
    'kategori_kehadiran',
    'jenis_ketidakhadiran',
    'status_ketidakhadiran',
    'golongan',
    'pangkat',
    'tugas_tambahan',
    'jenis_surat',
]

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanDataAccess(), bukan dari objek user. Propnya tetap diterima
// agar pemanggil (view.tsx) tidak perlu diubah.
export default function DropdownTab(_props: { user?: unknown }) {
    /**
     * Wewenang datang dari server lewat `usePengaturanDataAccess()`, sumber yang
     * sama dengan yang ditegakkan backend.
     *
     * Sebelumnya dipakai `hasPermission(permissions, ...)` dan/atau pencocokan role
     * 'ADMIN'. Keduanya lebih KETAT dari server sejak wewenang dipindah ke Hak Akses
     * Fitur: orang yang sah ditunjuk di layar itu bisa membuka tab ini lalu tidak
     * menemukan satu tombol pun. (`user.permissions` juga selalu larik kosong —
     * lihat lib/auth.ts — jadi praktis hanya cabang isAdmin yang pernah berlaku.)
       */
    const { boleh } = usePengaturanDataAccess()
    const canManage = boleh('dropdown')
    const canExport = canManage

    // State for columns (loaded from localStorage + server)
    const [columns, setColumns] = useState<ColumnDef[]>([
        { key: 'kategori_kehadiran', label: 'Kategori Kehadiran' },
        { key: 'jenis_ketidakhadiran', label: 'Jenis Ketidakhadiran' },
        { key: 'status_ketidakhadiran', label: 'Status Ketidakhadiran' },
        { key: 'golongan', label: 'Golongan' },
        { key: 'pangkat', label: 'Pangkat' },
        { key: 'tugas_tambahan', label: 'Tugas Tambahan' },
        { key: 'jenis_surat', label: 'Jenis Surat' },
    ])

    const [rawItems, setRawItems] = useState<DropdownItem[]>([])
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)
    const [savingColumn, setSavingColumn] = useState(false)

    // State for the modal
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [activeColumn, setActiveColumn] = useState<string>('') // Which column are we adding/editing?
    const [formData, setFormData] = useState({ id: 0, value: '' })

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
    const [deleteItemName, setDeleteItemName] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [deleteColumnKey, setDeleteColumnKey] = useState('')

    // Column Management Modal State
    const [showColumnModal, setShowColumnModal] = useState(false)
    const [columnForm, setColumnForm] = useState({ key: '', label: '' })
    const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null)
    const [deletingColumnKey, setDeletingColumnKey] = useState<string | null>(null)
    const [showDeleteColumnModal, setShowDeleteColumnModal] = useState(false)

    const { openModal, closeModal } = useModalBlur()

    useEffect(() => {
        if (isModalOpen || showDeleteModal || showColumnModal || showDeleteColumnModal) {
            openModal()
        } else {
            closeModal()
        }
        return () => {
            closeModal()
        }
    }, [isModalOpen, showDeleteModal, showColumnModal, showDeleteColumnModal, openModal, closeModal])

    // Load columns from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('master_dropdown_columns')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed)) {
                    // Buang kolom yang tidak ada di tabelnya — lihat KNOWN_COLUMNS.
                    const bersih = parsed.filter(
                        (c: any) => c && typeof c.key === 'string' && KNOWN_COLUMNS.includes(c.key)
                    )
                    if (bersih.length > 0) setColumns(bersih)
                }
            } catch (e) {
                console.error('Failed to parse saved columns:', e)
            }
        }
    }, [])

    // Save columns to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('master_dropdown_columns', JSON.stringify(columns))
    }, [columns])

    const fetchItems = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/master-dropdown')
            const json = await res.json()
            if (!json.ok) throw new Error(json.error || 'Failed')
            setRawItems(json.data || [])
        } catch (error) {
            console.error('Error fetching dropdowns:', error)
            Swal.fire('Error', 'Gagal memuat data dropdown', 'error')
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    // Helper to get list of values for a specific column, filtering out nulls
    const getColumnValues = (columnKey: string) => {
        return rawItems
            .filter(item => (item as any)[columnKey] !== null && (item as any)[columnKey] !== undefined && (item as any)[columnKey] !== '')
            .map(item => ({
                id: item.id,
                value: (item as any)[columnKey]
            }))
    }

    const handleDelete = (id: number, columnKey: string, value: string) => {
        if (!canManage) return
        setDeleteItemId(id)
        setDeleteItemName(value)
        setDeleteColumnKey(columnKey)
        setShowDeleteModal(true)
    }

    const confirmDelete = async () => {
        if (!deleteItemId) return
        setDeleting(true)
        try {
            const item = rawItems.find(i => i.id === deleteItemId)
            if (!item) return

            const otherColumns = columns.filter(c => c.key !== deleteColumnKey)
            const hasOtherData = otherColumns.some(c => (item as any)[c.key])

            let error = null
            if (hasOtherData) {
                // Update to NULL if other data exists in row
                const res = await fetch('/api/master-dropdown', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: deleteItemId, [deleteColumnKey]: null })
                })
                const json = await res.json()
                if (!json.ok) error = json.error
            } else {
                // Delete row if it's the only data
                const res = await fetch(`/api/master-dropdown?id=${deleteItemId}`, {
                    method: 'DELETE'
                })
                const json = await res.json()
                if (!json.ok) error = json.error
            }

            if (error) {
                Swal.fire('Error', 'Gagal menghapus data', 'error')
            } else {
                setShowDeleteModal(false)
                setDeleteItemId(null)
                setDeleteItemName('')
                setDeleteColumnKey('')
                Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success')
                fetchItems()
            }
        } catch (err) {
            console.error(err)
            Swal.fire('Gagal', 'Terjadi kesalahan', 'error')
        } finally {
            setDeleting(false)
        }
    }

    const openDropdownModal = (mode: 'create' | 'edit', columnKey: string, item?: { id: number, value: string }) => {
        if (!canManage) return
        setModalMode(mode)
        setActiveColumn(columnKey)
        if (mode === 'edit' && item) {
            setFormData({ id: item.id, value: item.value })
        } else {
            setFormData({ id: 0, value: '' })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canManage) return
        if (!formData.value.trim()) return

        const payload: any = { [activeColumn]: formData.value.trim() }

        let error = null
        if (modalMode === 'create') {
            const resEmpty = await fetch(`/api/master-dropdown?checkEmptySlot=true&columnKey=${activeColumn}`)
            const jsonEmpty = await resEmpty.json()
            const emptySlotRow = jsonEmpty.data?.[0]
            
            if (emptySlotRow) {
                const res = await fetch('/api/master-dropdown', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: emptySlotRow.id, ...payload })
                })
                const json = await res.json()
                if (!json.ok) error = json.error
            } else {
                const res = await fetch('/api/master-dropdown', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                const json = await res.json()
                if (!json.ok) error = json.error
            }
        } else {
            const res = await fetch('/api/master-dropdown', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: formData.id, ...payload })
            })
            const json = await res.json()
            if (!json.ok) error = json.error
        }

        if (error) {
            console.error(error)
            Swal.fire('Error', 'Gagal menyimpan data', 'error')
        } else {
            Swal.fire('Berhasil', 'Data berhasil disimpan', 'success')
            setIsModalOpen(false)
            fetchItems()
        }
    }

    const handleExport = () => {
        if (!canExport) return
        const worksheet = XLSX.utils.json_to_sheet(rawItems.map(item => {
            const row: any = {};
            columns.forEach(col => {
                row[col.label] = (item as any)[col.key] || '';
            });
            return row;
        }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Master Dropdown");
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(data, `Master_Dropdown_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canManage) return
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Group by column
                const importBuffer: Record<string, string[]> = {};
                columns.forEach(c => importBuffer[c.key] = []);

                data.forEach((row: any) => {
                    columns.forEach(col => {
                        const val = row[col.label] || row[col.key];
                        if (val) {
                            importBuffer[col.key].push(String(val).trim());
                        }
                    });
                });

                /**
                 * Tiap permintaan diperiksa hasilnya sebelum dihitung.
                 *
                 * Sebelumnya `addedCount++` berjalan tanpa syarat setelah `await
                 * fetch(...)` yang responsnya tidak pernah dibaca. Akibatnya impor
                 * yang seluruhnya ditolak server — 403 karena tidak berwenang, 400
                 * karena kolomnya tidak ada — tetap melaporkan "Impor selesai,
                 * 47 item baru ditambahkan". Angkanya dikarang.
                 */
                let addedCount = 0;
                const gagal: string[] = [];

                for (const col of columns) {
                    const existingValues = rawItems
                        .map(i => (i as any)[col.key])
                        .filter(v => v !== null && v !== undefined)
                        .map(v => String(v).toLowerCase().trim());

                    const newValues = importBuffer[col.key].filter(v => !existingValues.includes(v.toLowerCase()));

                    for (const val of newValues) {
                        const resEmpty = await fetch(`/api/master-dropdown?checkEmptySlot=true&columnKey=${col.key}`)
                        const jsonEmpty = resEmpty.ok ? await resEmpty.json().catch(() => null) : null
                        const emptySlots = jsonEmpty?.data

                        const res = (emptySlots && emptySlots.length > 0)
                            ? await fetch('/api/master-dropdown', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: emptySlots[0].id, [col.key]: val })
                            })
                            : await fetch('/api/master-dropdown', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ [col.key]: val })
                            })

                        const json = await res.json().catch(() => null)
                        if (res.ok && json?.ok !== false) {
                            addedCount++
                        } else {
                            gagal.push(`${col.label}: "${val}" — ${json?.error || json?.message || `HTTP ${res.status}`}`)
                        }
                    }
                }

                if (gagal.length > 0) {
                    Swal.fire({
                        icon: addedCount > 0 ? 'warning' : 'error',
                        title: addedCount > 0 ? 'Impor sebagian gagal' : 'Impor gagal',
                        html: `${addedCount} item tersimpan, ${gagal.length} gagal.<br/><br/>`
                            + `<div style="text-align:left;max-height:200px;overflow:auto;font-size:.8rem">`
                            + gagal.slice(0, 20).map(g => `• ${g}`).join('<br/>')
                            + (gagal.length > 20 ? `<br/>• …dan ${gagal.length - 20} lainnya` : '')
                            + `</div>`,
                    });
                } else {
                    Swal.fire('Berhasil', `Impor selesai. ${addedCount} item baru ditambahkan.`, 'success');
                }
                fetchItems();

            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Gagal memproses file import', 'error');
            } finally {
                setImporting(false);
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // Column Management Functions
    const openAddColumnModal = () => {
        setEditingColumnKey(null)
        setColumnForm({ key: '', label: '' })
        setShowColumnModal(true)
    }

    const openEditColumnModal = (col: ColumnDef) => {
        if (SYSTEM_COLUMNS.includes(col.key)) {
            Swal.fire('Info', 'Kolom sistem tidak dapat diedit', 'info')
            return
        }
        setEditingColumnKey(col.key)
        setColumnForm({ key: col.key, label: col.label })
        setShowColumnModal(true)
    }

    const saveColumn = async () => {
        if (!columnForm.label.trim()) {
            Swal.fire('Error', 'Nama label harus diisi', 'error')
            return
        }

        // Generate key from label if creating new
        const key = editingColumnKey || columnForm.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')

        setSavingColumn(true)
        try {
            if (editingColumnKey) {
                // Update existing column - rename label only
                // Daftar kolom hanya tersimpan di localStorage browser ini — tidak
                // ada tempatnya di server. Pesannya menyebutkan itu supaya tidak
                // dikira berlaku untuk semua pengguna.
                setColumns(prev => prev.map(c =>
                    c.key === editingColumnKey ? { ...c, label: columnForm.label.trim() } : c
                ))
                Swal.fire('Berhasil', 'Label kolom diubah untuk tampilan di browser ini.', 'success')
            } else {
                // Check if key already exists
                if (columns.some(c => c.key === key)) {
                    Swal.fire('Error', 'Kolom dengan nama tersebut sudah ada', 'error')
                    setSavingColumn(false)
                    return
                }

                // Kolom dropdown adalah kolom tabel sungguhan, jadi penambahannya
                // harus lewat migrasi database. Dulu kegagalan di sini hanya
                // di-console.warn lalu kolomnya tetap ditambahkan ke UI (dan
                // disimpan ke localStorage) dengan pesan "Berhasil" — padahal
                // kolomnya tidak pernah ada, dan setiap nilai yang dimasukkan ke
                // sana ditolak backend. Sekarang kegagalannya ditampilkan apa adanya
                // dan kolomnya tidak ditambahkan.
                const res = await fetch('/api/master-dropdown/column', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ columnKey: key, label: columnForm.label.trim() })
                })
                const json = await res.json()

                if (!json.ok) {
                    Swal.fire(
                        'Tidak Dapat Menambah Kolom',
                        json.error || json.message || 'Backend menolak penambahan kolom.',
                        'error'
                    )
                    setSavingColumn(false)
                    return
                }

                // Add new column to UI
                setColumns(prev => [...prev, { key, label: columnForm.label.trim() }])
                Swal.fire('Berhasil', `Kolom "${columnForm.label}" berhasil ditambahkan`, 'success')
            }
            setShowColumnModal(false)
        } catch (err) {
            console.error(err)
            Swal.fire('Error', 'Gagal menyimpan kolom', 'error')
        } finally {
            setSavingColumn(false)
        }
    }

    const confirmDeleteColumn = (colKey: string) => {
        if (SYSTEM_COLUMNS.includes(colKey)) {
            Swal.fire('Info', 'Kolom sistem tidak dapat dihapus', 'info')
            return
        }
        setDeletingColumnKey(colKey)
        setShowDeleteColumnModal(true)
    }

    const executeDeleteColumn = async () => {
        if (!deletingColumnKey) return

        setSavingColumn(true)
        try {
            // First, clear all data in the column (set to NULL)
            // (Skipped bulk update via supabase, assuming the DB drop command is enough, or we can add API later)

            // Call API to drop column from database
            const res = await fetch('/api/master-dropdown/column', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columnKey: deletingColumnKey })
            })
            const json = await res.json()

            // Sama seperti penambahan: kolomnya tidak benar-benar hilang dari
            // database, jadi menyembunyikannya dari UI hanya membuat datanya
            // tak terlihat sambil tetap ada. Kegagalan ditampilkan apa adanya.
            if (!json.ok) {
                Swal.fire(
                    'Tidak Dapat Menghapus Kolom',
                    json.error || json.message || 'Backend menolak penghapusan kolom.',
                    'error'
                )
                setSavingColumn(false)
                return
            }

            // Remove from UI
            setColumns(prev => prev.filter(c => c.key !== deletingColumnKey))
            Swal.fire('Berhasil', 'Kolom berhasil dihapus', 'success')
            setShowDeleteColumnModal(false)
            setDeletingColumnKey(null)
        } catch (err) {
            console.error(err)
            Swal.fire('Error', 'Gagal menghapus kolom', 'error')
        } finally {
            setSavingColumn(false)
        }
    }

    // Count total items across all columns
    const totalItems = columns.reduce((sum, col) => sum + getColumnValues(col.key).length, 0)

    if (loading) return <PageLoader minHeight="300px" dotsOnly size={18} />

    return (
        <div className="md">
            {/* Toolbar */}
            <div className="md__toolbar">
                <div className="md__toolbarLeft">
                    <span className="md__count">
                        <i className="bi bi-list-ul"></i>
                        {totalItems} item
                    </span>
                </div>
                <div className="md__toolbarRight">
                    {canManage && (
                        <label style={{ display: 'inline-flex' }}>
                            <Button
                                variant="outline"
                                type="button"
                                isLoading={importing}
                                icon="import"
                            >
                                {importing ? 'Importing...' : 'Import'}
                            </Button>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImport}
                                disabled={importing}
                                style={{ display: 'none' }}
                            />
                        </label>
                    )}
                    {canExport && (
                        <Button
                            variant="outline"
                            type="button"
                            onClick={handleExport}
                            icon="export"
                        >
                            Export
                        </Button>
                    )}
                    {canManage && (
                        <Button
                            variant="primary"
                            type="button"
                            onClick={openAddColumnModal}
                            icon="add"
                        >
                            Tambah
                        </Button>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="md__loading">
                    <Spinner variant="trace" />
                </div>
            ) : (
                /* Cards Grid */
                <div className="md__grid">
                    {columns.map((col) => {
                        const values = getColumnValues(col.key)
                        const isSystem = SYSTEM_COLUMNS.includes(col.key)
                        return (
                            <div key={col.key} className="md__card">
                                <div className="md__cardHeader">
                                    <div className="md__cardTitle">
                                        <i className="bi bi-list-columns"></i>
                                        <span>{col.label}</span>
                                        {isSystem && <span className="md__badge">System</span>}
                                    </div>
                                    <ActionGroup className="md__cardActions">
                                        {!isSystem && canManage && (
                                            <>
                                                <ActionButton
                                                    action="edit"
                                                    onClick={() => openEditColumnModal(col)}
                                                    title="Edit Nama Kolom"
                                                    tooltipPos="bottom"
                                                />
                                                <ActionButton
                                                    action="delete"
                                                    onClick={() => confirmDeleteColumn(col.key)}
                                                    title="Hapus Kolom"
                                                    tooltipPos="bottom"
                                                />
                                            </>
                                        )}
                                        {canManage && (
                                            <ActionButton
                                                action="add"
                                                onClick={() => openDropdownModal('create', col.key)}
                                                title="Tambah Item"
                                                tooltipPos="bottom"
                                            />
                                        )}
                                    </ActionGroup>
                                </div>
                                <div className="md__cardBody">
                                    {values.length === 0 ? (
                                        <div className="md__empty">
                                            <i className="bi bi-inbox"></i>
                                            <span>Belum ada data</span>
                                        </div>
                                    ) : (
                                        <ul className="md__list">
                                            {values.map((v) => (
                                                <li key={v.id} className="md__listItem">
                                                    <span className="md__listValue">{v.value}</span>
                                                    {canManage && (
                                                        <ActionGroup className="md__listActions">
                                                            <ActionButton
                                                                action="edit"
                                                                onClick={() => openDropdownModal('edit', col.key, v)}
                                                                title="Edit"
                                                                tooltipPos="left"
                                                            />
                                                            <ActionButton
                                                                action="delete"
                                                                onClick={() => handleDelete(v.id, col.key, v.value)}
                                                                title="Hapus"
                                                                tooltipPos="left"
                                                            />
                                                        </ActionGroup>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="md__cardFooter">
                                    <span className="md__itemCount">{values.length} item</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* MODAL - Add/Edit Item */}
            {isModalOpen && (
                <Modal
                    size="sm"
                    variant={modalMode === 'create' ? 'add' : 'edit'}
                    onClose={() => setIsModalOpen(false)}
                    labelledBy="dropdown-modal-title"
                >
                    <ModalHeader
                        id="dropdown-modal-title"
                        icon={modalMode === 'create' ? 'plus-lg' : 'pencil-square'}
                        title={modalMode === 'create' ? 'Tambah Data' : 'Edit Data'}
                        onClose={() => setIsModalOpen(false)}
                    />
                    <form onSubmit={handleSubmit}>
                        <ModalBody>
                            <div className="md__field">
                                <label>{columns.find(c => c.key === activeColumn)?.label}</label>
                                <input
                                    type="text"
                                    value={formData.value}
                                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                    placeholder="Masukkan nilai..."
                                    autoFocus
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button type="button" variant="cancel" onClick={() => setIsModalOpen(false)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                            <Button type="submit" variant="primary" leftIcon={<i className="bi bi-check-lg" />}>Simpan</Button>
                        </ModalFooter>
                    </form>
                </Modal>
            )}

            {/* MODAL - Delete Item */}
            {showDeleteModal && (
                <Modal
                    size="sm"
                    variant="delete"
                    onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
                    labelledBy="dropdown-delete-title"
                >
                    <ModalHeader
                        id="dropdown-delete-title"
                        icon="trash3"
                        title={deleteItemName}
                        onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
                    />
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button type="button" variant="danger" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>
                            Ya, Hapus
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* MODAL - Add/Edit Column */}
            {showColumnModal && (
                <Modal
                    size="sm"
                    variant={editingColumnKey ? 'edit' : 'add'}
                    onClose={() => setShowColumnModal(false)}
                    labelledBy="dropdown-column-title"
                >
                    <ModalHeader
                        id="dropdown-column-title"
                        icon="columns"
                        title={editingColumnKey ? 'Edit Kolom' : 'Tambah Kolom Baru'}
                        onClose={() => setShowColumnModal(false)}
                    />
                    <ModalBody>
                            <div className="md__field">
                                <label>Nama Label Kolom</label>
                                <input
                                    type="text"
                                    value={columnForm.label}
                                    onChange={(e) => setColumnForm({ ...columnForm, label: e.target.value })}
                                    placeholder="Contoh: Jenis Kelamin"
                                    autoFocus
                                />
                                <p className="md__hint">
                                    {editingColumnKey ? 'Mengubah hanya nama tampilan, tidak mengubah kolom di database.' : 'Kolom baru akan ditambahkan ke database secara otomatis.'}
                                </p>
                            </div>
                            {editingColumnKey && (
                                <div className="md__keyDisplay">
                                    <span>ID Kolom: </span>
                                    <code>{editingColumnKey}</code>
                                </div>
                            )}
                    </ModalBody>
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => setShowColumnModal(false)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={saveColumn}
                            isLoading={savingColumn}
                            disabled={!columnForm.label.trim()}
                            leftIcon={<i className="bi bi-check-lg" />}
                        >
                            {editingColumnKey ? 'Simpan Perubahan' : 'Tambah Kolom'}
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* MODAL - Delete Column Confirmation */}
            {showDeleteColumnModal && (
                <Modal
                    size="sm"
                    variant="delete"
                    onClose={() => { setShowDeleteColumnModal(false); setDeletingColumnKey(null); }}
                    labelledBy="dropdown-delete-column-title"
                >
                    <ModalHeader
                        id="dropdown-delete-column-title"
                        icon="trash3"
                        title={columns.find(c => c.key === deletingColumnKey)?.label || 'Kolom'}
                        onClose={() => { setShowDeleteColumnModal(false); setDeletingColumnKey(null); }}
                    />
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => { setShowDeleteColumnModal(false); setDeletingColumnKey(null); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button type="button" variant="danger" onClick={executeDeleteColumn} isLoading={savingColumn} leftIcon={<i className="bi bi-trash3-fill" />}>
                            Ya, Hapus Kolom
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                /* =====================================================
                   MASTER DROPDOWN — CONSISTENT WITH OTHER TABS
                ===================================================== */
                .md {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

                /* Toolbar */
                .md__toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                }
                .md__toolbarLeft {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .md__count {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.82rem;
                    color: var(--n-muted);
                    font-weight: 600;
                }
                .md__toolbarRight {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                /* Buttons */
                .md__btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                .md__btn--export {
                    background: #f0fdf4;
                    color: #15803d;
                    border: 1px solid #bbf7d0;
                }
                .md__btn--export:hover { background: #dcfce7; }
                .md__btn--import {
                    background: #eff6ff;
                    color: #1d4ed8;
                    border: 1px solid #bfdbfe;
                }
                .md__btn--import:hover { background: #dbeafe; }
                .md__btn--import.disabled { opacity: 0.6; cursor: not-allowed; }
                .md__btn--addCol {
                    background: linear-gradient(135deg, #3b82f6, #3083FF);
                    color: white;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                }
                .md__btn--addCol:hover { opacity: 0.9; transform: translateY(-1px); }
                .hidden-input { display: none; }

                /* Loading */
                .md__loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px;
                    color: var(--n-muted);
                    gap: 12px;
                }
                .md__spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid rgba(148, 163, 184, 0.2);
                    border-top-color: var(--n-primary);
                    border-radius: 50%;
                    animation: spin 0.75s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Grid (Stacked Rows) */
                .md__grid {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    width: 100%;
                }

                /* Card */
                .md__card {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
                    display: flex;
                    flex-direction: column;
                    max-height: 260px;
                }
                .md__cardHeader {
                    padding: 12px 16px;
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .md__cardTitle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.88rem;
                    font-weight: 700;
                    color: var(--n-text);
                }
                .md__cardTitle i { color: #3b82f6; }
                .md__badge {
                    font-size: 0.6rem;
                    padding: 2px 6px;
                    background: #e2e8f0;
                    color: var(--n-muted);
                    border-radius: 4px;
                    font-weight: 600;
                }
                .md__cardActions {
                    display: flex;
                    gap: 4px;
                }
                .md__iconBtn {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.8rem;
                }
                .md__iconBtn--edit {
                    background: transparent;
                    color: #3b82f6;
                }
                .md__iconBtn--edit:hover { background: #eff6ff; }
                .md__iconBtn--delete {
                    background: transparent;
                    color: #ef4444;
                }
                .md__iconBtn--delete:hover { background: #fef2f2; }
                .md__addBtn {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    background: var(--n-card);
                    color: var(--n-text);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .md__addBtn:hover {
                    background: #eff6ff;
                    border-color: #3b82f6;
                    color: #3b82f6;
                }

                /* Card Body */
                .md__cardBody {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                }
                .md__list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .md__listItem {
                    padding: 10px 16px;
                    border-bottom: 1px solid var(--n-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background 0.15s;
                }
                .md__listItem:hover { background: var(--n-soft); }
                .md__listItem:last-child { border-bottom: none; }
                .md__listValue {
                    font-size: 0.85rem;
                    color: var(--n-text);
                    font-weight: 500;
                }
                .md__listActions {
                    display: flex;
                    gap: 4px;
                    opacity: 0;
                    transition: opacity 0.15s;
                }
                .md__listItem:hover .md__listActions { opacity: 1; }
                .md__empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    color: var(--n-muted);
                    gap: 8px;
                }
                .md__empty i { font-size: 1.5rem; }
                .md__empty span { font-size: 0.82rem; font-style: italic; }

                /* Card Footer */
                .md__cardFooter {
                    padding: 8px 16px;
                    background: var(--n-soft);
                    border-top: 1px solid var(--n-border);
                }
                .md__itemCount {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                    font-weight: 600;
                }
                @keyframes zoomIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .md__hint { font-size: 0.75rem; color: var(--n-muted); margin: 0; }
                .md__keyDisplay {
                    margin-top: 12px;
                    padding: 12px;
                    background: var(--n-soft);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.75rem;
                    color: var(--n-muted);
                }
                .md__keyDisplay code {
                    font-size: 0.85rem;
                    color: #3b82f6;
                    font-weight: 600;
                }

                /* Dark Mode */
                :global(.dark) .md__toolbar { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 16px !important; }
                :global(.dark) .md__count { color: #94a3b8 !important; }
                :global(.dark) .md__btn--export { background: rgba(16,185,129,0.1) !important; color: #4ade80 !important; border-color: rgba(34,197,94,0.3) !important; }
                :global(.dark) .md__btn--import { background: rgba(59,130,246,0.1) !important; color: #7aabf9 !important; border-color: rgba(59,130,246,0.3) !important; }
                :global(.dark) .md__card { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 16px !important; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important; }
                :global(.dark) .md__cardHeader { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important; }
                :global(.dark) .md__cardTitle { color: #ffffff !important; }
                :global(.dark) .md__badge { background: rgba(26, 115, 232, 0.2) !important; color: #60a5fa !important; }
                :global(.dark) .md__listItem { border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .md__listItem:hover { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .md__listValue { color: #ffffff !important; }
                :global(.dark) .md__cardFooter { background: #000000 !important; border-top: 1px solid rgba(37, 99, 235, 0.4) !important; }
                :global(.dark) .md__itemCount { color: #94a3b8 !important; }
                :global(.dark) .md__iconBtn--edit { color: #60a5fa !important; }
                :global(.dark) .md__iconBtn--edit:hover { background: rgba(59,130,246,0.15) !important; }
                :global(.dark) .md__iconBtn--delete { color: #f87171 !important; }
                :global(.dark) .md__iconBtn--delete:hover { background: rgba(239,68,68,0.15) !important; }
                :global(.dark) .md__addBtn { background: #000000 !important; border-color: rgba(26, 115, 232, 0.5) !important; color: #60a5fa !important; }
                :global(.dark) .md__addBtn:hover { background: rgba(59,130,246,0.15) !important; color: #7aabf9 !important; border-color: #3b82f6 !important; }
                :global(.dark) .md__empty { color: #64748b !important; }
                :global(.dark) .md__hint { color: #94a3b8 !important; }
                :global(.dark) .md__keyDisplay { background: rgba(26, 115, 232, 0.1) !important; border: 1px solid rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .md__keyDisplay code { color: #60a5fa !important; }
                :global(.dark) .md__loading { color: #94a3b8 !important; }

                @media (max-width: 768px) {
                    .md__grid { grid-template-columns: 1fr; }
                    .md__toolbar { flex-direction: column; gap: 12px; align-items: stretch; }
                    .md__toolbarRight { flex-wrap: nowrap; width: 100%; gap: 6px; }
                    .md__btn { flex: 1; justify-content: center; padding: 10px 4px; font-size: 0.75rem; white-space: nowrap; min-width: 0; }
                    .md__listActions { opacity: 1 !important; }
                }
            `}</style>
        </div>
    )
}