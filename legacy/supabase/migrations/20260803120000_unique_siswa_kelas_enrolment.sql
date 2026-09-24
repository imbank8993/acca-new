-- =====================================================
-- Cegah baris enrolment kembar di siswa_kelas
--
-- Latar: mengeluarkan siswa dari kelas hanya soft delete (aktif=false).
-- Sebelum perbaikan di app/api/settings/siswa-kelas/route.ts, cek duplikat
-- pada jalur bulk menyaring aktif=true sehingga baris non-aktif tak terlihat
-- dan siswa yang dimasukkan kembali menghasilkan baris kembar.
-- 26 baris kembar sudah dibersihkan pada 3 Agustus 2026.
--
-- Jalankan manual lewat Supabase Dashboard -> SQL Editor.
-- Wajib bebas duplikat dulu; kalau tidak, CREATE UNIQUE INDEX akan gagal.
-- =====================================================

-- 1. Pastikan tidak ada duplikat tersisa (harus mengembalikan 0 baris)
SELECT nisn, kelas, tahun_ajaran, semester, COUNT(*) AS jumlah
FROM siswa_kelas
GROUP BY nisn, kelas, tahun_ajaran, semester
HAVING COUNT(*) > 1;

-- 2. Kunci kombinasinya. Satu siswa hanya boleh punya satu baris per
--    kelas + tahun ajaran + semester, terlepas dari status aktifnya:
--    baris non-aktif adalah jejak "pernah terdaftar", bukan enrolment kedua.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_siswa_kelas_enrolment
    ON siswa_kelas (nisn, kelas, tahun_ajaran, semester);
