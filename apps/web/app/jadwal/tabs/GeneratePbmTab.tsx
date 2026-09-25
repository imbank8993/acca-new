'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import DatePicker from '@/components/ui/DatePicker'
import * as XLSX from 'xlsx'
import Select from 'react-select'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Pagination from '@/components/ui/Pagination'
import InlineAlert from '@/components/ui/InlineAlert'
import Swal from 'sweetalert2'
import { exportToExcel } from '@/lib/excel-utils'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { useTimezone } from '@/hooks/use-timezone'
import Button from '@/components/ui/Button'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import { Spinner } from '@/components/ui/Spinner'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { parseJadwalCell, type GuruMapelEntry, type KelasEntry } from '@/app/jadwal/lib/parseJadwalExcel'

interface GeneratePbmTabProps {
    /** Boleh menyimpan / mengimpor / menghapus jadwal. */
    bolehKelola: boolean
    user?: any
}

// Interface reflects DB structure + Frontend needs
interface JadwalGuru {
    id: number
    nip: string
    nama_guru: string
    mata_pelajaran?: string // The DB column
    mapel?: string // Fallback alias
    hari: string
    kelas: string
    ruang?: string | null
    jam_ke: string // Can be "1", "2"
    aktif: boolean
    berlaku_mulai: string | null
}

interface KelasItem {
    id: number
    nama: string
    program: string
    kode?: string | null
}

// Helper for days sorting
const dayOrder: Record<string, number> = {
    'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7
}

// Escape HTML untuk konten yang dirender lewat opsi `html` SweetAlert (cegah XSS)
const escapeHtml = (s: string) =>
    String(s ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));

interface BentrokEntry {
    nip: string
    nama_guru: string
    hari: string
    jam_ke: number
    kelasList: string[]
}

// Deteksi guru yang dijadwalkan di >1 kelas pada hari+jam yang sama dalam satu batch generate
function detectJadwalBentrok(schedules: any[]): BentrokEntry[] {
    const slotMap = new Map<string, { nama_guru: string; kelasSet: Set<string> }>()
    for (const s of schedules) {
        const key = `${s.nip}|${s.hari}|${s.jam_ke}`
        if (!slotMap.has(key)) slotMap.set(key, { nama_guru: s.nama_guru, kelasSet: new Set() })
        slotMap.get(key)!.kelasSet.add(s.kelas)
    }
    const bentrokList: BentrokEntry[] = []
    for (const [key, val] of slotMap.entries()) {
        if (val.kelasSet.size > 1) {
            const [nip, hari, jamKeStr] = key.split('|')
            bentrokList.push({ nip, nama_guru: val.nama_guru, hari, jam_ke: parseInt(jamKeStr), kelasList: Array.from(val.kelasSet) })
        }
    }
    return bentrokList.sort((a, b) => (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99) || a.jam_ke - b.jam_ke)
}

export default function GeneratePbmTab({ user, bolehKelola }: GeneratePbmTabProps) {
    // Timezone
    const { getCurrentDate: getTzDate } = useTimezone();
    const [todayStr, setTodayStr] = useState('');

    // Initialize date from timezone
    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            setTodayStr(today);
        };
        init();
    }, [getTzDate]);
    // Hak kelola datang dari halaman induk: ADMIN, atau role/pengguna yang
    // ditunjuk admin di Pengaturan Users → Hak Akses Fitur. Nama `isAdmin`
    // dipertahankan karena dipakai di belasan titik di berkas ini.
    const isAdmin = bolehKelola

    const canUpdate = isAdmin;
    const canDelete = isAdmin;

    const [list, setList] = useState<JadwalGuru[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [totalItems, setTotalItems] = useState(0)

    // Master Data
    const [masterGuruMapel, setMasterGuruMapel] = useState<any[]>([])
    const [masterKelas, setMasterKelas] = useState<KelasItem[]>([])
    const [masterWaktu, setMasterWaktu] = useState<any[]>([])

    // Filter States
    const [filterHari, setFilterHari] = useState('Semua')
    const [filterKelas, setFilterKelas] = useState('Semua')
    const [filterBerlakuMulai, setFilterBerlakuMulai] = useState('')
    const [availableBerlakuDates, setAvailableBerlakuDates] = useState<string[]>([])

    // UI States
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [mobileAction, setMobileAction] = useState<{ open: boolean, item: JadwalGuru | null }>({ open: false, item: null })

    // Form States
    const [formGuru, setFormGuru] = useState('')
    const [formNip, setFormNip] = useState('') // NIP
    const [formMapel, setFormMapel] = useState('')
    const [formHari, setFormHari] = useState('Senin')
    const [formKelas, setFormKelas] = useState('')
    const [formRuang, setFormRuang] = useState('')
    const [formJams, setFormJams] = useState<number[]>([]) // Array of selected jam
    const [formBerlakuMulai, setFormBerlakuMulai] = useState(todayStr)

    // Generate Modal States
    const [showGenerateModal, setShowGenerateModal] = useState(false)
    const [generateFile, setGenerateFile] = useState<File | null>(null)
    const [generating, setGenerating] = useState(false)
    const [generateTanggalMulai, setGenerateTanggalMulai] = useState(todayStr)
    const [generateJenis, setGenerateJenis] = useState<'penuh' | 'parsial'>('penuh')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Touch Swipe Navigation Refs for Mobile List Cards
    const touchStartX = useRef<number | null>(null)
    const touchStartY = useRef<number | null>(null)
    const touchEndX = useRef<number | null>(null)
    const touchEndY = useRef<number | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        touchEndX.current = null
        touchEndY.current = null
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX
        touchEndY.current = e.touches[0].clientY
    }

    const handleTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null || touchStartY.current === null || touchEndY.current === null) return

        const deltaX = touchStartX.current - touchEndX.current
        const deltaY = Math.abs(touchStartY.current - touchEndY.current)

        // Ensure horizontal swipe > 45px and dominant over vertical scrolling
        if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > deltaY * 1.2) {
            const totalPages = Math.ceil(groupedList.length / itemsPerPage)
            if (deltaX > 0 && currentPage < totalPages) {
                // Swiped Left -> Next Page
                setCurrentPage(prev => prev + 1)
            } else if (deltaX < 0 && currentPage > 1) {
                // Swiped Right -> Prev Page
                setCurrentPage(prev => prev - 1)
            }
        }
    }

    // Sync dates when todayStr is loaded from timezone
    useEffect(() => {
        if (todayStr) {
            setFormBerlakuMulai(prev => prev === '' ? todayStr : prev)
            setGenerateTanggalMulai(prev => prev === '' ? todayStr : prev)
        }
    }, [todayStr])

    // Delete by Masa Berlaku States
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [selectedDates, setSelectedDates] = useState<string[]>([])
    const [deleting, setDeleting] = useState(false)

    // Overflow "Lainnya" action menu (Desktop)
    const [showMoreMenu, setShowMoreMenu] = useState(false)
    const moreMenuRef = useRef<HTMLDivElement>(null)

    // Action Menu State (Mobile)
    const [showActionMenu, setShowActionMenu] = useState(false)
    const actionMenuRef = useRef<HTMLDivElement>(null)

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

    // Edit Berlaku Massal States
    const [showEditBerlakuModal, setShowEditBerlakuModal] = useState(false)
    const [editOldDate, setEditOldDate] = useState('')
    const [editNewDate, setEditNewDate] = useState('')
    const [editPreviewCount, setEditPreviewCount] = useState(0)
    const [editingBerlaku, setEditingBerlaku] = useState(false)

    // Delete confirmation state
    const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
    const [deleteItemData, setDeleteItemData] = useState<any | null>(null)
    const [deletingSingle, setDeletingSingle] = useState(false)

    // Modal blur. `registerModal()` dipakai utk modal berbasis state (efek di
    // bawah); `openModal`/`closeModal` tetap dipakai apa adanya utk callback
    // SweetAlert `didOpen`/`willClose` — itu event sekali-tembak yang sudah
    // seimbang sendiri (bukan efek yang bisa jalan ulang), jadi aman.
    const { openModal, closeModal, registerModal } = useModalBlur()

    // Fix SweetAlert2 Z-Index for modals & trigger blur. `registerModal()`
    // dan tag <style> sama-sama dibersihkan lewat satu cleanup, jadi kalau
    // efek ini jalan ulang karena salah satu state modal berubah (banyak
    // digabung `||` di sini), keduanya selalu unregister-lalu-register
    // bersih — tidak menumpuk counter blur.
    useEffect(() => {
        const hasModal = showModal || showGenerateModal || showDeleteModal || showEditBerlakuModal || deleteItemId !== null
        if (hasModal) {
            const unregister = registerModal()
            const style = document.createElement('style')
            style.innerHTML = `.swal2-container { z-index: 99999 !important; }`
            document.head.appendChild(style)
            return () => {
                document.head.removeChild(style)
                unregister()
            }
        }
    }, [showModal, showGenerateModal, showDeleteModal, showEditBerlakuModal, deleteItemId, registerModal])

    useEffect(() => {
        fetchInitialData()
    }, [])

    // Skip the debounced search effect on first mount (the filter effect below covers the initial load)
    const didMountSearch = useRef(false)

    // Close the "Lainnya" overflow menu on outside click
    useEffect(() => {
        if (!showMoreMenu) return
        const handler = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showMoreMenu])

    // Track dark mode so the react-select Jam picker follows the app theme
    const [isDark, setIsDark] = useState(false)
    useEffect(() => {
        const el = document.documentElement
        const update = () => setIsDark(el.classList.contains('dark'))
        update()
        const obs = new MutationObserver(update)
        obs.observe(el, { attributes: true, attributeFilter: ['class'] })
        return () => obs.disconnect()
    }, [])

    // Dropdown filters + pagination refetch immediately (no debounce). Also handles initial load on mount.
    useEffect(() => {
        fetchJadwal()
    }, [filterHari, filterKelas, filterBerlakuMulai, currentPage])

    // Search text is debounced so typing doesn't fire a request per keystroke.
    useEffect(() => {
        if (!didMountSearch.current) { didMountSearch.current = true; return }
        const to = setTimeout(fetchJadwal, 400)
        return () => clearTimeout(to)
    }, [searchTerm])

    const fetchInitialData = async () => {
        try {
            const [resGM, resK, resW] = await Promise.all([
                fetch(`/api/settings/guru-mapel?limit=10000`),
                fetch('/api/master/kelas'),
                fetch('/api/master/waktu?limit=10000')
            ])
            const [jsonGM, jsonK, jsonW] = await Promise.all([
                resGM.json(),
                resK.json(),
                resW.json()
            ])
            if (jsonGM.ok) setMasterGuruMapel(jsonGM.data || [])
            if (jsonK.ok) setMasterKelas(jsonK.data || [])
            if (jsonW.ok) setMasterWaktu(jsonW.data || [])
        } catch (e) { console.error(e) }
    }

    const fetchJadwal = async () => {
        setLoading(true)
        try {
            let url = `/api/settings/jadwal-guru?q=${searchTerm}`
            if (filterHari !== 'Semua') url += `&hari=${filterHari}`
            if (filterKelas !== 'Semua') url += `&kelas=${filterKelas}`
            if (filterBerlakuMulai) url += `&valid_date=${filterBerlakuMulai}`

            const res = await fetch(url)
            const json = await res.json()
            if (json.ok) {
                // Ensure mata_pelajaran is populated
                let data: JadwalGuru[] = json.data || []

                // Normalize mapel check
                data = data.map(d => ({
                    ...d,
                    mapel: d.mata_pelajaran || d.mapel || ''
                }))

                // Sort by hari (Senin first), then by berlaku_mulai (newest first), then by guru, then by jam
                data.sort((a, b) => {
                    // First by hari (Senin = 1, so lower = earlier in week)
                    const d = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99)
                    if (d !== 0) return d
                    // Then by berlaku_mulai (newest first = descending)
                    const dateA = a.berlaku_mulai ? new Date(a.berlaku_mulai).getTime() : 0
                    const dateB = b.berlaku_mulai ? new Date(b.berlaku_mulai).getTime() : 0
                    if (dateA !== dateB) return dateB - dateA
                    // Then by guru name
                    if (a.nama_guru !== b.nama_guru) return (a.nama_guru || '').localeCompare(b.nama_guru || '')
                    // Then by jam
                    return parseInt(a.jam_ke) - parseInt(b.jam_ke)
                })

                // Store ALL data (no slicing — grouping/pagination done in useMemo
                setList(data)
                setTotalItems(json.total || data.length)
            }
        } catch (err) {
            console.error('[JadwalGuruTab] fetchJadwal error:', err)
        } finally { setLoading(false) }

    }

    const fetchAvailableDates = async () => {
        try {
            const res = await fetch('/api/settings/jadwal-guru?distinct_dates=true')
            const json = await res.json()
            if (json.ok) {
                setAvailableBerlakuDates(json.dates || [])
                setAvailableDates(json.dates || [])
            }
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        fetchAvailableDates()
    }, [])

    // --- Grouping Logic for "Merged" Display ---
    const groupedList = useMemo(() => {
        // Group by: guru + mapel + kelas + hari + berlaku_mulai + ruang
        // Within each group, merge consecutive jam_ke into ranges.
        // `ruang` is part of the key so a room change between adjacent periods (e.g. same
        // kelas+mapel but a different physical room) is never merged into one displayed range.
        const groups: Record<string, any[]> = {}

        list.forEach(item => {
            const key = `${item.mapel || item.mata_pelajaran || ''}|${item.kelas}|${item.hari}|${item.berlaku_mulai || ''}|${item.ruang || ''}`
            if (!groups[key]) groups[key] = []
            groups[key].push(item)
        })

        const result: any[] = []
        Object.values(groups).forEach(groupItems => {
            // Sort by jam_ke ascending
            groupItems.sort((a, b) => parseInt(a.jam_ke) - parseInt(b.jam_ke))

            let rangeStart = parseInt(groupItems[0].jam_ke)
            let rangeLast = rangeStart
            const rangeItems = [groupItems[0]]

            for (let i = 1; i < groupItems.length; i++) {
                const curr = parseInt(groupItems[i].jam_ke)
                if (curr === rangeLast + 1) {
                    // Consecutive — extend range
                    rangeLast = curr
                    rangeItems.push(groupItems[i])
                } else {
                    // Gap or different mapel — push current range as a row
                    result.push({
                        ...rangeItems[0],
                        displayJam: rangeStart === rangeLast ? String(rangeStart) : `${rangeStart}-${rangeLast}`,
                        rangeItems: [...rangeItems]
                    })
                    // Start new range
                    rangeStart = curr
                    rangeLast = curr
                    rangeItems.length = 0
                    rangeItems.push(groupItems[i])
                }
            }

            // Push the last range
            result.push({
                ...rangeItems[rangeItems.length - 1],
                displayJam: rangeStart === rangeLast ? String(rangeStart) : `${rangeStart}-${rangeLast}`,
                rangeItems: [...rangeItems]
            })
        })

        // Sort result: hari, then kelas, then jam, then mapel
        return result.sort((a, b) => {
            const d = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99)
            if (d !== 0) return d
            const dateA = a.berlaku_mulai ? new Date(a.berlaku_mulai).getTime() : 0
            const dateB = b.berlaku_mulai ? new Date(b.berlaku_mulai).getTime() : 0
            if (dateA !== dateB) return dateB - dateA
            if (a.kelas !== b.kelas) return (a.kelas || '').localeCompare(b.kelas || '')
            const jamA = parseInt(a.displayJam.split('-')[0])
            const jamB = parseInt(b.displayJam.split('-')[0])
            if (jamA !== jamB) return jamA - jamB
            return (a.mapel || '').localeCompare(b.mapel || '')
        })
    }, [list])

    // Paginated rows for display
    const pageRows = useMemo(() => {
        const offset = (currentPage - 1) * itemsPerPage
        return groupedList.slice(offset, offset + itemsPerPage)
    }, [groupedList, currentPage, itemsPerPage])

    // Record count for the current page (for Pagination display)
    const currentPageRecordCount = useMemo(() => {
        return pageRows.reduce((sum, item) => sum + (item.rangeItems?.length || 1), 0)
    }, [pageRows])

    // Derived States
    const uniqueGurus = useMemo(() => {
        const map = new Map()
        masterGuruMapel.forEach(item => {
            if (!map.has(item.nama_guru)) map.set(item.nama_guru, item.nip)
        })
        return Array.from(map.entries()).map(([nama, nip]) => ({ label: nama, value: nama, nip }))
    }, [masterGuruMapel])

    const availableMapels = useMemo(() => {
        if (!formGuru) return []
        return masterGuruMapel
            .filter(item => item.nama_guru === formGuru)
            .map(item => item.nama_mapel)
            .filter((v, i, a) => a.indexOf(v) === i)
    }, [formGuru, masterGuruMapel])

    // Group kelas by Program for the filter dropdown — Reguler first, then the rest
    // alphabetically — so kelompok peminatan/UTBK don't flood one flat, unsorted list.
    const kelasByProgram = useMemo(() => {
        const groups: Record<string, KelasItem[]> = {}
        masterKelas.forEach(k => {
            const program = k.program || 'Reguler'
            if (!groups[program]) groups[program] = []
            groups[program].push(k)
        })
        return Object.entries(groups).sort(([a], [b]) => {
            if (a === 'Reguler') return -1
            if (b === 'Reguler') return 1
            return a.localeCompare(b, 'id')
        })
    }, [masterKelas])

    const availableWaktu = useMemo(() => {
        const selectedKelasObj = masterKelas.find(k => k.nama === formKelas)
        const program = selectedKelasObj ? selectedKelasObj.program : 'Reguler'

        return masterWaktu
            .filter(w => w.hari === formHari && w.program === program)
            .sort((a, b) => a.jam_ke - b.jam_ke)
    }, [masterWaktu, formHari, formKelas, masterKelas])

    // Jam options for the multiselect dropdown — value = jam_ke, label includes the time range
    const jamSelectOptions = useMemo(() => {
        return availableWaktu.map(w => ({
            value: w.jam_ke,
            label: `Jam ${w.jam_ke} (${w.mulai.slice(0, 5)}-${w.selesai.slice(0, 5)})`,
        }))
    }, [availableWaktu])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAdmin) {
            Swal.fire('Akses Ditolak', 'Anda tidak memiliki izin untuk menyimpan data.', 'warning')
            return
        }
        if (formJams.length === 0) return Swal.fire('Peringatan', 'Pilih minimal satu jam!', 'warning')
        if (!formNip || !formGuru) return Swal.fire('Peringatan', 'NIP dan Nama Guru wajib diisi.', 'warning')

        const matchingGuruMapel = masterGuruMapel.find(gm =>
            gm.nama_guru === formGuru &&
            gm.nip === formNip &&
            gm.nama_mapel === formMapel
        )
        if (!matchingGuruMapel) {
            return Swal.fire('Validasi Gagal', 'NIP tidak sesuai dengan Nama Guru dan Mata Pelajaran yang dipilih.', 'error')
        }

        setSaving(true)
        try {
            const res = await fetch('/api/jadwal/save', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    berlaku_mulai: formBerlakuMulai,
                    replace_ids: editId ? editingIds : [],
                    rows: formJams.map(jam => ({ nama_guru: formGuru, nip: formNip,
                        mata_pelajaran: formMapel, hari: formHari, kelas: formKelas,
                        ruang: formRuang || null, jam_ke: jam })),
                }),
            })
            const result = await res.json()
            if (!res.ok || !result.ok) throw new Error(result.error || 'Gagal menyimpan jadwal')
            window.dispatchEvent(new CustomEvent('acca:jadwal-updated'))
            setShowModal(false)
            resetForm()
            fetchJadwal()
        } catch (e: any) {
            console.error(e)
            Swal.fire('Error', e.message, 'error')
        }
        finally { setSaving(false) }
    }

    const [editingIds, setEditingIds] = useState<number[]>([])

    const handleEdit = (item: any) => {
        if (!isAdmin) return;
        const editItems = item.rangeItems || [item]
        const editIds = editItems.map((r: any) => r.id)
        setEditingIds(editIds)
        setEditId(editIds[0])
        setFormJams(editItems.map((r: any) => parseInt(r.jam_ke)))

        setFormGuru(item.nama_guru)
        const found = uniqueGurus.find(g => g.label === item.nama_guru)
        setFormNip(item.nip || found?.nip || '')

        setFormMapel(item.mapel || item.mata_pelajaran || '')
        setFormHari(item.hari)
        setFormKelas(item.kelas)
        setFormRuang(item.ruang || '')
        setFormBerlakuMulai(item.berlaku_mulai ? item.berlaku_mulai.split('T')[0] : todayStr)
        setShowModal(true)
    }

    const handleDelete = (item: any) => {
        if (!isAdmin) {
            Swal.fire('Akses Ditolak', 'Anda tidak memiliki izin untuk menghapus.', 'warning')
            return;
        }
        const itemsToDelete = item.rangeItems || [item]
        setDeleteItemId(itemsToDelete[0].id)
        setDeleteItemData(item)
        setMobileAction({ open: false, item: null })
    }

    // Fetch available masa berlaku dates when modal opens
    useEffect(() => {
        if (showDeleteModal) {
            fetchAvailableDates()
        }
    }, [showDeleteModal])

    const handleDeleteByMasaBerlaku = async () => {
        if (!isAdmin) {
            Swal.fire('Akses Ditolak', 'Anda tidak memiliki izin untuk menghapus.', 'warning')
            return;
        }
        if (selectedDates.length === 0) {
            Swal.fire('Peringatan', 'Pilih minimal satu tanggal masa berlaku!', 'warning')
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Hapus Jadwal Massal?',
            html: `Akan menghapus jadwal pada tanggal:<br/><b>${selectedDates.join(', ')}</b><br/><br/>Jumlah: <b>${selectedDates.length} kelompok tanggal</b>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#d33',
            didOpen: () => openModal(),
            willClose: () => closeModal(),
        })
        if (!isConfirmed) return;

        setDeleting(true)
        try {
            const res = await fetch('/api/jadwal/delete-dates', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: selectedDates }),
            })
            const result = await res.json()
            if (!res.ok || !result.ok) throw new Error(result.error || 'Gagal menghapus jadwal')
            Swal.fire('Berhasil', 'Berhasil menghapus ' + result.data.deleted + ' jadwal.', 'success')
            window.dispatchEvent(new CustomEvent('acca:jadwal-updated'))
            fetchAvailableDates()
            setShowDeleteModal(false)
            setSelectedDates([])
            fetchJadwal()
        } catch (e: any) {
            console.error(e)
            Swal.fire('Error', e.message, 'error')
        } finally {
            setDeleting(false)
        }
    }

    const toggleDate = (date: string) => {
        setSelectedDates(prev =>
            prev.includes(date)
                ? prev.filter(d => d !== date)
                : [...prev, date]
        )
    }

    const selectAllDates = () => {
        setSelectedDates([...availableDates])
    }

    const clearSelectedDates = () => {
        setSelectedDates([])
    }

    // --- Edit Berlaku Massal ---
    const handleOpenEditBerlaku = () => {
        setEditOldDate('')
        setEditNewDate('')
        setEditPreviewCount(0)
        fetchAvailableDates()
        setShowEditBerlakuModal(true)
    }

    // Pick the "old" berlaku date inside the modal and preview how many rows it affects
    const handleSelectEditOldDate = async (date: string) => {
        setEditOldDate(date)
        if (!date) { setEditPreviewCount(0); return }
        try {
            const res = await fetch(`/api/settings/jadwal-guru?valid_date=${date}`)
            const json = await res.json()
            if (json.ok) setEditPreviewCount(json.data?.length || 0)
        } catch (e) {
            console.error(e)
        }
    }

    const handleEditBerlakuMassal = async () => {
        if (!editOldDate || !editNewDate) {
            setAlertMsg({ text: 'Pilih tanggal lama dan tanggal baru!', type: 'error' });
            return;
        }
        if (editOldDate === editNewDate) {
            setAlertMsg({ text: 'Tanggal baru harus berbeda dengan tanggal lama!', type: 'error' });
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Ubah Masa Berlaku?',
            html: `Ubah masa berlaku dari <b>${editOldDate}</b> menjadi <b>${editNewDate}</b>?<br/><br/>Jumlah jadwal: <b>${editPreviewCount}</b>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ubah',
            cancelButtonText: 'Batal',
            didOpen: () => openModal(),
            willClose: () => closeModal(),
        })
        if (!isConfirmed) return;

        setEditingBerlaku(true)
        try {
            const res = await fetch('/api/jadwal/move-date', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_date: editOldDate, new_date: editNewDate }),
            })
            const result = await res.json()
            if (!res.ok || !result.ok) throw new Error(result.error || 'Gagal mengubah tanggal')
            setAlertMsg({ text: 'Berhasil mengubah ' + result.data.updated + ' jadwal.', type: 'success' })
            window.dispatchEvent(new CustomEvent('acca:jadwal-updated'))
            setShowEditBerlakuModal(false)
            setEditOldDate('')
            setEditNewDate('')
            setEditPreviewCount(0)
            fetchJadwal()
            fetchAvailableDates()
        } catch (e: any) {
            console.error(e)
            setAlertMsg({ text: 'Error: ' + e.message, type: 'error' })
        } finally {
            setEditingBerlaku(false)
        }
    }

    const resetForm = () => {
        setEditId(null)
        setEditingIds([])
        setFormGuru('')
        setFormNip('')
        setFormMapel('')
        setFormHari('Senin')
        setFormKelas('')
        setFormRuang('')
        setFormJams([])
        setFormBerlakuMulai(todayStr)
    }

    // --- Generate Logic ---
    const handleGenerateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setGenerateFile(file)
        }
    }

    const handleGenerateProcess = async () => {
        if (!isAdmin) return;
        if (!generateFile) {
            setAlertMsg({ text: 'Pilih file Excel terlebih dahulu!', type: 'error' })
            return
        }
        if (!generateTanggalMulai) {
            setAlertMsg({ text: 'Pilih Tanggal Berlaku terlebih dahulu!', type: 'error' })
            return
        }

        setGenerating(true)
        try {
            // Ensure master data is loaded (fetch fresh data directly)
            const resGM = await fetch(`/api/settings/guru-mapel?limit=10000`)
            const jsonGM = await resGM.json()
            if (!jsonGM.ok || !jsonGM.data?.length) {
                throw new Error(`Data guru-mapel tidak ditemukan. Pastikan data sudah ada di tab "Guru Mapel".`)
            }

            // Use fresh data directly for this process
            const guruMapelData: GuruMapelEntry[] = jsonGM.data
            console.log('[GENERATE] guruMapelData count:', guruMapelData.length)

            // Build TWO lookups:
            // 1. kode_guru + nama_mapel → ARRAY (for full subject names)
            const guruMapelByNama = new Map<string, GuruMapelEntry[]>()
            // 2. kode_guru + kode_mapel → ARRAY (for short codes like BAH, BWK)
            const guruMapelByKode = new Map<string, GuruMapelEntry[]>()
            for (const gm of guruMapelData) {
                if (!gm.kode_guru || !gm.nama_mapel) continue
                // By nama_mapel (exact)
                const namaKey = `${gm.kode_guru}|${gm.nama_mapel}`
                if (!guruMapelByNama.has(namaKey)) guruMapelByNama.set(namaKey, [])
                guruMapelByNama.get(namaKey)!.push(gm)
                // By kode_mapel (if exists)
                if (gm.kode_mapel) {
                    const kodeKey = `${gm.kode_guru}|${gm.kode_mapel}`
                    if (!guruMapelByKode.has(kodeKey)) guruMapelByKode.set(kodeKey, [])
                    guruMapelByKode.get(kodeKey)!.push(gm)
                }
            }
            console.log('[GENERATE] guruMapelByNama:', guruMapelByNama.size, 'guruMapelByKode:', guruMapelByKode.size)

            // Fetch fresh Master Kelas — needed to resolve room→kelas (reguler) and kode→kelas (peminatan/UTBK)
            const resKelas = await fetch('/api/master/kelas?limit=10000')
            const jsonKelas = await resKelas.json()
            if (!jsonKelas.ok) {
                throw new Error('Gagal memuat data Master Kelas.')
            }
            const kelasData: KelasEntry[] = jsonKelas.data || []
            const kelasByNama = new Map<string, KelasEntry>()
            const kelasByKode = new Map<string, KelasEntry>()
            for (const k of kelasData) {
                kelasByNama.set(k.nama, k)
                if (k.kode) kelasByKode.set(k.kode, k)
            }

            const data = await generateFile.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

            if (jsonData.length < 2) {
                throw new Error('Format file tidak valid. Minimal harus ada 2 baris (header dan kelas).')
            }

            // Find the header row for room names and the first data row
            let roomNamesRowIndex = 1;
            let firstDataRowIndex = 2;

            for (let i = 0; i < Math.min(15, jsonData.length); i++) {
                const row = jsonData[i]
                if (!row) continue;
                const hari = row[0] ? String(row[0]).trim() : '';
                const jam = (row[1] !== undefined && row[1] !== null && row[1] !== '') ? parseInt(String(row[1])) : NaN;
                
                // If it looks like a schedule row (has a valid day and a valid number for Jam)
                if (hari.length > 2 && !isNaN(jam) && jam >= 0) {
                    firstDataRowIndex = i;
                    roomNamesRowIndex = i - 1;
                    break;
                }
            }

            // Extract ROOM names from the identified header row (starting from column index 2).
            const rooms: { name: string, col: number }[] = []
            const roomNamesRow = jsonData[roomNamesRowIndex] || []
            for (let col = 2; col < roomNamesRow.length; col++) {
                const roomName = roomNamesRow[col]
                if (roomName && String(roomName).trim()) {
                    rooms.push({ name: String(roomName).trim(), col: col })
                }
            }

            if (rooms.length === 0) {
                throw new Error(`Tidak ada nama ruang/kelas ditemukan di baris ke-${roomNamesRowIndex + 1}.`)
            }

            // Parse schedule data
            const schedulesToProcess: any[] = []
            const errors: string[] = []

            for (let rowIndex = firstDataRowIndex; rowIndex < jsonData.length; rowIndex++) {
                const row = jsonData[rowIndex]
                const hari = row[0] ? String(row[0]).trim() : null
                const jamKe = (row[1] !== undefined && row[1] !== null && row[1] !== '') ? parseInt(String(row[1])) : null

                if (!hari || jamKe === null || isNaN(jamKe)) continue

                for (const room of rooms) {
                    const cellValue = row[room.col]
                    const roomName = room.name

                    if (!cellValue || String(cellValue).trim() === '') continue

                    const cellStr = String(cellValue).trim()
                    const { entries, error } = parseJadwalCell(cellStr, roomName, guruMapelByNama, guruMapelByKode, kelasByNama, kelasByKode)

                    if (error) {
                        errors.push(`Baris ${rowIndex + 1}, Ruang ${roomName}: ${error}`)
                        continue
                    }

                    // Add each entry as a separate schedule
                    for (const parsed of entries) {
                        const scheduleKey = `${parsed.nip}|${parsed.mata_pelajaran}|${parsed.kelas}|${hari}|${jamKe}|${generateTanggalMulai}`
                        const existsIdx = schedulesToProcess.findIndex(s =>
                            `${s.nip}|${s.mata_pelajaran}|${s.kelas}|${s.hari}|${s.jam_ke}|${s.berlaku_mulai}` === scheduleKey
                        )
                        if (existsIdx < 0) {
                            schedulesToProcess.push({
                                nip: parsed.nip,
                                nama_guru: parsed.nama_guru,
                                mata_pelajaran: parsed.mata_pelajaran,
                                hari: hari,
                                kelas: parsed.kelas,
                                ruang: parsed.ruang,
                                jam_ke: jamKe,
                                berlaku_mulai: generateTanggalMulai,
                                aktif: true
                            })
                        }
                    }
                }
            }

            console.log('[GENERATE] schedulesToProcess:', schedulesToProcess.length)
            if (schedulesToProcess.length > 0) {
                console.log('[GENERATE] Sample:', schedulesToProcess.slice(0, 5).map((s: any) => `${s.nip} ${s.mata_pelajaran} jam ${s.jam_ke} ${s.kelas}`))
            }

            if (errors.length > 0) {
                const errorMsg = errors.slice(0, 3).join('\n\n') + (errors.length > 3 ? `\n\n... dan ${errors.length - 3} error lainnya` : '')
                setAlertMsg({ text: `Ditemukan ${errors.length} error:\n\n${errorMsg}`, type: 'error' })
                setGenerating(false)
                return
            }

            if (schedulesToProcess.length === 0) {
                throw new Error('Tidak ada data valid untuk diimport.')
            }

            // Validasi bentrok: 1 guru tidak boleh dijadwalkan di >1 kelas pada hari+jam
            // yang sama. Beri tahu admin dan minta konfirmasi eksplisit (centang) sebelum
            // tetap melanjutkan — proses generate TIDAK dihentikan otomatis seperti error
            // parsing, karena bentrok kadang memang disengaja (mis. team teaching/piket).
            const bentrokList = detectJadwalBentrok(schedulesToProcess)
            if (bentrokList.length > 0) {
                const distinctGuru = new Set(bentrokList.map(b => b.nip)).size
                const { isConfirmed, value: forceProceed } = await Swal.fire({
                    icon: 'warning',
                    title: `Ditemukan ${distinctGuru} guru bentrok jadwal`,
                    html: `
                        <div style="text-align:left">
                            <p style="margin:0 0 8px;font-size:0.85rem;color:var(--n-muted, #64748b)">
                                Guru berikut dijadwalkan di lebih dari satu kelas pada hari &amp; jam yang sama:
                            </p>
                            <ul style="margin:0;padding-left:18px;max-height:240px;overflow-y:auto;font-size:0.85rem">
                                ${bentrokList.map(b => `<li style="margin-bottom:6px">
                                    <strong>${escapeHtml(b.nama_guru)}</strong> — ${escapeHtml(b.hari)}, Jam ke-${b.jam_ke}:
                                    ${b.kelasList.map(escapeHtml).join(', ')}
                                </li>`).join('')}
                            </ul>
                        </div>
                    `,
                    input: 'checkbox',
                    inputValue: 0,
                    inputPlaceholder: 'Tetap lanjutkan meski ada jadwal bentrok',
                    showCancelButton: true,
                    confirmButtonText: 'Proses',
                    cancelButtonText: 'Batal, saya perbaiki dulu',
                    width: 560,
                    reverseButtons: true,
                })

                if (!isConfirmed) {
                    setGenerating(false)
                    return
                }
                if (!forceProceed) {
                    setAlertMsg({ text: `Dibatalkan: ${distinctGuru} guru masih bentrok jadwal. Centang "Tetap lanjutkan" jika ingin memproses tetap, atau perbaiki file Excel dan upload ulang.`, type: 'error' })
                    setGenerating(false)
                    return
                }
                // forceProceed === 1 (checkbox dicentang) → lanjut proses seperti biasa
            }

            // -----------------------------------------------------------------
            // TULIS SEBAGAI SATU VERSI
            //
            // Dulu: baris disisipkan/di-update satu per satu, lalu ditebak mana
            // baris lama yang perlu dimatikan berdasarkan pasangan (nip, hari)
            // yang kebetulan tersentuh file baru. Dua akibatnya:
            //  1. Guru yang DIHAPUS dari suatu hari tidak pernah tersentuh, jadi
            //     jadwal lamanya hidup selamanya (bug "absen di kelas yang bukan
            //     jadwal saya").
            //  2. Upload ulang tanggal yang sama menumpuk duplikat — versi
            //     2026-08-09 sempat berisi 3.199 baris untuk 620 slot nyata.
            //
            // Sekarang: satu upload = satu versi. Isi versi itu ditulis ulang
            // utuh (nonaktifkan seluruh isinya, lalu insert isi baru), dan
            // penentuan "versi mana yang berlaku" jadi urusan jadwal_versi —
            // tidak ada lagi tebakan.
            // -----------------------------------------------------------------
            const res = await fetch('/api/jadwal/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    berlaku_mulai: generateTanggalMulai,
                    jenis: generateJenis,
                    catatan: 'Generate dari ' + generateFile.name,
                    rows: schedulesToProcess,
                }),
            })
            const result = await res.json()
            if (!res.ok || !result.ok) throw new Error(result.error || result.message || 'Gagal menyimpan jadwal')
            setAlertMsg({ text: 'Berhasil menyimpan ' + result.data.inserted + ' baris jadwal sebagai versi ' + generateJenis + '.', type: 'success' })
            window.dispatchEvent(new CustomEvent('acca:jadwal-updated'))
            setGenerating(false)
            setGenerateFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
            // Close modal after a tick so InlineAlert can render first
            setTimeout(() => {
                setShowGenerateModal(false)
                fetchJadwal()
                fetchAvailableDates()
            }, 50)

        } catch (err: any) {
            console.error(err)
            setAlertMsg({ text: 'Error: ' + err.message, type: 'error' })
        } finally {
            setGenerating(false)
        }
    }

    const handleExport = () => {
        if (!isAdmin) return;
        const data = list.map((l, i) => ({
            No: i + 1,
            NIP: l.nip,
            Guru: l.nama_guru,
            Mapel: l.mapel,
            Hari: l.hari,
            Kelas: l.kelas,
            Jam: l.jam_ke,
            Berlaku_Mulai: l.berlaku_mulai || '-',
            Aktif: l.aktif ? 'Ya' : 'Tidak'
        }))
        exportToExcel(data, 'Jadwal_Guru')
    }

    const openAdd = () => {
        resetForm()
        setShowModal(true)
    }

    // Theme-aware react-select styling for the Jam multiselect (follows the app's dark mode)
    const jamSelectStyles = useMemo(() => {
        const t = isDark
            ? { bg: 'var(--n-surface)', bgFocus: 'var(--n-surface)', border: 'var(--n-border)', text: 'var(--n-ink)', menuBg: 'var(--n-card)', optHover: 'rgba(59,130,246,0.18)', chipBg: 'rgba(59,130,246,0.18)', chipText: '#93c5fd', chipHover: 'rgba(59,130,246,0.32)', placeholder: 'var(--n-muted)' }
            : { bg: '#f8fafc', bgFocus: '#ffffff', border: '#cbd5e1', text: '#0f172a', menuBg: '#ffffff', optHover: '#eff6ff', chipBg: '#eff6ff', chipText: '#1e40af', chipHover: '#dbeafe', placeholder: '#94a3b8' }

        return {
            control: (base: any, state: any) => ({
                ...base,
                borderRadius: '10px',
                border: `1px solid ${state.isFocused ? '#3b82f6' : t.border}`,
                boxShadow: state.isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                background: state.isFocused ? t.bgFocus : t.bg,
                padding: '2px',
                '&:hover': { borderColor: '#3b82f6' },
            }),
            menu: (base: any) => ({ ...base, background: t.menuBg, zIndex: 20 }),
            menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
            option: (base: any, state: any) => ({
                ...base,
                background: state.isFocused ? t.optHover : 'transparent',
                color: t.text,
                cursor: 'pointer',
            }),
            input: (base: any) => ({ ...base, color: t.text }),
            placeholder: (base: any) => ({ ...base, color: t.placeholder }),
            multiValue: (base: any) => ({ ...base, backgroundColor: t.chipBg, borderRadius: '6px' }),
            multiValueLabel: (base: any) => ({ ...base, color: t.chipText, fontWeight: '600' }),
            multiValueRemove: (base: any) => ({
                ...base,
                color: t.chipText,
                ':hover': { backgroundColor: t.chipHover, color: t.chipText },
            }),
            indicatorSeparator: (base: any) => ({ ...base, display: 'none' }),
            dropdownIndicator: (base: any) => ({ ...base, color: t.placeholder, padding: '0 8px' }),
        }
    }, [isDark])

    return (
        <div className="sk">
            {/* Toolbar */}
            <FilterToolbar actionsInline>
                <FilterSearch
                    value={searchTerm}
                    onChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
                    placeholder="Cari Guru / Mapel / Ruang..."
                />

                <FilterSelect
                    label="Hari"
                    value={filterHari}
                    onChange={(val) => { setFilterHari(val); setCurrentPage(1); }}
                    options={[
                        { value: 'Semua', label: 'Semua Hari' },
                        ...Object.keys(dayOrder).map(d => ({ value: d, label: d }))
                    ]}
                />

                <FilterSelect
                    label="Kelas"
                    value={filterKelas}
                    onChange={(val) => { setFilterKelas(val); setCurrentPage(1); }}
                    options={[
                        { value: 'Semua', label: 'Semua Kelas' },
                        ...kelasByProgram.flatMap(([, items]) => items.map(k => ({ value: k.nama, label: k.nama })))
                    ]}
                />

                <FilterSelect
                    label="Berlaku"
                    value={filterBerlakuMulai}
                    onChange={(val) => { setFilterBerlakuMulai(val); setCurrentPage(1); }}
                    variant="wide"
                    width={185}
                    grow={2}
                    options={[
                        { value: '', label: 'Berlaku Terbaru' },
                        ...availableBerlakuDates.map(d => ({
                            value: d,
                            label: new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                        }))
                    ]}
                />

                <FilterActions>
                    {isAdmin && (
                        <Button
                            variant="primary"
                            onClick={openAdd}
                            leftIcon={<i className="bi bi-plus-lg" />}
                            className="sk__btnDesktopOnly"
                        >
                            Tambah
                        </Button>
                    )}
                    {isAdmin && (
                        <div className="sk__more" ref={moreMenuRef}>
                            <Button
                                variant="outline"
                                onClick={() => setShowMoreMenu(v => !v)}
                                aria-haspopup="true"
                                aria-expanded={showMoreMenu}
                                title="Lainnya"
                                style={{ minWidth: 40, padding: '0 12px' }}
                                leftIcon={<i className="bi bi-three-dots" />}
                            />
                            {showMoreMenu && (
                                <div className="sk__moreMenu" role="menu">
                                    <button type="button" role="menuitem" className="sk__menuItemMobileOnly" onClick={() => { setShowMoreMenu(false); openAdd() }}>
                                        <span className="sk__menuIcon"><i className="bi bi-plus-lg" style={{ color: '#10b981' }} /></span>
                                        <span className="sk__menuLabel">Tambah Jadwal</span>
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => { setShowMoreMenu(false); handleExport() }}>
                                        <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel" style={{ color: '#3b82f6' }} /></span>
                                        <span className="sk__menuLabel">Export Excel</span>
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => { setShowMoreMenu(false); handleOpenEditBerlaku() }}>
                                        <span className="sk__menuIcon"><i className="bi bi-calendar-check" style={{ color: '#10b981' }} /></span>
                                        <span className="sk__menuLabel">Edit Berlaku Massal</span>
                                    </button>
                                    <button type="button" role="menuitem" className="danger" onClick={() => { setShowMoreMenu(false); setShowDeleteModal(true) }}>
                                        <span className="sk__menuIcon"><i className="bi bi-trash-fill" style={{ color: '#ef4444' }} /></span>
                                        <span className="sk__menuLabel">Hapus Massal</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </FilterActions>
            </FilterToolbar>

            {/* Desktop Table View */}
            <div className="sk__tableWrap">
                {!loading && totalItems > 0 && (
                    <div className="sk__recordCount">
                        <span className="sk__recordTotal">{totalItems.toLocaleString('id-ID')}</span> jadwal
                        {groupedList.length !== totalItems && (
                            <span className="sk__recordNote"> · {groupedList.length.toLocaleString('id-ID')} baris ditampilkan (setelah digabung)</span>
                        )}
                    </div>
                )}
                <table className="sk__table">
                    <thead>
                        <tr>
                            <th className="cNo">No</th>
                            <th>Hari</th>
                            <th className="cJam">Jam</th>
                            <th>Mapel</th>
                            <th>Kelas</th>
                            <th>Guru</th>
                            <th>Berlaku</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="sk__empty" style={{ border: 'none' }}>
                                    <Spinner variant="trace" />
                                </td>
                            </tr>
                        ) : pageRows.length === 0 ? (
                            <tr><td colSpan={8} className="sk__empty sk__muted">Tidak ada jadwal.</td></tr>
                        ) : (
                            pageRows.map((item: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="tCenter">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td><span className={`sk__day ${item.hari.toLowerCase()}`}>{item.hari}</span></td>
                                    <td className="tCenter font-bold text-blue-600">{item.displayJam}</td>
                                    <td className="font-medium">{item.mapel || '-'}</td>
                                    <td className="tCenter">
                                        <span className="font-bold">{item.kelas || '-'}</span>
                                    </td>
                                    <td className="tNameCell">
                                        <span className="tNameCell__name">{item.nama_guru || '-'}</span>
                                        <span className="tNameCell__sub">{item.nip || '-'}</span>
                                    </td>
                                    <td className="tCenter tMuted">{item.berlaku_mulai ? item.berlaku_mulai.slice(0, 10) : '-'}</td>
                                    <td>
                                        <ActionGroup>
                                            {isAdmin && (
                                                <ActionButton action="edit" onClick={() => handleEdit(item)} />
                                            )}
                                            {isAdmin && (
                                                <ActionButton action="delete" onClick={() => handleDelete(item)} />
                                            )}
                                        </ActionGroup>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards (Grouped Inset List with Touch Swipe Pagination) */}
            <div
                className="sk__cards"
                aria-label="Daftar Jadwal PBM versi mobile"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {loading ? (
                    <div className="sk__cardLoading" style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
                        <Spinner variant="trace" />
                    </div>
                ) : pageRows.length === 0 ? (
                    <div className="sk__cardEmpty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--n-ink, #0f172a)', marginBottom: 2 }}>Tidak ada data</div>
                        <div style={{ fontSize: '0.80rem', color: 'var(--n-muted, #64748b)' }}>Coba ubah kata kunci pencarian atau filter</div>
                    </div>
                ) : (
                    pageRows.map((item: any, idx: number) => (
                        <div
                            className="sk__cardCompact"
                            key={`m-jg-${item.id || idx}`}
                            onClick={() => setMobileAction({ open: true, item })}
                        >
                            <div className="sk__avatar">
                                {(currentPage - 1) * itemsPerPage + idx + 1}
                            </div>
                            <div className="sk__cardCompactLeft">
                                <div className="sk__cardName">
                                    {item.kelas || '-'} · {item.hari}, Jam {item.displayJam}
                                </div>
                                <div className="sk__cardNip">
                                    <span>{item.mapel || '-'}</span>
                                    {!item.aktif && (
                                        <span className="sk__statusBadge inactive">Nonaktif</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Aksi utama tab: Generate — FAB melayang di desktop, tombol tengah
                bottom nav di mobile. Tambah jadwal tetap tombol biasa di toolbar. */}
            {isAdmin && <DesktopFab label="Generate" icon="gear-fill" onClick={() => setShowGenerateModal(true)} />}
            {isAdmin && <MobileFab label="Generate" icon="gear-fill" onClick={() => setShowGenerateModal(true)} />}

            {/* Pagination (Placed at the bottom for both desktop and mobile) */}
            {groupedList.length > itemsPerPage && (
                <Pagination itemLabel="jadwal"
                    currentPage={currentPage}
                    totalPages={Math.ceil(groupedList.length / itemsPerPage)}
                    limit={itemsPerPage}
                    totalItems={totalItems}
                    recordCount={currentPageRecordCount}
                    onPageChange={setCurrentPage}
                    onLimitChange={(newLimit) => {
                        setItemsPerPage(newLimit);
                        setCurrentPage(1);
                    }}
                />
            )}

            {/* Sheet */}
            {mobileAction.open && mobileAction.item && (
                <div className="sk__sheetOverlay" onClick={(e) => e.target === e.currentTarget && setMobileAction({ open: false, item: null })}>
                    <div className="sk__sheet">
                        <div className="sk__sheetHandle"></div>
                        <div className="sk__sheetTitle">
                            <div className="sk__sheetName">{mobileAction.item.kelas || '-'} · {mobileAction.item.hari}, Jam {(mobileAction.item as any).displayJam || mobileAction.item.jam_ke}</div>
                            <div className="sk__sheetSub">{mobileAction.item.mapel || '-'}</div>
                        </div>
                        <div className="sk__sheetActions">
                            {canUpdate && (
                                <button className="sk__sheetBtn" onClick={() => { setMobileAction({ open: false, item: null }); handleEdit(mobileAction.item!) }}>
                                    <i className="bi bi-pencil"></i> Edit Jadwal
                                </button>
                            )}
                            {canDelete && (
                                <button className="sk__sheetBtn danger" onClick={() => handleDelete(mobileAction.item)}>
                                    <i className="bi bi-trash"></i> Hapus Jadwal
                                </button>
                            )}
                        </div>
                        <button className="sk__sheetCancel" onClick={() => setMobileAction({ open: false, item: null })}>Batal</button>
                    </div>
                </div>
            )}

            {/* Generate Modal */}
            {showGenerateModal && (
                <Modal size="md" variant="add" onClose={() => { setShowGenerateModal(false); closeModal(); }} labelledBy="generate-jadwal-guru-title">
                    <ModalHeader
                        id="generate-jadwal-guru-title"
                        icon="file-earmark-excel"
                        title="Generate Jadwal dari Excel"
                        subtitle="Upload file dengan format ACCA_GenerateJadwal"
                        onClose={() => { setShowGenerateModal(false); closeModal(); }}
                    />
                    <ModalBody>
                        <div className="sk__field">
                            <label>Tanggal Berlaku</label>
                            <DatePicker
                                value={generateTanggalMulai}
                                onChange={setGenerateTanggalMulai}
                                className="sk__dateInput"
                            />
                        </div>

                        <div className="sk__field" style={{ marginTop: '12px' }}>
                            <label>Jenis Penetapan</label>
                            <div className="sk__radioGroup">
                                <label className="sk__radioOpt">
                                    <input
                                        type="radio"
                                        name="jenisVersi"
                                        checked={generateJenis === 'penuh'}
                                        onChange={() => setGenerateJenis('penuh')}
                                    />
                                    <span>
                                        <strong>Jadwal menyeluruh</strong>
                                        <small>File memuat jadwal LENGKAP seluruh sekolah. Jadwal versi sebelumnya berhenti berlaku sejak tanggal di atas — guru yang tidak ada di file ini otomatis tidak lagi punya jadwal.</small>
                                    </span>
                                </label>
                                <label className="sk__radioOpt">
                                    <input
                                        type="radio"
                                        name="jenisVersi"
                                        checked={generateJenis === 'parsial'}
                                        onChange={() => setGenerateJenis('parsial')}
                                    />
                                    <span>
                                        <strong>Perbaikan sebagian</strong>
                                        <small>File hanya memuat sebagian slot. Slot yang disebut di file ditimpa; selebihnya tetap mengikuti jadwal menyeluruh terakhir.</small>
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="sk__field" style={{ marginTop: '12px' }}>
                            <label>Pilih File Excel</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleGenerateFileSelect}
                                className="sk__fileInput"
                            />
                            {generateFile && (
                                <div className="sk__fileName">
                                    <i className="bi bi-file-earmark-excel"></i>
                                    <span>{generateFile.name}</span>
                                </div>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => { setShowGenerateModal(false); closeModal(); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button
                            variant="primary"
                            type="button"
                            onClick={handleGenerateProcess}
                            disabled={generating || !generateFile}
                            isLoading={generating}
                            leftIcon={<i className="bi bi-gear-fill" />}
                        >
                            Generate Jadwal
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Delete by Masa Berlaku Modal */}
            {showDeleteModal && (
                <Modal size="lg" variant="delete" onClose={() => { setShowDeleteModal(false); setSelectedDates([]); closeModal(); }} labelledBy="delete-massal-guru-title">
                    <ModalHeader
                        id="delete-massal-guru-title"
                        icon="trash3"
                        title="Hapus Jadwal Massal"
                        subtitle="Pilih tanggal masa berlaku yang akan dihapus"
                        onClose={() => { setShowDeleteModal(false); setSelectedDates([]); closeModal(); }}
                    />
                    <ModalBody>
                        <div className="sk__warningBox">
                            <i className="bi bi-exclamation-triangle"></i>
                            <span>Peringatan: Tindakan ini tidak dapat dibatalkan!</span>
                        </div>

                        <div className="sk__field" style={{ marginTop: '12px' }}>
                            <div className="sk__dateSelectHeader">
                                <label>Pilih Tanggal Masa Berlaku ({selectedDates.length} dipilih)</label>
                                <div className="sk__dateSelectActions">
                                    <button type="button" className="sk__linkBtn" onClick={selectAllDates}>Pilih Semua</button>
                                    <button type="button" className="sk__linkBtn" onClick={clearSelectedDates}>Batal Pilih</button>
                                </div>
                            </div>
                            {availableDates.length === 0 ? (
                                <Spinner variant="trace" />
                            ) : (
                                <div className="sk__dateList">
                                    {availableDates.map(date => (
                                        <label key={date} className={`sk__dateItem ${selectedDates.includes(date) ? 'selected' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedDates.includes(date)}
                                                onChange={() => toggleDate(date)}
                                            />
                                            <span className="sk__dateItemLabel">
                                                {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                            <span className="sk__dateItemDate">{date}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => { setShowDeleteModal(false); setSelectedDates([]); closeModal(); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button
                            variant="danger"
                            type="button"
                            onClick={handleDeleteByMasaBerlaku}
                            disabled={deleting || selectedDates.length === 0}
                            isLoading={deleting}
                            leftIcon={<i className="bi bi-trash3-fill" />}
                        >
                            {`Hapus ${selectedDates.length} Tanggal`}
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Edit Berlaku Massal Modal */}
            {showEditBerlakuModal && (
                <Modal size="md" variant="edit" onClose={() => { setShowEditBerlakuModal(false); setEditOldDate(''); setEditNewDate(''); setEditPreviewCount(0); closeModal(); }} labelledBy="edit-berlaku-guru-title">
                    <ModalHeader
                        id="edit-berlaku-guru-title"
                        icon="calendar2-check"
                        title="Edit Masa Berlaku Massal"
                        subtitle="Ubah tanggal berlaku untuk semua jadwal pada tanggal tertentu"
                        onClose={() => { setShowEditBerlakuModal(false); setEditOldDate(''); setEditNewDate(''); setEditPreviewCount(0); closeModal(); }}
                    />
                    <ModalBody>
                        {editOldDate && (
                            <div className="sk__infoBox">
                                <div className="sk__infoItem">
                                    <i className="bi bi-info-circle"></i>
                                    <span>Akan mengubah <strong>{editPreviewCount}</strong> jadwal dari tanggal <strong>{editOldDate}</strong></span>
                                </div>
                            </div>
                        )}

                        <div className="sk__field" style={{ marginTop: editOldDate ? '12px' : 0 }}>
                            <label>Tanggal Lama (yang akan diubah)</label>
                            <select value={editOldDate} onChange={e => handleSelectEditOldDate(e.target.value)}>
                                <option value="">-- Pilih tanggal berlaku --</option>
                                {availableBerlakuDates.map(d => (
                                    <option key={d} value={d}>
                                        {new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="sk__field" style={{ marginTop: '12px' }}>
                            <label>Tanggal Baru</label>
                            <DatePicker
                                value={editNewDate}
                                onChange={setEditNewDate}
                                min={todayStr}
                            />
                        </div>

                        {editNewDate && editNewDate <= todayStr && (
                            <div className="sk__hintWarn">
                                <i className="bi bi-exclamation-triangle"></i>
                                Tanggal baru tidak boleh sebelum atau sama dengan hari ini
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => { setShowEditBerlakuModal(false); setEditOldDate(''); setEditNewDate(''); setEditPreviewCount(0); closeModal(); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button
                            variant="primary"
                            type="button"
                            onClick={handleEditBerlakuMassal}
                            disabled={editingBerlaku || !editOldDate || !editNewDate || editNewDate <= todayStr}
                            isLoading={editingBerlaku}
                            leftIcon={<i className="bi bi-check-lg" />}
                        >
                            {`Ubah ${editPreviewCount} Jadwal`}
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            {deleteItemId !== null && (
                <Modal size="sm" variant="delete" onClose={() => { setDeleteItemId(null); setDeleteItemData(null); }} labelledBy="delete-single-guru-title">
                    <ModalHeader
                        id="delete-single-guru-title"
                        icon="trash3"
                        title={deleteItemData?.nama_guru || '-'}
                        onClose={() => { setDeleteItemId(null); setDeleteItemData(null); }}
                    />
                    <ModalBody>
                        {deleteItemData?.rangeItems && deleteItemData.rangeItems.length > 1 && (
                            <p style={{ margin: 0, color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}>
                                Catatan: {deleteItemData.rangeItems.length} jadwal (range jam) akan dihapus.
                            </p>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => { setDeleteItemId(null); setDeleteItemData(null); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button
                            variant="danger"
                            type="button"
                            isLoading={deletingSingle}
                            leftIcon={<i className="bi bi-trash3-fill" />}
                            onClick={async () => {
                                if (!deleteItemId) return
                                const item = deleteItemData
                                const itemsToDelete = item?.rangeItems || [{ id: deleteItemId }]
                                setDeletingSingle(true)
                                try {
                                    const res = await fetch('/api/jadwal/delete-rows', {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ ids: itemsToDelete.map((rec: any) => rec.id) }),
                                    })
                                    const result = await res.json()
                                    if (!res.ok || !result.ok) throw new Error(result.error || 'Gagal menghapus jadwal')
                                    window.dispatchEvent(new CustomEvent('acca:jadwal-updated'))
                                    fetchAvailableDates()
                                    Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data berhasil dihapus.', timer: 1500, showConfirmButton: false })
                                    fetchJadwal()
                                } catch (error: any) {
                                    Swal.fire({ icon: 'error', title: 'Gagal', text: error.message || 'Tidak dapat menghubungi server.' })
                                } finally {
                                    setDeletingSingle(false)
                                    setDeleteItemId(null)
                                    setDeleteItemData(null)
                                }
                            }}
                            disabled={deletingSingle}
                        >
                            Ya, Hapus!
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* Modal Add/Edit */}
            {showModal && (
                <Modal size="lg" variant={editId ? 'edit' : 'add'} onClose={() => { setShowModal(false); closeModal(); }} labelledBy="jadwal-guru-modal-title">
                    <ModalHeader
                        id="jadwal-guru-modal-title"
                        icon={editId ? 'pencil-square' : 'plus-lg'}
                        title={editId ? 'Edit Jadwal' : 'Tambah Jadwal Mengajar'}
                        onClose={() => { setShowModal(false); closeModal(); }}
                    />
                    <form onSubmit={handleSubmit}>
                        <ModalBody>
                            <div className="sk__grid2 sk__grid2--guru">
                                <div className="sk__field">
                                    <label>Guru</label>
                                    <SearchableSelect
                                        value={formGuru}
                                        onChange={val => {
                                            const selectedVal = Array.isArray(val) ? (val[0] || '') : val;
                                            setFormGuru(selectedVal as string);
                                            const g = uniqueGurus.find(u => u.value === selectedVal);
                                            setFormNip(g?.nip || '');
                                            setFormMapel('');
                                        }}
                                        options={uniqueGurus}
                                        placeholder="Pilih Guru..."
                                    />
                                </div>
                                <div className="sk__field">
                                    <label>Tanggal Berlaku</label>
                                    <DatePicker
                                        required
                                        value={formBerlakuMulai}
                                        onChange={setFormBerlakuMulai}
                                    />
                                </div>
                            </div>

                            <div className="sk__field" style={{ marginTop: '12px' }}>
                                <label>Mata Pelajaran</label>
                                <select required value={formMapel} onChange={e => setFormMapel(e.target.value)} disabled={!formGuru}>
                                    <option value="">-- Pilih Mapel --</option>
                                    {availableMapels.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="sk__grid2" style={{ marginTop: '12px' }}>
                                <div className="sk__field">
                                    <label>Hari</label>
                                    <select required value={formHari} onChange={e => setFormHari(e.target.value)}>
                                        {Object.keys(dayOrder).map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="sk__field">
                                    <label>Kelas</label>
                                    <select required value={formKelas} onChange={e => {
                                        setFormKelas(e.target.value)
                                        setFormJams([])
                                    }}>
                                        <option value="">-- Pilih Kelas --</option>
                                        {masterKelas.map(k => <option key={k.id} value={k.nama}>{k.nama}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="sk__field" style={{ marginTop: '12px' }}>
                                <label>Ruangan (Opsional)</label>
                                <input
                                    type="text"
                                    value={formRuang}
                                    onChange={e => setFormRuang(e.target.value)}
                                    placeholder="Contoh: Laboratorium, Perpustakaan (kosongkan jika sama dengan nama kelas)"
                                />
                            </div>
                            <div className="sk__field" style={{ marginTop: '12px' }}>
                                <label>Jam Ke- (Pilih) {formKelas && masterKelas.find(k => k.nama === formKelas)?.program ? `(${masterKelas.find(k => k.nama === formKelas)?.program})` : ''}</label>
                                {availableWaktu.length === 0 ? (
                                    <div className="sk__hintWarn">Belum ada data waktu untuk program ini.</div>
                                ) : (
                                    <Select
                                        isMulti
                                        options={jamSelectOptions}
                                        value={jamSelectOptions.filter(opt => formJams.includes(opt.value))}
                                        onChange={(selected) => setFormJams(selected.map(s => s.value))}
                                        placeholder="Pilih jam ke-..."
                                        styles={jamSelectStyles}
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                    />
                                )}
                                <div className="sk__hint">{formJams.length} jam dipilih</div>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="cancel" type="button" onClick={() => { setShowModal(false); closeModal(); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                            <Button variant="primary" type="submit" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>Simpan</Button>
                        </ModalFooter>
                    </form>
                </Modal>
            )}

            <style jsx>{`
                :global(:root) {
                    --sk-line: rgba(148, 163, 184, 0.22);
                    --sk-card: rgba(255, 255, 255, 0.92);
                    --sk-shadow: 0 14px 34px rgba(2, 6, 23, 0.08);
                    --sk-shadow2: 0 10px 22px rgba(2, 6, 23, 0.08);
                    --sk-radius: 16px;
                    --sk-fs: 0.88rem;
                    --sk-fs-sm: 0.82rem;
                    --sk-fs-xs: 0.78rem;
                    --sk-safe-b: env(safe-area-inset-bottom, 0px);
                    --sk-safe-t: env(safe-area-inset-top, 0px);
                }

                .sk { width: 100%; display: flex; flex-direction: column; gap: 12px; font-size: var(--sk-fs); padding: 0; background: transparent; border-radius: 16px; padding-bottom: calc(16px + var(--sk-safe-b)); }

                .sk__bar { display: flex; gap: 10px; padding: 12px 14px; background: var(--n-card); border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.22); box-shadow: 0 2px 12px rgba(2, 6, 23, 0.06); align-items: center; flex-wrap: nowrap; }

                .sk__search { position: relative; flex: 1.5 1 160px; min-width: 120px; }
                .sk__search i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: rgba(100, 116, 139, 0.9); pointer-events: none; font-size: 0.9rem; z-index: 1; }
                .sk__search input { width: 100%; height: 38px; padding: 0 10px 0 32px; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; background: var(--n-card); font-weight: 500; font-size: 0.8rem; outline: none; color: var(--n-text); transition: border-color 0.2s; }
                .sk__search input:focus { border-color: var(--n-primary); }

                .sk__filters { display: flex; gap: 8px; flex-wrap: nowrap; flex: 1 1 auto; align-items: center; }
                .sk__filters select, .sk__filters .sk__dateInput { height: 38px; padding: 0 12px; border: 1px solid var(--n-border); border-radius: 10px; font-weight: 600; font-size: 0.82rem; outline: none; cursor: pointer; color: var(--n-text); background: var(--n-card); transition: border-color 0.2s; flex: 1 1 auto; min-width: 100px; }
                .sk__filters select {
                    appearance: none;
                    -webkit-appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolygon points='22 3 2 3 12 15'%3e%3c/polygon%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: right 14px center;
                    background-size: 13px;
                    padding-right: 38px;
                }
                .sk__filters select:focus { border-color: var(--n-primary); }

                .sk__actions { display: flex; gap: 8px; flex: 0 0 auto; align-items: center; justify-content: flex-end; flex-wrap: nowrap; }
                select { cursor: pointer; }

                /* Overflow "Lainnya" menu */
                .sk__more { position: relative; display: inline-flex; }
                .sk__more > .sk__btn { width: 100%; justify-content: center; }
                .sk__moreMenu {
                    position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
                    background: #fff; border: 1px solid rgba(148,163,184,0.35);
                    border-radius: 12px; box-shadow: 0 12px 30px rgba(2,6,23,0.14);
                    padding: 6px; min-width: 210px; display: flex; flex-direction: column; gap: 2px;
                    animation: zoomIn 0.12s ease-out;
                }
                .sk__moreMenu button {
                    display: flex; align-items: center; gap: 10px; width: 100%;
                    padding: 9px 12px; border: none; background: transparent; border-radius: 8px;
                    font-size: 0.8rem; font-weight: 500; color: var(--n-text, #0f172a);
                    cursor: pointer; text-align: left;
                }
                .sk__moreMenu button:hover { background: rgba(148,163,184,0.14); }
                .sk__moreMenu button.danger { color: #dc2626; }
                .sk__moreMenu button.danger:hover { background: rgba(220,38,38,0.10); }
                .sk__moreMenu button i { font-size: 0.95rem; width: 16px; text-align: center; }

                .sk__btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    gap: 6px;
                    height: 38px;
                    padding: 0 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.4);
                    background: rgba(255, 255, 255, 0.78);
                    color: rgba(7, 22, 46, 0.9);
                    font-weight: 650;
                    font-size: 0.84rem;
                    cursor: pointer;
                    transition: transform 0.15s ease, box-shadow 0.18s ease, background 0.18s ease;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                    white-space: nowrap;
                    flex: 1 1 auto;
                    min-width: 90px;
                }
                .sk__btn i { font-size: 0.9rem; }

                .sk__btn:hover {
                    box-shadow: 0 4px 12px rgba(58, 166, 255, 0.2);
                    transform: translateY(-1px);
                    filter: brightness(1.05);
                }
                .sk__btn:active { transform: translateY(0); }
                .sk__btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; filter: none; }

                .sk__btnPrimary {
                    background: linear-gradient(135deg, #0f2a6e, #3083FF);
                    color: #fff;
                    font-weight: 700;
                }
                .sk__btnExport {
                    background: linear-gradient(135deg, #059669, #10b981);
                    color: #fff;
                }
                .sk__btnGenerate {
                    background: linear-gradient(135deg, #3083FF, #3b82f6);
                    color: #fff;
                }
                .sk__btnDanger {
                    background: linear-gradient(135deg, #dc2626, #ef4444);
                    color: #fff;
                }
                .sk__btnGhost {
                    background: rgba(255, 255, 255, 0.78);
                    border: 1px solid var(--sk-line);
                }
                .sk__btnWarning {
                    background: linear-gradient(135deg, #d97706, #f59e0b);
                    color: #fff;
                }
                .sk__btnWarning:hover {
                    background: linear-gradient(135deg, #b45309, #d97706);
                }

                .sk__tableWrap { background: var(--n-card); border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.22); overflow: hidden; box-shadow: 0 4px 20px rgba(2, 6, 23, 0.07); overflow-x: auto; }
                .sk__recordCount { padding: 8px 16px; font-size: 0.82rem; color: rgba(100, 116, 139, 0.9); border-bottom: 1px solid var(--n-border); background: rgba(248, 250, 252, 0.7); }
                .sk__recordTotal { font-weight: 700; color: rgba(15, 23, 42, 0.9); }
                .sk__recordNote { color: rgba(100, 116, 139, 0.75); }
                .sk__table { width: 100%; border-collapse: collapse; min-width: 600px; }
                .sk__table th { padding: 12px 16px; text-align: left; background: var(--n-soft); color: var(--n-muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--n-border); white-space: nowrap; }
                .sk__table td { padding: 11px 16px; border-bottom: 1px solid var(--n-border); vertical-align: middle; color: var(--n-text); font-size: 0.82rem; }
                .sk__table tr:last-child td { border-bottom: none; }
                .sk__table tbody tr:hover td { background: rgba(58, 166, 255, 0.04); }
                .sk__rowActions { display: flex; gap: 6px; justify-content: flex-end; }
                .sk__iconBtn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid rgba(26, 115, 232, 0.25); background: rgba(26, 115, 232, 0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #1a73e8; transition: all 0.15s ease; }
                .sk__iconBtn:hover { background: #1a73e8; color: #ffffff; }
                .sk__iconBtn.danger { color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.08); }
                .sk__iconBtn.danger:hover { background: #ef4444; color: #ffffff; }

                .sk__day { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
                .sk__day.senin { background: #e0f2fe; color: #0284c7; }
                .sk__day.selasa { background: #f0fdf4; color: #16a34a; }
                .sk__day.rabu { background: #fefce8; color: #ca8a04; }
                .sk__day.kamis { background: var(--n-surface); color: #e11d48; }
                .sk__day.jumat { background: #faf5ff; color: #3083FF; }
                .sk__day.sabtu { background: #f3f4f6; color: var(--n-muted); }

                .sk__hint { font-size: 0.8rem; color: var(--n-muted); margin-top: 4px; font-style: italic; }
                .sk__hintWarn { border-color: rgba(245, 158, 11, 0.22); background: rgba(245, 158, 11, 0.1); color: rgba(180, 83, 9, 1); padding: 12px; border-radius: 8px; }

                .sk__warningBox { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.22); border-radius: 10px; color: rgba(185, 28, 28, 1); font-weight: 600; font-size: var(--sk-fs-sm); margin-bottom: 16px; }
                .sk__warningBox i { font-size: 1.2rem; color: #dc2626; }

                .sk__radioGroup { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
                .sk__radio { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; padding: 10px 14px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 10px; background: rgba(255, 255, 255, 0.8); transition: all 0.2s; }
                .sk__radio:hover { border-color: rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.05); }
                .sk__radio input[type="radio"] { margin-top: 2px; accent-color: #0f2a6e; width: 16px; height: 16px; cursor: pointer; }
                .sk__radio span { font-size: var(--sk-fs-sm); color: rgba(15, 23, 42, 0.9); }

                .sk__infoBox { background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 10px; padding: 12px 14px; margin-top: 12px; }
                .sk__infoItem { display: flex; align-items: flex-start; gap: 8px; font-size: var(--sk-fs-sm); color: rgba(15, 23, 42, 0.8); }
                .sk__infoItem i { color: #3b82f6; font-size: 1rem; margin-top: 2px; flex-shrink: 0; }
                .sk__inputDisabled { background: rgba(148, 163, 184, 0.1) !important; color: rgba(15, 23, 42, 0.5) !important; cursor: not-allowed; }
                .sk__hintWarn { display: flex; align-items: flex-start; gap: 8px; font-size: var(--sk-fs-sm); color: rgba(180, 83, 9, 1); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.22); border-radius: 8px; padding: 10px 14px; margin-top: 8px; }
                .sk__hintWarn i { color: #d97706; margin-top: 2px; flex-shrink: 0; }

                .sk__modalWide { max-width: 500px; }
                .sk__dateSelectHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .sk__dateSelectHeader label { font-weight: 700; font-size: var(--sk-fs-sm); color: rgba(15, 23, 42, 0.9); }
                .sk__dateSelectActions { display: flex; gap: 12px; }
                .sk__linkBtn { background: none; border: none; color: var(--n-primary); font-weight: 600; font-size: var(--sk-fs-sm); cursor: pointer; text-decoration: underline; padding: 0; }
                .sk__linkBtn:hover { color: #1d4ed8; }
                .sk__dateList { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding: 4px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 12px; background: rgba(248, 250, 252, 0.5); }
                .sk__dateItem { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 10px; background: var(--n-card); cursor: pointer; transition: all 0.2s; }
                .sk__dateItem:hover { border-color: rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.03); }
                .sk__dateItem.selected { border-color: #dc2626; background: rgba(239, 68, 68, 0.06); }
                .sk__dateItem input[type="checkbox"] { width: 18px; height: 18px; accent-color: #dc2626; cursor: pointer; flex-shrink: 0; }
                .sk__dateItemLabel { flex: 1; font-weight: 500; font-size: var(--sk-fs-sm); color: rgba(15, 23, 42, 0.9); }
                .sk__dateItemDate { font-size: var(--sk-fs-xs); color: var(--n-muted); font-weight: 600; background: rgba(148, 163, 184, 0.1); padding: 4px 8px; border-radius: 6px; }

                .sk__empty { padding: 20px; text-align: center; color: rgba(100, 116, 139, 0.8); font-weight: 500; }
                .sk__muted { color: rgba(148, 163, 184, 0.8); }
                .tCenter { text-align: center; }
                .tMono { font-family: monospace; }
                .font-medium { font-weight: 500; }
                .font-bold { font-weight: 700; }
                .tKelasCell { display: flex; flex-direction: column; align-items: center; gap: 1px; }
                .tKelasRuang { font-size: 0.72rem; font-weight: 400; color: var(--n-muted); }
                .cNo { width: 60px; text-align: center; }
                .tMuted { color: var(--n-muted); font-size: 0.75rem; }
                .tNameCell { display: flex; flex-direction: column; gap: 2px; }
                
                /* RECORD COUNT */
                .sk__recordTotal { font-weight: 800; color: var(--n-ink); }
                .sk__recordNote { color: var(--n-muted); font-weight: 400; }

                /* VIEW TOGGLE */
                .sk__viewToggle {
                    display: inline-flex;
                    align-items: center;
                    background: var(--n-card, #f8fafc);
                    border: 1.5px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    padding: 3px;
                    gap: 2px;
                }
                .sk__viewBtn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 9px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-muted, #64748b);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .sk__viewBtn:hover {
                    color: var(--n-ink, #0f172a);
                }
                .sk__viewBtn.active {
                    background: #10b981;
                    color: #ffffff;
                    font-weight: 700;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
                }
                .sk__cardDesktopActions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-shrink: 0;
                    margin-left: auto;
                }
                @media (max-width: 768px) {
                    .sk__cardDesktopActions {
                        display: none;
                    }
                }
                :global(.dark) .sk__viewToggle {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                }
                :global(.dark) .sk__viewBtn {
                    color: #94a3b8 !important;
                }
                :global(.dark) .sk__viewBtn.active {
                    background: #1a73e8 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 10px rgba(26, 115, 232, 0.5) !important;
                }
                
                .tNameCell__name { font-weight: 600; color: var(--n-ink); }
                .tNameCell__sub { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--n-muted); font-weight: 400; }
                :global(.dark) .tNameCell__name { color: var(--n-ink) !important; }
                :global(.dark) .tNameCell__sub { color: var(--n-muted) !important; }

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
                  background: var(--n-card);
                  border: 1px solid var(--n-border);
                  border-radius: 9999px;
                  color: var(--n-navy);
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
                  background: var(--n-soft);
                  border-color: var(--n-primary);
                  color: var(--n-navy);
                }

                .sk__btnActionMenu i,
                .sk__btnMore i {
                  font-size: 1.1rem;
                  color: var(--n-navy);
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
                  background: var(--n-card);
                  border: 1px solid var(--n-border);
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
                  border: 1px solid var(--n-border);
                  background: var(--n-card);
                  border-radius: 9999px;
                  text-align: left;
                  cursor: pointer;
                  font-size: 0.84rem;
                  font-weight: 600;
                  color: var(--n-navy);
                  transition: all 0.15s ease;
                }

                .sk__menuItem:hover,
                .sk__menuItem:active {
                  background: var(--n-soft);
                  border-color: var(--n-primary);
                  transform: translateY(-1px);
                }

                .sk__menuSep {
                  height: 1px;
                  background: var(--n-border);
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
                  color: var(--n-ink);
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

                .sk__cards {
                    display: none;
                    flex-direction: column;
                    gap: 2px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
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
                    background: var(--n-soft);
                }

                .sk__avatar {
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.74rem;
                    font-weight: 800;
                    flex-shrink: 0;
                    letter-spacing: 0.02em;
                    background: var(--n-soft);
                    color: var(--n-primary);
                    border: 1px solid var(--n-border);
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
                    font-size: 0.82rem;
                    line-height: 1.25;
                    color: #112E59;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .sk__cardCompactLeft .sk__cardNip {
                    font-size: 0.73rem;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .sk__cardCompactRight {
                    flex: 0 0 auto;
                    display: flex;
                    align-items: center;
                }

                .sk__chevron {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: #E0ECFF;
                    color: #3083FF;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: all 0.15s ease;
                }
                .sk__cardCompact:active .sk__chevron {
                    background: #3083FF;
                    color: #ffffff;
                }

                /* Sheet */
                .sk__sheetOverlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 0; }
                .sk__sheet { background: #ffffff; width: 100%; max-width: 480px; border-radius: 20px 20px 0 0; padding: 20px 24px calc(24px + env(safe-area-inset-bottom, 0px)); animation: slideUpSheet 0.25s ease-out; box-shadow: 0 -10px 40px rgba(0,0,0,0.15); }
                @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .sk__sheetHandle { width: 40px; height: 4px; background: #E1E2E9; border-radius: 99px; margin: 0 auto 18px; }
                .sk__sheetTitle { margin-bottom: 20px; text-align: center; }
                .sk__sheetName { font-weight: 800; font-size: 1.05rem; color: #112E59; }
                .sk__sheetSub { font-size: 0.82rem; color: #64748b; margin-top: 4px; font-weight: 500; }
                .sk__sheetActions { display: flex; flex-direction: row; gap: 10px; margin-bottom: 12px; }
                .sk__sheetBtn { flex: 1 1 0; width: auto; padding: 12px 14px; background: #E0ECFF; border: 1.5px solid #E1E2E9; border-radius: 12px; font-weight: 700; font-size: 0.88rem; color: #112E59; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; white-space: nowrap; }
                .sk__sheetBtn:hover { background: #d0e3ff; }
                .sk__sheetBtn.danger { background: #fef2f2; border-color: #fee2e2; color: #ef4444; }
                .sk__sheetBtn.danger:hover { background: #fee2e2; }
                .sk__sheetCancel { width: 100%; padding: 12px; background: #ffffff; border: 1.5px solid #E1E2E9; border-radius: 12px; font-weight: 700; color: #64748b; cursor: pointer; }

                @media (max-width: 768px) {
                    .sk__tableWrap { display: none; }
                    .sk__cards { display: flex; }
                    .sk {
                        padding: 0;
                        padding-bottom: calc(16px + var(--sk-safe-b));
                        background: transparent;
                        border-radius: 0;
                    }
                    .sk__bar {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 10px;
                        padding: 10px;
                        background: var(--n-card);
                        border-radius: 14px;
                        border: 1px solid rgba(148,163,184,0.22);
                        box-shadow: 0 2px 12px rgba(2,6,23,0.06);
                    }
                    .sk__search { flex: none; width: 100%; }
                    .sk__filters {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 8px;
                        width: 100%;
                    }
                    .sk__filters select, .sk__filters .sk__dateInput {
                        width: 100%;
                        min-width: 0;
                        font-size: 0.82rem;
                        padding: 9px 10px;
                        flex: none;
                    }
                    .sk__actions {
                        display: flex;
                        flex-direction: row;
                        gap: 6px;
                        width: 100%;
                    }
                    .sk__actions > button { flex: 1; }
                    .sk__actions .sk__more { flex: 0 0 auto; }
                    .sk__actions .sk__btn { justify-content: center; padding-left: 4px; padding-right: 4px; }
                    .sk__actions .sk__more .sk__btn { width: 100%; }
                }

                /* Modal Overlay */
                .sk__modalOverlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                }
                .sk__modal {
                    background: var(--n-card);
                    width: 100%;
                    max-width: 520px;
                    border-radius: 20px;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
                    overflow: hidden;
                    animation: zoomIn 0.2s ease-out;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                @keyframes zoomIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .sk__modalHead {
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--n-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    position: sticky;
                    top: 0;
                    background: var(--n-card);
                    z-index: 1;
                }
                .sk__modalTitle h2 {
                    margin: 0;
                    font-weight: 800;
                    font-size: 1.05rem;
                    color: var(--n-text);
                }
                .sk__close {
                    background: none;
                    border: none;
                    color: var(--n-muted);
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 0;
                    line-height: 1;
                }
                .sk__close:hover { color: var(--n-text); }
                .sk__modalBody {
                    padding: 20px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .sk__grid2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .sk__field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .sk__radioGroup {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .sk__radioOpt {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 10px 12px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    background: var(--n-card);
                    cursor: pointer;
                    transition: border-color 0.2s, background 0.2s;
                }
                .sk__radioOpt:hover {
                    border-color: var(--primary, #2563eb);
                }
                .sk__radioOpt:has(input:checked) {
                    border-color: var(--primary, #2563eb);
                    background: var(--n-soft);
                }
                .sk__radioOpt input {
                    width: auto;
                    padding: 0;
                    margin-top: 3px;
                    flex: 0 0 auto;
                    accent-color: var(--primary, #2563eb);
                }
                .sk__radioOpt span {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .sk__radioOpt strong {
                    font-size: 0.88rem;
                    color: var(--n-text);
                }
                .sk__radioOpt small {
                    font-size: 0.76rem;
                    line-height: 1.45;
                    color: var(--n-muted);
                }
                .sk__field label {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .sk__field input {
                    padding: 10px 12px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.2s;
                    background: var(--n-card);
                }
                .sk__field select {
                    appearance: none;
                    -webkit-appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolygon points='22 3 2 3 12 15'%3e%3c/polygon%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: right 14px center;
                    background-size: 13px;
                    padding: 10px 12px;
                    padding-right: 36px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.2s;
                    background-color: var(--n-card);
                }
                .sk__field input:focus,
                .sk__field select:focus {
                    border-color: var(--n-primary);
                }
                .sk__modalFoot {
                    padding: 16px 24px;
                    background: var(--n-soft);
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    border-top: 1px solid var(--n-border);
                    position: sticky;
                    bottom: 0;
                }

                @media (max-width: 480px) {
                    .sk__btn { padding: 8px 10px; font-size: 0.78rem; }
                    .sk__btn i { font-size: 0.85rem; }
                }
                :global(.dark) .sk__dateList { background: #000000 !important; border-color: rgba(26, 115, 232, 0.4) !important; }
                :global(.dark) .sk__dateItem { background: #090d16 !important; border-color: rgba(26, 115, 232, 0.3) !important; color: #e2e8f0 !important; }
                :global(.dark) .sk__dateItem:hover { background: rgba(26, 115, 232, 0.12) !important; border-color: #3b82f6 !important; }
                :global(.dark) .sk__dateItem.selected { background: rgba(239, 68, 68, 0.15) !important; border: 1px solid #ef4444 !important; color: #ffffff !important; box-shadow: 0 0 10px rgba(239, 68, 68, 0.25) !important; }
                :global(.dark) .sk__dateItemLabel { color: #e2e8f0 !important; }
                :global(.dark) .sk__dateItemDate { background: rgba(255, 255, 255, 0.06) !important; color: #94a3b8 !important; }
                :global(.dark) .sk__dateItem.selected .sk__dateItemDate { background: rgba(239, 68, 68, 0.25) !important; color: #fca5a5 !important; }
                :global(.dark) .sk__dateSelectHeader label { color: #e2e8f0 !important; }
                :global(.dark) .sk__linkBtn { color: #60a5fa !important; }
                :global(.dark) .sk__linkBtn:hover { color: #93c5fd !important; }
                :global(.dark) .sk__warningBox { background: rgba(239, 68, 68, 0.14) !important; border: 1px solid rgba(239, 68, 68, 0.45) !important; color: #fca5a5 !important; }
                :global(.dark) .sk__warningBox i { color: #f87171 !important; }
                :global(.dark) .sk__card { background: var(--n-card); }
                :global(.dark) .sk__group { background: var(--n-card); }
                :global(.dark) .sk__groupHeader { background: var(--n-card); }
            /* ===== DARK MODE FULL ===== */
/* ROOT */
:global(.dark) .sk { background: rgba(255,255,255,0.03) !important; }
/* TABLE */
:global(.dark) .sk__table { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__table thead th { background: rgba(255,255,255,0.05) !important; color: var(--n-muted) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__table tbody td { background: var(--n-card) !important; color: var(--n-ink) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.025) !important; }
:global(.dark) .sk__table tbody tr:hover td { background: rgba(79,142,247,0.06) !important; }
/* TOOLBAR */
:global(.dark) .sk__bar { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 16px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 16px rgba(26, 115, 232, 0.15) !important; }
:global(.dark) .sk__search { background: transparent !important; border: none !important; box-shadow: none !important; }
:global(.dark) .sk__search input[type="text"], :global(.dark) .sk__search input { height: 40px !important; background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 12px !important; color: #ffffff !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.2) !important; padding-left: 36px !important; }
:global(.dark) .sk__search i { color: #60a5fa !important; }
:global(.dark) .sk__filters select, :global(.dark) select { height: 40px !important; box-sizing: border-box !important; background-color: #000000 !important; background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjYgOSAxMiAxNSAxOCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==") !important; background-repeat: no-repeat !important; background-position: right 12px center !important; background-size: 16px 16px !important; padding-right: 36px !important; -webkit-appearance: none !important; appearance: none !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; color: #ffffff !important; }
:global(.dark) .sk__moreMenu { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__moreMenu button { color: var(--n-ink) !important; }
:global(.dark) .sk__moreMenu button:hover { background: var(--n-elevated) !important; }
/* BUTTONS */
:global(.dark) .sk__btn { background: #000000 !important; color: #ffffff !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.2) !important; }
:global(.dark) .sk__btn:hover { background: rgba(26, 115, 232, 0.15) !important; border-color: #3b82f6 !important; box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important; }
:global(.dark) .sk__btnGhost { background: #000000 !important; color: #ffffff !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.2) !important; }
:global(.dark) .sk__btnGhost:hover { background: rgba(26, 115, 232, 0.15) !important; border-color: #3b82f6 !important; }
:global(.dark) .sk__btnGenerate { background: rgba(26, 115, 232, 0.12) !important; color: #60a5fa !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; }
:global(.dark) .sk__btnPrimary { background: #1a73e8 !important; color: #ffffff !important; border: 1.8px solid #3b82f6 !important; box-shadow: 0 0 14px rgba(26, 115, 232, 0.5) !important; }
/* EMPTY / LOADING */
:global(.dark) .sk__empty, :global(.dark) .sk__muted { color: var(--n-muted) !important; }
/* CARDS / GROUP */
:global(.dark) .sk__group { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__groupTitle { color: var(--n-ink) !important; }
:global(.dark) .sk__groupMeta { color: var(--n-muted) !important; }
:global(.dark) .sk__cards { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__cardCompact { background: transparent !important; }
:global(.dark) .sk__cardCompact:hover,
:global(.dark) .sk__cardCompact:active { background: rgba(59, 130, 246, 0.15) !important; }
:global(.dark) .sk__avatar { background: rgba(59, 130, 246, 0.2) !important; color: #60a5fa !important; border-color: rgba(59, 130, 246, 0.4) !important; }
:global(.dark) .sk__cardCompactLeft .sk__cardName { color: var(--n-ink) !important; }
:global(.dark) .sk__cardCompactLeft .sk__cardNip { color: var(--n-muted) !important; }
:global(.dark) .sk__status.isOn { background: rgba(14, 165, 233, 0.15) !important; border: 1.5px solid rgba(56, 189, 248, 0.5) !important; color: #38bdf8 !important; }
:global(.dark) .sk__status.isOff { background: rgba(239, 68, 68, 0.15) !important; border: 1.5px solid rgba(239, 68, 68, 0.4) !important; color: #f87171 !important; }
:global(.dark) .sk__radio { background: rgba(255,255,255,0.05) !important; border-color: var(--n-border) !important; color: var(--n-ink) !important; }
/* HINT */
:global(.dark) .sk__hint { color: var(--n-muted) !important; }
/* JAM TIME */
:global(.dark) .sk__field input:disabled,
:global(.dark) .sk__field select:disabled {
    background-color: var(--n-surface) !important;
    opacity: 0.5;
}
/* MODAL */
:global(.dark) .sk__sheet { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__modal { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__close { color: var(--n-muted) !important; }
:global(.dark) .sk__close:hover { background: var(--n-elevated) !important; color: var(--n-ink) !important; }
/* RECORD COUNT */
:global(.dark) .sk__recordCount { background: rgba(255,255,255,0.02) !important; border-bottom-color: var(--n-border) !important; color: var(--n-muted) !important; }
:global(.dark) .sk__recordTotal { color: var(--n-ink) !important; }
:global(.dark) .sk__recordNote { color: var(--n-muted) !important; }
/* ICON BTN */
:global(.dark) .sk__iconBtn { background: rgba(26, 115, 232, 0.15) !important; border: 1.5px solid rgba(26, 115, 232, 0.6) !important; color: #60a5fa !important; }
:global(.dark) .sk__iconBtn:hover { background: #1a73e8 !important; border-color: #3b82f6 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(26, 115, 232, 0.5) !important; }
:global(.dark) .sk__iconBtn.danger { background: rgba(239, 68, 68, 0.15) !important; border: 1.5px solid rgba(239, 68, 68, 0.6) !important; color: #f87171 !important; }
:global(.dark) .sk__iconBtn.danger:hover { background: #ef4444 !important; border-color: #f87171 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(239, 68, 68, 0.5) !important; }
/* ===== END DARK MODE FULL ===== */

`}</style>
            {alertMsg && (
                <InlineAlert
                    message={alertMsg.text}
                    type={alertMsg.type}
                    onClose={() => setAlertMsg(null)}
                />
            )}
        </div>
    )
}
