// Beban per permintaan, kuota login, heartbeat, pool DB, dan batas kontainer.
// Run from repository root: node --test apps/api/test/server-capacity.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const crypto = require('node:crypto');

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
const noopDecorator = () => () => {};
const common = new Proxy({ Logger: class { error() {} warn() {} log() {} }, ServiceUnavailableException: class extends Error {}, BadRequestException: class extends Error {}, NotFoundException: class extends Error {}, ForbiddenException: class extends Error {} }, { get: (target, key) => target[key] || noopDecorator });
function load(file, imports = {}, env = {}) {
  const m = { exports: {} };
  vm.runInNewContext(compile(fs.readFileSync(file, 'utf8')), {
    module: m, exports: m.exports, console, Date, Buffer, Map, Set, Promise, BigInt,
    process: { env },
    require: name => imports[name] || (name === 'node:crypto' || name === 'crypto' ? crypto : name === 'node:buffer' ? require('node:buffer') : name === 'node:process' ? { env } : ['@nestjs/common', '@nestjs/swagger', '@nestjs/core', '@nestjs/jwt'].includes(name) ? common : {}),
  });
  return m.exports;
}
const read = file => fs.readFileSync(file, 'utf8');

// ─── Cache akses ──────────────────────────────────────────────────────────────
const { AccessService } = load('apps/api/src/access/access.service.ts');
function counted() {
  const state = {
    role_capabilities: [{ role: 'GURU', capability_key: 'a.b' }],
    user_capabilities: [{ user_id: 1n, capability_key: 'a.b', mode: 'revoke' }],
    tugas_tambahan: [{ nip: '123', granted_role: 'WALI_KELAS' }],
    siswa_kelas: [],
    master_tahun_ajaran: [{ tahun_ajaran: '2026/2027', is_active: true }],
  };
  const reads = {};
  const model = table => ({
    async findMany() { reads[table] = (reads[table] || 0) + 1; return structuredClone(state[table]); },
    async deleteMany() { state[table] = []; return { count: 0 }; },
    async createMany({ data }) { state[table].push(...data); return { count: data.length }; },
  });
  const prisma = new Proxy({ async $transaction(ops) { return Promise.all(ops); } }, { get: (t, k) => t[k] || model(k) });
  return { access: new AccessService(prisma), reads, state };
}

test('auth per request reads role_capabilities, duty roles, and overrides once per TTL', async () => {
  const { access, reads } = counted();
  for (let i = 0; i < 25; i++) {
    const caps = await access.resolveCapabilities(1n, ['GURU']);
    assert.deepEqual([...caps], []);
    assert.deepEqual([...await access.getDutyRoles('123')], ['WALI_KELAS']);
  }
  assert.equal(reads.role_capabilities, 1, 'role_capabilities harus dari cache, bukan dibaca tiap permintaan');
  assert.equal(reads.user_capabilities, 1);
  assert.equal(reads.tugas_tambahan, 1);
});

test('changing a user override clears the cached overrides immediately', async () => {
  const { access } = counted();
  assert.deepEqual([...await access.resolveCapabilities(1n, ['GURU'])], []);
  await access.setUserCapabilities(1n, []);
  assert.deepEqual([...await access.resolveCapabilities(1n, ['GURU'])], ['a.b']);
});

test('cached duty roles are copies: callers cannot mutate the cache', async () => {
  const { access } = counted();
  const first = await access.getDutyRoles('123');
  first.push('ADMIN');
  assert.deepEqual([...await access.getDutyRoles('123')], ['WALI_KELAS']);
});

test('per-request auth no longer forces fresh capability or page maps', () => {
  const source = read('apps/api/src/access/access.service.ts');
  assert.doesNotMatch(source, /this\.getRoleCapabilitiesMap\(true\)/);
  assert.doesNotMatch(source, /this\.getRolePagesMap\(true\)/);
  // Pemeriksaan keamanan murah tetap dibaca langsung tiap permintaan.
  const jwt = read('apps/api/src/auth/jwt.strategy.ts');
  assert.match(jwt, /public_users\.find/);
  assert.match(jwt, /auth_users\.findUnique/);
  assert.match(jwt, /sessionVersion\(credential\.raw_app_meta_data\)/);
});

// ─── Kuota login & panggilan internal ─────────────────────────────────────────
const throttlerStub = { ThrottlerGuard: class { async shouldSkip() { return false; } async getTracker(req) { return req.ip; } }, InjectThrottlerOptions: noopDecorator, InjectThrottlerStorage: noopDecorator };
const guardModule = env => load('apps/api/src/common/guards/user-throttler.guard.ts', { '@nestjs/throttler': throttlerStub }, env);

test('login quota is per real IP + account, so one school NAT does not share one bucket', () => {
  const { loginTracker, loginAccount, LOGIN_ACCOUNT_THROTTLER } = guardModule({});
  const req = (user, ip = '203.0.113.5') => ({ method: 'POST', originalUrl: '/api/auth/login', ip, body: { usernameOrEmail: user } });
  assert.equal(loginTracker(req('Siswa01')), 'login:203.0.113.5:siswa01');
  assert.notEqual(loginTracker(req('siswa01')), loginTracker(req('siswa02')));
  assert.equal(loginTracker({ method: 'GET', originalUrl: '/api/auth/login', body: {} }), null);
  assert.equal(loginTracker({ method: 'POST', originalUrl: '/api/users/heartbeat', body: { usernameOrEmail: 'x' } }), null);
  assert.equal(loginAccount(req('  Guru@Sekolah  ')), 'guru@sekolah');
  // Batas kedua per akun, berapa pun IP-nya.
  assert.equal(LOGIN_ACCOUNT_THROTTLER.getTracker(req('siswa01', '1.1.1.1')), LOGIN_ACCOUNT_THROTTLER.getTracker(req('siswa01', '2.2.2.2')));
  const ctx = r => ({ switchToHttp: () => ({ getRequest: () => r }) });
  assert.equal(LOGIN_ACCOUNT_THROTTLER.skipIf(ctx(req('a'))), false);
  assert.equal(LOGIN_ACCOUNT_THROTTLER.skipIf(ctx({ method: 'GET', originalUrl: '/api/users', body: {} })), true);
});

test('valid internal key skips the shared-IP quota; wrong or missing keys do not', async () => {
  const { hasValidInternalKey } = guardModule({ INTERNAL_API_KEY: 'k'.repeat(64) });
  assert.equal(hasValidInternalKey('k'.repeat(64), 'k'.repeat(64)), true);
  assert.equal(hasValidInternalKey('k'.repeat(63), 'k'.repeat(64)), false);
  assert.equal(hasValidInternalKey('', 'k'.repeat(64)), false);
  assert.equal(hasValidInternalKey('anything', ''), false);
  assert.equal(hasValidInternalKey(undefined, 'k'.repeat(64)), false);
});

test('API trusts X-Forwarded-For only from local/private proxies and web forwards it on login', () => {
  assert.match(read('apps/api/src/main.ts'), /set\('trust proxy', \['loopback', 'uniquelocal'\]\)/);
  assert.match(read('apps/web/app/api/auth/login/route.ts'), /'X-Forwarded-For': forwardedFor/);
  assert.match(read('apps/api/src/app.module.ts'), /LOGIN_ACCOUNT_THROTTLER/);
  assert.match(read('apps/api/src/auth/auth.controller.ts'), /@Throttle\(\{ default: \{ limit: 10, ttl: 60000 \} \}\)\s*\n\s*@ApiOperation\(\{ summary: 'Login pengguna/);
});

// ─── Heartbeat ────────────────────────────────────────────────────────────────
test('heartbeat writes last_seen at most once a minute per user, by primary key', async () => {
  const { UsersService } = load('apps/api/src/users/users.service.ts', { bcryptjs: {}, '@prisma/client': { Prisma: {} } });
  const updates = [];
  const prisma = { public_users: { async updateMany(args) { updates.push(args); return { count: 1 }; } } };
  const presence = { update() {}, logout() {} };
  const service = new UsersService(prisma, {}, presence);
  const user = { id: 7n, auth_id: 'abc' };
  await service.heartbeat(user, '/dashboard', { session: 's', tabId: 't', sequence: 1, online: true });
  await service.heartbeat(user, '/dashboard', { session: 's', tabId: 't', sequence: 2, online: true });
  await service.heartbeat(user, '/dashboard', { session: 's', tabId: 't2', sequence: 1, online: true });
  assert.equal(updates.length, 1);
  assert.deepEqual(Object.keys(updates[0].where), ['id']);
  await service.heartbeat(user, '/nilai', { session: 's', tabId: 't', sequence: 3, online: true });
  assert.equal(updates.length, 2, 'perpindahan halaman tetap langsung dicatat');
});

// ─── Pool DB ──────────────────────────────────────────────────────────────────
test('Prisma pool size is explicit for api and web, without overriding the URL', () => {
  for (const file of ['apps/api/src/prisma/database-url.ts', 'apps/web/lib/database-url.ts']) {
    const { withPoolDefaults } = load(file);
    const opts = { limitEnv: 'X_LIMIT', defaultLimit: 20 };
    assert.equal(withPoolDefaults('postgresql://u:p@h:5432/db?schema=public', opts, {}), 'postgresql://u:p@h:5432/db?schema=public&connection_limit=20&pool_timeout=20');
    assert.equal(withPoolDefaults('postgresql://u:p@h/db', opts, { X_LIMIT: '7', DB_POOL_TIMEOUT: '9' }), 'postgresql://u:p@h/db?connection_limit=7&pool_timeout=9');
    assert.equal(withPoolDefaults('postgresql://u:p@h/db?connection_limit=3&pool_timeout=4', opts, {}), 'postgresql://u:p@h/db?connection_limit=3&pool_timeout=4');
    assert.equal(withPoolDefaults(undefined, opts, {}), undefined);
  }
  assert.match(read('apps/api/src/prisma/prisma.service.ts'), /API_DB_CONNECTION_LIMIT/);
  assert.match(read('apps/web/lib/prisma.ts'), /WEB_DB_CONNECTION_LIMIT/);
});

// ─── Kontainer & migrasi ──────────────────────────────────────────────────────
test('api and web containers are capped, rotate logs, and can reach the host database', () => {
  const yaml = require('js-yaml');
  const compose = yaml.load(read('docker-compose.yml'));
  for (const name of ['acca-api', 'acca-web', 'acca-ocr', 'acca-browser']) {
    const service = compose.services[name];
    assert.ok(service.cpus !== undefined && service.mem_limit !== undefined, `${name} limits`);
    assert.equal(service.logging?.driver, 'json-file', `${name} logging`);
  }
  for (const name of ['acca-api', 'acca-web']) {
    assert.ok(compose.services[name].extra_hosts.includes('host.docker.internal:host-gateway'), name);
    assert.ok(compose.services[name].ports.every(p => p.startsWith('${ACCA_BIND_ADDR')), name);
  }
});

test('auth_id index migration is idempotent and runs on both deployment paths', () => {
  const sql = read('apps/api/prisma/sql/20261121_users_auth_id_index.sql');
  assert.match(sql, /IF NOT EXISTS/);
  assert.match(sql, /attname = 'auth_id'/);
  for (const file of ['.github/workflows/deploy.yml', 'scripts/deploy.sh']) {
    assert.match(read(file), /20261121_users_auth_id_index\.sql/, file);
  }
});
