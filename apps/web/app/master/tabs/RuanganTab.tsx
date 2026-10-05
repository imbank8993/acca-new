'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { exportToExcel } from '@/lib/excel-utils'
import Pagination from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import Swal from 'sweetalert2'
import ImportModal from '@/components/ui/ImportModal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalViewFooter } from '@/components/ui/Modal'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { useMasterAccess } from '@/lib/use-master-access'

export interface Ruangan {
  id: number;
  kode?: string | null;
  nama: string;
  lokasi?: string | null;
  kapasitas?: number | null;
  keterangan?: string | null;
  aktif: boolean;
}

export default function RuanganTab({ user }: { user?: any }) {
  const [allData, setAllData] = useState<Ruangan[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // View Detail Modal State
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedRuangan, setSelectedRuangan] = useState<Ruangan | null>(null)

  // Import State
  const [showImportModal, setShowImportModal] = useState(false)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleView = (ruangan: Ruangan) => {
    setSelectedRuangan(ruangan)
    setShowViewModal(true)
  }

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

  // Modal blur
  const { registerModal } = useModalBlur()

  useEffect(() => {
    if (showModal || showImportModal || showDeleteModal || showViewModal) {
      return registerModal()
    }
  }, [showModal, showImportModal, showDeleteModal, showViewModal, registerModal])

  // Filter State
  const [lokasiFilter, setLokasiFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [searchTerm, setSearchTerm] = useState('')

  const lokasiFilterOptions = useMemo(() => {
    const set = new Set<string>()
    allData.forEach(r => { if (r.lokasi) set.add(r.lokasi) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'))
  }, [allData])

  const filteredData = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    return allData.filter(r =>
      (!lokasiFilter || r.lokasi === lokasiFilter) &&
      (!statusFilter || statusFilter === 'semua' || (statusFilter === 'aktif' ? r.aktif : !r.aktif)) &&
      (!q ||
        (r.nama || '').toLowerCase().includes(q) ||
        (r.kode || '').toLowerCase().includes(q) ||
        (r.lokasi || '').toLowerCase().includes(q) ||
        (r.keterangan || '').toLowerCase().includes(q))
    )
  }, [allData, lokasiFilter, statusFilter, searchTerm])

  const totalItems = filteredData.length

  const ruanganList = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  const [formData, setFormData] = useState<Partial<Ruangan>>({
    kode: '',
    nama: '',
    lokasi: '',
    kapasitas: null,
    keterangan: '',
    aktif: true
  })

  useEffect(() => {
    fetchRuangan()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [lokasiFilter, statusFilter, searchTerm])

  // Permissions Check
  const { dapatKelola } = useMasterAccess()
  const isAdmin = dapatKelola('ruangan')
  const canManage = isAdmin
  const canView = true

  const fetchRuangan = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10000',
        show_inactive: 'true'
      })

      const res = await fetch(`/api/master/ruangan?${params}`, { cache: 'no-store' })
      const json = await res.json()

      if (json.ok) {
        setAllData(json.data || [])
      }
    } catch (err) {
      console.error('Error fetching ruangan:', err)
      setAllData([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = () => {
    setFormData({ kode: '', nama: '', lokasi: '', kapasitas: null, keterangan: '', aktif: true })
    setIsEditMode(false)
    setShowModal(true)
  }

  const handleEdit = (ruangan: Ruangan) => {
    setFormData({ ...ruangan })
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
      const res = await fetch(`/api/master/ruangan?id=${deleteItemId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        setShowDeleteModal(false)
        setDeleteItemId(null)
        setDeleteItemName('')
        fetchRuangan()
        Swal.fire('Terhapus!', 'Data ruangan berhasil dinonaktifkan.', 'success')
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
      await saveRuangan(formData as Ruangan, isEditMode)
      setShowModal(false)
      fetchRuangan()
      Swal.fire('Berhasil', `Data ruangan berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}`, 'success')
    } catch (err: any) {
      console.error('Error saving ruangan:', err)
      Swal.fire('Gagal', err.message || 'Terjadi kesalahan saat menyimpan data', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveRuangan = async (data: Ruangan, isUpdate: boolean, upsert: boolean = false) => {
    if (!data.nama?.trim()) {
      throw new Error('Nama Ruangan wajib diisi')
    }

    const payload = {
      ...data,
      nama: data.nama.trim(),
      kode: data.kode ? String(data.kode).trim() : null,
      lokasi: data.lokasi ? String(data.lokasi).trim() : null,
      kapasitas:
        data.kapasitas !== null && data.kapasitas !== undefined && String(data.kapasitas) !== ''
          ? parseInt(String(data.kapasitas), 10) || null
          : null,
      keterangan: data.keterangan ? String(data.keterangan).trim() : null,
    }

    const method = isUpdate ? 'PUT' : 'POST'
    let url = '/api/master/ruangan'
    if (upsert) url += '?upsert=true'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const json = await res.json()
    if (!json.ok) {
      throw new Error(json.error)
    }
    return json
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Excel Functions
  const handleExport = () => {
    const dataToExport = filteredData.map((r, index) => ({
      'No': index + 1,
      'Nama Ruangan': r.nama || '',
      'Kode Ruangan': r.kode || '',
      'Lokasi / Gedung': r.lokasi || '',
      'Kapasitas': r.kapasitas ?? '',
      'Keterangan': r.keterangan || '',
      'Status Aktif': r.aktif ? 'TRUE' : 'FALSE'
    }))
    exportToExcel(dataToExport, 'Data_Ruangan_ACCA', 'Ruangan')
  }

  const mapImportRow = (row: any) => {
    const getVal = (targetKeys: string[]) => {
      const normalizedTargets = targetKeys.map(k => k.toLowerCase().trim())
      const foundKey = Object.keys(row).find(k =>
        normalizedTargets.includes(k.toLowerCase().trim())
      )
      if (foundKey) return row[foundKey]
      return undefined
    }

    const namaRaw = getVal(['Nama Ruangan', 'nama', 'Nama', 'Ruangan'])
    if (!namaRaw) return null

    const kodeRaw = getVal(['Kode Ruangan', 'Kode', 'kode'])
    const lokasiRaw = getVal(['Lokasi / Gedung', 'Lokasi', 'Gedung', 'lokasi'])
    const kapasitasRaw = getVal(['Kapasitas', 'kapasitas', 'Kuota'])
    const ketRaw = getVal(['Keterangan', 'keterangan'])
    const aktifRaw = String(getVal(['Status Aktif', 'aktif', 'Status']) ?? 'TRUE').toUpperCase()

    return {
      nama: String(namaRaw).trim(),
      kode: kodeRaw ? String(kodeRaw).trim() : null,
      lokasi: lokasiRaw ? String(lokasiRaw).trim() : null,
      kapasitas: kapasitasRaw !== undefined && kapasitasRaw !== '' ? (parseInt(String(kapasitasRaw), 10) || null) : null,
      keterangan: ketRaw ? String(ketRaw).trim() : null,
      aktif: aktifRaw !== 'FALSE' && aktifRaw !== 'NON-AKTIF'
    }
  }

  return (
    <div className="sk">
      {/* ===== Filter Bar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari nama ruangan, kode, atau lokasi..."
          label="Cari Ruangan"
        />

        {lokasiFilterOptions.length > 0 && (
          <FilterSelect
            label="Lokasi / Gedung"
            value={lokasiFilter}
            onChange={setLokasiFilter}
          >
            <option value="">Semua Lokasi</option>
            {lokasiFilterOptions.map(lok => <option key={lok} value={lok}>{lok}</option>)}
          </FilterSelect>
        )}

        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
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
              <th>Nama Ruangan</th>
              <th className="cKode">Kode</th>
              <th className="cLokasi">Lokasi / Gedung</th>
              <th className="cKapasitas">Kapasitas</th>
              <th>Keterangan</th>
              <th className="cStatus">Status</th>
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
            ) : ruanganList.length === 0 ? (
              <tr>
                <td colSpan={8} className="sk__empty sk__muted">
                  Belum ada data ruangan.
                </td>
              </tr>
            ) : (
              ruanganList.map((ruangan, index) => (
                <tr key={ruangan.id}>
                  <td className="tCenter">{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className="tPlain" style={{ fontWeight: 600 }}>{ruangan.nama}</td>
                  <td className="tCenter tMono">{ruangan.kode || '-'}</td>
                  <td>
                    {ruangan.lokasi ? (
                      <span className="sk__programBadge">{ruangan.lokasi}</span>
                    ) : (
                      <span className="sk__muted">-</span>
                    )}
                  </td>
                  <td className="tCenter">{ruangan.kapasitas ? `${ruangan.kapasitas} org` : '-'}</td>
                  <td className="sk__muted">{ruangan.keterangan || '-'}</td>
                  <td>
                    <span className={`sk__status ${ruangan.aktif ? 'isOn' : 'isOff'}`}>
                      {ruangan.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <ActionGroup>
                        <ActionButton action="edit" onClick={() => handleEdit(ruangan)} />
                        <ActionButton action="delete" onClick={() => handleDelete(ruangan.id, ruangan.nama)} />
                      </ActionGroup>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile Cards ===== */}
      <div className="sk__cards" aria-label="Daftar Ruangan versi mobile">
        {loading ? (
          <div className="sk__cardLoading" style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
            <Spinner variant="buble" />
          </div>
        ) : ruanganList.length === 0 ? (
          <div className="sk__cardEmpty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--n-ink, #0f172a)', marginBottom: 2 }}>Tidak ada data</div>
            <div style={{ fontSize: '0.80rem', color: 'var(--n-muted, #64748b)' }}>Coba ubah kata kunci pencarian atau tambahkan ruangan baru</div>
          </div>
        ) : (
          ruanganList.map((ruangan, idx) => (
            <div
              className="sk__cardCompact"
              key={`m-${ruangan.id}-${idx}`}
              onClick={() => handleView(ruangan)}
            >
              <div className="sk__avatar">
                {(currentPage - 1) * pageSize + idx + 1}
              </div>
              <div className="sk__cardCompactLeft">
                <div className="sk__cardName">{ruangan.nama || '-'}</div>
                <div className="sk__cardNip">
                  <span>
                    {ruangan.kode ? `${ruangan.kode}` : 'Tanpa kode'}
                    {ruangan.lokasi ? ` · ${ruangan.lokasi}` : ''}
                    {ruangan.kapasitas ? ` · Kapasitas ${ruangan.kapasitas}` : ''}
                  </span>
                  {!ruangan.aktif && (
                    <span className="sk__statusBadge inactive">Nonaktif</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      {isAdmin && <DesktopFab label="Tambah Ruangan" icon="plus-lg" onClick={handleAddNew} />}
      {isAdmin && <MobileFab label="Tambah Ruangan" onClick={handleAddNew} />}

      {/* ===== Pagination ===== */}
      {totalItems > 0 && (
        <Pagination
          itemLabel="ruangan"
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

      {/* Form Modal (Add/Edit) */}
      {showModal && (
        <Modal
          size="md"
          variant={isEditMode ? 'edit' : 'add'}
          onClose={() => setShowModal(false)}
          labelledBy="ruangan-modal-title"
        >
          <ModalHeader
            id="ruangan-modal-title"
            icon={isEditMode ? 'pencil-square' : 'plus-lg'}
            title={isEditMode ? 'Edit Ruangan' : 'Tambah Ruangan Baru'}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <div className="sk__field">
                <label>Nama Ruangan <span className="required">*</span></label>
                <input
                  type="text"
                  name="nama"
                  required
                  value={formData.nama || ''}
                  onChange={handleInputChange}
                  placeholder="Contoh: Ruang Kelas X A, Perpustakaan, Lab Komputer"
                />
              </div>

              <div className="sk__grid2">
                <div className="sk__field">
                  <label>Kode Ruangan</label>
                  <input
                    type="text"
                    name="kode"
                    value={formData.kode || ''}
                    onChange={handleInputChange}
                    placeholder="Contoh: R-01, LAB-1"
                  />
                </div>

                <div className="sk__field">
                  <label>Kapasitas (Orang)</label>
                  <input
                    type="number"
                    name="kapasitas"
                    min={1}
                    value={formData.kapasitas ?? ''}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        kapasitas: e.target.value === '' ? null : parseInt(e.target.value, 10)
                      }))
                    }
                    placeholder="Contoh: 30"
                  />
                </div>
              </div>

              <div className="sk__field">
                <label>Lokasi / Gedung</label>
                <input
                  type="text"
                  name="lokasi"
                  value={formData.lokasi || ''}
                  onChange={handleInputChange}
                  placeholder="Contoh: Gedung Akademik Lt. 1"
                />
              </div>

              <div className="sk__field">
                <label>Keterangan</label>
                <input
                  type="text"
                  name="keterangan"
                  value={formData.keterangan || ''}
                  onChange={handleInputChange}
                  placeholder="Opsional — fasilitas atau catatan ruangan"
                />
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
      {showViewModal && selectedRuangan && (
        <Modal size="md" variant="edit" onClose={() => setShowViewModal(false)} labelledBy="ruangan-view-title">
          <ModalHeader
            id="ruangan-view-title"
            icon="door-open"
            title="Detail Data Ruangan"
            subtitle="Informasi detail ruangan"
            onClose={() => setShowViewModal(false)}
          />
          <ModalBody>
            <div className="sk__grid2">
              <div className="sk__field sk__fieldFull">
                <label>Nama Ruangan</label>
                <div className="sk__readInput" style={{ fontWeight: 750, fontSize: '0.92rem' }}>
                  {selectedRuangan.nama || '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Kode Ruangan</label>
                <div className="sk__readInput font-mono">{selectedRuangan.kode || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Kapasitas</label>
                <div className="sk__readInput">
                  {selectedRuangan.kapasitas ? `${selectedRuangan.kapasitas} orang` : '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Lokasi / Gedung</label>
                <div className="sk__readInput">{selectedRuangan.lokasi || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Status</label>
                <div className="sk__readInput">
                  <span className={`sk__status ${selectedRuangan.aktif ? 'isOn' : 'isOff'}`}>
                    {selectedRuangan.aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Keterangan</label>
                <div className="sk__readInput">{selectedRuangan.keterangan || '-'}</div>
              </div>
            </div>
          </ModalBody>
          <ModalViewFooter
            onClose={() => setShowViewModal(false)}
            onDelete={isAdmin ? () => { handleDelete(selectedRuangan.id, selectedRuangan.nama); setShowViewModal(false) } : undefined}
            onEdit={isAdmin ? () => { const toEdit = selectedRuangan; setShowViewModal(false); handleEdit(toEdit) } : undefined}
          />
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          labelledBy="ruangan-delete-title"
        >
          <ModalHeader
            id="ruangan-delete-title"
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
                fetchRuangan();
                setShowImportModal(false);
              }}
              templateColumns={['No', 'Nama Ruangan', 'Kode Ruangan', 'Lokasi / Gedung', 'Kapasitas', 'Keterangan', 'Status Aktif']}
              templateName="Template_Ruangan"
              apiEndpoint="/api/master/ruangan?upsert=true"
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

/* ========= ACTION MENU (MOBILE) ========= */
.sk__menuWrap {
  position: relative;
  display: inline-block;
}

.sk__btnActionMenu {
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
.sk__btnActionMenu.isOpen {
  background: #E0ECFF;
  border-color: #3083FF;
  color: #112E59;
}

.sk__btnActionMenu i {
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
  min-width: 720px;
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
.cKode { width: 110px; }
.cLokasi { width: 160px; }
.cKapasitas { width: 110px; text-align: center; }
.cStatus { width: 110px; }
.cAksi { width: 110px; text-align: right; }

.tCenter { text-align: center; }
.tPlain { font-weight: 400; }
.tMono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: var(--sk-fs-xs); color: rgba(100, 116, 139, 0.95); }

.sk__programBadge {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(15, 42, 86, 0.08);
  border: 1px solid rgba(15, 42, 86, 0.12);
  color: rgba(7, 22, 46, 0.92);
  font-weight: 500;
  font-size: var(--sk-fs-xs);
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

/* ========= MOBILE CARDS ========= */
.sk__cards {
  display: none;
  flex-direction: column;
  gap: 12px;
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
}

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
:global(.dark) .sk__table thead th {
  background: rgba(37, 99, 235, 0.15) !important;
  color: var(--n-muted) !important;
  border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
}
:global(.dark) .sk__table tbody td {
  background: #0b1329 !important;
  color: var(--n-ink) !important;
  border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
}
:global(.dark) .sk__table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.025) !important; }
:global(.dark) .sk__table tbody tr:hover td { background: rgba(79,142,247,0.06) !important; }

:global(.dark) .tMono { color: var(--n-muted) !important; }
:global(.dark) .sk__status.isOn { background: rgba(14, 165, 233, 0.15) !important; border-color: rgba(56, 189, 248, 0.5) !important; color: #38bdf8 !important; }
:global(.dark) .sk__status.isOff { background: rgba(239,68,68,0.12) !important; border-color: rgba(239,68,68,0.28) !important; color: #f87171 !important; }
:global(.dark) .sk__programBadge { background: rgba(79,142,247,0.1) !important; border-color: rgba(79,142,247,0.2) !important; color: #7aabf9 !important; }

:global(.dark) .sk__muted, :global(.dark) .sk__empty { color: var(--n-muted) !important; }
:global(.dark) .sk__loadingCell { background: transparent !important; }
:global(.dark) .sk__readInput {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
  color: #ffffff !important;
}

:global(.dark) .sk__btnActionMenu {
  background: rgba(26, 115, 232, 0.16) !important;
  color: #60a5fa !important;
  border: 1.5px solid rgba(26, 115, 232, 0.6) !important;
  border-radius: 9999px !important;
}
:global(.dark) .sk__btnActionMenu:hover,
:global(.dark) .sk__btnActionMenu.isOpen {
  background: #1a73e8 !important;
  border-color: #60a5fa !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(26, 115, 232, 0.5) !important;
}
:global(.dark) .sk__btnActionMenu i {
  color: #60a5fa !important;
}
:global(.dark) .sk__btnActionMenu:hover i,
:global(.dark) .sk__btnActionMenu.isOpen i {
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
:global(.dark) .sk__menuLabel {
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
:global(.dark) .sk__cardEmpty div {
  color: #94a3b8 !important;
}
`}</style>
    </div>
  )
}
