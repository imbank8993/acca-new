const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const target = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('apps/web/app/monitoring/laporan/report-order.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('module', 'exports', code)(target, target.exports);
const { sortReports, reportPeriod } = target.exports;

for (const [module, nameField] of [['GURU_ASUH', 'nama_guru_snap'], ['KLINIK', 'nama_guru'], ['EKSKUL', 'pembina_nama']]) {
    test(`${module}: months descend, names ascend, and one teacher's reports stay together`, () => {
        const rows = [
            { id: 'older', tahun: 2025, bulan: 10, tanggal: '2025-10-31', [nameField]: 'Ani' },
            { id: 'z', tahun: 2026, bulan: 10, tanggal: '2026-10-31', [nameField]: 'Zain' },
            { id: 'a1', tahun: 2026, bulan: 10, tanggal: '2026-10-01', [nameField]: ' Ani ', nip: '1' },
            { id: 'sept', tahun: 2026, bulan: 9, tanggal: '2026-09-30', [nameField]: 'Ani' },
            { id: 'a2', tahun: 2026, bulan: 10, tanggal: '2026-10-15', [nameField]: 'ani', nip: '1' },
        ];
        const before = JSON.stringify(rows);
        const sorted = sortReports(rows, module);
        assert.deepEqual(sorted.slice(0, 2).map(r => r.id).sort(), ['a1', 'a2']);
        assert.deepEqual(sorted.slice(2).map(r => r.id), ['z', 'sept', 'older']);
        assert.equal(JSON.stringify(rows), before);
        assert.equal(sorted.length, rows.length);
    });
}

test('clinic month uses the recorded calendar date regardless of timezone', () => {
    assert.deepEqual(reportPeriod({ tanggal: '2026-10-31T23:30:00.000Z' }, 'KLINIK'), { year: 2026, month: 10, key: '2026-10' });
});

test('unknown periods are grouped last without dropping reports', () => {
    const sorted = sortReports([{ id: 'missing' }, { id: 'valid', bulan: '10', tahun: '2026' }, { id: 'invalid', bulan: 13, tahun: 2026 }], 'GURU_ASUH');
    assert.equal(sorted[0].id, 'valid');
    assert.equal(sorted.length, 3);
    assert.equal(reportPeriod(sorted[1], 'GURU_ASUH').key, 'unknown');
});
