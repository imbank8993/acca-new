-- Migration: Add tugas_tambahan column to master_dropdown
-- Created: 2026-01-29
-- Description: Adds 'tugas_tambahan' column to master_dropdown table

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'master_dropdown' 
                   AND column_name = 'tugas_tambahan') THEN
        ALTER TABLE public.master_dropdown ADD COLUMN tugas_tambahan text;
    END IF;
END $$;

-- Seed Data for tugas_tambahan (using smart update to fill existing empty slots or insert new)
-- We'll use a temporary block to insert data safely
DO $$
DECLARE
    items text[] := ARRAY['Wali Kelas', 'Pembina Ekstrakurikuler', 'Kepala Laboratorium', 'Kepala Perpustakaan', 'Wakil Kepala Madrasah', 'Kepala Madrasah', 'Bendahara Madrasah'];
    item text;
    target_id bigint;
BEGIN
    FOREACH item IN ARRAY items
    LOOP
        -- Find first row where tugas_tambahan is null
        SELECT id INTO target_id FROM public.master_dropdown WHERE tugas_tambahan IS NULL ORDER BY id LIMIT 1;
        
        IF target_id IS NOT NULL THEN
            UPDATE public.master_dropdown SET tugas_tambahan = item WHERE id = target_id;
        ELSE
            INSERT INTO public.master_dropdown (tugas_tambahan) VALUES (item);
        END IF;
    END LOOP;
END $$;
