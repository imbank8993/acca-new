'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTimezone } from '@/hooks/use-timezone'
import Select from 'react-select'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import { Spinner } from '@/components/ui/Spinner'
import { ArrowLeftRight, CalendarCheck, CalendarClock, CheckCircle2, Circle, History, Info, ShieldCheck, AlertTriangle, RotateCcw, UserRound } from 'lucide-react'
import '../jadwal.css'
import './jadwal-sementara.css'

const tambahHari = (day: string, n: number) => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10)
const labelSlot = (r: any) => `${r.hari} · JP ${r.jam_ke} · ${r.kelas || r.ruang || '-'} · ${r.mata_pelajaran || r.kode_guru || ''}`
const tanggalLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function JadwalSementaraTab() {
  const { getCurrentDate, loading: tzLoading } = useTimezone()
  const [mulai, setMulai] = useState('')
  const [selesai, setSelesai] = useState('')
  const [jenis, setJenis] = useState('mengajar')
  const [slots, setSlots] = useState<any[]>([])
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [guruA, setGuruA] = useState('')
  const [guruB, setGuruB] = useState('')
  const [a, setA] = useState<string[]>([])
  const [b, setB] = useState<string[]>([])
  const [alasan, setAlasan] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (tzLoading) return
    const day = getCurrentDate()
    setMulai(day); setSelesai(tambahHari(day, 6))
  }, [tzLoading, getCurrentDate])
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!mulai) return
    setLoading(true); setError(''); setSlots([]); setA([]); setB([])
    try {
      const res = await fetch(`/api/jadwal/sementara?jenis=${jenis}&tanggal=${mulai}`, { signal })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || json.message || 'Gagal memuat jadwal')
      if (!signal?.aborted) { setSlots(json.data.slots); setRiwayat(json.data.riwayat) }
    } catch (e: any) { if (!signal?.aborted) setError(e.message) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [mulai, jenis])
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort() }, [load])
  const changed = () => window.dispatchEvent(new CustomEvent('acca:jadwal-updated'))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/jadwal/sementara', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jenis, mulai, selesai, slots_a: a, slots_b: b, alasan }) })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || json.message || 'Gagal menyimpan')
      setMessage('Jadwal sementara tersimpan dan langsung berlaku pada periode yang dipilih.'); setAlasan(''); changed(); await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const cancel = async (id: string) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/jadwal/sementara/${id}`, { method: 'DELETE' }); const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || json.message || 'Gagal membatalkan')
      changed(); setMessage('Jadwal sementara dibatalkan.'); await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const guru = Array.from(new Map(slots.filter(r => r.nip).map(r => [r.nip, r.nama_guru || r.nip])).entries()).sort((x, y) => String(x[1]).localeCompare(String(y[1])))
  const picker = (side: 'a' | 'b') => {
    const value = side === 'a' ? guruA : guruB, selected = side === 'a' ? a : b
    const setSelected = side === 'a' ? setA : setB
    const options = guru.filter(([nip]) => nip !== (side === 'a' ? guruB : guruA)).map(([nip, nama]) => ({ value: nip, label: String(nama) }))
    const teacherSlots = slots.filter(r => r.nip === value)
    return <section className="tj__col jsm__teacher" aria-labelledby={`jsm-guru-${side}`}>
      <div className="tj__colHead"><span className="tj__step">{side.toUpperCase()}</span><h4 id={`jsm-guru-${side}`} className="tj__colTitle">Guru {side.toUpperCase()}</h4><span className="jsm__selectionCount">{selected.length} dipilih</span></div>
      <label className="jsm__label" htmlFor={`jsm-pilih-${side}`}>Nama guru</label>
      <Select inputId={`jsm-pilih-${side}`} instanceId={`jsm-select-${side}`} className="react-select-container" classNamePrefix="react-select"
        options={options} value={options.find(o => o.value === value) || null} isDisabled={busy || loading} isSearchable isClearable
        onChange={option => { (side === 'a' ? setGuruA : setGuruB)(option?.value || ''); setSelected([]) }}
        placeholder="Cari nama guru…" noOptionsMessage={() => 'Guru tidak ditemukan'} menuPlacement="auto"
        menuPosition="fixed" menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        styles={{ menuPortal: base => ({ ...base, zIndex: 99999 }) }} />
      {value && teacherSlots.length ? <div className="tj__slotList jsm__slots" aria-label={`Slot Guru ${side.toUpperCase()}`}>
        {teacherSlots.map(r => {
          const checked = selected.includes(r.id)
          return <button key={r.id} type="button" className={`tj__slot tj__slot--${side} ${checked ? 'is-selected' : ''}`} aria-pressed={checked}
            onClick={() => setSelected(checked ? selected.filter(id => id !== r.id) : [...selected, r.id])}>
            <span className="tj__slotJam">{r.jam_ke}</span><span className="tj__slotBody"><span className="tj__slotKelas">{r.hari} · {r.kelas || r.ruang || '-'}</span>
              <span className="tj__slotMapel">{r.mata_pelajaran || `Piket ${r.ruang || r.kode_guru || ''}`}</span>
              {checked && <span className="tj__slotWaktu">Pasangan ke-{selected.indexOf(r.id) + 1}</span>}</span>
            {checked ? <CheckCircle2 size={18} className="tj__slotCheck" /> : <Circle size={18} className="tj__slotCheck" />}
          </button>
        })}
      </div> : <div className="tj__slotEmpty"><UserRound size={24} /><span>{value ? 'Tidak ada slot pada tanggal ini.' : 'Pilih guru untuk melihat jadwal.'}</span></div>}
    </section>
  }
  const today = tzLoading ? '' : getCurrentDate()
  const duration = mulai && selesai ? Math.round((Date.parse(selesai) - Date.parse(mulai)) / 86400000) + 1 : 0
  return <section className="tjp jsm">
    <div className="tjp__section jsm__intro"><span className="jsm__introIcon"><CalendarClock size={23} /></span><div><h2>Jadwal Sementara</h2><p>Penukaran langsung tanpa persetujuan guru. Jadwal normal kembali otomatis setelah periode selesai.</p></div></div>
    {error && <div role="alert" className="tjp__error"><AlertTriangle size={18} /><span>{error}</span></div>}
    {message && <div role="status" className="jsm__success"><CheckCircle2 size={18} /><span>{message}</span></div>}
    <form onSubmit={submit} className="tjp__section"><fieldset disabled={busy} className="jsm__fieldset">
      <legend className="jsm__srOnly">Buat jadwal sementara</legend>
      <div className="tjp__sectionHead"><h3><ArrowLeftRight size={18} />Buat Penukaran</h3><span className="tjp__status tjp__status--ok">Tanpa persetujuan</span></div>
      <div className="tj__jenisBar" role="group" aria-label="Jenis jadwal">
        <button type="button" className={`tj__jenisBtn ${jenis === 'mengajar' ? 'is-active' : ''}`} aria-pressed={jenis === 'mengajar'} onClick={() => { setJenis('mengajar'); setGuruA(''); setGuruB(''); setA([]); setB([]) }}><CalendarCheck size={16} />PBM</button>
        <button type="button" className={`tj__jenisBtn ${jenis === 'piket' ? 'is-active' : ''}`} aria-pressed={jenis === 'piket'} onClick={() => { setJenis('piket'); setGuruA(''); setGuruB(''); setA([]); setB([]) }}><ShieldCheck size={16} />Piket</button>
      </div>
      <div className="jsm__dates">
        <div><label className="jsm__label" htmlFor="jsm-mulai">Tanggal mulai</label><DatePicker id="jsm-mulai" value={mulai} disabled={busy} required onChange={day => { setMulai(day); if (day) setSelesai(tambahHari(day, 6)) }} /></div>
        <div><label className="jsm__label" htmlFor="jsm-selesai">Tanggal selesai <span>(inklusif)</span></label><DatePicker id="jsm-selesai" value={selesai} disabled={busy} required min={mulai} max={mulai ? tambahHari(mulai, 30) : undefined} onChange={setSelesai} /></div>
        <div className="jsm__duration"><CalendarClock size={18} /><div><strong>{duration > 0 ? `${duration} hari` : 'Pilih periode'}</strong><span>Bawaan 1 pekan · maksimal 31 hari</span></div></div>
      </div>
      <div className="tj__hintBox"><Info size={17} /><span>Pilih jumlah slot yang sama untuk kedua guru. Nomor pilihan menentukan pasangan pertukaran.{jenis === 'piket' ? ' Pilih seluruh baris tugas piket pada hari dan jam yang sama.' : ' Guru dan mata pelajaran bertukar; kelas, hari, dan jam slot tetap.'}</span></div>
      {loading ? <div className="tjp__loading"><Spinner size={18} label="Memuat jadwal" /><span>Memuat jadwal…</span></div> : <div className="jsm__teachers">{picker('a')}{picker('b')}</div>}
      {a.length > 0 && b.length > 0 && <div className="tj__preview"><div className="tj__previewTitle"><ArrowLeftRight size={17} />Ringkasan Penukaran</div>
        <div className="jsm__pairs">{a.map((id, i) => { const left = slots.find(r => r.id === id), right = slots.find(r => r.id === b[i]); return <div key={id} className="jsm__pair"><span className="jsm__pairNumber">{i + 1}</span><span>{left && labelSlot(left)}</span><ArrowLeftRight size={15} /><span>{right ? labelSlot(right) : 'Pilih slot pasangan'}</span></div> })}</div>
        {a.length !== b.length && <p className="jsm__mismatch">Jumlah slot belum sama: Guru A {a.length}, Guru B {b.length}.</p>}
      </div>}
      <label className="tj__label" htmlFor="jsm-alasan">Alasan penukaran <span className="jsm__required">*</span></label><textarea id="jsm-alasan" className="tj__textarea" required maxLength={1000} rows={3} placeholder="Tuliskan alasan penukaran jadwal…" value={alasan} onChange={e => setAlasan(e.target.value)} />
      <div className="jsm__formFooter"><span><RotateCcw size={15} />{selesai ? `Jadwal normal kembali ${tanggalLabel(tambahHari(selesai, 1))}` : 'Jadwal normal kembali setelah periode selesai'}</span>
        <Button type="submit" variant="primary" icon="save" isLoading={busy} disabled={loading || !a.length || a.length !== b.length || duration < 1 || duration > 31}>Terapkan Jadwal Sementara</Button></div>
    </fieldset></form>
    <section className="tjp__section"><div className="tjp__sectionHead"><h3><History size={18} />Riwayat Penukaran</h3><span className="tjp__count">{riwayat.length}</span></div>
      {!riwayat.length && <div className="tjp__empty"><History size={26} /><p>Belum ada jadwal sementara.</p><span>Penukaran yang disimpan akan tampil di sini.</span></div>}
      {riwayat.map(r => {
        const status = r.dibatalkan ? { text: 'Dibatalkan', tone: 'off' } : today > r.selesai ? { text: 'Selesai', tone: 'off' } : today < r.mulai ? { text: 'Terjadwal', tone: 'wait' } : { text: 'Aktif', tone: 'ok' }
        return <article key={r.id} className="tjp__card jsm__history">
          <div className="tjp__cardHead"><span className={`tjp__jenis tjp__jenis--${r.jenis === 'piket' ? 'piket' : 'pbm'}`}>{r.jenis === 'piket' ? <ShieldCheck size={15} /> : <CalendarCheck size={15} />}{r.jenis === 'piket' ? 'Piket' : 'PBM'}</span><span className={`tjp__status tjp__status--${status.tone}`}>{status.text}</span></div>
          <div className="jsm__period"><CalendarClock size={16} /><strong>{tanggalLabel(r.mulai)} – {tanggalLabel(r.selesai)}</strong></div>
          <div className="tjp__note"><b>Alasan:</b> {r.alasan}</div>
          <details className="jsm__details"><summary>Lihat {r.perubahan.length} slot yang ditukar</summary><ul>{r.perubahan.map((c: any) => <li key={c.id}>{c.label}<ArrowLeftRight size={13} /><strong>{c.pengganti.nama_guru || c.pengganti.kode_guru || c.pengganti.nip}</strong></li>)}</ul></details>
          <div className="tjp__cardFoot"><span className="tjp__date">Oleh {r.dibuat_oleh}{!r.dibatalkan && ` · Kembali normal ${tanggalLabel(tambahHari(r.selesai, 1))}`}</span>
            {!r.dibatalkan && today <= r.selesai && <Button type="button" size="sm" variant="outline" icon="cancel" disabled={busy} onClick={() => cancel(r.id)}>Batalkan</Button>}</div>
        </article>
      })}
    </section>
  </section>
}
