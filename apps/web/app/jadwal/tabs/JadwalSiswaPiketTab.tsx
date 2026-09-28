'use client'

import React from 'react'
import { CalendarCheck, CalendarRange, MapPin } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import {
  JadwalHariIni, JadwalPekan, LiburSehariPenuh, SectionHeader, cariLiburPenuh,
  kolomJam, kolomNomor, kolomPukul, kolomTeks, type TampilanJadwal,
} from './parts'

interface JadwalSiswaPiketTabProps {
  siswaPiketHariIni: any[]
  siswaPiketMingguIni: any[]
  liburHariIni: any[]
  loadingSiswaPiket: boolean
  getWeekOrder: () => string[]
  isToday: (hari: string) => boolean
}

const tampilan: TampilanJadwal = {
  piket: true,
  columns: [
    kolomNomor,
    kolomJam('JP', true),
    kolomPukul,
    kolomTeks('Kelas', 'Kelas', item =>
      !item.ruang || item.kelas === item.ruang ? item.kelas : `${item.kelas} (${item.ruang})`
    ),
    kolomTeks('Guru Piket', 'Guru', item => item.nama_guru || 'Guru Piket'),
  ],
  renderKartu: (item) => (
    <>
      <span className="db__timelineKelas">
        {item.kelas}
        {item.ruang && item.kelas !== item.ruang && (
          <span className="db__timelineRuang">
            <MapPin size={12} style={{ display: 'inline', marginRight: 2 }} /> {item.ruang}
          </span>
        )}
      </span>
      <span className="db__timelineGuru">{item.nama_guru || 'Guru Piket'}</span>
    </>
  ),
}

export default function JadwalSiswaPiketTab({
  siswaPiketHariIni,
  siswaPiketMingguIni,
  liburHariIni,
  loadingSiswaPiket,
  getWeekOrder,
  isToday,
}: JadwalSiswaPiketTabProps) {
  const libur = cariLiburPenuh(liburHariIni)

  return (
    <div className="tjp">
      <div className="db__section">
        <SectionHeader
          icon={<CalendarCheck size={18} style={{ color: 'var(--n-primary)', display: 'inline', verticalAlign: 'middle' }} />}
          judul="Piket Hari Ini"
          badge={`${siswaPiketHariIni.length} piket`}
          badgePiket
        />

        {loadingSiswaPiket ? (
          <div className="db__loading"><Spinner variant="buble" /></div>
        ) : libur ? (
          <LiburSehariPenuh libur={libur} jenis="piket" />
        ) : siswaPiketHariIni.length > 0 ? (
          <JadwalHariIni rows={siswaPiketHariIni} tampilan={tampilan} />
        ) : (
          <div className="db__empty db__empty--piket">
            <CalendarCheck size={32} />
            <p>Tidak ada piket hari ini</p>
          </div>
        )}
      </div>

      <div className="db__section">
        <SectionHeader
          icon={<CalendarRange size={18} style={{ color: 'var(--n-primary)', display: 'inline', verticalAlign: 'middle' }} />}
          judul="Pekan Ini"
          badge={`${siswaPiketMingguIni.length} piket`}
          badgePiket
        />

        {loadingSiswaPiket ? (
          <div className="db__loading"><Spinner variant="buble" /></div>
        ) : siswaPiketMingguIni.length > 0 ? (
          <JadwalPekan
            rows={siswaPiketMingguIni}
            getWeekOrder={getWeekOrder}
            isToday={isToday}
            satuan="piket"
            tampilan={tampilan}
          />
        ) : (
          <div className="db__empty db__empty--piket">
            <CalendarCheck size={32} />
            <p>Tidak ada jadwal</p>
          </div>
        )}
      </div>
    </div>
  )
}
