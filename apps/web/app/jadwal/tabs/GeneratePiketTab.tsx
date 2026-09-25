'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import Pagination from '@/components/ui/Pagination'
import InlineAlert from '@/components/ui/InlineAlert'
import DatePicker from '@/components/ui/DatePicker'
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

interface GeneratePiketTabProps {
    /** Boleh menyimpan / mengimpor / menghapus jadwal. */
    bolehKelola: boolean
}

interface JadwalPiket {
    id: number
    hari: string
    jam_ke: number
    waktu: string
    kelas: string | null
    ruang?: string | null
    kode_guru: string | null
    nip: string | null
    nama_guru: string | null
    berlaku_mulai: string
    aktif: boolean
}

interface KodeGuruItem {
    kode_guru: string
    nip: string
    nama_guru: string
}

const dayOrder: Record<string, number> = {
    'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7
}

export default function GeneratePiketTab({ bolehKelola }: GeneratePiketTabProps) {
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

    const canCreate = isAdmin;
    const canUpdate = isAdmin;
    const canDelete = isAdmin;

    const [list, setList] = useState<JadwalPiket[]>([])
    const [loading, setLoading] = useState(true)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [totalItems, setTotalItems] = useState(0)

    // Master Data
    const [masterKelas, setMasterKelas] = useState<any[]>([])
    const [masterGuru, setMasterGuru] = useState<KodeGuruItem[]>([])
    // Current jadwal_guru snapshot — used to auto-derive which kelas occupies a ruang
    // at a given hari+jam (piket tracks the room, not the class, directly).
    const [jadwalGuruSnapshot, setJadwalGuruSnapshot] = useState<any[]>([])

    // Filter States
    const [filterHari, setFilterHari] = useState('Semua')
    const [filterKelas, setFilterKelas] = useState('Semua')
    const [filterBerlakuMulai, setFilterBerlakuMulai] = useState('')
    const [availableBerlakuDates, setAvailableBerlakuDates] = useState<string[]>([])
    const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
    const [searchGuru, setSearchGuru] = useState('')

    // UI States
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [editingIds, setEditingIds] = useState<number[]>([])
    const [mobileAction, setMobileAction] = useState<{ open: boolean, item: JadwalPiket | null }>({ open: false, item: null })

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

        if (diff > minSwipeDistance) {
            if (currentPage < Math.ceil(effectiveTotal / itemsPerPage)) {
                setCurrentPage(prev => prev + 1)
            }
        } else if (diff < -minSwipeDistance) {
            if (currentPage > 1) {
                setCurrentPage(prev => prev - 1)
            }
        }
        touchStartX.current = null
        touchEndX.current = null
    }

    // Generate Modal States
    const [showGenerateModal, setShowGenerateModal] = useState(false)
    const [generateFile, setGenerateFile] = useState<File | null>(null)
    const [generating, setGenerating] = useState(false)
    const [generateTanggalMulai, setGenerateTanggalMulai] = useState(todayStr)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

    // Form States
    const [formHari, setFormHari] = useState('Senin')
    const [formRuang, setFormRuang] = useState('')
    const [formJamKe, setFormJamKe] = useState('')
    const [formWaktu, setFormWaktu] = useState('')
    const [formGuru, setFormGuru] = useState('') // kode_guru
    const [formBerlakuMulai, setFormBerlakuMulai] = useState(todayStr)

    // Delete confirmation state
    const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
    const [deleteItemData, setDeleteItemData] = useState<JadwalPiket | null>(null)
    const [deletingSingle, setDeletingSingle] = useState(false)

    // Modal blur. `openModal`/`closeModal` tetap dipakai apa adanya utk callback
    // SweetAlert `didOpen`/`willClose` (event sekali-tembak, sudah seimbang
    // sendiri). `registerModal()` dipakai khusus utk efek di bawah supaya
    // transisi antar state modal yang digabung `||` selalu unregister-lalu-
    // register bersih, tidak menumpuk counter blur.
    const { openModal, closeModal, registerModal } = useModalBlur()

    // Fix SweetAlert2 Z-Index for modals & trigger blur
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

    // Dropdown filters + pagination refetch immediately (no debounce). Also handles initial load on mount.
    useEffect(() => {
        fetchJadwal()
    }, [filterHari, filterKelas, filterBerlakuMulai, currentPage])

    // Search text is debounced so typing doesn't fire a request per keystroke.
    useEffect(() => {
        if (!didMountSearch.current) { didMountSearch.current = true; return }
        const to = setTimeout(fetchJadwal, 400)
        return () => clearTimeout(to)
    }, [searchGuru])

    const fetchInitialData = async () => {
        try {
            const [resK, resG] = await Promise.all([
                fetch('/api/master/kelas'),
                fetch('/api/master/kode-guru?limit=10000')
            ])
            const [jsonK, jsonG] = await Promise.all([
                resK.json(),
                resG.json()
            ])
            if (jsonK.ok) setMasterKelas(jsonK.data || [])
            if (jsonG.ok) setMasterGuru(jsonG.data || [])
        } catch (e) { console.error(e) }
    }

    // Lazy load jadwal-guru snapshot when manual form modal opens
    useEffect(() => {
        if (showModal && jadwalGuruSnapshot.length === 0) {
            fetch('/api/settings/jadwal-guru?limit=10000')
                .then(res => res.json())
                .then(json => {
                    if (json.ok) setJadwalGuruSnapshot(json.data || [])
                })
                .catch(console.error)
        }
    }, [showModal, jadwalGuruSnapshot.length])

    // Lookup: given (ruang, hari, jam_ke) -> kelas currently occupying that room, per the
    // latest jadwal_guru snapshot. Used both for the manual form's live preview and as a
    // fallback if the generate flow's own fresh fetch fails.
    const kelasByRuangHariJam = useMemo(() => {
        const map = new Map<string, string>()
        for (const jg of jadwalGuruSnapshot) {
            if (!jg.ruang) continue
            const key = `${jg.ruang}|${jg.hari}|${jg.jam_ke}`
            if (!map.has(key)) map.set(key, jg.kelas)
        }
        return map
    }, [jadwalGuruSnapshot])

    // Kelas is derived (read-only) from the current jadwal_guru schedule for this ruang+hari+jam
    const derivedFormKelas = useMemo(() => {
        if (!formRuang || !formHari || !formJamKe) return null
        return kelasByRuangHariJam.get(`${formRuang}|${formHari}|${parseInt(formJamKe)}`) || null
    }, [formRuang, formHari, formJamKe, kelasByRuangHariJam])

    const fetchJadwal = async () => {
        setLoading(true)
        try {
            let url = `/api/settings/jadwal-piket`
            if (filterHari !== 'Semua') url += `?hari=${filterHari}`
            if (filterKelas !== 'Semua') url += `${url.includes('?') ? '&' : '?'}kelas=${filterKelas}`
            if (filterBerlakuMulai) url += `${url.includes('?') ? '&' : '?'}valid_date=${filterBerlakuMulai}`
            if (searchGuru.trim()) url += `${url.includes('?') ? '&' : '?'}guru=${encodeURIComponent(searchGuru.trim())}`

            const res = await fetch(url)
            const json = await res.json()
            if (json.ok) {
                const data: JadwalPiket[] = json.data || []

                // Sort by hari, then jam
                data.sort((a, b) => {
                    const d = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99)
                    if (d !== 0) return d
                    return a.jam_ke - b.jam_ke
                })

                // Store ALL data (no slicing) — deduplication/grouping done in useMemo
                setList(data)
                setTotalItems(json.total || data.length)
            } else {
                console.error('API error:', json.error)
            }
        } catch (err) {
            console.error('Fetch error:', err)
        } finally { setLoading(false) }
    }

    const fetchAvailableDates = async () => {
        try {
            const res = await fetch('/api/settings/jadwal-piket?distinct_dates=true')
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
        // Group by: guru + ruang + hari + berlaku_mulai (ruang, not kelas — kelas is derived
        // and may be null/shared, while ruang is the stable physical slot identity).
        // Within each group, merge consecutive jam_ke into ranges
        const groups: Record<string, JadwalPiket[]> = {}

        list.forEach(item => {
            const key = `${item.kode_guru || ''}|${item.ruang || ''}|${item.hari}|${item.berlaku_mulai || ''}`
            if (!groups[key]) groups[key] = []
            groups[key].push(item)
        })

        const result: any[] = []
        Object.values(groups).forEach(groupItems => {
            // Sort by jam_ke ascending
            groupItems.sort((a, b) => a.jam_ke - b.jam_ke)

            let rangeStart = groupItems[0].jam_ke
            let rangeLast = rangeStart
            const rangeItems = [groupItems[0]]

            for (let i = 1; i < groupItems.length; i++) {
                const curr = groupItems[i].jam_ke
                if (curr === rangeLast + 1) {
                    // Consecutive — extend range
                    rangeLast = curr
                    rangeItems.push(groupItems[i])
                } else {
                    // Gap — push current range as a row
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

        // Sort result: berlaku_mulai DESC (newest first), then hari, then jam
        return result.sort((a, b) => {
            const dateA = a.berlaku_mulai ? new Date(a.berlaku_mulai).getTime() : 0
            const dateB = b.berlaku_mulai ? new Date(b.berlaku_mulai).getTime() : 0
            if (dateA !== dateB) return dateB - dateA
            const d = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99)
            if (d !== 0) return d
            const jamA = parseInt(String(a.displayJam).split('-')[0])
            const jamB = parseInt(String(b.displayJam).split('-')[0])
            return jamA - jamB
        })
    }, [list])

    // Paginated rows for display
    const pageRows = useMemo(() => {
        const offset = (currentPage - 1) * itemsPerPage
        return groupedList.slice(offset, offset + itemsPerPage)
    }, [groupedList, currentPage, itemsPerPage])

    // Record count for pagination display (total unique items, not rows)
    const effectiveTotal = groupedList.length

    const resetForm = () => {
        setEditId(null)
        setEditingIds([])
        setFormHari('Senin')
        setFormRuang('')
        setFormJamKe('')
        setFormWaktu('')
        setFormGuru('')
        setFormBerlakuMulai(todayStr)
    }

    const handleEdit = (item: any) => {
        if (!isAdmin) return;
        const rangeItems = item.rangeItems || [item]
        const editIds = rangeItems.map((r: any) => r.id)
        setEditId(editIds[0])
        setEditingIds(editIds)

        setFormHari(item.hari)
        setFormRuang(item.ruang || item.kelas || '')
        // Note: For piket we currently only support single jam editing in the modal form,
        // but if multiple items are passed, we prioritize the first one.
        // If JadwalPiketTab adds multi-jam support later, this will need adjustment like JadwalGuruTab.
        setFormJamKe(String(item.jam_ke))
        setFormWaktu(item.waktu)
        setFormGuru(item.kode_guru || '')
        setFormBerlakuMulai(item.berlaku_mulai ? item.berlaku_mulai.slice(0, 10) : todayStr)
        setShowModal(true)
    }

    const handleDelete = (item: any) => {
        if (!isAdmin) {
            Swal.fire('Akses Ditolak', 'Anda tidak memiliki izin untuk menghapus.', 'warning')
            return;
        }
        const rangeItems = item.rangeItems || [item]
        setDeleteItemId(rangeItems[0].id)
        setDeleteItemData(item)
        setMobileAction({ open: false, item: null })
    }

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
            // Satu API call untuk semua tanggal — jauh lebih cepat dari loop
            const res = await fetch(
                `/api/settings/jadwal-piket?dates=${encodeURIComponent(selectedDates.join(','))}`,
                { method: 'DELETE' }
            )
            const json = await res.json()

            if (!json.ok) throw new Error(json.error || 'Gagal menghapus jadwal')

            Swal.fire('Berhasil', `Jadwal piket pada ${selectedDates.length} tanggal berhasil dihapus.`, 'success')
            setShowDeleteModal(false)
            setSelectedDates([])
            fetchJadwal()
            fetchAvailableDates()
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
            const res = await fetch(`/api/settings/jadwal-piket?valid_date=${date}`)
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
            // Satu API call bulk update — jauh lebih cepat dari loop per item
            const res = await fetch(
                `/api/settings/jadwal-piket?old_date=${encodeURIComponent(editOldDate)}&new_date=${encodeURIComponent(editNewDate)}`,
                { method: 'PUT' }
            )
            const json = await res.json()

            if (!json.ok) throw new Error(json.error || 'Gagal mengubah masa berlaku')

            setAlertMsg({
                text: `Berhasil mengubah masa berlaku ${editPreviewCount} jadwal piket`,
                type: 'success'
            })
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if ((editId || editingIds.length > 0) ? !canUpdate : !canCreate) {
            Swal.fire('Akses Ditolak', 'Anda tidak memiliki izin untuk menyimpan data.', 'warning')
            return
        }
        if (!formRuang || !formJamKe) { Swal.fire('Peringatan', 'Ruang dan Jam wajib diisi.', 'warning'); return }

        const selectedGuru = masterGuru.find(g => g.kode_guru === formGuru)
        const nip = selectedGuru?.nip || null

        // Jam ke- divalidasi SEBELUM apa pun dihapus. Ia dikirim sebagai angka, dan
        // masukan yang tidak berupa angka akan menggagalkan penyimpanan — tepat
        // setelah baris lama terhapus.
        const jamKe = parseInt(formJamKe, 10)
        if (!Number.isSafeInteger(jamKe) || jamKe < 1) {
            Swal.fire('Peringatan', 'Jam ke- harus berupa angka mulai dari 1.', 'warning')
            return
        }

        setSaving(true)
        let barisLamaTerhapus = false
        try {
            /**
             * Menyunting = hapus baris lama, lalu buat yang baru. Keduanya
             * permintaan terpisah tanpa transaksi, jadi urutannya harus dijaga:
             *
             * 1. Hasil DELETE kini DIPERIKSA. Sebelumnya diabaikan sama sekali,
             *    sehingga hapus yang gagal (mis. ditolak wewenang) diikuti pembuatan
             *    baris baru — hasilnya duplikat: yang lama masih ada, yang baru
             *    ikut masuk.
             * 2. Kalau pembuatan gagal SETELAH penghapusan berhasil, jadwal lama
             *    sudah hilang. Itu tidak bisa dibatalkan dari sini, jadi pesannya
             *    harus menyatakannya terang-terangan — kalau tidak, pemakai
             *    menyangka tidak ada yang berubah.
             */
            if (editId && editingIds.length > 0) {
                const hasilHapus = await Promise.all(
                    editingIds.map(async (id) => {
                        const r = await fetch(`/api/settings/jadwal-piket?id=${id}`, { method: 'DELETE' })
                        const j = await r.json().catch(() => ({}))
                        return r.ok && j?.ok !== false
                    }),
                )
                if (hasilHapus.some((berhasil) => !berhasil)) {
                    throw new Error(
                        'Sebagian jadwal piket lama gagal dihapus, jadi penyimpanan dibatalkan '
                        + 'agar tidak menghasilkan data ganda. Muat ulang lalu coba lagi.',
                    )
                }
                barisLamaTerhapus = true
            }

            const res = await fetch('/api/settings/jadwal-piket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hari: formHari,
                    jam_ke: jamKe,
                    waktu: formWaktu,
                    ruang: formRuang,
                    kelas: derivedFormKelas,
                    kode_guru: formGuru || null,
                    nip: nip,
                    berlaku_mulai: formBerlakuMulai
                })
            })
            const json = await res.json()
            if (!res.ok || !json.ok) throw new Error(json.message || json.error || 'Gagal menyimpan jadwal piket')

            setShowModal(false)
            resetForm()
            fetchJadwal()
        } catch (err: any) {
            const tambahan = barisLamaTerhapus
                ? ' PERHATIAN: jadwal piket lama sudah terhapus, jadi jadwal itu perlu dibuat ulang.'
                : ''
            setAlertMsg({ text: 'Error: ' + err.message + tambahan, type: 'error' })
            if (barisLamaTerhapus) fetchJadwal()
        } finally { setSaving(false) }
    }

    const isEditMode = !!editId

    // --- Generate from Excel Piket Grid ---
    const handleGenerateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        setGenerateFile(file)
    }

    const handleGenerateProcess = async () => {
        if (!generateFile) { setAlertMsg({ text: 'Pilih file Excel terlebih dahulu.', type: 'error' }); return }
        setGenerating(true)

        try {
            // Yield to UI first so the loading spinner renders before heavy processing
            await new Promise(resolve => setTimeout(resolve, 0))

            // Fetch master guru fresh to avoid race condition with initial load
            const resG = await fetch('/api/master/kode-guru?limit=10000')
            const jsonG = await resG.json()
            if (!jsonG.ok || !jsonG.data?.length) {
                throw new Error('Data guru tidak ditemukan. Pastikan data sudah ada di master.')
            }
            const guruList: any[] = jsonG.data

            // Fetch the current jadwal_guru snapshot fresh (not the possibly-stale component
            // state) to derive which kelas occupies each ruang at a given hari+jam.
            const resJG = await fetch('/api/settings/jadwal-guru?limit=10000')
            const jsonJG = await resJG.json()
            const kelasLookup = new Map<string, string>()
            if (jsonJG.ok) {
                for (const jg of (jsonJG.data || [])) {
                    if (!jg.ruang) continue
                    const key = `${jg.ruang}|${jg.hari}|${jg.jam_ke}`
                    if (!kelasLookup.has(key)) kelasLookup.set(key, jg.kelas)
                }
            }

            const arrayBuffer = await generateFile.arrayBuffer()
            const workbook = XLSX.read(arrayBuffer, { type: 'array' })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

            // Find "Berlaku Mulai Tanggal" row to extract date
            let berlakuTanggal = generateTanggalMulai
            for (let i = 0; i < Math.min(10, rawData.length); i++) {
                const row = rawData[i]
                const cell = String(row[0] || '')
                if (cell.includes('Berlaku Mulai Tanggal')) {
                    const match = cell.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
                    if (match) {
                        const months: Record<string, string> = {
                            'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04',
                            'Mei': '05', 'Juni': '06', 'Juli': '07', 'Agustus': '08',
                            'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12'
                        }
                        berlakuTanggal = `${match[3]}-${months[match[2]] || '01'}-${match[1].padStart(2, '0')}`
                    }
                    break
                }
            }

            // --- Auto-detect room names row and first data row ---
            // Strategy (same as JadwalGuruTab): scan for the first row that looks like
            // schedule data (has a valid day name in col 0 and a valid jam number in col 1).
            // Room/Ruang names are in the row just above it.
            let roomNamesRowIndex = -1
            let firstDataRowIndex = -1

            for (let i = 0; i < Math.min(20, rawData.length); i++) {
                const row = rawData[i]
                if (!row) continue
                const col0 = row[0] ? String(row[0]).trim() : ''
                const col1 = row[1] ? parseInt(String(row[1])) : NaN

                // If it looks like a schedule row (has a valid day name and a number for Jam)
                if (dayOrder[col0] && !isNaN(col1) && col1 > 0) {
                    firstDataRowIndex = i
                    roomNamesRowIndex = i - 1
                    break
                }
            }

            // Fallback: if auto-detect didn't find data rows, try finding HARI/JAM header
            if (firstDataRowIndex === -1) {
                for (let i = 0; i < rawData.length; i++) {
                    const row = rawData[i]
                    if (String(row[0]).toUpperCase().includes('HARI') && String(row[1]).toUpperCase().includes('JAM')) {
                        roomNamesRowIndex = i
                        firstDataRowIndex = i + 1
                        // Check if the row below header is also a sub-header (not data)
                        const nextRow = rawData[i + 1]
                        if (nextRow) {
                            const nextCol0 = String(nextRow[0] || '').trim()
                            const nextCol1 = parseInt(String(nextRow[1] || ''))
                            if (!dayOrder[nextCol0] || isNaN(nextCol1)) {
                                // Row below header is a sub-header (room/kelas names)
                                roomNamesRowIndex = i + 1
                                firstDataRowIndex = i + 2
                            }
                        }
                        break
                    }
                }
            }

            if (roomNamesRowIndex < 0 || firstDataRowIndex < 0) {
                throw new Error('Format Excel tidak dikenali. Pastikan ada baris nama ruang dan baris data jadwal (Hari, Jam, Kode Guru).')
            }

            // Extract room/ruang names from the identified header row.
            // Columns start from index 2 (col C) to support both 2-col and 3-col layouts.
            // We store actual column indices so gaps (empty columns) don't shift everything.
            const rooms: { name: string, col: number }[] = []
            const roomNamesRow = rawData[roomNamesRowIndex] || []
            for (let col = 2; col < roomNamesRow.length; col++) {
                const roomName = roomNamesRow[col]
                if (roomName && String(roomName).trim()) {
                    const name = String(roomName).trim()
                    // Skip header labels that are not room names
                    if (name.toUpperCase() === 'WAKTU' || name.toUpperCase() === 'JAM' || name.toUpperCase() === 'HARI') continue
                    rooms.push({ name, col })
                }
            }

            if (rooms.length === 0) {
                throw new Error(`Tidak ada nama ruang ditemukan di baris ke-${roomNamesRowIndex + 1}. Pastikan baris di atas data jadwal berisi nama ruang.`)
            }

            console.log(`[PIKET GENERATE] Room names row: ${roomNamesRowIndex + 1}, First data row: ${firstDataRowIndex + 1}, Rooms found: ${rooms.length}`, rooms.map(r => r.name))

            const recordsToInsert: any[] = []
            let currentHari = ''

            for (let r = firstDataRowIndex; r < rawData.length; r++) {
                const row = rawData[r]
                if (!row || row.length === 0) continue

                // Column A (index 0): Hari — if filled, update currentHari (supports merged cells)
                if (row[0]) {
                    const hariVal = String(row[0]).trim()
                    if (hariVal && dayOrder[hariVal]) {
                        currentHari = hariVal
                    }
                }

                // Column B (index 1): Jam ke
                const jamRaw = row[1]
                if (!jamRaw || !currentHari) continue
                const jamKe = parseInt(String(jamRaw))
                if (isNaN(jamKe)) continue

                // Column C (index 2): Waktu — may or may not be present depending on format
                const waktu = String(row[2] || '').trim()

                // Check if this is a break (Istirahat/Ishoma) — skip
                const isBreak = waktu.includes('Istirahat') || waktu.includes('Ishoma')

                if (!isBreak) {
                    // Iterate through room columns using actual column indices
                    for (const room of rooms) {
                        const cellVal = String(row[room.col] || '').trim()
                        if (!cellVal) continue

                        // Skip special non-teaching entries
                        if (cellVal.includes('Upacara') || cellVal.includes('Senam') || cellVal.includes('Jumat Bersih')) continue

                        // Look up guru by kode_guru in fresh guru list
                        const guru = guruList.find(g => g.kode_guru === cellVal)
                        const roomName = room.name
                        // Derive kelas from the current teaching schedule for this ruang+hari+jam.
                        // May be null if the room has no active jadwal_guru entry for this slot.
                        const derivedKelas = kelasLookup.get(`${roomName}|${currentHari}|${jamKe}`) || null
                        recordsToInsert.push({
                            hari: currentHari,
                            jam_ke: jamKe,
                            waktu: waktu,
                            ruang: roomName,
                            kelas: derivedKelas,
                            kode_guru: cellVal,
                            nip: guru?.nip || null,
                            berlaku_mulai: berlakuTanggal
                        })
                    }
                }
            }

            if (recordsToInsert.length === 0) {
                throw new Error('Tidak ada data valid untuk diimport.')
            }

            console.log('Sending records to import:', recordsToInsert.length)

            const res = await fetch('/api/settings/jadwal-piket/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recordsToInsert)
            })
            const json = await res.json()
            console.log('Import response:', json)

            if (!json.ok) throw new Error(json.error)

            const { inserted = 0, updated = 0, skipped = 0, total = 0, notProcessed = 0, errors = [] } = json

            let msg = `Total Excel: ${total} | Berhasil: ${inserted + updated}`
            if (skipped > 0) msg += ` | Duplikat di-skip: ${skipped}`
            if (notProcessed > 0) msg += ` | Gagal: ${notProcessed}`

            if (errors && errors.length > 0) {
                msg += `\n\nError:\n${errors.join('\n')}`
            }

            const isError = (errors && errors.length > 0) || notProcessed > 0
            setAlertMsg({ text: msg, type: isError ? 'error' : 'success' })
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
        if (!isAdmin) return
        const data = list.map((l, i) => ({
            No: i + 1,
            Hari: l.hari,
            Jam_Ke: l.jam_ke,
            Waktu: l.waktu,
            Ruang: l.ruang || '-',
            Kelas: l.kelas || '-',
            Kode_Guru: l.kode_guru || '-',
            NIP: l.nip || '-',
            Guru: l.nama_guru || '-',
            Berlaku_Mulai: l.berlaku_mulai || '-'
        }))
        exportToExcel(data, 'Jadwal_Piket')
    }

    const openAdd = () => {
        resetForm()
        setShowModal(true)
    }

    return (
        <div className="sk">
            {/* Toolbar */}
            <FilterToolbar actionsInline>
                <FilterSearch
                    value={searchGuru}
                    onChange={(val) => { setSearchGuru(val); setCurrentPage(1); }}
                    placeholder="Cari guru, kelas, atau ruang..."
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
                        ...masterKelas.map(k => ({ value: k.nama, label: k.nama }))
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
                                        <span className="sk__menuLabel">Tambah Piket</span>
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

            {/* Table */}
            <div className="sk__tableWrap">
                {!loading && totalItems > 0 && (
                    <div className="sk__recordCount">
                        <span className="sk__recordTotal">{totalItems.toLocaleString('id-ID')}</span> jadwal piket
                    </div>
                )}
                <table className="sk__table">
                    <thead>
                        <tr>
                            <th className="cNo">No</th>
                            <th>Hari</th>
                            <th className="cJam">Jam</th>
                            <th>Waktu</th>
                            <th>Kelas</th>
                            <th>Guru Piket</th>
                            <th>Berlaku</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="sk__empty" style={{ border: 'none' }}>
                                    <Spinner variant="trace" />
                                </td>
                            </tr>
                        ) : pageRows.length === 0 ? (
                            <tr><td colSpan={9} className="sk__empty sk__muted">Tidak ada jadwal piket.</td></tr>
                        ) : (
                            pageRows.map((item, idx) => (
                                <tr key={item.id}>
                                    <td className="tCenter">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td><span className={`sk__day ${item.hari.toLowerCase()}`}>{item.hari}</span></td>
                                    <td className="tCenter font-bold text-blue-600">{item.displayJam || item.jam_ke}</td>
                                    <td className="tMuted">{item.waktu}</td>
                                    <td className="tCenter">
                                        <div className="tKelasCell">
                                            <span className="font-bold">{item.kelas || item.ruang || '-'}</span>
                                            {item.ruang && item.kelas && item.ruang !== item.kelas && (
                                                <span className="tKelasRuang">{item.ruang}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="tNameCell">
                                        <span className="tNameCell__name">{item.nama_guru || '-'}</span>
                                        <span className="tNameCell__sub">{item.kode_guru || '-'} · {item.nip || '-'}</span>
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

            {/* Mobile Cards */}
            <div
                className="sk__cards"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {pageRows.length === 0 && !loading ? (
                    <div className="sk__emptyCard">Tidak ada jadwal piket.</div>
                ) : (
                    pageRows.map((item: any, idx: number) => (
                        <div
                            className="sk__cardCompact"
                            key={`jp-${item.id || idx}`}
                            onClick={() => setMobileAction({ open: true, item })}
                        >
                            <div className="sk__avatar">
                                <span className="sk__avatarText">{item.displayJam || item.jam_ke}</span>
                            </div>
                            <div className="sk__cardCompactLeft">
                                <div className="sk__cardName">
                                    {item.ruang || item.kelas || 'Ruang Piket'} · {item.hari}
                                </div>
                                <div className="sk__cardNip">
                                    <span>{item.nama_guru || 'Tanpa Guru Piket'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Aksi utama tab: Generate — FAB melayang di desktop, tombol tengah
                bottom nav di mobile. Tambah piket tetap tombol biasa di toolbar. */}
            {canCreate && <DesktopFab label="Generate" icon="gear-fill" onClick={() => setShowGenerateModal(true)} />}
            {canCreate && <MobileFab label="Generate" icon="gear-fill" onClick={() => setShowGenerateModal(true)} />}

            {/* Pagination */}
            {effectiveTotal > 0 && (
                <Pagination itemLabel="jadwal piket"
                    currentPage={currentPage}
                    totalPages={Math.ceil(effectiveTotal / itemsPerPage)}
                    limit={itemsPerPage}
                    totalItems={effectiveTotal}
                    onPageChange={setCurrentPage}
                    onLimitChange={(newLimit) => { setItemsPerPage(newLimit); setCurrentPage(1) }}
                />
            )}

            {/* Sheet */}
            {mobileAction.open && mobileAction.item && (
                <div className="sk__sheetOverlay" onClick={e => e.target === e.currentTarget && setMobileAction({ open: false, item: null })}>
                    <div className="sk__sheet">
                        <div className="sk__sheetHandle"></div>
                        <div className="sk__sheetTitle">
                            <div className="sk__sheetName">
                                {mobileAction.item.ruang || mobileAction.item.kelas || 'Ruang Piket'} · {mobileAction.item.hari}
                            </div>
                            <div className="sk__sheetSub">
                                {mobileAction.item.nama_guru || 'Tanpa Guru Piket'}
                            </div>
                        </div>
                        <div className="sk__sheetActions">
                            {canUpdate && <button className="sk__sheetBtn" onClick={() => { setMobileAction({ open: false, item: null }); handleEdit(mobileAction.item!) }}>
                                <i className="bi bi-pencil"></i> Edit Jadwal
                            </button>}
                            {canDelete && <button className="sk__sheetBtn danger" onClick={() => { handleDelete(mobileAction.item); setMobileAction({ open: false, item: null }) }}>
                                <i className="bi bi-trash"></i> Hapus Jadwal
                            </button>}
                        </div>
                        <button className="sk__sheetCancel" onClick={() => setMobileAction({ open: false, item: null })}>Batal</button>
                    </div>
                </div>
            )}

            {/* Delete Massal by Masa Berlaku Modal */}
            {showDeleteModal && typeof document !== 'undefined' && createPortal(
                <div style={{ position: 'fixed', inset: 0, zIndex: 99998, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', pointerEvents: 'none' }}>
                <div className="sk__modalOverlay" onClick={() => { setShowDeleteModal(false); setSelectedDates([]); closeModal(); }}>
                    <div className="sk__modal sk__modalWide" onClick={e => e.stopPropagation()}>
                        <div className="sk__modalHead">
                            <div className="sk__modalTitle">
                                <h2>Hapus Jadwal Piket Massal</h2>
                                <p>Pilih tanggal masa berlaku yang akan dihapus</p>
                            </div>
                            <button onClick={() => { setShowDeleteModal(false); setSelectedDates([]); }} className="sk__close"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="sk__modalBody">
                            <div className="sk__warningBox">
                                <i className="bi bi-exclamation-triangle"></i>
                                <span>Peringatan: Tindakan ini tidak dapat dibatalkan!</span>
                            </div>

                            <div className="sk__field">
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
                        </div>
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
                    </div>
                </div>
                </div>,
                document.body
            )}

            {/* Edit Berlaku Massal Modal */}
            {showEditBerlakuModal && typeof document !== 'undefined' && createPortal(
                <div style={{ position: 'fixed', inset: 0, zIndex: 99998, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', pointerEvents: 'none' }}>
                <div className="sk__modalOverlay" onClick={() => { setShowEditBerlakuModal(false); setEditOldDate(''); setEditNewDate(''); setEditPreviewCount(0); closeModal(); }}>
                    <div className="sk__modal sk__modalWide" onClick={e => e.stopPropagation()}>
                        <div className="sk__modalHead">
                            <div className="sk__modalTitle">
                                <h2>Edit Masa Berlaku Massal</h2>
                                <p>Ubah tanggal berlaku untuk semua jadwal piket pada tanggal tertentu</p>
                            </div>
                            <button onClick={() => { setShowEditBerlakuModal(false); setEditOldDate(''); setEditNewDate(''); setEditPreviewCount(0); closeModal(); }} className="sk__close"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="sk__modalBody">
                            {editOldDate && (
                                <div className="sk__infoBox">
                                    <div className="sk__infoItem">
                                        <i className="bi bi-info-circle"></i>
                                        <span>Akan mengubah <strong>{editPreviewCount}</strong> jadwal piket dari tanggal <strong>{editOldDate}</strong></span>
                                    </div>
                                </div>
                            )}

                            <div className="sk__field">
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

                            <div className="sk__field">
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
                        </div>
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
                    </div>
                </div>
                </div>,
                document.body
            )}

            {/* Delete Confirmation Modal */}
            {deleteItemId !== null && typeof document !== 'undefined' && createPortal(
                <div className="sk__modalOverlay" onClick={() => { setDeleteItemId(null); setDeleteItemData(null); }}>
                    <div className="sk__modal sk__modalSm" onClick={e => e.stopPropagation()}>
                        <div className="sk__modalHead">
                            <div className="sk__modalTitle">
                                <h2><i className="bi bi-exclamation-triangle" style={{ color: '#ef4444', marginRight: '8px' }}></i>Hapus Jadwal Piket?</h2>
                            </div>
                            <button onClick={() => { setDeleteItemId(null); setDeleteItemData(null); }} className="sk__close"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="sk__modalBody">
                            <p style={{ margin: 0, color: 'var(--n-muted)', fontSize: '0.88rem', lineHeight: '1.5' }}>
                                Yakin ingin menghapus jadwal piket <strong>{deleteItemData?.hari} Jam {deleteItemData?.jam_ke}</strong> – <strong>{deleteItemData?.kelas || deleteItemData?.ruang}</strong>?
                            </p>
                            {(deleteItemData as any)?.ids && (deleteItemData as any).ids.length > 1 && (
                                <p style={{ margin: '8px 0 0', color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}>
                                    Catatan: {(deleteItemData as any).ids.length} jadwal akan dihapus.
                                </p>
                            )}
                        </div>
                        <ModalFooter>
                            <Button
                                variant="cancel"
                                type="button"
                                onClick={() => { setDeleteItemId(null); setDeleteItemData(null); }}
                                leftIcon={<i className="bi bi-x-lg" />}
                            >
                                Batal
                            </Button>
                            <Button
                                variant="danger"
                                type="button"
                                isLoading={deletingSingle}
                                leftIcon={<i className="bi bi-trash3-fill" />}
                                onClick={async () => {
                                    const idsToDelete = (deleteItemData as any)?.ids || [deleteItemId]
                                    setDeletingSingle(true)
                                    try {
                                        await Promise.all(idsToDelete.map((id: number) =>
                                            fetch(`/api/settings/jadwal-piket?id=${id}`, { method: 'DELETE' })
                                        ))
                                        Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data berhasil dihapus.', timer: 1500, showConfirmButton: false })
                                        fetchJadwal()
                                    } catch {
                                        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat menghubungi server.' })
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
                    </div>
                </div>,
                document.body
            )}


            {/* Generate Modal */}
            {showGenerateModal && typeof document !== 'undefined' && createPortal(
                <div style={{ position: 'fixed', inset: 0, zIndex: 99998, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', pointerEvents: 'none' }}>
                <div className="sk__modalOverlay" onClick={() => { setShowGenerateModal(false); closeModal(); }}>
                    <div className="sk__modal" onClick={e => e.stopPropagation()}>
                        <div className="sk__modalHead">
                            <div className="sk__modalTitle">
                                <h2>Generate Jadwal Piket dari Excel</h2>
                                <p>Upload file jadwal piket format grid</p>
                            </div>
                            <button onClick={() => { setShowGenerateModal(false); closeModal(); }} className="sk__close"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="sk__modalBody">
                            <div className="sk__field">
                                <label>Tanggal Berlaku (fallback)</label>
                                <DatePicker
                                    value={generateTanggalMulai}
                                    onChange={setGenerateTanggalMulai}
                                    className="sk__dateInput"
                                />
                            </div>
                            <div className="sk__field">
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
                        </div>
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
                    </div>
                </div>
                </div>,
                document.body
            )}

            {/* Modal Add/Edit */}
            {showModal && (
                <Modal size="md" variant={isEditMode ? 'edit' : 'add'} onClose={() => { setShowModal(false); closeModal(); }} labelledBy="jadwal-piket-modal-title">
                    <ModalHeader
                        id="jadwal-piket-modal-title"
                        icon={isEditMode ? 'pencil-square' : 'plus-lg'}
                        title={isEditMode ? 'Edit Jadwal Piket' : 'Tambah Jadwal Piket'}
                        onClose={() => { setShowModal(false); closeModal(); }}
                    />
                    <form onSubmit={handleSubmit}>
                        <ModalBody>
                            <div className="sk__grid2">
                                <div className="sk__field">
                                    <label>Hari</label>
                                    <select required value={formHari} onChange={e => setFormHari(e.target.value)}>
                                        {Object.keys(dayOrder).map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="sk__field">
                                    <label>Tanggal Berlaku</label>
                                    <DatePicker required value={formBerlakuMulai} onChange={setFormBerlakuMulai} />
                                </div>
                            </div>
                            <div className="sk__grid2" style={{ marginTop: '12px' }}>
                                <div className="sk__field">
                                    <label>Jam Ke-</label>
                                    <input type="number" min="1" max="14" required placeholder="1" value={formJamKe} onChange={e => setFormJamKe(e.target.value)} />
                                </div>
                                <div className="sk__field">
                                    <label>Waktu</label>
                                    <input type="text" placeholder="07:00 - 07:40" value={formWaktu} onChange={e => setFormWaktu(e.target.value)} />
                                </div>
                            </div>
                            <div className="sk__field" style={{ marginTop: '12px' }}>
                                <label>Ruang</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: XI A, Laboratorium, Perpustakaan"
                                    value={formRuang}
                                    onChange={e => setFormRuang(e.target.value)}
                                />
                            </div>
                            <div className="sk__field" style={{ marginTop: '12px' }}>
                                <label>Kelas (Otomatis dari Jadwal Guru)</label>
                                <input
                                    type="text"
                                    disabled
                                    className="sk__inputDisabled"
                                    value={derivedFormKelas || (formRuang && formHari && formJamKe ? 'Tidak ditemukan' : '-')}
                                />
                            </div>
                            <div className="sk__field" style={{ marginTop: '12px' }}>
                                <label>Guru Piket</label>
                                <select value={formGuru} onChange={e => setFormGuru(e.target.value)}>
                                    <option value="">-- Pilih Guru --</option>
                                    {masterGuru.map(g => <option key={g.kode_guru} value={g.kode_guru}>{g.kode_guru} — {g.nip} — {g.nama_guru}</option>)}
                                </select>
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
                .sk {
                    width: 100%;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    --sk-safe-b: env(safe-area-inset-bottom, 0px);
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

                /* Toolbar */
                .sk__bar {
                    display: flex;
                    gap: 10px;
                    padding: 12px 14px;
                    background: var(--n-card);
                    border-radius: 16px;
                    border: 1px solid rgba(148, 163, 184, 0.22);
                    box-shadow: 0 2px 12px rgba(2, 6, 23, 0.06);
                    align-items: center;
                    flex-wrap: nowrap;
                }
                .sk__search { position: relative; flex: 1 1 120px; min-width: 80px; }
                .sk__search i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: rgba(100, 116, 139, 0.9); pointer-events: none; font-size: 0.9rem; }
                .sk__search input { width: 100%; height: 38px; padding: 0 10px 0 32px; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; background: rgba(248, 250, 252, 0.9); font-weight: 500; font-size: 0.8rem; outline: none; color: var(--n-text); transition: border-color 0.2s; }
                .sk__search input:focus { border-color: var(--n-primary); }
                .sk__filters { display: flex; gap: 8px; flex-wrap: nowrap; flex: 1 1 auto; align-items: center; }
                .sk__filters select, .sk__filters .sk__dateInput {
                    height: 38px; padding: 0 12px; border: 1.5px solid var(--n-border); border-radius: 10px;
                    font-size: 0.82rem; font-weight: 600; color: var(--n-text); background: var(--n-card);
                    outline: none; transition: border-color 0.2s; cursor: pointer;
                    flex: 1 1 auto;
                    min-width: 100px;
                }
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

                /* Mobile Responsive Toolbar */
                @media (max-width: 768px) {
                    .sk__bar {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                        padding: 10px;
                    }
                    .sk__search {
                        width: 100%;
                        flex: none;
                    }
                    .sk__search input {
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .sk__filters {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 8px;
                        width: 100%;
                    }
                    .sk__filters select, .sk__filters .sk__dateInput {
                        width: 100%;
                        box-sizing: border-box;
                        flex: none;
                    }
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
                @media (max-width: 480px) {
                    .sk__filters {
                        grid-template-columns: 1fr;
                    }
                    .sk__actions {
                        justify-content: stretch;
                    }
                    .sk__btn {
                        flex: 1;
                        justify-content: center;
                        padding: 10px 14px;
                    }
                    .sk__btn span {
                        display: inline;
                    }
                }

                /* Buttons */
                .sk__actions { display: flex; gap: 8px; flex: 0 0 auto; align-items: center; justify-content: flex-end; flex-wrap: nowrap; }
                .sk__btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    gap: 6px;
                    height: 38px;
                    padding: 0 16px;
                    border-radius: 12px; font-size: 0.84rem; font-weight: 650;
                    cursor: pointer; border: none; transition: all 0.2s;
                    white-space: nowrap;
                    flex: 1 1 auto;
                    min-width: 90px;
                }
                .sk__btnPrimary { background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%))); color: white; box-shadow: 0 3px 10px rgba(0,56,168,0.2); }
                .sk__btnPrimary:hover { opacity: 0.92; transform: translateY(-1px); }
                .sk__btnGenerate { background: rgba(99, 102, 241, 0.1); color: #002a7a; border: 1.5px solid #c7d2fe; }
                .sk__btnGenerate:hover { background: rgba(99, 102, 241, 0.15); }
                .sk__btnExport { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1.5px solid #a7f3d0; }
                .sk__btnExport:hover { background: rgba(16, 185, 129, 0.15); }
                .sk__btnDanger { background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1.5px solid #fecaca; }
                .sk__btnDanger:hover { background: rgba(239, 68, 68, 0.15); }
                .sk__btnGhost { background: var(--n-card); color: var(--n-muted); border: 1.5px solid var(--n-border); }
                .sk__btnGhost:hover { background: var(--n-soft); }
                .sk__btnWarning { background: linear-gradient(135deg, #d97706, #f59e0b); color: #fff; }
                .sk__btnWarning:hover { background: linear-gradient(135deg, #b45309, #d97706); }
                .sk__btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }

                /* Overflow "Lainnya" menu */
                .sk__more { position: relative; display: inline-flex; }
                .sk__more > .sk__btn { width: 100%; justify-content: center; }
                .sk__moreMenu {
                    position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
                    background: var(--n-card); border: 1px solid rgba(148,163,184,0.35);
                    border-radius: 12px; box-shadow: 0 12px 30px rgba(2,6,23,0.14);
                    padding: 6px; min-width: 210px; display: flex; flex-direction: column; gap: 2px;
                    animation: zoomIn 0.12s ease-out;
                }
                .sk__moreMenu button {
                    display: flex; align-items: center; gap: 10px; width: 100%;
                    padding: 9px 12px; border: none; background: transparent; border-radius: 8px;
                    font-size: 0.8rem; font-weight: 600; color: var(--n-text); flex: none;
                    cursor: pointer; text-align: left;
                }
                .sk__moreMenu button:hover { background: var(--n-soft); }
                .sk__moreMenu button.danger { color: #dc2626; }
                .sk__moreMenu button.danger:hover { background: rgba(220,38,38,0.10); }
                .sk__moreMenu button i { font-size: 0.95rem; width: 16px; text-align: center; }

                /* Record Count */
                .sk__recordCount { padding: 8px 16px; font-size: 0.82rem; color: rgba(100, 116, 139, 0.9); border-bottom: 1px solid var(--n-border); background: rgba(248, 250, 252, 0.7); }
                .sk__recordTotal { font-weight: 700; color: rgba(15, 23, 42, 0.9); }

                /* Table */
                .sk__tableWrap { background: var(--n-card); border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.22); overflow: hidden; box-shadow: 0 4px 20px rgba(2, 6, 23, 0.07); overflow-x: auto; }
                .sk__table { width: 100%; border-collapse: collapse; min-width: 600px; }
                .sk__table th { padding: 12px 16px; text-align: left; background: var(--n-soft); color: var(--n-muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--n-border); white-space: nowrap; }
                .sk__table td { padding: 11px 16px; border-bottom: 1px solid var(--n-border); vertical-align: middle; color: var(--n-text); font-size: 0.82rem; }
                .sk__table tr:last-child td { border-bottom: none; }
                .sk__table tbody tr:hover td { background: rgba(58, 166, 255, 0.04); }
                .tCenter { text-align: center; }
                .tMuted { color: var(--n-muted); font-size: 0.78rem; }
                .tMono { font-family: monospace; font-size: 0.78rem; color: var(--n-muted); }
                .font-bold { font-weight: 700; }
                .tKelasCell { display: flex; flex-direction: column; align-items: center; gap: 1px; }
                .tKelasRuang { font-size: 0.72rem; font-weight: 400; color: var(--n-muted); }
                .font-medium { font-weight: 600; }
                .text-blue-600 { color: var(--n-primary); }
                .tNameCell { display: flex; flex-direction: column; gap: 2px; }
                .tNameCell__name { font-weight: 600; color: var(--n-ink); }
                .tNameCell__sub { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--n-muted); font-weight: 400; }
                :global(.dark) .tNameCell__name { color: var(--n-ink) !important; }
                :global(.dark) .tNameCell__sub { color: var(--n-muted) !important; }

                /* Spinner */
                .sk__spinner { width: 28px; height: 28px; border: 3px solid rgba(148,163,184,0.2); border-top-color: var(--n-primary); border-radius: 50%; animation: spin 0.75s linear infinite; margin: 0 auto; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .sk__empty { text-align: center; padding: 48px; color: var(--n-muted); font-style: italic; font-size: 0.85rem; }
                .sk__muted { color: var(--n-muted); }

                /* Day badge */
                .sk__day { padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; background: rgba(0,56,168,0.06); color: var(--n-primary); }
                .sk__day.senin { background: #eff6ff; color: #1e40af; }
                .sk__day.selasa { background: #f0fdf4; color: #166534; }
                .sk__day.rabu { background: #fef9c3; color: #713f12; }
                .sk__day.kamis { background: #fdf4ff; color: #1e40af; }
                .sk__day.jumat { background: var(--n-surface); color: #c2410c; }
:global(.dark) .sk__day.jumat { background: #431407; color: #fb923c; }
:global(.dark) .sk__day.senin { background: #0c4a6e; color: #7dd3fc; }
:global(.dark) .sk__day.selasa { background: #14532d; color: #86efac; }
:global(.dark) .sk__day.rabu { background: #422006; color: #fde047; }
:global(.dark) .sk__day.kamis { background: #3b0764; color: #d8b4fe; }
:global(.dark) .sk__iconBtn { background: rgba(26, 115, 232, 0.15) !important; border: 1.5px solid rgba(26, 115, 232, 0.6) !important; color: #60a5fa !important; }
:global(.dark) .sk__iconBtn:hover { background: #1a73e8 !important; border-color: #3b82f6 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(26, 115, 232, 0.5) !important; }
:global(.dark) .sk__iconBtn.danger { background: rgba(239, 68, 68, 0.15) !important; border: 1.5px solid rgba(239, 68, 68, 0.6) !important; color: #f87171 !important; }
:global(.dark) .sk__iconBtn.danger:hover { background: #ef4444 !important; border-color: #f87171 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(239, 68, 68, 0.5) !important; }

                /* Row Actions */
                .sk__rowActions { display: flex; justify-content: center; gap: 6px; }
                .sk__iconBtn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid rgba(26, 115, 232, 0.25); background: rgba(26, 115, 232, 0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #1a73e8; transition: all 0.15s ease; }
                .sk__iconBtn:hover { background: #1a73e8; color: #ffffff; }
                .sk__iconBtn.danger { color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.08); }
                .sk__iconBtn.danger:hover { background: #ef4444; color: #ffffff; }

                /* Cards */
                .sk__cards {
                    display: none;
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
                    font-size: 0.78rem;
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

                /* Mobile Responsive */
                @media (max-width: 768px) {
                    .sk__tableWrap {
                        display: none;
                    }
                    .sk__cards {
                        display: flex;
                    }
                }
                @media (min-width: 769px) {
                    .sk__tableWrap {
                        display: block;
                    }
                    .sk__cards {
                        display: none;
                    }
                }
                .sk__emptyCard { padding: 40px; text-align: center; color: var(--n-muted); font-style: italic; background: var(--n-card); border-radius: 16px; border: 1px solid rgba(148,163,184,0.22); }
                .sk__card { background: var(--n-card); border-radius: 14px; border: 1px solid rgba(148,163,184,0.22); padding: 14px; box-shadow: 0 2px 10px rgba(2,6,23,0.06); cursor: pointer; transition: all 0.15s; }
                .sk__card:hover { border-color: var(--n-primary); box-shadow: 0 4px 16px rgba(0,56,168,0.12); }
                .sk__cardHead { margin-bottom: 10px; }
                .sk__cardTitle { display: flex; flex-direction: column; gap: 2px; }
                .sk__cardName { font-weight: 800; color: var(--n-text); font-size: 0.9rem; }
                .sk__cardSub { font-size: 0.75rem; color: var(--n-muted); font-weight: 500; }
                .sk__cardBody { display: flex; flex-direction: column; gap: 6px; }
                .sk__kv { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
                .sk__k { font-size: 0.72rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; min-width: 70px; }

                /* Sheet */
                .sk__sheetOverlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 0; }
                .sk__sheet { background: var(--n-card); width: 100%; max-width: 480px; border-radius: 20px 20px 0 0; padding: 20px 24px calc(24px + env(safe-area-inset-bottom, 0px)); animation: slideUp 0.25s ease-out; }
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .sk__sheetHandle { width: 40px; height: 4px; background: #e2e8f0; border-radius: 99px; margin: 0 auto 20px; }
                .sk__sheetTitle { margin-bottom: 16px; text-align: center; }
                .sk__sheetName { font-weight: 800; font-size: 1rem; color: var(--n-text); }
                .sk__sheetSub { font-size: 0.8rem; color: var(--n-muted); margin-top: 2px; }
                .sk__sheetActions { display: flex; flex-direction: row; gap: 10px; margin-bottom: 16px; }
                .sk__sheetBtn { flex: 1 1 0; width: auto; padding: 12px 14px; background: #E0ECFF; border: 1.5px solid #E1E2E9; border-radius: 12px; font-weight: 700; font-size: 0.88rem; color: #112E59; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; white-space: nowrap; }
                .sk__sheetBtn:hover { background: #d0e3ff; }
                .sk__sheetBtn.danger { background: #fef2f2; border-color: #fee2e2; color: #ef4444; }
                .sk__sheetBtn.danger:hover { background: #fee2e2; }
                .sk__sheetCancel { width: 100%; padding: 12px; background: var(--n-card); border: 1.5px solid var(--n-border); border-radius: 12px; font-weight: 700; color: var(--n-muted); cursor: pointer; }

                /* Generate Modal */
                .sk__modalOverlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; pointer-events: auto; }
                .sk__modal { background: var(--n-card); width: 100%; max-width: 480px; border-radius: 20px; box-shadow: 0 25px 50px rgba(0,0,0,0.2); overflow: hidden; animation: zoomIn 0.2s ease-out; }
                @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .sk__modalHead { padding: 20px 24px; border-bottom: 1px solid var(--n-border); display: flex; justify-content: space-between; align-items: flex-start; }
                .sk__modalTitle h2 { margin: 0 0 4px; font-weight: 800; font-size: 1rem; color: var(--n-text); }
                .sk__modalTitle p { margin: 0; font-size: 0.78rem; color: var(--n-muted); }
                .sk__close { background: none; border: none; color: var(--n-muted); cursor: pointer; font-size: 1.1rem; padding: 0; }
                .sk__modalBody { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
                .sk__generateInfo { background: var(--n-soft); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
                .sk__infoItem { display: flex; align-items: flex-start; gap: 8px; font-size: 0.78rem; color: var(--n-muted); }
                .sk__infoItem i { color: var(--n-primary); margin-top: 1px; flex-shrink: 0; }
                .sk__modalFoot { padding: 16px 24px; background: var(--n-soft); display: flex; gap: 12px; }
                .sk__modalFoot .sk__btnGhost { flex: 1; justify-content: center; }
                .sk__modalFoot .sk__btnPrimary { flex: 2; justify-content: center; }
                .sk__fileInput { width: 100%; padding: 10px; border: 2px dashed #cbd5e1; border-radius: 10px; font-size: 0.85rem; cursor: pointer; }
                .sk__fileName { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 0.82rem; color: #059669; font-weight: 600; }

                /* Add/Edit Modal */
                .sk__modalBody .sk__grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .sk__field { display: flex; flex-direction: column; gap: 6px; }
                .sk__field label { font-size: 0.72rem; font-weight: 800; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.05em; }
                .sk__field input { padding: 10px 14px; border: 2px solid var(--n-border); border-radius: 12px; font-size: 0.8rem; font-weight: 600; color: var(--n-text); background: var(--n-card); outline: none; transition: border-color 0.2s; }
                .sk__field select {
                    appearance: none;
                    -webkit-appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolygon points='22 3 2 3 12 15'%3e%3c/polygon%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: right 14px center;
                    background-size: 13px;
                    padding: 10px 14px;
                    padding-right: 36px;
                    border: 2px solid var(--n-border);
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-text);
                    background-color: var(--n-card);
                    outline: none;
                    transition: border-color 0.2s;
                }
                .sk__field input:focus, .sk__field select:focus { border-color: var(--n-primary); box-shadow: 0 0 0 3px rgba(0,56,168,0.1); }

                /* Delete Modal */
                .sk__modalWide { max-width: 500px; }
                .sk__warningBox { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.22); border-radius: 10px; color: rgba(185, 28, 28, 1); font-weight: 600; font-size: 0.82rem; margin-bottom: 16px; }
                .sk__warningBox i { font-size: 1.2rem; color: #dc2626; }
                .sk__dateSelectHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .sk__dateSelectHeader label { font-weight: 700; font-size: 0.82rem; color: rgba(15, 23, 42, 0.9); }
                .sk__dateSelectActions { display: flex; gap: 12px; }
                .sk__linkBtn { background: none; border: none; color: var(--n-primary); font-weight: 600; font-size: 0.82rem; cursor: pointer; text-decoration: underline; padding: 0; }
                .sk__linkBtn:hover { color: #1d4ed8; }
                .sk__dateList { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding: 4px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 12px; background: rgba(248, 250, 252, 0.5); }
                .sk__dateItem { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 10px; background: var(--n-card); cursor: pointer; transition: all 0.2s; }
                .sk__dateItem:hover { border-color: rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.03); }
                .sk__dateItem.selected { border-color: #dc2626; background: rgba(239, 68, 68, 0.06); }
                .sk__dateItem input[type="checkbox"] { width: 18px; height: 18px; accent-color: #dc2626; cursor: pointer; flex-shrink: 0; }
                .sk__dateItemLabel { flex: 1; font-weight: 500; font-size: 0.82rem; color: rgba(15, 23, 42, 0.9); }
                .sk__dateItemDate { font-size: 0.72rem; color: var(--n-muted); font-weight: 600; background: rgba(148, 163, 184, 0.1); padding: 4px 8px; border-radius: 6px; }

                /* Edit Berlaku Modal */
                .sk__infoBox { background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 10px; padding: 12px 14px; margin-top: 12px; }
                .sk__infoItem { display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; color: rgba(15, 23, 42, 0.8); }
                .sk__infoItem i { color: #3b82f6; font-size: 1rem; margin-top: 2px; flex-shrink: 0; }
                .sk__inputDisabled { background: rgba(148, 163, 184, 0.1) !important; color: rgba(15, 23, 42, 0.5) !important; cursor: not-allowed; }
                .sk__hintWarn { display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; color: rgba(180, 83, 9, 1); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.22); border-radius: 8px; padding: 10px 14px; margin-top: 8px; }
                .sk__hintWarn i { color: #d97706; margin-top: 2px; flex-shrink: 0; }

                /* Responsive */
                @media (max-width: 768px) {
                    .sk { padding-bottom: calc(0px + var(--sk-safe-b)); }
                    .sk__bar { flex-direction: column; gap: 10px; padding: 12px; background: var(--n-card); border-radius: 14px; border: 1px solid rgba(148,163,184,0.22); box-shadow: 0 2px 12px rgba(2,6,23,0.06); }
                    .sk__search { flex: 1 1 100%; min-width: 0; }
                    .sk__filters { flex: 1 1 100%; }
                    .sk__filters select, .sk__filters .sk__dateInput { flex: 1 1 calc(50% - 4px); min-width: 0; font-size: 0.8rem; }
                    .sk__actions { flex: 1 1 100%; display: flex; flex-direction: row; gap: 6px; }
                    .sk__actions > button { flex: 1; }
                    .sk__actions .sk__more { flex: 0 0 auto; }
                    .sk__actions .sk__more .sk__btn { width: 100%; }
                    .sk__btn { padding: 9px 4px; font-size: 0.8rem; justify-content: center; }
                    .sk__tableWrap { display: none; }
                    .sk__cards { display: flex; }
                    .sk__modalBody .sk__grid2 { grid-template-columns: 1fr; }
                    .sk__modal { max-width: 100%; border-radius: 20px 20px 0 0; }
                    .sk__modalFoot { flex-direction: column-reverse; }
                    .sk__modalFoot .sk__btn { width: 100%; justify-content: center; }
                }
            /* ===== DARK MODE FULL ===== */
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
/* ROOT */
:global(.dark) .sk { background: rgba(255,255,255,0.03) !important; }
/* TABLE */
:global(.dark) .sk__table { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__table thead th { background: rgba(255,255,255,0.05) !important; color: var(--n-muted) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__table tbody td { background: var(--n-card) !important; color: var(--n-ink) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.025) !important; }
:global(.dark) .sk__table tbody tr:hover td { background: rgba(79,142,247,0.06) !important; }
/* TOOLBAR */
:global(.dark) .sk__bar { background: var(--n-card) !important; border: 1px solid var(--n-border) !important; border-radius: 16px !important; }
:global(.dark) .sk__search { background: transparent !important; border: none !important; box-shadow: none !important; }
:global(.dark) .sk__search input[type="text"], :global(.dark) .sk__search input { height: 40px !important; background: var(--n-card) !important; border: 1px solid var(--n-border) !important; border-radius: 12px !important; color: var(--n-ink) !important; padding-left: 36px !important; }
:global(.dark) .sk__search i { color: var(--n-primary) !important; }
:global(.dark) .sk__filters select, :global(.dark) select { height: 40px !important; box-sizing: border-box !important; background-color: var(--n-card) !important; padding-right: 36px !important; -webkit-appearance: none !important; appearance: none !important; border: 1px solid var(--n-border) !important; color: var(--n-ink) !important; }
:global(.dark) .sk__moreMenu { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__moreMenu button { color: var(--n-ink) !important; }
:global(.dark) .sk__moreMenu button:hover { background: var(--n-soft) !important; }
/* BUTTONS */
:global(.dark) .sk__btn { background: var(--n-card) !important; color: var(--n-ink) !important; border: 1px solid var(--n-border) !important; }
:global(.dark) .sk__btn:hover { background: var(--n-soft) !important; border-color: var(--n-primary) !important; }
:global(.dark) .sk__btnGhost { background: var(--n-card) !important; color: var(--n-ink) !important; border: 1px solid var(--n-border) !important; }
:global(.dark) .sk__btnGhost:hover { background: var(--n-soft) !important; border-color: var(--n-primary) !important; }
:global(.dark) .sk__btnGenerate { background: var(--n-soft) !important; color: var(--n-primary) !important; border: 1px solid var(--n-border) !important; }
:global(.dark) .sk__btnPrimary { background: var(--n-primary) !important; color: #ffffff !important; border: 1px solid var(--n-primary) !important; }
/* EMPTY / LOADING */
:global(.dark) .sk__empty, :global(.dark) .sk__muted { color: var(--n-muted) !important; }
/* CARDS / GROUP */
:global(.dark) .sk__group { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__card { background: rgba(255,255,255,0.05) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__kv, :global(.dark) .sk__k, :global(.dark) .sk__v { color: var(--n-ink) !important; }
:global(.dark) .sk__k { color: var(--n-muted) !important; }
:global(.dark) .sk__v { color: var(--n-ink) !important; }
:global(.dark) .sk__status.isOn { background: rgba(34,197,94,0.1) !important; color: #4ade80 !important; }
:global(.dark) .sk__status.isOff { background: rgba(239,68,68,0.1) !important; color: #f87171 !important; }
:global(.dark) .sk__day { background: rgba(79,142,247,0.1) !important; color: #7aabf9 !important; }
/* RADIO / PICK */
:global(.dark) .sk__radio { background: rgba(255,255,255,0.05) !important; border-color: var(--n-border) !important; color: var(--n-ink) !important; }
/* HINT */
:global(.dark) .sk__hint { color: var(--n-muted) !important; }
/* JAM TIME */
:global(.dark) .jam-time { color: var(--n-muted) !important; }
/* MODAL */
:global(.dark) .sk__sheet { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__modal { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__close { color: var(--n-muted) !important; }
:global(.dark) .sk__close:hover { background: var(--n-elevated) !important; color: var(--n-ink) !important; }
/* DISABLED FIELDS */
:global(.dark) .sk__field input:disabled,
:global(.dark) .sk__field select:disabled {
    background-color: var(--n-surface) !important;
    opacity: 0.5;
}
/* RECORD COUNT */
:global(.dark) .sk__recordCount { background: rgba(255,255,255,0.02) !important; border-bottom-color: var(--n-border) !important; color: var(--n-muted) !important; }
:global(.dark) .sk__recordTotal { color: var(--n-ink) !important; }
:global(.dark) .sk__recordNote { color: var(--n-muted) !important; }
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
