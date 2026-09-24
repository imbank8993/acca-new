'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { importFromExcel, downloadTemplate } from '@/lib/excel-utils'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
  templateColumns: string[]
  templateName: string
  apiEndpoint: string
  mapRowData: (row: any) => any | any[] | null
  useBulk?: boolean
  /** Tidak dipakai di sini — blur modal untuk Import sudah ditangani pemanggil
      lewat state `showImportModal`-nya sendiri. Dideklarasikan supaya cocok
      dengan pemanggil yang sudah terlanjur mengirim prop ini. */
  onOpen?: () => void
}

export default function ImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  templateColumns,
  templateName,
  apiEndpoint,
  mapRowData,
  useBulk = false
}: ImportModalProps) {
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fix SweetAlert2 Z-Index
  useEffect(() => {
    if (isOpen) {
      const style = document.createElement('style')
      style.innerHTML = `.swal2-container { z-index: 99999 !important; }`
      document.head.appendChild(style)
      return () => {
        document.head.removeChild(style)
      }
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const handleDownloadTemplate = () => {
    downloadTemplate(templateColumns, templateName)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      await Swal.fire('Format Salah', 'Harap upload file Excel (.xlsx atau .xls)', 'error')
      e.target.value = ''
      return
    }

    try {
      setLoading(true)
      const jsonData = await importFromExcel(file)

      if (jsonData.length === 0) {
        Swal.fire('Error', 'File kosong atau format salah.', 'error')
        setLoading(false)
        e.target.value = ''
        return
      }

      // --- Header Validation ---
      if (jsonData.length > 0) {
        const row = jsonData[0]
        const fileHeaders = Object.keys(row).map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ''))
        const expectedHeaders = templateColumns
          .map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ''))
          // Only No, NISN, and Nama Lengkap are required
          .filter((c) => c === 'no' || c === 'nisn' || c === 'namalengkap')

        const missing = expectedHeaders.filter((h) => !fileHeaders.includes(h))

        if (missing.length > 0) {
          const readableMissing = missing.map((m) => {
            const orig = templateColumns.find((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '') === m)
            return orig || m
          })

          Swal.fire({
            title: 'Import Gagal',
            html: `Struktur kolom tidak sesuai.<br/>Kolom wajib yang hilang: <b>${readableMissing.join(
              ', '
            )}</b>.<br/>Gunakan template yang disediakan.`,
            icon: 'error'
          })
          setLoading(false)
          e.target.value = ''
          return
        }
      }
      // -------------------------

      let successCount = 0
      let failCount = 0
      const errors: string[] = []

      const itemsToImport: { body: any; rowIndex: number }[] = []

      for (let i = 0; i < jsonData.length; i++) {
        const rawRow = jsonData[i]
        // Normalize keys to support case-insensitive lookups (e.g., TAHUN_AJARAN -> tahun_ajaran)
        const row: any = { ...rawRow }
        for (const key of Object.keys(rawRow)) {
          row[key.toLowerCase()] = rawRow[key]
          row[key.toUpperCase()] = rawRow[key]
        }

        const result = mapRowData(row)
        if (!result) continue

        const bodies = Array.isArray(result) ? result : [result]
        for (const body of bodies) {
          itemsToImport.push({ body, rowIndex: i + 2 })
        }
      }

      if (useBulk) {
        try {
          const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToImport })
          })

          const contentType = res.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            failCount++
            errors.push(`Error server (HTTP ${res.status})`)
          } else {
            const json = await res.json()
            if (res.ok && json.ok) {
              successCount = json.successCount || 0
              failCount = json.failCount || 0
              if (json.errors && Array.isArray(json.errors)) {
                errors.push(...json.errors)
              }
            } else {
              failCount++
              errors.push(json.error || 'Gagal melakukan import.')
            }
          }
        } catch (e: any) {
          failCount++
          errors.push(e.message)
        }
      } else {
        // Process sequentially to avoid database pool exhaustion and request timeouts
        const batchSize = 1
        for (let i = 0; i < itemsToImport.length; i += batchSize) {
          const batch = itemsToImport.slice(i, i + batchSize)
          await Promise.all(
            batch.map(async ({ body, rowIndex }) => {
              try {
                const res = await fetch(apiEndpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body)
                })

                const contentType = res.headers.get('content-type')
                if (!contentType || !contentType.includes('application/json')) {
                  failCount++
                  errors.push(`Baris ${rowIndex}: Error server (HTTP ${res.status})`)
                  return
                }

                const json = await res.json()
                if (res.ok && json.ok) {
                  successCount++
                } else {
                  failCount++
                  errors.push(`Baris ${rowIndex}: ${json.error || 'Gagal'}`)
                }
              } catch (e: any) {
                failCount++
                errors.push(`Baris ${rowIndex}: ${e.message}`)
              }
            })
          )
        }
      }

      if (failCount === 0) {
        Swal.fire({
          title: 'Berhasil!',
          text: `${successCount} data berhasil diimport.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        })
      } else {
        let htmlMsg = `<div style="text-align:left; max-height:200px; overflow-y:auto;"><b>${successCount} Sukses, ${failCount} Gagal.</b><br/><ul style="margin-top:5px; padding-left:15px; color:#d32f2f;">`
        errors.slice(0, 10).forEach((e) => (htmlMsg += `<li>${e}</li>`))
        if (errors.length > 10) htmlMsg += `<li>...dan ${errors.length - 10} lainnya</li>`
        htmlMsg += `</ul></div>`

        Swal.fire({
          title: 'Selesai (Ada Error)',
          html: htmlMsg,
          icon: 'warning'
        })
      }

      onImportSuccess()
      onClose()
    } catch (err: any) {
      Swal.fire('System Error', err.message, 'error')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return createPortal(
    <div className="im-overlay" role="dialog" aria-modal="true" aria-label="Import Data Excel">
      <div className="im-modal">
        {/* Header */}
        <div className="im-header">
          <div className="im-titleWrap">
            <i className="bi bi-file-earmark-spreadsheet im-headerIcon"></i>
            <h3 className="im-title">Import Data Excel</h3>
          </div>
          <button onClick={onClose} className="im-close" aria-label="Tutup">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="im-body">
          {/* Step 1 */}
          <div className="im-step">
            <div className="im-stepHead">
              <span className="im-stepNo">1</span>
              <h4 className="im-stepTitle">Download Template</h4>
            </div>
            <button onClick={handleDownloadTemplate} className="im-btn im-btn--download">
              <i className="bi bi-download"></i>
              <span>Download Template</span>
            </button>
          </div>

          {/* Step 2 */}
          <div className="im-step">
            <div className="im-stepHead">
              <span className="im-stepNo im-stepNo--green">2</span>
              <h4 className="im-stepTitle">Upload File Excel</h4>
            </div>
            
            <label className={`im-fileUpload ${loading ? 'is-disabled' : ''}`}>
              <input type="file" onChange={handleFileChange} disabled={loading} accept=".xlsx,.xls" />
              <div className="im-fileInner">
                <i className="bi bi-cloud-arrow-up im-uploadIcon"></i>
                <div className="im-fileText">
                  <span className="im-fileLabel">Pilih File Excel</span>
                  <span className="im-fileFormat">.xlsx / .xls</span>
                </div>
              </div>
            </label>
          </div>

          {loading && (
            <div className="im-loading">
              <div className="im-spinner"></div>
              <span>Memproses...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="im-footer">
          <button onClick={onClose} className="im-btn im-btn--close">
            Tutup
          </button>
        </div>
      </div>

      <style jsx>{`
        /* ========================================
           IMPORT MODAL - Navy Premium Design
        ======================================== */

        .im-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 16px;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .im-modal {
          width: 100%;
          max-width: 380px;
          background: var(--n-card);
          border-radius: 14px;
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.3), 
                      0 0 0 1px rgba(30, 58, 138, 0.1);
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Header */
        .im-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid #e0e7ff;
          background: linear-gradient(to bottom, #f8faff, #ffffff);
        }

        .im-titleWrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .im-headerIcon {
          font-size: 20px;
          color: #1e3a8a;
        }

        .im-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--n-text);
          letter-spacing: -0.02em;
        }

        .im-close {
          appearance: none;
          border: none;
          background: transparent;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          cursor: pointer;
          color: var(--n-muted);
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .im-close:hover {
          background: #f1f5f9;
          color: var(--n-text);
        }

        /* Body */
        .im-body {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: var(--n-card);
        }

        .im-step {
          background: var(--n-surface);
          border: 1px solid var(--n-border);
          border-radius: 10px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }

        .im-step:hover {
          border-color: #c7d2fe;
          box-shadow: 0 4px 12px rgba(30, 58, 138, 0.08);
        }

        .im-stepHead {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .im-stepNo {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e3a8a, #1e40af);
          color: #ffffff;
          font-weight: 600;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(30, 58, 138, 0.35),
                      inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .im-stepNo--green {
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35),
                      inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        /* ===== DARK MODE OVERRIDES ===== */
        :global(.dark) .im-modal {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 20px !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.95) !important;
        }

        :global(.dark) .im-header {
          background: #000000 !important;
          border-bottom: 1.5px solid rgba(59, 130, 246, 0.35) !important;
        }

        :global(.dark) .im-headerIcon {
          color: #38bdf8 !important;
        }

        :global(.dark) .im-title {
          color: #ffffff !important;
          font-weight: 700 !important;
        }

        :global(.dark) .im-close {
          background: #000000 !important;
          border: 1px solid rgba(59, 130, 246, 0.35) !important;
          color: #94a3b8 !important;
        }

        :global(.dark) .im-close:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
        }

        :global(.dark) .im-body {
          background: #000000 !important;
        }

        :global(.dark) .im-step {
          background: #000000 !important;
          border: 1.5px solid rgba(59, 130, 246, 0.35) !important;
          border-radius: 14px !important;
        }

        :global(.dark) .im-step:hover {
          border-color: #1a73e8 !important;
          box-shadow: 0 0 14px rgba(26, 115, 232, 0.25) !important;
        }

        :global(.dark) .im-stepNo {
          background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
          color: #ffffff !important;
          box-shadow: 0 0 10px rgba(14, 165, 233, 0.4) !important;
        }

        :global(.dark) .im-stepNo--green {
          background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
          color: #ffffff !important;
          box-shadow: 0 0 10px rgba(37, 99, 235, 0.4) !important;
        }

        :global(.dark) .im-stepTitle {
          color: #ffffff !important;
        }

        :global(.dark) .im-btn--download {
          background: #1a73e8 !important;
          border: 1.5px solid #3b82f6 !important;
          color: #ffffff !important;
          box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important;
        }

        :global(.dark) .im-btn--download:hover:not(:disabled) {
          background: #1557b0 !important;
          box-shadow: 0 0 20px rgba(26, 115, 232, 0.6) !important;
        }

        :global(.dark) .im-fileInner {
          background: #000000 !important;
          border: 2px dashed rgba(56, 189, 248, 0.5) !important;
          border-radius: 12px !important;
        }

        :global(.dark) .im-fileUpload:hover:not(.is-disabled) .im-fileInner {
          border-color: #38bdf8 !important;
          background: rgba(14, 165, 233, 0.08) !important;
          box-shadow: 0 0 16px rgba(56, 189, 248, 0.25) !important;
        }

        :global(.dark) .im-uploadIcon {
          color: #38bdf8 !important;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.5)) !important;
        }

        :global(.dark) .im-fileLabel {
          color: #ffffff !important;
        }

        :global(.dark) .im-fileFormat {
          color: #94a3b8 !important;
        }

        :global(.dark) .im-footer {
          background: #000000 !important;
          border-top: 1.5px solid rgba(59, 130, 246, 0.35) !important;
        }

        :global(.dark) .im-btn--close {
          background: #000000 !important;
          border: 1.5px solid rgba(59, 130, 246, 0.4) !important;
          color: #ffffff !important;
          border-radius: 10px !important;
        }

        :global(.dark) .im-btn--close:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: #3b82f6 !important;
          color: #ffffff !important;
        }

        :global(.dark) .im-loading {
          background: rgba(26, 115, 232, 0.15) !important;
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
          color: #38bdf8 !important;
        }

        :global(.dark) .im-spinner {
          border-color: rgba(56, 189, 248, 0.3) !important;
          border-top-color: #38bdf8 !important;
        }

        .im-stepTitle {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--n-text);
          letter-spacing: -0.01em;
        }

        /* Buttons */
        .im-btn {
          appearance: none;
          border: none;
          border-radius: 9px;
          padding: 11px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.2s ease;
          user-select: none;
        }

        .im-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .im-btn--download {
          background: linear-gradient(135deg, #1e3a8a, #1e40af);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(30, 58, 138, 0.3),
                      inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .im-btn--download:hover:not(:disabled) {
          box-shadow: 0 6px 18px rgba(30, 58, 138, 0.4),
                      inset 0 1px 0 rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
        }

        .im-btn--download:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(30, 58, 138, 0.3);
        }

        .im-btn--close {
          background: #f1f5f9;
          color: var(--n-muted);
        }

        .im-btn--close:hover {
          background: #e2e8f0;
          color: var(--n-text);
        }

        /* File Upload */
        .im-fileUpload {
          display: block;
          position: relative;
          cursor: pointer;
        }

        .im-fileUpload.is-disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .im-fileUpload input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .im-fileInner {
          background: #fafbff;
          border: 2px dashed #cbd5e1;
          border-radius: 9px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
        }

        .im-fileUpload:hover:not(.is-disabled) .im-fileInner {
          border-color: #16a34a;
          background: #f0fdf4;
          box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.05);
        }

        .im-uploadIcon {
          font-size: 28px;
          color: #16a34a;
          filter: drop-shadow(0 2px 4px rgba(22, 163, 74, 0.2));
        }

        .im-fileText {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .im-fileLabel {
          font-size: 13px;
          font-weight: 600;
          color: var(--n-text);
        }

        .im-fileFormat {
          font-size: 11px;
          color: var(--n-muted);
        }

        /* Loading */
        .im-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          background: linear-gradient(135deg, #dbeafe, #eff6ff);
          border: 1px solid #bfdbfe;
          border-radius: 9px;
          color: #1e3a8a;
          font-size: 13px;
          font-weight: 600;
        }

        .im-spinner {
          width: 18px;
          height: 18px;
          border: 3px solid #bfdbfe;
          border-top-color: #1e3a8a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Footer */
        .im-footer {
          padding: 14px 18px;
          border-top: 1px solid #e0e7ff;
          background: linear-gradient(to bottom, #fafbff, #ffffff);
          display: flex;
          justify-content: flex-end;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .im-overlay {
            padding: 12px;
          }

          .im-modal {
            max-width: 100%;
          }

          .im-header {
            padding: 16px 18px;
          }

          .im-title {
            font-size: 15px;
          }

          .im-body {
            padding: 16px;
          }

          .im-step {
            padding: 12px;
          }

          .im-footer {
            padding: 12px 16px;
          }

          .im-btn {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .im-overlay,
          .im-modal,
          .im-btn,
          .im-fileInner,
          .im-close {
            animation: none;
            transition: none;
          }
          .im-spinner {
            animation: none;
          }
        }
        :global(.dark) .im-modal { background: var(--n-card); border-color: rgba(255,255,255,0.08); }
        :global(.dark) .im-step { background: var(--n-surface); border-color: var(--n-border); }
      `}</style>
    </div>,
    document.body
  )
}
