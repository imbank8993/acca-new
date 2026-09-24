'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PreviewRow {
  id: string
  table: string
  column: string
  oldValue: string
  newValue: string
  rowLabel: string
  nip?: string
  nisn?: string
  tableKey: string
  rowId: string
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  // ── Core Master Data ──────────────────────────────────────
  users: 'Users',
  master_guru: 'Master Guru',
  master_siswa: 'Master Siswa',
  master_mapel: 'Master Mapel',
  master_kelas: 'Master Kelas',
  master_kode_guru: 'Master Kode Guru',
  master_dropdown: 'Master Dropdown',
  master_tahun_ajaran: 'Tahun Ajaran',
  master_agenda_kategori: 'Agenda Kategori',
  profile_sekolah: 'Profil Sekolah',

  // ── Guru & Mapel Relations ──────────────────────────────────
  guru_mapel: 'Guru Mapel',
  kelas_mapel: 'Kelas Mapel',
  master_mapel_kelas: 'Master Mapel Kelas',
  guru_asuh: 'Guru Asuh',
  wali_kelas: 'Wali Kelas',
  izin_guru: 'Izin Guru',

  // ── Jadwal & Piket ─────────────────────────────────────────
  jadwal_guru: 'Jadwal Guru',
  jadwal_piket: 'Jadwal Piket',
  laporan_piket: 'Laporan Piket',
  laporan_piket_detail: 'Piket Detail',

  // ── Siswa ─────────────────────────────────────────────────
  siswa_kelas: 'Siswa Kelas',
  nilai: 'Nilai',
  ketidakhadiran: 'Ketidakhadiran',

  // ── Jurnal & LCKH ─────────────────────────────────────────
  jurnal: 'Jurnal',
  lckh_submissions: 'LCKH',
  lckh_rekap_siswa: 'LCKH Rekap',

  // ── Akademik & Informasi ─────────────────────────────────
  informasi_akademik: 'Info Akademik',
  agenda_akademik: 'Agenda Akademik',
  tugas_tambahan: 'Tugas Tambahan',
  tugas_siswa: 'Tugas Siswa',
  ekskul: 'Ekstrakurikuler',
  ekskul_siswa: 'Ekskul Siswa',
  ekskul_pembina: 'Pembina Ekskul',

  // ── Keuangan & Catatan ────────────────────────────────────
  catatan_keuangan_guru: 'Keuangan Guru',
  kelulusan_data: 'Kelulusan',

  // ── Lainnya ────────────────────────────────────────────────
  surat: 'Surat',
  notifications: 'Notifikasi',
  chat_messages: 'Chat',
  kokurikuler_responses: 'Kokurikuler',
}

const TABLE_COLORS: Record<string, string> = {
  // ── Core Master Data ──────────────────────────────────────
  users: '#3083FF',
  master_guru: '#3b82f6',
  master_siswa: '#3b82f6',
  master_mapel: '#06b6d4',
  master_kelas: '#f97316',
  master_kode_guru: '#f59e0b',
  master_dropdown: '#14b8a6',
  master_tahun_ajaran: '#10b981',
  master_agenda_kategori: '#84cc16',
  profile_sekolah: '#eab308',

  // ── Guru & Mapel Relations ──────────────────────────────────
  guru_mapel: '#fb923c',
  kelas_mapel: '#fb7185',
  master_mapel_kelas: '#f87171',
  guru_asuh: '#3083FF',
  wali_kelas: '#60a5fa',
  izin_guru: '#3083FF',

  // ── Jadwal & Piket ─────────────────────────────────────────
  jadwal_guru: '#eab308',
  jadwal_piket: '#facc15',
  laporan_piket: '#f59e0b',
  laporan_piket_detail: '#d97706',

  // ── Siswa ─────────────────────────────────────────────────
  siswa_kelas: '#3083FF',
  nilai: '#3083FF',
  ketidakhadiran: '#002a7a',

  // ── Jurnal & LCKH ─────────────────────────────────────────
  jurnal: '#3b82f6',
  lckh_submissions: '#0ea5e9',
  lckh_rekap_siswa: '#06b6d4',

  // ── Akademik & Informasi ─────────────────────────────────
  informasi_akademik: '#10b981',
  agenda_akademik: '#14b8a6',
  tugas_tambahan: '#22c55e',
  tugas_siswa: '#84cc16',
  ekskul: '#eab308',
  ekskul_siswa: '#facc15',
  ekskul_pembina: '#f59e0b',

  // ── Keuangan & Catatan ────────────────────────────────────
  catatan_keuangan_guru: '#fb923c',
  kelulusan_data: '#f97316',

  // ── Lainnya ────────────────────────────────────────────────
  surat: '#3083FF',
  notifications: '#3b82f6',
  chat_messages: '#3083FF',
  kokurikuler_responses: '#06b6d4',
}

// Group results by table for summary
function groupByTable(rows: PreviewRow[]) {
  const map = new Map<string, PreviewRow[]>()
  for (const row of rows) {
    map.set(row.table, [...(map.get(row.table) || []), row])
  }
  return Array.from(map.entries()).map(([table, rows]) => ({ table, rows, count: rows.length }))
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BulkReplaceTab() {
  const [dataLama, setDataLama]   = useState('')
  const [dataBaru, setDataBaru]   = useState('')
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [selectedIds, setSelectedIds]  = useState<Set<string>>(new Set())
  const [allChecked, setAllChecked]    = useState(false)
  const [searched, setSearched]        = useState(false)
  const [loading, setLoading]          = useState(false)
  const [executing, setExecuting]      = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  // ── Search ──────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!dataLama.trim()) {
      setMsg({ type: 'error', text: 'Data Lama belum diisi.' })
      return
    }
    if (!dataBaru.trim()) {
      setMsg({ type: 'error', text: 'Data Baru belum diisi.' })
      return
    }
    if (dataLama.trim() === dataBaru.trim()) {
      setMsg({ type: 'error', text: 'Data Lama dan Data Baru tidak boleh sama.' })
      return
    }

    setLoading(true)
    setMsg(null)
    setSearched(false)
    setPreviewRows([])
    setSelectedIds(new Set())
    setAllChecked(false)

    try {
      const res = await fetch(
        `/api/reset-data/search?value=${encodeURIComponent(dataLama.trim())}`
      )
      const data = await res.json()

      if (!data.ok) {
        setMsg({ type: 'error', text: data.error || 'Gagal mencari data.' })
        return
      }

      const rows: PreviewRow[] = data.results.map((r: PreviewRow) => ({
        ...r,
        newValue: dataBaru.trim(),
      }))

      setPreviewRows(rows)
      setSearched(true)

      if (rows.length === 0) {
        setMsg({ type: 'info', text: `Tidak ditemukan data "${dataLama.trim()}" di database manapun.` })
      } else {
        const g = groupByTable(rows)
        setMsg({
          type: 'info',
          text: `Ditemukan ${rows.length} record di ${g.length} tabel. Centang baris yang ingin diperbarui, lalu klik "Eksekusi".`,
        })
      }
    } catch {
      setMsg({ type: 'error', text: 'Terjadi kesalahan koneksi saat mencari data.' })
    } finally {
      setLoading(false)
    }
  }

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds(new Set())
      setAllChecked(false)
    } else {
      setSelectedIds(new Set(previewRows.map(r => r.id)))
      setAllChecked(true)
    }
  }

  // ── Execute ─────────────────────────────────────────────────────────────────
  const handleExecute = async () => {
    if (selectedIds.size === 0) {
      setMsg({ type: 'error', text: 'Pilih minimal satu baris untuk diperbarui.' })
      return
    }

    const ok = window.confirm(
      `PERINGATAN!\n\nAkan memperbarui ${selectedIds.size} record.\n"${dataLama}" → "${dataBaru}"\n\nOperasi ini TIDAK BISA dibatalkan!\n\nYakin ingin melanjutkan?`
    )
    if (!ok) return

    const ok2 = window.confirm(
      `Konfirmasi terakhir.\n\nUbah ${selectedIds.size} record?`
    )
    if (!ok2) return

    setExecuting(true)
    setMsg(null)

    try {
      const rowsToUpdate = previewRows
        .filter(r => selectedIds.has(r.id))
        .map(r => ({
          table:    r.table,
          column:   r.column,
          // `oldValue` WAJIB untuk penggantian NIP/NISN: server memakainya sebagai
          // patokan mencari baris di tabel-tabel lain yang menyimpan nilai itu
          // sebagai teks. Tanpa ini, cascade tidak punya kunci pencarian —
          // master berubah sementara tabel lain tidak tersentuh.
          oldValue: r.oldValue,
          newValue: dataBaru.trim(),
          tableKey: r.tableKey,
          rowId:    r.rowId,
        }))

      const res = await fetch('/api/reset-data/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToUpdate }),
      })
      const data = await res.json()

      // Process results even if ok=false (partial success)
      if (!data.results || data.results.length === 0) {
        const errDetail = data.error || 'Gagal memperbarui data.'
        setMsg({ type: 'error', text: errDetail })
        return
      }

      /**
       * Hanya status 'ok' yang dianggap tersimpan.
       *
       * Server kini membedakan tiga hasil: 'ok' (baris benar-benar berubah),
       * 'error' (gagal), dan 'skipped' (tidak ada baris yang cocok — dulu ini
       * dilaporkan sebagai berhasil). Baris 'skipped' sengaja DIBIARKAN di
       * pratinjau supaya terlihat bahwa ia belum tergarap.
       */
      const updatedIds = new Set(
        data.results
          .filter((r: any) => r.status === 'ok')
          .map((r: any) => `${r.table}:${r.rowId}`)
      )

      // Always remove successfully updated rows from preview
      const remaining = previewRows.filter(r => !updatedIds.has(r.id))
      setPreviewRows(remaining)
      setSelectedIds(new Set())
      setAllChecked(false)
      setSearched(remaining.length > 0)

      if (data.failed === 0) {
        setMsg({ type: 'success', text: `Berhasil memperbarui ${data.updated} record!` })
      } else if (data.updated > 0) {
        // Partial success
        // 'skipped' ikut dihitung gagal oleh server, jadi alasannya harus ikut
        // ditampilkan — kalau tidak, pesannya berbunyi "Gagal: 2. Detail:" kosong.
        const failedErrors = data.results
          .filter((r: any) => r.status === 'error' || r.status === 'skipped')
          .map((r: any) => `[${r.table}.${r.column}] ${r.error}`)
          .join('; ')
        setMsg({ type: 'error', text: `Berhasil: ${data.updated}, Gagal: ${data.failed}. Detail: ${failedErrors}` })
      } else {
        // All failed
        const firstError = data.results?.find((r: any) => r.status !== 'ok') || data.results?.[0]
        setMsg({ type: 'error', text: `Gagal: [${firstError?.table}.${firstError?.column}] ${firstError?.error}` })
      }
    } catch (err) {
      setMsg({ type: 'error', text: `Kesalahan: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setExecuting(false)
    }
  }

  const selectedCount = selectedIds.size
  const groups = searched ? groupByTable(previewRows) : []

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bulk">


      {/* Input Section */}
      <div className="bulk__inputSection">
        <div className="bulk__inputGrid">
          {/* Data Lama */}
          <div className="bulk__field">
            <label className="bulk__label">
              <i className="bi bi-archive"></i>
              Data Lama <span className="bulk__required">*</span>
            </label>
            <div className="bulk__inputWrap">
              <input
                type="text"
                value={dataLama}
                onChange={e => { setDataLama(e.target.value); setSearched(false) }}
                placeholder="Ketik data yang akan diganti..."
                onKeyDown={e => { if (e.key === 'Enter') handlePreview() }}
              />
            </div>
            <span className="bulk__hint">Mencari di SEMUA kolom & tabel database</span>
          </div>

          {/* Arrow */}
          <div className="bulk__arrow">
            <div className="bulk__arrowLine">
              <i className="bi bi-arrow-right-short"></i>
            </div>
          </div>

          {/* Data Baru */}
          <div className="bulk__field">
            <label className="bulk__label">
              <i className="bi bi-pen"></i>
              Data Baru <span className="bulk__required">*</span>
            </label>
            <div className="bulk__inputWrap">
              <input
                type="text"
                value={dataBaru}
                onChange={e => { setDataBaru(e.target.value); setSearched(false) }}
                placeholder="Ketik data pengganti..."
                onKeyDown={e => { if (e.key === 'Enter') handlePreview() }}
              />
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="bulk__actionRow">
          {msg && (
            <div className={`bulk__toast bulk__toast--${msg.type}`}>
              <i className={`bi ${msg.type === 'success' ? 'bi-check-circle-fill' : msg.type === 'error' ? 'bi-x-circle-fill' : 'bi-info-circle-fill'}`} />
              <span>{msg.text}</span>
            </div>
          )}
          <Button
            variant="primary"
            icon="search"
            onClick={handlePreview}
            disabled={loading || !dataLama.trim() || !dataBaru.trim()}
            isLoading={loading}
          >
            Cari Data
          </Button>
        </div>
      </div>

      {/* Danger Alert */}
      <div className="bulk__danger">
        <div className="bulk__dangerIcon"><i className="bi bi-shield-exclamation"></i></div>
        <div className="bulk__dangerText">
          <strong>Peringatan Penting</strong>
          <p>Data yang diubah langsung tersimpan ke database dan <strong>tidak dapat dibatalkan</strong>. Gunakan preview untuk memastikan baris yang dipilih sudah benar.</p>
        </div>
      </div>

      {/* Table Chips */}
      {searched && previewRows.length > 0 && (
        <div className="bulk__chips">
          <span className="bulk__chipsLabel"><i className="bi bi-table"></i> Ditemukan di {groups.length} tabel:</span>
          {groups.map(g => (
            <span key={g.table} className="bulk__chip" style={{ '--chip-color': TABLE_COLORS[g.table] || '#64748b' } as React.CSSProperties}>
              {TABLE_LABELS[g.table] || g.table}
              <strong>{g.count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Preview Card */}
      {searched && previewRows.length > 0 && (
        <div className="bulk__previewCard">
          <div className="bulk__previewHeader">
            <div className="bulk__previewTitle">
              <h3>Hasil Preview</h3>
              <div className="bulk__previewMeta">
                <span className="bulk__metaOld"><i className="bi bi-arrow-right"></i>{dataLama}</span>
                <span className="bulk__metaArrow"><i className="bi bi-arrow-right"></i></span>
                <span className="bulk__metaNew"><i className="bi bi-check2"></i>{dataBaru}</span>
              </div>
            </div>
            <label className="bulk__selectAll">
              <div className="bulk__checkbox">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                <span className="bulk__checkMark"><i className="bi bi-check"></i></span>
              </div>
              <span>Pilih Semua ({previewRows.length})</span>
            </label>
          </div>

          {/* Table */}
          <div className="bulk__tableWrap">
            <table className="bulk__table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>#</th>
                  <th>Tabel</th>
                  <th>Kolom</th>
                  <th>Label</th>
                  <th>Lama</th>
                  <th>Baru</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const checked = selectedIds.has(row.id)
                  return (
                    <tr key={row.id} className={checked ? 'bulk__row--checked' : ''} onClick={() => toggleRow(row.id)}>
                      <td>
                        <div className={`bulk__rowCheck ${checked ? 'bulk__rowCheck--active' : ''}`}>
                          {checked && <i className="bi bi-check-lg"></i>}
                        </div>
                      </td>
                      <td className="bulk__no">{idx + 1}</td>
                      <td>
                        <span className="bulk__tableBadge" style={{ '--badge-color': TABLE_COLORS[row.table] || '#64748b' } as React.CSSProperties}>
                          {TABLE_LABELS[row.table] || row.table}
                        </span>
                      </td>
                      <td><code className="bulk__code">{row.column}</code></td>
                      <td className="bulk__labelCell"><span className="bulk__rowLabel">{row.rowLabel}</span></td>
                      <td><span className="bulk__val bulk__val--old">{row.oldValue}</span></td>
                      <td><span className="bulk__val bulk__val--new">{dataBaru}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Execute Footer */}
          <div className="bulk__footer">
            <div className="bulk__footerInfo">
              <div className={`bulk__footerDot ${selectedCount > 0 ? 'bulk__footerDot--active' : ''}`} />
              <span><strong>{selectedCount}</strong> dari <strong>{previewRows.length}</strong> baris dipilih</span>
            </div>
            <Button
              variant="primary"
              icon="save"
              onClick={handleExecute}
              disabled={executing || selectedCount === 0}
              isLoading={executing}
            >
              Eksekusi Perubahan ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      {searched && previewRows.length === 0 && (
        <div className="bulk__empty">
          <i className="bi bi-search"></i>
          <h4>Tidak Ada Data Ditemukan</h4>
          <p>Tidak ada record yang cocok dengan "{dataLama}" di database manapun.</p>
        </div>
      )}

      <style>{`
        .bulk { display: flex; flex-direction: column; gap: 20px; animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Hero */
        .bulk__hero {
          position: relative;
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 28px 32px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
        }
        .bulk__heroBg {
          position: absolute; inset: 0; pointer-events: none;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        .bulk__heroIcon {
          width: 60px; height: 60px; flex-shrink: 0;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; color: white;
          backdrop-filter: blur(10px);
          position: relative; z-index: 1;
        }
        .bulk__heroText { position: relative; z-index: 1; }
        .bulk__heroText h2 { margin: 0 0 6px; font-size: 1.4rem; font-weight: 800; color: white; letter-spacing: -0.02em; }
        .bulk__heroText p { margin: 0; font-size: 0.88rem; color: rgba(255,255,255,0.65); font-weight: 500; }

        /* Input Section */
        .bulk__inputSection {
          background: var(--n-card);
          border-radius: 20px;
          border: 1px solid var(--n-border);
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
          padding: 28px;
          display: flex; flex-direction: column; gap: 20px;
        }
        .bulk__inputGrid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 0;
          align-items: start;
        }
        .bulk__field { display: flex; flex-direction: column; gap: 8px; }
        .bulk__label {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.72rem; font-weight: 800; color: var(--n-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .bulk__label i { color: var(--n-text); font-size: 0.8rem; }
        .bulk__required { color: #f87171; }
        .bulk__inputWrap input {
          width: 100%; padding: 13px 16px;
          border: 1.5px solid var(--n-border); border-radius: 12px;
          font-size: 0.9rem; font-weight: 600; color: var(--n-text);
          background: var(--n-soft); outline: none; transition: all 0.2s;
        }
        .bulk__inputWrap input:focus {
          border-color: #3b82f6;
          background: var(--n-card);
          box-shadow: 0 0 0 4px rgba(59,130,246,0.1);
        }
        .bulk__inputWrap input::placeholder { color: var(--n-muted); font-weight: 400; }
        .bulk__hint { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; }
        .bulk__arrow {
          display: flex; align-items: center; justify-content: center;
          padding: 0 16px; padding-top: 36px;
        }
        .bulk__arrowLine {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #0f172a, #1e40af);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 1.1rem;
          box-shadow: 0 4px 12px rgba(30,64,175,0.25);
        }
        .bulk__actionRow {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .bulk__btnPreview {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 28px;
          background: linear-gradient(135deg, #0f172a, #1e40af);
          color: white; border: none; border-radius: 12px;
          font-weight: 700; font-size: 0.9rem; cursor: pointer;
          box-shadow: 0 4px 12px rgba(30,64,175,0.25);
          transition: all 0.2s; white-space: nowrap;
          margin-left: auto;
        }
        .bulk__btnPreview:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(30,64,175,0.3); }
        .bulk__btnPreview:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .bulk__spin { animation: spin 0.8s linear infinite; }
        .bulk__toast {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; border-radius: 12px;
          font-size: 0.85rem; font-weight: 600; flex: 1;
          border: 1px solid transparent;
        }
        .bulk__toast--success { background: #ecfdf5; color: #059669; border-color: #d1fae5; }
        .bulk__toast--error { background: #fff1f2; color: #dc2626; border-color: #fecaca; }
        .bulk__toast--info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
        .bulk__toast i { font-size: 1rem; flex-shrink: 0; }

        /* Danger */
        .bulk__danger {
          display: flex; gap: 16px;
          padding: 18px 22px;
          background: linear-gradient(to right, #fff7f7, #fff1f2);
          border: 1px solid #fecaca; border-left: 4px solid #ef4444;
          border-radius: 16px;
        }
        .bulk__dangerIcon {
          width: 40px; height: 40px; flex-shrink: 0;
          background: #fef2f2; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; color: #ef4444;
        }
        .bulk__dangerText strong { font-size: 0.85rem; font-weight: 800; color: #dc2626; display: block; margin-bottom: 4px; }
        .bulk__dangerText p { margin: 0; font-size: 0.82rem; color: var(--n-muted); line-height: 1.5; }
        .bulk__dangerText p strong { display: inline; color: var(--n-text); }

        /* Chips */
        .bulk__chips {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        }
        .bulk__chipsLabel {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.78rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.05em;
        }
        .bulk__chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 20px;
          font-size: 0.75rem; font-weight: 700; color: white;
          background: var(--chip-color);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        /* Preview Card */
        .bulk__previewCard {
          background: var(--n-card);
          border-radius: 20px;
          border: 1px solid var(--n-border);
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .bulk__previewHeader {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px;
          background: var(--n-soft); border-bottom: 1px solid var(--n-border);
          flex-wrap: wrap; gap: 12px;
        }
        .bulk__previewTitle h3 { margin: 0 0 8px; font-size: 0.95rem; font-weight: 800; color: var(--n-text); }
        .bulk__previewMeta { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
        .bulk__metaOld { background: #fff1f2; color: #be123c; padding: 3px 10px; border-radius: 8px; font-weight: 700; }
        .bulk__metaArrow { color: var(--n-muted); font-size: 0.7rem; }
        .bulk__metaNew { background: #ecfdf5; color: #059669; padding: 3px 10px; border-radius: 8px; font-weight: 700; }

        /* Checkbox */
        .bulk__selectAll {
          display: flex; align-items: center; gap: 10px;
          cursor: pointer; user-select: none;
        }
        .bulk__checkbox {
          position: relative; width: 20px; height: 20px;
        }
        .bulk__checkbox input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
        .bulk__checkMark {
          position: absolute; inset: 0;
          background: var(--n-primary);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 0.65rem;
          opacity: 0; transition: opacity 0.2s;
        }
        .bulk__checkbox input:checked ~ .bulk__checkMark { opacity: 1; }
        .bulk__checkbox { background: #e2e8f0; border-radius: 6px; transition: background 0.2s; }
        .bulk__selectAll:has(input:checked) .bulk__checkbox { background: var(--n-primary); }
        .bulk__selectAll span { font-size: 0.85rem; font-weight: 600; color: var(--n-muted); }

        /* Table */
        .bulk__tableWrap { overflow-x: auto; }
        .bulk__table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
        .bulk__table th {
          padding: 11px 14px; text-align: left;
          background: var(--n-soft);
          font-size: 0.68rem; font-weight: 800; color: var(--n-muted);
          text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap;
          border-bottom: 2px solid var(--n-border);
        }
        .bulk__table td { padding: 12px 14px; border-bottom: 1px solid #f8fafc; color: var(--n-muted); vertical-align: middle; }
        .bulk__table tbody tr { cursor: pointer; transition: background 0.15s; }
        .bulk__table tbody tr:hover td { background: #f8faff; }
        .bulk__row--checked td { background: #eff6ff !important; }
        .bulk__no { color: var(--n-muted); font-size: 0.78rem; text-align: center; font-weight: 600; }
        .bulk__rowCheck {
          width: 22px; height: 22px; border-radius: 6px;
          border: 2px solid var(--n-border); display: flex; align-items: center; justify-content: center;
          color: white; font-size: 0.65rem; transition: all 0.2s;
        }
        .bulk__rowCheck--active { background: var(--n-primary); border-color: var(--n-primary); }
        .bulk__tableBadge {
          display: inline-block; padding: 3px 10px; border-radius: 8px;
          font-size: 0.72rem; font-weight: 700; color: white; white-space: nowrap;
          background: var(--badge-color);
        }
        .bulk__code { font-size: 0.72rem; font-family: 'JetBrains Mono', 'Fira Code', monospace; background: var(--n-soft); color: var(--n-muted); padding: 2px 8px; border-radius: 6px; }
        .bulk__labelCell { max-width: 200px; }
        .bulk__rowLabel { display: block; font-weight: 600; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bulk__val { padding: 3px 10px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; }
        .bulk__val--old { background: #fff1f2; color: #be123c; }
        .bulk__val--new { background: #ecfdf5; color: #059669; }

        /* Footer */
        .bulk__footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 24px; background: var(--n-soft); border-top: 1px solid var(--n-border);
          gap: 16px; flex-wrap: wrap;
        }
        .bulk__footerInfo {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.85rem; color: var(--n-muted); font-weight: 600;
        }
        .bulk__footerDot {
          width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0;
          transition: background 0.2s;
        }
        .bulk__footerDot--active { background: var(--n-primary); box-shadow: 0 0 8px rgba(30,64,175,0.4); }
        .bulk__btnExecute {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: white; border: none; border-radius: 12px;
          font-weight: 800; font-size: 0.88rem; cursor: pointer;
          box-shadow: 0 4px 12px rgba(220,38,38,0.25);
          transition: all 0.2s;
        }
        .bulk__btnExecute:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(220,38,38,0.35); }
        .bulk__btnExecute:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Empty */
        .bulk__empty {
          text-align: center; padding: 64px 40px;
          background: var(--n-card); border: 2px dashed #e2e8f0; border-radius: 20px;
        }
        .bulk__empty i { font-size: 2.5rem; color: #cbd5e1; margin-bottom: 16px; }
        .bulk__empty h4 { margin: 0 0 8px; font-size: 1.05rem; font-weight: 800; color: var(--n-text); }
        .bulk__empty p { margin: 0; font-size: 0.88rem; color: var(--n-muted); }

        @media (max-width: 768px) {
          .bulk__inputGrid { grid-template-columns: 1fr; }
          .bulk__arrow { display: none; }
          .bulk__footer { justify-content: center; }
          .bulk__btnExecute { width: 100%; justify-content: center; }
          .bulk__hero { padding: 20px; }
        }
        /* ===== DARK MODE STANDARD ===== */
        :global(.dark) .bulk__hero,
        :global(.dark) .bulk__inputSection,
        :global(.dark) .bulk__previewCard,
        :global(.dark) .bulk__empty {
          background: #000000 !important;
          border: 2.2px solid rgba(26, 115, 232, 0.85) !important;
          border-radius: 20px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
        }
        :global(.dark) .bulk__inputWrap input {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 12px !important;
          color: #e2e8f0 !important;
        }
        :global(.dark) .bulk__inputWrap input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
        }
        :global(.dark) .bulk__table thead tr,
        :global(.dark) .bulk__table th {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .bulk__table td {
          background: #000000 !important;
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
          color: #cbd5e1 !important;
        }
        :global(.dark) .bulk__table tbody tr:hover td {
          background: rgba(26, 115, 232, 0.08) !important;
        }
        :global(.dark) .bulk__heroText h2,
        :global(.dark) .bulk__previewTitle h3,
        :global(.dark) .bulk__rowLabel,
        :global(.dark) .bulk__empty h4 {
          color: #e2e8f0 !important;
        }
        :global(.dark) .bulk__btnPreview,
        :global(.dark) .bulk__arrowLine {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
        }
        :global(.dark) .bulk__previewHeader,
        :global(.dark) .bulk__footer {
          background: #000000 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .bulk__danger {
          background: linear-gradient(to right, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.12)) !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
          border-left: 4px solid #ef4444 !important;
          border-radius: 16px !important;
        }
        :global(.dark) .bulk__dangerIcon {
          background: rgba(239, 68, 68, 0.18) !important;
          color: #f87171 !important;
        }
        :global(.dark) .bulk__dangerText strong {
          color: #f87171 !important;
        }
        :global(.dark) .bulk__dangerText p {
          color: #94a3b8 !important;
        }
        :global(.dark) .bulk__dangerText p strong {
          color: #e2e8f0 !important;
        }
        :global(.dark) .bulk__label {
          color: #94a3b8 !important;
        }
        :global(.dark) .bulk__label i {
          color: #60a5fa !important;
        }
        :global(.dark) .bulk__hint {
          color: #60a5fa !important;
        }
        :global(.dark) .bulk__toast--success {
          background: rgba(16, 185, 129, 0.12) !important;
          color: #34d399 !important;
          border-color: rgba(16, 185, 129, 0.4) !important;
        }
        :global(.dark) .bulk__toast--error {
          background: rgba(239, 68, 68, 0.12) !important;
          color: #f87171 !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
        }
        :global(.dark) .bulk__toast--info {
          background: rgba(26, 115, 232, 0.12) !important;
          color: #60a5fa !important;
          border-color: rgba(59, 130, 246, 0.4) !important;
        }
        :global(.dark) .bulk__code {
          background: rgba(26, 115, 232, 0.15) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
        }
        :global(.dark) .bulk__val--old {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
        }
        :global(.dark) .bulk__val--new {
          background: rgba(16, 185, 129, 0.15) !important;
          color: #34d399 !important;
        }
        :global(.dark) .bulk__metaOld {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
        }
        :global(.dark) .bulk__metaNew {
          background: rgba(16, 185, 129, 0.15) !important;
          color: #34d399 !important;
        }
        :global(.dark) .bulk__row--checked td {
          background: rgba(26, 115, 232, 0.1) !important;
        }
        :global(.dark) .bulk__rowCheck {
          border-color: rgba(26, 115, 232, 0.5) !important;
        }
        :global(.dark) .bulk__empty {
          border-color: rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .bulk__empty i {
          color: #60a5fa !important;
        }
        :global(.dark) .bulk__chipsLabel {
          color: #94a3b8 !important;
        }
        :global(.dark) .bulk__btnExecute {
          background: linear-gradient(135deg, #dc2626, #991b1b) !important;
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.45) !important;
        }
        :global(.dark) .bulk__inputWrap input::placeholder {
          color: #64748b !important;
        }
        /* ===== END DARK MODE STANDARD ===== */


`}</style>
    </div>
  )
}
