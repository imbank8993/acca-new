-- Drop existing constraint
ALTER TABLE absensi_sesi DROP CONSTRAINT absensi_sesi_hari_check;

-- Add new constraint including Sabtu and Minggu
ALTER TABLE absensi_sesi ADD CONSTRAINT absensi_sesi_hari_check 
CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'));
