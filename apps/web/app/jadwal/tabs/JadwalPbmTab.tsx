'use client'

import React from 'react'
import { CalendarCheck, CalendarRange, CalendarX, MapPin } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { jumlahEfektif, liburPenuhJadwal, tandaiLibur } from '@/lib/jadwal-libur'
import {
  JadwalHariIni, JadwalPekan, LiburSehariPenuh, SectionHeader,
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
  jadwalHariIni: jadwalAsli,
  jadwalMingguIni: pekanAsli,
  liburHariIni,
  loadingJadwal,
  getWeekOrder,
  isToday,
}: JadwalPbmTabProps) {
  const libur = liburPenuhJadwal(jadwalAsli, liburHariIni)
  // Jam yang terkena libur kelas/tingkat tertentu tetap tampil, ditandai "tidak efektif".
  const jadwalHariIni = tandaiLibur(jadwalAsli, liburHariIni)
  const jadwalMingguIni = pekanAsli.map(row => isToday(row.hari) ? tandaiLibur([row], liburHariIni)[0] : row)

  return (
    <div className="tjp">
      <div className="db__section">
        <SectionHeader
          icon={<CalendarCheck size={18} style={ikonJudul} />}
          judul="PBM Hari Ini"
          badge={`${jumlahEfektif(jadwalHariIni)} JP`}
        />

        {loadingJadwal ? (
          <div className="db__loading"><Spinner variant="buble" /></div>
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
          badge={`${jumlahEfektif(jadwalMingguIni)} JP`}
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
