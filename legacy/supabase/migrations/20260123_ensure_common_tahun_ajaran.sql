-- Ensure tahun_ajaran column exists in all Relationship tables
-- Sets a default value '2025/2026' for existing records that might be null

-- 1. Guru Asuh (Previously missing)
ALTER TABLE guru_asuh 
ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT DEFAULT '2025/2026';

-- 2. Guru Mapel (Ensure exists and has default)
ALTER TABLE guru_mapel 
ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT DEFAULT '2025/2026';

-- 3. Wali Kelas (Ensure exists)
ALTER TABLE wali_kelas 
ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT DEFAULT '2025/2026';

-- 4. Siswa Kelas (Ensure exists)
ALTER TABLE siswa_kelas 
ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT DEFAULT '2025/2026';

-- Optional: Update any NULL values to current default (if previous records were inserted without year)
UPDATE guru_asuh SET tahun_ajaran = '2025/2026' WHERE tahun_ajaran IS NULL;
UPDATE guru_mapel SET tahun_ajaran = '2025/2026' WHERE tahun_ajaran IS NULL;
UPDATE wali_kelas SET tahun_ajaran = '2025/2026' WHERE tahun_ajaran IS NULL;
UPDATE siswa_kelas SET tahun_ajaran = '2025/2026' WHERE tahun_ajaran IS NULL;

-- Add Indexes for performance (since we filter by year often)
CREATE INDEX IF NOT EXISTS idx_guru_asuh_tahun ON guru_asuh(tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_guru_mapel_tahun ON guru_mapel(tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_tahun ON wali_kelas(tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_tahun ON siswa_kelas(tahun_ajaran);
