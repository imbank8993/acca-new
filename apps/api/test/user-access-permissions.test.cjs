const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const noopDecorator = () => () => {};
const common = new Proxy({ Logger: class { error() {} warn() {} }, ServiceUnavailableException: class extends Error {}, BadRequestException: class extends Error {}, NotFoundException: class extends Error {}, ForbiddenException: class extends Error {} }, { get: (target, key) => target[key] || noopDecorator });
function load(file, imports = {}, globals = {}) {
  const m = { exports: {} };
  vm.runInNewContext(compile(fs.readFileSync(file, 'utf8')), { module: m, exports: m.exports, console, Date, AbortSignal, process: { env: {} }, ...globals, require: name => imports[name] || (['@nestjs/common', '@nestjs/swagger'].includes(name) ? common : {}) });
  return m.exports;
}
function snippets(file) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), out = { effects: [] };
  function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) out[n.name.text] = n.initializer.getText(tree);
    if (ts.isFunctionDeclaration(n) && n.name) out[n.name.text] = n.getText(tree);
    if (ts.isCallExpression(n) && n.expression.getText(tree) === 'useEffect') out.effects.push(n.arguments[0].getText(tree));
    ts.forEachChild(n, visit);
  }
  visit(tree); return out;
}
function evaluate(code, context = {}) { const m = { exports: {} }; vm.runInNewContext(compile('module.exports = ' + code), { ...context, module: m }); return m.exports; }
const { AccessService, can, parseRoles } = load('apps/api/src/access/access.service.ts');
const { AccessController } = load('apps/api/src/access/access.controller.ts', { './access.service': { AccessService, parseRoles } });
function dbFixture() {
  let state = { roles: ['ADMIN', 'GURU', 'SISWA'].map((name, i) => ({ id: i + 1, name })), public_users: [1n, 2n, 3n, 9007199254740993n].map(id => ({ id, nama: `User ${id}`, nip: `nip${id}` })), role_capabilities: [], user_capabilities: [], role_pages: [], role_group_flat: [], site_settings: [], system_config: [] };
  const failure = {}, log = [];
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => value && typeof value === 'object' ? ('in' in value ? value.in.includes(row[key]) : matches(row, value)) : row[key] === value);
  const model = (table, get) => ({
    async findMany({ where } = {}) { if (failure[`${table}.read`]) throw Error('simulated read failure'); return structuredClone(get()[table].filter(row => matches(row, where))); },
    async findFirst(args) { return (await this.findMany(args))[0] || null; },
    async findUnique(args) { return this.findFirst(args); },
    async deleteMany({ where }) { log.push(table + '.delete'); get()[table] = get()[table].filter(row => !matches(row, where)); },
    async createMany({ data }) { if (failure[`${table}.write`]) throw Error('simulated write failure'); get()[table].push(...structuredClone(data)); },
    async upsert({ where, create, update }) { if (failure[`${table}.write`] || failure[`${table}.write:${where.key}`]) throw Error('simulated write failure'); const row = get()[table].find(row => matches(row, where)); if (row) Object.assign(row, structuredClone(update)); else get()[table].push(structuredClone(create)); },
  });
  const models = get => Object.fromEntries(Object.keys(state).map(table => [table, model(table, get)]));
  const db = { ...models(() => state), async $transaction(fn) { const local = structuredClone(state); const result = await fn({ ...models(() => local), $queryRawUnsafe: async sql => { assert.match(sql, /pg_advisory_xact_lock.*::text$/); return []; } }); state = local; return result; } };
  return { db, failure, log, get state() { return state; }, access: new AccessService(db) };
}
test('admin write guard still rejects ordinary users and role name substrings', async () => {
  const calls = [], c = new AccessController({ saveRoleAccess: async (...args) => calls.push(args) });
  for (const role of ['GURU', 'ADMINISTRASI', 'OP_MADRASAH']) await assert.rejects(c.saveRolePages({ user: { role } }, { role: 'GURU', pageIds: [] }), /ADMIN/);
  for (const role of ['ADMIN', 'ADMINISTRATOR']) assert.equal((await c.saveRolePages({ user: { role } }, { role: 'GURU', pageIds: [] })).ok, true);
  assert.equal(calls.length, 2);
});
test('unreadable overrides never restore a revoked role capability', async () => {
  const f = dbFixture(); f.state.role_capabilities.push({ role: 'GURU', capability_key: 'klinik.kelola_sesi' }); f.state.user_capabilities.push({ user_id: 1n, capability_key: 'klinik.kelola_sesi', mode: 'revoke' });
  assert(!can({ roles: ['GURU'], caps: await f.access.resolveCapabilities(1n, ['GURU']) }, 'klinik.kelola_sesi'));
  f.failure['user_capabilities.read'] = true;
  await assert.rejects(f.access.resolveCapabilities(1n, ['GURU']), /Pengecualian izin gagal dibaca/);
});
test('read errors are propagated instead of empty permission maps/holders', async () => {
  for (const [table, method, args] of [['role_pages', 'getRolePagesMap', []], ['role_group_flat', 'getRoleFlatGroupsMap', []], ['role_capabilities', 'getRoleCapabilitiesMap', []], ['role_capabilities', 'getCapabilityHolders', ['klinik.kelola_sesi']], ['system_config', 'getRoleThemeMap', []]]) {
    const f = dbFixture(); f.failure[`${table}.read`] = true; await assert.rejects(f.access[method](...args), /gagal dibaca/);
  }
});
test('one capability save updates roles, grants, revokes and legacy mirror; removals take effect', async () => {
  const f = dbFixture(), key = 'klinik.kelola_sesi';
  await f.access.setCapabilityConfiguration(key, { roles: ['ADMIN', 'GURU'], userIds: ['2', '9007199254740993'], revokedUserIds: ['1'] });
  assert(!can({ roles: ['GURU'], caps: await f.access.resolveCapabilities(1n, ['GURU']) }, key));
  assert(can({ roles: ['SISWA'], caps: await f.access.resolveCapabilities(2n, ['SISWA']) }, key));
  assert(can({ roles: ['GURU'], caps: await f.access.resolveCapabilities(3n, ['GURU']) }, key));
  assert.equal(JSON.parse(f.state.site_settings[0].value).capabilityManaged, true);
  assert.equal((await f.access.getCapabilityHolders(key)).grants.some(g => g.user_id === '9007199254740993'), true);
  await f.access.setCapabilityConfiguration(key, { roles: [], userIds: [], revokedUserIds: [] });
  assert(!can({ roles: ['GURU'], caps: await f.access.resolveCapabilities(3n, ['GURU']) }, key));
  assert.equal(f.state.user_capabilities.length, 0);
});
test('invalid roles, users, IDs and contradictory exceptions are rejected before permission deletion', async () => {
  for (const body of [{ roles: ['UNKNOWN'], userIds: [], revokedUserIds: [] }, { roles: [], userIds: ['999'], revokedUserIds: [] }, { roles: [], userIds: [1.5], revokedUserIds: [] }, { roles: [], userIds: ['1'], revokedUserIds: ['1'] }]) {
    const f = dbFixture(); await assert.rejects(f.access.setCapabilityConfiguration('klinik.kelola_sesi', body)); assert.equal(f.log.length, 0);
  }
});
test('capability and legacy grant replacements roll back on write failure', async () => {
  const f = dbFixture(); f.state.user_capabilities.push({ user_id: 1n, capability_key: 'klinik.kelola_sesi', mode: 'grant' }); f.failure['site_settings.write'] = true;
  await assert.rejects(f.access.setCapabilityConfiguration('klinik.kelola_sesi', { roles: ['GURU'], userIds: ['2'], revokedUserIds: [] }));
  assert.equal(f.state.user_capabilities[0].user_id, 1n); assert.equal(f.state.role_capabilities.length, 0);
  f.failure['user_capabilities.write'] = true;
  await assert.rejects(f.access.setCapabilityHolders('klinik.kelola_sesi', ['2'])); assert.equal(f.state.user_capabilities[0].user_id, 1n);
});
test('page/group/theme changes commit together and preserve other role themes', async () => {
  const f = dbFixture(); f.state.system_config.push({ key: 'role_theme_modes', value: JSON.stringify({ SISWA: 'DARK' }) });
  await f.access.saveRoleAccess('GURU', ['jurnal'], ['akademik'], 'LIGHT');
  assert.equal(f.state.role_pages[0].page_id, 'jurnal'); assert.equal(f.state.role_group_flat[0].group_key, 'akademik');
  assert.equal(JSON.parse(f.state.system_config.find(r => r.key === 'role_theme_modes').value).SISWA, 'DARK');
  f.failure['system_config.write:dark_mode_roles'] = true;
  await assert.rejects(f.access.saveRoleAccess('GURU', ['master'], [], 'DARK'));
  assert.equal(f.state.role_pages[0].page_id, 'jurnal'); assert.equal(f.state.role_group_flat.length, 1);
});

const feature = snippets('apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx');
const pages = snippets('apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx');
const ROLE_ADMIN = ['ADMIN', 'ADMINISTRATOR'], KONFIG_AWAL = { allowedRoles: ROLE_ADMIN, allowedUsers: [] };
const MODUL = evaluate(feature.MODUL);
const configSnapshot = evaluate(feature.configSnapshot);
const parseKonfig = evaluate('(() => {' + feature.parseKonfig + '; return parseKonfig;})()', { ROLE_ADMIN, KONFIG_AWAL });
const flush = () => new Promise(resolve => setImmediate(resolve));
function featureFixture(opts = {}) {
  const state = { konfig: {}, failed: new Set(), snapshots: {}, calls: [], saving: null };
  const ctx = { ROLE_ADMIN, KONFIG_AWAL, MODUL, configSnapshot, parseKonfig, loadId: { current: 0 }, console, setLoading() {}, setRawUserList() {}, setDbRoles() {},
    setKonfig: v => state.konfig = typeof v === 'function' ? v(state.konfig) : v,
    setSavedSnapshots: v => state.snapshots = typeof v === 'function' ? v(state.snapshots) : v,
    setGagalMuat: v => state.failed = v, setSavingKey: v => state.saving = v, Swal: { fire: async () => ({}) },
    fetch: async (url, init) => {
      state.calls.push({ url, body: init?.body && JSON.parse(init.body) });
      return { ok: true, json: async () => init ? { ok: true } : url === '/api/admin/users' ? { ok: !opts.usersFail, data: [{ id: '1', nama: 'User 1' }] } : url === '/api/admin/roles' ? { ok: true, data: [{ name: 'GURU' }] } : url === '/api/site-settings' ? { ok: !opts.settingsFail, data: opts.settings || [] } : { ok: !opts.capsFail, roles: ['GURU'], grants: [], revokes: [{ user_id: '1', nama: 'User 1' }] } };
    } };
  const muat = evaluate(feature.muatSemua.match(/useCallback\(([\s\S]*),\s*\[\]\)$/)[1], ctx);
  const save = m => evaluate(feature.simpan, { ...ctx, konfig: state.konfig, gagalMuat: state.failed, savingKey: state.saving })(m);
  return { state, muat, save };
}
test('feature loader shows effective capability roles and explicit exceptions', async () => {
  const f = featureFixture(); await f.muat(); assert(f.state.konfig['klinik.kelola_sesi'].allowedRoles.includes('GURU')); assert.equal(f.state.konfig['klinik.kelola_sesi'].revokedUsers[0].id, '1');
});
test('a synchronized capability never restores obsolete grants from the JSON mirror', async () => {
  const f = featureFixture({ settings: [{ key: 'klinik.kelola_sesi', value: JSON.stringify({ capabilityManaged: true, allowedRoles: ['SISWA'], allowedUsers: [{ id: '3', nama: 'Removed grant' }] }) }] });
  await f.muat(); assert(!f.state.konfig['klinik.kelola_sesi'].allowedRoles.includes('SISWA')); assert.equal(f.state.konfig['klinik.kelola_sesi'].allowedUsers.length, 0);
});
test('Bank Data legacy compatibility respects revokes and stops after synchronization', async () => {
  const { BankDataService } = load('apps/api/src/bank-data/bank-data.service.ts');
  let revoked = true, managed = false;
  const svc = new BankDataService({ site_settings: { findUnique: async () => ({ value: JSON.stringify({ capabilityManaged: managed, allowedRoles: ['GURU'], allowedUsers: [] }) }) } }, { resolveUserAccess: async () => ({ roles: ['GURU'], pageIds: ['bank-data'], caps: [], revokedCaps: revoked ? ['bank_data.kelola'] : [] }) });
  assert.equal((await svc.permission({ id: 1n })).bolehKelola, false); revoked = false; assert.equal((await svc.permission({ id: 1n })).bolehKelola, true); managed = true; assert.equal((await svc.permission({ id: 1n })).bolehKelola, false);
});
test('either failed permission source locks capability saving; missing user list also locks saving', async () => {
  for (const opts of [{ capsFail: true }, { settingsFail: true }, { usersFail: true }]) {
    const f = featureFixture(opts); await f.muat(); assert(f.state.failed.has('klinik.kelola_sesi')); await f.save(MODUL.find(m => m.settingKey === 'klinik.kelola_sesi')); assert(!f.state.calls.some(c => c.body));
  }
});
test('feature saves use one request and preserve unsaved cards', async () => {
  const f = featureFixture(); await f.muat();
  f.state.konfig.dokumen_access_config = { allowedRoles: ['ADMIN', 'GURU'], allowedUsers: [] };
  await f.save(MODUL.find(m => m.settingKey === 'klinik.kelola_sesi'));
  const writes = f.state.calls.filter(c => c.body); assert.equal(writes.length, 1); assert.equal(writes[0].url, '/api/admin/capabilities');
  assert(writes[0].body.roles.includes('GURU')); assert.deepEqual(writes[0].body.revokedUserIds, ['1']);
  assert(f.state.konfig.dokumen_access_config.allowedRoles.includes('GURU'));
});
test('legacy general grants and Kinerja Guru are visible in the feature catalog/filter', () => {
  assert(MODUL.some(m => m.settingKey === 'jurnal_access_config')); assert(MODUL.some(m => m.settingKey === 'informasi_access_config'));
  assert(evaluate(feature.GRUP_ORDER).includes('Kinerja Guru')); assert(feature.allGroups.includes('MODUL.map(m => m.grup)'));
});
test('late previous role responses cannot replace current state; saves are blocked during load', async () => {
  const requests = [], state = {}, ctx = { AbortController, selectedRole: 'GURU',
    setLoading: v => state.loading = v, setLoadedRole: v => state.loadedRole = v, setGagalMuatAkses: v => state.failed = v,
    setPageIds: v => state.pageIds = v, setFlatGroups: v => state.flatGroups = v, setInitial: v => state.initial = v,
    snapshot: (p, f) => JSON.stringify({ p: [...p].sort(), f: [...f].sort() }),
    fetch: (url, init) => new Promise(resolve => requests.push({ signal: init.signal, finish: (role, ids) => resolve({ json: async () => ({ ok: true, role, pageIds: ids, flatGroups: [] }) }) })) };
  const effect = pages.effects.find(e => e.includes('setGagalMuatAkses(false)'));
  const cleanup = evaluate(effect, ctx)(); cleanup(); evaluate(effect, { ...ctx, selectedRole: 'SISWA' })();
  assert(requests[0].signal.aborted); requests[1].finish('SISWA', ['nilai']); await flush(); requests[0].finish('GURU', ['master']); await flush();
  assert.equal(state.loadedRole, 'SISWA'); assert.equal([...state.pageIds].join(), 'nilai');
  let writes = 0; const save = evaluate(pages.save, { selectedRole: 'SISWA', loading: true, saving: false, fetch: async () => { writes++; } }); await save(); assert.equal(writes, 0);
});
test('stale JWT grants never bypass current page access; backend failure denies navigation', async () => {
  let lookups = 0, info = { roles: ['GURU'], pages: new Set(), found: true };
  const response = kind => ({ kind, cookies: { set() {} } });
  const { middleware } = load('apps/web/middleware.ts', { 'next/server': { NextResponse: { next: () => response('next'), redirect: () => response('redirect'), json: () => response('json') } }, '@/lib/app-jwt': { verifyAppToken: async () => ({ authId: 'fixture', role: 'GURU', pageIds: ['master'] }) }, '@/lib/edge-access': { getAccessForAuthId: async (id, token) => { lookups++; assert.equal(token, 'test'); return info; } } });
  const url = new URL('https://fixture.invalid/master'); url.clone = () => new URL(url);
  const req = { nextUrl: url, headers: { get: k => k === 'authorization' ? 'Bearer test' : null }, cookies: { has: () => false, get: () => undefined } };
  assert.equal((await middleware(req)).kind, 'redirect'); info.pages.add('master'); assert.equal((await middleware(req)).kind, 'next'); info = null; assert.equal((await middleware(req)).kind, 'redirect'); assert.equal(lookups, 3);
});
test('edge access validates current account and never reuses old data after failure', async () => {
  let fail = false, active = true;
  const { getAccessForAuthId } = load('apps/web/lib/edge-access.ts', {}, { fetch: async (url, init) => { assert(url.endsWith('/access/me')); assert.equal(init.headers.authorization, 'Bearer token'); if (fail) return { ok: false }; return { ok: true, json: async () => ({ user: { auth_id: 'fixture', aktif: active }, access: { roles: ['GURU'], pageIds: ['master'] } }) }; } });
  assert((await getAccessForAuthId('fixture', 'token')).pages.has('master')); active = false; assert.equal(await getAccessForAuthId('fixture', 'token'), null); active = true; fail = true; assert.equal(await getAccessForAuthId('fixture', 'token'), null);
});
