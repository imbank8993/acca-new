BEGIN;
ALTER TABLE public.catatan_pribadi DROP CONSTRAINT IF EXISTS catatan_pribadi_jenis_check;
ALTER TABLE public.catatan_pribadi ADD CONSTRAINT catatan_pribadi_jenis_check CHECK (jenis IN ('catatan', 'list', 'draft_agenda'));
COMMIT;
