-- Migration: Add Jurnal Guru menu to users
-- Created: 2026-01-27
-- Description: Updates the pages column to include Jurnal menu items

-- Jurnal Guru menu structure:
-- Main menu: "Jurnal" (parent with submenu)
-- Submenu items: 
--   - "Jurnal" (main viewing page - /jurnal)
--   - "Pengaturan Jurnal" (settings page - /jurnal/pengaturan)
-- Student form (/jurnal/form) is accessible via direct link, not in menu

-- 1. Update ADMIN users - add full Jurnal access
-- Note: Using actual route names that match the app/jurnal structure
UPDATE users 
SET pages = pages || ',Jurnal>Jurnal=jurnal|Pengaturan Jurnal=jurnal/pengaturan'
WHERE role = 'Admin' 
  AND pages NOT LIKE '%Jurnal%';

-- 2. Update GURU users - add view-only Jurnal access
UPDATE users 
SET pages = pages || ',Jurnal>Jurnal=jurnal'
WHERE role = 'Guru' 
  AND pages NOT LIKE '%Jurnal%';

-- 3. Update OP_Absensi users - add full Jurnal access (same as Admin)
UPDATE users 
SET pages = pages || ',Jurnal>Jurnal=jurnal|Pengaturan Jurnal=jurnal/pengaturan'
WHERE role = 'OP_Absensi' 
  AND pages NOT LIKE '%Jurnal%';

-- Note: The format is "ParentMenu>Label1=page1|Label2=page2"
-- This creates a dropdown menu "Jurnal" with two items:
--   - "Jurnal" links to /jurnal page (title: "Jurnal", page: "jurnal")
--   - "Pengaturan Jurnal" links to /jurnal/pengaturan page (title: "Pengaturan Jurnal", page: "jurnal/pengaturan")
