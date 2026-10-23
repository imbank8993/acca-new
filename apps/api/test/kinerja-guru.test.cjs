const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const piketModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/kinerja-guru/piket-calculation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: piketModule, exports: piketModule.exports, Date, Intl, console });
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/kinerja-guru/kinerja-guru.service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText, {
  module: moduleUnderTest, exports: moduleUnderTest.exports, Date, console,
  require: name => name === '@nestjs/common' ? require(name) : name === './piket-calculation' ? piketModule.exports : {},
});
const { KinerjaGuruService } = moduleUnderTest.exports;
function fixture(overrides = {}) {
  let calls = 0;
  const tables = {
    master_kelas: [], master_waktu: [], jurnal_guru: [], laporan_piket: [], izin_guru: [], libur: [],
    jadwal_piket: [{ nip: '1', nama_guru: 'Guru A', hari: 'Senin', kelas: 'X', jam_ke: 1, berlaku_mulai: new Date('2020-01-01') }],
    master_guru: [{ nip: '1', nama_lengkap: 'Guru A' }, { nip: '2', nama_lengkap: 'Guru B' }], ...overrides,
  };
  const db = Object.fromEntries(Object.entries(tables).map(([key, rows]) => [key, {
    findMany: async () => { calls++; return rows; },
  }]));
  db.site_settings = { findUnique: async () => { calls++; return { value: 'Asia/Makassar' }; } };
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

test('piket uses one effective full version; removed weekday/teacher slots do not reappear', async () => {
  const result = await fixture({ jadwal_piket: [
    { nip: '1', hari: 'Senin', kelas: 'X', jam_ke: 1, berlaku_mulai: new Date('2020-01-01') },
    { nip: '2', hari: 'Selasa', kelas: 'Y', jam_ke: 2, berlaku_mulai: new Date('2020-01-13') },
  ] }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.piket.find(row => row.nip === '1').count, 1);
  assert.equal(result.data.piket.find(row => row.nip === '2').count, 3);
});

test('report dates and comma-separated JP are normalized without missing completed work', async () => {
  const result = await fixture({ jadwal_piket: [1, 2].map(jam_ke => ({ nip: '1', hari: 'Senin', kelas: 'X', jam_ke, berlaku_mulai: '2020-01-01' })),
    laporan_piket: [{ tanggal: '2020-01-06T00:00:00.000Z', laporan_piket_detail: [{ nama_kelas: ' x ', jam_ke: '01, 2' }] }],
  }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.piket[0].count, 6);
  assert.equal(result.data.piket[0].details.filter(row => row.type === 'Tidak Piket').length, 6);
});

test('multiple unreported classes in the same JP count once, with a matching detail', async () => {
  const result = await fixture({ jadwal_piket: ['X', 'Y', 'X'].map(kelas => ({ nip: '1', hari: 'Senin', kelas, jam_ke: 1, berlaku_mulai: '2020-01-01' })) }).service.getStats('2020-01', '2020-01');
  const teacher = result.data.piket[0];
  assert.equal(teacher.count, 4);
  assert.equal(teacher.details.length, 4);
  assert(teacher.details.every(detail => detail.kelas === 'X, Y' && detail.jam_ke === '1' && detail.mapel === 'Tugas Piket'));
});

test('full, per-JP, per-class and per-grade holidays only exempt affected duties', async () => {
  const schedules = [1, 2].map(jam_ke => ({ nip: '1', hari: 'Senin', kelas: 'X', jam_ke, berlaku_mulai: '2020-01-01' }));
  const check = async holiday => (await fixture({ jadwal_piket: schedules, master_kelas: [{ nama: 'X', tingkat: 10 }], libur: [{ tanggal: new Date('2020-01-06'), ...holiday }] }).service.getStats('2020-01', '2020-01')).data.piket[0].count;
  assert.equal(await check({ jam_ke: 'Semua' }), 6);
  assert.equal(await check({ jam_ke: '1' }), 7);
  assert.equal(await check({ lingkup: 'kelas', target_kelas: ['X'], jam_ke: 'Semua' }), 6);
  assert.equal(await check({ lingkup: 'kelas', target_kelas: ['Y'], jam_ke: 'Semua' }), 8);
  assert.equal(await check({ lingkup: 'tingkat', target_kelas: ['10'] }), 6);
  assert.equal(await check({ lingkup: 'tingkat', target_kelas: ['11'] }), 8);
});

test('piket without a specific class is covered by a report in the same hour', async () => {
  const result = await fixture({ jadwal_piket: [{ nip: '1', hari: 'Senin', kelas: null, jam_ke: 1, berlaku_mulai: '2020-01-01' }],
    laporan_piket: [{ nip: '1', tanggal: '2020-01-06', laporan_piket_detail: [{ nama_kelas: 'X', jam_ke: '1' }] }],
  }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.piket[0].count, 3);
});

test('current-day duties are counted only after finishing in the school timezone', () => {
  const { calculateMissingPiket, schoolClock } = piketModule.exports;
  const clock = schoolClock(new Date('2026-10-20T16:30:00Z'), 'Asia/Makassar');
  assert.equal(clock.date, '2026-10-21'); assert.equal(clock.minutes, 30);
  const input = { schedules: [{ nip: '1', hari: 'Rabu', kelas: 'X', jam_ke: 1, waktu: '07:00 - 08:00', berlaku_mulai: '2026-10-01' }], reports: [], holidays: [], classes: [], start: '2026-10-21', end: '2026-10-31', today: clock.date, currentMinutes: clock.minutes };
  assert.equal(calculateMissingPiket(input).length, 0);
  assert.equal(calculateMissingPiket({ ...input, currentMinutes: 479 }).length, 0);
  assert.equal(calculateMissingPiket({ ...input, currentMinutes: 480 }).length, 1);
  input.schedules[0].waktu = '';
  assert.equal(calculateMissingPiket({ ...input, currentMinutes: 1439 }).length, 0);
  assert.equal(calculateMissingPiket({ ...input, today: '2026-10-22' }).length, 1);
});

test('future versions and future periods produce no premature missed duty', () => {
  const { calculateMissingPiket } = piketModule.exports;
  const input = { schedules: [{ nip: '1', hari: 'Senin', kelas: 'X', jam_ke: 1, berlaku_mulai: '2026-11-01' }], reports: [], holidays: [], classes: [], start: '2026-10-01', end: '2026-10-31', today: '2026-10-21', currentMinutes: 1000 };
  assert.equal(calculateMissingPiket(input).length, 0);
  assert.equal(calculateMissingPiket({ ...input, start: '2026-11-01', end: '2026-11-30' }).length, 0);
});

test('a duty without a specified class is not covered by an unrelated teacher report', async () => {
  const result = await fixture({ jadwal_piket: [{ nip: '1', hari: 'Senin', kelas: null, jam_ke: 1, berlaku_mulai: '2020-01-01' }],
    laporan_piket: [{ nip: '2', tanggal: '2020-01-06', laporan_piket_detail: [{ nama_kelas: 'X', jam_ke: '1' }] }],
  }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.piket[0].count, 4);
});

test('permission for another NIP is not attached solely because teacher names match', async () => {
  const result = await fixture({ master_guru: [{ nip: '1', nama_lengkap: 'Guru A, S.Pd.' }],
    izin_guru: [{ id: 'wrong', nip: '2', nama_guru: 'Guru A, S.Pd.', tanggal_mulai: new Date('2020-01-06'), tanggal_selesai: new Date('2020-01-06'), status: 'disetujui', jenis: 'izin' }],
  }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.piket[0].details.find(detail => detail.tanggal === '2020-01-06').izin, null);
});

test('Daring is returned with matching counts, identity and details, without duplicate status counts', async () => {
  const result = await fixture({ jurnal_guru: [{ id: 'online', nip: '1', nama_guru: 'Guru A', tanggal: new Date('2020-01-06'),
    jam_ke: '1', jam_ke_id: 1, kelas: 'X', kategori_kehadiran: ' DARING ', status_tambahan_1: 'Daring' }] }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.daring.length, 1);
  assert.equal(result.data.daring[0].nip, '1');
  assert.equal(result.data.daring[0].count, 1);
  assert.equal(result.data.daring[0].details.filter(detail => detail.type === 'Daring').length, 1);
});

test('Daring by a substitute is attributed to the substitute', async () => {
  const result = await fixture({ jurnal_guru: [{ id: 'online-substitute', nip: '1', nama_guru: 'Guru A', guru_pengganti: 'Guru B',
    tanggal: new Date('2020-01-06'), jam_ke: '1', jam_ke_id: 1, kelas: 'X', kategori_kehadiran: 'Tukaran', status_pengganti: 'Daring' }] }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.daring[0].nip, '2'); assert.equal(result.data.daring[0].count, 1);
});
test('daring attendance is counted per teacher and exposed in the daring category', async () => {
  const j = (id, jam, kategori) => ({ id, nip: '1', nama_guru: 'Guru A', tanggal: new Date('2020-01-06'), jam_ke_id: jam, kategori_kehadiran: kategori });
  const result = await fixture({ jurnal_guru: [j('a', '1', 'Daring'), j('b', '2', 'Daring'), j('c', '3', 'Sesuai')] }).service.getStats('2020-01', '2020-01');
  assert.equal(result.data.daring.length, 1);
  assert.equal(result.data.daring[0].nip, '1');
  assert.equal(result.data.daring[0].count, 2);
  assert.equal(result.data.daring[0].details.filter(d => d.type === 'Daring').length, 2);
});

test('versi piket dihitung terpisah dari jurnal, per kejadian, dengan identitas dari nama atau jadwal', async () => {
  const laporan = [{ tanggal: new Date('2020-01-06'), nama_guru_piket: 'Guru Piket', laporan_piket_detail: [
    { nama_kelas: 'X', jam_ke: '1', nama_guru: 'Guru A', status_kehadiran: 'Terlambat' },
    { nama_kelas: 'X', jam_ke: '1', nama_guru: 'Guru A', status_kehadiran: 'Terlambat' }, // duplikat slot
    { nama_kelas: 'Y', jam_ke: '2', nama_guru: 'Guru A', status_kehadiran: 'Hadir', status_tambahan_1: 'Terlambat' },
    { nama_kelas: 'Z', jam_ke: '3', nama_guru: '', status_kehadiran: 'Kosong' },
    { nama_kelas: 'X', jam_ke: '4', nama_guru: 'Guru B', status_kehadiran: 'Hadir' },
  ] }];
  const f = fixture({ laporan_piket: laporan, jurnal_guru: [{ id: 'j', nip: '1', nama_guru: 'Guru A', tanggal: new Date('2020-01-06'),
    jam_ke_id: 1, kelas: 'X', kategori_kehadiran: 'Terlambat', durasi_terlambat: 20 }] });
  f.service.jadwalService.getJadwal = async () => ({ data: [{ nip: '2', nama_guru: 'Guru B', hari: 'Senin', jam_ke: '3', kelas: 'Z' }] });
  const result = await f.service.getStats('2020-01', '2020-01');
  // Versi jurnal tetap memakai menit dan tidak tercampur data piket.
  assert.equal(result.data.terlambat[0].count, 20);
  assert.equal(result.data.jamKosong.length, 0);
  // Versi piket: hitungan kejadian.
  assert.equal(result.dataPiket.terlambat[0].nip, '1');
  assert.equal(result.dataPiket.terlambat[0].count, 2);
  assert(result.dataPiket.terlambat[0].details.every(d => d.sumber === 'Piket' && d.type === 'Terlambat'));
  assert.equal(result.dataPiket.jamKosong[0].nip, '2');
  assert.equal(result.dataPiket.jamKosong[0].count, 1);
  assert.equal(result.dataPiket.daring.length, 0);
});
