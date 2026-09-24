-- Migration: Add effective date column to jadwal_guru
-- Created at: 2026-01-25
-- Description: Adds berlaku_mulai to support dynamic schedules.
-- Note: 'tahun' and 'bulan' are omitted as 'berlaku_mulai' is sufficient.

ALTER TABLE jadwal_guru
ADD COLUMN IF NOT EXISTS berlaku_mulai DATE DEFAULT CURRENT_DATE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_jadwal_berlaku ON jadwal_guru(berlaku_mulai);

COMMENT ON COLUMN jadwal_guru.berlaku_mulai IS 'Tanggal mulai berlakunya jadwal ini';
