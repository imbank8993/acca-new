'use client';

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { JAM_SEMUA, isCutiBersama, labelLingkup, normalizeJamKe, normalizeLingkup } from '@/lib/libur';
import '../agenda.css';
import { fetchAgendaList, formatWaktuAgenda } from '@/lib/agenda';
import SasaranAgenda from './SasaranAgenda';

interface AgendaItem {
    id: number | string;
    sasaran?: string[];
    judul: string;
    deskripsi: string | null;
    tanggal_mulai: string;
    tanggal_selesai: string | null;
    waktu_mulai: string | null;
    waktu_selesai: string | null;
    lokasi: string | null;
    kategori: string;
    warna: string;
    skip_hari_libur: boolean | null;
    foto?: { url: string; caption: string | null; tanggal?: string | null }[] | null;
}

function agendaSchedule(event: AgendaItem) {
    return [
        formatDateRange(event.tanggal_mulai, event.tanggal_selesai),
        event.waktu_mulai ? formatWaktuAgenda(event.waktu_mulai, event.waktu_selesai) : null,
        event.lokasi?.trim(),
    ].filter(Boolean).join(' | ');
}

interface AgendaFoto {
    url: string;
    caption: string | null;
    tanggal?: string | null;
}

interface HolidayItem {
    tanggal: string;
    nama: string;
    jam_ke: string;
    lingkup?: string | null;
    target_kelas?: string[] | string | null;
}

/** Libur sehari penuh yang berlaku untuk seluruh madrasah (bukan sekadar PBM tidak efektif). */
const isLiburPenuhSekolah = (h: HolidayItem) =>
    normalizeJamKe(h.jam_ke) === JAM_SEMUA &&
    normalizeLingkup(h) === 'semua' &&
    !/tidak\s*efektif|non\s*[-_ ]?efektif|fakultatif/i.test(h.nama || '');

const BULAN_LABELS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const HARI_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const KATEGORI_CONFIG: Record<string, { emoji: string; bg: string }> = {
    Umum: { emoji: "📅", bg: "rgba(59, 130, 246, 0.1)" },
    Ujian: { emoji: "✏️", bg: "rgba(245, 158, 11, 0.1)" },
    Libur: { emoji: "🌴", bg: "rgba(239, 68, 68, 0.1)" },
    Rapat: { emoji: "👥", bg: "rgba(59, 130, 246, 0.1)" },
    Kegiatan: { emoji: "⭐", bg: "rgba(16, 185, 129, 0.1)" },
    Penerimaan: { emoji: "🎓", bg: "rgba(99, 102, 241, 0.1)" },
    Lainnya: { emoji: "📌", bg: "rgba(100, 116, 139, 0.1)" },
};

function toDateStr(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateRange(startStr: string, endStr?: string | null) {
    if (!startStr) return "";
    if (!endStr || endStr === startStr) return formatDate(startStr);
    
    const d1 = new Date(startStr.includes("T") ? startStr : startStr + "T00:00:00");
    const d2 = new Date(endStr.includes("T") ? endStr : endStr + "T00:00:00");
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return formatDate(startStr);

    const m1 = d1.toLocaleDateString("id-ID", { month: "short" });
    const m2 = d2.toLocaleDateString("id-ID", { month: "short" });
    const y1 = d1.getFullYear();
    const y2 = d2.getFullYear();

    if (y1 === y2 && m1 === m2) {
        return `${d1.getDate()} - ${d2.getDate()} ${m1} ${y1}`;
    } else if (y1 === y2) {
        return `${d1.getDate()} ${m1} - ${d2.getDate()} ${m2} ${y1}`;
    }
    return `${formatDate(startStr)} - ${formatDate(endStr)}`;
}

export default function AgendaDisplayView({ headerTabs }: { headerTabs?: React.ReactNode } = {}) {
    const [agendas, setAgendas] = useState<AgendaItem[]>([]);
    const [holidays, setHolidays] = useState<HolidayItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const now = new Date();
    const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth()); 
    const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
    const [activeTab, setActiveTab] = useState<'selected' | 'ongoing' | 'upcoming'>('selected');
    const [expandedEventId, setExpandedEventId] = useState<number | string | null>(null);

    const [retry, setRetry] = useState(0);
    const [categories, setCategories] = useState<{ nama: string; color: string }[]>([]);

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        const fetchAgenda = async () => {
            setLoading(true);
            setError(null);
            try {
                const list = await fetchAgendaList(true, controller.signal);
                if (!cancelled) setAgendas(list);
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Gagal memuat data agenda.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/agenda-madrasah/kategori');
                const json = await res.json();
                if (json.data && Array.isArray(json.data)) {
                    setCategories(json.data);
                }
            } catch {}
        };
        fetchAgenda();
        fetchCategories();
        return () => { cancelled = true; controller.abort(); };
    }, [retry]);

    const categoryColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        categories.forEach(c => {
            if (c.nama && c.color) {
                map[c.nama.toLowerCase().trim()] = c.color;
            }
        });
        return map;
    }, [categories]);

    const effectiveAgendas = useMemo(() => {
        return agendas.map(a => {
            const effectiveWarna = categoryColorMap[a.kategori?.toLowerCase().trim()] || a.warna || '#3083FF';
            return { ...a, warna: effectiveWarna };
        });
    }, [agendas, categoryColorMap]);

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const res = await fetch(`/api/settings/libur?tahun=${viewYear}`);
                if (!res.ok) return;
                const json = await res.json();
                if (json.ok && json.data) {
                    const mapped: HolidayItem[] = json.data.map((h: any) => ({
                        tanggal: h.tanggal,
                        nama: h.keterangan,
                        jam_ke: h.jam_ke || 'Semua',
                        lingkup: h.lingkup,
                        target_kelas: h.target_kelas,
                    }));
                    setHolidays(mapped);
                }
            } catch { }
        };
        fetchHolidays();
    }, [viewYear]);

    // Satu tanggal bisa punya beberapa entri libur (mis. libur kelas XII saja +
    // libur jam ke-1 untuk kelas X). Versi lama menyimpan satu entri per tanggal
    // sehingga entri berikutnya menimpa yang sebelumnya.
    const holidayMap = useMemo(() => {
        const map: Record<string, HolidayItem[]> = {};
        holidays.forEach(h => {
            if (!map[h.tanggal]) map[h.tanggal] = [];
            map[h.tanggal].push(h);
        });
        return map;
    }, [holidays]);

    const eventMap = useMemo(() => {
        const map: Record<string, AgendaItem[]> = {};
        effectiveAgendas.forEach(a => {
            if (!a.tanggal_mulai) return;
            try {
                const start = new Date(a.tanggal_mulai.includes("T") ? a.tanggal_mulai : a.tanggal_mulai + "T00:00:00");
                const end = a.tanggal_selesai 
                    ? new Date(a.tanggal_selesai.includes("T") ? a.tanggal_selesai : a.tanggal_selesai + "T00:00:00") 
                    : start;
                if (isNaN(start.getTime())) return;
                const monthStart = new Date(viewYear, viewMonth, 1);
                const monthEnd = new Date(viewYear, viewMonth + 1, 0);
                const selected = selectedDay ? new Date(selectedDay + 'T00:00:00') : monthStart;
                const today = new Date(todayStr + 'T00:00:00');
                const ranges = [[monthStart, monthEnd], [selected, selected], [today, today]];
                const seen = new Set<string>();
                for (const [rangeStart, rangeEnd] of ranges) {
                    const curr = new Date(Math.max(start.getTime(), rangeStart.getTime()));
                    curr.setHours(0, 0, 0, 0);
                    const stop = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
                    stop.setHours(0, 0, 0, 0);
                    while (curr.getTime() <= stop.getTime()) {
                        const key = toDateStr(curr.getFullYear(), curr.getMonth() + 1, curr.getDate());
                        if (seen.has(key)) { curr.setDate(curr.getDate() + 1); continue; }
                        seen.add(key);
                        const dow = curr.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        // Agenda hanya dilewati kalau harinya benar-benar libur untuk
                        // seluruh madrasah — libur sebagian kelas tidak membatalkan agenda.
                        const isHoliday = (holidayMap[key] || []).some(isLiburPenuhSekolah);
                        if (!(a.skip_hari_libur && (isWeekend || isHoliday))) {
                            if (!map[key]) map[key] = [];
                            map[key].push(a);
                        }
                        curr.setDate(curr.getDate() + 1);
                    }
                }
            } catch (err) { }
        });
        return map;
    }, [effectiveAgendas, holidayMap, viewYear, viewMonth, selectedDay, todayStr]);

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const goToday = () => {
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
        setSelectedDay(todayStr);
        setActiveTab('selected');
    };

    const displayDay = selectedDay || todayStr;
    const [displayY, displayM, displayD] = displayDay.split("-").map(Number);

    // Filter events for sidebar
    const ongoingEvents = useMemo(() => eventMap[todayStr] || [], [eventMap, todayStr]);

    const upcomingEvents = useMemo(() => {
        return effectiveAgendas
            .filter(a => a.tanggal_mulai > todayStr)
            .sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai))
            .slice(0, 6);
    }, [effectiveAgendas, todayStr]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!mounted) return <div style={{ minHeight: '600px' }} />;

    return (
        <div className="ag-root">
            {/* Page Banner */}
            
            {headerTabs}

            <div className="ag-main-layout">
                {/* Calendar Card */}
                <div className="ag-card ag-calendar-container">
                    <div className="ag-cal-header">
                        <div className="ag-cal-nav">
                            <button className="ag-nav-btn" onClick={prevMonth} aria-label="Bulan sebelumnya">
                                <i className="bi bi-chevron-left"></i>
                            </button>
                            <span className="ag-month-name">{BULAN_LABELS[viewMonth]}</span>
                            <button className="ag-nav-btn" onClick={nextMonth} aria-label="Bulan selanjutnya">
                                <i className="bi bi-chevron-right"></i>
                            </button>
                        </div>
                        <span className="ag-year-display">{viewYear}</span>
                    </div>

                    <div className="ag-calendar-body">
                        <div className="ag-weekdays">
                            {HARI_LABELS.map(d => (
                                <div key={d} className={`ag-weekday ${d === "Min" || d === "Sab" ? "is-weekend-header" : ""}`}>{d}</div>
                            ))}
                        </div>

                        <div className="ag-grid">
                            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                                <div key={`e-${i}`} className="ag-cell is-empty" />
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = toDateStr(viewYear, viewMonth + 1, day);
                                const isToday = dateStr === todayStr;
                                const isSelected = dateStr === selectedDay;
                                const currentDayEvents = eventMap[dateStr] || [];
                                const hasEvent = currentDayEvents.length > 0;
                                const holidayList = holidayMap[dateStr] || [];
                                const isHoliday = holidayList.length > 0;
                                const isFullHoliday = holidayList.some(isLiburPenuhSekolah);
                                const isPartialHoliday = isHoliday && !isFullHoliday;
                                // Ungu hanya bila SEMUA libur penuh di tanggal itu cuti bersama;
                                // bertumpuk dengan libur nasional → tetap merah.
                                const isCutiBersamaDay = isFullHoliday &&
                                    holidayList.filter(isLiburPenuhSekolah).every(h => isCutiBersama(h.nama));
                                const dow = (firstDayOfWeek + i) % 7;
                                const isWeekend = dow === 0 || dow === 6; // 0 = Sunday, 6 = Saturday

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        className={`ag-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isFullHoliday ? 'is-full-holiday' : ''} ${isPartialHoliday ? 'is-partial-holiday' : ''} ${isCutiBersamaDay ? 'is-cuti-bersama' : ''} ${isWeekend ? 'is-weekend' : ''} ${hasEvent ? 'has-event' : ''}`}
                                        onClick={() => {
                                            setSelectedDay(dateStr);
                                            setActiveTab('selected');
                                        }}
                                    >
                                        <span className="ag-day-number">{day}</span>
                                        {hasEvent && (
                                            <div className="ag-event-dots">
                                                {currentDayEvents.slice(0, 3).map((ev, ei) => (
                                                    <span key={ei} className="ag-dot" style={{ backgroundColor: ev.warna }} />
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="ag-calendar-footer">
                        <div className="ag-legend">
                            <div className="ag-legend-item"><span className="ag-legend-box is-active-box" /> <span>Hari Aktif</span></div>
                            <div className="ag-legend-item"><span className="ag-legend-box is-partial-box" /> <span>PBM tidak efektif</span></div>
                            <div className="ag-legend-item"><span className="ag-legend-box is-holiday-box" /> <span>Hari Libur</span></div>
                            <div className="ag-legend-item"><span className="ag-legend-box is-cuti-box" /> <span>Cuti Bersama</span></div>
                        </div>
                    </div>
                </div>

                {/* Details Panel */}
                <div className="ag-details-container">
                    <div className="ag-card ag-details-card">
                        <div className="ag-details-header" style={{ padding: (holidayMap[displayDay]?.length) ? '20px 24px' : '0', borderBottom: (holidayMap[displayDay]?.length) ? '1px solid var(--n-border, #e2e8f0)' : 'none' }}>
                            {(holidayMap[displayDay] || []).map((h, hi) => (
                                <div className={`ag-holiday-notice ${isCutiBersama(h.nama) ? 'is-cuti' : ''}`} key={hi}>
                                    <i className="bi bi-info-circle-fill"></i>
                                    <span>
                                        {h.nama}
                                        {normalizeJamKe(h.jam_ke) !== JAM_SEMUA ? ` (Jam ke-${h.jam_ke})` : ''}
                                        {normalizeLingkup(h) !== 'semua' ? ` — ${labelLingkup(h)}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="ag-details-content">
                            {loading ? (
                                <div className="ag-state-msg">
                                    <Spinner variant="buble" />
                                </div>
                            ) : error ? (
                                <div className="ag-state-msg error">
                                    <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '2rem', color: '#ef4444' }}></i>
                                    <p>{error}</p>
                                    <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Coba lagi</Button>
                                </div>
                            ) : (
                                <div className="ag-timeline">
                                    <div className="ag-timeline-tabs">
                                        <button className={`ag-tab-btn ${activeTab === 'selected' ? 'is-active' : ''}`} onClick={() => setActiveTab('selected')}>
                                            Terpilih {eventMap[displayDay]?.length > 0 && <span className="ag-badge">{eventMap[displayDay].length}</span>}
                                        </button>
                                        <button className={`ag-tab-btn ${activeTab === 'ongoing' ? 'is-active' : ''}`} onClick={() => setActiveTab('ongoing')}>
                                            Berlangsung {ongoingEvents.length > 0 && <span className="ag-badge">{ongoingEvents.length}</span>}
                                        </button>
                                        <button className={`ag-tab-btn ${activeTab === 'upcoming' ? 'is-active' : ''}`} onClick={() => setActiveTab('upcoming')}>
                                            Mendatang {upcomingEvents.length > 0 && <span className="ag-badge">{upcomingEvents.length}</span>}
                                        </button>
                                    </div>

                                    {/* Section: Selected Day Events */}
                                    {activeTab === 'selected' && (
                                        eventMap[displayDay]?.length > 0 ? (
                                            <div className="ag-timeline-section is-selected">
                                                <div className="ag-section-title is-selected">
                                                    <i className="bi bi-calendar-event"></i>
                                                    <span>{displayD} {BULAN_LABELS[displayM - 1]} {displayY}</span>
                                                </div>
                                                {eventMap[displayDay].map(ev => {
                                                    const isExpanded = expandedEventId === ev.id;
                                                    return (
                                                        <div key={ev.id} className="ag-mini-event-wrapper">
                                                            <div 
                                                                className={`ag-mini-event ${isExpanded ? 'is-expanded' : ''}`} 
                                                                onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                                                            >
                                                                <span className="ag-mini-dot" style={{ backgroundColor: ev.warna }} />
                                                                <div className="ag-mini-info">
                                                                    <span className="ag-mini-title">{ev.judul}</span>
                                                                    <SasaranAgenda sasaran={ev.sasaran} />
                                                                    <span className="ag-mini-date">{agendaSchedule(ev)}</span>
                                                                </div>
                                                                <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} ag-mini-arrow`}></i>
                                                            </div>
                                                            {isExpanded && (
                                                                <div style={{ marginTop: '8px' }}>
                                                                    <EventCard event={ev} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="ag-empty-state">
                                                <i className="bi bi-calendar-x ag-empty-icon"></i>
                                                <p>Belum ada agenda terjadwal pada <br/><strong>{displayD} {BULAN_LABELS[displayM - 1]} {displayY}</strong>.</p>
                                            </div>
                                        )
                                    )}

                                    {/* Section: Ongoing Events */}
                                    {activeTab === 'ongoing' && (
                                        ongoingEvents.length > 0 ? (
                                            <div className="ag-timeline-section is-ongoing">
                                                <div className="ag-section-title is-ongoing">
                                                    <i className="bi bi-activity"></i> Sedang Berlangsung
                                                </div>
                                                {ongoingEvents.map(ev => {
                                                    const isExpanded = expandedEventId === ev.id;
                                                    return (
                                                        <div key={ev.id} className="ag-mini-event-wrapper">
                                                            <div 
                                                                className={`ag-mini-event ${isExpanded ? 'is-expanded' : ''}`} 
                                                                onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                                                            >
                                                                <span className="ag-mini-dot" style={{ backgroundColor: ev.warna }} />
                                                                <div className="ag-mini-info">
                                                                    <span className="ag-mini-title">{ev.judul}</span>
                                                                    <SasaranAgenda sasaran={ev.sasaran} />
                                                                    <span className="ag-mini-date">{agendaSchedule(ev)}</span>
                                                                </div>
                                                                <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} ag-mini-arrow`}></i>
                                                            </div>
                                                            {isExpanded && (
                                                                <div style={{ marginTop: '8px' }}>
                                                                    <EventCard event={ev} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="ag-empty-state">
                                                <i className="bi bi-calendar-x ag-empty-icon"></i>
                                                <p>Tidak ada agenda yang sedang berlangsung.</p>
                                            </div>
                                        )
                                    )}

                                    {/* Section: Upcoming Events */}
                                    {activeTab === 'upcoming' && (
                                        upcomingEvents.length > 0 ? (
                                            <div className="ag-timeline-section is-upcoming">
                                                <div className="ag-section-title is-upcoming">
                                                    <i className="bi bi-fast-forward-fill"></i> Kegiatan Mendatang
                                                </div>
                                                {upcomingEvents.map(ev => (
                                                    <div key={ev.id} className="ag-mini-event" onClick={() => {
                                                        setSelectedDay(ev.tanggal_mulai);
                                                        setActiveTab('selected');
                                                    }}>
                                                        <span className="ag-mini-dot" style={{ backgroundColor: ev.warna }} />
                                                        <div className="ag-mini-info">
                                                            <span className="ag-mini-title">{ev.judul}</span>
                                                                    <SasaranAgenda sasaran={ev.sasaran} />
                                                            <span className="ag-mini-date">{agendaSchedule(ev)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="ag-empty-state">
                                                <i className="bi bi-calendar-x ag-empty-icon"></i>
                                                <p>Tidak ada kegiatan mendatang.</p>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
}

function EventCard({ event }: { event: AgendaItem }) {
    const kat = event.kategori?.charAt(0).toUpperCase() + event.kategori?.slice(1).toLowerCase();
    const config = KATEGORI_CONFIG[kat] || KATEGORI_CONFIG["Lainnya"];
    const fotos = Array.isArray(event.foto) ? event.foto.filter(f => f && f.url) : [];
    
    const fotosByDate = fotos.reduce((acc, f) => {
        const date = f.tanggal || event.tanggal_mulai;
        if (!acc[date]) acc[date] = [];
        acc[date].push(f);
        return acc;
    }, {} as Record<string, typeof fotos>);
    const dateKeys = Object.keys(fotosByDate).sort();

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [showDescModal, setShowDescModal] = useState(false);
    const isLongDesc = event.deskripsi && event.deskripsi.length > 150;
    
    return (
        <>
            <div className="ag-event-card" style={{ '--accent': event.warna } as any}>
            <div className="ag-ev-header">
                <span className="ag-ev-badge" style={{ '--badge-bg': config.bg, color: event.warna } as any}>
                    {config.emoji} {event.kategori}
                </span>
            </div>
            <h4 className="ag-ev-title">{event.judul}</h4>
            <SasaranAgenda sasaran={event.sasaran} />
            
            {event.deskripsi && (
                <div className="ag-ev-desc-wrapper">
                    <p className={`ag-ev-desc ${isLongDesc ? 'is-truncated' : ''}`}>{event.deskripsi}</p>
                    {isLongDesc && (
                        <button className="ag-read-more" onClick={() => setShowDescModal(true)}>
                            Baca selengkapnya
                        </button>
                    )}
                </div>
            )}
            
            {showDescModal && (
                <DescModal title={event.judul} description={event.deskripsi!} onClose={() => setShowDescModal(false)} />
            )}

            <div className="ag-ev-footer">
                {event.waktu_mulai && (
                    <div className="ag-ev-meta">
                        <i className="bi bi-clock"></i>
                        <span>{formatWaktuAgenda(event.waktu_mulai, event.waktu_selesai)}</span>
                    </div>
                )}
                {event.lokasi && (
                    <div className="ag-ev-meta">
                        <i className="bi bi-geo-alt"></i>
                        {event.lokasi.trim().toLowerCase().startsWith('http') ? (
                            <a href={event.lokasi.trim()} target="_blank" rel="noopener noreferrer" className="ag-ev-link">{event.lokasi}</a>
                        ) : (
                            <span>{event.lokasi}</span>
                        )}
                    </div>
                )}
            </div>
            
            {dateKeys.length > 0 && (
                <div className="ag-ev-galleries">
                    {dateKeys.map(date => {
                        const dayFotos = fotosByDate[date];
                        return (
                            <div key={date} className="ag-ev-gallery">
                                <div className="ag-gallery-label">
                                    <i className="bi bi-images"></i>
                                    <span>Dokumentasi {formatDate(date)}</span>
                                </div>
                                <div className="ag-gallery-thumbs" data-count={Math.min(dayFotos.length, 5)}>
                                    {dayFotos.slice(0, 5).map((f, i) => {
                                        const gIndex = fotos.findIndex(x => x.url === f.url);
                                        return (
                                            <button
                                                key={f.url}
                                                type="button"
                                                className="ag-thumb"
                                                onClick={() => setLightboxIndex(gIndex)}
                                                aria-label={f.caption || `Foto`}
                                            >
                                                <img src={f.url} alt={f.caption || `Dokumentasi`} loading="lazy" />
                                                {i === 4 && dayFotos.length > 5 && (
                                                    <div className="ag-thumb-more">+{dayFotos.length - 5}</div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {lightboxIndex !== null && (
                <Lightbox
                    fotos={fotos}
                    index={lightboxIndex}
                    title={event.judul}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={setLightboxIndex}
                />
            )}
        </div>

        </>
    );
}

function Lightbox({ fotos, index, title, onClose, onNavigate }: {
    fotos: AgendaFoto[];
    index: number;
    title: string;
    onClose: () => void;
    onNavigate: (i: number) => void;
}) {
    const total = fotos.length;
    const current = fotos[index];

    const prev = () => onNavigate((index - 1 + total) % total);
    const next = () => onNavigate((index + 1) % total);

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0 && total > 1) next();
            else if (diff < 0 && total > 1) prev();
        }
        setTouchStart(null);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [index, total, onClose, prev, next]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    const content = (
        <div className="ag-lightbox" onClick={onClose}>
            <div className="ag-lb-overlay"></div>
            <div className="ag-lb-content" onClick={e => e.stopPropagation()}
                 onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <div className="ag-lb-img-wrap">
                    <div className="ag-lb-img-container">
                        <img src={current.url} alt={current.caption || title} className="ag-lb-img" />
                        <div className="ag-lb-toolbar">
                            <button className="ag-lb-btn" onClick={toggleFullscreen} aria-label="Fullscreen">
                                <i className="bi bi-arrows-fullscreen"></i>
                            </button>
                            <button className="ag-lb-btn" onClick={onClose} aria-label="Tutup">
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        {total > 1 && (
                            <button className="ag-lb-nav is-prev" onClick={prev} aria-label="Foto sebelumnya">
                                <i className="bi bi-chevron-left"></i>
                            </button>
                        )}
                        {total > 1 && (
                            <button className="ag-lb-nav is-next" onClick={next} aria-label="Foto selanjutnya">
                                <i className="bi bi-chevron-right"></i>
                            </button>
                        )}
                    </div>
                    <div className="ag-lb-info">
                        <h5>{title}</h5>
                        {current.caption && <p>{current.caption}</p>}
                        {total > 1 && <span className="ag-lb-count">{index + 1} / {total}</span>}
                    </div>
                </div>
            </div>

        </div>
    );

    return createPortal(content, document.body);
}

function DescModal({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    const content = (
        <div className="ag-desc-overlay" onClick={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
            <div className="ag-desc-modal">
                <div className="ag-desc-header">
                    <h4>{title}</h4>
                    <button onClick={onClose} aria-label="Tutup"><i className="bi bi-x-lg"></i></button>
                </div>
                <div className="ag-desc-body">
                    {description.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                </div>
            </div>

        </div>
    );
    return createPortal(content, document.body);
}
