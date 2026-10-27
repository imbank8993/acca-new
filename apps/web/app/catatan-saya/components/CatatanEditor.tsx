'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  Pin, Archive, Trash2, RotateCcw, Copy, Calendar, Clock, MapPin,
  X, AlertTriangle, Check, Loader2, XCircle, Tag, Palette
} from 'lucide-react'
import CatatanBlockEditor from './CatatanBlockEditor'
import type { Catatan, CatatanBlock, CatatanJenis, CatatanWarna } from '../types'
import { WARNA_OPTIONS } from '../types'
import Swal from 'sweetalert2'

interface CatatanEditorProps {
  catatan: Catatan | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function CatatanEditor({ catatan: initialCatatan, isOpen, onClose, onSaved, onDeleted }: CatatanEditorProps) {
  const [catatan, setCatatan] = useState<Catatan | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [conflictData, setConflictData] = useState<Catatan | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [newLabelInput, setNewLabelInput] = useState('')
  const [showWarnaMenu, setShowWarnaMenu] = useState(false)
  const [allLabels, setAllLabels] = useState<string[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')
  const currentRef = useRef<Catatan | null>(null)
  const revisionRef = useRef(0)
  const savedRevisionRef = useRef(0)
  const savePromiseRef = useRef<Promise<boolean> | null>(null)
  const conflictRef = useRef(false)

  // Load catatan into local state
  useEffect(() => {
    if (initialCatatan) {
      currentRef.current = { ...initialCatatan }
      revisionRef.current = savedRevisionRef.current = 0
      conflictRef.current = false
      setCatatan(currentRef.current)
      lastSavedRef.current = JSON.stringify(initialCatatan)
      setHasUnsavedChanges(false)
      setSaveStatus('idle')
      setConflictData(null)
    }
  }, [initialCatatan])

  // Fetch all labels for autocomplete
  useEffect(() => {
    if (!isOpen) return
    fetch('/api/catatan-saya/labels')
      .then(r => r.json())
      .then(d => { if (d.success) setAllLabels(d.data || []) })
      .catch(() => {})
  }, [isOpen])

  // Unsaved changes warning
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const doSave = useCallback((_data: Catatan): Promise<boolean> => {
    if (savePromiseRef.current) return savePromiseRef.current
    if (conflictRef.current) return Promise.resolve(false)
    const run = async (): Promise<boolean> => {
      setSaveStatus('saving')
      try {
        // Serialize writes. Edits made while a request is in flight are sent next,
        // using the version returned by that request.
        while (currentRef.current) {
          const data = currentRef.current
          const revision = revisionRef.current
          const res = await fetch(`/api/catatan-saya/${data.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ judul: data.judul, isi: data.isi, jenis: data.jenis,
              label: data.label, warna: data.warna, tanggal_agenda: data.tanggal_agenda,
              waktu_agenda: data.waktu_agenda, tempat_agenda: data.tempat_agenda, version: data.version }),
          })
          const result = await res.json()
          if (currentRef.current?.id !== data.id) return false
          if (res.status === 409) {
            conflictRef.current = true
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
            setConflictData(result.serverData || result.data || result.currentData || null)
            setSaveStatus('error')
            setHasUnsavedChanges(true)
            return false
          }
          if (!res.ok) throw new Error('Gagal menyimpan catatan')
          currentRef.current = { ...currentRef.current, version: result.data.version,
            updated_at: result.data.updated_at }
          setCatatan(currentRef.current)
          savedRevisionRef.current = revision
          if (revisionRef.current !== revision) continue
          setHasUnsavedChanges(false)
          setSaveStatus('saved')
          onSaved()
          return true
        }
        return false
      } catch {
        setSaveStatus('error')
        setHasUnsavedChanges(true)
        return false
      }
    }
    const pending = run().finally(() => { savePromiseRef.current = null })
    savePromiseRef.current = pending
    return pending
  }, [onSaved])

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setHasUnsavedChanges(true)
    setSaveStatus('idle')
    saveTimerRef.current = setTimeout(() => {
      if (currentRef.current && revisionRef.current !== savedRevisionRef.current) void doSave(currentRef.current)
    }, 1500)
  }, [doSave])

  const updateField = useCallback(<K extends keyof Catatan>(field: K, value: Catatan[K]) => {
    if (!currentRef.current) return
    currentRef.current = { ...currentRef.current, [field]: value }
    revisionRef.current++
    setCatatan(currentRef.current)
    scheduleAutoSave()
  }, [scheduleAutoSave])

  const retrySave = useCallback(() => {
    if (catatan) doSave(catatan)
  }, [catatan, doSave])

  const handleAcceptServerVersion = useCallback(() => {
    if (conflictData) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      conflictRef.current = false
      currentRef.current = conflictData
      savedRevisionRef.current = revisionRef.current
      setCatatan(conflictData)
      lastSavedRef.current = JSON.stringify(conflictData)
      setHasUnsavedChanges(false)
      setConflictData(null)
      setSaveStatus('idle')
    }
  }, [conflictData])

  const handleSaveAsCopy = useCallback(async () => {
    if (!catatan) return
    try {
      const res = await fetch('/api/catatan-saya', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: catatan.judul + ' (salinan)',
          isi: catatan.isi,
          jenis: catatan.jenis,
          label: catatan.label,
          warna: catatan.warna,
          tanggal_agenda: catatan.tanggal_agenda,
          waktu_agenda: catatan.waktu_agenda,
          tempat_agenda: catatan.tempat_agenda,
        }),
      })
      if (res.ok) {
        const result = await res.json()
        currentRef.current = result.data
        setCatatan(result.data)
        savedRevisionRef.current = revisionRef.current
        conflictRef.current = false
        setConflictData(null)
        setSaveStatus('saved')
        setHasUnsavedChanges(false)
        onSaved()
        Swal.fire({ icon: 'success', title: 'Disimpan sebagai salinan', timer: 1500, showConfirmButton: false })
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal menyimpan salinan' })
    }
  }, [catatan, onSaved])

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!catatan) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (revisionRef.current !== savedRevisionRef.current && !await doSave(catatan)) return
    try {
      const res = await fetch(`/api/catatan-saya/${catatan.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        onSaved()
        onClose()
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal mengubah status' })
    }
  }, [catatan, doSave, onSaved, onClose])

  const handleRestore = useCallback(async () => {
    if (!catatan) return
    try {
      const res = await fetch(`/api/catatan-saya/${catatan.id}/restore`, { method: 'PUT' })
      if (res.ok) {
        onSaved()
        onClose()
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal memulihkan' })
    }
  }, [catatan, onSaved, onClose])

  const handlePermanentDelete = useCallback(async () => {
    if (!catatan) return
    const result = await Swal.fire({
      title: 'Hapus permanen?',
      text: 'Catatan ini tidak dapat dipulihkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Ya, hapus permanen',
      cancelButtonText: 'Batal',
    })
    if (!result.isConfirmed) return
    try {
      const res = await fetch(`/api/catatan-saya/${catatan.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDeleted()
        onClose()
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal menghapus' })
    }
  }, [catatan, onDeleted, onClose])

  const handleCopyDraft = useCallback(() => {
    if (!catatan) return
    const lines: string[] = []
    if (catatan.judul) lines.push(catatan.judul, '')
    if (catatan.jenis === 'draft_agenda') {
      if (catatan.tanggal_agenda) lines.push(`Tanggal: ${catatan.tanggal_agenda}`)
      if (catatan.waktu_agenda) lines.push(`Waktu: ${catatan.waktu_agenda}`)
      if (catatan.tempat_agenda) lines.push(`Tempat: ${catatan.tempat_agenda}`)
      if (catatan.tanggal_agenda || catatan.waktu_agenda || catatan.tempat_agenda) lines.push('')
    }
    for (const block of catatan.isi) {
      if (block.type === 'checklist') {
        lines.push(`${block.checked ? '[x]' : '[ ]'} ${block.text}`)
      } else if (block.type === 'list-item') {
        lines.push(`• ${block.text}`)
      } else {
        lines.push(block.text)
      }
    }
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => Swal.fire({ icon: 'success', title: 'Disalin ke clipboard', timer: 1200, showConfirmButton: false }))
      .catch(() => Swal.fire({ icon: 'error', title: 'Gagal menyalin' }))
  }, [catatan])

  const handleAddLabel = useCallback(() => {
    const label = newLabelInput.trim()
    if (!label || !catatan) return
    if (catatan.label.includes(label)) return
    if (catatan.label.length >= 10) {
      Swal.fire({ icon: 'warning', title: 'Maksimal 10 label' })
      return
    }
    updateField('label', [...catatan.label, label])
    setNewLabelInput('')
  }, [newLabelInput, catatan, updateField])

  const handleRemoveLabel = useCallback((label: string) => {
    if (!catatan) return
    updateField('label', catatan.label.filter(l => l !== label))
  }, [catatan, updateField])

  const handleClose = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (savePromiseRef.current || revisionRef.current !== savedRevisionRef.current) {
      if (!currentRef.current || !await doSave(currentRef.current)) return
    }
    onClose()
  }, [doSave, onClose])

  if (!catatan) return null

  const isPinned = catatan.status === 'pinned'
  const isTrashed = catatan.status === 'trashed'
  const isArchived = catatan.status === 'archived'

  return (
    <>
      <Modal open={isOpen} onClose={handleClose} size="lg" variant="default">
        <ModalHeader onClose={handleClose} title={<>
          <span>Catatan Saya</span>
          <div className="catatan-editor__header-row">
            <div className="catatan-editor__save-status-wrapper">
              {saveStatus === 'saving' && (
                <span className="catatan-editor__save-status catatan-editor__save-status--saving">
                  <Loader2 size={14} className="animate-spin" /> Menyimpan...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="catatan-editor__save-status catatan-editor__save-status--saved">
                  <Check size={14} /> Tersimpan
                </span>
              )}
              {saveStatus === 'error' && !conflictData && (
                <span className="catatan-editor__save-status catatan-editor__save-status--error">
                  <XCircle size={14} /> Gagal menyimpan
                  <button type="button" onClick={retrySave} className="catatan-editor__retry-btn">Coba lagi</button>
                </span>
              )}
            </div>
          </div>
        </>} />

        <ModalBody>
          <div className="catatan-editor">
            {/* Type selector */}
            <div className="catatan-editor__type-selector">
              <button
                type="button"
                className={`catatan-editor__type-btn${catatan.jenis === 'catatan' ? ' catatan-editor__type-btn--active' : ''}`}
                onClick={() => updateField('jenis', 'catatan' as CatatanJenis)}
              >
                Catatan Bebas
              </button>
              <button
                type="button"
                className={`catatan-editor__type-btn${catatan.jenis === 'draft_agenda' ? ' catatan-editor__type-btn--active' : ''}`}
                onClick={() => updateField('jenis', 'draft_agenda' as CatatanJenis)}
              >
                <Calendar size={14} />
                Draft Agenda
              </button>
            </div>

            {/* Agenda fields */}
            {catatan.jenis === 'draft_agenda' && (
              <div className="catatan-editor__agenda-fields">
                <div className="catatan-editor__field">
                  <label><Calendar size={14} /> Tanggal</label>
                  <input
                    type="date"
                    value={catatan.tanggal_agenda || ''}
                    onChange={e => updateField('tanggal_agenda', e.target.value || null)}
                  />
                </div>
                <div className="catatan-editor__field">
                  <label><Clock size={14} /> Waktu</label>
                  <input
                    type="time"
                    value={catatan.waktu_agenda || ''}
                    onChange={e => updateField('waktu_agenda', e.target.value || null)}
                  />
                </div>
                <div className="catatan-editor__field">
                  <label><MapPin size={14} /> Tempat</label>
                  <input
                    type="text"
                    value={catatan.tempat_agenda || ''}
                    onChange={e => updateField('tempat_agenda', e.target.value || null)}
                    placeholder="Opsional..."
                    maxLength={255}
                  />
                </div>
              </div>
            )}

            {/* Title */}
            <input
              className="catatan-editor__title-input"
              type="text"
              value={catatan.judul}
              onChange={e => updateField('judul', e.target.value)}
              placeholder="Judul catatan..."
              maxLength={200}
              disabled={isTrashed}
            />

            {/* Block editor */}
            <CatatanBlockEditor
              blocks={Array.isArray(catatan.isi) ? catatan.isi : [{ type: 'paragraph', text: '' }]}
              onChange={blocks => updateField('isi', blocks as any)}
              readOnly={isTrashed}
            />

            {/* Labels */}
            <div className="catatan-editor__labels">
              <div className="catatan-editor__labels-header">
                <Tag size={14} />
                <span>Label</span>
              </div>
              <div className="catatan-editor__labels-list">
                {catatan.label.map((lbl, i) => (
                  <span key={i} className="catatan-card__label">
                    {lbl}
                    {!isTrashed && (
                      <button type="button" onClick={() => handleRemoveLabel(lbl)} className="catatan-editor__label-remove">
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
                {!isTrashed && catatan.label.length < 10 && (
                  <div className="catatan-editor__label-input-wrap">
                    <input
                      type="text"
                      value={newLabelInput}
                      onChange={e => setNewLabelInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel() } }}
                      placeholder="Tambah label..."
                      maxLength={50}
                      list="catatan-labels-list"
                    />
                    <datalist id="catatan-labels-list">
                      {allLabels.filter(l => !catatan.label.includes(l)).map(l => (
                        <option key={l} value={l} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>
            </div>

            {/* Color picker */}
            <div className="catatan-editor__warna-section">
              <button
                type="button"
                className="catatan-editor__warna-toggle"
                onClick={() => setShowWarnaMenu(!showWarnaMenu)}
              >
                <Palette size={14} />
                <span>Warna</span>
                <span
                  className="catatan-editor__warna-preview"
                  style={{ backgroundColor: WARNA_OPTIONS.find(w => w.value === catatan.warna)?.color || '#fff' }}
                />
              </button>
              {showWarnaMenu && (
                <div className="catatan-editor__warna-picker">
                  {WARNA_OPTIONS.map(w => (
                    <button
                      key={w.value}
                      type="button"
                      className={`catatan-editor__warna-option${catatan.warna === w.value ? ' catatan-editor__warna-option--active' : ''}`}
                      style={{ backgroundColor: w.color }}
                      onClick={() => { updateField('warna', w.value as CatatanWarna); setShowWarnaMenu(false) }}
                      title={w.label}
                    >
                      {catatan.warna === w.value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <div className="catatan-editor__footer">
            <div className="catatan-editor__footer-left">
              {!isTrashed && !isArchived && (
                <>
                  <Button variant="ghost" onClick={() => handleStatusChange(isPinned ? 'active' : 'pinned')}>
                    <Pin size={14} /> {isPinned ? 'Lepas sematan' : 'Sematkan'}
                  </Button>
                  <Button variant="ghost" onClick={handleCopyDraft}>
                    <Copy size={14} /> Salin draft
                  </Button>
                </>
              )}
            </div>
            <div className="catatan-editor__footer-right">
              {!isTrashed && !isArchived && (
                <>
                  <Button variant="ghost" onClick={() => handleStatusChange('archived')}>
                    <Archive size={14} /> Arsipkan
                  </Button>
                  <Button variant="danger" onClick={() => handleStatusChange('trashed')}>
                    <Trash2 size={14} /> Hapus
                  </Button>
                </>
              )}
              {isArchived && (
                <Button variant="secondary" onClick={() => handleStatusChange('active')}>
                  Kembalikan ke aktif
                </Button>
              )}
              {isTrashed && (
                <>
                  <Button variant="secondary" onClick={handleRestore}>
                    <RotateCcw size={14} /> Pulihkan
                  </Button>
                  <Button variant="danger" onClick={handlePermanentDelete}>
                    <Trash2 size={14} /> Hapus permanen
                  </Button>
                </>
              )}
            </div>
          </div>
        </ModalFooter>
      </Modal>

      {/* Conflict resolution dialog */}
      {conflictData && (
        <Modal open={true} onClose={() => {}} closeOnOverlayClick={false} size="sm" variant="edit">
          <ModalHeader title="Konflik Versi" icon={<AlertTriangle size={18} style={{ color: '#f59e0b' }} />} />
          <ModalBody>
            <p style={{ marginBottom: '1rem' }}>
              Catatan ini sudah diubah dari tab atau perangkat lain. Pilih tindakan:
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={handleAcceptServerVersion}>
              Gunakan versi terbaru
            </Button>
            <Button variant="primary" onClick={handleSaveAsCopy}>
              Simpan sebagai salinan
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  )
}
