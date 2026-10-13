// Targeted Form migration. Defaults to a transaction rolled back after checks.
// No credentials, records, or encryption keys are printed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env'), quiet: true });
const apply = process.argv.includes('--apply');
const tables = ['custom_forms', 'custom_form_responses'];
const migrationPath = path.join(__dirname, '../apps/api/prisma/sql/20261012_forms_identity.sql');
const digest = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

async function snapshot(client) {
  const data = {};
  for (const table of tables) {
    data[table] = (await client.query(`SELECT to_jsonb(t)::text AS record FROM public.${table} t ORDER BY id`)).rows.map(row => row.record);
  }
  const metadata = {};
  metadata.columns = (await client.query(`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1) ORDER BY table_name,ordinal_position`, [tables])).rows;
  metadata.constraints = (await client.query(`SELECT c.conrelid::regclass::text AS table_name,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c WHERE c.conrelid IN ('public.custom_forms'::regclass,'public.custom_form_responses'::regclass) ORDER BY c.conname`)).rows;
  metadata.indexes = (await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1) ORDER BY indexname`, [tables])).rows;
  metadata.policies = (await client.query(`SELECT * FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1) ORDER BY tablename,policyname`, [tables])).rows;
  metadata.grants = (await client.query(`SELECT * FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name=ANY($1)`, [tables])).rows;
  metadata.security = (await client.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid IN ('public.custom_forms'::regclass,'public.custom_form_responses'::regclass)`)).rows;
  return { data, metadata };
}

function backup(snapshotData) {
  const dir = path.join(__dirname, '../scratch/form-backups');
  fs.mkdirSync(dir, { recursive: true });
  const stem = new Date().toISOString().replace(/[:.]/g, '-') + '-form-identity';
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const payload = JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), migration: fs.readFileSync(migrationPath, 'utf8'), ...snapshotData });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const packed = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  const dataPath = path.join(dir, stem + '.enc');
  const keyPath = path.join(dir, stem + '.key');
  fs.writeFileSync(dataPath, packed, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(keyPath, key, { flag: 'wx', mode: 0o600 });
  const saved = fs.readFileSync(dataPath);
  const decipher = crypto.createDecipheriv('aes-256-gcm', fs.readFileSync(keyPath), saved.subarray(0, 12));
  decipher.setAuthTag(saved.subarray(12, 28));
  const recovered = Buffer.concat([decipher.update(saved.subarray(28)), decipher.final()]).toString('utf8');
  if (recovered !== payload) throw new Error('Backup verification failed');
  return { dataPath, keyPath };
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  let transaction = false;
  try {
    await client.connect();
    const identity = (await client.query(`SELECT current_database() AS database,current_user AS role,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass_rls`)).rows[0];
    if (!identity.bypass_rls) throw new Error('Database API role must bypass RLS for this migration');
    await client.query('BEGIN'); transaction = true;
    await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='60s'");
    await client.query('LOCK TABLE public.custom_forms,public.custom_form_responses IN ACCESS EXCLUSIVE MODE');
    const before = await snapshot(client);
    const backupPaths = apply ? backup(before) : null;
    const sql = fs.readFileSync(migrationPath, 'utf8').replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
    await client.query(sql);
    const after = await snapshot(client);
    if (digest(before.data) !== digest(after.data)) throw new Error('Form records changed unexpectedly');
    for (const [table, column] of [['custom_forms','created_by'], ['custom_form_responses','user_id']]) {
      if (!after.metadata.columns.some(c => c.table_name === table && c.column_name === column && c.data_type === 'text')) throw new Error('Identity type verification failed');
    }
    if (after.metadata.policies.length) throw new Error('Legacy policies still active');
    if (after.metadata.security.some(t => !t.relrowsecurity)) throw new Error('RLS not enabled');
    const identityFKs = before.metadata.constraints.filter(c => /FOREIGN KEY \((created_by|user_id)\)/.test(c.definition));
    for (const constraint of before.metadata.constraints.filter(c => !identityFKs.includes(c))) {
      if (!after.metadata.constraints.some(c => c.conname === constraint.conname && c.table_name === constraint.table_name && c.definition === constraint.definition)) throw new Error('Unrelated constraint changed');
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK'); transaction = false;
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run-rolled-back', database: identity.database, role: identity.role, counts: Object.fromEntries(tables.map(t => [t, before.data[t].length])), recordsUnchanged: true, identityTypes: 'text', legacyPoliciesRemoved: before.metadata.policies.length, identityForeignKeysRemoved: identityFKs.length, remainingConstraintsPreserved: true, backup: backupPaths }, null, 2));
  } catch (error) {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed; active transaction rolled back:', error.code || error.message);
    process.exitCode = 1;
  } finally { await client.end(); }
})();
