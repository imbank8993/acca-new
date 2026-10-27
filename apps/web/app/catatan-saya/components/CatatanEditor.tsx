'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  Pin, Archive, Trash2, RotateCcw, Copy, Calendar, Clock, MapPin,
  X, AlertTriangle, Check, Loader2, XCircle, Tag, Palette
} from 'lucide-react'
import type { Catatan, CatatanJenis, CatatanWarna } from '../types'
import { InlineSelect } from '@/components/ui/InlineSelect'
import { catatanColor } from '../lib/catatan-color'
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
    if (catatan.tanggal_agenda) {
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
      <Modal open={isOpen} onClose={handleClose} size="lg" variant="edit" className="catatan-modal" labelledBy="catatan-editor-title">
        <ModalHeader id="catatan-editor-title" title="Catatan Saya" icon="journal-text"
          subtitle="Catatan dan list pribadi Anda" onClose={handleClose} />
        <ModalBody>
          <div className="catatan-form">
            <div className="catatan-form__status" aria-live="polite">
              {saveStatus === 'saving' ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
                : saveStatus === 'error' ? <><XCircle size={14} /> Gagal menyimpan. <button type="button" onClick={retrySave}>Coba lagi</button></>
                : hasUnsavedChanges ? 'Perubahan belum tersimpan'
                : <><Check size={14} /> Perubahan disimpan otomatis</>}
            </div>
            <fieldset disabled={isTrashed} className="catatan-form__fields">
              <div className="catatan-form__row">
                <div className="catatan-form__field">
                  <label>Jenis catatan</label>
                  <InlineSelect title="Jenis catatan" value={catatan.jenis}
                    onChange={value => {
                      updateField('jenis', value as CatatanJenis)
                      if (value === 'list') updateField('isi', catatan.isi.length ? catatan.isi.map(item => ({ ...item, type: 'checklist', checked: !!item.checked })) : [{ type: 'checklist', text: '', checked: false }])
                    }} disabled={isTrashed}
                    minWidth="0" height="42px" style={{ width: '100%' }}
                    options={[{ value: 'catatan', label: 'Catatan' }, { value: 'list', label: 'List' }]} />
                </div>
                <div className="catatan-form__field">
                  <label htmlFor="catatan-warna">Warna kartu</label>
                  <div className="catatan-color-control">
                    <input id="catatan-warna" type="color" aria-label="Pilih warna kartu custom" value={catatanColor(catatan.warna)}
                      onChange={e => updateField('warna', e.target.value as CatatanWarna)} disabled={isTrashed} />
                    <span><strong>{catatan.warna === 'default' ? 'Warna default' : catatanColor(catatan.warna).toUpperCase()}</strong><small>Klik warna untuk memilih sendiri</small></span>
                    {catatan.warna !== 'default' && <button type="button" disabled={isTrashed} onClick={() => updateField('warna', 'default')}>Reset</button>}
                  </div>
                </div>
              </div>
              <div className="catatan-form__field">
                <label htmlFor="catatan-judul">Judul catatan</label>
                <input id="catatan-judul" className="catatan-editor__title-input" value={catatan.judul}
                  onChange={e => updateField('judul', e.target.value)} placeholder="Contoh: Persiapan kegiatan bulan November" maxLength={200} />
              </div>
              <div className="catatan-form__field">
                <label htmlFor="catatan-tanggal">Tanggal catatan <span className="catatan-form__optional">(opsional)</span></label>
                <input id="catatan-tanggal" type="date" value={catatan.tanggal_agenda || ''} onChange={e => updateField('tanggal_agenda', e.target.value || null)} />
                <span className="catatan-form__hint">Jika kosong, kalender memakai tanggal pembuatan catatan.</span>
              </div>
              <div className="catatan-form__field">
                <label htmlFor="catatan-isi">Isi catatan</label>
                {catatan.jenis === 'list' ? (
                  <div className="catatan-checklist">
                    {(catatan.isi.length ? catatan.isi : [{ type: 'checklist', text: '', checked: false }]).map((item, index) => (
                      <div className="catatan-checklist__row" key={index}>
                        <input type="checkbox" aria-label={`Selesai item ${index + 1}`} checked={!!item.checked} onChange={e => {
                          const items = catatan.isi.length ? [...catatan.isi] : [{ type: 'checklist' as const, text: '' }]
                          items[index] = { ...items[index], type: 'checklist', checked: e.target.checked }; updateField('isi', items)
                        }} />
                        <input aria-label={`Item ${index + 1}`} value={item.text} placeholder="Tulis item..." onChange={e => {
                          const items = catatan.isi.length ? [...catatan.isi] : [{ type: 'checklist' as const, text: '' }]
                          items[index] = { ...items[index], type: 'checklist', text: e.target.value }; updateField('isi', items)
                        }} />
                        <button type="button" aria-label={`Hapus item ${index + 1}`} onClick={() => updateField('isi', catatan.isi.filter((_, i) => i !== index))}><X size={14} /></button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateField('isi', [...catatan.isi, { type: 'checklist', text: '', checked: false }])}>Tambah item</Button>
                  </div>
                ) : <textarea id="catatan-isi" rows={7} placeholder="Tulis catatan Anda di sini..."
                  value={(Array.isArray(catatan.isi) ? catatan.isi : []).map(block => block.text).join('\n\n')}
                  onChange={e => updateField('isi', [{ type: 'paragraph', text: e.target.value }])} />}
                <span className="catatan-form__hint">{catatan.jenis === 'list' ? 'Centang item yang sudah selesai.' : 'Tulis dalam bentuk paragraf. Gunakan Enter untuk baris baru.'}</span>
              </div>
              <div className="catatan-form__field">
                <label htmlFor="catatan-label">Label <span className="catatan-form__optional">(opsional)</span></label>
                <div className="catatan-form__label-entry">
                  <input id="catatan-label" value={newLabelInput} onChange={e => setNewLabelInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel() } }}
                    placeholder="Ketik label, lalu tekan Enter" maxLength={50} list="catatan-labels-list" />
                  <Button variant="outline" onClick={handleAddLabel} disabled={!newLabelInput.trim() || catatan.label.length >= 10 || isTrashed}>Tambah</Button>
                </div>
                <datalist id="catatan-labels-list">{allLabels.filter(l => !catatan.label.includes(l)).map(l => <option key={l} value={l} />)}</datalist>
                {catatan.label.length > 0 && <div className="catatan-form__labels">{catatan.label.map(lbl => (
                  <span key={lbl} className="catatan-card__label">{lbl}{!isTrashed && <button type="button" aria-label={`Hapus label ${lbl}`} onClick={() => handleRemoveLabel(lbl)}><X size={12} /></button>}</span>
                ))}</div>}
              </div>
            </fieldset>
            <div className="catatan-form__actions">
              {!isTrashed && <>
                {!isArchived && <Button variant="outline" size="sm" leftIcon={<Pin size={14} />} onClick={() => handleStatusChange(isPinned ? 'active' : 'pinned')}>{isPinned ? 'Lepas sematan' : 'Sematkan'}</Button>}
                <Button variant="outline" size="sm" leftIcon={<Copy size={14} />} onClick={handleCopyDraft}>Salin catatan</Button>
                <Button variant="outline" size="sm" leftIcon={<Archive size={14} />} onClick={() => handleStatusChange(isArchived ? 'active' : 'archived')}>{isArchived ? 'Kembalikan ke aktif' : 'Arsipkan'}</Button>
                <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => handleStatusChange('trashed')}>Hapus</Button>
              </>}
              {isTrashed && <><Button variant="outline" leftIcon={<RotateCcw size={14} />} onClick={handleRestore}>Pulihkan</Button>
                <Button variant="danger" leftIcon={<Trash2 size={14} />} onClick={handlePermanentDelete}>Hapus permanen</Button></>}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="cancel" onClick={handleClose}>Tutup</Button>
          {!isTrashed && <Button variant="primary" icon="save" isLoading={saveStatus === 'saving'} onClick={handleClose}>Simpan &amp; tutup</Button>}
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
