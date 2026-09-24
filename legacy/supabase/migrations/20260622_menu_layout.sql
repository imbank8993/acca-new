-- Migration: Global, editable sidebar menu structure
-- Stores ONE JSON document describing the menu groups (label, icon, modes, pages).
-- This controls how pages are GROUPED/ORDERED in the sidebar. WHICH pages a user
-- sees is still decided by role_pages (access). Structure is global; access is per-role.
--
-- layout shape:
-- [ { "key": "...", "label": "...", "icon": "fa-...", "modes": ["guru","admin"], "pages": ["dashboard", ...] }, ... ]

CREATE TABLE IF NOT EXISTS menu_layout (
    id INT PRIMARY KEY DEFAULT 1,
    layout JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT menu_layout_singleton CHECK (id = 1)
);

COMMENT ON TABLE menu_layout IS
  'Single-row global sidebar menu structure (groups, order, mode tags). Access is still per-role via role_pages.';
