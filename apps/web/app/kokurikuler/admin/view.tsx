"use client"

import React, { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import DatePicker from '@/components/ui/DatePicker'
import Tab from '@/components/ui/Tab'
import { FilterToolbar, FilterField, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar'
import { Button } from '@/components/ui/Button'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'

interface KokurikulerAdminProps {
    user?: any
    isAdmin?: boolean
    /** Jabatan tugas tambahan, mis. "Koordinator Kokurikuler Kelas XI" */
    koordinatorJabatan?: string
    initialTab?: 'master' | 'laporan'
}

const getTodayStr = () => new Date().toLocaleDateString('en-CA')

export default function KokurikulerAdminPage({ user, isAdmin = false, koordinatorJabatan = '', initialTab }: KokurikulerAdminProps) {
    const [activeTab, setActiveTab] = useState<'master' | 'laporan'>(initialTab || 'master')

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab)
        }
    }, [initialTab])

    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => { setSearchQuery('') }, [activeTab])
    
    // Master States
    const [masterList, setMasterList] = useState<any[]>([])
    const [loadingMaster, setLoadingMaster] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState<any>(null)
    const [formData, setFormData] = useState({ nama_kegiatan: '', kategori: 'Ibadah', aktif: true })
    const [savingMaster, setSavingMaster] = useState(false)

    // Laporan States
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toLocaleDateString('en-CA')
    })
    const [endDate, setEndDate] = useState(getTodayStr)
    const [summary, setSummary] = useState<any[]>([])
    const [loadingLaporan, setLoadingLaporan] = useState(false)
    const [kelasList, setKelasList] = useState<{ id: number; nama: string }[]>([])

    const kelasFilter = (!isAdmin && koordinatorJabatan.toLowerCase().includes('kelas'))
        ? (koordinatorJabatan.trim().split(/\s+/).pop() || '')
        : ''

    const [selectedKelas, setSelectedKelas] = useState<string>(kelasFilter || '')

    useEffect(() => {
        if (isAdmin) {
            fetch('/api/master/kelas?limit=200')
                .then(res => res.json())
                .then(json => {
                    if (json.ok && Array.isArray(json.data)) {
                        setKelasList(json.data.filter((k: any) => k.program === 'Reguler'))
                    }
                })
                .catch(() => {})
        }
    }, [isAdmin])

    const filteredMasterList = useMemo(() => {
        if (!searchQuery.trim()) return masterList
        const q = searchQuery.toLowerCase().trim()
        return masterList.filter(m => (m.nama_kegiatan || '').toLowerCase().includes(q) || (m.kategori || '').toLowerCase().includes(q))
    }, [masterList, searchQuery])

    const filteredSummary = useMemo(() => {
        if (!searchQuery.trim()) return summary
        const q = searchQuery.toLowerCase().trim()
        return summary.filter(s => (s.name || '').toLowerCase().includes(q))
    }, [summary, searchQuery])

    useEffect(() => {
        if (activeTab === 'master') fetchMaster()
        else fetchLaporan()
    }, [activeTab, startDate, endDate, selectedKelas])

    // --- MASTER DATA LOGIC ---
    const fetchMaster = async () => {
        setLoadingMaster(true)
        try {
            const res = await fetch('/api/kokurikuler/master')
            const json = await res.json()
            if (json.ok) setMasterList(json.data || [])
        } catch (e) {}
        setLoadingMaster(false)
    }

    const handleSaveMaster = async () => {
        if (!formData.nama_kegiatan.trim()) {
            Swal.fire({ icon: 'warning', title: 'Nama Kegiatan Kosong', text: 'Nama kegiatan wajib diisi.' })
            return
        }

        setSavingMaster(true)
        try {
            const method = editItem ? 'PUT' : 'POST'
            const payload = editItem ? { ...formData, id: editItem.id } : formData
            const res = await fetch('/api/kokurikuler/master', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const json = await res.json()
            if (json.ok) {
                setShowModal(false)
                fetchMaster()
                Swal.fire({ icon: 'success', title: 'Berhasil', timer: 1500, showConfirmButton: false })
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: json.error || 'Terjadi kesalahan' })
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: e?.message || 'Terjadi kesalahan sistem' })
        }
        finally { setSavingMaster(false) }
    }

    const handleDeleteMaster = async (id: string) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Hapus Kegiatan?',
            text: 'Data yang terhapus tidak dapat dikembalikan. Jika kegiatan sudah memiliki riwayat log siswa, kegiatan sebaiknya dinonaktifkan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Hapus',
            cancelButtonText: 'Batal'
        })
        if (isConfirmed) {
            try {
                const res = await fetch(`/api/kokurikuler/master?id=${id}`, { method: 'DELETE' })
                const json = await res.json()
                if (json.ok) {
                    fetchMaster()
                    Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Kegiatan berhasil dihapus.', timer: 1500, showConfirmButton: false })
                } else {
                    Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: json.error || 'Terjadi kesalahan' })
                }
            } catch (e: any) {
                Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: e?.message || 'Terjadi kesalahan sistem' })
            }
        }
    }

    // --- LAPORAN LOGIC ---
    const fetchLaporan = async () => {
        setLoadingLaporan(true)
        try {
            const activeKelas = (!isAdmin && kelasFilter) ? kelasFilter : selectedKelas
            const res = await fetch(`/api/kokurikuler/laporan?start_date=${startDate}&end_date=${endDate}&kelas=${encodeURIComponent(activeKelas)}`)
            const json = await res.json()
            if (json.ok) setSummary(json.summary || [])
        } catch (e) {}
        setLoadingLaporan(false)
    }

    const openAddMaster = () => {
        setEditItem(null)
        setFormData({ nama_kegiatan: '', kategori: 'Ibadah', aktif: true })
        setShowModal(true)
    }

    return (
        <div className="ka__container">
            {!initialTab && (
                <Tab
                    variant="slider"
                    activeTab={activeTab}
                    onChange={(t) => setActiveTab(t as any)}
                    tabs={[
                        { key: 'master', label: 'Master Kegiatan', icon: 'bi-list-check' },
                        { key: 'laporan', label: 'Laporan & Tren', icon: 'bi-pie-chart' }
                    ]}
                    style={{ marginBottom: '16px' }}
                />
            )}

            {activeTab === 'master' && (
                <>
                    <FilterToolbar style={{ marginBottom: '16px' }}>
                        <FilterSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Cari kegiatan atau kategori..."
                        />
                    </FilterToolbar>
                    <div className="ka__content">
                        {loadingMaster ? <div className="ka__loading"><Spinner size={32} /></div> : (
                            <table className="ka__table">
                                <thead>
                                    <tr>
                                        <th>Kegiatan</th>
                                        <th>Kategori</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMasterList.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--n-muted)' }}>{masterList.length === 0 ? 'Belum ada data kegiatan.' : 'Tidak ditemukan kegiatan yang sesuai pencarian.'}</td></tr>
                                    ) : filteredMasterList.map(m => (
                                        <tr key={m.id}>
                                            <td style={{ fontWeight: 600 }}>{m.nama_kegiatan}</td>
                                            <td><span className="ka__catBadge">{m.kategori}</span></td>
                                            <td>
                                                <span className={`ka__statusBadge ${m.aktif ? 'st-aktif' : 'st-nonaktif'}`}>
                                                    {m.aktif ? 'Aktif' : 'Nonaktif'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <ActionGroup align="center">
                                                    <ActionButton action="edit" size="sm" onClick={() => { setEditItem(m); setFormData({ nama_kegiatan: m.nama_kegiatan, kategori: m.kategori || 'Ibadah', aktif: m.aktif ?? true }); setShowModal(true) }} label="Edit" />
                                                    <ActionButton action="delete" size="sm" onClick={() => handleDeleteMaster(m.id)} label="Hapus" />
                                                </ActionGroup>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'laporan' && (
                <>
                    <FilterToolbar style={{ marginBottom: '16px' }}>
                        <FilterSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Cari kegiatan..."
                        />
                        {isAdmin && (
                            <FilterSelect
                                label="Kelas"
                                icon="door-open"
                                value={selectedKelas}
                                onChange={setSelectedKelas}
                                options={[
                                    { value: '', label: 'Semua Kelas' },
                                    ...kelasList.map(k => ({ value: k.nama, label: `Kelas ${k.nama}` }))
                                ]}
                                width="170px"
                            />
                        )}
                        <FilterField label="Dari Tanggal" icon="calendar-event" bare width="200px">
                            <DatePicker value={startDate} onChange={setStartDate} max={endDate} />
                        </FilterField>
                        <FilterField label="Sampai Tanggal" icon="calendar-event" bare width="200px">
                            <DatePicker value={endDate} onChange={setEndDate} min={startDate} />
                        </FilterField>
                    </FilterToolbar>
                    <div className="ka__content">
                        {loadingLaporan ? <div className="ka__loading"><Spinner size={32} /></div> : (
                            <div className="ka__chartWrap">
                                <div className="ka__statsGrid">
                                    {filteredSummary.slice(0,4).map((s, i) => (
                                        <div key={i} className="ka__statCard">
                                            <div className="ka__statRank">#{i+1}</div>
                                            <div className="ka__statName">{s.name}</div>
                                            <div className="ka__statCount">{s.count} <small>kali dilakukan</small></div>
                                        </div>
                                    ))}
                                </div>
                                
                                <table className="ka__table mt-4">
                                    <thead>
                                        <tr>
                                            <th>Nama Kegiatan</th>
                                            <th style={{ textAlign: 'right' }}>Total Dilakukan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSummary.length === 0 ? (
                                            <tr><td colSpan={2} style={{ textAlign: 'center', padding: '30px', color: 'var(--n-muted)' }}>{summary.length === 0 ? 'Belum ada data laporan.' : 'Tidak ditemukan laporan yang sesuai pencarian.'}</td></tr>
                                        ) : filteredSummary.map(s => (
                                            <tr key={s.name}>
                                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                                <td style={{ textAlign: 'right' }}>{s.count} kali</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'master' && (
                <>
                    <DesktopFab label="Tambah Kegiatan" icon="plus-lg" onClick={openAddMaster} />
                    <MobileFab label="Tambah Kegiatan" icon="plus-lg" onClick={openAddMaster} />
                </>
            )}

            {/* Modal Master */}
            {showModal && (
                <Modal onClose={() => setShowModal(false)} size="md">
                    <ModalHeader
                        title={editItem ? 'Edit Kegiatan' : 'Tambah Kegiatan Baru'}
                        icon={editItem ? 'pencil-square' : 'plus-circle'}
                        onClose={() => setShowModal(false)}
                    />
                    <ModalBody>
                        <div className="ka__formGroup" style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>Nama Kegiatan</label>
                            <input 
                                type="text" 
                                value={formData.nama_kegiatan} 
                                onChange={e => setFormData({...formData, nama_kegiatan: e.target.value})} 
                                placeholder="Contoh: Shalat Dhuha" 
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)' }}
                            />
                        </div>
                        
                        <div className="ka__formGroup" style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>Kategori</label>
                            <select 
                                value={formData.kategori} 
                                onChange={e => setFormData({...formData, kategori: e.target.value})}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--n-border)' }}
                            >
                                <option value="Ibadah">Ibadah</option>
                                <option value="Akademik">Akademik</option>
                                <option value="Sosial & Kebersihan">Sosial & Kebersihan</option>
                                <option value="Lainnya">Lainnya</option>
                            </select>
                        </div>
                        
                        <div className="ka__formGroup">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                <input 
                                    type="checkbox" 
                                    checked={formData.aktif} 
                                    onChange={e => setFormData({...formData, aktif: e.target.checked})} 
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--n-primary)' }} 
                                />
                                Aktifkan Kegiatan
                            </label>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => setShowModal(false)}>Batal</Button>
                        <Button variant="primary" onClick={handleSaveMaster} isLoading={savingMaster}>Simpan</Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .ka__container { width: 100%; padding: 0; font-family: 'Inter', sans-serif; }

                /* Topbar: segmented tabs kiri + badge user kanan (satu baris ringkas) */
                .ka__topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
                .ka__tabs { display: inline-flex; gap: 4px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; }
                .ka__tab { display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; border: none; border-radius: 9px; background: transparent; font-weight: 700; font-size: 0.85rem; color: #64748b; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .ka__tab:hover { color: #334155; }
                .ka__tab.active { background: #fff; color: #3083FF; box-shadow: 0 1px 4px rgba(15,23,42,0.1); }

                .ka__content { background: #fff; border-radius: 16px; padding: 25px; box-shadow: 0 5px 20px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
                
                .ka__toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .ka__toolbar h3 { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin: 0; }
                .ka__btnAdd { background: #3b82f6; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
                .ka__btnAdd:hover { background: #3083FF; }

                .ka__filters { display: flex; align-items: center; gap: 10px; }
                .ka__filters input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; font-family: inherit; font-weight: 500; }

                .ka__table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                .ka__table th { text-align: left; padding: 12px 16px; border-bottom: 2px solid #f1f5f9; color: #64748b; font-weight: 600; }
                .ka__table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
                
                .ka__catBadge { background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; }
                .ka__statusBadge { padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; }
                .st-aktif { background: #dcfce7; color: #16a34a; }
                .st-nonaktif { background: #f1f5f9; color: #94a3b8; }
                
                .ka__btnIcon { background: none; border: none; font-size: 1.1rem; color: #64748b; cursor: pointer; padding: 4px; border-radius: 6px; transition: all 0.2s; }
                .ka__btnIcon:hover { background: #f1f5f9; color: #3b82f6; }
                .ka__btnIcon.text-red:hover { color: #ef4444; }

                .ka__modalOverlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; }
                .ka__modal { background: #fff; width: 100%; max-width: 450px; border-radius: 16px; padding: 25px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                .ka__modal h3 { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
                
                .ka__formGroup { margin-bottom: 16px; }
                .ka__formGroup label { display: block; font-size: 0.9rem; font-weight: 600; color: #475569; margin-bottom: 6px; }
                .ka__formGroup input[type="text"], .ka__formGroup select { width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-family: inherit; font-size: 0.95rem; outline: none; }
                .ka__formGroup input:focus, .ka__formGroup select:focus { border-color: #3b82f6; }
                
                .ka__modalActions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
                .ka__btnCancel { padding: 10px 20px; background: #f1f5f9; border: none; border-radius: 10px; font-weight: 600; color: #475569; cursor: pointer; }
                .ka__btnSave { padding: 10px 20px; background: #3b82f6; border: none; border-radius: 10px; font-weight: 600; color: #fff; cursor: pointer; }

                .ka__statsGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
                .ka__statCard { background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; position: relative; overflow: hidden; }
                .ka__statRank { position: absolute; top: -10px; right: -10px; font-size: 4rem; font-weight: 900; color: rgba(59, 130, 246, 0.05); }
                .ka__statName { font-size: 1rem; font-weight: 700; color: #334155; margin-bottom: 8px; z-index: 1; position: relative; }
                .ka__statCount { font-size: 1.5rem; font-weight: 800; color: #3b82f6; display: flex; align-items: baseline; gap: 6px; z-index: 1; position: relative; }
                .ka__statCount small { font-size: 0.8rem; font-weight: 600; color: #64748b; }
                
                .ka__loading { padding: 50px; display: flex; justify-content: center; }
                .spinner { width: 30px; height: 30px; border: 3px solid rgba(59,130,246,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .mt-4 { margin-top: 30px; }

                @media (max-width: 560px) {
                    .ka__topbar { flex-direction: column; align-items: stretch; }
                    .ka__tabs { width: 100%; }
                    .ka__tab { flex: 1; justify-content: center; }
                    .ka__toolbar { flex-wrap: wrap; gap: 12px; }
                }

                /* Dark mode */
                /* Dark Mode — pola referensi master/pengaturan-data.
                   Palet biru bersama (sama di semua halaman): aksen #60a5fa */
                :global(.dark) .ka__tabs {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    padding: 4px !important;
                }
                :global(.dark) .ka__tab { color: #94a3b8 !important; }
                :global(.dark) .ka__tab:hover { color: #60a5fa !important; background: rgba(96, 165, 250, 0.12) !important; }
                :global(.dark) .ka__tab.active {
                    background: #1d6bf3 !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 14px rgba(29, 107, 243, 0.4) !important;
                    border-radius: 12px !important;
                }
                :global(.dark) .ka__tab.active i { color: #ffffff !important; }
                :global(.dark) .ka__content {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .ka__toolbar h3 { color: #ffffff !important; }
                :global(.dark) .ka__filters input {
                    background: #000000 !important;
                    border: 2.2px solid #1d6bf3 !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                    color-scheme: dark;
                }
                :global(.dark) .ka__table th {
                    color: #94a3b8 !important;
                    border-bottom-color: rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .ka__table td {
                    color: #ffffff !important;
                    border-bottom-color: rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .ka__table tbody tr:hover td { background: rgba(26, 115, 232, 0.12) !important; }
                :global(.dark) .ka__catBadge {
                    background: rgba(96, 165, 250, 0.18) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ka__btnIcon { color: #60a5fa !important; }
                :global(.dark) .ka__btnIcon:hover { background: rgba(96, 165, 250, 0.15) !important; }
                :global(.dark) .ka__modal {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 20px !important;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8) !important;
                }
                :global(.dark) .ka__modal h3 { color: #ffffff !important; }
                :global(.dark) .ka__formGroup label { color: #94a3b8 !important; }
                :global(.dark) .ka__formGroup input[type="text"], :global(.dark) .ka__formGroup select {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                }
                :global(.dark) .ka__btnCancel {
                    background: #000000 !important;
                    border: 1px solid rgba(26, 115, 232, 0.4) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .ka__btnCancel:hover { background: rgba(26, 115, 232, 0.12) !important; color: #ffffff !important; }
                :global(.dark) .ka__statCard {
                    background: #000000 !important;
                    border: 1px solid rgba(37, 99, 235, 0.4) !important;
                    border-radius: 12px !important;
                }
                :global(.dark) .ka__statName { color: #ffffff !important; }
                :global(.dark) .ka__statCount small { color: #94a3b8 !important; }
            `}</style>
        </div>
    )
}
