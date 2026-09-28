'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Swal from 'sweetalert2'
import { Spinner } from '@/components/ui/Spinner'
import { exportToExcel } from '@/lib/excel-utils'
import ImportModal from '@/components/ui/ImportModal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Pagination from '@/components/ui/Pagination'
import { getCurrentAcademicYear } from '@/lib/date-utils'
import { usePengaturanTugasAccess } from '@/lib/use-pengaturan-tugas-access'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { FilterToolbar, FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import DesktopFab from '@/components/ui/DesktopFab'

interface WaliKelas {
  id?: number
  nama_kelas: string
  nip: string
  nama_guru: string
  tahun_ajaran: string
  semester: string
  aktif: boolean
}

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanTugasAccess(), bukan dari objek user. Propnya tetap diterima agar
// pemanggil (view.tsx) tidak perlu diubah.
export default function WaliKelasTab(_props: { user?: unknown }) {
  /**
   * Wewenang dari server (Hak Akses Fitur per tab), bukan dari objek user.
   *
   * Pemeriksaan lama punya dua masalah. `user?.role === 'ADMIN'` adalah
   * perbandingan string UTUH, sedangkan ketiga akun admin di basis data ini
   * berrole gabungan (`ADMIN,GURU`, dst) — hanya cabang `user.roles` yang
   * menyelamatkannya, dan itu bergantung objek user terisi. Lalu
   * `hasPermission(permissions, ...)` membaca tabel capabilities yang kosong dan
   * tidak punya layar pengelola, jadi praktis hanya cabang isAdmin yang berlaku.
   */
  const { boleh } = usePengaturanTugasAccess()
  const bolehKelola = boleh('wali_kelas')

  const canCreate = bolehKelola
  const canUpdate = bolehKelola
  const canDelete = bolehKelola
  const canImport = bolehKelola
  const canExport = bolehKelola

  // Local Filter State
  const [tahunAjaran, setTahunAjaran] = useState(getCurrentAcademicYear())
  const [semester, setSemester] = useState('Semua')

  const [list, setList] = useState<WaliKelas[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [showActionMenu, setShowActionMenu] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  const { registerModal } = useModalBlur()

  useEffect(() => {
    if (showModal || showImportModal || showDeleteModal) return registerModal()
  }, [showModal, showImportModal, showDeleteModal, registerModal])

  useEffect(() => {
    if (!showActionMenu) return
    const onClick = (e: MouseEvent) => {
      if (!actionMenuRef.current?.contains(e.target as Node)) setShowActionMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showActionMenu])

  const [formData, setFormData] = useState<Partial<WaliKelas>>({ aktif: true })
  // Pilihan semester di modal tambah; 'Semua' = simpan 2 baris (Ganjil & Genap)
  const [formSemester, setFormSemester] = useState('Semua')
  const [saving, setSaving] = useState(false)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  // Selection States
  const [selectedClass, setSelectedClass] = useState('')

  // Master data for selection
  const [masterGuru, setMasterGuru] = useState<any[]>([])
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

  const sortedList = useMemo(() => {
    if (!list || list.length === 0) return []
    return [...list].sort((a, b) => {
      const classCompare = (a.nama_kelas || '').localeCompare(b.nama_kelas || '')
      if (classCompare !== 0) return classCompare
      const semOrder = (sem?: string) => (sem === 'Ganjil' ? 1 : sem === 'Genap' ? 2 : 3)
      return semOrder(a.semester) - semOrder(b.semester)
    })
  }, [list])


  useEffect(() => {
    fetchMasterData()
    fetchAcademicYears()
  }, [])

  const fetchAcademicYears = async () => {
    try {
      const { getActivePeriods, getActiveSettings } = await import('@/lib/settings-client');
      const periods = await getActivePeriods();
      setActivePeriods(periods);
      const defaultSettings = await getActiveSettings();

      if (periods.length > 0) {
        const uniqueYears = Array.from(new Set(periods.map(p => p.tahun_ajaran)));
        setAcademicYears(uniqueYears);

        const currentYearIsValid = uniqueYears.includes(tahunAjaran);

        if (!currentYearIsValid && defaultSettings) {
          setTahunAjaran(defaultSettings.tahun_ajaran);
          setSemester(defaultSettings.semester);
        } else if (!currentYearIsValid && periods.length > 0) {
          setTahunAjaran(periods[0].tahun_ajaran);
          setSemester(periods[0].semester);
        }
      } else {
        setAcademicYears([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Debounced fetch on filter/page changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData()
    }, 500)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaran, semester, searchTerm, currentPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaran, semester, searchTerm])

  const fetchMasterData = async () => {
    try {
      // jenis=GURU: tendik tidak boleh muncul sebagai kandidat wali kelas.
      const [resGuru, resKelas] = await Promise.all([fetch('/api/master/guru?limit=10000&jenis=GURU'), fetch('/api/master/kelas')])
      const [jsonGuru, jsonKelas] = await Promise.all([resGuru.json(), resKelas.json()])
      if (jsonGuru.ok) setMasterGuru(jsonGuru.data)
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
      page: currentPage.toString(),
      limit: pageSize.toString(),
    })
    try {
      const res = await fetch(`/api/settings/wali-kelas?${params}`)
      const json = await res.json()
      if (json.ok) {
        setList(json.data || [])
        setTotalItems(json.total || 0)
      } else {
        setList([])
        setTotalItems(0)
      }
    } catch (err) {
      console.error(err)
      setList([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.id ? !canUpdate : !canCreate) return
    if (!formData.nip) {
      alert('Silahkan pilih Wali Kelas (Guru)')
      return
    }
    setSaving(true)
    try {
      if (formData.id) {
        const payload = {
          ...formData,
          tahun_ajaran: tahunAjaran,
          semester: formData.semester,
        }
        const res = await fetch('/api/settings/wali-kelas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error)
      } else {
        // Pakai pilihan semester dari modal, bukan filter toolbar
        const targetSemesters = !formSemester || formSemester === 'Semua' ? ['Ganjil', 'Genap'] : [formSemester]

        const promises = targetSemesters.map((sem) => {
          const payload = {
            ...formData,
            tahun_ajaran: tahunAjaran,
            semester: sem,
          }
          return fetch('/api/settings/wali-kelas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        })

        const responses = await Promise.all(promises)
        const jsonResponses = await Promise.all(responses.map((r) => r.json()))

        const error = jsonResponses.find((j) => !j.ok)
        if (error) throw new Error(error.error || 'Gagal menyimpan sebagian data')
      }

      setShowModal(false)
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Terjadi kesalahan')
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
    setDeleting(true)
    try {
      const res = await fetch(`/api/settings/wali-kelas?id=${deleteItemId}`, { method: 'DELETE' })
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

  const handleExport = async () => {
    if (totalItems === 0) {
      alert('Tidak ada data untuk diexport')
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams({
        q: searchTerm,
        tahun_ajaran: tahunAjaran === 'Semua' ? '' : tahunAjaran,
        semester: semester === 'Semua' ? '' : semester,
        limit: '10000', // Fetch all for export
      })
      const res = await fetch(`/api/settings/wali-kelas?${params}`)
      const json = await res.json()

      if (!json.ok) throw new Error(json.error)
      const allData: WaliKelas[] = json.data || []

      const dataToExport = allData.map((item, index) => ({
        No: index + 1,
        Kelas: item.nama_kelas,
        Nama_Guru: item.nama_guru,
        NIP: item.nip,
        Tahun_Ajaran: item.tahun_ajaran,
        Semester: item.semester,
        Status: item.aktif ? 'Aktif' : 'Non-Aktif',
      }))
      exportToExcel(dataToExport, `WaliKelas_${tahunAjaran.replace('/', '-')}_${semester}`)
    } catch (err: any) {
      console.error(err)
      alert('Gagal fetching data untuk export: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const mapImportRow = (row: any) => {
    const nip = row['NIP'] || row['nip']
    const nama = row['Nama_Guru'] || row['Nama Guru'] || row['nama_guru'] || ''
    const kelas = row['Kelas'] || row['kelas'] || row['Nama_Kelas']

    const ta = row['Tahun_Ajaran'] || row['Tahun Ajaran'] || row['tahun_ajaran']
    if (!ta || String(ta).trim() === '') return null

    let sem = row['Semester'] || row['semester'] || ''

    if (!nip || !kelas) return null

    const base = {
      nip: String(nip),
      nama_guru: String(nama),
      nama_kelas: String(kelas),
      tahun_ajaran: String(ta),
      aktif: true,
    }

    if (!sem || String(sem).toLowerCase() === 'semua') {
      return [
        { ...base, semester: 'Ganjil' },
        { ...base, semester: 'Genap' },
      ]
    }

    const validSemesters = ['ganjil', 'genap']
    if (!validSemesters.includes(String(sem).toLowerCase())) return null

    return { ...base, semester: String(sem) }
  }

  const openAdd = () => {
    setFormData({ aktif: true, tahun_ajaran: tahunAjaran })
    setFormSemester(semester || 'Semua')
    setSelectedClass('')
    setShowModal(true)
  }

  return (
    <div className="wk">
      {/* ===== Toolbar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari Kelas / Guru..."
        />
        <FilterSelect
          label="Tahun Ajaran"
          value={tahunAjaran}
          onChange={setTahunAjaran}
        >
          {academicYears.length > 1 && <option value="Semua">Semua</option>}
          {academicYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Semester"
          value={semester}
          onChange={setSemester}
        >
          {availableSemesters.length > 1 && <option value="Semua">Semua</option>}
          {availableSemesters.map(s => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
        <FilterActions>
          {(canImport || canExport) && (
            <div className="sk__menuWrap" ref={actionMenuRef}>
              <button
                type="button"
                className="sk__btnActionMenu ftb-btn-icon-mobile"
                onClick={() => setShowActionMenu(!showActionMenu)}
                title="Opsi"
              >
                <i className="bi bi-three-dots-vertical" />
                <span>Opsi</span>
              </button>
              {showActionMenu && (
                <div className="sk__moreMenu">
                  {canImport && (
                    <button type="button" onClick={() => { setShowActionMenu(false); setShowImportModal(true) }}>
                      <i className="bi bi-download" /> Import Excel
                    </button>
                  )}
                  {canExport && (
                    <button type="button" onClick={() => { setShowActionMenu(false); handleExport() }}>
                      <i className="bi bi-upload" /> Export Data
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {canImport && (
            <Button variant="outline" className="btn-text-desktop" icon="download" onClick={() => setShowImportModal(true)} title="Import Excel">
              Import
            </Button>
          )}
          {canExport && (
            <Button variant="outline" className="btn-text-desktop" icon="upload" onClick={handleExport} title="Export Data">
              Export
            </Button>
          )}
        </FilterActions>
      </FilterToolbar>

      {canCreate && (
        <DesktopFab
          label="Tambah"
          icon="plus-lg"
          onClick={openAdd}
        />
      )}

      {/* ===== Table (Desktop/Tablet) ===== */}
      <div className="wk__tableWrap">
        <table className="wk__table">
          <thead>
            <tr>
              <th className="cNo">No</th>
              <th>Nama Kelas</th>
              <th>Nama Guru (Wali Kelas)</th>
              <th className="cNip">ID Guru / NIP</th>
              <th className="cTa">Tahun Ajaran</th>
              <th className="cSem">Semester</th>
              <th className="cStatus">Status</th>
              <th className="cAksi">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="wk__empty">
                  <Spinner variant="buble" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={8} className="wk__empty wk__muted">
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              sortedList.map((item, index) => (
                <tr key={item.id ?? `${item.nip}-${index}`}>
                  <td className="tCenter">{index + 1}</td>
                  <td className="tPlain">{item.nama_kelas}</td>
                  <td className="tPlain">{item.nama_guru}</td>
                  <td className="tMono">{item.nip}</td>
                  <td className="tMuted">{item.tahun_ajaran}</td>
                  <td>
                    <span className={`wk__pill ${item.semester === 'Ganjil' ? 'isGanjil' : 'isGenap'}`}>
                      {item.semester}
                    </span>
                  </td>
                  <td>
                    <span className={`wk__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                      {item.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td>
                    <ActionGroup>
                      {canUpdate && (
                        <ActionButton
                          action="edit"
                          onClick={() => {
                            setFormData(item)
                            setSelectedClass(item.nama_kelas)
                            setShowModal(true)
                          }}
                        />
                      )}
                      {canDelete && (
                        <ActionButton
                          action="delete"
                          onClick={() => item.id && handleDelete(item.id, item.nama_guru)}
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

      {/* ===== Mobile Cards ===== */}
      <div className="wk__cards" aria-label="Daftar Wali Kelas versi mobile">
        {loading ? (
          <div className="wk__card">
            <div className="wk__cardHead">
              <div className="wk__cardTitle">
                <Spinner variant="buble" />
              </div>
            </div>
          </div>
        ) : list.length === 0 ? (
          <div className="wk__card">
            <div className="wk__cardHead">
              <div className="wk__cardTitle">
                <div className="wk__cardName">Tidak ada data</div>
                <div className="wk__cardSub">Coba ubah filter</div>
              </div>
            </div>
          </div>
        ) : (
          sortedList.map((item, index) => (

            <div className="wk__card" key={`m-${item.id ?? `${item.nip}-${index}`}`}>
              <div className="wk__cardHead">
                <div className="wk__cardTitle">
                  <div className="wk__cardName" title={item.nama_kelas}>
                    {item.nama_kelas}
                  </div>
                  <div className="wk__cardSub">{item.nama_guru}</div>
                </div>
              </div>

              <div className="wk__cardFoot">
                <div className="wk__statusLeft">
                  <span className={`wk__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                    {item.aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
                <ActionGroup>
                  {canUpdate && (
                    <ActionButton
                      action="edit"
                      onClick={() => {
                        setFormData(item)
                        setSelectedClass(item.nama_kelas)
                        setShowModal(true)
                      }}
                    />
                  )}

                  {canDelete && (
                    <ActionButton
                      action="delete"
                      onClick={() => item.id && handleDelete(item.id, item.nama_guru)}
                    />
                  )}
                </ActionGroup>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== Pagination ===== */}
      {totalItems > pageSize && (
        <Pagination itemLabel="wali kelas"
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
        <Modal size="md" variant={formData.id ? "edit" : "add"} onClose={() => setShowModal(false)} labelledBy="modal-wk-title">
          <ModalHeader
            id="modal-wk-title"
            title={formData.id ? 'Edit Wali Kelas' : 'Tambah Wali Kelas'}
            subtitle={`Periode: ${tahunAjaran} • ${formData.id ? formData.semester : (formSemester === 'Semua' ? 'Ganjil & Genap' : formSemester)}`}
            icon={formData.id ? "pencil-square" : "plus-circle-fill"}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <div className="sk__grid2">
              <div className="sk__field">
                <label>1. Pilih Kelas</label>
                <select
                  value={formData.nama_kelas || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, nama_kelas: e.target.value })
                    setSelectedClass(e.target.value)
                  }}
                  required
                >
                  <option value="">— Pilih Kelas —</option>
                  {masterKelas.map((k) => (
                    <option key={k.id} value={k.nama}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sk__field wk__z">
                <SearchableSelect
                  label="2. Pilih Wali Kelas (Guru)"
                  placeholder="Cari guru..."
                  value={formData.nip || ''}
                  options={masterGuru.map((g) => ({
                    value: g.nip,
                    label: g.nama_lengkap,
                    subLabel: g.nip,
                  }))}
                  onChange={(val) => {
                    const v = val as string
                    const selected = masterGuru.find((g) => g.nip === v)
                    setFormData({
                      ...formData,
                      nip: v,
                      nama_guru: selected ? selected.nama_lengkap : '',
                    })
                  }}
                  disabled={!formData.nama_kelas}
                />
              </div>

              <div className="sk__field">
                <label>Tahun Ajaran</label>
                <input
                  type="text"
                  value={formData.tahun_ajaran || tahunAjaran}
                  onChange={(e) => setFormData({ ...formData, tahun_ajaran: e.target.value })}
                  required
                  placeholder="2024/2025"
                />
              </div>

              {formData.id ? (
                <div className="sk__field">
                  <label>Semester (Record)</label>
                  <input type="text" value={formData.semester || ''} readOnly />
                </div>
              ) : (
                <div className="sk__field">
                  <label>Semester</label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value)}
                    required
                  >
                    <option value="Semua">Semua (Ganjil & Genap)</option>
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                  {formSemester === 'Semua' && (
                    <small style={{ display: 'block', marginTop: 6, fontSize: '0.74rem', color: 'rgba(100,116,139,0.95)' }}>
                      <i className="bi bi-info-circle" /> 2 data akan ditambahkan: semester Ganjil dan Genap.
                    </small>
                  )}
                </div>
              )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="cancel" type="button" onClick={() => setShowModal(false)} leftIcon={<i className="bi bi-x-lg" />}>
                Batal
              </Button>
              <Button variant="primary" type="submit" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                {saving ? null : 'Simpan'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Import Modal */}
      {showImportModal && (
            <ImportModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImportSuccess={fetchData}
              templateColumns={['No', 'NIP', 'Nama_Guru', 'Kelas', 'Tahun_Ajaran']}
              templateName="Template_WaliKelas"
              apiEndpoint="/api/settings/wali-kelas"
              mapRowData={mapImportRow}
            />
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal size="sm" variant="delete" onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }} labelledBy="modal-wk-del">
          <ModalHeader
            id="modal-wk-del"
            title={deleteItemName}
            icon="trash3"
            onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
          />
          <ModalFooter>
            <Button variant="cancel" type="button" onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); }} leftIcon={<i className="bi bi-x-lg" />}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              isLoading={deleting}
              leftIcon={<i className="bi bi-trash3-fill" />}
            >
              {deleting ? null : 'Ya, Hapus!'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <style jsx>{`
        :global(:root) {
          --wk-line: rgba(148, 163, 184, 0.22);
          --wk-card: rgba(255, 255, 255, 0.92);
          --wk-shadow: 0 14px 34px rgba(2, 6, 23, 0.08);
          --wk-shadow2: 0 10px 22px rgba(2, 6, 23, 0.08);
          --wk-radius: 16px;

          --wk-fs: 0.86rem;
          --wk-fs-sm: 0.8rem;
          --wk-fs-xs: 0.76rem;

          --wk-blue: rgba(58, 166, 255, 0.95);
          --wk-blue2: rgba(15, 42, 86, 0.92);
        }

        .wk {
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: var(--wk-fs);
          padding: 0;
          background: transparent;
        }

        /* ========= TOOLBAR ========= */
        .wk__bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          width: 100%;
          min-width: 0;
        }

        .wk__filters {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          padding: 8px;
          border-radius: var(--wk-radius);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--wk-line);
          box-shadow: var(--wk-shadow2);
        }

        .wk__search {
          position: relative;
          flex: 1 1 280px;
          min-width: 180px;
        }

        .wk__search i {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(100, 116, 139, 0.9);
          pointer-events: none;
          font-size: 0.88rem;
        }

        .wk__search input {
          width: 100%;
          padding: 8px 10px 8px 30px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          font-weight: 550;
          color: rgba(15, 23, 42, 0.92);
          outline: none;
          font-size: var(--wk-fs-sm);
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }

        .wk__filters select {
          padding: 8px 10px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          font-weight: 600;
          color: rgba(15, 23, 42, 0.86);
          outline: none;
          min-width: 138px;
          font-size: var(--wk-fs-sm);
        }

        .wk__search input:focus,
        .wk__filters select:focus {
          border-color: rgba(58, 166, 255, 0.55);
          box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14);
        }

        .wk__actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .wk__btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid var(--wk-line);
          background: rgba(255, 255, 255, 0.78);
          color: rgba(7, 22, 46, 0.9);
          font-weight: 700;
          cursor: pointer;
          font-size: var(--wk-fs-sm);
          transition: transform 0.15s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          white-space: nowrap;
        }

        .wk__btn i {
          font-size: 1rem;
        }

        .wk__btn:hover {
          /* background: rgba(255, 255, 255, 0.92); removed to keep gradient */
          border-color: rgba(58, 166, 255, 0.24);
          box-shadow: 0 4px 12px rgba(58, 166, 255, 0.2);
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .wk__btn:active {
          transform: translateY(0);
        }

        .wk__btnGhost {
          background: rgba(255, 255, 255, 0.78);
        }

        .wk__btnPrimary {
          background: #3083FF;
          border-color: rgba(58, 166, 255, 0.32);
          color: #fff;
        }

        .wk__btnExport {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
          border-color: rgba(16, 185, 129, 0.28);
          color: #fff;
        }

        .wk__btnImport {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.92), rgba(15, 42, 86, 0.86));
          border-color: rgba(245, 158, 11, 0.28);
          color: #fff;
        }

        /* ========= TABLE ========= */
        .wk__tableWrap {
          width: 100%;
          min-width: 0;
          overflow: auto;
          border-radius: var(--wk-radius);
          border: 1px solid var(--wk-line);
          background: rgba(255, 255, 255, 0.85);
          box-shadow: var(--wk-shadow);
        }

        .wk__table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 980px;
        }

        .wk__table thead th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.98));
          color: rgba(7, 22, 46, 0.86);
          font-size: var(--wk-fs-xs);
          font-weight: 800;
          letter-spacing: 0.01em;
          text-align: left;
          padding: 10px 10px;
          border-bottom: 1px solid var(--wk-line);
          white-space: nowrap;
        }

        .wk__table tbody td {
          padding: 10px 10px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          color: rgba(15, 23, 42, 0.92);
          font-size: var(--wk-fs-sm);
          font-weight: 400;
          vertical-align: middle;
          background: rgba(255, 255, 255, 0.82);
        }

        .wk__table tbody tr:nth-child(even) td {
          background: rgba(248, 250, 252, 0.85);
        }

        .wk__table tbody tr:hover td {
          background: rgba(58, 166, 255, 0.05);
        }

        .wk__empty {
          text-align: center;
          padding: 18px 10px !important;
          font-weight: 600;
          font-size: var(--wk-fs-sm);
        }

        .wk__muted {
          color: rgba(100, 116, 139, 0.9) !important;
          font-weight: 400 !important;
        }

        .cNo {
          width: 56px;
        }
        .cNip {
          width: 170px;
        }
        .cTa {
          width: 120px;
        }
        .cSem {
          width: 110px;
        }
        .cStatus {
          width: 110px;
        }
        .cAksi {
          width: 120px;
          text-align: right;
        }

        .tCenter {
          text-align: center;
        }
        .tMono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: var(--wk-fs-xs);
          font-weight: 400;
        }
        .tPlain {
          font-weight: 400;
        }
        .tMuted {
          color: rgba(100, 116, 139, 0.9);
        }

        .wk__pill {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border-radius: 999px;
          font-weight: 500;
          font-size: var(--wk-fs-xs);
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .wk__pill.isGanjil {
          background: rgba(37, 99, 235, 0.12);
          border-color: rgba(37, 99, 235, 0.25);
          color: #2563eb;
        }

        .wk__pill.isGenap {
          background: rgba(2, 132, 199, 0.12);
          border-color: rgba(2, 132, 199, 0.25);
          color: #0284c7;
        }


        .wk__status {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border-radius: 999px;
          font-weight: 500;
          font-size: var(--wk-fs-xs);
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .wk__status::before {
          content: none !important;
          display: none !important;
        }

        .wk__status.isOn {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.18);
          color: rgba(22, 163, 74, 1);
        }

        .wk__status.isOff {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.16);
          color: rgba(220, 38, 38, 1);
        }

        .wk__rowActions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
        }

        .wk__iconBtn {
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

        .wk__iconBtn:hover {
          box-shadow: var(--wk-shadow2);
          transform: translateY(-1px);
          border-color: rgba(58, 166, 255, 0.22);
        }

        .wk__iconBtn.danger {
          color: rgba(220, 38, 38, 1);
          border-color: rgba(239, 68, 68, 0.18);
          background: rgba(239, 68, 68, 0.06);
        }

        /* ========= MOBILE CARDS ========= */
        .wk__cards {
          display: none; /* ✅ default desktop: hide */
          flex-direction: column;
          gap: 12px;
        }

        .wk__card {
          background: var(--n-card);
          border: 1px solid rgba(15, 42, 86, 0.14);
          border-radius: 16px;
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.1);
          overflow: hidden;
        }

        .wk__cardHead {
          padding: 14px 14px 10px;
        }

        .wk__cardTitle {
          min-width: 0;
        }

        .wk__cardName {
          font-weight: 800;
          color: rgba(11, 31, 58, 0.95);
          font-size: 0.98rem;
          line-height: 1.25;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
          word-break: break-word;
        }

        .wk__cardSub {
          margin-top: 4px;
          color: rgba(100, 116, 139, 0.95);
          font-weight: 600;
          font-size: 0.82rem;
        }

        .wk__cardBody {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .wk__kv {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .wk__k {
          color: rgba(15, 42, 86, 0.7);
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          flex: 0 0 112px;
        }

        .wk__v {
          flex: 1 1 auto;
          min-width: 0;
          text-align: right;
          color: rgba(15, 23, 42, 0.92);
          font-weight: 500;
          overflow-wrap: anywhere;
        }

        .wk__cardFoot {
          display: flex;
          gap: 10px;
          padding: 8px 12px;
        }

        .wk__statusLeft {
          flex: 1 1 auto;
        }

        .wk__actionsRight {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .wk__actionBtn {
          flex: 1 1 0;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          border-radius: 12px;
          border: 1px solid rgba(15, 42, 86, 0.16);
          background: var(--n-card);
          color: rgba(11, 31, 58, 0.92);
          font-weight: 600;
          font-size: 0.86rem;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.18s ease;
          height: auto;
        }

        .wk__actionBtn:hover {
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.1);
          transform: translateY(-1px);
        }

        .wk__actionBtn.danger {
          color: rgba(220, 38, 38, 1);
          border-color: rgba(239, 68, 68, 0.18);
          background: rgba(239, 68, 68, 0.06);
        }

        /* ========= MODAL ========= */
        .wk__modalOverlay {
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

        .wk__modal {
          width: min(640px, 100%);
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          box-shadow: 0 28px 80px rgba(2, 6, 23, 0.35);
          overflow: hidden;
        }

        .wk__modalHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }

        .wk__modalTitle h2 {
          margin: 0 0 3px;
          font-size: 0.98rem;
          font-weight: 800;
          color: rgba(7, 22, 46, 0.96);
        }

        .wk__modalTitle p {
          margin: 0;
          font-size: var(--wk-fs-sm);
          font-weight: 500;
          color: rgba(100, 116, 139, 0.95);
        }

        .wk__close {
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

        .wk__z {
          position: relative;
          z-index: 50;
        }

        /* ✅ Switch yang konsisten: Desktop=Table, Mobile=Cards */
        @media (max-width: 768px) {
          .wk__tableWrap { display: none; }
          .wk__cards { display: flex; flex-direction: column; gap: 12px; }
          .wk {
             padding: 0;
             padding-bottom: 20px; /* Safe padding */
             background: transparent;
             border-radius: 0;
          }

          .wk__actions {
             width: 100%;
             display: flex;
             gap: 6px;
             margin-bottom: 12px;
          }
          .wk__actions .wk__btn {
             flex: 1;
             height: 40px;
             padding: 9px 8px;
             justify-content: center;
             min-width: 0;
          }
          .wk__actions .wk__btn span {
             font-size: 0.75rem;
          }

          /* ✅ Pagination responsive */
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
        }

        @media (max-width: 420px) {
          .wk {
            padding-bottom: 20px;
          }

          .wk__filters {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .wk__search {
            grid-column: 1 / -1;
            min-width: 0;
          }

          .wk__filters select {
            min-width: 0;
            width: 100%;
          }



          .wk__modal {
            width: 100%;
          }
          .wk__modalFoot {
            flex-direction: column-reverse;
          }
          .wk__modalFoot .wk__btn {
            width: 100%;
            justify-content: center;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wk__btn,
          .wk__iconBtn,
          .wk__actionBtn {
            transition: none;
          }
          .wk__btn:hover,
          .wk__iconBtn:hover,
          .wk__actionBtn:hover {
            transform: none;
          }
        }
        :global(.dark) .wk__card { background: var(--n-card); }
      /* ===== DARK MODE STANDARD ===== */
      :global(.dark) .wk__filters,
      :global(.dark) .wk__tableWrap,
      :global(.dark) .wk__modal,
      :global(.dark) .wk__card {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
      }
      :global(.dark) .wk__search input,
      :global(.dark) .wk__filters select,
      :global(.dark) .wk__field input,
      :global(.dark) .wk__field select {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 12px !important;
          color: #e2e8f0 !important;
      }
      :global(.dark) .wk__filters select {
          height: 40px !important;
          background-color: #000000 !important;
          background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjYgOSAxMiAxNSAxOCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==") !important;
          background-repeat: no-repeat !important;
          background-position: right 12px center !important;
          background-size: 16px 16px !important;
          padding-right: 36px !important;
          -webkit-appearance: none !important;
          appearance: none !important;
      }
      :global(.dark) .wk__table thead th {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
      }
      :global(.dark) .wk__table tbody td {
          background: #000000 !important;
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
          color: #cbd5e1 !important;
      }
      :global(.dark) .wk__table tbody tr:nth-child(even) td {
          background: #000000 !important;
      }
      :global(.dark) .wk__table tbody tr:hover td {
          background: rgba(26, 115, 232, 0.08) !important;
      }
      :global(.dark) .wk__btnPrimary {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(59, 130, 246, 0.6) !important;
          box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
      }
      :global(.dark) .wk__btnExport {
          background: #000000 !important;
          color: #60a5fa !important;
          border: 1.5px solid rgba(59, 130, 246, 0.5) !important;
      }
      :global(.dark) .wk__btnExport:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .wk__btnImport {
          background: #000000 !important;
          color: #38bdf8 !important;
          border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
      }
      :global(.dark) .wk__btnImport:hover {
          background: rgba(2, 132, 199, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .wk__status.isOn {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.5) !important;
      }
      :global(.dark) .wk__status.isOff {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
      }
      :global(.dark) .wk__pill.isGanjil {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
      }
      :global(.dark) .wk__pill.isGenap {
          background: rgba(14, 165, 233, 0.2) !important;
          color: #38bdf8 !important;
          border: 1px solid rgba(56, 189, 248, 0.4) !important;
      }

      :global(.dark) .wk__iconBtn {
          background: #000000 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #60a5fa !important;
      }
      :global(.dark) .wk__iconBtn:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .wk__iconBtn.danger {
          background: #000000 !important;
          border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
          color: #f87171 !important;
      }
      :global(.dark) .wk__iconBtn.danger:hover {
          background: rgba(239, 68, 68, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .wk__modalHead {
          background: #000000 !important;
          border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
      }
      :global(.dark) .wk__modalTitle h2 { color: #60a5fa !important; }
      :global(.dark) .wk__modalTitle p { color: #94a3b8 !important; }
      :global(.dark) .wk__close {
          background: #000000 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #60a5fa !important;
      }
      :global(.dark) .wk__close:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
      }

      :global(.dark) .wk__modalBody { background: #000000 !important; }
      :global(.dark) .wk__modalFoot {
          background: #000000 !important;
          border-top: 1px solid rgba(26, 115, 232, 0.4) !important;
      }
      :global(.dark) .wk__field label {
          color: #94a3b8 !important;
      }
      :global(.dark) .wk__cardHead, :global(.dark) .wk__cardBody, :global(.dark) .wk__cardFoot {
          background: #000000 !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
      }
      :global(.dark) .wk__cardName, :global(.dark) .wk__v {
          color: #e2e8f0 !important;
      }
      :global(.dark) .wk__k {
          color: #94a3b8 !important;
      }

      /* Delete Modal Styles */
      .wk__delModal {
        background: var(--n-card);
        border-radius: 20px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        overflow: hidden;
        animation: zoomIn 0.2s;
      }
      .wk__delModalHead {
        padding: 20px 24px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(to bottom, #fef2f2, #fff);
      }
      .wk__delTitle {
        margin: 0;
        font-weight: 800;
        color: var(--n-text);
        font-size: 1.1rem;
      }
      .wk__delModalBody {
        padding: 24px;
      }
      .wk__delText {
        color: var(--n-muted);
        font-size: 0.9rem;
        margin-bottom: 8px;
      }
      .wk__delWarn {
        color: #dc2626;
        font-size: 0.82rem;
        font-weight: 600;
        margin-top: 12px;
      }
      .wk__delModalFoot {
        padding: 16px 24px;
        background: #f8fafc;
        display: flex;
        gap: 12px;
      }
      .wk__btnCancel {
        flex: 1;
        padding: 12px;
        background: var(--n-card);
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        font-weight: 700;
        color: var(--n-muted);
        cursor: pointer;
        transition: all 0.2s;
      }
      .wk__btnCancel:hover {
        background: var(--n-surface);
        color: var(--n-ink);
      }
      .wk__btnDanger {
        flex: 2;
        padding: 12px;
        background: linear-gradient(135deg, #dc2626, #ef4444);
        border: none;
        border-radius: 12px;
        font-weight: 700;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
      }
      .wk__btnDanger:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
      }
      .wk__btnDanger:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      :global(.dark) .wk__delModal {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
      }
      :global(.dark) .wk__delModalHead {
          background: #000000 !important;
          border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
      }
      :global(.dark) .wk__delTitle {
          color: #60a5fa !important;
      }
      :global(.dark) .wk__delTitle i {
          color: #60a5fa !important;
      }

      :global(.dark) .wk__delModalBody {
          background: #000000 !important;
      }
      :global(.dark) .wk__delText {
          color: #cbd5e1 !important;
      }
      :global(.dark) .wk__delText strong {
          color: #ffffff !important;
      }
      :global(.dark) .wk__delWarn {
          color: #f87171 !important;
      }
      :global(.dark) .wk__delModalFoot {
          background: #000000 !important;
          border-top: 1px solid rgba(37, 99, 235, 0.4) !important;
      }
      :global(.dark) .wk__btnCancel {
          background: #000000 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
      }
      :global(.dark) .wk__btnCancel:hover {
          background: rgba(26, 115, 232, 0.15) !important;
          color: #ffffff !important;
      }
      :global(.dark) .wk__btnDanger {
          background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
          color: #ffffff !important;
          border: 1px solid rgba(239, 68, 68, 0.6) !important;
          box-shadow: 0 4px 16px rgba(220, 38, 38, 0.45) !important;
      }
      /* ===== END DARK MODE STANDARD ===== */



`}</style>
    </div>
  )
}
