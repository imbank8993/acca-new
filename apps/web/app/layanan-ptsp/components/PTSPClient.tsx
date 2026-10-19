'use client'

type Row = any;

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Swal from 'sweetalert2'
import DatePicker from '@/components/ui/DatePicker'
import { useFileViewer } from '@/components/useFileViewer'
import Tab, { TabItem } from '@/components/ui/Tab'
import FilterToolbar, { FilterSearch } from '@/components/ui/FilterToolbar'
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons'
import { Button } from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Settings, Save } from 'lucide-react'
import { DesktopFab } from '@/components/ui/DesktopFab'
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalDetailGrid, ModalDetailField } from '@/components/ui/Modal'
import './ptsp-settings.css'

/* ──────────────────────────────────────────────────────────
   CONSTANTS & TYPES
────────────────────────────────────────────────────────── */
const PTSP_TABS = [
    { key: 'ptsp_master_tracking', label: 'Tracking', icon: 'qr-code', color: '#3083FF' },
    { key: 'ptsp_buku_tamu', label: 'Buku Tamu', icon: 'book', color: '#0891b2' },
    { key: 'ptsp_izin_magang', label: 'Izin Magang', icon: 'briefcase', color: '#d97706' },
    { key: 'ptsp_izin_siswa', label: 'Izin Siswa', icon: 'house-lock', color: '#059669' },
    { key: 'ptsp_legalisir', label: 'Legalisir', icon: 'filetype-pdf', color: '#dc2626' },
    { key: 'ptsp_mutasi_siswa', label: 'Mutasi', icon: 'arrow-left-right', color: '#3083FF' },
    { key: 'ptsp_pengaduan', label: 'Pengaduan', icon: 'megaphone-fill', color: '#dc2626' },
    { key: 'ptsp_pengganti_ijazah', label: 'Pengganti Ijazah', icon: 'file-earmark-diff', color: '#db2777' },
    { key: 'ptsp_peminjaman_sarana', label: 'Pinjam Sarana', icon: 'truck', color: '#0891b2' },
    { key: 'ptsp_izin_penelitian', label: 'Penelitian', icon: 'mortarboard', color: '#3083FF' },
    { key: 'ptsp_sosialisasi', label: 'Sosialisasi', icon: 'megaphone', color: '#ea580c' },
]

const FIELD_LABELS: Record<string, string> = {
    short_code: 'Short Code', no_wa: 'No. WA', service_type: 'Jenis Layanan',
    table_name: 'Nama Tabel', status: 'Status', progress: 'Progres', created_at: 'Tanggal',
    nama: 'Nama', wa: 'No. WA', instansi: 'Instansi', tujuan: 'Tujuan',
    bertemu_dengan: 'Bertemu Dengan', catatan_admin: 'Catatan Admin',
    kelas: 'Kelas', tanggal_mulai: 'Tgl Mulai', tanggal_selesai: 'Tgl Selesai',
    alasan: 'Alasan', sekolah_kampus: 'Sekolah/Kampus', jurusan: 'Jurusan',
    jenis_dokumen: 'Jenis Dokumen', jumlah_lembar: 'Jumlah Lembar',
    nama_siswa: 'Nama Siswa', nisn: 'NISN', jenis_kelamin: 'Jenis Kelamin',
    alasan_pindah: 'Alasan Pindah', alamat: 'Alamat',
    jenis: 'Jenis', target: 'Target',
    file_proposal: 'File Proposal', isi_laporan: 'Isi Laporan',
    file_bukti: 'File Bukti', jenis_laporan: 'Jenis Laporan',
    jenis_lainnya: 'Jenis Lainnya', judul_penelitian: 'Judul Penelitian',
    instansi_sekolah: 'Instansi/Sekolah',
}

/** Kolom file per tab — key: tab name, value: Record<columnName, label> */
const TAB_FILE_COLS: Record<string, Record<string, string>> = {
    ptsp_izin_magang: { file_surat_pengantar: 'Surat Pengantar' },
    ptsp_sosialisasi: { file_url: 'File Lampiran' },
    ptsp_legalisir: { file_dokumen: 'Dokumen' },
    ptsp_mutasi_siswa: { file_permohonan_ortu: 'Surat Permohonan Ortu', file_rekomendasi_tujuan: 'Surat Rekomendasi Tujuan' },
    ptsp_pengganti_ijazah: { file_copy_ijazah: 'Copy Ijazah', file_copy_ktp: 'Copy KTP', file_pas_foto: 'Pas Foto', file_surat_kehilangan: 'Surat Kehilangan' },
    ptsp_peminjaman_sarana: { file_proposal: 'File Proposal' },
    ptsp_izin_penelitian: { file_proposal: 'File Proposal' },
    ptsp_pengaduan: { file_bukti: 'File Bukti' },
}

const STATUS_STYLES: Record<string, { color: string; bg: string; dot: string; label: string }> = {
    '0': { color: '#ef4444', bg: '#fef2f2', dot: '#ef4444', label: 'Ditolak' },
    '1': { color: '#f59e0b', bg: '#fef9c3', dot: '#f59e0b', label: 'Pending' },
    'proses': { color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6', label: 'Proses' },
    '100': { color: '#22c55e', bg: '#f0fdf4', dot: '#22c55e', label: 'Selesai' },
}

const PAGE_SIZE = 20;

const PTSP_SERVICE_OPTIONS = [
    { id: 'buku-tamu', label: 'Buku Tamu' }, { id: 'sosialisasi', label: 'Sosialisasi' },
    { id: 'izin-siswa', label: 'Izin Siswa Asrama' }, { id: 'peminjaman-sarana', label: 'Peminjaman Sarana' },
    { id: 'izin-penelitian', label: 'Izin Penelitian' }, { id: 'legalisir', label: 'Legalisir Dokumen' },
    { id: 'ganti-ijazah', label: 'Pengganti Ijazah' }, { id: 'izin-magang', label: 'Permohonan Magang' },
    { id: 'mutasi-siswa', label: 'Mutasi Siswa' }, { id: 'pengaduan', label: 'Pengaduan Masyarakat' },
];
const DEFAULT_PTSP_CONFIG = { enabledServices: PTSP_SERVICE_OPTIONS.map(x => x.id), waEnabled: true, waMessageTemplate: 'Halo {nama}, permohonan {layanan} Anda berhasil diterima. Kode lacak: {kode_lacak}. Gunakan kode tersebut untuk memantau status permohonan.', waNotificationsEnabled: true };

function getStatusBadgeClass(pct: number): string {
    if (pct === 0) return 'ptsp-badge-danger';
    if (pct === 1) return 'ptsp-badge-warning';
    if (pct === 100) return 'ptsp-badge-success';
    return 'ptsp-badge-info';
}

function getStatusLabel(pct: number): string {
    if (pct === 0) return 'Ditolak';
    if (pct === 1) return 'Pending';
    if (pct === 100) return 'Selesai';
    return `${pct}%`;
}

function StatusCell({ rowId, value, tab, tabColor, onClick }: {
    rowId: unknown; value?: number; tab: string; tabColor: string;
    onClick: () => void;
}) {
    const rawPct = parseInt(String(value ?? 1), 10)
    const pct = isNaN(rawPct) ? 1 : Math.min(Math.max(rawPct, 0), 100)
    const badgeClass = getStatusBadgeClass(pct)
    const label = getStatusLabel(pct)

    return (
        <button
            type="button"
            className={`ptsp-badge ptsp-badge--clickable ${badgeClass}`}
            onClick={onClick}
            title="Klik untuk ubah status & catatan"
        >
            <span className="ptsp-badge__dot" />
            <span>{label}</span>
            <i className="bi bi-pencil" style={{ fontSize: '0.6rem', marginLeft: 2 }} />
        </button>
    )
}

/* ──────────────────────────────────────────────────────────
   MAIN COMPONENT
────────────────────────────────────────────────────────── */
export default function PTSPClient({ user }: { user: any }) {
    const { openFile, viewer } = useFileViewer()
    const [activeTab, setActiveTab] = useState(PTSP_TABS[0].key)
    const [rows, setRows] = useState<Row[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [editRow, setEditRow] = useState<Row | null>(null)
    const [viewRow, setViewRow] = useState<Row | null>(null)
    const [statusRow, setStatusRow] = useState<Row | null>(null)
    const [rowToDelete, setRowToDelete] = useState<Row | null>(null)
    const [localStatus, setLocalStatus] = useState(1)
    const [localNotes, setLocalNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<number | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [config, setConfig] = useState(DEFAULT_PTSP_CONFIG)
    const [configSaving, setConfigSaving] = useState(false)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    // Tab items for Tab component
    const tabItems: TabItem[] = useMemo(() => {
        return PTSP_TABS.map(t => ({
            key: t.key,
            label: t.label,
            icon: t.icon,
        }));
    }, []);

    // Check if user has edit permissions (ADMIN or PTSP role)
    const canEdit = (() => {
        if (!user) return false
        const roleStr = (user.role || '').toUpperCase()
        const roles = roleStr.split(/[,|]/).map((r: string) => r.trim())
        return roles.includes('ADMIN') || roles.includes('PTSP')
    })()

    useEffect(() => {
        fetch('/api/ptsp/config', { cache: 'no-store' }).then(r => r.json()).then(json => {
            if (json?.ok && json.data) setConfig({ ...DEFAULT_PTSP_CONFIG, ...json.data })
        }).catch(() => {})
    }, [canEdit])

    const saveConfig = async () => {
        setConfigSaving(true)
        try {
            const res = await fetch('/api/ptsp/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
            const json = await res.json()
            if (!res.ok || !json.ok) throw new Error(json.message || json.error || 'Pengaturan gagal disimpan')
            setConfig({ ...DEFAULT_PTSP_CONFIG, ...json.data })
            setSettingsOpen(false)
            await Swal.fire({ icon: 'success', title: 'Pengaturan tersimpan', timer: 1300, showConfirmButton: false })
        } catch (e: any) { await Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: e.message }) }
        finally { setConfigSaving(false) }
    }

    const currentTab = PTSP_TABS.find(t => t.key === activeTab)!

    const fetchRows = useCallback(async (tabKey: string, p = 1, q = '') => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ table: tabKey, page: String(p), pageSize: String(PAGE_SIZE) })
            if (q) params.set('search', q)
            const res = await fetch(`/api/ptsp?${params}`)
            const json = await res.json()
            if (json.ok) { setRows(json.data); setTotal(json.total); setPage(p) }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchRows(activeTab, 1, '') }, [activeTab])

    useEffect(() => {
        clearTimeout(debounceRef.current as any)
        debounceRef.current = setTimeout(() => {
            setSearch(searchInput)
            setPage(1)
        }, 450)
        return () => clearTimeout(debounceRef.current as any)
    }, [searchInput])

    useEffect(() => { fetchRows(activeTab, 1, search) }, [activeTab, search])

    /* ── Column order per tab ── */
    const COL_ORDER: Record<string, string[]> = {
        ptsp_master_tracking: ['created_at', 'short_code', 'no_wa', 'service_type', 'table_name', 'status', 'catatan_admin'],
        ptsp_buku_tamu: ['created_at', 'nama', 'wa', 'instansi', 'tujuan', 'bertemu_dengan', 'status', 'catatan_admin'],
        ptsp_izin_siswa: ['created_at', 'nama', 'kelas', 'tanggal_mulai', 'tanggal_selesai', 'alasan', 'status', 'catatan_admin'],
        ptsp_izin_magang: ['created_at', 'nama', 'wa', 'sekolah_kampus', 'jurusan', 'tanggal_mulai', 'tanggal_selesai', 'status', 'catatan_admin'],
        ptsp_legalisir: ['created_at', 'nama', 'wa', 'jenis_dokumen', 'jumlah_lembar', 'status', 'catatan_admin'],
        ptsp_mutasi_siswa: ['created_at', 'nama_siswa', 'nisn', 'kelas', 'jenis_kelamin', 'alasan_pindah', 'status', 'catatan_admin'],
        ptsp_pengganti_ijazah: ['created_at', 'nama_siswa', 'nisn', 'alamat', 'status', 'catatan_admin'],
        ptsp_sosialisasi: ['created_at', 'nama', 'wa', 'instansi', 'jenis', 'tujuan', 'target', 'status', 'catatan_admin'],
        ptsp_peminjaman_sarana: ['created_at', 'nama', 'wa', 'alamat', 'tanggal_mulai', 'tanggal_selesai', 'status', 'catatan_admin'],
        ptsp_izin_penelitian: ['created_at', 'nama', 'wa', 'instansi', 'judul_penelitian', 'tanggal_mulai', 'tanggal_selesai', 'status', 'catatan_admin'],
        ptsp_pengaduan: ['created_at', 'nama', 'wa', 'jenis', 'jenis_lainnya', 'isi_laporan', 'status', 'catatan_admin'],
    }

    const SKIP = ['file_surat_pengantar', 'file_dokumen', 'file_permohonan_ortu',
        'file_rekomendasi_tujuan', 'file_copy_ijazah', 'file_copy_ktp',
        'file_pas_foto', 'file_surat_kehilangan', 'file_url', 'edit_count', 'is_edited']

    const cols = COL_ORDER[activeTab] || Object.keys(rows[0] || {}).filter(c => !SKIP.includes(c))
    const totalPages = Math.ceil(total / PAGE_SIZE)

    /* ── Cell renderer ── */
    const renderCell = (key: string, value: unknown): React.ReactNode => {
        if (key === 'status') {
            const rawPct = parseInt(String(value ?? 1), 10)
            const pct = isNaN(rawPct) ? 1 : Math.min(Math.max(rawPct, 0), 100)
            const badgeClass = getStatusBadgeClass(pct)
            const label = getStatusLabel(pct)
            return (
                <span className={`ptsp-badge ${badgeClass}`}>
                    <span className="ptsp-badge__dot" />
                    <span>{label}</span>
                </span>
            )
        }
        if (key === 'is_edited') return value === 'Ya'
            ? <i className="bi bi-check-circle-fill" style={{ color: '#22c55e', fontSize: '0.85rem' }} />
            : <i className="bi bi-dash" style={{ color: '#d1d5db', fontSize: '0.85rem' }} />
        if (key === 'catatan_admin') return (
            <span className="ptsp-cell-ellipsis" title={String(value || '')}>
                {value ? String(value) : <em style={{ color: '#9ca3af' }}>—</em>}
            </span>
        )
        if (typeof value === 'string' && value.startsWith('http')) return (
            <button type="button" onClick={() => openFile(value, String(key))} className="ptsp-file-link">
                <i className="bi bi-paperclip"></i>File
            </button>
        )
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return <span className="ptsp-cell-date">{new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        }
        return <span>{value != null ? String(value) : '—'}</span>
    }

    /* ── Status + Notes Modal ── */
    const openStatusModal = (row: Row) => {
        setStatusRow({ ...row })
        setLocalStatus(Number(row.status) || 1)
        setLocalNotes(String(row.catatan_admin ?? ''))
    }
    const closeStatusModal = () => { setStatusRow(null) }

    const saveStatusModal = async () => {
        if (!statusRow) return
        setSaving(true)
        try {
            const res = await fetch('/api/ptsp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table: activeTab,
                    id: statusRow.id,
                    data: { status: localStatus, catatan_admin: localNotes },
                }),
            })
            const json = await res.json()
            if (json.ok) {
                setRows(prev => prev.map(r => r.id === statusRow.id ? { ...r, status: localStatus, catatan_admin: localNotes } : r))
                closeStatusModal()
                await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data berhasil disimpan.', timer: 1200, showConfirmButton: false })
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error })
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message })
        } finally { setSaving(false) }
    }

    /* ── View ── */
    const closeViewModal = () => { setViewRow(null) }

    /* ── Edit ── */
    const openEdit = (row: Row) => { setEditRow({ ...row }) }
    const closeEdit = () => { setEditRow(null) }

    const saveEdit = async () => {
        if (!editRow) return
        setSaving(true)
        try {
            const res = await fetch('/api/ptsp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table: activeTab,
                    id: editRow.id,
                    data: { ...editRow },
                }),
            })
            const json = await res.json()
            if (json.ok) {
                await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data berhasil disimpan.', timer: 1500, showConfirmButton: false })
                closeEdit()
                fetchRows(activeTab, page, search)
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error })
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message })
        } finally { setSaving(false) }
    }

    /* ── Delete ── */
    const confirmDeleteRow = async () => {
        if (!rowToDelete) return
        setDeleting(rowToDelete.id as number)
        try {
            const res = await fetch(`/api/ptsp?table=${activeTab}&id=${rowToDelete.id}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.ok) {
                setRows(prev => prev.filter(r => r.id !== rowToDelete.id))
                setRowToDelete(null)
                await Swal.fire({ icon: 'success', title: 'Dihapus', text: 'Data berhasil dihapus.', timer: 1200, showConfirmButton: false })
                fetchRows(activeTab, page, search)
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error })
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message })
        } finally { setDeleting(null) }
    }

    const tab = currentTab
    const tabColor = tab.color

    return (
        <>
            {canEdit && <>
                <DesktopFab label="Pengaturan PTSP" icon={<Settings size={20} />} mobileIcon="gear-fill" onClick={() => setSettingsOpen(true)} title="Pengaturan layanan dan WhatsApp PTSP" />
            </>}
            <Modal open={settingsOpen} size="lg" className="ptsp-settings-modal" onClose={() => setSettingsOpen(false)} title="Pengaturan Layanan PTSP" icon={<Settings size={20} />} labelledBy="ptsp-settings-title">
                <ModalBody>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>Menu yang ditampilkan di aplikasi PTSP</h3>
                    <div className="ptsp-settings-services">
                        {PTSP_SERVICE_OPTIONS.map(option => <label key={option.id} className="ptsp-settings-service"><input type="checkbox" checked={config.enabledServices.includes(option.id)} onChange={e => setConfig(old => ({ ...old, enabledServices: e.target.checked ? [...old.enabledServices, option.id] : old.enabledServices.filter(id => id !== option.id) }))} /><span>{option.label}</span></label>)}
                    </div>
                    <div style={{ borderTop: '1px solid var(--n-border,#e2e8f0)', paddingTop: 18 }}>
                        <label className="ptsp-settings-section-toggle"><input type="checkbox" checked={config.waEnabled} onChange={e => setConfig(old => ({ ...old, waEnabled: e.target.checked }))} /><span>Kirim konfirmasi otomatis melalui WhatsApp</span></label>
                        <textarea value={config.waMessageTemplate} onChange={e => setConfig(old => ({ ...old, waMessageTemplate: e.target.value }))} rows={4} maxLength={1000} style={{ width: '100%', resize: 'vertical', padding: 11, border: '1px solid var(--n-border,#cbd5e1)', borderRadius: 10, font: 'inherit' }} />
                        <small style={{ display: 'block', color: 'var(--n-muted,#64748b)', marginTop: 6 }}>Gunakan {'{nama}'}, {'{layanan}'}, dan {'{kode_lacak}'}.</small>
                    </div>
                    <div style={{ borderTop: '1px solid var(--n-border,#e2e8f0)', paddingTop: 18, marginTop: 18 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>Notifikasi status PTSP</h3>
                        <label className="ptsp-settings-section-toggle"><input type="checkbox" checked={config.waNotificationsEnabled} onChange={e => setConfig(old => ({ ...old, waNotificationsEnabled: e.target.checked }))} /><span>Aktifkan notifikasi status melalui WhatsApp</span></label>
                        <small style={{ display: 'block', color: 'var(--n-muted,#64748b)', marginTop: 6 }}>Pilih provider, nomor tujuan, dan akun PTSP di Pengaturan Umum → WhatsApp.</small>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="cancel" onClick={() => setSettingsOpen(false)}>Batal</Button>
                    <Button type="button" variant="primary" isLoading={configSaving} leftIcon={<Save size={15} />} onClick={saveConfig}>Simpan Pengaturan</Button>
                </ModalFooter>
            </Modal>
            <div className="ptsp-main-shell">
                {/* 2. Tab Component */}
                <Tab
                    tabs={tabItems}
                    activeTab={activeTab}
                    onChange={(key) => { setActiveTab(key); setSearchInput(''); setPage(1); }}
                    ariaLabel="Layanan PTSP Tabs"
                    variant="slider"
                />

                {/* 3. FilterToolbar Component */}
                <FilterToolbar style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                    <FilterSearch
                        value={searchInput}
                        onChange={setSearchInput}
                        placeholder={`Cari ${tab.label}…`}
                        grow={1}
                    />
                </FilterToolbar>

                {/* Table */}
                <div className="ptsp-table-wrap" style={{ marginTop: '0.5rem' }}>
                    <table className="ptsp-table">
                        <thead>
                            <tr>
                                {(() => {
                                    const hasCreatedAt = cols.includes('created_at')
                                    const hasNama = cols.includes('nama')
                                    const hasWa = cols.includes('wa')
                                    const hasNamaWa = hasNama && hasWa
                                    const hasNamaOnly = hasNama && !hasWa
                                    const restCols = cols.filter(c => c !== 'created_at' && c !== 'nama' && c !== 'wa')
                                    return (
                                        <>
                                            {hasCreatedAt && (
                                                <th className="ptsp-table__th">{FIELD_LABELS['created_at'] || 'Tanggal'}</th>
                                            )}
                                            {hasNamaWa && <th className="ptsp-table__th">Nama / WA</th>}
                                            {hasNamaOnly && <th className="ptsp-table__th">Nama</th>}
                                            {hasWa && !hasNama && <th className="ptsp-table__th">No. WA</th>}
                                            {restCols.map(c => (
                                                <th key={c} className="ptsp-table__th">
                                                    {FIELD_LABELS[c] || c.replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                        </>
                                    )
                                })()}
                                {TAB_FILE_COLS[activeTab] && Object.keys(TAB_FILE_COLS[activeTab]).length > 0 && (
                                    <th className="ptsp-table__th"><i className="bi bi-paperclip"></i> Lampiran</th>
                                )}
                                <th className="ptsp-table__th ptsp-table__th--right"><i className="bi bi-gear-fill"></i></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={cols.length + 2} style={{ padding: '60px 0', textAlign: 'center' }}>
                                        {/* 6. Spinner trace tanpa label */}
                                        <Spinner variant="buble" />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    {(() => {
                                        const hasFiles = TAB_FILE_COLS[activeTab] && Object.keys(TAB_FILE_COLS[activeTab]).length > 0
                                        const lampCol = hasFiles ? 1 : 0
                                        const otherCols = cols.filter(c => c !== 'created_at' && c !== 'nama' && c !== 'wa')
                                        const namaCol = (cols.includes('nama')) ? 1 : 0
                                        const createdAtCol = cols.includes('created_at') ? 1 : 0
                                        return <td colSpan={otherCols.length + lampCol + namaCol + createdAtCol + 1} className="ptsp-empty">
                                            <i className={`bi bi-${tab.icon} ptsp-empty-icon`} />
                                            <p className="ptsp-empty-title">Belum ada data</p>
                                            <p className="ptsp-empty-sub">{search ? `Tidak ditemukan untuk "${search}"` : 'Data akan muncul setelah diisi oleh aplikasi PTSP.'}</p>
                                        </td>
                                    })()}
                                </tr>
                            ) : (
                                rows.map((row, idx) => (
                                    <tr key={row.id as string} className="ptsp-table__row" style={{ animationDelay: `${idx * 0.03}s` }}>
                                        {(() => {
                                            const hasCreatedAt = cols.includes('created_at')
                                            const hasNama = cols.includes('nama')
                                            const hasWa = cols.includes('wa')
                                            const hasNamaWa = hasNama && hasWa
                                            const restCols = cols.filter(c => c !== 'created_at' && c !== 'nama' && c !== 'wa')

                                            return (
                                                <>
                                                    {hasCreatedAt && (
                                                        <td className="ptsp-table__cell">{renderCell('created_at', row.created_at)}</td>
                                                    )}
                                                    {hasNamaWa ? (
                                                        <td key="nama-wa" className="ptsp-table__cell ptsp-table__cell--name-wa">
                                                            <span className="ptsp-name-wa__nama">{renderCell('nama', row.nama)}</span>
                                                            <span className="ptsp-name-wa__wa">{renderCell('wa', row.wa)}</span>
                                                        </td>
                                                    ) : hasNama ? (
                                                        <td className="ptsp-table__cell ptsp-table__cell--name">
                                                            <span className="ptsp-name">{renderCell('nama', row.nama)}</span>
                                                        </td>
                                                    ) : null}
                                                    {restCols.map(c => (
                                                        <td key={c} className="ptsp-table__cell">
                                                            {c === 'status'
                                                                ? <StatusCell rowId={row.id} value={row.status as number} tab={activeTab} tabColor={tabColor} onClick={canEdit ? () => openStatusModal(row) : () => setViewRow(row)} />
                                                                : renderCell(c, row[c])
                                                            }
                                                        </td>
                                                    ))}
                                                </>
                                            )
                                        })()}
                                        {TAB_FILE_COLS[activeTab] && Object.keys(TAB_FILE_COLS[activeTab]).length > 0 && (
                                            <td className="ptsp-table__cell">
                                                {(() => {
                                                    const fileCols = TAB_FILE_COLS[activeTab] || {}
                                                    const entries = Object.entries(fileCols).filter(([k]) => {
                                                        const v = row[k]
                                                        return typeof v === 'string' && v.startsWith('http')
                                                    })
                                                    if (entries.length === 0) return <span style={{ color: 'var(--n-muted)', fontSize: '0.78rem' }}>—</span>
                                                    const [firstKey, firstLabel] = entries[0]
                                                    const firstUrl = row[firstKey] as string
                                                    return (
                                                        <button
                                                            type="button"
                                                            className="ptsp-lampiran-badge"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                openFile(firstUrl, firstLabel)
                                                            }}
                                                            title={`Pratinjau ${firstLabel}`}
                                                        >
                                                            <i className="bi bi-paperclip"></i> {entries.length}
                                                        </button>
                                                    )
                                                })()}
                                            </td>
                                        )}
                                        {/* 4. ActionButton & ActionGroup */}
                                        <td className="ptsp-table__cell ptsp-table__cell--right">
                                            <ActionGroup>
                                                <ActionButton
                                                    action="view"
                                                    title="Lihat Detail"
                                                    onClick={() => setViewRow(row)}
                                                />
                                                {canEdit && (
                                                    <>
                                                        <ActionButton
                                                            action="edit"
                                                            title="Edit Data"
                                                            onClick={() => openEdit(row)}
                                                        />
                                                        <ActionButton
                                                            action="delete"
                                                            title="Hapus Data"
                                                            onClick={() => setRowToDelete(row)}
                                                        />
                                                    </>
                                                )}
                                            </ActionGroup>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── MOBILE CARD VIEW ── */}
                <div className="ptsp-mobile-cards">
                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center' }}>
                            <Spinner variant="buble" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="ptsp-mobile-empty">
                            <i className={`bi bi-${tab.icon}`} />
                            <p className="ptsp-empty-title">Belum ada data</p>
                            <p className="ptsp-empty-sub">{search ? `Tidak ditemukan untuk "${search}"` : 'Data akan muncul setelah diisi.'}</p>
                        </div>
                    ) : (
                        rows.map((row) => {
                            const rawStatusVal = parseInt(String(row.status ?? 1), 10)
                            const statusVal = isNaN(rawStatusVal) ? 1 : Math.min(Math.max(rawStatusVal, 0), 100)
                            const badgeClass = getStatusBadgeClass(statusVal)
                            const statusLabel = getStatusLabel(statusVal)
                            const displayCols = cols.filter(c =>
                                c !== 'status' &&
                                c !== 'created_at' &&
                                !(c === 'wa' && !cols.includes('nama'))
                            )

                            return (
                                <div key={row.id as string} className="ptsp-card-item">
                                    <div className="ptsp-card-item__header">
                                        <span className="ptsp-card-item__id">ID #{row.id}</span>
                                        <span className={`ptsp-badge ${badgeClass}`}>
                                            <span className="ptsp-badge__dot" />
                                            <span>{statusLabel}</span>
                                        </span>
                                    </div>
                                    <div className="ptsp-card-item__body">
                                        {displayCols.slice(0, 6).map(c => {
                                            let val: React.ReactNode = '—'
                                            const raw = row[c]
                                            if (raw != null) {
                                                if (typeof raw === 'string' && raw.startsWith('http')) {
                                                    val = <button type="button" onClick={() => openFile(raw, c)} className="ptsp-file-link"><i className="bi bi-paperclip"></i>File</button>
                                                } else if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
                                                    val = new Date(raw).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                                } else {
                                                    val = String(raw)
                                                }
                                            }
                                            return (
                                                <div key={c} className={`ptsp-card-item__field ${c === 'nama' ? 'highlight' : ''}`}>
                                                    <span className="ptsp-card-item__label">{FIELD_LABELS[c] || c.replace(/_/g, ' ')}</span>
                                                    <span className="ptsp-card-item__value">{val}</span>
                                                </div>
                                            )
                                        })}
                                        {displayCols.length > 6 && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                style={{ width: '100%', marginTop: '0.5rem' }}
                                                onClick={() => setViewRow(row)}
                                            >
                                                Lihat semua ({displayCols.length - 6} field lainnya)
                                            </Button>
                                        )}
                                    </div>
                                    <div className="ptsp-card-item__footer">
                                        <div className="ptsp-card-item__status">
                                            <StatusCell rowId={row.id} value={row.status as number} tab={activeTab} tabColor={tabColor} onClick={canEdit ? () => openStatusModal(row) : () => setViewRow(row)} />
                                        </div>
                                        <div className="ptsp-card-item__actions">
                                            <ActionGroup>
                                                <ActionButton
                                                    action="view"
                                                    title="Lihat Detail"
                                                    onClick={() => setViewRow(row)}
                                                />
                                                {canEdit && (
                                                    <>
                                                        <ActionButton
                                                            action="edit"
                                                            title="Edit Data"
                                                            onClick={() => openEdit(row)}
                                                        />
                                                        <ActionButton
                                                            action="delete"
                                                            title="Hapus Data"
                                                            onClick={() => setRowToDelete(row)}
                                                        />
                                                    </>
                                                )}
                                            </ActionGroup>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* 5. Button Component for Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', padding: '0 4px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--n-muted)' }}>
                            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => fetchRows(activeTab, page - 1, search)}
                                leftIcon={<i className="bi bi-chevron-left" />}
                            />
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                const p = i + 1
                                const isCurrent = page === p
                                return (
                                    <Button
                                        key={p}
                                        variant={isCurrent ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => fetchRows(activeTab, p, search)}
                                    >
                                        {p}
                                    </Button>
                                )
                            })}
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => fetchRows(activeTab, page + 1, search)}
                                leftIcon={<i className="bi bi-chevron-right" />}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 7. Modal Component - VIEW MODAL */}
            {viewRow && (
                <Modal size="lg" onClose={closeViewModal} labelledBy="ptsp-view-title">
                    <ModalHeader
                        id="ptsp-view-title"
                        icon={tab.icon}
                        title={`Detail ${tab.label}`}
                        subtitle={`ID #${viewRow.id}`}
                        onClose={closeViewModal}
                    />
                    <ModalBody>
                        <ModalDetailGrid>
                            {(() => {
                                const hasNama = cols.includes('nama')
                                const hasWa = cols.includes('wa')
                                const otherCols = cols.filter(c => c !== 'nama' && c !== 'wa')
                                const FULL_WIDTH_FIELDS = ['catatan_admin', 'alasan', 'isi_laporan', 'judul_penelitian', 'alamat', 'alasan_pindah', 'tujuan']

                                const renderField = (c: string, raw: unknown) => {
                                    let displayVal: React.ReactNode = '—'
                                    if (raw != null) {
                                        if (c === 'status') {
                                            const rawPct = parseInt(String(raw), 10)
                                            const pct = isNaN(rawPct) ? 1 : Math.min(Math.max(rawPct, 0), 100)
                                            const badgeClass = getStatusBadgeClass(pct)
                                            const label = getStatusLabel(pct)
                                            displayVal = (
                                                <span className={`ptsp-badge ${badgeClass}`}>
                                                    <span className="ptsp-badge__dot" />
                                                    <span>{label}</span>
                                                </span>
                                            )
                                        } else if (typeof raw === 'string' && raw.startsWith('http')) {
                                            displayVal = (
                                                <Button type="button" variant="secondary" size="sm" onClick={() => openFile(raw, c)} leftIcon={<i className="bi bi-paperclip" />}>
                                                    Buka File
                                                </Button>
                                            )
                                        } else if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
                                            displayVal = new Date(raw).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        } else {
                                            displayVal = String(raw)
                                        }
                                    }
                                    const isFull = FULL_WIDTH_FIELDS.includes(c)
                                    return (
                                        <ModalDetailField key={c} label={FIELD_LABELS[c] || c.replace(/_/g, ' ')} full={isFull}>
                                            {displayVal}
                                        </ModalDetailField>
                                    )
                                }
                                return (
                                    <>
                                        {hasNama && renderField('nama', viewRow.nama)}
                                        {hasWa && renderField('wa', viewRow.wa)}
                                        {otherCols.map(c => renderField(c, viewRow[c]))}
                                    </>
                                )
                            })()}
                        </ModalDetailGrid>

                        {/* Lampiran */}
                        {(() => {
                            const fileCols = TAB_FILE_COLS[activeTab] || {}
                            const fileEntries = Object.entries(fileCols).filter(([k]) => {
                                const v = viewRow[k as keyof typeof viewRow]
                                return typeof v === 'string' && v.startsWith('http')
                            })
                            if (fileEntries.length === 0) return null
                            return (
                                <div className="ptsp-lampiran-section" style={{ marginTop: '1rem' }}>
                                    <div className="ptsp-lampiran-section__header">
                                        <i className="bi bi-paperclip"></i>
                                        <span>Lampiran ({fileEntries.length})</span>
                                    </div>
                                    <div className="ptsp-lampiran-grid">
                                        {fileEntries.map(([key, label]) => {
                                            const url = viewRow[key as keyof typeof viewRow] as string
                                            const filename = url.split('/').pop() || 'File'
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => openFile(url, String(label))}
                                                    className="ptsp-lampiran-item"
                                                >
                                                    <div className="ptsp-lampiran-item__icon">
                                                        <i className="bi bi-file-earmark-arrow-down"></i>
                                                    </div>
                                                    <div className="ptsp-lampiran-item__info">
                                                        <span className="ptsp-lampiran-item__label">{label}</span>
                                                        <span className="ptsp-lampiran-item__name">{decodeURIComponent(filename)}</span>
                                                    </div>
                                                    <i className="bi bi-eye ptsp-lampiran-item__dl"></i>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })()}
                    </ModalBody>
                    <ModalFooter align="between">
                        {canEdit ? (
                            <Button variant="primary" onClick={() => { closeViewModal(); openEdit(viewRow); }} leftIcon={<i className="bi bi-pencil-square" />}>
                                Edit Data
                            </Button>
                        ) : <div />}
                        <Button variant="cancel" onClick={closeViewModal} leftIcon={<i className="bi bi-x-lg" />}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* 7. Modal Component - EDIT MODAL */}
            {editRow && (
                <Modal size="lg" onClose={closeEdit} labelledBy="ptsp-edit-title">
                    <ModalHeader
                        id="ptsp-edit-title"
                        icon="pencil-square"
                        title={`Edit ${tab.label}`}
                        subtitle={`ID #${editRow.id}`}
                        onClose={closeEdit}
                    />
                    <ModalBody>
                        <div className="ptsp-edit-fields-grid">
                            {cols.map(c => {
                                const isEditable = c === 'status' || c === 'catatan_admin'
                                const FULL_WIDTH = ['status', 'catatan_admin', 'alasan', 'isi_laporan', 'judul_penelitian', 'alamat', 'alasan_pindah', 'tujuan'].includes(c)
                                return (
                                    <div key={c} className={`ptsp-edit-field-item ${isEditable ? 'editable' : ''} ${FULL_WIDTH ? 'full-width' : ''}`}>
                                        <label className="ptsp-edit-field-item__label">{FIELD_LABELS[c] || c.replace(/_/g, ' ')}</label>
                                        {c === 'status' ? (
                                            <div className="ptsp-edit-field-status">
                                                <input
                                                    type="range" min={0} max={100} step={1}
                                                    className="ptsp-range"
                                                    style={{ accentColor: tabColor }}
                                                    value={Number(editRow.status) || 1}
                                                    onChange={e => setEditRow({ ...editRow, status: parseInt(e.target.value) })}
                                                />
                                                <span className="ptsp-edit-field-status__val" style={{ color: tabColor }}>{Number(editRow.status) || 1}%</span>
                                            </div>
                                        ) : /^(tanggal_|created_at|updated_at)/.test(c) ? (
                                            <DatePicker
                                                className="ptsp-input"
                                                value={typeof editRow[c] === 'string' ? String(editRow[c])?.slice(0, 10) : ''}
                                                onChange={v => setEditRow({ ...editRow, [c]: v })}
                                            />
                                        ) : c === 'catatan_admin' ? (
                                            <textarea
                                                className="ptsp-textarea"
                                                rows={3}
                                                placeholder="Tambahkan catatan…"
                                                value={String(editRow.catatan_admin ?? '')}
                                                onChange={e => setEditRow({ ...editRow, catatan_admin: e.target.value })}
                                            />
                                        ) : typeof editRow[c] === 'number' ? (
                                            <input
                                                type="number"
                                                className="ptsp-input"
                                                value={editRow[c] as number ?? ''}
                                                onChange={e => setEditRow({ ...editRow, [c]: parseFloat(e.target.value) })}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className="ptsp-input"
                                                value={String(editRow[c] ?? '')}
                                                onChange={e => setEditRow({ ...editRow, [c]: e.target.value })}
                                            />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={closeEdit} disabled={saving} leftIcon={<i className="bi bi-x-lg" />}>
                            Batal
                        </Button>
                        <Button variant="primary" onClick={saveEdit} isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                            Simpan
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* 7. Modal Component - STATUS MODAL */}
            {statusRow && (
                <Modal size="md" onClose={closeStatusModal} labelledBy="ptsp-status-title">
                    <ModalHeader
                        id="ptsp-status-title"
                        icon="gear"
                        title="Update Status & Catatan"
                        subtitle={`${tab.label} — ID #${statusRow.id}`}
                        onClose={closeStatusModal}
                    />
                    <ModalBody>
                        {Boolean(statusRow.nama || statusRow.nama_siswa) && (
                            <div className="ptsp-status-person" style={{ marginBottom: '1rem' }}>
                                <i className="bi bi-person-circle" />
                                <span>{String(statusRow.nama || statusRow.nama_siswa)}</span>
                            </div>
                        )}
                        <div className="ptsp-status-card" style={{ borderColor: `var(--status-color, ${tabColor})` }}>
                            <div className="ptsp-status-card__header">
                                <span className="ptsp-status-card__label">Status Pengajuan</span>
                                <span className="ptsp-status-card__percent" style={{ color: `var(--status-color, ${tabColor})` }}>
                                    {localStatus}%
                                </span>
                            </div>
                            <div className="ptsp-status-card__progress">
                                <div className="ptsp-status-card__progress-track" style={{ background: `color-mix(in srgb, var(--status-color, ${tabColor}) 15%, transparent)` }}>
                                    <div
                                        className="ptsp-status-card__progress-fill"
                                        style={{
                                            width: `${localStatus}%`,
                                            background: `var(--status-color, ${tabColor})`
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="ptsp-status-card__buttons">
                                {[
                                    { val: 0, label: 'Ditolak', icon: 'bi-x-circle-fill', color: '#ef4444', isActive: (v: number) => v === 0 },
                                    { val: 1, label: 'Pending', icon: 'bi-clock-fill', color: '#f59e0b', isActive: (v: number) => v === 1 },
                                    { val: 50, label: 'Proses', icon: 'bi-arrow-repeat', color: '#3b82f6', isActive: (v: number) => v >= 2 && v <= 99 },
                                    { val: 100, label: 'Selesai', icon: 'bi-check-circle-fill', color: '#22c55e', isActive: (v: number) => v === 100 },
                                ].map(btn => (
                                    <button
                                        key={btn.val}
                                        type="button"
                                        className={`ptsp-status-chip ${btn.isActive(localStatus) ? 'active' : ''}`}
                                        style={{ '--chip-color': btn.color } as React.CSSProperties}
                                        onClick={() => setLocalStatus(btn.val)}
                                    >
                                        <i className={`bi ${btn.icon}`} />
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                            <div className="ptsp-status-card__slider">
                                <input
                                    type="range" min={0} max={100} step={1}
                                    className="ptsp-status-card__range"
                                    style={{ accentColor: tabColor }}
                                    value={localStatus}
                                    onChange={e => setLocalStatus(parseInt(e.target.value, 10))}
                                />
                            </div>
                        </div>
                        <div className="ptsp-notes-card" style={{ marginTop: '1rem' }}>
                            <div className="ptsp-notes-card__header">
                                <i className="bi bi-sticky" />
                                <span>Catatan Admin</span>
                            </div>
                            <textarea
                                className="ptsp-notes-card__textarea"
                                rows={4}
                                placeholder="Tambahkan catatan untuk pemohon…"
                                value={localNotes}
                                onChange={e => setLocalNotes(e.target.value)}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={closeStatusModal} disabled={saving} leftIcon={<i className="bi bi-x-lg" />}>
                            Batal
                        </Button>
                        <Button variant="primary" onClick={saveStatusModal} isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                            Simpan
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* 7. Modal Component - DELETE MODAL */}
            {rowToDelete && (
                <Modal size="sm" variant="delete" onClose={() => setRowToDelete(null)} labelledBy="ptsp-del-title">
                    <ModalHeader
                        id="ptsp-del-title"
                        icon="trash3"
                        title="Hapus Data PTSP?"
                        onClose={() => setRowToDelete(null)}
                    />
                    <ModalBody>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                            <div>Data ID <strong>#{rowToDelete.id}</strong> pada <strong>{tab.label}</strong> akan dihapus permanen.</div>
                            <div style={{ color: '#dc2626', fontWeight: 600, marginTop: '6px' }}>
                                PERINGATAN: Tindakan ini tidak dapat dibatalkan!
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => setRowToDelete(null)} disabled={deleting === rowToDelete.id} leftIcon={<i className="bi bi-x-lg" />}>
                            Batal
                        </Button>
                        <Button variant="danger" onClick={confirmDeleteRow} isLoading={deleting === rowToDelete.id} leftIcon={<i className="bi bi-trash" />}>
                            Ya, Hapus
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {viewer}

            <style jsx>{`
                .ptsp-main-shell {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                :global(.ptsp-badge) {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 3px 9px;
                    border-radius: 12px;
                    font-size: 0.68rem;
                    font-weight: 600;
                    line-height: 1.2;
                    white-space: nowrap;
                    border: 1px solid transparent;
                }

                :global(.ptsp-badge--clickable) {
                    cursor: pointer;
                    transition: filter 0.15s ease, transform 0.15s ease;
                }
                :global(.ptsp-badge--clickable:hover) {
                    transform: translateY(-1px);
                    filter: brightness(0.95);
                }

                :global(.ptsp-badge__dot) {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: currentColor;
                }

                :global(.ptsp-badge-warning) {
                    background: rgba(245, 158, 11, 0.14) !important;
                    color: #b45309 !important;
                    border-color: rgba(245, 158, 11, 0.4) !important;
                }
                :global(.dark .ptsp-badge-warning) {
                    background: rgba(245, 158, 11, 0.25) !important;
                    color: #fbbf24 !important;
                    border-color: rgba(251, 191, 36, 0.5) !important;
                }

                :global(.ptsp-badge-info) {
                    background: rgba(59, 130, 246, 0.14) !important;
                    color: #1d4ed8 !important;
                    border-color: rgba(59, 130, 246, 0.4) !important;
                }
                :global(.dark .ptsp-badge-info) {
                    background: rgba(59, 130, 246, 0.25) !important;
                    color: #60a5fa !important;
                    border-color: rgba(96, 165, 250, 0.5) !important;
                }

                :global(.ptsp-badge-success) {
                    background: rgba(34, 197, 94, 0.14) !important;
                    color: #15803d !important;
                    border-color: rgba(34, 197, 94, 0.4) !important;
                }
                :global(.dark .ptsp-badge-success) {
                    background: rgba(34, 197, 94, 0.25) !important;
                    color: #4ade80 !important;
                    border-color: rgba(74, 222, 128, 0.5) !important;
                }

                :global(.ptsp-badge-danger) {
                    background: rgba(239, 68, 68, 0.14) !important;
                    color: #b91c1c !important;
                    border-color: rgba(239, 68, 68, 0.4) !important;
                }
                :global(.dark .ptsp-badge-danger) {
                    background: rgba(239, 68, 68, 0.25) !important;
                    color: #f87171 !important;
                    border-color: rgba(248, 113, 113, 0.5) !important;
                }

                .ptsp-file-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    color: var(--n-primary, #3083FF);
                    background: transparent;
                    border: none;
                    font-size: 0.78rem;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 0;
                }
                .ptsp-file-link:hover {
                    text-decoration: underline;
                }

                .ptsp-cell-date {
                    font-size: 0.8rem;
                    color: var(--n-text);
                }

                .ptsp-cell-ellipsis {
                    display: block;
                    max-width: 160px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-size: 0.8rem;
                }

                .ptsp-table-wrap {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    overflow-x: auto;
                }

                :global(.dark) .ptsp-table-wrap, .dark .ptsp-table-wrap {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }

                .ptsp-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.82rem;
                }

                .ptsp-table__th {
                    text-align: left;
                    padding: 10px 14px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--n-muted);
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                }

                :global(.dark) .ptsp-table__th, .dark .ptsp-table__th {
                    background: #090d16 !important;
                    color: #94a3b8 !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.5) !important;
                }

                .ptsp-table__th--right { text-align: right; }

                .ptsp-table__row {
                    border-bottom: 1px solid var(--n-border);
                    transition: background 0.15s ease;
                }

                :global(.dark) .ptsp-table__row, .dark .ptsp-table__row,
                :global(.dark) .ptsp-table__cell, .dark .ptsp-table__cell {
                    border-bottom: 1px solid rgba(26, 115, 232, 0.25) !important;
                }

                .ptsp-table__row:last-child {
                    border-bottom: none;
                }

                :global(.dark) .ptsp-table__row:last-child, .dark .ptsp-table__row:last-child,
                :global(.dark) .ptsp-table__row:last-child .ptsp-table__cell, .dark .ptsp-table__row:last-child .ptsp-table__cell {
                    border-bottom: none !important;
                }
                .ptsp-table__row:hover {
                    background: var(--n-soft);
                }

                .ptsp-table__cell {
                    padding: 10px 14px;
                    vertical-align: middle;
                    color: var(--n-text);
                }
                .ptsp-table__cell--right { text-align: right; }

                .ptsp-name-wa__nama {
                    display: block;
                    font-weight: 600;
                    color: var(--n-ink);
                }
                .ptsp-name-wa__wa {
                    display: block;
                    font-size: 0.74rem;
                    color: var(--n-muted);
                }

                .ptsp-empty {
                    text-align: center;
                    padding: 40px 20px;
                }
                .ptsp-empty-title {
                    font-weight: 700;
                    margin-top: 8px;
                    color: var(--n-text);
                }
                .ptsp-empty-sub {
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    margin-top: 4px;
                }

                .ptsp-lampiran-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    font-size: 0.74rem;
                    font-weight: 600;
                    color: var(--n-primary, #3083FF);
                    cursor: pointer;
                }

                /* Mobile Card View */
                .ptsp-mobile-cards {
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                }
                @media (max-width: 767px) {
                    .ptsp-table-wrap { display: none; }
                    .ptsp-mobile-cards { display: flex; }
                }

                .ptsp-card-item {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .ptsp-card-item__header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .ptsp-card-item__id {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }

                .ptsp-card-item__body {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .ptsp-card-item__field {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.8rem;
                }
                .ptsp-card-item__label {
                    color: var(--n-muted);
                }
                .ptsp-card-item__value {
                    font-weight: 500;
                    color: var(--n-text);
                    text-align: right;
                }
                .ptsp-card-item__field.highlight .ptsp-card-item__value {
                    font-weight: 700;
                    color: var(--n-ink);
                }

                .ptsp-card-item__footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 8px;
                    border-top: 1px solid var(--n-border);
                }

                /* Status Modal Cards & Controls */
                .ptsp-status-person {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    color: var(--n-ink);
                    padding: 8px 12px;
                    background: var(--n-soft);
                    border-radius: 8px;
                }

                .ptsp-status-card {
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .ptsp-status-card__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.85rem;
                    font-weight: 700;
                }

                .ptsp-status-card__progress-track {
                    height: 8px;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .ptsp-status-card__progress-fill {
                    height: 100%;
                    transition: width 0.2s ease;
                }

                .ptsp-status-card__buttons {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 6px;
                }

                .ptsp-status-chip {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    padding: 6px 4px;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    background: var(--n-card);
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .ptsp-status-chip.active {
                    background: var(--chip-color);
                    color: #fff;
                    border-color: var(--chip-color);
                }

                .ptsp-status-card__range {
                    width: 100%;
                    cursor: pointer;
                }

                .ptsp-notes-card {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .ptsp-notes-card__header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }
                .ptsp-notes-card__textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-text);
                    font-size: 0.82rem;
                    font-family: inherit;
                }

                .ptsp-edit-fields-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }
                @media (max-width: 640px) {
                    .ptsp-edit-fields-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .ptsp-edit-field-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .ptsp-edit-field-item.full-width {
                    grid-column: 1 / -1;
                }
                .ptsp-edit-field-item__label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: var(--n-muted);
                }
                .ptsp-input {
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-text);
                    font-size: 0.85rem;
                }
                .ptsp-textarea {
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-text);
                    font-size: 0.85rem;
                    font-family: inherit;
                }
                .ptsp-edit-field-status {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .ptsp-range {
                    flex: 1;
                }
                .ptsp-edit-field-status__val {
                    font-weight: 700;
                    font-size: 0.9rem;
                }

                .ptsp-lampiran-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .ptsp-lampiran-section__header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }
                .ptsp-lampiran-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .ptsp-lampiran-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    color: var(--n-text);
                    text-align: left;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }
                .ptsp-lampiran-item:hover {
                    background: var(--n-card);
                }
                .ptsp-lampiran-item__icon {
                    font-size: 1.1rem;
                    color: var(--n-primary, #3083FF);
                }
                .ptsp-lampiran-item__info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .ptsp-lampiran-item__label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }
                .ptsp-lampiran-item__name {
                    font-size: 0.8rem;
                    font-weight: 500;
                }
                .ptsp-lampiran-item__dl {
                    color: var(--n-muted);
                }
            `}</style>
        </>
    )
}
