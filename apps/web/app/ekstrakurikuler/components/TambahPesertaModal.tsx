'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { Button } from '@/components/ui/Button'
import { InlineSelect } from '@/components/ui/InlineSelect'
import { FilterSearch } from '@/components/ui/FilterToolbar'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'

interface Kandidat {
  siswa_id: string
  nama: string
  kelas: string
  /** Sudah peserta aktif ekskul ini pada periode yang dipilih. */
  peserta: boolean
}

/**
 * Pembina (atau pengelola) menambahkan peserta ke ekskulnya: pilih dari siswa
 * yang terdaftar di kelas pada tahun ajaran berjalan. Siswa boleh ikut lebih
 * dari satu ekskul, jadi keikutsertaan di ekskul lain tidak dibatasi.
 */
export default function TambahPesertaModal({
  open,
  onClose,
  onSaved,
  ekskulId,
  namaEkskul,
  tahunAjaran,
  semester,
}: {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  ekskulId: string
  namaEkskul?: string
  tahunAjaran: string
  semester: number
}) {
  const [kandidat, setKandidat] = useState<Kandidat[]>([])
  const [daftarKelas, setDaftarKelas] = useState<string[]>([])
  const [tanpaMaster, setTanpaMaster] = useState(0)
  const [kelas, setKelas] = useState('')
  const [cari, setCari] = useState('')
  const [dipilih, setDipilih] = useState<Set<string>>(new Set())
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)

  const muat = useCallback(async () => {
    if (!ekskulId || !tahunAjaran) return
    setMemuat(true)
    setGalat('')
    try {
      const qs = new URLSearchParams({ ekskul_id: ekskulId, tahun_ajaran: tahunAjaran, semester: String(semester) })
      const res = await fetch(`/api/ekskul/kandidat?${qs}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || json?.message || `Gagal memuat (HTTP ${res.status})`)
      setKandidat(json.data?.siswa || [])
      setDaftarKelas(json.data?.kelas || [])
      setTanpaMaster(json.data?.tanpa_master || 0)
    } catch (err: any) {
      setKandidat([])
      setGalat(err?.message || 'Daftar siswa tidak dapat dimuat.')
    } finally {
      setMemuat(false)
    }
  }, [ekskulId, tahunAjaran, semester])

  useEffect(() => {
    if (!open) return
    setDipilih(new Set())
    setCari('')
    setKelas('')
    muat()
  }, [open, muat])

  const terlihat = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return kandidat.filter(k =>
      (!kelas || k.kelas === kelas) &&
      (!q || k.nama.toLowerCase().includes(q))
    )
  }, [kandidat, kelas, cari])

  const bisaDipilih = terlihat.filter(k => !k.peserta)
  const semuaTerpilih = bisaDipilih.length > 0 && bisaDipilih.every(k => dipilih.has(k.siswa_id))

  const toggle = (id: string) => setDipilih(prev => {
    const s = new Set(prev)
    if (s.has(id)) s.delete(id); else s.add(id)
    return s
  })
  const toggleSemua = () => setDipilih(prev => {
    const s = new Set(prev)
    if (semuaTerpilih) bisaDipilih.forEach(k => s.delete(k.siswa_id))
    else bisaDipilih.forEach(k => s.add(k.siswa_id))
    return s
  })

  const simpan = async () => {
    if (dipilih.size === 0) return
    setMenyimpan(true)
    try {
      const res = await fetch('/api/ekskul/siswa/tambah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ekskul_id: ekskulId,
          tahun_ajaran: tahunAjaran,
          semester,
          siswa_ids: [...dipilih],
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || json?.message || `Gagal menyimpan (HTTP ${res.status})`)
      const total = (json.created || 0) + (json.reactivated || 0)
      onSaved?.()
      onClose()
      Swal.fire({
        icon: 'success',
        title: 'Peserta ditambahkan',
        text: `${total} siswa kini menjadi peserta${namaEkskul ? ` ${namaEkskul}` : ''}.`,
        timer: 2200,
        showConfirmButton: false,
      })
    } catch (err: any) {
      Swal.fire('Gagal Menyimpan', err?.message || 'Peserta tidak dapat ditambahkan.', 'error')
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <Modal
      open={open}
      size="lg"
      variant="add"
      icon="person-plus"
      title="Tambah Peserta"
      subtitle={`${namaEkskul || 'Ekstrakurikuler'} · ${tahunAjaran} · Semester ${semester === 2 ? 'Genap' : 'Ganjil'}`}
      onClose={onClose}
      labelledBy="tambah-peserta-title"
    >
      <ModalBody>
        <div className="tpe__bar">
          <div className="tpe__search">
            <FilterSearch value={cari} onChange={setCari} placeholder="Cari nama siswa..." />
          </div>
          <InlineSelect
            title="Filter kelas"
            value={kelas}
            onChange={setKelas}
            options={[{ value: '', label: 'Semua kelas' }, ...daftarKelas.map(k => ({ value: k, label: k }))]}
            minWidth="150px"
            disabled={memuat}
          />
        </div>

        {memuat ? (
          <div className="tpe__state"><Spinner variant="buble" /></div>
        ) : galat ? (
          <div className="tpe__state tpe__state--err">
            <i className="bi bi-exclamation-triangle" />
            <div>{galat}</div>
            <Button variant="outline" size="sm" icon="refresh" onClick={muat}>Coba lagi</Button>
          </div>
        ) : terlihat.length === 0 ? (
          <div className="tpe__state">
            {kandidat.length === 0
              ? `Belum ada siswa terdaftar di kelas pada tahun ajaran ${tahunAjaran}.`
              : 'Tidak ada siswa yang cocok dengan pencarian.'}
          </div>
        ) : (
          <div className="tpe__list" role="list">
            <label className="tpe__row tpe__row--head">
              <input
                type="checkbox"
                checked={semuaTerpilih}
                onChange={toggleSemua}
                disabled={bisaDipilih.length === 0}
                aria-label="Pilih semua yang tampil"
              />
              <span>Pilih semua yang tampil ({bisaDipilih.length})</span>
            </label>
            {terlihat.map(k => (
              <label
                key={k.siswa_id}
                className={`tpe__row ${k.peserta ? 'is-disabled' : ''} ${dipilih.has(k.siswa_id) ? 'is-on' : ''}`}
                role="listitem"
              >
                <input
                  type="checkbox"
                  checked={k.peserta || dipilih.has(k.siswa_id)}
                  disabled={k.peserta}
                  onChange={() => toggle(k.siswa_id)}
                />
                <span className="tpe__nama">{k.nama}</span>
                <span className="tpe__kelas">{k.kelas}</span>
                {k.peserta && <span className="tpe__badge">Sudah peserta</span>}
              </label>
            ))}
          </div>
        )}

        {tanpaMaster > 0 && !memuat && !galat && (
          <div className="tpe__hint">
            <i className="bi bi-info-circle" /> {tanpaMaster} siswa di daftar kelas belum ada di Master Siswa, jadi tidak ditampilkan.
          </div>
        )}
      </ModalBody>
      <ModalFooter align="between">
        <span className="tpe__count">{dipilih.size} dipilih</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="cancel" onClick={onClose}>Batal</Button>
          <Button
            type="button"
            variant="primary"
            icon="save"
            isLoading={menyimpan}
            disabled={dipilih.size === 0 || memuat}
            onClick={simpan}
          >
            Tambahkan {dipilih.size > 0 ? dipilih.size : ''} Peserta
          </Button>
        </div>
      </ModalFooter>

      <style jsx>{`
        .tpe__bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .tpe__search { flex: 1 1 220px; min-width: 0; }
        .tpe__state {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
          min-height: 180px; text-align: center; color: var(--n-muted); font-size: 0.86rem; padding: 12px;
        }
        .tpe__state--err { color: #dc2626; }
        .tpe__state--err i { font-size: 1.4rem; }
        /* Area gulir sendiri; jangan overflow: hidden (anak flex .mdl-body akan
           menyusut sampai isinya terpotong — lihat SinkronLiburNasionalModal). */
        .tpe__list {
          display: flex; flex-direction: column; flex: 1 1 auto; min-height: 240px;
          overflow-y: auto; overscroll-behavior: contain;
          border: 1px solid var(--n-border); border-radius: 12px;
        }
        .tpe__row {
          flex: none; display: flex; align-items: center; gap: 12px; padding: 9px 12px; cursor: pointer;
          border-top: 1px solid var(--n-border); transition: background 0.12s;
        }
        .tpe__row:first-child { border-top: 0; }
        .tpe__row:hover { background: rgba(59, 130, 246, 0.05); }
        .tpe__row.is-on { background: rgba(59, 130, 246, 0.08); }
        .tpe__row.is-disabled { cursor: default; opacity: 0.6; }
        .tpe__row input { width: 16px; height: 16px; accent-color: var(--n-primary); cursor: pointer; flex: none; }
        .tpe__row--head {
          position: sticky; top: 0; z-index: 1;
          background: var(--n-surface); box-shadow: inset 0 -1px 0 var(--n-border);
          font-size: 0.8rem; font-weight: 700; color: var(--n-muted);
        }
        .tpe__row--head + .tpe__row { border-top: 0; }
        :global(.dark) .tpe__row--head { background: #0b1329; }
        .tpe__nama { flex: 1; min-width: 0; font-weight: 600; font-size: 0.88rem; color: var(--n-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tpe__kelas { flex: none; font-size: 0.78rem; color: var(--n-muted); font-variant-numeric: tabular-nums; }
        .tpe__badge {
          flex: none; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 999px;
          background: rgba(22, 163, 74, 0.12); color: #16a34a; white-space: nowrap;
        }
        .tpe__hint { font-size: 0.78rem; color: var(--n-muted); display: flex; gap: 6px; align-items: baseline; }
        .tpe__count { font-size: 0.82rem; font-weight: 600; color: var(--n-muted); }
      `}</style>
    </Modal>
  )
}
