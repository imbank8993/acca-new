'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Select from 'react-select'
import {
    CalendarX,
    X,
    Info,
    User,
    ArrowLeftRight,
    ArrowRight,
    AlertTriangle,
    Send,
    Loader2,
    CheckCircle2,
    Circle
} from 'lucide-react'
import '../jadwal.css'

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export type JenisTukar = 'mengajar' | 'piket'

/** Bentuk slot yang sudah dinormalisasi oleh /api/tukar-jadwal/slots. */
export interface SlotJadwal {
    jenis: JenisTukar
    /** Hanya untuk jenis 'mengajar' — id baris jadwal_guru. */
    id?: number
    /** Hanya untuk jenis 'piket' — kunci grup `nip|hari|jam_ke`. */
    key?: string
    hari: string
    jam_ke: string
    kelas: string
    mapel?: string
    waktu?: string
    kelasList?: string[]
    jumlahBaris?: number
}

interface GuruOpsi {
    nip: string
    nama_guru: string
}

/** Id unik untuk keperluan seleksi di UI — beda sumber per jenis. */
const slotUid = (s: SlotJadwal) => (s.jenis === 'piket' ? s.key! : String(s.id))
const mapelOf = (s: SlotJadwal) => s.mapel || '-'
const jamNum = (s: SlotJadwal) => parseInt(s.jam_ke, 10) || 0
const dayIdx = (h: string) => {
    const i = DAYS.indexOf(h)
    return i === -1 ? 99 : i
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Maksimal JP yang boleh ditukar sekaligus — dibatasi juga di sisi server. */
const MAKS_JP = 3

/** Daftar slot yang bisa dipilih, dikelompokkan per hari. */
function SlotPicker({
    slots, selectedUids, onSelect, emptyText, accent,
}: {
    slots: SlotJadwal[]
    selectedUids: string[]
    onSelect: (s: SlotJadwal) => void
    emptyText: string
    accent: 'a' | 'b'
}) {
    const grouped = useMemo(() => {
        const byDay = new Map<string, SlotJadwal[]>()
        for (const s of slots) {
            if (!byDay.has(s.hari)) byDay.set(s.hari, [])
            byDay.get(s.hari)!.push(s)
        }
        return [...byDay.entries()]
            .sort((a, b) => dayIdx(a[0]) - dayIdx(b[0]))
            .map(([hari, list]) => [hari, [...list].sort((x, y) => jamNum(x) - jamNum(y))] as const)
    }, [slots])


    if (slots.length === 0) {
        return (
            <div className="tj__slotEmpty">
                <CalendarX size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /><span>{emptyText}</span>
            </div>
        )
    }

    return (
        <div className="tj__slotList">
            {grouped.map(([hari, list]) => (
                <div key={hari} className="tj__slotDay">
                    <div className="tj__slotDayName">{hari}</div>
                    {list.map(s => {
                        const uid = slotUid(s)
                        const dipilih = selectedUids.includes(uid)
                        return (
                            <button
                                key={uid}
                                type="button"
                                className={`tj__slot tj__slot--${accent} ${dipilih ? 'is-selected' : ''}`}
                                onClick={() => onSelect(s)}
                            >
                                <span className="tj__slotJam">{s.jam_ke}</span>
                                <span className="tj__slotBody">
                                    <span className="tj__slotKelas">{s.kelas}</span>
                                    <span className="tj__slotMapel">{mapelOf(s)}</span>
                                    {s.waktu && <span className="tj__slotWaktu">{s.waktu}</span>}
                                    {s.jenis === 'piket' && s.jumlahBaris ? (
                                        <span className="tj__slotWaktu">
                                            Mencakup {s.jumlahBaris} baris jadwal — ditukar sekaligus
                                        </span>
                                    ) : null}
                                </span>
                                {dipilih ? <CheckCircle2 size={18} className="tj__slotCheck" /> : <Circle size={18} className="tj__slotCheck" />}
                            </button>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

export default function TukarJadwalModal({
    open, onClose, nip, onSubmitted,
}: {
    open: boolean
    onClose: () => void
    nip: string
    onSubmitted: () => void
}) {
    const [mySlots, setMySlots] = useState<SlotJadwal[]>([])
    const [guruList, setGuruList] = useState<GuruOpsi[]>([])
    const [targetSlots, setTargetSlots] = useState<SlotJadwal[]>([])

    const [jenis, setJenis] = useState<JenisTukar>('mengajar')
    const [slotsA, setSlotsA] = useState<SlotJadwal[]>([])
    const [guruB, setGuruB] = useState<string>('')
    const [slotsB, setSlotsB] = useState<SlotJadwal[]>([])
    const [alasan, setAlasan] = useState('')

    const [loadingMine, setLoadingMine] = useState(false)
    const [loadingTarget, setLoadingTarget] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Reset tiap kali dibuka. `mySlots`/`guruList` ikut dikosongkan supaya
    // daftar milik pembukaan sebelumnya tidak sempat terlihat sebelum data
    // baru tiba.
    useEffect(() => {
        if (!open) return
        setJenis('mengajar')
        setSlotsA([]); setGuruB(''); setSlotsB([]); setAlasan('')
        setError(null); setMySlots([]); setGuruList([]); setTargetSlots([])
    }, [open])

    // Ganti jenis = konteks berbeda total, bersihkan seluruh pilihan.
    useEffect(() => {
        setSlotsA([]); setGuruB(''); setSlotsB([])
        setMySlots([]); setTargetSlots([]); setError(null)
    }, [jenis])

    // Muat jadwal sendiri + daftar guru (keduanya bergantung jenis)
    useEffect(() => {
        if (!open || !nip) return
        let cancelled = false
        ;(async () => {
            setLoadingMine(true)
            try {
                const [mineRes, guruRes] = await Promise.all([
                    fetch(`/api/tukar-jadwal/slots?jenis=${jenis}&nip=${encodeURIComponent(nip)}`),
                    fetch(`/api/tukar-jadwal/guru?jenis=${jenis}`),
                ])
                const [mineJson, guruJson] = await Promise.all([mineRes.json(), guruRes.json()])
                if (cancelled) return
                if (mineJson.ok) setMySlots(mineJson.data || [])
                else setError(mineJson.error || 'Gagal memuat jadwal Anda')
                if (guruJson.ok) setGuruList(guruJson.data || [])
                else setError(guruJson.error || 'Gagal memuat daftar guru')
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Gagal memuat data')
            } finally {
                if (!cancelled) setLoadingMine(false)
            }
        })()
        return () => { cancelled = true }
    }, [open, nip, jenis])

    // Muat jadwal guru tujuan
    useEffect(() => {
        if (!guruB) { setTargetSlots([]); setSlotsB([]); return }
        let cancelled = false
        ;(async () => {
            setLoadingTarget(true); setSlotsB([])
            try {
                const res = await fetch(
                    `/api/tukar-jadwal/slots?jenis=${jenis}&nip=${encodeURIComponent(guruB)}`
                )
                const json = await res.json()
                if (cancelled) return
                setTargetSlots(json.ok ? (json.data || []) : [])
            } catch {
                if (!cancelled) setTargetSlots([])
            } finally {
                if (!cancelled) setLoadingTarget(false)
            }
        })()
        return () => { cancelled = true }
    }, [guruB, jenis])

    const namaGuruB = guruList.find(g => g.nip === guruB)?.nama_guru || ''
    
    const guruOptions = useMemo(() => {
        return (guruList || []).map(g => ({
            value: String(g.nip || ''),
            label: String(g.nama_guru || g.nip || '')
        }))
    }, [guruList])

    const selectedGuruOption = useMemo(() => {
        if (!guruB) return null
        const found = guruList.find(g => String(g.nip) === String(guruB))
        return {
            value: guruB,
            label: found?.nama_guru || namaGuruB || guruB
        }
    }, [guruB, guruList, namaGuruB])

    /** Cocokkan juga terhadap NIP, bukan hanya nama seperti bawaan react-select. */
    const filterGuru = useCallback((option: any, rawInput: string) => {
        const search = (rawInput || '').toLowerCase().trim()
        if (!search) return true
        const label = String(option?.label || '').toLowerCase()
        const val = String(option?.value || '').toLowerCase()
        return label.includes(search) || val.includes(search)
    }, [])

    // Filter target slots based on origin class
    const filteredTargetSlots = useMemo(() => {
        if (jenis === 'piket' || slotsA.length === 0) return targetSlots;
        const reqClass = slotsA[0].kelas;
        return targetSlots.filter(s => s.kelas === reqClass);
    }, [targetSlots, slotsA, jenis])

    /** Klik pada slot yang sudah terpilih = batalkan pilihan. */
    const toggle = (list: SlotJadwal[], s: SlotJadwal) => {
        const uid = slotUid(s)
        return list.some(x => slotUid(x) === uid) ? list.filter(x => slotUid(x) !== uid) : null
    }

    const handleSelectA = (s: SlotJadwal) => {
        if (jenis === 'piket') {
            setSlotsA([s]); setSlotsB([])
            return
        }
        const tanpaS = toggle(slotsA, s)
        if (tanpaS) { setSlotsA(tanpaS); return }
        if (slotsA.length >= MAKS_JP) return
        // Beda kelas = konteks tukar yang lain; mulai ulang dari slot ini.
        // Pilihan guru tujuan ikut direset karena disaring per kelas asal.
        if (slotsA.length > 0 && slotsA[0].kelas !== s.kelas) {
            setSlotsA([s]); setSlotsB([])
            return
        }
        setSlotsA([...slotsA, s])
    }

    const handleSelectB = (s: SlotJadwal) => {
        if (jenis === 'piket') {
            setSlotsB([s])
            return
        }
        const tanpaS = toggle(slotsB, s)
        if (tanpaS) { setSlotsB(tanpaS); return }
        if (slotsA.length === 0) {
            setError('Pilih dulu jadwal Anda di kolom 1.')
            return
        }
        // Jumlah JP kedua sisi harus sama, jadi jangan biarkan melebihi sisi A.
        if (slotsB.length >= Math.min(slotsA.length, MAKS_JP)) {
            setError(`Cukup ${slotsA.length} JP — sama dengan jumlah JP yang Anda pilih.`)
            return
        }
        setError(null)
        setSlotsB([...slotsB, s])
    }

    const bisaKirim = slotsA.length > 0 && slotsA.length === slotsB.length && !submitting

    const submit = async () => {
        if (slotsA.length === 0 || slotsB.length === 0 || slotsA.length !== slotsB.length) return
        setSubmitting(true); setError(null)
        try {
            const payload = jenis === 'piket'
                ? { jenis, requester_piket_key: slotsA[0].key, target_piket_key: slotsB[0].key, alasan }
                : { jenis, requester_slots: slotsA, target_slots: slotsB, alasan }
            const res = await fetch('/api/tukar-jadwal', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (!json.ok) { setError(json.error || 'Gagal mengirim pengajuan'); return }
            onSubmitted()
            onClose()
        } catch (e: any) {
            setError(e.message || 'Gagal mengirim pengajuan')
        } finally {
            setSubmitting(false)
        }
    }

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div className="tj__overlay" onClick={onClose}>
            <div className="tj__modal" onClick={e => e.stopPropagation()}>
                <div className="tj__header">
                    <h3 className="tj__title">
                        <ArrowLeftRight size={18} style={{ color: 'var(--n-primary)', flexShrink: 0 }} />
                        <span>Ajukan Tukar Jadwal</span>
                    </h3>
                    <button className="tj__close" onClick={onClose} aria-label="Tutup">
                        <X size={18} />
                    </button>
                </div>

                <div className="tj__body">
                    {/* ── Jenis jadwal yang ditukar ── */}
                    <div className="tj__jenisBar">
                        <button
                            type="button"
                            className={`tj__jenisBtn ${jenis === 'mengajar' ? 'is-active' : ''}`}
                            onClick={() => setJenis('mengajar')}
                        >
                            PBM
                        </button>
                        <button
                            type="button"
                            className={`tj__jenisBtn ${jenis === 'piket' ? 'is-active' : ''}`}
                            onClick={() => setJenis('piket')}
                        >
                            Piket
                        </button>
                    </div>

                    {jenis === 'piket' && (
                        <div className="tj__hintBox">
                            <Info size={18} style={{ flexShrink: 0 }} />
                            <span>
                                Satu tugas piket mencakup banyak kelas sekaligus. Pertukaran dilakukan
                                untuk <b>seluruh kelas</b> pada jam tersebut, tidak bisa sebagian.
                            </span>
                        </div>
                    )}

                    <div className="tj__cols">
                        {/* ── Slot milik saya ── */}
                        <section className="tj__col">
                            <div className="tj__colHead">
                                <span className="tj__step">1</span>
                                <div className="tj__colTitle">
                                    {jenis === 'piket' ? 'Piket Saya' : 'Jadwal Saya'}
                                </div>
                            </div>
                            {loadingMine ? (
                                <div className="tj__loading"><Loader2 size={18} className="fa-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Memuat…</div>
                            ) : (
                                <SlotPicker
                                    slots={mySlots}
                                    selectedUids={slotsA.map(slotUid)}
                                    onSelect={handleSelectA}
                                    emptyText={jenis === 'piket'
                                        ? 'Anda belum punya tugas piket aktif'
                                        : 'Anda belum punya jadwal mengajar aktif'}
                                    accent="a"
                                />
                            )}
                        </section>

                        {/* ── Slot guru tujuan ── */}
                        <section className="tj__col">
                            <div className="tj__colHead">
                                <span className="tj__step">2</span>
                                <div className="tj__colTitle">
                                    {jenis === 'piket' ? 'Piket Guru Tujuan' : 'Jadwal Guru Tujuan'}
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <Select
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    options={guruOptions}
                                    value={selectedGuruOption}
                                    onChange={(sel) => setGuruB(sel?.value || '')}
                                    filterOption={filterGuru}
                                    placeholder="Cari nama atau NIP guru…"
                                    isSearchable={true}
                                    isClearable={true}
                                    menuPlacement="auto"
                                    menuPosition="fixed"
                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                    noOptionsMessage={() => "Guru tidak ditemukan"}
                                    styles={{
                                        menuPortal: (base) => ({
                                            ...base,
                                            zIndex: 99999,
                                            fontFamily: "'Poppins', sans-serif",
                                        }),
                                        container: (base) => ({
                                            ...base,
                                            fontFamily: "'Poppins', sans-serif",
                                        }),
                                        control: (base, state) => ({
                                            ...base,
                                            fontFamily: "'Poppins', sans-serif",
                                            borderColor: state.isFocused ? 'var(--n-primary)' : 'var(--n-border)',
                                            backgroundColor: 'var(--n-surface)',
                                            color: 'var(--n-ink)',
                                            borderRadius: '6px',
                                            minHeight: '42px',
                                            boxShadow: state.isFocused ? '0 0 0 1px var(--n-primary)' : 'none',
                                            '&:hover': {
                                                borderColor: 'var(--n-primary)',
                                            }
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            fontFamily: "'Poppins', sans-serif",
                                            zIndex: 99999,
                                            backgroundColor: 'var(--n-card)',
                                            border: '1px solid var(--n-border)'
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            fontFamily: "'Poppins', sans-serif",
                                            color: 'var(--n-ink)'
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            fontFamily: "'Poppins', sans-serif",
                                            color: 'var(--n-ink)'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            fontFamily: "'Poppins', sans-serif",
                                            color: 'var(--n-muted)'
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            fontFamily: "'Poppins', sans-serif",
                                            backgroundColor: state.isSelected 
                                                ? 'var(--n-primary)' 
                                                : state.isFocused 
                                                    ? 'var(--n-soft)' 
                                                    : 'transparent',
                                            color: state.isSelected ? '#fff' : 'var(--n-ink)',
                                            cursor: 'pointer',
                                            '&:active': {
                                                backgroundColor: 'var(--n-primary)',
                                                color: '#fff'
                                            }
                                        })
                                    }}
                                />
                            </div>

                            {!guruB ? (
                                <div className="tj__slotEmpty"><User size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /><span>Pilih guru terlebih dahulu</span></div>
                            ) : loadingTarget ? (
                                <div className="tj__loading"><Loader2 size={18} className="fa-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Memuat…</div>
                            ) : (
                                <SlotPicker
                                    slots={filteredTargetSlots}
                                    selectedUids={slotsB.map(slotUid)}
                                    onSelect={handleSelectB}
                                    emptyText={jenis === 'piket'
                                        ? 'Guru ini belum punya tugas piket aktif'
                                        : 'Guru ini belum punya jadwal mengajar aktif'}
                                    accent="b"
                                />
                            )}
                        </section>
                    </div>

                    {/* ── Ringkasan ── */}
                    {(slotsA.length > 0 || slotsB.length > 0) && (
                        <div className="tj__preview">
                            <div className="tj__previewTitle">
                                <span className="tj__previewIconWrap"><ArrowLeftRight size={14} /></span>
                                Hasil setelah ditukar
                            </div>
                            <div className="tj__previewRows">
                                <div className="tj__previewRow">
                                    <span className="tj__pvName">{slotsA.length > 0 ? 'Anda' : '—'}</span>
                                    <span className="tj__pvArrow"><ArrowRight size={14} /></span>
                                    <span className="tj__pvSlot">
                                        {slotsB.length > 0
                                            ? jenis === 'piket'
                                                ? `Piket ${slotsB[0].hari} jam ke-${slotsB[0].jam_ke} • ${slotsB[0].kelas}`
                                                : slotsB.map(s => `${s.hari} jam ke-${s.jam_ke} • ${s.kelas}`).join(', ')
                                            : 'belum dipilih'}
                                    </span>
                                </div>
                                <div className="tj__previewRow">
                                    <span className="tj__pvName">{namaGuruB || 'Guru tujuan'}</span>
                                    <span className="tj__pvArrow"><ArrowRight size={14} /></span>
                                    <span className="tj__pvSlot">
                                        {slotsA.length > 0
                                            ? jenis === 'piket'
                                                ? `Piket ${slotsA[0].hari} jam ke-${slotsA[0].jam_ke} • ${slotsA[0].kelas}`
                                                : slotsA.map(s => `${s.hari} jam ke-${s.jam_ke} • ${s.kelas}`).join(', ')
                                            : 'belum dipilih'}
                                    </span>
                                </div>
                            </div>
                            <p className="tj__previewNote">
                                {jenis === 'piket'
                                    ? 'Cakupan kelas tetap melekat pada jam piketnya — yang bertukar adalah guru penjaganya.'
                                    : `Memilih ${slotsA.length} JP. Pastikan memilih JP dalam jumlah yang sama untuk guru tujuan.`}
                            </p>
                        </div>
                    )}

                    <label className="tj__label">Alasan (opsional)</label>
                    <textarea
                        className="tj__textarea"
                        rows={2}
                        placeholder="Contoh: bentrok dengan tugas tambahan setiap Senin pagi"
                        value={alasan}
                        onChange={e => setAlasan(e.target.value)}
                    />

                    {error && (
                        <div className="tj__error"><AlertTriangle size={18} style={{ flexShrink: 0 }} /><span>{error}</span></div>
                    )}
                </div>

                <div className="tj__footer">
                    <button className="tj__btn tj__btn--ghost" onClick={onClose} disabled={submitting}>Batal</button>
                    <button className="tj__btn tj__btn--primary" onClick={submit} disabled={!bisaKirim}>
                        {submitting ? <><Loader2 size={16} className="fa-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Mengirim…</> : <><Send size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Kirim Pengajuan</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
