-- Add missing updated_at column to lckh_submissions table
-- Date: 2026-02-04

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lckh_submissions' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.lckh_submissions 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Copy existing values from last_update_at if it exists
        UPDATE public.lckh_submissions 
        SET updated_at = last_update_at 
        WHERE last_update_at IS NOT NULL;
    END IF;
END $$;

-- Create trigger to auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_lckh_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.lckh_submissions;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.lckh_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_lckh_submissions_updated_at();
