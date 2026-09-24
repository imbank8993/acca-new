'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { getActiveSettings } from '@/lib/settings-client'
import Swal from 'sweetalert2'
import { swalError, swalWarning } from '@/lib/swal-premium'
import Select from 'react-select'
import { Spinner } from '@/components/ui/Spinner'

interface SiswaEkskul {
    id: string
    ekskul_id: string
    siswa_id: string
    tahun_ajaran: string
    semester: number
    aktif: boolean
    nama_ekskul?: string
}

interface EkskulOption {
    id: string
    nama_ekskul: string
}

export default function SiswaEkskulView() {
    const [siswaEkskulList, setSiswaEkskulList] = useState<SiswaEkskul[]>([])
    const [ekskulLoading, setEkskulLoading] = useState(false)
    
    // Form States
    const [showEkskulForm, setShowEkskulForm] = useState(false)
    const [availableEkskul, setAvailableEkskul] = useState<EkskulOption[]>([])
    const [selectedEkskulOption, setSelectedEkskulOption] = useState<{ value: string; label: string } | null>(null)
    const [savingEkskul, setSavingEkskul] = useState(false)
    const [deletingEkskul, setDeletingEkskul] = useState(false)
    const [deleteEkskulId, setDeleteEkskulId] = useState<string | null>(null)
    const [ekskulTA, setEkskulTA] = useState('')
    const [ekskulSemester, setEkskulSemester] = useState(1)

    useEffect(() => {
        fetchSiswaEkskul()
    }, [])

    const fetchSiswaEkskul = async () => {
        setEkskulLoading(true)
        try {
            const active = await getActiveSettings()
            const activeTA = active?.tahun_ajaran ?? ''
            const res = await fetch(`/api/ekskul/siswa?tahun_ajaran=${encodeURIComponent(activeTA)}`)
            const json = await res.json()
            if (json.ok) setSiswaEkskulList(json.data || [])
        } catch (e) { console.error(e) }
        finally { setEkskulLoading(false) }
    }

    const uniqueEkskuls = useMemo(() => {
        const map = new Map<string, SiswaEkskul>()
        siswaEkskulList.forEach(e => {
            if (!map.has(e.ekskul_id)) map.set(e.ekskul_id, e)
        })
        return Array.from(map.values())
    }, [siswaEkskulList])

    const openEkskulForm = async () => {
        setSelectedEkskulOption(null)
        setShowEkskulForm(true)
        const active = await getActiveSettings()
        const activeTA = active?.tahun_ajaran ?? ''
        setEkskulTA(activeTA)
        try {
            const res = await fetch(`/api/ekskul?tahun_ajaran=${encodeURIComponent(activeTA)}&aktif=true`)
            const json = await res.json()
            if (json.ok) {
                const taken = new Set(siswaEkskulList.map(e => e.ekskul_id))
                setAvailableEkskul(json.data.filter((e: any) => !taken.has(e.id)))
            }
        } catch (e) { console.error(e) }
    }

    const handleSaveSiswaEkskul = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedEkskulOption) { swalWarning('Peringatan', 'Pilih ekstrakurikuler terlebih dahulu!'); return }
        setSavingEkskul(true)
        try {
            const payloadBase = {
                ekskul_id: selectedEkskulOption.value,
                tahun_ajaran: ekskulTA,
                aktif: true,
            }
            const res1 = await fetch('/api/ekskul/siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payloadBase, semester: 1 }),
            })
            const res2 = await fetch('/api/ekskul/siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payloadBase, semester: 2 }),
            })
            
            const json1 = await res1.json()
            const json2 = await res2.json()
            
            if (!res1.ok || !res2.ok) { 
                swalError('Gagal', (json1.error || '') + ' ' + (json2.error || 'Gagal menyimpan')) 
            } else {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Ekstrakurikuler berhasil disimpan.', timer: 2000, showConfirmButton: false, confirmButtonColor: '#10b981' })
                setShowEkskulForm(false)
                fetchSiswaEkskul()
            }
        } catch (e: any) { swalError('Error', e.message) }
        finally { setSavingEkskul(false) }
    }

    const handleDeleteSiswaEkskul = async (item: SiswaEkskul) => {
        setDeleteEkskulId(item.ekskul_id)
        const c = await Swal.fire({
            title: 'Hapus Ekskul?', html: `<p>Hapus <strong>${item.nama_ekskul || 'ekskul'}</strong> dari ekstrakurikuler Anda?</p>`,
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
        })
        if (!c.isConfirmed) { setDeleteEkskulId(null); return }
        setDeletingEkskul(true)
        try {
            const recordsToDelete = siswaEkskulList.filter(e => e.ekskul_id === item.ekskul_id)
            let success = true
            for (const record of recordsToDelete) {
                const res = await fetch(`/api/ekskul/siswa?id=${record.id}`, { method: 'DELETE' })
                const json = await res.json()
                if (!json.ok) success = false
            }
            if (success) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Ekstrakurikuler berhasil dihapus.', timer: 2000, showConfirmButton: false, confirmButtonColor: '#10b981' })
                fetchSiswaEkskul()
            } else { swalError('Gagal', 'Beberapa data gagal dihapus') }
        } catch (e: any) { swalError('Error', e.message) }
        finally { setDeleteEkskulId(null); setDeletingEkskul(false) }
    }

    return (
        <div className="ps-card ekp-scope" style={{ maxWidth: 800, margin: '0 auto', background: 'var(--n-card)', padding: '24px', borderRadius: '16px', marginTop: '24px' }}>
            <div className="ps-tab-header-flex">
                <div className="ps-tab-titles">
                    <h2 className="ps-tab-title" style={{ color: 'var(--n-text)' }}>Ekstrakurikuler</h2>
                    <p className="ps-tab-desc">Pilih ekstrakurikuler yang Anda ikuti.</p>
                </div>
                <button type="button" className="ps-btn ps-btn-primary" onClick={openEkskulForm}>
                    <i className="bi bi-plus-circle"></i> Pilih Ekskul
                </button>
            </div>

            <div className="ps-ekskul-grid" style={{ marginTop: '24px' }}>
                {ekskulLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', justifyContent: 'center' }}><Spinner size={24} /></div>
                ) : uniqueEkskuls.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {uniqueEkskuls.map((item) => (
                            <div key={item.ekskul_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--n-surface)', border: '1px solid var(--n-border)', borderRadius: '12px' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: 600, color: 'var(--n-primary)' }}>{item.nama_ekskul}</h4>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                                        Tahun Ajaran {item.tahun_ajaran}
                                    </div>
                                </div>
                                <div>
                                    <button 
                                        type="button" 
                                        className="ps-btn ps-btn-outline" 
                                        style={{ color: '#ef4444', borderColor: '#ef4444' }} 
                                        onClick={() => handleDeleteSiswaEkskul(item)} 
                                        disabled={deleteEkskulId === item.ekskul_id}
                                    >
                                        {deleteEkskulId === item.ekskul_id ? <Spinner size={16} /> : <><i className="bi bi-trash"></i> Hapus</>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--n-border)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem' }}><i className="bi bi-award"></i></div>
                        <h3 style={{ margin: '0 0 0.5rem', color: 'var(--n-text)' }}>Belum Ada Ekstrakurikuler</h3>
                        <p style={{ margin: 0, color: '#64748b' }}>Klik "Pilih Ekskul" untuk menambahkan ekstrakurikuler yang Anda ikuti.</p>
                    </div>
                )}
            </div>

            {/* Modal Pilih Ekskul */}
            {showEkskulForm && (
                <div className="ps-modal-overlay">
                    <div className="ps-modal">
                        <form onSubmit={handleSaveSiswaEkskul}>
                            <h3 style={{ margin: '0 0 20px', color: 'var(--n-text)' }}><i className="bi bi-list-task"></i> Pilih Ekstrakurikuler</h3>
                            
                            <div className="ps-form-group">
                                <label className="required-label">Ekstrakurikuler</label>
                                <Select
                                    options={availableEkskul.map(e => ({ value: e.id, label: e.nama_ekskul }))}
                                    value={selectedEkskulOption}
                                    onChange={(val) => setSelectedEkskulOption(val as any)}
                                    placeholder="Pilih ekstrakurikuler..."
                                    noOptionsMessage={() => "Tidak ada ekskul tersedia"}
                                    isClearable
                                />
                                {availableEkskul.length === 0 && (
                                    <small style={{ color: '#f59e0b', marginTop: '8px', display: 'block' }}>
                                        <i className="bi bi-info-circle"></i> Semua ekstrakurikuler yang tersedia sudah Anda ikuti.
                                    </small>
                                )}
                            </div>
                            
                            <div className="ps-modal-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" className="ps-btn ps-btn-outline" onClick={() => setShowEkskulForm(false)} disabled={savingEkskul}>Batal</button>
                                <button type="submit" className="ps-btn ps-btn-primary" disabled={savingEkskul || availableEkskul.length === 0}>
                                    {savingEkskul ? <Spinner size={16} /> : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style jsx>{`
                .ps-tab-header-flex { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
                .ps-tab-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
                .ps-tab-desc { margin: 0; color: var(--n-text-muted); font-size: 0.95rem; }
                .ps-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
                .ps-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .ps-btn-primary { background: linear-gradient(135deg, var(--n-primary) 0%, #002b80 100%); color: white; box-shadow: 0 4px 12px rgba(0, 56, 168, 0.2); }
                .ps-btn-outline { background: transparent; border: 1.5px solid var(--n-border); color: var(--n-text); }
                .ps-btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0, 56, 168, 0.3); }
                .ps-form-group { margin-bottom: 20px; }
                .ps-form-group label { display: block; font-weight: 600; color: var(--n-text-strong); margin-bottom: 8px; font-size: 0.9rem; }
                .required-label::after { content: '*'; color: #ef4444; margin-left: 4px; }
                
                .ps-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; }
                .ps-modal { background: var(--n-card); width: 100%; max-width: 500px; border-radius: 20px; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
        </div>
    )
}
