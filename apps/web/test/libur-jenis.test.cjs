const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require });
  return module.exports;
}
const { normalizeJenis, labelJenis, buildLiburIndex } = load('apps/web/lib/libur.ts');

test('jenis kosong / baris lama dibaca sebagai libur', () => {
  assert.equal(normalizeJenis(undefined), 'libur');
  assert.equal(normalizeJenis(null), 'libur');
  assert.equal(normalizeJenis('apa saja'), 'libur');
});

test('variasi penulisan PBM tidak efektif dikenali', () => {
  for (const v of ['tidak_efektif', 'Tidak Efektif', 'pbm-tidak-efektif', 'PBM tidak efektif']) {
    assert.equal(normalizeJenis(v), 'tidak_efektif', v);
  }
  assert.equal(labelJenis('tidak_efektif'), 'PBM Tidak Efektif');
  assert.equal(labelJenis('libur'), 'Libur');
});

test('PBM tidak efektif tetap meniadakan PBM seperti libur', () => {
  const idx = buildLiburIndex([{ tanggal: '2026-11-20', jam_ke: '3', jenis: 'tidak_efektif' }]);
  assert.equal(idx.isLibur('2026-11-20', 3), true);
  assert.equal(idx.isLibur('2026-11-20', 4), false);
});
