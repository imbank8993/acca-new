'use client'
import { useCallback, useEffect, useState } from 'react'
import Modal, { ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useFileViewer } from '@/components/useFileViewer'
import './disposisi.css'

type Props = { canManage: boolean; user: any; source?: { table: string; row: any } | null; onClose: () => void }
export default function DisposisiPanel({ canManage, user, source, onClose }: Props) {
 const [items, setItems] = useState<any[]>([]), [recipients, setRecipients] = useState<any[]>([])
 const [recipientId, setRecipient] = useState(''), [instructions, setInstructions] = useState('')
 const [selected, setSelected] = useState<any>(null), [status, setStatus] = useState('Menunggu'), [followUp, setFollowUp] = useState('')
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true)
 const { openFile, viewer } = useFileViewer()
 const load = useCallback(async () => {
  try { const r = await fetch('/api/ptsp/disposisi', { cache: 'no-store' }); const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.message || j.error || 'Disposisi gagal dimuat'); setItems(j.data || []); setError('') }
  catch(e: any) { setError(e.message) } finally { setLoading(false) }
 }, [])
 useEffect(() => { load() }, [load])
 useEffect(() => { if (!source) return; setRecipient(''); setInstructions(''); setError(''); fetch('/api/ptsp/disposisi?recipients=true').then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.message || 'Pengguna gagal dimuat'); setRecipients(j.data || []) }).catch(e => setError(e.message)) }, [source])
 const save = async (body: any) => {
  setBusy(true); setError('')
  try { const r = await fetch('/api/ptsp/disposisi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.message || j.error || 'Gagal menyimpan'); onClose(); setSelected(null); await load() }
  catch(e: any) { setError(e.message) } finally { setBusy(false) }
 }
 const own = selected && selected.recipient_id === (user?.authId || user?.auth_id)
 const attachments = selected ? Object.entries(selected.snapshot || {}).filter(([k,v]) => /^file(_|$)/.test(k) && typeof v === 'string' && /^https?:\/\//i.test(v)) : []
 return <section className="disposisi-panel">
  <div className="disposisi-heading"><div><span className="disposisi-eyebrow">LAYANAN TERPADU SATU PINTU</span><h2>{canManage ? 'Monitor disposisi surat' : 'Disposisi untuk Anda'}</h2><p>Instruksi, berkas permohonan, dan hasil tindak lanjut dalam satu tempat.</p></div><Button variant="secondary" onClick={load}>Muat ulang</Button></div>
  <div className="disposisi-stats">{['Menunggu','Diproses','Selesai'].map(s => <div key={s}><strong>{items.filter(i => i.status === s).length}</strong><span>{s}</span></div>)}</div>
  {error && <p role="alert" className="disposisi-error">{error}</p>}
  {loading ? <p>Memuat disposisiâ€¦</p> : items.length === 0 ? <div className="disposisi-empty">Belum ada disposisi surat.{canManage && ' Buka detail permohonan dan pilih Disposisikan.'}</div> : <div className="disposisi-list">{items.map(i => <button className="disposisi-item" key={i.id} onClick={() => {setSelected(i); setStatus(i.status); setFollowUp(i.follow_up || ''); setError('')}}><div><strong>{i.snapshot?.layanan || 'Permohonan PTSP'}</strong><span className="disposisi-state">{i.status}</span></div><p>{i.snapshot?.nama || i.snapshot?.nama_siswa || 'Pemohon'} Â· {i.snapshot?.wa || i.snapshot?.no_wa || 'WA tidak tersedia'}</p><p>{i.instructions}</p><small>{i.sender_name} â†’ {i.recipient_name} Â· {new Date(i.created_at).toLocaleDateString('id-ID')}</small></button>)}</div>}
  {source && <Modal onClose={onClose}><ModalHeader title="Disposisikan permohonan" subtitle="Kirim instruksi dan berkas kepada pengguna tujuan" onClose={onClose}/><ModalBody><form id="disposisi-send" className="disposisi-form" onSubmit={e => {e.preventDefault(); save({table: source.table, id: String(source.row.id), recipientId, instructions})}}><p>{source.row.nama || source.row.nama_siswa || 'Permohonan'}<br/>{source.row.wa || source.row.no_wa || ''}</p><label>Pengguna tujuan<select required value={recipientId} onChange={e => setRecipient(e.target.value)}><option value="">Pilih pengguna</option>{recipients.map(u => <option key={u.id} value={u.id}>{u.nama} â€” {u.role || 'Pengguna'}</option>)}</select></label><label>Instruksi disposisi<textarea required maxLength={4000} rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Tuliskan arahan dan tindak lanjut yang diperlukan"/></label><p className="disposisi-hint">Detail permohonan, PDF, dan seluruh lampiran tersedia di kotak disposisi penerima. Penerima mendapatkan notifikasi di aplikasi.</p>{error && <p role="alert" className="disposisi-error">{error}</p>}</form></ModalBody><ModalFooter><Button variant="cancel" onClick={onClose} disabled={busy}>Batal</Button><Button variant="primary" type="submit" form="disposisi-send" isLoading={busy}>Kirim Disposisi</Button></ModalFooter></Modal>}
  {selected && <Modal onClose={() => setSelected(null)}><ModalHeader title="Detail disposisi" subtitle={selected.snapshot?.layanan} onClose={() => setSelected(null)}/><ModalBody><div className="disposisi-form"><p><strong>Pemohon</strong><br/>{selected.snapshot?.nama || selected.snapshot?.nama_siswa || 'â€”'}<br/>{selected.snapshot?.wa || selected.snapshot?.no_wa || 'â€”'}</p><p><strong>{selected.sender_name} â†’ {selected.recipient_name}</strong><br/>{selected.instructions}</p><a className="disposisi-download" href={`/api/ptsp/disposisi/pdf?id=${selected.id}`} target="_blank" rel="noopener noreferrer">Unduh PDF detail permohonan</a><strong>Lampiran surat ({attachments.length})</strong>{attachments.length === 0 && <p>Tidak ada lampiran pada permohonan ini.</p>}{attachments.map(([k,v]) => <button className="disposisi-download" key={k} onClick={() => openFile(String(v), k.replace(/_/g,' '))}>{k.replace(/_/g,' ')} â†—</button>)}<details><summary>Seluruh data permohonan</summary><dl>{Object.entries(selected.snapshot || {}).filter(([k]) => !/^file|tracking_token/.test(k)).map(([k,v]) => <div key={k}><dt>{k.replace(/_/g,' ')}</dt><dd>{String(v ?? 'â€”')}</dd></div>)}</dl></details><label>Status tindak lanjut<select disabled={!own || busy} value={status} onChange={e => setStatus(e.target.value)}>{['Menunggu','Diproses','Selesai'].map(s => <option key={s}>{s}</option>)}</select></label><label>Hasil / catatan tindak lanjut<textarea disabled={!own || busy} rows={4} maxLength={4000} value={followUp} onChange={e => setFollowUp(e.target.value)}/></label>{error && <p role="alert" className="disposisi-error">{error}</p>}</div></ModalBody><ModalFooter><Button variant="cancel" onClick={() => setSelected(null)}>Tutup</Button>{own && <Button variant="primary" isLoading={busy} onClick={() => save({action:'follow_up',id:selected.id,status,followUp})}>Simpan tindak lanjut</Button>}</ModalFooter></Modal>}{viewer}
 </section>
}
