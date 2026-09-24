'use client'

import React from 'react'
import { CalendarCheck, CalendarRange, CalendarX, MapPin } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import {
  JadwalHariIni, JadwalPekan, LiburSehariPenuh, SectionHeader, cariLiburPenuh,
  kolomJam, kolomNomor, kolomPukul, kolomTeks, type TampilanJadwal,
} from './parts'

interface JadwalPbmTabProps {
  jadwalHariIni: any[]
  jadwalMingguIni: any[]
  liburHariIni: any[]
  loadingJadwal: boolean
  getWeekOrder: () => string[]
  isToday: (hari: string) => boolean
}

const tampilan: TampilanJadwal = {
  columns: [
    kolomNomor,
    kolomJam('Jam'),
    kolomPukul,
    kolomTeks('Kelas', 'Kelas', item => item.kelas),
    kolomTeks('Ruangan', 'Ruang', item => item.ruang),
    kolomTeks('Mata Pelajaran', 'Mapel', item => item.mapel),
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
      <span className="db__timelineMapel">{item.mapel}</span>
    </>
  ),
}

const ikonJudul = { color: 'var(--n-primary)', display: 'inline', verticalAlign: 'middle' } as const

export default function JadwalPbmTab({
  jadwalHariIni,
  jadwalMingguIni,
  liburHariIni,
  loadingJadwal,
  getWeekOrder,
  isToday,
}: JadwalPbmTabProps) {
  const libur = cariLiburPenuh(liburHariIni)

  return (
    <div className="tjp">
      <div className="db__section">
        <SectionHeader
          icon={<CalendarCheck size={18} style={ikonJudul} />}
          judul="PBM Hari Ini"
          badge={`${jadwalHariIni.length} JP`}
        />

        {loadingJadwal ? (
          <div className="db__loading"><Spinner variant="trace" /></div>
        ) : libur ? (
          <LiburSehariPenuh libur={libur} jenis="PBM" />
        ) : jadwalHariIni.length > 0 ? (
          <JadwalHariIni rows={jadwalHariIni} tampilan={tampilan} />
        ) : (
          <div className="db__empty">
            <CalendarX size={32} />
            <p>Tidak ada jadwal</p>
          </div>
        )}
      </div>

      <div className="db__section">
        <SectionHeader
          icon={<CalendarRange size={18} style={ikonJudul} />}
          judul="PBM Pekan Ini"
          badge={`${jadwalMingguIni.length} JP`}
        />

        {jadwalMingguIni.length > 0 ? (
          <JadwalPekan
            rows={jadwalMingguIni}
            getWeekOrder={getWeekOrder}
            isToday={isToday}
            satuan="JP"
            tampilan={tampilan}
          />
        ) : (
          <div className="db__empty">
            <CalendarRange size={32} />
            <p>Tidak ada jadwal minggu ini</p>
          </div>
        )}
      </div>
    </div>
  )
}
