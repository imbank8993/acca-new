'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { exportToExcel } from '@/lib/excel-utils'
import ImportModal from '@/components/ui/ImportModal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Pagination from '@/components/ui/Pagination'
import { getCurrentAcademicYear } from '@/lib/date-utils'

import { usePengaturanDataAccess } from '@/lib/use-pengaturan-data-access'
import { useModalBlur } from '@/components/ModalBlurProvider'
import Button from '@/components/ui/Button'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import { Spinner } from '@/components/ui/Spinner'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'

interface SiswaKelas {
  id?: number
  nisn: string
  nama_siswa: string
  kelas: string
  tahun_ajaran: string
  semester: string
  aktif: boolean
  is_pengurus?: boolean
}

// Kelas reguler/homeroom = tanpa kode DAN program Reguler. Program ikut dicek
// karena kelompok UTBK/Peminatan bisa terlanjur terdaftar tanpa kode.
const isRegularClass = (cls: any) =>
  !!cls && !cls.kode && (!cls.program || cls.program === 'Reguler')

const CLASS_BLUE_PALETTES = [
  {
    dark: { bg: 'rgba(37, 99, 235, 0.22)', fg: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.45)' },
    light: { bg: 'rgba(37, 99, 235, 0.12)', fg: '#1d4ed8', border: '1px solid rgba(147, 197, 253, 0.7)' }
  },
  {
    dark: { bg: 'rgba(56, 189, 248, 0.22)', fg: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.45)' },
    light: { bg: 'rgba(14, 165, 233, 0.12)', fg: '#0284c7', border: '1px solid rgba(165, 243, 252, 0.7)' }
  },
  {
    dark: { bg: 'rgba(129, 140, 248, 0.22)', fg: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.45)' },
    light: { bg: 'rgba(99, 102, 241, 0.12)', fg: '#4338ca', border: '1px solid rgba(199, 210, 254, 0.7)' }
  },
  {
    dark: { bg: 'rgba(6, 182, 212, 0.22)', fg: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.45)' },
    light: { bg: 'rgba(14, 116, 144, 0.12)', fg: '#0e7490', border: '1px solid rgba(165, 243, 252, 0.7)' }
  },
  {
    dark: { bg: 'rgba(29, 78, 216, 0.22)', fg: '#93c5fd', border: '1px solid rgba(147, 197, 253, 0.45)' },
    light: { bg: 'rgba(30, 64, 175, 0.12)', fg: '#1e40af', border: '1px solid rgba(147, 197, 253, 0.7)' }
  },
  {
    dark: { bg: 'rgba(56, 189, 248, 0.18)', fg: '#7dd3fc', border: '1px solid rgba(125, 211, 252, 0.45)' },
    light: { bg: 'rgba(3, 105, 161, 0.12)', fg: '#0369a1', border: '1px solid rgba(186, 230, 253, 0.7)' }
  }
];

function getClassBadgeStyle(kelasName: string, isDark: boolean) {
  if (!kelasName) return CLASS_BLUE_PALETTES[0][isDark ? 'dark' : 'light'];
  let hash = 0;
  for (let i = 0; i < kelasName.length; i++) {
    hash = kelasName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CLASS_BLUE_PALETTES.length;
  return CLASS_BLUE_PALETTES[index][isDark ? 'dark' : 'light'];
}

function getSemesterBadgeStyle(semester: string, isDark: boolean) {
  if (semester === 'Ganjil') {
    return {
      bg: isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.12)',
      fg: isDark ? '#60a5fa' : '#1e40af',
      border: isDark ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(147, 197, 253, 0.7)'
    };
  }
  return {
    bg: isDark ? 'rgba(6, 182, 212, 0.22)' : 'rgba(6, 182, 212, 0.12)',
    fg: isDark ? '#22d3ee' : '#0e7490',
    border: isDark ? '1px solid rgba(34, 211, 238, 0.45)' : '1px solid rgba(165, 243, 252, 0.7)'
  };
}

function getStatusBadgeStyle(aktif: boolean, isDark: boolean) {
  if (aktif) {
    return {
      bg: isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.12)',
      fg: isDark ? '#34d399' : '#047857',
      border: isDark ? '1px solid rgba(52, 211, 153, 0.45)' : '1px solid rgba(167, 243, 208, 0.7)'
    };
  }
  return {
    bg: isDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)',
    fg: isDark ? '#f87171' : '#b91c1c',
    border: isDark ? '1px solid rgba(248, 113, 113, 0.45)' : '1px solid rgba(254, 202, 202, 0.7)'
  };
}

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanDataAccess(), bukan dari objek user. Propnya tetap diterima
// agar pemanggil (view.tsx) tidak perlu diubah.
export default function SiswaKelasTab(_props: { user?: unknown }) {

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
  const canManage = boleh('siswa_kelas')
  const canCreate = canManage
  const canUpdate = canManage
  const canDelete = canManage
  const canImport = canManage
  const canExport = canManage

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Local Filter State
  const [tahunAjaran, setTahunAjaran] = useState(getCurrentAcademicYear())

  const [semester, setSemester] = useState('Semua')
  const [filterKelas, setFilterKelas] = useState('Semua')

  const [allData, setAllData] = useState<SiswaKelas[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  // Computed paginated list
  const list = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return allData.slice(start, end)
  }, [allData, currentPage, pageSize])

  const [relationMode, setRelationMode] = useState<'per_kelas' | 'per_siswa'>('per_kelas')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  // Anggota yang SUDAH tersimpan saat kelas/siswa dipilih di modal tambah;
  // selisihnya dengan selected* menentukan apa yang di-insert / di-hapus saat Simpan
  const [initialMembers, setInitialMembers] = useState<string[]>([])
  const [initialClasses, setInitialClasses] = useState<string[]>([])
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  // Baris asli yang diedit; identitas lamanya dipakai mencari baris semester pasangan
  const [editItem, setEditItem] = useState<SiswaKelas | null>(null)
  // Semester target di modal — independen dari filter halaman: 'Ganjil' | 'Genap' | 'Semua'
  const [formSemester, setFormSemester] = useState('Semua')
  // Penanda pengurus kelas (mode edit) — disimpan ke siswa_kelas.is_pengurus
  const [formIsPengurus, setFormIsPengurus] = useState(false)
  // Baris yang sedang diproses toggle pengurus inline (mencegah klik ganda)
  const [pengurusBusyId, setPengurusBusyId] = useState<number | null>(null)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Action Menu State (Mobile)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

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
      if (currentPage < Math.ceil(totalItems / pageSize)) {
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

  // Mobile Action Sheet Drawer State
  const [mobileAction, setMobileAction] = useState<{ open: boolean; item: SiswaKelas | null }>({ open: false, item: null })

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

  const toggleStudent = (nisn: string) => {
    if (editId) {
      if (selectedStudents.includes(nisn)) setSelectedStudents([])
      else setSelectedStudents([nisn])
      return
    }

    if (selectedStudents.includes(nisn)) {
      setSelectedStudents(selectedStudents.filter((id) => id !== nisn))
    } else {
      setSelectedStudents([...selectedStudents, nisn])
    }
  }

  // Master data for selection
  const [masterSiswa, setMasterSiswa] = useState<any[]>([])
  const [masterKelas, setMasterKelas] = useState<any[]>([])
  const [academicYears, setAcademicYears] = useState<string[]>([])
  const [activePeriods, setActivePeriods] = useState<any[]>([])

  const availableSemesters = useMemo(() => {
    if (tahunAjaran === 'Semua') {
      const sems = new Set(activePeriods.map(p => p.semester));
      return Array.from(sems);
    }
    const sems = activePeriods
      .filter(p => p.tahun_ajaran === tahunAjaran)
      .map(p => p.semester);
    return Array.from(new Set(sems));
  }, [activePeriods, tahunAjaran]);

  // Global Enrollments for Filtering
  const [allEnrollments, setAllEnrollments] = useState<SiswaKelas[]>([])

  useEffect(() => {
    fetchMasterData()
    fetchAcademicYears()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAcademicYears = async () => {
    try {
      const { getActivePeriods, getActiveSettings } = await import('@/lib/settings-client');
      // Fetch all active periods
      const periods = await getActivePeriods();
      setActivePeriods(periods);
      // Fetch default active setting (optional, mostly for initial state if needed)
      const defaultSettings = await getActiveSettings();

      if (periods.length > 0) {
        // Populate academic years with unique years from active periods
        const uniqueYears = Array.from(new Set(periods.map(p => p.tahun_ajaran)));
        setAcademicYears(uniqueYears);

        // If current state is not in active periods, default to the first one (or the specific one from settings)
        // Check if current tahunAjaran is valid
        const currentYearIsValid = uniqueYears.includes(tahunAjaran);

        if (!currentYearIsValid && defaultSettings) {
          setTahunAjaran(defaultSettings.tahun_ajaran);
          setSemester(defaultSettings.semester);
        } else if (!currentYearIsValid && periods.length > 0) {
          setTahunAjaran(periods[0].tahun_ajaran);
          setSemester(periods[0].semester);
        }
      } else {
        // Fallback if no active periods
        setAcademicYears([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1)
      fetchData()
    }, 450)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaran, semester, filterKelas, searchTerm])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize])

  useEffect(() => {
    if (showModal) fetchAllEnrollmentsForContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, tahunAjaran, semester])

  // Mode tambah per kelas: saat kelas dipilih, muat anggota yang sudah tersimpan
  // sebagai pilihan awal supaya terlihat dan bisa dihapus dari modal
  useEffect(() => {
    if (!showModal || editId || relationMode !== 'per_kelas') return
    if (!selectedClass) {
      setInitialMembers([])
      return
    }
    const targetSemesters = formSemester === 'Semua' ? ['Ganjil', 'Genap'] : [formSemester]
    const members = Array.from(new Set(
      allEnrollments
        .filter((e) => e.kelas === selectedClass && targetSemesters.includes(e.semester))
        .map((e) => e.nisn)
    ))
    setInitialMembers(members)
    setSelectedStudents(members)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, editId, relationMode, selectedClass, allEnrollments, formSemester])

  // Mode tambah per siswa: saat siswa dipilih, muat kelas yang sudah tersimpan
  useEffect(() => {
    if (!showModal || editId || relationMode !== 'per_siswa') return
    if (!selectedStudent) {
      setInitialClasses([])
      return
    }
    const targetSemesters = formSemester === 'Semua' ? ['Ganjil', 'Genap'] : [formSemester]
    const classes = Array.from(new Set(
      allEnrollments
        .filter((e) => e.nisn === selectedStudent && targetSemesters.includes(e.semester))
        .map((e) => e.kelas)
    ))
    setInitialClasses(classes)
    setSelectedClasses(classes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, editId, relationMode, selectedStudent, allEnrollments, formSemester])

  const fetchMasterData = async () => {
    try {
      const [resSiswa, resKelas] = await Promise.all([
        fetch('/api/master/students?limit=2000'),
        fetch('/api/master/kelas'),
      ])
      const [jsonSiswa, jsonKelas] = await Promise.all([resSiswa.json(), resKelas.json()])
      if (jsonSiswa.ok) setMasterSiswa(jsonSiswa.data)
      if (jsonKelas.ok) setMasterKelas(jsonKelas.data)
    } catch (err) {
      console.error('Error fetching master data:', err)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    const params = new URLSearchParams({
      q: searchTerm,
      tahun_ajaran: tahunAjaran === 'Semua' ? '' : tahunAjaran,
      semester: semester === 'Semua' ? '' : semester,
      kelas: filterKelas === 'Semua' ? '' : filterKelas,
    })
    try {
      const res = await fetch(`/api/settings/siswa-kelas?${params}`)
      const json = await res.json()
      if (json.ok) {
        setAllData(json.data || [])
        setTotalItems(json.data?.length || 0)
      } else {
        setAllData([])
        setTotalItems(0)
      }
    } catch (err) {
      console.error(err)
      setAllData([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllEnrollmentsForContext = async () => {
    if (tahunAjaran === 'Semua') return
    const params = new URLSearchParams({
      tahun_ajaran: tahunAjaran,
    })
    try {
      const res = await fetch(`/api/settings/siswa-kelas?${params}`)
      const json = await res.json()
      if (json.ok) setAllEnrollments(json.data)
      else setAllEnrollments([])
    } catch (e) {
      console.error('Enrollment check failed', e)
      setAllEnrollments([])
    }
  }

  const closeFormModal = () => {
    setShowModal(false)
    setEditId(null)
    setEditItem(null)
    setSelectedStudents([])
    setSelectedClass('')
    setSelectedStudent('')
    setSelectedClasses([])
    setInitialMembers([])
    setInitialClasses([])
    setFormIsPengurus(false)
    setRelationMode('per_kelas')
  }

  const { registerModal } = useModalBlur()

  useEffect(() => {
    if (showModal || showImportModal || showDeleteModal) {
      return registerModal()
    }
  }, [showModal, showImportModal, showDeleteModal, registerModal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isEditMode = !!editId
    if (isEditMode ? !canUpdate : (!canCreate && !canDelete)) return

    if (tahunAjaran === 'Semua') {
      alert('Harap pilih Tahun Ajaran spesifik untuk menambah relasi.')
      return
    }

    setSaving(true)
    try {
      const targetSemesters = formSemester === 'Semua' ? ['Ganjil', 'Genap'] : [formSemester]

      if (editId) {
        // For edit mode, only handle single student
        const nisn = selectedStudents[0]
        const siswa = masterSiswa.find((s) => s.nisn === nisn)
        const nama = siswa?.nama_lengkap || ''
        const origSem = editItem?.semester === 'Genap' ? 'Genap' : 'Ganjil'

        const putRow = async (id: number, sem: string) => {
          const res = await fetch('/api/settings/siswa-kelas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              nisn,
              nama_siswa: nama,
              kelas: selectedClass,
              tahun_ajaran: tahunAjaran,
              semester: sem,
              aktif: true,
              is_pengurus: formIsPengurus,
            }),
          })
          const json = await res.json()
          if (!json.ok) throw new Error(json.error || 'Gagal mengubah data')
        }

        if (formSemester !== 'Semua') {
          // Pindah semester: cegah duplikat bila baris tujuan sudah ada
          if (formSemester !== origSem && hasEnrollment(nisn, selectedClass, formSemester)) {
            throw new Error(`Siswa ini sudah terdaftar di ${selectedClass} semester ${formSemester}.`)
          }
          await putRow(editId, formSemester)
        } else {
          // Semua: baris ini tetap di semester asalnya, lalu pastikan semester pasangan ikut
          await putRow(editId, origSem)
          const otherSem = origSem === 'Ganjil' ? 'Genap' : 'Ganjil'
          const sibling = editItem
            ? allEnrollments.find((e) => e.id && e.id !== editId &&
                e.nisn === editItem.nisn && e.kelas === editItem.kelas && e.semester === otherSem)
            : undefined
          const dupTarget = allEnrollments.some((e) =>
            e.id !== editId && (!sibling || e.id !== sibling.id) &&
            e.nisn === nisn && e.kelas === selectedClass && e.semester === otherSem)
          if (!dupTarget) {
            if (sibling?.id) {
              await putRow(sibling.id, otherSem)
            } else {
              const res = await fetch('/api/settings/siswa-kelas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nisn,
                  nama_siswa: nama,
                  kelas: selectedClass,
                  tahun_ajaran: tahunAjaran,
                  semester: otherSem,
                  aktif: true,
                }),
              })
              const json = await res.json()
              if (!json.ok) throw new Error(json.error || `Gagal menambah baris semester ${otherSem}`)
            }
          }
        }
        Swal.fire('Berhasil', 'Perubahan relasi tersimpan.', 'success')
      } else {
        // Mode tambah = sinkronisasi keanggotaan: selisih terhadap data tersimpan
        // menentukan baris yang di-insert dan baris yang dihapus
        if (relationMode === 'per_kelas' && !selectedClass) {
          alert('Pilih kelas terlebih dahulu!')
          setSaving(false)
          return
        }
        if (relationMode === 'per_siswa' && !selectedStudent) {
          alert('Pilih siswa terlebih dahulu!')
          setSaving(false)
          return
        }

        const additions = relationMode === 'per_kelas'
          ? selectedStudents.filter((n) => !initialMembers.includes(n))
          : selectedClasses.filter((c) => !initialClasses.includes(c))
        const removals = relationMode === 'per_kelas'
          ? initialMembers.filter((n) => !selectedStudents.includes(n))
          : initialClasses.filter((c) => !selectedClasses.includes(c))

        // Baris yang di-insert dihitung per (siswa, kelas, SEMESTER) — bukan per siswa —
        // supaya anggota lama yang baru terdaftar di salah satu semester target
        // (mis. hanya Ganjil padahal target Ganjil & Genap) ikut dilengkapi
        const itemsToInsert: any[] = []
        let rowIndexCounter = 1

        if (relationMode === 'per_kelas') {
          selectedStudents.forEach((nisn) => {
            const siswa = masterSiswa.find((s) => s.nisn === nisn)
            targetSemesters.forEach((sem) => {
              if (hasEnrollment(nisn, selectedClass, sem)) return
              itemsToInsert.push({
                body: {
                  nisn,
                  nama_siswa: siswa?.nama_lengkap || '',
                  kelas: selectedClass,
                  tahun_ajaran: tahunAjaran,
                  semester: sem,
                  aktif: true,
                },
                rowIndex: rowIndexCounter++
              })
            })
          })
        } else {
          const siswa = masterSiswa.find((s) => s.nisn === selectedStudent)
          selectedClasses.forEach((kelasNama) => {
            targetSemesters.forEach((sem) => {
              if (hasEnrollment(selectedStudent, kelasNama, sem)) return
              itemsToInsert.push({
                body: {
                  nisn: selectedStudent,
                  nama_siswa: siswa?.nama_lengkap || '',
                  kelas: kelasNama,
                  tahun_ajaran: tahunAjaran,
                  semester: sem,
                  aktif: true,
                },
                rowIndex: rowIndexCounter++
              })
            })
          })
        }

        if (itemsToInsert.length === 0 && removals.length === 0) {
          alert('Tidak ada perubahan untuk disimpan.')
          setSaving(false)
          return
        }
        if (itemsToInsert.length > 0 && !canCreate) {
          alert('Anda tidak memiliki izin menambah relasi.')
          setSaving(false)
          return
        }
        if (removals.length > 0 && !canDelete) {
          alert('Anda tidak memiliki izin menghapus relasi tersimpan.')
          setSaving(false)
          return
        }

        if (removals.length > 0) {
          const confirm = await Swal.fire({
            title: 'Hapus relasi tersimpan?',
            html: relationMode === 'per_kelas'
              ? `<strong>${removals.length} siswa</strong> akan dikeluarkan dari kelas <strong>${selectedClass}</strong>.`
              : `Siswa ini akan dikeluarkan dari <strong>${removals.length} kelas</strong> (${removals.join(', ')}).`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, lanjutkan',
            cancelButtonText: 'Batal',
          })
          if (!confirm.isConfirmed) {
            setSaving(false)
            return
          }
        }

        let failErrors: string[] = []
        if (itemsToInsert.length > 0) {
          const res = await fetch('/api/settings/siswa-kelas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToInsert }),
          })
          const json = await res.json()
          if (!json.ok) throw new Error(json.error || 'Gagal menyimpan data')
          if (json.failCount > 0 && json.errors?.length > 0) failErrors = json.errors
        }

        // Hapus (soft delete) baris enrollment milik anggota yang dicabut
        const rowsToDelete = relationMode === 'per_kelas'
          ? allEnrollments.filter((e) =>
              e.id && e.kelas === selectedClass && removals.includes(e.nisn) && targetSemesters.includes(e.semester))
          : allEnrollments.filter((e) =>
              e.id && e.nisn === selectedStudent && removals.includes(e.kelas) && targetSemesters.includes(e.semester))

        if (rowsToDelete.length > 0) {
          const results = await Promise.all(rowsToDelete.map((r) =>
            fetch(`/api/settings/siswa-kelas?id=${r.id}`, { method: 'DELETE' })
              .then((res) => res.json())
              .catch(() => ({ ok: false }))
          ))
          const delFailed = results.filter((r) => !r.ok).length
          if (delFailed > 0) failErrors.push(`${delFailed} baris gagal dihapus.`)
        }

        if (failErrors.length > 0) {
          Swal.fire({
            title: 'Selesai dengan Error',
            html: `<div style="text-align:left; max-height:200px; overflow-y:auto;">${failErrors.join('<br/>')}</div>`,
            icon: 'warning'
          })
        } else {
          // Baris pelengkap = insert untuk anggota lama yang semesternya kurang
          const completionRows = itemsToInsert.filter((it) => relationMode === 'per_kelas'
            ? !additions.includes(it.body.nisn)
            : !additions.includes(it.body.kelas)).length
          const parts: string[] = []
          if (additions.length > 0) {
            parts.push(relationMode === 'per_kelas'
              ? `<strong>${additions.length} siswa</strong> ditambahkan ke kelas <strong>${selectedClass}</strong>`
              : `Siswa didaftarkan ke <strong>${additions.length} kelas</strong> (${additions.join(', ')})`)
          }
          if (completionRows > 0) {
            parts.push(`<strong>${completionRows} baris</strong> semester yang kurang dilengkapi`)
          }
          if (removals.length > 0) {
            parts.push(relationMode === 'per_kelas'
              ? `<strong>${removals.length} siswa</strong> dikeluarkan`
              : `dikeluarkan dari <strong>${removals.length} kelas</strong>`)
          }
          Swal.fire({
            title: 'Berhasil Tersimpan',
            html: `${parts.join(', ')}.<br/><small>Periode ${tahunAjaran} • ${formSemester === 'Semua' ? 'Ganjil & Genap' : formSemester}</small>`,
            icon: 'success'
          })
        }
      }

      closeFormModal()
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Gagal menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: SiswaKelas) => {
    if (!canUpdate) return
    setEditId(item.id!)
    setEditItem(item)
    setFormSemester(item.semester === 'Genap' ? 'Genap' : 'Ganjil')
    setSelectedClass(item.kelas)
    setSelectedStudents([item.nisn])
    setFormIsPengurus(!!item.is_pengurus)
    setRelationMode('per_kelas')
    setShowModal(true)
  }

  // Toggle pengurus langsung dari baris tabel (tanpa modal). PUT year-scoped
  // menyebar ke semua semester siswa+kelas+tahun ajaran yang sama.
  const togglePengurus = async (item: SiswaKelas) => {
    if (!canUpdate || !item.id || pengurusBusyId === item.id) return
    setPengurusBusyId(item.id)
    try {
      const res = await fetch('/api/settings/siswa-kelas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          nisn: item.nisn,
          nama_siswa: item.nama_siswa,
          kelas: item.kelas,
          tahun_ajaran: item.tahun_ajaran,
          semester: item.semester,
          aktif: item.aktif,
          is_pengurus: !item.is_pengurus,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Gagal memperbarui status pengurus')
      await fetchData()
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Gagal memperbarui status pengurus', 'error')
    } finally {
      setPengurusBusyId(null)
    }
  }

  const handleDelete = (id: number, name: string) => {
    if (!canDelete) return
    setDeleteItemId(id)
    setDeleteItemName(name)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteItemId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/settings/siswa-kelas?id=${deleteItemId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        setShowDeleteModal(false)
        setDeleteItemId(null)
        setDeleteItemName('')
        fetchData()
        Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success')
      } else {
        Swal.fire('Gagal', json.error || 'Gagal menghapus data', 'error')
      }
    } catch (err) {
      console.error(err)
      Swal.fire('Gagal', 'Terjadi kesalahan', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    if (!canExport) return;
    if (allData.length === 0) {
      alert('Tidak ada data untuk diexport')
      return
    }
    const dataToExport = allData.map((item, index) => ({
      No: index + 1,
      NISN: item.nisn,
      Nama_Siswa: item.nama_siswa,
      Kelas: item.kelas,
      Tahun_Ajaran: item.tahun_ajaran,
      Semester: item.semester,
      Status: item.aktif ? 'Aktif' : 'Non-Aktif',
    }))
    exportToExcel(dataToExport, `SiswaKelas_${tahunAjaran.replace('/', '-')}_${semester}`)
  }

  const mapImportRow = (row: any) => {
    const nisn = row['NISN'] || row['nisn']
    const nama = row['Nama_Siswa'] || row['Nama Siswa'] || row['nama_siswa'] || ''
    const kelas = row['Kelas'] || row['kelas']

    const ta = row['Tahun_Ajaran'] || row['Tahun Ajaran'] || row['tahun_ajaran']
    if (!ta || String(ta).trim() === '') return null

    let sem = row['Semester'] || row['semester'] || ''
    const statusStr = row['Status'] || row['status']
    const aktif = statusStr
      ? String(statusStr).toLowerCase() === 'aktif' || statusStr === 'true' || statusStr === true
      : true

    const rawNisn = String(nisn ?? '').trim()
    const fixedNisn = rawNisn.length < 10 && /^\d+$/.test(rawNisn) ? rawNisn.padStart(10, '0') : rawNisn

    const baseObj = {
      nisn: fixedNisn,
      nama_siswa: String(nama).trim(),
      kelas: String(kelas ?? '').trim(),
      tahun_ajaran: String(ta).trim(),
      aktif,
    }

    if (!sem || String(sem).toLowerCase() === 'semua') {
      return [
        { ...baseObj, semester: 'Ganjil' },
        { ...baseObj, semester: 'Genap' },
      ]
    }

    return { ...baseObj, semester: String(sem).trim() }
  }

  const siswaOptions = useMemo(() => {
    const targetClassObj = masterKelas.find((k) => k.nama === selectedClass)
    const targetIsHomeroom = isRegularClass(targetClassObj)

    return masterSiswa
      .filter((student) => {
        if (editId && selectedStudents.includes(student.nisn)) return true

        const enrollments = allEnrollments.filter((e) => e.nisn === student.nisn)

        // Find existing homeroom/regular class enrollment for this student in this academic year
        const existingHomeroom = enrollments.find((e) =>
          isRegularClass(masterKelas.find((k) => k.nama === e.kelas))
        )

        if (targetIsHomeroom) {
          // If trying to add to a regular class, and student already has a regular class,
          // they can only be added to that EXACT same regular class!
          if (existingHomeroom && existingHomeroom.kelas !== selectedClass) {
            return false
          }
        }

        // Edit mode: sembunyikan siswa yang sudah penuh terdaftar di kelas target.
        // Mode tambah TIDAK menyembunyikan anggota — mereka tampil tercentang (preload)
        // sehingga bisa dihapus/dikembalikan dari daftar
        if (editId) {
          const targetSemesters = formSemester === 'Semua' ? ['Ganjil', 'Genap'] : [formSemester]
          const alreadyInTargetInAllTargetSemesters = targetSemesters.every((sem) =>
            enrollments.some((e) => e.kelas === selectedClass && e.semester === sem)
          )
          if (alreadyInTargetInAllTargetSemesters) return false
        }

        return true
      })
      .map((s) => ({
        value: s.nisn,
        label: s.nama_lengkap || s.nisn,
        subLabel: s.nisn,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterSiswa, masterKelas, selectedClass, allEnrollments, editId, selectedStudents, formSemester])

  const allSiswaOptions = useMemo(() => {
    return masterSiswa.map((s) => ({
      value: s.nisn,
      label: s.nama_lengkap || s.nisn,
      subLabel: s.nisn,
    }))
  }, [masterSiswa])

  const availableKelasOptions = useMemo(() => {
    if (!selectedStudent) return []

    // Kelas reguler yang sedang terpilih (termasuk preload dari data tersimpan);
    // pakai state seleksi agar melepas kelas reguler langsung membuka pilihan reguler lain
    const pendingRegular = selectedClasses.find((name) =>
      isRegularClass(masterKelas.find((k) => k.nama === name))
    )

    return masterKelas
      .filter((k) => {
        // Satu kelas reguler per siswa: kelas reguler lain disembunyikan.
        // Anggota tersimpan tidak disembunyikan — tampil tercentang agar bisa dihapus
        if (isRegularClass(k) && pendingRegular && pendingRegular !== k.nama) {
          return false
        }
        return true
      })
      .map((k) => ({
        value: k.nama,
        label: `${k.nama} (${k.program})`,
        subLabel: k.program
      }))
  }, [masterKelas, selectedStudent, selectedClasses])

  // Cek apakah (siswa, kelas, semester) sudah punya baris enrollment tersimpan
  // pada tahun ajaran terpilih (allEnrollments sudah terfilter tahun ajaran + aktif)
  const hasEnrollment = (nisn: string, kelas: string, sem: string) =>
    allEnrollments.some((e) => e.nisn === nisn && e.kelas === kelas && e.semester === sem)

  const formTargetSemesters = formSemester === 'Semua' ? ['Ganjil', 'Genap'] : [formSemester]

  // Anggota terpilih yang baru terdaftar di sebagian semester target;
  // baris semester yang kurang akan di-insert saat Simpan
  const pendingCompletions = editId ? 0 : (relationMode === 'per_kelas'
    ? selectedStudents.filter((n) => {
        if (!selectedClass) return false
        const c = formTargetSemesters.filter((sem) => hasEnrollment(n, selectedClass, sem)).length
        return c > 0 && c < formTargetSemesters.length
      }).length
    : selectedClasses.filter((k) => {
        if (!selectedStudent) return false
        const c = formTargetSemesters.filter((sem) => hasEnrollment(selectedStudent, k, sem)).length
        return c > 0 && c < formTargetSemesters.length
      }).length)

  // Selisih seleksi vs data tersimpan, untuk ringkasan di sidebar modal
  const pendingRemovals = useMemo(() => (
    relationMode === 'per_kelas'
      ? initialMembers.filter((n) => !selectedStudents.includes(n))
      : initialClasses.filter((c) => !selectedClasses.includes(c))
  ), [relationMode, initialMembers, selectedStudents, initialClasses, selectedClasses])

  const pendingAdds = useMemo(() => (
    relationMode === 'per_kelas'
      ? selectedStudents.filter((n) => !initialMembers.includes(n))
      : selectedClasses.filter((c) => !initialClasses.includes(c))
  ), [relationMode, initialMembers, selectedStudents, initialClasses, selectedClasses])

  const openAdd = () => {
    if (tahunAjaran === 'Semua') {
      alert('Pilih Tahun Ajaran spesifik terlebih dahulu.')
      return
    }
    setSelectedClass('')
    setSelectedStudents([])
    setSelectedStudent('')
    setSelectedClasses([])
    setFormIsPengurus(false)
    setRelationMode('per_kelas')
    setEditId(null)
    setEditItem(null)
    setFormSemester(semester)
    setShowModal(true)
  }

  // Group for mobile: by kelas
  const groupedMobile = useMemo(() => {
    const map = new Map<string, SiswaKelas[]>()
      ; (list || []).forEach((it) => {
        const key = String(it.kelas || '-').trim() || '-'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(it)
      })
    // stable sort by kelas
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'id'))
    // sort each group by nama_siswa then nisn
    entries.forEach(([k, arr]) => {
      arr.sort((x, y) => {
        const nx = String(x.nama_siswa || '').toLowerCase()
        const ny = String(y.nama_siswa || '').toLowerCase()
        if (nx !== ny) return nx.localeCompare(ny, 'id')
        return String(x.nisn || '').localeCompare(String(y.nisn || ''), 'id')
      })
    })
    return entries
  }, [list])



  return (
    <div className="sk">
      <style>{`
        .sk__pengurusToggle { background:none; border:0; padding:2px; cursor:pointer; color:#3083FF; line-height:1; transition:opacity .15s ease, transform .1s ease; }
        .sk__pengurusToggle.is-off { color:#cbd5e1; opacity:0; }
        .sk__table tbody tr:hover .sk__pengurusToggle.is-off,
        .sk__cardCompact:hover .sk__pengurusToggle.is-off { opacity:1; }
        .sk__pengurusToggle:hover { transform:scale(1.18); }
        .sk__pengurusToggle:disabled { cursor:default; }
        @media (hover:none) { .sk__pengurusToggle.is-off { opacity:.5; } }

        .sk__cardCompact {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          background: var(--n-card, #ffffff);
          border: 1px solid rgba(225, 226, 233, 0.7);
          border-radius: 12px;
          transition: background 0.15s ease;
          box-sizing: border-box;
          cursor: pointer;
        }
        .sk__cardCompact:hover,
        .sk__cardCompact:active {
          background: #E0ECFF;
        }
        .sk__cardCompactLeft {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          flex: 1 1 auto;
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
      `}</style>
      {/* ===== Toolbar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari siswa / kelas / NISN..."
        />

        <FilterSelect
          label="Tahun Ajaran"
          value={tahunAjaran}
          onChange={setTahunAjaran}
          options={[
            ...(academicYears.length > 1 ? [{ value: 'Semua', label: 'Semua TA' }] : []),
            ...academicYears.map(y => ({ value: y, label: y }))
          ]}
        />

        <FilterSelect
          label="Semester"
          value={semester}
          onChange={setSemester}
          options={[
            ...(availableSemesters.length > 1 ? [{ value: 'Semua', label: 'Semua Sem' }] : []),
            ...availableSemesters.map(s => ({ value: s, label: s }))
          ]}
        />

        <FilterSelect
          label="Kelas"
          value={filterKelas}
          onChange={setFilterKelas}
          options={[
            { value: 'Semua', label: 'Semua Kelas' },
            ...masterKelas.map(k => ({ value: k.nama, label: k.nama }))
          ]}
        />

        <FilterActions>
          {canImport && (
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              icon="import"
              className="sk__btnDesktopOnly"
            >
              Import
            </Button>
          )}

          {canExport && (
            <Button
              variant="outline"
              onClick={handleExport}
              icon="export"
              className="sk__btnDesktopOnly"
            >
              Export
            </Button>
          )}

          {(canImport || canExport) && (
            <div className="sk__more sk__menuItemMobileOnly" ref={actionMenuRef}>
              <Button
                variant="outline"
                onClick={() => setShowActionMenu(v => !v)}
                aria-haspopup="true"
                aria-expanded={showActionMenu}
                title="Lainnya"
                style={{ minWidth: 40, padding: '0 12px' }}
              >
                <i className="bi bi-three-dots" />
              </Button>
              {showActionMenu && (
                <div className="sk__moreMenu" role="menu">
                  {canImport && (
                    <button type="button" role="menuitem" className="sk__menuItemMobileOnly" onClick={() => { setShowActionMenu(false); setShowImportModal(true) }}>
                      <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel-fill" style={{ color: '#f97316' }} /></span>
                      <span className="sk__menuLabel">Import Excel</span>
                    </button>
                  )}
                  {canExport && (
                    <button type="button" role="menuitem" className="sk__menuItemMobileOnly" onClick={() => { setShowActionMenu(false); handleExport() }}>
                      <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#3b82f6' }} /></span>
                      <span className="sk__menuLabel">Export Excel</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </FilterActions>
      </FilterToolbar>

      {/* ===== Table (Desktop/Tablet) ===== */}
      <div className="sk__tableWrap">
        <table className="sk__table">
          <thead>
            <tr>
              <th className="cNo">No</th>
              <th className="cNisn">NISN</th>
              <th>Nama Siswa</th>
              <th className="cKelas">Kelas</th>
              <th className="cTa">Tahun</th>
              <th className="cSem">Semester</th>
              <th className="cStatus">Status</th>
              <th className="cAksi">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="sk__empty" style={{ border: 'none' }}>
                  <Spinner variant="trace" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={8} className="sk__empty sk__muted">
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            ) : (
              list.map((item, index) => (
                <tr key={item.id ?? `${item.nisn}-${index}`}>
                  <td className="tCenter">{index + 1}</td>
                  <td className="tMono">{item.nisn}</td>
                  <td className="tPlain">
                    {item.nama_siswa}
                    {canUpdate ? (
                      <button
                        type="button"
                        className={`sk__pengurusToggle${item.is_pengurus ? '' : ' is-off'}`}
                        onClick={() => togglePengurus(item)}
                        disabled={pengurusBusyId === item.id}
                        title={item.is_pengurus ? 'Pengurus kelas — klik untuk melepas' : 'Tandai sebagai pengurus kelas'}
                        aria-label={item.is_pengurus ? 'Lepas pengurus kelas' : 'Tandai pengurus kelas'}
                        style={{ marginLeft: 7, fontSize: '0.8rem', verticalAlign: 'middle' }}
                      >
                        <i className={item.is_pengurus ? 'bi bi-star-fill' : 'bi bi-star'} />
                      </button>
                    ) : item.is_pengurus && (
                      <i className="bi bi-star-fill" title="Pengurus kelas" aria-label="Pengurus kelas" style={{ marginLeft: 7, color: '#3083FF', fontSize: '0.78rem', verticalAlign: 'middle' }} />
                    )}
                  </td>
                  <td>
                    {(() => {
                      const classBadge = getClassBadgeStyle(item.kelas, isDark);
                      return (
                        <span className="sk__badge" style={{ background: classBadge.bg, color: classBadge.fg, border: classBadge.border }}>
                          {item.kelas}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="tMuted">{item.tahun_ajaran}</td>
                  <td>
                    {(() => {
                      const semBadge = getSemesterBadgeStyle(item.semester, isDark);
                      return (
                        <span className="sk__pill" style={{ background: semBadge.bg, color: semBadge.fg, border: semBadge.border }}>
                          {item.semester}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const stBadge = getStatusBadgeStyle(item.aktif, isDark);
                      return (
                        <span className="sk__status" style={{ background: stBadge.bg, color: stBadge.fg, border: stBadge.border }}>
                          {item.aktif ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      );
                    })()}
                  </td>

                  <td>
                    <ActionGroup>
                      {canUpdate && (
                        <ActionButton
                          action="edit"
                          onClick={() => handleEdit(item)}
                        />
                      )}
                      {canDelete && (
                        <ActionButton
                          action="delete"
                          onClick={() => item.id && handleDelete(item.id, item.nama_siswa)}
                        />
                      )}
                    </ActionGroup>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile Compact Cards ===== */}
      <div
        className="sk__cards"
        aria-label="Daftar Siswa-Kelas versi mobile"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            <Spinner variant="trace" />
          </div>
        ) : list.length === 0 ? (
          <div className="sk__emptyCard">Tidak ada data siswa kelas.</div>
        ) : (
          list.map((item, idx) => (
            <div
              className="sk__cardCompact"
              key={`m-${item.id ?? `${item.nisn}-${idx}`}`}
              onClick={() => setMobileAction({ open: true, item })}
            >
              <div className="sk__avatar">
                <span className="sk__avatarText">
                  {item.nama_siswa ? item.nama_siswa.charAt(0).toUpperCase() : 'S'}
                </span>
              </div>
              <div className="sk__cardCompactLeft">
                <div className="sk__cardName">
                  {item.nama_siswa || '-'}
                  {canUpdate ? (
                    <button
                      type="button"
                      className={`sk__pengurusToggle${item.is_pengurus ? '' : ' is-off'}`}
                      onClick={(e) => { e.stopPropagation(); togglePengurus(item); }}
                      disabled={pengurusBusyId === item.id}
                      title={item.is_pengurus ? 'Pengurus kelas — ketuk untuk melepas' : 'Tandai sebagai pengurus kelas'}
                      aria-label={item.is_pengurus ? 'Lepas pengurus kelas' : 'Tandai pengurus kelas'}
                      style={{ marginLeft: 6, fontSize: '0.75rem', verticalAlign: 'middle' }}
                    >
                      <i className={item.is_pengurus ? 'bi bi-star-fill' : 'bi bi-star'} />
                    </button>
                  ) : item.is_pengurus && (
                    <i className="bi bi-star-fill" title="Pengurus kelas" aria-label="Pengurus kelas" style={{ marginLeft: 6, color: '#3083FF', fontSize: '0.72rem', verticalAlign: 'middle' }} />
                  )}
                </div>
                <div className="sk__cardNip">
                  <span>Kelas: {item.kelas || '-'}</span>
                  <span>· NISN: {item.nisn}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Aksi utama tab: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
      {canCreate && <DesktopFab label="Tambah Relasi" icon="plus-lg" onClick={openAdd} />}
      {canCreate && <MobileFab label="Tambah Relasi" icon="plus-lg" onClick={openAdd} />}

      {/* Sheet */}
      {mobileAction.open && mobileAction.item && (
        <div className="sk__sheetOverlay" onClick={e => e.target === e.currentTarget && setMobileAction({ open: false, item: null })}>
          <div className="sk__sheet">
            <div className="sk__sheetHandle"></div>
            <div className="sk__sheetTitle">
              <div className="sk__sheetName">{mobileAction.item.nama_siswa || '-'}</div>
              <div className="sk__sheetSub">Kelas {mobileAction.item.kelas} · NISN {mobileAction.item.nisn} · {mobileAction.item.tahun_ajaran} ({mobileAction.item.semester})</div>
            </div>
            <div className="sk__sheetActions">
              {canUpdate && <button className="sk__sheetBtn" onClick={() => { setMobileAction({ open: false, item: null }); handleEdit(mobileAction.item!) }}>
                <i className="bi bi-pencil"></i> Edit Relasi
              </button>}
              {canDelete && <button className="sk__sheetBtn danger" onClick={() => { if (mobileAction.item?.id) handleDelete(mobileAction.item.id, mobileAction.item.nama_siswa); setMobileAction({ open: false, item: null }) }}>
                <i className="bi bi-trash"></i> Hapus Relasi
              </button>}
            </div>
            <button className="sk__sheetCancel" onClick={() => setMobileAction({ open: false, item: null })}>Batal</button>
          </div>
        </div>
      )}

      {/* ===== Pagination ===== */}
      {totalItems > 0 && (
        <Pagination itemLabel="siswa"
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / pageSize)}
          limit={pageSize}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          onLimitChange={(newLimit) => {
            setCurrentPage(1)
            setPageSize(newLimit)
          }}
        />
      )}

      {/* ===== Modal Add/Edit ===== */}
      {showModal && (
        <Modal size="xl" variant={editId ? 'edit' : 'add'} onClose={closeFormModal} labelledBy="siswa-kelas-modal-title">
          <ModalHeader
            id="siswa-kelas-modal-title"
            icon={editId ? 'pencil-square' : 'plus-lg'}
            title={editId ? 'Edit Relasi Siswa' : 'Tambah Relasi Siswa Kelas'}
            subtitle={`Periode: ${tahunAjaran} • ${formSemester === 'Semua' ? 'Ganjil & Genap' : formSemester}`}
            onClose={closeFormModal}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody className={!editId ? 'sk__modalBody--split' : ''}>
                <div className="sk__modalForm">
                  <div className="sk__grid2">
                    <div className="sk__field">
                      <label>Tahun Ajaran</label>
                      <input value={tahunAjaran} disabled />
                    </div>
                    <div className="sk__field">
                      <label>Semester</label>
                      <select
                        className="sk__select"
                        value={formSemester}
                        onChange={(e) => setFormSemester(e.target.value)}
                      >
                        <option value="Ganjil">Ganjil</option>
                        <option value="Genap">Genap</option>
                        <option value="Semua">Ganjil & Genap</option>
                      </select>
                    </div>
                  </div>

                  {!editId && (
                    <div className="sk__modeToggle">
                      <button
                        type="button"
                        className={`sk__modeTab ${relationMode === 'per_kelas' ? 'active' : ''}`}
                        onClick={() => {
                          setRelationMode('per_kelas')
                          setSelectedClass('')
                          setSelectedStudents([])
                          setSelectedStudent('')
                          setSelectedClasses([])
                        }}
                      >
                        <i className="bi bi-door-open" /> Tambah per Kelas
                      </button>
                      <button
                        type="button"
                        className={`sk__modeTab ${relationMode === 'per_siswa' ? 'active' : ''}`}
                        onClick={() => {
                          setRelationMode('per_siswa')
                          setSelectedClass('')
                          setSelectedStudents([])
                          setSelectedStudent('')
                          setSelectedClasses([])
                        }}
                      >
                        <i className="bi bi-person" /> Tambah per Siswa
                      </button>
                    </div>
                  )}

                  {relationMode === 'per_kelas' ? (
                    <>
                      <div className="sk__field">
                        <label>Pilih Kelas</label>
                        <select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          required
                          className="sk__select"
                        >
                          <option value="">— Pilih Kelas —</option>
                          {masterKelas.map((k) => (
                            <option key={k.id} value={k.nama}>
                              {k.nama} ({k.program})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sk__field">
                        <label>Pilih Siswa {editId ? '(Ganti Siswa)' : '(Bisa lebih dari satu)'}</label>
                        <SearchableSelect
                          options={siswaOptions}
                          value={selectedStudents}
                          onChange={(val) => {
                            if (editId) {
                              const singleVal = Array.isArray(val) ? val.slice(-1) : [val]
                              setSelectedStudents(singleVal as string[])
                            } else {
                              setSelectedStudents(val as string[])
                            }
                          }}
                          placeholder={selectedClass ? "Cari dan pilih siswa..." : "Silakan pilih kelas terlebih dahulu"}
                          multiple={!editId}
                          disabled={!selectedClass}
                          placement="top"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sk__field">
                        <label>Pilih Siswa</label>
                        <SearchableSelect
                          options={allSiswaOptions}
                          value={selectedStudent}
                          onChange={(val) => setSelectedStudent(val as string)}
                          placeholder="Cari dan pilih siswa..."
                          multiple={false}
                        />
                      </div>

                      <div className="sk__field">
                        <label>Pilih Kelas (Bisa lebih dari satu)</label>
                        <SearchableSelect
                          options={availableKelasOptions}
                          value={selectedClasses}
                          onChange={(val) => setSelectedClasses(val as string[])}
                          placeholder={selectedStudent ? "Cari dan pilih kelas..." : "Silakan pilih siswa terlebih dahulu"}
                          multiple={true}
                          itemLabel="kelas"
                          disabled={!selectedStudent}
                          placement="top"
                        />
                      </div>
                    </>
                  )}

                  {editId && (
                    <div className="sk__field">
                      <label
                        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', border: '1px solid var(--n-border, #e2e8f0)', borderRadius: 10 }}
                      >
                        <input
                          type="checkbox"
                          checked={formIsPengurus}
                          onChange={(e) => setFormIsPengurus(e.target.checked)}
                          style={{ width: 16, height: 16, margin: 0 }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--n-text)' }}>Jadikan pengurus kelas</span>
                        <i className="bi bi-star-fill" style={{ marginLeft: 'auto', color: '#3083FF', fontSize: '0.9rem' }} />
                      </label>
                      <small style={{ display: 'block', marginTop: 6, color: 'var(--n-muted)', fontSize: '0.72rem', lineHeight: 1.5 }}>
                        Pengurus boleh membuat tugas untuk kelasnya. Berlaku pada tahun ajaran ini saja.
                      </small>
                    </div>
                  )}
                </div>

                {!editId && (
                  <div className="sk__modalSidebar">
                    {relationMode === 'per_kelas' ? (
                      <>
                        <div className="sk__sidebarTitle">
                          <span>Anggota Kelas</span>
                          <span className="sk__selectedCount" style={{margin:0, padding:'2px 8px', borderRadius:'8px', background:'var(--n-primary)', color:'white', fontSize:'0.75rem'}}>{selectedStudents.length}</span>
                        </div>

                        {(pendingAdds.length > 0 || pendingRemovals.length > 0 || pendingCompletions > 0) && (
                          <div style={{fontSize:'0.75rem', fontWeight:600, margin:'6px 0', display:'flex', gap:10, flexWrap:'wrap'}}>
                            {pendingAdds.length > 0 && (
                              <span style={{color:'#16a34a'}}><i className="bi bi-plus-circle" /> {pendingAdds.length} baru</span>
                            )}
                            {pendingCompletions > 0 && (
                              <span style={{color:'#b45309'}}><i className="bi bi-arrow-repeat" /> {pendingCompletions} semesternya dilengkapi saat disimpan</span>
                            )}
                            {pendingRemovals.length > 0 && (
                              <span style={{color:'#dc2626'}}><i className="bi bi-exclamation-triangle" /> {pendingRemovals.length} akan dihapus saat disimpan</span>
                            )}
                          </div>
                        )}

                        {selectedStudents.length === 0 ? (
                          <div className="sk__sidebarPlaceholder">
                            <i className="bi bi-people" />
                            <span>{selectedClass ? 'Belum ada siswa di kelas ini.' : 'Pilih kelas untuk melihat anggotanya.'}<br/>Cari dan pilih siswa di kolom kiri untuk menambah.</span>
                          </div>
                        ) : (
                          <div className="sk__sidebarList">
                            {selectedStudents.map((nisn) => {
                              const s = masterSiswa.find((x) => x.nisn === nisn)
                              const enrolledSems = formTargetSemesters.filter((sem) => hasEnrollment(nisn, selectedClass, sem))
                              const isSaved = enrolledSems.length > 0
                              const isPartial = isSaved && enrolledSems.length < formTargetSemesters.length
                              const badgeLabel = !isSaved ? 'Baru' : isPartial ? `${enrolledSems[0]} saja` : 'Tersimpan'
                              return (
                                <div className="sk__sidebarItem" key={nisn}>
                                  <div className="sk__sidebarItemInfo">
                                    <span className="sk__sidebarItemName">{s?.nama_lengkap || nisn}</span>
                                    <span className="sk__sidebarItemSub">
                                      {nisn}
                                      <span
                                        title={isPartial ? 'Baris semester lainnya akan dilengkapi saat disimpan' : undefined}
                                        style={{
                                        marginLeft: 6, padding: '1px 6px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                                        background: !isSaved ? 'rgba(34,197,94,0.14)' : isPartial ? 'rgba(245,158,11,0.16)' : 'rgba(100,116,139,0.12)',
                                        color: !isSaved ? 'rgba(22,163,74,1)' : isPartial ? 'rgba(180,83,9,1)' : 'rgba(71,85,105,0.95)',
                                      }}>{badgeLabel}</span>
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="sk__sidebarItemRemove"
                                    onClick={() => setSelectedStudents(selectedStudents.filter((id) => id !== nisn))}
                                    title={isSaved ? 'Keluarkan dari kelas (dihapus saat disimpan)' : 'Batalkan'}
                                  >
                                    <i className="bi bi-x" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="sk__sidebarTitle">
                          <span>Kelas Siswa Ini</span>
                          <span className="sk__selectedCount" style={{margin:0, padding:'2px 8px', borderRadius:'8px', background:'var(--n-primary)', color:'white', fontSize:'0.75rem'}}>{selectedClasses.length}</span>
                        </div>

                        {(pendingAdds.length > 0 || pendingRemovals.length > 0 || pendingCompletions > 0) && (
                          <div style={{fontSize:'0.75rem', fontWeight:600, margin:'6px 0', display:'flex', gap:10, flexWrap:'wrap'}}>
                            {pendingAdds.length > 0 && (
                              <span style={{color:'#16a34a'}}><i className="bi bi-plus-circle" /> {pendingAdds.length} baru</span>
                            )}
                            {pendingCompletions > 0 && (
                              <span style={{color:'#b45309'}}><i className="bi bi-arrow-repeat" /> {pendingCompletions} semesternya dilengkapi saat disimpan</span>
                            )}
                            {pendingRemovals.length > 0 && (
                              <span style={{color:'#dc2626'}}><i className="bi bi-exclamation-triangle" /> {pendingRemovals.length} akan dihapus saat disimpan</span>
                            )}
                          </div>
                        )}

                        {selectedClasses.length === 0 ? (
                          <div className="sk__sidebarPlaceholder">
                            <i className="bi bi-door-open" />
                            <span>{selectedStudent ? 'Siswa ini belum masuk kelas manapun.' : 'Pilih siswa untuk melihat kelasnya.'}<br/>Cari dan pilih kelas di kolom kiri untuk menambah.</span>
                          </div>
                        ) : (
                          <div className="sk__sidebarList">
                            {selectedClasses.map((kelasNama) => {
                              const enrolledSems = formTargetSemesters.filter((sem) => hasEnrollment(selectedStudent, kelasNama, sem))
                              const isSaved = enrolledSems.length > 0
                              const isPartial = isSaved && enrolledSems.length < formTargetSemesters.length
                              const badgeLabel = !isSaved ? 'Baru' : isPartial ? `${enrolledSems[0]} saja` : 'Tersimpan'
                              return (
                                <div className="sk__sidebarItem" key={kelasNama}>
                                  <div className="sk__sidebarItemInfo">
                                    <span className="sk__sidebarItemName">{kelasNama}</span>
                                    <span className="sk__sidebarItemSub">
                                      Kelas
                                      <span
                                        title={isPartial ? 'Baris semester lainnya akan dilengkapi saat disimpan' : undefined}
                                        style={{
                                        marginLeft: 6, padding: '1px 6px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                                        background: !isSaved ? 'rgba(34,197,94,0.14)' : isPartial ? 'rgba(245,158,11,0.16)' : 'rgba(100,116,139,0.12)',
                                        color: !isSaved ? 'rgba(22,163,74,1)' : isPartial ? 'rgba(180,83,9,1)' : 'rgba(71,85,105,0.95)',
                                      }}>{badgeLabel}</span>
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="sk__sidebarItemRemove"
                                    onClick={() => setSelectedClasses(selectedClasses.filter((c) => c !== kelasNama))}
                                    title={isSaved ? 'Keluarkan dari kelas (dihapus saat disimpan)' : 'Batalkan'}
                                  >
                                    <i className="bi bi-x" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
            </ModalBody>
            <ModalFooter>
              <Button variant="cancel" type="button" onClick={closeFormModal} leftIcon={<i className="bi bi-x-lg" />}>
                Batal
              </Button>
              <Button variant="primary" type="submit" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                Simpan
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* ===== Import Modal ===== */}
      {showImportModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowImportModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 99998, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
        >
          <div onClick={e => e.stopPropagation()}>
            <ImportModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImportSuccess={fetchData}
              templateColumns={['No', 'NISN', 'Nama_Siswa', 'Kelas', 'Tahun_Ajaran', 'Semester']}
              templateName={`Template_SiswaKelas`}
              apiEndpoint="/api/settings/siswa-kelas"
              mapRowData={mapImportRow}
              useBulk={true}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal size="sm" variant="delete" onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }} labelledBy="delete-siswa-kelas-title">
          <ModalHeader
            id="delete-siswa-kelas-title"
            icon="trash3"
            title={deleteItemName}
            onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          />
          <ModalFooter>
            <Button
              variant="cancel"
              type="button"
              onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
              leftIcon={<i className="bi bi-x-lg" />}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={confirmDelete}
              isLoading={deleting}
              leftIcon={<i className="bi bi-trash3-fill" />}
            >
              Ya, Hapus!
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <style jsx>{`
        :global(:root) {
  --sk-line: rgba(148, 163, 184, 0.22);
  --sk-card: rgba(255, 255, 255, 0.92);

  --sk-shadow: 0 14px 34px rgba(2, 6, 23, 0.08);
  --sk-shadow2: 0 10px 22px rgba(2, 6, 23, 0.08);

  --sk-radius: 16px;

  /* typography compact */
  --sk-fs: 0.88rem;
  --sk-fs-sm: 0.82rem;
  --sk-fs-xs: 0.78rem;

  /* iOS safe area */
  --sk-safe-b: env(safe-area-inset-bottom, 0px);
  --sk-safe-t: env(safe-area-inset-top, 0px);
}

.sk {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: var(--sk-fs);

  /* background page feel */
  padding: 0; background: transparent;
  border-radius: 16px;

  /* space for sticky bottom bar in mobile */
  padding-bottom: calc(16px + var(--sk-safe-b));
}

/* ========= TOOLBAR ========= */
.sk__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: nowrap;
  width: 100%;
  min-width: 0;
}

.sk__filters {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;

  padding: 8px;
  border-radius: var(--sk-radius);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--sk-line);
  box-shadow: var(--sk-shadow2);
}

.sk__search {
  position: relative;
  flex: 1 1 120px;
  min-width: 80px;
}

.sk__search i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(100, 116, 139, 0.9);
  pointer-events: none;
  font-size: 0.9rem;
}

.sk__search input {
  width: 100%;
  padding: 8px 10px 8px 30px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);

  /* lebih profesional */
  font-weight: 500;
  color: rgba(15, 23, 42, 0.92);

  outline: none;
  font-size: var(--sk-fs-sm);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.sk__filters select {
  padding: 8px 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);

  font-weight: 550;
  color: rgba(15, 23, 42, 0.86);
  outline: none;
  min-width: 138px;
  max-width: 220px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  font-size: var(--sk-fs-sm);

  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 14px;
  padding-right: 38px;
}

.sk__search input:focus,
.sk__filters select:focus {
  border-color: rgba(58, 166, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14);
}

.sk__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  flex-wrap: nowrap;
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

/* Buttons */
.sk__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--sk-line);
  background: rgba(255, 255, 255, 0.78);
  color: rgba(7, 22, 46, 0.9);

  font-weight: 600;
  font-size: var(--sk-fs-sm);

  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  white-space: nowrap;
}

.sk__btn i {
  font-size: 1rem;
}

.sk__btn:hover {
  /* background: rgba(255, 255, 255, 0.92); removed */
  border-color: rgba(58, 166, 255, 0.25);
  box-shadow: 0 4px 12px rgba(58, 166, 255, 0.2);
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.sk__btn:active {
  transform: translateY(0);
}

.sk__btnPrimary {
  background: linear-gradient(135deg, rgba(58, 166, 255, 0.92), rgba(15, 42, 86, 0.92));
  border-color: rgba(58, 166, 255, 0.32);
  color: #fff;
  font-weight: 650;
}

.sk__btnExport {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(16, 185, 129, 0.28);
  color: #fff;
}

.sk__btnImport {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(245, 158, 11, 0.28);
  color: #fff;
}

.sk__modalFoot .sk__btn {
  font-weight: 600;
}

/* ========= TABLE ========= */
.sk__tableWrap {
  width: 100%;
  min-width: 0;
  overflow: auto;
  border-radius: var(--sk-radius);
  border: 1px solid var(--sk-line);
  background: var(--sk-card);
  box-shadow: var(--sk-shadow);
}

.sk__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 920px;
}

.sk__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.98));
  color: rgba(7, 22, 46, 0.86);
  font-size: var(--sk-fs-xs);
  font-weight: 750;
  letter-spacing: 0.01em;
  text-align: left;
  padding: 10px 10px;
  border-bottom: 1px solid var(--sk-line);
  white-space: nowrap;
}

.sk__table tbody td {
  padding: 10px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  color: rgba(15, 23, 42, 0.92);
  font-size: var(--sk-fs-sm);
  font-weight: 400;
  vertical-align: middle;
  background: rgba(255, 255, 255, 0.82);
}

.sk__table tbody tr:nth-child(even) td {
  background: rgba(248, 250, 252, 0.85);
}

.sk__table tbody tr:hover td {
  background: rgba(58, 166, 255, 0.055);
}

.sk__empty {
  text-align: center;
  padding: 18px 10px !important;
  font-weight: 500;
  font-size: var(--sk-fs-sm);
}

.sk__muted {
  color: rgba(100, 116, 139, 0.9) !important;
  font-weight: 400 !important;
}

.cNo { width: 56px; }
.cNisn { width: 150px; }
.cKelas { width: 110px; }
.cTa { width: 110px; }
.cSem { width: 110px; }
.cStatus { width: 110px; }
.cAksi { width: 110px; text-align: right; }

.tCenter { text-align: center; }

.tMono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: var(--sk-fs-xs);
  font-weight: 400;
}

.tPlain { font-weight: 400; }
.tMuted { color: rgba(100, 116, 139, 0.9); }

.sk__badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 8px !important;
  font-weight: 600;
  font-size: var(--sk-fs-xs);
  white-space: nowrap;
}

.sk__pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 8px !important;
  font-weight: 600;
  font-size: var(--sk-fs-xs);
  white-space: nowrap;
}

.sk__status {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px !important;
  font-weight: 600;
  font-size: var(--sk-fs-xs);
  white-space: nowrap;
}
.sk__status::before { display: none !important; content: none !important; }

.sk__status.isOn {
  background: rgba(0, 56, 168, 0.08);
  border: 1px solid rgba(0, 56, 168, 0.25);
  color: #3083FF;
}

:global(.dark) .sk__status.isOn {
  background: rgba(14, 165, 233, 0.15) !important;
  border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
  color: #38bdf8 !important;
}

.sk__status.isOff {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: rgba(220, 38, 38, 1);
}

:global(.dark) .sk__status.isOff {
  background: rgba(239, 68, 68, 0.15) !important;
  border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
  color: #f87171 !important;
}

.sk__rowActions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.sk__iconBtn {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.9);
  color: rgba(7, 22, 46, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.sk__iconBtn:hover {
  box-shadow: var(--sk-shadow2);
  transform: translateY(-1px);
  border-color: rgba(58, 166, 255, 0.22);
}

.sk__iconBtn.danger {
  color: rgba(220, 38, 38, 1);
  border-color: rgba(239, 68, 68, 0.18);
  background: rgba(239, 68, 68, 0.06);
}

/* ========= MOBILE CARDS ========= */
.sk__cards {
  display: none; /* default desktop hidden */
  flex-direction: column;
  gap: 12px;
}

/* (Grouping ready) wrapper classes */
.sk__group {
  border: 1px solid rgba(15, 42, 86, 0.10);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255,255,255,.85);
  box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06);
}

.sk__groupHead {
  position: sticky;
  top: 0; /* akan efektif kalau container diberi overflow; tetap aman */
  z-index: 2;
  padding: 12px 14px;
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.96));
  border-bottom: 1px solid rgba(15, 42, 86, 0.10);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.sk__groupTitleRow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.sk__groupTitle {
  margin: 0;
  font-size: .92rem;
  font-weight: 800;
  color: rgba(11,31,58,.95);
}

.sk__groupMeta {
  font-size: .78rem;
  font-weight: 650;
  color: rgba(100,116,139,.92);
  white-space: nowrap;
}

.sk__groupBody {
  padding: 12px 12px 2px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Card */
.sk__card {
  background: var(--n-card);
  border: 1px solid rgba(15,42,86,.14);
  border-radius: 16px;
  box-shadow: 0 12px 26px rgba(15,23,42,.10);
  overflow: hidden;
}

.sk__cardHead {
  padding: 14px 14px 10px;
  background: linear-gradient(180deg, #ffffff, #fbfcff);
  border-bottom: 1px solid rgba(15,42,86,.08);

  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.sk__cardTitle { min-width: 0; }

.sk__cardName {
  font-weight: 800;
  color: rgba(11,31,58,.95);
  font-size: .86rem;
  line-height: 1.25;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  word-break: break-word;
}

.sk__cardSub {
  margin-top: 4px;
  color: rgba(100,116,139,.95);
  font-weight: 600;
  font-size: .82rem;
}

.sk__cardActions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

.sk__cardBody {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sk__statusRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.sk__statusLeft {
  flex: 0 0 auto;
}

.sk__actionsRight {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

.sk__kv {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.sk__k {
  color: rgba(15,42,86,.70);
  font-size: .74rem;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  flex: 0 0 112px;
}

.sk__v {
  flex: 1 1 auto;
  min-width: 0;
  text-align: right;
  color: rgba(15,23,42,.92);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.sk__cardFoot {
  padding: 12px 14px;
  background: rgba(15,42,86,.04);
  border-top: 1px solid rgba(15,42,86,.08);
}

.sk__cardTags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* ========= MODAL ========= */
.sk__modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.sk__modal {
  width: min(840px, 100%);
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  box-shadow: 0 28px 80px rgba(2, 6, 23, 0.35);
  position: relative;
  transition: width 0.2s ease;
}

.sk__modalHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  border-top-left-radius: 15px;
  border-top-right-radius: 15px;
}

.sk__modalTitle h2 {
  margin: 0 0 3px;
  font-size: 0.98rem;
  font-weight: 750;
  color: rgba(7, 22, 46, 0.96);
}

.sk__modalTitle p {
  margin: 0;
  font-size: var(--sk-fs-sm);
  font-weight: 500;
  color: rgba(100, 116, 139, 0.95);
}

.sk__selectedStudent {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(58, 166, 255, 0.08), rgba(15, 42, 86, 0.04));
  border: 1px solid rgba(58, 166, 255, 0.2);
  border-radius: 10px;
  font-size: var(--sk-fs-sm);
  font-weight: 600;
  color: rgba(15, 42, 86, 0.9);
}

.sk__selectedStudent i {
  font-size: 1.1rem;
  color: rgba(58, 166, 255, 0.8);
}

.sk__close {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.9);
  color: rgba(7, 22, 46, 0.92);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sk__modalBody {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* .sk__grid2 sekarang di components/modal.css — ubah di sana, bukan di sini. */

.sk__field label {
  display: block;
  font-size: var(--sk-fs-xs);
  font-weight: 650;
  color: rgba(7, 22, 46, 0.88);
  margin-bottom: 7px;
}

.sk__field input,
.sk__field select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(248, 250, 252, 0.9);
  color: rgba(15, 23, 42, 0.92);
  font-weight: 500;
  outline: none;
  font-size: var(--sk-fs-sm);
}

.sk__field input:focus,
.sk__field select:focus {
  border-color: rgba(58, 166, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14);
}

.sk__hint {
  margin-top: 7px;
  font-size: var(--sk-fs-xs);
  font-weight: 500;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(248, 250, 252, 0.92);
  color: rgba(100, 116, 139, 0.95);
}

.sk__hintWarn {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(245, 158, 11, 0.1);
  color: rgba(180, 83, 9, 1);
}

.sk__modalFoot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.92);
  border-bottom-left-radius: 15px;
  border-bottom-right-radius: 15px;
}

/* =========================
   RESPONSIVE SWITCH (CLEAN)
   Desktop: TABLE
   Mobile : CARDS
========================= */
.sk__tableWrap { display: block; }
.sk__cards { display: none; }

/* ===== DARK MODE FULL ===== */


.sk__studentSearch {
  position: relative;
  margin-bottom: 10px;
}

.sk__studentSearch i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(100, 116, 139, 0.9);
  pointer-events: none;
}

.sk__studentSearch input {
  width: 100%;
  padding: 9px 10px 9px 30px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.92);
  font-weight: 500;
  font-size: var(--sk-fs-sm);
  outline: none;
}

.sk__multi {
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 42, 86, 0.02);
  border-radius: 16px;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  max-height: 340px;
  overflow: auto;
}

.sk__pick {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  padding: 10px 10px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.12s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.sk__pick:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.1);
  border-color: rgba(58, 166, 255, 0.24);
  background: rgba(255, 255, 255, 0.98);
}

.sk__pick.isOn {
  border-color: rgba(58, 166, 255, 0.42);
  background: linear-gradient(135deg, rgba(58, 166, 255, 0.11), rgba(255, 255, 255, 0.98));
  box-shadow: 0 14px 22px rgba(58, 166, 255, 0.12);
}

.sk__check {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 2px solid rgba(148, 163, 184, 0.55);
  background: var(--n-card);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin-top: 2px;
}

.sk__pick.isOn .sk__check {
  border-color: rgba(58, 166, 255, 0.72);
  background: rgba(58, 166, 255, 1);
}

.sk__pickInfo {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
}

.sk__pickName {
  font-weight: 800;
  color: rgba(11, 31, 58, 0.96);
  font-size: 0.8rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sk__pickMeta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  color: rgba(100, 116, 139, 0.95);
  font-size: 0.78rem;
  font-weight: 600;
}

.sk__dot {
  opacity: 0.65;
}

.sk__pillKelas {
  display: inline-flex;
  align-items: center;
  padding: 3px 7px;
  border-radius: 8px !important;
  border: 1px solid rgba(15, 42, 86, 0.12);
  background: rgba(15, 42, 86, 0.06);
  color: rgba(7, 22, 46, 0.9);
  font-weight: 650;
  font-size: 0.72rem;
  white-space: nowrap;
}


.sk__selectedCount {
  margin-top: 10px;
  font-size: var(--sk-fs-xs);
  color: rgba(100, 116, 139, 0.95);
  font-weight: 600;
}

/* ========= Reduced motion ========= */
@media (prefers-reduced-motion: reduce) {
  .sk__btn,
  .sk__iconBtn,
  .sk__pick {
    transition: none;
  }
  .sk__btn:hover,
  .sk__iconBtn:hover,
  .sk__pick:hover {
    transform: none;
  }
}

/* ========= MOBILE RESPONSIVE: All-in-One Toolbar & Filters ========= */
@media (max-width: 768px) {
  .sk__tableWrap { display: none; }
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

  .sk__bar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px;
    background: white;
    border-radius: 14px;
    border: 1px solid rgba(148,163,184,0.22);
    box-shadow: 0 2px 12px rgba(2,6,23,0.06);
  }
  .sk__search {
    flex: 1 1 100%;
    min-width: 0;
  }
  .sk__search input {
    width: 100%;
    box-sizing: border-box;
    font-size: 0.82rem;
    padding: 9px 10px 9px 32px;
  }
  .sk__filters {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    flex: 1 1 100%;
    width: 100%;
    padding: 10px;
  }
  .sk__filters select {
    width: 100%;
    max-width: none;
    box-sizing: border-box;
    flex: none;
    min-width: 0;
    font-size: 0.82rem;
    padding: 9px 10px;
  }
  .sk__actions {
    flex: 1 1 100%;
    display: flex;
    flex-direction: row;
    gap: 6px;
  }
  .sk__actions > button {
    flex: 1;
  }
  .sk__actions .sk__more {
    flex: 0 0 auto;
  }
  .sk__actions .sk__btn {
    padding: 9px 4px;
    font-size: 0.78rem;
    justify-content: center;
    min-width: 0;
  }
  .sk__actions .sk__more .sk__btn {
    width: 100%;
  }
  .sk__actions .sk__btn span {
    display: none;
  }
  .sk__actions .sk__btn i {
    margin: 0;
  }

  /* pagination */
  .pagination-container {
    flex-direction: column !important;
    gap: 10px;
    padding: 12px 8px;
  }
  .pagination-info {
    text-align: center;
    min-width: unset;
  }
  .pagination-controls {
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .limit-selector { display: none; }
  .page-number { min-width: 70px; }
  .btn-page { width: 32px; height: 32px; }

  .sk {
    padding: 0;
    padding-bottom: calc(16px + var(--sk-safe-b));
    background: transparent;
    border-radius: 0;
  }
  .sk__modalBody .sk__grid2 { grid-template-columns: 1fr; }

  /* Bottom-sheet: modal nempel bawah, tinggi dibatasi viewport (dvh utk toolbar Safari iOS) */
  .sk__modalOverlay {
    align-items: flex-end;
    padding: 12px 8px 0;
  }
  .sk__modal {
    max-width: 100%;
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
  }
  .sk__modal form {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .sk__modalHead { flex: 0 0 auto; }
  .sk__modalBody {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .sk__modalFoot {
    flex: 0 0 auto;
    flex-direction: column-reverse;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    padding-bottom: calc(12px + var(--sk-safe-b));
  }
  .sk__modalFoot .sk__btn { width: 100%; justify-content: center; }

  /* Font input min 16px supaya Safari iOS tidak auto-zoom saat fokus */
  .sk__field input,
  .sk__field select { font-size: 16px; }
}

@media (max-width: 480px) {
  .sk__filters { grid-template-columns: 1fr; }
  .sk__actions { grid-template-columns: repeat(2, 1fr); }
}

/* ===== DARK MODE FULL ===== */
:global(.dark) .sk { background: transparent !important; }
/* BAR & CARDS (MOBILE) */
:global(.dark) .sk__bar { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 16px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 16px rgba(26, 115, 232, 0.15) !important; }
:global(.dark) .sk__group { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__groupHead { background: var(--n-surface) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__groupTitle { color: var(--n-ink) !important; }
:global(.dark) .sk__groupMeta { color: var(--n-muted) !important; }
/* TABLE */
:global(.dark) .sk__tableWrap { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__table thead th { background: rgba(255,255,255,0.05) !important; color: var(--n-muted) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__table tbody td { background: var(--n-card) !important; color: var(--n-ink) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.025) !important; }
:global(.dark) .sk__table tbody tr:hover td { background: rgba(79,142,247,0.06) !important; }
/* TOOLBAR */
:global(.dark) .sk__filters { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
:global(.dark) .sk__search { background: transparent !important; border: none !important; box-shadow: none !important; }
:global(.dark) .sk__search input[type="text"], :global(.dark) .sk__search input { height: 40px !important; background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 12px !important; color: #ffffff !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.2) !important; padding-left: 36px !important; }
:global(.dark) .sk__search i { color: #60a5fa !important; }
:global(.dark) .sk__filters select, :global(.dark) select { height: 40px !important; box-sizing: border-box !important; background-color: #000000 !important; background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjYgOSAxMiAxNSAxOCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==") !important; background-repeat: no-repeat !important; background-position: right 12px center !important; background-size: 16px 16px !important; padding-right: 36px !important; -webkit-appearance: none !important; appearance: none !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; color: #ffffff !important; }
/* BUTTONS */
:global(.dark) .sk__btn { background: #000000 !important; color: #ffffff !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.2) !important; }
:global(.dark) .sk__btn:hover { background: rgba(26, 115, 232, 0.15) !important; border-color: #3b82f6 !important; box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important; }
:global(.dark) .sk__btnGhost { background: #000000 !important; color: #ffffff !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.2) !important; }
:global(.dark) .sk__btnGhost:hover { background: rgba(26, 115, 232, 0.15) !important; border-color: #3b82f6 !important; }
:global(.dark) .sk__btnGenerate { background: rgba(26, 115, 232, 0.12) !important; color: #60a5fa !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; }
:global(.dark) .sk__btnPrimary { background: linear-gradient(135deg, #1d6bf3 0%, #3b82f6 100%) !important; color: #ffffff !important; border: 1.8px solid #3b82f6 !important; box-shadow: 0 0 14px rgba(29, 107, 243, 0.5) !important; }
/* EMPTY */
:global(.dark) .sk__empty { color: var(--n-muted) !important; }
/* CARD / MODAL */
:global(.dark) .sk__card { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__cardHead { background: var(--n-elevated) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__cardName { color: var(--n-ink) !important; }
:global(.dark) .sk__cardSub { color: var(--n-muted) !important; }
:global(.dark) .sk__k { color: var(--n-muted) !important; }
:global(.dark) .sk__v { color: var(--n-ink) !important; }
:global(.dark) .sk__iconBtn { background: rgba(26, 115, 232, 0.15) !important; border: 1.5px solid rgba(26, 115, 232, 0.6) !important; color: #60a5fa !important; }
:global(.dark) .sk__iconBtn:hover { background: #1a73e8 !important; border-color: #3b82f6 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(26, 115, 232, 0.5) !important; }
:global(.dark) .sk__iconBtn.danger { background: rgba(239, 68, 68, 0.15) !important; border: 1.5px solid rgba(239, 68, 68, 0.6) !important; color: #f87171 !important; }
:global(.dark) .sk__iconBtn.danger:hover { background: #ef4444 !important; border-color: #f87171 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(239, 68, 68, 0.5) !important; }
:global(.dark) .sk__modal { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__modalHead { background: var(--n-elevated) !important; border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__modalTitle h2 { color: var(--n-ink) !important; }
:global(.dark) .sk__modalTitle p { color: var(--n-muted) !important; }
:global(.dark) .sk__selectedStudent { background: rgba(79,142,247,0.08) !important; border-color: rgba(79,142,247,0.2) !important; color: var(--n-ink) !important; }
:global(.dark) .sk__selectedStudent i { color: var(--n-primary) !important; }
:global(.dark) .sk__close { background: var(--n-surface) !important; border-color: var(--n-border) !important; color: var(--n-muted) !important; }
:global(.dark) .sk__close:hover { background: var(--n-elevated) !important; color: var(--n-ink) !important; }
:global(.dark) .sk__modalBody { background: var(--n-card) !important; }
:global(.dark) .sk__modalFoot { background: var(--n-elevated) !important; border-top-color: var(--n-border) !important; }
:global(.dark) .sk__field label { color: var(--n-muted) !important; }
:global(.dark) .sk__field input, :global(.dark) .sk__field select { background: var(--n-surface) !important; border-color: var(--n-border) !important; color: var(--n-ink) !important; }
:global(.dark) .sk__hint { background: rgba(255,255,255,0.05) !important; border-color: var(--n-border) !important; color: var(--n-muted) !important; }
:global(.dark) .sk__hintWarn { background: rgba(245,158,11,0.08) !important; border-color: rgba(245,158,11,0.2) !important; color: #fbbf24 !important; }

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
/* ===== END DARK MODE FULL ===== */

/* ===== MODE TOGGLE STYLE ===== */
.sk__modeToggle {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
.sk__modeTab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.sk__modeTab.active {
  background: white;
  color: #0f172a;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}
:global(.dark) .sk__modeToggle {
  background: var(--n-surface) !important;
  border-color: var(--n-border) !important;
}
:global(.dark) .sk__modeTab {
  color: var(--n-muted) !important;
}
:global(.dark) .sk__modeTab.active {
  background: var(--n-card) !important;
  color: var(--n-ink) !important;
}

/* ===== SPLIT LAYOUT SIDEBAR ===== */
.sk__modalBody--split {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
  min-height: 340px;
}
.sk__modalForm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.sk__modalSidebar {
  border-left: 1px solid rgba(148, 163, 184, 0.16);
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.sk__sidebarTitle {
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(7, 22, 46, 0.88);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  padding-bottom: 8px;
}
.sk__sidebarList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}
.sk__sidebarItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  min-width: 0;
}
.sk__sidebarItemInfo {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sk__sidebarItemName {
  font-size: 0.78rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sk__sidebarItemSub {
  font-size: 0.72rem;
  color: #64748b;
  font-family: monospace;
}
.sk__sidebarItemRemove {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.sk__sidebarItemRemove:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}
.sk__sidebarPlaceholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 0.78rem;
  padding: 30px 10px;
  text-align: center;
  border: 1.5px dashed rgba(148, 163, 184, 0.25);
  border-radius: 12px;
  line-height: 1.4;
}
.sk__sidebarPlaceholder i {
  font-size: 1.3rem;
}

:global(.dark) .sk__modalSidebar {
  border-left-color: var(--n-border) !important;
}
:global(.dark) .sk__sidebarItem {
  background: var(--n-surface) !important;
  border-color: var(--n-border) !important;
}
:global(.dark) .sk__sidebarItemName {
  color: var(--n-ink) !important;
}
:global(.dark) .sk__sidebarPlaceholder {
  border-color: var(--n-border) !important;
  color: var(--n-muted) !important;
}

@media (max-width: 768px) {
  .sk__modalBody--split {
    grid-template-columns: 1fr;
    gap: 15px;
    min-height: auto;
  }
  .sk__modalSidebar {
    border-left: none;
    border-top: 1px solid rgba(148, 163, 184, 0.16);
    padding-left: 0;
    padding-top: 15px;
  }
}

`}</style>
    </div>
  )
}