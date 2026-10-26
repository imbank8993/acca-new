import { liburBerlakuUntukKelas, liburMencakupJam, normalizeJamKe, JAM_SEMUA, type LiburRow, type KelasContext } from './libur'

interface JadwalRow extends KelasContext { hari?: string; jam_ke?: string | number | null }

/** Nilai tingkat dari master kelas didahulukan; nama kelas untuk data lama. */
function konteks(row: JadwalRow): KelasContext {
  const prefix = String(row.kelas ?? '').trim().toUpperCase().match(/^(XII|XI|X|VII|VIII|IX|10|11|12|7|8|9)(?=\s|[-.]|$)/)?.[1]
  const tingkat: Record<string, number> = { X: 10, XI: 11, XII: 12, VII: 7, VIII: 8, IX: 9 }
  return { kelas: row.kelas, tingkat: row.tingkat ?? (prefix ? tingkat[prefix] ?? prefix : undefined) }
}

export function jadwalTanpaLibur<T extends JadwalRow>(rows: T[], libur: LiburRow[]): T[] {
  return rows.filter(row => !libur.some(l => liburBerlakuUntukKelas(l, konteks(row)) && liburMencakupJam(l, row.jam_ke)))
}

/** Banner khusus kelas hanya boleh menggantikan daftar jika seluruh kelas libur. */
export function liburPenuhJadwal(rows: JadwalRow[], libur: LiburRow[]): LiburRow | undefined {
  const penuh = libur.filter(l => normalizeJamKe(l.jam_ke) === JAM_SEMUA)
  const global = penuh.find(l => liburBerlakuUntukKelas(l))
  if (global) return global
  if (!rows.length || !rows.every(row => penuh.some(l => liburBerlakuUntukKelas(l, konteks(row))))) return undefined
  return penuh.find(l => liburBerlakuUntukKelas(l, konteks(rows[0])))
}
