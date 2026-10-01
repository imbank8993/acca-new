'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { exportToExcel } from '@/lib/excel-utils'
import Pagination from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalViewFooter } from '@/components/ui/Modal'
import ImportModal from '@/components/ui/ImportModal'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import { useMasterAccess } from '@/lib/use-master-access'

interface EkskulData {
  id: string
  nama_ekskul: string
  aktif: boolean
}

const getInitials = (name?: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// `user` tidak lagi dipakai: wewenangnya datang dari useMasterAccess(),
// bukan dari role di objek user. Propnya tetap diterima agar pemanggil
// (view.tsx) tidak perlu diubah.
export default function EkskulTab(_props: { user?: unknown }) {
  const [dataList, setDataList] = useState<EkskulData[]>([])
  const [allData, setAllData] = useState<EkskulData[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // View Detail Modal State
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedEkskul, setSelectedEkskul] = useState<EkskulData | null>(null)

  const handleView = (item: EkskulData) => {
    setSelectedEkskul(item)
    setShowViewModal(true)
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [formNama, setFormNama] = useState('')
  const [formAktif, setFormAktif] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

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
    if (showModal || showImportModal || showDeleteModal) return registerModal()
  }, [showModal, showImportModal, showDeleteModal, registerModal])

  const filteredData = useMemo(() => {
    return allData.filter(item => {
      const matchSearch = item.nama_ekskul.toLowerCase().includes(searchTerm.toLowerCase())
      const matchStatus = !statusFilter || statusFilter === 'semua' || (statusFilter === 'aktif' ? item.aktif : !item.aktif)
      return matchSearch && matchStatus
    })
  }, [allData, searchTerm, statusFilter])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  useEffect(() => { setCurrentPage(1) }, [searchTerm])
  useEffect(() => { setTotalItems(filteredData.length) }, [filteredData])

  useEffect(() => { loadData(); }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ekskul`)
      const json = await res.json()
      if (json.ok) { setDataList(json.data); setAllData(json.data) }
    } catch (error) { console.error('Failed load ekskul', error) }
    finally { setLoading(false) }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNama) {
      Swal.fire('Error', 'Mohon lengkapi field wajib', 'error')
      return
    }
    setSaving(true)
    const payload = {
      id: isEditMode ? dataList.find(d => d.nama_ekskul === formNama)?.id : undefined,
      nama_ekskul: formNama,
      aktif: formAktif,
    }
    try {
      const res = await fetch('/api/ekskul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const result = await res.json()
      if (result.ok) {
        Swal.fire('Sukses', 'Data berhasil disimpan', 'success')
        setShowModal(false)
        resetForm()
        loadData()
      } else { throw new Error(result.error) }
    } catch (err: any) { Swal.fire('Error', err.message, 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = (id: string, name: string) => {
    setDeleteItemId(id); setDeleteItemName(name); setShowDeleteModal(true)
  }

  /**
   * Dua tahap. Permintaan pertama dikirim tanpa `confirm`; kalau ekskulnya masih
   * punya peserta, pembina, pertemuan, atau laporan, API menolak dan mengirim
   * rinciannya — semua itu ikut terhapus lewat FK cascade dan tidak bisa
   * dipulihkan. Rincian itu ditampilkan apa adanya, dan hanya kalau pemakainya
   * tetap memilih lanjut permintaannya diulang dengan `confirm=cascade`.
   */
  const confirmDelete = async () => {
    if (!deleteItemId) return
    setDeleting(true)
    try {
      const hapus = (cascade: boolean) =>
        fetch(`/api/ekskul?id=${encodeURIComponent(deleteItemId)}${cascade ? '&confirm=cascade' : ''}`, {
          method: 'DELETE',
        }).then((r) => r.json())

      let json = await hapus(false)

      if (!json.ok && typeof json.error === 'string' && json.error.includes('akan terhapus')) {
        const lanjut = await Swal.fire({
          title: 'Hapus beserta seluruh isinya?',
          text: json.error,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          confirmButtonText: 'Ya, hapus semua',
          cancelButtonText: 'Batal',
        })
        if (!lanjut.isConfirmed) {
          setShowDeleteModal(false); setDeleteItemId(null); setDeleteItemName('')
          return
        }
        json = await hapus(true)
      }

      if (json.ok) {
        setShowDeleteModal(false); setDeleteItemId(null); setDeleteItemName('')
        loadData()
        Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success')
      } else { Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error') }
    } catch (err) { console.error(err); Swal.fire('Gagal', 'Terjadi kesalahan', 'error') }
    finally { setDeleting(false) }
  }

  const resetForm = () => {
    setIsEditMode(false); setFormNama(''); setFormAktif(true)
  }

  const openAdd = () => { setIsEditMode(false); resetForm(); setShowModal(true) }

  const openEdit = (item: EkskulData) => {
    setIsEditMode(true)
    setFormNama(item.nama_ekskul)
    setFormAktif(item.aktif)
    setShowModal(true)
  }

  const handleExport = () => {
    const dataToExport = paginatedData.map((item, index) => ({
      'No': (currentPage - 1) * pageSize + index + 1,
      'Nama Ekskul': item.nama_ekskul,
      'Status': item.aktif ? 'Aktif' : 'Non-Aktif',
    }))
    exportToExcel(dataToExport, 'Master_Ekstrakurikuler', 'Ekskul')
  }

  const mapImportRow = (row: any) => {
    const getVal = (targetKeys: string[]) => {
      const normalizedTargets = targetKeys.map(k => k.toLowerCase().trim())
      const foundKey = Object.keys(row).find(k => normalizedTargets.includes(k.toLowerCase().trim()))
      if (foundKey) return row[foundKey]
      return undefined
    }
    const nama = getVal(['Nama Ekskul', 'nama', 'Nama'])
    const status = getVal(['Status', 'aktif'])
    if (!nama) return null
    return {
      nama_ekskul: String(nama).trim(),
      aktif: status !== undefined ? String(status).toLowerCase() === 'aktif' || String(status) === 'true' : true,
    }
  }

  /**
   * Gerbangnya mengikuti backend `EkskulController.bolehKelolaMasterEkskul`:
   * ADMIN, atau ditunjuk di "Hak Akses Fitur → Master Data: Ekstrakurikuler".
   *
   * Sebelumnya tab ini memakai aturan role sendiri (ADMIN / WKM Kesiswaan yang
   * melekat di kode), sehingga menyimpang dari tab lain di halaman yang sama.
   * Sekarang hanya ADMIN yang melekat; WKM Kesiswaan perlu ditunjuk di layar itu.
   *
   * `isAdmin` dipertahankan sebagai nama untuk JSX di bawah.
   */
  const { boleh, dapatKelola } = useMasterAccess()
  const isAdmin = dapatKelola('ekskul')

  const statsData = useMemo(() => ({
    total: filteredData.length,
    aktif: filteredData.filter(d => d.aktif).length,
    nonAktif: filteredData.filter(d => !d.aktif).length
  }), [filteredData])

  return (
    <div className="sk">
      {/* Stats Header */}
      <div className="tt__stats">
        <div className="tt__statCard">
          <div className="tt__statCardTop">
            <div className="tt__statIcon tt__statIconTotal">
              <i className="bi bi-list-task tt__iconTotal"></i>
            </div>
            <div className="tt__statValue tt__valTotal">{statsData.total}</div>
          </div>
          <div className="tt__statLabel">Total Ekskul</div>
        </div>

        <div className="tt__statCard">
          <div className="tt__statCardTop">
            <div className="tt__statIcon tt__statIconAktif">
              <i className="bi bi-check-circle-fill tt__iconAktif"></i>
            </div>
            <div className="tt__statValue tt__valAktif">{statsData.aktif}</div>
          </div>
          <div className="tt__statLabel">Aktif</div>
        </div>

        <div className="tt__statCard">
          <div className="tt__statCardTop">
            <div className="tt__statIcon tt__statIconNonAktif">
              <i className="bi bi-x-circle-fill tt__iconNonAktif"></i>
            </div>
            <div className="tt__statValue tt__valNonAktif">{statsData.nonAktif}</div>
          </div>
          <div className="tt__statLabel">Non-Aktif</div>
        </div>
      </div>

      {/* Toolbar */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari ekstrakurikuler..."
          label="Cari Ekskul"
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
                  <button
                    type="button"
                    role="menuitem"
                    className="sk__menuItem sk__menuItemMobileOnly"
                    onClick={() => { setShowActionMenu(false); setShowImportModal(true) }}
                  >
                    <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel-fill" style={{ color: '#f97316' }} /></span>
                    <span className="sk__menuLabel">Import</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className="sk__menuItem sk__menuItemMobileOnly"
                  onClick={() => { setShowActionMenu(false); handleExport() }}
                >
                  <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#3b82f6' }} /></span>
                  <span className="sk__menuLabel">Export</span>
                </button>
              </div>
            )}
          </div>

          {isAdmin && (
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
        </FilterActions>
      </FilterToolbar>

      {/* Desktop Table */}
      <div className="sk__tableWrap">
        <table className="sk__table">
          <thead>
            <tr>
              <th className="cNo">No</th>
              <th>Nama Ekstrakurikuler</th>
              <th className="cStatus">Status</th>
              {isAdmin && <th className="cAksi">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 4 : 3} className="sk__loadingCell"><Spinner variant="buble" /></td></tr>
            ) : paginatedData.length === 0 ? (
              <tr><td colSpan={isAdmin ? 4 : 3} className="sk__empty sk__muted">Belum ada data ekstrakurikuler.</td></tr>
            ) : (
              paginatedData.map((item, idx) => (
                <tr key={item.id}>
                  <td className="tCenter">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td>
                    <div className="tt__tugasName">
                      <i className="bi bi-list-task tt__tugasIcon"></i>
                      {item.nama_ekskul}
                    </div>
                  </td>
                  <td>
                    <span className={`sk__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                      {item.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <ActionGroup>
                        <ActionButton action="edit" onClick={() => openEdit(item)} />
                        <ActionButton action="delete" onClick={() => handleDelete(item.id, item.nama_ekskul)} />
                      </ActionGroup>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (Grouped Inset List) */}
      <div className="sk__cards" aria-label="Daftar Ekstrakurikuler versi mobile">
        {loading ? (
          <div className="sk__cardLoading" style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
            <Spinner variant="buble" />
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="sk__cardEmpty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--n-ink, #0f172a)', marginBottom: 2 }}>Tidak ada data</div>
            <div style={{ fontSize: '0.80rem', color: 'var(--n-muted, #64748b)' }}>Coba ubah kata kunci pencarian atau filter</div>
          </div>
        ) : (
          paginatedData.map((item, idx) => {
            return (
              <div
                className="sk__cardCompact"
                key={`eks-${item.id}-${idx}`}
                onClick={() => handleView(item)}
              >
                <div className="sk__avatar">
                  {(currentPage - 1) * pageSize + idx + 1}
                </div>
                <div className="sk__cardCompactLeft">
                  <div className="sk__cardName">{item.nama_ekskul || '-'}</div>
                  <div className="sk__cardNip">
                    <span>Ekstrakurikuler</span>
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
      {isAdmin && <DesktopFab label="Tambah Ekskul" icon="plus-lg" onClick={openAdd} />}
      {isAdmin && <MobileFab label="Tambah Ekskul" onClick={openAdd} />}

      {/* Pagination */}
      {totalItems > 0 && (
        <Pagination itemLabel="ekskul"
          currentPage={currentPage} totalPages={Math.ceil(totalItems / pageSize)}
          limit={pageSize} totalItems={totalItems}
          onPageChange={setCurrentPage}
          onLimitChange={(newLimit) => { setCurrentPage(1); setPageSize(newLimit) }}
        />
      )}

      {/* Form Modal */}
      {showModal && (
        <Modal
          size="md"
          variant={isEditMode ? 'edit' : 'add'}
          onClose={() => setShowModal(false)}
          labelledBy="ekskul-modal-title"
        >
          <ModalHeader
            id="ekskul-modal-title"
            icon={isEditMode ? 'pencil-square' : 'plus-lg'}
            title={isEditMode ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSave}>
            <ModalBody>
                <div className="sk__field">
                  <label>Nama Ekstrakurikuler <span className="required">*</span></label>
                  <input type="text" placeholder="Contoh: Paskibra, Pramuka, PMR, dll" value={formNama} onChange={e => setFormNama(e.target.value)} required />
                </div>
                <div className="sk__field">
                  <label>Status</label>
                  <div className="mdl-switchWrap">
                    <label className="mdl-switch">
                      <input
                        type="checkbox"
                        checked={formAktif}
                        onChange={e => setFormAktif(e.target.checked)}
                      />
                      <span className="mdl-switch__track">
                        <span className="mdl-switch__thumb" />
                      </span>
                      <span className={`mdl-switch__badge ${formAktif ? 'isOn' : 'isOff'}`}>
                        {formAktif ? 'Aktif' : 'Non-Aktif'}
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
      {showViewModal && selectedEkskul && (
        <Modal size="md" variant="edit" onClose={() => setShowViewModal(false)} labelledBy="ekskul-view-title">
          <ModalHeader
            id="ekskul-view-title"
            icon="trophy"
            title="Detail Data Ekstrakurikuler"
            subtitle="Informasi lengkap kegiatan ekstrakurikuler"
            onClose={() => setShowViewModal(false)}
          />
          <ModalBody>
            <div className="sk__grid2">
              <div className="sk__field sk__fieldFull">
                <label>Nama Ekstrakurikuler</label>
                <div className="sk__readInput" style={{ fontWeight: 750, fontSize: '0.92rem' }}>
                  {selectedEkskul.nama_ekskul || '-'}
                </div>
              </div>

              <div className="sk__field">
                <label>Status</label>
                <div className="sk__readInput">
                  <span className={`sk__status ${selectedEkskul.aktif ? 'isOn' : 'isOff'}`}>
                    {selectedEkskul.aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalViewFooter
            onClose={() => setShowViewModal(false)}
            onDelete={isAdmin ? () => { handleDelete(selectedEkskul.id, selectedEkskul.nama_ekskul); setShowViewModal(false) } : undefined}
            onEdit={isAdmin ? () => { const toEdit = selectedEkskul; setShowViewModal(false); openEdit(toEdit) } : undefined}
          />
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          labelledBy="ekskul-delete-title"
        >
          <ModalHeader
            id="ekskul-delete-title"
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
        <div onClick={() => setShowImportModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}>
            <ImportModal
              isOpen={showImportModal} onClose={() => setShowImportModal(false)}
              onImportSuccess={() => { loadData(); setShowImportModal(false) }}
              templateColumns={['Nama Ekskul', 'Status']}
              templateName="Template_Master_Ekskul" apiEndpoint="/api/ekskul" mapRowData={mapImportRow}
            />
          </div>
        </div>, document.body
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

        .sk { width: 100%; min-width: 0; display: flex; flex-direction: column; gap: 12px; font-size: var(--sk-fs); padding: 0; background: transparent; border-radius: 0; padding-bottom: calc(16px + var(--sk-safe-b)); }

        .tt__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; }
        .tt__statCard { background: #ffffff; border: 1px solid #E1E2E9; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-shadow: 0 1px 4px rgba(17, 46, 89, 0.04); }
        .tt__statCardTop { display: flex; align-items: center; justify-content: space-between; width: 100%; }
        .tt__statIcon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #E0ECFF; color: #3083FF; border: 1px solid #E1E2E9; }
        .tt__statIcon i { font-size: 1.15rem; color: #3083FF; }
        .tt__iconTotal, .tt__iconAktif, .tt__iconNonAktif { color: #3083FF !important; }
        .tt__statIconTotal, .tt__statIconAktif, .tt__statIconNonAktif { background: #E0ECFF !important; color: #3083FF !important; }
        .tt__statValue { font-size: 1.5rem; font-weight: 800; line-height: 1; color: #112E59; text-align: right; }
        .tt__statLabel { font-size: 0.80rem; color: #64748b; font-weight: 600; text-align: left; line-height: 1.2; }

        .sk__bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; width: 100%; min-width: 0; }
        .sk__filters { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px; border-radius: var(--sk-radius); background: var(--n-card); border: 1px solid var(--n-border); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); }
        .sk__search { position: relative; flex: 1 1 260px; min-width: 160px; }
        .sk__search i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: rgba(100, 116, 139, 0.9); pointer-events: none; font-size: 0.9rem; }
        .sk__search input { box-sizing: border-box; width: 100%; padding: 8px 10px 8px 30px; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; background: var(--n-card); font-weight: 500; color: rgba(15, 23, 42, 0.92); outline: none; font-size: var(--sk-fs-sm); transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        .sk__search input:focus { border-color: rgba(58, 166, 255, 0.55); box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14); }
        .sk__filterSelect { padding: 8px 10px; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; background: var(--n-card); font-weight: 500; font-size: var(--sk-fs-sm); color: rgba(15, 23, 42, 0.92); outline: none; cursor: pointer; transition: border-color 0.15s ease; min-width: 120px; }
        .sk__filterSelect:focus { border-color: rgba(58, 166, 255, 0.55); box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14); }

        .sk__actions { display: flex; align-items: center; gap: 8px; }

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
        .sk__btn { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 10px; font-size: var(--sk-fs-sm); font-weight: 600; cursor: pointer; border: none; transition: all 0.2s ease; white-space: nowrap; }
        .sk__btnPrimary { background: var(--n-primary, #3083ff); color: white; box-shadow: 0 2px 8px rgba(0, 56, 168, 0.25); }
        .sk__btnPrimary:hover { background: #002b6e; box-shadow: 0 4px 12px rgba(0, 56, 168, 0.3); }
        .sk__btnGhost { background: transparent; border: 1px solid var(--n-border); color: var(--n-muted); }
        .sk__btnGhost:hover { background: rgba(148, 163, 184, 0.08); }
        .sk__btnImport { background: rgba(59, 130, 246, 0.08); color: #3083FF; border: 1px solid rgba(59, 130, 246, 0.2); }
        .sk__btnImport:hover { background: rgba(59, 130, 246, 0.15); }
        .sk__btnExport { background: rgba(16, 185, 129, 0.08); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        .sk__btnExport:hover { background: rgba(16, 185, 129, 0.15); }

        .sk__tableWrap { overflow-x: auto; }
        .sk__table { width: 100%; border-collapse: collapse; background: var(--n-card); border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid var(--n-border); }
        .sk__table th { background: linear-gradient(135deg, var(--n-primary) 0%, #3083FF 100%); color: white; font-weight: 700; font-size: 0.8rem; padding: 10px 12px; text-align: left; white-space: nowrap; }
        .sk__table td { padding: 9px 12px; border-bottom: 1px solid var(--sk-line); font-size: var(--sk-fs); color: var(--n-text); vertical-align: middle; }
        .sk__table tbody tr:last-child td { border-bottom: none; }
        .sk__table tbody tr:hover td { background: rgba(59, 130, 246, 0.03); }
        .cNo, .cTA, .cSem, .cStatus, .cAksi { text-align: center; }
        .cNo { width: 50px; }
        .cTA { width: 120px; }
        .cSem { width: 70px; }
        .cStatus { width: 80px; }
        .cAksi { width: 90px; }
        .tCenter { text-align: center; }
        .sk__loadingCell { text-align: center; padding: 32px; }
        .sk__spinner { width: 28px; height: 28px; border: 3px solid rgba(59, 130, 246, 0.2); border-top-color: #3083FF; border-radius: 50%; animation: ekspin 0.7s linear infinite; margin: 0 auto; }
        @keyframes ekspin { to { transform: rotate(360deg); } }
        .sk__empty { text-align: center; padding: 40px 20px; color: var(--n-muted); font-size: 0.9rem; }
        .sk__muted { color: var(--n-muted); }
        .tt__tugasName { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--n-text); }
        .tt__tugasIcon { font-size: 0.95rem; }
        .sk__kelompokBadge { display: inline-flex; padding: 3px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 600; background: rgba(0, 56, 168, 0.08); color: var(--n-primary); white-space: nowrap; }
        .sk__semesterBadge { display: inline-flex; padding: 3px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
        .sk__semesterBadge.ganjil { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .sk__semesterBadge.genap { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .sk__semesterBadge.semua { background: rgba(148, 163, 184, 0.15); color: var(--n-muted); }
        .sk__status { display: inline-flex; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; text-transform: capitalize; }
        .sk__status.isOn { background: rgba(0, 56, 168, 0.08); border: 1px solid rgba(0, 56, 168, 0.25); color: #3083FF; }
        .sk__status.isOff { background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); color: #64748b; }
        .sk__rowActions { display: flex; justify-content: center; gap: 4px; }
        .sk__iconBtn { width: 30px; height: 30px; border: none; border-radius: 8px; background: rgba(100, 116, 139, 0.08); color: var(--n-muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease; font-size: 0.85rem; }
        .sk__iconBtn:hover { background: rgba(100, 116, 139, 0.15); color: var(--n-muted); }
        .sk__iconBtn.danger:hover { background: rgba(239, 68, 68, 0.1); color: #dc2626; }

        .tt__toggleField { flex-direction: row; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--sk-line); }
        .tt__toggleLabel { display: flex; align-items: center; gap: 8px; }
        .tt__toggleBadge { padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
        .tt__toggleBadge.isOn { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .tt__toggleBadge.isOff { background: rgba(239, 68, 68, 0.1); color: #dc2626; }
        .tt__switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .tt__switch input { opacity: 0; width: 0; height: 0; }
        .tt__slider { position: absolute; cursor: pointer; inset: 0; background-color: #cbd5e1; transition: 0.3s; border-radius: 24px; }
        .tt__slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
        .tt__switch input:checked + .tt__slider { background-color: #10b981; }
        .tt__switch input:checked + .tt__slider:before { transform: translateX(20px); }

        .sk__cards { display: none; }
        .sk__card { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .sk__cardHead { padding: 14px 16px; border-bottom: 1px solid var(--sk-line); display: flex; align-items: flex-start; justify-content: space-between; }
        .sk__cardTitle { flex: 1; }
        .sk__cardName { font-weight: 700; font-size: 0.95rem; color: var(--n-text); }
        .sk__cardSub { display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
        .sk__cardBody { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .sk__statusRow { display: flex; align-items: center; justify-content: space-between; }
        .sk__actionsRight { display: flex; gap: 4px; }
        .sk__cardLoading { min-height: 100px; }
        .sk__cardRow { margin-bottom: 0; }

        @media (max-width: 767px) {
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
          .tt__stats { display: none !important; }
          .sk__bar { flex-direction: column; align-items: stretch; }
          .sk__filters { flex-direction: column; }
          .sk__search { min-width: 0; width: 100%; flex: none; margin-right: 0; }
          .sk__actions { width: 100%; display: flex; gap: 6px; margin-bottom: 12px; margin-top: 8px; }
          .sk__actions .sk__btn { flex: 1; height: 40px; padding: 9px 8px; justify-content: center; min-width: 0; }
          .sk__actions .sk__btn span { font-size: 0.75rem; }
        }

        /* ===== DARK MODE FULL OVERHAUL ===== */
        :global(.dark) .tt__statCard {
          background: #0b1329 !important;
          border: 1px solid rgba(26, 115, 232, 0.35) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
          transition: all 0.2s ease !important;
        }
        :global(.dark) .tt__statCard:hover {
          border-color: rgba(59, 130, 246, 0.6) !important;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
        }
        :global(.dark) .tt__statIconTotal,
        :global(.dark) .tt__statIconAktif,
        :global(.dark) .tt__statIconNonAktif { background: rgba(48, 131, 255, 0.15) !important; }
        :global(.dark) .tt__iconTotal,
        :global(.dark) .tt__iconAktif,
        :global(.dark) .tt__iconNonAktif { color: #60a5fa !important; }
        :global(.dark) .tt__valTotal,
        :global(.dark) .tt__valAktif,
        :global(.dark) .tt__valNonAktif { color: #ffffff !important; }
        
        :global(.dark) .tt__statLabel { color: #94a3b8 !important; }

        :global(.dark) .sk__bar { background: transparent !important; border: none !important; }
        :global(.dark) .sk__filters,
        :global(.dark) .sk__actions { background: transparent !important; border: none !important; box-shadow: none !important; }
        
        :global(.dark) .sk__search {
          background: #0b1329 !important;
          border: 1px solid rgba(26, 115, 232, 0.35) !important;
          border-radius: 12px !important;
          box-shadow: 0 0 10px rgba(26, 115, 232, 0.15) !important;
        }
        :global(.dark) .sk__search input {
          background: #0b1329 !important;
          border: none !important;
          color: #ffffff !important;
          border-radius: 12px !important;
        }
        :global(.dark) .sk__search i { color: #94a3b8 !important; }

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
        :global(.dark) .sk__table { background: #0b1329 !important; color: #e2e8f0 !important; border: none !important; }
        :global(.dark) .sk__table th {
          background: rgba(37, 99, 235, 0.15) !important;
          color: #94a3b8 !important;
          border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
          font-weight: 800 !important;
        }
        :global(.dark) .sk__table td {
          background: #0b1329 !important;
          color: #e2e8f0 !important;
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
        }
        :global(.dark) .sk__table tbody tr:hover td { background: rgba(37, 99, 235, 0.08) !important; }

        :global(.dark) .tt__tugasName { color: #ffffff !important; font-weight: 700 !important; }
        :global(.dark) .tt__tugasIcon { color: #38bdf8 !important; }

        :global(.dark) .sk__status { padding: 4px 10px !important; border-radius: 6px !important; font-size: 0.78rem !important; font-weight: 600 !important; text-transform: capitalize !important; }
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

        :global(.dark) .sk__card { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
        :global(.dark) .sk__cardHead { background: #0b1329 !important; }
        :global(.dark) .sk__cardName { color: #ffffff !important; }
        :global(.dark) .sk__btnGhost { background: #0b1329 !important; color: #e2e8f0 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
      `}</style>
    </div>
  )
}