const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function load(file, imports = {}, globals = {}) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
    }).outputText, { module, exports: module.exports, Date, AbortSignal, console, require: name => imports[name] || {}, ...globals });
    return module.exports;
}

const { withAuditContext, redactAuditValue } = load('packages/shared/src/audit-client.ts');

function fixture() {
    let actor;
    const rows = [], batches = [];
    const promise = execute => ({
        [Symbol.toStringTag]: 'PrismaPromise',
        requestTransaction() {},
        then(yes, no) { return Promise.resolve().then(execute).then(yes, no); },
    });
    const client = {
        items: {
            findMany: () => promise(() => rows.slice()),
            create: ({ data }) => promise(() => { const row = { ...data, actor }; rows.push(row); return row; }),
        },
        $queryRawUnsafe: (query, value) => promise(() => {
            if (query.includes('set_config')) { actor = JSON.parse(value); return [{ set_config: value }]; }
            return [{ actor }];
        }),
        async $transaction(input, options) {
            const start = rows.length;
            batches.push({ input, options });
            try {
                if (typeof input === 'function') return await input(client);
                for (const operation of input) assert.equal(typeof operation.requestTransaction, 'function', 'batch receives original Prisma promises');
                const results = [];
                for (const operation of input) results.push(await operation);
                return results;
            } catch (error) { rows.splice(start); throw error; }
            finally { actor = undefined; }
        },
    };
    return { client, rows, batches };
}

test('audit client preserves lazy writes and does not wrap model reads in transactions', async () => {
    const f = fixture(), client = withAuditContext(f.client, () => ({ user_name: 'Alice' }));
    assert.equal(withAuditContext(client, () => undefined), client);
    assert.equal((await client.items.findMany()).length, 0);
    assert.equal(f.batches.length, 0);
    const pending = client.items.create({ data: { id: 1 } });
    assert.equal(f.rows.length, 0);
    assert.equal((await pending).actor.user_name, 'Alice');
    assert.equal(f.batches.length, 1);
    assert.equal((await pending).id, 1);
    assert.equal(f.rows.length, 1, 'multiple awaits do not repeat the write');
});

test('audit client preserves batch ordering, native promises and transaction options', async () => {
    const f = fixture(), client = withAuditContext(f.client, () => ({ user_name: 'Bob' }));
    const result = await client.$transaction([
        client.items.create({ data: { id: 1 } }), client.items.create({ data: { id: 2 } }), client.items.findMany(),
    ], { isolationLevel: 'Serializable' });
    assert.deepEqual(result.slice(0, 2).map(row => row.id), [1, 2]);
    assert.equal(result[2].length, 2);
    assert(f.rows.every(row => row.actor.user_name === 'Bob'));
    assert.equal(f.batches.length, 1);
    assert.equal(f.batches[0].input.length, 4);
    assert.equal(f.batches[0].options.isolationLevel, 'Serializable');
});

test('audit client preserves interactive rollback and never leaks context to background writes', async () => {
    const f = fixture(), client = withAuditContext(f.client, () => ({ user_name: 'Carol' }));
    await assert.rejects(client.$transaction(async tx => {
        assert.equal((await tx.items.create({ data: { id: 1 } })).actor.user_name, 'Carol');
        throw Error('Rollback');
    }), /Rollback/);
    assert.equal(f.rows.length, 0);
    assert.equal(f.batches.length, 1);
    const background = withAuditContext(f.client, () => undefined);
    assert.equal((await background.items.create({ data: { id: 2 } })).actor, undefined);
    const result = await client.$queryRawUnsafe('SELECT actor');
    assert.equal(result[0].actor.user_name, 'Carol');
});

test('audit redaction hides nested and serialized credentials while preserving ordinary values', () => {
    const output = redactAuditValue({ password: 'private', active: true, amount: 20, config: JSON.stringify({ token: 'private', nested: { apiKey: 'private' } }), setting: { key: 'smtp_password', value: 'private' } });
    assert.equal(output.password, '[Disamarkan]');
    assert.equal(output.active, true);
    assert.equal(output.amount, 20);
    assert.equal(JSON.parse(output.config).nested.apiKey, '[Disamarkan]');
    assert.equal(output.setting.value, '[Disamarkan]');
    assert(!JSON.stringify(output).includes('private'));
});

test('Cloudflare explorer requires current administrator permissions before reading storage', async () => {
    for (const roles of [[], ['WKM_AKADEMIK'], ['ADMIN']]) {
        const { requireAuditAdmin } = load('apps/web/lib/audit-admin.ts', {
            'next/server': { NextResponse: { json: (body, init) => ({ body, ...init }) } },
            './app-jwt': { extractRequestToken: () => 'session' },
            './nest-api': { nestFetchAsUser: async () => ({ status: 200, body: { user: { role: 'ADMIN' }, access: { roles } } }) },
        });
        const response = await requireAuditAdmin({});
        assert.equal(response?.status || 200, roles.includes('ADMIN') ? 200 : 403);
    }
    for (const path of ['files/route.ts', 'files/content/route.ts']) {
        let storageCalls = 0;
        const denied = { status: 403 };
        const route = load('apps/web/app/api/audit-logs/' + path, {
            '@/lib/audit-admin': { requireAuditAdmin: async () => denied },
            '@/lib/audit-r2': { auditR2: () => { storageCalls++; throw Error('Must not read storage'); } },
        });
        assert.equal(await route.GET({}), denied);
        assert.equal(storageCalls, 0);
    }
});

test('system audit migration records atomic changes, masks credentials and covers direct partition truncation', async () => {
    const db = new PGlite();
    try {
        await db.exec(`CREATE SCHEMA auth;
            CREATE TABLE public.items(id serial PRIMARY KEY, label text, password text, settings text);
            CREATE TABLE auth.users(id int PRIMARY KEY, encrypted_password text);
            CREATE TABLE public.events(id int, part int, PRIMARY KEY(id,part)) PARTITION BY RANGE(part);
            CREATE TABLE public.events_part PARTITION OF public.events FOR VALUES FROM (0) TO (100);
            CREATE TABLE public.activity_logs(id int);`);
        const sql = fs.readFileSync('apps/api/prisma/sql/20261022_system_audit.sql', 'utf8');
        await db.exec(sql);
        await db.exec(sql); // Deployment retries are safe.
        await db.exec('BEGIN');
        await db.query("SELECT set_config('acca.audit_context',$1,true)", [JSON.stringify({ user_name: 'Alice', page: '/items', source: 'test' })]);
        await db.query('INSERT INTO public.items(label,password,settings) VALUES ($1,$2,$3)', ['first', 'private', JSON.stringify({ token: 'private' })]);
        await db.exec('COMMIT');
        let logs = (await db.query('SELECT * FROM public.audit_logs ORDER BY id')).rows;
        assert.equal(logs.length, 1);
        assert.equal(logs[0].user_name, 'Alice');
        assert.equal(logs[0].action, 'CREATE');
        assert.equal(logs[0].details.after.password, '[Disamarkan]');
        assert.equal(JSON.parse(logs[0].details.after.settings).token, '[Disamarkan]');
        assert(!JSON.stringify(logs).includes('private'));
        await db.exec("UPDATE items SET label='first'; UPDATE items SET label='second';");
        logs = (await db.query('SELECT * FROM audit_logs ORDER BY id')).rows;
        assert.equal(logs.length, 2, 'unchanged updates do not create log rows');
        assert.equal(logs[1].user_name, null, 'transaction context was cleared');
        assert.deepEqual(logs[1].details.changed_columns, ['label']);
        assert.equal(logs[1].details.before.label, 'first');
        assert.equal(logs[1].details.after.label, 'second');
        await db.exec("BEGIN; UPDATE items SET label='rolled back'; ROLLBACK;");
        assert.equal((await db.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n, 2);
        await db.exec("INSERT INTO auth.users VALUES (1,'private'); INSERT INTO activity_logs VALUES (1);");
        const auth = (await db.query("SELECT details FROM audit_logs WHERE entity='auth.users'")).rows[0];
        assert.equal(auth.details.values_hidden, true);
        assert.equal(auth.details.before, null);
        assert.equal(auth.details.after, null);
        await db.exec('INSERT INTO events VALUES (1,10); TRUNCATE events_part; DELETE FROM items;');
        assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity='public.events_part' AND details->>'operation'='TRUNCATE'")).rows[0].n, 1);
        assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity='public.items' AND action='DELETE'")).rows[0].n, 1);
        await db.exec("ALTER TABLE audit_logs ADD CONSTRAINT block_items CHECK(entity <> 'public.items') NOT VALID;");
        await assert.rejects(db.exec("INSERT INTO items(label) VALUES ('must roll back')"));
        assert.equal((await db.query('SELECT count(*)::int AS n FROM items')).rows[0].n, 0);
        await db.exec("BEGIN; SELECT set_config('acca.audit_context','{}',true); SET TRANSACTION READ ONLY; SELECT public.acca_audit_redact('{\"token\":\"private\"}'::jsonb); COMMIT;");
    } finally { await db.close(); }
});
