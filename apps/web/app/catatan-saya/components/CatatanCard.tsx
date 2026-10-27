'use client'

import React from 'react'
import { Pin, Calendar, Clock, MapPin, Trash2, Archive, ArchiveRestore, RotateCcw } from 'lucide-react'
import type { Catatan, CatatanWarna } from '../types'
import { WARNA_OPTIONS } from '../types'

interface CatatanCardProps {
  catatan: Catatan
  onClick: (catatan: Catatan) => void
  onStatusChange?: (id: number, status: string) => void
  onRestore?: (id: number) => void
  showActions?: boolean
}

function getWarnaStyle(warna: CatatanWarna): React.CSSProperties {
  const opt = WARNA_OPTIONS.find(w => w.value === warna)
  if (!opt || warna === 'default') return {}
  return { '--card-bg': opt.color, '--card-bg-dark': opt.darkColor } as React.CSSProperties
}

function getPreviewText(isi: Catatan['isi']): string {
  if (!Array.isArray(isi)) return ''
  return isi
    .slice(0, 5)
    .map(block => {
      if (block.type === 'checklist') {
        return `${block.checked ? '☑' : '☐'} ${block.text}`
      }
      if (block.type === 'list-item') {
        return `• ${block.text}`
      }
      return block.text
    })
    .filter(Boolean)
    .join('\n')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return ''
  return timeStr.slice(0, 5)
}

function timeAgo(dateStr: string): string {
  try {
    const now = Date.now()
    const updated = new Date(dateStr).getTime()
    const diffMs = now - updated
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Baru saja'
    if (diffMin < 60) return `${diffMin} menit lalu`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr} jam lalu`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay} hari lalu`
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export default function CatatanCard({ catatan, onClick, onStatusChange, onRestore, showActions = true }: CatatanCardProps) {
  const preview = getPreviewText(catatan.isi)
  const isPinned = catatan.status === 'pinned'
  const isTrashed = catatan.status === 'trashed'
  const isArchived = catatan.status === 'archived'
  const isAgenda = catatan.jenis === 'draft_agenda'

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  return (
    <div
      className={`catatan-card catatan-card--${catatan.warna}${isPinned ? ' catatan-card--pinned' : ''}${isTrashed ? ' catatan-card--trashed' : ''} catatan-animate-in`}
      style={getWarnaStyle(catatan.warna)}
      onClick={() => onClick(catatan)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick(catatan) }}
    >
      {isPinned && (
        <div className="catatan-card__pin-icon" title="Disematkan">
          <Pin size={14} />
        </div>
      )}

      {catatan.judul && (
        <h3 className="catatan-card__title">{catatan.judul}</h3>
      )}

      {preview && (
        <p className="catatan-card__preview">{preview}</p>
      )}

      {isAgenda && catatan.tanggal_agenda && (
        <div className="catatan-card__agenda-info">
          <span className="catatan-card__agenda-badge">
            <Calendar size={12} />
            Draft Agenda
          </span>
          <span className="catatan-card__agenda-detail">
            <Calendar size={12} />
            {formatDate(catatan.tanggal_agenda)}
          </span>
          {catatan.waktu_agenda && (
            <span className="catatan-card__agenda-detail">
              <Clock size={12} />
              {formatTime(catatan.waktu_agenda)}
            </span>
          )}
          {catatan.tempat_agenda && (
            <span className="catatan-card__agenda-detail">
              <MapPin size={12} />
              {catatan.tempat_agenda}
            </span>
          )}
        </div>
      )}

      {catatan.label.length > 0 && (
        <div className="catatan-card__labels">
          {catatan.label.slice(0, 4).map((lbl, i) => (
            <span key={i} className="catatan-card__label">{lbl}</span>
          ))}
          {catatan.label.length > 4 && (
            <span className="catatan-card__label catatan-card__label--more">
              +{catatan.label.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="catatan-card__meta">
        <span className="catatan-card__time">{timeAgo(catatan.updated_at)}</span>
        {isAgenda && !catatan.tanggal_agenda && (
          <span className="catatan-card__agenda-badge">
            <Calendar size={12} />
            Draft
          </span>
        )}
      </div>

      {showActions && (
        <div className="catatan-card__actions">
          {!isTrashed && !isArchived && (
            <>
              <button
                className="catatan-card__action-btn"
                title={isPinned ? 'Lepas sematan' : 'Sematkan'}
                onClick={e => handleAction(e, () => onStatusChange?.(catatan.id, isPinned ? 'active' : 'pinned'))}
              >
                <Pin size={14} className={isPinned ? 'filled' : ''} />
              </button>
              <button
                className="catatan-card__action-btn"
                title="Arsipkan"
                onClick={e => handleAction(e, () => onStatusChange?.(catatan.id, 'archived'))}
              >
                <Archive size={14} />
              </button>
              <button
                className="catatan-card__action-btn catatan-card__action-btn--danger"
                title="Hapus"
                onClick={e => handleAction(e, () => onStatusChange?.(catatan.id, 'trashed'))}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {isArchived && (
            <button
              className="catatan-card__action-btn"
              title="Kembalikan ke aktif"
              onClick={e => handleAction(e, () => onStatusChange?.(catatan.id, 'active'))}
            >
              <ArchiveRestore size={14} />
            </button>
          )}
          {isTrashed && (
            <button
              className="catatan-card__action-btn"
              title="Pulihkan"
              onClick={e => handleAction(e, () => onRestore?.(catatan.id))}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
