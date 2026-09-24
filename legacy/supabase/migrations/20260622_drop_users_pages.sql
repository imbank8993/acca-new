-- Migration: remove the legacy per-user `pages` column.
--
-- Access is now fully role-based: effective pages = union(role_pages for the
-- user's roles) + users.page_overrides. Nothing reads users.pages anymore.
--
-- PREREQUISITE: role_pages must already be seeded & verified (run
-- scripts/seed-role-pages.js first). Apply this LAST.

ALTER TABLE users DROP COLUMN IF EXISTS pages;
