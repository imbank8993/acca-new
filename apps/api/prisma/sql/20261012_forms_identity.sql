-- Preserve legacy UUID identifiers while permitting modern public_users IDs.
-- Apply before deploying the Form identity changes. No records are deleted.
BEGIN;
-- Forms now use server-side JWT authorization. Legacy direct client access
-- must remain closed after identifiers cease to be UUIDs.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('custom_forms','custom_form_responses')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;
ALTER TABLE public.custom_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_form_responses ENABLE ROW LEVEL SECURITY;
-- The API database role must own these tables or have BYPASSRLS; browser roles
-- no longer query them directly. No rows or legacy identifiers are removed.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS table_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.contype='f' AND (
      (c.conrelid='public.custom_forms'::regclass AND a.attname='created_by') OR
      (c.conrelid='public.custom_form_responses'::regclass AND a.attname='user_id')
    )
  LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname); END LOOP;
END $$;
ALTER TABLE public.custom_forms ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE public.custom_form_responses ALTER COLUMN user_id TYPE text USING user_id::text;
CREATE INDEX IF NOT EXISTS idx_custom_forms_owner ON public.custom_forms(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_form_response_identity ON public.custom_form_responses(form_id,user_id);
COMMIT;
