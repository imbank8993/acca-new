const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('audit teardown removes triggers and storage without affecting business tables', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE TABLE public.business_rows(id serial PRIMARY KEY, value text);
      CREATE TABLE public.partitioned_rows(id int, bucket int) PARTITION BY RANGE(bucket);
      CREATE TABLE public.partitioned_rows_1 PARTITION OF public.partitioned_rows FOR VALUES FROM (0) TO (10);
      CREATE TABLE auth.users(id serial PRIMARY KEY, value text);
      CREATE TABLE public.audit_logs(id bigserial PRIMARY KEY);
      CREATE TABLE public.role_pages(page_id text);
      INSERT INTO public.role_pages(page_id) VALUES ('audit-log'), ('monitoring');
      CREATE FUNCTION public.acca_audit_redact(value jsonb, depth integer DEFAULT 0)
        RETURNS jsonb LANGUAGE sql AS $$ SELECT value $$;
      CREATE FUNCTION public.acca_capture_change()
        RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.audit_logs DEFAULT VALUES; RETURN NULL; END $$;
      CREATE FUNCTION public.acca_install_audit_triggers()
        RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
      CREATE TRIGGER acca_audit_row AFTER INSERT ON public.business_rows
        FOR EACH ROW EXECUTE FUNCTION public.acca_capture_change();
      CREATE TRIGGER acca_audit_row AFTER INSERT ON public.partitioned_rows
        FOR EACH ROW EXECUTE FUNCTION public.acca_capture_change();
      CREATE TRIGGER acca_audit_truncate AFTER TRUNCATE ON public.partitioned_rows_1
        FOR EACH STATEMENT EXECUTE FUNCTION public.acca_capture_change();
      CREATE TRIGGER acca_audit_row AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.acca_capture_change();
      INSERT INTO public.business_rows(value) VALUES ('before');
    `);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.audit_logs')).rows[0].count, 1);
    const sql = fs.readFileSync('apps/api/prisma/sql/20261111_remove_system_audit.sql', 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const state = (await db.query(`SELECT to_regclass('public.audit_logs') AS table_name,
      to_regprocedure('public.acca_capture_change()') AS capture,
      (SELECT count(*)::int FROM pg_trigger WHERE tgname LIKE 'acca_audit_%') AS triggers`)).rows[0];
    assert.equal(state.table_name, null);
    assert.equal(state.capture, null);
    assert.equal(state.triggers, 0);
    const redacted = (await db.query(`SELECT public.acca_redact_data('{"password":"secret","count":2}'::jsonb) AS value`)).rows[0].value;
    assert.deepEqual(redacted, { password: '[Disamarkan]', count: 2 });
    assert.deepEqual((await db.query('SELECT page_id FROM public.role_pages')).rows.map(row => row.page_id), ['monitoring']);
    await db.exec("INSERT INTO public.business_rows(value) VALUES ('after'); INSERT INTO auth.users(value) VALUES ('ok');");
    await db.exec('INSERT INTO public.partitioned_rows(id,bucket) VALUES (1,1)');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.business_rows')).rows[0].count, 2);
  } finally {
    await db.close();
  }
});
