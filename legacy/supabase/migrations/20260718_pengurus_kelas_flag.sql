-- Migration: Pengurus Kelas jadi data (Opsi A), bukan role manual di users.role
-- Created: 2026-07-18
--
-- Sebelumnya PENGURUS_KELAS diketik manual di users.role dan dibaca langsung oleh
-- RLS tugas_siswa. Kini penandanya adalah kolom siswa_kelas.is_pengurus, sehingga:
--   - otomatis kadaluarsa per tahun ajaran (ikut baris enrolment),
--   - role PENGURUS_KELAS diturunkan saat login (lib/auth.ts getDutyRoles),
--   - users.role berhenti membawa role tugas.
-- Lihat [[duty-role-derivation]].

-- 1. Kolom penanda + index parsial untuk lookup cepat saat menurunkan role.
ALTER TABLE siswa_kelas
  ADD COLUMN IF NOT EXISTS is_pengurus BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN siswa_kelas.is_pengurus IS
  'Penanda pengurus kelas. Sumber kebenaran akses tugas_siswa (menggantikan role PENGURUS_KELAS di users.role).';

CREATE INDEX IF NOT EXISTS idx_siswa_kelas_pengurus
  ON siswa_kelas(nisn) WHERE is_pengurus;

-- 2. Backfill: siapa pun yang sekarang PENGURUS_KELAS di users.role ditandai pada
--    baris enrolment tahun ajaran aktif miliknya, supaya tidak kehilangan akses.
UPDATE siswa_kelas sk SET is_pengurus = true
FROM users u, master_tahun_ajaran ta
WHERE (sk.nisn = u.nip OR sk.nisn = u.username)
  AND u.role LIKE '%PENGURUS_KELAS%'
  AND ta.is_active = true AND ta.tahun_ajaran = sk.tahun_ajaran
  AND sk.aktif = true;

-- 3. Helper: apakah user (auth uid) adalah pengurus kelas AKTIF di tahun berjalan.
--    SECURITY DEFINER agar bisa membaca users/siswa_kelas terlepas dari RLS-nya.
CREATE OR REPLACE FUNCTION is_active_pengurus(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN siswa_kelas sk ON (sk.nisn = u.nip OR sk.nisn = u.username)
    JOIN master_tahun_ajaran ta
      ON ta.tahun_ajaran = sk.tahun_ajaran AND ta.is_active = true
    WHERE u.auth_id = uid
      AND sk.is_pengurus = true
      AND sk.aktif = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_active_pengurus(uuid) TO authenticated;

-- 4. Policy RLS tugas_siswa untuk pengurus kelas.
--    CATATAN: SELECT untuk siswa SUDAH ditangani policy "Siswa can view tugas_siswa"
--    dari migrasi pembuatan tabel (20260414) — TIDAK dibuat ulang di sini.
--    Kita hanya mengganti policy TULIS (insert/update/delete) agar sumbernya
--    siswa_kelas.is_pengurus (via is_active_pengurus), bukan users.role.

-- Bersihkan policy pengurus versi lama maupun versi migrasi ini (idempoten).
DROP POLICY IF EXISTS "PengurusKelas can view tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "PengurusKelas can insert tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "PengurusKelas can update own tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "PengurusKelas can delete own tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "PengurusKelas can update tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "PengurusKelas can delete tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "Pengurus aktif insert tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "Pengurus aktif update tugas_siswa" ON tugas_siswa;
DROP POLICY IF EXISTS "Pengurus aktif delete tugas_siswa" ON tugas_siswa;

CREATE POLICY "Pengurus aktif insert tugas_siswa"
  ON tugas_siswa FOR INSERT
  TO authenticated
  WITH CHECK (is_active_pengurus(auth.uid()));

CREATE POLICY "Pengurus aktif update tugas_siswa"
  ON tugas_siswa FOR UPDATE
  TO authenticated
  USING (is_active_pengurus(auth.uid()));

CREATE POLICY "Pengurus aktif delete tugas_siswa"
  ON tugas_siswa FOR DELETE
  TO authenticated
  USING (is_active_pengurus(auth.uid()));
