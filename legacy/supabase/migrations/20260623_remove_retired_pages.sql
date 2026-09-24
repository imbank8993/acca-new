-- Migration: Remove retired page ids from role access
-- These pages were deleted or merged in the app (2026-06-23):
--   - manage-dokumen  → merged into unggah-dokumen (tab "Kelola")
--   - piket-input     → already a tab inside the Piket page
--   - dokumen-siswa   → ghost id (no component), removed
--   - kelola-kelas    → ghost id (no component), removed
--   - analisis-beban-kerja, reset-data, laporan-guru-asuh → pages removed
--
-- Leftover role_pages rows for these ids would otherwise surface a dead menu
-- item (group "Lainnya") that 404s. This deletes those grants. The combined
-- Dokumen page keeps id `unggah-dokumen`, so that id is intentionally NOT removed.
-- NOTE: /api/reset-data/* endpoints stay (used by the "Ganti Data Massal" tab).

DELETE FROM role_pages WHERE page_id IN (
  'manage-dokumen',
  'piket-input',
  'dokumen-siswa',
  'kelola-kelas',
  'analisis-beban-kerja',
  'reset-data',
  'laporan-guru-asuh'
);

-- Also drop any per-role "flat group" rows for groups that no longer exist
-- (defensive; harmless if none match).
DELETE FROM role_group_flat WHERE group_key IN (
  'analisis-beban-kerja',
  'reset-data',
  'laporan-guru-asuh'
);
