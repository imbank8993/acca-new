'use client'

import React from 'react'
import type { Catatan } from '../types'
import CatatanCard from './CatatanCard'
import { PageLoader } from '@/components/ui/Spinner'
import { FileText } from 'lucide-react'

interface CatatanListProps {
  notes: Catatan[]
  loading: boolean
  onNoteClick: (catatan: Catatan) => void
  onStatusChange: (id: number, status: string) => void
  onRestore: (id: number) => void
  emptyMessage?: string
  selectedIds?: Set<number>
  onToggleSelect?: (id: number) => void
  selectionMode?: boolean
}

export default function CatatanList({
  notes,
  loading,
  onNoteClick,
  onStatusChange,
  onRestore,
  emptyMessage = 'Belum ada catatan',
  selectedIds,
  onToggleSelect,
  selectionMode = false,
}: CatatanListProps) {
  if (loading) {
    return (
      <div className="catatan-list__loading">
        <PageLoader minHeight="200px" />
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="catatan-list__empty">
        <FileText size={48} strokeWidth={1} />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  // Separate pinned from others
  const pinned = notes.filter(n => n.status === 'pinned')
  const others = notes.filter(n => n.status !== 'pinned')

  return (
    <div className="catatan-list">
      {pinned.length > 0 && (
        <>
          <div className="catatan-list__section-label">Disematkan</div>
          <div className="catatan-grid">
            {pinned.map(catatan => (
              <div key={catatan.id} className={`catatan-grid__item${selectionMode ? ' catatan-grid__item--selectable' : ''}${selectedIds?.has(catatan.id) ? ' catatan-grid__item--selected' : ''}`}>
                {selectionMode && (
                  <label className="catatan-grid__checkbox" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(catatan.id) ?? false}
                      onChange={() => onToggleSelect?.(catatan.id)}
                    />
                  </label>
                )}
                <CatatanCard
                  catatan={catatan}
                  onClick={onNoteClick}
                  onStatusChange={onStatusChange}
                  onRestore={onRestore}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          {pinned.length > 0 && (
            <div className="catatan-list__section-label">Lainnya</div>
          )}
          <div className="catatan-grid">
            {others.map(catatan => (
              <div key={catatan.id} className={`catatan-grid__item${selectionMode ? ' catatan-grid__item--selectable' : ''}${selectedIds?.has(catatan.id) ? ' catatan-grid__item--selected' : ''}`}>
                {selectionMode && (
                  <label className="catatan-grid__checkbox" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(catatan.id) ?? false}
                      onChange={() => onToggleSelect?.(catatan.id)}
                    />
                  </label>
                )}
                <CatatanCard
                  catatan={catatan}
                  onClick={onNoteClick}
                  onStatusChange={onStatusChange}
                  onRestore={onRestore}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
