'use client'

/**
 * Tab Relasi Orang Tua ↔ Siswa (halaman Pengaturan Data).
 * Semua role dengan akses pengaturan-data bisa MELIHAT relasi;
 * tambah / ubah status / hapus hanya untuk ADMIN.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Swal from 'sweetalert2'
import { Spinner } from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { usePengaturanDataAccess } from '@/lib/use-pengaturan-data-access'

interface Relation {
    id: string
    user_id: number
    nisn: string
    status_keluarga: string
    created_at: string
    ortu_nama: string
    ortu_email: string
    ortu_aktif: boolean
    siswa_nama: string
    siswa_kelas: string
}

interface ParentAccount {
    id: number
    nama: string
    email: string
    aktif: boolean
    jumlah_anak: number
}

interface SiswaResult {
    nisn: string
    nama_lengkap: string
    kelas: string
    jumlah_ortu: number
}

const STATUS_OPTIONS = ['Ayah', 'Ibu', 'Wali']

function statusBadge(status: string, isDark: boolean = false) {
    if (status === 'Ayah') {
        return {
            bg: isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.12)',
            fg: isDark ? '#60a5fa' : '#1e40af',
            border: isDark ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(147, 197, 253, 0.7)'
        }
    }
    if (status === 'Ibu') {
        return {
            bg: isDark ? 'rgba(6, 182, 212, 0.22)' : 'rgba(6, 182, 212, 0.12)',
            fg: isDark ? '#22d3ee' : '#0e7490',
            border: isDark ? '1px solid rgba(34, 211, 238, 0.45)' : '1px solid rgba(165, 243, 252, 0.7)'
        }
    }
    // Wali
    return {
        bg: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)',
        fg: isDark ? '#a5b4fc' : '#3730a3',
        border: isDark ? '1px solid rgba(165, 180, 252, 0.45)' : '1px solid rgba(199, 210, 254, 0.7)'
    }
}


function formatTanggal(iso: string) {
    if (!iso) return '-'
    try {
        return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
        return '-'
    }
}

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanDataAccess(), bukan dari objek user. Propnya tetap diterima
// agar pemanggil (view.tsx) tidak perlu diubah.
export default function RelasiOrangtuaTab(_props: { user?: unknown }) {
    /**
     * Menautkan, mengubah status, dan menghapus relasi mengikuti wewenang TAB —
     * ADMIN (melekat di kode) atau akun/role yang ditunjuk di Pengaturan Users ->
     * Hak Akses Fitur. Server menegakkan hal yang sama lewat `requireAccess`.
     *
     * Dulu `canEdit = isAdmin`, jadi penerima Hak Akses Fitur hanya bisa melihat
     * dan seluruh tombolnya tetap mati. Sebelum itu lagi, pemeriksaannya memakai
     * `user.role.toUpperCase().includes('ADMIN')` — pencocokan SUBSTRING, sehingga
     * role seperti `ADMINISTRASI` atau `WAKIL_ADMIN` ikut lolos.
     */
    const { boleh } = usePengaturanDataAccess()
    const canEdit = boleh('relasi_ortu')

    const [isDark, setIsDark] = useState(false)
    useEffect(() => {
        const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'))
        checkDark()
        const observer = new MutationObserver(checkDark)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    const [relations, setRelations] = useState<Relation[]>([])
    const [parents, setParents] = useState<ParentAccount[]>([])
    // Jumlah seluruh relasi menurut server. `relations` dibatasi per permintaan,
    // jadi panjang array itu bukan angka yang benar untuk ditampilkan.
    const [totalRelasi, setTotalRelasi] = useState(0)
    const [terpotong, setTerpotong] = useState(false)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'Ayah' | 'Ibu' | 'Wali'>('all')

    // Action Menu State (Mobile)
    const [showActionMenu, setShowActionMenu] = useState(false)
    const actionMenuRef = useRef<HTMLDivElement>(null)
    const [showMoreMenu, setShowMoreMenu] = useState(false)
    const moreMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Mobile Action Sheet Drawer State
    const [mobileAction, setMobileAction] = useState<{ open: boolean; item: Relation | null }>({ open: false, item: null })

    // Mobile Touch Gesture Swipe Navigation
    const touchStartX = useRef<number | null>(null)
    const touchEndX = useRef<number | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX
        touchEndX.current = e.targetTouches[0].clientX
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX
    }

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return
        const diff = touchStartX.current - touchEndX.current
        const minSwipeDistance = 50

        // Relasi tab has no pagination currently, but touch handlers ready if added
        touchStartX.current = null
        touchEndX.current = null
    }

    useEffect(() => {
        if (!showActionMenu) return
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setShowActionMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showActionMenu])


    // Modal tambah relasi
    const [showAddModal, setShowAddModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedParent, setSelectedParent] = useState<ParentAccount | null>(null)
    const [parentQuery, setParentQuery] = useState('')
    const [parentDropdownOpen, setParentDropdownOpen] = useState(false)
    const [selectedSiswa, setSelectedSiswa] = useState<SiswaResult | null>(null)
    const [siswaQuery, setSiswaQuery] = useState('')
    const [siswaResults, setSiswaResults] = useState<SiswaResult[]>([])
    const [siswaSearching, setSiswaSearching] = useState(false)
    const [newStatus, setNewStatus] = useState('Ayah')
    const siswaDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Modal edit status
    const [editingRelation, setEditingRelation] = useState<Relation | null>(null)
    const [editStatus, setEditStatus] = useState('Ayah')

    // Modal blur — sebelumnya `useModalBlur` di-import tapi tidak pernah
    // dipanggil, jadi modal Tambah/Edit di sini tidak pernah bikin
    // latar belakang blur seperti tab lain.
    const { registerModal } = useModalBlur()
    useEffect(() => {
        if (showAddModal || editingRelation) return registerModal()
    }, [showAddModal, editingRelation, registerModal])

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/orangtua-siswa')
            const data = await res.json()
            if (data.ok) {
                setRelations(data.relations || [])
                setParents(data.parents || [])
                setTotalRelasi(typeof data.total === 'number' ? data.total : (data.relations || []).length)
                setTerpotong(!!data.truncated)
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: data.error || 'Gagal memuat data' })
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat terhubung ke server' })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // Pencarian siswa (debounced) untuk modal tambah
    useEffect(() => {
        if (siswaDebounce.current) clearTimeout(siswaDebounce.current)
        const q = siswaQuery.trim()
        if (q.length < 3) { setSiswaResults([]); return }
        siswaDebounce.current = setTimeout(async () => {
            setSiswaSearching(true)
            try {
                const res = await fetch(`/api/orangtua-siswa?siswa=${encodeURIComponent(q)}`)
                const data = await res.json()
                if (data.ok) setSiswaResults(data.data || [])
            } catch { /* abaikan; hasil lama tetap tampil */ }
            finally { setSiswaSearching(false) }
        }, 400)
        return () => { if (siswaDebounce.current) clearTimeout(siswaDebounce.current) }
    }, [siswaQuery])

    const filteredRelations = useMemo(() => {
        let list = relations
        if (statusFilter !== 'all') list = list.filter(r => r.status_keluarga === statusFilter)
        const q = searchQuery.trim().toLowerCase()
        if (q) {
            list = list.filter(r =>
                r.ortu_nama.toLowerCase().includes(q) ||
                r.ortu_email.toLowerCase().includes(q) ||
                r.siswa_nama.toLowerCase().includes(q) ||
                r.nisn.toLowerCase().includes(q) ||
                r.siswa_kelas.toLowerCase().includes(q)
            )
        }
        return list
    }, [relations, searchQuery, statusFilter])

    const filteredParents = useMemo(() => {
        const q = parentQuery.trim().toLowerCase()
        if (!q) return parents
        return parents.filter(p => p.nama.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    }, [parents, parentQuery])

    const stats = useMemo(() => ({
        totalRelasi,
        totalOrtu: parents.length,
        totalSiswa: new Set(relations.map(r => r.nisn)).size,
        ortuTanpaAnak: parents.filter(p => p.jumlah_anak === 0).length,
    }), [relations, parents, totalRelasi])

    const resetAddModal = () => {
        setShowAddModal(false)
        setSelectedParent(null)
        setParentQuery('')
        setParentDropdownOpen(false)
        setSelectedSiswa(null)
        setSiswaQuery('')
        setSiswaResults([])
        setNewStatus('Ayah')
    }

    const handleAdd = async () => {
        if (!selectedParent || !selectedSiswa) {
            Swal.fire({ icon: 'warning', title: 'Belum lengkap', text: 'Pilih akun orang tua dan siswa terlebih dahulu.' })
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/orangtua-siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: selectedParent.id, nisn: selectedSiswa.nisn, status_keluarga: newStatus })
            })
            const data = await res.json()
            if (data.ok) {
                resetAddModal()
                Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message, timer: 2000, showConfirmButton: false })
                fetchData()
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: data.error })
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat terhubung ke server' })
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = async () => {
        if (!editingRelation) return
        setSaving(true)
        try {
            const res = await fetch('/api/orangtua-siswa', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingRelation.id, status_keluarga: editStatus })
            })
            const data = await res.json()
            if (data.ok) {
                setEditingRelation(null)
                Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message, timer: 2000, showConfirmButton: false })
                fetchData()
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: data.error })
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat terhubung ke server' })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (rel: Relation) => {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Hapus relasi ini?',
            html: `Akun <b>${rel.ortu_nama}</b> tidak akan bisa lagi melihat data siswa <b>${rel.siswa_nama}</b>.<br/><small>Akun orang tua tetap ada — hanya tautannya yang dihapus.</small>`,
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
        })
        if (!confirm.isConfirmed) return
        try {
            const res = await fetch(`/api/orangtua-siswa?id=${encodeURIComponent(rel.id)}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message, timer: 2000, showConfirmButton: false })
                fetchData()
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: data.error })
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat terhubung ke server' })
        }
    }

    return (
        <>
            <div className="ors-page">
                {/* Stats */}
                <div className="ors-stats">
                    <div className="ors-stat">
                        <div className="ors-statIcon" style={{ background: isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.12)', color: isDark ? '#60a5fa' : '#1d4ed8' }}>
                            <i className="bi bi-link-45deg"></i>
                        </div>
                        <div><div className="ors-statValue">{stats.totalRelasi}</div><div className="ors-statLabel">Total Relasi</div></div>
                    </div>
                    <div className="ors-stat">
                        <div className="ors-statIcon" style={{ background: isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(14, 165, 233, 0.12)', color: isDark ? '#38bdf8' : '#0284c7' }}>
                            <i className="bi bi-people-fill"></i>
                        </div>
                        <div><div className="ors-statValue">{stats.totalOrtu}</div><div className="ors-statLabel">Akun Orang Tua</div></div>
                    </div>
                    <div className="ors-stat">
                        <div className="ors-statIcon" style={{ background: isDark ? 'rgba(129, 140, 248, 0.22)' : 'rgba(99, 102, 241, 0.12)', color: isDark ? '#818cf8' : '#4338ca' }}>
                            <i className="bi bi-mortarboard-fill"></i>
                        </div>
                        <div><div className="ors-statValue">{stats.totalSiswa}</div><div className="ors-statLabel">Siswa Terklaim</div></div>
                    </div>
                    <div className="ors-stat">
                        <div className="ors-statIcon" style={{ background: isDark ? 'rgba(6, 182, 212, 0.22)' : 'rgba(2, 132, 199, 0.12)', color: isDark ? '#22d3ee' : '#0369a1' }}>
                            <i className="bi bi-person-dash"></i>
                        </div>
                        <div><div className="ors-statValue">{stats.ortuTanpaAnak}</div><div className="ors-statLabel">Akun Tanpa Anak</div></div>
                    </div>

                </div>

                {/* Toolbar */}
                <FilterToolbar actionsInline>
                    <FilterSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Cari nama ortu, email, nama siswa, NISN, kelas…"
                    />

                    <FilterSelect
                        label="Hubungan"
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val as any)}
                        options={[
                            { value: 'all', label: 'Semua Status' },
                            { value: 'Ayah', label: 'Ayah' },
                            { value: 'Ibu', label: 'Ibu' },
                            { value: 'Wali', label: 'Wali' }
                        ]}
                    />

                </FilterToolbar>

                {/* Server membatasi jumlah baris per permintaan; tanpa pemberitahuan
                    ini, daftar yang terpotong tampak seperti daftar lengkap. */}
                {terpotong && !loading && (
                    <div className="ors-card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <i className="bi bi-exclamation-triangle" style={{ color: 'var(--n-warning, #f59e0b)' }}></i>
                        <span style={{ fontSize: '0.875rem' }}>
                            Menampilkan {relations.length} dari {totalRelasi} relasi. Gunakan pencarian untuk menemukan data tertentu.
                        </span>
                    </div>
                )}

                {/* Tabel relasi */}
                <div className="ors-card">
                    {loading ? (
                        <div className="ors-loading"><Spinner variant="trace" /></div>
                    ) : filteredRelations.length === 0 ? (
                        <div className="ors-empty">
                            <i className="bi bi-inbox"></i>
                            <p>{relations.length === 0 ? 'Belum ada relasi orang tua–siswa.' : 'Tidak ada relasi yang cocok dengan pencarian.'}</p>
                        </div>
                    ) : (
                        <>
                            <div className="ors-desktopOnly ors-tableWrap">
                                <table className="ors-table">
                                    <thead>
                                        <tr>
                                            <th>Orang Tua</th>
                                            <th>Status</th>
                                            <th>Siswa</th>
                                            <th>Kelas</th>
                                            <th>Ditautkan</th>
                                            {canEdit && <th style={{ textAlign: 'right' }}>Aksi</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRelations.map(rel => {
                                            const badge = statusBadge(rel.status_keluarga, isDark)
                                            return (
                                                <tr key={rel.id}>
                                                    <td>
                                                        <div className="ors-ortu">
                                                            <span className="ors-ortuNama">
                                                                {rel.ortu_nama}
                                                                {!rel.ortu_aktif && <span className="ors-inactive">nonaktif</span>}
                                                            </span>
                                                            <span className="ors-ortuEmail">{rel.ortu_email}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="ors-badge" style={{ background: badge.bg, color: badge.fg, border: badge.border }}>
                                                            {rel.status_keluarga}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="ors-ortu">
                                                            <span className="ors-ortuNama">{rel.siswa_nama}</span>
                                                            <span className="ors-ortuEmail">NISN {rel.nisn}</span>
                                                        </div>
                                                    </td>
                                                    <td>{rel.siswa_kelas || '-'}</td>
                                                    <td className="ors-tanggal">{formatTanggal(rel.created_at)}</td>
                                                    {canEdit && (
                                                        <td>
                                                            <ActionGroup>
                                                                <ActionButton
                                                                    action="edit"
                                                                    title="Ubah Status"
                                                                    onClick={() => { setEditingRelation(rel); setEditStatus(rel.status_keluarga) }}
                                                                />
                                                                <ActionButton
                                                                    action="delete"
                                                                    title="Hapus"
                                                                    onClick={() => handleDelete(rel)}
                                                                />
                                                            </ActionGroup>
                                                        </td>
                                                    )}
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Mobile Cards */}
                            <div
                                className="sk__cards"
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                {filteredRelations.map(rel => (
                                    <div
                                        className="sk__cardCompact"
                                        key={rel.id}
                                        onClick={() => setMobileAction({ open: true, item: rel })}
                                    >
                                        <div className="sk__avatar">
                                            <span className="sk__avatarText">
                                                {rel.ortu_nama ? rel.ortu_nama.charAt(0).toUpperCase() : 'O'}
                                            </span>
                                        </div>
                                        <div className="sk__cardCompactLeft">
                                            <div className="sk__cardName">
                                                {rel.ortu_nama} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3083FF', marginLeft: 4 }}>({rel.status_keluarga})</span>
                                            </div>
                                            <div className="sk__cardNip">
                                                <span>Siswa: {rel.siswa_nama}</span>
                                                <span>· {rel.siswa_kelas ? `Kelas ${rel.siswa_kelas}` : `NISN ${rel.nisn}`}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Aksi utama tab: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
                            {canEdit && <DesktopFab label="Tambah Relasi" icon="person-plus-fill" onClick={() => setShowAddModal(true)} />}
                            {canEdit && <MobileFab label="Tambah Relasi" icon="person-plus-fill" onClick={() => setShowAddModal(true)} />}

                            {/* Sheet */}
                            {mobileAction.open && mobileAction.item && (
                                <div className="sk__sheetOverlay" onClick={e => e.target === e.currentTarget && setMobileAction({ open: false, item: null })}>
                                    <div className="sk__sheet">
                                        <div className="sk__sheetHandle"></div>
                                        <div className="sk__sheetTitle">
                                            <div className="sk__sheetName">{mobileAction.item.ortu_nama} ({mobileAction.item.status_keluarga})</div>
                                            <div className="sk__sheetSub">
                                                Siswa: {mobileAction.item.siswa_nama} · {mobileAction.item.siswa_kelas ? `Kelas ${mobileAction.item.siswa_kelas}` : `NISN ${mobileAction.item.nisn}`}
                                            </div>
                                        </div>
                                        <div className="sk__sheetActions">
                                            {canEdit && <button className="sk__sheetBtn" onClick={() => { const item = mobileAction.item!; setMobileAction({ open: false, item: null }); setEditingRelation(item); setEditStatus(item.status_keluarga); }}>
                                                <i className="bi bi-pencil"></i> Edit Status Keluarga
                                            </button>}
                                            {canEdit && <button className="sk__sheetBtn danger" onClick={() => { const item = mobileAction.item!; setMobileAction({ open: false, item: null }); handleDelete(item); }}>
                                                <i className="bi bi-trash"></i> Hapus Relasi
                                            </button>}
                                        </div>
                                        <button className="sk__sheetCancel" onClick={() => setMobileAction({ open: false, item: null })}>Batal</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal tambah relasi */}
            {canEdit && showAddModal && (
                <Modal size="md" variant="add" onClose={resetAddModal} labelledBy="add-relasi-title">
                    <ModalHeader id="add-relasi-title" icon="person-plus-fill" title="Tambah Relasi" onClose={resetAddModal} />
                    <ModalBody>
                        {/* Pilih akun orang tua */}
                        <label className="ors-label">Akun Orang Tua</label>
                        {selectedParent ? (
                            <div className="ors-selected">
                                <div>
                                    <b>{selectedParent.nama}</b>
                                    <span>{selectedParent.email} · {selectedParent.jumlah_anak} anak tertaut</span>
                                </div>
                                <button type="button" onClick={() => setSelectedParent(null)}><i className="bi bi-x-lg"></i></button>
                            </div>
                        ) : (
                            <div className="ors-combo">
                                <input
                                    type="text"
                                    placeholder="Cari nama / email akun orang tua…"
                                    value={parentQuery}
                                    onChange={e => { setParentQuery(e.target.value); setParentDropdownOpen(true) }}
                                    onFocus={() => setParentDropdownOpen(true)}
                                />
                                {parentDropdownOpen && (
                                    <div className="ors-dropdown">
                                        {filteredParents.length === 0 ? (
                                            <div className="ors-dropEmpty">Tidak ada akun ORANG_TUA yang cocok</div>
                                        ) : filteredParents.slice(0, 30).map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => { setSelectedParent(p); setParentDropdownOpen(false) }}
                                            >
                                                <b>{p.nama}</b>
                                                <span>{p.email} · {p.jumlah_anak} anak {!p.aktif ? '· nonaktif' : ''}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Pilih siswa */}
                        <label className="ors-label" style={{ marginTop: 12 }}>Siswa</label>
                        {selectedSiswa ? (
                            <div className="ors-selected">
                                <div>
                                    <b>{selectedSiswa.nama_lengkap}</b>
                                    <span>NISN {selectedSiswa.nisn}{selectedSiswa.kelas ? ` · ${selectedSiswa.kelas}` : ''} · {selectedSiswa.jumlah_ortu}/2 ortu</span>
                                </div>
                                <button type="button" onClick={() => setSelectedSiswa(null)}><i className="bi bi-x-lg"></i></button>
                            </div>
                        ) : (
                            <div className="ors-combo">
                                <input
                                    type="text"
                                    placeholder="Ketik min. 3 huruf nama atau NISN siswa…"
                                    value={siswaQuery}
                                    onChange={e => setSiswaQuery(e.target.value)}
                                />
                                {siswaQuery.trim().length >= 3 && (
                                    <div className="ors-dropdown">
                                        {siswaSearching ? (
                                            <div className="ors-dropEmpty">Mencari…</div>
                                        ) : siswaResults.length === 0 ? (
                                            <div className="ors-dropEmpty">Siswa tidak ditemukan</div>
                                        ) : siswaResults.map(s => (
                                            <button
                                                key={s.nisn}
                                                type="button"
                                                disabled={s.jumlah_ortu >= 2}
                                                onClick={() => { setSelectedSiswa(s); setSiswaQuery('') }}
                                            >
                                                <b>{s.nama_lengkap}</b>
                                                <span>NISN {s.nisn}{s.kelas ? ` · ${s.kelas}` : ''} · {s.jumlah_ortu}/2 ortu{s.jumlah_ortu >= 2 ? ' (penuh)' : ''}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Status keluarga */}
                        <label className="ors-label" style={{ marginTop: 12 }}>Status Keluarga</label>
                        <div className="ors-radios">
                            {STATUS_OPTIONS.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`ors-radio ${newStatus === s ? 'isActive' : ''}`}
                                    onClick={() => setNewStatus(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={resetAddModal} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button variant="primary" type="button" onClick={handleAdd} isLoading={saving} disabled={saving || !selectedParent || !selectedSiswa} leftIcon={<i className="bi bi-check-lg" />}>
                            Simpan Relasi
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Modal edit status */}
            {canEdit && editingRelation && (
                <Modal size="md" variant="edit" onClose={() => setEditingRelation(null)} labelledBy="edit-relasi-title">
                    <ModalHeader id="edit-relasi-title" icon="pencil-square" title="Ubah Status Keluarga" onClose={() => setEditingRelation(null)} />
                    <ModalBody>
                        <div className="ors-selected" style={{ marginBottom: 12 }}>
                            <div>
                                <b>{editingRelation.ortu_nama}</b>
                                <span>→ {editingRelation.siswa_nama} (NISN {editingRelation.nisn})</span>
                            </div>
                        </div>
                        <label className="ors-label">Status Keluarga</label>
                        <div className="ors-radios">
                            {STATUS_OPTIONS.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`ors-radio ${editStatus === s ? 'isActive' : ''}`}
                                    onClick={() => setEditStatus(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => setEditingRelation(null)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button variant="primary" type="button" onClick={handleEdit} isLoading={saving} disabled={saving || editStatus === editingRelation.status_keluarga} leftIcon={<i className="bi bi-check-lg" />}>
                            Simpan
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .ors-page { display: flex; flex-direction: column; gap: 14px; font-family: 'Poppins', sans-serif; }

                .ors-btnAdd {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    color: white;
                    border: none; border-radius: 12px; padding: 10px 18px;
                    font-weight: 700; font-size: 0.85rem; cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
                    white-space: nowrap;
                    transition: transform 0.15s;
                }
                .ors-btnAdd:hover { transform: translateY(-1px); }

                .ors-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                .ors-stat {
                    background: var(--n-card); border: 1px solid var(--n-border);
                    border-radius: 14px; padding: 14px 16px;
                    display: flex; align-items: center; gap: 12px;
                }
                .ors-statIcon {
                    width: 42px; height: 42px; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.2rem; flex-shrink: 0;
                }
                .ors-statValue { font-size: 1.3rem; font-weight: 800; color: var(--n-text); line-height: 1.1; }
                .ors-statLabel { font-size: 0.75rem; color: var(--n-muted); }

                .ors-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
                .ors-search {
                    flex: 1; min-width: 240px;
                    display: flex; align-items: center; gap: 8px;
                    background: var(--n-card); border: 1px solid var(--n-border);
                    border-radius: 12px; padding: 9px 14px;
                }
                .ors-search i { color: var(--n-muted); }
                .ors-search input {
                    flex: 1; border: none; outline: none; background: transparent;
                    font-size: 0.875rem; color: var(--n-text);
                }
                .ors-toolbarActions { display: flex; align-items: center; gap: 10px; flex: 1; }
                .ors-filters { display: flex; gap: 6px; flex: 1; min-width: 0; }
                .ors-selectFilter {
                    padding: 9px 42px 9px 14px; border-radius: 12px; width: 100%;
                    border: 1px solid var(--n-border); background: var(--n-card);
                    font-size: 0.875rem; font-weight: 600; color: var(--n-text);
                    outline: none; cursor: pointer; font-family: inherit;
                    min-width: 0;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 16px center;
                }

                .ors-card {
                    background: var(--n-card); border: 1px solid var(--n-border);
                    border-radius: 16px; overflow: hidden;
                }
                .ors-loading { display: flex; align-items: center; justify-content: center; padding: 48px; }
                .ors-empty { text-align: center; padding: 48px 16px; color: var(--n-muted); }
                .ors-empty i { font-size: 2rem; display: block; margin-bottom: 8px; }

                .ors-tableWrap { overflow-x: auto; }
                .ors-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .ors-table th {
                    text-align: left; padding: 12px 16px;
                    font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
                    color: var(--n-muted); border-bottom: 1px solid var(--n-border);
                    background: rgba(0,0,0,0.02);
                    white-space: nowrap;
                }
                .ors-table td { padding: 12px 16px; border-bottom: 1px solid var(--n-border); color: var(--n-text); vertical-align: middle; }
                .ors-table tr:last-child td { border-bottom: none; }
                .ors-table tr:hover td { background: rgba(0,56,168,0.02); }

                .ors-ortu { display: flex; flex-direction: column; gap: 2px; }
                .ors-ortuNama { font-weight: 600; display: flex; align-items: center; gap: 6px; }
                .ors-ortuEmail { font-size: 0.75rem; color: var(--n-muted); }
                .ors-inactive {
                    font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
                    background: #fee2e2; color: #991b1b;
                    padding: 1px 6px; border-radius: 6px;
                }
                .ors-badge { padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; }
                .ors-tanggal { white-space: nowrap; color: var(--n-muted); }

                .ors-actions { display: flex; gap: 6px; justify-content: flex-end; }
                .ors-iconBtn {
                    width: 32px; height: 32px; border-radius: 9px;
                    border: 1px solid var(--n-border); background: var(--n-card);
                    color: var(--n-muted); cursor: pointer;
                    display: inline-flex; align-items: center; justify-content: center;
                    transition: all 0.15s;
                }
                .ors-iconBtn:hover { color: var(--n-primary); border-color: var(--n-primary); }
                .ors-iconBtn.isDanger:hover { color: #dc2626; border-color: #dc2626; }

                /* MODAL */
                .ors-overlay {
                    position: fixed; inset: 0; z-index: 1000;
                    background: rgba(15,23,42,0.55);
                    display: flex; align-items: center; justify-content: center;
                    padding: 16px;
                }
                .ors-modal {
                    background: var(--n-card); border-radius: 18px;
                    width: 100%; max-width: 480px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.25);
                    display: flex; flex-direction: column;
                    max-height: 90vh;
                }
                .ors-modalHead {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 16px 20px; border-bottom: 1px solid var(--n-border);
                }
                .ors-modalHead h2 {
                    font-size: 1rem; font-weight: 700; color: var(--n-text); margin: 0;
                    display: flex; align-items: center; gap: 8px;
                }
                .ors-close {
                    border: none; background: transparent; color: var(--n-muted);
                    cursor: pointer; font-size: 0.9rem; padding: 4px;
                }
                .ors-modalBody { padding: 18px 20px; overflow-y: auto; }
                .ors-modalFoot {
                    display: flex; justify-content: flex-end; gap: 8px;
                    padding: 14px 20px; border-top: 1px solid var(--n-border);
                }

                .ors-label {
                    display: block; font-size: 0.75rem; font-weight: 700;
                    color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.04em;
                    margin: 14px 0 6px;
                }
                .ors-label:first-child { margin-top: 0; }

                .ors-combo { position: relative; }
                .ors-combo input {
                    width: 100%; padding: 10px 14px;
                    border: 1px solid var(--n-border); border-radius: 10px;
                    background: transparent; color: var(--n-text);
                    font-size: 0.875rem; outline: none;
                }
                .ors-combo input:focus { border-color: var(--n-primary); }
                .ors-dropdown {
                    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10;
                    background: var(--n-card); border: 1px solid var(--n-border);
                    border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                    max-height: 220px; overflow-y: auto;
                }
                .ors-dropdown button {
                    display: flex; flex-direction: column; gap: 1px;
                    width: 100%; text-align: left;
                    padding: 9px 14px; border: none; background: transparent;
                    cursor: pointer; color: var(--n-text); font-size: 0.85rem;
                }
                .ors-dropdown button:hover:not(:disabled) { background: rgba(0,56,168,0.05); }
                .ors-dropdown button:disabled { opacity: 0.45; cursor: not-allowed; }
                .ors-dropdown button span { font-size: 0.72rem; color: var(--n-muted); }
                .ors-dropEmpty { padding: 14px; text-align: center; font-size: 0.8rem; color: var(--n-muted); }

                .ors-selected {
                    display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    border: 1px solid var(--n-primary); background: rgba(0,56,168,0.05);
                    border-radius: 10px; padding: 10px 14px;
                }
                .ors-selected > div { display: flex; flex-direction: column; gap: 1px; }
                .ors-selected b { font-size: 0.875rem; color: var(--n-text); }
                .ors-selected span { font-size: 0.72rem; color: var(--n-muted); }
                .ors-selected button {
                    border: none; background: transparent; color: var(--n-muted);
                    cursor: pointer; padding: 4px;
                }

                .ors-radios { display: flex; gap: 8px; }
                .ors-radio {
                    flex: 1; padding: 9px; border-radius: 10px;
                    border: 1px solid var(--n-border); background: transparent;
                    font-size: 0.85rem; font-weight: 600; color: var(--n-muted); cursor: pointer;
                    transition: all 0.15s;
                }
                .ors-radio.isActive {
                    border-color: var(--n-primary); color: var(--n-primary);
                    background: rgba(0,56,168,0.06); font-weight: 700;
                }

                .ors-btnGhost {
                    padding: 9px 18px; border-radius: 10px;
                    border: 1px solid var(--n-border); background: transparent;
                    font-size: 0.85rem; font-weight: 600; color: var(--n-muted); cursor: pointer;
                }
                .ors-btnPrimary {
                    padding: 9px 18px; border-radius: 10px; border: none;
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    color: white; font-size: 0.85rem; font-weight: 700; cursor: pointer;
                }
                .ors-btnPrimary:disabled { opacity: 0.5; cursor: not-allowed; }

                /* Dark mode */
                :global(.dark) .ors-table th { background: rgba(255,255,255,0.03); }
                :global(.dark) .ors-table tr:hover td { background: rgba(255,255,255,0.03); }
                :global(.dark) .ors-inactive { background: rgba(220,38,38,0.2); color: #fca5a5; }
                :global(.dark) .ors-selectFilter {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                }

                /* ========= ACTION MENU (MOBILE) ========= */
                .sk__menuWrap {
                  position: relative;
                  display: inline-block;
                }

                .sk__btnActionMenu,
                .sk__btnMore {
                  min-width: 42px;
                  height: 36px;
                  min-height: 36px;
                  padding: 0 16px;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  background: #ffffff;
                  border: 1px solid #E1E2E9;
                  border-radius: 9999px;
                  color: #112E59;
                  font-size: 0.82rem;
                  font-weight: 600;
                  box-shadow: 0 1px 3px rgba(17, 46, 89, 0.04);
                  box-sizing: border-box;
                  cursor: pointer;
                  transition: all 0.15s ease;
                }

                .sk__btnActionMenu:hover,
                .sk__btnActionMenu.isOpen,
                .sk__btnMore:hover,
                .sk__btnMore.isOpen {
                  background: #E0ECFF;
                  border-color: #3083FF;
                  color: #112E59;
                }

                .sk__btnActionMenu i,
                .sk__btnMore i {
                  font-size: 1.1rem;
                  color: #112E59;
                  transition: color 0.15s ease;
                }

                .sk__menu {
                  position: absolute;
                  top: calc(100% + 6px);
                  left: 0;
                  z-index: 1000;
                  min-width: 190px;
                  width: max-content;
                  max-width: calc(100vw - 32px);
                  display: flex;
                  flex-direction: column;
                  gap: 6px;
                  padding: 8px;
                  border-radius: 16px;
                  background: #ffffff;
                  border: 1px solid #E1E2E9;
                  box-shadow: 0 12px 32px rgba(17, 46, 89, 0.12);
                  animation: skMenuIn 0.14s ease-out;
                }

                @keyframes skMenuIn {
                  from { opacity: 0; transform: translateY(-6px); }
                  to { opacity: 1; transform: translateY(0); }
                }

                .sk__menuItem {
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  width: 100%;
                  padding: 9px 14px;
                  border: 1px solid #E1E2E9;
                  background: #ffffff;
                  border-radius: 9999px;
                  text-align: left;
                  cursor: pointer;
                  font-size: 0.84rem;
                  font-weight: 600;
                  color: #112E59;
                  transition: all 0.15s ease;
                }

                .sk__menuItem:hover,
                .sk__menuItem:active {
                  background: #f8fafc;
                  border-color: #3083FF;
                  transform: translateY(-1px);
                }

                .sk__menuSep {
                  height: 1px;
                  background: #EBECF1;
                  margin: 2px 4px;
                }

                .sk__menuIcon {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 24px;
                  height: 24px;
                  flex-shrink: 0;
                }

                .sk__menuIcon i {
                  font-size: 1.05rem;
                  line-height: 1;
                  display: block;
                }

                .sk__menuLabel {
                  font-size: 0.84rem;
                  font-weight: 600;
                  color: var(--n-text, #0f172a);
                  white-space: nowrap;
                  flex: 1;
                }

                .sk__menuItemMobileOnly {
                  display: none !important;
                }

                @media (min-width: 640px) {
                  .sk__menuWrap { display: none !important; }
                }

                @media (max-width: 639px) {
                  .sk__menuItemMobileOnly {
                    display: flex !important;
                  }
                  .sk__menuSep.sk__menuItemMobileOnly {
                    display: block !important;
                  }
                  .sk__menu {
                    left: auto;
                    right: 0;
                  }
                  .sk__menuWrap .sk__btnActionMenu {
                    width: 42px !important;
                    min-width: 42px !important;
                    height: 42px !important;
                    min-height: 42px !important;
                    border-radius: 9999px !important;
                    flex: 0 0 auto !important;
                    padding: 0 !important;
                  }
                }

                @media (min-width: 768px) {
                    .ors-desktopOnly { display: block; }
                    .sk__cards { display: none !important; }
                }
                /* Mobile */
                @media (max-width: 767px) {
                    .ors-desktopOnly { display: none; }
                    .sk__cards {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        background: #ffffff;
                        border: 1px solid #E1E2E9;
                        border-radius: 16px;
                        box-shadow: 0 1px 4px rgba(17, 46, 89, 0.04);
                        padding: 6px;
                        overflow: hidden;
                        touch-action: pan-y;
                    }

                    .sk__cardCompact {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 12px;
                        padding: 11px 12px;
                        background: transparent;
                        border: none !important;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: background 0.15s ease;
                        box-sizing: border-box;
                    }

                    .sk__cardCompact:hover,
                    .sk__cardCompact:active {
                        background: #E0ECFF;
                    }

                    .sk__avatar {
                        width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #E0ECFF;
                        color: #1d6bf3;
                        font-weight: 700;
                        font-size: 0.85rem;
                        flex-shrink: 0;
                    }

                    .sk__avatarText {
                        line-height: 1;
                    }

                    .sk__cardCompactLeft {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        min-width: 0;
                        flex: 1 1 auto;
                    }

                    .sk__cardCompact:not(:last-child) .sk__cardCompactLeft {
                        border-bottom: 1px solid #E1E2E9;
                        padding-bottom: 9px;
                    }

                    :global(.dark) .sk__cardCompact:not(:last-child) .sk__cardCompactLeft {
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    }

                    .sk__cardCompactLeft .sk__cardName {
                        font-weight: 700;
                        font-size: 0.84rem;
                        line-height: 1.25;
                        color: #112E59;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .sk__cardCompactLeft .sk__cardNip {
                        font-size: 0.72rem;
                        color: #64748b;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex-wrap: wrap;
                    }
                    .ors-mobileCards { display: flex; flex-direction: column; gap: 12px; }
                    .ors-mCard {
                        background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px;
                        display: flex; flex-direction: column; gap: 12px; padding: 12px;
                    }
                    .ors-mCardHeader { border-bottom: 1px dashed var(--n-border); padding-bottom: 10px; }
                    .ors-mCardFooter {
                        display: flex; justify-content: flex-end; align-items: center; gap: 12px;
                        border-top: 1px dashed var(--n-border); padding-top: 10px;
                    }
                    .ors-stats { grid-template-columns: repeat(2, 1fr); }
                    .ors-toolbar { flex-direction: column; align-items: stretch; }
                    .ors-toolbarActions { width: 100%; display: flex; gap: 10px; }
                    .ors-btnAdd { flex-shrink: 0; white-space: nowrap; }
                    .ors-card { border: none; background: transparent; border-radius: 0; }
                }
                @media (min-width: 768px) {
                    .ors-mobileCards { display: none; }
                }

                :global(.dark) .sk__cards {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.65) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
                }

                :global(.dark) .sk__cardCompact {
                    background: transparent !important;
                    border: none !important;
                    border-bottom: 1px solid rgba(59, 130, 246, 0.18) !important;
                }

                :global(.dark) .sk__cardCompact:last-child {
                    border-bottom: none !important;
                }

                :global(.dark) .sk__cardCompact:hover,
                :global(.dark) .sk__cardCompact:active {
                    background: rgba(26, 115, 232, 0.12) !important;
                }

                :global(.dark) .sk__avatar {
                    background: rgba(26, 115, 232, 0.18) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(26, 115, 232, 0.5) !important;
                }

                :global(.dark) .sk__cardCompactLeft .sk__cardName {
                    color: #ffffff !important;
                }
                :global(.dark) .sk__cardCompactLeft .sk__cardNip {
                    color: #94a3b8 !important;
                }
            `}</style>
        </>
    )
}
