'use client'

import React from 'react'
import { CalendarCheck, CalendarRange, CalendarX, MapPin, Users } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import {
  JadwalHariIni, JadwalPekan, LiburSehariPenuh, SectionHeader, cariLiburPenuh,
  kolomJam, kolomNomor, kolomPukul, kolomTeks, type TampilanJadwal,
} from './parts'

interface JadwalSiswaPbmTabProps {
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
    kolomJam('JP'),
    kolomPukul,
    kolomTeks('Mata Pelajaran', 'Mapel', item => item.mapel),
    kolomTeks('Kelas', 'Kelas', item => item.kelas),
    kolomTeks('Ruangan', 'Ruang', item => item.ruang),
    kolomTeks('Guru', 'Guru', item => item.nama_guru || 'Guru'),
  ],
  renderKartu: (item) => (
    <>
      <span className="db__timelineKelas">{item.mapel || '-'}</span>
      <span className="db__timelineGuru">{item.nama_guru || 'Guru'}</span>
      <span className="db__timelineMeta">
        <span className="db__timelineMetaItem">
          <Users size={12} style={{ display: 'inline', marginRight: 2 }} /> {item.kelas}
        </span>
        {item.ruang && item.kelas !== item.ruang && (
          <span className="db__timelineMetaItem">
            <MapPin size={12} style={{ display: 'inline', marginRight: 2 }} /> {item.ruang}
          </span>
        )}
      </span>
    </>
  ),
}

export default function JadwalSiswaPbmTab({
  jadwalHariIni,
  jadwalMingguIni,
  liburHariIni,
  loadingJadwal,
  getWeekOrder,
  isToday,
}: JadwalSiswaPbmTabProps) {
  const libur = cariLiburPenuh(liburHariIni)

  return (
    <div className="tjp">
      {/* Hari ini didahulukan: urutan "Pekan Ini" mulai dari besok dan berakhir
          di hari ini, jadi tanpa blok ini siswa harus menggulir sampai bawah
          untuk melihat jadwal hari ini. */}
      <div className="db__section">
        <SectionHeader
          icon={<CalendarCheck size={18} style={{ color: 'var(--n-primary)', display: 'inline', verticalAlign: 'middle' }} />}
          judul="Jadwal Hari Ini"
          badge={`${jadwalHariIni.length} JP`}
        />

        {loadingJadwal ? (
          <div className="db__loading"><Spinner variant="trace" /></div>
        ) : libur ? (
          <LiburSehariPenuh libur={libur} jenis="pelajaran" />
        ) : jadwalHariIni.length > 0 ? (
          <JadwalHariIni rows={jadwalHariIni} tampilan={tampilan} />
        ) : (
          <div className="db__empty">
            <CalendarX size={32} />
            <p>Tidak ada jadwal hari ini</p>
          </div>
        )}
      </div>

      <div className="db__section">
        <SectionHeader
          icon={<CalendarRange size={18} style={{ display: 'inline', verticalAlign: 'middle' }} />}
          judul="Jadwal Minggu Ini"
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
