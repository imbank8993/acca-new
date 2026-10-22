// Read-only reproductions against current source. All persistence is mocked.
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const results = [];
const read = f => fs.readFileSync(f, 'utf8');
const compile = s => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const common = new Proxy({ Logger: class { error() {} warn() {} }, ForbiddenException: class extends Error {}, BadRequestException: class extends Error {}, NotFoundException: class extends Error {} }, { get(t, k) { return t[k] || (() => () => {}); } });
function load(file, imports = {}, extra = {}) {
  const m = { exports: {} };
  vm.runInNewContext(compile(read(file)), { module: m, exports: m.exports, console, Date, process: { env: {} }, ...extra, require(n) { return imports[n] || (['@nestjs/common', '@nestjs/swagger'].includes(n) ? common : {}); } });
  return m.exports;
}
function extract(file) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), out = { effects: [] };
  function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) out[n.name.text] = n.initializer.getText(ast);
    if (ts.isFunctionDeclaration(n) && n.name) out[n.name.text] = n.getText(ast);
    if (ts.isCallExpression(n) && n.expression.getText(ast) === 'useEffect') out.effects.push(n.arguments[0].getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast); return out;
}
const feature = extract('apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx');
const pages = extract('apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx');
function execSnippet(source, context) { const m = { exports: {} }; vm.runInNewContext(compile('module.exports = ' + source), { ...context, module: m }); return m.exports; }
const flush = () => new Promise(r => setImmediate(r));
const { AccessService, can, parseRoles } = load('apps/api/src/access/access.service.ts');
const { AccessController } = load('apps/api/src/access/access.controller.ts', { './access.service': { AccessService, parseRoles } });
const { aksesDiizinkan, parseKonfigurasiAkses } = load('apps/api/src/auth/feature-access.guard.ts');
const roleAdmin = ['ADMIN', 'ADMINISTRATOR'];
const featureBase = { ROLE_ADMIN: roleAdmin, KONFIG_AWAL: { allowedRoles: roleAdmin, allowedUsers: [] }, console, Swal: { fire: async () => ({}) }, setSavingKey() {} };
const moduls = execSnippet(feature.MODUL, {});
const parseKonfig = execSnippet('(() => {' + feature.parseKonfig + '; return parseKonfig; })()', featureBase);
function featureFixture(options = {}) {
  const state = { config: {}, failed: new Set(), loading: false, calls: [] };
  const ctx = { ...featureBase, MODUL: moduls, parseKonfig, setLoading: v => state.loading = v,
    setRawUserList() {}, setDbRoles() {}, setKonfig: v => state.config = v, setGagalMuat: v => state.failed = v,
    fetch: async (url, init) => {
      state.calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
      if (init) return { json: async () => ({ ok: true }) };
      return { json: async () => url === '/api/admin/users' ? { ok: true, data: [] } : url === '/api/admin/roles' ? { ok: true, data: [{ name: 'GURU' }] } : url === '/api/site-settings' ? { ok: options.settingsOk !== false, data: options.settings || [] } : { ok: options.capsOk !== false, grants: options.grants || [], roles: options.capRoles || [] } };
    } };
  const muatSemua = execSnippet(feature.muatSemua.match(/useCallback\(([\s\S]*),\s*\[\]\)$/)[1], ctx);
  const save = (m, config = state.config) => execSnippet(feature.simpan, { ...ctx, gagalMuat: state.failed, konfig: config, muatSemua })(m);
  return { state, muatSemua, save };
}
async function check(name, fn) { await fn(); results.push({ name, confirmed: true }); console.log('CONFIRMED: ' + name); }
(async () => {
  await check('Baseline: exact admin write guard and normal role/user feature matching', async () => {
    const calls = [], c = new AccessController({ setRolePages: async (...v) => calls.push(v), setRoleFlatGroups: async () => {} });
    for (const role of ['GURU', 'ADMINISTRASI', 'OP_MADRASAH']) await assert.rejects(c.saveRolePages({ user: { role } }, { role: 'GURU', pageIds: ['jurnal'] }));
    for (const role of roleAdmin) assert.equal((await c.saveRolePages({ user: { role } }, { role: 'GURU', pageIds: ['jurnal'], flatGroups: [] })).ok, true);
    assert.equal(calls.length, 2);
    const cfg = parseKonfigurasiAkses(JSON.stringify({ allowedRoles: ['GURU'], allowedUsers: [{ id: '9', nip: 'nip9' }] }));
    assert(aksesDiizinkan({ roles: ['GURU'], id: 1 }, cfg));
    assert(aksesDiizinkan({ roles: ['SISWA'], id: 9 }, cfg));
    assert(!aksesDiizinkan({ roles: ['SISWA'], id: 2 }, cfg));
  });
  await check('Security: failed override query restores a revoked role capability', async () => {
    let fail = false;
    const a = new AccessService({ role_capabilities: { findMany: async () => [{ role: 'GURU', capability_key: 'klinik.kelola_sesi' }] }, user_capabilities: { findMany: async () => { if (fail) throw Error('simulated unavailable'); return [{ mode: 'revoke', capability_key: 'klinik.kelola_sesi' }]; } } });
    assert(!can({ roles: ['GURU'], caps: await a.resolveCapabilities(9n, ['GURU']) }, 'klinik.kelola_sesi'));
    fail = true;
    assert(can({ roles: ['GURU'], caps: await a.resolveCapabilities(9n, ['GURU']) }, 'klinik.kelola_sesi'));
  });
  await check('Feature UI: selecting Klinik role saves site_settings but never role_capabilities', async () => {
    const f = featureFixture(), m = moduls.find(m => m.settingKey === 'klinik.kelola_sesi');
    await f.muatSemua();
    await f.save(m, { [m.settingKey]: { allowedRoles: [...roleAdmin, 'GURU'], allowedUsers: [] } });
    const writes = f.state.calls.filter(c => c.body);
    assert.equal(JSON.parse(writes[0].body.value).allowedRoles.includes('GURU'), true);
    assert.deepEqual(writes[1].body, { capability: m.settingKey, userIds: [], mode: 'grant' });
    assert(!writes.some(c => c.body.role || c.body.capabilityKeys));
    const a = new AccessService({ role_capabilities: { findMany: async () => [] }, user_capabilities: { findMany: async () => [] } });
    assert(!can({ roles: ['GURU'], caps: await a.resolveCapabilities(9n, ['GURU']) }, m.settingKey));
  });
  await check('Feature UI: existing role_capabilities holders are hidden by loader', async () => {
    const f = featureFixture({ capRoles: ['GURU'] }); await f.muatSemua();
    assert(!f.state.config['klinik.kelola_sesi'].allowedRoles.includes('GURU'));
  });
  await check('Feature UI: one failed source is marked saveable; grants can be overwritten with empty list', async () => {
    const f = featureFixture({ capsOk: false }); await f.muatSemua();
    assert(!f.state.failed.has('klinik.kelola_sesi'));
    assert.equal(f.state.config['klinik.kelola_sesi'].allowedUsers.length, 0);
    await f.save(moduls.find(m => m.settingKey === 'klinik.kelola_sesi'));
    assert(f.state.calls.some(c => c.body?.capability && c.body.userIds.length === 0));
  });
  await check('Backend: capability holder read errors are returned as empty successful data', async () => {
    const a = new AccessService({ role_capabilities: { findMany: async () => { throw Error('simulated'); } }, user_capabilities: { findMany: async () => [] } });
    const empty = await a.getCapabilityHolders('klinik.kelola_sesi');
    assert.equal(empty.roles.length + empty.grants.length + empty.revokes.length, 0);
    assert.equal((await new AccessController(a).capabilityHolders('klinik.kelola_sesi')).grants.length, 0);
  });
  await check('Feature UI: save reloads all cards and erases another unsaved card', async () => {
    const f = featureFixture(); await f.muatSemua();
    f.state.config.dokumen_access_config = { ...f.state.config.dokumen_access_config, allowedRoles: [...roleAdmin, 'GURU'] };
    await f.save(moduls.find(m => m.settingKey === 'agenda_access_config'));
    await flush(); await flush();
    assert(!f.state.config.dokumen_access_config.allowedRoles.includes('GURU'));
  });
  await check('Role pages: slow previous role response overwrites current role; save writes wrong access', async () => {
    const requests = [], state = { pageIds: new Set(), flatGroups: new Set() }, writes = [];
    const ctx = { setLoading: v => state.loading = v, setGagalMuatAkses: v => state.failed = v,
      setPageIds: v => state.pageIds = v, setFlatGroups: v => state.flatGroups = v,
      setInitial: v => state.initial = v, snapshot: (p, f) => JSON.stringify({ p: [...p].sort(), f: [...f].sort() }),
      fetch: url => new Promise(resolve => requests.push({ url, finish: ids => resolve({ json: async () => ({ ok: true, pageIds: ids, flatGroups: [] }) }) })) };
    const effect = pages.effects.find(e => e.includes('setGagalMuatAkses(false)'));
    execSnippet(effect, { ...ctx, selectedRole: 'GURU' })();
    execSnippet(effect, { ...ctx, selectedRole: 'SISWA' })();
    requests[1].finish(['nilai']); await flush();
    requests[0].finish(['pengaturan-data']); await flush();
    assert.equal([...state.pageIds][0], 'pengaturan-data');
    // One normal checkbox edit makes the Save button dirty/enabled again.
    execSnippet(pages.togglePage, { setPageIds: fn => state.pageIds = fn(state.pageIds) })('jurnal');
    assert.notEqual(ctx.snapshot(state.pageIds, state.flatGroups), state.initial);
    const save = execSnippet(pages.save, { ...ctx, ...state, selectedRole: 'SISWA', gagalMuatAkses: false, isThemeDirty: false, roleThemeMap: {}, setSaving() {}, setInitialRoleThemeMap() {}, formatRoleDisplay: v => v, Swal: { fire() {} }, fetch: async (url, options) => { writes.push(JSON.parse(options.body)); return { json: async () => ({ ok: true }) }; } });
    await save(); assert.deepEqual(writes[0], { role: 'SISWA', pageIds: ['pengaturan-data', 'jurnal'], flatGroups: [] });
  });
  await check('Role pages: database load failure is disguised as an empty map', async () => {
    const a = new AccessService({ role_pages: { findMany: async () => { throw Error('simulated'); } }, role_group_flat: { findMany: async () => [] } });
    assert.equal(Object.keys((await new AccessController(a).rolePages()).pages).length, 0);
  });
  await check('Persistence: failed second capability upsert leaves only partially replaced grants', async () => {
    let rows = [1, 2];
    const a = new AccessService({ user_capabilities: { deleteMany: async () => { rows = []; }, upsert: async ({ create }) => { if (create.user_id === 99n) throw Error('FK violation'); rows.push(Number(create.user_id)); } } });
    await assert.rejects(a.setCapabilityHolders('klinik.kelola_sesi', [3, 99]));
    assert.deepEqual(rows, [3]);
  });
  await check('Security: an old signed JWT page grant bypasses current revoked page access', async () => {
    let lookups = 0;
    const claims = { authId: 'fixture-auth', role: 'GURU', pageIds: ['master'] };
    const response = kind => ({ kind, cookies: { set() {} } });
    const { middleware } = load('apps/web/middleware.ts', {
      'next/server': { NextResponse: { next: () => response('next'), redirect: () => response('redirect'), json: () => response('json') } },
      '@/lib/edge-access': { getAccessForAuthId: async () => { lookups++; return { roles: ['GURU'], pages: new Set(), found: true }; } },
      '@/lib/app-jwt': { verifyAppToken: async () => claims, decodeSessionCookie: v => v },
    });
    const url = new URL('https://fixture.invalid/master'); url.clone = () => new URL(url);
    const request = { nextUrl: url, headers: { get: k => k === 'authorization' ? 'Bearer valid-fixture' : null }, cookies: { has: () => false, get: () => undefined } };
    assert.equal((await middleware(request)).kind, 'next'); assert.equal(lookups, 0);
    claims.pageIds = [];
    assert.equal((await middleware(request)).kind, 'redirect'); assert.equal(lookups, 1);
  });
  await check('UI: Kinerja Guru exists but cannot be selected in group filter', async () => {
    const order = execSnippet(feature.GRUP_ORDER, {});
    assert(moduls.some(m => m.grup === 'Kinerja Guru')); assert(!order.includes('Kinerja Guru'));
    assert(feature.allGroups.includes('for (const g of GRUP_ORDER)'));
  });
  await check('Security/UI: hidden legacy Jurnal config still grants generate privilege', async () => {
    assert(!moduls.some(m => m.settingKey === 'jurnal_access_config'));
    const { FeatureAccessGuard } = load('apps/api/src/auth/feature-access.guard.ts');
    const guard = new FeatureAccessGuard({ getAllAndOverride: () => ({ settingKey: ['jurnal_generate_access_config', 'jurnal_access_config'], peranBawaan: ['OP_JURNAL'] }) }, { site_settings: { findUnique: async ({ where }) => ({ value: JSON.stringify({ allowedRoles: where.key === 'jurnal_access_config' ? ['GURU'] : roleAdmin, allowedUsers: [] }) }) } });
    assert(await guard.canActivate({ getHandler() {}, getClass() {}, switchToHttp: () => ({ getRequest: () => ({ user: { id: 9n, roles: ['GURU'] }, headers: {} }) }) }));
  });
  fs.writeFileSync('artifacts/audit-user-access-2026-10-22-results.json', JSON.stringify({ scope: 'Local source with mocked persistence, no production requests', results }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
