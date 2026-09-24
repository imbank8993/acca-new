-- Fix: Tambahkan 'Umum' ke CHECK constraint kelas
ALTER TABLE form_pendaftaran_kokurikuler
DROP CONSTRAINT IF EXISTS form_pendaftaran_kokurikuler_kelas_check;

ALTER TABLE form_pendaftaran_kokurikuler
ADD CONSTRAINT form_pendaftaran_kokurikuler_kelas_check
CHECK (kelas IN ('X', 'XI', 'Umum'));