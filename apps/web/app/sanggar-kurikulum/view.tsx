'use client'

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/auth-client'
import type { User } from '@/lib/types'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx-js-style'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useFileViewer } from '@/components/useFileViewer'
import { Tab } from '@/components/ui/Tab'
import { FilterToolbar, FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import { Button } from '@/components/ui/Button'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useModalBlur } from '@/components/ModalBlurProvider'
import './sanggar-kurikulum.css'

interface KelasConfig {
    nama: string;
    kuota: number | string;
}

interface SanggarConfig {
    sanggar: string;
    aktif?: boolean;
    kelas: KelasConfig[];
}

type TabType = 'form' | 'data' | 'broadcast' | 'settings'

export default function SanggarKurikulumPage({ user: propUser }: { user?: any } = {}) {
    const [user, setUser] = useState<User | null>(propUser || null)
    const [activeTab, setActiveTab] = useState<TabType>('form')
    const [loadingUser, setLoadingUser] = useState(!propUser)

    // Global Config State
    const [configData, setConfigData] = useState<SanggarConfig[]>([])
    const [asalSekolah, setAsalSekolah] = useState('Internal ACCA')
    const [loadingConfig, setLoadingConfig] = useState(true)

    useEffect(() => {
        getCurrentUser().then(u => {
            setUser(u)
            setLoadingUser(false)
        })
        fetchConfig()
    }, [])

    const fetchConfig = async () => {
        setLoadingConfig(true)
        
        // Fetch config dropdown
        try {
            const confRes = await fetch('/api/site-settings?key=sanggar_config')
            const confJson = await confRes.json()
            const rawVal = confJson?.data?.value ?? confJson?.value
            if (rawVal) {
                const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal
                const normalized = parsed.map((s: any) => ({
                    ...s,
                    kelas: s.kelas.map((k: any) => typeof k === 'string' ? { nama: k, kuota: '' } : (k.kuota === 0 ? {...k, kuota: ''} : k))
                }))
                normalized.sort((a: any, b: any) => a.sanggar.localeCompare(b.sanggar, 'id', { numeric: true, sensitivity: 'base' }))
                normalized.forEach((s: any) => {
                    s.kelas.sort((a: any, b: any) => a.nama.localeCompare(b.nama, 'id', { numeric: true, sensitivity: 'base' }))
                })
                setConfigData(normalized)
            }
        } catch (e) {
            setConfigData([])
        }
        
        // Fetch profil sekolah
        try {
            const profRes = await fetch('/api/profil-sekolah')
            const profJson = await profRes.json()
            const profData = profJson?.data || profJson
            if (profData?.nama) {
                setAsalSekolah(profData.nama)
            }
        } catch (e) {
            console.error('Error fetching profil_sekolah:', e)
        }

        setLoadingConfig(false)
    }

    if (loadingUser) {
        return <div className="p-8 text-center text-gray-500"><i className="fa-solid fa-spinner fa-spin mr-2"></i> Memuat profil...</div>
    }

    if (!user) {
        return <div className="p-8 text-center text-red-500">
            <i className="bi bi-exclamation-triangle text-2xl block mb-2"></i>
            Anda harus login untuk mengakses halaman pendaftaran ini.
        </div>
    }

    const isAdmin = user.roles.includes('ADMIN')
    const isGuru = user.roles.includes('GURU') || user.roles.includes('KAMAD')

    if (!isAdmin && !isGuru) {
        return <div className="p-8 text-center text-red-500">
            <i className="bi bi-shield-lock text-3xl block mb-2"></i>
            Akses Ditolak: Halaman ini hanya diperuntukkan bagi Guru.
        </div>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
            

            {/* Tabs */}
            <Tab
                tabs={[
                    { key: 'form', label: 'Form Registrasi', icon: 'bi-ui-checks-grid' },
                    ...(isAdmin ? [
                        { key: 'data', label: 'Data Pendaftar', icon: 'bi-people-fill' },
                        { key: 'broadcast', label: 'Broadcast WA', icon: 'bi-whatsapp' },
                        { key: 'settings', label: 'Pengaturan', icon: 'bi-gear-fill' },
                    ] : [])
                ]}
                activeTab={activeTab}
                onChange={(k) => setActiveTab(k as TabType)}
                variant="slider"
            />

            {/* Content */}
            <div>
                {activeTab === 'form' && <FormRegistrasi user={user} configData={configData} asalSekolah={asalSekolah} isLoading={loadingConfig} />}
                {activeTab === 'data' && <DataRegistrasi configData={configData} />}
                {activeTab === 'broadcast' && isAdmin && <BroadcastWA />}
                {activeTab === 'settings' && isAdmin && <PengaturanSanggar configData={configData} reloadConfig={fetchConfig} />}
            </div>



        </div>
    )
}

function FormRegistrasi({ user, configData, asalSekolah, isLoading }: { user: User, configData: SanggarConfig[], asalSekolah: string, isLoading: boolean }) {
    const [loading, setLoading] = useState(false)
    
    const nama = user.nama || user.nama_lengkap || user.username
    const nip = user.nip || ''
    const email = user.email || 'belum diatur'
    const alamat = 'belum diatur' 
    const nomorWa = 'belum diatur' 

    const [pilihanSanggar, setPilihanSanggar] = useState('')
    const [kelasPelatihan, setKelasPelatihan] = useState('')
    const [fileFoto, setFileFoto] = useState<File | null>(null)

    // Fetch live kuota data
    const [kuotaData, setKuotaData] = useState<any[]>([])
    const [fetchingKuota, setFetchingKuota] = useState(true)

    // Cek apakah user sudah pernah mendaftar (blokir daftar ulang)
    const [existingReg, setExistingReg] = useState<any>(null)
    const [checkingReg, setCheckingReg] = useState(true)

    const checkExisting = async (): Promise<any> => {
        try {
            const params = new URLSearchParams()
            if (nip) params.set('nip', nip)
            if (nama) params.set('nama', nama)
            const res = await fetch(`/api/sanggar-kurikulum/check?${params.toString()}`)
            if (res.ok) {
                const json = await res.json()
                return json.data || null
            }
        } catch (err) {
            console.error(err)
        }
        return null
    }

    useEffect(() => {
        const fetchKuota = async () => {
            try {
                const res = await fetch('/api/sanggar-kurikulum/kuota')
                if (res.ok) {
                    const json = await res.json()
                    setKuotaData(json.data || [])
                }
            } catch (err) {
                console.error(err)
            } finally {
                setFetchingKuota(false)
            }
        }
        fetchKuota()
        checkExisting().then(reg => {
            setExistingReg(reg)
            setCheckingReg(false)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const selectedSanggarObj = kuotaData.length > 0 
        ? kuotaData.find(s => s.sanggar === pilihanSanggar)
        : configData.find(s => s.sanggar === pilihanSanggar)
        
    const availableKelas = selectedSanggarObj?.kelas || []

    useEffect(() => {
        if (pilihanSanggar && !availableKelas.find((k: any) => (k.nama || k) === kelasPelatihan)) {
            setKelasPelatihan('')
        }
    }, [pilihanSanggar, availableKelas, kelasPelatihan])

    const selectedKelasObj = availableKelas.find((k: any) => (k.nama || k) === kelasPelatihan)
    const isFull = selectedKelasObj?.penuh === true

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pilihanSanggar || !kelasPelatihan) {
            Swal.fire('Perhatian', 'Silakan pilih Sanggar dan Kelas Pelatihan', 'warning')
            return
        }
        if (isFull) {
            Swal.fire('Kuota Penuh', `Kuota untuk kelas "${kelasPelatihan}" sudah penuh. Silakan pilih kelas lain.`, 'error')
            return
        }

        if (!fileFoto) {
            Swal.fire('Perhatian', 'Silakan unggah Pas Foto', 'warning')
            return
        }

        if (fileFoto.size > 10 * 1024 * 1024) {
            Swal.fire('Perhatian', 'Ukuran foto maksimal 10MB', 'warning')
            return
        }

        setLoading(true)

        // Re-cek tepat sebelum insert agar tidak bisa daftar dua kali
        const already = await checkExisting()
        if (already) {
            setExistingReg(already)
            setLoading(false)
            Swal.fire('Sudah Terdaftar', `Pendaftaran atas nama "${already.nama}" sudah tercatat pada ${already.pilihan_sanggar} — ${already.kelas_pelatihan}. Pendaftaran hanya dapat dilakukan satu kali.`, 'error')
            return
        }

        // 1. Upload foto via /api/storage/upload
        let pasFotoUrl = ''
        try {
            const formData = new FormData()
            formData.append('file', fileFoto)
            formData.append('folder', 'pas_foto')

            const uploadRes = await fetch('/api/storage/upload', {
                method: 'POST',
                body: formData,
            })
            const uploadJson = await uploadRes.json()
            if (!uploadJson.ok) {
                setLoading(false)
                Swal.fire('Gagal', 'Gagal mengunggah foto: ' + (uploadJson.error || 'Upload gagal'), 'error')
                return
            }
            pasFotoUrl = uploadJson.publicUrl || uploadJson.url
        } catch (err: any) {
            setLoading(false)
            Swal.fire('Gagal', 'Gagal mengunggah foto: ' + err.message, 'error')
            return
        }

        const res = await fetch('/api/sanggar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama, nip, asal_sekolah: asalSekolah, alamat, nomor_wa: nomorWa, email, pilihan_sanggar: pilihanSanggar, kelas_pelatihan: kelasPelatihan, sumber_aplikasi: 'acca-app', pas_foto: pasFotoUrl
            })
        })

        const regData = await res.json().catch(() => ({}))
        setLoading(false)

        if (!res.ok) {
            console.error('Insert error', regData)
            Swal.fire('Gagal', 'Terjadi kesalahan saat mendaftar: ' + (regData.message || regData.error || 'Unknown error'), 'error')
        } else {
            Swal.fire('Berhasil', 'Pendaftaran Anda telah berhasil disimpan.', 'success')
            setPilihanSanggar('')
            setKelasPelatihan('')
            setFileFoto(null)
            // Refresh kuota
            fetch('/api/sanggar-kurikulum/kuota').then(res => res.json()).then(json => setKuotaData(json.data || []))
        }
    }

    if (isLoading || fetchingKuota || checkingReg) return <div className="sr-loading" style={{ padding: '48px', textAlign: 'center', color: 'var(--n-muted)' }}><Spinner variant="buble" size={28} color="currentColor" /></div>

    if (existingReg) {
        return (
            <div className="sr-card" style={{ alignItems: 'center', textAlign: 'center', gap: 16, padding: '48px 32px' }}>
                <div className="sr-iconOuter" style={{ background: '#f0fdf4', color: '#16a34a', width: 64, height: 64, fontSize: '1.75rem', borderRadius: 16 }}>
                    <i className="bi bi-patch-check-fill"></i>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--n-text, #1e293b)' }}>Anda Sudah Terdaftar</h3>
                <p style={{ margin: 0, color: 'var(--n-muted, #64748b)', fontSize: '0.95rem', maxWidth: 480 }}>
                    Pendaftaran atas nama <strong>{existingReg.nama}</strong> sudah tercatat pada{' '}
                    <strong>{existingReg.pilihan_sanggar}</strong> — <strong>{existingReg.kelas_pelatihan}</strong>{' '}
                    ({new Date(existingReg.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}).
                    Pendaftaran hanya dapat dilakukan satu kali. Hubungi admin jika perlu perubahan data.
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="sr-card">
            
            {/* Bagian Auto-Fill */}
            <div className="sr-section">
                <div className="sr-sectionHead">
                    <div className="sr-iconOuter sr-iconBlue">
                        <i className="bi bi-person-badge"></i>
                    </div>
                    <div className="sr-sectionTitles">
                        <h3>Data Identitas Internal</h3>
                        <p>Data di bawah ini diisi otomatis dari profil akun Anda.</p>
                    </div>
                </div>
                
                <div className="sr-staticGrid">
                    <div className="sr-fieldStatic">
                        <label>Nama Lengkap</label>
                        <div className="sr-val">{nama}</div>
                    </div>
                    <div className="sr-fieldStatic">
                        <label>NIP/NUPTK</label>
                        <div className="sr-val">{nip || '-'}</div>
                    </div>
                    <div className="sr-fieldStatic">
                        <label>Asal Sekolah</label>
                        <div className="sr-val">{asalSekolah}</div>
                    </div>
                </div>
            </div>

            <hr className="sr-divider" />

            {/* Bagian Pilihan Form */}
            <div className="sr-section">
                <div className="sr-sectionHead">
                    <div className="sr-iconOuter sr-iconIndigo">
                        <i className="bi bi-ui-radios-grid"></i>
                    </div>
                    <div className="sr-sectionTitles">
                        <h3>Pilihan Program</h3>
                        <p>Silakan tentukan Sanggar dan Kelas Pelatihan yang ingin Anda ikuti.</p>
                    </div>
                </div>

                <div className="sr-inputGrid">
                    <div className="sr-field">
                        <label>Pas Foto <span className="text-red">*</span></label>
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setFileFoto(e.target.files[0])
                                }
                            }}
                            required
                            className="sr-select"
                            style={{ padding: '9px 16px' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Format: JPG/PNG, Maksimal: 10MB</div>
                    </div>
                    
                    <div className="sr-field">
                        <label>Pilihan Sanggar <span className="text-red">*</span></label>
                        <select 
                            value={pilihanSanggar}
                            onChange={(e) => setPilihanSanggar(e.target.value)}
                            required
                            className="sr-select"
                        >
                            <option value="">-- Pilih Sanggar --</option>
                            {(kuotaData.length > 0 ? kuotaData : configData).map((s: any, idx: number) => (
                                <option key={idx} value={s.sanggar} disabled={s.aktif === false}>
                                    {s.sanggar}{s.aktif === false ? ' (Nonaktif)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sr-field">
                        <label>Kelas Pelatihan <span className="text-red">*</span></label>
                        <select 
                            value={kelasPelatihan}
                            onChange={(e) => setKelasPelatihan(e.target.value)}
                            required
                            disabled={!pilihanSanggar}
                            className="sr-select"
                        >
                            <option value="">{pilihanSanggar ? '-- Pilih Kelas --' : '-- Pilih Sanggar Dahulu --'}</option>
                            {availableKelas.map((k: any, idx: number) => {
                                const nama = k.nama || k;
                                const isFull = k.penuh;
                                const label = k.kuota !== null
                                    ? isFull
                                        ? `${nama} 🔒 Penuh (${k.terisi}/${k.kuota})`
                                        : `${nama} (${k.sisa} kursi tersisa)`
                                    : nama;
                                return (
                                    <option key={idx} value={nama} disabled={isFull}>
                                        {label}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
            </div>

            <div className="sr-formActions">
                <Button
                    type="submit"
                    variant="primary"
                    leftIcon={<i className="bi bi-send-check" />}
                    isLoading={loading}
                    disabled={loading || availableKelas.length === 0 || isFull}
                >
                    Kirim Pendaftaran
                </Button>
            </div>
            
        </form>
    )
}

function DataRegistrasi({ configData }: { configData: SanggarConfig[] }) {
    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer()
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [editMode, setEditMode] = useState<string | null>(null)
    const [editData, setEditData] = useState<any>({})
    
    const [searchQuery, setSearchQuery] = useState('')
    const [filterSekolah, setFilterSekolah] = useState('')
    const [filterSanggar, setFilterSanggar] = useState('')
    const [filterKelas, setFilterKelas] = useState('')

    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [viewData, setViewData] = useState<any>(null)
    const [showDupOnly, setShowDupOnly] = useState(false)
    const [deleteData, setDeleteData] = useState<{ id: string, nama: string } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        const res = await fetch('/api/sanggar')
        const json = await res.json().catch(() => ({}))
        if (json.ok && json.data) setData(json.data)
        setLoading(false)
    }

    useEffect(() => { fetchData() }, [])

    const handleDelete = (id: string, nama: string) => {
        setDeleteData({ id, nama })
    }

    const confirmDelete = async () => {
        if (!deleteData) return
        setIsDeleting(true)
        const res = await fetch(`/api/sanggar/${deleteData.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        setIsDeleting(false)
        if (!res.ok) Swal.fire('Gagal', json.message || json.error || 'Gagal menghapus data', 'error')
        else {
            Swal.fire('Terhapus', 'Data peserta telah dihapus.', 'success')
            setDeleteData(null)
            fetchData()
        }
    }

    const handleEditSave = async (id: string) => {
        if (!editData.nama?.trim()) { Swal.fire('Validasi', 'Nama wajib diisi', 'warning'); return }
        const res = await fetch(`/api/sanggar/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pilihan_sanggar: editData.pilihan_sanggar,
                kelas_pelatihan: editData.kelas_pelatihan,
                nama: editData.nama,
                nip: editData.nip || null,
                asal_sekolah: editData.asal_sekolah,
                alamat: editData.alamat || null,
                nomor_wa: editData.nomor_wa || null,
                email: editData.email || null,
            })
        })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) Swal.fire('Gagal', json.message || json.error || 'Gagal menyimpan perubahan', 'error')
        else {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tersimpan', showConfirmButton: false, timer: 1500 })
            setEditMode(null); fetchData()
        }
    }

    const availableClassesForEdit = configData.find(s => s.sanggar === editData.pilihan_sanggar)?.kelas || []

    const localeSort = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
    const uniqueSekolah = (Array.from(new Set(data.map(d => d.asal_sekolah))).filter(Boolean) as string[]).sort(localeSort)
    const uniqueSanggar = (Array.from(new Set(data.map(d => d.pilihan_sanggar))).filter(Boolean) as string[]).sort(localeSort)
    // Opsi kelas mengikuti sanggar terpilih agar tidak menampilkan kelas dari sanggar lain.
    const uniqueKelas = (Array.from(new Set(
        data
            .filter(d => !filterSanggar || d.pilihan_sanggar === filterSanggar)
            .map(d => d.kelas_pelatihan)
    )).filter(Boolean) as string[]).sort(localeSort)

    const filteredData = data.filter(d => {
        const matchSearch = d.nama.toLowerCase().includes(searchQuery.toLowerCase())
        const matchSekolah = filterSekolah ? d.asal_sekolah === filterSekolah : true
        const matchSanggar = filterSanggar ? d.pilihan_sanggar === filterSanggar : true
        const matchKelas = filterKelas ? d.kelas_pelatihan === filterKelas : true
        return matchSearch && matchSekolah && matchSanggar && matchKelas
    })

    // Deteksi nama ganda (dinormalisasi: huruf kecil, spasi dirapikan) di seluruh data
    const normName = (s: any) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    const dupCounts: Record<string, number> = {}
    data.forEach(d => { const k = normName(d.nama); dupCounts[k] = (dupCounts[k] || 0) + 1 })
    const dupNameTotal = Object.values(dupCounts).filter(c => c > 1).length

    // Nama ganda dikelompokkan berdampingan di urutan teratas agar mudah terlihat
    const displayData = filteredData
        .filter(d => !showDupOnly || dupCounts[normName(d.nama)] > 1)
        .sort((a, b) => {
            const dupA = dupCounts[normName(a.nama)] > 1 ? 0 : 1
            const dupB = dupCounts[normName(b.nama)] > 1 ? 0 : 1
            if (dupA !== dupB) return dupA - dupB
            if (dupA === 0) {
                const nc = normName(a.nama).localeCompare(normName(b.nama), 'id')
                if (nc !== 0) return nc
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

    const handleSelectAll = () => {
        if (selectedIds.length === displayData.length) {
            setSelectedIds([]) // unselect all
        } else {
            setSelectedIds(displayData.map(d => d.id))
        }
    }

    const handleSelectRow = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id))
        } else {
            setSelectedIds([...selectedIds, id])
        }
    }

    const handleExportExcel = () => {
        if (selectedIds.length === 0) {
            Swal.fire('Perhatian', 'Pilih minimal satu data untuk diekspor.', 'warning')
            return
        }
        const dataToExport = filteredData.filter(d => selectedIds.includes(d.id)).map((d, index) => ({
            'No': index + 1,
            'Nama Lengkap': d.nama,
            'NIP/NUPTK': d.nip || '-',
            'Asal Sekolah': d.asal_sekolah,
            'Nomor WA': d.nomor_wa,
            'Email': d.email || '-',
            'Alamat': d.alamat,
            'Sanggar': d.pilihan_sanggar,
            'Kelas Pelatihan': d.kelas_pelatihan,
            'Waktu Pendaftaran': new Date(d.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }) + ' WITA'
        }))
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        
        // Atur lebar kolom agar lebih mudah dibaca
        worksheet['!cols'] = [
            { wch: 5 },  // No
            { wch: 30 }, // Nama Lengkap
            { wch: 20 }, // NIP/NUPTK
            { wch: 25 }, // Asal Sekolah
            { wch: 15 }, // Nomor WA
            { wch: 25 }, // Email
            { wch: 35 }, // Alamat
            { wch: 20 }, // Sanggar
            { wch: 25 }, // Kelas Pelatihan
            { wch: 25 }  // Waktu Pendaftaran
        ]
        
        // Beri warna dan style pada header
        const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:J1")
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: 0, c: C })
            if (!worksheet[address]) continue
            worksheet[address].s = {
                fill: { fgColor: { rgb: "0284c7" } }, // Warna biru
                font: { bold: true, color: { rgb: "ffffff" } },
                alignment: { horizontal: "center", vertical: "center" }
            }
        }

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data Pendaftar")
        XLSX.writeFile(workbook, "Data_Pendaftar_Sanggar.xlsx")
    }

    const handleExportPhotos = async () => {
        if (selectedIds.length === 0) {
            Swal.fire('Perhatian', 'Pilih minimal satu data untuk diekspor.', 'warning')
            return
        }
        
        const dataToExport = filteredData.filter(d => selectedIds.includes(d.id) && d.pas_foto)
        if (dataToExport.length === 0) {
            Swal.fire('Perhatian', 'Tidak ada foto yang tersedia pada peserta yang dipilih.', 'warning')
            return
        }

        Swal.fire({
            title: 'Mengunduh Foto...',
            html: 'Mohon tunggu, sedang memproses file...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        })

        try {
            const zip = new JSZip()
            const folder = zip.folder("Pas_Foto_Pendaftar")
            
            for (const d of dataToExport) {
                const response = await fetch(d.pas_foto)
                if (response.ok) {
                    const blob = await response.blob()
                    const ext = d.pas_foto.split('.').pop() || 'jpg'
                    const safeNama = d.nama.replace(/[\/\\:*?"<>|]/g, '').trim()
                    const safeNip = (d.nip || 'nonip').replace(/[\/\\:*?"<>|]/g, '').trim()
                    const safeSekolah = d.asal_sekolah.replace(/[\/\\:*?"<>|]/g, '').trim()
                    const filename = `${safeNama} - ${safeNip} - ${safeSekolah}.${ext}`
                    folder?.file(filename, blob)
                }
            }

            const content = await zip.generateAsync({ type: 'blob' })
            saveAs(content, "Export_Pas_Foto.zip")
            Swal.close()
            Swal.fire('Berhasil', 'Foto berhasil diekspor.', 'success')
        } catch (error) {
            console.error(error)
            Swal.close()
            Swal.fire('Gagal', 'Gagal mengunduh foto', 'error')
        }
    }

    if (loading) return <div className="sr-loading" style={{ padding: '48px', textAlign: 'center', color: 'var(--n-muted)' }}><Spinner variant="buble" size={28} color="currentColor" /></div>

    if (data.length === 0) return (
        <div className="sr-empty">
            <i className="bi bi-inbox"></i> Belum ada peserta yang mendaftar.
        </div>
    )

    return (
        <div className="sr-card">
            <style>{`
                .sr-checkbox-box {
                    width: 32px; height: 32px; border: 2px solid #cbd5e1; border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; position: relative; transition: all 0.2s; background: #f8fafc;
                }
                .sr-checkbox-box.checked { background: #eff6ff; border-color: #3b82f6; }
                .sr-checkbox-box.checked::after {
                    content: '\\F26A'; font-family: 'bootstrap-icons'; position: absolute;
                    top: -6px; right: -6px; background: #3b82f6; color: white;
                    font-size: 10px; border-radius: 50%; width: 16px; height: 16px;
                    display: flex; align-items: center; justify-content: center;
                    border: 2px solid white;
                }
                .sr-checkbox-num { font-weight: 700; font-size: 12px; color: #64748b; }
                .sr-checkbox-box.checked .sr-checkbox-num { color: #1d4ed8; }
            `}</style>

            {/* Toolbar 2 baris: (1) Total + Export, (2) Filter */}
            <div className="sr-toolbar2">
                {/* Baris 1: jumlah pendaftar di kiri, tombol export di kanan */}
                <div className="sr-toolbarTop">
                    <div className="sr-toolbarBadges">
                        <div className="sr-totalBadge">
                            <span className="sr-totalNumber">{displayData.length}</span>
                            <span className="sr-totalLabel">Total Pendaftar</span>
                        </div>

                        {dupNameTotal > 0 && (
                            <button
                                onClick={() => setShowDupOnly(v => !v)}
                                className="sr-totalBadge"
                                title={showDupOnly ? 'Tampilkan semua pendaftar' : 'Tampilkan hanya nama ganda'}
                                style={{
                                    cursor: 'pointer',
                                    border: showDupOnly ? '1px solid #ef4444' : '1px solid #fecaca',
                                    background: showDupOnly ? '#ef4444' : '#fef2f2',
                                    fontFamily: 'inherit'
                                }}
                            >
                                <i className="bi bi-exclamation-triangle-fill" style={{ color: showDupOnly ? '#fff' : '#ef4444' }}></i>
                                <span className="sr-totalLabel" style={{ color: showDupOnly ? '#fff' : '#b91c1c', textTransform: 'none' }}>
                                    {dupNameTotal} Nama Ganda {showDupOnly ? '(filter aktif)' : ''}
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="sr-toolbarExports">
                        <Button
                            variant="outline"
                            leftIcon={<i className="bi bi-file-earmark-excel" style={{ color: '#16a34a' }} />}
                            onClick={handleExportExcel}
                            title="Export Excel data terpilih"
                        >
                            Export Excel
                        </Button>
                        <Button
                            variant="outline"
                            leftIcon={<i className="bi bi-file-earmark-zip" style={{ color: '#0284c7' }} />}
                            onClick={handleExportPhotos}
                            title="Export Foto data terpilih (.zip)"
                        >
                            Export Foto
                        </Button>
                    </div>
                </div>

                {/* Baris 2: filter (pencarian + dropdown), menggunakan FilterToolbar */}
                <FilterToolbar>
                    <FilterSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Cari nama peserta..."
                        label="Pencarian"
                        grow={2}
                    />
                    <FilterSelect
                        label="Sanggar"
                        value={filterSanggar}
                        onChange={(val) => { setFilterSanggar(val); setFilterKelas('') }}
                        options={[
                            { value: '', label: 'Semua Sanggar' },
                            ...uniqueSanggar.map(sg => ({ value: sg, label: sg }))
                        ]}
                    />
                    <FilterSelect
                        label="Kelas"
                        value={filterKelas}
                        onChange={setFilterKelas}
                        options={[
                            { value: '', label: 'Semua Kelas' },
                            ...uniqueKelas.map(kl => ({ value: kl, label: kl }))
                        ]}
                    />
                    <FilterSelect
                        label="Asal Sekolah"
                        value={filterSekolah}
                        onChange={setFilterSekolah}
                        options={[
                            { value: '', label: 'Semua Sekolah' },
                            ...uniqueSekolah.map(sek => ({ value: sek, label: sek }))
                        ]}
                    />
                </FilterToolbar>
            </div>

            {displayData.length === 0 ? (
                <div className="sr-emptySmall">
                    Tidak ada peserta yang cocok dengan filter / pencarian.
                </div>
            ) : (
              <>
                <div className="sr-tableWrap sr-desktopTable">
                    <table className="sr-table">
                        <thead>
                            <tr>
                                <th className="text-left md:text-center" style={{width: '60px'}}>
                                    <div
                                        className={`sr-checkbox-box mx-0 md:mx-auto ${selectedIds.length === displayData.length && displayData.length > 0 ? 'checked' : ''}`}
                                        onClick={handleSelectAll}
                                        title="Pilih Semua"
                                        style={{width: '28px', height: '28px'}}
                                    >
                                        <i className="bi bi-check-all" style={{color: selectedIds.length === displayData.length && displayData.length > 0 ? '#1d4ed8' : '#94a3b8'}}></i>
                                    </div>
                                </th>
                                <th>Pendaftar</th>
                                <th>Sanggar</th>
                                <th>Kelas</th>
                                <th>Pas Foto</th>
                                <th style={{textAlign: 'center'}}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((row, index) => {
                                const isDup = dupCounts[normName(row.nama)] > 1
                                return (
                                <tr key={row.id} style={isDup ? { background: '#fff5f5' } : undefined}>
                                {(
                                    <>
                                        <td className="text-left md:text-center">
                                            <div 
                                                className={`sr-checkbox-box mx-0 md:mx-auto ${selectedIds.includes(row.id) ? 'checked' : ''}`}
                                                onClick={() => handleSelectRow(row.id)}
                                            >
                                                <span className="sr-checkbox-num">{index + 1}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{fontWeight: 700, color: 'var(--n-text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                                                {row.nama}
                                                {isDup && (
                                                    <span style={{background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 800, whiteSpace: 'nowrap'}}>
                                                        <i className="bi bi-exclamation-triangle-fill" style={{marginRight: 4}}></i>
                                                        Ganda ×{dupCounts[normName(row.nama)]}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: 4}}>
                                                {row.asal_sekolah}
                                            </div>
                                        </td>
                                        <td><span className="sr-badge">{row.pilihan_sanggar}</span></td>
                                        <td>
                                            <div style={{fontWeight: 600, color: 'var(--n-text)'}}>{row.kelas_pelatihan}</div>
                                            <div className="sr-date"><i className="bi bi-clock"></i> {new Date(row.created_at).toLocaleDateString('id-ID')}</div>
                                        </td>
                                        <td>
                                            {row.pas_foto ? (
                                                <button type="button" onClick={() => openFile(row.pas_foto, `Pas Foto — ${row.nama}`)} className="sr-badge sr-badge--foto" style={{cursor: 'pointer', fontFamily: 'inherit'}}>
                                                    <i className="bi bi-image"></i> Lihat
                                                </button>
                                            ) : (
                                                <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>-</span>
                                            )}
                                        </td>
                                        <td>
                                            <ActionGroup>
                                                <ActionButton action="view" onClick={() => setViewData(row)} />
                                                <ActionButton action="edit" onClick={() => { setEditData(row); setEditMode(row.id) }} />
                                                <ActionButton action="delete" onClick={() => handleDelete(row.id, row.nama)} />
                                            </ActionGroup>
                                        </td>
                                    </>
                                )}
                            </tr>
                            )})}
                        </tbody>
                    </table>
                </div>

                {/* Mobile: kartu peserta (menggantikan tabel di layar kecil) */}
                <div className="sr-cards">
                    {displayData.map((row, index) => {
                        const isDup = dupCounts[normName(row.nama)] > 1
                        return (
                            <div key={row.id} className={`sr-mCard ${isDup ? 'isDup' : ''}`}>
                                {/* Header: pilih + nama + sekolah + foto */}
                                <div className="sr-mCardHead">
                                    <div
                                        className={`sr-checkbox-box ${selectedIds.includes(row.id) ? 'checked' : ''}`}
                                        onClick={() => handleSelectRow(row.id)}
                                    >
                                        <span className="sr-checkbox-num">{index + 1}</span>
                                    </div>
                                    <div className="sr-mCardIdentity">
                                        <div className="sr-mCardName">
                                            {row.nama}
                                            {isDup && (
                                                <span className="sr-mCardDup">
                                                    <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 4 }}></i>
                                                    Ganda ×{dupCounts[normName(row.nama)]}
                                                </span>
                                            )}
                                        </div>
                                        <div className="sr-mCardSchool"><i className="bi bi-building"></i> {row.asal_sekolah}</div>
                                    </div>
                                    {row.pas_foto ? (
                                        <button type="button" onClick={() => openFile(row.pas_foto, `Pas Foto — ${row.nama}`)} className="sr-mCardPhoto" title="Buka pas foto" style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
                                            <img src={row.pas_foto} alt={`Pas foto ${row.nama}`} />
                                        </button>
                                    ) : (
                                        <div className="sr-mCardPhoto sr-mCardPhotoEmpty"><i className="bi bi-person-bounding-box"></i></div>
                                    )}
                                </div>

                                {/* Body: sanggar + kelas */}
                                <div className="sr-mCardBody">
                                    <div className="sr-mCardLabel">Sanggar</div>
                                    <div><span className="sr-badge">{row.pilihan_sanggar}</span></div>
                                    <div className="sr-mCardLabel" style={{ marginTop: 12 }}>Kelas</div>
                                    <div className="sr-mCardKelas">{row.kelas_pelatihan}</div>
                                    <div className="sr-mCardDate"><i className="bi bi-clock"></i> {new Date(row.created_at).toLocaleDateString('id-ID')}</div>
                                </div>

                                {/* Footer: aksi */}
                                <div className="sr-mCardFoot">
                                    {row.pas_foto ? (
                                        <button type="button" onClick={() => openFile(row.pas_foto, `Pas Foto — ${row.nama}`)} className="sr-mCardFotoBtn" style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            <i className="bi bi-image"></i> Lihat foto
                                        </button>
                                    ) : <span className="sr-mCardNoFoto">Tanpa foto</span>}
                                    <div className="sr-mCardActions">
                                        <ActionButton action="view" onClick={() => setViewData(row)} />
                                        <ActionButton action="edit" onClick={() => { setEditData(row); setEditMode(row.id) }} />
                                        <ActionButton action="delete" onClick={() => handleDelete(row.id, row.nama)} />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
              </>
            )}

            {/* View Modal */}
            <Modal
                open={!!viewData}
                onClose={() => setViewData(null)}
                size="lg"
                title="Detail Pendaftar"
                icon="person-vcard"
                variant="default"
            >
                <ModalBody>
                {viewData && (
                <div className="flex flex-col md:flex-row" style={{ gap: '24px' }}>
                            {/* Left Column - Photo */}
                            <div className="w-full md:w-auto flex justify-center flex-shrink-0">
                                <div className="w-[160px] sm:w-[200px] flex flex-col items-center">
                                    <div className="w-full relative" style={{ paddingBottom: '12px' }}>
                                        <div className="w-full aspect-[3/4] overflow-hidden flex items-center justify-center shadow-sm border" style={{ borderRadius: '10px', background: 'var(--n-subtle, #f8fafc)', borderColor: 'var(--n-border, #e2e8f0)' }}>
                                            {viewData.pas_foto ? (
                                                <img src={viewData.pas_foto} alt="Pas Foto" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-slate-300 flex flex-col items-center gap-2">
                                                    <i className="bi bi-person-bounding-box text-4xl"></i>
                                                    <span className="text-[11px] font-medium">Tanpa Foto</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: '-4px', padding: '0 16px' }}>
                                            <div className="w-full text-center text-[12px] font-bold shadow-md truncate" style={{ padding: '6px 12px', borderRadius: '9999px', background: 'var(--n-card, #ffffff)', color: 'var(--n-text, #1d4ed8)', border: '1px solid var(--n-border, #dbeafe)' }}>
                                                {viewData.pilihan_sanggar}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right Column - Data */}
                            <div className="flex-1 w-full pt-1">
                                <div style={{ marginBottom: '28px' }}>
                                    <h4 className="text-[26px] font-black leading-tight tracking-tight" style={{ marginBottom: '6px', color: 'var(--n-text)' }}>{viewData.nama}</h4>
                                    <p className="font-medium text-[14px] flex items-center" style={{ gap: '6px', color: 'var(--n-muted)' }}>
                                        <i className="bi bi-building"></i> {viewData.asal_sekolah}
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '20px 24px' }}>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block">NIP / NUPTK</label>
                                        <div className="font-bold text-[14px]" style={{ color: 'var(--n-text)' }}>{viewData.nip || '-'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block">Kelas Pelatihan</label>
                                        <div className="font-bold text-[14px]" style={{ color: 'var(--n-text)' }}>{viewData.kelas_pelatihan}</div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block">Nomor WA</label>
                                        <div className="font-bold text-[14px]" style={{ color: 'var(--n-text)' }}>{viewData.nomor_wa}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block">Email</label>
                                        <div className="font-bold text-[14px] truncate" style={{ color: 'var(--n-text)' }}>{viewData.email || '-'}</div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block">Pilihan Sanggar</label>
                                        <div className="font-bold text-[14px]" style={{ color: 'var(--n-text)' }}>{viewData.pilihan_sanggar || '-'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block">Sumber Pendaftaran</label>
                                        <div className="font-bold text-[14px]" style={{ color: 'var(--n-text)' }}>{viewData.sumber_aplikasi || '-'}</div>
                                    </div>

                                    <div className="col-span-1 sm:col-span-2 mt-1">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Alamat</label>
                                        <div className="font-medium text-[14px] leading-relaxed" style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--n-subtle, #f8fafc)', color: 'var(--n-text, #475569)', border: '1px solid var(--n-border, #f1f5f9)' }}>
                                            {viewData.alamat || '-'}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-[#f1f5f9] text-right">
                                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#94a3b8]">
                                        <i className="bi bi-clock-history"></i> Mendaftar {new Date(viewData.created_at).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')}
                                    </span>
                                </div>
                            </div>
                </div>
                )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="cancel" onClick={() => setViewData(null)}>Tutup</Button>
                    {viewData && (
                        <Button variant="primary" icon="edit" onClick={() => { setEditData(viewData); setEditMode(viewData.id); setViewData(null) }}>Edit Data</Button>
                    )}
                </ModalFooter>
            </Modal>

            {/* Edit Modal */}
            <Modal
                open={!!editMode && !!editData}
                onClose={() => setEditMode(null)}
                size="lg"
                title="Edit Pendaftar"
                icon="pencil-square"
                variant="edit"
            >
                <ModalBody>
                {editData && (
                <div className="flex flex-col md:flex-row" style={{ gap: '24px' }}>
                            {/* Left Column - Photo (read-only) */}
                            <div className="w-full md:w-auto flex justify-center flex-shrink-0">
                                <div className="w-[160px] sm:w-[200px] flex flex-col items-center">
                                    <div className="w-full relative" style={{ paddingBottom: '12px' }}>
                                        <div className="w-full aspect-[3/4] bg-[#f8fafc] overflow-hidden flex items-center justify-center shadow-sm border border-slate-200" style={{ borderRadius: '10px' }}>
                                            {editData.pas_foto ? (
                                                <img src={editData.pas_foto} alt="Pas Foto" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-slate-300 flex flex-col items-center gap-2">
                                                    <i className="bi bi-person-bounding-box text-4xl"></i>
                                                    <span className="text-[11px] font-medium">Tanpa Foto</span>
                                                </div>
                                            )}
                                        </div>
                                        {editData.pilihan_sanggar && (
                                            <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: '-4px', padding: '0 16px' }}>
                                                <div className="w-full text-center bg-white text-blue-700 text-[12px] font-bold border border-blue-100 shadow-md truncate" style={{ padding: '6px 12px', borderRadius: '9999px' }}>
                                                    {editData.pilihan_sanggar}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Form */}
                            <div className="flex-1 w-full pt-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '16px 24px' }}>
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Nama Lengkap <span className="text-red">*</span></label>
                                        <input type="text" value={editData.nama || ''} onChange={e => setEditData({ ...editData, nama: e.target.value })} className="sr-input" placeholder="Nama Lengkap" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">NIP / NUPTK</label>
                                        <input type="text" value={editData.nip || ''} onChange={e => setEditData({ ...editData, nip: e.target.value })} className="sr-input" placeholder="NIP / NUPTK" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Asal Sekolah</label>
                                        <input type="text" value={editData.asal_sekolah || ''} onChange={e => setEditData({ ...editData, asal_sekolah: e.target.value })} className="sr-input" placeholder="Asal Sekolah" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Nomor WA</label>
                                        <input type="text" value={editData.nomor_wa || ''} onChange={e => setEditData({ ...editData, nomor_wa: e.target.value })} className="sr-input" placeholder="08xxxxxxxxxx" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Email</label>
                                        <input type="email" value={editData.email || ''} onChange={e => setEditData({ ...editData, email: e.target.value })} className="sr-input" placeholder="email@contoh.com" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Pilihan Sanggar</label>
                                        <select value={editData.pilihan_sanggar || ''} onChange={e => setEditData({ ...editData, pilihan_sanggar: e.target.value, kelas_pelatihan: '' })} className="sr-input" style={{ cursor: 'pointer' }}>
                                            <option value="">-- Pilih --</option>
                                            {configData.map((s, idx) => <option key={idx} value={s.sanggar}>{s.sanggar}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Kelas Pelatihan</label>
                                        <select value={editData.kelas_pelatihan || ''} onChange={e => setEditData({ ...editData, kelas_pelatihan: e.target.value })} className="sr-input" style={{ cursor: 'pointer' }} disabled={!editData.pilihan_sanggar}>
                                            <option value="">{editData.pilihan_sanggar ? '-- Pilih --' : '-- Pilih Sanggar Dahulu --'}</option>
                                            {editData.kelas_pelatihan && !availableClassesForEdit.some(k => k.nama === editData.kelas_pelatihan) && (
                                                <option value={editData.kelas_pelatihan}>{editData.kelas_pelatihan} (saat ini)</option>
                                            )}
                                            {availableClassesForEdit.map((k, idx) => <option key={idx} value={k.nama}>{k.nama}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-wider block mb-1">Alamat</label>
                                        <textarea value={editData.alamat || ''} onChange={e => setEditData({ ...editData, alamat: e.target.value })} className="sr-input" placeholder="Alamat" rows={2} style={{ resize: 'vertical', minHeight: '44px' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="cancel" onClick={() => setEditMode(null)}>Batal</Button>
                    <Button variant="primary" icon="save" onClick={() => editMode && handleEditSave(editMode)}>Simpan Perubahan</Button>
                </ModalFooter>
            </Modal>

            {/* Modal Hapus */}
            <Modal
                open={!!deleteData}
                onClose={() => !isDeleting && setDeleteData(null)}
                size="sm"
                title="Hapus Pendaftar"
                icon="trash3"
                variant="delete"
            >
                <ModalBody>
                    <p style={{ margin: 0, color: 'var(--n-text)', fontSize: '0.9rem' }}>
                        Apakah Anda yakin ingin menghapus <strong>{deleteData?.nama}</strong> dari daftar pendaftar? Tindakan ini tidak dapat dibatalkan.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="cancel" onClick={() => setDeleteData(null)} disabled={isDeleting}>Batal</Button>
                    <Button variant="danger" icon="delete" onClick={confirmDelete} isLoading={isDeleting}>Ya, Hapus</Button>
                </ModalFooter>
            </Modal>

            {viewer}
        </div>
    )
}

interface KelasWa { link_grup?: string; template?: string }

const DEFAULT_WA_TEMPLATE = 'Halo {{nama}},\n\nAnda terdaftar pada pelatihan *{{kelas}}* ({{sanggar}}).\nSilakan bergabung ke grup WhatsApp kelas berikut:\n{{link_grup}}\n\nTerima kasih.'

function BroadcastWA() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any[]>([])
    const [config, setConfig] = useState<Record<string, KelasWa>>({})
    const [hasToken, setHasToken] = useState(false)
    const [showTokenEdit, setShowTokenEdit] = useState(false)
    const [tokenInput, setTokenInput] = useState('')
    const [selected, setSelected] = useState<Record<string, boolean>>({})
    const [busyKelas, setBusyKelas] = useState<string | null>(null)
    const [expandedKelas, setExpandedKelas] = useState<string | null>(null)
    const [showParticipants, setShowParticipants] = useState<Record<string, boolean>>({})

    const isValidWa = (n: any) => String(n || '').replace(/\D/g, '').length >= 9
    const localeSort = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
    const kelasList = (Array.from(new Set(data.map(d => d.kelas_pelatihan))).filter(Boolean) as string[]).sort(localeSort)

    // Ringkasan global
    const totalAll = data.length
    const validAll = data.filter(d => isValidWa(d.nomor_wa)).length
    const noNumAll = totalAll - validAll

    const fetchData = async () => {
        const res = await fetch('/api/sanggar')
        const json = await res.json().catch(() => ({}))
        setData(json.data || [])
    }

    const loadAll = async () => {
        setLoading(true)
        try {
            const [cfgRes] = await Promise.all([
                fetch('/api/sanggar-kurikulum/broadcast').then(r => r.json()).catch(() => null),
                fetchData(),
            ])
            if (cfgRes?.ok) { setConfig(cfgRes.config || {}); setHasToken(!!cfgRes.hasToken) }
        } catch (e) { /* noop */ }
        setLoading(false)
    }

    useEffect(() => { loadAll() /* eslint-disable-next-line */ }, [])

    // Default centang: peserta bernomor valid yang belum pernah terkirim.
    // Reset tiap data berubah (mis. setelah kirim → yang sudah terkirim ikut ter-uncheck).
    useEffect(() => {
        const init: Record<string, boolean> = {}
        data.forEach(d => { if (isValidWa(d.nomor_wa) && !d.wa_sent_at) init[d.id] = true })
        setSelected(init)
    }, [data]) // eslint-disable-line

    const toggleOne = (id: string) => setSelected(prev => ({ ...prev, [id]: !prev[id] }))
    const setKelasAll = (rows: any[], value: boolean) => {
        setSelected(prev => {
            const next = { ...prev }
            rows.forEach(r => { if (isValidWa(r.nomor_wa)) next[r.id] = value })
            return next
        })
    }

    const setField = (kelas: string, field: keyof KelasWa, val: string) => {
        setConfig(prev => ({ ...prev, [kelas]: { ...(prev[kelas] || {}), [field]: val } }))
    }

    const post = async (bodyObj: any) => {
        const res = await fetch('/api/sanggar-kurikulum/broadcast', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj)
        })
        return res.json()
    }

    const saveConfig = async (silent = false) => {
        const json = await post({ action: 'save-config', config })
        if (json.ok) { if (!silent) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Konfigurasi tersimpan', showConfirmButton: false, timer: 1500 }) }
        else Swal.fire('Gagal', json.error, 'error')
        return json.ok
    }

    const saveToken = async () => {
        if (!tokenInput.trim()) { Swal.fire('Perhatian', 'Token tidak boleh kosong', 'warning'); return }
        const json = await post({ action: 'save-token', token: tokenInput.trim() })
        if (json.ok) { setHasToken(true); setShowTokenEdit(false); setTokenInput(''); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Token tersimpan', showConfirmButton: false, timer: 1500 }) }
        else Swal.fire('Gagal', json.error, 'error')
    }

    const preview = async (kelas: string) => {
        if (!(await saveConfig(true))) return
        const json = await post({ action: 'preview', kelas })
        if (json.ok) {
            Swal.fire({ title: `Pratinjau — ${kelas}`, html: `<pre style="text-align:left;white-space:pre-wrap;font-family:inherit;font-size:0.85rem;margin:0">${String(json.message || '(template kosong)').replace(/</g, '&lt;')}</pre>`, confirmButtonText: 'Tutup' })
        } else Swal.fire('Gagal', json.error, 'error')
    }

    const send = async (kelas: string, ids: string[]) => {
        if (!hasToken) { Swal.fire('Token WA belum diatur', 'Isi token WhatsApp terlebih dahulu di bagian atas panel. Jika menggunakan Baileys (scan QR), pastikan pengaturan global WA diatur ke Baileys.', 'warning'); return }
        if (ids.length === 0) { Swal.fire('Info', 'Centang minimal satu peserta untuk dikirim.', 'info'); return }
        if (!(await saveConfig(true))) return
        const c = await Swal.fire({ title: 'Kirim pesan WA?', html: `Akan mengirim ke <b>${ids.length}</b> peserta terpilih di kelas <b>${kelas}</b>.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, kirim', confirmButtonColor: '#16a34a' })
        if (!c.isConfirmed) return
        setBusyKelas(kelas)
        Swal.fire({ title: 'Mengirim…', html: 'Pesan dikirim satu per satu, mohon tunggu.', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
        try {
            const json = await post({ action: 'send', kelas, ids })
            Swal.close()
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Selesai', html: `Terkirim: <b>${json.terkirim}</b><br>Gagal: <b>${json.gagal}</b><br>Tanpa nomor: <b>${json.tanpa_nomor}</b>` })
                fetchData()
            } else Swal.fire('Gagal', json.error, 'error')
        } catch (e: any) { Swal.close(); Swal.fire('Gagal', e.message, 'error') }
        setBusyKelas(null)
    }

    return (
        <div className="sr-card">
            <div className="sr-sectionHead" style={{ marginBottom: 4 }}>
                <div className="sr-iconOuter sr-iconGreen">
                    <i className="bi bi-whatsapp"></i>
                </div>
                <div className="sr-sectionTitles">
                    <h3>Broadcast WA per Kelas</h3>
                    <p>Kirim pesan berisi link grup ke tiap peserta sesuai kelas pelatihannya.</p>
                </div>
            </div>
            {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--n-muted)' }}><Spinner variant="buble" size={24} color="currentColor" /></div>
            ) : (
                <>
                            {/* Token */}
                            <div className="sr-tokenBox">
                                <i className="bi bi-key-fill" style={{ color: hasToken ? '#16a34a' : '#f59e0b' }}></i>
                                {hasToken && !showTokenEdit ? (
                                    <>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--n-text)', fontWeight: 600 }}>Token WA tersimpan</span>
                                        <Button variant="outline" onClick={() => setShowTokenEdit(true)} style={{ marginLeft: 'auto' }}>Ubah token</Button>
                                    </>
                                ) : (
                                    <>
                                        <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Token Provider (Kosongkan jika Baileys)" className="sr-input" style={{ flex: 1, minWidth: 160 }} />
                                        <Button variant="primary" onClick={saveToken}>Simpan Token</Button>
                                        {hasToken && <Button variant="cancel" onClick={() => { setShowTokenEdit(false); setTokenInput('') }}>Batal</Button>}
                                    </>
                                )}
                            </div>

                            {/* Ringkasan */}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                                <div className="sr-statBox">
                                    <div className="sr-statBox-label">Total peserta</div>
                                    <div className="sr-statBox-val">{totalAll}</div>
                                </div>
                                <div className="sr-statBox sr-statBox--green">
                                    <div className="sr-statBox-label">Nomor valid</div>
                                    <div className="sr-statBox-val">{validAll}</div>
                                </div>
                                <div className="sr-statBox sr-statBox--yellow">
                                    <div className="sr-statBox-label">Tanpa nomor</div>
                                    <div className="sr-statBox-val">{noNumAll}</div>
                                </div>
                            </div>

                            {kelasList.length === 0 ? (
                                <div className="sr-emptySmall">Belum ada kelas dengan peserta.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {kelasList.map(kelas => {
                                        const rows = data.filter(d => d.kelas_pelatihan === kelas)
                                        const total = rows.length
                                        const validRows = rows.filter(d => isValidWa(d.nomor_wa))
                                        const valid = validRows.length
                                        const sent = rows.filter(d => d.wa_sent_at).length
                                        const belum = rows.filter(d => isValidWa(d.nomor_wa) && !d.wa_sent_at).length
                                        const kc = config[kelas] || {}
                                        const linkEmpty = !kc.link_grup || !kc.link_grup.trim()
                                        const selectedIds = validRows.filter(r => selected[r.id]).map(r => r.id)
                                        const allSelected = validRows.length > 0 && validRows.every(r => selected[r.id])
                                        const busy = busyKelas === kelas
                                        const isExpanded = expandedKelas === kelas
                                        const isParticipantsVisible = !!showParticipants[kelas]

                                        return (
                                            <div key={kelas} style={{ border: '1px solid var(--n-border)', borderRadius: 12, overflow: 'hidden' }}>
                                                <div 
                                                    onClick={() => setExpandedKelas(isExpanded ? null : kelas)}
                                                    style={{ padding: '12px 14px', background: 'var(--n-subtle)', borderBottom: isExpanded ? '1px solid var(--n-border)' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: 'var(--n-text)', fontSize: '0.9rem' }}>{kelas}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: 3 }}>
                                                            {total} peserta · {valid} siap · <span style={{ color: '#16a34a' }}>{sent} terkirim</span> · {belum} belum
                                                        </div>
                                                    </div>
                                                    <div style={{ color: 'var(--n-muted)' }}>
                                                        <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                <div style={{ padding: 14 }}>
                                                    <label className="sr-mCardLabel" style={{ display: 'block', marginBottom: 5 }}>Link grup WhatsApp</label>
                                                    <input type="text" value={kc.link_grup || ''} onChange={e => setField(kelas, 'link_grup', e.target.value)} placeholder="https://chat.whatsapp.com/…" className="sr-input" style={{ marginBottom: 12, borderColor: linkEmpty ? '#fca5a5' : undefined }} />
                                                    <label className="sr-mCardLabel" style={{ display: 'block', marginBottom: 5 }}>Template pesan</label>
                                                    <textarea value={kc.template ?? ''} onChange={e => setField(kelas, 'template', e.target.value)} rows={4} className="sr-input" style={{ resize: 'vertical', lineHeight: 1.5 }} placeholder={DEFAULT_WA_TEMPLATE} />
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 4px' }}>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>Placeholder:</span>
                                                        {['{{nama}}', '{{kelas}}', '{{sanggar}}', '{{link_grup}}'].map(ph => (
                                                            <button key={ph} type="button" onClick={() => setField(kelas, 'template', (kc.template ?? '') + ph)} style={{ fontSize: '0.72rem', background: '#eef2ff', color: '#3083FF', border: '1px solid #e0e7ff', borderRadius: 5, padding: '1px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>{ph}</button>
                                                        ))}
                                                        {!kc.template && (
                                                            <button type="button" onClick={() => setField(kelas, 'template', DEFAULT_WA_TEMPLATE)} className="sr-btnOutline" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>Pakai template default</button>
                                                        )}
                                                    </div>

                                                    {/* Daftar peserta + centang (filter penerima) */}
                                                    <div style={{ marginTop: 14, border: '1px solid var(--n-border)', borderRadius: 10, overflow: 'hidden' }}>
                                                        <div 
                                                            onClick={() => setShowParticipants(prev => ({...prev, [kelas]: !prev[kelas]}))}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderBottom: isParticipantsVisible ? '1px solid var(--n-border)' : 'none', cursor: 'pointer' }}
                                                        >
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-text)' }}>
                                                                Daftar Penerima <span style={{ color: 'var(--n-muted)', fontWeight: 'normal' }}>({selectedIds.length} dipilih dari {validRows.length} valid)</span>
                                                            </span>
                                                            <div style={{ marginLeft: 'auto', color: 'var(--n-muted)' }}>
                                                                <i className={`bi bi-chevron-${isParticipantsVisible ? 'up' : 'down'}`}></i>
                                                            </div>
                                                        </div>
                                                        {isParticipantsVisible && (
                                                        <>
                                                            <div style={{ padding: '8px 12px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-text)', cursor: validRows.length ? 'pointer' : 'not-allowed' }}>
                                                                    <input type="checkbox" checked={allSelected} onChange={e => setKelasAll(rows, e.target.checked)} disabled={validRows.length === 0} />
                                                                    Pilih semua ({validRows.length} bernomor)
                                                                </label>
                                                            </div>
                                                            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                                                {rows.map(p => {
                                                                    const pv = isValidWa(p.nomor_wa)
                                                                    return (
                                                                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: pv ? 'pointer' : 'not-allowed', opacity: pv ? 1 : 0.6 }}>
                                                                            <input type="checkbox" checked={!!selected[p.id] && pv} onChange={() => toggleOne(p.id)} disabled={!pv} />
                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--n-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nama}</div>
                                                                                <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>{pv ? p.nomor_wa : 'nomor belum diatur'}</div>
                                                                            </div>
                                                                            {p.wa_sent_at ? (
                                                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle"></i> terkirim</span>
                                                                            ) : !pv ? (
                                                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>tanpa nomor</span>
                                                                            ) : (
                                                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>belum</span>
                                                                            )}
                                                                        </label>
                                                                    )
                                                                })}
                                                            </div>
                                                        </>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                                        <Button variant="outline" icon="save" onClick={() => saveConfig()}>Simpan</Button>
                                                        <Button variant="outline" leftIcon={<i className="bi bi-eye" />} onClick={() => preview(kelas)}>Pratinjau</Button>
                                                        <Button
                                                            variant="primary"
                                                            leftIcon={<i className="bi bi-whatsapp" />}
                                                            onClick={() => send(kelas, selectedIds)}
                                                            disabled={busy || linkEmpty || selectedIds.length === 0}
                                                            isLoading={busy}
                                                            style={{ marginLeft: 'auto', background: (!busy && !linkEmpty && selectedIds.length > 0) ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : undefined }}
                                                        >
                                                            {busy ? 'Mengirim…' : `Kirim ke ${selectedIds.length}`}
                                                        </Button>
                                                    </div>
                                                    {linkEmpty && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 6 }}><i className="bi bi-exclamation-circle"></i> Link grup wajib diisi sebelum mengirim.</div>}
                                                </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}
        </div>
    )
}

function PengaturanSanggar({ configData, reloadConfig }: { configData: SanggarConfig[], reloadConfig: () => void }) {
    const [localConfig, setLocalConfig] = useState<SanggarConfig[]>(configData)
    const [saving, setSaving] = useState(false)
    const [regCounts, setRegCounts] = useState<Record<string, number>>({})
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [modalData, setModalData] = useState<SanggarConfig>({ sanggar: '', kelas: [] })

    // Normalize kelas to new format (backward compat if old data is string[])
    const normalizeConfig = (cfg: SanggarConfig[]): SanggarConfig[] => cfg.map(s => ({
        ...s,
        kelas: s.kelas.map((k: any) => typeof k === 'string' ? { nama: k, kuota: '' } : (k.kuota === 0 ? {...k, kuota: ''} : k))
    }))

    const fetchRegCounts = async () => {
        const res = await fetch('/api/sanggar')
        const json = await res.json().catch(() => ({}))
        const counts: Record<string, number> = {}
        for (const r of json.data || []) {
            const key = `${r.pilihan_sanggar}||${r.kelas_pelatihan}`
            counts[key] = (counts[key] || 0) + 1
        }
        setRegCounts(counts)
    }

    useEffect(() => { setLocalConfig(normalizeConfig(configData)); fetchRegCounts() }, [configData])

    const openModalNew = () => {
        setEditingIndex(null)
        setModalData({ sanggar: '', kelas: [] })
        setIsModalOpen(true)
    }

    const openModalEdit = (idx: number) => {
        setEditingIndex(idx)
        setModalData({ sanggar: localConfig[idx].sanggar, kelas: localConfig[idx].kelas.map(k => ({...k})) })
        setIsModalOpen(true)
    }

    const closeModal = () => setIsModalOpen(false)

    const handleModalAddKelas = () => {
        setModalData({ ...modalData, kelas: [...modalData.kelas, { nama: '', kuota: '' }] })
    }

    const handleModalUpdateKelasNama = (kIdx: number, val: string) => {
        const newKelas = [...modalData.kelas]
        newKelas[kIdx] = { ...newKelas[kIdx], nama: val }
        setModalData({ ...modalData, kelas: newKelas })
    }

    const handleModalUpdateKelasKuota = (kIdx: number, val: any) => {
        const newKelas = [...modalData.kelas]
        newKelas[kIdx] = { ...newKelas[kIdx], kuota: val }
        setModalData({ ...modalData, kelas: newKelas })
    }

    const handleModalRemoveKelas = (kIdx: number) => {
        const newKelas = [...modalData.kelas]
        newKelas.splice(kIdx, 1)
        setModalData({ ...modalData, kelas: newKelas })
    }

    const handleModalSave = async () => {
        if (!modalData.sanggar.trim()) {
            Swal.fire('Perhatian', 'Nama sanggar tidak boleh kosong', 'warning')
            return
        }
        
        const copy = [...localConfig]
        if (editingIndex !== null) {
            copy[editingIndex] = modalData
        } else {
            copy.push(modalData)
        }
        setLocalConfig(copy)
        setIsModalOpen(false)
        await saveToDBDirect(copy)
    }

    const handleRemoveSanggar = (idx: number) => {
        Swal.fire({
            title: 'Hapus Sanggar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const copy = [...localConfig]
                copy.splice(idx, 1)
                setLocalConfig(copy)
                await saveToDBDirect(copy)
            }
        })
    }

    const handleToggleAktif = async (idx: number) => {
        const copy = [...localConfig]
        copy[idx] = { ...copy[idx], aktif: copy[idx].aktif === false ? true : false }
        setLocalConfig(copy)
        await saveToDBDirect(copy)
    }

    const saveToDBDirect = async (configToSave: SanggarConfig[]) => {
        setSaving(true)
        const cleanedConfig = configToSave.filter(s => s.sanggar.trim() !== '').map(s => ({
            ...s,
            kelas: s.kelas.filter(k => k.nama.trim() !== '')
        }))

        const res = await fetch('/api/site-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: 'sanggar_config',
                label: 'Konfigurasi Sanggar',
                description: 'Pengaturan dropdown pilihan sanggar dan kelas',
                value: JSON.stringify(cleanedConfig),
                is_active: true
            })
        })
        
        setSaving(false)
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            Swal.fire('Gagal', err.message || err.error || 'Gagal menyimpan pengaturan', 'error')
            return
        }

        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Konfigurasi Tersimpan', showConfirmButton: false, timer: 1500 })
        reloadConfig()
    }

    return (
        <div className="sr-card">
            <div className="sr-flexBetween" style={{marginBottom: 16}}>
                <div className="sr-sectionHead">
                    <div className="sr-iconOuter sr-iconIndigo">
                        <i className="bi bi-gear-fill"></i>
                    </div>
                    <div className="sr-sectionTitles">
                        <h3>Manajemen Sanggar</h3>
                        <p>Konfigurasi di sini akan langsung berlaku pada dropdown pendaftaran.</p>
                    </div>
                </div>
                <Button icon="add" variant="primary" onClick={openModalNew} disabled={saving} isLoading={saving}>
                    Tambah Sanggar
                </Button>
            </div>

            <div className="sr-sanggarList">
                {localConfig.map((sConfig, sIdx) => (
                    <div key={sIdx} className="sr-sanggarItem">
                        <div className="sr-sanggarHeader">
                            <div className="sr-sanggarTitle">
                                <i><span className="bi bi-building"></span></i>
                                <span style={{ textDecoration: sConfig.aktif === false ? 'line-through' : 'none', opacity: sConfig.aktif === false ? 0.6 : 1 }}>{sConfig.sanggar}</span>
                            </div>
                            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                                <ActionButton
                                    action="toggle"
                                    onClick={() => handleToggleAktif(sIdx)}
                                    title={sConfig.aktif === false ? 'Aktifkan Sanggar' : 'Nonaktifkan Sanggar'}
                                    style={{ backgroundColor: sConfig.aktif === false ? '#ef4444' : '#10b981', color: '#fff', border: 'none' }}
                                />
                                <ActionButton action="edit" onClick={() => openModalEdit(sIdx)} title="Edit Sanggar" />
                                <ActionButton action="delete" onClick={() => handleRemoveSanggar(sIdx)} title="Hapus Sanggar" />
                            </div>
                        </div>
                        
                        <div className="sr-kelasWrap">
                            <div className="sr-kelasLabel">
                                <i className="bi bi-list-check"></i> Daftar Kelas Pelatihan
                            </div>
                            {sConfig.kelas.length === 0 ? (
                                <div className="sr-emptySmall">Belum ada kelas di sanggar ini.</div>
                            ) : (
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                                    {sConfig.kelas.map((k, kIdx) => (
                                        <span key={kIdx} className="sr-kelasLabelBox">
                                            {k.nama || <i>(Tanpa Nama)</i>}
                                            {Number(k.kuota) > 0 && (() => {
                                                const terisi = regCounts[`${sConfig.sanggar}||${k.nama}`] || 0
                                                const penuh = terisi >= Number(k.kuota)
                                                return (
                                                    <span className={`sr-badgeKuota ${penuh ? 'isPenuh' : 'isSisa'}`}>
                                                        <i className={`bi bi-people-fill`} style={{marginRight:3}}></i>
                                                        {terisi}/{k.kuota} {penuh && <span style={{marginLeft:2}}>🔒</span>}
                                                    </span>
                                                )
                                            })()}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Form Tambah/Edit Sanggar */}
            <Modal
                open={isModalOpen}
                onClose={closeModal}
                size="md"
                title={editingIndex !== null ? 'Edit Sanggar' : 'Tambah Sanggar'}
                icon="building"
                variant={editingIndex !== null ? 'edit' : 'add'}
            >
                <ModalBody>
                            <div className="sr-field" style={{marginBottom: 24}}>
                                <label>Nama Sanggar</label>
                                <input 
                                    type="text" 
                                    value={modalData.sanggar}
                                    onChange={e => setModalData({...modalData, sanggar: e.target.value})}
                                    className="sr-input"
                                    placeholder="Contoh: Sanggar Komputer"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="sr-field">
                                <label>Daftar Kelas Pelatihan</label>
                                {modalData.kelas.length === 0 && (
                                    <div className="sr-emptySmall" style={{padding: '12px'}}>Belum ada kelas ditambahkan.</div>
                                )}
                                {modalData.kelas.map((k, kIdx) => (
                                    <div key={kIdx} style={{display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center'}}>
                                        <input 
                                            type="text" 
                                            value={k.nama}
                                            onChange={e => handleModalUpdateKelasNama(kIdx, e.target.value)}
                                            className="sr-input"
                                            placeholder="Nama Kelas..."
                                            style={{flex: 2}}
                                        />
                                        <div style={{position:'relative', flex:1, minWidth:110}}>
                                            <i className="bi bi-people-fill" style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:'0.8rem'}}></i>
                                            <input 
                                                type="number" 
                                                value={k.kuota === null || k.kuota === undefined ? '' : k.kuota}
                                                onChange={e => handleModalUpdateKelasKuota(kIdx, e.target.value === '' ? '' : parseInt(e.target.value))}
                                                className="sr-input"
                                                placeholder="Kosongkan jika tanpa batas"
                                                min={0}
                                                style={{paddingLeft:30}}
                                            />
                                        </div>
                                        <ActionButton action="delete" onClick={() => handleModalRemoveKelas(kIdx)} />
                                    </div>
                                ))}
                                <Button variant="outline" icon="add" onClick={handleModalAddKelas} style={{marginTop: 8}}>Tambah Kelas Baru</Button>
                            </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="cancel" onClick={closeModal}>Batal</Button>
                    <Button variant="primary" icon="save" onClick={handleModalSave} isLoading={saving}>Simpan Sanggar</Button>
                </ModalFooter>
            </Modal>
        </div>
    )
}
