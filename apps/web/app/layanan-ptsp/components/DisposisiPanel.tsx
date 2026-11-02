'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCheck, FileText, Inbox, Mail, Paperclip, RefreshCw, Send } from 'lucide-react'
import Modal, { ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useFileViewer } from '@/components/useFileViewer'
import { letterAttachments, letterDate, letterFields, type LetterNotice } from '@/lib/ptsp-letter'
import './disposisi.css'

type Props = { canManage: boolean; user: any; source?: { table: string; row: any } | null; onClose: () => void }
type Recipient = { id: string; nama: string; role: string }
const apiPath = '/api/ptsp/disposisi'

async function readResponse(response: Response) {
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.ok) {
        const message = response.status >= 500 ? 'Layanan sedang tidak tersedia. Silakan coba lagi.' : json?.message || json?.error
        throw new Error(typeof message === 'string' ? message : 'Permintaan gagal. Silakan coba lagi.')
    }
    return json
}

// The stored table and endpoint retain their old names so previously sent letters remain accessible.
export default function DisposisiPanel({ canManage, user, source, onClose }: Props) {
    const [items, setItems] = useState<LetterNotice[]>([])
    const [summary, setSummary] = useState({ total: 0, unread: 0 })
    const [page, setPage] = useState(1), [total, setTotal] = useState(0)
    const [unreadOnly, setUnreadOnly] = useState(false)
    const [recipients, setRecipients] = useState<Recipient[]>([])
    const [recipientsLoading, setRecipientsLoading] = useState(false)
    const [recipientRetry, setRecipientRetry] = useState(0)
    const [recipientId, setRecipient] = useState(''), [message, setMessage] = useState('')
    const [selected, setSelected] = useState<LetterNotice | null>(null)
    const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
    const [listError, setListError] = useState(''), [formError, setFormError] = useState(''), [detailError, setDetailError] = useState('')
    const [success, setSuccess] = useState('')
    const mutationLock = useRef(false), requestId = useRef(''), loadVersion = useRef(0), openVersion = useRef(0)
    const noticeId = useSearchParams().get('surat')
    const authId = user?.authId || user?.auth_id
    const { openFile, viewer } = useFileViewer()

    const load = useCallback(async () => {
        const version = ++loadVersion.current
        setLoading(true); setListError('')
        try {
            const json = await readResponse(await fetch(`${apiPath}?page=${page}&unread=${unreadOnly}`, { cache: 'no-store' }))
            if (version !== loadVersion.current) return
            const rows: LetterNotice[] = Array.isArray(json.data) ? json.data : []
            setItems(rows); setTotal(json.total ?? rows.length)
            setSummary(json.summary || { total: rows.length, unread: rows.filter(row => !row.read_at).length })
            if (Number.isInteger(json.page) && json.page !== page) setPage(json.page)
        } catch (e: any) { if (version === loadVersion.current) setListError(e.message) }
        finally { if (version === loadVersion.current) setLoading(false) }
    }, [page, unreadOnly])

    useEffect(() => { load(); return () => { loadVersion.current++ } }, [load])

    useEffect(() => {
        if (!source) return
        const controller = new AbortController()
        setFormError(''); setRecipients([]); setRecipientsLoading(true)
        fetch(`${apiPath}?recipients=true`, { signal: controller.signal }).then(readResponse).then(json => {
            if (!controller.signal.aborted) setRecipients(json.data || [])
        }).catch(e => { if (!controller.signal.aborted) setFormError(e.message) })
            .finally(() => { if (!controller.signal.aborted) setRecipientsLoading(false) })
        return () => controller.abort()
    }, [source, recipientRetry])

    useEffect(() => {
        if (source) { setRecipient(''); setMessage(''); requestId.current = crypto.randomUUID() }
    }, [source])

    const post = async (body: unknown) => readResponse(await fetch(apiPath, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))

    const openNotice = useCallback(async (id: string) => {
        const version = ++openVersion.current
        setDetailError(''); setListError('')
        try {
            const json = await readResponse(await fetch(`${apiPath}?id=${encodeURIComponent(id)}`, { cache: 'no-store' }))
            if (version !== openVersion.current) return
            setSelected(json.data)
            if (json.data.recipient_id === authId && !json.data.read_at) {
                try {
                    await post({ action: 'mark_read', id })
                    if (version !== openVersion.current) return
                    setSelected({ ...json.data, read_at: new Date().toISOString() })
                    await load()
                } catch (e: any) { if (version === openVersion.current) setDetailError(e.message) }
            }
        } catch (e: any) { if (version === openVersion.current) setListError(e.message) }
    }, [authId, load])

    // Notification links open the intended letter even if it is on an older list page.
    const openedLink = useRef<string | null>(null)
    useEffect(() => {
        if (!noticeId) { openedLink.current = null; return }
        if (openedLink.current === noticeId) return
        openedLink.current = noticeId
        openNotice(noticeId)
    }, [noticeId, openNotice])

    const send = async (event: React.FormEvent) => {
        event.preventDefault()
        if (mutationLock.current || !source) return
        if (!recipientId) { setFormError('Pilih pengguna penerima terlebih dahulu.'); return }
        mutationLock.current = true; setBusy(true); setFormError(''); setSuccess('')
        try {
            await post({ table: source.table, id: String(source.row.id), recipientId, message, clientRequestId: requestId.current })
            setSuccess('Pemberitahuan surat masuk berhasil dikirim.'); onClose(); await load()
        } catch (e: any) { setFormError(e.message) }
        finally { mutationLock.current = false; setBusy(false) }
    }

    const retryRead = async () => {
        if (!selected || mutationLock.current) return
        const id = selected.id
        mutationLock.current = true; setBusy(true); setDetailError('')
        try {
            await post({ action: 'mark_read', id })
            setSelected(current => current?.id === id ? { ...current, read_at: new Date().toISOString() } : current)
            await load()
        } catch (e: any) { setDetailError(e.message) }
        finally { mutationLock.current = false; setBusy(false) }
    }

    const closeDetail = () => { openVersion.current++; setSelected(null); setDetailError('') }
    const attachments = letterAttachments(selected?.snapshot)
    const fields = letterFields(selected?.snapshot)
    const pageCount = Math.max(1, Math.ceil(total / 12))

    return <section className="disposisi-panel" aria-label="Pemberitahuan surat masuk">
        <header className="disposisi-heading">
            <div className="disposisi-heading-title"><span className="disposisi-heading-icon"><Inbox size={24} /></span><div>
                <span className="disposisi-eyebrow">LAYANAN PTSP</span>
                <h2>{canManage ? 'Pemberitahuan surat masuk' : 'Surat masuk untuk Anda'}</h2>
                <p>Informasi permohonan dan lampiran surat yang dibagikan kepada pengguna.</p>
            </div></div>
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={15} />} onClick={load} disabled={loading}>Muat ulang</Button>
        </header>
        <div className="disposisi-stats">
            <div><Mail size={19} /><span>Total pemberitahuan<strong>{summary.total}</strong></span></div>
            <div><Inbox size={19} /><span>Belum dibaca<strong>{summary.unread}</strong></span></div>
            <div><CheckCheck size={19} /><span>Sudah dibaca<strong>{summary.total - summary.unread}</strong></span></div>
        </div>
        <div className="disposisi-toolbar"><div className="disposisi-filters" aria-label="Filter pemberitahuan">
            <button type="button" aria-pressed={!unreadOnly} onClick={() => { setUnreadOnly(false); setPage(1) }}>Semua</button>
            <button type="button" aria-pressed={unreadOnly} onClick={() => { setUnreadOnly(true); setPage(1) }}>Belum dibaca</button>
        </div><span>{total} pemberitahuan</span></div>
        {success && <p role="status" className="disposisi-success">{success}</p>}
        {listError && <p role="alert" className="disposisi-error">{listError}</p>}
        {loading ? <div className="disposisi-empty" role="status">Memuat pemberitahuan...</div> : listError ? null : items.length === 0 ?
            <div className="disposisi-empty"><Inbox size={32} /><strong>{unreadOnly ? 'Semua pemberitahuan sudah dibaca' : 'Belum ada pemberitahuan surat masuk'}</strong><p>{canManage ? 'Pilih Beri tahu pada daftar layanan untuk mengirim detail permohonan dan lampirannya.' : 'Pemberitahuan yang dikirim kepada Anda akan muncul di sini.'}</p></div> :
            <div className="disposisi-list">{items.map(item => <button type="button" className="disposisi-item" key={item.id} onClick={() => openNotice(item.id)}>
                <div className="disposisi-item-top"><span className="disposisi-service"><FileText size={17} />{String(item.snapshot?.layanan || 'Permohonan PTSP')}</span><span className={`disposisi-state ${item.read_at ? 'is-read' : ''}`}>{item.read_at ? 'Sudah dibaca' : 'Belum dibaca'}</span></div>
                <strong className="disposisi-applicant">{String(item.snapshot?.nama || item.snapshot?.nama_siswa || 'Pemohon')}</strong>
                <span className="disposisi-phone">Nomor WA: {String(item.snapshot?.wa || item.snapshot?.no_wa || 'Tidak tersedia')}</span>
                <p className="disposisi-message">{item.instructions}</p>
                <div className="disposisi-item-footer"><span>{item.sender_name}<ArrowRight size={13} />{item.recipient_name}</span><time>{letterDate(item.created_at)} WITA</time></div>
            </button>)}</div>}
        {pageCount > 1 && <nav className="disposisi-pagination" aria-label="Halaman pemberitahuan"><Button size="sm" variant="secondary" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button><span>{page} / {pageCount}</span><Button size="sm" variant="secondary" disabled={loading || page >= pageCount} onClick={() => setPage(p => p + 1)}>Berikutnya</Button></nav>}

        {source && <Modal size="md" onClose={() => { if (!busy) onClose() }} labelledBy="ptsp-letter-send-title">
            <ModalHeader id="ptsp-letter-send-title" title="Beri tahu surat masuk" subtitle="Bagikan permohonan dan lampiran kepada pengguna" onClose={() => { if (!busy) onClose() }} />
            <ModalBody><form id="ptsp-letter-send" className="disposisi-form" onSubmit={send}>
                <div className="disposisi-info"><FileText size={20} /><p>Detail permohonan dan lampiran asli disertakan. Nama pemohon dan nomor WA tersedia sebagai teks di halaman penerima.</p></div>
                <label>Pengguna penerima<select required disabled={busy || recipientsLoading} value={recipientId} onChange={e => { setRecipient(e.target.value); requestId.current = crypto.randomUUID() }}><option value="">{recipientsLoading ? 'Memuat pengguna...' : 'Pilih pengguna penerima'}</option>{recipients.map(u => <option key={u.id} value={u.id}>{u.nama} ({u.role || 'Pengguna'})</option>)}</select></label>
                <label>Pesan tambahan <small>Opsional</small><textarea disabled={busy} maxLength={4000} rows={4} value={message} onChange={e => { setMessage(e.target.value); requestId.current = crypto.randomUUID() }} placeholder="Contoh: Ada surat permohonan peminjaman aula. Silakan lihat detailnya." /></label>
                <p className="disposisi-hint">Penerima mendapat notifikasi di aplikasi dan dapat mengunduh PDF serta membuka lampiran. Pesan ini merupakan pemberitahuan surat masuk.</p>
                {formError && <p role="alert" className="disposisi-error">{formError}</p>}
                {!recipientsLoading && recipients.length === 0 && <Button type="button" variant="secondary" onClick={() => setRecipientRetry(n => n + 1)}>Muat ulang pengguna</Button>}
            </form></ModalBody>
            <ModalFooter><Button variant="cancel" onClick={onClose} disabled={busy}>Batal</Button><Button variant="primary" form="ptsp-letter-send" type="submit" disabled={recipientsLoading || !recipientId} isLoading={busy} leftIcon={<Send size={15} />}>Kirim pemberitahuan</Button></ModalFooter>
        </Modal>}

        {selected && <Modal size="lg" onClose={closeDetail} labelledBy="ptsp-letter-detail-title">
            <ModalHeader id="ptsp-letter-detail-title" title="Detail surat masuk" subtitle={String(selected.snapshot?.layanan || 'Layanan PTSP')} onClose={closeDetail} />
            <ModalBody><div className="disposisi-form">
                <div className="disposisi-detail-meta"><div><span>Dikirim oleh</span><strong>{selected.sender_name}</strong></div><div><span>Penerima</span><strong>{selected.recipient_name}</strong></div><div><span>Diterima</span><strong>{letterDate(selected.created_at)} WITA</strong></div><div><span>Status pemberitahuan</span><strong>{selected.read_at ? 'Sudah dibaca' : 'Belum dibaca'}</strong></div></div>
                <div className="disposisi-note"><strong>Pesan pengirim</strong><p>{selected.instructions}</p></div>
                {detailError && <p role="alert" className="disposisi-error">{detailError}</p>}
                <a className="disposisi-download" href={`${apiPath}/pdf?id=${encodeURIComponent(selected.id)}`} target="_blank" rel="noopener noreferrer"><FileText size={18} />Unduh PDF detail permohonan</a>
                <h3 className="disposisi-section-title">Informasi permohonan</h3><dl className="disposisi-details">{fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
                <h3 className="disposisi-section-title"><Paperclip size={17} />Lampiran surat ({attachments.length})</h3>
                {attachments.length === 0 ? <p className="disposisi-hint">Tidak ada lampiran pada permohonan ini.</p> : attachments.map(file => <button type="button" className="disposisi-download" key={file.label} onClick={() => openFile(file.url, file.label)}><Paperclip size={17} />{file.label}<ArrowRight size={15} /></button>)}
            </div></ModalBody><ModalFooter><Button variant="cancel" onClick={closeDetail}>Tutup</Button>{selected.recipient_id === authId && !selected.read_at && <Button variant="primary" isLoading={busy} onClick={retryRead}>Tandai dibaca</Button>}</ModalFooter>
        </Modal>}{viewer}
    </section>
}
