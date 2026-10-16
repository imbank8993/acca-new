const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Workbook } = require('exceljs');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
const catalog = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync('apps/api/src/bank-data/datasets.ts', 'utf8')), { module: catalog, exports: catalog.exports });
const moduleUnderTest = { exports: {} };
const errors = Object.fromEntries(['BadRequestException', 'ForbiddenException'].map(name => { class E extends Error { constructor(message) { super(message); this.name = name; } } return [name, E]; }));
class StreamableFile { constructor(buffer) { this.buffer = buffer; } }
vm.runInNewContext(compile(fs.readFileSync('apps/api/src/bank-data/bank-data.service.ts', 'utf8')), {
  module: moduleUnderTest, exports: moduleUnderTest.exports, Buffer, Date,
  require(name) {
    if (name === './datasets') return catalog.exports;
    if (name === '@nestjs/common') return { ...errors, StreamableFile, Injectable: () => value => value };
    if (name === '@prisma/client') return require('@prisma/client');
    if (name === 'exceljs') return { Workbook };
    return {};
  },
});
const actor = { id: '1', nama: 'Pengguna' };
function fixture({ config = { dataset_id: 'siswa', aktif: true, kolom_diizinkan: ['nama_lengkap', 'nisn'], batas_baris: 3 }, access = { roles: ['GURU'], caps: [], pageIds: ['bank-data'] } } = {}) {
  const records = [{ id: 1n, nama_lengkap: 'Andi', nisn: '001', nik: 'private' }, { id: 2n, nama_lengkap: 'Andi', nisn: '002', nik: 'secret' }, { id: 3n, nama_lengkap: 'Budi', nisn: '003' }, { id: 4n, nama_lengkap: '=SUM(A1)', nisn: '004' }];
  const logs = [], queries = [];
  const matches = (row, where = {}) => Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some(c => matches(row, c));
    if (condition && typeof condition === 'object') {
      if (condition.in) return condition.in.includes(row[key]);
      if (condition.contains !== undefined) return String(row[key] || '').toLowerCase().includes(condition.contains.toLowerCase());
      return row[key] === condition.equals;
    }
    return row[key] === condition;
  });
  const prisma = {
    site_settings: { findUnique: async () => null },
    role_pages: { findFirst: async () => { throw new Error('Must not bypass resolved access overrides'); } },
    bank_data_dataset_config: { findUnique: async () => config, findMany: async () => config ? [config] : [] },
    bank_data_log: { create: async q => { logs.push(q.data); return q.data; } },
    master_siswa: {
      count: async q => records.filter(row => matches(row, q.where)).length,
      findMany: async q => {
        queries.push(q);
        return records.filter(row => matches(row, q.where)).sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap) || Number(a.id - b.id)).slice(q.skip || 0, (q.skip || 0) + q.take).map(row => Object.fromEntries(Object.keys(q.select).map(k => [k, row[k]])));
      },
    },
    siswa_kelas: { findMany: async () => [{ nisn: '002', kelas: 'X A' }] },
  };
  return { service: new moduleUnderTest.exports.BankDataService(prisma, { resolveUserAccess: async () => access }), queries, logs };
}
const payload = { action: 'data', dataset_id: 'siswa', kolom: ['nama_lengkap', 'nisn'], filter: {}, halaman: 1, perHalaman: 2 };
const reject = (promise, name) => assert.rejects(promise, error => error.name === name);

function multiYearFixture() {
  const f = fixture();
  const memberships = [
    { nisn: '001', tahun_ajaran: '2025/2026', semester: 'Ganjil', kelas: 'X A', aktif: true },
    { nisn: '002', tahun_ajaran: '2026/2027', semester: 'Genap', kelas: 'X B', aktif: true },
    { nisn: '003', tahun_ajaran: '2024/2025', semester: 'Ganjil', kelas: 'X C', aktif: true },
  ];
  f.service.prisma.siswa_kelas.findMany = async query => memberships.filter(row =>
    Object.entries(query.where || {}).every(([key, condition]) =>
      condition && typeof condition === 'object' ? condition.in ? condition.in.includes(row[key]) : row[key] !== condition.not : row[key] === condition,
    ),
  );
  return f;
}

test('Pilihan beberapa tahun, semester dan kelas menyaring tabel serta ekspor secara sama', async () => {
  const f = multiYearFixture();
  const filter = { tahun_ajaran: ['2025/2026', '2026/2027'], semester: ['Ganjil', 'Genap'], kelas: ['X A', 'X B'] };
  const result = await f.service.handlePost({ ...payload, filter }, actor);
  assert.deepEqual(Array.from(result.data, row => row.nisn), ['001', '002']);
  const exported = await f.service.handlePost({ ...payload, action: 'export', filter }, actor);
  const workbook = new Workbook();
  await workbook.xlsx.load(exported.buffer);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['2025-2026', '2026-2027']);
  const nisnColumn = workbook.worksheets[0].getRow(1).values.indexOf('NISN');
  assert(nisnColumn > 0);
  assert.equal(workbook.worksheets[0].getRow(2).getCell(nisnColumn).value, '001');
  assert.equal(workbook.worksheets[1].getRow(2).getCell(nisnColumn).value, '002');
  const single = await f.service.handlePost({ ...payload, action: 'export', filter: { tahun_ajaran: ['2025/2026'] } }, actor);
  await workbook.xlsx.load(single.buffer);
  assert.equal(workbook.worksheets.length, 1);
  assert.equal(workbook.worksheets[0].name, '2025-2026');
});

test('Filter lama tetap didukung dan pilihan kosong berarti semua data', async () => {
  const f = multiYearFixture();
  const result = await f.service.handlePost({ ...payload, filter: { tahun_ajaran: '2025/2026', semester: 'Ganjil' } }, actor);
  assert.deepEqual(Array.from(result.data, row => row.nisn), ['001']);
  const all = await f.service.handlePost({ ...payload, filter: { tahun_ajaran: [], semester: [], kelas: [] } }, actor);
  assert.equal(all.total, 4);
});

test('Filter multiselect yang salah bentuk atau terlalu panjang ditolak', async () => {
  for (const filter of [
    { tahun_ajaran: [2026] }, { tahun_ajaran: { in: ['2026/2027'] } },
    { semester: ['Ganjil', 'Lainnya'] }, { semester: [1] },
    { tahun_ajaran: Array(51).fill('2026/2027') }, { tahun_ajaran: ['a'.repeat(51)] },
  ]) await reject(fixture().service.handlePost({ ...payload, filter }, actor), 'BadRequestException');
});

test('Dataset dan kolom yang tidak diizinkan ditolak pada tabel serta ekspor', async () => {
  for (const action of ['data', 'export', 'preview']) {
    await reject(fixture().service.handlePost({ ...payload, action, kolom: ['nik'] }, actor), 'ForbiddenException');
    await reject(fixture({ config: { aktif: false } }).service.handlePost({ ...payload, action }, actor), 'ForbiddenException');
  }
});
test('Kolom kosong tidak membuka kembali kolom bawaan', async () => {
  const f = fixture({ config: { dataset_id: 'siswa', aktif: true, kolom_diizinkan: [] } });
  assert(!(await f.service.getCatalog(actor)).data.some(d => d.id === 'siswa'));
  await reject(f.service.handlePost(payload, actor), 'ForbiddenException');
});
test('Kolom sensitif memerlukan izin khusus sekaligus izin konfigurasi', async () => {
  const config = { aktif: true, kolom_diizinkan: ['nik'], batas_baris: 3 };
  await reject(fixture({ config }).service.handlePost({ ...payload, kolom: ['nik'] }, actor), 'ForbiddenException');
  const f = fixture({ config, access: { roles: ['GURU'], caps: ['bank_data.export_sensitif'], pageIds: ['bank-data'] } });
  const result = await f.service.handlePost({ ...payload, kolom: ['nik'] }, actor);
  assert.equal(result.data[0].nik, undefined); // First sorted row has no NIK.
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0].filter._tipe, 'data');
});
test('Penolakan halaman tidak ditimpa oleh izin role lama', async () => {
  await reject(fixture({ access: { roles: ['GURU'], caps: [], pageIds: [] } }).service.handlePost(payload, actor), 'ForbiddenException');
});
test('Pagination stabil dan tidak melewati batas konfigurasi', async () => {
  const f = fixture();
  const result = await f.service.handlePost({ ...payload, halaman: 2 }, actor);
  assert.equal(result.total, 4); assert.equal(result.totalTersedia, 3); assert.equal(result.terpotong, true);
  assert.equal(result.data.length, 1);
  assert.equal(f.queries[0].skip, 2); assert.equal(f.queries[0].take, 1);
  assert.equal(f.queries[0].orderBy[1].id, 'asc');
  assert(!Object.hasOwn(result.data[0], 'id')); assert(!Object.hasOwn(result.data[0], 'nik'));
});
test('Pencarian hanya menggunakan kolom induk yang boleh ditampilkan', async () => {
  const f = fixture();
  const result = await f.service.handlePost({ ...payload, q: 'andi' }, actor);
  assert.equal(result.total, 2);
  assert.deepEqual(Object.keys(f.queries[0].where.OR[0]), ['nisn']);
  assert(!JSON.stringify(f.queries[0].where).includes('nik'));
});
test('Filter kelas mempersempit siswa sebelum pagination', async () => {
  const result = await fixture().service.handlePost({ ...payload, filter: { kelas: ['X A'], tahun_ajaran: '2026/2027', semester: 'Ganjil' } }, actor);
  assert.equal(result.total, 1); assert.equal(result.data[0].nisn, '002');
});
test('Filter, pencarian, dan pagination tidak valid ditolak', async () => {
  for (const change of [{ halaman: 0 }, { perHalaman: 101 }, { halaman: '1' }, { q: ['a'] }, { q: 'a'.repeat(101) }, { filter: [] }, { filter: false }, { filter: { semester: 'invalid' } }, { filter: { kelas: 'X A' } }, { filter: { kelas: false } }, { filter: { tahun_ajaran: 0 } }, { filter: { arbitrary: 'x' } }]) {
    await reject(fixture().service.handlePost({ ...payload, ...change }, actor), 'BadRequestException');
  }
});
test('Ekspor mencakup semua halaman sesuai pencarian dan tetap dibatasi', async () => {
  const f = fixture();
  const result = await f.service.handlePost({ ...payload, action: 'export', halaman: 2, q: 'andi' }, actor);
  const workbook = new Workbook(); await workbook.xlsx.load(result.buffer);
  assert.equal(workbook.worksheets[0].rowCount, 3);
  assert.equal(f.queries[0].take, 3); assert.equal(f.queries[0].skip, 0);
  assert.equal(f.logs[0].jumlah_baris, 2); assert.equal(f.logs[0].filter.q, 'andi');
  const full = await fixture().service.handlePost({ ...payload, action: 'export' }, actor);
  await workbook.xlsx.load(full.buffer); assert.equal(workbook.worksheets[0].rowCount, 4);
  assert.equal(workbook.worksheets[0].getCell('B2').type, 3); // Formula-looking text stays text.
});
test('Gagal mencatat pembacaan sensitif tidak mengembalikan data', async () => {
  const f = fixture({ config: { aktif: true, kolom_diizinkan: ['nik'] }, access: { roles: ['ADMIN'], caps: [], pageIds: [] } });
  // Inject log failure through a separate service wrapper.
  f.service.prisma.bank_data_log.create = async () => { throw new Error('Audit unavailable'); };
  await assert.rejects(f.service.handlePost({ ...payload, kolom: ['nik'] }, actor), /Audit unavailable/);
});
test('Semua tabel dan kolom katalog cocok dengan schema Prisma', () => {
  const models = require('@prisma/client').Prisma.dmmf.datamodel.models;
  const field = (table, name) => {
    const model = models.find(m => m.name === table);
    assert(model, `Model tidak ada: ${table}`);
    assert(model.fields.some(f => f.name === name), `Kolom tidak ada: ${table}.${name}`);
  };
  for (const def of Object.values(catalog.exports.DATASETS)) {
    field(def.table, 'id');
    for (const col of def.kolom) {
      if (!col.pendukung) { field(def.table, col.key); continue; }
      const p = col.pendukung;
      if (p.kunciInduk) field(def.table, p.kunciInduk);
      for (const key of ['kunciPendukung', 'kolomNilai', 'kolomTahunAjaran', 'kolomSemester', 'kolomAktif']) if (p[key]) field(p.table, p[key]);
      if (p.lewat) { field(p.lewat.table, p.lewat.kunci); field(p.lewat.table, p.lewat.kolomNilai); }
    }
    if (def.prasaring) for (const key of ['kolomKunci', 'kolomKelas', 'kolomTahunAjaran', 'kolomSemester', 'kolomAktif']) if (def.prasaring[key]) field(def.prasaring.table, def.prasaring[key]);
  }
});
