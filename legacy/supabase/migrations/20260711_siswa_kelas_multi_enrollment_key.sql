-- =====================================================
-- ACCA App: kunci unik siswa_kelas untuk multi-enrollment
-- Konteks: constraint lama (nisn, tahun_ajaran, semester) menolak siswa punya
-- lebih dari satu kelas per semester — padahal desain peminatan/UTBK
-- (lihat migrasi 20260707) memakai siswa_kelas multi-enrollment:
-- 1 kelas reguler + N kelompok peminatan/UTBK sebagai baris terpisah.
-- Gejala: "duplicate key value violates unique constraint
-- siswa_kelas_nisn_tahun_semester_key" saat assign siswa ke kelas kedua.
-- Diverifikasi 2026-07-11: tidak ada data duplikat (nisn,kelas,TA,sem),
-- jadi index baru aman dibuat tanpa pembersihan data.
-- =====================================================

ALTER TABLE siswa_kelas
    DROP CONSTRAINT IF EXISTS siswa_kelas_nisn_tahun_semester_key;

-- Kunci unik baru mengikutkan kelas, dan hanya berlaku untuk baris aktif:
-- hapus dari UI = soft delete (aktif=false), siswa harus bisa didaftarkan
-- ulang ke kelas yang sama tanpa bentrok dengan baris histori nonaktif.
CREATE UNIQUE INDEX IF NOT EXISTS idx_siswa_kelas_enrollment_key
    ON siswa_kelas (nisn, kelas, tahun_ajaran, semester)
    WHERE aktif;

COMMENT ON INDEX idx_siswa_kelas_enrollment_key IS
    'Satu baris aktif per (siswa, kelas, tahun ajaran, semester). Multi-enrollment antar kelas diizinkan (homeroom + peminatan/UTBK). Aturan "maks 1 kelas reguler per siswa" ditegakkan di aplikasi (isRegularClass di SiswaKelasTab), bukan di DB.';
