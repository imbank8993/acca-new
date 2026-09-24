"use client"

import React, { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import DatePicker from '@/components/ui/DatePicker'
import { FilterToolbar, FilterField, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar'
import { Button } from '@/components/ui/Button'
import { ActionButton } from '@/components/ui/ActionButtons'
import { Spinner } from '@/components/ui/Spinner'

interface KokurikulerSiswaProps { user?: any }

export default function KokurikulerSiswaPage({ user }: KokurikulerSiswaProps) {
    const roles: string[] = (user?.roles || []).map((r: string) => String(r).toUpperCase())
    const isOrangTua = roles.includes('ORANG_TUA') || user?.role === 'ORANG_TUA'
    const selfNisn: string = isOrangTua ? '' : (user?.nisn || user?.nip || user?.username || '')

    const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0])
    const [masterList, setMasterList] = useState<any[]>([])
    const [checklist, setChecklist] = useState<any[]>([])
    const [customs, setCustoms] = useState<{ id: number, nama_kegiatan: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [anakList, setAnakList] = useState<{ nisn: string, nama: string }[]>([])
    const [selectedNisn, setSelectedNisn] = useState<string>(selfNisn)

    const activeNisn = isOrangTua ? selectedNisn : selfNisn

    useEffect(() => {
        fetchMaster()
        if (isOrangTua) fetchAnak()
    }, [])

    useEffect(() => {
        if (activeNisn && tanggal) fetchLog()
        else setLoading(false)
    }, [tanggal, activeNisn])

    const fetchAnak = async () => {
        try {
            const res = await fetch('/api/orangtua/anak')
            const json = await res.json()
            if (json.ok && Array.isArray(json.data)) {
                const mapped = json.data.map((d: any) => ({ nisn: d.nisn, nama: d.nama_lengkap }))
                setAnakList(mapped)
                if (mapped.length === 1) setSelectedNisn(mapped[0].nisn)
            }
        } catch (e) {
            console.error(e)
        }
    }

    const fetchMaster = async () => {
        try {
            const res = await fetch('/api/kokurikuler/master?aktif=true')
            const json = await res.json()
            if (json.ok) setMasterList(json.data)
        } catch (e) {
            console.error(e)
        }
    }

    const fetchLog = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/kokurikuler/siswa?nisn=${encodeURIComponent(activeNisn)}&tanggal=${tanggal}`)
            const json = await res.json()
            if (json.ok) {
                const logs = json.data
                const checked = logs.filter((l: any) => !l.is_custom).map((l: any) => ({ kegiatan_id: l.kegiatan_id, nama_kegiatan: l.nama_kegiatan, status: l.status }))
                const csts = logs.filter((l: any) => l.is_custom).map((l: any, i: number) => ({ id: i, nama_kegiatan: l.nama_kegiatan, status: l.status }))
                
                setChecklist(checked)
                setCustoms(csts)
            }
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const handleCheck = (m: any) => {
        const exist = checklist.find(c => c.kegiatan_id === m.id)
        if (exist) {
            setChecklist(checklist.filter(c => c.kegiatan_id !== m.id))
        } else {
            setChecklist([...checklist, { kegiatan_id: m.id, nama_kegiatan: m.nama_kegiatan, status: 'Pending' }])
        }
    }

    const addCustom = () => {
        setCustoms([...customs, { id: Date.now(), nama_kegiatan: '' }])
    }

    const updateCustom = (id: number, val: string) => {
        setCustoms(customs.map(c => c.id === id ? { ...c, nama_kegiatan: val } : c))
    }

    const removeCustom = (id: number) => {
        setCustoms(customs.filter(c => c.id !== id))
    }

    const submitData = async () => {
        if (!activeNisn) {
            Swal.fire({ icon: 'warning', title: 'Pilih siswa', text: 'Silakan pilih anak terlebih dahulu.' })
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/kokurikuler/siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nisn: activeNisn,
                    tanggal,
                    checklist,
                    customs
                })
            })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Catatan kokurikuler berhasil disimpan' })
                fetchLog()
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error })
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan' })
        }
        setSaving(false)
    }

    const [searchQuery, setSearchQuery] = useState('')

    const filteredMasterList = useMemo(() => {
        if (!searchQuery.trim()) return masterList
        const q = searchQuery.toLowerCase().trim()
        return masterList.filter(m => (m.nama_kegiatan || '').toLowerCase().includes(q) || (m.kategori || '').toLowerCase().includes(q))
    }, [masterList, searchQuery])

    const groupedMaster: Record<string, any[]> = useMemo(() => {
        const map: Record<string, any[]> = {}
        filteredMasterList.forEach(m => {
            const cat = m.kategori || 'Lainnya'
            if (!map[cat]) map[cat] = []
            map[cat].push(m)
        })
        return map
    }, [filteredMasterList])

    return (
        <div className="kk__container">
            <FilterToolbar style={{ marginBottom: '20px' }}>
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari kegiatan..."
                />
                {isOrangTua && (
                    <FilterSelect
                        label="Pilih Anak"
                        icon="person"
                        value={selectedNisn}
                        onChange={setSelectedNisn}
                        options={anakList.map(a => ({ value: a.nisn, label: `${a.nama} (${a.nisn})` }))}
                        width="240px"
                    />
                )}
                <FilterField label="Tanggal Kegiatan" icon="calendar-event" bare width="200px">
                    <DatePicker value={tanggal} onChange={setTanggal} />
                </FilterField>
            </FilterToolbar>

            <div className="kk__card">
                {!activeNisn ? (
                    <div className="kk__loading">
                        {isOrangTua ? 'Pilih anak untuk mulai mencatat kegiatan.' : 'NISN tidak ditemukan. Hubungi administrator.'}
                    </div>
                ) : loading ? (
                    <div className="kk__loading"><Spinner size={28} /></div>
                ) : (
                    <>
                        <div className="kk__masterList">
                            {Object.keys(groupedMaster).map(cat => (
                                <div key={cat} className="kk__catGroup">
                                    <h3>{cat}</h3>
                                    <div className="kk__items">
                                        {groupedMaster[cat].map(m => {
                                            const isChecked = checklist.some(c => c.kegiatan_id === m.id)
                                            const itemStatus = checklist.find(c => c.kegiatan_id === m.id)?.status
                                            return (
                                                <label key={m.id} className={`kk__item ${isChecked ? 'active' : ''}`}>
                                                    <input type="checkbox" checked={isChecked} onChange={() => handleCheck(m)} />
                                                    <span className="kk__checkIcon"><i className="bi bi-check" /></span>
                                                    <span className="kk__text">{m.nama_kegiatan}</span>
                                                    {itemStatus && itemStatus !== 'Pending' && (
                                                        <span className={`kk__statusBadge ${itemStatus === 'Disetujui' ? 'st-ok' : 'st-err'}`}>{itemStatus}</span>
                                                    )}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="kk__customs">
                            <h3>Kegiatan Lainnya (Opsional)</h3>
                            <p>Tambahkan kegiatan positif lain yang tidak ada di atas.</p>
                            
                            <div className="kk__customList">
                                {customs.map((c) => (
                                    <div key={c.id} className="kk__customItem">
                                        <input 
                                            type="text" 
                                            placeholder="Contoh: Membantu membersihkan masjid" 
                                            value={c.nama_kegiatan} 
                                            onChange={e => updateCustom(c.id, e.target.value)} 
                                        />
                                        <ActionButton action="delete" size="sm" onClick={() => removeCustom(c.id)} label="Hapus" />
                                        {(c as any).status && (c as any).status !== 'Pending' && (
                                            <span className={`kk__statusBadge ${(c as any).status === 'Disetujui' ? 'st-ok' : 'st-err'}`}>{(c as any).status}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <Button variant="outline" size="sm" onClick={addCustom} leftIcon={<i className="bi bi-plus-lg" />}>
                                Tambah Kegiatan
                            </Button>
                        </div>
                        
                        <div className="kk__actions" style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
                            <Button variant="primary" size="lg" onClick={submitData} isLoading={saving} leftIcon={<i className="bi bi-save" />}>
                                Simpan Catatan
                            </Button>
                        </div>
                    </>
                )}
            </div>

            <style jsx>{`
                .kk__container { width: 100%; padding: 0; font-family: 'Inter', sans-serif; }
                .kk__card { background: #fff; border-radius: 20px; padding: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.02); }
                
                .kk__catGroup { margin-bottom: 25px; }
                .kk__catGroup h3 { font-size: 1.05rem; font-weight: 700; color: #475569; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
                .kk__items { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
                
                .kk__item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 1.5px solid #f1f5f9; cursor: pointer; transition: all 0.2s; position: relative; }
                .kk__item:hover { border-color: #cbd5e1; background: #f8fafc; }
                .kk__item.active { border-color: #3b82f6; background: rgba(59, 130, 246, 0.04); }
                .kk__item input { display: none; }
                
                .kk__checkIcon { width: 24px; height: 24px; border-radius: 8px; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; color: transparent; transition: all 0.2s; flex-shrink: 0; }
                .kk__item.active .kk__checkIcon { background: #3b82f6; border-color: #3b82f6; color: #fff; }
                
                .kk__text { font-size: 0.95rem; font-weight: 600; color: #334155; flex: 1; }
                
                .kk__statusBadge { font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
                .st-ok { background: #dcfce7; color: #16a34a; }
                .st-err { background: #fee2e2; color: #dc2626; }
                
                .kk__customs { margin-top: 30px; padding-top: 25px; border-top: 1.5px dashed #e2e8f0; }
                .kk__customs h3 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
                .kk__customs p { color: #64748b; font-size: 0.85rem; margin-bottom: 16px; }
                
                .kk__customList { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
                .kk__customItem { display: flex; align-items: center; gap: 10px; }
                .kk__customItem input { flex: 1; padding: 12px 16px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 0.95rem; outline: none; transition: all 0.2s; }
                .kk__customItem input:focus { border-color: #3b82f6; }
                
                .kk__loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: #64748b; font-weight: 600; }

                @media (max-width: 640px) {
                    .kk__items { grid-template-columns: 1fr; }
                    .kk__card { padding: 20px; border-radius: 16px; }
                }

                :global(.dark) .kk__card {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .kk__catGroup h3 {
                    color: #ffffff !important;
                    border-bottom-color: rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .kk__item { border-color: rgba(26, 115, 232, 0.25) !important; }
                :global(.dark) .kk__item:hover {
                    background: rgba(26, 115, 232, 0.12) !important;
                    border-color: rgba(96, 165, 250, 0.5) !important;
                }
                :global(.dark) .kk__item.active {
                    border-color: #60a5fa !important;
                    background: rgba(96, 165, 250, 0.18) !important;
                }
                :global(.dark) .kk__item.active .kk__text { color: #60a5fa !important; }
                :global(.dark) .kk__text { color: #ffffff !important; }
                :global(.dark) .kk__customs { border-top-color: rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .kk__customs h3 { color: #ffffff !important; }
                :global(.dark) .kk__customs p { color: #94a3b8 !important; }
                :global(.dark) .kk__customItem input {
                    background: #000000 !important;
                    border: 2.2px solid #1d6bf3 !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                }
                :global(.dark) .kk__loading { color: #94a3b8 !important; }
            `}</style>
        </div>
    )
}
