'use client'

import { useState, useEffect, useMemo } from 'react'
import type { User } from '@/lib/types'
import Select from 'react-select'
import Swal from 'sweetalert2'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface UserModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (formData: any) => Promise<void>
    editingUser: User | null
    availableRoles: { value: string, label: string }[]
    saving: boolean
}

export default function UserModal({
    isOpen,
    onClose,
    onSave,
    editingUser,
    availableRoles,
    saving
}: UserModalProps) {
    const [roles, setRoles] = useState<{ value: string, label: string }[]>([])
    const [formData, setFormData] = useState({
        username: '',
        nip: '',
        nama_lengkap: '',
        nama: '',
        divisi: '',
        email: '',
        role: '',
        password: ''
    })
    const [selectedRoles, setSelectedRoles] = useState<string[]>([])
    const [isAddingRole, setIsAddingRole] = useState(false)
    const [gagalMuatRole, setGagalMuatRole] = useState(false)

    const allRoleOptions = useMemo(() => {
        return roles.length > 0 ? roles : availableRoles
    }, [roles, availableRoles])

    const unselectedRoleOptions = useMemo(() => {
        return allRoleOptions.filter(r => !selectedRoles.includes(r.value))
    }, [allRoleOptions, selectedRoles])

    /**
     * Daftar role diambil dari sumber yang sama dengan tab "Daftar Role".
     *
     * Kegagalannya ditandai, bukan didiamkan: daftar cadangan yang dulu ditulis
     * tangan di pemanggil sudah dikosongkan (salah satu isinya, 'WALI KELAS'
     * dengan spasi, bahkan tidak ada di tabel `roles`), jadi tanpa penanda ini
     * pemakai hanya melihat dropdown kosong tanpa tahu sebabnya.
     */
    useEffect(() => {
        if (!isOpen) return
        const fetchRoles = async () => {
            try {
                const res = await fetch('/api/admin/roles')
                const data = await res.json()
                if (data.ok && Array.isArray(data.data)) {
                    setRoles(
                        (data.data as { name?: string }[])
                            .map((r) => ({ value: r.name || '', label: r.name || '' }))
                            .filter((r) => r.value),
                    )
                    setGagalMuatRole(false)
                } else {
                    setGagalMuatRole(true)
                }
            } catch (e) {
                console.error('Failed to fetch roles:', e)
                setGagalMuatRole(true)
            }
        }
        fetchRoles()
    }, [isOpen])

    useEffect(() => {
        setIsAddingRole(false)
        if (editingUser) {
            const currentRoles = (editingUser.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
            setFormData({
                username: editingUser.username || '',
                nip: editingUser.nip || '',
                nama_lengkap: editingUser.nama_lengkap || editingUser.nama || '',
                nama: editingUser.nama || '',
                divisi: editingUser.divisi || '',
                email: editingUser.email || '',
                role: editingUser.role || '',
                password: '' // Kosongkan saat edit
            })
            setSelectedRoles(currentRoles)
        } else {
            setFormData({
                username: '',
                nip: '',
                nama_lengkap: '',
                nama: '',
                divisi: '',
                email: '',
                role: 'GURU',
                password: ''
            })
            setSelectedRoles(['GURU'])
        }
    }, [editingUser, isOpen])

    if (!isOpen) return null

    const handleFormSubmit = () => {
        const username = formData.username.trim()
        const nama = formData.nama.trim() || formData.nama_lengkap.trim()
        const rawNip = formData.nip.trim()
        const nip = rawNip === '-' ? '' : rawNip
        const rawDivisi = formData.divisi.trim()
        const divisi = rawDivisi === '-' ? '' : rawDivisi
        const email = formData.email.trim()

        if (!username) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Username wajib diisi!' })
            return
        }
        if (/\s/.test(username)) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Username tidak boleh mengandung spasi!' })
            return
        }
        if (!nama) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Nama Lengkap atau Nama Ringkas wajib diisi!' })
            return
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Format email tidak valid (contoh: user@sekolah.sch.id)!' })
            return
        }
        if (!editingUser && (!formData.password || formData.password.length < 6)) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Password baru minimal harus 6 karakter!' })
            return
        }
        if (editingUser && formData.password !== '' && formData.password.length < 6) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Password minimal harus 6 karakter!' })
            return
        }
        if (selectedRoles.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Pilih minimal satu role!' })
            return
        }
        const dataToSave = {
            ...formData,
            username,
            nama,
            nama_lengkap: formData.nama_lengkap.trim() || nama,
            nip,
            divisi,
            email,
            role: selectedRoles.join(',')
        }
        onSave(dataToSave);
    }

    return (
        <>
        <Modal size="lg" variant={editingUser ? "edit" : "add"} onClose={onClose} labelledBy="user-modal-title">
            <ModalHeader
                id="user-modal-title"
                title={editingUser ? 'Edit Personil' : 'Tambah Personil Baru'}
                subtitle={editingUser ? `Mengubah data untuk ${editingUser.nama}` : 'Masukkan informasi detail personil sistem.'}
                icon={editingUser ? "pencil-square" : "person-plus-fill"}
                onClose={onClose}
            />

            <ModalBody>
                <div className="sk__grid2">
                    <div className="sk__field sk__fieldFull">
                        <label>Nama Lengkap (Sesuai Ijazah/Sertifikat)</label>
                        <input
                            value={formData.nama_lengkap}
                            onChange={e => setFormData({ ...formData, nama_lengkap: e.target.value })}
                            placeholder="Contoh: Dr. Ahmad S.Pd, M.Si"
                        />
                    </div>
                    <div className="sk__field">
                        <label>Nama Panggilan / Nama Ringkas</label>
                        <input
                            value={formData.nama}
                            onChange={e => setFormData({ ...formData, nama: e.target.value })}
                            placeholder="Contoh: Ahmad"
                        />
                    </div>
                    <div className="sk__field">
                        <label>NIP / NISN (Identitas Utama)</label>
                        <input
                            value={formData.nip}
                            onChange={e => setFormData({ ...formData, nip: e.target.value })}
                            placeholder="Masukkan NIP atau NISN"
                            style={{ borderColor: 'var(--n-primary)', background: 'rgba(0,56,168,0.02)' }}
                        />
                    </div>
                    <div className="sk__field">
                        <label>Username (Hanya untuk Login)</label>
                        <input
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                            placeholder="Username Login"
                        />
                    </div>
                    <div className="sk__field">
                        <label>Email (Untuk Pemulihan Akun)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="contoh@email.com"
                        />
                    </div>
                    <div className="sk__field">
                        <label>Divisi / Unit Kerja</label>
                        <input
                            value={formData.divisi}
                            onChange={e => setFormData({ ...formData, divisi: e.target.value })}
                            placeholder="Contoh: Guru / Tata Usaha"
                        />
                    </div>
                    <div className="sk__field sk__fieldFull">
                        <label>Password {editingUser ? '(Kosongi jika tidak ganti)' : ''}</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder={editingUser ? '••••••••' : 'Masukkan password login...'}
                            autoComplete="new-password"
                        />
                    </div>
                    <div className="sk__field sk__fieldFull">
                        <label>Role</label>
                        {gagalMuatRole && (
                            <p className="um-roleError" role="alert" style={{
                                margin: '0 0 8px', fontSize: '0.8rem', color: '#b45309',
                                background: 'rgba(245,158,11,0.10)',
                                border: '1px solid rgba(245,158,11,0.30)',
                                borderRadius: 8, padding: '8px 10px',
                            }}>
                                Daftar role gagal dimuat, jadi tidak ada pilihan yang bisa ditampilkan.
                                Muat ulang halaman dan coba lagi.
                            </p>
                        )}
                        <div className="role-wrapper">
                            <div className="role-chips">
                                {selectedRoles.length === 0 && !isAddingRole && (
                                    <span className="role-empty">Belum ada role terpilih</span>
                                )}
                                {selectedRoles.map(roleVal => {
                                    const opt = allRoleOptions.find(r => r.value === roleVal) || { value: roleVal, label: roleVal }
                                    return (
                                        <div key={roleVal} className="role-chip selected">
                                            <i className="bi bi-check-lg"></i>
                                            <span className="role-chip-text">{opt.label}</span>
                                            <button
                                                type="button"
                                                className="role-chip-remove"
                                                onClick={() => setSelectedRoles(selectedRoles.filter(r => r !== roleVal))}
                                                title={`Hapus role ${opt.label}`}
                                            >
                                                <i className="bi bi-x-lg"></i>
                                            </button>
                                        </div>
                                    )
                                })}

                                <button
                                    type="button"
                                    className={`role-add-btn ${isAddingRole ? 'active' : ''}`}
                                    onClick={() => setIsAddingRole(!isAddingRole)}
                                    title={isAddingRole ? "Tutup pilihan role" : "Tambah role baru"}
                                >
                                    <i className={`bi ${isAddingRole ? 'bi-dash-lg' : 'bi-plus-lg'}`}></i>
                                    <span>{isAddingRole ? 'Tutup Pilihan' : 'Tambah Role'}</span>
                                </button>
                            </div>

                            {isAddingRole && (
                                <div className="role-select-box">
                                    <Select
                                        isMulti
                                        value={[]}
                                        options={unselectedRoleOptions}
                                        placeholder="Pilih role untuk ditambahkan..."
                                        noOptionsMessage={() => "Semua role sudah terpilih"}
                                        onChange={(newVal) => {
                                            if (newVal) {
                                                const newVals = (newVal as any[]).map(v => v.value)
                                                setSelectedRoles(prev => Array.from(new Set([...prev, ...newVals])))
                                            }
                                        }}
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                        menuPlacement="auto"
                                        menuPosition="fixed"
                                        maxMenuHeight={200}
                                        menuShouldScrollIntoView={true}
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                        styles={{
                                            menuPortal: base => ({ ...base, zIndex: 99999 }),
                                            menu: base => ({
                                                ...base,
                                                backgroundColor: 'var(--n-card, #ffffff)',
                                                border: '1.5px solid var(--n-border, #e2e8f0)',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                                                zIndex: 99999
                                            }),
                                            menuList: base => ({
                                                ...base,
                                                backgroundColor: 'var(--n-card, #ffffff)',
                                                padding: '6px'
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isSelected
                                                    ? '#1d6bf3'
                                                    : state.isFocused
                                                    ? 'rgba(59, 130, 246, 0.15)'
                                                    : 'transparent',
                                                color: state.isSelected
                                                    ? '#ffffff'
                                                    : 'var(--n-text, #0f172a)',
                                                cursor: 'pointer',
                                                borderRadius: '8px',
                                                padding: '8px 12px',
                                                fontSize: '0.88rem',
                                                fontWeight: 600
                                            }),
                                            input: base => ({ ...base, color: 'var(--n-text, #0f172a)' }),
                                            placeholder: base => ({ ...base, color: 'var(--n-muted, #94a3b8)' }),
                                            singleValue: base => ({ ...base, color: 'var(--n-text, #0f172a)' })
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <p className="field-hint">Menampilkan role terpilih untuk user ini. Klik tombol '+ Tambah Role' untuk menambah role tambahan via dropdown multiselect.</p>
                    </div>
                </div>
            </ModalBody>

            <ModalFooter>
                <Button variant="cancel" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>
                    Batal
                </Button>
                <Button variant="primary" onClick={handleFormSubmit} isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                    {editingUser ? 'Simpan Perubahan' : 'Tambah Personil'}
                </Button>
            </ModalFooter>
        </Modal>

            <style jsx>{`
        /* .modalGrid, .field, .field.full sekarang di components/modal.css
           (via sk__grid2 / sk__field / sk__fieldFull) - ubah di sana, bukan di sini. */

        .role-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .role-chips {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .role-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 10px;
          border: 1.5px solid var(--n-primary, #3083FF);
          background: var(--n-primary, #3083FF);
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .role-chip i.bi-check-lg { font-size: 0.8rem; }
        .role-chip-text { line-height: 1; }
        .role-chip-remove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          padding: 0;
          cursor: pointer;
          font-size: 0.7rem;
          transition: background 0.15s;
          margin-left: 2px;
        }
        .role-chip-remove:hover {
          background: rgba(255, 255, 255, 0.4);
        }
        .role-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 10px;
          border: 1.5px dashed var(--n-primary, #3083FF);
          background: rgba(0, 56, 168, 0.04);
          color: var(--n-primary, #3083FF);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .role-add-btn:hover, .role-add-btn.active {
          background: rgba(0, 56, 168, 0.1);
          border-style: solid;
        }
        .role-empty {
          font-size: 0.85rem;
          color: var(--n-muted);
          font-style: italic;
        }
        .role-select-box {
          margin-top: 4px;
        }
        .field-hint {
          font-size: 0.78rem;
          color: var(--n-muted);
          margin: 6px 0 0;
          font-weight: 400;
        }
        /* ===== DARK MODE STANDARD ===== */
        :global(.dark) .role-chip.selected {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          border-color: #3b82f6 !important;
          color: #ffffff !important;
        }
        :global(.dark) .role-add-btn {
          background: rgba(59, 130, 246, 0.1) !important;
          border: 1.5px dashed #3b82f6 !important;
          color: #60a5fa !important;
        }
        :global(.dark) .role-add-btn:hover, :global(.dark) .role-add-btn.active {
          background: rgba(59, 130, 246, 0.2) !important;
          border-style: solid !important;
        }
        :global(.dark .react-select__menu) {
          background-color: #0b1329 !important;
          border: 1.5px solid rgba(59, 130, 246, 0.6) !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8) !important;
        }
        :global(.dark .react-select__menu-list) {
          background-color: #0b1329 !important;
        }
        :global(.dark .react-select__option) {
          background-color: transparent !important;
          color: #f8fafc !important;
        }
        :global(.dark .react-select__option--is-focused) {
          background-color: rgba(59, 130, 246, 0.25) !important;
          color: #60a5fa !important;
        }
        :global(.dark .react-select__option--is-selected) {
          background-color: #1d6bf3 !important;
          color: #ffffff !important;
        }
        :global(.dark .react-select__control) {
          background-color: #000000 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.75) !important;
          color: #ffffff !important;
        }
        :global(.dark .react-select__input-container),
        :global(.dark .react-select__input) {
          color: #ffffff !important;
        }
        :global(.dark .react-select__placeholder) {
          color: #94a3b8 !important;
        }
        :global(.dark .react-select__multi-value) {
          background-color: rgba(59, 130, 246, 0.2) !important;
        }
        :global(.dark .react-select__multi-value__label) {
          color: #60a5fa !important;
        }
        /* ===== END DARK MODE STANDARD ===== */


`}</style>
        </>
    )
}
