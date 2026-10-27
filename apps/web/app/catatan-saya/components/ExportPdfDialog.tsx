'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Download, FileText, Calendar as CalendarIcon, CheckSquare, Layers } from 'lucide-react'
import Swal from 'sweetalert2'
import type { Catatan, ExportOptions } from '../types'
import { generateCatatanPdf } from '../lib/catatan-pdf'

export interface ExportPdfDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedIds: number[]
  notes: Catatan[]
}

export default function ExportPdfDialog({
  isOpen,
  onClose,
  selectedIds,
  notes,
}: ExportPdfDialogProps) {
  // Current month helper: YYYY-MM
  const getCurrentMonthStr = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const [judulDokumen, setJudulDokumen] = useState<string>('Catatan Pribadi')
  const [exportMode, setExportMode] = useState<'selected' | 'month'>('month')
  const [bulan, setBulan] = useState<string>(getCurrentMonthStr())
  const [sertakanKalender, setSertakanKalender] = useState<boolean>(true)
  const [bulanKalender, setBulanKalender] = useState<string>(getCurrentMonthStr())
  const [isExporting, setIsExporting] = useState<boolean>(false)

  // Initialize and reset dialog state when opened
  useEffect(() => {
    if (isOpen) {
      setJudulDokumen('Catatan Pribadi')
      const currentMonth = getCurrentMonthStr()
      setBulan(currentMonth)
      setBulanKalender(currentMonth)

      const hasSelected = selectedIds && selectedIds.length > 0
      setExportMode(hasSelected ? 'selected' : 'month')

      // Default kalender enabled if there are any dated draft agendas
      const hasDatedAgendas = notes.some(
        (n) => Boolean(n.tanggal_agenda || n.created_at)
      )
      setSertakanKalender(hasDatedAgendas)
      setIsExporting(false)
    }
  }, [isOpen, selectedIds, notes])

  // Estimated count of notes to be exported
  const previewCount = useMemo(() => {
    if (exportMode === 'selected') {
      return selectedIds.length
    }
    // Filter local notes by month (either agenda date or created date)
    const matching = notes.filter((n) => {
      const matchAgenda = n.tanggal_agenda && n.tanggal_agenda.startsWith(bulan)
      const matchCreated = n.created_at && n.created_at.startsWith(bulan)
      return (matchAgenda || matchCreated) && n.status !== 'trashed'
    })
    return matching.length
  }, [exportMode, selectedIds, notes, bulan])

  const handleExport = async () => {
    if (exportMode === 'selected' && selectedIds.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Tidak Ada Pilihan',
        text: 'Silakan pilih minimal satu catatan untuk diekspor.',
      })
      return
    }

    setIsExporting(true)

    try {
      // 1. Fetch export data from API endpoint
      const reqBody: { ids?: number[]; bulan?: string } = {}
      if (exportMode === 'selected') {
        reqBody.ids = selectedIds
      } else {
        reqBody.bulan = bulan
      }

      const res = await fetch('/api/catatan-saya/export-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })

      const json = await res.json()

      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Gagal memuat data catatan untuk diekspor')
      }

      const exportNotes: Catatan[] = json.data || []

      if (!exportNotes || exportNotes.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Tidak Ada Data',
          text: exportMode === 'selected'
            ? 'Catatan yang dipilih tidak ditemukan atau telah dihapus.'
            : `Tidak ada catatan pada bulan yang dipilih (${bulan}).`,
        })
        setIsExporting(false)
        return
      }

      // 2. Prepare export options
      const options: ExportOptions = {
        ids: exportMode === 'selected' ? selectedIds : undefined,
        bulan: exportMode === 'month' ? bulan : undefined,
        judul_dokumen: judulDokumen.trim() || 'Catatan Pribadi',
        sertakan_kalender: sertakanKalender,
        bulan_kalender: sertakanKalender ? (bulanKalender || bulan) : undefined,
      }

      // 3. Generate client-side PDF
      generateCatatanPdf(exportNotes, options)

      // 4. Close dialog and notify success
      onClose()
      Swal.fire({
        icon: 'success',
        title: 'Export Berhasil',
        text: `Dokumen "${options.judul_dokumen}" berhasil diunduh.`,
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (err: unknown) {
      console.error('Error saat export PDF:', err)
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat dokumen PDF.'
      Swal.fire({
        icon: 'error',
        title: 'Export Gagal',
        text: message,
      })
    } finally {
      setIsExporting(false)
    }
  }

  const hasSelectedNotes = selectedIds && selectedIds.length > 0

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <ModalHeader
        title="Export Catatan ke PDF"
        subtitle="Unduh catatan dan list pribadi beserta kalender dalam format PDF"
        onClose={onClose}
        icon={<Download size={20} className="text-blue-600 dark:text-blue-400" />}
      />

      <ModalBody>
        <div className="catatan-export">
          {/* 1. Judul Dokumen */}
          <div className="catatan-export__option">
            <label className="catatan-export__option-label">
              Judul Dokumen
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-blue-500/30 bg-white dark:bg-[#0b1329] text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors"
              value={judulDokumen}
              onChange={(e) => setJudulDokumen(e.target.value)}
              placeholder="Contoh: Catatan Pribadi"
              disabled={isExporting}
            />
          </div>

          {/* 2. Mode Export */}
          <div className="catatan-export__option">
            <label className="catatan-export__option-label">
              Pilihan Catatan yang Diekspor
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option A: Catatan Terpilih */}
              <button
                type="button"
                disabled={!hasSelectedNotes || isExporting}
                onClick={() => setExportMode('selected')}
                className={`flex items-start gap-3 p-3 text-left rounded-xl border transition-all ${
                  exportMode === 'selected'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                } ${!hasSelectedNotes ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    exportMode === 'selected'
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-400 dark:border-slate-600'
                  }`}
                >
                  {exportMode === 'selected' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <CheckSquare size={13} className="text-blue-600 dark:text-blue-400" />
                    <span>Catatan Terpilih</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {hasSelectedNotes
                      ? `${selectedIds.length} catatan dipilih`
                      : 'Pilih catatan terlebih dahulu'}
                  </div>
                </div>
              </button>

              {/* Option B: Catatan Bulan Tertentu */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setExportMode('month')}
                className={`flex items-start gap-3 p-3 text-left rounded-xl border transition-all cursor-pointer ${
                  exportMode === 'month'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    exportMode === 'month'
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-400 dark:border-slate-600'
                  }`}
                >
                  {exportMode === 'month' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Layers size={13} className="text-blue-600 dark:text-blue-400" />
                    <span>Berdasarkan Bulan</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Semua catatan pada bulan tertentu
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Input Bulan (jika mode bulan dipilih) */}
          {exportMode === 'month' && (
            <div className="catatan-export__option">
              <label className="catatan-export__option-label">
                Pilih Bulan Catatan
              </label>
              <input
                type="month"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-blue-500/30 bg-white dark:bg-[#0b1329] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors"
                value={bulan}
                onChange={(e) => {
                  setBulan(e.target.value)
                  setBulanKalender(e.target.value)
                }}
                disabled={isExporting}
              />
            </div>
          )}

          {/* 4. Toggle Sertakan Kalender */}
          <div className="catatan-export__option pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="catatan-export__option-label cursor-pointer" htmlFor="toggle-kalender">
                  Sertakan Kalender Agenda
                </label>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tampilkan kalender visual 1 bulan di halaman pertama dokumen
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  id="toggle-kalender"
                  type="checkbox"
                  className="sr-only peer"
                  checked={sertakanKalender}
                  onChange={(e) => setSertakanKalender(e.target.checked)}
                  disabled={isExporting}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Input Bulan Kalender jika toggle kalender aktif */}
            {sertakanKalender && (
              <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-blue-600 dark:text-blue-400" />
                  <span>Bulan Tampilan Kalender</span>
                </label>
                <input
                  type="month"
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-blue-500/30 bg-white dark:bg-[#0b1329] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  value={bulanKalender}
                  onChange={(e) => setBulanKalender(e.target.value)}
                  disabled={isExporting}
                />
              </div>
            )}
          </div>

          {/* 5. Preview Count Banner */}
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
              <FileText size={16} />
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300">
              {exportMode === 'selected' ? (
                <span>
                  <strong className="text-blue-700 dark:text-blue-300 font-bold">{previewCount} catatan</strong> yang Anda pilih akan diekspor.
                </span>
              ) : (
                <span>
                  Catatan pada bulan <strong className="text-blue-700 dark:text-blue-300 font-bold">{bulan}</strong> akan diekspor dari database.
                </span>
              )}
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter align="end">
        <Button
          variant="cancel"
          onClick={onClose}
          disabled={isExporting}
        >
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          isLoading={isExporting}
          leftIcon={<Download size={16} />}
        >
          {isExporting ? 'Membuat PDF...' : 'Export PDF'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
