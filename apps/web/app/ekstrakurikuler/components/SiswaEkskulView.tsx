'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getActiveSettings } from '@/lib/settings-client'
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter'
import Swal from 'sweetalert2'
import { swalError, swalWarning } from '@/lib/swal-premium'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalField } from '@/components/ui/Modal'
import { InlineSelect } from '@/components/ui/InlineSelect'
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

export default function SiswaEkskulView({ user }: { user?: any }) {
    const taFilter = useTahunAjaranFilter()
    const selectedTA = taFilter.selected

    const [siswaEkskulList, setSiswaEkskulList] = useState<SiswaEkskul[]>([])
    const [masterEkskulList, setMasterEkskulList] = useState<MasterEkskul[]>([])
    const [ekskulLoading, setEkskulLoading] = useState(true)
    const [isDark, setIsDark] = useState(false)
    
    // Form Modal States
    const [showEkskulForm, setShowEkskulForm] = useState(false)
    const [selectedEkskulId, setSelectedEkskulId] = useState<string>('')
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

    // Selected ekskul metadata for modal preview
    const selectedEkskulMeta = useMemo(() => {
        if (!selectedEkskulId) return null
        return masterMap.get(selectedEkskulId) || availableEkskulList.find(e => e.id === selectedEkskulId) || null
    }, [selectedEkskulId, masterMap, availableEkskulList])

    // Options for InlineSelect
    const ekskulSelectOptions = useMemo(() => {
        if (availableEkskulList.length === 0) {
            return [{ value: '', label: '-- Tidak ada ekskul yang tersedia --', disabled: true }]
        }
        return [
            { value: '', label: '-- Pilih Ekstrakurikuler --' },
            ...availableEkskulList.map(e => ({
                value: e.id,
                label: e.nama_ekskul,
            }))
        ]
    }, [availableEkskulList])

    // Open enrollment modal
    const openEkskulForm = () => {
        setSelectedEkskulId('')
        setShowEkskulForm(true)
    }

    // Save enrollment
    const handleSaveSiswaEkskul = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedEkskulId || !selectedEkskulMeta) {
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
                ekskul_id: selectedEkskulId,
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
                    text: `Anda berhasil terdaftar di ekstrakurikuler ${selectedEkskulMeta.nama_ekskul}.`,
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
                <div className="ps-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--n-primary, #3b82f6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem'
                            }}>
                                <i className="bi bi-award" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--n-text)' }}>
                                Ekstrakurikuler yang Diikuti
                            </h3>
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--n-primary, #3b82f6)'
                            }}>
                                {uniqueEnrolledEkskuls.length} Kegiatan
                            </span>
                        </div>
                        {currentYear && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--n-muted, #64748b)' }}>
                                Periode TA {currentYear}
                            </span>
                        )}
                    </div>

                    <div className="ps-table-container">
                        <table className="ps-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '60px', textAlign: 'center' }}>No</th>
                                    <th>Ekstrakurikuler</th>
                                    <th style={{ minWidth: '180px' }}>Jadwal & Waktu</th>
                                    <th style={{ minWidth: '160px' }}>Tempat</th>
                                    <th style={{ width: '130px', textAlign: 'center' }}>Status</th>
                                    <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uniqueEnrolledEkskuls.map((item, idx) => {
                                    const master = masterMap.get(item.ekskul_id)
                                    const nama = item.nama_ekskul || master?.nama_ekskul || 'Ekstrakurikuler'
                                    const hari = master?.hari || null
                                    const waktuMulai = formatWaktu(master?.waktu_mulai)
                                    const waktuSelesai = formatWaktu(master?.waktu_selesai)
                                    const tempat = master?.tempat || null
                                    const keterangan = master?.keterangan || null
                                    const isDeleting = deleteEkskulId === item.ekskul_id

                                    return (
                                        <tr key={item.ekskul_id}>
                                            <td data-label="No" style={{ textAlign: 'center', fontWeight: 600, color: 'var(--n-muted)' }}>
                                                {idx + 1}
                                            </td>
                                            <td data-label="Ekstrakurikuler">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '38px',
                                                        height: '38px',
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
                                                        <div style={{ fontWeight: 700, color: 'var(--n-text)', fontSize: '0.95rem' }}>
                                                            {nama}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--n-muted, #64748b)' }}>
                                                            Tahun Ajaran {item.tahun_ajaran}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Jadwal & Waktu">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--n-text)', fontSize: '0.88rem' }}>
                                                        <i className="bi bi-calendar3" style={{ color: '#3b82f6', fontSize: '0.85rem' }} />
                                                        <span>{hari || 'Sesuai jadwal pembina'}</span>
                                                    </div>
                                                    {waktuMulai ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--n-muted, #64748b)' }}>
                                                            <i className="bi bi-clock" style={{ fontSize: '0.8rem' }} />
                                                            <span>{waktuMulai}{waktuSelesai ? ` - ${waktuSelesai}` : ''}</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td data-label="Tempat">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--n-text)', fontWeight: 500, fontSize: '0.88rem' }}>
                                                        <i className="bi bi-geo-alt" style={{ color: '#10b981', fontSize: '0.85rem' }} />
                                                        <span>{tempat || 'Madrasah'}</span>
                                                    </div>
                                                    {keterangan && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--n-muted, #64748b)' }}>
                                                            <i className="bi bi-info-circle" style={{ color: '#f59e0b', fontSize: '0.75rem' }} />
                                                            <span>{keterangan}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-label="Status" style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    background: item.aktif !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: item.aktif !== false ? '#10b981' : '#ef4444',
                                                    border: `1px solid ${item.aktif !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                                                    {item.aktif !== false ? 'Terdaftar' : 'Nonaktif'}
                                                </span>
                                            </td>
                                            <td data-label="Aksi" style={{ textAlign: 'center' }}>
                                                <Button
                                                    type="button"
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => handleDeleteSiswaEkskul(item)}
                                                    disabled={isDeleting}
                                                    icon="delete"
                                                    style={{ fontSize: '0.82rem', padding: '5px 12px' }}
                                                >
                                                    {isDeleting ? 'Membatalkan...' : 'Batalkan'}
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
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
                            <ModalField label="Nama Ekstrakurikuler" required>
                                <InlineSelect
                                    value={selectedEkskulId}
                                    onChange={setSelectedEkskulId}
                                    minWidth="100%"
                                    height="40px"
                                    options={ekskulSelectOptions}
                                    disabled={availableEkskulList.length === 0}
                                    title="Pilih Ekstrakurikuler"
                                    style={{ width: '100%' }}
                                />
                            </ModalField>

                            {availableEkskulList.length === 0 && (
                                <div style={{
                                    marginTop: '-4px',
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

                            {/* Preview detail of selected ekskul */}
                            {selectedEkskulMeta && (
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
                                        {selectedEkskulMeta.nama_ekskul}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--n-text)' }}>
                                        <i className="bi bi-calendar3" style={{ color: '#3b82f6', width: '16px' }} />
                                        <span style={{ color: 'var(--n-muted, #64748b)' }}>Jadwal:</span>
                                        <span>
                                            {selectedEkskulMeta.hari || 'Sesuai jadwal pembina'}
                                            {selectedEkskulMeta.waktu_mulai ? `, ${formatWaktu(selectedEkskulMeta.waktu_mulai)} - ${formatWaktu(selectedEkskulMeta.waktu_selesai)}` : ''}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--n-text)' }}>
                                        <i className="bi bi-geo-alt" style={{ color: '#10b981', width: '16px' }} />
                                        <span style={{ color: 'var(--n-muted, #64748b)' }}>Tempat:</span>
                                        <span>{selectedEkskulMeta.tempat || 'Madrasah'}</span>
                                    </div>
                                    {selectedEkskulMeta.keterangan && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--n-muted, #64748b)', fontSize: '0.82rem', marginTop: '2px' }}>
                                            <i className="bi bi-info-circle" style={{ color: '#f59e0b', width: '16px', marginTop: '2px' }} />
                                            <span>{selectedEkskulMeta.keterangan}</span>
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
                            disabled={savingEkskul || !selectedEkskulId || availableEkskulList.length === 0}
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
