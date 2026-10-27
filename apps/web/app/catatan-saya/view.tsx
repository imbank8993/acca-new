'use client'

import Pagination from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Plus, Download, LockKeyhole, CheckSquare, X, NotebookPen, LayoutGrid, Calendar } from 'lucide-react'

import React, { useState, useCallback, useMemo } from 'react'
import type { User } from '@/lib/types'
import type { Catatan } from './types'
import { useCatatan } from './hooks/use-catatan'
import CatatanToolbar from './components/CatatanToolbar'
import CatatanList from './components/CatatanList'
import CatatanEditor from './components/CatatanEditor'
import KalenderBulanan from './components/KalenderBulanan'
import ExportPdfDialog from './components/ExportPdfDialog'
import Swal from 'sweetalert2'
import './catatan-saya.css'

interface Props {
  user: User
}

export default function CatatanSayaView({ user }: Props) {
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingCatatan, setEditingCatatan] = useState<Catatan | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const {
    notes, loading, error, filters, setFilter, refreshNotes, setSearch, pagination, setPage,
  } = useCatatan()

  // All unique labels from current notes for toolbar filter
  const allLabels = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => n.label.forEach(l => set.add(l)))
    return Array.from(set).sort()
  }, [notes])

  // Handle new note creation
  const handleNewNote = useCallback(async () => {
    try {
      const res = await fetch('/api/catatan-saya', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: '',
          isi: [{ type: 'paragraph', text: '' }],
          jenis: 'catatan',
        }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setEditingCatatan(result.data)
        setEditorOpen(true)
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal membuat catatan', text: result.error || 'Terjadi kesalahan' })
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal membuat catatan' })
    }
  }, [])

  // Handle note click to edit
  const handleNoteClick = useCallback(async (catatan: Catatan) => {
    try {
      const res = await fetch(`/api/catatan-saya/${catatan.id}`)
      const result = await res.json()
      if (res.ok && result.success) {
        setEditingCatatan(result.data)
        setEditorOpen(true)
      } else {
        // Fallback to cached data
        setEditingCatatan(catatan)
        setEditorOpen(true)
      }
    } catch {
      setEditingCatatan(catatan)
      setEditorOpen(true)
    }
  }, [])

  // Handle status change from card actions
  const handleStatusChange = useCallback(async (id: number, status: string) => {
    try {
      await fetch(`/api/catatan-saya/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      refreshNotes()
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal mengubah status' })
    }
  }, [refreshNotes])

  // Handle restore from trash
  const handleRestore = useCallback(async (id: number) => {
    try {
      await fetch(`/api/catatan-saya/${id}/restore`, { method: 'PUT' })
      refreshNotes()
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal memulihkan' })
    }
  }, [refreshNotes])

  // Create agenda from calendar date click
  const handleCreateAgenda = useCallback(async (date: string) => {
    try {
      const res = await fetch('/api/catatan-saya', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: '',
          isi: [{ type: 'paragraph', text: '' }],
          jenis: 'catatan',
          tanggal_agenda: date,
        }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setEditingCatatan(result.data)
        setEditorOpen(true)
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal membuat catatan' })
    }
  }, [])

  // Handle agenda click from calendar
  const handleAgendaClick = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/catatan-saya/${id}`)
      const result = await res.json()
      if (res.ok && result.success) {
        setEditingCatatan(result.data)
        setEditorOpen(true)
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal memuat catatan' })
    }
  }, [])

  // Toggle selection for export
  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Toggle selection mode
  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) setSelectedIds(new Set()) // Clear selection when exiting
      return !prev
    })
  }, [])

  return (
    <div className="catatan-page">
      <header className="catatan-home-header">
        <div className="catatan-home-header__identity">
          <span className="catatan-home-header__icon"><NotebookPen size={23} /></span>
          <div><h2>Catatan &amp; rencana</h2><p><LockKeyhole size={12} /> Ruang pribadi untuk catatan dan daftar pribadi Anda.</p></div>
        </div>
        <div className="catatan-home-header__actions">
          <Button variant="outline" icon="pdf" onClick={() => setExportOpen(true)}>Export PDF</Button>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={handleNewNote}>Catatan baru</Button>
        </div>
      </header>
      <CatatanToolbar
        onNewNote={handleNewNote}
        search={filters.search}
        onSearchChange={setSearch}
        statusFilter={filters.status}
        onStatusFilterChange={v => setFilter('status', v)}
        jenisFilter={filters.jenis}
        onJenisFilterChange={v => setFilter('jenis', v)}
        labelFilter={filters.label}
        onLabelFilterChange={v => setFilter('label', v)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExport={() => setExportOpen(true)}
        labels={allLabels}
        selectionMode={selectionMode}
        onToggleSelectionMode={handleToggleSelectionMode}
        selectedCount={selectedIds.size}
      />

      {error && <div className="catatan-home-error" role="alert">{error}<Button variant="outline" size="sm" onClick={refreshNotes}>Coba lagi</Button></div>}
      <div className="catatan-results">
        <div><h3>{viewMode === 'calendar' ? 'Kalender pribadi' : filters.status === 'archived' ? 'Arsip catatan' : filters.status === 'trashed' ? 'Sampah' : 'Koleksi catatan'}</h3>
          <span>{viewMode === 'calendar' ? 'Catatan dan list berdasarkan tanggal' : selectionMode ? `${selectedIds.size} catatan dipilih` : loading ? 'Memuat catatan...' : `${pagination.total} catatan · diperbarui terbaru`}</span></div>
        <div className="catatan-results__actions">
          <div className="catatan-view-toggle" role="group" aria-label="Tampilan catatan">
            <button type="button" aria-pressed={viewMode === 'cards'} className={`catatan-view-toggle__btn${viewMode === 'cards' ? ' catatan-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('cards')}><LayoutGrid size={15} /> Catatan</button>
            <button type="button" aria-pressed={viewMode === 'calendar'} className={`catatan-view-toggle__btn${viewMode === 'calendar' ? ' catatan-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('calendar')}><Calendar size={15} /> Kalender</button>
          </div>
          {viewMode === 'cards' && <Button variant={selectionMode ? 'secondary' : 'outline'} size="sm" leftIcon={selectionMode ? <X size={14} /> : <CheckSquare size={14} />} onClick={handleToggleSelectionMode}>{selectionMode ? 'Batal memilih' : 'Pilih catatan'}</Button>}
        </div>
      </div>
      {selectionMode && viewMode === 'cards' && <div className="catatan-selection-bar"><span>{selectedIds.size ? `${selectedIds.size} catatan siap diekspor` : 'Pilih catatan yang ingin disertakan dalam PDF.'}</span><Button variant="outline" size="sm" disabled={!selectedIds.size} leftIcon={<Download size={14} />} onClick={() => setExportOpen(true)}>Export pilihan</Button></div>}
      {viewMode === 'cards' && (
        <CatatanList
          notes={notes}
          loading={loading}
          onNoteClick={handleNoteClick}
          onStatusChange={handleStatusChange}
          onRestore={handleRestore}
          emptyMessage={
            filters.status === 'trashed' ? 'Sampah kosong' :
            filters.status === 'archived' ? 'Belum ada arsip' :
            filters.search ? 'Tidak ada catatan yang cocok' :
            'Belum ada catatan. Klik "Catatan Baru" untuk memulai.'
          }
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          selectionMode={selectionMode}
        />
      )}

      {viewMode === 'cards' && (
        <Pagination currentPage={pagination.page} totalPages={pagination.totalPages}
          totalItems={pagination.total} limit={pagination.limit} itemLabel="catatan" onPageChange={setPage} />
      )}

      {viewMode === 'calendar' && (
        <KalenderBulanan
          key={`${editorOpen}-${pagination.total}`}
          onAgendaClick={handleAgendaClick}
          onCreateAgenda={handleCreateAgenda}
        />
      )}

      {editorOpen && editingCatatan && (
        <CatatanEditor
          catatan={editingCatatan}
          isOpen={editorOpen}
          onClose={() => { setEditorOpen(false); setEditingCatatan(null); refreshNotes() }}
          onSaved={refreshNotes}
          onDeleted={() => { refreshNotes() }}
        />
      )}

      {exportOpen && (
        <ExportPdfDialog
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          selectedIds={Array.from(selectedIds)}
          notes={notes}
        />
      )}
    </div>
  )
}
