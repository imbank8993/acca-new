-- Apply before deploying the Agenda audience changes. Existing agendas become Umum.
BEGIN;
ALTER TABLE public.agenda_akademik
  ADD COLUMN IF NOT EXISTS sasaran text[] NOT NULL DEFAULT ARRAY['UMUM']::text[];
ALTER TABLE public.agenda_akademik DROP CONSTRAINT IF EXISTS agenda_sasaran_valid;
ALTER TABLE public.agenda_akademik ADD CONSTRAINT agenda_sasaran_valid
  CHECK (cardinality(sasaran) > 0 AND sasaran <@ ARRAY['GURU','STAF','SISWA','UMUM']::text[]
    AND array_position(sasaran, NULL) IS NULL);
COMMIT;
