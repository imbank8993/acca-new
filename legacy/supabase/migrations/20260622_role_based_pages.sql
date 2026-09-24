-- Migration: Role-based page access
-- Adds a role -> pages mapping so a user's sidebar is derived from their roles
-- instead of being configured one user at a time.
--
-- Effective pages for a user =
--   UNION(role_pages.page_id for every role the user has)
--   + page_overrides.add
--   - page_overrides.remove

-- 1. role -> page mapping (the new source of truth for menus)
CREATE TABLE IF NOT EXISTS role_pages (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL,        -- e.g. 'GURU', 'WALI_KELAS', 'OP_JURNAL'
    page_id TEXT NOT NULL,     -- e.g. 'jurnal', 'agenda-madrasah'
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, page_id)
);
CREATE INDEX IF NOT EXISTS idx_role_pages_role ON role_pages(role);

-- 2. Per-user exceptions layered on top of role pages.
--    Shape: { "add": ["page-id", ...], "remove": ["page-id", ...] }
ALTER TABLE users ADD COLUMN IF NOT EXISTS page_overrides JSONB DEFAULT '{}'::jsonb;

COMMENT ON TABLE role_pages IS
  'Maps roles to page ids they unlock. Effective user pages = union(role_pages for all user roles) + page_overrides.add - page_overrides.remove';
COMMENT ON COLUMN users.page_overrides IS
  'Per-user page exceptions on top of role_pages: {"add":[...],"remove":[...]}';
