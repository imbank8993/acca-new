
'use client'
import React, { useState } from 'react'
import { FileText, ListChecks, Plus } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { catatanColor } from '../lib/catatan-color'
import type { KalenderAgenda } from '../types'

export interface KalenderCellProps {
  date: Date; isCurrentMonth: boolean; isToday: boolean; agendas: KalenderAgenda[]
  onAgendaClick: (id: number) => void; onCreateAgenda: (date: string) => void
}
export function KalenderCell({ date, isCurrentMonth, isToday, agendas, onAgendaClick, onCreateAgenda }: KalenderCellProps) {
  const [open, setOpen] = useState(false)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  const label = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const activate = () => agendas.length ? setOpen(true) : onCreateAgenda(dateStr)
  const icon = (item: KalenderAgenda) => item.jenis === 'list' ? <ListChecks size={13} /> : <FileText size={13} />
  return <>
    <div className={`note-calendar-cell${!isCurrentMonth ? ' note-calendar-cell--muted' : ''}${isToday ? ' note-calendar-cell--today' : ''}`}
      role="button" tabIndex={0} aria-label={`${label}, ${agendas.length} catatan`} onClick={activate}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate() } }}>
      <div className="note-calendar-cell__top"><span className="note-calendar-date">{date.getDate()}</span>
        {agendas.length > 0 && <span className="note-calendar-count">{agendas.length}</span>}</div>
      <div className="note-calendar-events">
        {agendas.slice(0,2).map(item => <button key={item.id} type="button" className="note-calendar-event"
          style={{ '--note-color': catatanColor(item.warna || 'default') } as React.CSSProperties}
          title={`${item.jenis === 'list' ? 'List' : 'Catatan'}: ${item.judul || 'Tanpa judul'}`}
          onClick={e => { e.stopPropagation(); onAgendaClick(item.id) }}>
          {icon(item)}<span>{item.judul || 'Tanpa judul'}</span></button>)}
        {agendas.length > 2 && <span className="note-calendar-more">+{agendas.length - 2} lainnya</span>}
      </div>
    </div>
    {open && <Modal open onClose={() => setOpen(false)} size="sm" labelledBy={`day-${dateStr}`}>
      <ModalHeader id={`day-${dateStr}`} title={label} subtitle={`${agendas.length} catatan pribadi`} icon="calendar3" onClose={() => setOpen(false)} />
      <ModalBody><div className="note-calendar-day-list">{agendas.map(item => <button type="button" key={item.id} onClick={() => { setOpen(false); onAgendaClick(item.id) }}>
        {icon(item)}<span><strong>{item.judul || 'Tanpa judul'}</strong><small>{item.jenis === 'list' ? 'List' : 'Catatan'}</small></span></button>)}</div></ModalBody>
      <ModalFooter><Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => { setOpen(false); onCreateAgenda(dateStr) }}>Catatan baru</Button></ModalFooter>
    </Modal>}
  </>
}
export default KalenderCell
