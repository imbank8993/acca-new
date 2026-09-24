-- Migration: Create master_agenda_kategori table
-- Tabel untuk menyimpan kategori agenda akademik yang dinamis

CREATE TABLE IF NOT EXISTS master_agenda_kategori (
    id          BIGSERIAL PRIMARY KEY,
    nama        TEXT NOT NULL UNIQUE,
    color       TEXT NOT NULL DEFAULT '#3083FF',
    icon        TEXT NOT NULL DEFAULT 'bi-calendar-event',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with a default category
INSERT INTO master_agenda_kategori (nama, color, icon)
VALUES ('Umum', '#3083FF', 'bi-calendar-event')
ON CONFLICT (nama) DO NOTHING;

-- RLS: allow public read
ALTER TABLE master_agenda_kategori ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_read_agenda_kat" ON master_agenda_kategori
    FOR SELECT USING (true);

CREATE POLICY "allow_service_role_all_agenda_kat" ON master_agenda_kategori
    USING (true) WITH CHECK (true);
