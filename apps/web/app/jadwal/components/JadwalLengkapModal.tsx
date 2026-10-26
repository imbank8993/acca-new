'use client'

import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { createJadwalPdf } from '@/lib/jadwal-pdf'
import type { GuruMapelEntry } from '@/app/jadwal/lib/parseJadwalExcel'
import Spinner from '@/components/ui/Spinner'
import { FileText, X, AlertTriangle, CalendarX, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar'
import { useTimezone } from '@/hooks/use-timezone'

interface JadwalRow {
    nip: string
    nama_guru: string
    mapel?: string
    mata_pelajaran?: string
    hari: string
    kelas: string
    ruang?: string | null
    jam_ke: string
    berlaku_mulai?: string | null
}

const ALL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

/** Kolom = ruang bila ada, jika tidak pakai kelas (mengikuti template generate). */
function colKeyOf(r: JadwalRow): string {
    const ruang = (r.ruang || '').trim()
    return ruang || r.kelas || '-'
}
function mapelOf(r: JadwalRow): string {
    return r.mapel || r.mata_pelajaran || ''
}
const natCompare = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })

/**
 * Urutkan kolom:
 *  - Kelas reguler diurutkan natural (X, XI, XII).
 *  - Kolom ruangan (bukan nama kelas) ditempatkan di sebelah kanan kelas XI
 *    karena ruangan tsb. dipakai untuk mapel kelas XI.
 * Urutan akhir: kelas X... → kelas XI... → ruangan → kelas XII...
 */
function sortColumns(cols: string[], classSet: Set<string>): string[] {
    const group = (c: string): number => {
        if (!classSet.has(c)) return 1 // ruangan → taruh setelah XI
        const upper = c.toUpperCase()
        if (upper.startsWith('XII')) return 2
        return 0 // X, XI, dll.
    }
    return [...cols].sort((a, b) => {
        const ga = group(a)
        const gb = group(b)
        if (ga !== gb) return ga - gb
        return natCompare(a, b)
    })
}

export default function JadwalLengkapModal({ open, onClose, type = 'mengajar' }: { open: boolean; onClose: () => void; type?: 'mengajar' | 'piket' }) {
    const [exporting, setExporting] = useState(false)
    const [rows, setRows] = useState<JadwalRow[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [berlaku, setBerlaku] = useState<string | null>(null)
    const [selectedDay, setSelectedDay] = useState<string>('Senin')
    const [search, setSearch] = useState('')
    const [selectedKelas, setSelectedKelas] = useState<string>('semua')
    const [waktuMap, setWaktuMap] = useState<Record<string, string>>({})
    const [colIndex, setColIndex] = useState(0)
    const touchStartX = useRef<number | null>(null)
    const activeTabRef = useRef<HTMLButtonElement | null>(null)
    const { getDayName } = useTimezone()

    // Tutup dengan Esc, dan kunci scroll halaman di belakang modal.
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        const overflowAsli = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = overflowAsli
        }
    }, [open, onClose])

    // Scroll tab hari aktif ke tengah container bila container bisa di-scroll
    useEffect(() => {
        if (activeTabRef.current && activeTabRef.current.parentElement) {
            const parent = activeTabRef.current.parentElement
            const tab = activeTabRef.current
            const left = tab.offsetLeft - (parent.clientWidth - tab.clientWidth) / 2
            parent.scrollTo({ left, behavior: 'smooth' })
        }
    }, [selectedDay])

    // Ganti jenis jadwal = data yang sama sekali lain; buang semua turunannya
    // agar tidak ada sisa dari jenis sebelumnya yang sempat tampil.
    useEffect(() => {
        setLoaded(false)
        setRows([])
        setBerlaku(null)
        setWaktuMap({})
        setError(null)
        setSearch('')
        setSelectedKelas('semua')
    }, [type])

    // Fetch full schedule + master_waktu (latest berlaku_mulai) once when opened.
    useEffect(() => {
        if (!open || loaded) return
        let cancelled = false
        ;(async () => {
            setLoading(true); setError(null)
            try {
                const endpoint = type === 'piket' ? '/api/settings/jadwal-piket' : '/api/settings/jadwal-guru'
                const [jadwalRes, waktuRes, kelasRes] = await Promise.all([
                    fetch(endpoint),
                    fetch('/api/master/waktu?limit=10000'),
                    fetch('/api/master/kelas?limit=10000'),
                ])
                const [jadwalJson, waktuJson, kelasJson] = await Promise.all([
                    jadwalRes.json(), waktuRes.json(), kelasRes.json(),
                ])
                if (cancelled) return
                if (jadwalJson.ok) {
                    const data: JadwalRow[] = jadwalJson.data || []
                    setRows(data)
                    setBerlaku(data.find(d => d.berlaku_mulai)?.berlaku_mulai || null)
                    setLoaded(true)
                } else {
                    setError(jadwalJson.error || 'Gagal memuat jadwal')
                }
                
                const waktuData: any[] = (waktuJson.ok ? waktuJson.data : waktuJson) || []
                const kelasData: any[] = (kelasJson.ok ? kelasJson.data : kelasJson) || []
                const kelasProgramMap: Record<string, string> = {}
                kelasData.forEach((k: any) => { if (k.nama) kelasProgramMap[k.nama] = k.program || 'Reguler' })
                
                const fmt = (t: string) => t ? t.substring(0, 5) : ''
                const wMap: Record<string, string> = {}
                waktuData.forEach((w: any) => {
                    const key = `${w.hari}|${w.jam_ke}`
                    if (wMap[key]) return
                    const mulai = fmt(w.mulai || '')
                    const selesai = fmt(w.selesai || '')
                    if (mulai && selesai) wMap[key] = `${mulai} - ${selesai}`
                    else if (mulai) wMap[key] = mulai
                })
                setWaktuMap(wMap)
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Gagal memuat jadwal')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [open, loaded, type])

    // Days that actually have data, in week order.
    const daysPresent = useMemo(() => {
        const set = new Set(rows.map(r => r.hari))
        return ALL_DAYS.filter(d => set.has(d))
    }, [rows])

    // Set of all known class names
    const classSet = useMemo(() => new Set(rows.map(r => r.kelas).filter(Boolean)), [rows])

    // Distinct list of classes for the dropdown filter
    const classOptions = useMemo(() => {
        return Array.from(classSet).sort(natCompare)
    }, [classSet])

    // Default ke hari ini bila ada — memakai zona waktu madrasah, bukan zona
    // perangkat, supaya sama dengan penanda "Hari Ini" di halaman jadwal.
    useEffect(() => {
        if (daysPresent.length === 0) return
        const today = getDayName()
        setSelectedDay(prev => (daysPresent.includes(prev) ? prev : (daysPresent.includes(today) ? today : daysPresent[0])))
    }, [daysPresent, getDayName])

    // Reset ke kolom pertama saat filter/hari berganti — kolom lama mungkin
    // sudah tidak ada di daftar yang baru.
    useEffect(() => {
        setColIndex(0)
    }, [selectedDay, selectedKelas, search])

    // Build filtered matrix for selected day with search & class filter
    const matrix = useMemo(() => {
        let dayRows = rows.filter(r => r.hari === selectedDay)

        // Class Filter
        if (selectedKelas !== 'semua') {
            dayRows = dayRows.filter(r => r.kelas === selectedKelas || colKeyOf(r) === selectedKelas)
        }

        // Text Search Filter
        if (search.trim() !== '') {
            const q = search.toLowerCase().trim()
            dayRows = dayRows.filter(r => {
                const nama = (r.nama_guru || '').toLowerCase()
                const mapel = mapelOf(r).toLowerCase()
                const kelas = (r.kelas || '').toLowerCase()
                const ruang = (r.ruang || '').toLowerCase()
                const jam = String(r.jam_ke)
                return nama.includes(q) || mapel.includes(q) || kelas.includes(q) || ruang.includes(q) || jam.includes(q)
            })
        }

        const rawCols = [...new Set(dayRows.map(colKeyOf))]
        const cols = sortColumns(rawCols, classSet)
        const jams = [...new Set(dayRows.map(r => parseInt(r.jam_ke)).filter(n => !isNaN(n)))].sort((a, b) => a - b)
        const cell: Record<string, JadwalRow[]> = {}
        dayRows.forEach(r => {
            const jam = parseInt(r.jam_ke)
            if (isNaN(jam)) return
            const key = `${jam}|${colKeyOf(r)}`
            if (!cell[key]) cell[key] = []
            cell[key].push(r)
        })
        return { cols, jams, cell }
    }, [rows, selectedDay, classSet, selectedKelas, search])

    const safeColIndex = useMemo(() => {
        if (matrix.cols.length === 0) return 0
        return Math.min(colIndex, Math.max(0, matrix.cols.length - 1))
    }, [colIndex, matrix.cols.length])

    const activeCol = matrix.cols[safeColIndex] || ''

    const goPrevCol = () => setColIndex(prev => Math.max(0, prev - 1))
    const goNextCol = () => setColIndex(prev => Math.min(matrix.cols.length - 1, prev + 1))

    // Geser jari ke kiri/kanan di atas tabel untuk pindah kolom kelas — jarak
    // minimum 40px supaya scroll vertikal biasa (jari agak miring) tidak
    // salah terbaca sebagai geser kolom.
    const handleTouchStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX }
    const handleTouchEnd = (e: TouchEvent) => {
        if (touchStartX.current === null) return
        const delta = e.changedTouches[0].clientX - touchStartX.current
        touchStartX.current = null
        if (Math.abs(delta) < 40) return
        if (delta < 0) goNextCol(); else goPrevCol()
    }

    const exportPdf = async () => {
        setExporting(true)
        try {
            const res = await fetch('/api/settings/guru-mapel?limit=10000')
            const json = await res.json()
            if (!res.ok || !json.ok || !Array.isArray(json.data)) throw new Error('Gagal memuat keterangan kode guru dan mapel. Silakan coba lagi.')
            const master: GuruMapelEntry[] = json.data
            createJadwalPdf(rows, { type, berlaku, waktuMap, master, selectedKelas, search, sortColumns })
                .save(`Jadwal_${type === 'piket' ? 'Piket' : 'PBM'}_Lengkap${berlaku ? '_' + berlaku : ''}.pdf`)
        } catch (e: any) {
            window.alert(e.message || 'Gagal membuat PDF jadwal.')
        } finally {
            setExporting(false)
        }
    }

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div className="jl__overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="jl__modal">
                <div className="jl__head">
                    <div>
                        <h3>{type === 'piket' ? 'Jadwal Piket Lengkap' : 'Jadwal PBM Lengkap'}</h3>
                        {berlaku && <span className="jl__berlaku">Berlaku mulai {new Date(berlaku + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                    </div>
                    <div className="jl__headActions">
                        {loaded && rows.length > 0 && (
                            <button className="jl__btnExport" onClick={exportPdf} disabled={exporting} aria-label="Unduh jadwal PDF" title={exporting ? 'Menyiapkan PDF�' : 'Unduh sebagai PDF'}><FileText size={16} /></button>
                        )}
                        <button className="jl__close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
                    </div>
                </div>

                {loading ? (
                    <div className="jl__state" style={{ padding: '80px 20px' }}>
                        <Spinner variant="buble" />
                    </div>
                ) : error ? (
                    <div className="jl__state jl__stateErr"><AlertTriangle size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /><span>{error}</span></div>
                ) : rows.length === 0 ? (
                    <div className="jl__state"><CalendarX size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /><span>Belum ada jadwal.</span></div>
                ) : (
                    <>
                        {/* Day Tabs — beralih hari dengan mudah lewat tab */}
                        {daysPresent.length > 0 && (
                            <div className="jl__dayTabs" role="tablist" aria-label="Pilih Hari">
                                {daysPresent.map(d => {
                                    const isActive = selectedDay === d
                                    return (
                                        <button
                                            key={d}
                                            ref={isActive ? activeTabRef : null}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            className={`jl__dayTab ${isActive ? 'active' : ''}`}
                                            onClick={() => setSelectedDay(d)}
                                        >
                                            {d}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Search & Filter Toolbar — Hari di tab terpisah, tersisa Pencarian & Kelas */}
                        <div className="jl__toolbarWrap">
                            <FilterToolbar>
                                <FilterSearch
                                    label="Pencarian"
                                    placeholder="Cari guru, mapel, atau ruang…"
                                    value={search}
                                    onChange={setSearch}
                                    grow={1}
                                />
                                <FilterSelect
                                    label="Kelas"
                                    icon="funnel"
                                    value={selectedKelas}
                                    onChange={setSelectedKelas}
                                    options={[
                                        { value: 'semua', label: `Semua Kelas (${classOptions.length})` },
                                        ...classOptions.map(cls => ({ value: cls, label: `Kelas ${cls}` }))
                                    ]}
                                    grow={1}
                                />
                            </FilterToolbar>
                        </div>

                        {/* Matrix Table — satu kolom kelas per waktu, digeser lewat jl__colPager di atas */}
                        <div className="jl__tableWrap" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                            {matrix.cols.length === 0 ? (
                                <div className="jl__state">
                                    <Search size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
                                    <span>Tidak ada jadwal yang cocok untuk {selectedKelas !== 'semua' ? `kelas "${selectedKelas}"` : 'kriteria pencarian'}{search ? ` (${search})` : ''} pada hari {selectedDay}.</span>
                                </div>
                            ) : (
                                <table className="jl__table">
                                    <thead>
                                        <tr>
                                            <th className="jl__thJamWaktu">Waktu</th>
                                            <th className="jl__thCol">
                                                <div className="jl__colHeader">
                                                    <span className="jl__colName">{activeCol}</span>
                                                    <span className="jl__colNavGroup">
                                                        <button type="button" className="jl__colNavBtn" disabled={safeColIndex <= 0} onClick={goPrevCol} title="Kelas Sebelumnya">
                                                            <ChevronLeft size={16} />
                                                        </button>
                                                        <button type="button" className="jl__colNavBtn" disabled={safeColIndex >= matrix.cols.length - 1} onClick={goNextCol} title="Kelas Selanjutnya">
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    </span>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matrix.jams.map(jam => {
                                            const entries = matrix.cell[`${jam}|${activeCol}`] || []
                                            return (
                                                <tr key={jam}>
                                                    <td className="jl__tdJamWaktu">
                                                        <div className="jl__tdJamWaktuInner">
                                                            <span className="jl__jamBadge">{jam}</span>
                                                            <span className="jl__waktuText">{waktuMap[`${selectedDay}|${jam}`] || <span className="jl__dash">—</span>}</span>
                                                        </div>
                                                    </td>
                                                    <td className="jl__cell">
                                                        {entries.length === 0 ? <span className="jl__dash">—</span> : entries.map((e, i) => (
                                                            <div key={i} className="jl__entry">
                                                                <div className="jl__entryTop">
                                                                    <span className="jl__mapel">{mapelOf(e)}</span>
                                                                    {e.kelas && e.kelas !== activeCol && (
                                                                        <>
                                                                            <span className="jl__dot">•</span>
                                                                            <span className="jl__kelas">{e.kelas}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <span className="jl__guru">{e.nama_guru}</span>
                                                            </div>
                                                        ))}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>

            <style jsx>{`
                .jl__overlay { position: fixed; inset: 0; background: rgba(15,23,42,.62); backdrop-filter: blur(6px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; }
                .jl__modal { background: var(--n-card); border-radius: 18px; width: 100%; max-width: 760px; height: 90vh; height: 90dvh; max-height: 90vh; max-height: 90dvh; display: flex; flex-direction: column; box-shadow: 0 25px 70px rgba(0,0,0,.35); overflow: hidden; }
                .jl__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 20px; border-bottom: 1px solid var(--n-border); }
                .jl__head h3 { margin: 0; font-size: .98rem; font-weight: 800; color: var(--n-ink); }
                .jl__berlaku { font-size: .70rem; color: var(--n-muted); font-weight: 500; font-style: italic; }
                .jl__headActions { display: flex; align-items: center; gap: 8px; }
                .jl__btnExport { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--n-soft); color: var(--n-primary); cursor: pointer; transition: all .18s ease; flex-shrink: 0; }
                .jl__btnExport:hover { background: var(--n-soft); opacity: 0.85; }
                .jl__close { width: 32px; height: 32px; border: none; border-radius: 50%; background: var(--n-soft); color: var(--n-muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all .18s ease; flex-shrink: 0; }
                .jl__close:hover { background: var(--n-border); color: var(--n-ink); }

                .jl__state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px 20px; color: var(--n-muted); font-size: .9rem; text-align: center; }
                .jl__state i { font-size: 1.6rem; }
                .jl__stateErr { color: #dc2626; }

                /* Day Tabs — beralih hari cepat lewat tab */
                .jl__dayTabs {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px 4px;
                    overflow-x: auto;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .jl__dayTabs::-webkit-scrollbar {
                    display: none;
                }
                .jl__dayTab {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 16px;
                    border-radius: 999px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-muted);
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.18s ease;
                    white-space: nowrap;
                    user-select: none;
                }
                .jl__dayTab:hover {
                    border-color: var(--n-primary);
                    color: var(--n-primary);
                    background: var(--n-soft);
                }
                .jl__dayTab.active {
                    background: var(--n-primary);
                    border-color: var(--n-primary);
                    color: #ffffff;
                    font-weight: 700;
                    box-shadow: 0 2px 8px rgba(48, 131, 255, 0.32);
                }

                /* Filter toolbar lepas kotaknya agar terlihat melayang menggunakan kotaknya masing-masing */
                .jl__toolbarWrap { padding: 6px 12px 0; }
                .jl__toolbarWrap :global(.ftb-toolbar) {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                /* Pager kelas */
                .jl__colHeader { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
                .jl__colName { flex: 1; min-width: 0; text-align: left; font-size: 0.86rem; font-weight: 500; color: var(--n-ink); text-transform: none; letter-spacing: normal; word-break: break-word; }
                .jl__colNavGroup { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
                .jl__colNavBtn { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; padding: 0; }
                .jl__colNavBtn:hover:not(:disabled) { background: var(--n-primary); color: #fff; border-color: var(--n-primary); }
                .jl__colNavBtn:disabled { opacity: 0.25; cursor: not-allowed; }

                .jl__tableWrap { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; margin: 8px 12px; border: 1px solid var(--n-border); border-radius: 12px; touch-action: pan-y; }
                .jl__table { border-collapse: separate; border-spacing: 0; font-size: .8rem; width: 100%; table-layout: fixed; }
                .jl__table th, .jl__table td { border-right: 1px solid var(--n-border); border-bottom: 1px solid var(--n-border); }
                .jl__table th:last-child, .jl__table td:last-child { border-right: none; }
                .jl__table thead th { position: sticky; top: 0; background: var(--n-elevated); z-index: 2; padding: 12px 10px; font-weight: 700; color: var(--n-muted); text-align: center; font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; }
                .jl__thJamWaktu { width: 156px; white-space: nowrap; text-align: left !important; padding-left: 16px !important; }
                .jl__thCol { width: auto; padding: 12px 12px !important; word-break: break-word; }
                .jl__tdJamWaktu { text-align: left; padding: 10px 8px 10px 16px; height: 1px; }
                .jl__tdJamWaktuInner { display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; height: 100%; }
                .jl__waktuText { font-size: .68rem; font-weight: 600; color: var(--n-muted); white-space: nowrap; line-height: 1.1; }
                .jl__jamBadge { display: inline-flex; align-items: center; justify-content: center; background: var(--n-primary) !important; color: #fff !important; width: 26px; height: 26px; border-radius: 50%; font-weight: 700; font-size: .72rem; flex-shrink: 0; line-height: 1; }
                .jl__cell { padding: 10px 10px; vertical-align: middle; }
                .jl__entry { display: flex; flex-direction: column; gap: 2px; padding: 2px 0; background: transparent !important; border: none !important; margin-bottom: 4px; }
                .jl__entry:last-child { margin-bottom: 0; }
                .jl__entryTop { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
                .jl__mapel { font-weight: 700; color: var(--n-ink); font-size: .8rem; line-height: 1.25; }
                .jl__guru { font-size: .74rem; color: var(--n-muted); }
                .jl__dot { color: var(--n-muted); opacity: .5; font-size: .7rem; }
                .jl__kelas { font-size: .66rem; font-weight: 500; color: var(--n-primary); background: var(--n-soft); padding: 2px 6px; border-radius: 5px; }
                .jl__dash { color: var(--n-muted); opacity: .4; }

                @media (max-width: 640px) {
                    .jl__overlay {
                        padding: 0 !important;
                        align-items: flex-end !important;
                        justify-content: center !important;
                        background: rgba(17, 46, 89, 0.55) !important;
                        -webkit-backdrop-filter: blur(8px) !important;
                        backdrop-filter: blur(8px) !important;
                    }
                    .jl__modal {
                        width: 100% !important;
                        max-width: 100% !important;
                        height: 88vh !important;
                        height: 88dvh !important;
                        max-height: 88vh !important;
                        max-height: 88dvh !important;
                        border-radius: 24px 24px 0 0 !important;
                        border-top: 1px solid var(--n-border) !important;
                        border-left: none !important;
                        border-right: none !important;
                        border-bottom: none !important;
                        box-shadow: 0 -12px 36px rgba(17, 46, 89, 0.2) !important;
                        animation: bnavSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
                        padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
                    }
                    .jl__modal::before {
                        content: '';
                        display: block;
                        width: 36px;
                        height: 4px;
                        border-radius: 999px;
                        background: var(--n-navy);
                        margin: 10px auto 2px;
                        flex-shrink: 0;
                    }
                    .jl__head h3 { font-size: .92rem; }
                    .jl__dayTabs {
                        gap: 6px;
                        padding: 8px 12px 2px;
                        -webkit-overflow-scrolling: touch;
                    }
                    .jl__dayTab {
                        flex: 1 1 0;
                        min-width: 48px;
                        min-height: 36px;
                        padding: 7px 4px;
                        font-size: 0.74rem;
                        font-weight: 700;
                        border-radius: 999px;
                        text-align: center;
                        touch-action: manipulation;
                    }
                    .jl__toolbarWrap { padding: 4px 12px 0; }

                    .jl__thJamWaktu { width: 108px; }
                    .jl__tdJamWaktuInner { gap: 3px; }
                    .jl__jamBadge { width: 14px; height: 14px; font-size: .52rem; font-weight: 800; border-radius: 50%; transform: translateY(-3px); }

                    .jl__colNavGroup { gap: 6px; }
                    .jl__colNavBtn { width: 34px; height: 34px; }
                    .jl__colNavBtn svg { width: 16px; height: 16px; }
                    .jl__close, .jl__btnExport { width: 40px; height: 40px; }
                    .jl__close svg, .jl__btnExport svg { width: 19px; height: 19px; }
                }

                /* Dark Mode overrides */
                :global(.dark) .jl__modal {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                }
                :global(.dark) .jl__close {
                    background: var(--n-soft);
                    color: var(--n-muted);
                }
                :global(.dark) .jl__close:hover {
                    background: var(--n-border);
                    color: var(--n-ink);
                }
                :global(.dark) .jl__btnExport {
                    background: var(--n-soft);
                    color: var(--n-primary);
                }
                :global(.dark) .jl__head {
                    border-bottom-color: var(--n-border);
                }
                :global(.dark) .jl__head h3 {
                    color: var(--n-ink);
                }
                :global(.dark) .jl__berlaku {
                    color: var(--n-muted);
                }
                :global(.dark) .jl__dayTab {
                    background: var(--n-card);
                    border-color: var(--n-border);
                    color: var(--n-muted);
                }
                :global(.dark) .jl__dayTab:hover {
                    border-color: var(--n-primary);
                    color: var(--n-primary);
                    background: var(--n-soft);
                }
                :global(.dark) .jl__dayTab.active {
                    background: var(--n-primary);
                    border-color: var(--n-primary);
                    color: #ffffff;
                }
                :global(.dark) .jl__tableWrap {
                    background: var(--n-card);
                    border-color: var(--n-border);
                }
                :global(.dark) .jl__table th,
                :global(.dark) .jl__table td {
                    border-color: var(--n-border);
                }
                :global(.dark) .jl__table thead th,
                :global(.dark) .jl__thJamWaktu {
                    background: var(--n-elevated);
                    color: var(--n-ink);
                }
                :global(.dark) .jl__tdJamWaktu {
                    background: var(--n-card);
                }
                :global(.dark) .jl__waktuText {
                    color: var(--n-muted);
                }
                :global(.dark) .jl__entry {
                    background: transparent;
                    border: none;
                }
                :global(.dark) .jl__mapel {
                    color: var(--n-ink);
                }
                :global(.dark) .jl__guru {
                    color: var(--n-muted);
                }
            `}</style>
        </div>,
        document.body
    )
}
