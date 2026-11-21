// Halaman /logout: pintu keluar bersama untuk CBT/Tools.
// Run from repository root: node --test apps/api/test/cbt-logout-entry.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');

function load(file, env = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: m, exports: m.exports, URL, Set, process: { env } });
  return m.exports;
}

test('only ACCA, CBT and Tools origins start the shared logout automatically', () => {
  const { trustedLogoutOrigins, cameFromAccaApplication } = load('apps/web/lib/logout-referrer.ts');
  const trusted = trustedLogoutOrigins('https://acca.icgowa.sch.id');
  assert.equal(cameFromAccaApplication('https://acca-cbt.icgowa.sch.id/', trusted), true);
  assert.equal(cameFromAccaApplication('https://acca-cbt.icgowa.sch.id/dashboard/siswa', trusted), true);
  assert.equal(cameFromAccaApplication('https://acca-tools.icgowa.sch.id/x', trusted), true);
  assert.equal(cameFromAccaApplication('https://acca.icgowa.sch.id/dashboard', trusted), true);
  for (const other of ['', 'https://evil.example/', 'http://acca-cbt.icgowa.sch.id/', 'https://acca-cbt.icgowa.sch.id.evil.example/', 'not a url']) {
    assert.equal(cameFromAccaApplication(other, trusted), false, other);
  }
  const custom = load('apps/web/lib/logout-referrer.ts', { NEXT_PUBLIC_CBT_URL: 'https://cbt.test' }).trustedLogoutOrigins('https://acca.test');
  assert.equal(cameFromAccaApplication('https://cbt.test/', custom), true);
});

test('/logout runs the existing shared logout and is reachable without an ACCA session', () => {
  const page = fs.readFileSync('apps/web/app/logout/page.tsx', 'utf8');
  assert.match(page, /logoutAcrossApplications\(\)/);
  assert.match(page, /cameFromAccaApplication\(document\.referrer/);
  assert.match(page, /setState\(\{ step: 'confirm' \}\)/, 'other origins must confirm first');
  assert.match(page, /window\.location\.replace\('\/login\?logged_out=1'\)/);
  const middleware = fs.readFileSync('apps/web/middleware.ts', 'utf8');
  const publicList = middleware.slice(middleware.indexOf('const publicPaths'), middleware.indexOf('const isPublicFormRead'));
  assert.match(publicList, /'\/logout'/);
});
