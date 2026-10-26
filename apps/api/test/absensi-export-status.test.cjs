const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const moduleBox = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/absensi/absensi.service.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
}).outputText, {
    module: moduleBox, exports: moduleBox.exports, Date,
    require: name => name === '@nestjs/common' ? require(name) : name === 'crypto' ? require(name) : {},
});
const { AbsensiService } = moduleBox.exports;

async function exportFixture(statuses, mode = 'ADMIN', absenceKind) {
    const date = new Date('2026-09-09T00:00:00Z');
    const sessions = statuses.map((status, i) => ({ sesi_id: `s${i}`, tanggal: date, kelas: 'X A', status_sesi: 'FINAL', tahun_ajaran: '2026/2027' }));
    const details = statuses.map((status, i) => ({ sesi_id: `s${i}`, nisn: '001', nama_snapshot: 'Siswa Contoh', status }));
    const db = {
        libur: { findMany: async () => [] },
        siswa_kelas: { findMany: async () => [{ nisn: '001', nama_siswa: 'Siswa Contoh', kelas: 'X A' }] },
        wali_kelas: { findMany: async () => [{ nama_kelas: 'X A' }] },
        ketidakhadiran: { findMany: async () => absenceKind ? [{ id: 'permit', nisn: '001', kelas: 'X A', aktif: true, jenis: absenceKind, tgl_mulai: date, tgl_selesai: date, keterangan: 'Izin resmi' }] : [] },
        absensi_sesi: { findMany: async () => sessions },
        absensi_detail: { findMany: async () => details },
    };
    const result = await new AbsensiService(db).exportAbsensi({ isAdmin: mode === 'ADMIN', nip: 'wali' }, {
        mode, kelas: 'X A', year: '2026/2027', months: [9],
    });
    return result.data.find(s => s.tanggal === '2026-09-09').absensi_detail[0];
}

for (const mode of ['ADMIN', 'WALI']) {
    for (const status of ['HADIR', 'IZIN', 'SAKIT', 'ALPHA']) {
        test(`${mode} export preserves ${status} when other status categories are absent`, async () => {
            assert.equal((await exportFixture([status], mode)).status, status);
        });
    }
}

test('export keeps the majority status and existing tie priority, without inventing Alpha', async () => {
    assert.equal((await exportFixture(['HADIR', 'HADIR', 'ALPHA'])).status, 'HADIR');
    assert.equal((await exportFixture(['HADIR', 'ALPHA'])).status, 'ALPHA');
    assert.equal((await exportFixture(['IZIN', 'SAKIT'])).status, 'SAKIT');
});

test('official leave overrides class-session status and keeps its reference', async () => {
    const row = await exportFixture(['ALPHA'], 'ADMIN', 'IZIN');
    assert.equal(row.status, 'IZIN');
    assert.equal(row.ref_ketidakhadiran_id, 'permit');
    assert.equal(row.keterangan, 'Izin resmi');
});

test('a day without recorded sessions keeps the existing default and is never fabricated as Alpha', async () => {
    assert.equal((await exportFixture([])).status, 'HADIR');
});

test('admin multiselect exports each selected class and an empty month selection covers the school year', async () => {
    const classes = ['X A', 'X B'];
    const checkClasses = args => { assert.deepEqual(Array.from(args.where.kelas.in), classes); };
    const db = {
        libur: { findMany: async () => [] },
        siswa_kelas: { findMany: async args => { checkClasses(args); return classes.map((kelas, i) => ({ nisn: `00${i}`, nama_siswa: `Siswa ${i}`, kelas })); } },
        ketidakhadiran: { findMany: async args => { checkClasses(args); return []; } },
        absensi_sesi: { findMany: async args => { checkClasses(args); return []; } },
        absensi_detail: { findMany: async () => [] },
    };
    const result = await new AbsensiService(db).exportAbsensi({ isAdmin: true, nip: 'admin' }, {
        mode: 'ADMIN', kelas: classes, year: '2026/2027', months: [],
    });
    assert.equal(result.data.length, 730);
    assert.deepEqual(Array.from(new Set(result.data.map(s => s.kelas))), classes);
    assert(result.data.some(s => s.tanggal === '2026-07-01'));
    assert(result.data.some(s => s.tanggal === '2027-06-30'));
    assert(result.data.every(s => s.tanggal >= '2026-07-01' && s.tanggal <= '2027-06-30'));
    assert(result.data.every(s => s.absensi_detail.length === 1));
});
