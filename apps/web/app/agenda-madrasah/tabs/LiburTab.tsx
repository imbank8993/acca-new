'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import DatePicker from '@/components/ui/DatePicker'
import { exportToExcel } from '@/lib/excel-utils'
import ImportModal from '@/components/ui/ImportModal'
import Select, { components } from 'react-select'

import { useModalBlur } from '@/components/ModalBlurProvider'
import { Spinner } from '@/components/ui/Spinner'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalViewFooter } from '@/components/ui/Modal'
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown'
import { ChevronRight } from 'lucide-react'
import { hasPermission } from '@/lib/permissions-client'
import {
  LINGKUP_OPTIONS,
  labelLingkup,
  labelTingkat,
  normalizeLingkup,
  parseTargetKelas,
  type LiburLingkup,
} from '@/lib/libur'

interface Libur {
  id?: number
  tanggal: string
  jam_ke: string
  keterangan: string
  lingkup?: string | null
  target_kelas?: string[] | string | null
}

interface KelasOpt {
  nama: string
  tingkat: string
}

/** Gaya react-select bersama untuk pilihan Jam dan pilihan Tingkat/Kelas. */
const rsStyles = {
  control: (base: any, state: any) => ({
    ...base,
    borderRadius: '12px',
    border: state.isFocused ? '2px solid #3b82f6' : '1.5px solid rgba(59,130,246,0.35)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#3b82f6' },
    background: 'transparent',
    minHeight: '45px'
  }),
  placeholder: (base: any) => ({ ...base, color: 'var(--n-muted)' }),
  input: (base: any) => ({ ...base, color: 'inherit' }),
  singleValue: (base: any) => ({ ...base, color: 'inherit' }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? 'rgba(26,115,232,0.2)' : state.isFocused ? 'rgba(59,130,246,0.1)' : 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    padding: '8px 12px'
  }),
  menu: (base: any) => ({ ...base, background: 'transparent' }),
  menuList: (base: any) => ({ ...base, background: 'transparent' }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: 'rgba(26,115,232,0.15)',
    borderRadius: '8px',
    padding: '2px 4px'
  }),
  multiValueLabel: (base: any) => ({ ...base, color: '#93c5fd', fontWeight: '600' }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#93c5fd',
    ':hover': { backgroundColor: '#1a73e8', color: 'white' }
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
}

/** Opsi dengan checkbox — dipakai kedua multiselect di modal. */
const CheckboxOption = (props: any) => (
  <components.Option {...props}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <input
        type="checkbox"
        checked={props.isSelected}
        readOnly
        style={{ width: '16px', height: '16px', accentColor: 'var(--n-primary)', cursor: 'pointer' }}
      />
      <span>{props.label}</span>
    </div>
  </components.Option>
)

export default function LiburTab({
  user,
  /**
   * Pindahkan tombol Tambah dari baris filter ke FAB melayang (desktop) dan
   * slot tengah bottom nav (mobile).
   *
   * Harus dinyalakan per-pemakaian, bukan selalu: komponen ini juga dipasang
   * sebagai SATU KARTU di antara kartu lain pada panel admin Jurnal
   * (JurnalLiburSection). FAB di sana akan melayang di atas seluruh halaman
   * dan merebut tombol tengah bottom nav untuk aksi yang cuma milik satu
   * kartu.
   */
  primaryActionAsFab = false,
  canManageOverride,
}: { user?: any; primaryActionAsFab?: boolean; canManageOverride?: boolean }) {
  // Permission Check
  const permissions = user?.permissions || []
  const isAdmin = (user?.role === 'ADMIN') || (user?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN')) || false
  const isOPJurnal = user?.roles?.some((r: string) => r.toUpperCase() === 'OP_JURNAL') || false
  const userRoles = user?.roles || []
  const canManage = typeof canManageOverride === 'boolean'
    ? canManageOverride
    : (isAdmin || isOPJurnal || hasPermission(permissions, 'pengaturan_data:libur', 'manage', isAdmin, userRoles) ||
       hasPermission(permissions, 'pengaturan_data.libur', 'manage', isAdmin, userRoles))

  const [list, setList] = useState<Libur[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // View Detail Modal State
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedLibur, setSelectedLibur] = useState<Libur | null>(null)

  const handleView = (item: Libur) => {
    setSelectedLibur(item)
    setShowViewModal(true)
  }

  const { openModal, closeModal } = useModalBlur()

  useEffect(() => {
    if (showModal || showImportModal || showDeleteModal || showViewModal) {
      openModal()
    } else {
      closeModal()
    }
    return () => {
      closeModal()
    }
  }, [showModal, showImportModal, showDeleteModal, showViewModal, openModal, closeModal])

  const [saving, setSaving] = useState(false)
  const [academicYears, setAcademicYears] = useState<string[]>([])
  const [tahunAjaran, setTahunAjaran] = useState('')

  // Form Data
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [jamKe, setJamKe] = useState('Semua')
  const [keterangan, setKeterangan] = useState('')
  const [lingkup, setLingkup] = useState<LiburLingkup>('semua')
  const [targetKelas, setTargetKelas] = useState<string[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Master Waktu for Jam Ke options
  const [masterWaktu, setMasterWaktu] = useState<any[]>([])
  // Master Kelas untuk pilihan lingkup (nama kelas + tingkat)
  const [masterKelas, setMasterKelas] = useState<KelasOpt[]>([])

  // Mobile Action State
  const [mobileAction, setMobileAction] = useState<{
    open: boolean
    item: Libur | null
  }>({ open: false, item: null })

  useEffect(() => {
    fetchMasterWaktu()
    fetchMasterKelas()
    fetchAcademicYears()
  }, [])

  const fetchAcademicYears = async () => {
    try {
      const { getActivePeriods, getActiveSettings } = await import('@/lib/settings-client');
      const periods = await getActivePeriods();
      const defaultSettings = await getActiveSettings();

      if (periods.length > 0) {
        const uniqueYears = Array.from(new Set(periods.map(p => p.tahun_ajaran)));
        setAcademicYears(uniqueYears);

        const currentYearIsValid = uniqueYears.includes(tahunAjaran);

        if (!currentYearIsValid && defaultSettings) {
          setTahunAjaran(defaultSettings.tahun_ajaran);
        } else if (!currentYearIsValid && periods.length > 0) {
          setTahunAjaran(periods[0].tahun_ajaran);
        }
      } else {
        setAcademicYears([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, tahunAjaran])

  const fetchMasterWaktu = async () => {
    try {
      const res = await fetch('/api/master/waktu')
      const json = await res.json()
      if (json.ok) setMasterWaktu(json.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchMasterKelas = async () => {
    try {
      const res = await fetch('/api/master/kelas?limit=500')
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        setMasterKelas(
          json.data
            .map((k: any) => ({ nama: String(k.nama || '').trim(), tingkat: String(k.tingkat ?? '').trim() }))
            .filter((k: KelasOpt) => k.nama)
        )
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    // Filter tahun ajaran diterjemahkan server jadi rentang tanggal (Juli–Juni).
    // Sebelumnya komponen ini selalu mengirim tahun kalender '2026' yang
    // di-hardcode, sehingga dropdown tahun ajaran tidak berpengaruh sama sekali
    // dan libur di luar 2026 tidak pernah muncul.
    const params = new URLSearchParams({ q: searchTerm })
    if (tahunAjaran && tahunAjaran !== 'Semua') params.set('tahun_ajaran', tahunAjaran)
    try {
      const res = await fetch(`/api/settings/libur?${params}`)
      const json = await res.json()
      if (json.ok) {
        setList(json.data || [])
      } else {
        setList([])
        Swal.fire('Gagal Memuat', json.error || 'Data libur tidak dapat dimuat.', 'error')
      }
    } catch (err: any) {
      setList([])
      Swal.fire('Gagal Memuat', err?.message || 'Data libur tidak dapat dimuat.', 'error')
    } finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManage) return
    if (!startDate) { Swal.fire('Peringatan', 'Mulai Tanggal wajib diisi.', 'warning'); return }
    if (!keterangan.trim()) { Swal.fire('Peringatan', 'Keterangan wajib diisi.', 'warning'); return }
    if (endDate && endDate < startDate) {
      Swal.fire('Peringatan', 'Sampai Tanggal tidak boleh mendahului Mulai Tanggal.', 'warning')
      return
    }
    if (lingkup !== 'semua' && targetKelas.length === 0) {
      Swal.fire(
        'Peringatan',
        lingkup === 'tingkat' ? 'Pilih minimal satu tingkat.' : 'Pilih minimal satu kelas.',
        'warning'
      )
      return
    }

    setSaving(true)

    try {
      // Satu request untuk seluruh rentang. Versi lama menembakkan satu POST per
      // (tanggal × jam) secara paralel tanpa memeriksa hasilnya sama sekali,
      // sehingga kegagalan server tampak seperti "tersimpan" padahal datanya hilang.
      const payload = {
        id: editId || undefined,
        tanggal: startDate,
        tanggal_selesai: editId ? undefined : (endDate || startDate),
        jam_ke: jamKe,
        keterangan: keterangan.trim(),
        lingkup,
        target_kelas: lingkup === 'semua' ? [] : targetKelas,
      }

      const res = await fetch('/api/settings/libur', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menyimpan data libur')

      setShowModal(false)
      resetForm()
      await fetchData()

      const sebagianGagal = Array.isArray(json.errors) && json.errors.length > 0
      Swal.fire({
        icon: sebagianGagal ? 'warning' : 'success',
        title: sebagianGagal ? 'Sebagian Tersimpan' : 'Tersimpan',
        html: editId
          ? 'Data libur berhasil diperbarui.'
          : `${json.created ?? 0} baris ditambahkan, ${json.updated ?? 0} diperbarui, ${json.skipped ?? 0} dilewati (sudah sama).` +
            (sebagianGagal ? `<br/><small style="color:#dc2626">${json.errors.slice(0, 3).join('<br/>')}</small>` : '') +
            (json.warning ? `<br/><small style="color:#d97706">${json.warning}</small>` : '')
      })
    } catch (err: any) {
      Swal.fire('Gagal', err.message || 'Gagal menyimpan data', 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setStartDate('')
    setEndDate('')
    setJamKe('Semua')
    setKeterangan('')
    setLingkup('semua')
    setTargetKelas([])
    setEditId(null)
  }

  const handleEdit = (item: Libur) => {
    if (!canManage) return
    setEditId(item.id!)
    setStartDate(item.tanggal)
    setEndDate('')
    setJamKe(item.jam_ke)
    setKeterangan(item.keterangan)
    setLingkup(normalizeLingkup(item))
    setTargetKelas(parseTargetKelas(item.target_kelas))
    setShowModal(true)
  }

  const handleDelete = (id: number, name: string) => {
    if (!canManage) return
    setDeleteItemId(id)
    setDeleteItemName(name)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteItemId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/settings/libur?id=${deleteItemId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Gagal menghapus data libur')

      setShowDeleteModal(false)
      setDeleteItemId(null)
      setDeleteItemName('')
      fetchData()
      Swal.fire('Terhapus!', `Data libur "${deleteItemName}" berhasil dihapus.`, 'success')
    } catch (err: any) {
      console.error(err)
      Swal.fire('Gagal', err.message || 'Terjadi kesalahan', 'error')
    } finally {
      setDeleting(false)
    }
    setMobileAction({ open: false, item: null })
  }

  const handleExport = () => {
    const dataToExport = list.map((item, index) => ({
      No: index + 1,
      Tanggal: item.tanggal,
      'Jam Ke': item.jam_ke,
      Keterangan: item.keterangan,
      'Berlaku Untuk': labelLingkup(item)
    }))
    const suffix = (tahunAjaran && tahunAjaran !== 'Semua' ? tahunAjaran : 'Semua').replace(/\//g, '-')
    exportToExcel(dataToExport, `DataLibur_${suffix}`)
  }

  const mapImportRow = (row: any) => {
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined) return row[k];
      }
      return '';
    }

    const dateRaw = getVal(['Tanggal', 'tanggal', 'Date']);
    const ketRaw = getVal(['Keterangan', 'keterangan']);
    const tingkatRaw = String(getVal(['Tingkat', 'tingkat']) || '').trim();
    const kelasRaw = String(getVal(['Kelas', 'kelas']) || '').trim();

    if (!dateRaw || !ketRaw) return null;

    // Parse Date logic same as before...
    let dateResult = '';
    if (typeof dateRaw === 'number') {
      const d = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
      dateResult = d.toISOString().split('T')[0];
    } else {
      const dateStr = String(dateRaw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        dateResult = dateStr;
      }
      else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
        const parts = dateStr.split(/[\/\-]/);
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        dateResult = `${year}-${month}-${day}`;
      }
      else {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          dateResult = d.toISOString().split('T')[0];
        }
      }
    }

    if (!dateResult || dateResult === 'Invalid Date') return null;

    // Kolom Tingkat / Kelas opsional. Diisi salah satunya untuk libur yang hanya
    // berlaku sebagian; keduanya kosong = libur seluruh madrasah.
    let lingkup: LiburLingkup = 'semua'
    let target_kelas: string[] = []
    if (kelasRaw) {
      lingkup = 'kelas'
      target_kelas = kelasRaw.split(',').map(s => s.trim()).filter(Boolean)
    } else if (tingkatRaw) {
      lingkup = 'tingkat'
      target_kelas = tingkatRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        // Terima "X"/"XI"/"XII" maupun angka 10/11/12.
        .map(s => {
          const romawi: Record<string, string> = { X: '10', XI: '11', XII: '12', VII: '7', VIII: '8', IX: '9' }
          return romawi[s.toUpperCase()] || s
        })
    }

    return {
      tanggal: dateResult,
      jam_ke: 'Semua',
      keterangan: String(ketRaw),
      lingkup,
      target_kelas
    }
  }

  const openAdd = () => {
    resetForm()
    setShowModal(true)
  }

  /* Menu titik tiga (mobile). Import & Export tidak muat sebaris dengan kolom
     cari sebagai tombol berlabel, jadi di layar kecil keduanya dilipat ke sini;
     di desktop menunya disembunyikan dan tombol aslinya yang tampil. */
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

  // Sengaja TIDAK ada `if (loading) return <PageLoader/>` di sini: early return
  // meng-unmount seluruh toolbar tiap kali data dimuat ulang, sehingga kolom
  // pencarian kehilangan fokus setiap 500ms saat diketik. Status loading
  // ditampilkan di dalam tabel/kartu saja.
  return (
    <div className="lb">
      {/* ===== Toolbar ===== */}
      {/* actionsInline: di mobile aksi duduk SEBARIS dengan kolom cari, bukan
          di baris sendiri. Yang tersisa di sana memang cuma satu tombol ikon. */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari Keterangan..."
          label="Cari Libur"
        />

        <FilterSelect
          label="Tahun Ajaran"
          value={tahunAjaran}
          onChange={setTahunAjaran}
        >
          {academicYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
          <option value="Semua">Semua Tahun</option>
        </FilterSelect>

        <FilterActions>
          {/* Pemicu titik tiga: hanya terlihat di mobile, digambar sebagai
              lingkaran 42px di samping kolom cari oleh
              `.ftb-mobile-inlineActions .sk__menuWrap > button`
              (components/filter-toolbar.css). */}
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
                {canManage && (
                  <button
                    type="button"
                    role="menuitem"
                    className="sk__menuItem"
                    onClick={() => { setShowActionMenu(false); setShowImportModal(true) }}
                  >
                    <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel-fill" style={{ color: '#f97316' }} /></span>
                    <span className="sk__menuLabel">Import</span>
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="sk__menuItem"
                  onClick={() => { setShowActionMenu(false); handleExport() }}
                >
                  <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#3b82f6' }} /></span>
                  <span className="sk__menuLabel">Export</span>
                </button>
              </div>
            )}
          </div>

          {canManage && (
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              icon="import"
              className="sk__btnDesktopOnly"
            >
              Import
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExport}
            icon="export"
            className="sk__btnDesktopOnly"
          >
            Export
          </Button>
          {canManage && !primaryActionAsFab && (
            <Button
              variant="primary"
              onClick={openAdd}
              icon="add"
            >
              Tambah
            </Button>
          )}
        </FilterActions>
      </FilterToolbar>

      {/* Desktop pakai FAB melayang, mobile mengambil slot tengah bottom nav —
          pola yang sama dengan tab Kelola Agenda di halaman yang sama.
          Import/Export tetap di toolbar karena keduanya aksi sekunder. */}
      {canManage && primaryActionAsFab && (
        <>
          <DesktopFab label="Tambah Hari Libur" icon="plus-lg" onClick={openAdd} />
          <MobileFab label="Tambah" icon="plus-lg" onClick={openAdd} />
        </>
      )}

      {/* ===== Table (Desktop) ===== */}
      <div className="lb__tableWrap">
        <table className="lb__table">
          <thead>
            <tr>
              <th className="cNo">No</th>
              <th>Tanggal</th>
              <th>Jam Ke</th>
              <th>Keterangan</th>
              <th>Berlaku Untuk</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!loading && list.map((item, index) => (
              <tr key={item.id}>
                <td className="tCenter">{index + 1}</td>
                <td className="tPlain font-medium">{item.tanggal}</td>
                <td className="tMono">{item.jam_ke}</td>
                <td className="tPlain">{item.keterangan}</td>
                <td className="tPlain">
                  <span className={`lb__scope lb__scope--${normalizeLingkup(item)}`}>
                    <i className={`bi ${normalizeLingkup(item) === 'semua' ? 'bi-buildings' : 'bi-people'}`} />
                    {labelLingkup(item)}
                  </span>
                </td>
                <td>
                  <ActionGroup>
                    <ActionButton action="edit" onClick={() => handleEdit(item)} />
                    <ActionButton action="delete" onClick={() => item.id && handleDelete(item.id, item.keterangan)} />
                  </ActionGroup>
                </td>
              </tr>
            ))}
            {loading && <tr><td colSpan={6} className="lb__empty" style={{ textAlign: 'center' }}><Spinner variant="trace" /></td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={6} className="lb__empty lb__muted">Tidak ada data.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile Cards ===== */}
      <div className="lb__cards" aria-label="Daftar Hari Libur versi mobile">
        {loading ? (
          <div className="sk__card sk__cardLoading">
            <div className="sk__cardBody" style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
              <Spinner variant="trace" />
            </div>
          </div>
        ) : list.length === 0 ? (
          <div className="sk__card">
            <div className="sk__cardHead">
              <div className="sk__cardTitle">
                <div className="sk__cardName">Tidak ada data</div>
                <div className="sk__cardSub">Belum ada hari libur</div>
              </div>
            </div>
          </div>
        ) : (
          list.map((item, idx) => (
            <div
              className="sk__card sk__cardCompact"
              key={`lb-${item.id || idx}`}
              onClick={() => handleView(item)}
            >
              <div className="sk__cardCompactLeft">
                <div className="sk__cardName">{item.keterangan || '-'}</div>
                <div className="sk__cardNip">
                  {item.tanggal} · Jam: {item.jam_ke} · {labelLingkup(item)}
                </div>
              </div>
              <div className="sk__cardCompactRight">
                <button
                  type="button"
                  className="sk__viewBtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleView(item);
                  }}
                  aria-label="Lihat detail libur"
                  title="Lihat detail"
                >
                  <ChevronRight size={15} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* View Detail Modal */}
      {showViewModal && selectedLibur && (
        <Modal size="md" variant="edit" onClose={() => setShowViewModal(false)} labelledBy="libur-view-title">
          <ModalHeader
            id="libur-view-title"
            icon="calendar-x"
            title="Detail Data Hari Libur"
            onClose={() => setShowViewModal(false)}
          />
          <ModalBody>
            <div className="sk__grid2">
              <div className="sk__field sk__fieldFull">
                <label>Keterangan Libur</label>
                <div className="sk__readInput" style={{ fontWeight: 750, fontSize: '0.92rem' }}>
                  {selectedLibur.keterangan || '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Tanggal</label>
                <div className="sk__readInput font-mono">{selectedLibur.tanggal || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Jam Ke</label>
                <div className="sk__readInput font-mono">{selectedLibur.jam_ke || '-'}</div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Berlaku Untuk</label>
                <div className="sk__readInput">
                  <span className={`lb__scope lb__scope--${normalizeLingkup(selectedLibur)}`}>
                    <i className={`bi ${normalizeLingkup(selectedLibur) === 'semua' ? 'bi-buildings' : 'bi-people'}`} />
                    {labelLingkup(selectedLibur)}
                  </span>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalViewFooter
            onClose={() => setShowViewModal(false)}
            onDelete={canManage ? () => { if (selectedLibur.id) handleDelete(selectedLibur.id, selectedLibur.keterangan); setShowViewModal(false) } : undefined}
            onEdit={canManage ? () => { const toEdit = selectedLibur; setShowViewModal(false); handleEdit(toEdit) } : undefined}
          />
        </Modal>
      )}

      {/* ===== Modal Tambah / Edit Libur ===== */}
      <Modal
        open={showModal}
        size="lg"
        variant={editId ? 'edit' : 'add'}
        onClose={() => setShowModal(false)}
        labelledBy="modal-libur-title"
      >
        <ModalHeader
          id="modal-libur-title"
          title={editId ? 'Edit Data Libur' : 'Tambah Hari Libur'}
          icon={editId ? 'pencil-square' : 'calendar-plus'}
          onClose={() => setShowModal(false)}
        />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <div className="lb__grid2">
              <div className="lb__field">
                <label>Tanggal Libur <span className="required">*</span></label>
                <DatePicker
                  value={startDate}
                  valueEnd={endDate}
                  isRange={true}
                  onChangeRange={(start, end) => { setStartDate(start); setEndDate(end); }}
                  onChange={v => { setStartDate(v); setEndDate(v); }}
                  placeholder="Pilih tanggal / rentang libur..."
                  required
                />
              </div>

              <div className="lb__field">
                <label>Berlaku untuk Jam</label>
                <MultiSelectDropdown
                  options={[
                    { value: 'Semua', label: 'Semua' },
                    ...Array.from(new Set(masterWaktu.map(w => String(w.jam_ke).trim())))
                      .filter(j => j && j !== 'Semua' && j !== '')
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map(jam => ({ value: jam, label: `Jam Ke-${jam}` }))
                  ]}
                  value={
                    jamKe && jamKe !== 'Semua'
                      ? Array.from(new Set(jamKe.split(',').map(v => v.trim()).filter(Boolean)))
                      : ['Semua']
                  }
                  onChange={(selectedValues) => {
                    if (!selectedValues || selectedValues.length === 0) {
                      setJamKe('Semua');
                      return;
                    }
                    const hadSemua = jamKe.includes('Semua');
                    const hasSemua = selectedValues.includes('Semua');
                    if (hasSemua && !hadSemua) {
                      setJamKe('Semua');
                    } else if (hasSemua && selectedValues.length > 1) {
                      const filtered = selectedValues.filter(v => v !== 'Semua');
                      setJamKe(filtered.join(','));
                    } else {
                      setJamKe(selectedValues.join(','));
                    }
                  }}
                  placeholder="Pilih jam pelajaran..."
                  minWidth="100%"
                  height="42px"
                />
              </div>
            </div>

            <div className="lb__field">
              <label>Keterangan <span className="required">*</span></label>
              <textarea value={keterangan} onChange={e => setKeterangan(e.target.value)} required placeholder="Contoh: Libur Nasional..." />
            </div>

            {/* ===== Lingkup: semua kelas / tingkat / kelas tertentu ===== */}
            <div className="lb__field">
              <label>Berlaku untuk</label>
              <div className="lb__scopeTabs" role="radiogroup" aria-label="Lingkup libur">
                {LINGKUP_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={lingkup === opt.value}
                    className={`lb__scopeTab ${lingkup === opt.value ? 'is-active' : ''}`}
                    onClick={() => {
                      setLingkup(opt.value)
                      setTargetKelas([])
                    }}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {lingkup === 'semua' && (
                <p className="lb__scopeHint">Libur berlaku untuk seluruh kelas di madrasah.</p>
              )}

              {lingkup !== 'semua' && (
                <>
                  <MultiSelectDropdown
                    options={
                      lingkup === 'tingkat'
                        ? Array.from(new Set(masterKelas.map(k => k.tingkat).filter(Boolean)))
                            .sort((a, b) => Number(a) - Number(b))
                            .map(t => ({ value: t, label: `Tingkat ${labelTingkat(t)}` }))
                        : masterKelas
                            .map(k => k.nama)
                            .sort((a, b) => a.localeCompare(b))
                            .map(nama => ({ value: nama, label: nama }))
                    }
                    value={targetKelas}
                    onChange={(selectedValues) => setTargetKelas(selectedValues)}
                    placeholder={lingkup === 'tingkat' ? 'Pilih tingkat...' : 'Pilih kelas...'}
                    minWidth="100%"
                    height="38px"
                  />
                  <p className="lb__scopeHint">
                    {lingkup === 'tingkat'
                      ? 'Hanya kelas pada tingkat terpilih yang diliburkan; kelas lain tetap berjalan normal.'
                      : 'Hanya kelas terpilih yang diliburkan; kelas lain tetap berjalan normal.'}
                  </p>
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter align="end">
            <Button type="button" variant="cancel" onClick={() => setShowModal(false)}>Batal</Button>
            <Button type="submit" variant="primary" isLoading={saving} icon="save">Simpan</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Import Modal */}
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
              templateColumns={['No', 'Tanggal', 'Keterangan', 'Tingkat', 'Kelas']}
              templateName="Template_DataLibur"
              apiEndpoint="/api/settings/libur"
              mapRowData={mapImportRow}
              onOpen={openModal}
            />
          </div>
        </div>,
        document.body
      )}

      {/* ===== Modal Hapus Libur ===== */}
      <Modal
        open={showDeleteModal}
        size="sm"
        variant="delete"
        icon="trash3"
        title="Hapus Data Libur?"
        onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
      >
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <div><strong>Keterangan:</strong> {deleteItemName}</div>
            <div style={{ color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
              Data libur ini akan dihapus dari sistem. Lanjutkan?
            </div>
          </div>
        </ModalBody>
        <ModalFooter align="end">
          <Button type="button" variant="cancel" onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); }}>
            Batal
          </Button>
          <Button type="button" variant="danger" isLoading={deleting} onClick={confirmDelete} icon="delete">
            Hapus
          </Button>
        </ModalFooter>
      </Modal>

      <style jsx>{`
        :global(:root) {
           --lb-line: rgba(148, 163, 184, 0.22);
           --lb-card: rgba(255, 255, 255, 0.92);
           --lb-shadow: 0 14px 34px rgba(2, 6, 23, 0.08);
           --lb-shadow2: 0 10px 22px rgba(2, 6, 23, 0.08);
           --lb-radius: 16px;
           --lb-fs: 0.88rem;
           --lb-safe-b: env(safe-area-inset-bottom, 0px);
        }

        .lb {
            width: 100%; display: flex; flex-direction: column; gap: 10px; font-size: var(--lb-fs);
            padding: 16px; background: #f5f7fb; border-radius: 16px; padding-bottom: calc(16px + var(--lb-safe-b));
        }

        /* Pemicu titik tiga hanya untuk mobile: di desktop Import & Export
           sudah tampil sebagai tombol berlabel. filter-toolbar.css tidak
           menyembunyikannya sendiri di atas 639px — aturan display none untuk
           .sk__btnActionMenu di sana ada DI DALAM blok
           max-width 639px, dan justru dikalahkan .ftb-mobile-inlineActions
           yang lebih spesifik. Ambang 640px dipilih agar bersambung rapat
           dengan 639px milik toolbar, tanpa celah maupun tumpang tindih. */
        @media (min-width: 640px) {
          .sk__menuWrap { display: none !important; }
        }

        /* Bentuk pemicu: LINGKARAN, bukan bujur sangkar.
           Bawaan filter-toolbar.css memberi radius 10px lewat
           .ftb-actions > .sk__menuWrap > button.ftb-btn--iconOnlyMobile
           (spesifisitas 0,3,1) — sengaja dibedakan dari kapsul kolom cari.
           Aturan lingkaran .ftb-mobile-inlineActions (0,2,1) kalah darinya
           karena DOM aslinya masih melewati pembungkus .ftb-actions. Satu kelas
           tambahan di selektor bawah membuatnya (0,4,1), jadi menang tanpa
           bergantung pada urutan penyisipan CSS. */
        @media (max-width: 639px) {
          :global(.ftb-actions) > .sk__menuWrap > button.sk__btnActionMenu.ftb-btn--iconOnlyMobile {
            border-radius: 50% !important;
          }
        }

        .lb__bar { display: flex; gap: 10px; flex-wrap: nowrap; align-items: center; }
        .lb__row1 { display: flex; gap: 10px; align-items: center; flex: 1; }
        .lb__row2 { display: flex; gap: 10px; align-items: center; }
        .lb__search { position: relative; flex: 2 1 300px; }
        .lb__search i { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #3b82f6; pointer-events: none; font-size: 0.85rem; }
        .lb__search input { width: 100%; padding: 9px 12px 9px 32px; border: 2px solid rgba(59,130,246,0.5); border-radius: 12px; background: var(--n-card); font-weight: 500; font-size: 0.9rem; color: var(--n-text); outline: none; transition: border-color 0.15s; }
        .lb__search input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        .lb__filterSelect {
            width: 140px;
            padding: 9px 32px 9px 12px;
            border: 2px solid rgba(59,130,246,0.5);
            border-radius: 12px;
            background: var(--n-card);
            font-weight: 600;
            font-size: 0.88rem;
            cursor: pointer;
            color: var(--n-text);
            outline: none;
            transition: border-color 0.15s;
            appearance: none;
            -webkit-appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%233b82f6' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 11px center;
        }
        .lb__filterSelect:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        select { width: 120px; padding: 8px 10px; border: 1.5px solid rgba(59,130,246,0.35); border-radius: 12px; background: var(--n-card); font-weight: 500; font-size: 0.9rem; cursor: pointer; }
        .lb__btn { padding: 10px 16px; height: 42px; }
        @media (max-width: 768px) {
            .lb__bar {
                flex-direction: column;
                gap: 12px;
            }
            .lb__row1 {
                flex-direction: row;
                gap: 8px;
            }
            .lb__row2 {
                flex-direction: row;
                gap: 6px;
            }
            .lb__row2 .lb__btn {
                flex: 1;
                height: 44px;
                padding: 10px 12px;
                justify-content: center;
                min-width: 0;
            }
            .lb__row2 .lb__btn span {
                font-size: 0.75rem;
            }
            .lb__search {
                flex: 1;
            }
            select {
                width: 120px;
            }
        }

        .lb__btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 38px;
            padding: 8px 12px;
            border-radius: 12px;
            border: 1px solid var(--lb-line);
            background: rgba(255, 255, 255, 0.78);
            color: rgba(7, 22, 46, 0.9);
            font-weight: 650;
            cursor: pointer;
            font-size: var(--lb-fs);
            transition: transform 0.15s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            white-space: nowrap;
        }
        .lb__btn:hover {
            /* background: rgba(255, 255, 255, 0.92); removed */
            border-color: rgba(58, 166, 255, 0.25);
            box-shadow: 0 4px 12px rgba(58, 166, 255, 0.2);
            transform: translateY(-2px);
            filter: brightness(1.1);
        }
        .lb__btn:active { transform: translateY(0); }

        .lb__btnPrimary {
          background: linear-gradient(135deg, rgba(58, 166, 255, 0.92), rgba(15, 42, 86, 0.92));
          border-color: rgba(58, 166, 255, 0.32);
          color: #fff;
          font-weight: 700;
        }

        .lb__btnExport {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
          border-color: rgba(16, 185, 129, 0.28);
          color: #fff;
        }

        .lb__btnImport {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.92), rgba(15, 42, 86, 0.86));
          border-color: rgba(245, 158, 11, 0.28);
          color: #fff;
        }

        .lb__btnGhost { background: transparent; color: var(--n-muted); border: 1px solid #cbd5e1; }

        /* Jam Ke Multiselect Filter */
        .lb__jamFilter { min-width: 200px; }
        .lb__jamBtn {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #1e293b;
            border-radius: 12px;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: #f1f5f9;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(30, 41, 59, 0.15);
        }
        .lb__jamBtn:hover {
            background: linear-gradient(135deg, #334155 0%, #475569 100%);
            box-shadow: 0 4px 12px rgba(30, 41, 59, 0.25);
            transform: translateY(-1px);
        }
        .lb__jamBtn span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
            text-align: left;
        }
        .lb__jamBtn i {
            font-size: 0.8rem;
            margin-left: 8px;
            flex-shrink: 0;
        }
        .lb__jamDropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--n-card);
            border: 2px solid #1e293b;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(30, 41, 59, 0.2);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
            margin-top: 4px;
        }
        .lb__jamOption {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            cursor: pointer;
            transition: background 0.15s ease;
            border-bottom: 1px solid var(--n-border);
        }
        .lb__jamOption:last-child {
            border-bottom: none;
        }
        .lb__jamOption:hover {
            background: var(--n-soft);
        }
        .lb__jamOption input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: var(--n-text);
            cursor: pointer;
        }
        .lb__jamOption span {
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--n-text);
            flex: 1;
        }
        .lb__jamOption input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Table */
        .lb__tableWrap { border-radius: 16px; overflow: hidden; border: 1px solid var(--lb-line); box-shadow: var(--lb-shadow2); background: var(--n-card); }
        .lb__table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .lb__table th { background: var(--n-soft); padding: 12px 14px; text-align: left; font-weight: 700; color: #0f2a56; border-bottom: 1px solid var(--lb-line); position: sticky; top: 0; }
        .lb__table td { padding: 12px 14px; border-bottom: 1px solid var(--n-border); vertical-align: middle; color: var(--n-text); }
        .lb__rowActions { display: flex; gap: 7px; justify-content: flex-end; }
        .lb__iconBtn { 
            width: 34px; height: 34px; border-radius: 11px; 
            border: 1px solid rgba(148, 163, 184, 0.22); 
            background: rgba(255, 255, 255, 0.9); 
            display: flex; align-items: center; justify-content: center; 
            cursor: pointer; color: rgba(7, 22, 46, 0.9);
            transition: transform 0.15s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .lb__iconBtn:hover { 
            background: rgba(255, 255, 255, 0.92); 
            border-color: rgba(58, 166, 255, 0.24); 
            box-shadow: var(--lb-shadow2); 
            transform: translateY(-1px);
        }
        .lb__iconBtn.danger:hover { background: rgba(239, 68, 68, 0.06); color: rgba(220, 38, 38, 1); border-color: rgba(239, 68, 68, 0.18); }
        .lb__iconBtn.danger {
            color: rgba(220, 38, 38, 1);
            border-color: rgba(239, 68, 68, 0.18);
            background: rgba(239, 68, 68, 0.06);
        }

        .tCenter { text-align: center; }
        .tMono { font-family: monospace; }

        /* Badge lingkup libur */
        .lb__scope {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 650;
            line-height: 1.4;
            background: rgba(148, 163, 184, 0.14);
            border: 1px solid rgba(148, 163, 184, 0.28);
            color: rgba(7, 22, 46, 0.78);
        }
        .lb__scope i { font-size: 0.8rem; }
        .lb__scope--tingkat {
            background: rgba(245, 158, 11, 0.12);
            border-color: rgba(245, 158, 11, 0.3);
            color: #b45309;
        }
        .lb__scope--kelas {
            background: rgba(59, 130, 246, 0.12);
            border-color: rgba(59, 130, 246, 0.3);
            color: #1d4ed8;
        }

        /* Pemilih lingkup di modal */
        .lb__scopeTabs {
            display: flex;
            gap: 6px;
            padding: 4px;
            border-radius: 12px;
            background: rgba(148, 163, 184, 0.12);
            border: 1px solid var(--lb-line);
        }
        .lb__scopeTab {
            flex: 1;
            padding: 9px 10px;
            border: none;
            border-radius: 9px;
            background: transparent;
            font-size: 0.82rem;
            font-weight: 650;
            color: var(--n-muted);
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
            white-space: nowrap;
        }
        .lb__scopeTab:hover { color: var(--n-text); }
        .lb__scopeTab.is-active {
            background: var(--n-card);
            color: #1d4ed8;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
        }
        .lb__scopeHint {
            margin: 0;
            font-size: 0.78rem;
            color: var(--n-muted);
            line-height: 1.5;
            text-transform: none;
            font-weight: 500;
        }
        
        .sk__readInput {
          display: flex;
          align-items: center;
          width: 100%;
          min-height: 42px;
          padding: 8px 12px;
          background: rgba(248, 250, 252, 0.85);
          border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 10px;
          color: var(--n-text, #0f172a);
          font-size: var(--sk-fs-sm, 0.85rem);
          box-sizing: border-box;
        }

        .sk__cardCompact {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .sk__cardCompact:hover,
        .sk__cardCompact:active {
          border-color: var(--n-primary, #3083FF);
          box-shadow: 0 4px 12px rgba(0, 56, 168, 0.08);
          transform: translateY(-1px);
        }

        .sk__cardCompactLeft {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }

        .sk__cardCompactLeft .sk__cardName {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--n-text, #0f172a);
          line-height: 1.25;
        }

        .sk__cardCompactLeft .sk__cardNip {
          font-size: 0.78rem;
          color: var(--n-muted, #64748b);
          font-weight: 500;
        }

        .sk__cardCompactRight {
          flex-shrink: 0;
          margin-left: 12px;
        }

        .sk__viewBtn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid var(--n-border, #e2e8f0);
          background: #ffffff;
          color: var(--n-primary, #3083FF);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .sk__viewBtn:hover,
        .sk__viewBtn:active {
          background: #3083FF;
          border-color: #3083FF;
          color: #ffffff;
          transform: scale(1.05);
        }

        /* Mobile Cards */
        .lb__cards { display: none; flex-direction: column; gap: 10px; }

        @media (max-width: 768px) {
            .lb__tableWrap { display: none; }
            .lb__cards { display: flex; }
            .lb {
                padding: 0;
                padding-bottom: calc(16px + var(--lb-safe-b));
                background: transparent;
                border-radius: 0;
            }
        }

        /* Modal */
        .lb__modalOverlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(8px);
            padding: 20px;
            animation: fadeIn 0.2s ease-out;
        }
        .lb__modal {
            background: var(--n-card);
            width: 100%;
            max-width: 520px;
            border-radius: 24px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 90vh;
            box-shadow: 0 25px 50px rgba(0,0,0,0.25);
            animation: slideIn 0.3s ease-out;
        }
        .lb__modalHead {
            padding: 24px 28px;
            border-bottom: 1px solid var(--n-border);
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .lb__modalTitle h2 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 800;
            color: var(--n-text);
            letter-spacing: -0.025em;
        }
        .lb__modalTitle p {
            margin: 4px 0 0 0;
            font-size: 0.875rem;
            color: var(--n-muted);
            font-weight: 500;
        }
        .lb__close {
            background: none;
            border: none;
            font-size: 1.25rem;
            cursor: pointer;
            color: var(--n-muted);
            padding: 8px;
            border-radius: 8px;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .lb__close:hover {
            background: rgba(148, 163, 184, 0.1);
            color: var(--n-muted);
        }
        .lb__modalBody {
            padding: 28px;
            overflow-y: auto;
            background: var(--n-card);
        }
        .lb__modalFoot {
            padding: 20px 28px;
            border-top: 1px solid var(--n-border);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: var(--n-soft);
        }

        .lb__grid2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .lb__field {
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .lb__field label {
            font-size: 0.72rem;
            font-weight: 500;
            color: var(--n-ink, #475569);
            letter-spacing: normal;
            text-transform: none;
        }
        .lb__field input,
        .lb__field select,
        .lb__field textarea {
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            background: var(--n-card);
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--n-text);
            transition: all 0.2s ease;
            outline: none;
        }
        .lb__field input:focus,
        .lb__field select:focus,
        .lb__field textarea:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .lb__field textarea {
            min-height: 100px;
            resize: vertical;
            line-height: 1.5;
        }
        .lb__field select {
            cursor: pointer;
        }

        @media (max-width: 768px) {
            .lb__modalOverlay {
                padding: 16px;
                align-items: flex-end;
            }
            .lb__modal {
                max-width: none;
                border-radius: 20px 20px 0 0;
                max-height: 85vh;
            }
            .lb__modalHead {
                padding: 20px 24px;
            }
            .lb__modalTitle h2 {
                font-size: 1.125rem;
            }
            .lb__modalBody {
                padding: 24px;
            }
            .lb__modalFoot {
                padding: 16px 24px;
                flex-direction: column-reverse;
                gap: 8px;
            }
            .lb__modalFoot button {
                width: 100%;
                justify-content: center;
            }
            .lb__grid2 {
                grid-template-columns: 1fr;
                gap: 12px;
            }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: scale(0.95) translateY(-10px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        /* Delete Confirmation Modal */
        .lb__modalOverlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: fadeIn 0.2s ease-out;
        }
        .lb__delModal {
            background: var(--n-card, white);
            border-radius: 24px;
            width: 100%;
            max-width: 420px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3), 0 8px 20px rgba(0, 0, 0, 0.15);
            animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid var(--lb-line, rgba(148,163,184,0.22));
        }
        .lb__delModalHead {
            padding: 24px 28px 20px;
            display: flex;
            align-items: flex-start;
            gap: 14px;
            background: linear-gradient(135deg, #fef2f2 0%, #fff 60%);
            border-bottom: 1px solid rgba(239, 68, 68, 0.1);
            position: relative;
        }
        :global(.dark) .lb__delModalHead {
            background: linear-gradient(135deg, rgba(239,68,68,0.08) 0%, var(--n-elevated) 60%);
            border-bottom-color: rgba(239, 68, 68, 0.15);
        }
        .lb__delIconWrap {
            width: 48px;
            height: 48px;
            min-width: 48px;
            border-radius: 14px;
            background: linear-gradient(135deg, #dc2626, #ef4444);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.25rem;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
        }
        .lb__delModalTitle {
            flex: 1;
        }
        .lb__delModalTitle h2 {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 800;
            color: var(--n-text);
            letter-spacing: -0.02em;
        }
        .lb__delModalTitle p {
            margin: 3px 0 0;
            font-size: 0.82rem;
            color: var(--n-muted);
            font-weight: 500;
        }
        :global(.dark) .lb__delModalTitle h2 { color: var(--n-ink); }
        :global(.dark) .lb__delModalTitle p { color: var(--n-muted); }
        .lb__delModalBody {
            padding: 20px 28px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .lb__delWarning {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 14px;
            background: rgba(59, 130, 246, 0.08);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 12px;
            font-size: 0.84rem;
            color: #3b82f6;
            line-height: 1.5;
        }
        :global(.dark) .lb__delWarning {
            background: rgba(59, 130, 246, 0.1);
            border-color: rgba(59, 130, 246, 0.25);
            color: #93c5fd;
        }
        .lb__delWarning i { font-size: 1rem; margin-top: 1px; flex-shrink: 0; }
        .lb__delCaution {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            background: rgba(220, 38, 38, 0.06);
            border: 1px solid rgba(220, 38, 38, 0.18);
            border-radius: 12px;
            font-size: 0.84rem;
            color: #dc2626;
            font-weight: 600;
        }
        :global(.dark) .lb__delCaution {
            background: rgba(220, 38, 38, 0.1);
            border-color: rgba(220, 38, 38, 0.25);
            color: #f87171;
        }
        .lb__delCaution i { font-size: 1rem; flex-shrink: 0; }
        .lb__delModalFoot {
            padding: 16px 28px 24px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .lb__delModalFoot .lb__btnGhost { flex: 1; justify-content: center; }
        .lb__delModalFoot .lb__btnDanger {
            flex: 2;
            justify-content: center;
            background: linear-gradient(135deg, #dc2626, #ef4444);
            border-color: rgba(220, 38, 38, 0.4);
            color: white;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }
        .lb__delModalFoot .lb__btnDanger:hover {
            background: linear-gradient(135deg, #b91c1c, #dc2626);
            box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
            transform: translateY(-2px);
        }
        .lb__delModalFoot .lb__btnDanger:disabled {
            opacity: 0.55;
            transform: none;
            cursor: not-allowed;
        }
        /* Spinner */
        .lb__spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.4);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
            margin-right: 6px;
            vertical-align: middle;
        }

        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.92) translateY(10px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .lb__modalOverlay {
                padding: 16px;
                align-items: flex-end;
            }
            .lb__delModal {
                border-radius: 20px 20px 0 0;
                max-width: none;
            }
            .lb__delModalHead { padding: 20px 24px 16px; }
            .lb__delModalBody { padding: 16px 24px; }
            .lb__delModalFoot {
                padding: 12px 24px 24px;
                flex-direction: column-reverse;
                gap: 8px;
            }
            .lb__delModalFoot .lb__btnGhost,
            .lb__delModalFoot .lb__btnDanger { flex: unset; width: 100%; justify-content: center; }
        }

        /* Sheet */
        .lb__sheetOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; align-items: flex-end; }
        .lb__sheet { background: var(--n-card); width: 100%; border-radius: 20px 20px 0 0; padding: 20px; animation: slideUp 0.2s; }
        .lb__sheetHandle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 99px; margin: 0 auto 20px auto; }
        .lb__sheetTitle { text-align: center; margin-bottom: 24px; }
        .lb__sheetName { font-weight: 800; font-size: 1.2rem; color: var(--n-text); }
        .lb__sheetActions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .lb__sheetBtn { background: var(--n-surface); border: none; padding: 14px; border-radius: 12px; font-weight: 600; color: var(--n-text); display: flex; align-items: center; justify-content: center; gap: 8px; }
        .lb__sheetBtn.danger { color: #ef4444; background: #fef2f2; }
        .lb__sheetCancel { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid var(--n-border); background: var(--n-card); font-weight: 700; color: var(--n-text); }

        :global(.dark) .lb__sheetBtn { background: var(--n-card); color: var(--n-ink); }
        :global(.dark) .lb__sheetBtn.danger { background: #4c0519; color: #fb7185; }
        :global(.dark) .lb__sheetCancel { background: var(--n-card); color: var(--n-ink); }
        :global(.dark) .lb__modalBody { background: var(--n-card); }
        :global(.dark) .lb__field textarea { background: var(--n-card); color: var(--n-ink); }

        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      /* ===== DARK MODE FULL ===== */
/* ROOT CONTAINER */
:global(.dark) .lb { background: transparent !important; }
/* TOOLBAR */
:global(.dark) .lb__search input { background: #000000 !important; border: 2px solid rgba(59, 130, 246, 0.5) !important; color: #f1f5f9 !important; }
:global(.dark) .lb__search input:focus { border-color: #3b82f6 !important; }
:global(.dark) .lb__search i { color: #3b82f6 !important; }
:global(.dark) .lb__filterSelect {
    background-color: #000000 !important;
    border: 2px solid rgba(59, 130, 246, 0.5) !important;
    color: #f1f5f9 !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2360a5fa' d='M6 8L1 3h10z'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 11px center !important;
}
:global(.dark) .lb__filterSelect:focus { border-color: #3b82f6 !important; }
:global(.dark) select { background: #000000 !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; color: #f1f5f9 !important; }
/* BUTTONS */
:global(.dark) .lb__btn { background: #000000 !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; color: #f1f5f9 !important; }
:global(.dark) .lb__btn:hover { background: rgba(37, 99, 235, 0.15) !important; border-color: #3b82f6 !important; }
:global(.dark) .lb__btnPrimary { background: #1a73e8 !important; border-color: #3b82f6 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important; }
:global(.dark) .lb__btnPrimary:hover { background: #1565c0 !important; }
:global(.dark) .lb__btnExport { background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9)) !important; border-color: rgba(16, 185, 129, 0.4) !important; color: #fff !important; }
:global(.dark) .lb__btnImport { background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(180, 83, 9, 0.9)) !important; border-color: rgba(245, 158, 11, 0.4) !important; color: #fff !important; }
:global(.dark) .lb__btnGhost { background: #000000 !important; color: #94a3b8 !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; }
:global(.dark) .lb__btnGhost:hover { background: rgba(37, 99, 235, 0.15) !important; color: #f1f5f9 !important; }
:global(.dark) .lb__btnDanger { background: linear-gradient(135deg, #dc2626, #ef4444) !important; border-color: rgba(220, 38, 38, 0.4) !important; color: white !important; }
/* TABLE */
:global(.dark) .lb__tableWrap { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__table th { background: rgba(26, 115, 232, 0.1) !important; color: #93c5fd !important; border-bottom: 1.5px solid rgba(59, 130, 246, 0.25) !important; }
:global(.dark) .lb__table td { background: #000000 !important; color: #f1f5f9 !important; border-bottom: 1px solid rgba(59, 130, 246, 0.15) !important; }
:global(.dark) .lb__table tr:hover td { background: rgba(26, 115, 232, 0.06) !important; }
:global(.dark) .lb__iconBtn { background: rgba(37, 99, 235, 0.12) !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; color: #93c5fd !important; }
:global(.dark) .lb__iconBtn:hover { background: #1a73e8 !important; border-color: #3b82f6 !important; color: #ffffff !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.4) !important; }
:global(.dark) .lb__iconBtn.danger { color: #f87171 !important; border: 1.5px solid rgba(239, 68, 68, 0.35) !important; background: rgba(239, 68, 68, 0.1) !important; }
:global(.dark) .lb__iconBtn.danger:hover { background: #ef4444 !important; color: white !important; border-color: #ef4444 !important; }
/* CARDS (mobile) */
:global(.dark) .sk__readInput {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
  color: #ffffff !important;
}

:global(.dark) .sk__cardCompact {
  background: #000000 !important;
  border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
}
:global(.dark) .sk__cardCompact:hover,
:global(.dark) .sk__cardCompact:active {
  border-color: #60a5fa !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
}
:global(.dark) .sk__cardCompactLeft .sk__cardName {
  color: #ffffff !important;
}
:global(.dark) .sk__cardCompactLeft .sk__cardNip {
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

:global(.dark) .lb__card { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__cardName { color: #f1f5f9 !important; }
:global(.dark) .lb__cardSub { color: #94a3b8 !important; }
:global(.dark) .lb__cardBody { color: #f1f5f9 !important; }
:global(.dark) .lb__k { color: #94a3b8 !important; }
:global(.dark) .lb__v { color: #f1f5f9 !important; }
:global(.dark) .lb__moreBtn { color: #94a3b8 !important; }
/* MODAL */
:global(.dark) .lb__modal { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__modalHead { background: rgba(26, 115, 232, 0.08) !important; border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__modalTitle h2 { color: #f1f5f9 !important; }
:global(.dark) .lb__modalTitle p { color: #94a3b8 !important; }
:global(.dark) .lb__close { color: #94a3b8 !important; }
:global(.dark) .lb__close:hover { background: rgba(37, 99, 235, 0.15) !important; color: #f1f5f9 !important; }
:global(.dark) .lb__modalBody { background: #000000 !important; }
:global(.dark) .lb__modalFoot { background: rgba(26, 115, 232, 0.06) !important; border-top: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__field input,
:global(.dark) .lb__field select,
:global(.dark) .lb__field textarea { background: #000000 !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; color: #f1f5f9 !important; }
:global(.dark) .lb__field label { color: #93c5fd !important; }
/* LINGKUP */
:global(.dark) .lb__scope { background: rgba(148,163,184,0.14) !important; border-color: rgba(148,163,184,0.3) !important; color: #cbd5e1 !important; }
:global(.dark) .lb__scope--tingkat { background: rgba(245,158,11,0.14) !important; border-color: rgba(245,158,11,0.35) !important; color: #fbbf24 !important; }
:global(.dark) .lb__scope--kelas { background: rgba(59,130,246,0.16) !important; border-color: rgba(59,130,246,0.35) !important; color: #93c5fd !important; }
:global(.dark) .lb__scopeTabs { background: rgba(26,115,232,0.08) !important; border: 1.5px solid rgba(59,130,246,0.3) !important; }
:global(.dark) .lb__scopeTab { color: #94a3b8 !important; }
:global(.dark) .lb__scopeTab.is-active { background: #1a73e8 !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(26,115,232,0.35) !important; }
:global(.dark) .lb__scopeHint { color: #94a3b8 !important; }
/* DELETE MODAL */
:global(.dark) .lb__delModal { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__delModalHead { background: rgba(220, 38, 38, 0.08) !important; border-bottom-color: rgba(239, 68, 68, 0.2) !important; }
:global(.dark) .lb__delModalBody { background: #000000 !important; }
:global(.dark) .lb__delModalFoot { background: #000000 !important; border-top: 1px solid rgba(59, 130, 246, 0.2) !important; }
/* JAM KE DROPDOWN */
:global(.dark) .lb__jamBtn { background: #000000 !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; color: #f1f5f9 !important; }
:global(.dark) .lb__jamDropdown { background: #000000 !important; border: 1.5px solid rgba(59, 130, 246, 0.35) !important; }
:global(.dark) .lb__jamOption { border-bottom-color: rgba(59, 130, 246, 0.15) !important; }
:global(.dark) .lb__jamOption:hover { background: rgba(26, 115, 232, 0.1) !important; }
:global(.dark) .lb__jamOption span { color: #f1f5f9 !important; }
:global(.dark) .lb__jamOption input[type="checkbox"] { accent-color: #1a73e8 !important; }
/* SHEET (mobile action sheet) */
:global(.dark) .lb__sheet { background: #000000 !important; border-top: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__sheetHandle { background: rgba(59, 130, 246, 0.4) !important; }
:global(.dark) .lb__sheetName { color: #f1f5f9 !important; }
:global(.dark) .lb__sheetSub { color: #94a3b8 !important; }
:global(.dark) .lb__sheetBtn { background: rgba(26, 115, 232, 0.1) !important; color: #f1f5f9 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
:global(.dark) .lb__sheetBtn.danger { background: rgba(239, 68, 68, 0.1) !important; color: #f87171 !important; border-color: rgba(239, 68, 68, 0.3) !important; }
:global(.dark) .lb__sheetCancel { background: #000000 !important; color: #94a3b8 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
/* REACT-SELECT (control inside modal, inherits background from parent) */
.lb__modalBody .lb-select__control {
    background: #000000 !important;
    border: 1.5px solid rgba(59, 130, 246, 0.35) !important;
    color: #f1f5f9 !important;
}
.lb__modalBody .lb-select__single-value,
.lb__modalBody .lb-select__input-container,
.lb__modalBody .lb-select__placeholder { color: #f1f5f9 !important; }
.lb__modalBody .lb-select__multi-value { background: rgba(26,115,232,0.2) !important; }
.lb__modalBody .lb-select__multi-value__label { color: #93c5fd !important; }
/* REACT-SELECT MENU PORTAL (rendered in body, need :global) */
:global(.dark) .lb-select__menu {
    background: #000000 !important;
    border: 1.5px solid rgba(59, 130, 246, 0.35) !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.8), 0 0 15px rgba(26,115,232,0.15) !important;
    border-radius: 12px !important;
    color: #f1f5f9 !important;
}
:global(.dark) .lb-select__menu-list { background: #000000 !important; }
:global(.dark) .lb-select__option {
    background: transparent !important;
    color: #f1f5f9 !important;
}
:global(.dark) .lb-select__option--is-focused {
    background: rgba(26, 115, 232, 0.15) !important;
    color: #f1f5f9 !important;
}
:global(.dark) .lb-select__option--is-selected {
    background: rgba(26, 115, 232, 0.3) !important;
    color: #93c5fd !important;
}
:global(.dark) .lb-select__control {
    background: #000000 !important;
    border: 1.5px solid rgba(59, 130, 246, 0.35) !important;
    color: #f1f5f9 !important;
}
:global(.dark) .lb-select__single-value { color: #f1f5f9 !important; }
:global(.dark) .lb-select__placeholder { color: #94a3b8 !important; }
:global(.dark) .lb-select__input-container { color: #f1f5f9 !important; }
:global(.dark) .lb-select__indicator { color: #94a3b8 !important; }
:global(.dark) .lb-select__indicator:hover { color: #f1f5f9 !important; }
:global(.dark) .lb-select__indicator-separator { background: rgba(59,130,246,0.3) !important; }
:global(.dark) .lb-select__multi-value { background: rgba(26,115,232,0.2) !important; }
:global(.dark) .lb-select__multi-value__label { color: #93c5fd !important; }
:global(.dark) .lb-select__multi-value__remove { color: #93c5fd !important; }
:global(.dark) .lb-select__multi-value__remove:hover { background: #1a73e8 !important; color: white !important; }

`}</style>
    </div>
  )
}
