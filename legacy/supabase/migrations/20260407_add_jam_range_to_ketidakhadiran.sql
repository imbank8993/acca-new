-- Migration: Add jam_mulai and jam_selesai to ketidakhadiran for half-day support
-- Nullable integers: NULL = all hours (full day), 1-12 = specific hour range
-- Example: jam_mulai=1, jam_selesai=3 means only lesson hours 1-3 are affected

DO $$
BEGIN
    -- Check if columns exist, if not add them
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ketidakhadiran'
        AND column_name = 'jam_mulai'
    ) THEN
        ALTER TABLE ketidakhadiran ADD COLUMN jam_mulai INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ketidakhadiran'
        AND column_name = 'jam_selesai'
    ) THEN
        ALTER TABLE ketidakhadiran ADD COLUMN jam_selesai INTEGER;
    END IF;
END $$;

-- Add comments (COMMENT ON is idempotent, safe to run multiple times)
COMMENT ON COLUMN ketidakhadiran.jam_mulai IS 'Jam mulai ketidakhadiran. NULL = semua jam (full day). Contoh: 1 = jam 1, 7 = jam 7';
COMMENT ON COLUMN ketidakhadiran.jam_selesai IS 'Jam selesai ketidakhadiran. NULL = semua jam (full day). Contoh: 3 = jam 3, 12 = jam 12';
