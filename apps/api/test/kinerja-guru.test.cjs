const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/kinerja-guru/kinerja-guru.service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText, {
  module: moduleUnderTest, exports: moduleUnderTest.exports, Date, console,
  require: name => name === '@nestjs/common' ? require(name) : {},
});
const { KinerjaGuruService } = moduleUnderTest.exports;
function fixture(overrides = {}) {
  let calls = 0;
  const tables = {
    master_kelas: [], master_waktu: [], jurnal_guru: [], laporan_piket: [], izin_guru: [],
    jadwal_piket: [{ nip: '1', nama_guru: 'Guru A', hari: 'Senin', kelas: 'X', jam_ke: 1, berlaku_mulai: new Date('2020-01-01') }],
    master_guru: [{ nip: '1', nama_lengkap: 'Guru A' }, { nip: '2', nama_lengkap: 'Guru B' }], ...overrides,
  };
  const db = Object.fromEntries(Object.entries(tables).map(([key, rows]) => [key, {
    findMany: async () => { calls++; return rows; },
  }]));
  const service = new KinerjaGuruService(db, { getJadwal: async () => { calls++; return { data: [] }; } });
  return { service, get calls() { return calls; } };
}
test('invalid, reversed and oversized periods are rejected before accessing data', async () => {
  for (const [start, end] of [['bad', '2020-01'], ['2020-13', '2020-13'], ['2020-00', '2020-01'],
    ['2020-02', '2020-01'], ['2020-01', '2021-01'], ['0000-01', '0000-01'], [['2020-01'], '2020-01']]) {
    const f = fixture();
    await assert.rejects(f.service.getStats(start, end), error => error.getStatus() === 400);
    assert.equal(f.calls, 0);
  }
  const r = await fixture().service.getStats('2020-01', '2020-12');
  assert.equal(r.period.end_date, '2020-12-31');
});
test('missing piket reports are counted even with zero reports for the whole period', async () => {
  const empty = await fixture().service.getStats('2020-01', '2020-01');
  const unrelated = await fixture({ laporan_piket: [{ tanggal: new Date('2020-01-01'), laporan_piket_detail: [{ nama_kelas: 'Y', jam_ke: 9 }] }] }).service.getStats('2020-01', '2020-01');
  assert.equal(empty.data.piket[0].count, 4);
  assert.equal(unrelated.data.piket[0].count, 4);
  const reported = await fixture({ laporan_piket: [{ tanggal: new Date('2020-01-06'), laporan_piket_detail: [{ nama_kelas: 'X', jam_ke: 1 }] }] }).service.getStats('2020-01', '2020-01');
  assert.equal(reported.data.piket[0].count, 3);
});
test('substitute attendance, duration and permission lookup use the substitute identity', async () => {
  const journal = { id: 'j', nip: '1', nama_guru: 'Guru A', guru_pengganti: 'Guru B',
    tanggal: new Date('2020-01-06'), jam_ke_id: '1', kategori_kehadiran: 'Tukaran', status_pengganti: 'Terlambat',
    durasi_terlambat: '15', durasi_keluar_awal: '10', mengambil_istirahat: true };
  const result = await fixture({ jurnal_guru: [journal], izin_guru: [{ id: 'izin', nip: '2', nama_guru: 'Guru B',
    tanggal_mulai: new Date('2020-01-06'), tanggal_selesai: new Date('2020-01-06'), status: 'disetujui', jenis: 'izin' }] }).service.getStats('2020-01', '2020-01');
  for (const key of ['terlambat', 'keluarSebelumWaktu', 'mengambilIstirahat']) {
    assert.equal(result.data[key][0].nip, '2');
    assert.equal(result.data[key][0].details.find(d => d.izin)?.izin.id, 'izin');
  }
  assert.equal(result.data.terlambat[0].count, 15);
  const main = await fixture({ jurnal_guru: [{ ...journal, guru_pengganti: '-', kategori_kehadiran: 'Terlambat' }] }).service.getStats('2020-01', '2020-01');
  assert.equal(main.data.terlambat[0].nip, '1');
  const unknown = await fixture({ jurnal_guru: [{ ...journal, guru_pengganti: 'Guru Tidak Terdaftar' }] }).service.getStats('2020-01', '2020-01');
  assert.equal(unknown.data.terlambat[0].nip, '');
  assert.equal(unknown.data.terlambat[0].nama, 'Guru Tidak Terdaftar');
});
