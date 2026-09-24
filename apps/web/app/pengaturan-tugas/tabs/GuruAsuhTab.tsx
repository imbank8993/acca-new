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

interface GuruAsuh {
  id?: number
  nip: string
  nama_guru: string
  nisn_siswa: string
  nama_siswa: string
  kelas: string
  tahun_ajaran: string
  aktif: boolean
}

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanTugasAccess(), bukan dari objek user. Propnya tetap diterima agar
// pemanggil (view.tsx) tidak perlu diubah.
export default function GuruAsuhTab(_props: { user?: unknown }) {
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
  const bolehKelola = boleh('guru_asuh')

  const canCreate = bolehKelola
  const canUpdate = bolehKelola
  const canDelete = bolehKelola
  const canImport = bolehKelola
  const canExport = bolehKelola

  // Local Filter State
  const [tahunAjaran, setTahunAjaran] = useState(getCurrentAcademicYear())

  const [list, setList] = useState<GuruAsuh[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [showActionMenu, setShowActionMenu] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showActionMenu) return
    const onClick = (e: MouseEvent) => {
      if (!actionMenuRef.current?.contains(e.target as Node)) setShowActionMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showActionMenu])

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  // Selection States for new entry
  const [selectedNip, setSelectedNip] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [studentSearchTerm, setStudentSearchTerm] = useState('')

  // Master data for selection
  const [masterGuru, setMasterGuru] = useState<any[]>([])
  const [masterKelas, setMasterKelas] = useState<any[]>([])
  const [studentsInClass, setStudentsInClass] = useState<any[]>([])

  // Tracking existing assignments to hide occupied students
  const [allAssignments, setAllAssignments] = useState<GuruAsuh[]>([])
  const [academicYears, setAcademicYears] = useState<string[]>([])

  useEffect(() => {
    fetchMasterData()
    fetchAcademicYears()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Debounced fetch when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1)
      fetchData()
    }, 500)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaran, searchTerm])

  // Immediate fetch when page changes
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // Effect to fetch students and assignments whenever showModal is true or year changes
  useEffect(() => {
    if (showModal) {
      fetchStudents()
      fetchAllAssignments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, tahunAjaran])

  const fetchStudents = async () => {
    try {
      const res = await fetch(
        `/api/settings/siswa-kelas?tahun_ajaran=${tahunAjaran === 'Semua' ? getCurrentAcademicYear() : tahunAjaran}&limit=2000`
      )
      const json = await res.json()
      if (json.ok) {
        const uniqueStudents = Array.from(
          new Map(json.data.map((item: any) => [item.nisn, item])).values()
        )
        setStudentsInClass(uniqueStudents)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchAllAssignments = async () => {
    if (tahunAjaran === 'Semua') return
    try {
      const res = await fetch(`/api/settings/guru-asuh?tahun_ajaran=${tahunAjaran}`)
      const json = await res.json()
      if (json.ok) setAllAssignments(json.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchMasterData = async () => {
    try {
      // jenis=GURU: tendik tidak boleh muncul sebagai kandidat guru asuh.
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
      page: currentPage.toString(),
      limit: pageSize.toString(),
    })
    try {
      const res = await fetch(`/api/settings/guru-asuh?${params}`)
      const json = await res.json()
      if (json.ok) {
        setList(json.data)
        setTotalItems(json.total || 0)
      } else {
        setList([])
        setTotalItems(0)
      }
    } catch (e) {
      console.error(e)
      setList([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }

  const closeFormModal = () => {
    setShowModal(false)
    setEditId(null)
    setSelectedStudents([])
    setSelectedNip('')
    setSelectedClass('')
    setStudentSearchTerm('')
  }

  const { registerModal } = useModalBlur()

  useEffect(() => {
    if (showModal || showImportModal || showDeleteModal) return registerModal()
  }, [showModal, showImportModal, showDeleteModal, registerModal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editId ? !canUpdate : !canCreate) return
    if (!selectedNip || selectedStudents.length === 0) {
      alert('Pilih guru dan minimal satu siswa!')
      return
    }

    if (tahunAjaran === 'Semua') {
      alert('Pilih Tahun Ajaran spesifik untuk menambah relasi.')
      return
    }

    setSaving(true)
    try {
      const guru = masterGuru.find((g) => g.nip === selectedNip)

      const itemsToSave = selectedStudents.map((nisn) => {
        const studentDetail = studentsInClass.find((s) => s.nisn === nisn)
        const currentEditItem = editId ? list.find((l) => l.id === editId) : null

        const namaSiswa =
          studentDetail?.nama_siswa || (currentEditItem?.nisn_siswa === nisn ? currentEditItem?.nama_siswa : '')
        const kelas =
          studentDetail?.kelas || selectedClass || (currentEditItem?.nisn_siswa === nisn ? currentEditItem?.kelas : '')

        if (!kelas) {
          throw new Error(`Data kelas tidak ditemukan untuk siswa ${namaSiswa || nisn}.`)
        }

        return {
          id: editId ?? undefined,
          nip: selectedNip,
          nama_guru: guru?.nama_lengkap || '',
          nisn_siswa: nisn,
          nama_siswa: namaSiswa,
          kelas,
          tahun_ajaran: tahunAjaran,
          aktif: true,
        }
      })

      if (editId) {
        const payload = itemsToSave[0]
        const res = await fetch('/api/settings/guru-asuh', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Gagal mengubah data')
      } else {
        const promises = itemsToSave.map((item) =>
          fetch('/api/settings/guru-asuh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          }).then(async (res) => {
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Gagal menyimpan data')
            return json
          })
        )
        await Promise.all(promises)
      }

      closeFormModal()
      fetchData()
      alert('Data berhasil disimpan!')
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Terjadi kesalahan saat menyimpan data.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: GuruAsuh) => {
    if (!canUpdate) return
    setEditId(item.id!)
    setSelectedNip(item.nip)
    setSelectedClass(item.kelas)
    setSelectedStudents([item.nisn_siswa])
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
      const res = await fetch(`/api/settings/guru-asuh?id=${deleteItemId}`, { method: 'DELETE' })
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
    if (list.length === 0) {
      alert('Tidak ada data untuk diexport')
      return
    }
    const dataToExport = list.map((item, index) => ({
      No: index + 1,
      NIP: item.nip,
      Nama_Guru: item.nama_guru,
      NISN_Siswa: item.nisn_siswa,
      Nama_Siswa: item.nama_siswa,
      Kelas: item.kelas,
      Tahun_Ajaran: item.tahun_ajaran,
      Status: item.aktif ? 'Aktif' : 'Non-Aktif',
    }))
    exportToExcel(dataToExport, `GuruAsuh_${tahunAjaran}`)
  }

  const mapImportRow = (row: any) => {
    const nip = row['NIP'] || row['nip']
    const nisn = row['NISN_Siswa'] || row['NISN'] || row['nisn_siswa'] || row['nisn']
    const namaG = row['Nama_Guru'] || row['nama_guru'] || ''
    const namaS = row['Nama_Siswa'] || row['nama_siswa'] || ''
    const kelas = row['Kelas'] || row['kelas'] || ''
    const statusRaw = row['Status'] || row['status']

    const ta = row['Tahun_Ajaran'] || row['tahun_ajaran']
    if (!ta || String(ta).trim() === '') return null
    if (!nip || !nisn) return null

    let status = true
    if (statusRaw !== undefined && statusRaw !== null && String(statusRaw).trim() !== '') {
      const s = String(statusRaw).trim().toLowerCase()
      if (s === 'false' || s === 'non-aktif' || s === 'non aktif' || s === 'inactive') status = false
    }

    return {
      nip: String(nip),
      nama_guru: String(namaG),
      nisn_siswa: String(nisn),
      nama_siswa: String(namaS),
      kelas: String(kelas),
      tahun_ajaran: String(ta),
      aktif: status,
      status: status,
    }
  }

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

  const filteredStudents = studentsInClass.filter((s) => {
    if (selectedClass && s.kelas !== selectedClass) return false

    const assignment = allAssignments.find((a) => a.nisn_siswa === s.nisn)
    if (assignment) {
      if (!editId) return false
      if (editId && assignment.id !== editId) return false
    }

    if (studentSearchTerm) {
      const term = studentSearchTerm.toLowerCase()
      const matchName = String(s.nama_siswa || '').toLowerCase().includes(term)
      const matchNisn = String(s.nisn || '').includes(term)
      if (!matchName && !matchNisn) return false
    }

    return true
  })

  const openAdd = () => {
    if (tahunAjaran === 'Semua') {
      alert('Pilih Tahun Ajaran spesifik untuk menambah data.')
      return
    }
    setSelectedNip('')
    setSelectedClass('')
    setSelectedStudents([])
    setStudentSearchTerm('')
    setEditId(null)
    setShowModal(true)
  }

  // ===== Mobile grouping per GURU =====
  const groupedMobile = useMemo(() => {
    const map = new Map<string, GuruAsuh[]>()
    for (const item of list) {
      const key = (item.nama_guru || '-').trim() || '-'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'id'))
    return keys.map((k) => ({ guru: k, items: map.get(k)! }))
  }, [list])

  return (
    <div className="ga">
      {/* ===== Toolbar ===== */}
      <FilterToolbar actionsInline>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Cari Guru / Siswa / NISN..."
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
                      <i className="bi bi-upload" /> Export Excel
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {canImport && (
            <Button variant="outline" className="btn-text-desktop" icon="import" onClick={() => setShowImportModal(true)} title="Import Excel">
              Import
            </Button>
          )}
          {canExport && (
            <Button variant="outline" className="btn-text-desktop" icon="export" onClick={handleExport} title="Export Excel">
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
      <div className="ga__tableWrap">
        <table className="ga__table">
          <thead>
            <tr>
              <th className="cNo">No</th>
              <th>Guru</th>
              <th>Nama Siswa</th>
              <th className="cNisn">NISN</th>
              <th className="cKelas">Kelas</th>
              <th className="cStatus">Status</th>
              <th className="cAksi">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="ga__empty">
                  <Spinner variant="trace" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="ga__empty ga__muted">
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              list.map((item, index) => (
                <tr key={item.id ?? `${item.nip}-${item.nisn_siswa}-${index}`}>
                  <td className="tCenter">{index + 1}</td>
                  <td className="tNameCell">
                    <div className="tNameCell__name">{item.nama_guru}</div>
                    <div className="tNameCell__sub">{item.nip}</div>
                  </td>
                  <td className="tPlain">{item.nama_siswa}</td>
                  <td className="tMono">{item.nisn_siswa}</td>
                  <td>
                    <span className="ga__badge">{item.kelas || '-'}</span>
                  </td>
                  <td>
                    <span className={`ga__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                      {item.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td>
                    <ActionGroup>
                      {canUpdate && (
                        <ActionButton action="edit" onClick={() => handleEdit(item)} />
                      )}
                      {canDelete && (
                        <ActionButton
                          action="delete"
                          onClick={() => item.id && handleDelete(item.id, `${item.nama_guru} - ${item.nama_siswa}`)}
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

      {/* ===== Mobile Cards (Grouped by Kelas) ===== */}
      <div className="ga__cards" aria-label="Daftar Guru Asuh versi mobile">
        {loading ? (
          <div className="ga__loading">
            <Spinner variant="trace" />
          </div>
        ) : list.length === 0 ? (
          <div className="ga__emptyState">
            <div className="ga__emptyText">Tidak ada data</div>
            <div className="ga__emptySub">Coba ubah filter</div>
          </div>
        ) : (
          groupedMobile.map((group) => (
            <div className="ga__group" key={`g-${group.guru}`}>
              <div className="ga__groupHead">
                <div className="ga__groupTitleRow">
                  <div>
                    <h3 className="ga__groupTitle">{group.guru}</h3>
                    <div className="ga__groupNip">NIP: {group.items[0]?.nip}</div>
                  </div>
                  <div className="ga__groupMeta">{group.items.length} siswa</div>
                </div>
              </div>

              <div className="ga__groupBody">
                {group.items.map((item, idx) => (
                  <div className="ga__card" key={`m-${item.id ?? `${item.nip}-${item.nisn_siswa}-${idx}`}`}>
                    <div className="ga__cardHead">
                      <div className="ga__cardTitle">
                        <div className="ga__cardName" title={item.nama_siswa}>
                          {item.nama_siswa || '-'}
                        </div>
                        <div className="ga__cardSub">
                          <span className="ga__mono">{item.nisn_siswa}</span>
                        </div>
                      </div>
                    </div>



                    <div className="ga__cardFoot">
                      <div className="ga__cardActions">
                        <div className="ga__cardStatus">
                          <span className={`ga__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                            {item.aktif ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        </div>
                        <ActionGroup>
                          {canUpdate && (
                            <ActionButton action="edit" onClick={() => handleEdit(item)} />
                          )}
                          {canDelete && (
                            <ActionButton
                              action="delete"
                              onClick={() => item.id && handleDelete(item.id, `${item.nama_guru} - ${item.nama_siswa}`)}
                            />
                          )}
                        </ActionGroup>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== Pagination ===== */}
      {totalItems > pageSize && (
        <Pagination itemLabel="guru asuh"
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / pageSize)}
          limit={pageSize}
          totalItems={totalItems}
          recordCount={list.length}
          onPageChange={setCurrentPage}
          onLimitChange={(newLimit) => {
            setCurrentPage(1)
            setPageSize(newLimit)
          }}
        />
      )}

      {/* ===== Modal Add/Edit ===== */}
      {showModal && (
        <Modal size="lg" variant={editId ? "edit" : "add"} onClose={closeFormModal} labelledBy="modal-ga-title">
          <ModalHeader
            id="modal-ga-title"
            title={editId ? 'Edit Guru Asuh' : 'Tambah Guru Asuh'}
            subtitle={`Periode: ${tahunAjaran}`}
            icon={editId ? "pencil-square" : "plus-circle-fill"}
            onClose={closeFormModal}
          />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <div className="sk__field sk__fieldFull ga__z">
                <SearchableSelect
                  label="Pilih Guru"
                  options={masterGuru.map((g) => ({
                    value: g.nip,
                    label: g.nama_lengkap,
                    subLabel: g.nip,
                  }))}
                  value={selectedNip}
                  onChange={(val) => setSelectedNip(val as string)}
                  placeholder="Cari Guru..."
                />
              </div>

              <div className="sk__grid2">
                <div className="sk__field">
                  <label>Tahun Ajaran</label>
                  <input value={tahunAjaran} disabled />
                </div>

                <div className="sk__field">
                  <label>Filter Kelas (Opsional)</label>
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="">-- Semua Kelas --</option>
                    {masterKelas.map((k) => (
                      <option key={k.nama ?? k.id} value={k.nama}>
                        {k.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sk__field sk__fieldFull">
                <label>Pilih Siswa {editId ? '(Ganti Siswa)' : '(Bisa lebih dari satu)'}</label>

                <div className="ga__studentSearch">
                  <i className="bi bi-search" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa atau NISN..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                  />
                </div>

                <div className="ga__multi">
                  {filteredStudents.length === 0 ? (
                    <div className="ga__hint ga__muted">
                      {selectedClass && allAssignments.length > 0
                        ? 'Semua siswa di kelas ini sudah memiliki Guru Asuh.'
                        : 'Tidak ada siswa tersedia.'}
                    </div>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        type="button"
                        key={s.nisn}
                        className={`ga__pick ${selectedStudents.includes(s.nisn) ? 'isOn' : ''}`}
                        onClick={() => toggleStudent(s.nisn)}
                      >
                        <span className="ga__check" aria-hidden="true">
                          {selectedStudents.includes(s.nisn) ? <i className="bi bi-check-lg" /> : null}
                        </span>

                        <span className="ga__pickInfo">
                          <span className="ga__pickName" title={s.nama_siswa}>
                            {s.nama_siswa}
                          </span>
                          <span className="ga__pickMeta">
                            <span className="ga__mono">{s.nisn}</span>
                            <span className="ga__dot" aria-hidden="true">
                              •
                            </span>
                            <span className="ga__pillKelas">{s.kelas}</span>
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <div className="ga__selectedCount">{selectedStudents.length} siswa dipilih</div>
              </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="cancel" type="button" onClick={closeFormModal} leftIcon={<i className="bi bi-x-lg" />}>
                Batal
              </Button>
              <Button variant="primary" type="submit" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                {saving ? null : 'Simpan'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal size="sm" variant="delete" onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }} labelledBy="modal-ga-del">
          <ModalHeader
            id="modal-ga-del"
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

      {/* Import Modal */}
      {showImportModal && (
            <ImportModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImportSuccess={fetchData}
              templateColumns={['No', 'NIP', 'Nama_Guru', 'NISN_Siswa', 'Nama_Siswa', 'Kelas', 'Tahun_Ajaran', 'Status']}
              templateName="Template_GuruAsuh"
              apiEndpoint="/api/settings/guru-asuh"
              mapRowData={mapImportRow}
            />
            )}

      <style jsx>{`
        :global(:root) {
          --ga-line: rgba(148, 163, 184, 0.22);
          --ga-card: rgba(255, 255, 255, 0.92);
          --ga-shadow: 0 14px 34px rgba(2, 6, 23, 0.08);
          --ga-shadow2: 0 10px 22px rgba(2, 6, 23, 0.08);
          --ga-radius: 16px;

          --ga-fs: 0.88rem;
          --ga-fs-sm: 0.82rem;
          --ga-fs-xs: 0.78rem;

          --ga-safe-b: env(safe-area-inset-bottom, 0px);
          --ga-safe-t: env(safe-area-inset-top, 0px);
        }

        .ga {
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: var(--ga-fs);
          padding: 16px;
          background: #f5f7fb;
          border-radius: 16px;

          /* space for sticky action bar (mobile) */
          padding-bottom: calc(16px + var(--ga-safe-b));
        }

        /* ========= TOOLBAR ========= */
        .ga__bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          width: 100%;
          min-width: 0;
        }

        .ga__filters {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          padding: 8px;
          border-radius: var(--ga-radius);
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid var(--ga-line);
          box-shadow: var(--ga-shadow2);
        }

        .ga__search {
          position: relative;
          flex: 1 1 280px;
          min-width: 180px;
        }

        .ga__search i {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(100, 116, 139, 0.9);
          pointer-events: none;
          font-size: 0.9rem;
        }

        .ga__search input {
          width: 100%;
          padding: 8px 10px 8px 30px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          font-weight: 500;
          color: rgba(15, 23, 42, 0.92);
          outline: none;
          font-size: var(--ga-fs-sm);
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }

        .ga__filters select {
          padding: 8px 10px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          font-weight: 550;
          color: rgba(15, 23, 42, 0.86);
          outline: none;
          min-width: 138px;
          font-size: var(--ga-fs-sm);
        }

        .ga__search input:focus,
        .ga__filters select:focus {
          border-color: rgba(58, 166, 255, 0.55);
          box-shadow: 0 0 0 4px rgba(58, 166, 255, 0.14);
        }

        .ga__actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        /* ========= BUTTONS ========= */
        .ga__btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid var(--ga-line);
          background: rgba(255, 255, 255, 0.78);
          color: rgba(7, 22, 46, 0.9);
          font-weight: 650;
          cursor: pointer;
          font-size: var(--ga-fs-sm);
          transition: transform 0.15s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          white-space: nowrap;
        }

        .ga__btn i {
          font-size: 1rem;
        }

        .ga__btn:hover {
          /* background: rgba(255, 255, 255, 0.92); removed */
          border-color: rgba(58, 166, 255, 0.25);
          box-shadow: 0 4px 12px rgba(58, 166, 255, 0.2);
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .ga__btn:active {
          transform: translateY(0);
        }

        .ga__btnGhost {
          background: rgba(255, 255, 255, 0.78);
        }

.ga__btnPrimary {
  background: linear-gradient(135deg, rgba(58, 166, 255, 0.92), rgba(15, 42, 86, 0.92));
  border-color: rgba(58, 166, 255, 0.32);
  color: #fff;
  font-weight: 700;
}

.ga__btnPrimary:hover {
  background: linear-gradient(135deg, rgba(58, 166, 255, 0.92), rgba(15, 42, 86, 0.92));
  color: #fff;
}

.ga__btnPrimary:active {
  background: linear-gradient(135deg, rgba(58, 166, 255, 1), rgba(15, 42, 86, 1));
  color: #fff;
}

.ga__btnExport {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(16, 185, 129, 0.28);
  color: #fff;
}

.ga__btnExport:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(15, 42, 86, 0.86));
  color: #fff;
}

.ga__btnExport:active {
  background: linear-gradient(135deg, rgba(16, 185, 129, 1), rgba(15, 42, 86, 1));
  color: #fff;
}

.ga__btnImport {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.92), rgba(15, 42, 86, 0.86));
  border-color: rgba(245, 158, 11, 0.28);
  color: #fff;
}

.ga__btnImport:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.92), rgba(15, 42, 86, 0.86));
  color: #fff;
}

.ga__btnImport:active {
  background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(15, 42, 86, 1));
  color: #fff;
}

        /* ========= TABLE ========= */
        .ga__tableWrap {
          width: 100%;
          min-width: 0;
          overflow: auto;
          border-radius: var(--ga-radius);
          border: 1px solid var(--ga-line);
          background: var(--ga-card);
          box-shadow: var(--ga-shadow);
        }

        .ga__table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 980px;
        }

        .ga__table thead th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.98));
          color: rgba(7, 22, 46, 0.86);
          font-size: var(--ga-fs-xs);
          font-weight: 800;
          letter-spacing: 0.01em;
          text-align: left;
          padding: 10px 10px;
          border-bottom: 1px solid var(--ga-line);
          white-space: nowrap;
        }

        .ga__table tbody td {
          padding: 10px 10px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          color: rgba(15, 23, 42, 0.92);
          font-size: var(--ga-fs-sm);
          font-weight: 400;
          vertical-align: middle;
          background: rgba(255, 255, 255, 0.82);
        }

        .ga__table tbody tr:nth-child(even) td {
          background: rgba(248, 250, 252, 0.85);
        }

        .ga__table tbody tr:hover td {
          background: rgba(58, 166, 255, 0.05);
        }

        .ga__empty {
          text-align: center;
          padding: 18px 10px !important;
          font-weight: 600;
          font-size: var(--ga-fs-sm);
        }

        .ga__muted {
          color: rgba(100, 116, 139, 0.9) !important;
          font-weight: 400 !important;
        }

        .ga__loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background: rgba(255, 255, 255, 0.85);
          border-radius: 16px;
          border: 1px solid rgba(15, 42, 86, 0.1);
        }

        .ga__emptyState {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background: rgba(255, 255, 255, 0.85);
          border-radius: 16px;
          border: 1px solid rgba(15, 42, 86, 0.1);
        }

        .ga__emptyText {
          font-size: var(--ga-fs);
          font-weight: 600;
          color: rgba(15, 23, 42, 0.92);
          margin-bottom: 8px;
        }

        .ga__emptySub {
          font-size: var(--ga-fs-sm);
          color: rgba(100, 116, 139, 0.9);
        }

        .cNo {
          width: 56px;
        }
        .cNip {
          width: 170px;
        }
        .cNisn {
          width: 170px;
        }
        .cKelas {
          width: 120px;
        }
        .cStatus {
          width: 120px;
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
          font-size: var(--ga-fs-xs);
          font-weight: 400;
        }
        .tPlain {
          font-weight: 400;
        }

        .tNameCell { display: flex; flex-direction: column; gap: 2px; }
        .tNameCell__name { font-weight: 600; color: rgba(15, 23, 42, 0.92); }
        .tNameCell__sub { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 0.72rem; color: rgba(100, 116, 139, 0.9); font-weight: 400; }

        .ga__badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(0, 56, 168, 0.06);
          border: 1px solid rgba(0, 56, 168, 0.15);
          color: #3083ff;
          font-weight: 600;
          font-size: var(--ga-fs-xs);
          white-space: nowrap;
        }

        .ga__status {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border-radius: 999px;
          font-weight: 500;
          font-size: var(--ga-fs-xs);
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .ga__status::before {
          content: none !important;
          display: none !important;
        }

        .ga__status.isOn {
          background: rgba(14, 165, 233, 0.12);
          border-color: rgba(14, 165, 233, 0.25);
          color: #0284c7;
        }

        .ga__status.isOff {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.16);
          color: rgba(220, 38, 38, 1);
        }

        .ga__rowActions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
        }

        .ga__iconBtn {
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

        .ga__iconBtn:hover {
          box-shadow: var(--ga-shadow2);
          transform: translateY(-1px);
          border-color: rgba(58, 166, 255, 0.22);
        }

        .ga__iconBtn.danger {
          color: rgba(220, 38, 38, 1);
          border-color: rgba(239, 68, 68, 0.18);
          background: rgba(239, 68, 68, 0.06);
        }

        /* ========= MOBILE GROUPS + CARDS ========= */
        .ga__cards {
          display: none;
          flex-direction: column;
          gap: 12px;
        }

        .ga__group {
          border: 1px solid rgba(15, 42, 86, 0.1);
          border-radius: 16px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06);
        }

        .ga__groupHead {
          padding: 12px 14px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
          border-bottom: 1px solid rgba(15, 42, 86, 0.1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .ga__groupTitleRow {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .ga__groupTitle {
          margin: 0;
          font-size: 0.92rem;
          font-weight: 850;
          color: rgba(11, 31, 58, 0.95);
        }

        .ga__groupMeta {
          font-size: 0.78rem;
          font-weight: 650;
          color: rgba(100, 116, 139, 0.92);
          white-space: nowrap;
        }

        .ga__groupNip {
          font-size: 0.76rem;
          font-weight: 600;
          color: rgba(100, 116, 139, 0.85);
          margin-top: 2px;
        }

        .ga__groupBody {
          padding: 12px 12px 2px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ga__card {
          background: var(--n-card);
          border: 1px solid rgba(15, 42, 86, 0.14);
          border-radius: 16px;
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.1);
          overflow: hidden;
        }

        .ga__cardHead {
          padding: 14px 14px 10px;
          background: linear-gradient(180deg, #ffffff, #fbfcff);
          border-bottom: 1px solid rgba(15, 42, 86, 0.08);

          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .ga__cardTitle {
          min-width: 0;
        }

        .ga__cardName {
          font-weight: 800;
          color: rgba(11, 31, 58, 0.95);
          font-size: 0.88rem;
          line-height: 1.25;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
          word-break: break-word;
        }

        .ga__cardSub {
          margin-top: 4px;
          color: rgba(100, 116, 139, 0.95);
          font-weight: 600;
          font-size: 0.82rem;
        }

        .ga__cardActions {
          display: flex;
          justify-content: space-between;
          flex: 0 0 auto;
        }

        .ga__cardActionsLeft {
          display: flex;
          gap: 12px;
        }

        .ga__cardBody {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ga__kv {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .ga__k {
          color: rgba(15, 42, 86, 0.7);
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          flex: 0 0 112px;
        }

        .ga__v {
          flex: 1 1 auto;
          min-width: 0;
          text-align: right;
          color: rgba(15, 23, 42, 0.92);
          font-weight: 500;
          overflow-wrap: anywhere;
        }

        .ga__cardFoot {
          padding: 12px 14px;
          background: rgba(15, 42, 86, 0.04);
          border-top: 1px solid rgba(15, 42, 86, 0.08);
        }

        .ga__cardTags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .ga__cardStatus {
          display: flex;
          justify-content: flex-end;
        }

        .ga__mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.78rem;
          font-weight: 500;
        }

        /* ========= MODAL ========= */
        .ga__modalOverlay {
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
          padding-bottom: calc(16px + var(--ga-safe-b));
        }

        .ga__modal {
          width: min(680px, 100%);
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          box-shadow: 0 28px 80px rgba(2, 6, 23, 0.35);
          overflow: hidden;
        }

        .ga__modalLarge {
          width: min(920px, 100%);
        }

        .ga__modalHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }

        .ga__modalTitle h2 {
          margin: 0 0 3px;
          font-size: 0.98rem;
          font-weight: 750;
          color: rgba(7, 22, 46, 0.96);
        }

        .ga__modalTitle p {
          margin: 0;
          font-size: var(--ga-fs-sm);
          font-weight: 500;
          color: rgba(100, 116, 139, 0.95);
        }

        .ga__close {
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

        .ga__z {
          position: relative;
          z-index: 50;
        }

        .ga__studentSearch {
          position: relative;
          margin-bottom: 10px;
        }

        .ga__studentSearch i {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(100, 116, 139, 0.9);
          pointer-events: none;
        }

        .ga__studentSearch input {
          width: 100%;
          padding: 9px 10px 9px 30px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(255, 255, 255, 0.92);
          font-weight: 500;
          font-size: var(--ga-fs-sm);
          outline: none;
        }

        .ga__multi {
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

        .ga__pick {
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

        .ga__pick:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.1);
          border-color: rgba(58, 166, 255, 0.24);
          background: rgba(255, 255, 255, 0.98);
        }

        .ga__pick.isOn {
          border-color: rgba(58, 166, 255, 0.42);
          background: linear-gradient(135deg, rgba(58, 166, 255, 0.11), rgba(255, 255, 255, 0.98));
          box-shadow: 0 14px 22px rgba(58, 166, 255, 0.12);
        }

        .ga__check {
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

        .ga__pick.isOn .ga__check {
          border-color: rgba(58, 166, 255, 0.72);
          background: rgba(58, 166, 255, 1);
        }

        .ga__pickInfo {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1 1 auto;
        }

        .ga__pickName {
          font-weight: 800;
          color: rgba(11, 31, 58, 0.96);
          font-size: 0.8rem;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ga__pickMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          color: rgba(100, 116, 139, 0.95);
          font-size: 0.78rem;
          font-weight: 600;
        }

        .ga__dot {
          opacity: 0.65;
        }

        .ga__pillKelas {
          display: inline-flex;
          align-items: center;
          padding: 3px 7px;
          border-radius: 999px;
          border: 1px solid rgba(15, 42, 86, 0.12);
          background: rgba(15, 42, 86, 0.06);
          color: rgba(7, 22, 46, 0.9);
          font-weight: 650;
          font-size: 0.72rem;
          white-space: nowrap;
        }

        .ga__hint {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(248, 250, 252, 0.92);
          text-align: center;
          font-size: var(--ga-fs-sm);
        }

        .ga__selectedCount {
          margin-top: 10px;
          font-size: var(--ga-fs-xs);
          color: rgba(100, 116, 139, 0.95);
          font-weight: 600;
        }

        /* =========================
           RESPONSIVE SWITCH
           Desktop: table
           Mobile : grouped cards
        ========================= */
        .ga__cards {
          display: none;
        }
        .ga__tableWrap {
          display: block;
        }

        @media (max-width: 768px) {
          .ga__filters { flex-wrap: nowrap; }
          .ga__search { flex: 1; min-width: 0; }
          .ga__filters select { flex: 0 0 auto; min-width: 100px; width: 35%; max-width: 130px; }
          
          .ga__tableWrap {
            display: none;
          }
          .ga__cards {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
        }

        /* ========= Mobile: Pagination Wrapper ========= */
        @media (max-width: 768px) {
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

        /* ========= iOS Sticky Action Bar (Mobile) ========= */
        /* ========= Mobile Actions Above Cards ========= */
        @media (max-width: 768px) {
          .ga {
            padding: 0;
            padding-bottom: calc(16px + var(--ga-safe-b));
            background: transparent;
            border-radius: 0;
          }

          .ga__actions {
             width: 100%;
             display: flex;
             gap: 6px;
             margin-bottom: 12px;

             /* Reset sticky if present in previous CSS */
             position: static;
             padding: 0;
             background: none;
             border: none;
             box-shadow: none;
          }

          .ga__actions .ga__btn {
            flex: 1;
            height: 40px;
            padding: 9px 8px;
            justify-content: center;
            min-width: 0;
          }

          .ga__actions .ga__btn span {
             font-size: 0.75rem;
          }
        }



        /* ========= small phones (iPhone 13 / Oppo A-series) ========= */
        @media (max-width: 420px) {
          .ga {
             padding-bottom: calc(16px + var(--ga-safe-b));
          }

          .ga__grid2 {
            grid-template-columns: 1fr;
          }

          .ga__multi {
            grid-template-columns: 1fr;
            max-height: 360px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ga__btn,
          .ga__iconBtn,
          .ga__pick {
            transition: none;
          }
          .ga__btn:hover,
          .ga__iconBtn:hover,
          .ga__pick:hover {
            transform: none;
          }
        }
        :global(.dark) .ga__card { background: var(--n-card); }
      /* ===== DARK MODE STANDARD ===== */
      :global(.dark) .ga__filters,
      :global(.dark) .ga__tableWrap,
      :global(.dark) .ga__modal,
      :global(.dark) .ga__card,
      :global(.dark) .ga__loading,
      :global(.dark) .ga__emptyState {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
      }
      :global(.dark) .ga__search input,
      :global(.dark) .ga__filters select,
      :global(.dark) .ga__field input,
      :global(.dark) .ga__field select,
      :global(.dark) .ga__studentSearch input {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 12px !important;
          color: #e2e8f0 !important;
      }
      :global(.dark) .ga__filters select {
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
      :global(.dark) .ga__table thead th {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
      }
      :global(.dark) .ga__table tbody td {
          background: #000000 !important;
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
          color: #cbd5e1 !important;
      }
      :global(.dark) .ga__table tbody tr:hover td {
          background: rgba(26, 115, 232, 0.08) !important;
      }
      :global(.dark) .tNameCell__name, :global(.dark) .ga__cardName {
          color: #e2e8f0 !important;
      }
      :global(.dark) .tNameCell__sub {
          color: #94a3b8 !important;
      }
      :global(.dark) .ga__btnPrimary {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(59, 130, 246, 0.6) !important;
          box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
      }
      :global(.dark) .ga__btnExport {
          background: #000000 !important;
          color: #60a5fa !important;
          border: 1.5px solid rgba(59, 130, 246, 0.5) !important;
      }
      :global(.dark) .ga__btnExport:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .ga__btnImport {
          background: #000000 !important;
          color: #38bdf8 !important;
          border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
      }
      :global(.dark) .ga__btnImport:hover {
          background: rgba(2, 132, 199, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .ga__status.isOn {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.5) !important;
      }
      :global(.dark) .ga__status.isOff {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
      }
      :global(.dark) .ga__iconBtn {
          background: #000000 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #60a5fa !important;
      }
      :global(.dark) .ga__iconBtn:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .ga__iconBtn.danger {
          background: #000000 !important;
          border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
          color: #f87171 !important;
      }
      :global(.dark) .ga__iconBtn.danger:hover {
          background: rgba(239, 68, 68, 0.2) !important;
          color: #ffffff !important;
      }
      :global(.dark) .ga__modalHead {
          background: linear-gradient(135deg, #00287a 0%, #001540 100%) !important;
          border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
      }
      :global(.dark) .ga__modalTitle h2 { color: #e2e8f0 !important; }
      :global(.dark) .ga__modalBody { background: #000000 !important; }
      :global(.dark) .ga__modalFoot {
          background: #000000 !important;
          border-top: 1px solid rgba(26, 115, 232, 0.4) !important;
      }
      :global(.dark) .ga__field label {
          color: #94a3b8 !important;
      }
      :global(.dark) .ga__pick {
          background: #000000 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
      }
      :global(.dark) .ga__pick.isOn {
          background: rgba(26, 115, 232, 0.18) !important;
          border-color: #3b82f6 !important;
      }
      :global(.dark) .ga__pickName {
          color: #e2e8f0 !important;
      }
      :global(.dark) .ga__multi {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
      }
      :global(.dark) .ga__groupHead, :global(.dark) .ga__cardHead, :global(.dark) .ga__cardFoot {
          background: #000000 !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
      }
      :global(.dark) .ga__groupTitle {
          color: #e2e8f0 !important;
      }
      /* ===== END DARK MODE STANDARD ===== */

  border-color: var(--n-border) !important;
  color: var(--n-ink) !important;
}
:global(.dark) .sk__btn:hover, :global(.dark) .wk__btn:hover, :global(.dark) .ga__btn:hover, :global(.dark) .lb__btn:hover {
  background: var(--n-elevated) !important;
  border-color: rgba(58,166,255,0.35) !important;
  color: var(--n-ink) !important;
}
:global(.dark) .sk__btnGhost, :global(.dark) .wk__btnGhost, :global(.dark) .ga__btnGhost {
  background: var(--n-card) !important;
  color: var(--n-ink) !important;
  border-color: var(--n-border) !important;
}
:global(.dark) .sk__btnGhost:hover, :global(.dark) .ga__btnGhost:hover {
  background: var(--n-elevated) !important;
}
:global(.dark) .lb__btnGhost {
  background: transparent !important;
  color: var(--n-muted) !important;
  border-color: var(--n-border) !important;
}
:global(.dark) .lb__btnGhost:hover {
  background: var(--n-elevated) !important;
  color: var(--n-ink) !important;
}
/* EMPTY / LOADING */
:global(.dark) .sk__empty, :global(.dark) .wk__empty, :global(.dark) .ga__empty, :global(.dark) .ga__emptyState {
  color: var(--n-muted) !important;
}
:global(.dark) .ga__emptyState, :global(.dark) .ga__loading {
  background: var(--n-card) !important;
  border-color: var(--n-border) !important;
}
:global(.dark) .ga__emptyText { color: var(--n-ink) !important; }
:global(.dark) .ga { background: rgba(255,255,255,0.03) !important; }
/* STATUS BADGE & KELAS BADGE */
:global(.dark) .ga__badge {
  background: rgba(26, 115, 232, 0.18) !important;
  border: 1px solid rgba(59, 130, 246, 0.45) !important;
  color: #60a5fa !important;
  font-weight: 600 !important;
}
:global(.dark) .ga__status {
  background: rgba(14, 165, 233, 0.15) !important;
  color: #38bdf8 !important;
  border: 1.5px solid rgba(56, 189, 248, 0.4) !important;
}
:global(.dark) .ga__status.isOn {
  background: rgba(14, 165, 233, 0.15) !important;
  color: #38bdf8 !important;
  border: 1.5px solid rgba(56, 189, 248, 0.4) !important;
}
:global(.dark) .ga__status.isOff {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #f87171 !important;
  border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
}

/* JAM KE DROPDOWN */
:global(.dark) .lb__jamBtn {
  background: linear-gradient(135deg, var(--n-surface) 0%, var(--n-elevated) 100%) !important;
  border-color: var(--n-border) !important;
  color: var(--n-ink) !important;
}
:global(.dark) .lb__jamDropdown { background: var(--n-card) !important; border-color: var(--n-border) !important; }
:global(.dark) .lb__jamOption:hover { background: rgba(79,142,247,0.1) !important; }
:global(.dark) .lb__jamOption label { color: var(--n-ink) !important; }
/* ===== END DARK MODE FULL ===== */
/* DELETE MODAL STYLES */
.ga__delModal {
  background: var(--n-card);
  border-radius: 20px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  overflow: hidden;
  animation: zoomIn 0.2s;
}
.ga__delModalHead {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to bottom, #fef2f2, #fff);
}
.ga__delTitle {
  margin: 0;
  font-weight: 800;
  color: var(--n-text);
  font-size: 1.1rem;
}
.ga__delModalBody {
  padding: 24px;
}
.ga__delText {
  color: var(--n-muted);
  font-size: 0.9rem;
  margin-bottom: 8px;
}
.ga__delWarn {
  color: #dc2626;
  font-size: 0.82rem;
  font-weight: 600;
  margin-top: 12px;
}
.ga__delModalFoot {
  padding: 16px 24px;
  background: #f8fafc;
  display: flex;
  gap: 12px;
}
.ga__btnCancel {
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
.ga__btnCancel:hover {
  background: var(--n-surface);
  color: var(--n-ink);
}
.ga__btnDanger {
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
.ga__btnDanger:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
}

:global(.dark) .ga__delModal {
    background: #000000 !important;
    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
}
:global(.dark) .ga__delModalHead {
    background: #000000 !important;
    border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
}
:global(.dark) .ga__delTitle {
    color: #60a5fa !important;
}
:global(.dark) .ga__delTitle i {
    color: #60a5fa !important;
}
:global(.dark) .ga__modalHead {
    background: #000000 !important;
    border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
}
:global(.dark) .ga__modalTitle h2 { color: #60a5fa !important; }
:global(.dark) .ga__modalTitle p { color: #94a3b8 !important; }
:global(.dark) .ga__close {
    background: #000000 !important;
    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
    color: #60a5fa !important;
}
:global(.dark) .ga__close:hover {
    background: rgba(26, 115, 232, 0.2) !important;
    color: #ffffff !important;
}

:global(.dark) .ga__delModalBody {
    background: #000000 !important;
}
:global(.dark) .ga__delText {
    color: #cbd5e1 !important;
}
:global(.dark) .ga__delText strong {
    color: #ffffff !important;
}
:global(.dark) .ga__delWarn {
    color: #f87171 !important;
}
:global(.dark) .ga__delModalFoot {
    background: #000000 !important;
    border-top: 1px solid rgba(37, 99, 235, 0.4) !important;
}
:global(.dark) .ga__btnCancel {
    background: #000000 !important;
    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
    color: #94a3b8 !important;
}
:global(.dark) .ga__btnCancel:hover {
    background: rgba(26, 115, 232, 0.15) !important;
    color: #ffffff !important;
}
:global(.dark) .ga__btnDanger {
    background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
    color: #ffffff !important;
    border: 1px solid rgba(239, 68, 68, 0.6) !important;
    box-shadow: 0 4px 16px rgba(220, 38, 38, 0.45) !important;
}
:global(.dark) .tNameCell__name { color: var(--n-ink) !important; }
:global(.dark) .tNameCell__sub { color: var(--n-muted) !important; }

/* MODAL EDIT GURU ASUH DARK MODE FIXES */
:global(.dark) .ga__multi {
  background: #000000 !important;
  border: 1.5px solid rgba(26, 115, 232, 0.5) !important;
}
:global(.dark) .ga__hint {
  background: #000000 !important;
  border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
  color: #94a3b8 !important;
}
:global(.dark) .ga__studentSearch input {
  background: #000000 !important;
  border: 1.5px solid rgba(26, 115, 232, 0.5) !important;
  color: #ffffff !important;
}
:global(.dark) .ga__studentSearch i {
  color: #60a5fa !important;
}
:global(.dark) .ga__pick {
  background: #000000 !important;
  border: 1.5px solid rgba(26, 115, 232, 0.35) !important;
  color: #ffffff !important;
}
:global(.dark) .ga__pick:hover {
  background: rgba(26, 115, 232, 0.15) !important;
  border-color: #3b82f6 !important;
}
:global(.dark) .ga__pick.isOn {
  background: rgba(26, 115, 232, 0.25) !important;
  border-color: #3b82f6 !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
}
:global(.dark) .ga__pickName {
  color: #f8fafc !important;
}
:global(.dark) .ga__pickMeta {
  color: #94a3b8 !important;
}
:global(.dark) .ga__pillKelas {
  background: rgba(26, 115, 232, 0.2) !important;
  border: 1px solid rgba(59, 130, 246, 0.4) !important;
  color: #60a5fa !important;
}
:global(.dark) .ga__selectedCount {
  color: #94a3b8 !important;
}


`}</style>
    </div>
  )
}
