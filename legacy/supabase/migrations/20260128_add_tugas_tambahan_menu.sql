-- Migration: Add Tugas Tambahan menu to users
-- Created: 2026-01-28
-- Description: Updates the pages column to include Tugas Tambahan menu items

-- 1. Update ADMIN users - add full access (Ploting & Laporan)
-- Parent: "Tugas Tambahan"
-- Children: "Laporan" -> TugasTambahan, "Ploting" -> AdminTugasTambahan
UPDATE users 
SET pages = pages || ',Tugas Tambahan>Laporan=TugasTambahan|Ploting=AdminTugasTambahan'
WHERE (role = 'ADMIN' OR roles::text ILIKE '%ADMIN%')
  AND pages NOT LIKE '%Tugas Tambahan%';

-- 2. Update GURU users - add Report access only
-- Item: "Tugas Tambahan" -> TugasTambahan
UPDATE users 
SET pages = pages || ',Tugas Tambahan=TugasTambahan'
WHERE (role = 'GURU' OR roles::text ILIKE '%GURU%')
  AND NOT (role = 'ADMIN' OR roles::text ILIKE '%ADMIN%')
  AND pages NOT LIKE '%Tugas Tambahan%';
