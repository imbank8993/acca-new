-- =====================================================
-- UTILITY: Truncate (Clear) Master Data Tables
-- USE WITH CAUTION: This will delete ALL data in master tables.
-- =====================================================

-- 1. Master Siswa (Cascade to relationships like guru_asuh, siswa_kelas if linked)
TRUNCATE TABLE master_siswa CASCADE;

-- 2. Master Guru (Cascade to guru_mapel, wali_kelas, guru_asuh)
TRUNCATE TABLE master_guru CASCADE;

-- 3. Master Mapel
TRUNCATE TABLE master_mapel CASCADE;

-- 4. Master Kelas
TRUNCATE TABLE master_kelas CASCADE;

-- 5. Master Waktu
TRUNCATE TABLE master_waktu CASCADE;

-- Optional: If you want to clear relationship tables explicitly too:
-- TRUNCATE TABLE siswa_kelas CASCADE;
-- TRUNCATE TABLE wali_kelas CASCADE;
-- TRUNCATE TABLE guru_asuh CASCADE;
-- TRUNCATE TABLE guru_mapel CASCADE;
