-- Add semester column to relationship tables
-- Tables: siswa_kelas, wali_kelas, guru_asuh, guru_mapel

-- 1. siswa_kelas
ALTER TABLE siswa_kelas 
ADD COLUMN IF NOT EXISTS semester TEXT DEFAULT 'Ganjil';

-- Update unique constraint for siswa_kelas to include semester
ALTER TABLE siswa_kelas DROP CONSTRAINT IF EXISTS siswa_kelas_nisn_tahun_ajaran_key;
ALTER TABLE siswa_kelas ADD CONSTRAINT siswa_kelas_nisn_tahun_semester_key UNIQUE (nisn, tahun_ajaran, semester);

-- 2. wali_kelas
ALTER TABLE wali_kelas 
ADD COLUMN IF NOT EXISTS semester TEXT DEFAULT 'Ganjil';

-- Update unique constraint for wali_kelas to include semester
ALTER TABLE wali_kelas DROP CONSTRAINT IF EXISTS wali_kelas_nama_kelas_tahun_ajaran_key;
ALTER TABLE wali_kelas ADD CONSTRAINT wali_kelas_kelas_tahun_semester_key UNIQUE (nama_kelas, tahun_ajaran, semester);

-- 3. guru_asuh
ALTER TABLE guru_asuh 
ADD COLUMN IF NOT EXISTS semester TEXT DEFAULT 'Ganjil';

-- 4. guru_mapel
ALTER TABLE guru_mapel 
ADD COLUMN IF NOT EXISTS semester TEXT DEFAULT 'Ganjil';

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_semester ON siswa_kelas(semester);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_semester ON wali_kelas(semester);
CREATE INDEX IF NOT EXISTS idx_guru_asuh_semester ON guru_asuh(semester);
CREATE INDEX IF NOT EXISTS idx_guru_mapel_semester ON guru_mapel(semester);
