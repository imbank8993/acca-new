'use client'

import React from 'react'
import { Tab } from '@/components/ui/Tab'
import JadwalSiswaPbmTab from './JadwalSiswaPbmTab'
import JadwalSiswaPiketTab from './JadwalSiswaPiketTab'

interface JadwalSiswaTabProps {
  activeSiswaTab: 'mengajar' | 'piket'
  setActiveSiswaTab: (tab: 'mengajar' | 'piket') => void
  jadwalHariIni: any[]
  jadwalMingguIni: any[]
  siswaPiketHariIni: any[]
  siswaPiketMingguIni: any[]
  liburHariIni: any[]
  loadingJadwal: boolean
  loadingSiswaPiket: boolean
  getWeekOrder: () => string[]
  isToday: (hari: string) => boolean
}

export default function JadwalSiswaTab({
  activeSiswaTab,
  setActiveSiswaTab,
  jadwalHariIni,
  jadwalMingguIni,
  siswaPiketHariIni,
  siswaPiketMingguIni,
  liburHariIni,
  loadingJadwal,
  loadingSiswaPiket,
  getWeekOrder,
  isToday
}: JadwalSiswaTabProps) {
  return (
    <>
      <Tab
        tabs={[
          { key: 'mengajar', label: 'Jadwal PBM', icon: 'calendar-check-fill' },
          { key: 'piket', label: 'Jadwal Piket', icon: 'shield-check' },
        ]}
        activeTab={activeSiswaTab}
        onChange={setActiveSiswaTab}
        ariaLabel="Tab Jadwal Siswa"
        variant="slider"
      />

      {activeSiswaTab === 'mengajar' && (
        <JadwalSiswaPbmTab
          jadwalHariIni={jadwalHariIni}
          jadwalMingguIni={jadwalMingguIni}
          liburHariIni={liburHariIni}
          loadingJadwal={loadingJadwal}
          getWeekOrder={getWeekOrder}
          isToday={isToday}
        />
      )}

      {activeSiswaTab === 'piket' && (
        <JadwalSiswaPiketTab
          siswaPiketHariIni={siswaPiketHariIni}
          siswaPiketMingguIni={siswaPiketMingguIni}
          liburHariIni={liburHariIni}
          loadingSiswaPiket={loadingSiswaPiket}
          getWeekOrder={getWeekOrder}
          isToday={isToday}
        />
      )}
    </>
  )
}
