const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const helpers = ts.transpileModule(fs.readFileSync('apps/web/lib/payment-period.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleBox = { exports: {} };
vm.runInNewContext(helpers, { module: moduleBox, exports: moduleBox.exports, Date, Intl });
const { matchesPaymentPeriod, paymentDatePeriod } = moduleBox.exports;

test('month and year filters work independently and together', () => {
    const period = { bulan: 10, tahun: 2026 };
    assert.equal(matchesPaymentPeriod(period, 10, 2026), true);
    assert.equal(matchesPaymentPeriod(period, 0, 2026), true);
    assert.equal(matchesPaymentPeriod(period, 10, 0), true);
    assert.equal(matchesPaymentPeriod(period, 0, 0), true);
    assert.equal(matchesPaymentPeriod(period, 11, 2026), false);
    assert.equal(matchesPaymentPeriod(period, 10, 2025), false);
});

test('session calendar dates retain their month regardless of local timezone', () => {
    const period = paymentDatePeriod('2026-10-31T00:00:00.000Z', true);
    assert.equal(period.bulan, 10);
    assert.equal(period.tahun, 2026);
    for (const invalid of ['', 'invalid', '2026-13-01', '2026-02-30']) {
        assert.equal(paymentDatePeriod(invalid, true), null);
    }
});

test('tariff timestamps cross month and year boundaries in WITA', () => {
    const period = paymentDatePeriod('2026-12-31T17:00:00Z');
    assert.equal(period.bulan, 1);
    assert.equal(period.tahun, 2027);
    assert.equal(paymentDatePeriod(null), null);
    assert.equal(matchesPaymentPeriod(null, 0, 0), true);
    assert.equal(matchesPaymentPeriod(null, 10, 2026), false);
});

// Evaluate the actual page's selectors to check that rows, payment groups, cards,
// and recap totals all consume the same period rather than the unfiltered data.
function pageData(periodMonth, periodYear, { legacy = false, rateMultiplier = 1 } = {}) {
    const source = fs.readFileSync('apps/web/app/pembayaran/view.tsx', 'utf8');
    const tree = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const component = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'PembayaranPage');
    const names = new Set(['periodSubmissions', 'periodKlinikSlots', 'periodEkskulSubmissions', 'klinikRows', 'rekapan']);
    const selectors = component.body.statements.filter(n => ts.isVariableStatement(n)
        && n.declarationList.declarations.some(d => names.has(d.name.getText(tree)))).map(n => n.getText(tree)).join('\n');
    const js = ts.transpileModule(selectors + '\nglobalThis.result = { periodSubmissions, periodEkskulSubmissions, periodKlinikSlots, klinikRows, rekapan };', {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = {
        periodMonth, periodYear, matchesPaymentPeriod, paymentDatePeriod, useMemo: fn => fn(),
        filterBayar: 'ALL', klinikFilterBayar: 'ALL', ekskulFilterBayar: 'ALL', searchQuery: '', klinikSearchQuery: '', ekskulSearchQuery: '',
        submissions: [
            { id: 'g-oct', bulan: 10, tahun: 2026, dibayarkan: true, catatan_pembayaran: legacy ? null : '{"nominal":200000}' },
            { id: 'g-nov', bulan: 11, tahun: 2026, dibayarkan: false },
        ],
        ekskulSubmissions: [
            { id: 'e-oct', bulan: 10, tahun: 2026, dibayarkan: true, jml_internal: 2, jml_eksternal: 1, catatan_pembayaran: legacy ? null : '{"nominal":200000}' },
            { id: 'e-old', bulan: 10, tahun: 2025, dibayarkan: true, jml_internal: 10, catatan_pembayaran: legacy ? null : '{"nominal":500000}' },
        ],
        klinikSlots: [
            { id: 'k-oct', guru_id: 1, tanggal: '2026-10-01', status: 'paid', nominal_dibayarkan: 75000 },
            { id: 'k-oct-unpaid', guru_id: 1, tanggal: '2026-10-05', status: 'finished' },
            { id: 'k-nov-unpaid', guru_id: 1, tanggal: '2026-11-05', status: 'finished' },
            { id: 'k-nov', guru_id: 1, tanggal: '2026-11-01', status: 'paid', nominal_dibayarkan: 100000 },
        ],
        tarifList: [{ id: 't-oct', updated_at: '2026-09-30T17:00:00Z' }, { id: 't-old', updated_at: '2025-10-01T00:00:00Z' }],
        getTarif: key => rateMultiplier * ({ GURU_ASUH: 200000, EKSKUL_INTERNAL: 50000, EKSKUL_EKSTERNAL: 100000 }[key] || 75000),
        getCatatanData: raw => ({ text: '', url: '', nominal: null, ...(raw ? JSON.parse(raw) : {}) }), parseNominal: Number,
        klinikEvidence: {}, klinikProofs: () => [], fmtTanggal: String, fmtRupiah: String,
    };
    vm.runInNewContext(js, context);
    return context.result;
}

test('routine rows, payment groups, and recap respect the chosen period', () => {
    const data = pageData(10, 2026);
    assert.equal(data.periodSubmissions.length, 1);
    assert.equal(data.periodEkskulSubmissions.length, 1);
    assert.equal(data.periodKlinikSlots.length, 2);
    assert.equal(data.klinikRows.reduce((n, row) => n + row.sessions.length, 0), 2);
    const pending = data.klinikRows.find(row => !row.paid).sessions;
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, 'k-oct-unpaid');
    assert.equal(data.rekapan.categories.find(c => c.key === 'GURU_ASUH').total, 200000);
    assert.equal(data.rekapan.categories.find(c => c.key === 'KLINIK').total, 75000);
    assert.equal(data.rekapan.categories.find(c => c.key === 'EKSKUL').total, 200000);
    assert.equal(data.rekapan.total, 475000);
});

test('all-period and empty-period selections produce consistent rows and totals', () => {
    const all = pageData(0, 0);
    assert.equal(all.periodSubmissions.length, 2);
    assert.equal(all.periodKlinikSlots.length, 4);
    assert.equal(all.periodEkskulSubmissions.length, 2);
    assert.equal(all.rekapan.total, 1075000);
    const empty = pageData(1, 2030);
    assert.equal(empty.periodSubmissions.length, 0);
    assert.equal(empty.klinikRows.length, 0);
    assert.equal(empty.rekapan.total, 0);
});
test('recap uses historical snapshots and explicitly counts missing amounts instead of current tariffs', () => {
    assert.equal(pageData(10,2026,{rateMultiplier:100}).rekapan.total,475000);
    const legacy=pageData(10,2026,{legacy:true});
    assert.equal(legacy.rekapan.total,75000);
    assert.equal(legacy.rekapan.missing,2);
});
