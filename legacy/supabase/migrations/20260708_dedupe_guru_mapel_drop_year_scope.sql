-- =====================================================
-- ACCA App: guru_mapel jadi daftar kompetensi tetap (bukan per tahun ajaran)
-- Konteks: guru_mapel selama ini mewajibkan tahun_ajaran+semester, sehingga admin harus
-- input ulang tiap tahun ajaran baru, dan Jadwal Guru (yang bergantung padanya) macet
-- sampai itu selesai. Keputusan: guru_mapel adalah fakta kompetensi/penugasan TETAP
-- ("guru X bisa mengajar Y"), bukan keputusan per-tahun seperti SK Wali Kelas. Jejak
-- historis (siapa mengajar apa, kapan) sudah tercatat lewat tanggal di jadwal_guru
-- (berlaku_mulai) dan jurnal_guru (tanggal per sesi) — jadi tidak ada yang hilang.
--
-- Aplikasi (route.ts) sudah diubah untuk berhenti memfilter/mewajibkan tahun_ajaran+semester.
-- Migrasi ini membereskan data LAMA: karena guru+mapel yang sama kemungkinan pernah
-- diinput ulang tiap tahun (re-entry tahunan), sekarang perlu disisakan HANYA satu baris
-- aktif per (nip, nama_mapel) — baris dari tahun paling baru yang dipertahankan, baris
-- lama dinonaktifkan (aktif=false, soft/reversible, TIDAK dihapus permanen).
-- =====================================================

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY nip, nama_mapel
               ORDER BY tahun_ajaran DESC NULLS LAST, id DESC
           ) AS rn
    FROM guru_mapel
    WHERE aktif = true
)
UPDATE guru_mapel
SET aktif = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- =====================================================
-- Verifikasi setelah menjalankan migrasi ini (opsional, jalankan terpisah):
--
-- SELECT nip, nama_mapel, COUNT(*) FROM guru_mapel
-- WHERE aktif = true GROUP BY nip, nama_mapel HAVING COUNT(*) > 1;
--
-- Harus mengembalikan 0 baris (tidak ada lagi duplikat aktif per guru+mapel).
-- =====================================================
