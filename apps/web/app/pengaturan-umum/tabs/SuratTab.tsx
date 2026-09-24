'use client'

import { useState, useEffect, useCallback } from 'react'
import Swal from 'sweetalert2'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import Button from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

interface SuratTemplate {
  id: string
  name: string
  type: string
  description: string
  storage_path: string
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

const templateTypes = [
  { key: 'IZIN_SINGLE', label: 'Surat Izin (Perorangan)', icon: 'bi-envelope-paper-fill', color: '#059669' },
  { key: 'IZIN_GROUP', label: 'Surat Izin + Lampiran (Kolektif)', icon: 'bi-collection', color: '#059669' },
  { key: 'TUGAS_SINGLE', label: 'Surat Tugas (Perorangan)', icon: 'bi-briefcase-fill', color: '#3083FF' },
  { key: 'TUGAS_GROUP', label: 'Surat Tugas + Lampiran (Kolektif)', icon: 'bi-collection', color: '#3083FF' },
  { key: 'SAKIT', label: 'Surat Keterangan Sakit', icon: 'bi-heart-pulse-fill', color: '#dc2626' },
]

const QuillToolbar = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean'],
  ],
}

export default function SuratTab({ user }: { user?: any }) {
  const [templates, setTemplates] = useState<SuratTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<SuratTemplate | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SuratTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { openModal, closeModal } = useModalBlur()

  useEffect(() => {
    if (deleteTarget) openModal()
    else closeModal()
    return () => closeModal()
  }, [deleteTarget, openModal, closeModal])

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    const { getCurrentUser } = await import('@/lib/auth-client')
    const userData = await getCurrentUser()
    if (userData) {
      const adminStatus = (userData.roles || []).some((r: string) => {
        const normalized = r.toUpperCase().trim()
        return normalized === 'ADMIN' || normalized === 'ADMINISTRATOR'
      }) || !!(userData as any).isAdmin || false
      setIsAdmin(adminStatus)
    }

    await loadTemplates()
  }

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/surat/templates')
      const json = await res.json()
      if (json.ok && json.data) {
        setTemplates(json.data)
      }
    } catch (e) {
      console.error('Load templates error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.docx')) {
      Swal.fire('Error', 'Hanya file .docx yang diizinkan', 'error')
      return
    }

    const templateType = (e.target as any).dataset?.type || 'IZIN_SINGLE'

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', templateType)

      const res = await fetch('/api/surat/templates', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (!json.ok) throw new Error(json.error)

      await loadTemplates()
      Swal.fire('Berhasil', 'Template berhasil diupload dan akan digunakan untuk cetak selanjutnya', 'success')
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDownload = async (template: SuratTemplate) => {
    try {
      const res = await fetch(`/api/surat/templates/${template.id}/download`)
      if (!res.ok) throw new Error('Gagal download')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = template.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    }
  }

  const handleDelete = (template: SuratTemplate) => {
    if (template.is_default) {
      Swal.fire('Info', 'Template default tidak bisa dihapus', 'info')
      return
    }
    setDeleteTarget(template)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/surat/templates/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)

      setDeleteTarget(null)
      await loadTemplates()
      Swal.fire('Berhasil', 'Template dihapus', 'success')
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleSetDefault = async (template: SuratTemplate) => {
    try {
      const res = await fetch(`/api/surat/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)

      await loadTemplates()
      Swal.fire('Berhasil', 'Template default diperbarui', 'success')
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    }
  }

  const getTypeInfo = (type: string) => {
    return templateTypes.find(t => t.key === type) || { label: type, icon: 'bi-file-earmark', color: '#666' }
  }

  const groupedTemplates = templateTypes.map(t => ({
    ...t,
    items: templates.filter(tm => tm.type === t.key),
  }))

  return (
    <div className="surat-tab-wrap">
      <div className="surat-tab-header">
        <div>
          <h2 className="surat-tab-title">
            <i className="bi bi-file-earmark-word"></i>
            Template Surat
          </h2>
          <p className="surat-tab-desc">
            Kelola template dokumen untuk Cetak Surat Izin, Surat Tugas, dan Surat Keterangan Sakit.
          </p>
        </div>
        <div className="surat-tab-actions">
          <button className="surat-btn surat-btn--outline" onClick={() => window.open('/templates', '_blank')}>
            <i className="bi bi-folder2-open"></i>
            Lihat Folder Templates
          </button>
        </div>
      </div>

      {loading ? (
        <div className="surat-loading">
          <Spinner variant="trace" />
        </div>
      ) : (
        <div className="surat-groups">
          {groupedTemplates.map(group => (
            <div key={group.key} className="surat-group">
              <div className="surat-group-header" style={{ borderLeftColor: group.color }}>
                <i className={`bi ${group.icon}`} style={{ color: group.color }}></i>
                <span>{group.label}</span>
                <span className="surat-count">{group.items.length}</span>
              </div>

              <div className="surat-group-body">
                {group.items.length === 0 ? (
                  <div className="surat-empty">
                    <i className="bi bi-file-earmark-x"></i>
                    <span>Belum ada template</span>
                    {isAdmin && (
                      <label className="surat-upload-zone">
                        <input
                          type="file"
                          accept=".docx"
                          onChange={handleUpload}
                          data-type={group.key}
                        />
                        <i className="bi bi-upload"></i>
                        <span>Klik untuk upload</span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="surat-list">
                    {group.items.map(tm => (
                      <div key={tm.id} className={`surat-item ${tm.is_default ? 'is-default' : ''}`}>
                        <div className="surat-item-info">
                          <div className="surat-item-name">
                            {tm.name}
                            {tm.is_default && <span className="surat-badge-default">Default</span>}
                          </div>
                          {tm.description && (
                            <div className="surat-item-desc">{tm.description}</div>
                          )}
                          <div className="surat-item-meta">
                            Diupload: {new Date(tm.created_at).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                        <div className="surat-item-actions">
                          <button
                            className="surat-action-btn"
                            title="Download"
                            onClick={() => handleDownload(tm)}
                          >
                            <i className="bi bi-download"></i>
                          </button>
                          {!tm.is_default && isAdmin && (
                            <>
                              <button
                                className="surat-action-btn"
                                title="Set sebagai Default"
                                onClick={() => handleSetDefault(tm)}
                              >
                                <i className="bi bi-star"></i>
                              </button>
                              <button
                                className="surat-action-btn surat-action-btn--danger"
                                title="Hapus"
                                onClick={() => handleDelete(tm)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </>
                          )}
                          {isAdmin && !tm.is_default && (
                            <label className="surat-action-btn" title="Ganti Template">
                              <input
                                type="file"
                                accept=".docx"
                                onChange={handleUpload}
                                data-type={tm.type}
                                style={{ display: 'none' }}
                              />
                              <i className="bi bi-arrow-repeat"></i>
                            </label>
                          )}
                        </div>
                      </div>
                    ))}

                    {isAdmin && (
                      <label className="surat-add-btn">
                        <input
                          type="file"
                          accept=".docx"
                          onChange={handleUpload}
                          data-type={group.key}
                        />
                        <i className="bi bi-plus"></i>
                        Tambah Template
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => setDeleteTarget(null)}
          labelledBy="surat-delete-title"
        >
          <ModalHeader
            id="surat-delete-title"
            icon="trash3"
            title={deleteTarget.name}
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
        .surat-tab-wrap {
          padding: 0;
        }

        .surat-tab-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px 24px;
          background: linear-gradient(135deg, #3083FF 0%, #00287a 100%);
          border-radius: 16px;
          margin-bottom: 16px;
          color: white;
        }

        .surat-tab-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0 0 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .surat-tab-desc {
          font-size: 0.85rem;
          opacity: 0.9;
          margin: 0;
        }

        .surat-tab-actions {
          display: flex;
          gap: 8px;
        }

        .surat-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .surat-btn--outline {
          background: rgba(255,255,255,0.15);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .surat-btn--outline:hover {
          background: rgba(255,255,255,0.25);
        }

        .surat-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px;
          color: var(--n-text-muted, #888);
        }

        .surat-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e5e7eb;
          border-top-color: #3083FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .surat-groups {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .surat-group {
          background: var(--n-card, #fff);
          border: 1px solid var(--n-border, #e5e7eb);
          border-radius: 14px;
          overflow: hidden;
        }

        .surat-group-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid var(--n-border, #e5e7eb);
          border-left: 4px solid;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .surat-count {
          margin-left: auto;
          background: #e5e7eb;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #666;
        }

        .surat-group-body {
          padding: 12px;
        }

        .surat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          color: var(--n-text-muted, #888);
          gap: 8px;
        }

        .surat-empty i {
          font-size: 2rem;
          opacity: 0.5;
        }

        .surat-upload-zone {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border: 2px dashed #d1d5db;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.85rem;
          color: #666;
          transition: all 0.2s;
        }

        .surat-upload-zone:hover {
          border-color: #3083FF;
          color: #3083FF;
          background: rgba(0, 56, 168, 0.05);
        }

        .surat-upload-zone input {
          display: none;
        }

        .surat-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .surat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border: 1px solid var(--n-border, #e5e7eb);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .surat-item:hover {
          border-color: #3083FF;
          box-shadow: 0 2px 8px rgba(0, 56, 168, 0.1);
        }

        .surat-item.is-default {
          background: linear-gradient(135deg, rgba(0, 56, 168, 0.05) 0%, rgba(0, 56, 168, 0.02) 100%);
          border-color: rgba(0, 56, 168, 0.2);
        }

        .surat-item-info {
          flex: 1;
        }

        .surat-item-name {
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .surat-badge-default {
          background: #3083FF;
          color: white;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
        }

        .surat-item-desc {
          font-size: 0.8rem;
          color: #666;
          margin-top: 2px;
        }

        .surat-item-meta {
          font-size: 0.75rem;
          color: #999;
          margin-top: 4px;
        }

        .surat-item-actions {
          display: flex;
          gap: 4px;
        }

        .surat-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: #f3f4f6;
          color: #666;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.85rem;
        }

        .surat-action-btn:hover {
          background: #3083FF;
          color: white;
        }

        .surat-action-btn input {
          display: none;
        }

        .surat-action-btn--danger:hover {
          background: #dc2626;
          color: white;
        }

        .surat-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border: 2px dashed #d1d5db;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.85rem;
          color: #666;
          transition: all 0.2s;
        }

        .surat-add-btn:hover {
          border-color: #3083FF;
          color: #3083FF;
          background: rgba(0, 56, 168, 0.05);
        }

        .surat-add-btn input {
          display: none;
        }

        @media (max-width: 640px) {
          .surat-tab-header {
            flex-direction: column;
            gap: 12px;
          }

          .surat-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .surat-item-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  )
}
