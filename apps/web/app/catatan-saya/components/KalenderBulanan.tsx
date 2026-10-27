
'use client'
import React, { useMemo } from 'react'
import { ChevronLeft, ChevronRight, FileText, ListChecks, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCatatanKalender } from '../hooks/use-catatan-kalender'
import KalenderCell from './KalenderCell'
import type { KalenderAgenda } from '../types'
interface Props { onAgendaClick: (id: number) => void; onCreateAgenda: (date: string) => void }
export default function KalenderBulanan({ onAgendaClick, onCreateAgenda }: Props) {
  const { agendas, currentMonth, goNextMonth, goPrevMonth, goToday, loading, error, refreshKalender } = useCatatanKalender()
  const [year, month] = currentMonth.split('-').map(Number)
  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })
  const byDate = useMemo(() => {
    const result = new Map<string, KalenderAgenda[]>()
    for (const item of agendas) { const key = item.tanggal_agenda?.slice(0,10); if (key) result.set(key, [...(result.get(key) || []), item]) }
    return result
  }, [agendas])
  const cells = useMemo(() => {
    const first = (new Date(year, month - 1, 1).getDay() + 6) % 7
    const days = new Date(year, month, 0).getDate()
    return Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, index) => new Date(year, month - 1, index - first + 1))
  }, [year, month])
  return <section className="note-calendar" aria-label="Kalender catatan pribadi" aria-busy={loading}>
    <header className="note-calendar__header"><div className="note-calendar__identity"><span><CalendarDays size={22} /></span><div><h3>{monthTitle}</h3><p>{loading ? 'Memuat catatan...' : `${agendas.length} catatan bulan ini`}</p></div></div>
      <div className="note-calendar__nav"><Button variant="outline" size="sm" onClick={goToday}>Bulan ini</Button><Button variant="outline" size="sm" aria-label="Bulan sebelumnya" onClick={goPrevMonth}><ChevronLeft size={16} /></Button><Button variant="outline" size="sm" aria-label="Bulan berikutnya" onClick={goNextMonth}><ChevronRight size={16} /></Button></div></header>
    {error && <div className="catatan-home-error" role="alert">{error}<Button variant="outline" size="sm" onClick={refreshKalender}>Coba lagi</Button></div>}
    <div className="note-calendar__grid">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(day => <div className="note-calendar__weekday" key={day}>{day}</div>)}
      {cells.map(date => { const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; return <KalenderCell key={key} date={date} isCurrentMonth={date.getMonth()===month-1} isToday={key===today} agendas={byDate.get(key)||[]} onAgendaClick={onAgendaClick} onCreateAgenda={onCreateAgenda} /> })}
    </div>
    <footer className="note-calendar__footer"><div><span><FileText size={13} /> Catatan</span><span><ListChecks size={13} /> List</span></div><p>Klik tanggal kosong untuk menulis. Tanggal tanpa isian mengikuti tanggal pembuatan.</p></footer>
  </section>
}
