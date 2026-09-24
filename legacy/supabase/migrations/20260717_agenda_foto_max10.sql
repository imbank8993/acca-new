-- Migration: Naikkan batas foto dokumentasi agenda dari 5 menjadi 10
-- Menggantikan constraint chk_agenda_foto_max5 dari 20260716_add_foto_to_agenda.sql.
-- Jalankan manual via Supabase Dashboard > SQL Editor.

ALTER TABLE agenda_akademik
    DROP CONSTRAINT IF EXISTS chk_agenda_foto_max5;

ALTER TABLE agenda_akademik
    DROP CONSTRAINT IF EXISTS chk_agenda_foto_max10;

ALTER TABLE agenda_akademik
    ADD CONSTRAINT chk_agenda_foto_max10
    CHECK (jsonb_typeof(foto) = 'array' AND jsonb_array_length(foto) <= 10);
