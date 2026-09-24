-- Migration: pindahkan tugas_siswa bulan Juli 2026 ke tahun ajaran 2026/2027
--
-- Latar: form tugas siswa dulu menyimpan tahun_ajaran secara hard-coded
-- ('2025/2026', semester 2), sehingga tugas yang dibuat mulai Juli 2026
-- (= awal tahun ajaran 2026/2027, semester Ganjil) ikut tertulis 2025/2026
-- dan hilang saat difilter per tahun ajaran.
--
-- Batas tahun ajaran mengikuti lib/date-utils.ts: Juli s.d. Juni.

UPDATE tugas_siswa
SET tahun_ajaran = '2026/2027',
    semester = 1,
    updated_at = NOW()
WHERE tanggal_mulai >= '2026-07-01'
  AND tanggal_mulai <= '2026-07-31'
  AND (tahun_ajaran IS DISTINCT FROM '2026/2027' OR semester IS DISTINCT FROM 1);
