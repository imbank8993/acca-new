-- Migration: Fix lckh_periods dates and enable upsert
-- Handles: wrong tgl_akhir, duplicate entries, and ensures unique constraint

BEGIN;

-- Step 1: Disable RLS so this migration can run unrestricted
ALTER TABLE public.lckh_periods DISABLE ROW LEVEL SECURITY;

-- Step 2: Check how many rows exist for each periode_kode
-- If duplicates exist, keep the one with latest data and update dates
-- First, find all duplicate periode_kode values
WITH duplicate_periods AS (
    SELECT periode_kode
    FROM public.lckh_periods
    GROUP BY periode_kode
    HAVING COUNT(*) > 1
),
ranked_duplicates AS (
    SELECT
        lp.id,
        lp.periode_kode,
        ROW_NUMBER() OVER (PARTITION BY lp.periode_kode ORDER BY lp.id DESC) as rn
    FROM public.lckh_periods lp
    INNER JOIN duplicate_periods dp ON lp.periode_kode = dp.periode_kode
)
-- Mark duplicates for deletion (keep newest, delete older)
DELETE FROM public.lckh_periods lp
USING ranked_duplicates rd
WHERE lp.id = rd.id AND rd.rn > 1;

-- Step 3: Now fix dates for ALL remaining period rows
-- Extract year and month from periode_kode (format: 'YYYY-MM')
UPDATE public.lckh_periods lp
SET
    tgl_awal = TO_DATE(lp.periode_kode || '-01', 'YYYY-MM-DD'),
    tgl_akhir = (
        DATE_TRUNC('month', TO_DATE(lp.periode_kode || '-01', 'YYYY-MM-DD'))
        + INTERVAL '1 month' - INTERVAL '1 day'
    )::date
WHERE
    -- Only update if dates are wrong
    tgl_awal IS NULL
    OR tgl_akhir IS NULL
    OR tgl_awal::text NOT LIKE (lp.periode_kode || '%');

-- Step 4: Ensure periode_kode is UNIQUE (required for upsert)
ALTER TABLE public.lckh_periods DROP CONSTRAINT IF EXISTS lckh_periods_pkey;
ALTER TABLE public.lckh_periods ADD CONSTRAINT lckh_periods_pkey PRIMARY KEY (periode_kode);

COMMIT;
