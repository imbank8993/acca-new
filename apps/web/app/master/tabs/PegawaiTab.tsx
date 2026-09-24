'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { exportToExcel } from '@/lib/excel-utils'
import Pagination from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import DatePicker from '@/components/ui/DatePicker'
import Swal from 'sweetalert2'
import ImportModal from '@/components/ui/ImportModal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalViewFooter } from '@/components/ui/Modal'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { JENIS_PEGAWAI_LABEL, type JenisPegawai } from '@/lib/jenis-pegawai'
import { useMasterAccess } from '@/lib/use-master-access'

interface RiwayatPendidikan {
  level: string;
  nama_sekolah: string;
  tahun_lulus: string;
}

interface Rekening {
  nama_bank: string;
  nomor: string;
  atas_nama: string;
  aktif: boolean;
}

interface Guru {
  /** Primary key baris. Dipakai untuk hapus; NIP bukan PK. */
  id?: string | number;
  nip: string;
  nama_lengkap: string;
  jenis_pegawai?: JenisPegawai;
  tempat_lahir: string;
  tanggal_lahir: string;
  golongan: string;
  pangkat: string;
  tmt_tugas: string;
  riwayat_pendidikan: RiwayatPendidikan[];
  alamat: string;
  no_hp?: string;
  aktif: boolean;
  rekening_1?: Rekening;
  rekening_2?: Rekening;
}

const PENDIDIKAN_LEVELS = ['SD', 'SMP', 'SMA', 'S1', 'S2', 'S3'];

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'. Nilai kosong jadi '-', format asing lewat apa adanya. */
const fmtTanggal = (v?: string) => {
  const s = String(v || '').trim();
  if (!s) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

/**
 * Isi tab Master Data > Guru dan Master Data > Tendik.
 *
 * Keduanya satu komponen karena datanya memang satu tabel (master_guru) yang
 * dibedakan kolom `jenis_pegawai` — lihat lib/jenis-pegawai.ts. Yang berbeda
 * hanya penyaringan dan label; menyalin 2000 baris ini jadi dua berkas berarti
 * setiap perbaikan harus dikerjakan dua kali.
 *
 * CSS-nya sengaja tetap di dalam komponen ini: `<style jsx>` tidak menjangkau
 * subkomponen, jadi ia harus berada di berkas yang merender markup-nya.
 */
export default function PegawaiTab({ user, jenis }: { user?: any; jenis: JenisPegawai }) {
  const isTendik = jenis === 'TENDIK'
  const label = JENIS_PEGAWAI_LABEL[jenis]                       // "Guru" / "Tendik"
  const labelLain = JENIS_PEGAWAI_LABEL[isTendik ? 'GURU' : 'TENDIK']
  const jenisLain: JenisPegawai = isTendik ? 'GURU' : 'TENDIK'

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [allData, setAllData] = useState<Guru[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Computed paginated list
  const filteredGuru = useMemo(() => {
    return allData.filter(g => {
      if (!statusFilter || statusFilter === 'semua') return true;
      return statusFilter === 'aktif' ? g.aktif : !g.aktif;
    });
  }, [allData, statusFilter]);

  /* Paginasi menghitung dari daftar yang SUDAH tersaring, bukan dari jumlah
     baris hasil fetch. Dulu totalnya diambil dari `allData`, sehingga memilih
     filter "Non-Aktif" tetap memunculkan lima halaman padahal isinya satu
     baris — dan halaman 2 ke atas tampil kosong tanpa penjelasan. `safePage`
     menjaga hal yang sama saat jumlah baris menyusut sementara nomor halaman
     masih tertinggal di angka lama. */
  const totalItems = filteredGuru.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const guruList = useMemo(() => {
    const start = (safePage - 1) * pageSize
    const end = start + pageSize
    return filteredGuru.slice(start, end)
  }, [filteredGuru, safePage, pageSize])

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedGuru, setSelectedGuru] = useState<Guru | null>(null)

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Pindah Guru <-> Tendik
  const [showPindahModal, setShowPindahModal] = useState(false)
  const [pindahTarget, setPindahTarget] = useState<Guru | null>(null)
  // null = ringkasan dampak masih dimuat; array kosong = tidak ada penugasan.
  const [pindahPenugasan, setPindahPenugasan] = useState<{ label: string; count: number }[] | null>(null)
  const [pindahing, setPindahing] = useState(false)

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

  const { registerModal } = useModalBlur()
  // useOverlayClose tidak lagi diperlukan: komponen Modal bersama sudah
  // menangani klik-di-luar (pakai mousedown, jadi seleksi teks yang berakhir
  // di luar panel tidak ikut menutup modal).

  // `registerModal()` mengembalikan cleanup yang otomatis dipanggil React
  // sebelum efek ini jalan ulang — transisi showViewModal→showModal dalam
  // satu batch (klik "Edit Data" di modal Detail) selalu unregister-lalu-
  // register bersih, tidak menumpuk counter blur seperti pola manual lama.
  useEffect(() => {
    if (showModal || showViewModal || showImportModal || showDeleteModal || showPindahModal) {
      return registerModal()
    }
  }, [showModal, showViewModal, showImportModal, showDeleteModal, showPindahModal, registerModal])

  const [formData, setFormData] = useState<Partial<Guru>>({
    nip: '',
    nama_lengkap: '',
    aktif: true,
    no_hp: '',
    riwayat_pendidikan: []
  })

  const [pendidikanState, setPendidikanState] = useState<{ [key: string]: { nama_sekolah: string, tahun_lulus: string } }>({})

  // Gerbangnya mengikuti backend (MasterController.resolveFlags): Admin ATAU
  // pemegang halaman `master`. Sebelumnya di sini hanya role ADMIN, sehingga
  // operator yang sah diberi halaman ini melihat layar tanpa satu tombol pun.
  // `isAdmin` dipertahankan sebagai nama untuk JSX di bawah.
  // `canManage` = ADMIN atau yang ditunjuk di Hak Akses Fitur.
  // `isAdminRole` khusus aksi yang TIDAK pernah diberikan lewat layar itu.
  const { boleh, isAdmin: isAdminRole } = useMasterAccess()
  const isAdmin = boleh('guru')

  /* Satu efek untuk pergantian tab DAN pencarian. Sebelumnya keduanya efek
     terpisah yang sama-sama memanggil fetchGuru saat mount, jadi setiap kali
     tab dibuka permintaannya berangkat dua kali. Jeda hanya dipasang saat ada
     kata kunci — membuka tab atau mengosongkan kotak cari tidak perlu menunggu
     setengah detik. */
  useEffect(() => {
    setCurrentPage(1)
    const timer = setTimeout(fetchGuru, searchTerm ? 500 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenis, searchTerm])

  /**
   * Halaman ini menyaring, mengurutkan, dan mengekspor di sisi klien, jadi
   * seluruh baris memang perlu ada di memori. Server membatasi 1000 baris per
   * permintaan (MasterService.list), karena itu sisanya diambil bertahap
   * berdasarkan `meta.total`. Versi lama menitipkan `limit=10000` yang
   * diam-diam dipotong server — begitu pegawai lewat 1000 orang, daftar,
   * pencarian, dan Export kehilangan baris tanpa tanda apa pun.
   */
  const fetchGuru = async () => {
    const PAGE_SIZE = 1000
    const MAX_PAGES = 20

    setLoading(true)
    try {
      const rows: Guru[] = []

      for (let page = 1; page <= MAX_PAGES; page++) {
        const params = new URLSearchParams({
          q: searchTerm,
          jenis,
          page: String(page),
          limit: String(PAGE_SIZE),
          show_inactive: 'true'
        })

        const res = await fetch(`/api/master/guru?${params}`, { cache: 'no-store' })
        const contentType = res.headers.get('content-type') || ''
        if (!res.ok || !contentType.includes('application/json')) {
          const text = await res.text()
          console.warn('[fetchGuru] HTTP error non-JSON:', res.status, text.substring(0, 150))
          setAllData([])
          return
        }

        const json = await res.json()
        if (!json.ok) {
          setAllData([])
          return
        }

        const batch: Guru[] = json.data || []
        rows.push(...batch)

        const total = Number(json.meta?.total ?? rows.length)
        if (batch.length === 0 || rows.length >= total) break
      }

      setAllData(rows)
    } catch (err) {
      console.error('Error fetching guru:', err)
      setAllData([])
    } finally {
      setLoading(false)
    }
  }

  const preparePendidikanState = (riwayat: RiwayatPendidikan[] = []) => {
    const state: any = {};
    PENDIDIKAN_LEVELS.forEach(level => {
      const existing = riwayat.find(r => r.level === level)
      state[level] = existing || { nama_sekolah: '', tahun_lulus: '' }
    })
    return state
  }

  const handleAddNew = () => {
    setFormData({ nip: '', nama_lengkap: '', aktif: true, no_hp: '', riwayat_pendidikan: [] })
    setPendidikanState(preparePendidikanState([]))
    setIsEditMode(false)
    setShowModal(true)
  }

  const handleEdit = (guru: Guru) => {
    // Convert flat rekening columns to nested objects for the form
    const flatGuru = guru as any
    const formGuru: Partial<Guru> = {
      ...guru,
      rekening_1: flatGuru.rekening_1_nama_bank ? {
        nama_bank: flatGuru.rekening_1_nama_bank,
        nomor: flatGuru.rekening_1_nomor,
        atas_nama: flatGuru.rekening_1_atas_nama,
        aktif: flatGuru.rekening_1_aktif ?? true,
      } : undefined,
      rekening_2: flatGuru.rekening_2_nama_bank ? {
        nama_bank: flatGuru.rekening_2_nama_bank,
        nomor: flatGuru.rekening_2_nomor,
        atas_nama: flatGuru.rekening_2_atas_nama,
        aktif: flatGuru.rekening_2_aktif ?? true,
      } : undefined,
    }
    setFormData(formGuru)
    const riwayat = Array.isArray(guru.riwayat_pendidikan) ? guru.riwayat_pendidikan : []
    setPendidikanState(preparePendidikanState(riwayat))
    setIsEditMode(true)
    setShowModal(true)
  }

  const handleView = (guru: Guru) => {
    const flatGuru = guru as any
    const mappedGuru: Guru = {
      ...guru,
      rekening_1: flatGuru.rekening_1_nama_bank ? {
        nama_bank: flatGuru.rekening_1_nama_bank,
        nomor: flatGuru.rekening_1_nomor,
        atas_nama: flatGuru.rekening_1_atas_nama,
        aktif: flatGuru.rekening_1_aktif ?? true,
      } : undefined,
      rekening_2: flatGuru.rekening_2_nama_bank ? {
        nama_bank: flatGuru.rekening_2_nama_bank,
        nomor: flatGuru.rekening_2_nomor,
        atas_nama: flatGuru.rekening_2_atas_nama,
        aktif: flatGuru.rekening_2_aktif ?? true,
      } : undefined,
    }
    setSelectedGuru(mappedGuru)
    setShowViewModal(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name.startsWith('rekening_1_')) {
      const field = name.replace('rekening_1_', '') as keyof Rekening
      setFormData(prev => ({ ...prev, rekening_1: { ...(prev.rekening_1 || { nama_bank: '', nomor: '', atas_nama: '', aktif: true }), [field]: value } }))
    } else if (name.startsWith('rekening_2_')) {
      const field = name.replace('rekening_2_', '') as keyof Rekening
      setFormData(prev => ({ ...prev, rekening_2: { ...(prev.rekening_2 || { nama_bank: '', nomor: '', atas_nama: '', aktif: true }), [field]: value } }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handlePendidikanChange = (level: string, field: 'nama_sekolah' | 'tahun_lulus', value: string) => {
    setPendidikanState(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        [field]: value
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const consolidatedPendidikan: RiwayatPendidikan[] = [];
      PENDIDIKAN_LEVELS.forEach(level => {
        const p = pendidikanState[level];
        if (p && (p.nama_sekolah || p.tahun_lulus)) {
          consolidatedPendidikan.push({
            level,
            nama_sekolah: p.nama_sekolah,
            tahun_lulus: p.tahun_lulus
          })
        }
      });

      const payload: any = {
        ...formData,
        riwayat_pendidikan: consolidatedPendidikan,
        rekening_1_nama_bank: formData.rekening_1?.nama_bank,
        rekening_1_nomor: formData.rekening_1?.nomor,
        rekening_1_atas_nama: formData.rekening_1?.atas_nama,
        rekening_1_aktif: formData.rekening_1?.aktif,
        rekening_2_nama_bank: formData.rekening_2?.nama_bank,
        rekening_2_nomor: formData.rekening_2?.nomor,
        rekening_2_atas_nama: formData.rekening_2?.atas_nama,
        rekening_2_aktif: formData.rekening_2?.aktif,
      }
      delete payload.rekening_1;
      delete payload.rekening_2;

      await saveGuru(payload as Guru, isEditMode);
      setShowModal(false)
      fetchGuru()
      alert(`Data ${label.toLowerCase()} berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}`)

    } catch (err: any) {
      console.error('Error saving pegawai:', err)
      alert(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  const saveGuru = async (data: Guru, isUpdate: boolean, upsert: boolean = false) => {
    if (!data.nip || !data.nama_lengkap) {
      throw new Error('NIP dan Nama Lengkap wajib diisi')
    }

    const method = isUpdate ? 'PUT' : 'POST'
    let url = '/api/master/guru'
    if (upsert) url += '?upsert=true'

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      // Tab yang aktif menentukan jenis baris baru. Pada PUT field ini diabaikan
      // server: `jenis_pegawai` terdaftar di `protectedFields` (master.config.ts)
      // sehingga dibuang dari payload update. Perubahan jenis hanya lewat tombol
      // Pindah, yang khusus Admin dan menampilkan dampak penugasannya lebih dulu.
      // (Sebelumnya komentar ini menjanjikan hal yang sama, tapi servernya tetap
      // menulis field tersebut — gerbang Admin pada Pindah bisa dilewati PUT biasa.)
      body: JSON.stringify({ ...data, jenis_pegawai: jenis })
    })

    const json = await res.json()
    if (!json.ok) {
      throw new Error(json.error)
    }
    return json;
  }

  const handlePindah = async (pegawai: Guru) => {
    if (!isAdminRole) return

    setPindahTarget(pegawai)
    setPindahPenugasan(null)
    setShowPindahModal(true)

    // Ringkasan dampak dimuat setelah modal tampil supaya tombolnya terasa
    // langsung merespons; tombol konfirmasi dikunci sampai hasilnya tiba.
    try {
      const res = await fetch(`/api/master/guru/pindah?nip=${encodeURIComponent(pegawai.nip)}`, { cache: 'no-store' })
      const json = await res.json()
      setPindahPenugasan(json.ok ? (json.data?.penugasan || []) : [])
    } catch {
      setPindahPenugasan([])
    }
  }

  const confirmPindah = async () => {
    if (!pindahTarget) return
    setPindahing(true)
    try {
      const res = await fetch('/api/master/guru/pindah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip: pindahTarget.nip, tujuan: jenisLain })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)

      setShowPindahModal(false)
      setPindahTarget(null)
      fetchGuru()
      Swal.fire('Berhasil Dipindahkan', json.message, 'success')
    } catch (err: any) {
      Swal.fire('Gagal', err.message || 'Terjadi kesalahan saat memindahkan', 'error')
    } finally {
      setPindahing(false)
    }
  }

  /**
   * `id` di sini adalah primary key baris, bukan NIP. Dulu yang dikirim NIP,
   * lalu backend meng-cast-nya jadi primary key: NIP non-numerik ('G-01')
   * bikin 500, NIP numerik menunjuk baris lain atau tak ada sama sekali —
   * hapus praktis tidak pernah mengenai orang yang dimaksud.
   */
  const handleDelete = (id: string | number | undefined, nip: string, name: string) => {
    setDeleteItemId(id ?? nip)
    setDeleteItemName(name)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteItemId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/master/guru?id=${encodeURIComponent(String(deleteItemId))}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        setShowDeleteModal(false)
        setDeleteItemId(null)
        setDeleteItemName('')
        fetchGuru()
        Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success')
      } else {
        Swal.fire('Gagal', json.error, 'error')
      }
    } catch (err) {
      console.error(err)
      Swal.fire('Gagal', 'Terjadi kesalahan', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    if (!isAdmin) return;
    const dataToExport = allData.map((g, index) => {
      const base: any = {
        'No': index + 1,
        'NIP': g.nip || '',
        'Nama Lengkap': g.nama_lengkap || '',
        'Tempat Lahir': g.tempat_lahir || '',
        'Tanggal Lahir': g.tanggal_lahir || '',
        'Golongan': g.golongan || '',
        'Pangkat': g.pangkat || '',
        'TMT Tugas': g.tmt_tugas || '',
        'Alamat': g.alamat || '',
        'No HP': g.no_hp || '',
      };

      const riwayat = g.riwayat_pendidikan && Array.isArray(g.riwayat_pendidikan) ? g.riwayat_pendidikan : [];
      PENDIDIKAN_LEVELS.forEach(level => {
        const edu = riwayat.find(r => r.level === level);
        base[level] = edu ? edu.nama_sekolah : '';
        base[`Tahun ${level}`] = edu ? edu.tahun_lulus : '';
      });

      base['Status Aktif'] = g.aktif ? 'TRUE' : 'FALSE';
      return base;
    });

    exportToExcel(dataToExport, `Data_${label}_ACCA`, label);
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

    const idRaw = getVal(['NIP', 'nip', 'ID/NIP', 'ID Guru']);
    const namaRaw = getVal(['Nama Lengkap', 'nama_lengkap']);

    if (!idRaw || !namaRaw) return null;

    const parseDate = (val: any) => {
      if (!val) return null;
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
      }
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      // Urutan Indonesia: dd/mm/yyyy. Dulu bagian pertama diperlakukan sebagai
      // bulan (urutan AS), jadi 05/03/1986 (5 Maret) masuk sebagai 3 Mei.
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split(/[\/\-]/);
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      return s;
    };

    let eduList: RiwayatPendidikan[] = [];
    for (const level of PENDIDIKAN_LEVELS) {
      const sekolahRaw = getVal([level, level.toLowerCase()]);
      const tahunRaw = getVal([`Tahun ${level}`, `tahun_${level.toLowerCase()}`]);

      if (sekolahRaw) {
        eduList.push({
          level: level,
          nama_sekolah: String(sekolahRaw),
          tahun_lulus: String(tahunRaw || '')
        });
      }
    }

    return {
      nip: String(idRaw).trim(),
      nama_lengkap: String(namaRaw).trim(),
      // Berkas impor tidak punya kolom jenis; barisnya masuk ke tab yang sedang dibuka.
      jenis_pegawai: jenis,
      tempat_lahir: getVal(['Tempat Lahir', 'tempat_lahir']),
      tanggal_lahir: parseDate(getVal(['Tanggal Lahir', 'tanggal_lahir'])),
      golongan: getVal(['Golongan', 'golongan']),
      pangkat: getVal(['Pangkat', 'pangkat']),
      tmt_tugas: parseDate(getVal(['TMT Tugas', 'tmt_tugas'])),
      alamat: getVal(['Alamat', 'alamat']),
      no_hp: getVal(['No HP', 'no_hp']),
      aktif: String(getVal(['Status Aktif', 'aktif', 'Status'])).toUpperCase() !== 'FALSE' && String(getVal(['Status Aktif', 'aktif', 'Status'])).toUpperCase() !== 'NON-AKTIF',
      riwayat_pendidikan: eduList
    };
  }

  // Group for mobile: by status aktif
  const groupedMobile = useMemo(() => {
    const map = new Map<string, Guru[]>()
      ; (guruList || []).forEach((it) => {
        const key = it.aktif ? 'Aktif' : 'Non-Aktif'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(it)
      })
    const entries = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0], 'id'))
    entries.forEach(([k, arr]) => {
      arr.sort((x, y) => {
        const nx = String(x.nama_lengkap || '').toLowerCase()
        const ny = String(y.nama_lengkap || '').toLowerCase()
        if (nx !== ny) return nx.localeCompare(ny, 'id')
        return String(x.nip || '').localeCompare(String(y.nip || ''), 'id')
      })
    })
    return entries
  }, [guruList])

  return (
    <div className="sk">
      {/* ===== Toolbar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={`Cari Nama ${label} / NIP...`}
          label={`Cari ${label}`}
        />

        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}
          options={[
            { value: 'semua', label: 'Semua Status' },
            { value: 'aktif', label: 'Aktif' },
            { value: 'nonaktif', label: 'Non-Aktif' }
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

      {/* ===== Table (Desktop/Tablet) ===== */}
      <div className="sk__tableWrap">
        <table className="sk__table">
          <thead>
            <tr>
              <th className="cNo">No</th>
              <th>Nama</th>
              <th>Pangkat/Gol</th>
              <th className="cTmt">TMT Tugas</th>
              <th className="cEdu">Pendidikan</th>
              <th className="cStatus">Status</th>
              <th className="cAksi">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="sk__loadingCell">
                  <Spinner variant="trace" />
                </td>
              </tr>
            ) : guruList.length === 0 ? (
              <tr>
                <td colSpan={7} className="sk__empty sk__muted">
                  Tidak ada data {label.toLowerCase()}.
                </td>
              </tr>
            ) : (
              guruList.map((guru, index) => (
                <tr key={guru.nip}>
                  <td className="tCenter">{(safePage - 1) * pageSize + index + 1}</td>
                  <td className="tNameCell">
                    <div className="tNameCell__name">{guru.nama_lengkap}</div>
                    <div className="tNameCell__sub">{guru.nip}</div>
                  </td>
                  <td>
                    <div className="text-sm">{guru.pangkat || '-'}</div>
                    <div className="text-xs text-gray-500">{guru.golongan}</div>
                  </td>
                  <td className="text-sm">{fmtTanggal(guru.tmt_tugas)}</td>
                  <td>
                    {Array.isArray(guru.riwayat_pendidikan) && guru.riwayat_pendidikan.length > 0 ? (
                      <span className="sk__eduBadge">{guru.riwayat_pendidikan[guru.riwayat_pendidikan.length - 1].level}</span>
                    ) : '-'}
                  </td>
                  <td>
                    <span className={`sk__status ${guru.aktif ? 'isOn' : 'isOff'}`}>
                      {guru.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td>
                    <ActionGroup>
                      <ActionButton action="view" onClick={() => handleView(guru)} />
                      {isAdmin && (
                        <ActionButton action="edit" onClick={() => handleEdit(guru)} />
                      )}
                      {/* Mutasi jenis pegawai khusus role ADMIN — server menolaknya
                          untuk pemegang Hak Akses Fitur (assertCanWrite(req, true)). */}
                      {isAdminRole && (
                        <ActionButton
                          action="move"
                          title={`Pindahkan ke ${labelLain}`}
                          onClick={() => handlePindah(guru)}
                        />
                      )}
                      {isAdmin && (
                        <ActionButton action="delete" onClick={() => handleDelete(guru.id, guru.nip, guru.nama_lengkap)} />
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
      <div className="sk__cards" aria-label={`Daftar ${label} versi mobile`}>
        {loading ? (
          <div className="sk__cardLoading" style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
            <Spinner variant="trace" />
          </div>
        ) : guruList.length === 0 ? (
          <div className="sk__cardEmpty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--n-ink, #0f172a)', marginBottom: 2 }}>Tidak ada data</div>
            <div style={{ fontSize: '0.80rem', color: 'var(--n-muted, #64748b)' }}>Coba ubah kata kunci pencarian atau filter</div>
          </div>
        ) : (
          guruList.map((guru, idx) => {
            return (
              <div
                className="sk__cardCompact"
                key={`m-${guru.nip}-${idx}`}
                onClick={() => handleView(guru)}
              >
                <div className="sk__avatar">
                  {(safePage - 1) * pageSize + idx + 1}
                </div>
                <div className="sk__cardCompactLeft">
                  <div className="sk__cardName">{guru.nama_lengkap || '-'}</div>
                  <div className="sk__cardNip">
                    <span>NIP: {guru.nip || '-'}</span>
                    {!guru.aktif && (
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
      {isAdmin && <DesktopFab label={`Tambah ${label}`} icon="plus-lg" onClick={handleAddNew} />}
      {isAdmin && <MobileFab label={`Tambah ${label}`} onClick={handleAddNew} />}

      {/* ===== Pagination ===== */}
      {totalItems > 0 && (
        <Pagination itemLabel={label.toLowerCase()}
          currentPage={safePage}
          totalPages={totalPages}
          limit={pageSize}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          onLimitChange={(newLimit) => {
            setCurrentPage(1)
            setPageSize(newLimit)
          }}
        />
      )}

      {/* Form Modal (Add/Edit) */}
      {showModal && (
        <Modal
          size="lg"
          variant={isEditMode ? 'edit' : 'add'}
          onClose={() => setShowModal(false)}
          labelledBy="guru-modal-title"
        >
          <ModalHeader
            id="guru-modal-title"
            icon={isEditMode ? 'pencil-square' : 'plus-lg'}
            title={isEditMode ? `Edit Data ${label}` : `Tambah ${label} Baru`}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody>
                <div className="sk__grid2">
                  <div className="sk__field sk__fieldFull">
                    <label>NIP <span className="required">*</span></label>
                    <input
                      type="text"
                      name="nip"
                      required
                      value={formData.nip || ''}
                      onChange={handleInputChange}
                      placeholder="Contoh: 19800101..."
                      disabled={isEditMode}
                      className={isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}
                    />
                  </div>

                  <div className="sk__field sk__fieldFull">
                    <label>Nama Lengkap <span className="required">*</span></label>
                    <input
                      type="text"
                      name="nama_lengkap"
                      required
                      value={formData.nama_lengkap || ''}
                      onChange={handleInputChange}
                      placeholder="Nama Lengkap dengan Gelar"
                    />
                  </div>

                  <div className="sk__field">
                    <label>Tempat Lahir</label>
                    <input type="text" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleInputChange} />
                  </div>
                  <div className="sk__field">
                    <label>Tanggal Lahir</label>
                    <DatePicker value={formData.tanggal_lahir || ''} onChange={v => setFormData(prev => ({ ...prev, tanggal_lahir: v }))} />
                  </div>

                  <div className="sk__field">
                    <label>Pangkat</label>
                    <input type="text" name="pangkat" value={formData.pangkat || ''} onChange={handleInputChange} placeholder="Contoh: Penata Muda Tk. I" />
                  </div>
                  <div className="sk__field">
                    <label>Golongan</label>
                    <input type="text" name="golongan" value={formData.golongan || ''} onChange={handleInputChange} placeholder="Contoh: III/b" />
                  </div>

                  <div className="sk__field">
                    <label>TMT Tugas</label>
                    <DatePicker value={formData.tmt_tugas || ''} onChange={v => setFormData(prev => ({ ...prev, tmt_tugas: v }))} />
                  </div>
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

                  <div className="sk__sectionTitle">Kontak & Alamat</div>

                  <div className="sk__field">
                    <label>No. HP</label>
                    <input type="text" name="no_hp" value={formData.no_hp || ''} onChange={handleInputChange} placeholder="08..." />
                  </div>

                  <div className="sk__field sk__fieldFull">
                    <label>Alamat Lengkap</label>
                    <textarea name="alamat" rows={3} value={formData.alamat || ''} onChange={handleInputChange}></textarea>
                  </div>

                  <div className="sk__sectionTitle">Riwayat Pendidikan</div>

                  {PENDIDIKAN_LEVELS.map(level => (
                    <div key={level} className="sk__field">
                      <label>{level}</label>
                      <div className="sk__eduInputs">
                        <input
                          type="text"
                          placeholder="Nama Sekolah / Kampus"
                          value={pendidikanState[level]?.nama_sekolah || ''}
                          onChange={(e) => handlePendidikanChange(level, 'nama_sekolah', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Tahun"
                          className="sk__inputTahun"
                          value={pendidikanState[level]?.tahun_lulus || ''}
                          onChange={(e) => handlePendidikanChange(level, 'tahun_lulus', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="sk__sectionTitle">Data Rekening</div>
                  <div className="sk__field">
                    <label>Bank 1</label>
                    <input type="text" name="rekening_1_nama_bank" value={formData.rekening_1?.nama_bank || ''} onChange={handleInputChange} placeholder="Contoh: Bank BCA" />
                  </div>
                  <div className="sk__field">
                    <label>No. Rekening 1</label>
                    <input type="text" name="rekening_1_nomor" value={formData.rekening_1?.nomor || ''} onChange={handleInputChange} placeholder="Contoh: 1234567890" />
                  </div>
                  <div className="sk__field">
                    <label>Atas Nama 1</label>
                    <input type="text" name="rekening_1_atas_nama" value={formData.rekening_1?.atas_nama || ''} onChange={handleInputChange} placeholder="Nama di rekening" />
                  </div>
                  <div className="sk__field">
                    <label>Status Rek. 1</label>
                    <div className="mdl-switchWrap">
                      <label className="mdl-switch">
                        <input
                          type="checkbox"
                          checked={formData.rekening_1?.aktif ?? true}
                          onChange={(e) => setFormData(prev => ({ ...prev, rekening_1: { ...(prev.rekening_1 || { nama_bank: '', nomor: '', atas_nama: '', aktif: true }), aktif: e.target.checked } }))}
                        />
                        <span className="mdl-switch__track">
                          <span className="mdl-switch__thumb" />
                        </span>
                        <span className={`mdl-switch__badge ${formData.rekening_1?.aktif !== false ? 'isOn' : 'isOff'}`}>
                          {formData.rekening_1?.aktif !== false ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="sk__field">
                    <label>Bank 2</label>
                    <input type="text" name="rekening_2_nama_bank" value={formData.rekening_2?.nama_bank || ''} onChange={handleInputChange} placeholder="Contoh: Bank Mandiri" />
                  </div>
                  <div className="sk__field">
                    <label>No. Rekening 2</label>
                    <input type="text" name="rekening_2_nomor" value={formData.rekening_2?.nomor || ''} onChange={handleInputChange} placeholder="Contoh: 0987654321" />
                  </div>
                  <div className="sk__field">
                    <label>Atas Nama 2</label>
                    <input type="text" name="rekening_2_atas_nama" value={formData.rekening_2?.atas_nama || ''} onChange={handleInputChange} placeholder="Nama di rekening" />
                  </div>
                  <div className="sk__field">
                    <label>Status Rek. 2</label>
                    <div className="mdl-switchWrap">
                      <label className="mdl-switch">
                        <input
                          type="checkbox"
                          checked={formData.rekening_2?.aktif ?? true}
                          onChange={(e) => setFormData(prev => ({ ...prev, rekening_2: { ...(prev.rekening_2 || { nama_bank: '', nomor: '', atas_nama: '', aktif: true }), aktif: e.target.checked } }))}
                        />
                        <span className="mdl-switch__track">
                          <span className="mdl-switch__thumb" />
                        </span>
                        <span className={`mdl-switch__badge ${formData.rekening_2?.aktif !== false ? 'isOn' : 'isOff'}`}>
                          {formData.rekening_2?.aktif !== false ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                      </label>
                    </div>
                  </div>
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

      {/* View Detail Modal */}
      {showViewModal && selectedGuru && (
        <Modal size="lg" variant="edit" onClose={() => setShowViewModal(false)} labelledBy="guru-view-title">
          <ModalHeader
            id="guru-view-title"
            icon="person-vcard"
            title={`Detail Data ${label}`}
            subtitle={`Informasi lengkap dan riwayat data ${label.toLowerCase()}`}
            onClose={() => setShowViewModal(false)}
          />
          <ModalBody>
            {/* Tata letak baris demi baris SENGAJA dibuat identik dengan form
                Edit di atas (urutan field, sk__grid2/sk__fieldFull/sk__sectionTitle
                yang sama) — supaya transisi Detail → Edit terasa mulus, cuma
                kotak input muncul menggantikan kotak baca di posisi yang sama. */}
            <div className="sk__grid2">
              <div className="sk__field sk__fieldFull">
                <label>NIP</label>
                <div className="sk__readInput font-mono">{selectedGuru.nip || '-'}</div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Nama Lengkap</label>
                <div className="sk__readInput" style={{ fontWeight: 750, fontSize: '0.92rem' }}>
                  {selectedGuru.nama_lengkap || '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Tempat Lahir</label>
                <div className="sk__readInput">{selectedGuru.tempat_lahir || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Tanggal Lahir</label>
                <div className="sk__readInput">{fmtTanggal(selectedGuru.tanggal_lahir)}</div>
              </div>

              <div className="sk__field">
                <label>Pangkat</label>
                <div className="sk__readInput">{selectedGuru.pangkat || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Golongan</label>
                <div className="sk__readInput">{selectedGuru.golongan || '-'}</div>
              </div>

              <div className="sk__field">
                <label>TMT Tugas</label>
                <div className="sk__readInput">{fmtTanggal(selectedGuru.tmt_tugas)}</div>
              </div>
              <div className="sk__field">
                <label>Status</label>
                <div className="sk__readInput">
                  <span className={`sk__status ${selectedGuru.aktif ? 'isOn' : 'isOff'}`}>
                    {selectedGuru.aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>

              <div className="sk__sectionTitle">Kontak & Alamat</div>

              <div className="sk__field">
                <label>No. HP</label>
                <div className="sk__readInput">{selectedGuru.no_hp || '-'}</div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Alamat Lengkap</label>
                <div className="sk__readInput" style={{ minHeight: '56px', alignItems: 'flex-start', paddingTop: '8px' }}>
                  {selectedGuru.alamat || '-'}
                </div>
              </div>

              <div className="sk__sectionTitle">Riwayat Pendidikan</div>

              {PENDIDIKAN_LEVELS.map(level => {
                const riwayat = Array.isArray(selectedGuru.riwayat_pendidikan) ? selectedGuru.riwayat_pendidikan : []
                const edu = riwayat.find(r => r.level === level)
                return (
                  <div key={level} className="sk__field">
                    <label>{level}</label>
                    <div className="sk__eduInputs">
                      <div className="sk__readInput">{edu?.nama_sekolah || '-'}</div>
                      <div className="sk__readInput sk__inputTahun" style={{ justifyContent: 'center' }}>{edu?.tahun_lulus || '-'}</div>
                    </div>
                  </div>
                )
              })}

              <div className="sk__sectionTitle">Data Rekening</div>

              <div className="sk__field">
                <label>Bank 1</label>
                <div className="sk__readInput">{selectedGuru.rekening_1?.nama_bank || '-'}</div>
              </div>
              <div className="sk__field">
                <label>No. Rekening 1</label>
                <div className="sk__readInput font-mono">{selectedGuru.rekening_1?.nomor || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Atas Nama 1</label>
                <div className="sk__readInput">{selectedGuru.rekening_1?.atas_nama || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Status Rek. 1</label>
                <div className="sk__readInput">{selectedGuru.rekening_1?.nomor ? (selectedGuru.rekening_1?.aktif ? 'Aktif' : 'Tidak Aktif') : '-'}</div>
              </div>

              <div className="sk__field">
                <label>Bank 2</label>
                <div className="sk__readInput">{selectedGuru.rekening_2?.nama_bank || '-'}</div>
              </div>
              <div className="sk__field">
                <label>No. Rekening 2</label>
                <div className="sk__readInput font-mono">{selectedGuru.rekening_2?.nomor || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Atas Nama 2</label>
                <div className="sk__readInput">{selectedGuru.rekening_2?.atas_nama || '-'}</div>
              </div>
              <div className="sk__field">
                <label>Status Rek. 2</label>
                <div className="sk__readInput">{selectedGuru.rekening_2?.nomor ? (selectedGuru.rekening_2?.aktif ? 'Aktif' : 'Tidak Aktif') : '-'}</div>
              </div>
            </div>
          </ModalBody>
          <ModalViewFooter
            onClose={() => setShowViewModal(false)}
            onDelete={isAdmin ? () => { handleDelete(selectedGuru.id, selectedGuru.nip, selectedGuru.nama_lengkap); setShowViewModal(false) } : undefined}
            onEdit={isAdmin ? () => { const toEdit = selectedGuru; setShowViewModal(false); handleEdit(toEdit) } : undefined}
            // Di mobile kartu langsung membuka modal detail (tidak ada tombol
            // aksi per baris), jadi Pindah harus tersedia dari sini juga.
            extraActions={isAdminRole ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => { const toMove = selectedGuru; setShowViewModal(false); handlePindah(toMove) }}
                leftIcon={<i className="bi bi-arrow-left-right" />}
              >
                Pindah ke {labelLain}
              </Button>
            ) : undefined}
          />
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          labelledBy="guru-delete-title"
        >
          <ModalHeader
            id="guru-delete-title"
            icon="trash3"
            title={deleteItemName}
            onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          />
          <ModalFooter>
            <Button type="button" variant="cancel" onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); }} leftIcon={<i className="bi bi-x-lg" />}>
              Batal
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>
              Ya, Hapus
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Pindah Guru <-> Tendik */}
      {showPindahModal && pindahTarget && (
        <Modal
          size="sm"
          variant="edit"
          onClose={() => { setShowPindahModal(false); setPindahTarget(null) }}
          labelledBy="pegawai-pindah-title"
        >
          <ModalHeader
            id="pegawai-pindah-title"
            icon="arrow-left-right"
            title={`Pindahkan ke ${labelLain}`}
            subtitle={pindahTarget.nama_lengkap}
            onClose={() => { setShowPindahModal(false); setPindahTarget(null) }}
          />
          <ModalBody>
            <p className="sk__pindahText">
              <strong>{pindahTarget.nama_lengkap}</strong> (NIP {pindahTarget.nip}) akan dipindahkan
              dari tab <strong>{label}</strong> ke tab <strong>{labelLain}</strong>.
            </p>
            <p className="sk__pindahText sk__muted">
              NIP tidak berubah, jadi akun, jurnal, absensi, dan riwayat suratnya tetap utuh.
            </p>

            {pindahPenugasan === null ? (
              <div className="sk__pindahLoading">
                <Spinner variant="trace" />
                <span>Memeriksa penugasan aktif...</span>
              </div>
            ) : pindahPenugasan.length > 0 && (
              <div className="sk__pindahWarn">
                <div className="sk__pindahWarnHead">
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span>Masih punya penugasan aktif</span>
                </div>
                <ul>
                  {pindahPenugasan.map(p => (
                    <li key={p.label}>{p.label} <strong>({p.count})</strong></li>
                  ))}
                </ul>
                <p>
                  Penugasan ini tidak ikut terhapus. Lepaskan lewat halaman Pengaturan Tugas
                  bila memang sudah tidak mengajar.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="cancel"
              onClick={() => { setShowPindahModal(false); setPindahTarget(null) }}
              leftIcon={<i className="bi bi-x-lg" />}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={confirmPindah}
              isLoading={pindahing}
              disabled={pindahPenugasan === null}
              leftIcon={<i className="bi bi-arrow-left-right" />}
            >
              Ya, Pindahkan
            </Button>
          </ModalFooter>
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
                fetchGuru();
                setShowImportModal(false);
              }}
              templateColumns={['No', 'NIP', 'Nama Lengkap', 'Tempat Lahir', 'Tanggal Lahir', 'Golongan', 'Pangkat', 'TMT Tugas', 'Alamat', 'No HP', ...PENDIDIKAN_LEVELS.flatMap(l => [l, `Tahun ${l}`]), 'Status Aktif']}
              templateName={`Template_${label}`}
              apiEndpoint="/api/master/guru?upsert=true"
              mapRowData={mapImportRow}
            />
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

.cNo { width: 56px; }
.cNip { width: 140px; }
.cTmt { width: 120px; }
.cEdu { width: 100px; }
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
.text-gray-600 { color: rgba(75, 85, 99, 1); }
.italic { font-style: italic; }

.sk__eduBadge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.10);
  border: 1px solid rgba(99, 102, 241, 0.18);
  color: #1e3a8a;
  font-weight: 800;
  font-size: 0.82rem;
  white-space: nowrap;
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

/* Pakai 1 / -1, BUKAN span 2: di dalam grid 1 kolom (mode mobile), span 2
   memaksa browser membuat kolom implisit ke-2, sehingga seluruh isian modal
   kembali tersusun 2 kolom walau grid-template-columns sudah 1fr. */
.sk__pendidikanGrid {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sk__eduInputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 85px;
  gap: 8px;
  width: 100%;
}

.sk__inputTahun {
  text-align: center;
}

/* ========= MODAL PINDAH (GURU <-> TENDIK) ========= */
.sk__pindahText {
  margin: 0 0 8px;
  font-size: var(--sk-fs-sm);
  line-height: 1.55;
  color: var(--n-ink, #0f172a);
}

.sk__pindahText.sk__muted {
  color: var(--n-muted, #64748b);
}

.sk__pindahLoading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0 2px;
  font-size: var(--sk-fs-xs);
  color: var(--n-muted, #64748b);
}

.sk__pindahWarn {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  background: rgba(254, 243, 199, 0.55);
  font-size: var(--sk-fs-xs);
  color: #78350f;
}

.sk__pindahWarnHead {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  margin-bottom: 6px;
}

.sk__pindahWarn ul {
  margin: 0 0 8px;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sk__pindahWarn p {
  margin: 0;
  line-height: 1.5;
  opacity: 0.9;
}

:global(.dark) .sk__pindahText {
  color: #e2e8f0;
}

:global(.dark) .sk__pindahText.sk__muted {
  color: #94a3b8;
}

:global(.dark) .sk__pindahWarn {
  border-color: rgba(245, 158, 11, 0.45);
  background: rgba(120, 53, 15, 0.28);
  color: #fcd34d;
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

  .sk__filterBar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .sk__filterGroup select { min-width: 0; width: 100%; }

  .sk__actions {
    width: 100%;
    display: flex;
    gap: 6px;
    margin-top: 8px;
    margin-bottom: 12px;
    padding: 8px;
    border-radius: var(--sk-radius);
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid var(--sk-line);
    box-shadow: var(--sk-shadow2);
  }

  .sk__actions .sk__btn {
    flex: 1;
    height: 40px;
    padding: 9px 8px;
    justify-content: center;
    min-width: 0;
  }

  .sk__actions .sk__btn span {
    font-size: 0.75rem;
  }

  .sk__pendidikanRow {
    grid-template-columns: 56px minmax(0, 1fr) 92px;
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
@keyframes zoomInDelete { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
/* ===== DARK MODE FULL ===== */
:global(.dark) .sk__bar { background: transparent !important; border: none !important; }
:global(.dark) .sk__tableWrap {
  background: #000000 !important;
  border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
  border-radius: 18px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
  overflow: hidden !important;
}
:global(.dark) .sk__table { background: #000000 !important; color: #e2e8f0 !important; }
:global(.dark) .sk__table thead th {
  background: #000000 !important;
  color: #94a3b8 !important;
  border-bottom: 1.5px solid rgba(59, 130, 246, 0.4) !important;
  font-weight: 800 !important;
}
:global(.dark) .sk__table tbody td {
  background: #000000 !important;
  color: #e2e8f0 !important;
  border-bottom: 1px solid rgba(59, 130, 246, 0.2) !important;
}
:global(.dark) .sk__table tbody tr:nth-child(even) td { background: #000000 !important; }
:global(.dark) .sk__table tbody tr:hover td { background: rgba(37, 99, 235, 0.08) !important; }

:global(.dark) .sk__search {
  background: #000000 !important;
  border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 10px rgba(26, 115, 232, 0.2) !important;
}
:global(.dark) .sk__filters,
:global(.dark) .sk__actions { background: transparent !important; border: none !important; box-shadow: none !important; }
:global(.dark) .sk__search input {
  background: #000000 !important;
  border: none !important;
  color: #ffffff !important;
  border-radius: 12px !important;
}
:global(.dark) .sk__search i { color: #94a3b8 !important; }

:global(.dark) .sk__filterGroup label { color: #94a3b8 !important; }
:global(.dark) select,
:global(.dark) .sk__filterGroup select {
  background-color: #000000 !important;
  border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
  color: #ffffff !important;
  border-radius: 12px !important;
  box-shadow: 0 0 10px rgba(26, 115, 232, 0.25) !important;
}

:global(.dark) .sk__btn {
  background: #000000 !important;
  border: 1.5px solid rgba(59, 130, 246, 0.4) !important;
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
  border-radius: 12px !important;
}
:global(.dark) .sk__btnExport {
  background: rgba(79, 70, 229, 0.15) !important;
  border: 1.5px solid rgba(129, 140, 248, 0.5) !important;
  color: #818cf8 !important;
  border-radius: 12px !important;
}
:global(.dark) .sk__btnPrimary {
  background: #1a73e8 !important;
  border: 1.5px solid #3b82f6 !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(26, 115, 232, 0.5) !important;
  border-radius: 12px !important;
}
:global(.dark) input:disabled, :global(.dark) select:disabled, :global(.dark) textarea:disabled { background: rgba(255,255,255,0.04) !important; color: #94a3b8 !important; }
:global(.dark) .sk__btnGhost { background: #000000 !important; color: #e2e8f0 !important; border: 1.5px solid rgba(59, 130, 246, 0.4) !important; }
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

:global(.dark) .sk__group { background: #000000 !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; }
:global(.dark) .sk__groupHead { background: #000000 !important; }
:global(.dark) .sk__groupTitle { color: #ffffff !important; }
:global(.dark) .sk__groupMeta { color: #94a3b8 !important; }

:global(.dark) .sk__card { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; }
:global(.dark) .sk__cardHead { background: #000000 !important; }
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
:global(.dark) .sk__btnActionMenu i,
:global(.dark) .sk__btnMore i {
  color: #60a5fa !important;
}
:global(.dark) .sk__btnActionMenu:hover i,
:global(.dark) .sk__btnActionMenu.isOpen i,
:global(.dark) .sk__btnMore:hover i,
:global(.dark) .sk__btnMore.isOpen i {
  color: #ffffff !important;
}

:global(.dark) .sk__menu {
  background: #000000 !important;
  border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7) !important;
}
:global(.dark) .sk__menuItem {
  background: #0f172a !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
  color: #e2e8f0 !important;
}
:global(.dark) .sk__menuItem:hover,
:global(.dark) .sk__menuItem:active {
  background: #1e293b !important;
  border-color: #60a5fa !important;
}
:global(.dark) .sk__menuItemTitle,
:global(.dark) .sk__menuLabel {
  color: #ffffff !important;
}
:global(.dark) .sk__menuSep {
  background: rgba(59, 130, 246, 0.2) !important;
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
  border-color: rgba(26, 115, 232, 0.5) !important;
}

:global(.dark) .sk__chevron {
  background: rgba(26, 115, 232, 0.18) !important;
  color: #60a5fa !important;
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
:global(.dark) .sk__cardEmpty div {
  color: #94a3b8 !important;
}
:global(.dark) .sk__viewBtn {
  background: rgba(26, 115, 232, 0.18) !important;
  border-color: rgba(26, 115, 232, 0.7) !important;
  color: #60a5fa !important;
}
:global(.dark) .sk__viewBtn:hover,
:global(.dark) .sk__viewBtn:active {
  background: #1a73e8 !important;
  color: #ffffff !important;
  border-color: #60a5fa !important;
}

:global(.dark) .sk__muted, :global(.dark) .sk__empty { color: #94a3b8 !important; }
:global(.dark) .sk__loadingCell { background: transparent !important; }
:global(.dark) .tNameCell__name { color: #ffffff !important; font-weight: 700 !important; }
:global(.dark) .tNameCell__sub { color: #94a3b8 !important; }
:global(.dark) .text-gray-500, :global(.dark) .text-gray-600 { color: #94a3b8 !important; }
/* ===== END DARK MODE FULL ===== */

`}</style>
    </div>
  )
}

