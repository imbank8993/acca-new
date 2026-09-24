-- Migration: Tambah kolom foto dokumentasi ke agenda_akademik
-- foto = array JSONB berisi objek { "url": string, "caption": string|null }
-- Maksimal 5 foto per agenda (dijaga constraint + validasi API).
-- Jalankan manual via Supabase Dashboard > SQL Editor.

ALTER TABLE agenda_akademik
    ADD COLUMN IF NOT EXISTS foto JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Jaga maksimal 5 foto di level database
ALTER TABLE agenda_akademik
    DROP CONSTRAINT IF EXISTS chk_agenda_foto_max5;

ALTER TABLE agenda_akademik
    ADD CONSTRAINT chk_agenda_foto_max5
    CHECK (jsonb_typeof(foto) = 'array' AND jsonb_array_length(foto) <= 5);
