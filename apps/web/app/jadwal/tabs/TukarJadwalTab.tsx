'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    BadgeCheck,
    History,
    X,
    ShieldCheck,
    CalendarCheck,
    ArrowLeftRight,
    AlertTriangle,
    Inbox,
    Check,
    Send,
    Ban,
    Loader2
} from 'lucide-react'
import '../jadwal.css'

export interface TukarRequest {
    id: number
    jenis: 'mengajar' | 'piket'
    requester_nip: string
    requester_nama: string
    requester_hari: string
    requester_jam_ke: string
    requester_kelas: string | null
    requester_mapel: string | null
    requester_slots?: any[]
    target_nip: string
    target_nama: string
    target_hari: string
    target_jam_ke: string
    target_kelas: string | null
    target_mapel: string | null
    target_slots?: any[]
    alasan: string | null
    status: string
    guru_catatan: string | null
    wkm_nama: string | null
    wkm_catatan: string | null
    created_at: string
}

export interface TukarData {
    masuk: TukarRequest[]
    keluar: TukarRequest[]
    perluWkm: TukarRequest[]
    riwayatWkm: TukarRequest[]
    isWkm: boolean
}

const STATUS_LABEL: Record<string, { text: string; tone: 'wait' | 'ok' | 'bad' | 'off' }> = {
    menunggu_guru: { text: 'Menunggu Guru Tujuan', tone: 'wait' },
    menunggu_wkm: { text: 'Menunggu WKM Akademik', tone: 'wait' },
    disetujui: { text: 'Disetujui', tone: 'ok' },
    ditolak_guru: { text: 'Ditolak', tone: 'bad' },
    ditolak_wkm: { text: 'Ditolak', tone: 'bad' },
    dibatalkan: { text: 'Dibatalkan', tone: 'off' },
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const slotText = (hari: string, jam: string, kelas: string | null, mapel: string | null) =>
    [`${hari} • jam ke-${jam}`, kelas, mapel].filter(Boolean).join(' • ')

/** Kartu satu pengajuan; `actions` diisi tombol sesuai peran pembaca. */
function RequestCard({
    req, actions, busy,
}: {
    req: TukarRequest
    actions?: React.ReactNode
    busy?: boolean
}) {
    const st = STATUS_LABEL[req.status] || { text: req.status, tone: 'off' as const }
    const isPiket = req.jenis === 'piket'

    return (
        <div className={`tjp__card ${busy ? 'is-busy' : ''}`}>
            <div className="tjp__cardHead">
                <span className={`tjp__jenis tjp__jenis--${isPiket ? 'piket' : 'pbm'}`}>
                    {isPiket ? <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> : <CalendarCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />}
                    {isPiket ? 'Piket' : 'PBM'}
                </span>
                {['disetujui', 'ditolak_guru', 'ditolak_wkm'].includes(req.status) ? (
                    <span className={`tjp__status tjp__status--${st.tone} tjp__status--circle`}>
                        {req.status === 'disetujui' ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                    </span>
                ) : (
                    <span className={`tjp__status tjp__status--${st.tone}`}>{st.text}</span>
                )}
            </div>

            <div className="tjp__slots">
                <div className="tjp__slotBox tjp__slotBox--a">
                    <span className="tjp__slotOwner">{req.requester_nama}</span>
                    <span className="tjp__slotVal">
                        {req.requester_slots && req.requester_slots.length > 0
                            ? req.requester_slots.map(s => slotText(s.hari, s.jam_ke, s.kelas, s.mapel)).map((txt, i) => <div key={i}>{txt}</div>)
                            : slotText(req.requester_hari, req.requester_jam_ke, req.requester_kelas, req.requester_mapel)
                        }
                    </span>
                </div>
                <ArrowLeftRight size={18} className="tjp__swapIcon" />
                <div className="tjp__slotBox tjp__slotBox--b">
                    <span className="tjp__slotOwner">{req.target_nama}</span>
                    <span className="tjp__slotVal">
                        {req.target_slots && req.target_slots.length > 0
                            ? req.target_slots.map(s => slotText(s.hari, s.jam_ke, s.kelas, s.mapel)).map((txt, i) => <div key={i}>{txt}</div>)
                            : slotText(req.target_hari, req.target_jam_ke, req.target_kelas, req.target_mapel)
                        }
                    </span>
                </div>
            </div>

            {req.alasan && <div className="tjp__note"><b>Alasan:</b> {req.alasan}</div>}
            {req.guru_catatan && <div className="tjp__note"><b>Catatan guru:</b> {req.guru_catatan}</div>}
            {req.wkm_catatan && <div className="tjp__note"><b>Catatan Akademik:</b> {req.wkm_catatan}</div>}

            <div className="tjp__cardFoot">
                <span className="tjp__date">
                    {new Date(req.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {req.wkm_nama ? ` • ${req.wkm_nama}` : ''}
                </span>
                {actions && <div className="tjp__actions">{actions}</div>}
            </div>
        </div>
    )
}

export default function TukarJadwalTab({
    onChanged,
}: {
    /** Dipanggil setelah daftar berubah, agar badge di tab ikut diperbarui. */
    onChanged?: () => void
}) {
    const [data, setData] = useState<TukarData | null>(null)
    const [loading, setLoading] = useState(true)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [busyId, setBusyId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/tukar-jadwal')
            const json = await res.json()
            if (json.ok) { setData(json.data); setError(null) }
            else setError(json.error || 'Gagal memuat pengajuan')
        } catch (e: any) {
            setError(e.message || 'Gagal memuat pengajuan')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    // Pengajuan baru dikirim lewat modal milik halaman (tombol FAB / Action
    // Sheet), bukan dari tab ini. Tanpa pemberitahuan ini daftar tidak ikut
    // menyegar bila tab Tukar kebetulan sudah aktif saat pengajuan dikirim.
    useEffect(() => {
        const onUpdated = () => { load() }
        window.addEventListener('acca:tukar-jadwal-updated' as any, onUpdated)
        return () => window.removeEventListener('acca:tukar-jadwal-updated' as any, onUpdated)
    }, [load])

    const aksi = async (id: number, jenis: string, perluCatatan = false) => {
        let catatan = ''
        if (perluCatatan) {
            const input = window.prompt('Catatan / alasan (opsional):', '')
            if (input === null) return // dibatalkan
            catatan = input
        }
        setBusyId(id); setError(null)
        try {
            const res = await fetch(`/api/tukar-jadwal/${id}`, {
                method: 'PATCH',
                headers: JSON_HEADERS,
                body: JSON.stringify({ aksi: jenis, catatan }),
            })
            const json = await res.json()
            if (!json.ok) setError(json.error || 'Aksi gagal')
            await load()
            onChanged?.()
        } catch (e: any) {
            setError(e.message || 'Aksi gagal')
        } finally {
            setBusyId(null)
        }
    }

    const masuk = data?.masuk || []
    const keluar = data?.keluar || []
    const perluWkm = data?.perluWkm || []
    const riwayatWkm = data?.riwayatWkm || []

    return (
        <div className="tjp">
            {/* 3-Poin Alur Tukar Jadwal */}
            <div className="tjp__flowCard">
                <div className="tjp__flow">
                    <div className="tjp__step">
                        <div className="tjp__stepCircle">1</div>
                    </div>
                    <div className="tjp__connector">
                        <span className="tjp__connectorLabel">Ajukan</span>
                        <div className="tjp__connectorLine" />
                    </div>
                    <div className="tjp__step">
                        <div className="tjp__stepCircle">2</div>
                    </div>
                    <div className="tjp__connector">
                        <span className="tjp__connectorLabel">Guru Tujuan</span>
                        <div className="tjp__connectorLine" />
                    </div>
                    <div className="tjp__step">
                        <div className="tjp__stepCircle">3</div>
                    </div>
                    <div className="tjp__connector">
                        <span className="tjp__connectorLabel">Akademik</span>
                        <div className="tjp__connectorLine" />
                    </div>
                    <div className="tjp__step tjp__step--done">
                        <div className="tjp__stepCircle tjp__stepCircle--done" title="Jadwal Berubah">
                            <Check size={14} strokeWidth={2.6} />
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="tjp__error"><AlertTriangle size={18} style={{ flexShrink: 0 }} /><span>{error}</span></div>
            )}

            {loading ? (
                <div className="tjp__loading"><Loader2 size={18} className="fa-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Memuat pengajuan…</div>
            ) : (
                <>
                    {/* Persetujuan yang ditunggu dari user ini (sebagai guru tujuan) */}
                    <section className="tjp__section">
                        <div className="tjp__sectionHead">
                            <h3><Inbox size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Permintaan Masuk</h3>
                            {masuk.length > 0 && <span className="tjp__count">{masuk.length}</span>}
                        </div>
                        {masuk.length === 0 ? (
                            <div className="tjp__empty">Tidak ada permintaan</div>
                        ) : masuk.map(r => (
                            <RequestCard
                                key={r.id}
                                req={r}
                                busy={busyId === r.id}
                                actions={<>
                                    <button className="tjp__btn tjp__btn--ok" disabled={busyId === r.id}
                                        onClick={() => aksi(r.id, 'terima')}>
                                        <Check size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Terima
                                    </button>
                                    <button className="tjp__btn tjp__btn--bad" disabled={busyId === r.id}
                                        onClick={() => aksi(r.id, 'tolak', true)}>
                                        <X size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Tolak
                                    </button>
                                </>}
                            />
                        ))}
                    </section>

                    {/* Persetujuan Akademik */}
                    {data?.isWkm && (
                        <section className="tjp__section">
                            <div className="tjp__sectionHead">
                                <h3><BadgeCheck size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Persetujuan Akademik</h3>
                                <div className="tjp__sectionHead-right">
                                    {perluWkm.length > 0 && <span className="tjp__count">{perluWkm.length}</span>}
                                    {riwayatWkm.length > 0 && (
                                        <button className="tjp__btn tjp__btn--ghost tjp__btn--head" onClick={() => setHistoryModalOpen(true)}>
                                            <History size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Riwayat
                                        </button>
                                    )}
                                </div>
                            </div>
                            {perluWkm.length === 0 ? (
                                <div className="tjp__empty">Tidak ada pengajuan</div>
                            ) : perluWkm.map(r => (
                                <RequestCard
                                    key={r.id}
                                    req={r}
                                    busy={busyId === r.id}
                                    actions={<>
                                        <button className="tjp__btn tjp__btn--ok" disabled={busyId === r.id}
                                            onClick={() => aksi(r.id, 'setujui', true)}>
                                            <Check size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Setujui & Ubah Jadwal
                                        </button>
                                        <button className="tjp__btn tjp__btn--bad" disabled={busyId === r.id}
                                            onClick={() => aksi(r.id, 'tolak_wkm', true)}>
                                            <X size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Tolak
                                        </button>
                                    </>}
                                />
                            ))}
                        </section>
                    )}

                    {/* Ajuan milik user ini */}
                    <section className="tjp__section">
                        <div className="tjp__sectionHead">
                            <h3><Send size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Pengajuan Saya</h3>
                            {keluar.length > 0 && <span className="tjp__count">{keluar.length}</span>}
                        </div>
                        {keluar.length === 0 ? (
                            <div className="tjp__empty">Belum ada data</div>
                        ) : keluar.map(r => (
                            <RequestCard
                                key={r.id}
                                req={r}
                                busy={busyId === r.id}
                                actions={['menunggu_guru', 'menunggu_wkm'].includes(r.status) ? (
                                    <button className="tjp__btn tjp__btn--ghost" disabled={busyId === r.id}
                                        onClick={() => aksi(r.id, 'batal')}>
                                        <Ban size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Batalkan
                                    </button>
                                ) : undefined}
                            />
                        ))}
                    </section>

                    {/* Riwayat Modal (WKM saja) */}
                    {historyModalOpen && typeof document !== 'undefined' && createPortal(
                        <div className="tj__overlay" onClick={() => setHistoryModalOpen(false)}>
                            <div className="tj__modal" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                                <div className="tj__header">
                                    <h3 className="tj__title"><History size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Riwayat</h3>
                                    <button className="tj__close" onClick={() => setHistoryModalOpen(false)} aria-label="Tutup">
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="tj__body">
                                    {riwayatWkm.map(r => <RequestCard key={r.id} req={r} />)}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            )}
        </div>
    )
}
