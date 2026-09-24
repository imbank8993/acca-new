-- Migration: Tautkan tugas_tambahan -> role fungsional
-- Created: 2026-07-18
--
-- Role fungsional (WALI_KELAS, PEMBINA_EKSKUL) sebelumnya diketik manual di
-- users.role sehingga tiap perubahan penugasan harus diikuti edit role user.
-- Kolom granted_role menjadikan tugas_tambahan satu-satunya sumber kebenaran:
-- role diturunkan otomatis saat login (lihat lib/auth.ts getDutyRoles) untuk
-- penugasan di tahun ajaran aktif.

ALTER TABLE tugas_tambahan
  ADD COLUMN IF NOT EXISTS granted_role VARCHAR(50);

COMMENT ON COLUMN tugas_tambahan.granted_role IS
  'Role fungsional yang diturunkan dari penugasan ini (mis. WALI_KELAS, PEMBINA_EKSKUL). Digabung ke roles user saat login untuk tahun ajaran aktif.';

-- Backfill baris yang sudah ada berdasarkan pola jabatan.
UPDATE tugas_tambahan SET granted_role = 'WALI_KELAS'
  WHERE granted_role IS NULL AND jabatan ILIKE 'wali kelas%';

UPDATE tugas_tambahan SET granted_role = 'PEMBINA_EKSKUL'
  WHERE granted_role IS NULL AND jabatan ILIKE 'pembina ekstrakurikuler%';

-- Lookup cepat saat menurunkan role per user.
CREATE INDEX IF NOT EXISTS idx_tugas_tambahan_nip_granted
  ON tugas_tambahan(nip, granted_role) WHERE granted_role IS NOT NULL;
