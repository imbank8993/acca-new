'use client'

import React from 'react'
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar'

export interface CatatanToolbarProps {
  onNewNote: () => void
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  jenisFilter: string
  onJenisFilterChange: (value: string) => void
  labelFilter: string
  onLabelFilterChange: (value: string) => void
  viewMode: 'cards' | 'calendar'
  onViewModeChange: (mode: 'cards' | 'calendar') => void
  onExport: () => void
  labels: string[]
  selectionMode: boolean
  onToggleSelectionMode: () => void
  selectedCount: number
}

export default function CatatanToolbar({
  onNewNote,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  jenisFilter,
  onJenisFilterChange,
  labelFilter,
  onLabelFilterChange,
  viewMode,
  onViewModeChange,
  onExport,
  labels,
  selectionMode,
  onToggleSelectionMode,
  selectedCount,
}: CatatanToolbarProps) {
  // Label dropdown options
  const labelOptions = [
    { value: '', label: 'Semua Label' },
    ...Array.from(new Set(labels || [])).map(lbl => ({ value: lbl, label: lbl })),
  ]

  // Status dropdown options
  const statusOptions = [
    { value: 'active,pinned', label: 'Aktif' },
    { value: 'archived', label: 'Arsip' },
    { value: 'trashed', label: 'Sampah' },
  ]

  // Jenis dropdown options
  const jenisOptions = [
    { value: '', label: 'Semua Jenis' },
    { value: 'catatan', label: 'Catatan' },
    { value: 'list', label: 'List' },
  ]

  return (
    <FilterToolbar className="catatan-toolbar" actionsInline>
      <FilterSearch label="Pencarian" placeholder="Cari judul catatan..." value={search} onChange={onSearchChange} grow={2} />
      <FilterSelect label="Status" value={statusFilter === 'all' ? 'active,pinned' : statusFilter} onChange={onStatusFilterChange} options={statusOptions} width={140} />
      <FilterSelect label="Jenis" value={jenisFilter === 'all' ? '' : jenisFilter} onChange={onJenisFilterChange} options={jenisOptions} width={160} />
      {labels.length > 0 && <FilterSelect label="Label" value={labelFilter} onChange={onLabelFilterChange} options={labelOptions} width={150} />}

    </FilterToolbar>
  )
}
