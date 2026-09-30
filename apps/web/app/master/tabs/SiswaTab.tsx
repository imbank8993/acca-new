'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { exportToExcel } from '@/lib/excel-utils'
import { authFetch } from '@/lib/auth-fetch'
import JSZip from 'jszip'
import Pagination from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalViewFooter } from '@/components/ui/Modal'
import DatePicker from '@/components/ui/DatePicker'
import Swal from 'sweetalert2'
import ImportModal from '@/components/ui/ImportModal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { useMasterAccess } from '@/lib/use-master-access'
import { getPublicOrigin } from '@/lib/public-url'


interface RawSiswa {
  nisn: string;
  nama_lengkap: string;
  nik: string;
  gender: 'L' | 'P';
  tempat_lahir: string;
  tanggal_lahir: string;
  nama_ayah: string;
  nama_ibu: string;
  nomor_hp_ayah: string;
  nomor_hp_ibu: string;
  alamat: string;
  asal_sekolah: string;
  aktif: boolean;
}

/** Siswa aktif yang tidak tercatat di kelas reguler pada TA tertentu. */
interface KandidatNonaktif {
  nisn: string;
  nama_lengkap: string;
  gender: string | null;
  kelas_terakhir: string | null;
  tahun_ajaran_terakhir: string | null;
  /** null = tidak punya akun login sama sekali */
  akun_login: 'aktif' | 'nonaktif' | null;
}

type StatusFilter = 'aktif' | 'nonaktif' | 'semua'

async function safeFetchJson(url: string, init?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, init)
    const contentType = res.headers.get('content-type') || ''
    if (!res.ok || !contentType.includes('application/json')) {
      const text = await res.text()
      console.warn(`[safeFetchJson] ${url} returned ${res.status} non-JSON:`, text.substring(0, 150))
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` }
    }
    return await res.json()
  } catch (err: any) {
    console.error(`[safeFetchJson] ${url} error:`, err)
    return { ok: false, error: err.message || 'Network error' }
  }
}

async function fetchCardIdsInChunks(nisns: string[]): Promise<Record<string, any>> {
  if (!nisns || nisns.length === 0) return {}
  const CHUNK_SIZE = 50
  const resultMap: Record<string, any> = {}

  for (let i = 0; i < nisns.length; i += CHUNK_SIZE) {
    const chunk = nisns.slice(i, i + CHUNK_SIZE)
    const nisnList = chunk.join(',')
    const json = await safeFetchJson(`/api/master/students/card?batch=true&nisn_list=${encodeURIComponent(nisnList)}`)
    if (json?.ok && json?.data) {
      Object.assign(resultMap, json.data)
    }
  }
  return resultMap
}

const getInitials = (name?: string) => {
  if (!name) return 'S';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
};

export default function SiswaTab({ user }: { user?: any }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('aktif')
  const [allData, setAllData] = useState<RawSiswa[]>([])
  const [loading, setLoading] = useState(true)

  // Only ADMIN can perform actions, others are view-only
  // Gerbangnya mengikuti backend (MasterController.resolveFlags): Admin ATAU
  // pemegang halaman `master`. Sebelumnya di sini hanya role ADMIN, sehingga
  // operator yang sah diberi halaman ini melihat layar tanpa satu tombol pun.
  // `isAdmin` dipertahankan sebagai nama untuk JSX di bawah.
  // `canManage` = ADMIN atau yang ditunjuk di Hak Akses Fitur.
  // `isAdminRole` khusus aksi yang TIDAK pernah diberikan lewat layar itu.
  const { boleh, isAdmin: isAdminRole } = useMasterAccess()
  const isAdmin = boleh('siswa')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  // Computed paginated list
  const siswaList = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return allData.slice(start, end)
  }, [allData, currentPage, pageSize])

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemNisn, setDeleteItemNisn] = useState('')
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // QR Code State
  const [cardIdMap, setCardIdMap] = useState<Record<string, { card_id: string; card_name: string; is_active: boolean; issued_at: string }>>({});
  const [generatingQR, setGeneratingQR] = useState(false)
  const [downloadingQR, setDownloadingQR] = useState(false)
  const [selectedNisns, setSelectedNisns] = useState<Set<string>>(new Set());

  // QR Toolbar Modal
  const [showQRToolbarModal, setShowQRToolbarModal] = useState(false)

  // Menu "..." di toolbar (QR + status massal)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  // Bulk Status State (aktifkan/nonaktifkan massal dari centang tabel)
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // Modal "Nonaktif Massal" (audit per tahun ajaran)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [taOptions, setTaOptions] = useState<string[]>([])
  const [bulkTa, setBulkTa] = useState('')
  const [bulkChecking, setBulkChecking] = useState(false)
  const [bulkResult, setBulkResult] = useState<KandidatNonaktif[] | null>(null)
  const [bulkMeta, setBulkMeta] = useState<any>(null)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSertakanAkun, setBulkSertakanAkun] = useState(false)
  // 'nonaktif' = cari siswa aktif tanpa kelas reguler; 'aktif' = kebalikannya
  const [bulkMode, setBulkMode] = useState<'nonaktif' | 'aktif'>('nonaktif')

  // QR View Modal State
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrStudent, setQRStudent] = useState<RawSiswa | null>(null)
  const [qrCardId, setQrCardId] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  // Modal blur - sync with global blur context
  const { registerModal } = useModalBlur()

  // Import State
  const [showImportModal, setShowImportModal] = useState(false)

  // Sync modal blur with global context. `registerModal()` mengembalikan cleanup
  // yang otomatis dipanggil React sebelum efek ini jalan ulang, jadi transisi
  // antar state modal dalam satu batch selalu unregister-lalu-register bersih
  // (lihat catatan yang sama di app/tugas-siswa/view.tsx).
  useEffect(() => {
    const isOpen = showModal || showViewModal || showImportModal || showDeleteModal || showQRToolbarModal || showQRModal || showBulkModal
    if (isOpen) {
      return registerModal()
    }
  }, [showModal, showViewModal, showImportModal, showDeleteModal, showQRToolbarModal, showQRModal, showBulkModal, registerModal])


  // Tutup menu "..." saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!showActionMenu) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!actionMenuRef.current?.contains(e.target as Node)) setShowActionMenu(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowActionMenu(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showActionMenu])

  const [formData, setFormData] = useState<Partial<RawSiswa>>({
    gender: 'L',
    aktif: true
  })

  // Selected Data for View
  const [selectedSiswa, setSelectedSiswa] = useState<RawSiswa | null>(null)



  useEffect(() => {
    fetchSiswa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchSiswa()
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  // Ganti filter status: langsung fetch ulang (tanpa debounce) dan buang centang
  // lama supaya tidak ada NISN terpilih yang tidak terlihat di daftar baru.
  const isFirstStatusRun = useRef(true)
  useEffect(() => {
    if (isFirstStatusRun.current) {
      isFirstStatusRun.current = false
      return
    }
    setCurrentPage(1)
    setSelectedNisns(new Set())
    fetchSiswa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])


  const fetchSiswa = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10000',
        search: searchTerm
      })
      // API default hanya mengembalikan yang aktif; minta semua lalu saring di sini.
      if (statusFilter !== 'aktif') params.set('show_inactive', 'true')

      const res = await fetch(`/api/master/students?${params}`, { cache: 'no-store' })

      if (!res.ok) {
        const text = await res.text()
        console.error('API Error:', res.status, text)
        throw new Error(`Gagal mengambil data: ${res.statusText}`)
      }

      const json = await res.json()

      if (json.ok) {
        const rows: RawSiswa[] = statusFilter === 'nonaktif'
          ? (json.data || []).filter((s: RawSiswa) => s.aktif === false)
          : (json.data || [])

        setAllData(rows)
        setTotalItems(rows.length)

        // Fetch existing card IDs after loading students (in safe 50-item chunks)
        if (rows.length > 0) {
          const nisns = rows.map((s: RawSiswa) => s.nisn).filter(Boolean);
          const cardData = await fetchCardIdsInChunks(nisns);
          setCardIdMap(cardData);
        }
      }
    } catch (err) {
      console.error('Error fetching siswa:', err)
      setAllData([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = () => {
    if (!isAdmin) return;
    setFormData({ gender: 'L', aktif: true })
    setIsEditMode(false)
    setShowModal(true)
  }

  const handleEdit = (siswa: RawSiswa) => {
    if (!isAdmin) return;
    setFormData({ ...siswa })
    setIsEditMode(true)
    setShowModal(true)
  }

  const handleView = (siswa: RawSiswa) => {
    setSelectedSiswa(siswa)
    setShowViewModal(true)
  }

  // Toggle select siswa
  const toggleSelectSiswa = (nisn: string) => {
    setSelectedNisns(prev => {
      const next = new Set(prev);
      if (next.has(nisn)) next.delete(nisn);
      else next.add(nisn);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNisns.size === siswaList.length) {
      setSelectedNisns(new Set());
    } else {
      setSelectedNisns(new Set(siswaList.map(s => s.nisn)));
    }
  };

  // ===== Bulk status (aktif / non-aktif) =====

  const applyBulkStatus = async (nisns: string[], aktif: boolean, sertakanAkun = false) => {
    const res = await authFetch('/api/master/students/bulk-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nisns, aktif, sertakan_akun: sertakanAkun })
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || 'Gagal memperbarui status siswa')
    return {
      updated: json.data?.updated ?? nisns.length,
      akunUpdated: json.data?.akun_updated ?? 0
    }
  }

  const pesanHasil = (updated: number, akunUpdated: number, aktif: boolean) => {
    const inti = `${updated} siswa berhasil di${aktif ? 'aktifkan' : 'nonaktifkan'}.`
    return akunUpdated > 0
      ? `${inti} ${akunUpdated} akun login ikut di${aktif ? 'aktifkan' : 'nonaktifkan'}.`
      : inti
  }

  // Aksi massal dari centang di tabel — dipakai dua arah (nonaktifkan & aktifkan kembali)
  const handleBulkStatusSelected = async (aktif: boolean) => {
    if (!isAdmin || selectedNisns.size === 0) return
    const nisns = Array.from(selectedNisns)

    const confirm = await Swal.fire({
      title: `${aktif ? 'Aktifkan' : 'Nonaktifkan'} ${nisns.length} siswa?`,
      html: aktif
        ? 'Siswa terpilih akan kembali berstatus Aktif.'
        : 'Siswa terpilih akan berstatus Non-Aktif. Data tidak dihapus dan bisa diaktifkan lagi kapan saja.<br/><br/><small>Status ini <strong>tidak</strong> memblokir login — akun login diatur terpisah.</small>',
      icon: 'warning',
      input: 'checkbox',
      inputValue: 0,
      inputPlaceholder: `${aktif ? 'Aktifkan' : 'Nonaktifkan'} juga akun login-nya`,
      showCancelButton: true,
      confirmButtonText: aktif ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: aktif ? '#16a34a' : '#dc2626'
    })
    if (!confirm.isConfirmed) return

    setBulkUpdating(true)
    try {
      const { updated, akunUpdated } = await applyBulkStatus(nisns, aktif, confirm.value === 1)
      setSelectedNisns(new Set())
      await fetchSiswa()
      Swal.fire('Berhasil!', pesanHasil(updated, akunUpdated, aktif), 'success')
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Terjadi kesalahan.', 'error')
    } finally {
      setBulkUpdating(false)
    }
  }

  // Ambil daftar tahun ajaran saat modal nonaktif massal dibuka; default ke TA aktif.
  useEffect(() => {
    if (!showBulkModal) return
    let cancelled = false
      ; (async () => {
        try {
          const json = await safeFetchJson('/api/admin/tahun-ajaran', { cache: 'no-store' })
          if (cancelled || !json?.ok || !Array.isArray(json.data)) return
          const years = [...new Set(json.data.map((t: any) => String(t.tahun_ajaran)))].sort().reverse() as string[]
          // is_active bisa 2 baris (Ganjil + Genap) dengan tahun yang sama
          const active = [...new Set(
            json.data.filter((t: any) => t.is_active).map((t: any) => String(t.tahun_ajaran))
          )] as string[]
          setTaOptions(years)
          setBulkTa(prev => prev || active[0] || years[0] || '')
        } catch {
          /* biarkan dropdown kosong; user bisa tutup & coba lagi */
        }
      })()
    return () => { cancelled = true }
  }, [showBulkModal])

  const openBulkModal = (mode: 'nonaktif' | 'aktif') => {
    if (!isAdmin) return
    setBulkMode(mode)
    setBulkResult(null)
    setBulkMeta(null)
    setBulkSelected(new Set())
    setBulkSertakanAkun(false)
    setShowBulkModal(true)
  }

  const modeAktif = bulkMode === 'aktif'

  // Berapa siswa terpilih yang status akunnya berlawanan dengan target — angka
  // inilah yang menentukan apakah opsi akun login relevan ditampilkan.
  const bulkAkunRelevanTerpilih = useMemo(() => {
    if (!bulkResult) return 0
    const cari = modeAktif ? 'nonaktif' : 'aktif'
    return bulkResult.filter(r => r.akun_login === cari && bulkSelected.has(r.nisn)).length
  }, [bulkResult, bulkSelected, modeAktif])

  const runBulkCheck = async () => {
    if (!bulkTa) return
    setBulkChecking(true)
    setBulkResult(null)
    setBulkMeta(null)
    try {
      const res = await authFetch(
        `/api/master/students/bulk-status?tahun_ajaran=${encodeURIComponent(bulkTa)}&mode=${bulkMode}`
      )
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Gagal memeriksa data')
      const rows: KandidatNonaktif[] = json.data || []
      setBulkResult(rows)
      setBulkMeta(json.meta || null)
      // Khusus mode nonaktif: TA tanpa data kelas sama sekali akan menandai SEMUA
      // siswa sebagai kandidat — hampir pasti salah pilih tahun, jadi jangan
      // centang otomatis. Di mode aktif kasus itu justru menghasilkan 0 kandidat.
      const berbahaya = !modeAktif && json.meta?.tanpa_data_kelas
      setBulkSelected(berbahaya ? new Set() : new Set(rows.map(r => r.nisn)))
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Terjadi kesalahan saat memeriksa data.', 'error')
    } finally {
      setBulkChecking(false)
    }
  }

  const confirmBulkApply = async () => {
    const nisns = Array.from(bulkSelected)
    if (nisns.length === 0) return

    const alasan = modeAktif
      ? `Siswa berikut berstatus Non-Aktif padahal masih tercatat di kelas reguler TA <strong>${bulkTa}</strong>.<br/>Status dikembalikan menjadi Aktif.`
      : `Siswa berikut tidak tercatat di kelas reguler TA <strong>${bulkTa}</strong>.<br/>Status berubah menjadi Non-Aktif — data tidak dihapus dan bisa diaktifkan kembali.`

    const confirm = await Swal.fire({
      title: `${modeAktif ? 'Aktifkan' : 'Nonaktifkan'} ${nisns.length} siswa?`,
      html: alasan
        + (bulkSertakanAkun && bulkAkunRelevanTerpilih > 0
          ? `<br/><br/><strong>${bulkAkunRelevanTerpilih} akun login</strong> ikut di${modeAktif ? 'aktifkan' : 'nonaktifkan'}.`
          : ''),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: modeAktif ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: modeAktif ? '#16a34a' : '#dc2626'
    })
    if (!confirm.isConfirmed) return

    setBulkUpdating(true)
    try {
      const { updated, akunUpdated } = await applyBulkStatus(nisns, modeAktif, bulkSertakanAkun)
      setShowBulkModal(false)
      setBulkResult(null)
      setBulkSelected(new Set())
      await fetchSiswa()
      Swal.fire('Berhasil!', pesanHasil(updated, akunUpdated, modeAktif), 'success')
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Terjadi kesalahan.', 'error')
    } finally {
      setBulkUpdating(false)
    }
  }

  // Open QR View Modal
  const openQRModal = (siswa: RawSiswa) => {
    setQRStudent(siswa);
    setQrCardId(cardIdMap[siswa.nisn]?.card_id || null);
    setQrLoading(false);
    setShowQRModal(true);
  };

  // Generate card IDs (batch)
  const generateCardIds = async () => {
    const targetList = selectedNisns.size > 0 ? selectedNisns : new Set(allData.map(s => s.nisn));
    if (targetList.size === 0) return;
    setGeneratingQR(true);
    try {
      const nisns = Array.from(targetList);
      const cardData = await fetchCardIdsInChunks(nisns);
      if (Object.keys(cardData).length > 0) {
        setCardIdMap(prev => ({ ...prev, ...cardData }));
        const label = selectedNisns.size > 0 ? `${targetList.size} siswa terpilih` : `${targetList.size} semua siswa`;
        Swal.fire('Berhasil!', `Card ID berhasil di-generate untuk ${label}.`, 'success');
      } else {
        Swal.fire('Gagal', 'Gagal mengambil/generate data kartu.', 'error');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Terjadi kesalahan saat generate kartu.', 'error');
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return;
    setSaving(true)

    try {
      if (!formData.nisn || !formData.nama_lengkap) {
        alert('NISN dan Nama Lengkap wajib diisi')
        setSaving(false)
        return
      }

      await saveSiswa(formData as RawSiswa, isEditMode);

      setShowModal(false)
      fetchSiswa()
      alert(`Data siswa berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}`)

    } catch (err: any) {
      console.error('Error saving siswa:', err)
      alert(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  const saveSiswa = async (data: RawSiswa, isUpdate: boolean, upsert: boolean = false) => {
    const method = isUpdate ? 'PUT' : 'POST'
    let url = '/api/master/students'
    if (upsert) url += '?upsert=true'

    const json = await safeFetchJson(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!json?.ok) {
      throw new Error(json?.error || 'Gagal menyimpan data siswa')
    }
    return json;
  }

  const handleDelete = (nisn: string, nama: string) => {
    if (!isAdmin) return;
    setDeleteItemNisn(nisn);
    setDeleteItemName(nama);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteItemNisn) return;
    setDeleting(true);
    try {
      const json = await safeFetchJson(`/api/master/students?nisn=${deleteItemNisn}`, {
        method: 'DELETE',
      })

      if (json?.ok) {
        setShowDeleteModal(false);
        setDeleteItemNisn('');
        setDeleteItemName('');
        fetchSiswa()
        Swal.fire('Terhapus!', 'Data siswa berhasil dihapus.', 'success')
      } else {
        Swal.fire('Gagal', json?.error || 'Gagal menghapus data', 'error')
      }
    } catch (err: any) {
      console.error('Error deleting siswa:', err)
      Swal.fire('Gagal', err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Excel Functions
  const handleExport = () => {
    if (!isAdmin) return;
    const dataToExport = allData.map((s, index) => ({
      'No': index + 1,
      'NISN': s.nisn || '',
      'Nama Lengkap': s.nama_lengkap || '',
      'NIK': s.nik || '',
      'Jenis Kelamin': s.gender || '',
      'Tempat Lahir': s.tempat_lahir || '',
      'Tanggal Lahir': s.tanggal_lahir || '',
      'Nama Ayah': s.nama_ayah || '',
      'Nama Ibu': s.nama_ibu || '',
      'Nomor HP Ayah': s.nomor_hp_ayah || '',
      'Nomor HP Ibu': s.nomor_hp_ibu || '',
      'Alamat': s.alamat || '',
      'Asal Sekolah': s.asal_sekolah || '',
      'Status Aktif': s.aktif ? 'TRUE' : 'FALSE'
    }))
    exportToExcel(dataToExport, 'Data_Siswa_ACCA', 'Siswa');
  }

  const mapImportRow = (row: any) => {
    const getVal = (targetKeys: string[]) => {
      const normalizedTargets = targetKeys.map(k => k.toLowerCase().trim());
      const foundKey = Object.keys(row).find(k =>
        normalizedTargets.includes(k.toLowerCase().trim())
      );
      if (foundKey) return row[foundKey];
      return undefined;
    };

    const parseDate = (val: any) => {
      if (!val) return null;
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
      }
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
        const p = s.split(/[\/\-]/);
        return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      }
      return s;
    };

    const _noRaw = getVal(['No', 'no', 'Nomor']);
    const nisnRaw = getVal(['NISN', 'nisn', 'No Induk', 'Nomor Induk']);
    const namaRaw = getVal(['Nama Lengkap', 'nama', 'Nama']);

    // Validasi: NISN dan Nama Lengkap wajib diisi
    if (!nisnRaw || String(nisnRaw).trim() === '' || !namaRaw || String(namaRaw).trim() === '') {
      return null; // Tolak data jika NISN atau Nama Lengkap kosong
    }

    return {
      nisn: String(nisnRaw).replace(/[^0-9]/g, ''),
      nama_lengkap: String(namaRaw).trim(),
      nik: String(getVal(['NIK', 'nik']) || '').replace(/[^0-9]/g, ''),
      gender: (String(getVal(['Jenis Kelamin', 'Gender'])).toUpperCase().startsWith('P') ? 'P' : 'L'),
      tempat_lahir: getVal(['Tempat Lahir']),
      tanggal_lahir: parseDate(getVal(['Tanggal Lahir'])),
      nama_ayah: getVal(['Nama Ayah']),
      nama_ibu: getVal(['Nama Ibu']),
      aktif: String(getVal(['Status Aktif', 'Status'])).toUpperCase() !== 'FALSE' && String(getVal(['Status Aktif', 'Status'])).toUpperCase() !== 'NON-AKTIF'
    };
  }

  return (
    <div className="sk">
      {/* ===== Toolbar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari Nama / NISN..."
          label="Cari Siswa"
        />

        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as StatusFilter)}
          options={[
            { value: 'aktif', label: 'Status: Aktif' },
            { value: 'nonaktif', label: 'Status: Non-Aktif' },
            { value: 'semua', label: 'Status: Semua' }
          ]}
        />

        <FilterActions>
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
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="sk__menuItem sk__menuItemMobileOnly"
                      onClick={() => { setShowActionMenu(false); setShowImportModal(true) }}
                    >
                      <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel-fill" style={{ color: '#f97316' }} /></span>
                      <span className="sk__menuLabel">Import</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="sk__menuItem sk__menuItemMobileOnly"
                      onClick={() => { setShowActionMenu(false); handleExport() }}
                    >
                      <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#3b82f6' }} /></span>
                      <span className="sk__menuLabel">Export</span>
                    </button>

                    <div className="sk__menuSep sk__menuItemMobileOnly" />
                  </>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className="sk__menuItem"
                  onClick={() => { setShowActionMenu(false); setShowQRToolbarModal(true) }}
                >
                  <span className="sk__menuIcon"><i className="bi bi-qr-code isQR" /></span>
                  <span className="sk__menuLabel">QR & Cetak</span>
                </button>

                {isAdmin && (
                  <>
                    <div className="sk__menuSep" />
                    <button
                      type="button"
                      role="menuitem"
                      className="sk__menuItem"
                      onClick={() => { setShowActionMenu(false); openBulkModal('aktif') }}
                    >
                      <span className="sk__menuIcon"><i className="bi bi-person-check isOk" /></span>
                      <span className="sk__menuLabel">Aktifkan</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="sk__menuItem"
                      onClick={() => { setShowActionMenu(false); openBulkModal('nonaktif') }}
                    >
                      <span className="sk__menuIcon"><i className="bi bi-person-dash isDanger" /></span>
                      <span className="sk__menuLabel">Nonaktifkan</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                icon="import"
                className="sk__btnDesktopOnly"
              >
                Import
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                icon="export"
                className="sk__btnDesktopOnly"
              >
                Export
              </Button>
            </>
          )}
        </FilterActions>
      </FilterToolbar>

      {/* ===== Bar aksi massal ===== */}
      {isAdmin && selectedNisns.size > 0 && (
        <div className="sk__bulkBar">
          <div className="sk__bulkInfo">
            <i className="bi bi-check2-square" />
            <span><strong>{selectedNisns.size}</strong> siswa dipilih</span>
          </div>
          <div className="sk__bulkActions">
            <button
              className="sk__btn sk__btnAktifkan"
              onClick={() => handleBulkStatusSelected(true)}
              disabled={bulkUpdating}
            >
              <i className="bi bi-person-check" /> <span>Aktifkan</span>
            </button>
            <button
              className="sk__btn sk__btnNonaktif"
              onClick={() => handleBulkStatusSelected(false)}
              disabled={bulkUpdating}
            >
              <i className="bi bi-person-dash" /> <span>Nonaktifkan</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== Table (Desktop) ===== */}
      <div className="sk__tableWrap">
        <table className="sk__table">
          <thead>
            <tr>
              <th className="cNo">
                <input
                  type="checkbox"
                  className="ui-checkbox"
                  checked={selectedNisns.size === siswaList.length && siswaList.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Nama</th>
              <th className="cGender">L/P</th>
              <th>TTL</th>
              <th>Kontak Ortu</th>
              <th className="cCardId">Card ID</th>
              <th className="cStatus">Status</th>
              <th className="cAksi">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="sk__loadingCell">
                  <Spinner variant="buble" />
                </td>
              </tr>
            ) : siswaList.length === 0 ? (
              <tr>
                <td colSpan={8} className="sk__empty">
                  Tidak ada data siswa
                </td>
              </tr>
            ) : (
              siswaList.map((siswa) => (
                <tr key={siswa.nisn} className={selectedNisns.has(siswa.nisn) ? 'isSelected' : ''}>
                  <td className="cNo">
                    <input
                      type="checkbox"
                      className="ui-checkbox"
                      checked={selectedNisns.has(siswa.nisn)}
                      onChange={() => toggleSelectSiswa(siswa.nisn)}
                    />
                  </td>
                  <td className="cName">
                    <div className="sk__teacherPrimary">
                      <span className="sk__teacherName">{siswa.nama_lengkap}</span>
                      <span className="sk__teacherNip">{siswa.nisn}</span>
                    </div>
                  </td>
                  <td className="cGender">{siswa.gender}</td>
                  <td>
                    <div className="sk__cellSub">{siswa.tempat_lahir || '-'}</div>
                    <div className="sk__cellMeta">{siswa.tanggal_lahir || '-'}</div>
                  </td>
                  <td>
                    <div className="sk__cellSub">Ayah: {siswa.nama_ayah || '-'} ({siswa.nomor_hp_ayah || '-'})</div>
                    <div className="sk__cellMeta">Ibu: {siswa.nama_ibu || '-'} ({siswa.nomor_hp_ibu || '-'})</div>
                  </td>
                  <td className="cCardId">
                    {cardIdMap[siswa.nisn] ? (
                      <div className="sk__cardIdCell">
                        <span className="sk__cardIdBadge">{cardIdMap[siswa.nisn]?.card_id}</span>
                      </div>
                    ) : (
                      <span className="sk__cardIdEmpty">—</span>
                    )}
                  </td>
                  <td className="cStatus">
                    <span className={`sk__status ${siswa.aktif ? 'isOn' : 'isOff'}`}>
                      {siswa.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td>
                    <ActionGroup>
                      <ActionButton action="view" onClick={() => handleView(siswa)} title="Lihat Detail" />
                      {isAdmin && (
                        <ActionButton action="edit" onClick={() => handleEdit(siswa)} />
                      )}
                      {isAdmin && (
                        <ActionButton action="delete" onClick={() => handleDelete(siswa.nisn, siswa.nama_lengkap)} />
                      )}
                      {cardIdMap[siswa.nisn] && (
                        <button
                          className="btn-icon-soft"
                          onClick={() => openQRModal(siswa)}
                          data-tooltip="Lihat QR"
                        >
                          <i className="bi bi-qr-code" />
                        </button>
                      )}
                    </ActionGroup>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile Cards (Grouped Inset List) ===== */}
      <div className="sk__cards" aria-label="Daftar Siswa versi mobile">
        {loading ? (
          <div className="sk__cardLoading" style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
            <Spinner variant="buble" />
          </div>
        ) : siswaList.length === 0 ? (
          <div className="sk__cardEmpty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--n-ink, #0f172a)', marginBottom: 2 }}>Tidak ada data</div>
            <div style={{ fontSize: '0.80rem', color: 'var(--n-muted, #64748b)' }}>Coba ubah kata kunci pencarian atau filter</div>
          </div>
        ) : (
          siswaList.map((siswa, idx) => {
            const initials = getInitials(siswa.nama_lengkap);
            return (
              <div
                className="sk__cardCompact"
                key={`m-${siswa.nisn}-${idx}`}
                onClick={() => handleView(siswa)}
              >
                <div className="sk__avatar">
                  {(currentPage - 1) * pageSize + idx + 1}
                </div>
                <div className="sk__cardCompactLeft">
                  <div className="sk__cardName">{siswa.nama_lengkap || '-'}</div>
                  <div className="sk__cardNip">
                    <span>NISN: {siswa.nisn || '-'}</span>
                    {!siswa.aktif && (
                      <span className="sk__statusBadge inactive">Nonaktif</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB digerbangi CSS (.mui-fabWrap), bukan lebar layar dari JS: ambangnya
          harus sama persis dengan yang menyembunyikan tombol di toolbar. */}
      {/* Aksi utama tab: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
      {isAdmin && <DesktopFab label="Tambah Siswa" icon="plus-lg" onClick={handleAddNew} />}
      {isAdmin && <MobileFab label="Tambah Siswa" onClick={handleAddNew} />}

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

      {/* Modal di bawah ini dipakai bersama kedua cabang (mobile & desktop). */}

      {/* Form Modal (Add/Edit) */}
      {showModal && (
        <Modal
          size="lg"
          variant={isEditMode ? 'edit' : 'add'}
          onClose={() => setShowModal(false)}
          labelledBy="siswa-modal-title"
        >
          <ModalHeader
            id="siswa-modal-title"
            icon={isEditMode ? 'pencil-square' : 'plus-lg'}
            title={isEditMode ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody>
                <div className="sk__grid2">
                  <div className="sk__field sk__fieldFull">
                    <label>NISN <span className="required">*</span></label>
                    <input
                      type="text"
                      name="nisn"
                      required
                      value={formData.nisn || ''}
                      onChange={handleInputChange}
                      placeholder="Nomor Induk Siswa Nasional"
                      disabled={isEditMode}
                      className={isEditMode ? 'bg-gray-100' : ''}
                    />
                  </div>

                  <div className="sk__field sk__fieldFull">
                    <label>Nama Lengkap <span className="required">*</span></label>
                    <input type="text" name="nama_lengkap" required value={formData.nama_lengkap || ''} onChange={handleInputChange} placeholder="Nama Lengkap Siswa" />
                  </div>

                  <div className="sk__field">
                    <label>NIK</label>
                    <input type="text" name="nik" value={formData.nik || ''} onChange={handleInputChange} placeholder="Nomor Induk Kependudukan" />
                  </div>

                  <div className="sk__field">
                    <label>Jenis Kelamin</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange}>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>

                  <div className="sk__field">
                    <label>Asal Sekolah</label>
                    <input type="text" name="asal_sekolah" value={formData.asal_sekolah || ''} onChange={handleInputChange} placeholder="SMP/MTs..." />
                  </div>

                  <div className="sk__field">
                    <label>Tempat Lahir</label>
                    <input type="text" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleInputChange} />
                  </div>

                  <div className="sk__field">
                    <label>Tanggal Lahir</label>
                    <DatePicker value={formData.tanggal_lahir || ''} onChange={v => setFormData(prev => ({ ...prev, tanggal_lahir: v }))} />
                  </div>

                  <div className="sk__sectionTitle">Data Orang Tua</div>

                  <div className="sk__field">
                    <label>Nama Ayah</label>
                    <input type="text" name="nama_ayah" value={formData.nama_ayah || ''} onChange={handleInputChange} />
                  </div>

                  <div className="sk__field">
                    <label>No. HP Ayah</label>
                    <input type="text" name="nomor_hp_ayah" value={formData.nomor_hp_ayah || ''} onChange={handleInputChange} />
                  </div>

                  <div className="sk__field">
                    <label>Nama Ibu</label>
                    <input type="text" name="nama_ibu" value={formData.nama_ibu || ''} onChange={handleInputChange} />
                  </div>

                  <div className="sk__field">
                    <label>No. HP Ibu</label>
                    <input type="text" name="nomor_hp_ibu" value={formData.nomor_hp_ibu || ''} onChange={handleInputChange} />
                  </div>

                  <div className="sk__field sk__fieldFull">
                    <label>Alamat Lengkap</label>
                    <textarea name="alamat" rows={3} value={formData.alamat || ''} onChange={handleInputChange}></textarea>
                  </div>

                  {isEditMode && (
                    <div className="sk__field">
                      <label>Status</label>
                      <div className="mdl-switchWrap">
                        <label className="mdl-switch">
                          <input
                            type="checkbox"
                            checked={!!formData.aktif}
                            onChange={(e) => setFormData(prev => ({ ...prev, aktif: e.target.checked }))}
                          />
                          <span className="mdl-switch__track">
                            <span className="mdl-switch__thumb" />
                          </span>
                          <span className={`mdl-switch__badge ${formData.aktif ? 'isOn' : 'isOff'}`}>
                            {formData.aktif ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="cancel" onClick={() => setShowModal(false)} leftIcon={<i className="bi bi-x-lg" />}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                Simpan
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Standardized Import Modal */}
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
              onImportSuccess={() => {
                fetchSiswa();
                setShowImportModal(false);
              }}
              templateColumns={['No', 'NISN', 'Nama Lengkap', 'NIK', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Nama Ayah', 'Nama Ibu', 'Nomor HP Ayah', 'Nomor HP Ibu', 'Alamat', 'Asal Sekolah', 'Status Aktif']}
              templateName="Template_Siswa"
              apiEndpoint="/api/master/students?upsert=true"
              mapRowData={mapImportRow}
            />
          </div>
        </div>,
        document.body
      )}

      {/* View Detail Modal */}
      {showViewModal && selectedSiswa && (
        <Modal size="lg" variant="edit" onClose={() => setShowViewModal(false)} labelledBy="siswa-view-title">
          <ModalHeader
            id="siswa-view-title"
            icon="person-vcard"
            title="Detail Data Siswa"
            subtitle="Informasi lengkap dan riwayat data siswa"
            onClose={() => setShowViewModal(false)}
          />
          <ModalBody>
            {/* Urutan baris SENGAJA dibuat identik dengan form Edit di atas
                (sk__grid2/sk__fieldFull/sk__sectionTitle yang sama, field
                yang sama) — supaya transisi Detail → Edit terasa mulus. */}
            <div className="sk__grid2">
              <div className="sk__field sk__fieldFull">
                <label>NISN</label>
                <div className="sk__readInput font-mono">{selectedSiswa.nisn || '-'}</div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Nama Lengkap</label>
                <div className="sk__readInput">
                  {selectedSiswa.nama_lengkap || '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>NIK</label>
                <div className="sk__readInput font-mono">{selectedSiswa.nik || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Jenis Kelamin</label>
                <div className="sk__readInput">
                  {selectedSiswa.gender === 'L' ? 'Laki-laki (L)' : selectedSiswa.gender === 'P' ? 'Perempuan (P)' : '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Asal Sekolah</label>
                <div className="sk__readInput">{selectedSiswa.asal_sekolah || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Tempat Lahir</label>
                <div className="sk__readInput">{selectedSiswa.tempat_lahir || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Tanggal Lahir</label>
                <div className="sk__readInput">{selectedSiswa.tanggal_lahir || '-'}</div>
              </div>

              <div className="sk__sectionTitle">Data Orang Tua</div>

              <div className="sk__field">
                <label>Nama Ayah</label>
                <div className="sk__readInput">{selectedSiswa.nama_ayah || '-'}</div>
              </div>
              <div className="sk__field">
                <label>No. HP Ayah</label>
                <div className="sk__readInput">{selectedSiswa.nomor_hp_ayah || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Nama Ibu</label>
                <div className="sk__readInput">{selectedSiswa.nama_ibu || '-'}</div>
              </div>
              <div className="sk__field">
                <label>No. HP Ibu</label>
                <div className="sk__readInput">{selectedSiswa.nomor_hp_ibu || '-'}</div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Alamat Lengkap</label>
                <div className="sk__readInput" style={{ minHeight: '80px', alignItems: 'flex-start', paddingTop: '8px' }}>
                  {selectedSiswa.alamat || '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Status</label>
                <div className="sk__readInput">
                  <span className={`sk__status ${selectedSiswa.aktif ? 'isOn' : 'isOff'}`}>
                    {selectedSiswa.aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalViewFooter
            onClose={() => setShowViewModal(false)}
            onDelete={isAdmin ? () => { handleDelete(selectedSiswa.nisn, selectedSiswa.nama_lengkap); setShowViewModal(false) } : undefined}
            onEdit={isAdmin ? () => { const toEdit = selectedSiswa; setShowViewModal(false); handleEdit(toEdit) } : undefined}
          />
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => { setShowDeleteModal(false); setDeleteItemNisn(''); setDeleteItemName(''); }}
          labelledBy="siswa-delete-title"
        >
          <ModalHeader
            id="siswa-delete-title"
            icon="trash3"
            title={deleteItemName}
            onClose={() => { setShowDeleteModal(false); setDeleteItemNisn(''); setDeleteItemName(''); }}
          />
          <ModalFooter>
            <Button type="button" variant="cancel" onClick={() => { setShowDeleteModal(false); setDeleteItemNisn(''); setDeleteItemName(''); }} leftIcon={<i className="bi bi-x-lg" />}>
              Batal
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>
              Ya, Hapus
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Modal Status Massal — dipakai dua arah (nonaktifkan / aktifkan) */}
      {showBulkModal && (
        <Modal
          size="md"
          variant="edit"
          onClose={() => { if (!bulkUpdating) setShowBulkModal(false) }}
          labelledBy="siswa-bulk-title"
        >
          <ModalHeader
            id="siswa-bulk-title"
            icon={modeAktif ? 'person-check' : 'person-dash'}
            title={modeAktif ? 'Aktifkan Siswa Massal' : 'Nonaktifkan Siswa Massal'}
            onClose={bulkUpdating ? undefined : () => setShowBulkModal(false)}
          />
          <ModalBody>
              <p className="sk__bulkIntro">
                {modeAktif ? (
                  <>
                    Sistem memeriksa siswa berstatus <strong>Non-Aktif</strong> yang justru masih
                    tercatat di kelas reguler pada tahun ajaran terpilih — biasanya salah
                    dinonaktifkan, atau siswa yang kembali masuk.
                  </>
                ) : (
                  <>
                    Sistem memeriksa siswa berstatus <strong>Aktif</strong> yang tidak tercatat di
                    kelas reguler pada tahun ajaran terpilih — biasanya mereka yang sudah tamat
                    atau pindah.
                  </>
                )}
                {' '}Kelompok Peminatan/UTBK tidak dihitung sebagai kelas reguler.
              </p>

              <div className="sk__bulkPicker">
                <div className="sk__field" style={{ flex: '1 1 200px' }}>
                  <label>Tahun Ajaran</label>
                  <select
                    value={bulkTa}
                    onChange={(e) => { setBulkTa(e.target.value); setBulkResult(null); setBulkMeta(null) }}
                    disabled={bulkChecking || bulkUpdating}
                  >
                    {taOptions.length === 0 && <option value=""></option>}
                    {taOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <button
                  className="sk__btn sk__btnPrimary"
                  onClick={runBulkCheck}
                  disabled={!bulkTa || bulkChecking || bulkUpdating}
                  style={{ alignSelf: 'flex-end', height: '40px' }}
                >
                  <i className={`bi ${bulkChecking ? 'bi-arrow-clockwise animate-spin' : 'bi-search'}`} />
                  <span>{bulkChecking ? null : 'Periksa'}</span>
                </button>
              </div>

              {bulkResult !== null && (
                <>
                  <div className="sk__bulkSummary">
                    <div>
                      <span>{modeAktif ? 'Siswa non-aktif' : 'Siswa aktif'}</span>
                      <strong>{bulkMeta?.total_diperiksa ?? '-'}</strong>
                    </div>
                    <div>
                      <span>Punya kelas reguler</span>
                      <strong>{bulkMeta?.total_punya_kelas ?? '-'}</strong>
                    </div>
                    <div className={modeAktif ? '' : 'isWarn'}>
                      <span>{modeAktif ? 'Perlu diaktifkan' : 'Tanpa kelas reguler'}</span>
                      <strong>{bulkResult.length}</strong>
                    </div>
                    <div>
                      <span>{modeAktif ? 'Akun login terkunci' : 'Punya akun login aktif'}</span>
                      <strong>{bulkMeta?.total_akun_relevan ?? 0}</strong>
                    </div>
                  </div>

                  {!modeAktif && bulkMeta?.tanpa_data_kelas && (
                    <div className="sk__bulkWarn">
                      <i className="bi bi-exclamation-triangle-fill" />
                      <span>
                        Tidak ada satu pun data kelas untuk TA <strong>{bulkTa}</strong>, sehingga
                        seluruh siswa aktif ikut terdaftar di bawah. Kemungkinan besar tahun ajaran
                        yang dipilih salah atau pembagian kelasnya belum diisi. Centang dilepas
                        otomatis — periksa dulu sebelum melanjutkan.
                      </span>
                    </div>
                  )}

                  {bulkResult.length === 0 ? (
                    <div className="sk__bulkEmpty">
                      <i className="bi bi-check-circle" />
                      <span>
                        {modeAktif
                          ? `Tidak ada siswa non-aktif yang masih tercatat di kelas reguler TA ${bulkTa}. Tidak ada yang perlu diaktifkan.`
                          : `Semua siswa aktif sudah tercatat di kelas reguler TA ${bulkTa}. Tidak ada yang perlu dinonaktifkan.`}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="sk__bulkListHead">
                        <label className="sk__bulkCheckAll">
                          <input
                            type="checkbox"
                            className="ui-checkbox"
                            checked={bulkSelected.size === bulkResult.length && bulkResult.length > 0}
                            onChange={() => setBulkSelected(
                              bulkSelected.size === bulkResult.length
                                ? new Set()
                                : new Set(bulkResult.map(r => r.nisn))
                            )}
                          />
                          <span>Pilih semua</span>
                        </label>
                        <span className="sk__bulkCount">{bulkSelected.size} dari {bulkResult.length} dipilih</span>
                      </div>

                      <div className="sk__bulkList">
                        {bulkResult.map(k => (
                          <label className="sk__bulkItem" key={k.nisn}>
                            <input
                              type="checkbox"
                              className="ui-checkbox"
                              checked={bulkSelected.has(k.nisn)}
                              onChange={() => setBulkSelected(prev => {
                                const next = new Set(prev)
                                if (next.has(k.nisn)) next.delete(k.nisn)
                                else next.add(k.nisn)
                                return next
                              })}
                            />
                            <div className="sk__bulkItemMain">
                              <div className="sk__bulkItemName">
                                {k.nama_lengkap}
                                {k.akun_login === (modeAktif ? 'nonaktif' : 'aktif') && (
                                  <span
                                    className="sk__akunBadge"
                                    title={modeAktif ? 'Akun login-nya masih terkunci' : 'Punya akun login yang masih aktif'}
                                  >
                                    <i className={`bi ${modeAktif ? 'bi-lock' : 'bi-box-arrow-in-right'}`} />
                                    {modeAktif ? ' akun terkunci' : ' akun aktif'}
                                  </span>
                                )}
                              </div>
                              <div className="sk__bulkItemSub">
                                {k.nisn}
                                {k.kelas_terakhir
                                  ? ` · ${modeAktif ? 'terdaftar di' : 'terakhir'} ${k.kelas_terakhir} (${k.tahun_ajaran_terakhir})`
                                  : ' · belum pernah tercatat di kelas'}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {bulkAkunRelevanTerpilih > 0 && (
                        <label className="sk__akunOpsi">
                          <input
                            type="checkbox"
                            className="ui-checkbox"
                            checked={bulkSertakanAkun}
                            onChange={(e) => setBulkSertakanAkun(e.target.checked)}
                          />
                          <div>
                            <div className="sk__akunOpsiTitle">
                              {modeAktif ? 'Aktifkan juga akun login-nya' : 'Nonaktifkan juga akun login-nya'}
                            </div>
                            <div className="sk__akunOpsiDesc">
                              <strong>{bulkAkunRelevanTerpilih}</strong> dari {bulkSelected.size} siswa terpilih
                              {modeAktif
                                ? ' punya akun login yang masih terkunci, jadi mereka belum bisa masuk meski statusnya sudah Aktif.'
                                : ' masih punya akun yang bisa login.'}
                              {' '}Status di data siswa <strong>tidak</strong> menentukan bisa-tidaknya login —
                              gerbangnya kolom terpisah di tabel <code>users</code>.
                              {modeAktif ? ' Centang ini supaya aksesnya ikut dibuka.' : ' Centang ini kalau aksesnya memang harus dicabut (mis. sudah tamat).'}
                            </div>
                          </div>
                        </label>
                      )}
                    </>
                  )}
                </>
              )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="cancel" onClick={() => setShowBulkModal(false)} disabled={bulkUpdating} leftIcon={<i className="bi bi-x-lg" />}>
              Tutup
            </Button>
            <Button
              type="button"
              variant={modeAktif ? 'primary' : 'danger'}
              onClick={confirmBulkApply}
              isLoading={bulkUpdating}
              disabled={bulkSelected.size === 0}
              leftIcon={<i className={`bi ${modeAktif ? 'bi-person-check' : 'bi-person-dash'}`} />}
            >
              {`${modeAktif ? 'Aktifkan' : 'Nonaktifkan'} ${bulkSelected.size} Siswa Terpilih`}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* QR Toolbar Modal */}
      {showQRToolbarModal && typeof document !== 'undefined' && createPortal(
        <div
          className="qr__modalOverlay"
          onClick={() => setShowQRToolbarModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div className="qr__modal" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowQRToolbarModal(false)}
              className="qrm-close"
              aria-label="Tutup"
            >
              <i className="bi bi-x-lg" />
            </button>

            <div style={{ marginBottom: '16px' }}>
              <div className="qrm-headIcon">
                <i className="bi bi-qr-code" style={{ fontSize: '1.6rem' }}></i>
              </div>
              <h2 className="qrm-title">
                QR Code Siswa
              </h2>
              <p className="qrm-studentNisn" style={{ margin: 0 }}>
                {selectedNisns.size > 0 ? `${selectedNisns.size} siswa dipilih` : `${allData.length} siswa`}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={async () => {
                  const targetList = selectedNisns.size > 0 ? selectedNisns : new Set(allData.map(s => s.nisn));
                  if (targetList.size === 0) return;
                  setGeneratingQR(true);
                  try {
                    const nisns = Array.from(targetList);
                    const cardData = await fetchCardIdsInChunks(nisns);
                    if (Object.keys(cardData).length > 0) {
                      setCardIdMap(prev => ({ ...prev, ...cardData }));
                      const label = selectedNisns.size > 0 ? `${targetList.size} siswa terpilih` : `${targetList.size} semua siswa`;
                      Swal.fire('Berhasil!', `Card ID berhasil di-generate untuk ${label}.`, 'success');
                    } else {
                      Swal.fire('Gagal', 'Gagal generate card ID.', 'error');
                    }
                  } catch (e: any) {
                    Swal.fire('Error', e.message || 'Terjadi kesalahan.', 'error');
                  } finally {
                    setGeneratingQR(false);
                  }
                }}
                disabled={generatingQR || allData.length === 0}
                className="qrm-btnDownload"
                style={{
                  cursor: (generatingQR || allData.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (generatingQR || allData.length === 0) ? 0.5 : 1,
                }}
              >
                <i className={`bi ${generatingQR ? 'bi-arrow-clockwise animate-spin' : 'bi-qr-code'}`} style={{ fontSize: '1.1rem' }}></i>
                {generatingQR ? null : 'Generate QR Code'}
              </button>

              <button
                onClick={async () => {
                  const hasCard = Object.keys(cardIdMap);
                  if (hasCard.length === 0) {
                    Swal.fire('Belum Ada', 'Generate QR terlebih dahulu untuk mengunduh.', 'warning');
                    return;
                  }
                  const targetList = selectedNisns.size > 0
                    ? Array.from(selectedNisns).filter(n => cardIdMap[n])
                    : hasCard;
                  if (targetList.length === 0) {
                    Swal.fire('Pilih Siswa', 'Siswa yang dipilih belum punya Card ID. Generate dulu.', 'warning');
                    return;
                  }

                  setDownloadingQR(true);
                  Swal.fire({
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                  });

                  const zip = new JSZip();
                  const baseUrl = getPublicOrigin();
                  let count = 0;

                  for (const siswa of allData) {
                    const cardId = cardIdMap[siswa.nisn]?.card_id;
                    if (!cardId || !targetList.includes(siswa.nisn)) continue;
                    const url = `${baseUrl}/api/qrcode?data=${encodeURIComponent(`${baseUrl}/verify/siswa/${cardId}`)}`;
                    try {
                      const res = await fetch(url);
                      if (!res.ok) continue;
                      const blob = await res.blob();
                      const fileName = `${(siswa.nama_lengkap || 'Siswa').replace(/\s+/g, '_')}_${siswa.nisn}.png`;
                      zip.file(fileName, blob);
                      count++;
                    } catch (e) { /* skip */ }
                  }

                  if (count === 0) {
                    setDownloadingQR(false);
                    Swal.fire('Gagal', 'Tidak ada QR code yang bisa diunduh.', 'error');
                    return;
                  }

                  try {
                    const content = await zip.generateAsync({ type: 'blob' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(content);
                    link.download = `QR_Siswa_${new Date().toISOString().split('T')[0]}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                    Swal.fire('Selesai!', `${count} QR code berhasil dikemas dalam file ZIP.`, 'success');
                  } catch (e) {
                    Swal.fire('Error', 'Gagal membuat file ZIP.', 'error');
                  } finally {
                    setDownloadingQR(false);
                  }
                }}
                disabled={downloadingQR || Object.keys(cardIdMap).length === 0}
                className="qrm-btnCopy"
                style={{
                  cursor: (downloadingQR || Object.keys(cardIdMap).length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (downloadingQR || Object.keys(cardIdMap).length === 0) ? 0.5 : 1,
                }}
              >
                <i className={`bi ${downloadingQR ? 'bi-arrow-clockwise animate-spin' : 'bi-download'}`} style={{ fontSize: '1.1rem' }}></i>
                {downloadingQR ? null : `Download QR (${Object.keys(cardIdMap).length > 0
                  ? (selectedNisns.size > 0 ? `${Array.from(selectedNisns).filter(n => cardIdMap[n]).length} dipilih` : 'semua')
                  : '0'})`}
              </button>
            </div>

            {selectedNisns.size > 0 && (
              <p style={{ marginTop: '14px', marginBottom: 0, fontSize: '0.75rem' }} className="qrm-studentNisn">
                <i className="bi bi-info-circle" style={{ marginRight: '4px' }}></i>
                {selectedNisns.size} siswa dipilih — tanpa centang = semua siswa
              </p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* QR View Modal (Individual) */}
      {showQRModal && qrStudent && typeof document !== 'undefined' && createPortal(
        <div
          className="qr__modalOverlay"
          onClick={() => setShowQRModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div className="qr__modal" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowQRModal(false)}
              className="qrm-close"
              aria-label="Tutup"
            >
              <i className="bi bi-x-lg" />
            </button>

            <div style={{ marginBottom: '16px' }}>
              <div className="qrm-headIcon">
                <i className="bi bi-qr-code" style={{ fontSize: '1.6rem' }}></i>
              </div>
              <h2 className="qrm-title">
                QR Code Siswa
              </h2>
            </div>

            {/* Student Info Card */}
            <div className="qrm-card">
              <div className="qrm-studentName">
                {qrStudent.nama_lengkap}
              </div>
              <div className="qrm-studentNisn">
                NISN: {qrStudent.nisn}
              </div>
              {qrCardId && (
                <div className="qrm-cardId">
                  {qrCardId}
                </div>
              )}
              <div style={{ marginTop: '8px' }}>
                <span className={`sk__status ${qrStudent.aktif ? 'isOn' : 'isOff'}`}>
                  {qrStudent.aktif ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>

            {/* QR Code Image */}
            {qrCardId ? (
              <>
                <div className="qrm-codeWrap">
                  <img
                    src={`/api/qrcode?data=${encodeURIComponent(`${getPublicOrigin()}/verify/siswa/${qrCardId}`)}`}
                    alt={`QR Code untuk ${qrStudent.nama_lengkap}`}
                    width={180}
                    height={180}
                    style={{ display: 'block' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    className="qrm-btnDownload"
                    onClick={async () => {
                      const baseUrl = getPublicOrigin();
                      const url = `${baseUrl}/api/qrcode?data=${encodeURIComponent(`${baseUrl}/verify/siswa/${qrCardId}`)}`;
                      try {
                        const res = await fetch(url);
                        if (!res.ok) throw new Error('Gagal mengambil QR');
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `QR_Siswa_${qrStudent.nama_lengkap.replace(/\s+/g, '_')}_${qrStudent.nisn}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                      } catch (e: any) {
                        Swal.fire('Error', e.message || 'Gagal mengunduh QR.', 'error');
                      }
                    }}
                  >
                    <i className="bi bi-download" style={{ fontSize: '1rem' }}></i>
                    Unduh QR
                  </button>
                  <button
                    id="copyLinkBtn"
                    className="qrm-btnCopy"
                    onClick={() => {
                      const baseUrl = getPublicOrigin();
                      const url = `${baseUrl}/verify/siswa/${qrCardId}`;
                      navigator.clipboard.writeText(url);
                      const btn = document.getElementById('copyLinkBtn');
                      if (btn) {
                        const orig = btn.innerHTML;
                        btn.innerHTML = '<i class="bi bi-check2"></i> Tersalin!';
                        setTimeout(() => { if (btn) btn.innerHTML = orig; }, 2000);
                      }
                    }}
                  >
                    <i className="bi bi-link-45deg" style={{ fontSize: '1.2rem' }}></i>
                    Salin Link
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', color: '#f59e0b', display: 'block', marginBottom: '12px' }}></i>
                <p style={{ fontSize: '0.82rem', margin: '0 0 16px', lineHeight: 1.5 }} className="qrm-studentNisn">
                  Gagal memuat ID kartu siswa.
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
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

.sk {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: var(--sk-fs);
  padding: 0;
  background: transparent;
  border-radius: 0;
  padding-bottom: calc(16px + var(--sk-safe-b));
}

/* ========= LOADING SPINNER ========= */
.sk__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(148, 163, 184, 0.2);
  border-top-color: var(--n-primary);
  border-radius: 50%;
  animation: sk__spin 0.75s linear infinite;
  margin: 0 auto;
}

@keyframes sk__spin {
  to { transform: rotate(360deg); }
}

.sk__loadingCell {
  text-align: center !important;
  padding: 48px 16px !important;
  background: transparent !important;
}

.sk__cardLoading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
}

.sk__cardLoading .sk__cardBody {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ========= TOOLBAR ========= */
.sk__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.sk__filters {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px;
  border-radius: var(--sk-radius);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--sk-line);
  box-shadow: var(--sk-shadow2);
}

.sk__search {
  position: relative;
  flex: 1 1 280px;
  min-width: 180px;
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
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px 8px 30px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  font-weight: 500;
  color: rgba(15, 23, 42, 0.92);
  outline: none;
  font-size: var(--sk-fs-sm);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.sk__search input:focus {
  border-color: rgba(58, 166, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14);
}

.sk__filterGroup {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sk__selectWrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 140px;
}

.sk__filterSelect {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 36px 8px 14px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  color: rgba(15, 23, 42, 0.92);
  font-weight: 600;
  font-size: var(--sk-fs-sm);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.sk__selectIcon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(100, 116, 139, 0.9);
  pointer-events: none;
  font-size: 0.85rem;
}

.sk__filterSelect:focus {
  border-color: rgba(58, 166, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14);
}

.sk__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

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
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(58, 166, 255, 0.24);
  box-shadow: var(--sk-shadow2);
  transform: translateY(-1px);
}

.sk__btn:active {
  transform: translateY(0);
}

.sk__btnPrimary {
  background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
  border-color: rgba(0, 56, 168, 0.2);
  color: #fff;
  font-weight: 650;
}

.sk__btnPrimary:hover {
  background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
  color: #fff;
}

.sk__btnPrimary:active {
  background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
  opacity: 0.9;
  color: #fff;
}

.sk__btnExport {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(16, 185, 129, 0.28);
  color: #fff;
}

.sk__btnExport:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
  color: #fff;
}

.sk__btnExport:active {
  background: linear-gradient(135deg, rgba(16, 185, 129, 1), rgba(15, 42, 86, 1));
  color: #fff;
}

.sk__btnImport {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(245, 158, 11, 0.28);
  color: #fff;
}

.sk__btnImport:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.92), rgba(15, 42, 86, 0.86));
  color: #fff;
}

.sk__btnImport:active {
  background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(15, 42, 86, 1));
  color: #fff;
}

.sk__btnQR {
  background: linear-gradient(135deg, rgba(0, 56, 168, 0.9) 0%, rgba(194, 24, 91, 0.9) 100%);
  border-color: rgba(0, 56, 168, 0.3);
  color: #fff;
}

.sk__btnQR:hover {
  background: linear-gradient(135deg, rgba(0, 56, 168, 1) 0%, rgba(194, 24, 91, 1) 100%);
  color: #fff;
}

.sk__btnQR:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sk__btnDownloadQR {
  background: rgba(16, 185, 129, 0.9);
  border-color: rgba(16, 185, 129, 0.3);
  color: #fff;
}

.sk__btnDownloadQR:hover {
  background: rgba(16, 185, 129, 1);
  color: #fff;
}

.sk__btnDownloadQR:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sk__btnGhost {
  background: var(--n-card);
  color: rgba(7, 22, 46, 0.9);
  border: 1px solid var(--sk-line);
}

.sk__btnDanger {
  background: var(--n-card);
  color: rgba(220, 38, 38, 1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.sk__btnDanger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
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

.sk__teacherPrimary { display: flex; flex-direction: column; gap: 2px; }
.sk__teacherName { font-size: var(--sk-fs); font-weight: 600; color: var(--n-ink, #0f172a); }
.sk__teacherNip { font-size: var(--sk-fs-xs); font-weight: 500; color: var(--n-muted, #64748b); }

.cNo { width: 56px; text-align: center !important; vertical-align: middle !important; }
.cNisn { width: 150px; }
.cGender { width: 70px; }
.cStatus { width: 110px; }
.cAksi { width: 130px; text-align: right; }

.tCenter { text-align: center; }

.tMono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: var(--sk-fs-xs);
  font-weight: 400;
}

.tPlain { font-weight: 400; }

.tNameCell { display: flex; flex-direction: column; gap: 2px; }
.tNameCell__name { font-weight: 600; color: rgba(15, 23, 42, 0.92); }
.tNameCell__sub { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 0.72rem; color: rgba(100, 116, 139, 0.9); font-weight: 400; }

.text-sm { font-size: 0.875rem; }
.text-xs { font-size: 0.75rem; }
.text-gray-500 { color: rgba(107, 114, 128, 1); }

.sk__genderBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 900;
  border: 1px solid var(--sk-line);
  background: rgba(15, 42, 86, 0.08);
  color: rgba(7, 22, 46, 0.92);
  white-space: nowrap;
}

.sk__genderBadge.L {
  background: rgba(37, 99, 235, 0.10);
  border-color: rgba(37, 99, 235, 0.18);
  color: #1d4ed8;
}

.sk__genderBadge.P {
  background: rgba(236, 72, 153, 0.10);
  border-color: rgba(236, 72, 153, 0.18);
  color: #db2777;
}

.sk__status {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.78rem;
  border: 1px solid transparent;
  white-space: nowrap;
  text-transform: capitalize;
}

.sk__status::before { display: none !important; content: none !important; }

.sk__status.isOn {
  background: rgba(0, 56, 168, 0.08);
  border-color: rgba(0, 56, 168, 0.25);
  color: #3083FF;
}

.sk__status.isOff {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.16);
  color: rgba(220, 38, 38, 1);
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

.sk__iconBtnQR {
  color: rgba(0, 56, 168, 0.7);
  border-color: rgba(0, 56, 168, 0.2);
  background: rgba(0, 56, 168, 0.05);
}

.sk__iconBtnQR:hover {
  background: rgba(0, 56, 168, 0.12) !important;
  border-color: rgba(0, 56, 168, 0.4) !important;
  color: var(--n-primary) !important;
  box-shadow: var(--sk-shadow2);
  transform: translateY(-1px);
}

/* ========= MOBILE CARDS ========= */
.sk__cards {
  display: none;
  flex-direction: column;
  gap: 12px;
}

.sk__group {
  border: 1px solid rgba(15, 42, 86, 0.10);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06);
}

.sk__groupHead {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 12px 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
  border-bottom: 1px solid rgba(15, 42, 86, 0.10);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.sk__groupLeft {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.sk__groupTitle {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 800;
  color: rgba(11, 31, 58, 0.95);
}

.sk__groupMeta {
  font-size: 0.78rem;
  font-weight: 650;
  color: rgba(100, 116, 139, 0.92);
  white-space: nowrap;
}

.sk__groupList {
  padding: 12px 12px 2px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sk__card {
  background: var(--n-card);
  border: 1px solid rgba(15, 42, 86, 0.14);
  border-radius: 16px;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.10);
  overflow: hidden;
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
  font-size: 0.74rem;
  font-weight: 800;
  flex-shrink: 0;
  letter-spacing: 0.02em;
  background: #E0ECFF;
  color: #3083FF;
  border: 1px solid #E1E2E9;
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

.sk__genderBadge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.70rem;
  font-weight: 700;
  line-height: 1.2;
}

.sk__genderBadge.male {
  background: #EFF6FF;
  color: #1D4ED8;
}

.sk__genderBadge.female {
  background: #FDF2F8;
  color: #BE185D;
}

.sk__statusBadge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.2;
}

.sk__statusBadge.inactive {
  background: #F1F5F9;
  color: #64748B;
  border: 1px solid #E2E8F0;
}

.sk__cardHead {
  padding: 14px 14px 10px;
  background: linear-gradient(180deg, #ffffff, #fbfcff);
  border-bottom: 1px solid rgba(15, 42, 86, 0.08);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.sk__cardTitle {
  min-width: 0;
}

.sk__cardName {
  font-weight: 800;
  color: rgba(11, 31, 58, 0.95);
  font-size: 0.86rem;
  line-height: 1.25;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  word-break: break-word;
}

.sk__cardSub {
  margin-top: 4px;
  color: rgba(100, 116, 139, 0.95);
  font-weight: 600;
  font-size: 0.82rem;
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
  padding-top: 8px;
  border-top: 1px dashed rgba(15, 42, 86, 0.10);
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
  color: rgba(15, 42, 86, 0.70);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  flex: 0 0 112px;
}

.sk__v {
  flex: 1 1 auto;
  min-width: 0;
  text-align: right;
  color: rgba(15, 23, 42, 0.92);
  font-weight: 500;
  overflow-wrap: anywhere;
}

/* .sk__grid2 / .sk__fieldFull / .sk__sectionTitle sekarang di components/modal.css
   (dipakai bersama GuruTab/SiswaTab/KelasTab/WaktuTab/dll) — ubah di sana, bukan di sini. */

.sk__detailGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.sk__detailItem {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Pakai 1 / -1, BUKAN span 2: di grid 1 kolom (mobile) span 2 bikin browser
   menambah kolom implisit ke-2, isian modal jadi 2 kolom lagi. */
.sk__detailFull {
  grid-column: 1 / -1;
}

.sk__detailItem label {
  color: rgba(100, 116, 139, 0.9);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 650;
}

.sk__detailValue {
  font-size: 1rem;
  color: rgba(15, 23, 42, 0.92);
  font-weight: 600;
  line-height: 1.4;
}

.sk__detailValue.sk__mono {
  font-family: ui-monospace, monospace;
  color: rgba(11, 31, 58, 0.95);
  background: rgba(15, 42, 86, 0.08);
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.sk__detailValue.sk__large {
  font-size: 1.1rem;
  font-weight: 700;
}
@keyframes zoomInDelete { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* ========= RESPONSIVE ========= */
.sk__tableWrap { display: block; }
.sk__cards { display: none; }

@media (max-width: 768px) {
  .sk__search {
    margin-right: 0;
    width: 100%;
    flex: none;
  }

  .sk__tableWrap { display: none; }
  .sk__cards {
    display: flex !important;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: #ffffff;
    border: 1px solid #E1E2E9;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(17, 46, 89, 0.04);
  }

  .sk {
    padding-bottom: calc(0px + var(--sk-safe-b));
  }

  .sk__bar {
    padding: 0 4px;
    gap: 0;
  }

  .sk__filters {
    gap: 8px;
    flex-direction: column;
    width: 100%;
  }

  .sk__filterGroup, .sk__filterSelect {
    width: 100%;
  }

  .sk__actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
    margin-bottom: 12px;
    padding: 8px;
    border-radius: var(--sk-radius);
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid var(--sk-line);
    box-shadow: var(--sk-shadow2);
  }

  .sk__actions .sk__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 40px;
    padding: 9px 8px;
    border-radius: 12px;
  }

  .sk__actions .sk__btn span {
    font-size: 0.75rem;
  }

  .sk__detailGrid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .sk__detailFull {
    grid-column: span 1;
  }
}

@media (max-width: 420px) {
  .sk__filters {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .sk__search {
    grid-column: 1 / -1;
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk__btn,
  .sk__iconBtn {
    transition: none;
  }
  .sk__btn:hover,
  .sk__iconBtn:hover {
    transform: none;
  }
}
.sk__btnDesktopOnly {
  display: inline-flex !important;
}

@media (max-width: 768px) {
  .sk__btnDesktopOnly,
  :global(.ftb-actions) .sk__btnDesktopOnly,
  :global(.ftb-actions) button.sk__btnDesktopOnly {
    display: none !important;
  }
}

/* ========= MENU "..." TOOLBAR ========= */
@media (min-width: 640px) {
  .sk__menuWrap { display: none !important; }
}

.sk__menuWrap {
  position: relative;
  display: inline-flex;
}

@media (max-width: 639px) {
  .sk__menuWrap {
    display: inline-flex !important;
    width: auto !important;
    min-width: 0 !important;
  }
  .sk__menuWrap :global(.ui-btn),
  .sk__menuWrap .sk__btnMore {
    width: auto !important;
    flex: 0 0 auto !important;
    min-width: 0 !important;
  }
  /* Tombol "..." dilebarkan agar badge-nya lebih lega di mobile */
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

.sk__menuItem:hover {
  background: #E0ECFF;
  border-color: #3083FF;
  color: #112E59;
}

.sk__menuSep {
  height: 1px;
  background: #EBECF1;
  margin: 2px 4px;
}
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.15s ease;
}

.sk__menuItem:hover,
.sk__menuItem:active {
  background: #f8fafc;
  border-color: #3083FF;
  transform: translateY(-1px);
}

/* Kolom ikon: lebar tetap, konten di-center secara flex */
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

.sk__menuIcon i.isQR { color: #3083FF; }
.sk__menuIcon i.isDanger { color: #dc2626; }
.sk__menuIcon i.isOk { color: #16a34a; }

/* Label: teks rata kiri, mulai dari posisi yang sama di semua baris */
.sk__menuLabel {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--n-text, #0f172a);
  white-space: nowrap;
  flex: 1;
}

/* Menu dibuka ke KIRI di mobile. Sejak toolbar memakai actionsInline, tombol
   "…" duduk di tepi kanan layar — menu yang berjangkar left:0 (pengaturan
   lama, dari saat tombolnya masih di kiri barisnya sendiri) terdorong keluar
   layar dan isinya terpotong.

   Ambangnya 639px, disamakan dengan saat FilterToolbar beralih ke wujud mobile
   dan tombolnya berpindah ke kanan — bukan 560px seperti sebelumnya, karena di
   561–639px tombolnya sudah di kanan tapi menunya masih membuka ke kanan. */

/* Import & Export: di desktop ada tombolnya sendiri; di mobile masuk menu aksi.
   Sembunyikan di ≥640px, tampilkan di ≤639px. */
.sk__menuItemMobileOnly {
  display: none !important;
}

@media (max-width: 639px) {
  .sk__menuItemMobileOnly {
    display: flex !important;
  }
  .sk__menuSep.sk__menuItemMobileOnly {
    display: block !important;
  }
}

@media (max-width: 639px) {
  .sk__menu {
    left: auto;
    right: 0;
  }
}

/* ========= BULK STATUS ========= */
.sk__btnNonaktif {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(239, 68, 68, 0.28);
  color: #fff;
}

.sk__btnNonaktif:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(15, 42, 86, 0.92));
  color: #fff;
}

.sk__btnAktifkan {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(34, 197, 94, 0.28);
  color: #fff;
}

.sk__btnAktifkan:hover {
  background: linear-gradient(135deg, rgba(34, 197, 94, 1), rgba(15, 42, 86, 0.92));
  color: #fff;
}

.sk__btnNonaktif:disabled,
.sk__btnAktifkan:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.sk__bulkBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: var(--sk-radius);
  border: 1px solid rgba(58, 166, 255, 0.28);
  background: rgba(58, 166, 255, 0.07);
  box-shadow: var(--sk-shadow2);
}

.sk__bulkInfo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: var(--sk-fs-sm);
  color: rgba(15, 23, 42, 0.9);
}

.sk__bulkInfo > i {
  color: var(--n-primary);
  font-size: 1.05rem;
}

.sk__bulkLink {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--sk-fs-xs);
  font-weight: 650;
  color: var(--n-primary);
  text-decoration: underline;
}

.sk__bulkActions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sk__bulkIntro {
  margin: 0 0 14px;
  font-size: var(--sk-fs-sm);
  line-height: 1.55;
  color: rgba(71, 85, 105, 0.95);
}

.sk__bulkPicker {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.sk__bulkSummary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0;
}

.sk__bulkSummary > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--sk-line);
  background: rgba(248, 250, 252, 0.9);
}

.sk__bulkSummary span {
  font-size: 0.7rem;
  color: rgba(100, 116, 139, 0.95);
}

.sk__bulkSummary strong {
  font-size: 1.05rem;
  font-weight: 750;
  color: rgba(15, 23, 42, 0.92);
}

.sk__bulkSummary .isWarn {
  border-color: rgba(239, 68, 68, 0.28);
  background: rgba(239, 68, 68, 0.07);
}

.sk__bulkSummary .isWarn strong {
  color: rgba(220, 38, 38, 1);
}

.sk__bulkEmpty {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(34, 197, 94, 0.28);
  background: rgba(34, 197, 94, 0.07);
  font-size: var(--sk-fs-sm);
  color: rgba(21, 128, 61, 1);
  line-height: 1.5;
}

.sk__bulkEmpty > i {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.sk__bulkWarn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.07);
  font-size: var(--sk-fs-xs);
  line-height: 1.55;
  color: rgba(153, 27, 27, 1);
}

.sk__bulkWarn > i {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 1px;
  color: rgba(220, 38, 38, 1);
}

.sk__bulkListHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.sk__bulkCheckAll {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: var(--sk-fs-sm);
  font-weight: 600;
  color: rgba(15, 23, 42, 0.9);
}

.sk__bulkCount {
  font-size: var(--sk-fs-xs);
  color: rgba(100, 116, 139, 0.95);
}

.sk__bulkList {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--sk-line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
}

.sk__bulkItem {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.sk__bulkItem:last-child {
  border-bottom: none;
}

.sk__bulkItem:hover {
  background: rgba(58, 166, 255, 0.05);
}

.sk__bulkItem input {
  margin-top: 2px;
}

.sk__bulkItemMain {
  min-width: 0;
}

.sk__bulkItemName {
  font-size: var(--sk-fs-sm);
  font-weight: 600;
  color: rgba(15, 23, 42, 0.92);
}

.sk__bulkItemSub {
  font-size: 0.72rem;
  color: rgba(100, 116, 139, 0.95);
  margin-top: 1px;
}

.sk__akunBadge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 650;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: rgba(180, 83, 9, 1);
  vertical-align: middle;
}

.sk__akunBadge > i { font-size: 0.7rem; }

.sk__akunOpsi {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.32);
  background: rgba(245, 158, 11, 0.07);
  cursor: pointer;
}

.sk__akunOpsi input {
  margin-top: 2px;
}

.sk__akunOpsiTitle {
  font-size: var(--sk-fs-sm);
  font-weight: 700;
  color: rgba(15, 23, 42, 0.92);
}

.sk__akunOpsiDesc {
  margin-top: 3px;
  font-size: 0.72rem;
  line-height: 1.5;
  color: rgba(100, 116, 139, 0.95);
}

.sk__akunOpsiDesc code {
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(148, 163, 184, 0.18);
  font-size: 0.68rem;
}

@media (max-width: 720px) {
  .sk__bulkSummary { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 560px) {
  .sk__bulkSummary { grid-template-columns: 1fr; }
  .sk__bulkBar { flex-direction: column; align-items: stretch; }
  .sk__bulkActions > .sk__btn { flex: 1 1 auto; justify-content: center; }
}

/* ===== DARK MODE FULL ===== */
:global(.dark) .sk__bar { background: transparent !important; border: none !important; }
:global(.dark) .sk__tableWrap {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  border-radius: 18px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
  overflow: hidden !important;
  transition: all 0.2s ease !important;
}
:global(.dark) .sk__tableWrap:hover {
  border-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
}
:global(.dark) .sk__table { background: #0b1329 !important; color: #e2e8f0 !important; }
:global(.dark) .sk__table thead th {
  background: rgba(37, 99, 235, 0.15) !important;
  color: #94a3b8 !important;
  border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
  font-weight: 800 !important;
}
:global(.dark) .sk__table tbody td {
  background: #0b1329 !important;
  color: #e2e8f0 !important;
  border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
}
:global(.dark) .sk__table tbody tr:nth-child(even) td { background: #0b1329 !important; }
:global(.dark) .sk__table tbody tr:hover td { background: rgba(37, 99, 235, 0.08) !important; }

:global(.dark) .sk__search {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 10px rgba(26, 115, 232, 0.15) !important;
}
:global(.dark) .sk__filters,
:global(.dark) .sk__actions { background: transparent !important; border: none !important; }
:global(.dark) .sk__search input {
  background: #0b1329 !important;
  border: none !important;
  color: #ffffff !important;
  border-radius: 12px !important;
}
:global(.dark) .sk__search i { color: #94a3b8 !important; }

:global(.dark) .sk__filterGroup label { color: #94a3b8 !important; }
:global(.dark) .sk__selectWrap {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 10px rgba(26, 115, 232, 0.15) !important;
}
:global(.dark) select,
:global(.dark) .sk__filterGroup select,
:global(.dark) .sk__filterSelect {
  background: transparent !important;
  border: none !important;
  color: #ffffff !important;
  outline: none !important;
  box-shadow: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  padding: 8px 36px 8px 14px !important;
}
:global(.dark) .sk__selectIcon {
  color: #60a5fa !important;
  font-weight: 700 !important;
}
:global(.dark) select option,
:global(.dark) .sk__filterSelect option {
  background-color: #0b1329 !important;
  color: #ffffff !important;
}

:global(.dark) .sk__btn {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  color: #e2e8f0 !important;
  border-radius: 12px !important;
}
:global(.dark) .sk__btn:hover {
  background: rgba(26, 115, 232, 0.15) !important;
  border-color: #1a73e8 !important;
  color: #ffffff !important;
}

:global(.dark) .sk__btnImport {
  background: rgba(14, 165, 233, 0.15) !important;
  border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
  color: #38bdf8 !important;
}
:global(.dark) .sk__btnExport {
  background: rgba(79, 70, 229, 0.15) !important;
  border: 1.5px solid rgba(129, 140, 248, 0.5) !important;
  color: #818cf8 !important;
}
:global(.dark) .sk__btnPrimary {
  background: linear-gradient(135deg, #1d6bf3 0%, #3b82f6 100%) !important;
  border: 1.5px solid #3b82f6 !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(29, 107, 243, 0.5) !important;
}
:global(.dark) .sk__btnPrimary:hover {
  background: linear-gradient(135deg, #1557c0 0%, #1d6bf3 100%) !important;
  box-shadow: 0 0 20px rgba(29, 107, 243, 0.75) !important;
}
:global(.dark) input:disabled, :global(.dark) select:disabled, :global(.dark) textarea:disabled { background: rgba(255,255,255,0.04) !important; color: #94a3b8 !important; }
:global(.dark) .sk__btnGhost { background: #0b1329 !important; color: #e2e8f0 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
:global(.dark) .sk__hint { color: #94a3b8 !important; }
:global(.dark) .sk__formInfo { background: rgba(14, 165, 233, 0.15) !important; color: #38bdf8 !important; border: 1px solid rgba(56, 189, 248, 0.3) !important; }

/* Status Badges - Pure Blue Theme (No Green) */
:global(.dark) .sk__status { padding: 4px 10px !important; border-radius: 6px !important; font-size: 0.78rem !important; font-weight: 600 !important; text-transform: capitalize !important; letter-spacing: 0.03em !important; }
:global(.dark) .sk__status.isOn {
  background: rgba(14, 165, 233, 0.18) !important;
  border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
  color: #38bdf8 !important;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.25) !important;
}
:global(.dark) .sk__status.isOff {
  background: rgba(148, 163, 184, 0.12) !important;
  border: 1.5px solid rgba(148, 163, 184, 0.35) !important;
  color: #94a3b8 !important;
}
:global(.dark) .sk__badge { background: rgba(37, 99, 235, 0.15) !important; color: #60a5fa !important; }
:global(.dark) .sk__badgeIstirahat { background: rgba(244, 63, 94, 0.18) !important; border-color: rgba(251, 113, 133, 0.5) !important; color: #fb7185 !important; }
:global(.dark) .sk__badgeKBM { background: rgba(14, 165, 233, 0.18) !important; border-color: rgba(56, 189, 248, 0.5) !important; color: #38bdf8 !important; }
:global(.dark) .sk__genderBadge { color: #e8edf5 !important; }
:global(.dark) .sk__genderBadge.L { color: #38bdf8 !important; }
:global(.dark) .sk__genderBadge.P { color: #f472b6 !important; }
:global(.dark) .sk__cardIdBadge { background: rgba(37, 99, 235, 0.15) !important; color: #60a5fa !important; border: 1px solid rgba(96, 165, 250, 0.4) !important; }
:global(.dark) .sk__eduBadge { color: #60a5fa !important; }

:global(.dark) .sk__iconBtn {
  background: rgba(26, 115, 232, 0.12) !important;
  border: 1px solid rgba(26, 115, 232, 0.4) !important;
  color: #60a5fa !important;
}
:global(.dark) .sk__iconBtn:hover { background: #1a73e8 !important; color: #ffffff !important; }
:global(.dark) .sk__iconBtn.danger {
  background: rgba(244, 63, 94, 0.12) !important;
  border: 1px solid rgba(244, 63, 94, 0.4) !important;
  color: #fb7185 !important;
}
:global(.dark) .sk__iconBtn.danger:hover { background: #ef4444 !important; color: #ffffff !important; }

:global(.dark) .sk__group { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 14px !important; }
:global(.dark) .sk__groupHead { background: rgba(37, 99, 235, 0.15) !important; }
:global(.dark) .sk__groupTitle { color: #ffffff !important; }
:global(.dark) .sk__groupMeta { color: #94a3b8 !important; }

:global(.dark) .sk__card {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  border-radius: 14px !important;
  transition: all 0.2s ease !important;
}
:global(.dark) .sk__card:hover {
  border-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
}
:global(.dark) .sk__cardHead { background: rgba(37, 99, 235, 0.15) !important; }
:global(.dark) .sk__cardName { color: #ffffff !important; }
:global(.dark) .sk__cardSub { color: #94a3b8 !important; }

:global(.dark) .sk__k { color: #94a3b8 !important; }
:global(.dark) .sk__v { color: #ffffff !important; }

:global(.dark) .sk__btnActionMenu,
:global(.dark) .sk__btnMore {
  background: rgba(26, 115, 232, 0.16) !important;
  color: #60a5fa !important;
  border: 1.5px solid rgba(26, 115, 232, 0.6) !important;
  border-radius: 9999px !important;
}
:global(.dark) .sk__btnActionMenu:hover,
:global(.dark) .sk__btnActionMenu.isOpen,
:global(.dark) .sk__btnMore:hover,
:global(.dark) .sk__btnMore.isOpen {
  background: #1a73e8 !important;
  border-color: #60a5fa !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(26, 115, 232, 0.5) !important;
}

:global(.dark) .sk__menu {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7) !important;
}
:global(.dark) .sk__menuItem {
  background: #0f172a !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
}
:global(.dark) .sk__menuItem:hover,
:global(.dark) .sk__menuItem:active {
  background: #1e293b !important;
  border-color: #60a5fa !important;
}
:global(.dark) .sk__menuItemTitle {
  color: #ffffff !important;
}

:global(.dark) .sk__cards {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
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
  border-color: rgba(26, 115, 232, 0.5) !important;
}

:global(.dark) .sk__cardCompactLeft .sk__cardName {
  color: #ffffff !important;
}

:global(.dark) .sk__cardCompactLeft .sk__cardNip {
  color: #94a3b8 !important;
}

:global(.dark) .sk__statusBadge.inactive {
  background: rgba(148, 163, 184, 0.14) !important;
  color: #94a3b8 !important;
  border-color: rgba(148, 163, 184, 0.3) !important;
}

:global(.dark) .sk__muted, :global(.dark) .sk__empty { color: #94a3b8 !important; }
:global(.dark) .sk__loadingCell { background: transparent !important; }
:global(.dark) .tNameCell__name { color: #ffffff !important; font-weight: 700 !important; }
:global(.dark) .tNameCell__sub { color: #94a3b8 !important; }
:global(.dark) .text-gray-500, :global(.dark) .text-gray-600 { color: #94a3b8 !important; }
:global(.dark) .sk__detailItem label { color: #94a3b8 !important; }
:global(.dark) .sk__detailValue { color: #ffffff !important; }
:global(.dark) .sk__detailValue.sk__mono { color: #60a5fa !important; background: rgba(26, 115, 232, 0.12) !important; }
:global(.dark) .sk__detailValue.sk__large { color: #ffffff !important; }

/* ===== QR MODAL DARK MODE ===== */
  :global(.dark) .qr__modal {
    background: #0b1329 !important;
    border: 1px solid rgba(26, 115, 232, 0.35) !important;
  }
  :global(.dark) .sk__iconBtnQR {
    color: #60a5fa !important;
    border-color: rgba(26, 115, 232, 0.4) !important;
    background: rgba(26, 115, 232, 0.12) !important;
  }
  :global(.dark) .sk__btnQR { background: #1a73e8 !important; border-color: #3b82f6 !important; color: white !important; }
  :global(.dark) .sk__btnQR:hover { background: #1557b0 !important; }
  :global(.dark) .sk__btnQR:disabled { opacity: 0.4 !important; }
  :global(.dark) .sk__btnDownloadQR { background: rgba(14, 165, 233, 0.85) !important; border-color: rgba(14, 165, 233, 0.3) !important; color: white !important; }
  :global(.dark) .sk__btnDownloadQR:hover { background: #0284c7 !important; }
  :global(.dark) .sk__btnDownloadQR:disabled { opacity: 0.4 !important; }

/* ===== MENU "..." DARK MODE ===== */
:global(.dark) .sk__btnMore {
  background: rgba(26, 115, 232, 0.16) !important;
  border: 1.5px solid rgba(26, 115, 232, 0.6) !important;
  color: #60a5fa !important;
  border-radius: 12px !important;
}
:global(.dark) .sk__btnMore:hover, :global(.dark) .sk__btnMore.isOpen {
  background: #1a73e8 !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(26, 115, 232, 0.5) !important;
}
:global(.dark) .sk__menu {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  border-radius: 16px !important;
  box-shadow: 0 16px 40px rgba(0,0,0,0.8), 0 0 20px rgba(26,115,232,0.3) !important;
}
:global(.dark) .sk__menuItem:hover { background: rgba(26, 115, 232, 0.15) !important; }
:global(.dark) .sk__menuItemTitle { color: #ffffff !important; }
:global(.dark) .sk__menuItemDesc { color: #94a3b8 !important; }
:global(.dark) .sk__menuSep { background: rgba(59, 130, 246, 0.35) !important; }
:global(.dark) .sk__menuItem > i.isDanger { color: #fb7185 !important; }
:global(.dark) .sk__menuItem > i.isOk { color: #38bdf8 !important; }
:global(.dark) .sk__menuItem > i.isQR { color: #60a5fa !important; }

/* ===== BULK STATUS DARK MODE ===== */
:global(.dark) .sk__bulkBar { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
:global(.dark) .sk__bulkInfo { color: #ffffff !important; }
:global(.dark) .sk__bulkInfo > i, :global(.dark) .sk__bulkLink { color: #60a5fa !important; }
:global(.dark) .sk__btnNonaktif { background: rgba(244, 63, 94, 0.18) !important; border: 1.5px solid rgba(244, 63, 94, 0.5) !important; color: #fb7185 !important; }
:global(.dark) .sk__btnNonaktif:hover { background: #ef4444 !important; color: #ffffff !important; }
:global(.dark) .sk__btnAktifkan { background: #1a73e8 !important; border: 1.5px solid #3b82f6 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important; }
:global(.dark) .sk__btnAktifkan:hover { background: #1557b0 !important; }
:global(.dark) .sk__bulkIntro { color: var(--n-muted) !important; }
:global(.dark) .sk__bulkPicker { border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__bulkSummary > div { background: rgba(255,255,255,0.04) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__bulkSummary span { color: var(--n-muted) !important; }
:global(.dark) .sk__bulkSummary strong { color: var(--n-ink) !important; }
:global(.dark) .sk__bulkSummary .isWarn { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.3) !important; }
:global(.dark) .sk__bulkSummary .isWarn strong { color: #f87171 !important; }
:global(.dark) .sk__bulkEmpty { background: rgba(34,197,94,0.1) !important; border-color: rgba(34,197,94,0.3) !important; color: #4ade80 !important; }
:global(.dark) .sk__bulkWarn { background: rgba(239,68,68,0.12) !important; border-color: rgba(239,68,68,0.32) !important; color: #fca5a5 !important; }
:global(.dark) .sk__akunBadge { background: rgba(245,158,11,0.14) !important; border-color: rgba(245,158,11,0.34) !important; color: #fbbf24 !important; }
:global(.dark) .sk__akunOpsi { background: rgba(245,158,11,0.1) !important; border-color: rgba(245,158,11,0.34) !important; }
:global(.dark) .sk__akunOpsiTitle { color: var(--n-ink) !important; }
:global(.dark) .sk__akunOpsiDesc { color: var(--n-muted) !important; }
:global(.dark) .sk__akunOpsiDesc code { background: rgba(255,255,255,0.08) !important; }
:global(.dark) .sk__bulkWarn > i { color: #f87171 !important; }
:global(.dark) .sk__bulkCheckAll { color: var(--n-ink) !important; }
:global(.dark) .sk__bulkCount, :global(.dark) .sk__bulkItemSub { color: var(--n-muted) !important; }
:global(.dark) .sk__bulkList { background: var(--n-surface) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__bulkItem { border-bottom-color: var(--n-border) !important; }
:global(.dark) .sk__bulkItem:hover { background: rgba(79,142,247,0.08) !important; }
:global(.dark) .sk__bulkItemName { color: var(--n-ink) !important; }

/* ===== QR MODAL PROPORTIONAL & DARK MODE ===== */
        .qr__modal {
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 20px;
          padding: 24px;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 24px 60px rgba(2, 6, 23, 0.35);
          animation: qrModalIn 0.25s ease-out;
          position: relative;
          box-sizing: border-box;
        }

        :global(.dark) .qr__modal {
          background: #0b1329 !important;
          border: 1px solid rgba(26, 115, 232, 0.35) !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.95) !important;
        }

        .qrm-headIcon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: rgba(0, 56, 168, 0.08);
          border-radius: 14px;
          margin-bottom: 10px;
          color: var(--n-primary, #3083FF);
        }

        :global(.dark) .qrm-headIcon {
          background: rgba(26, 115, 232, 0.15) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.35) !important;
        }

        .qrm-title {
          margin: 0 0 4px;
          font-size: 1.1rem;
          font-weight: 750;
          color: rgba(7, 22, 46, 0.95);
        }

        :global(.dark) .qrm-title {
          background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: transparent !important;
        }

        .qrm-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(0, 0, 0, 0.06);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 50%;
          width: 34px;
          height: 34px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          color: #64748b;
          transition: all 0.15s ease;
        }

        :global(.dark) .qrm-close {
          background: #0b1329 !important;
          border-color: rgba(59, 130, 246, 0.35) !important;
          color: #94a3b8 !important;
        }

        :global(.dark) .qrm-close:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #f87171 !important;
        }

        .qrm-card {
          background: linear-gradient(135deg, rgba(0, 56, 168, 0.04), rgba(14, 165, 233, 0.04));
          border: 1px solid rgba(0, 56, 168, 0.12);
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 16px;
        }

        :global(.dark) .qrm-card {
          background: #0b1329 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          box-shadow: 0 0 12px rgba(26, 115, 232, 0.15) !important;
        }

        .qrm-studentName {
          font-size: 1.1rem;
          font-weight: 750;
          color: rgba(7, 22, 46, 0.95);
          margin-bottom: 4px;
          line-height: 1.3;
        }

        :global(.dark) .qrm-studentName {
          color: #ffffff !important;
        }

        .qrm-studentNisn {
          font-size: 0.8rem;
          color: #64748b;
          font-family: ui-monospace, monospace;
          letter-spacing: 0.05em;
        }

        :global(.dark) .qrm-studentNisn {
          color: #94a3b8 !important;
        }

        .qrm-cardId {
          font-size: 0.82rem;
          color: #3083FF;
          font-family: ui-monospace, monospace;
          letter-spacing: 0.05em;
          margin-top: 4px;
          font-weight: 700;
        }

        :global(.dark) .qrm-cardId {
          color: #60a5fa !important;
        }

        .qrm-codeWrap {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid rgba(0, 56, 168, 0.12);
          padding: 14px;
          display: inline-block;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(0, 56, 168, 0.08);
        }

        :global(.dark) .qrm-codeWrap {
          border-color: rgba(56, 189, 248, 0.5) !important;
          box-shadow: 0 0 20px rgba(26, 115, 232, 0.25) !important;
        }

        .qrm-btnDownload {
          width: 100%;
          padding: 11px;
          background: rgba(0, 56, 168, 0.06);
          border: 1.5px solid rgba(0, 56, 168, 0.18);
          border-radius: 12px;
          color: #3083FF;
          font-weight: 700;
          font-size: 0.84rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        :global(.dark) .qrm-btnDownload {
          background: rgba(26, 115, 232, 0.15) !important;
          border: 1.5px solid rgba(26, 115, 232, 0.6) !important;
          color: #38bdf8 !important;
        }

        :global(.dark) .qrm-btnDownload:hover {
          background: rgba(26, 115, 232, 0.25) !important;
          color: #ffffff !important;
        }

        .qrm-btnCopy {
          width: 100%;
          padding: 11px;
          background: #3083FF;
          border: 1.5px solid #3083FF;
          border-radius: 12px;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.84rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        :global(.dark) .qrm-btnCopy {
          background: #1a73e8 !important;
          border: 1.5px solid #3b82f6 !important;
          color: #ffffff !important;
          box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important;
        }

        :global(.dark) .qrm-btnCopy:hover {
          background: #1557b0 !important;
          border-color: #60a5fa !important;
        }

  /* ===== QR MODAL ANIMATION ===== */
  @keyframes qrModalIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`}</style>
    </div>
  )
}

