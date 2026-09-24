'use client'

import React from 'react'
import { CalendarCheck, CalendarRange, MapPin } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import {
  JadwalHariIni, JadwalPekan, LiburSehariPenuh, SectionHeader, cariLiburPenuh,
  kolomJam, kolomNomor, kolomPukul, kolomTeks, type TampilanJadwal,
} from './parts'

interface JadwalPiketTabProps {
  jadwalPiketHariIni: any[]
  jadwalPiketMingguIni: any[]
  liburHariIni: any[]
  loadingPiket: boolean
  getWeekOrder: () => string[]
  isToday: (hari: string) => boolean
}

const tampilan: TampilanJadwal = {
  piket: true,
  columns: [
    kolomNomor,
    kolomJam('Jam'),
    kolomPukul,
    kolomTeks('Kelas', 'Kelas', item => item.kelas),
    kolomTeks('Ruangan', 'Ruang', item => item.ruang),
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
      <span className="db__timelineMapel">Tugas Piket</span>
    </>
  ),
}

const ikonJudul = { color: 'var(--n-primary)', display: 'inline', verticalAlign: 'middle' } as const

const KosongPiket = () => (
  <div className="db__empty db__empty--piket">
    <CalendarCheck size={32} />
    <p>Tidak ada jadwal</p>
  </div>
)

export default function JadwalPiketTab({
  jadwalPiketHariIni,
  jadwalPiketMingguIni,
  liburHariIni,
  loadingPiket,
  getWeekOrder,
  isToday,
}: JadwalPiketTabProps) {
  const libur = cariLiburPenuh(liburHariIni)

  return (
    <div className="tjp">
      <div className="db__section">
        <SectionHeader
          icon={<CalendarCheck size={18} style={ikonJudul} />}
          judul="Piket Hari Ini"
          badge={`${jadwalPiketHariIni.length} piket`}
          badgePiket
        />

        {loadingPiket ? (
          <div className="db__loading"><Spinner variant="trace" /></div>
        ) : libur ? (
          <LiburSehariPenuh libur={libur} jenis="Piket" />
        ) : jadwalPiketHariIni.length > 0 ? (
          <JadwalHariIni rows={jadwalPiketHariIni} tampilan={tampilan} />
        ) : (
          <KosongPiket />
        )}
      </div>

      <div className="db__section">
        <SectionHeader
          icon={<CalendarRange size={18} style={ikonJudul} />}
          judul="Piket Pekan Ini"
          badge={`${jadwalPiketMingguIni.length} piket`}
          badgePiket
        />

        {jadwalPiketMingguIni.length > 0 ? (
          <JadwalPekan
            rows={jadwalPiketMingguIni}
            getWeekOrder={getWeekOrder}
            isToday={isToday}
            satuan="jam"
            tampilan={tampilan}
          />
        ) : (
          <KosongPiket />
        )}
      </div>
    </div>
  )
}
