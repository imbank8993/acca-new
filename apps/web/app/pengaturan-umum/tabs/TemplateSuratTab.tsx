'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { getCurrentUser } from '@/lib/auth-client'
import Swal from 'sweetalert2'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { downloadBlob, downloadFileName, extensionFromMime, extensionFromUrl } from '@/lib/storage/download'

// ── Template type definitions ──────────────────────────────
interface TemplateRecord {
  id: string
  nama_template: string | null
  jenis_surat: string
  description: string | null
  template_html: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface TemplateTypeDef {
  key: string
  label: string
  desc: string
  icon: string
  color: string
}

// Templates that only accept image formats
const IMAGE_ONLY_TYPES = ['MENINGGALKAN_ASRAMA', 'REKOMENDASI_KONTROL', 'REKAM_MEDIK']

// Satu sumber untuk atribut `accept` DAN validasi sebelum unggah. Dulu keduanya
// ditulis terpisah, jadi bisa berbeda diam-diam: dialog memperbolehkan sebuah
// format, lalu berkasnya ditolak sesudah dipilih.
const EKSTENSI_GAMBAR = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const EKSTENSI_DOKUMEN = ['docx', 'html', 'htm']

const ekstensiUntuk = (jenisSurat: string) =>
  IMAGE_ONLY_TYPES.includes(jenisSurat) ? EKSTENSI_GAMBAR : EKSTENSI_DOKUMEN

const acceptUntuk = (jenisSurat: string) =>
  ekstensiUntuk(jenisSurat).map(e => `.${e}`).join(',')

// Nama berkas unduhan: `nama_template` disimpan TANPA ekstensi (lihat
// app/api/surat/templates/route.ts), jadi ekstensinya dipasang ulang saat
// mengunduh — dan harus ekstensi yang SEBENARNYA, bukan ditebak dari "ini
// gambar atau bukan". Helper-nya di lib/storage/download.ts.
const namaUnduhan = (tm: TemplateRecord, ext: string) =>
  downloadFileName(tm.nama_template || tm.jenis_surat, ext, 'template')

const TEMPLATE_TYPES: TemplateTypeDef[] = [
  { key: 'IZIN_SINGLE',           label: 'Surat Izin Personal',         desc: 'Surat izin perorangan',                          icon: 'bi-person-badge',          color: '#3083FF' },
  { key: 'IZIN_GROUP',             label: 'Surat Izin Kolektif',         desc: 'Surat izin dengan lampiran daftar siswa',         icon: 'bi-people-fill',           color: '#3083FF' },
  { key: 'TUGAS_SINGLE',          label: 'Surat Tugas Personal',          desc: 'Surat tugas perorangan',                         icon: 'bi-briefcase-fill',        color: '#3083FF' },
  { key: 'TUGAS_GROUP',           label: 'Surat Tugas Kolektif',         desc: 'Surat tugas dengan lampiran daftar guru',         icon: 'bi-collection',            color: '#3083FF' },
  { key: 'MENINGGALKAN_ASRAMA',    label: 'Izin Keasramaan',            desc: 'Surat izin keasramaan (Izin & Sakit)',           icon: 'bi-house-door-fill',       color: '#3083FF' },
  { key: 'REKOMENDASI_KONTROL',   label: 'Surat Rekomendasi',           desc: 'Surat rekomendasi perawatan / kontrol siswa',     icon: 'bi-clipboard-check-fill',  color: '#3083FF' },
  { key: 'REKAM_MEDIK',            label: 'Rekam Medik',                 desc: 'Surat keterangan rekam medik / kesehatan',      icon: 'bi-heart-pulse-fill',      color: '#3083FF' },
]

const swalSuccess = (title: string, text?: string) => Swal.fire({
  title, text, icon: 'success', confirmButtonText: 'OK',
  confirmButtonColor: '#3083FF', customClass: { popup: 'swal-compact', confirmButton: 'swal-btn-primary' }
})

const swalError = (title: string, text?: string) => Swal.fire({
  title, text, icon: 'error', confirmButtonText: 'OK',
  confirmButtonColor: '#dc2626', customClass: { popup: 'swal-compact', confirmButton: 'swal-btn-danger' }
})

// ── View Modal ───────────────────────────────────────────────
function ViewModal({
  template,
  onClose,
}: {
  template: TemplateRecord
  onClose: () => void
}) {
  const isUrl = template.template_html?.startsWith('http')
  const isHtml = !isUrl && (template.template_html || '').trim().startsWith('<')
  const isImage = isUrl && /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(template.template_html || '')

  return (
    <Modal
      size="lg"
      variant="add"
      onClose={onClose}
      labelledBy="view-template-modal-title"
    >
      <ModalHeader
        id="view-template-modal-title"
        icon="eye"
        title={`Preview: ${template.nama_template || template.jenis_surat}`}
        onClose={onClose}
      />
      <ModalBody>
        {isUrl ? (
          isImage ? (
            <div className="tsrt-modal-image-wrap">
              <img
                src={template.template_html || undefined}
                alt={template.nama_template || template.jenis_surat}
                className="tsrt-modal-image"
              />
              <a
                href={template.template_html || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="tsrt-modal-open-link"
              >
                <i className="bi bi-download"></i> Buka / Unduh
              </a>
            </div>
          ) : (
            <div className="tsrt-modal-info">
              <i className="bi bi-file-earmark-word"></i>
              <div>
                <div className="tsrt-modal-info-title">File .docx tersimpan di storage</div>
                <div className="tsrt-modal-info-url">{template.template_html}</div>
              </div>
              <a
                href={template.template_html || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="tsrt-modal-open-link"
              >
                <i className="bi bi-download"></i> Buka / Unduh
              </a>
            </div>
          )
        ) : isHtml ? (
          <iframe
            srcDoc={template.template_html || ''}
            className="tsrt-modal-iframe"
            title="Template Preview"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="tsrt-modal-info">
            <i className="bi bi-file-text"></i>
            <div>
              <div className="tsrt-modal-info-title">Konten template tidak ditemukan</div>
              <div className="tsrt-modal-info-url">Template mungkin kosong atau format tidak dikenali.</div>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="cancel" type="button" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>
          Tutup
        </Button>
      </ModalFooter>
    </Modal>
  )
}

// ── Main Component ──────────────────────────────────────────
export default function TemplateSuratTab({ user }: { user?: any }) {
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [viewTarget, setViewTarget] = useState<TemplateRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null)

  const { openModal, closeModal } = useModalBlur()

  // SATU input berkas untuk seluruh tabel, dibuka lewat ref.
  //
  // Sebelumnya tiap baris membungkus `<input type="file">` tersembunyi dan
  // sebuah <ActionButton> di dalam satu <label>. Itu tidak pernah bisa bekerja:
  // ActionButton merender <button>, dan spesifikasi HTML menyatakan klik pada
  // "interactive content" di dalam <label> TIDAK meneruskan aktivasi ke kontrol
  // yang dilabeli. Jadi ikon "Ganti template" tampak normal tapi diam saja.
  //
  // `jenisTarget` disimpan di ref, bukan state: `.click()` dipanggil di baris
  // yang sama dengan penyetelannya, sementara state baru terlihat setelah render
  // berikutnya — dialog akan terbuka membawa target yang lama.
  const inputBerkasRef = useRef<HTMLInputElement>(null)
  const jenisTargetRef = useRef<string>('')

  const pilihBerkas = (jenisSurat: string) => {
    const el = inputBerkasRef.current
    if (!el) return
    jenisTargetRef.current = jenisSurat
    el.accept = acceptUntuk(jenisSurat)
    // Dikosongkan supaya memilih berkas yang SAMA dua kali tetap memicu onChange.
    el.value = ''
    el.click()
  }

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  useEffect(() => {
    if (viewTarget || deleteTarget) openModal()
    else closeModal()
    return () => closeModal()
  }, [viewTarget, deleteTarget, openModal, closeModal])

  const checkAdminAndLoad = async () => {
    const userData = await getCurrentUser()
    if (userData) {
      const adminStatus = (userData.roles || []).some((r: string) => {
        const n = r.toUpperCase().trim()
        return n === 'ADMIN' || n === 'ADMINISTRATOR'
      }) || !!(userData as any).isAdmin || false
      setIsAdmin(adminStatus)
    }
    await loadTemplates()
  }

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/surat/templates')
      const json = await res.json()
      if (json.ok && json.data) setTemplates(json.data)
    } catch (e) { console.error('[TemplateSuratTab] Load error:', e) }
    finally { setLoading(false) }
  }, [])

  const getTemplateForType = (key: string) =>
    templates.find(t => t.jenis_surat === key && t.is_active)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, jenisSurat: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowedExts = ekstensiUntuk(jenisSurat)
    if (!allowedExts.includes(ext || '')) {
      const daftar = allowedExts.map(x => `.${x}`).join('/')
      const msg = IMAGE_ONLY_TYPES.includes(jenisSurat)
        ? `Hanya file gambar (${daftar}) yang diizinkan untuk template ini`
        : `Hanya file ${daftar} yang diizinkan`
      Swal.fire('Error', msg, 'error')
      e.target.value = ''
      return
    }

    setUploading(jenisSurat)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', jenisSurat)
      const res = await fetch('/api/surat/templates', { method: 'POST', body: formData })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      await loadTemplates()
      await swalSuccess('Berhasil', 'Template berhasil diupload')
    } catch (err: any) { await swalError('Gagal', err.message) }
    finally { setUploading(null); e.target.value = '' }
  }

  const handleDelete = (tm: TemplateRecord) => {
    setDeleteTarget(tm)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(deleteTarget.id)
    try {
      const res = await fetch(`/api/surat/templates/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setDeleteTarget(null)
      await loadTemplates()
      await swalSuccess('Berhasil', 'Template dihapus')
    } catch (err: any) { await swalError('Gagal', err.message) }
    finally { setDeleting(null) }
  }

  const handleDownload = async (tm: TemplateRecord) => {
    try {
      if (tm.template_html?.startsWith('http')) {
        // LEWAT PROXY, bukan fetch langsung ke URL penyimpanan.
        //
        // Berkas template ada di Cloudflare Worker yang TIDAK mengirim
        // Access-Control-Allow-Origin, jadi `fetch()` lintas-asal dari halaman
        // ini selalu gagal dengan TypeError "Failed to fetch" — berkasnya sendiri
        // baik-baik saja (HTTP 200), yang menolak adalah browser. /api/pdf-proxy
        // mengambilnya di sisi server lalu menyajikannya satu asal dengan
        // halaman; jalur yang sama sudah dipakai PDFViewer & Dokumen Siswa.
        const res = await fetch(`/api/pdf-proxy?url=${encodeURIComponent(tm.template_html)}`)
        if (!res.ok) throw new Error('Gagal mengambil file dari penyimpanan')
        const blob = await res.blob()
        // Ekstensi diambil dari URL ASLI (bukan URL proxy) — di situlah nama
        // berkas sebenarnya berada. Sebelumnya semua gambar diunduh sebagai
        // `.png`, jadi template .webp/.jpg turun dengan nama yang berbohong.
        const ext = extensionFromUrl(tm.template_html) || extensionFromMime(blob.type)
        downloadBlob(blob, namaUnduhan(tm, ext))
      } else {
        // Cabang ini isinya HTML mentah di kolom DB, bukan URL. Ejaan aslinya
        // (.html vs .htm) tidak tersimpan di mana pun — nama_template sudah
        // dipangkas saat unggah — jadi .html dipakai untuk keduanya.
        downloadBlob(new Blob([tm.template_html || ''], { type: 'text/html' }), namaUnduhan(tm, '.html'))
      }
    } catch (err: any) { await swalError('Gagal', err.message) }
  }

  const uploadedCount = TEMPLATE_TYPES.filter(t => getTemplateForType(t.key)).length

  // Enriched rows for the table
  const tableRows = TEMPLATE_TYPES.map((t, i) => ({ ...t, no: i + 1, template: getTemplateForType(t.key) }))

  return (
    <div className="tsrt-wrap">
      {/* Satu input berkas untuk semua baris; dibuka lewat `pilihBerkas()`.
          `accept` dipasang imperatif tepat sebelum dialog dibuka, karena ia
          berbeda per jenis surat. */}
      <input
        ref={inputBerkasRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => handleUpload(e, jenisTargetRef.current)}
      />

      {/* ── Loading ── */}
      {loading ? (
        <div className="tsrt-loading">
          <Spinner variant="trace" />
        </div>
      ) : (
        <>
          {/* ── Table ── */}
          <div className="tsrt-table-wrap">
            <table className="tsrt-table">
              <thead>
                <tr>
                  <th className="tsrt-th tsrt-th--no">No</th>
                  <th className="tsrt-th tsrt-th--name">Nama Template</th>
                  <th className="tsrt-th tsrt-th--file">Nama File</th>
                  <th className="tsrt-th tsrt-th--actions">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(row => (
                  <tr key={row.key} className={`tsrt-row ${row.template ? 'tsrt-row--filled' : ''}`}>
                    {/* No */}
                    <td className="tsrt-td tsrt-td--no">
                      <span className="tsrt-no-badge">{row.no}</span>
                    </td>

                    {/* Nama Template */}
                    <td className="tsrt-td tsrt-td--name">
                      <div className="tsrt-name-cell">
                        <div
                          className="tsrt-name-icon"
                          style={{ background: `${row.color}18`, color: row.color }}
                        >
                          <i className={`bi ${row.icon}`}></i>
                        </div>
                        <div>
                          <div className="tsrt-name-label">{row.label}</div>
                          <div className="tsrt-name-desc">{row.desc}</div>
                        </div>
                      </div>
                    </td>

                    {/* Nama File */}
                    <td className="tsrt-td tsrt-td--file">
                      {row.template ? (
                        <div className="tsrt-file-cell">
                          {(() => {
                            const isImg = row.template!.template_html?.startsWith('http') &&
                              /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(row.template!.template_html || '')
                            return (
                              <>
                                <i className={`bi ${isImg ? 'bi-file-earmark-image' : 'bi-file-earmark-word'}`} style={{ color: row.color }}></i>
                                <div className="tsrt-file-info">
                                  <div className="tsrt-file-name">{row.template.nama_template || '—'}</div>
                                  <div className="tsrt-file-date">
                                    Diupload {new Date(row.template.created_at).toLocaleDateString('id-ID', {
                                      day: '2-digit', month: 'short', year: 'numeric'
                                    })}
                                  </div>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      ) : (
                        <span className="tsrt-file-empty">
                          <i className="bi bi-dash-lg"></i>
                          <span>Belum ada file</span>
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="tsrt-td tsrt-td--actions">
                      {row.template ? (
                        <ActionGroup className="tsrt-actions">
                          {/* View */}
                          <ActionButton
                            action="view"
                            title="Lihat template"
                            onClick={() => setViewTarget(row.template!)}
                          />

                          {/* Download */}
                          <ActionButton
                            action="download"
                            title="Unduh template"
                            onClick={() => handleDownload(row.template!)}
                          />

                          {/* Replace (admin only) */}
                          {isAdmin && (
                            <ActionButton
                              action="replace"
                              title="Ganti template"
                              isLoading={uploading === row.key}
                              disabled={uploading === row.key}
                              onClick={() => pilihBerkas(row.key)}
                            />
                          )}

                          {/* Delete (admin only) */}
                          {isAdmin && (
                            <ActionButton
                              action="delete"
                              title="Hapus template"
                              disabled={deleting === row.template!.id}
                              onClick={() => handleDelete(row.template!)}
                            />
                          )}
                        </ActionGroup>
                      ) : (
                        <div className="tsrt-actions">
                          {isAdmin ? (
                            <Button
                              variant="primary"
                              size="sm"
                              type="button"
                              isLoading={uploading === row.key}
                              leftIcon={<i className="bi bi-cloud-arrow-up" />}
                              onClick={() => pilihBerkas(row.key)}
                            >
                              Upload
                            </Button>
                          ) : (
                            <span className="tsrt-no-upload">
                              <i className="bi bi-shield-lock"></i>
                              Admin only
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Help text ── */}
          <div className="tsrt-help">
            <i className="bi bi-info-circle"></i>
            <div>
              <div>Format file yang didukung:</div>
              <div style={{ marginTop: 4 }}>
                <strong>.docx</strong>, .html, .htm — untuk template surat biasa
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>.png/.jpg/.jpeg/.webp/.gif</strong> — untuk Surat Izin Meninggalkan Asrama, Rekomendasi, dan Rekam Medik
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── View Modal ── */}
      {viewTarget && <ViewModal template={viewTarget} onClose={() => setViewTarget(null)} />}

      {/* ── Delete Modal ── */}
      {deleteTarget && (
        <Modal
          size="sm"
          variant="delete"
          onClose={() => setDeleteTarget(null)}
          labelledBy="template-delete-title"
        >
          <ModalHeader
            id="template-delete-title"
            icon="trash3"
            title={deleteTarget.nama_template || deleteTarget.jenis_surat}
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
              isLoading={deleting === deleteTarget.id}
              leftIcon={<i className="bi bi-trash3-fill" />}
            >
              Ya, Hapus
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <style jsx>{`
        /* ── Wrapper ── */
        .tsrt-wrap { padding: 0; }

        /* ── Header ── */
        .tsrt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: linear-gradient(135deg, #3083FF 0%, #00287a 100%);
          border-radius: 16px;
          margin-bottom: 20px;
          color: white;
        }
        .tsrt-header-left { display: flex; align-items: center; gap: 14px; }
        .tsrt-header-icon {
          width: 48px; height: 48px;
          background: rgba(255,255,255,0.2);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; flex-shrink: 0;
        }
        .tsrt-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 2px; }
        .tsrt-desc {
          font-size: 0.82rem; opacity: 0.88; margin: 0;
          display: flex; align-items: center; gap: 8px;
        }
        .tsrt-count-badge {
          background: rgba(255,255,255,0.25); padding: 1px 8px;
          border-radius: 999px; font-size: 0.75rem; font-weight: 700;
        }

        /* ── Loading ── */
        .tsrt-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; padding: 80px; color: #888; font-size: 0.9rem;
        }
        .tsrt-spinner {
          width: 26px; height: 26px;
          border: 3px solid #e5e7eb; border-top-color: #3083FF;
          border-radius: 50%; animation: tsrt-spin 0.8s linear infinite;
        }
        @keyframes tsrt-spin { to { transform: rotate(360deg); } }

        /* ── Table ── */
        .tsrt-table-wrap {
          background: var(--n-card);
          border: 1px solid var(--n-border);
          border-radius: 16px;
          overflow: hidden;
          overflow-x: auto;
          margin-bottom: 16px;
        }
        .tsrt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        /* Header */
        .tsrt-th {
          background: var(--n-soft);
          padding: 12px 16px;
          text-align: left;
          font-weight: 700;
          font-size: 0.78rem;
          color: var(--n-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 2px solid var(--n-border);
          white-space: nowrap;
        }
        .tsrt-th--no { width: 56px; text-align: center; }
        .tsrt-th--name { min-width: 220px; }
        .tsrt-th--file { min-width: 200px; }
        .tsrt-th--actions { width: 280px; text-align: center; }

        /* Row */
        .tsrt-row {
          border-bottom: 1px solid var(--n-border);
          transition: background 0.15s;
        }
        .tsrt-row:last-child { border-bottom: none; }
        .tsrt-row:hover { background: #fafafc; }
        .tsrt-row--filled { background: transparent; }

        /* Cell */
        .tsrt-td {
          padding: 14px 16px;
          vertical-align: middle;
          color: var(--n-text);
        }
        .tsrt-td--no { text-align: center; }
        .tsrt-td--actions { text-align: center; }

        /* No badge */
        .tsrt-no-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px; height: 28px;
          background: var(--n-soft);
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.78rem;
          color: var(--n-muted);
        }

        /* Name cell */
        .tsrt-name-cell { display: flex; align-items: center; gap: 12px; }
        .tsrt-name-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; flex-shrink: 0;
        }
        .tsrt-name-label { font-weight: 600; font-size: 0.875rem; color: var(--n-text); }
        .tsrt-name-desc { font-size: 0.74rem; color: var(--n-muted); margin-top: 1px; }

        /* File cell */
        .tsrt-file-cell { display: flex; align-items: center; gap: 10px; }
        .tsrt-file-cell > i { font-size: 1.2rem; flex-shrink: 0; }
        .tsrt-file-info { text-align: left; }
        .tsrt-file-name { font-weight: 600; font-size: 0.85rem; }
        .tsrt-file-date { font-size: 0.72rem; color: var(--n-muted); margin-top: 2px; }
        .tsrt-file-empty {
          display: flex; align-items: center; gap: 6px;
          color: #cbd5e1; font-size: 0.82rem;
        }

        /* Actions */
        .tsrt-actions { display: flex; align-items: center; justify-content: center; gap: 6px; }

        /* Action buttons */
        .tsrt-btn {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid var(--n-border);
          background: var(--n-soft);
          color: var(--n-muted);
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.18s;
          white-space: nowrap;
          line-height: 1;
        }
        .tsrt-btn:hover { opacity: 0.85; }
        .tsrt-btn:disabled { pointer-events: none; opacity: 0.5; }

        /* View button — uses row color accent */
        .tsrt-btn--view {
          background: color-mix(in srgb, var(--row-color) 10%, white);
          border-color: var(--row-color);
          color: var(--row-color);
        }
        .tsrt-btn--view:hover { background: var(--row-color); color: white; }

        /* Download */
        .tsrt-btn--download:hover { background: #1d6bf3; border-color: #1d6bf3; color: white; }

        /* Replace */
        .tsrt-btn--replace:hover { background: #3083ff; border-color: #3083ff; color: white; }

        /* Delete */
        .tsrt-btn--delete:hover { background: #dc2626; border-color: #dc2626; color: white; }


        /* Upload (empty state) */
        .tsrt-btn--upload {
          background: var(--row-color, #3083FF);
          border-color: var(--row-color, #3083FF);
          color: white;
        }
        .tsrt-btn--upload:hover { opacity: 0.88; }

        /* Spinner */
        .tsrt-btn-spinner {
          display: inline-block;
          width: 12px; height: 12px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: tsrt-spin 0.6s linear infinite;
        }
        .tsrt-btn-spinner--white { border-color: white; border-top-color: transparent; }

        /* No admin */
        .tsrt-no-upload {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.75rem; color: var(--n-muted);
        }

        /* Help */
        .tsrt-help {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 14px 16px;
          background: var(--n-soft);
          border-radius: 12px;
          font-size: 0.8rem; color: var(--n-muted);
          line-height: 1.5;
          border: 1px solid var(--n-border);
        }
        .tsrt-help i { color: #0284c7; margin-top: 1px; flex-shrink: 0; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .tsrt-header-icon { width: 38px; height: 38px; font-size: 1.15rem; border-radius: 10px; }
          .tsrt-count-badge { border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; }
          .tsrt-desc { flex-direction: column; align-items: flex-start; gap: 8px; }
          .tsrt-table thead { display: none; }
          .tsrt-table, .tsrt-table tbody, .tsrt-row, .tsrt-td { display: block; width: 100%; box-sizing: border-box; }
          .tsrt-row { padding: 16px; position: relative; border-bottom: 1px solid var(--n-border); }
          .tsrt-td { padding: 0 !important; border: none !important; text-align: left !important; }
          
          .tsrt-td--no { position: absolute; top: 16px; right: 16px; }
          .tsrt-td--name { margin-bottom: 16px; padding-right: 44px !important; }
          
          .tsrt-td--file { 
            margin-bottom: 16px; 
            padding: 12px !important; 
            background: rgba(148, 163, 184, 0.08); 
            border-radius: 12px; 
            border: 1px dashed var(--n-border); 
          }
          
          .tsrt-actions { justify-content: flex-start; flex-wrap: wrap; gap: 8px; }
          .tsrt-btn { flex: 1 1 calc(50% - 4px); justify-content: center; padding: 10px 4px; font-size: 0.82rem; }
        }

        /* ── Dark Mode ── */
        :global(.dark) .tsrt-table-wrap {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
        }
        :global(.dark) .tsrt-th {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .tsrt-row {
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
        }
        :global(.dark) .tsrt-row:hover {
          background: rgba(26, 115, 232, 0.08) !important;
        }
        :global(.dark) .tsrt-td {
          color: #cbd5e1 !important;
        }
        :global(.dark) .tsrt-no-badge {
          background: rgba(26, 115, 232, 0.15) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .tsrt-name-label {
          color: #e2e8f0 !important;
        }
        :global(.dark) .tsrt-name-desc, :global(.dark) .tsrt-file-date {
          color: #94a3b8 !important;
        }
        :global(.dark) .tsrt-file-name {
          color: #e2e8f0 !important;
        }

        :global(.dark) .tsrt-file-empty {
          color: #64748b !important;
        }
        :global(.dark) .tsrt-name-icon {
          background: rgba(26, 115, 232, 0.15) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .tsrt-file-cell > i {
          color: #60a5fa !important;
        }
        :global(.dark) .tsrt-btn {
          background: #000000 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .tsrt-btn:hover {
          color: #ffffff !important;
        }
        :global(.dark) .tsrt-btn--view {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .tsrt-btn--view:hover {
          background: #1a73e8 !important;
          color: #ffffff !important;
          border-color: #3b82f6 !important;
        }
        :global(.dark) .tsrt-btn--download:hover,
        :global(.dark) .tsrt-btn--replace:hover {
          background: #1a73e8 !important;
          border-color: #3b82f6 !important;
          color: #ffffff !important;
        }
        :global(.dark) .tsrt-btn--upload {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          border: 1px solid rgba(59, 130, 246, 0.6) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .tsrt-help {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          border-radius: 12px !important;
          color: #94a3b8 !important;
        }

        :global(.dark) .tsrt-modal {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
        }
        :global(.dark) .tsrt-modal-info {
          background: #000000 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .tsrt-modal-info-title {
          color: #ffffff !important;
        }

      `}</style>
    </div>
  )
}

