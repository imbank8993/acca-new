-- Migration: Per-role "flat" group display
-- Lets the "Akses Per Role" admin UI decide, per role AND per group, whether the
-- group's pages are shown grouped under a collapsible header (default) or listed
-- "flat" (rendered as top-level menu items without the group header).
--
-- This is a DISPLAY concern only — it never changes which pages a role can access
-- (that stays in role_pages). A row here means: "for this role, render this group
-- flat instead of grouped".

CREATE TABLE IF NOT EXISTS role_group_flat (
    role TEXT NOT NULL,        -- e.g. 'GURU', 'WALI_KELAS'
    group_key TEXT NOT NULL,   -- MenuGroupDef.key, e.g. 'beranda', 'akademik'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role, group_key)
);
CREATE INDEX IF NOT EXISTS idx_role_group_flat_role ON role_group_flat(role);

COMMENT ON TABLE role_group_flat IS
  'Per-role display flag: presence of (role, group_key) means that role shows the group flat (no group header) instead of grouped. Access stays in role_pages.';
