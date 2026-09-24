'use client'

import { useState, useEffect, useCallback } from 'react'
import Swal from 'sweetalert2'
import type { User } from '@/lib/types'

interface LampiranItem {
    type: 'guru' | 'siswa' | 'user'
    nip?: string
    nis?: string
    nama: string
    role?: string
}

interface PermintaanSurat {
    id: string
    nomor_surat?: string
    jenis_surat: string
    judul: string
    keperluan?: string
    pemohon_nip: string
    pemohon_nama: string
    pemohon_role: string
    data_json: any
    lampiran_json: LampiranItem[]
    status: string
    status_catatan?: string
    approved_by?: string
    approved_at?: string
    approved_catatan?: string
    created_at: string
    updated_at: string
}

interface TabPengajuanProps {
    user: User | null
    onEdit: (data: PermintaanSurat) => void
    onNew: () => void
}

export default function TabPengajuan({ user, onEdit, onNew }: TabPengajuanProps) {
    const [rows, setRows] = useState<PermintaanSurat[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [search, setSearch] = useState('')

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filterStatus) params.set('status', filterStatus)
            if (search) params.set('q', search)

            const res = await fetch(`/api/permintaan-surat?${params}`)
            const json = await res.json()
            if (json.ok) {
                // Filter: user melihat hanya pengajuan miliknya sendiri
                const userNip = user?.nip || user?.id
                const filtered = json.data.filter((r: PermintaanSurat) =>
                    r.pemohon_nip === userNip
                )
                setRows(filtered)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [filterStatus, search, user])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleDelete = async (id: string) => {
        const confirm = await Swal.fire({
            title: 'Hapus Pengajuan?',
            text: 'Data yang dihapus tidak bisa dikembalikan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
        })
        if (!confirm.isConfirmed) return

        try {
            const res = await fetch(`/api/permintaan-surat/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({ title: 'Dihapus', text: 'Pengajuan berhasil dihapus.', icon: 'success', timer: 1500, showConfirmButton: false })
                loadData()
            } else {
                throw new Error(json.error)
            }
        } catch (e: any) {
            Swal.fire('Error', e.message, 'error')
        }
    }

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; color: string; text: string }> = {
            draft: { bg: '#f1f5f9', color: 'var(--n-muted)', text: 'Draft' },
            menunggu: { bg: '#fef3c7', color: '#d97706', text: 'Menunggu' },
            diproses: { bg: '#dbeafe', color: '#2563eb', text: 'Diproses' },
            disetujui: { bg: '#d1fae5', color: '#059669', text: 'Disetujui' },
            ditolak: { bg: '#fee2e2', color: '#dc2626', text: 'Ditolak' },
            selesai: { bg: '#d1fae5', color: '#059669', text: 'Selesai' },
        }
        return badges[status] || badges.draft
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const getJenisLabel = (jenis: string) => {
        const labels: Record<string, string> = {
            nota_dinas: 'Nota Dinas',
            surat_keterangan: 'Surat Keterangan',
            surat_tugas: 'Surat Tugas',
            surat_panggilan: 'Surat Panggilan',
            surat_rekomendasi: 'Surat Rekomendasi',
        }
        return labels[jenis] || jenis
    }

    return (
        <div className="ps-list">
            {/* Toolbar */}
            <div className="ps-list__toolbar">
                <div className="ps-list__search">
                    <i className="bi bi-search"></i>
                    <input
                        type="text"
                        placeholder="Cari judul/perihal..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="ps-list__filter">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">Semua Status</option>
                        <option value="draft">Draft</option>
                        <option value="menunggu">Menunggu</option>
                        <option value="diproses">Diproses</option>
                        <option value="disetujui">Disetujui</option>
                        <option value="ditolak">Ditolak</option>
                        <option value="selesai">Selesai</option>
                    </select>
                    <i className="bi bi-chevron-down"></i>
                </div>
                <button className="ps-btn ps-btn--ghost" onClick={loadData} title="Refresh">
                    <i className="bi bi-arrow-clockwise"></i>
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="ps-list__loading">
                    <i className="bi bi-arrow-repeat spin"></i>
                    <span>Memuat...</span>
                </div>
            ) : rows.length === 0 ? (
                <div className="ps-list__empty">
                    <i className="bi bi-inbox"></i>
                    <h3>Belum Ada Pengajuan</h3>
                    <p>Ajukan permintaan surat baru untuk memulai</p>
                    <button className="ps-btn ps-btn--primary" onClick={onNew}>
                        <i className="bi bi-plus-circle"></i>
                        Ajukan Sekarang
                    </button>
                </div>
            ) : (
                <div className="ps-list__table-wrap">
                    <table className="ps-list__table">
                        <thead>
                            <tr>
                                <th>Jenis Surat</th>
                                <th>Judul / Perihal</th>
                                <th>Tanggal</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.id}>
                                    <td>
                                        <span className="ps-list__jenis">
                                            {getJenisLabel(row.jenis_surat)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="ps-list__title">{row.judul}</div>
                                        {row.keperluan && (
                                            <div className="ps-list__keperluan">{row.keperluan}</div>
                                        )}
                                        {row.lampiran_json?.length > 0 && (
                                            <div className="ps-list__lampiran">
                                                <i className="bi bi-paperclip"></i>
                                                {row.lampiran_json.length} lampiran
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="ps-list__date">{formatDate(row.created_at)}</span>
                                    </td>
                                    <td>
                                        <span
                                            className="ps-list__status"
                                            style={{
                                                background: getStatusBadge(row.status).bg,
                                                color: getStatusBadge(row.status).color
                                            }}
                                        >
                                            {getStatusBadge(row.status).text}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="ps-list__actions">
                                            {row.status === 'draft' && (
                                                <>
                                                    <button
                                                        className="ps-list__action-btn"
                                                        onClick={() => onEdit(row)}
                                                        title="Edit"
                                                    >
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    <button
                                                        className="ps-list__action-btn danger"
                                                        onClick={() => handleDelete(row.id)}
                                                        title="Hapus"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                className="ps-list__action-btn"
                                                onClick={() => onEdit(row)}
                                                title="Detail"
                                            >
                                                <i className="bi bi-eye"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style jsx>{`
                .ps-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .ps-list__toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .ps-list__search {
                    flex: 1;
                    min-width: 200px;
                    position: relative;
                }

                .ps-list__search i {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--n-muted);
                }

                .ps-list__search input {
                    width: 100%;
                    padding: 10px 14px 10px 40px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                }

                .ps-list__search input:focus {
                    outline: none;
                    border-color: #1e40af;
                }

                .ps-list__filter {
                    position: relative;
                    min-width: 150px;
                }

                .ps-list__filter select {
                    width: 100%;
                    padding: 10px 44px 10px 14px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    appearance: none;
                    background: var(--n-card);
                }

                .ps-list__filter i {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--n-muted);
                    pointer-events: none;
                }

                .ps-list__filter select:focus {
                    outline: none;
                    border-color: #1e40af;
                }

                .ps-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .ps-btn--ghost {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    color: var(--n-muted);
                }

                .ps-btn--ghost:hover {
                    background: var(--n-soft);
                }

                .ps-btn--primary {
                    background: #1e40af;
                    color: white;
                }

                .ps-btn--primary:hover {
                    background: #1e3a8a;
                }

                .ps-list__loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 60px;
                    color: var(--n-muted);
                    background: var(--n-card);
                    border-radius: 12px;
                }

                .ps-list__empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 60px 20px;
                    background: var(--n-card);
                    border-radius: 12px;
                    text-align: center;
                }

                .ps-list__empty i {
                    font-size: 3rem;
                    color: #cbd5e1;
                }

                .ps-list__empty h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--n-text);
                }

                .ps-list__empty p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: var(--n-muted);
                }

                .ps-list__table-wrap {
                    background: var(--n-card);
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
                }

                .ps-list__table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .ps-list__table th {
                    padding: 14px 16px;
                    text-align: left;
                    font-size: 0.72rem;
                    font-weight: 800;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    background: var(--n-soft);
                    border-bottom: 2px solid var(--n-border);
                }

                .ps-list__table td {
                    padding: 14px 16px;
                    border-bottom: 1px solid var(--n-border);
                    font-size: 0.9rem;
                }

                .ps-list__table tr:last-child td {
                    border-bottom: none;
                }

                .ps-list__jenis {
                    display: inline-block;
                    padding: 4px 10px;
                    background: var(--n-soft);
                    border-radius: 6px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }

                .ps-list__title {
                    font-weight: 600;
                    color: var(--n-text);
                    margin-bottom: 2px;
                }

                .ps-list__keperluan {
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .ps-list__lampiran {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 6px;
                    font-size: 0.72rem;
                    color: #1e40af;
                }

                .ps-list__date {
                    font-size: 0.82rem;
                    color: var(--n-muted);
                }

                .ps-list__status {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .ps-list__actions {
                    display: flex;
                    gap: 6px;
                    justify-content: flex-end;
                }

                .ps-list__action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: var(--n-soft);
                    color: var(--n-muted);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .ps-list__action-btn:hover {
                    background: #e2e8f0;
                    color: var(--n-text);
                }

                .ps-list__action-btn.danger:hover {
                    background: #fee2e2;
                    color: #dc2626;
                }

                @media (max-width: 768px) {
                    .ps-list__toolbar {
                        flex-direction: column;
                    }
                    .ps-list__search {
                        width: 100%;
                    }
                    .ps-list__filter {
                        width: 100%;
                    }
                    .ps-list__table-wrap {
                        overflow-x: auto;
                    }
                    .ps-list__table {
                        min-width: 600px;
                    }
                }
            `}</style>
        </div>
    )
}