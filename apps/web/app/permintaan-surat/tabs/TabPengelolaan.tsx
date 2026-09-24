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

interface TabPengelolaanProps {
    user: User | null
    onEdit: (data: PermintaanSurat) => void
}

export default function TabPengelolaan({ user, onEdit }: TabPengelolaanProps) {
    const [rows, setRows] = useState<PermintaanSurat[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterJenis, setFilterJenis] = useState('')
    const [search, setSearch] = useState('')
    const [selectedRow, setSelectedRow] = useState<PermintaanSurat | null>(null)
    const [showDetail, setShowDetail] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filterStatus) params.set('status', filterStatus)
            if (filterJenis) params.set('jenis', filterJenis)
            if (search) params.set('q', search)

            const res = await fetch(`/api/permintaan-surat?${params}`)
            const json = await res.json()
            if (json.ok) {
                setRows(json.data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterJenis, search])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleUpdateStatus = async (id: string, newStatus: string, catatan: string = '') => {
        try {
            const res = await fetch(`/api/permintaan-surat/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    status_catatan: catatan,
                    approved_by: user?.nip || user?.id
                })
            })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: `Status berhasil diubah ke "${getStatusBadge(newStatus).text}"`,
                    timer: 1500,
                    showConfirmButton: false
                })
                loadData()
                setShowDetail(false)
                setSelectedRow(null)
            } else {
                throw new Error(json.error)
            }
        } catch (e: any) {
            Swal.fire('Error', e.message, 'error')
        }
    }

    const openDetail = (row: PermintaanSurat) => {
        setSelectedRow(row)
        setShowDetail(true)
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
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

    const STATUS_OPTIONS = [
        { value: 'draft', label: 'Draft' },
        { value: 'menunggu', label: 'Menunggu' },
        { value: 'diproses', label: 'Diproses' },
        { value: 'disetujui', label: 'Disetujui' },
        { value: 'ditolak', label: 'Ditolak' },
        { value: 'selesai', label: 'Selesai' },
    ]

    const JENIS_OPTIONS = [
        { value: 'nota_dinas', label: 'Nota Dinas' },
        { value: 'surat_keterangan', label: 'Surat Keterangan' },
        { value: 'surat_tugas', label: 'Surat Tugas' },
        { value: 'surat_panggilan', label: 'Surat Panggilan' },
        { value: 'surat_rekomendasi', label: 'Surat Rekomendasi' },
    ]

    return (
        <div className="ps-manage">
            {/* Toolbar */}
            <div className="ps-manage__toolbar">
                <div className="ps-manage__search">
                    <i className="bi bi-search"></i>
                    <input
                        type="text"
                        placeholder="Cari judul, nama pemohon..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="ps-manage__filter-group">
                    <div className="ps-manage__filter">
                        <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
                            <option value="">Semua Jenis</option>
                            {JENIS_OPTIONS.map(j => (
                                <option key={j.value} value={j.value}>{j.label}</option>
                            ))}
                        </select>
                        <i className="bi bi-chevron-down"></i>
                    </div>
                    <div className="ps-manage__filter">
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">Semua Status</option>
                            {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                        <i className="bi bi-chevron-down"></i>
                    </div>
                </div>
                <button className="ps-btn ps-btn--ghost" onClick={loadData} title="Refresh">
                    <i className="bi bi-arrow-clockwise"></i>
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="ps-manage__loading">
                    <i className="bi bi-arrow-repeat spin"></i>
                    <span>Memuat...</span>
                </div>
            ) : rows.length === 0 ? (
                <div className="ps-manage__empty">
                    <i className="bi bi-inbox"></i>
                    <h3>Belum Ada Data</h3>
                    <p>Tidak ada permintaan surat dengan filter yang dipilih</p>
                </div>
            ) : (
                <div className="ps-manage__table-wrap">
                    <table className="ps-manage__table">
                        <thead>
                            <tr>
                                <th>Jenis Surat</th>
                                <th>Judul / Perihal</th>
                                <th>Pemohon</th>
                                <th>Tanggal</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.id}>
                                    <td>
                                        <span className="ps-manage__jenis">
                                            {getJenisLabel(row.jenis_surat)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="ps-manage__title">{row.judul}</div>
                                        {row.lampiran_json?.length > 0 && (
                                            <div className="ps-manage__lampiran">
                                                <i className="bi bi-paperclip"></i>
                                                {row.lampiran_json.length} lampiran
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="ps-manage__pemohon">
                                            <span className="name">{row.pemohon_nama}</span>
                                            <span className="role">{row.pemohon_role}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="ps-manage__date">{formatDate(row.created_at)}</span>
                                    </td>
                                    <td>
                                        <span
                                            className="ps-manage__status"
                                            style={{
                                                background: getStatusBadge(row.status).bg,
                                                color: getStatusBadge(row.status).color
                                            }}
                                        >
                                            {getStatusBadge(row.status).text}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="ps-manage__action-btn"
                                            onClick={() => openDetail(row)}
                                        >
                                            <i className="bi bi-gear"></i>
                                            Kelola
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && selectedRow && (
                <div className="ps-manage__modal-overlay" onClick={() => setShowDetail(false)}>
                    <div className="ps-manage__modal" onClick={e => e.stopPropagation()}>
                        <div className="ps-manage__modal-header">
                            <h3>Detail Permintaan Surat</h3>
                            <button className="ps-manage__modal-close" onClick={() => setShowDetail(false)}>
                                <i className="bi bi-x"></i>
                            </button>
                        </div>
                        <div className="ps-manage__modal-body">
                            <div className="ps-manage__modal-grid">
                                <div className="ps-manage__info-section">
                                    <h4>Informasi Surat</h4>
                                    <div className="ps-manage__info-row">
                                        <span className="label">Jenis Surat</span>
                                        <span className="value">{getJenisLabel(selectedRow.jenis_surat)}</span>
                                    </div>
                                    <div className="ps-manage__info-row">
                                        <span className="label">Judul</span>
                                        <span className="value">{selectedRow.judul}</span>
                                    </div>
                                    <div className="ps-manage__info-row">
                                        <span className="label">Keperluan</span>
                                        <span className="value">{selectedRow.keperluan || '-'}</span>
                                    </div>
                                    {selectedRow.nomor_surat && (
                                        <div className="ps-manage__info-row">
                                            <span className="label">Nomor Surat</span>
                                            <span className="value">{selectedRow.nomor_surat}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="ps-manage__info-section">
                                    <h4>Informasi Pemohon</h4>
                                    <div className="ps-manage__info-row">
                                        <span className="label">Nama</span>
                                        <span className="value">{selectedRow.pemohon_nama}</span>
                                    </div>
                                    <div className="ps-manage__info-row">
                                        <span className="label">NIP/No.Id</span>
                                        <span className="value">{selectedRow.pemohon_nip}</span>
                                    </div>
                                    <div className="ps-manage__info-row">
                                        <span className="label">Role</span>
                                        <span className="value">{selectedRow.pemohon_role}</span>
                                    </div>
                                    <div className="ps-manage__info-row">
                                        <span className="label">Tanggal Ajuan</span>
                                        <span className="value">{formatDate(selectedRow.created_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Lampiran */}
                            {selectedRow.lampiran_json?.length > 0 && (
                                <div className="ps-manage__lampiran-section">
                                    <h4>
                                        <i className="bi bi-paperclip"></i>
                                        Lampiran ({selectedRow.lampiran_json.length})
                                    </h4>
                                    <div className="ps-manage__lampiran-list">
                                        {selectedRow.lampiran_json.map((item, idx) => (
                                            <div key={idx} className={`ps-manage__lampiran-item type-${item.type}`}>
                                                <i className={`bi ${item.type === 'guru' ? 'bi-person' : item.type === 'siswa' ? 'bi-mortarboard' : 'bi-person-badge'}`}></i>
                                                <div className="info">
                                                    <span className="name">{item.nama}</span>
                                                    <span className="meta">{item.nip || item.nis || ''} {item.role && `• ${item.role}`}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Status Update */}
                            <div className="ps-manage__status-section">
                                <h4>Update Status</h4>
                                <div className="ps-manage__status-buttons">
                                    {['menunggu', 'diproses', 'disetujui', 'ditolak', 'selesai'].map(status => (
                                        <button
                                            key={status}
                                            className={`ps-manage__status-btn ${selectedRow.status === status ? 'active' : ''}`}
                                            style={{
                                                background: selectedRow.status === status ? getStatusBadge(status).bg : 'white',
                                                color: selectedRow.status === status ? getStatusBadge(status).color : '#64748b',
                                                borderColor: selectedRow.status === status ? getStatusBadge(status).color : '#e2e8f0'
                                            }}
                                            onClick={() => {
                                                if (selectedRow.status !== status) {
                                                    handleUpdateStatus(selectedRow.id, status)
                                                }
                                            }}
                                        >
                                            {getStatusBadge(status).text}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Catatan */}
                            {selectedRow.status_catatan && (
                                <div className="ps-manage__catatan">
                                    <h4>Catatan Status</h4>
                                    <p>{selectedRow.status_catatan}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .ps-manage {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .ps-manage__toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .ps-manage__search {
                    flex: 1;
                    min-width: 200px;
                    position: relative;
                }

                .ps-manage__search i {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--n-muted);
                }

                .ps-manage__search input {
                    width: 100%;
                    padding: 10px 14px 10px 40px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                }

                .ps-manage__search input:focus {
                    outline: none;
                    border-color: #1e40af;
                }

                .ps-manage__filter-group {
                    display: flex;
                    gap: 8px;
                }

                .ps-manage__filter {
                    position: relative;
                    min-width: 140px;
                }

                .ps-manage__filter select {
                    width: 100%;
                    padding: 10px 44px 10px 14px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    appearance: none;
                    background: var(--n-card);
                }

                .ps-manage__filter i {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--n-muted);
                    pointer-events: none;
                }

                .ps-manage__filter select:focus {
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

                .ps-manage__loading,
                .ps-manage__empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 60px 20px;
                    background: var(--n-card);
                    border-radius: 12px;
                    text-align: center;
                }

                .ps-manage__empty i {
                    font-size: 3rem;
                    color: #cbd5e1;
                }

                .ps-manage__empty h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--n-text);
                }

                .ps-manage__empty p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: var(--n-muted);
                }

                .ps-manage__table-wrap {
                    background: var(--n-card);
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
                }

                .ps-manage__table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .ps-manage__table th {
                    padding: 14px 16px;
                    text-align: left;
                    font-size: 0.72rem;
                    font-weight: 800;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    background: var(--n-soft);
                    border-bottom: 2px solid var(--n-border);
                }

                .ps-manage__table td {
                    padding: 14px 16px;
                    border-bottom: 1px solid var(--n-border);
                    font-size: 0.9rem;
                }

                .ps-manage__table tr:last-child td {
                    border-bottom: none;
                }

                .ps-manage__jenis {
                    display: inline-block;
                    padding: 4px 10px;
                    background: var(--n-soft);
                    border-radius: 6px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }

                .ps-manage__title {
                    font-weight: 600;
                    color: var(--n-text);
                    margin-bottom: 2px;
                }

                .ps-manage__lampiran {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 4px;
                    font-size: 0.72rem;
                    color: #1e40af;
                }

                .ps-manage__pemohon .name {
                    display: block;
                    font-weight: 600;
                    color: var(--n-text);
                }

                .ps-manage__pemohon .role {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                }

                .ps-manage__date {
                    font-size: 0.82rem;
                    color: var(--n-muted);
                }

                .ps-manage__status {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .ps-manage__action-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-muted);
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .ps-manage__action-btn:hover {
                    background: #1e40af;
                    color: white;
                    border-color: #1e40af;
                }

                /* Modal */
                .ps-manage__modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }

                .ps-manage__modal {
                    background: var(--n-card);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 700px;
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .ps-manage__modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--n-border);
                    background: linear-gradient(135deg, #1e40af 0%, #1e40af 100%);
                    color: white;
                }

                .ps-manage__modal-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 700;
                }

                .ps-manage__modal-close {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                }

                .ps-manage__modal-body {
                    padding: 20px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .ps-manage__modal-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }

                .ps-manage__info-section h4 {
                    margin: 0 0 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1e40af;
                    text-transform: uppercase;
                }

                .ps-manage__info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--n-border);
                }

                .ps-manage__info-row .label {
                    font-size: 0.82rem;
                    color: var(--n-muted);
                }

                .ps-manage__info-row .value {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-text);
                    text-align: right;
                }

                .ps-manage__lampiran-section h4 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1e40af;
                }

                .ps-manage__lampiran-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .ps-manage__lampiran-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 14px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                }

                .ps-manage__lampiran-item i {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    font-size: 0.9rem;
                }

                .ps-manage__lampiran-item.type-guru i {
                    background: #dbeafe;
                    color: #1e40af;
                }

                .ps-manage__lampiran-item.type-siswa i {
                    background: #d1fae5;
                    color: #059669;
                }

                .ps-manage__lampiran-item.type-user i {
                    background: #fef3c7;
                    color: #d97706;
                }

                .ps-manage__lampiran-item .info .name {
                    display: block;
                    font-weight: 600;
                    font-size: 0.85rem;
                    color: var(--n-text);
                }

                .ps-manage__lampiran-item .info .meta {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                }

                .ps-manage__status-section h4 {
                    margin: 0 0 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1e40af;
                }

                .ps-manage__status-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .ps-manage__status-btn {
                    padding: 8px 16px;
                    border: 1px solid;
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .ps-manage__status-btn:not(.active):hover {
                    background: var(--n-soft);
                }

                .ps-manage__catatan {
                    background: #fef3c7;
                    border: 1px solid #fcd34d;
                    border-radius: 10px;
                    padding: 14px;
                }

                .ps-manage__catatan h4 {
                    margin: 0 0 8px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: #92400e;
                }

                .ps-manage__catatan p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: #78350f;
                }

                @media (max-width: 768px) {
                    .ps-manage__toolbar {
                        flex-direction: column;
                    }
                    .ps-manage__search,
                    .ps-manage__filter-group {
                        width: 100%;
                    }
                    .ps-manage__filter {
                        flex: 1;
                    }
                    .ps-manage__table-wrap {
                        overflow-x: auto;
                    }
                    .ps-manage__table {
                        min-width: 700px;
                    }
                    .ps-manage__modal-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}