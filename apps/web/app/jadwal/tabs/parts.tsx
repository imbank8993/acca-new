'use client'

/**
 * Potongan tampilan bersama untuk keempat tab jadwal (PBM guru, Piket guru,
 * PBM siswa, Piket siswa).
 *
 * Keempatnya menampilkan bentuk yang sama persis — kartu timeline di mobile,
 * tabel di desktop, dikelompokkan per hari — dan sebelumnya masing-masing
 * menyalin markup itu utuh. Yang benar-benar berbeda hanya daftar kolom
 * tabelnya dan isi sisi kanan kartu mobile, jadi keduanya dijadikan parameter.
 *
 * Nama kelas CSS sengaja dipertahankan apa adanya (`db__*` di jadwal.css).
 */

import React, { type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'

export interface KolomJadwal {
  /** Judul kolom di <thead>. */
  header: string
  thClass: string
  tdClass: string
  /** `idx` adalah nomor urut dalam kelompok yang sedang dirender. */
  cell: (item: any, idx: number) => ReactNode
}

export const Dash = () => <span className="db__tdDash">—</span>

/** Kolom "#" dan "Pukul" identik di semua tabel jadwal. */
export const kolomNomor: KolomJadwal = {
  header: '#',
  thClass: 'db__thNum',
  tdClass: 'db__tdNum',
  cell: (_item, idx) => idx + 1,
}

export const kolomPukul: KolomJadwal = {
  header: 'Pukul',
  thClass: 'db__thPukul',
  tdClass: 'db__tdPukul',
  cell: (item) => item.waktu_display || <Dash />,
}

export const kolomJam = (header: string, piket = false): KolomJadwal => ({
  header,
  thClass: 'db__thJam',
  tdClass: 'db__tdJam',
  cell: (item) => (
    <span className={`db__tdJamBadge${piket ? ' db__tdJamBadgePiket' : ''}`}>{item.jam_ke}</span>
  ),
})

export const kolomTeks = (
  header: string, kelasCss: 'Kelas' | 'Ruang' | 'Mapel' | 'Guru',
  ambil: (item: any) => ReactNode,
): KolomJadwal => ({
  header,
  thClass: `db__th${kelasCss}`,
  tdClass: `db__td${kelasCss}`,
  cell: (item) => ambil(item) || <Dash />,
})

function TabelJadwal({
  rows, columns, wrapClass, tableClass,
}: {
  rows: any[]
  columns: KolomJadwal[]
  wrapClass: string
  tableClass: string
}) {
  return (
    <div className={wrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            {columns.map(c => <th key={c.header} className={c.thClass}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => (
            <tr key={item.id ?? idx} className="db__jadwalTR">
              {columns.map(c => <td key={c.header} className={c.tdClass}>{c.cell(item, idx)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KartuTimeline({
  item, piket, children,
}: {
  item: any
  piket?: boolean
  children: ReactNode
}) {
  return (
    <div className="db__mingguRowTimeline">
      <div className="db__timelineLeft">
        <span className="db__timelineWaktu">{item.waktu_display || '-'}</span>
        <span className={`db__timelineJamBadge${piket ? ' db__timelineJamBadgePiket' : ''}`}>
          Jam {item.jam_ke}
        </span>
      </div>
      <div className="db__timelineDivider"></div>
      <div className="db__timelineRight">{children}</div>
    </div>
  )
}

export interface TampilanJadwal {
  columns: KolomJadwal[]
  /** Isi sisi kanan kartu mobile. */
  renderKartu: (item: any) => ReactNode
  piket?: boolean
}

/** Daftar satu hari (dipakai untuk blok "Hari Ini"). */
export function JadwalHariIni({ rows, tampilan }: { rows: any[]; tampilan: TampilanJadwal }) {
  return (
    <div className="db__jadwalWrapper">
      <div className="db__jadwalCardsMobile">
        {rows.map((item, idx) => (
          <KartuTimeline key={item.id ?? idx} item={item} piket={tampilan.piket}>
            {tampilan.renderKartu(item)}
          </KartuTimeline>
        ))}
      </div>
      <TabelJadwal
        rows={rows}
        columns={tampilan.columns}
        wrapClass="db__jadwalTableWrap"
        tableClass="db__jadwalTable"
      />
    </div>
  )
}

/**
 * Daftar sepekan, dikelompokkan per hari mengikuti `getWeekOrder()`.
 * `rows` diharapkan sudah terurut (hari lalu jam) oleh pemanggilnya.
 */
export function JadwalPekan({
  rows, getWeekOrder, isToday, satuan, tampilan,
}: {
  rows: any[]
  getWeekOrder: () => string[]
  isToday: (hari: string) => boolean
  /** Satuan pada penghitung tiap hari, mis. "JP" atau "jam". */
  satuan: string
  tampilan: TampilanJadwal
}) {
  return (
    <div className="db__jadwalMingguWrap">
      {getWeekOrder().map(hari => {
        const isiHari = rows.filter(j => j.hari === hari)
        if (isiHari.length === 0) return null
        const hariIni = isToday(hari)

        return (
          <div key={hari} className={`db__mingguDay ${hariIni ? 'db__mingguDayToday' : ''}`}>
            <div className="db__mingguDayHeader">
              <span className="db__mingguDayName">{hari}</span>
              {hariIni && <span className="db__mingguDayBadge">Hari Ini</span>}
              <span className="db__mingguDayCount">{isiHari.length} {satuan}</span>
            </div>
            <div className="db__mingguDayBody">
              <div className="db__mingguCardsMobile">
                {isiHari.map((item, idx) => (
                  <KartuTimeline key={item.id ?? idx} item={item} piket={tampilan.piket}>
                    {tampilan.renderKartu(item)}
                  </KartuTimeline>
                ))}
              </div>
              <TabelJadwal
                rows={isiHari}
                columns={tampilan.columns}
                wrapClass="db__mingguTableWrap"
                tableClass="db__mingguTable"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Header seragam tiap blok section. */
export function SectionHeader({
  icon, judul, badge, badgePiket,
}: {
  icon: ReactNode
  judul: string
  badge: string
  badgePiket?: boolean
}) {
  return (
    <div className="db__sectionHeader">
      <div className="db__sectionTitle">
        {icon}
        <h2>{judul}</h2>
      </div>
      <span className={`db__sectionBadge${badgePiket ? ' piket' : ''}`}>{badge}</span>
    </div>
  )
}

/**
 * Libur yang menutup seluruh hari (bukan libur per jam pelajaran), bila ada.
 * `jam_ke` kosong atau 'Semua' berarti sehari penuh.
 */
export const cariLiburPenuh = (liburHariIni: any[]) =>
  liburHariIni.find(l => !l.jam_ke || l.jam_ke === 'Semua')

/** Pemberitahuan hari libur sehari penuh. */
export function LiburSehariPenuh({ libur, jenis }: { libur: any; jenis: string }) {
  return (
    <div className="db__empty db__empty--libur">
      <CalendarDays className="db__liburIcon" />
      <h3 className="db__liburTitle">{libur.keterangan}</h3>
      <span className="db__liburDesc">Tidak ada jadwal {jenis} hari ini.</span>
    </div>
  )
}
