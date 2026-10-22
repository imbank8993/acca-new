BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY, user_id varchar(100), user_nip varchar(50), user_name varchar(100),
  user_role varchar(100), action varchar(50) NOT NULL, entity varchar(128) NOT NULL,
  entity_id varchar(256), details jsonb, ip_address varchar(64), user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ALTER COLUMN entity TYPE varchar(128), ALTER COLUMN entity_id TYPE varchar(256);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);

CREATE OR REPLACE FUNCTION public.acca_audit_redact(value jsonb, depth integer DEFAULT 0)
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
        ELSE public.acca_audit_redact(item.val, depth + 1) END);
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'array' THEN
    SELECT coalesce(jsonb_agg(public.acca_audit_redact(e.val, depth + 1) ORDER BY e.ord), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS e(val,ord) WHERE e.ord <= 50;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'string' THEN
    string_value := value #>> '{}';
    IF string_value ~ '^\s*[\[{]' THEN
      IF length(string_value) > 1000000 THEN RETURN to_jsonb('[JSON terlalu besar]'::text); END IF;
      BEGIN
        parsed_value := string_value::jsonb;
        RETURN to_jsonb(public.acca_audit_redact(parsed_value, depth + 1)::text);
      EXCEPTION WHEN data_exception THEN
        -- This is ordinary text rather than serialized JSON.
        NULL;
      END;
    END IF;
    IF length(string_value) > 4000 THEN RETURN to_jsonb(left(string_value, 4000) || '…'); END IF;
  END IF;
  RETURN value;
END $$;

CREATE OR REPLACE FUNCTION public.acca_capture_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor jsonb; before_row jsonb; after_row jsonb; columns_changed jsonb;
  identity_value text; pk jsonb; hidden boolean; operation text;
BEGIN
  actor := coalesce(nullif(current_setting('acca.audit_context', true), '')::jsonb, '{}'::jsonb);
  IF TG_OP <> 'TRUNCATE' THEN
    IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
    IF TG_OP = 'UPDATE' AND before_row IS NOT DISTINCT FROM after_row THEN RETURN NULL; END IF;
    SELECT coalesce(jsonb_agg(k ORDER BY k), '[]'::jsonb) INTO columns_changed
      FROM jsonb_object_keys(coalesce(after_row, before_row)) AS keys(k)
      WHERE TG_OP <> 'UPDATE' OR before_row->k IS DISTINCT FROM after_row->k;
    SELECT jsonb_object_agg(k, coalesce(after_row->k, before_row->k)) INTO pk
      FROM jsonb_array_elements_text(coalesce(nullif(TG_ARGV[0], ''), '[]')::jsonb) AS keys(k);
    identity_value := coalesce(after_row->>'id', before_row->>'id', public.acca_audit_redact(pk)::text);
  END IF;
  hidden := TG_TABLE_SCHEMA = 'auth';
  operation := CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'TRUNCATE' THEN 'DELETE' ELSE TG_OP END;
  INSERT INTO public.audit_logs(user_id,user_nip,user_name,user_role,action,entity,entity_id,details,ip_address,user_agent)
  VALUES (left(actor->>'user_id',100),left(actor->>'user_nip',50),left(actor->>'user_name',100),left(actor->>'user_role',100),
    operation,left(TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,128),left(identity_value,256),
    jsonb_build_object('source','database','application',coalesce(actor->>'source',session_user),
      'page',actor->>'page','schema',TG_TABLE_SCHEMA,'table',TG_TABLE_NAME,'operation',TG_OP,
      'changed_columns',columns_changed,'values_hidden',hidden,
      'before',CASE WHEN hidden THEN NULL ELSE public.acca_audit_redact(before_row) END,
      'after',CASE WHEN hidden THEN NULL ELSE public.acca_audit_redact(after_row) END),
    left(actor->>'ip_address',64),left(actor->>'user_agent',500));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.acca_install_audit_triggers()
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE item record; pk text; installed integer := 0;
BEGIN
  FOR item IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p') AND NOT c.relispartition
      AND c.relname NOT IN ('audit_logs','activity_logs','user_heartbeats','_prisma_migrations')
  LOOP
    SELECT coalesce(jsonb_agg(a.attname ORDER BY k.ord),'[]'::jsonb)::text INTO pk
      FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
      WHERE i.indrelid=item.oid AND i.indisprimary;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=item.oid AND tgname='acca_audit_row') THEN
      EXECUTE format('CREATE TRIGGER acca_audit_row AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.acca_capture_change(%L)',item.nspname,item.relname,pk);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=item.oid AND tgname='acca_audit_truncate') THEN
      EXECUTE format('CREATE TRIGGER acca_audit_truncate AFTER TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION public.acca_capture_change(%L)',item.nspname,item.relname,pk);
    END IF;
    installed := installed + 1;
  END LOOP;
  -- Row triggers are cloned from partitioned parents. Statement-level TRUNCATE
  -- triggers are not inherited when a partition is truncated directly.
  FOR item IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p') AND c.relispartition
      AND c.relname NOT IN ('audit_logs','activity_logs','user_heartbeats','_prisma_migrations')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=item.oid AND tgname='acca_audit_truncate') THEN
      EXECUTE format('CREATE TRIGGER acca_audit_truncate AFTER TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION public.acca_capture_change(%L)',item.nspname,item.relname,'[]');
    END IF;
    installed := installed + 1;
  END LOOP;
  RETURN installed;
END $$;
SELECT public.acca_install_audit_triggers();
COMMIT;
