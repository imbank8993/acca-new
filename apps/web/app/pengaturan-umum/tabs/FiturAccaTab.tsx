'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PageLoader, Spinner } from '@/components/ui/Spinner'
import Swal from 'sweetalert2'
import { useModalBlur } from '@/components/ModalBlurProvider'
import Button from '@/components/ui/Button'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

interface FiturAkademik {
  id: string
  title: string
  description: string
  image_url: string
  icon: string | null
  order_num: number
  is_active: boolean
}

export default function FiturAccaTab() {
  const [features, setFeatures] = useState<FiturAkademik[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FiturAkademik | null>(null)

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    icon: 'bi-star',
    order_num: 0,
    is_active: true
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { openModal, closeModal } = useModalBlur()

  useEffect(() => {
    if (isModalOpen || deleteTarget) openModal()
    else closeModal()
    return () => closeModal()
  }, [isModalOpen, deleteTarget, openModal, closeModal])

  useEffect(() => {
    fetchFeatures()
  }, [])

  const fetchFeatures = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fitur-akademik')
      const json = await res.json().catch(() => null)
      if (json && json.ok && Array.isArray(json.data)) {
        setFeatures(json.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (feat?: FiturAkademik) => {
    if (feat) {
      setEditingId(feat.id)
      setForm({
        title: feat.title,
        description: feat.description,
        icon: feat.icon || 'bi-star',
        order_num: feat.order_num,
        is_active: feat.is_active
      })
      setImagePreview(feat.image_url)
      setImageFile(null)
    } else {
      setEditingId(null)
      setForm({
        title: '',
        description: '',
        icon: 'bi-star',
        order_num: features.length,
        is_active: true
      })
      setImagePreview(null)
      setImageFile(null)
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    }
  }

  const handleSave = async () => {
    if (!form.title || !form.description) {
      Swal.fire('Error', 'Judul dan Deskripsi harus diisi', 'error')
      return
    }

    if (!editingId && !imageFile) {
      Swal.fire('Error', 'Gambar fitur wajib diupload untuk data baru', 'error')
      return
    }

    setSaving(true)
    try {
      let finalImageUrl = imagePreview // If editing and no new image, keep old url

      // Upload image to Supabase Storage if new image selected
      if (imageFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', imageFile)
        uploadFormData.append('folder', 'fitur')

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData
        })

        const uploadJson = await uploadRes.json()

        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.publicUrl) {
          throw new Error(uploadJson.error || 'Upload gambar gagal')
        }

        finalImageUrl = uploadJson.publicUrl
      }

      const payload = {
        title: form.title,
        description: form.description,
        icon: form.icon,
        order_num: form.order_num,
        is_active: form.is_active,
        image_url: finalImageUrl,
      }

      if (editingId) {
        const res = await fetch('/api/fitur-akademik', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload })
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.error || 'Unknown error')
        Swal.fire('Sukses', 'Fitur berhasil diperbarui', 'success')
      } else {
        const res = await fetch('/api/fitur-akademik', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.error || 'Unknown error')
        Swal.fire('Sukses', 'Fitur baru berhasil ditambahkan', 'success')
      }

      handleCloseModal()
      fetchFeatures()

    } catch (err: any) {
      console.error(err)
      Swal.fire('Error', 'Gagal menyimpan: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (feat: FiturAkademik) => {
    setDeleteTarget(feat)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const fetchRes = await fetch(`/api/fitur-akademik?id=${deleteTarget.id}`, { method: 'DELETE' })
      const data = await fetchRes.json()
      if (!fetchRes.ok || !data.ok) throw new Error(data.error || 'Unknown error')
      
      setDeleteTarget(null)
      fetchFeatures()
      Swal.fire('Dihapus', 'Fitur berhasil dihapus', 'success')
    } catch (err: any) {
      Swal.fire('Error', 'Gagal menghapus: ' + err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const toggleActive = async (feat: FiturAkademik) => {
    try {
      const res = await fetch('/api/fitur-akademik', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feat.id, is_active: !feat.is_active })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Unknown error')
      fetchFeatures()
    } catch (err: any) {
      Swal.fire('Error', 'Gagal mengubah status: ' + err.message, 'error')
    }
  }

  if (loading) {
    return <PageLoader minHeight="300px" dotsOnly size={18} />
  }

  return (
    <div className="fitur-tab">
      <div className="fitur-header">
        <h3>Daftar Fitur Akademik</h3>
        <Button variant="primary" type="button" onClick={() => handleOpenModal()} leftIcon={<i className="bi bi-plus-lg" />}>
          Tambah Fitur
        </Button>
      </div>

      <div className="fitur-table-wrap">
        <table className="fitur-table">
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>No</th>
              <th style={{ width: '64px', textAlign: 'center' }}>Gambar</th>
              <th>Nama Fitur</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Urutan</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {features.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--n-muted)' }}>
                  Belum ada data fitur. Silakan tambah fitur baru.
                </td>
              </tr>
            ) : (
              features.map((feat, idx) => (
                <tr key={feat.id}>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--n-muted)' }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center' }}>
                    {feat.image_url ? (
                      <img src={feat.image_url} alt={feat.title} className="fitur-thumb" />
                    ) : (
                      <div className="fitur-thumb-placeholder">
                        <i className={`bi ${feat.icon || 'bi-star'}`}></i>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="fitur-title-cell">
                      <i className={`bi ${feat.icon || 'bi-star'} fitur-icon-inline`}></i>
                      <div>
                        <div className="fitur-name">{feat.title}</div>
                        <div className="fitur-desc">{feat.description}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{feat.order_num}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`status-badge-sm ${feat.is_active ? 'active' : 'inactive'}`}>
                      {feat.is_active ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td>
                    <ActionGroup className="fitur-actions-inline">
                      <ActionButton action="edit" onClick={() => handleOpenModal(feat)} title="Edit Fitur" />
                      <ActionButton action="toggle" onClick={() => toggleActive(feat)} title={feat.is_active ? 'Nonaktifkan' : 'Aktifkan'} />
                      <ActionButton action="delete" onClick={() => handleDelete(feat)} title="Hapus Fitur" />
                    </ActionGroup>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal
          size="md"
          variant={editingId ? 'edit' : 'add'}
          onClose={handleCloseModal}
          labelledBy="fitur-modal-title"
        >
          <ModalHeader
            id="fitur-modal-title"
            icon={editingId ? 'pencil-square' : 'plus-circle'}
            title={editingId ? 'Edit Fitur ACCA' : 'Tambah Fitur ACCA'}
            onClose={handleCloseModal}
          />
          <ModalBody>
            <div className="form-group">
              <label>Judul Fitur</label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Contoh: Sistem Absensi" className="form-control" />
            </div>
            <div className="form-group">
              <label>Deskripsi</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Penjelasan singkat fitur..." rows={3} className="form-control"></textarea>
            </div>
            <div className="form-row">
              <div className="form-group half">
                <label>Ikon (Bootstrap Icon)</label>
                <input type="text" value={form.icon} onChange={e => setForm({...form, icon: e.target.value})} placeholder="bi-star" className="form-control" />
              </div>
              <div className="form-group half">
                <label>Nomor Urut</label>
                <input type="number" value={form.order_num} onChange={e => setForm({...form, order_num: parseInt(e.target.value) || 0})} className="form-control" />
              </div>
            </div>
            <div className="form-group">
              <label>Gambar Preview (Rekomendasi rasio 16:9)</label>
              <div className="image-upload-box" onClick={() => fileInputRef.current?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="preview-img" />
                ) : (
                  <div className="upload-placeholder">
                    <i className="bi bi-cloud-arrow-up"></i>
                    <span>Klik untuk memilih gambar</span>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{display: 'none'}} />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
                Tampilkan di halaman publik
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="cancel" type="button" onClick={handleCloseModal} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
            <Button variant="primary" type="button" onClick={handleSave} isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
              Simpan Fitur
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => setDeleteTarget(null)}
          labelledBy="fitur-delete-title"
        >
          <ModalHeader
            id="fitur-delete-title"
            icon="trash3"
            title={deleteTarget.title}
            onClose={() => setDeleteTarget(null)}
          />
          <ModalFooter>
            <Button
              type="button"
              variant="cancel"
              onClick={() => setDeleteTarget(null)}
              leftIcon={<i className="bi bi-x-lg" />}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDelete}
              isLoading={deleting}
              leftIcon={<i className="bi bi-trash3-fill" />}
            >
              Ya, Hapus
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <style jsx>{`
        .fitur-tab { padding: 14px 18px; background: var(--n-card); border-radius: 12px; border: 1px solid var(--n-border); }
        .fitur-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .fitur-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--n-text); }
        .btn-add { background: var(--n-primary, #3083FF); color: white; border: none; padding: 0 14px; height: 34px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; display: flex; gap: 6px; align-items: center; transition: all 0.2s; }
        .btn-add:hover { filter: brightness(1.1); transform: translateY(-1px); }

        .fitur-table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid var(--n-border);
          border-radius: 10px;
        }
        .fitur-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .fitur-table th {
          background: var(--n-soft);
          color: var(--n-muted);
          font-weight: 700;
          font-size: 0.75rem;
          text-transform: uppercase;
          padding: 8px 12px;
          border-bottom: 1px solid var(--n-border);
        }
        .fitur-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--n-border);
          color: var(--n-text);
          vertical-align: middle;
        }
        .fitur-table tr:last-child td {
          border-bottom: none;
        }
        .fitur-table tr:hover td {
          background: var(--n-soft);
        }
        .fitur-thumb {
          width: 44px;
          height: 30px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid var(--n-border);
        }
        .fitur-thumb-placeholder {
          width: 44px;
          height: 30px;
          background: var(--n-soft);
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--n-muted);
          font-size: 0.95rem;
        }
        .fitur-title-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .fitur-icon-inline {
          font-size: 0.95rem;
          color: var(--n-primary, #3083FF);
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(0, 56, 168, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fitur-name {
          font-weight: 700;
          color: var(--n-text);
          font-size: 0.85rem;
        }
        .fitur-desc {
          font-size: 0.75rem;
          color: var(--n-muted);
          margin-top: 1px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .status-badge-sm {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .status-badge-sm.active { background: #eff6ff; color: #3083FF; border: 1px solid #bfdbfe; }
        .status-badge-sm.inactive { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

        .fitur-actions-inline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-icon {
          width: 30px;
          height: 30px;
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--n-soft);
          color: var(--n-text);
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .btn-icon:hover { filter: brightness(0.95); transform: translateY(-1px); }
        .btn-edit { color: #1d6bf3; background: #eff6ff; border-color: #bfdbfe; }
        .btn-toggle { color: #0284c7; background: #e0f2fe; border-color: #bae6fd; }
        .btn-delete { color: #dc2626; background: #fef2f2; border-color: #fecaca; }


        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px; }
        .modal-content { background: var(--n-card); width: 100%; max-width: 540px; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; box-shadow: 0 25px 60px rgba(0,0,0,0.3); }
        .modal-header { padding: 12px 16px; background: linear-gradient(135deg, #3083FF, #c2185b); color: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .modal-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; }
        .btn-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
        .btn-close:hover { background: rgba(255,255,255,0.35); }
        .modal-body { padding: 16px; overflow-y: auto; }
        .form-group { margin-bottom: 12px; }
        .form-row { display: flex; gap: 12px; }
        .form-group.half { flex: 1; }
        .form-group label { display: block; margin-bottom: 4px; font-size: 0.78rem; font-weight: 600; color: var(--n-text); }
        .form-control { width: 100%; padding: 5px 10px; height: 34px; border: 1px solid var(--n-border); border-radius: 8px; font-family: inherit; font-size: 0.85rem; background: var(--n-surface); color: var(--n-text); }
        textarea.form-control { height: auto; }
        .image-upload-box { border: 2px dashed var(--n-border); border-radius: 8px; height: 120px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; }
        .image-upload-box:hover { border-color: var(--n-primary); }
        .upload-placeholder { display: flex; flex-direction: column; align-items: center; color: var(--n-muted); gap: 4px; font-size: 0.78rem; }
        .upload-placeholder i { font-size: 1.5rem; }
        .preview-img { width: 100%; height: 100%; object-fit: cover; }
        .checkbox-group label { display: flex; align-items: center; gap: 8px; font-weight: normal; cursor: pointer; font-size: 0.82rem; }
        .modal-footer { padding: 12px 16px; border-top: 1px solid var(--n-border); display: flex; justify-content: flex-end; gap: 8px; }
        .btn-cancel { padding: 0 14px; height: 34px; border: 1px solid var(--n-border); background: var(--n-surface); color: var(--n-text); border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
        .btn-save { padding: 0 16px; height: 34px; background: var(--n-primary, #3083FF); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Dark Mode */
        :global(.dark) .fitur-tab {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
        }
        :global(.dark) .fitur-header h3 {
          color: #e2e8f0 !important;
        }
        :global(.dark) .fitur-table-wrap {
          border-color: rgba(26, 115, 232, 0.4) !important;
          border-radius: 12px !important;
        }
        :global(.dark) .fitur-table th {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .fitur-table td {
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
          color: #cbd5e1 !important;
        }
        :global(.dark) .fitur-table tr:hover td {
          background: rgba(26, 115, 232, 0.08) !important;
        }
        :global(.dark) .fitur-name {
          color: #e2e8f0 !important;
        }
        :global(.dark) .fitur-desc {
          color: #94a3b8 !important;
        }

        :global(.dark) .fitur-icon-inline {
          background: rgba(26, 115, 232, 0.15) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .status-badge-sm.active {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.5) !important;
        }
        :global(.dark) .status-badge-sm.inactive {
          background: rgba(255, 255, 255, 0.05) !important;
          color: #94a3b8 !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        :global(.dark) .btn-icon {
          background: #000000 !important;
          border: 1px solid rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .btn-edit {
          background: #000000 !important;
          color: #60a5fa !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
        }
        :global(.dark) .btn-edit:hover {
          background: rgba(26, 115, 232, 0.25) !important;
          color: #ffffff !important;
        }
        :global(.dark) .btn-toggle {
          background: #000000 !important;
          color: #38bdf8 !important;
          border: 1px solid rgba(56, 189, 248, 0.5) !important;
        }
        :global(.dark) .btn-toggle:hover {
          background: rgba(2, 132, 199, 0.25) !important;
          color: #ffffff !important;
        }
        :global(.dark) .btn-delete {
          background: #000000 !important;
          color: #f87171 !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
        }
        :global(.dark) .btn-delete:hover {
          background: rgba(239, 68, 68, 0.25) !important;
          color: #ffffff !important;
        }
        :global(.dark) .modal-content {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8) !important;
        }
        :global(.dark) .form-group label {
          color: #94a3b8 !important;
        }
        :global(.dark) .form-control {
          height: 40px !important;
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          border-radius: 12px !important;
          color: #ffffff !important;
        }
        :global(.dark) textarea.form-control {
          height: auto !important;
        }
        :global(.dark) .image-upload-box {
          background: #000000 !important;
          border: 1px dashed rgba(26, 115, 232, 0.5) !important;
          border-radius: 12px !important;
        }
        :global(.dark) .modal-footer {
          border-top-color: rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .btn-cancel {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .btn-save {
          height: 40px !important;
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          color: #ffffff !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
        }


      `}</style>
    </div>
  )
}


