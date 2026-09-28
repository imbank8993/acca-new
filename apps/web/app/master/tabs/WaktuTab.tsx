'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { exportToExcel } from '@/lib/excel-utils'
import Pagination from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import Swal from 'sweetalert2'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalViewFooter } from '@/components/ui/Modal'
import ImportModal from '@/components/ui/ImportModal'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { useMasterAccess } from '@/lib/use-master-access'

interface Waktu {
  id: number;
  hari: string;
  program: string;
  jam_ke: number;
  mulai: string;
  selesai: string;
  is_istirahat: boolean;
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DEFAULT_PROGRAM_LIST = ['Reguler', 'UTBK'];

export default function WaktuTab({ user }: { user?: any }) {
  const [allData, setAllData] = useState<Waktu[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredData = useMemo(() => {
    if (!searchTerm) return allData;
    const lower = searchTerm.toLowerCase();
    return allData.filter(w => 
      (w.hari || '').toLowerCase().includes(lower) || 
      (w.program || '').toLowerCase().includes(lower) ||
      String(w.jam_ke).includes(lower) ||
      (w.is_istirahat ? 'istirahat' : 'kbm').includes(lower)
    )
  }, [allData, searchTerm])

  const totalItems = filteredData.length

  // Computed paginated list
  const waktuList = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredData.slice(start, end)
  }, [filteredData, currentPage, pageSize])

  // Filtering
  const [filterProgram, setFilterProgram] = useState('Semua Program')
  const [filterHari, setFilterHari] = useState('Semua')

  // Program mengikuti data master kelas (termasuk Peminatan/UTBK bila ada kelasnya)
  const [kelasPrograms, setKelasPrograms] = useState<string[]>([])

  const programList = useMemo(() => {
    const set = new Set<string>(kelasPrograms.length > 0 ? kelasPrograms : DEFAULT_PROGRAM_LIST)
    allData.forEach(w => { if (w.program) set.add(w.program) })
    return Array.from(set).sort((a, b) => {
      if (a === 'Reguler') return -1
      if (b === 'Reguler') return 1
      return a.localeCompare(b, 'id')
    })
  }, [kelasPrograms, allData])

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // View Detail Modal State
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedWaktu, setSelectedWaktu] = useState<Waktu | null>(null)

  const handleView = (waktu: Waktu) => {
    setSelectedWaktu(waktu)
    setShowViewModal(true)
  }

  // Import State
  const [showImportModal, setShowImportModal] = useState(false)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    if (showModal || showImportModal || showDeleteModal) {
      return registerModal()
    }
  }, [showModal, showImportModal, showDeleteModal, registerModal])

  const [formData, setFormData] = useState<Partial<Waktu>>({
    hari: 'Senin',
    program: 'Reguler',
    jam_ke: 1,
    mulai: '07:00:00',
    selesai: '07:40:00',
    is_istirahat: false
  })

  useEffect(() => {
    setCurrentPage(1)
    fetchWaktu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProgram, filterHari])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])



  useEffect(() => {
    fetchKelasPrograms()
  }, [])

  const fetchKelasPrograms = async () => {
    try {
      const res = await fetch('/api/master/kelas?page=1&limit=10000')
      const json = await res.json()
      if (json.ok) {
        const set = new Set<string>()
        ;(json.data || []).forEach((k: any) => { if (k.program) set.add(k.program) })
        setKelasPrograms(Array.from(set))
      }
    } catch (err) {
      console.error('Error fetching program kelas:', err)
    }
  }

  // Permissions Check
  const permissions = user?.permissions || []
  // Gerbangnya mengikuti backend (MasterController.resolveFlags): Admin ATAU
  // pemegang halaman `master`. Sebelumnya di sini hanya role ADMIN, sehingga
  // operator yang sah diberi halaman ini melihat layar tanpa satu tombol pun.
  // `isAdmin` dipertahankan sebagai nama untuk JSX di bawah.
  // `canManage` = ADMIN atau yang ditunjuk di Hak Akses Fitur.
  // `isAdminRole` khusus aksi yang TIDAK pernah diberikan lewat layar itu.
  const { boleh, isAdmin: isAdminRole } = useMasterAccess()
  const isAdmin = boleh('waktu')
  const canManage = isAdmin

  const canView = true;

  const fetchWaktu = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        program: filterProgram === 'Semua Program' ? '' : filterProgram,
        hari: filterHari === 'Semua' ? '' : filterHari,
        page: '1',
        limit: '10000'
      })

      const res = await fetch(`/api/master/waktu?${params}`, { cache: 'no-store' })
      const json = await res.json()

      if (json.ok) {
        setAllData(json.data || [])
      }
    } catch (err) {
      console.error('Error fetching waktu:', err)
      setAllData([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = () => {
    const currentHari = filterHari === 'Semua' ? 'Senin' : filterHari;
    const currentProgram = filterProgram === 'Semua Program' ? 'Reguler' : filterProgram;
    const relevantList = allData.filter(w => w.hari === currentHari && w.program === currentProgram);
    const maxJam = relevantList.length > 0 ? Math.max(...relevantList.map(w => w.jam_ke)) : 0;

    setFormData({
      hari: currentHari,
      program: currentProgram,
      jam_ke: maxJam + 1,
      mulai: '07:00',
      selesai: '07:40',
      is_istirahat: false
    })
    setIsEditMode(false)
    setShowModal(true)
  }

  const handleEdit = (waktu: Waktu) => {
    setFormData({ ...waktu })
    setIsEditMode(true)
    setShowModal(true)
  }

  const handleDelete = (id: number, name: string) => {
    setDeleteItemId(id)
    setDeleteItemName(name)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteItemId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/master/waktu?id=${deleteItemId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        setShowDeleteModal(false)
        setDeleteItemId(null)
        setDeleteItemName('')
        fetchWaktu()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await saveWaktu(formData as Waktu, isEditMode);
      setShowModal(false)
      fetchWaktu()
      alert(`Data waktu berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}`)
    } catch (err: any) {
      console.error('Error saving waktu:', err)
      alert(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  const saveWaktu = async (data: Waktu, isUpdate: boolean, upsert: boolean = false) => {
    if (!data.mulai || !data.selesai) {
      throw new Error('Jam Mulai dan Selesai harus diisi');
    }

    const method = isUpdate ? 'PUT' : 'POST'
    let url = '/api/master/waktu'
    if (upsert) url += '?upsert=true'

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    const json = await res.json()
    if (!json.ok) {
      throw new Error(json.error)
    }
    return json;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleExport = () => {
    const dataToExport = waktuList.map((w, index) => ({
      'No': (currentPage - 1) * pageSize + index + 1,
      'Hari': w.hari || '',
      'Program': w.program || '',
      'Jam Ke': w.jam_ke || 1,
      'Waktu Mulai': w.mulai || '',
      'Waktu Selesai': w.selesai || '',
      'Jenis': w.is_istirahat ? 'Istirahat' : 'KBM'
    }))
    exportToExcel(dataToExport, `Data_Waktu_${filterProgram}_${filterHari}`, 'Waktu');
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

    const isIstirahatRaw = getVal(['Jenis', 'is_istirahat', 'Tipe']);
    const isIstirahat = isIstirahatRaw === true || String(isIstirahatRaw).toLowerCase() === 'true' || String(isIstirahatRaw).toLowerCase() === 'istirahat';

    const formatTime = (val: any): string => {
      if (val === undefined || val === null) return '00:00';

      if (typeof val === 'number') {
        let fraction = val % 1;
        if (val === 0) return '00:00';
        const totalSeconds = Math.round(fraction * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }

      const s = String(val).trim();
      const normalized = s.replace('.', ':');
      if (/^\d{1,2}:\d{2}/.test(normalized)) {
        const parts = normalized.split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }

      return normalized;
    };

    const hari = getVal(['Hari', 'hari']) || 'Senin';
    const program = getVal(['Program', 'program']) || 'Reguler';
    const jam_ke = parseInt(String(getVal(['Jam Ke', 'jam_ke']) || '1'));

    if (!hari || !program) return null;

    return {
      hari,
      program,
      jam_ke,
      mulai: formatTime(getVal(['Waktu Mulai', 'mulai', 'Mulai'])),
      selesai: formatTime(getVal(['Waktu Selesai', 'selesai', 'Selesai'])),
      is_istirahat: isIstirahat
    };
  }

  // Group for mobile: by jam_ke
  const groupedMobile = useMemo(() => {
    const map = new Map<string, Waktu[]>()
      ; (waktuList || []).forEach((it) => {
        const key = it.is_istirahat ? 'Istirahat' : `Jam ${it.jam_ke}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(it)
      })
    const entries = Array.from(map.entries())
    return entries
  }, [waktuList])

  return (
    <div className="sk">
      {/* ===== Filter Bar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari waktu..."
          label="Cari Waktu"
        />

        <FilterSelect
          label="Hari"
          value={filterHari}
          onChange={setFilterHari}
        >
          <option value="Semua">Semua Hari</option>
          {HARI_LIST.map(hari => <option key={hari} value={hari}>{hari}</option>)}
        </FilterSelect>

        <FilterSelect
          label="Program"
          value={filterProgram}
          onChange={setFilterProgram}
        >
          <option value="Semua Program">Semua Program</option>
          {programList.map(prog => <option key={prog} value={prog}>{prog}</option>)}
        </FilterSelect>

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
              <th className="cProgram">Program</th>
              <th className="cHari">Hari</th>
              <th className="cJam">Jam Ke</th>
              <th className="cMulai">Waktu Mulai</th>
              <th className="cSelesai">Waktu Selesai</th>
              <th className="cTipe">Tipe</th>
              {canManage && <th className="cAksi">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {!canView ? (
              <tr>
                <td colSpan={8} className="sk__empty sk__muted">
                  Anda tidak memiliki akses untuk melihat data ini.
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={8} className="sk__loadingCell">
                  <Spinner variant="buble" />
                </td>
              </tr>
            ) : waktuList.length === 0 ? (
              <tr>
                <td colSpan={8} className="sk__empty sk__muted">
                  Belum ada data untuk {filterHari} - {filterProgram}.
                </td>
              </tr>
            ) : (
              waktuList.map((waktu, index) => (
                <tr key={waktu.id} className={waktu.is_istirahat ? 'sk__rowIstirahat' : ''}>
                  <td className="tCenter">{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className="tPlain">{waktu.program}</td>
                  <td className="tPlain">{waktu.hari}</td>
                  <td className="tCenter tBold">{waktu.jam_ke}</td>
                  <td className="tCenter tMono">{waktu.mulai}</td>
                  <td className="tCenter tMono">{waktu.selesai}</td>
                  <td className="tCenter">
                    {waktu.is_istirahat ? (
                      <span className="sk__badgeIstirahat">Istirahat</span>
                    ) : (
                      <span className="sk__badgeKBM">KBM</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <ActionGroup>
                        <ActionButton action="edit" onClick={() => handleEdit(waktu)} />
                        <ActionButton action="delete" onClick={() => handleDelete(waktu.id, `${waktu.hari} - ${waktu.program} Jam ${waktu.jam_ke}`)} />
                      </ActionGroup>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile Cards (Grouped Inset List) ===== */}
      <div className="sk__cards" aria-label="Daftar Waktu versi mobile">
        {loading ? (
          <div className="sk__cardLoading" style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
            <Spinner variant="buble" />
          </div>
        ) : waktuList.length === 0 ? (
          <div className="sk__cardEmpty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--n-ink, #0f172a)', marginBottom: 2 }}>Tidak ada data</div>
            <div style={{ fontSize: '0.80rem', color: 'var(--n-muted, #64748b)' }}>Coba ubah kata kunci pencarian atau filter</div>
          </div>
        ) : (
          waktuList.map((waktu, idx) => (
            <div
              className="sk__cardCompact"
              key={`m-${waktu.id}-${idx}`}
              onClick={() => handleView(waktu)}
            >
              <div className="sk__avatar">
                {(currentPage - 1) * pageSize + idx + 1}
              </div>
              <div className="sk__cardCompactLeft">
                <div className="sk__cardName">
                  {waktu.is_istirahat ? 'Istirahat' : `Jam ke-${waktu.jam_ke}`} · {waktu.hari}
                </div>
                <div className="sk__cardNip">
                  <span>{waktu.mulai} - {waktu.selesai} · {waktu.program}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Aksi utama tab: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
      {isAdmin && <DesktopFab label="Tambah Waktu" icon="plus-lg" onClick={handleAddNew} />}
      {isAdmin && <MobileFab label="Tambah Waktu" onClick={handleAddNew} />}

      {/* ===== Pagination ===== */}
      {totalItems > 0 && (
        <Pagination itemLabel="waktu"
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

      {/* Form Modal */}
      {showModal && (
        <Modal
          size="md"
          variant={isEditMode ? 'edit' : 'add'}
          onClose={() => setShowModal(false)}
          labelledBy="waktu-modal-title"
        >
          <ModalHeader
            id="waktu-modal-title"
            icon={isEditMode ? 'pencil-square' : 'plus-lg'}
            title={isEditMode ? 'Edit Jam' : 'Tambah Jam Baru'}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody>
                <div className="sk__formInfo">
                  Menambahkan jam untuk Program <strong>{formData.program}</strong>
                </div>

                <div className="sk__field">
                  <label>Hari</label>
                  <select
                    name="hari"
                    value={formData.hari}
                    onChange={handleInputChange}
                    disabled={isEditMode}
                  >
                    {HARI_LIST.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="sk__field">
                  <label>Program</label>
                  <select
                    name="program"
                    value={formData.program}
                    onChange={handleInputChange}
                    disabled={isEditMode}
                  >
                    {programList.map(prog => <option key={prog} value={prog}>{prog}</option>)}
                  </select>
                </div>

                <div className="sk__field">
                  <label>Jam Ke- <span className="required">*</span></label>
                  <input
                    type="number"
                    name="jam_ke"
                    required
                    value={formData.jam_ke || ''}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="sk__grid2">
                  <div className="sk__field">
                    <label>Mulai</label>
                    <input
                      type="time"
                      name="mulai"
                      required
                      value={formData.mulai || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="sk__field">
                    <label>Selesai</label>
                    <input
                      type="time"
                      name="selesai"
                      required
                      value={formData.selesai || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="sk__checkboxGroup">
                  <label className="sk__checkboxLabel">
                    <input
                      type="checkbox"
                      checked={formData.is_istirahat || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_istirahat: e.target.checked }))}
                    />
                    Jam Istirahat?
                  </label>
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
      {showViewModal && selectedWaktu && (
        <Modal size="md" variant="edit" onClose={() => setShowViewModal(false)} labelledBy="waktu-view-title">
          <ModalHeader
            id="waktu-view-title"
            icon="clock"
            title="Detail Jadwal Waktu"
            subtitle="Informasi jam pelajaran dan istirahat"
            onClose={() => setShowViewModal(false)}
          />
          <ModalBody>
            <div className="sk__grid2">
              <div className="sk__field">
                <label>Hari</label>
                <div className="sk__readInput">{selectedWaktu.hari || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Program</label>
                <div className="sk__readInput">{selectedWaktu.program || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Jam Ke</label>
                <div className="sk__readInput font-bold">{selectedWaktu.jam_ke}</div>
              </div>

              <div className="sk__field">
                <label>Tipe</label>
                <div className="sk__readInput">
                  {selectedWaktu.is_istirahat ? (
                    <span className="sk__badgeIstirahat">Istirahat</span>
                  ) : (
                    <span className="sk__badgeKBM">KBM</span>
                  )}
                </div>
              </div>

              <div className="sk__field">
                <label>Waktu Mulai</label>
                <div className="sk__readInput font-mono">{selectedWaktu.mulai || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Waktu Selesai</label>
                <div className="sk__readInput font-mono">{selectedWaktu.selesai || '-'}</div>
              </div>
            </div>
          </ModalBody>
          <ModalViewFooter
            onClose={() => setShowViewModal(false)}
            onDelete={isAdmin ? () => { handleDelete(selectedWaktu.id, `${selectedWaktu.hari} - ${selectedWaktu.program} Jam ${selectedWaktu.jam_ke}`); setShowViewModal(false) } : undefined}
            onEdit={isAdmin ? () => { const toEdit = selectedWaktu; setShowViewModal(false); handleEdit(toEdit) } : undefined}
          />
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          labelledBy="waktu-delete-title"
        >
          <ModalHeader
            id="waktu-delete-title"
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
                fetchWaktu();
                setShowImportModal(false);
              }}
              templateColumns={['No', 'Hari', 'Program', 'Jam Ke', 'Waktu Mulai', 'Waktu Selesai', 'Jenis']}
              templateName="Template_Waktu"
              apiEndpoint="/api/master/waktu?upsert=true"
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

/* ========= FILTER BAR ========= */
.sk__filterBar {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px;
  background: var(--n-card);
  border: 1px solid var(--sk-line);
  border-radius: var(--sk-radius);
  box-shadow: var(--sk-shadow2);
  min-width: 0;
  flex-wrap: wrap;
}

.sk__search {
  position: relative;
  flex: 1 1 280px;
  min-width: 180px;
  margin-right: 16px;
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
  background: rgba(248, 250, 252, 0.9);
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
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.sk__filterGroup label {
  font-size: 0.82rem;
  color: rgba(100, 116, 139, 0.95);
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.sk__filterGroup select {
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  min-width: 150px;
  background: rgba(248, 250, 252, 0.9);
  color: rgba(15, 23, 42, 0.92);
  font-size: 0.95rem;
  font-weight: 500; /* Reduced from 650 */
  outline: none;
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.sk__filterGroup select:focus {
  border-color: rgba(58, 166, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14);
}

.sk__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex: 0 0 auto;
}

/* ========= ACTION MENU (MOBILE) ========= */
@media (min-width: 640px) {
  .sk__menuWrap { display: none !important; }
}

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
  min-width: 820px;
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

.sk__rowIstirahat td {
  background: rgba(239, 68, 68, 0.06) !important;
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
.cProgram { width: 110px; }
.cHari { width: 100px; }
.cJam { width: 80px; text-align: center; }
.cMulai { text-align: center; }
.cSelesai { text-align: center; }
.cTipe { width: 120px; text-align: center; }
.cAksi { width: 110px; text-align: right; }

.tCenter { text-align: center; }
.tPlain { font-weight: 400; }
.tBold { font-weight: 700; }

.tMono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: var(--sk-fs-xs);
  font-weight: 400;
}

.sk__badgeIstirahat {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.10);
  border: 1px solid rgba(239, 68, 68, 0.22);
  color: #7f1d1d;
  font-size: 0.82rem;
  font-weight: 900;
  white-space: nowrap;
}

.sk__badgeKBM {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(22, 163, 74, 0.10);
  border: 1px solid rgba(22, 163, 74, 0.22);
  color: #14532d;
  font-size: 0.82rem;
  font-weight: 900;
  white-space: nowrap;
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

.sk__formInfo {
  background: rgba(37, 99, 235, 0.08);
  color: #1e3a8a;
  padding: 12px;
  border-radius: 12px;
  font-size: 0.92rem;
  border: 1px solid rgba(37, 99, 235, 0.18);
}

/* .sk__grid2 sekarang di components/modal.css — ubah di sana, bukan di sini. */

.sk__checkboxGroup {
  display: flex;
  align-items: center;
}

.sk__checkboxLabel {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  color: rgba(15, 23, 42, 0.92);
  font-weight: 700;
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

/* ========= RESPONSIVE ========= */
.sk__tableWrap { display: block; }
.sk__cards { display: none; }

@media (max-width: 768px) {
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

  .sk__filterBar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .sk__search {
    margin-right: 0;
    width: 100%;
    flex: none;
  }

  .sk__filterGroup select {
    min-width: 0;
    width: 100%;
  }

  .sk__actions {
    width: 100%;
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
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
}

@media (max-width: 420px) {
  .sk__filterBar {
    width: 100%;
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

/* Dark mode for WaktuTab handled in globals.css */
:global(.dark) .sk__btnGhost { background: var(--n-card); color: var(--n-ink); border-color: var(--n-border); }
:global(.dark) .sk__card { background: var(--n-card); }
@keyframes zoomInDelete { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
/* ===== DARK MODE FULL ===== */
:global(.dark) .sk__tableWrap {
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
  border-radius: 16px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
  transition: all 0.2s ease !important;
}
:global(.dark) .sk__tableWrap:hover {
  border-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
}
:global(.dark) .sk__table thead th { background: rgba(37, 99, 235, 0.15) !important; color: var(--n-muted) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; }
:global(.dark) .sk__table tbody td { background: #0b1329 !important; color: var(--n-ink) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important; }
:global(.dark) .sk__table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.025) !important; }
:global(.dark) .sk__table tbody tr:hover td { background: rgba(79,142,247,0.06) !important; }

:global(.dark) .sk__search { background: rgba(255,255,255,0.05) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__search input { background: rgba(255,255,255,0.07) !important; border-color: var(--n-border) !important; color: var(--n-ink) !important; }
:global(.dark) .sk__search i { color: var(--n-muted) !important; }

:global(.dark) .sk__filterGroup label { color: var(--n-muted) !important; }
:global(.dark) .sk__filterGroup select { background: var(--n-surface) !important; border-color: var(--n-border) !important; color: var(--n-ink) !important; }

:global(.dark) .sk__btn { background: var(--n-card) !important; border-color: var(--n-border) !important; color: var(--n-ink) !important; }
:global(.dark) .sk__btn:hover { background: var(--n-elevated) !important; border-color: rgba(58,166,255,0.35) !important; color: var(--n-ink) !important; }
:global(.dark) input:disabled, :global(.dark) select:disabled, :global(.dark) textarea:disabled { background: rgba(255,255,255,0.04) !important; color: var(--n-muted) !important; }
:global(.dark) .sk__btnGhost { background: var(--n-card) !important; color: var(--n-ink) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__hint { color: var(--n-muted) !important; }
:global(.dark) .sk__formInfo { background: rgba(79,142,247,0.08) !important; color: #7aabf9 !important; }

:global(.dark) .sk__status.isOn { background: rgba(34,197,94,0.12) !important; border-color: rgba(34,197,94,0.28) !important; color: #4ade80 !important; }
:global(.dark) .sk__status.isOff { background: rgba(239,68,68,0.12) !important; border-color: rgba(239,68,68,0.28) !important; color: #f87171 !important; }
:global(.dark) .sk__badge { background: rgba(79,142,247,0.1) !important; color: #7aabf9 !important; }
:global(.dark) .sk__badgeIstirahat { background: rgba(239,68,68,0.12) !important; border-color: rgba(239,68,68,0.28) !important; color: #f87171 !important; }
:global(.dark) .sk__badgeKBM { background: rgba(34,197,94,0.12) !important; border-color: rgba(34,197,94,0.28) !important; color: #4ade80 !important; }
:global(.dark) .sk__genderBadge { color: #e8edf5 !important; }
:global(.dark) .sk__genderBadge.L { color: #38bdf8 !important; }
:global(.dark) .sk__genderBadge.P { color: #f472b6 !important; }
:global(.dark) .sk__eduBadge { color: #60a5fa !important; }

:global(.dark) .sk__iconBtn { background: var(--n-surface) !important; border-color: var(--n-border) !important; color: var(--n-muted) !important; }
:global(.dark) .sk__iconBtn:hover { background: rgba(58,166,255,0.1) !important; color: var(--n-ink) !important; }
:global(.dark) .sk__iconBtn.danger { color: rgba(239,68,68,0.7) !important; }
:global(.dark) .sk__iconBtn.danger:hover { background: rgba(239,68,68,0.12) !important; color: #f87171 !important; }

:global(.dark) .sk__group { background: rgba(255,255,255,0.04) !important; border-color: var(--n-border) !important; }
:global(.dark) .sk__groupHead { background: rgba(255,255,255,0.06) !important; }
:global(.dark) .sk__groupTitle { color: var(--n-ink) !important; }
:global(.dark) .sk__groupMeta { color: var(--n-muted) !important; }

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
:global(.dark) .sk__cardName { color: var(--n-ink) !important; }
:global(.dark) .sk__cardSub { color: var(--n-muted) !important; }

:global(.dark) .sk__k { color: var(--n-muted) !important; }
:global(.dark) .sk__v { color: var(--n-ink) !important; }

:global(.dark) .sk__muted, :global(.dark) .sk__empty { color: var(--n-muted) !important; }
:global(.dark) .sk__loadingCell { background: transparent !important; }
:global(.dark) .sk__readInput {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
  color: #ffffff !important;
}

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
  background: #0b1329 !important;
  border: 1px solid rgba(26, 115, 232, 0.35) !important;
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

:global(.dark) .sk__detailItem label { color: var(--n-muted) !important; }
:global(.dark) .sk__detailValue { color: var(--n-ink) !important; }
:global(.dark) .sk__detailValue.sk__mono { color: var(--n-ink) !important; background: rgba(79,142,247,0.1) !important; }
:global(.dark) .sk__detailValue.sk__large { color: var(--n-ink) !important; }

/* ===== END DARK MODE FULL ===== */

`}</style>
    </div>
  )
}

