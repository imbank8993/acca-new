-- Migration: Perbaiki TIPE kolom siswa_id di modul ekskul (uuid -> bigint)
-- Created: 2026-07-18
-- Konteks: `master_siswa.id` bertipe BIGINT (angka), tetapi ekskul_siswa.siswa_id
--   (dan ekskul_absensi.siswa_id) terlanjur dibuat UUID. Akibatnya insert peserta
--   SELALU gagal (bentrok tipe) — tabel ekskul_siswa kosong. Karena kosong,
--   tak ada data yg perlu diremap; cukup ubah tipe kolom agar cocok master_siswa.id.
--   Jalankan via Dashboard SQL Editor. Idempoten (bigint::text::bigint = no-op).

-- ekskul_siswa.siswa_id -> bigint (referensi ke master_siswa.id)
ALTER TABLE ekskul_siswa
    ALTER COLUMN siswa_id TYPE BIGINT USING siswa_id::text::bigint;

-- ekskul_absensi.siswa_id -> bigint (bila tabel sudah dibuat dgn uuid)
ALTER TABLE ekskul_absensi
    ALTER COLUMN siswa_id TYPE BIGINT USING siswa_id::text::bigint;

-- Catatan: TIDAK ada FK ke master_siswa (mengikuti pola ekskul_siswa yg asli),
-- agar fleksibel. Aplikasi menormalkan siswa_id = master_siswa.id via NISN.
