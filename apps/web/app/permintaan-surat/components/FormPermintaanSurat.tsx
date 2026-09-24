'use client'

import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import type { User } from '@/lib/types'
import { getUserRoles } from '@/lib/auth-client'

interface LampiranItem {
    type: 'guru' | 'siswa' | 'user'
    nip?: string
    nis?: string
    nama: string
    role?: string
}

interface FormPermintaanSuratProps {
    user: User | null
    editData?: any
    onClose: () => void
    onSuccess: () => void
}

export default function FormPermintaanSurat({ user, editData, onClose, onSuccess }: FormPermintaanSuratProps) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [jenisSuratList, setJenisSuratList] = useState<{ value: string; label: string }[]>([])
    const [guruList, setGuruList] = useState<any[]>([])
    const [siswaList, setSiswaList] = useState<any[]>([])
    const [userList, setUserList] = useState<any[]>([])

    const [formData, setFormData] = useState({
        jenis_surat: editData?.jenis_surat || '',
        judul: editData?.judul || '',
        keperluan: editData?.keperluan || '',
        data_json: editData?.data_json || {},
        lampiran_json: editData?.lampiran_json || []
    })

    const [lampiran, setLampiran] = useState<LampiranItem[]>(editData?.lampiran_json || [])
    const [searchGuru, setSearchGuru] = useState('')
    const [searchSiswa, setSearchSiswa] = useState('')
    const [showGuruDropdown, setShowGuruDropdown] = useState(false)
    const [showSiswaDropdown, setShowSiswaDropdown] = useState(false)

    const userRoles = getUserRoles(user)
    const isAdmin = userRoles.includes('ADMIN')
    const isOpLayanan = userRoles.includes('OP_LAYANAN')
    const canManage = isAdmin || isOpLayanan

    useEffect(() => {
        loadDropdownData()
    }, [])

    const loadDropdownData = async () => {
        setLoading(true)
        try {
            // Load jenis surat from master_dropdown (nota_dinas, surat_keterangan, dll)
            const resDropdown = await fetch('/api/master/dropdown')
            const jsonDropdown = await resDropdown.json()

            // Extract unique jenis surat values (simulated - adjust based on actual data)
            const jenisSurat = [
                { value: 'nota_dinas', label: 'Nota Dinas' },
                { value: 'surat_keterangan', label: 'Surat Keterangan' },
                { value: 'surat_tugas', label: 'Surat Tugas' },
                { value: 'surat_panggilan', label: 'Surat Panggilan' },
                { value: 'surat_rekomendasi', label: 'Surat Rekomendasi' },
            ]
            setJenisSuratList(jenisSurat)

            // Load guru list
            const resGuru = await fetch('/api/master/guru?limit=1000')
            const jsonGuru = await resGuru.json()
            if (jsonGuru.ok) setGuruList(jsonGuru.data)

            // Load siswa list.
            // Routenya /api/master/students (bukan /api/master/siswa) dan mengembalikan
            // baris master_siswa apa adanya — nisn/nama_lengkap. Dropdown & LampiranItem
            // di bawah memakai nis/nama, jadi dipetakan di sini.
            const resSiswa = await fetch('/api/master/students?limit=1000')
            const jsonSiswa = await resSiswa.json()
            if (jsonSiswa.ok) {
                setSiswaList((jsonSiswa.data || []).map((s: any) => ({
                    id: s.id,
                    nis: s.nisn,
                    nama: s.nama_lengkap,
                })))
            }

            // Load user list
            const resUser = await fetch('/api/admin/users?limit=1000')
            const jsonUser = await resUser.json()
            if (jsonUser.ok) setUserList(jsonUser.data || [])
        } catch (e) {
            console.error('Error loading dropdown data:', e)
        } finally {
            setLoading(false)
        }
    }

    const addLampiran = (item: LampiranItem) => {
        const exists = lampiran.some(l =>
            (item.nip && l.nip === item.nip) ||
            (item.nis && l.nis === item.nis) ||
            (item.nama === l.nama && item.type === l.type)
        )
        if (exists) {
            Swal.fire('Info', 'Item sudah ada di lampiran', 'info')
            return
        }
        setLampiran([...lampiran, item])
    }

    const removeLampiran = (index: number) => {
        setLampiran(lampiran.filter((_, i) => i !== index))
    }

    const filteredGuru = guruList.filter(g =>
        g.nama_lengkap?.toLowerCase().includes(searchGuru.toLowerCase()) ||
        g.nip?.includes(searchGuru)
    ).slice(0, 10)

    const filteredSiswa = siswaList.filter(s =>
        s.nama?.toLowerCase().includes(searchSiswa.toLowerCase()) ||
        s.nis?.includes(searchSiswa)
    ).slice(0, 10)

    const handleSubmit = async () => {
        if (!formData.jenis_surat) {
            Swal.fire('Info', 'Pilih jenis surat terlebih dahulu', 'info')
            return
        }

        if (!formData.judul) {
            Swal.fire('Info', 'Judul wajib diisi', 'info')
            return
        }

        setSaving(true)
        try {
            const payload = {
                ...formData,
                lampiran_json: lampiran,
                data_json: {
                    ...formData.data_json,
                    submitted_by: user?.nip || user?.id
                }
            }

            let res, json
            if (editData) {
                res = await fetch(`/api/permintaan-surat/${editData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
            } else {
                res = await fetch('/api/permintaan-surat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
            }
            json = await res.json()

            if (json.ok) {
                // If user is submitting (not just draft), change status
                if (!editData || editData.status === 'draft') {
                    await fetch(`/api/permintaan-surat/${json.data.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'menunggu' })
                    })
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: editData ? 'Pengajuan berhasil diperbarui' : 'Pengajuan berhasil dikirim',
                    timer: 1500,
                    showConfirmButton: false
                })
                onSuccess()
            } else {
                throw new Error(json.error)
            }
        } catch (e: any) {
            Swal.fire('Error', e.message, 'error')
        } finally {
            setSaving(false)
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

    return (
        <div className="ps-form">
            {/* Form Header */}
            <div className="ps-form__header">
                <button className="ps-form__back" onClick={onClose}>
                    <i className="bi bi-arrow-left"></i>
                </button>
                <h2 className="ps-form__title">
                    {editData ? 'Edit Permintaan' : 'Ajukan Permintaan Surat Baru'}
                </h2>
                {editData && (
                    <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        ...getStatusBadge(editData.status)
                    }}>
                        {getStatusBadge(editData.status).text}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="ps-form__loading">
                    <i className="bi bi-arrow-repeat spin"></i>
                    <span>Memuat data...</span>
                </div>
            ) : (
                <div className="ps-form__content">
                    {/* Left Column: Main Form */}
                    <div className="ps-form__main">
                        {/* Jenis Surat */}
                        <div className="ps-form__field">
                            <label>Jenis Surat <span className="required">*</span></label>
                            <select
                                value={formData.jenis_surat}
                                onChange={e => setFormData({ ...formData, jenis_surat: e.target.value })}
                                disabled={!canManage && !!editData}
                            >
                                <option value="">-- Pilih Jenis Surat --</option>
                                {jenisSuratList.map(j => (
                                    <option key={j.value} value={j.value}>{j.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Judul */}
                        <div className="ps-form__field">
                            <label>Judul / Perihal <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.judul}
                                onChange={e => setFormData({ ...formData, judul: e.target.value })}
                                placeholder="Contoh: Permohonan Nota Dinas untuk rapat..."
                            />
                        </div>

                        {/* Keperluan */}
                        <div className="ps-form__field">
                            <label>Keperluan / Keterangan</label>
                            <textarea
                                value={formData.keperluan}
                                onChange={e => setFormData({ ...formData, keperluan: e.target.value })}
                                placeholder="Jelaskan keperluan surat ini..."
                                rows={4}
                            />
                        </div>

                        {/* Lampiran Section */}
                        <div className="ps-form__lampiran">
                            <div className="ps-form__lampiran-header">
                                <h3>
                                    <i className="bi bi-paperclip"></i>
                                    Lampirkan Nama
                                </h3>
                                <p>Tambahkan nama guru, siswa, atau user yang terkait dengan surat ini</p>
                            </div>

                            {/* Search Inputs */}
                            <div className="ps-form__lampiran-search">
                                <div className="ps-form__search-wrap">
                                    <input
                                        type="text"
                                        placeholder="Cari guru..."
                                        value={searchGuru}
                                        onChange={e => {
                                            setSearchGuru(e.target.value)
                                            setShowGuruDropdown(true)
                                        }}
                                        onFocus={() => setShowGuruDropdown(true)}
                                    />
                                    {showGuruDropdown && filteredGuru.length > 0 && (
                                        <div className="ps-form__dropdown">
                                            {filteredGuru.map(g => (
                                                <button
                                                    key={g.id || g.nip}
                                                    type="button"
                                                    onClick={() => {
                                                        addLampiran({
                                                            type: 'guru',
                                                            nip: g.nip,
                                                            nama: g.nama_lengkap || g.nama,
                                                            role: 'GURU'
                                                        })
                                                        setSearchGuru('')
                                                        setShowGuruDropdown(false)
                                                    }}
                                                >
                                                    <i className="bi bi-person"></i>
                                                    <span>{g.nama_lengkap || g.nama}</span>
                                                    <small>{g.nip}</small>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="ps-form__search-wrap">
                                    <input
                                        type="text"
                                        placeholder="Cari siswa..."
                                        value={searchSiswa}
                                        onChange={e => {
                                            setSearchSiswa(e.target.value)
                                            setShowSiswaDropdown(true)
                                        }}
                                        onFocus={() => setShowSiswaDropdown(true)}
                                    />
                                    {showSiswaDropdown && filteredSiswa.length > 0 && (
                                        <div className="ps-form__dropdown">
                                            {filteredSiswa.map(s => (
                                                <button
                                                    key={s.id || s.nis}
                                                    type="button"
                                                    onClick={() => {
                                                        addLampiran({
                                                            type: 'siswa',
                                                            nis: s.nis,
                                                            nama: s.nama,
                                                            role: 'SISWA'
                                                        })
                                                        setSearchSiswa('')
                                                        setShowSiswaDropdown(false)
                                                    }}
                                                >
                                                    <i className="bi bi-mortarboard"></i>
                                                    <span>{s.nama}</span>
                                                    <small>{s.nis}</small>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Lampiran List */}
                            {lampiran.length > 0 ? (
                                <div className="ps-form__lampiran-list">
                                    {lampiran.map((item, idx) => (
                                        <div key={idx} className={`ps-form__lampiran-item type-${item.type}`}>
                                            <i className={`bi ${item.type === 'guru' ? 'bi-person' : item.type === 'siswa' ? 'bi-mortarboard' : 'bi-person-badge'}`}></i>
                                            <div className="ps-form__lampiran-info">
                                                <span className="name">{item.nama}</span>
                                                <span className="meta">
                                                    {item.nip || item.nis || ''} {item.role && `• ${item.role}`}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="ps-form__lampiran-remove"
                                                onClick={() => removeLampiran(idx)}
                                            >
                                                <i className="bi bi-x"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="ps-form__lampiran-empty">
                                    <i className="bi bi-inbox"></i>
                                    <span>Belum ada lampiran</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Info */}
                    <div className="ps-form__sidebar">
                        <div className="ps-form__info-card">
                            <h4>
                                <i className="bi bi-info-circle"></i>
                                Informasi
                            </h4>
                            <ul>
                                <li>Permintaan akan diproses oleh Admin/OP Layanan</li>
                                <li>Status dapat dipantau di tab "Pengajuan Saya"</li>
                                <li>Lampirkan nama yang relevan untuk加快了 proses</li>
                            </ul>
                        </div>

                        <div className="ps-form__pemohon">
                            <h4>Pemohon</h4>
                            <div className="ps-form__pemohon-info">
                                <div className="avatar">
                                    {(user?.nama_lengkap || user?.nama || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <span className="name">{user?.nama_lengkap || user?.nama}</span>
                                    <span className="role">{userRoles[0] || 'USER'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Actions */}
            <div className="ps-form__footer">
                <button className="ps-btn ps-btn--ghost" onClick={onClose}>
                    Batal
                </button>
                <div className="ps-form__footer-right">
                    <button
                        className="ps-btn ps-btn--secondary"
                        onClick={handleSubmit}
                        disabled={saving}
                    >
                        {saving ? <i className="bi bi-arrow-repeat spin"></i> : <i className="bi bi-save"></i>}
                        Simpan Draft
                    </button>
                    <button
                        className="ps-btn ps-btn--primary"
                        onClick={handleSubmit}
                        disabled={saving}
                    >
                        {saving ? <i className="bi bi-arrow-repeat spin"></i> : <i className="bi bi-send"></i>}
                        Kirim Pengajuan
                    </button>
                </div>
            </div>

            <style jsx>{`
                .ps-form {
                    background: var(--n-card);
                    border-radius: 16px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                    overflow: hidden;
                }

                .ps-form__header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--n-border);
                    background: linear-gradient(135deg, #1e40af 0%, #1e40af 100%);
                    color: white;
                }

                .ps-form__back {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border: none;
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                }

                .ps-form__back:hover {
                    background: rgba(255,255,255,0.2);
                }

                .ps-form__title {
                    flex: 1;
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                }

                .ps-form__loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 60px;
                    color: var(--n-muted);
                }

                .ps-form__content {
                    display: grid;
                    grid-template-columns: 1fr 320px;
                    gap: 24px;
                    padding: 24px;
                }

                .ps-form__main {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .ps-form__field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .ps-form__field label {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }

                .ps-form__field .required {
                    color: #ef4444;
                }

                .ps-form__field input,
                .ps-form__field select,
                .ps-form__field textarea {
                    padding: 12px 16px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.9rem;
                    font-family: inherit;
                    transition: border-color 0.2s;
                }

                .ps-form__field input:focus,
                .ps-form__field select:focus,
                .ps-form__field textarea:focus {
                    outline: none;
                    border-color: #1e40af;
                    box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
                }

                .ps-form__field textarea {
                    resize: vertical;
                    min-height: 100px;
                }

                .ps-form__lampiran {
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    padding: 20px;
                }

                .ps-form__lampiran-header {
                    margin-bottom: 16px;
                }

                .ps-form__lampiran-header h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 4px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-text);
                }

                .ps-form__lampiran-header h3 i {
                    color: #1e40af;
                }

                .ps-form__lampiran-header p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--n-muted);
                }

                .ps-form__lampiran-search {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .ps-form__search-wrap {
                    position: relative;
                }

                .ps-form__search-wrap input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    font-size: 0.85rem;
                }

                .ps-form__dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    max-height: 240px;
                    overflow-y: auto;
                    z-index: 100;
                }

                .ps-form__dropdown button {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 14px;
                    border: none;
                    background: transparent;
                    text-align: left;
                    cursor: pointer;
                    font-size: 0.85rem;
                }

                .ps-form__dropdown button:hover {
                    background: var(--n-soft);
                }

                .ps-form__dropdown button i {
                    color: var(--n-muted);
                    width: 20px;
                }

                .ps-form__dropdown button span {
                    flex: 1;
                    font-weight: 500;
                }

                .ps-form__dropdown button small {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                }

                .ps-form__lampiran-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .ps-form__lampiran-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 14px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                }

                .ps-form__lampiran-item i {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    font-size: 0.9rem;
                }

                .ps-form__lampiran-item.type-guru i {
                    background: #dbeafe;
                    color: #1e40af;
                }

                .ps-form__lampiran-item.type-siswa i {
                    background: #d1fae5;
                    color: #059669;
                }

                .ps-form__lampiran-item.type-user i {
                    background: #fef3c7;
                    color: #d97706;
                }

                .ps-form__lampiran-info {
                    flex: 1;
                }

                .ps-form__lampiran-info .name {
                    display: block;
                    font-weight: 600;
                    font-size: 0.85rem;
                    color: var(--n-text);
                }

                .ps-form__lampiran-info .meta {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                }

                .ps-form__lampiran-remove {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border-radius: 6px;
                    cursor: pointer;
                }

                .ps-form__lampiran-remove:hover {
                    background: rgba(239, 68, 68, 0.2);
                }

                .ps-form__lampiran-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 24px;
                    color: var(--n-muted);
                    font-size: 0.85rem;
                }

                .ps-form__sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .ps-form__info-card {
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 12px;
                    padding: 16px;
                }

                .ps-form__info-card h4 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1e40af;
                }

                .ps-form__info-card ul {
                    margin: 0;
                    padding-left: 20px;
                    font-size: 0.8rem;
                    color: #3b82f6;
                }

                .ps-form__info-card li {
                    margin-bottom: 6px;
                }

                .ps-form__pemohon {
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    padding: 16px;
                }

                .ps-form__pemohon h4 {
                    margin: 0 0 12px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                }

                .ps-form__pemohon-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .ps-form__pemohon-info .avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #1e40af, #1e40af);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1rem;
                }

                .ps-form__pemohon-info .name {
                    display: block;
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: var(--n-text);
                }

                .ps-form__pemohon-info .role {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                }

                .ps-form__footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 24px;
                    border-top: 1px solid var(--n-border);
                    background: var(--n-soft);
                }

                .ps-form__footer-right {
                    display: flex;
                    gap: 12px;
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
                    background: transparent;
                    color: var(--n-muted);
                }

                .ps-btn--ghost:hover {
                    background: var(--n-soft);
                }

                .ps-btn--secondary {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    color: var(--n-muted);
                }

                .ps-btn--secondary:hover {
                    background: var(--n-soft);
                }

                .ps-btn--primary {
                    background: #1e40af;
                    color: white;
                }

                .ps-btn--primary:hover:not(:disabled) {
                    background: #1e3a8a;
                }

                .ps-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                @media (max-width: 768px) {
                    .ps-form__content {
                        grid-template-columns: 1fr;
                    }
                    .ps-form__lampiran-search {
                        grid-template-columns: 1fr;
                    }
                    .ps-form__footer {
                        flex-direction: column;
                        gap: 12px;
                    }
                    .ps-form__footer-right {
                        width: 100%;
                    }
                    .ps-form__footer-right .ps-btn {
                        flex: 1;
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    )
}