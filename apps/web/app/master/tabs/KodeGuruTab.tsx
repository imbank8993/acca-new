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

interface KodeGuru {
  id?: number;
  nip: string;
  nama_guru: string;
  kode_guru: string;
  aktif: boolean;
}


const getInitials = (name?: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function KodeGuruTab({ user }: { user?: any }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [allData, setAllData] = useState<KodeGuru[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  // Computed paginated list
  const filteredKodeGuru = useMemo(() => {
    return allData.filter(g => {
      if (!statusFilter || statusFilter === 'semua') return true;
      return statusFilter === 'aktif' ? g.aktif : !g.aktif;
    });
  }, [allData, statusFilter]);

  const kodeGuruList = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredKodeGuru.slice(start, end)
  }, [filteredKodeGuru, currentPage, pageSize])

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // View Detail Modal State
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedKodeGuru, setSelectedKodeGuru] = useState<KodeGuru | null>(null)

  const handleView = (item: KodeGuru) => {
    setSelectedKodeGuru(item)
    setShowViewModal(true)
  }

  // Import Modal
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

  const [formData, setFormData] = useState<Partial<KodeGuru>>({
    nip: '',
    nama_guru: '',
    kode_guru: '',
    aktif: true
  })

  // Master Data Guru untuk dropdown
  const [masterGuru, setMasterGuru] = useState<any[]>([])

  useEffect(() => {
    fetchMasterGuru()
    fetchKodeGuru()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchKodeGuru()
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  const fetchMasterGuru = async () => {
    try {
      const res = await fetch('/api/master/guru?limit=10000')
      const json = await res.json()
      if (json.ok) {
        setMasterGuru(json.data || [])
      }
    } catch (err) {
      console.error('Error fetching master guru:', err)
    }
  }

  const fetchKodeGuru = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        page: '1',
        limit: '10000'
      })

      const res = await fetch(`/api/master/kode-guru?${params}`, { cache: 'no-store' })
      const json = await res.json()

      if (json.ok) {
        setAllData(json.data || [])
        setTotalItems(json.data?.length || 0)
      }
    } catch (err) {
      console.error('Error fetching kode guru:', err)
      setAllData([])
      setTotalItems(0)
    } finally {
      setLoading(false)
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
  const isAdmin = boleh('kode-guru')
  const canManage = isAdmin

  const canView = true;

  const handleAddNew = () => {
    setFormData({ nip: '', nama_guru: '', kode_guru: '', aktif: true })
    setIsEditMode(false)
    setShowModal(true)
  }

  const handleEdit = (item: KodeGuru) => {
    setFormData({ ...item })
    setIsEditMode(true)
    setShowModal(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleGuruSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nip = e.target.value
    const guru = masterGuru.find(g => g.nip === nip)
    if (guru) {
      setFormData(prev => ({
        ...prev,
        nip: guru.nip,
        nama_guru: guru.nama_lengkap
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (!formData.nip || !formData.nama_guru || !formData.kode_guru) {
        throw new Error('NIP, Nama Guru, dan Kode Guru wajib diisi')
      }

      const method = isEditMode ? 'PUT' : 'POST'
      const url = '/api/master/kode-guru'

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const json = await res.json()
      if (!json.ok) {
        throw new Error(json.error)
      }

      setShowModal(false)
      fetchKodeGuru()
      alert(`Data kode guru berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}`)

    } catch (err: any) {
      console.error('Error saving kode guru:', err)
      alert(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: number, name: string) => {
    setDeleteItemId(id)
    setDeleteItemName(name)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteItemId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/master/kode-guru?id=${deleteItemId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        setShowDeleteModal(false)
        setDeleteItemId(null)
        setDeleteItemName('')
        fetchKodeGuru()
        Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success')
      } else {
        Swal.fire('Gagal', json.error, 'error')
      }
    } catch (err) {
      console.error(err)
      Swal.fire('Gagal', 'Terjadi kesalahan', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const dataToExport = kodeGuruList.map((item, index) => ({
      'No': (currentPage - 1) * pageSize + index + 1,
      'NIP': item.nip || '',
      'Nama Guru': item.nama_guru || '',
      'Kode Guru': item.kode_guru || '',
      'Status': item.aktif ? 'Aktif' : 'Non-Aktif'
    }))

    exportToExcel(dataToExport, 'Data_Kode_Guru', 'Kode Guru')
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

    const nipRaw = getVal(['NIP', 'nip'])
    const namaRaw = getVal(['Nama Guru', 'nama_guru', 'Nama'])
    const kodeRaw = getVal(['Kode Guru', 'kode_guru', 'Kode'])

    if (!nipRaw || !namaRaw || !kodeRaw) return null

    const statusRaw = getVal(['Status', 'status', 'Aktif', 'aktif'])
    const aktif = String(statusRaw).toUpperCase() !== 'NON-AKTIF' && String(statusRaw).toUpperCase() !== 'FALSE'

    return {
      nip: String(nipRaw).trim(),
      nama_guru: String(namaRaw).trim(),
      kode_guru: String(kodeRaw).trim(),
      aktif: aktif
    }
  }

  // Group for mobile: by status aktif
  const groupedMobile = useMemo(() => {
    const map = new Map<string, KodeGuru[]>()
      ; (kodeGuruList || []).forEach((it) => {
        const key = it.aktif ? 'Aktif' : 'Non-Aktif'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(it)
      })
    const entries = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0], 'id'))
    entries.forEach(([k, arr]) => {
      arr.sort((x, y) => {
        const nx = String(x.nama_guru || '').toLowerCase()
        const ny = String(y.nama_guru || '').toLowerCase()
        if (nx !== ny) return nx.localeCompare(ny, 'id')
        return String(x.kode_guru || '').localeCompare(String(y.kode_guru || ''), 'id')
      })
    })
    return entries
  }, [kodeGuruList])

  return (
    <div className="sk">
      {/* ===== Toolbar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari Nama Guru / NIP / Kode..."
          label="Cari Kode Guru"
        />

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
              <th className="cNip">NIP</th>
              <th>Nama Guru</th>
              <th className="cKode">Kode Guru</th>
              <th className="cStatus">Status</th>
              {(canManage) && <th className="cAksi">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {!canView ? (
              <tr>
                <td colSpan={6} className="sk__empty sk__muted">
                  Anda tidak memiliki akses untuk melihat data ini.
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={6} className="sk__loadingCell">
                  <Spinner variant="trace" />
                </td>
              </tr>
            ) : kodeGuruList.length === 0 ? (
              <tr>
                <td colSpan={6} className="sk__empty sk__muted">
                  Tidak ada data kode guru.
                </td>
              </tr>
            ) : (
              kodeGuruList.map((item, index) => (
                <tr key={item.id || `${item.nip}-${index}`}>
                  <td className="tCenter">{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className="tMono">{item.nip}</td>
                  <td className="tPlain">{item.nama_guru}</td>
                  <td className="tCenter">
                    <span className="sk__kodeBadge">{item.kode_guru}</span>
                  </td>
                  <td>
                    <span className={`sk__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                      {item.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <ActionGroup>
                        <ActionButton action="edit" onClick={() => handleEdit(item)} />
                        <ActionButton action="delete" onClick={() => item.id && handleDelete(item.id, item.nama_guru)} />
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
      <div className="sk__cards" aria-label="Daftar Kode Guru versi mobile">
        {loading ? (
          <div className="sk__cardLoading" style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
            <Spinner variant="trace" />
          </div>
        ) : kodeGuruList.length === 0 ? (
          <div className="sk__cardEmpty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--n-ink, #0f172a)', marginBottom: 2 }}>Tidak ada data</div>
            <div style={{ fontSize: '0.80rem', color: 'var(--n-muted, #64748b)' }}>Coba ubah kata kunci pencarian atau filter</div>
          </div>
        ) : (
          kodeGuruList.map((item, idx) => {
            return (
              <div
                className="sk__cardCompact"
                key={`m-${item.id || idx}`}
                onClick={() => handleView(item)}
              >
                <div className="sk__avatar">
                  {(currentPage - 1) * pageSize + idx + 1}
                </div>
                <div className="sk__cardCompactLeft">
                  <div className="sk__cardName">{item.nama_guru || '-'}</div>
                  <div className="sk__cardNip">
                    <span>{item.kode_guru || '-'}</span>
                    {!item.aktif && (
                      <span className="sk__statusBadge inactive">Nonaktif</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Aksi utama tab: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
      {isAdmin && <DesktopFab label="Tambah Kode Guru" icon="plus-lg" onClick={handleAddNew} />}
      {isAdmin && <MobileFab label="Tambah Kode Guru" onClick={handleAddNew} />}

      {/* ===== Pagination ===== */}
      {totalItems > 0 && (
        <Pagination itemLabel="kode guru"
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
          labelledBy="kodeguru-modal-title"
        >
          <ModalHeader
            id="kodeguru-modal-title"
            icon={isEditMode ? 'pencil-square' : 'plus-lg'}
            title={isEditMode ? 'Edit Kode Guru' : 'Tambah Kode Guru'}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody>
                <div className="sk__field">
                  <label>Pilih Guru <span className="required">*</span></label>
                  <select
                    value={formData.nip || ''}
                    onChange={handleGuruSelect}
                    required
                    disabled={isEditMode}
                    className={isEditMode ? 'bg-gray-100' : ''}
                  >
                    <option value="">-- Pilih Guru --</option>
                    {masterGuru.map(guru => (
                      <option key={guru.nip} value={guru.nip}>
                        {guru.nip} - {guru.nama_lengkap}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sk__field">
                  <label>Nama Guru <span className="required">*</span></label>
                  <input
                    type="text"
                    name="nama_guru"
                    required
                    value={formData.nama_guru || ''}
                    onChange={handleInputChange}
                    readOnly
                    className="bg-gray-100"
                  />
                </div>

                <div className="sk__field">
                  <label>Kode Guru <span className="required">*</span></label>
                  <input
                    type="text"
                    name="kode_guru"
                    required
                    value={formData.kode_guru || ''}
                    onChange={handleInputChange}
                    placeholder="Contoh: MATH, BIO, ENG"
                    style={{ textTransform: 'uppercase' }}
                  />
                  <div className="sk__hint">Gunakan kode singkat untuk identifikasi guru (2-4 karakter)</div>
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
      {showViewModal && selectedKodeGuru && (
        <Modal size="md" variant="edit" onClose={() => setShowViewModal(false)} labelledBy="kodeguru-view-title">
          <ModalHeader
            id="kodeguru-view-title"
            icon="person-badge"
            title="Detail Data Kode Guru"
            subtitle="Informasi penetapan kode guru"
            onClose={() => setShowViewModal(false)}
          />
          <ModalBody>
            <div className="sk__grid2">
              <div className="sk__field">
                <label>NIP Guru</label>
                <div className="sk__readInput font-mono">{selectedKodeGuru.nip || '-'}</div>
              </div>

              <div className="sk__field">
                <label>Kode Guru</label>
                <div className="sk__readInput">
                  <span className="sk__kodeBadge font-mono">{selectedKodeGuru.kode_guru || '-'}</span>
                </div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Nama Lengkap Guru</label>
                <div className="sk__readInput" style={{ fontWeight: 750, fontSize: '0.92rem' }}>
                  {selectedKodeGuru.nama_guru || '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Status</label>
                <div className="sk__readInput">
                  <span className={`sk__status ${selectedKodeGuru.aktif ? 'isOn' : 'isOff'}`}>
                    {selectedKodeGuru.aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalViewFooter
            onClose={() => setShowViewModal(false)}
            onDelete={isAdmin ? () => { if (selectedKodeGuru.id) handleDelete(selectedKodeGuru.id, selectedKodeGuru.nama_guru); setShowViewModal(false) } : undefined}
            onEdit={isAdmin ? () => { const toEdit = selectedKodeGuru; setShowViewModal(false); handleEdit(toEdit) } : undefined}
          />
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          labelledBy="kodeguru-delete-title"
        >
          <ModalHeader
            id="kodeguru-delete-title"
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
              onImportSuccess={() => {
                fetchKodeGuru()
                setShowImportModal(false)
              }}
              templateColumns={['No', 'NIP', 'Nama Guru', 'Kode Guru', 'Status']}
              templateName="Template_Kode_Guru"
              apiEndpoint="/api/master/kode-guru?upsert=true"
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

.sk__btnExport {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(16, 185, 129, 0.28);
  color: #fff;
}

.sk__btnExport:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
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
.cNip { width: 160px; }
.cKode { width: 130px; }
.cStatus { width: 110px; }
.cAksi { width: 120px; text-align: right; }

.tCenter { text-align: center; }

.tMono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: var(--sk-fs-xs);
  font-weight: 400;
}

.tPlain { font-weight: 400; }

.sk__kodeBadge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.22);
  color: rgba(76, 29, 149, 1);
  font-weight: 800;
  font-size: 0.85rem;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.5px;
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

.bg-gray-100 {
  background-color: rgba(0, 0, 0, 0.03) !important;
}

.sk__hint {
  font-size: 0.75rem;
  color: rgba(100, 116, 139, 0.85);
  font-style: italic;
  margin-top: 4px;
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
  }

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

:global(.dark) .sk__kodeBadge {
  background: rgba(37, 99, 235, 0.18) !important;
  border: 1.5px solid rgba(96, 165, 250, 0.5) !important;
  color: #60a5fa !important;
  font-weight: 800 !important;
  padding: 4px 12px !important;
  border-radius: 8px !important;
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.25) !important;
}

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

:global(.dark) .sk__muted, :global(.dark) .sk__empty { color: #94a3b8 !important; }
:global(.dark) .sk__loadingCell { background: transparent !important; }
:global(.dark) .tPlain { color: #ffffff !important; font-weight: 600 !important; }
:global(.dark) .tMono { color: #94a3b8 !important; font-family: monospace !important; }
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

:global(.dark) .sk__detailItem label { color: var(--n-muted) !important; }
:global(.dark) .sk__detailValue { color: #ffffff !important; }
:global(.dark) .sk__detailValue.sk__mono { color: #60a5fa !important; background: rgba(26, 115, 232, 0.12) !important; }
:global(.dark) .sk__detailValue.sk__large { color: #ffffff !important; }

/* ===== END DARK MODE FULL ===== */

`}</style>
    </div>
  )
}
