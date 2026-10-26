const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: n => imports[n] || require(n) });
  return module.exports;
}
const libur = load('apps/web/lib/libur.ts');
const { jadwalTanpaLibur, liburPenuhJadwal } = load('apps/web/lib/jadwal-libur.ts', { './libur': libur });
const rows = [{ kelas: 'XI A', jam_ke: 1 }, { kelas: 'XII A', jam_ke: 2 }];
const holiday = { tanggal: '2026-10-26', jam_ke: 'Semua', lingkup: 'tingkat', target_kelas: ['12'] };
test('libur XII mempertahankan jadwal XI dan tidak menutup daftar guru', () => {
  assert.equal(jadwalTanpaLibur(rows, [holiday]).length, 1);
  assert.equal(jadwalTanpaLibur(rows, [holiday])[0].kelas, 'XI A');
  assert.equal(liburPenuhJadwal(rows, [holiday]), undefined);
  assert.equal(liburPenuhJadwal([rows[1]], [holiday]), holiday);
});
test('libur per kelas dan per jam hanya menyaring pelajaran terkait', () => {
  const h = { ...holiday, lingkup: 'kelas', target_kelas: ['XI A'], jam_ke: '1' };
  assert.equal(jadwalTanpaLibur([...rows, { kelas: 'XI A', jam_ke: 3 }], [h]).length, 2);
  assert.equal(liburPenuhJadwal(rows, [h]), undefined);
});
test('libur umum tetap menutup semua jadwal dan master tingkat didahulukan', () => {
  const h = { ...holiday, lingkup: 'semua' };
  assert.equal(jadwalTanpaLibur(rows, [h]).length, 0);
  assert.equal(liburPenuhJadwal([], [h]), h);
  assert.equal(jadwalTanpaLibur([{ kelas: 'Kelas Khusus', tingkat: 12, jam_ke: 1 }], [holiday]).length, 0);
});
