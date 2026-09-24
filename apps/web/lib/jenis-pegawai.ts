/**
 * Guru dan Tendik tinggal di tabel yang sama (master_guru), dibedakan kolom
 * `jenis_pegawai`. Lihat supabase/migrations/20260908_add_jenis_pegawai_master_guru.sql
 * untuk alasannya (nip dipakai sebagai FK dan kunci join di banyak modul, jadi
 * memindah baris antar tabel akan memutus riwayat pegawai).
 */

export type JenisPegawai = 'GURU' | 'TENDIK'

export const JENIS_PEGAWAI_LABEL: Record<JenisPegawai, string> = {
    GURU: 'Guru',
    TENDIK: 'Tendik',
}

/** Baris lama bisa saja belum terisi; anggap guru, sesuai backfill migrasi. */
export function normalizeJenisPegawai(value: unknown): JenisPegawai {
    return String(value || '').trim().toUpperCase() === 'TENDIK' ? 'TENDIK' : 'GURU'
}

/**
 * Membaca query param `?jenis=`. Mengembalikan null bila pemanggil tidak
 * menyaring (atau menulis `all`), supaya query dibiarkan apa adanya.
 */
export function parseJenisPegawai(value: string | null): JenisPegawai | null {
    const raw = String(value || '').trim().toUpperCase()
    if (raw === 'GURU' || raw === 'TENDIK') return raw
    return null
}
