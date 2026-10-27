'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import Button from '@/components/ui/Button'
import { InlineSelect } from '@/components/ui/InlineSelect'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'

type Kategori = 'nasional' | 'cuti_bersama' | 'peringatan' | 'lainnya'
type Status = 'baru' | 'sebagian' | 'sudah_ada'

interface ItemNasional {
  uid: string
  tanggal_mulai: string
  tanggal_selesai: string
  keterangan: string
  deskripsi: string
  kategori: Kategori
  jumlah_hari: number
  tanggal_terisi: string[]
  keterangan_terisi: string[]
  status: Status
}

const LABEL_KATEGORI: Record<Kategori, string> = {
  nasional: 'Libur Nasional',
  cuti_bersama: 'Cuti Bersama',
  peringatan: 'Peringatan',
  lainnya: 'Perlu dicek',
}

/** Dicentang otomatis saat pratinjau dimuat. Peringatan & "lainnya" tidak. */
const KATEGORI_DEFAULT: Kategori[] = ['nasional', 'cuti_bersama']

const fmt = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
})
const fmtTanggal = (t: string) => fmt.format(new Date(`${t}T00:00:00Z`))
const fmtRentang = (a: string, b: string) => (a === b ? fmtTanggal(a) : `${fmtTanggal(a)} – ${fmtTanggal(b)}`)

/**
 * Ambil libur nasional dari kalender publik Google, pilih, lalu simpan ke
 * Data Libur sebagai libur sehari penuh untuk seluruh madrasah. Tanggal yang
 * sudah punya data libur (apa pun lingkupnya) dilewati server — tidak ditimpa.
 */
export default function SinkronLiburNasionalModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}) {
  const tahunIni = new Date().getFullYear()
  const [tahun, setTahun] = useState(tahunIni + (new Date().getMonth() >= 9 ? 1 : 0))
  const [tahunTersedia, setTahunTersedia] = useState<number[]>([])
  const [items, setItems] = useState<ItemNasional[]>([])
  const [dipilih, setDipilih] = useState<Set<string>>(new Set())
  const [tampilPeringatan, setTampilPeringatan] = useState(false)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)

  const muat = useCallback(async (th: number, segarkan = false) => {
    setMemuat(true)
    setGalat('')
    try {
      const qs = new URLSearchParams({ tahun: String(th) })
      if (segarkan) qs.set('segarkan', '1')
      const res = await fetch(`/api/settings/libur/nasional?${qs}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.message || json?.error || `Gagal memuat (HTTP ${res.status})`)
      const data: ItemNasional[] = json.data?.items || []
      setItems(data)
      setTahunTersedia(json.data?.tahun_tersedia || [])
      setDipilih(new Set(
        data
          .filter(i => KATEGORI_DEFAULT.includes(i.kategori) && i.status !== 'sudah_ada')
          .map(i => i.uid)
      ))
    } catch (err: any) {
      setItems([])
      setDipilih(new Set())
      setGalat(err?.message || 'Kalender libur nasional tidak dapat dimuat.')
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    if (open) muat(tahun)
  }, [open, tahun, muat])

  const terlihat = useMemo(
    () => items.filter(i => tampilPeringatan || i.kategori !== 'peringatan'),
    [items, tampilPeringatan]
  )
  const bisaDipilih = terlihat.filter(i => i.status !== 'sudah_ada')
  const jumlahDipilih = items.filter(i => dipilih.has(i.uid) && i.status !== 'sudah_ada').length
  const semuaTerpilih = bisaDipilih.length > 0 && bisaDipilih.every(i => dipilih.has(i.uid))
  const jumlahPeringatan = items.filter(i => i.kategori === 'peringatan').length

  const toggle = (uid: string) => setDipilih(prev => {
    const s = new Set(prev)
    if (s.has(uid)) s.delete(uid); else s.add(uid)
    return s
  })
  const toggleSemua = () => setDipilih(prev => {
    const s = new Set(prev)
    if (semuaTerpilih) bisaDipilih.forEach(i => s.delete(i.uid))
    else bisaDipilih.forEach(i => s.add(i.uid))
    return s
  })

  const pilihanTahun = useMemo(() => {
    const set = new Set<number>([tahunIni, tahunIni + 1, tahun, ...tahunTersedia])
    return [...set].sort((a, b) => a - b)
  }, [tahunIni, tahun, tahunTersedia])

  const simpan = async () => {
    const terpilih = items.filter(i => dipilih.has(i.uid) && i.status !== 'sudah_ada')
    if (terpilih.length === 0) return
    setMenyimpan(true)
    try {
      const res = await fetch('/api/settings/libur/nasional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: terpilih.map(i => ({
            tanggal_mulai: i.tanggal_mulai,
            tanggal_selesai: i.tanggal_selesai,
            keterangan: i.keterangan,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.message || json?.error || `Gagal menyimpan (HTTP ${res.status})`)
      onSaved?.()
      onClose()
      Swal.fire({
        icon: 'success',
        title: 'Sinkronisasi selesai',
        html: `<b>${json.created}</b> tanggal libur ditambahkan.` +
          (json.skipped ? `<br/><span style="opacity:.75">${json.skipped} tanggal dilewati karena sudah ada di Data Libur.</span>` : ''),
      })
    } catch (err: any) {
      Swal.fire('Gagal Menyimpan', err?.message || 'Libur nasional tidak dapat disimpan.', 'error')
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <Modal
      open={open}
      size="lg"
      variant="add"
      icon="cloud-download"
      title="Sinkron Libur Nasional"
      subtitle="Sumber: Google Calendar · Hari Libur di Indonesia"
      onClose={onClose}
      labelledBy="sinkron-libur-title"
    >
      <ModalBody>
        <div className="sln__bar">
          <div className="sln__tahun">
            <span>Tahun</span>
            <InlineSelect
              title="Tahun kalender"
              value={String(tahun)}
              onChange={v => setTahun(Number(v))}
              options={pilihanTahun.map(y => ({ value: String(y), label: String(y) }))}
              disabled={memuat}
              minWidth="96px"
            />
          </div>
          <label className="sln__toggle">
            <input
              type="checkbox"
              checked={tampilPeringatan}
              onChange={e => setTampilPeringatan(e.target.checked)}
            />
            <span>Tampilkan hari peringatan{jumlahPeringatan ? ` (${jumlahPeringatan})` : ''}</span>
          </label>
          <div className="sln__refresh">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon="refresh"
              onClick={() => muat(tahun, true)}
              disabled={memuat}
              title="Ambil ulang dari Google"
            >
              Segarkan
            </Button>
          </div>
        </div>

        <div className="sln__note">
          <i className="bi bi-info-circle" />
          <span>
            Disimpan sebagai libur <b>sehari penuh untuk semua kelas</b>. Tanggal yang sudah ada di Data
            Libur dilewati, tidak ditimpa. Cuti bersama ditetapkan untuk ASN; cocokkan dulu dengan kalender
            pendidikan madrasah sebelum dicentang.
          </span>
        </div>

        {memuat ? (
          <div className="sln__state"><Spinner variant="buble" /></div>
        ) : galat ? (
          <div className="sln__state sln__state--err">
            <i className="bi bi-exclamation-triangle" />
            <div>{galat}</div>
            <Button variant="outline" size="sm" icon="refresh" onClick={() => muat(tahun, true)}>Coba lagi</Button>
          </div>
        ) : terlihat.length === 0 ? (
          <div className="sln__state">
            Tidak ada data libur untuk tahun {tahun} di kalender Google.
            {tahunTersedia.length > 0 && <> Tersedia: {tahunTersedia.join(', ')}.</>}
          </div>
        ) : (
          <div className="sln__list" role="list">
            <label className="sln__row sln__row--head">
              <input
                type="checkbox"
                checked={semuaTerpilih}
                onChange={toggleSemua}
                disabled={bisaDipilih.length === 0}
                aria-label="Pilih semua"
              />
              <span className="sln__headText">Pilih semua ({bisaDipilih.length})</span>
            </label>
            {terlihat.map(i => {
              const sudah = i.status === 'sudah_ada'
              return (
                <label
                  key={i.uid}
                  className={`sln__row ${sudah ? 'is-disabled' : ''} ${dipilih.has(i.uid) && !sudah ? 'is-on' : ''}`}
                  role="listitem"
                  title={i.deskripsi || undefined}
                >
                  <input
                    type="checkbox"
                    checked={!sudah && dipilih.has(i.uid)}
                    disabled={sudah}
                    onChange={() => toggle(i.uid)}
                  />
                  <div className="sln__main">
                    <div className="sln__ket">{i.keterangan}</div>
                    <div className="sln__date">
                      {fmtRentang(i.tanggal_mulai, i.tanggal_selesai)}
                      {i.jumlah_hari > 1 && <> · {i.jumlah_hari} hari</>}
                    </div>
                    {i.status !== 'baru' && (
                      <div className="sln__exist">
                        <i className="bi bi-check2-circle" />
                        {sudah ? 'Sudah ada' : `${i.tanggal_terisi.length} dari ${i.jumlah_hari} hari sudah ada`}
                        {i.keterangan_terisi.length > 0 && <>: {i.keterangan_terisi.join(', ')}</>}
                      </div>
                    )}
                  </div>
                  <span className={`sln__badge sln__badge--${i.kategori}`}>{LABEL_KATEGORI[i.kategori]}</span>
                </label>
              )
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter align="between">
        <span className="sln__count">{jumlahDipilih} dipilih</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="cancel" onClick={onClose}>Batal</Button>
          <Button
            type="button"
            variant="primary"
            icon="save"
            isLoading={menyimpan}
            disabled={jumlahDipilih === 0 || memuat}
            onClick={simpan}
          >
            Simpan {jumlahDipilih > 0 ? jumlahDipilih : ''} Libur
          </Button>
        </div>
      </ModalFooter>

      <style jsx>{`
        .sln__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
        .sln__tahun { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.85rem; color: var(--n-ink); }
        .sln__toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem; color: var(--n-ink); cursor: pointer; }
        .sln__toggle input, .sln__row input { width: 16px; height: 16px; accent-color: var(--n-primary); cursor: pointer; flex: none; }
        .sln__refresh { margin-left: auto; }
        .sln__note {
          display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 12px;
          background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.22);
          font-size: 0.8rem; line-height: 1.45; color: var(--n-ink);
        }
        .sln__note i { color: #3b82f6; margin-top: 1px; }
        .sln__state {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
          min-height: 160px; text-align: center; color: var(--n-muted); font-size: 0.86rem; padding: 12px;
        }
        .sln__state--err { color: #dc2626; }
        .sln__state--err i { font-size: 1.4rem; }
        /* Daftar adalah area gulirnya sendiri. Jangan pakai overflow: hidden di
           sini: sebagai anak flex .mdl-body, elemen ber-overflow non-visible
           boleh menyusut sampai 0 — isinya terpotong dan tidak ada yang bisa
           di-scroll. flex-shrink diizinkan, tapi dengan overflow-y: auto dan
           tinggi minimum supaya tetap terbaca di layar pendek (body yang
           menggulir bila sudah mentok). */
        .sln__list {
          display: flex; flex-direction: column; flex: 1 1 auto; min-height: 220px;
          overflow-y: auto; overscroll-behavior: contain;
          border: 1px solid var(--n-border); border-radius: 12px;
        }
        .sln__row {
          flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer;
          border-top: 1px solid var(--n-border); transition: background 0.12s;
        }
        .sln__row:first-child { border-top: 0; }
        .sln__row:hover { background: rgba(59, 130, 246, 0.05); }
        .sln__row.is-on { background: rgba(59, 130, 246, 0.08); }
        .sln__row.is-disabled { cursor: default; opacity: 0.6; }
        .sln__row--head {
          position: sticky; top: 0; z-index: 1; flex: none;
          background: var(--n-surface); box-shadow: inset 0 -1px 0 var(--n-border);
          font-size: 0.8rem; font-weight: 700; color: var(--n-muted);
        }
        .sln__row--head + .sln__row { border-top: 0; }
        :global(.dark) .sln__row--head { background: #0b1329; }
        .sln__main { flex: 1; min-width: 0; }
        .sln__ket { font-weight: 650; font-size: 0.88rem; color: var(--n-ink); }
        .sln__date { font-size: 0.78rem; color: var(--n-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
        .sln__exist { font-size: 0.75rem; color: #16a34a; margin-top: 3px; display: flex; gap: 4px; align-items: baseline; }
        .sln__badge { flex: none; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
        .sln__badge--nasional { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
        .sln__badge--cuti_bersama { background: rgba(139, 92, 246, 0.14); color: #7c3aed; }
        .sln__badge--peringatan { background: rgba(100, 116, 139, 0.14); color: #64748b; }
        .sln__badge--lainnya { background: rgba(234, 179, 8, 0.16); color: #a16207; }
        .sln__count { font-size: 0.82rem; font-weight: 600; color: var(--n-muted); }
        @media (max-width: 639px) {
          .sln__refresh { margin-left: 0; }
          .sln__row { align-items: flex-start; }
          .sln__badge { margin-top: 2px; }
        }
      `}</style>
    </Modal>
  )
}
