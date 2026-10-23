const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('apps/api/src/laporan-piket/laporan-piket.service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText;
new Function('require', 'module', 'exports', code)(name => name === '@nestjs/common' ? require(name) : {}, moduleUnderTest, moduleUnderTest.exports);
const { LaporanPiketService } = moduleUnderTest.exports;

for (const [label, detail, expected] of [
  ['original timetable teacher wins over substitute', { guru_jadwal: 'Guru A', guru_pengganti: 'Adrianah', guru: 'Adrianah' }, 'Guru A'],
  ['original name is trimmed', { guru_jadwal: ' Guru A ', guru: 'Guru B' }, 'Guru A'],
  ['legacy clients retain their recorded teacher', { guru: 'Guru A' }, 'Guru A'],
  ['blank timetable name falls back to legacy teacher', { guru_jadwal: ' ', guru: 'Guru A' }, 'Guru A'],
]) test(`new piket report: ${label}`, async () => {
  let stored;
  const db = {
    laporan_piket: { findMany: async () => [], create: async () => ({ id: 'header' }) },
    laporan_piket_detail: { createMany: async ({ data }) => { stored = data; } },
    notifications: { create: async () => ({}) },
    $transaction: async callback => callback(db),
  };
  const service = new LaporanPiketService(db, {});
  const body = { guruPiket: 'Pelapor', nip: '1', tanggal: '2026-10-09', jamPiket: '3',
    details: [{ kelas: 'XII D', jam_ke: '3', status: 'Penugasan dengan pendampingan', ...detail }] };
  const before = JSON.stringify(body);
  await service.createLaporan({ nip: '1' }, body);
  assert.equal(stored[0].nama_guru, expected);
  assert.equal(stored[0].status_kehadiran, 'Penugasan dengan pendampingan');
  assert.equal(JSON.stringify(body), before);
});
