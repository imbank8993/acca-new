-- Migration: Add unique constraint to nilai_data for bulk upsert
-- Created: 2026-01-28

-- We need a unique constraint to allow Supabase/Postgres to handle UPSERT correctly.
-- Tagihan and materi_tp are part of the uniqueness because a student has different scores for different tasks in the same subject/materi.

ALTER TABLE nilai_data 
ADD CONSTRAINT unique_nilai_entry 
UNIQUE (nip, kelas, mapel, semester, nisn, jenis, tagihan, materi_tp);

-- Optional: Create a log table for grade changes (Audit Trail)
CREATE TABLE IF NOT EXISTS nilai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nilai_id UUID REFERENCES nilai_data(id),
    nip_reviser VARCHAR(255) NOT NULL,
    old_nilai NUMERIC(5, 2),
    new_nilai NUMERIC(5, 2),
    action VARCHAR(50), -- INSERT, UPDATE, DELETE
    created_at TIMESTAMPTZ DEFAULT NOW()
);
