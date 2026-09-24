-- Migration: lebarkan ketidakhadiran.petugas_role
-- Tanggal: 2026-08-23
--
-- Masalah: kolom dibuat VARCHAR(50) di 20260121_create_ketidakhadiran.sql, saat
-- itu satu petugas hanya punya 1-2 role. Sekarang user bisa punya banyak role
-- sekaligus, mis. "GURU,ADMIN,WKM_AKADEMIK,WKM_KEASRAMAAN,WKM_KESISWAAN"
-- (52 karakter). Akibatnya setiap simpan/edit ketidakhadiran oleh user tersebut
-- gagal dengan Postgres 22001 "value too long for type character varying(50)",
-- dan UI hanya menampilkan "Gagal mengupdate data".
--
-- petugas_role murni catatan jejak (siapa yang menginput), tidak pernah dipakai
-- untuk filter/join, jadi TEXT lebih tepat daripada menaikkan batas panjangnya.

ALTER TABLE public.ketidakhadiran
  ALTER COLUMN petugas_role TYPE TEXT;

-- Tabel rekam_medis_siswa menulis petugas_role dari sumber yang sama.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rekam_medis_siswa'
      AND column_name = 'petugas_role'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE public.rekam_medis_siswa ALTER COLUMN petugas_role TYPE TEXT;
  END IF;
END $$;
