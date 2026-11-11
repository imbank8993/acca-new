BEGIN;

-- Drop every trigger installed by the old system audit, including triggers
-- cloned onto partition tables. Match the trigger function, not table names.
DO $$
DECLARE item record;
BEGIN
  IF to_regprocedure('public.acca_capture_change()') IS NOT NULL THEN
    FOR item IN
      SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgfoid = to_regprocedure('public.acca_capture_change()')
        AND NOT t.tgisinternal
        AND t.tgparentid = 0
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', item.trigger_name, item.schema_name, item.table_name);
    END LOOP;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.acca_install_audit_triggers();
DROP FUNCTION IF EXISTS public.acca_capture_change();

-- The read-only table explorer still needs field masking after audit capture
-- is removed. Give that generic helper its own name before retiring the old one.
CREATE OR REPLACE FUNCTION public.acca_redact_data(value jsonb, depth integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE result jsonb; item record; protected_setting boolean; string_value text; parsed_value jsonb;
BEGIN
  IF value IS NULL THEN RETURN NULL; END IF;
  IF depth > 10 THEN RETURN to_jsonb('[Data terlalu dalam]'::text); END IF;
  IF jsonb_typeof(value) = 'object' THEN
    result := '{}'::jsonb;
    protected_setting := concat_ws(' ', value->>'key', value->>'name', value->>'setting_key') ~* '(password|passwd|secret|token|credential|private.?key|access.?key|api.?key|authorization|cookie|connection.?string|database.?url)';
    FOR item IN SELECT key, val FROM jsonb_each(value) AS e(key, val) LOOP
      result := result || jsonb_build_object(item.key, CASE
        WHEN item.key ~* '(password|passwd|secret|token|credential|private.?key|access.?key|api.?key|authorization|cookie|connection.?string|database.?url)'
          OR (protected_setting AND item.key IN ('value','data','setting_value')) THEN to_jsonb('[Disamarkan]'::text)
        ELSE public.acca_redact_data(item.val, depth + 1) END);
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'array' THEN
    SELECT coalesce(jsonb_agg(public.acca_redact_data(e.val, depth + 1) ORDER BY e.ord), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS e(val,ord) WHERE e.ord <= 50;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'string' THEN
    string_value := value #>> '{}';
    IF string_value ~ '^\s*[\[{]' THEN
      IF length(string_value) > 1000000 THEN RETURN to_jsonb('[JSON terlalu besar]'::text); END IF;
      BEGIN
        parsed_value := string_value::jsonb;
        RETURN to_jsonb(public.acca_redact_data(parsed_value, depth + 1)::text);
      EXCEPTION WHEN data_exception THEN
        NULL;
      END;
    END IF;
    IF length(string_value) > 4000 THEN RETURN to_jsonb(left(string_value, 4000) || '…'); END IF;
  END IF;
  RETURN value;
END $$;

DROP FUNCTION IF EXISTS public.acca_audit_redact(jsonb, integer);
DROP TABLE IF EXISTS public.audit_logs;

-- Remove stale menu permissions for the retired page.
DO $$
BEGIN
  IF to_regclass('public.role_pages') IS NOT NULL THEN
    DELETE FROM public.role_pages WHERE page_id = 'audit-log';
  END IF;
END $$;

COMMIT;
