-- Hapus key sampah 'maintenance_' yang dibuat auto-create MaintenanceTab
-- dari id halaman kosong hasil scan (dashboard)/[...pageId] di /api/pages.
-- Scanner sudah diperbaiki agar id kosong tidak lagi didaftarkan.
-- Jalankan manual via Supabase Dashboard SQL Editor.

DELETE FROM site_settings WHERE key = 'maintenance_';
