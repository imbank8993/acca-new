'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getActiveSettings } from '@/lib/settings-client'
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter'
import Swal from 'sweetalert2'
import { swalError, swalWarning } from '@/lib/swal-premium'
import Select from 'react-select'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { FilterToolbar, FilterSelect } from '@/components/ui/FilterToolbar'

interface SiswaEkskul {
    id: string
    ekskul_id: string
    siswa_id: string
    tahun_ajaran: string
    semester: number
    aktif: boolean
    nama_ekskul?: string
    nama_siswa?: string
}

interface MasterEkskul {
    id: string
    nama_ekskul: string
    hari?: string | null
    waktu_mulai?: string | null
    waktu_selesai?: string | null
    tempat?: string | null
    keterangan?: string | null
    aktif?: boolean | null
}

function formatWaktu(waktu?: string | null) {
    if (!waktu) return ''
    try {
        if (waktu.includes('T')) {
            const d = new Date(waktu)
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
        return waktu.slice(0, 5)
    } catch {
        return waktu
    }
}

const getCustomSelectStyles = (isDark: boolean) => ({
    control: (base: any, state: any) => ({
        ...base,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: state.isFocused 
            ? 'var(--n-primary, #3b82f6)' 
            : isDark ? 'rgba(255, 255, 255, 0.18)' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none',
        borderRadius: '10px',
        padding: '3px 6px',
        color: isDark ? '#ffffff' : '#0f172a',
        cursor: 'pointer',
        '&:hover': {
            borderColor: 'var(--n-primary, #3b82f6)',
        }
    }),
    menu: (base: any) => ({
        ...base,
        borderRadius: '12px',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #e2e8f0',
        boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.7)' : '0 10px 25px rgba(0,0,0,0.1)',
        zIndex: 99999,
        overflow: 'hidden'
    }),
    menuList: (base: any) => ({
        ...base,
        padding: '6px',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
    }),
    option: (base: any, state: any) => ({
        ...base,
        fontSize: '0.9rem',
        fontWeight: 500,
        padding: '10px 14px',
        borderRadius: '8px',
        backgroundColor: state.isSelected
            ? '#3b82f6'
            : state.isFocused
                ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.08)')
                : 'transparent',
        color: state.isSelected
            ? '#ffffff'
            : isDark ? '#f1f5f9' : '#0f172a',
        cursor: 'pointer',
    }),
    singleValue: (base: any) => ({
        ...base,
        fontWeight: 600,
        color: isDark ? '#ffffff' : '#0f172a',
    }),
    input: (base: any) => ({
        ...base,
        color: isDark ? '#ffffff' : '#0f172a',
    }),
    placeholder: (base: any) => ({
        ...base,
        color: isDark ? '#94a3b8' : '#94a3b8',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
})

export default function SiswaEkskulView({ user }: { user?: any }) {
    const taFilter = useTahunAjaranFilter()
    const selectedTA = taFilter.selected

    const [siswaEkskulList, setSiswaEkskulList] = useState<SiswaEkskul[]>([])
    const [masterEkskulList, setMasterEkskulList] = useState<MasterEkskul[]>([])
    const [ekskulLoading, setEkskulLoading] = useState(true)
    const [isDark, setIsDark] = useState(false)
    
    // Form Modal States
    const [showEkskulForm, setShowEkskulForm] = useState(false)
    const [selectedEkskulOption, setSelectedEkskulOption] = useState<{ value: string; label: string; meta?: MasterEkskul } | null>(null)
    const [savingEkskul, setSavingEkskul] = useState(false)
    const [deleteEkskulId, setDeleteEkskulId] = useState<string | null>(null)
    const [activeTA, setActiveTA] = useState('')

    // Theme observer
    useEffect(() => {
        const checkDark = () => {
            const isDarkTheme = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark')
            setIsDark(isDarkTheme)
        }
        checkDark()
        const obs = new MutationObserver(checkDark)
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => obs.disconnect()
    }, [])

    const selectStyles = useMemo(() => getCustomSelectStyles(isDark), [isDark])

    // Load active settings
    useEffect(() => {
        (async () => {
            try {
                const active = await getActiveSettings()
                if (active?.tahun_ajaran) {
                    setActiveTA(active.tahun_ajaran)
                }
            } catch (e) {
                console.error('Error fetching active settings:', e)
            }
        })()
    }, [])

    // Load Master Ekskul
    const loadMasterEkskul = useCallback(async () => {
        try {
            const res = await fetch('/api/ekskul?aktif=true')
            const json = await res.json()
            if (json.ok && Array.isArray(json.data)) {
                setMasterEkskulList(json.data)
            }
        } catch (e) {
            console.error('Error fetching master ekskul:', e)
        }
    }, [])

    useEffect(() => {
        loadMasterEkskul()
    }, [loadMasterEkskul])

    // Fetch Siswa Ekskul
    const fetchSiswaEkskul = useCallback(async (taToUse: string) => {
        setEkskulLoading(true)
        try {
            const queryParam = taToUse ? `?tahun_ajaran=${encodeURIComponent(taToUse)}` : ''
            const res = await fetch(`/api/ekskul/siswa${queryParam}`)
            const json = await res.json()
            if (json.ok && Array.isArray(json.data)) {
                setSiswaEkskulList(json.data)
            } else {
                setSiswaEkskulList([])
            }
        } catch (e) {
            console.error('Error fetching student ekskul:', e)
            setSiswaEkskulList([])
        } finally {
            setEkskulLoading(false)
        }
    }, [])

    useEffect(() => {
        const ta = selectedTA || activeTA
        if (ta) {
            fetchSiswaEkskul(ta)
        }
    }, [selectedTA, activeTA, fetchSiswaEkskul])

    // Master map for quick lookup
    const masterMap = useMemo(() => {
        const map = new Map<string, MasterEkskul>()
        masterEkskulList.forEach(m => map.set(m.id, m))
        return map
    }, [masterEkskulList])

    // Distinct enrolled ekskuls (merging semester 1 & 2)
    const uniqueEnrolledEkskuls = useMemo(() => {
        const map = new Map<string, SiswaEkskul>()
        siswaEkskulList.forEach(e => {
            if (!map.has(e.ekskul_id)) {
                map.set(e.ekskul_id, e)
            }
        })
        return Array.from(map.values())
    }, [siswaEkskulList])

    // Available ekskul for joining
    const availableEkskulList = useMemo(() => {
        const joinedIds = new Set(siswaEkskulList.map(e => e.ekskul_id))
        return masterEkskulList.filter(m => m.aktif !== false && !joinedIds.has(m.id))
    }, [masterEkskulList, siswaEkskulList])

    // Open enrollment modal
    const openEkskulForm = () => {
        setSelectedEkskulOption(null)
        setShowEkskulForm(true)
    }

    // Save enrollment
    const handleSaveSiswaEkskul = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedEkskulOption) {
            swalWarning('Peringatan', 'Pilih ekstrakurikuler terlebih dahulu!')
            return
        }

        const taToUse = selectedTA || activeTA
        if (!taToUse) {
            swalWarning('Peringatan', 'Tahun ajaran belum ditentukan!')
            return
        }

        setSavingEkskul(true)
        try {
            const payloadBase = {
                ekskul_id: selectedEkskulOption.value,
                tahun_ajaran: taToUse,
                aktif: true,
            }

            // Register for both Semester 1 and Semester 2 of the academic year
            const [res1, res2] = await Promise.all([
                fetch('/api/ekskul/siswa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payloadBase, semester: 1 }),
                }),
                fetch('/api/ekskul/siswa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payloadBase, semester: 2 }),
                }),
            ])

            const json1 = await res1.json()
            const json2 = await res2.json()

            if (!res1.ok || !res2.ok || !json1.ok || !json2.ok) {
                const errMsg = json1.error || json2.error || 'Gagal menyimpan pilihan ekstrakurikuler'
                swalError('Gagal', errMsg)
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil Mendaftar',
                    text: `Anda berhasil terdaftar di ekstrakurikuler ${selectedEkskulOption.label}.`,
                    timer: 2000,
                    showConfirmButton: false,
                    confirmButtonColor: '#10b981',
                })
                setShowEkskulForm(false)
                fetchSiswaEkskul(taToUse)
            }
        } catch (e: any) {
            swalError('Error', e.message || 'Terjadi kesalahan sistem')
        } finally {
            setSavingEkskul(false)
        }
    }

    // Cancel / Delete enrollment
    const handleDeleteSiswaEkskul = async (item: SiswaEkskul) => {
        const ekskulNama = item.nama_ekskul || masterMap.get(item.ekskul_id)?.nama_ekskul || 'ekstrakurikuler ini'
        setDeleteEkskulId(item.ekskul_id)

        const c = await Swal.fire({
            title: 'Batalkan Pilihan?',
            html: `Apakah Anda yakin ingin membatalkan keikutsertaan pada <strong>${ekskulNama}</strong>?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Batalkan',
            cancelButtonText: 'Kembali',
        })

        if (!c.isConfirmed) {
            setDeleteEkskulId(null)
            return
        }

        try {
            const recordsToDelete = siswaEkskulList.filter(e => e.ekskul_id === item.ekskul_id)
            let success = true
            for (const record of recordsToDelete) {
                const res = await fetch(`/api/ekskul/siswa?id=${record.id}`, { method: 'DELETE' })
                const json = await res.json()
                if (!res.ok || !json.ok) success = false
            }

            if (success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Dibatalkan',
                    text: 'Pilihan ekstrakurikuler berhasil dibatalkan.',
                    timer: 2000,
                    showConfirmButton: false,
                    confirmButtonColor: '#10b981',
                })
                fetchSiswaEkskul(selectedTA || activeTA)
            } else {
                swalError('Gagal', 'Beberapa data gagal dihapus')
            }
        } catch (e: any) {
            swalError('Error', e.message || 'Gagal menghapus ekstrakurikuler')
        } finally {
            setDeleteEkskulId(null)
        }
    }

    const currentYear = selectedTA || activeTA

    return (
        <div className="ekp-scope" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '3rem' }}>
            {/* Header Card */}
            <div className="ps-card" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--n-primary, #3b82f6)',
                                fontSize: '1.4rem'
                            }}>
                                <i className="bi bi-trophy" />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--n-text)' }}>
                                    Ekstrakurikuler
                                </h2>
                                <p style={{ margin: '2px 0 0', color: 'var(--n-muted, #64748b)', fontSize: '0.9rem' }}>
                                    Pilih dan ikuti kegiatan ekstrakurikuler minat & bakat Anda.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {taFilter.years.length > 1 && (
                            <FilterToolbar style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
                                <FilterSelect
                                    label="Tahun Ajaran"
                                    value={taFilter.selected}
                                    onChange={taFilter.setSelected}
                                    options={taFilter.years.map(y => ({ value: y, label: `TA ${y}` }))}
                                />
                            </FilterToolbar>
                        )}
                        <Button
                            variant="primary"
                            icon="add"
                            onClick={openEkskulForm}
                        >
                            Pilih Ekskul
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content List */}
            {ekskulLoading ? (
                <div className="ps-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <Spinner size={32} />
                    <p style={{ marginTop: '16px', color: 'var(--n-muted, #64748b)', fontSize: '0.95rem' }}>
                        Memuat data ekstrakurikuler...
                    </p>
                </div>
            ) : uniqueEnrolledEkskuls.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--n-text)' }}>
                            Ekskul yang Diikuti ({uniqueEnrolledEkskuls.length})
                        </span>
                        {currentYear && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--n-muted, #64748b)' }}>
                                Periode TA {currentYear}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                        {uniqueEnrolledEkskuls.map((item) => {
                            const master = masterMap.get(item.ekskul_id)
                            const nama = item.nama_ekskul || master?.nama_ekskul || 'Ekstrakurikuler'
                            const hari = master?.hari || null
                            const waktuMulai = formatWaktu(master?.waktu_mulai)
                            const waktuSelesai = formatWaktu(master?.waktu_selesai)
                            const tempat = master?.tempat || null
                            const keterangan = master?.keterangan || null
                            const isDeleting = deleteEkskulId === item.ekskul_id

                            return (
                                <div
                                    key={item.ekskul_id}
                                    className="ps-card"
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        padding: '20px',
                                        borderRadius: '16px',
                                        border: '1px solid var(--n-border)',
                                        background: 'var(--n-card)',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(59, 130, 246, 0.12)',
                                                    color: 'var(--n-primary, #3b82f6)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.2rem',
                                                    flexShrink: 0
                                                }}>
                                                    <i className="bi bi-award-fill" />
                                                </div>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--n-text)' }}>
                                                        {nama}
                                                    </h3>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--n-muted, #64748b)' }}>
                                                        Tahun Ajaran {item.tahun_ajaran}
                                                    </span>
                                                </div>
                                            </div>

                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                background: item.aktif !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: item.aktif !== false ? '#10b981' : '#ef4444',
                                                border: `1px solid ${item.aktif !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                                flexShrink: 0
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                                                {item.aktif !== false ? 'Terdaftar' : 'Nonaktif'}
                                            </span>
                                        </div>

                                        {/* Detail info */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            padding: '12px 14px',
                                            background: 'var(--n-surface)',
                                            borderRadius: '10px',
                                            fontSize: '0.86rem',
                                            color: 'var(--n-text)',
                                            marginBottom: '16px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <i className="bi bi-calendar3" style={{ color: '#3b82f6', width: '16px' }} />
                                                <span style={{ color: 'var(--n-muted, #64748b)', minWidth: '55px' }}>Jadwal:</span>
                                                <span style={{ fontWeight: 600 }}>
                                                    {hari ? hari : 'Sesuai jadwal pembina'}
                                                    {waktuMulai ? `, ${waktuMulai}${waktuSelesai ? ' - ' + waktuSelesai : ''}` : ''}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <i className="bi bi-geo-alt" style={{ color: '#10b981', width: '16px' }} />
                                                <span style={{ color: 'var(--n-muted, #64748b)', minWidth: '55px' }}>Tempat:</span>
                                                <span style={{ fontWeight: 500 }}>
                                                    {tempat || 'Madrasah'}
                                                </span>
                                            </div>

                                            {keterangan && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '2px' }}>
                                                    <i className="bi bi-info-circle" style={{ color: '#f59e0b', width: '16px', marginTop: '2px' }} />
                                                    <span style={{ color: 'var(--n-muted, #64748b)', fontSize: '0.82rem' }}>
                                                        {keterangan}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action footer */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--n-border)' }}>
                                        <Button
                                            type="button"
                                            variant="danger"
                                            onClick={() => handleDeleteSiswaEkskul(item)}
                                            disabled={isDeleting}
                                            icon="delete"
                                            style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                                        >
                                            {isDeleting ? 'Membatalkan...' : 'Batalkan Pilihan'}
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="ps-card" style={{ padding: '60px 24px', textAlign: 'center', borderRadius: '16px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--n-primary, #3b82f6)',
                        fontSize: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}>
                        <i className="bi bi-trophy" />
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--n-text)' }}>
                        Belum Memilih Ekstrakurikuler
                    </h3>
                    <p style={{ margin: '0 auto 24px', maxWidth: '460px', color: 'var(--n-muted, #64748b)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                        Anda belum terdaftar dalam kegiatan ekstrakurikuler pada tahun ajaran ini. Klik tombol di bawah untuk memilih ekstrakurikuler yang Anda minati.
                    </p>
                    <Button
                        variant="primary"
                        icon="add"
                        onClick={openEkskulForm}
                        style={{ padding: '10px 22px', fontSize: '0.95rem' }}
                    >
                        Pilih Ekstrakurikuler Sekarang
                    </Button>
                </div>
            )}

            {/* Modal Pilih Ekskul */}
            <Modal
                open={showEkskulForm}
                onClose={() => setShowEkskulForm(false)}
                size="md"
                variant="add"
            >
                <ModalHeader
                    title="Pilih Ekstrakurikuler"
                    subtitle={`Pendaftaran ekstrakurikuler untuk Tahun Ajaran ${currentYear || 'Aktif'}`}
                    icon="trophy"
                    onClose={() => setShowEkskulForm(false)}
                />
                <form onSubmit={handleSaveSiswaEkskul}>
                    <ModalBody>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', color: 'var(--n-text)' }}>
                                    Nama Ekstrakurikuler <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <Select
                                    styles={selectStyles}
                                    options={availableEkskulList.map(e => ({
                                        value: e.id,
                                        label: e.nama_ekskul,
                                        meta: e
                                    }))}
                                    value={selectedEkskulOption}
                                    onChange={(val) => setSelectedEkskulOption(val as any)}
                                    placeholder="Cari atau pilih ekstrakurikuler..."
                                    noOptionsMessage={() => "Tidak ada ekskul yang tersedia"}
                                    isClearable
                                />
                                {availableEkskulList.length === 0 && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '10px 14px',
                                        background: 'rgba(245, 158, 11, 0.12)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        borderRadius: '8px',
                                        color: isDark ? '#fbbf24' : '#b45309',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <i className="bi bi-info-circle-fill" />
                                        <span>Semua ekstrakurikuler yang tersedia pada periode ini sudah Anda ikuti.</span>
                                    </div>
                                )}
                            </div>

                            {/* Preview detail of selected ekskul */}
                            {selectedEkskulOption?.meta && (
                                <div style={{
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    background: 'var(--n-surface)',
                                    border: '1px solid var(--n-border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    fontSize: '0.88rem',
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--n-primary, #3b82f6)', fontSize: '0.95rem', marginBottom: '2px' }}>
                                        {selectedEkskulOption.meta.nama_ekskul}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--n-text)' }}>
                                        <i className="bi bi-calendar3" style={{ color: '#3b82f6', width: '16px' }} />
                                        <span style={{ color: 'var(--n-muted, #64748b)' }}>Jadwal:</span>
                                        <span>
                                            {selectedEkskulOption.meta.hari || 'Sesuai jadwal pembina'}
                                            {selectedEkskulOption.meta.waktu_mulai ? `, ${formatWaktu(selectedEkskulOption.meta.waktu_mulai)} - ${formatWaktu(selectedEkskulOption.meta.waktu_selesai)}` : ''}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--n-text)' }}>
                                        <i className="bi bi-geo-alt" style={{ color: '#10b981', width: '16px' }} />
                                        <span style={{ color: 'var(--n-muted, #64748b)' }}>Tempat:</span>
                                        <span>{selectedEkskulOption.meta.tempat || 'Madrasah'}</span>
                                    </div>
                                    {selectedEkskulOption.meta.keterangan && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--n-muted, #64748b)', fontSize: '0.82rem', marginTop: '2px' }}>
                                            <i className="bi bi-info-circle" style={{ color: '#f59e0b', width: '16px', marginTop: '2px' }} />
                                            <span>{selectedEkskulOption.meta.keterangan}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{
                                padding: '10px 14px',
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                color: 'var(--n-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <i className="bi bi-check2-circle" style={{ color: '#3b82f6', fontSize: '1rem', flexShrink: 0 }} />
                                <span>Pendaftaran berlaku untuk Tahun Ajaran <strong>{currentYear || 'Aktif'}</strong> (Semester Ganjil dan Genap).</span>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            type="button"
                            variant="cancel"
                            onClick={() => setShowEkskulForm(false)}
                            disabled={savingEkskul}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={savingEkskul}
                            disabled={savingEkskul || !selectedEkskulOption || availableEkskulList.length === 0}
                            icon="save"
                        >
                            Daftar Ekstrakurikuler
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
        </div>
    )
}
