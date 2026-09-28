'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { exportToExcel } from '@/lib/excel-utils'
import ImportModal from '@/components/ui/ImportModal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Pagination from '@/components/ui/Pagination'
import Swal from 'sweetalert2'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { FilterToolbar, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import DesktopFab from '@/components/ui/DesktopFab'
import { usePengaturanDataAccess } from '@/lib/use-pengaturan-data-access'

interface GuruMapelTabProps {
    user?: any
}

interface GuruMapel {
    id?: number;
    nip: string;
    nama_guru: string;
    kode_guru?: string;
    nama_mapel: string; // Display
    kode_mapel?: string;
    aktif?: boolean;
}

// `user` tidak lagi didestrukturisasi: wewenang datang dari server lewat
// usePengaturanDataAccess(). Propnya tetap diterima agar view.tsx tidak berubah.
export default function GuruMapelTab(_props: GuruMapelTabProps) {
    // Permissions
    /**
     * Wewenang dari server (Hak Akses Fitur per tab), bukan dari string role —
     * agar tidak lebih ketat daripada yang ditegakkan backend. Lihat catatan yang
     * sama di SiswaKelasTab.
     */
    const { boleh } = usePengaturanDataAccess()
    const bolehKelola = boleh('guru_mapel')

    const canCreate = bolehKelola;
    const canUpdate = bolehKelola;
    const canDelete = bolehKelola;
    const canImport = bolehKelola;
    const canExport = bolehKelola;

    // Modal blur state
    const { registerModal } = useModalBlur()

    const [list, setList] = useState<GuruMapel[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [totalItems, setTotalItems] = useState(0)

    // UI State
    const [showModal, setShowModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    
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

    // Store all guru+mapel combinations that already exist (for accurate filtering).
    // Key format: "nip|nama_mapel"
    const [existingCombinations, setExistingCombinations] = useState<Set<string>>(new Set())

    // Selection States
    const [selectedNip, setSelectedNip] = useState('')
    const [selectedMapels, setSelectedMapels] = useState<string[]>([])
    const [mapelSearchTerm, setMapelSearchTerm] = useState('')

    // Master data
    const [masterGuru, setMasterGuru] = useState<any[]>([])
    const [masterMapel, setMasterMapel] = useState<any[]>([])
    const [masterKodeGuru, setMasterKodeGuru] = useState<any[]>([])

    // Auto-filled kode guru dan kode mapel
    const [autoKodeGuru, setAutoKodeGuru] = useState('')
    const [autoKodeMapel, setAutoKodeMapel] = useState<{ [key: string]: string }>({})

    // Filtered mapel list based on search

    // Filtered Guru: only exclude guru+mapel+semester combinations that already exist (only in add mode)
    // IMPORTANT: Guru can still be added if they have different mapel or different semester
    const availableGurus = useMemo(() => {
        if (editId) return masterGuru // In edit mode, show all gurus

        return masterGuru // Show all gurus - we'll filter mapels instead
    }, [masterGuru, editId])

    // Filtered Mapels: exclude mapels the selected guru is already assigned to teach
    const availableMapels = useMemo(() => {
        if (editId) return masterMapel // In edit mode, show all mapels

        if (!selectedNip) {
            return masterMapel // Show all if no guru selected yet
        }

        return masterMapel.filter(mapel => {
            const key = `${selectedNip}|${mapel.nama}`
            return !existingCombinations.has(key)
        })
    }, [masterMapel, editId, selectedNip, existingCombinations])

    // Search-filtered mapels (from availableMapels)
    const filteredMapel = useMemo(() => {
        if (!mapelSearchTerm.trim()) return availableMapels
        return availableMapels.filter(m => m.nama.toLowerCase().includes(mapelSearchTerm.toLowerCase()))
    }, [availableMapels, mapelSearchTerm])

    useEffect(() => {
        fetchMasterData()
    }, [])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setCurrentPage(1)
            fetchData()
        }, 500)
        return () => clearTimeout(timeoutId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm])

    // Auto-fill kode_guru when guru selected
    useEffect(() => {
        if (selectedNip) {
            const kodeGuruData = masterKodeGuru.find(kg => kg.nip === selectedNip)
            setAutoKodeGuru(kodeGuruData?.kode_guru || '')
        } else {
            setAutoKodeGuru('')
        }
    }, [selectedNip, masterKodeGuru])

    // Load all existing guru+mapel combinations once (for accurate "already assigned" filtering)
    useEffect(() => {
        const fetchExistingCombinations = async () => {
            try {
                const res = await fetch(`/api/settings/guru-mapel?limit=10000`)
                const json = await res.json()
                if (json.ok && json.data) {
                    const combinations = new Set<string>(json.data.map((item: any) =>
                        `${item.nip}|${item.nama_mapel}`
                    ))
                    setExistingCombinations(combinations)

                    /**
                     * Daftar ini dipakai menyaring kombinasi yang SUDAH ada. Kalau
                     * server memotongnya, penyaringnya tidak lengkap dan form akan
                     * menawarkan pasangan guru+mapel yang sebenarnya sudah terdaftar.
                     * `?limit=10000` di atas dibatasi atap server (1.000), jadi
                     * pemotongan itu mungkin terjadi bila tabelnya tumbuh — dan harus
                     * terdengar, bukan diam.
                     */
                    if (json.truncated) {
                        console.warn('[guru-mapel] daftar kombinasi terpotong server:',
                            `${json.data.length} dari ${json.total}`)
                        Swal.fire({
                            icon: 'warning',
                            title: 'Daftar tidak lengkap',
                            text: `Server hanya mengirim ${json.data.length} dari ${json.total} data guru mapel. `
                                + 'Penyaring "sudah terdaftar" mungkin tidak akurat — laporkan ke admin.',
                        })
                    }
                }
            } catch (err) {
                console.error('Error fetching existing combinations:', err)
            }
        }
        fetchExistingCombinations()
    }, [])

    // Auto-fill kode_mapel for each selected mapel
    useEffect(() => {
        const kodeMap: { [key: string]: string } = {}
        selectedMapels.forEach(mapelName => {
            const mapelData = masterMapel.find(m => m.nama === mapelName)
            kodeMap[mapelName] = mapelData?.kode || ''
        })
        setAutoKodeMapel(kodeMap)
    }, [selectedMapels, masterMapel])

    const fetchMasterData = async () => {
        try {
            const [resGuru, resMapel, resKodeGuru] = await Promise.all([
                // jenis=GURU: tendik tidak boleh muncul sebagai kandidat guru mapel.
                fetch('/api/master/guru?limit=10000&jenis=GURU'),
                fetch('/api/master/mapel?limit=10000'),
                fetch('/api/master/kode-guru?limit=10000')
            ])
            const [jsonGuru, jsonMapel, jsonKodeGuru] = await Promise.all([
                resGuru.json(),
                resMapel.json(),
                resKodeGuru.json()
            ])
            if (jsonGuru.ok) setMasterGuru(jsonGuru.data)
            if (jsonMapel.ok) setMasterMapel(jsonMapel.data)
            if (jsonKodeGuru.ok) setMasterKodeGuru(jsonKodeGuru.data)
        } catch (err) {
            console.error('Error fetching master data:', err)
        }
    }

    const fetchData = async () => {
        setLoading(true)
        const params = new URLSearchParams({
            q: searchTerm,
            page: currentPage.toString(),
            limit: pageSize.toString(),
        })
        try {
            const res = await fetch(`/api/settings/guru-mapel?${params}`)
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
        const isEditMode = !!editId
        if (!bolehKelola) return
        if (!selectedNip || selectedMapels.length === 0) {
            alert('Pilih guru dan minimal satu mata pelajaran!')
            return
        }

        setSaving(true)
        try {
            const guru = masterGuru.find(g => g.nip === selectedNip)

            if (editId) {
                if (!bolehKelola) return;
                const mapelName = selectedMapels[0] // Only 1 mapel for edit
                const kodeMapel = autoKodeMapel[mapelName] || ''

                const res = await fetch('/api/settings/guru-mapel', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editId,
                        nip: selectedNip,
                        nama_guru: guru?.nama_lengkap || '',
                        kode_guru: autoKodeGuru,
                        nama_mapel: mapelName,
                        kode_mapel: kodeMapel,
                        aktif: true
                    })
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Gagal mengubah data')
            } else {
                // Bulk Insert — one row per selected mapel
                for (const mapelName of selectedMapels) {
                    const kodeMapel = autoKodeMapel[mapelName] || ''

                    const res = await fetch('/api/settings/guru-mapel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            nip: selectedNip,
                            nama_guru: guru?.nama_lengkap || '',
                            kode_guru: autoKodeGuru,
                            nama_mapel: mapelName,
                            kode_mapel: kodeMapel,
                            aktif: true
                        })
                    })
                    const json = await res.json()

                    if (!res.ok) {
                        throw new Error(`Gagal menyimpan ${mapelName}: ${json.error}`)
                    }
                }
            }

            closeFormModal()
            fetchData()
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data berhasil disimpan.', timer: 1500, showConfirmButton: false })
        } catch (err: any) {
            console.error(err)
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan' })
        } finally {
            setSaving(false)
        }
    }

    const closeFormModal = () => {
        setShowModal(false)
        setEditId(null)
        setSelectedNip('')
        setSelectedMapels([])
        setAutoKodeGuru('')
        setAutoKodeMapel({})
    }

    // Fix SweetAlert2 Z-Index for modals & trigger blur
    useEffect(() => {
        const hasModal = showModal || showImportModal || showDeleteModal || deleteItemId !== null
        if (hasModal) {
            const unregister = registerModal()
            const style = document.createElement('style')
            style.innerHTML = `.swal2-container { z-index: 99999 !important; }`
            document.head.appendChild(style)
            return () => { document.head.removeChild(style); unregister() }
        }
    }, [showModal, showImportModal, showDeleteModal, deleteItemId, registerModal])

    const handleEdit = (item: GuruMapel) => {
        if (!bolehKelola) return
        setEditId(item.id!)
        setSelectedNip(item.nip)
        setSelectedMapels([item.nama_mapel])
        setShowModal(true)
    }

    const handleDelete = (id: number) => {
        if (!bolehKelola) return
        setDeleteItemId(id)
        setShowDeleteModal(true)
    }

    const handleExport = () => {
        if (!bolehKelola) return
        if (list.length === 0) return Swal.fire({ icon: 'info', title: 'Info', text: 'Tidak ada data untuk diexport.' })
        const dataToExport = list.map((item, index) => ({
            No: index + 1,
            NIP: item.nip,
            Nama_Guru: item.nama_guru,
            Kode_Guru: item.kode_guru || '',
            Kode_Mapel: item.kode_mapel || '',
            Nama_Mapel: item.nama_mapel,
            Status: item.aktif ? 'Aktif' : 'Non-Aktif'
        }))
        exportToExcel(dataToExport, 'GuruMapel')
    }

    const mapImportRow = (row: any) => {
        const no = row['No'] || row['no']
        const kodeGuru = row['Kode_Guru'] || row['kode_guru'] || ''
        const nip = row['NIP'] || row['nip']
        const namaGuru = row['Nama_Guru'] || row['nama_guru']
        const kodeMapel = row['Kode_Mapel'] || row['kode_mapel'] || ''
        const namaMapel = row['Nama_Mapel'] || row['Nama Mapel'] || row['nama_mapel']

        // Validasi wajib: no, nama_guru, nip, nama_mapel
        if (!no || !namaGuru || !nip || !namaMapel) return null;

        return {
            kode_guru: String(kodeGuru),
            nip: String(nip),
            nama_guru: String(namaGuru),
            kode_mapel: String(kodeMapel),
            nama_mapel: String(namaMapel),
            aktif: true
        }
    }

    const toggleMapel = (mapelName: string) => {
        if (selectedMapels.includes(mapelName)) {
            setSelectedMapels(selectedMapels.filter(m => m !== mapelName))
        } else {
            setSelectedMapels([...selectedMapels, mapelName])
        }
    }

    const openAdd = async () => {
        setEditId(null)
        setSelectedNip('')
        setSelectedMapels([])
        setAutoKodeGuru('')
        setAutoKodeMapel({})

        // Refresh existing combinations (non-paginated) for accurate filtering
        try {
            const res = await fetch(`/api/settings/guru-mapel?limit=10000`)
            const json = await res.json()
            if (json.ok && json.data) {
                const combinations = new Set<string>(json.data.map((item: any) =>
                    `${item.nip}|${item.nama_mapel}`
                ))
                setExistingCombinations(combinations)
            }
        } catch (err) {
            console.error('Error fetching existing combinations:', err)
        }

        setShowModal(true)
    }

    // Grouping for Mobile View (By Guru)
    const groupedMobile = useMemo(() => {
        const map = new Map<string, GuruMapel[]>()
        for (const item of list) {
            const key = (item.nama_guru || '-').trim() || '-'
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(item)
        }
        const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'id'))
        return keys.map((k) => ({ guru: k, items: map.get(k)! }))
    }, [list])

    return (
        <div className="gm">
            {/* ===== Toolbar ===== */}
            <FilterToolbar actionsInline>
                <FilterSearch
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Cari Guru / Mapel / NIP..."
                />
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

                    {bolehKelola && (
                        <Button variant="outline" className="btn-text-desktop" icon="import" onClick={() => setShowImportModal(true)} title="Import Excel">
                            Import
                        </Button>
                    )}
                    {bolehKelola && (
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
            <div className="gm__tableWrap">
                <table className="gm__table">
                    <thead>
                        <tr>
                            <th className="cNo">No</th>
                            <th>Guru</th>
                            <th>Kode Guru</th>
                            <th>Kode Mapel</th>
                            <th>Mata Pelajaran</th>
                            <th className="cStatus">Status</th>
                            <th className="cAksi">Aksi</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="gm__empty">
                                    <Spinner variant="buble" />
                                </td>
                            </tr>
                        ) : list.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="gm__empty gm__muted">
                                    Tidak ada data.
                                </td>
                            </tr>
                        ) : (
                            list.map((item, index) => (
                                <tr key={item.id ?? `${item.nip}-${item.nama_mapel}-${index}`}>
                                    <td className="tCenter">{(currentPage - 1) * pageSize + index + 1}</td>
                                    <td className="tNameCell">
                                        <div className="tNameCell__name">{item.nama_guru}</div>
                                        <div className="tNameCell__sub">{item.nip}</div>
                                    </td>
                                    <td className="tPlain">{item.kode_guru || '-'}</td>
                                    <td className="tPlain">{item.kode_mapel || '-'}</td>
                                    <td className="tPlain">{item.nama_mapel}</td>
                                    <td>
                                        <span className={`gm__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                                            {item.aktif ? 'Aktif' : 'Non-Aktif'}
                                        </span>
                                    </td>
                                    <td>
                                        <ActionGroup>
                                            {bolehKelola && (
                                                <ActionButton action="edit" onClick={() => handleEdit(item)} />
                                            )}
                                            {bolehKelola && (
                                                <ActionButton action="delete" onClick={() => item.id && handleDelete(item.id)} />
                                            )}
                                        </ActionGroup>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ===== Mobile Cards (Grouped by Guru) ===== */}
            <div className="gm__cards" aria-label="Daftar Guru Mapel versi mobile">
                {loading ? (
                    <div className="gm__loading">
                        <Spinner variant="buble" />
                    </div>
                ) : list.length === 0 ? (
                    <div className="gm__emptyState">
                        <div className="gm__emptyText">Tidak ada data</div>
                        <div className="gm__emptySub">Coba ubah filter</div>
                    </div>
                ) : (
                    groupedMobile.map((group) => (
                        <div className="gm__group" key={`g-${group.guru}`}>
                            <div className="gm__groupHead">
                                <div className="gm__groupTitleRow">
                                    <div>
                                        <h3 className="gm__groupTitle">{group.guru}</h3>
                                        <div className="gm__groupNip">NIP: {group.items[0]?.nip}</div>
                                    </div>
                                    <div className="gm__groupMeta">{group.items.length} mapel</div>
                                </div>
                            </div>

                            <div className="gm__groupBody">
                                {group.items.map((item, idx) => (
                                    <div className="gm__card" key={`m-${item.id ?? `${item.nip}-${item.nama_mapel}-${idx}`}`}>
                                        <div className="gm__cardHead">
                                            <div className="gm__cardTitle">
                                                <div className="gm__cardName" title={item.nama_mapel}>
                                                    {item.nama_mapel || '-'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="gm__cardFoot">
                                            <div className="gm__cardActions">
                                                <div className="gm__cardStatus">
                                                    <span className={`gm__status ${item.aktif ? 'isOn' : 'isOff'}`}>
                                                        {item.aktif ? 'Aktif' : 'Non-Aktif'}
                                                    </span>
                                                </div>
                                                <ActionGroup>
                                                    {bolehKelola && (
                                                        <ActionButton action="edit" onClick={() => handleEdit(item)} />
                                                    )}
                                                    {bolehKelola && (
                                                        <ActionButton action="delete" onClick={() => item.id && handleDelete(item.id)} />
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
                <Pagination itemLabel="penugasan"
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
                <Modal size="lg" variant={editId ? "edit" : "add"} onClose={closeFormModal} labelledBy="modal-gm-title">
                    <ModalHeader
                        id="modal-gm-title"
                        title={editId ? 'Edit Guru Mapel' : 'Tambah Guru Mapel'}
                        icon={editId ? "pencil-square" : "plus-circle-fill"}
                        onClose={closeFormModal}
                    />
                    <form onSubmit={handleSubmit}>
                        <ModalBody>
                            <div className="sk__field sk__fieldFull gm__z">
                                <SearchableSelect
                                    label="Pilih Guru"
                                    options={availableGurus.map((g) => ({
                                        value: g.nip,
                                        label: g.nama_lengkap,
                                        subLabel: g.nip,
                                    }))}
                                    value={selectedNip}
                                    onChange={(val) => setSelectedNip(val as string)}
                                    placeholder="Cari Guru..."
                                />
                            </div>

                            {/* Display Auto-filled Kode Guru */}
                            {selectedNip && (
                                <div className="gm__autoFill">
                                    <i className="bi bi-info-circle"></i>
                                    <span>Kode Guru: <strong>{autoKodeGuru || 'Belum ada kode'}</strong></span>
                                </div>
                            )}

                            <div className="sk__field sk__fieldFull">
                                <label>Pilih Mata Pelajaran {editId ? '(Ganti Mapel)' : '(Bisa lebih dari satu)'}</label>

                                <div className="gm__searchMapel">
                                    <i className="bi bi-search" aria-hidden="true" />
                                    <input
                                        type="text"
                                        placeholder="Cari mata pelajaran..."
                                        value={mapelSearchTerm}
                                        onChange={(e) => setMapelSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="gm__multi">
                                    {masterMapel.length === 0 ? (
                                        <div className="gm__hint gm__muted">Tidak ada mata pelajaran tersedia.</div>
                                    ) : (
                                        availableMapels.map((m) => {
                                            const isSelected = selectedMapels.includes(m.nama)
                                            const kodeMapel = m.kode || ''

                                            return (
                                                <button
                                                    type="button"
                                                    key={m.nama ?? m.id}
                                                    className={`gm__pick ${isSelected ? 'isOn' : ''}`}
                                                    onClick={() => toggleMapel(m.nama)}
                                                >
                                                    <span className="gm__check" aria-hidden="true">
                                                        {isSelected ? <i className="bi bi-check-lg" /> : null}
                                                    </span>

                                                    <span className="gm__pickInfo">
                                                        <span className="gm__pickName" title={m.nama}>
                                                            {m.nama}
                                                        </span>
                                                        {kodeMapel && (
                                                            <span className="gm__pickCode">Kode: {kodeMapel}</span>
                                                        )}
                                                    </span>
                                                </button>
                                            )
                                        })
                                    )}
                                </div>

                                <div className="gm__selectedCount">{selectedMapels.length} mapel dipilih</div>
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

            {/* Import Modal */}
            {showImportModal && (
                        <ImportModal
                            isOpen={showImportModal}
                            onClose={() => setShowImportModal(false)}
                            onImportSuccess={fetchData}
                            templateColumns={['No', 'NIP', 'Nama_Guru', 'Kode_Guru', 'Kode_Mapel', 'Nama_Mapel', 'Status']}
                            templateName="Template_GuruMapel"
                            apiEndpoint="/api/settings/guru-mapel"
                            mapRowData={mapImportRow}
                        />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (() => {
                const target = list.find(x => x.id === deleteItemId);
                return (
                    <Modal size="sm" variant="delete" onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }} labelledBy="modal-gm-del">
                        <ModalHeader
                            id="modal-gm-del"
                            title={target ? `${target.nama_guru} — ${target.nama_mapel}` : 'Relasi Guru Mapel'}
                            icon="trash3"
                            onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
                        />
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); }} leftIcon={<i className="bi bi-x-lg" />}>
                            Batal
                        </Button>
                        <Button
                            variant="danger"
                            type="button"
                            leftIcon={<i className="bi bi-trash3-fill" />}
                            onClick={async () => {
                                if (!deleteItemId) return
                                const idToDelete = deleteItemId
                                setShowDeleteModal(false)
                                setDeleteItemId(null)
                                try {
                                    const res = await fetch(`/api/settings/guru-mapel?id=${idToDelete}`, { method: 'DELETE' })
                                    const json = await res.json()
                                    if (json.ok) {
                                        fetchData()
                                    } else {
                                        alert(json.error || 'Gagal menghapus data')
                                    }
                                } catch (err: any) {
                                    alert(err.message || 'Terjadi kesalahan')
                                }
                            }}
                        >
                            Ya, Hapus!
                        </Button>
                    </ModalFooter>
                </Modal>
                );
            })()}

            <style jsx>{`
                /* =====================================================
                   GURU MAPEL TAB — PREMIUM CLEAN DESIGN
                ===================================================== */

                .gm {
                    width: 100%;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding: 0;
                    background: transparent;
                }

                /* ===== TOOLBAR ===== */
                .gm__bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    flex-wrap: wrap;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 16px;
                    padding: 12px 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                }

                .gm__filters {
                    flex: 1 1 auto;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .gm__search {
                    position: relative;
                    flex: 1 1 260px;
                    min-width: 180px;
                }

                .gm__search i {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--n-muted);
                    pointer-events: none;
                    font-size: 0.9rem;
                }

                .gm__search input {
                    width: 100%;
                    padding: 10px 12px 10px 36px;
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    background: var(--n-surface);
                    color: var(--n-ink);
                    outline: none;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .gm__search input:focus {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.1);
                }

                .gm__filters select {
                    padding: 10px 12px;
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    background: var(--n-surface);
                    color: var(--n-ink);
                    outline: none;
                    min-width: 130px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .gm__filters select:focus {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.1);
                }

                .gm__actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 0 0 auto;
                }

                .gm__btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 40px;
                    padding: 0 14px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 0.875rem;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                }

                .gm__btn i { font-size: 1rem; }

                .gm__btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
                }

                .gm__btn:active { transform: translateY(0); }

                .gm__btnPrimary {
                    background: linear-gradient(135deg, var(--n-primary) 0%, #1565c0 100%);
                    color: white;
                    box-shadow: 0 4px 14px rgba(0, 56, 168, 0.25);
                }

                .gm__btnExport {
                    background: rgba(16, 185, 129, 0.1);
                    color: #059669;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }

                .gm__btnExport:hover {
                    background: rgba(16, 185, 129, 0.15);
                    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.2);
                }

                .gm__btnImport {
                    background: rgba(245, 158, 11, 0.1);
                    color: #d97706;
                    border: 1px solid rgba(245, 158, 11, 0.2);
                }

                .gm__btnImport:hover {
                    background: rgba(245, 158, 11, 0.15);
                    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.2);
                }

                /* ===== TABLE ===== */
                .gm__tableWrap {
                    width: 100%;
                    min-width: 0;
                    overflow: auto;
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                }

                .gm__table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    min-width: 900px;
                }

                .gm__table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    background: linear-gradient(180deg, var(--n-card) 0%, var(--n-surface) 100%);
                    color: var(--n-muted);
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    text-align: left;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--n-border);
                    white-space: nowrap;
                }

                .gm__table tbody td {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--n-border);
                    color: var(--n-ink);
                    font-size: 0.875rem;
                    vertical-align: middle;
                    background: var(--n-card);
                }

                .gm__table tbody tr:last-child td { border-bottom: none; }

                .gm__table tbody tr:hover td {
                    background: rgba(0, 56, 168, 0.02);
                }

                .gm__empty {
                    text-align: center;
                    padding: 40px 16px !important;
                    color: var(--n-muted);
                    font-weight: 500;
                }

                .gm__muted { color: var(--n-muted) !important; }

                .cNo { width: 50px; }
                .cNip { width: 140px; }
                .cStatus { width: 100px; }
                .cAksi { width: 100px; text-align: right; }

                .tCenter { text-align: center; }
                .tMono {
                    font-family: ui-monospace, monospace;
                    font-size: 0.8rem;
                    color: var(--n-muted);
                }

                .tNameCell { display: flex; flex-direction: column; gap: 2px; }
                .tNameCell__name { font-weight: 600; color: var(--n-ink); }
                .tNameCell__sub { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--n-muted); font-weight: 400; }

                /* ===== STATUS ===== */
                .gm__status {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 0.75rem;
                    white-space: nowrap;
                }

                .gm__status.isOn {
                    background: rgba(34, 197, 94, 0.1);
                    color: #16a34a;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }

                .gm__status.isOff {
                    background: rgba(239, 68, 68, 0.08);
                    color: #dc2626;
                    border: 1px solid rgba(239, 68, 68, 0.15);
                }

                /* ===== ROW ACTIONS ===== */
                .gm__rowActions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 6px;
                }

                .gm__iconBtn {
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-ink);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.85rem;
                }

                .gm__iconBtn:hover {
                    background: var(--n-surface);
                    border-color: var(--n-primary);
                    color: var(--n-primary);
                    transform: translateY(-1px);
                }

                .gm__iconBtn.danger {
                    color: #dc2626;
                    border-color: rgba(239, 68, 68, 0.2);
                    background: rgba(239, 68, 68, 0.05);
                }

                .gm__iconBtn.danger:hover {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: #dc2626;
                    color: #dc2626;
                }

                /* ===== MODAL ===== */
                .gm__modalOverlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    animation: gmFadeIn 0.2s ease-out;
                }

                @keyframes gmFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .gm__modal {
                    width: min(560px, 100%);
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 20px;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
                    overflow: hidden;
                    animation: gmSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }

                @keyframes gmSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .gm__modalHead {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 20px 24px;
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    border-bottom: none;
                }

                .gm__modalTitle h2 {
                    margin: 0 0 4px;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: white;
                }

                .gm__modalTitle p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.8);
                    font-weight: 500;
                }

                .gm__close {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: none;
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .gm__close:hover {
                    background: rgba(255, 255, 255, 0.25);
                    transform: scale(1.05);
                }

                .gm__modalBody {
                    padding: 20px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    max-height: min(70vh, 650px);
                    overflow: auto;
                }

                .gm__modalFoot {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 24px;
                    border-top: 1px solid var(--n-border);
                    background: var(--n-surface);
                }

                .gm__modalFoot .gm__btn {
                    height: 40px;
                    padding: 0 20px;
                }

                .gm__modalFoot .gm__btnGhost {
                    background: var(--n-surface);
                    color: var(--n-muted);
                    border: 1px solid var(--n-border);
                }

                .gm__modalFoot .gm__btnGhost:hover {
                    background: var(--n-card);
                    color: var(--n-ink);
                }

                .gm__z { position: relative; z-index: 50; }

                /* ===== AUTO FILL INFO ===== */
                .gm__autoFill {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    background: rgba(0, 56, 168, 0.05);
                    border: 1px solid rgba(0, 56, 168, 0.15);
                    border-radius: 12px;
                    font-size: 0.85rem;
                    color: var(--n-primary);
                }

                .gm__autoFill i { font-size: 1rem; }
                .gm__autoFill strong { font-weight: 700; }

                /* ===== MAPEL PICKER ===== */
                .gm__searchMapel {
                    position: relative;
                    margin-bottom: 4px;
                }

                .gm__searchMapel i {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--n-muted);
                    pointer-events: none;
                    font-size: 0.9rem;
                }

                .gm__searchMapel input {
                    width: 100%;
                    padding: 10px 12px 10px 36px;
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    background: var(--n-surface);
                    color: var(--n-ink);
                    outline: none;
                    font-size: 0.875rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .gm__searchMapel input:focus {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.1);
                }

                .gm__multi {
                    border: 1px solid var(--n-border);
                    background: var(--n-surface);
                    border-radius: 16px;
                    padding: 12px;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    max-height: 320px;
                    overflow: auto;
                }

                .gm__pick {
                    width: 100%;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    border-radius: 12px;
                    padding: 12px;
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                }

                .gm__pick:hover {
                    border-color: var(--n-primary);
                    background: rgba(0, 56, 168, 0.03);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }

                .gm__pick.isOn {
                    border-color: var(--n-primary);
                    background: rgba(0, 56, 168, 0.06);
                    box-shadow: 0 4px 12px rgba(0, 56, 168, 0.12);
                }

                .gm__check {
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    border: 2px solid var(--n-border);
                    background: var(--n-card);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                    margin-top: 2px;
                    transition: all 0.2s;
                    color: white;
                    font-size: 0.75rem;
                }

                .gm__pick.isOn .gm__check {
                    border-color: var(--n-primary);
                    background: var(--n-primary);
                }

                .gm__pickInfo {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                }

                .gm__pickName {
                    font-weight: 600;
                    color: var(--n-ink);
                    font-size: 0.875rem;
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .gm__pickCode {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    font-weight: 500;
                }

                .gm__hint {
                    padding: 24px;
                    border-radius: 12px;
                    border: 1px dashed var(--n-border);
                    background: var(--n-surface);
                    text-align: center;
                    color: var(--n-muted);
                    font-size: 0.875rem;
                }

                .gm__selectedCount {
                    font-size: 0.8rem;
                    color: var(--n-primary);
                    font-weight: 600;
                }

                /* ===== MOBILE CARDS ===== */
                .gm__cards {
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                }

                .gm__group {
                    border: 1px solid var(--n-border);
                    border-radius: 16px;
                    overflow: hidden;
                    background: var(--n-card);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                }

                .gm__groupHead {
                    padding: 14px 16px;
                    background: linear-gradient(180deg, var(--n-card) 0%, var(--n-surface) 100%);
                    border-bottom: 1px solid var(--n-border);
                }

                .gm__groupTitleRow {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 10px;
                }

                .gm__groupTitle {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-ink);
                }

                .gm__groupMeta {
                    font-size: 0.78rem;
                    color: var(--n-muted);
                    font-weight: 600;
                }

                .gm__groupNip {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    margin-top: 2px;
                }

                .gm__groupBody {
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .gm__card {
                    background: var(--n-surface);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    overflow: hidden;
                }

                .gm__cardHead {
                    padding: 12px 14px;
                    background: var(--n-card);
                    border-bottom: 1px solid var(--n-border);
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 10px;
                }

                .gm__cardName {
                    font-weight: 600;
                    color: var(--n-ink);
                    font-size: 0.875rem;
                    white-space: normal;
                    word-break: break-word;
                }

                .gm__cardFoot {
                    padding: 10px 14px;
                    background: var(--n-surface);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .gm__cardActionsLeft {
                    display: flex;
                    gap: 8px;
                }

                /* ===== RESPONSIVE ===== */
                @media (max-width: 768px) {
                    .gm__tableWrap { display: none; }
                    .gm__cards { display: flex; }
                    .gm { gap: 12px; }

                    .gm__bar {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                        padding: 12px;
                    }

                    .gm__filters {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 10px;
                    }

                    .gm__search { min-width: 0; flex: none; }
                    .gm__filters select { width: 100%; min-width: 0; }

                    .gm__actions {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 8px;
                    }

                    .gm__actions .gm__btn {
                        justify-content: center;
                        height: 44px;
                        font-size: 0.8rem;
                    }

                    .gm__modal { border-radius: 16px; }
                    .gm__modalHead { padding: 16px 20px; }
                    .gm__modalBody { padding: 16px 20px; max-height: 65vh; }
                    .gm__modalFoot { padding: 12px 20px; }
                    .gm__grid2 { grid-template-columns: 1fr; }
                    .gm__multi { grid-template-columns: 1fr; max-height: 280px; }
                }

                @media (prefers-reduced-motion: reduce) {
                    .gm__btn, .gm__iconBtn, .gm__pick { transition: none; }
                    .gm__btn:hover, .gm__iconBtn:hover, .gm__pick:hover { transform: none; }
                    .gm__modalOverlay, .gm__modal { animation: none; }
                }
            /* ===== DARK MODE STANDARD ===== */
            :global(.dark) .gm__bar,
            :global(.dark) .gm__tableWrap,
            :global(.dark) .gm__modal,
            :global(.dark) .gm__group {
                background: #000000 !important;
                border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                border-radius: 16px !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
            }
            :global(.dark) .gm__search input,
            :global(.dark) .gm__filters select,
            :global(.dark) .gm__field input,
            :global(.dark) .gm__field select,
            :global(.dark) .gm__searchMapel input {
                background: #000000 !important;
                border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                border-radius: 12px !important;
                color: #e2e8f0 !important;
            }
            :global(.dark) .gm__filters select {
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
            :global(.dark) .gm__table thead th {
                background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                color: #94a3b8 !important;
            }
            :global(.dark) .gm__table tbody td {
                background: #000000 !important;
                border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                color: #cbd5e1 !important;
            }
            :global(.dark) .gm__table tbody tr:hover td {
                background: rgba(26, 115, 232, 0.08) !important;
            }
            :global(.dark) .tNameCell__name {
                color: #e2e8f0 !important;
            }
            :global(.dark) .tNameCell__sub {
                color: #94a3b8 !important;
            }
            :global(.dark) .gm__btnPrimary {
                background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
                color: #ffffff !important;
                border: 1px solid rgba(59, 130, 246, 0.6) !important;
                box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
            }
            :global(.dark) .gm__btnExport {
                background: #000000 !important;
                color: #60a5fa !important;
                border: 1.5px solid rgba(59, 130, 246, 0.5) !important;
            }
            :global(.dark) .gm__btnExport:hover {
                background: rgba(26, 115, 232, 0.2) !important;
                color: #ffffff !important;
            }
            :global(.dark) .gm__btnImport {
                background: #000000 !important;
                color: #38bdf8 !important;
                border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
            }
            :global(.dark) .gm__btnImport:hover {
                background: rgba(2, 132, 199, 0.2) !important;
                color: #ffffff !important;
            }
            :global(.dark) .gm__status.isOn {
                background: rgba(26, 115, 232, 0.2) !important;
                color: #60a5fa !important;
                border: 1px solid rgba(59, 130, 246, 0.5) !important;
            }
            :global(.dark) .gm__status.isOff {
                background: rgba(239, 68, 68, 0.15) !important;
                color: #f87171 !important;
                border: 1px solid rgba(239, 68, 68, 0.4) !important;
            }
            :global(.dark) .gm__iconBtn {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                color: #60a5fa !important;
            }
            :global(.dark) .gm__iconBtn:hover {
                background: rgba(26, 115, 232, 0.2) !important;
                color: #ffffff !important;
            }
            :global(.dark) .gm__iconBtn.danger {
                background: #000000 !important;
                border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
                color: #f87171 !important;
            }
            :global(.dark) .gm__iconBtn.danger:hover {
                background: rgba(239, 68, 68, 0.2) !important;
                color: #ffffff !important;
            }
            :global(.dark) .gm__modalHead {
                background: #000000 !important;
                border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
            }
            :global(.dark) .gm__modalTitle h2 { color: #60a5fa !important; }
            :global(.dark) .gm__modalTitle p { color: #94a3b8 !important; }
            :global(.dark) .gm__close {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                color: #60a5fa !important;
            }
            :global(.dark) .gm__close:hover {
                background: rgba(26, 115, 232, 0.2) !important;
                color: #ffffff !important;
            }

            :global(.dark) .gm__modalFoot {
                background: #000000 !important;
                border-top: 1px solid rgba(26, 115, 232, 0.4) !important;
            }
            :global(.dark) .gm__field label {
                color: #94a3b8 !important;
            }
            :global(.dark) .gm__pick {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
            }
            :global(.dark) .gm__pick.isOn {
                background: rgba(26, 115, 232, 0.18) !important;
                border-color: #3b82f6 !important;
            }
            :global(.dark) .gm__pickName {
                color: #e2e8f0 !important;
            }
            :global(.dark) .gm__multi {
                background: #000000 !important;
                border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
            }
            :global(.dark) .gm__groupHead, :global(.dark) .gm__cardHead, :global(.dark) .gm__cardFoot {
                background: #000000 !important;
                border-color: rgba(26, 115, 232, 0.3) !important;
            }
            :global(.dark) .gm__groupTitle, :global(.dark) .gm__cardName {
                color: #e2e8f0 !important;
            }

            /* Delete Modal Styles */
            .gm__delModal {
              background: var(--n-card);
              border-radius: 20px;
              max-width: 400px;
              width: 100%;
              box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
              overflow: hidden;
              animation: zoomIn 0.2s;
            }
            .gm__delModalHead {
              padding: 20px 24px;
              border-bottom: 1px solid #f1f5f9;
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: linear-gradient(to bottom, #fef2f2, #fff);
            }
            .gm__delTitle {
              margin: 0;
              font-weight: 800;
              color: var(--n-text);
              font-size: 1.1rem;
            }
            .gm__delModalBody {
              padding: 24px;
            }
            .gm__delText {
              color: var(--n-muted);
              font-size: 0.9rem;
              margin-bottom: 8px;
            }
            .gm__delWarn {
              color: #dc2626;
              font-size: 0.82rem;
              font-weight: 600;
              margin-top: 12px;
            }
            .gm__delModalFoot {
              padding: 16px 24px;
              background: #f8fafc;
              display: flex;
              gap: 12px;
            }
            .gm__btnCancel {
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
            .gm__btnCancel:hover {
              background: var(--n-surface);
              color: var(--n-ink);
            }
            .gm__btnDanger {
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
            .gm__btnDanger:hover:not(:disabled) {
              transform: translateY(-1px);
              box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
            }

            :global(.dark) .gm__delModal {
                background: #000000 !important;
                border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
            }
            :global(.dark) .gm__delModalHead {
                background: #000000 !important;
                border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
            }
            :global(.dark) .gm__delTitle {
                color: #60a5fa !important;
            }
            :global(.dark) .gm__delTitle i {
                color: #60a5fa !important;
            }

            :global(.dark) .gm__delModalBody {
                background: #000000 !important;
            }
            :global(.dark) .gm__delText {
                color: #cbd5e1 !important;
            }
            :global(.dark) .gm__delWarn {
                color: #f87171 !important;
            }
            :global(.dark) .gm__delModalFoot {
                background: #000000 !important;
                border-top: 1px solid rgba(37, 99, 235, 0.4) !important;
            }
            :global(.dark) .gm__btnCancel {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                color: #94a3b8 !important;
            }
            :global(.dark) .gm__btnCancel:hover {
                background: rgba(26, 115, 232, 0.15) !important;
                color: #ffffff !important;
            }
            :global(.dark) .gm__btnDanger {
                background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
                color: #ffffff !important;
                border: 1px solid rgba(239, 68, 68, 0.6) !important;
                box-shadow: 0 4px 16px rgba(220, 38, 38, 0.45) !important;
            }
            :global(.dark) .gm__multi {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.5) !important;
            }
            :global(.dark) .gm__hint {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                color: #94a3b8 !important;
            }
            :global(.dark) .gm__searchMapel input {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.5) !important;
                color: #ffffff !important;
            }
            :global(.dark) .gm__pick {
                background: #000000 !important;
                border: 1.5px solid rgba(26, 115, 232, 0.35) !important;
                color: #ffffff !important;
            }
            :global(.dark) .gm__pick:hover {
                background: rgba(26, 115, 232, 0.15) !important;
                border-color: #3b82f6 !important;
            }
            :global(.dark) .gm__pick.isOn {
                background: rgba(26, 115, 232, 0.25) !important;
                border-color: #3b82f6 !important;
            }
            :global(.dark) .gm__pickName { color: #f8fafc !important; }
            :global(.dark) .gm__pickCode { color: #94a3b8 !important; }
            :global(.dark) .gm__selectedCount { color: #94a3b8 !important; }
            /* ===== END DARK MODE STANDARD ===== */



`}</style>
        </div>
    )
}

