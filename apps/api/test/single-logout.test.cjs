const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, imports, env = {}) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { module, exports: module.exports, require: name => imports[name], process: { env }, URL, Date, Set, Promise, AbortSignal, console: { error() {} } });
    return module.exports;
}
function server(env = { NODE_ENV: 'production' }) {
    const { logoutResponse } = load('apps/web/lib/single-logout.ts', {
        'node:crypto': { randomUUID: () => 'public-event-marker' },
        'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200, headers: init.headers, cookies: { values: [], set(...args) { this.values.push(args); } } }) } },
    }, env);
    return (origin = 'https://acca.icgowa.sch.id', site = 'same-origin', query = '') => logoutResponse({
        headers: { get: key => key === 'origin' ? origin : key === 'sec-fetch-site' ? site : null },
        nextUrl: new URL('http://internal-web:3006/api/auth/logout' + query), cookies: { getAll: () => [{ name: 'sb-old-session.1' }] },
    });
}
test('production logout clears local cookies, returns all three endpoints and publishes a non-secret event', () => {
    const response = server()();
    assert.equal(response.status, 200); assert.equal(response.body.targets.length, 3);
    assert.equal(response.body.targets[0].url, 'https://acca-cbt.icgowa.sch.id/api/auth/single-logout');
    assert.equal(response.body.targets[1].url, 'https://acca-tools.icgowa.sch.id/auth/single-logout');
    assert.equal(response.body.targets[2].url, 'https://icgowa.sch.id/?acca_single_logout=1');
    const cookies = response.cookies.values;
    for (const name of ['acca_session', 'acca_refresh_token', 'sb-old-session.1']) assert(cookies.some(item => item[0] === name && item[1] === '' && item[2].httpOnly));
    const marker = cookies.find(item => item[0] === 'acca_logout_at');
    assert.equal(marker[1], 'public-event-marker'); assert.equal(marker[2].domain, 'icgowa.sch.id'); assert.equal(marker[2].secure, true);
    assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('preparing logout preserves ACCA cookies and does not wake other tabs', () => {
    const response = server()('https://acca.icgowa.sch.id', 'same-origin', '?phase=prepare');
    assert.equal(response.status, 200);
    assert.equal(response.body.targets.length, 3);
    assert.equal(response.cookies.values.length, 0);
    assert.equal(response.headers['Cache-Control'], 'no-store');
});
test('untrusted or cross-site requests cannot log users out', () => {
    for (const [origin, site] of [['https://evil.invalid', 'same-site'], ['https://acca.icgowa.sch.id.evil.invalid', 'same-site'], ['https://acca.icgowa.sch.id', 'cross-site']]) {
        const response = server()(origin, site);
        assert.equal(response.status, 403); assert.equal(response.cookies.values.length, 0);
    }
});
test('explicitly disabled integration reports that remote sessions were not closed', () => {
    for (const env of [{ NODE_ENV: 'development', SINGLE_LOGOUT_ENABLED: 'false' }, { NODE_ENV: 'production', SINGLE_LOGOUT_ENABLED: 'false' }]) {
        const response = server(env)();
        assert.equal(response.body.targets.length, 0); assert(!response.cookies.values.some(item => item[0] === 'acca_logout_at'));
        assert.equal(response.body.integrationDisabled, true);
    }
});

test('development reports disabled integration instead of silently claiming complete logout', () => {
    const response = server({ NODE_ENV: 'development' })('http://internal-web:3006');
    assert.equal(response.body.targets.length, 0);
    assert.equal(response.body.integrationDisabled, true);
});
test('invalid configuration still clears ACCA and explicitly reports incomplete logout', () => {
    const response = server({ NODE_ENV: 'production', CBT_URL: 'not a URL' })();
    assert.equal(response.body.configurationError, true);
    assert(response.cookies.values.some(item => item[0] === 'acca_session'));
});
function client(localResult, remoteResults, href, completionResult = reply(true, { ok: true })) {
    const calls = []; let cleared = 0;
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync('apps/web/lib/single-logout-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, require: () => ({ clearUserCache: () => cleared++ }), Date, Promise, AbortSignal,
        URL, ...(href ? { window: { location: { href } } } : {}),
        localStorage: { setItem() { throw Error('Storage denied'); } }, fetch: async (url, init) => { calls.push({ url, ...init }); if (url === '/api/auth/logout?phase=prepare') return localResult; if (url === '/api/auth/logout') return completionResult; const result = remoteResults[url]; if (result instanceof Error) throw result; return result; } });
    return { api: module.exports, calls, get cleared() { return cleared; } };
}
const reply = (ok, body) => ({ ok, json: async () => body });
test('coordinator sends credentialed POSTs and reports every failed application', async () => {
    const targets = [{ name: 'CBT', url: 'https://cbt.invalid/logout' }, { name: 'Tools', url: 'https://tools.invalid/logout' }, { name: 'WordPress', url: 'https://wp.invalid/logout' }];
    const c = client(reply(true, { ok: true, targets }), { [targets[0].url]: reply(true, { ok: true }), [targets[1].url]: Error('Offline'), [targets[2].url]: reply(false, { ok: false }) });
    assert.deepEqual([...await c.api.logoutAcrossApplications()], ['Tools', 'WordPress']); assert.equal(c.cleared, 1);
    assert.equal(c.calls.length, 5);
    for (const call of c.calls.slice(1, -1)) { assert.equal(call.method, 'POST'); assert.equal(call.credentials, 'include'); assert.equal(call.mode, 'cors'); assert.equal(call.redirect, 'error'); assert(call.signal); }
    for (const call of c.calls) assert.equal(call.keepalive, true, 'logout requests must survive page navigation');
});
test('coordinator never reports success or clears cache when ACCA logout fails', async () => {
    const c = client(reply(false, { ok: false }), {});
    await assert.rejects(c.api.logoutAcrossApplications()); assert.equal(c.calls.length, 1); assert.equal(c.cleared, 0);
});

test('localhost cannot report production cookie sessions as successfully logged out', async () => {
    const target = { name: 'WordPress', url: 'https://icgowa.sch.id/?acca_single_logout=1' };
    const c = client(reply(true, { ok: true, targets: [target] }), { [target.url]: reply(true, { ok: true }) }, 'http://localhost:3006');
    assert.deepEqual([...await c.api.logoutAcrossApplications()], ['WordPress']);
    assert.equal(c.calls.length, 2);
});

test('same-site production requests send the destination session cookies', async () => {
    const target = { name: 'CBT', url: 'https://acca-cbt.icgowa.sch.id/api/auth/single-logout' };
    const c = client(reply(true, { ok: true, targets: [target] }), { [target.url]: reply(true, { ok: true }) }, 'https://acca.icgowa.sch.id/dashboard');
    assert.deepEqual([...await c.api.logoutAcrossApplications()], []);
    assert.equal(c.calls[1].credentials, 'include');
});

test('disabled integration is never presented as complete logout', async () => {
    const c = client(reply(true, { ok: true, targets: [], integrationDisabled: true }), {});
    assert.deepEqual([...await c.api.logoutAcrossApplications()], ['Logout bersama dinonaktifkan']);
});

test('ACCA session remains intact until every remote logout has settled', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const targets = [{ name: 'CBT', url: 'https://acca-cbt.icgowa.sch.id/api/auth/single-logout' }];
    const c = client(reply(true, { ok: true, targets }), { [targets[0].url]: pending }, 'https://acca.icgowa.sch.id/dashboard');
    const logout = c.api.logoutAcrossApplications();
    // Allow the preparation request and the remote request to start.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.deepEqual(c.calls.map(call => call.url), ['/api/auth/logout?phase=prepare', targets[0].url]);
    assert.equal(c.cleared, 0);
    release(reply(true, { ok: true }));
    assert.deepEqual([...await logout], []);
    assert.equal(c.calls.at(-1).url, '/api/auth/logout');
    assert.equal(c.cleared, 1);
});

test('local logout failure after remote completion is not presented as success', async () => {
    const target = { name: 'CBT', url: 'https://acca-cbt.icgowa.sch.id/api/auth/single-logout' };
    const c = client(reply(true, { ok: true, targets: [target] }), { [target.url]: reply(true, { ok: true }) }, undefined, reply(false, { ok: false }));
    await assert.rejects(c.api.logoutAcrossApplications());
    assert.equal(c.calls.length, 3);
    assert.equal(c.cleared, 0);
});

test('missing or empty destinations cannot silently report complete logout', async () => {
    const malformed = client(reply(true, { ok: true }), {});
    await assert.rejects(malformed.api.logoutAcrossApplications());
    assert.equal(malformed.calls.length, 1);
    assert.equal(malformed.cleared, 0);
    const empty = client(reply(true, { ok: true, targets: [] }), {});
    assert.deepEqual([...await empty.api.logoutAcrossApplications()], ['Daftar aplikasi logout kosong']);
});
