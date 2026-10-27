'use client'

import React from 'react'
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import { Button } from '@/components/ui/Button'
import { Plus, LayoutGrid, Calendar, Download, CheckSquare } from 'lucide-react'

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
    { value: 'catatan', label: 'Catatan Bebas' },
    { value: 'draft_agenda', label: 'Draft Agenda' },
  ]

  return (
    <FilterToolbar
      className="catatan-toolbar"
      leading={
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={onNewNote}
            className="shrink-0"
          >
            <span className="hidden sm:inline">Catatan Baru</span>
            <span className="sm:hidden">Baru</span>
          </Button>

          <Button
            variant={selectionMode ? 'secondary' : 'outline'}
            leftIcon={<CheckSquare size={16} className={selectionMode ? 'text-blue-600 dark:text-blue-400' : ''} />}
            onClick={onToggleSelectionMode}
            className="shrink-0"
            title={selectionMode ? 'Batalkan mode pilih' : 'Pilih catatan untuk diekspor'}
          >
            {selectionMode ? (
              selectedCount > 0 ? (
                <span>
                  <strong className="text-blue-600 dark:text-blue-400">{selectedCount}</strong> Terpilih
                </span>
              ) : (
                'Batal'
              )
            ) : (
              <span>Pilih</span>
            )}
          </Button>
        </div>
      }
    >
      {/* Kolom Pencarian */}
      <FilterSearch
        label="Cari"
        placeholder="Cari catatan..."
        value={search}
        onChange={onSearchChange}
        grow={2}
      />

      {/* Filter Status: Aktif / Arsip / Sampah */}
      <FilterSelect
        label="Status"
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={statusOptions}
        width="135px"
      />

      {/* Filter Jenis: Semua / Catatan Bebas / Draft Agenda */}
      <FilterSelect
        label="Jenis"
        value={jenisFilter}
        onChange={onJenisFilterChange}
        options={jenisOptions}
        width="155px"
      />

      {/* Filter Label */}
      <FilterSelect
        label="Label"
        value={labelFilter}
        onChange={onLabelFilterChange}
        options={labelOptions}
        width="145px"
      />

      {/* Sisi Kanan: Tombol Export PDF & Segmented View Toggle */}
      <FilterActions>
        <Button
          variant="outline"
          leftIcon={<Download size={16} />}
          onClick={onExport}
          className="shrink-0"
        >
          <span className="hidden md:inline">Export PDF</span>
          <span className="md:hidden">Export</span>
        </Button>

        {/* View Toggle (cards / calendar) */}
        <div className="catatan-view-toggle shrink-0" role="group" aria-label="Mode Tampilan">
          <button
            type="button"
            className={`catatan-view-toggle__btn ${viewMode === 'cards' ? 'catatan-view-toggle__btn--active' : ''}`}
            onClick={() => onViewModeChange('cards')}
            title="Tampilan Kartu"
          >
            <LayoutGrid size={16} />
            <span>Kartu</span>
          </button>
          <button
            type="button"
            className={`catatan-view-toggle__btn ${viewMode === 'calendar' ? 'catatan-view-toggle__btn--active' : ''}`}
            onClick={() => onViewModeChange('calendar')}
            title="Tampilan Kalender"
          >
            <Calendar size={16} />
            <span>Kalender</span>
          </button>
        </div>
      </FilterActions>
    </FilterToolbar>
  )
}
