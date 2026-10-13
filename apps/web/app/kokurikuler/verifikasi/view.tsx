"use client"

import React, { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import DatePicker from '@/components/ui/DatePicker'
import { FilterToolbar, FilterField, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar'
import { Button } from '@/components/ui/Button'
import { ActionButton } from '@/components/ui/ActionButtons'
import { Spinner } from '@/components/ui/Spinner'
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter'

interface KokurikulerVerifikasiProps {
    user?: any
    isAdmin?: boolean
    /** Jabatan tugas tambahan Pembina Asrama, mis. "Pembina Asrama Putra" */
    pembinaJabatan?: string
}

const BULAN_OPTIONS = [
    { value: '0', label: 'Semua Bulan' },
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
]

const getTodayStr = () => new Date().toLocaleDateString('en-CA')

export default function KokurikulerVerifikasiPage({ user, isAdmin = false, pembinaJabatan = '' }: KokurikulerVerifikasiProps) {
    const taFilter = useTahunAjaranFilter()
    const [tanggal, setTanggal] = useState<string>(getTodayStr)
    const [selectedBulan, setSelectedBulan] = useState<string>('0')
    const [selectedKelas, setSelectedKelas] = useState<string>('')
    const [kelasList, setKelasList] = useState<{ id: number; nama: string }[]>([])

    const [students, setStudents] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    /** Tanggal lain yang masih menyimpan kegiatan menunggu verifikasi. */
    const [pendingLain, setPendingLain] = useState<{ tanggal: string; jumlah: number }[]>([])
    const [loading, setLoading] = useState(false)
    const [actioning, setActioning] = useState<string | null>(null) // nisn or log_id being processed

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students
        const q = searchQuery.toLowerCase().trim()
        return students.filter(s => {
            const nameMatch = (s.nama_lengkap || '').toLowerCase().includes(q)
            const nisnMatch = (s.nisn || '').toLowerCase().includes(q)
            const kelasMatch = (s.kelas || '').toLowerCase().includes(q)
            const logMatch = (s.logs || []).some((l: any) => (l.nama_kegiatan || '').toLowerCase().includes(q))
            return nameMatch || nisnMatch || kelasMatch || logMatch
        })
    }, [students, searchQuery])

    const verifierNip: string = user?.nip || user?.username || ''

    const jl = pembinaJabatan.toLowerCase()
    const genderFilter = isAdmin ? '' : (jl.includes('putra') ? 'L' : jl.includes('putri') ? 'P' : '')

    // Fetch list of active regular classes (sorted by level)
    useEffect(() => {
        fetch('/api/master/kelas?limit=200')
            .then(res => res.json())
            .then(json => {
                if (json.ok && Array.isArray(json.data)) {
                    const regulerOnly = json.data.filter((k: any) => k.program === 'Reguler');

                    const getTingkatRank = (k: { nama: string; tingkat?: number }) => {
                        if (k.tingkat) return Number(k.tingkat);
                        const name = (k.nama || '').trim().toUpperCase();
                        if (name.startsWith('XII') || name.startsWith('12')) return 12;
                        if (name.startsWith('XI') || name.startsWith('11')) return 11;
                        if (name.startsWith('X') || name.startsWith('10')) return 10;
                        return 99;
                    };

                    const sorted = [...regulerOnly].sort((a, b) => {
                        const rankA = getTingkatRank(a);
                        const rankB = getTingkatRank(b);
                        if (rankA !== rankB) return rankA - rankB;
                        return (a.nama || '').localeCompare(b.nama || '', undefined, { numeric: true, sensitivity: 'base' });
                    });

                    setKelasList(sorted);
                }
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        fetchStudents()
    }, [tanggal, selectedBulan, selectedKelas, taFilter.selected])

    const fetchStudents = async () => {
        setLoading(true)
        try {
            const queryParams = new URLSearchParams()
            // Jika memilih bulan tertentu, prioritaskan filter bulan (jangan kirim tanggal)
            if (selectedBulan && selectedBulan !== '0') {
                queryParams.set('bulan', selectedBulan)
            } else if (tanggal) {
                queryParams.set('tanggal', tanggal)
            }
            if (genderFilter) queryParams.set('gender', genderFilter)
            if (selectedKelas) queryParams.set('kelas', selectedKelas)
            if (taFilter.selected) queryParams.set('tahun_ajaran', taFilter.selected)

            const res = await fetch(`/api/kokurikuler/verifikasi?${queryParams.toString()}`)
            const json = await res.json()
            if (json.ok) {
                setStudents(json.data || [])
                setPendingLain(json.pendingLain || [])
            }
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const handleApproveAll = async (nisn: string) => {
        setActioning(nisn)
        try {
            const payload: any = {
                action: 'approve_all_for_nisn',
                nisn,
                verifier_nip: verifierNip
            }
            if (selectedBulan && selectedBulan !== '0') {
                payload.bulan = selectedBulan
                if (taFilter.selected) payload.tahun_ajaran = taFilter.selected
            } else if (tanggal) {
                payload.tanggal = tanggal
            }

            const res = await fetch('/api/kokurikuler/verifikasi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const json = await res.json()
            if (json.ok) {
                fetchStudents()
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error || 'Terjadi kesalahan' })
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e?.message || 'Terjadi kesalahan sistem' })
        }
        setActioning(null)
    }

    const handleApproveOne = async (logId: string) => {
        setActioning(logId)
        try {
            const res = await fetch('/api/kokurikuler/verifikasi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_status',
                    log_id: logId,
                    status: 'Disetujui',
                    verifier_nip: verifierNip
                })
            })
            const json = await res.json()
            if (json.ok) {
                fetchStudents()
            } else {
                Swal.fire({ icon: 'error', title: 'Gagal', text: json.error || 'Terjadi kesalahan' })
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e?.message || 'Terjadi kesalahan sistem' })
        }
        setActioning(null)
    }

    const handleReject = async (logId: string) => {
        const { value: catatan, isConfirmed } = await Swal.fire({
            title: 'Tolak Kegiatan',
            input: 'text',
            inputLabel: 'Catatan pembinaan (contoh: Didapati tidur saat jam tahajud)',
            inputPlaceholder: 'Masukkan catatan...',
            showCancelButton: true
        })

        if (isConfirmed) {
            setActioning(logId)
            try {
                const res = await fetch('/api/kokurikuler/verifikasi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update_status',
                        log_id: logId,
                        status: 'Ditolak',
                        catatan: catatan || '',
                        verifier_nip: verifierNip
                    })
                })
                const json = await res.json()
                if (json.ok) {
                    fetchStudents()
                } else {
                    Swal.fire({ icon: 'error', title: 'Gagal', text: json.error || 'Terjadi kesalahan' })
                }
            } catch (e: any) {
                Swal.fire({ icon: 'error', title: 'Gagal', text: e?.message || 'Terjadi kesalahan sistem' })
            }
            setActioning(null)
        }
    }

    return (
        <div className="kv__container">
            <FilterToolbar style={{ marginBottom: '20px' }}>
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari nama, NISN, atau kegiatan..."
                />

                <FilterSelect
                    label="Tahun Ajaran"
                    icon="mortarboard"
                    value={taFilter.selected}
                    onChange={taFilter.setSelected}
                    options={taFilter.years.map(y => ({ value: y, label: `TA ${y}` }))}
                    width="180px"
                />

                <FilterSelect
                    label="Bulan"
                    icon="calendar-month"
                    value={selectedBulan}
                    onChange={setSelectedBulan}
                    options={BULAN_OPTIONS}
                    width="170px"
                />

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

                <FilterField label="Tanggal Verifikasi" icon="calendar-check" bare width="200px">
                    <DatePicker value={tanggal} onChange={setTanggal} />
                </FilterField>
            </FilterToolbar>

            {/* Halaman ini hanya menampilkan SATU tanggal, jadi antrean di hari lain
                tak akan pernah muncul sendiri — pengguna cuma melihat halaman kosong
                sementara kegiatan menunggu verifikasi menumpuk di tanggal lampau. */}
            {pendingLain.length > 0 && (
                <div className="kv__pendingLain">
                    <i className="bi bi-clock-history" />
                    <span className="kv__pendingLainText">
                        <strong>
                            {pendingLain.reduce((s, p) => s + p.jumlah, 0)} kegiatan
                        </strong>{' '}
                        menunggu verifikasi di tanggal lain:
                    </span>
                    <span className="kv__pendingLainChips">
                        {pendingLain.map(p => (
                            <button
                                key={p.tanggal}
                                type="button"
                                className="kv__pendingChip"
                                onClick={() => {
                                    setSelectedBulan('0')
                                    setTanggal(p.tanggal)
                                }}
                                title={`Buka tanggal ${p.tanggal}`}
                            >
                                {new Date(p.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                <span className="kv__pendingChipCount">{p.jumlah}</span>
                            </button>
                        ))}
                    </span>
                </div>
            )}

            {loading ? (
                <div className="kv__loading"><Spinner size={32} /></div>
            ) : (
                <div className="kv__students">
                    {filteredStudents.map(s => {
                        const hasPending = s.logs.some((l: any) => l.status === 'Pending')
                        if (s.logs.length === 0) return null

                        return (
                            <div key={s.nisn} className="kv__studentCard">
                                <div className="kv__stHead">
                                    <div className="kv__stInfo">
                                        <h4>{s.nama_lengkap}</h4>
                                        <span className="kv__stKelas">{s.kelas}</span>
                                    </div>
                                    {hasPending && (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => handleApproveAll(s.nisn)}
                                            isLoading={actioning === s.nisn}
                                            leftIcon={<i className="bi bi-check2-all" />}
                                        >
                                            Setujui Semua Pending
                                        </Button>
                                    )}
                                </div>
                                <div className="kv__logs">
                                    {s.logs.map((log: any) => {
                                        const statusLower = (log.status || 'Pending').toLowerCase()
                                        return (
                                            <div key={log.id} className={`kv__logItem st-${statusLower}`}>
                                                <div className="kv__logText">
                                                    <span className="kv__logName">
                                                        {log.nama_kegiatan}
                                                        {log.is_custom && <span className="kv__badgeCustom">Custom</span>}
                                                    </span>
                                                    <span className={`kv__statusTxt st-${statusLower}`}>{log.status || 'Pending'}</span>
                                                    {log.catatan && <div className="kv__catatan">Catatan: {log.catatan}</div>}
                                                </div>
                                                <div className="kv__logActions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    {log.status !== 'Disetujui' && (
                                                        <ActionButton
                                                            action="approve"
                                                            size="sm"
                                                            onClick={() => handleApproveOne(log.id)}
                                                            disabled={actioning === log.id}
                                                            label="Setujui"
                                                        />
                                                    )}
                                                    {log.status !== 'Ditolak' && (
                                                        <ActionButton
                                                            action="reject"
                                                            size="sm"
                                                            onClick={() => handleReject(log.id)}
                                                            disabled={actioning === log.id}
                                                            label="Tolak"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {filteredStudents.filter(s => s.logs.length > 0).length === 0 && (
                        <div className="kv__emptyState">
                            <i className="bi bi-inbox" />
                            <p>{students.length === 0 ? 'Belum ada siswa yang mengisi catatan kegiatan untuk kriteria ini.' : 'Tidak ditemukan siswa atau kegiatan yang sesuai pencarian.'}</p>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .kv__container { width: 100%; padding: 0; font-family: 'Inter', sans-serif; }
                .kv__students { display: flex; flex-direction: column; gap: 20px; }
                .kv__studentCard { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 6px 20px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; transition: all 0.2s; }
                .kv__studentCard:hover { box-shadow: 0 10px 25px rgba(0,0,0,0.06); }

                .kv__stHead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
                .kv__stInfo h4 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
                .kv__stKelas { font-size: 0.8rem; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-weight: 600; }

                .kv__logs { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
                .kv__logItem { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; }
                .kv__logItem.st-disetujui { background: #f0fdf4; border-color: #bbf7d0; }
                .kv__logItem.st-ditolak { background: #fef2f2; border-color: #fecaca; }

                .kv__logText { display: flex; flex-direction: column; gap: 4px; }
                .kv__logName { font-weight: 600; color: #334155; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
                .kv__badgeCustom { font-size: 0.65rem; background: #e0e7ff; color: #002a7a; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }

                .kv__statusTxt { font-size: 0.75rem; font-weight: 700; }
                .kv__statusTxt.st-pending { color: #d97706; }
                .kv__statusTxt.st-disetujui { color: #16a34a; }
                .kv__statusTxt.st-ditolak { color: #dc2626; }

                .kv__catatan { font-size: 0.8rem; color: #b91c1c; margin-top: 4px; font-style: italic; }
                .kv__loading { text-align: center; padding: 50px; color: #64748b; font-weight: 600; display: flex; justify-content: center; }

                /* Pengingat antrean di tanggal lain */
                .kv__pendingLain {
                    display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
                    margin: 0 0 16px; padding: 12px 16px;
                    background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px;
                    color: #92400e; font-size: 0.875rem;
                }
                .kv__pendingLain > i { font-size: 1.05rem; flex-shrink: 0; }
                .kv__pendingLainText strong { font-weight: 800; }
                .kv__pendingLainChips { display: flex; flex-wrap: wrap; gap: 6px; }
                .kv__pendingChip {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 4px 10px; border-radius: 999px; cursor: pointer;
                    background: #fff; border: 1px solid #fcd34d; color: #92400e;
                    font-size: 0.8rem; font-weight: 700; transition: all .15s ease;
                }
                .kv__pendingChip:hover { background: #fef3c7; border-color: #f59e0b; }
                .kv__pendingChipCount {
                    min-width: 18px; padding: 0 5px; border-radius: 999px;
                    background: #dc2626; color: #fff; font-size: 0.68rem; line-height: 18px; text-align: center;
                }
                :global(.dark) .kv__pendingLain {
                    background: #000000 !important;
                    border: 1.5px solid rgba(245, 158, 11, 0.5) !important;
                    color: #fbbf24 !important;
                }
                :global(.dark) .kv__pendingChip {
                    background: rgba(245, 158, 11, 0.12) !important;
                    border-color: rgba(245, 158, 11, 0.45) !important;
                    color: #fbbf24 !important;
                }
                .kv__emptyState { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; border: 1px dashed #cbd5e1; color: #94a3b8; }
                .kv__emptyState i { font-size: 3rem; margin-bottom: 10px; display: block; color: #cbd5e1; }

                /* Dark mode */
                :global(.dark) .kv__studentCard {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .kv__stHead {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .kv__stInfo h4 { color: #ffffff !important; }
                :global(.dark) .kv__stKelas {
                    background: rgba(96, 165, 250, 0.18) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .kv__logItem {
                    background: #000000 !important;
                    border-color: rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .kv__logItem:hover { background: rgba(26, 115, 232, 0.12) !important; }
                :global(.dark) .kv__logItem.st-disetujui { background: rgba(34,197,94,0.12) !important; border-color: rgba(34,197,94,0.35) !important; }
                :global(.dark) .kv__logItem.st-ditolak { background: rgba(239,68,68,0.12) !important; border-color: rgba(239,68,68,0.35) !important; }
                :global(.dark) .kv__logName { color: #ffffff !important; }
                :global(.dark) .kv__emptyState {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    color: #64748b !important;
                }
            `}</style>
        </div>
    )
}
