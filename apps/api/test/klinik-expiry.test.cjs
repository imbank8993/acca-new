const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const apiModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/klinik/klinik.service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText, {
    module: apiModule, exports: apiModule.exports, Date, console,
    require(name) {
        if (name === '@nestjs/common') return require(name);
        if (name === '../access/access.service') return { can: () => true };
        return {};
    },
});

const file = 'apps/web/app/klinik/view.tsx';
const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helpers = tree.statements.filter(node => ts.isFunctionDeclaration(node) && ['formatJam', 'waktuMulaiSesi', 'pengajuanKadaluarsa'].includes(node.name?.text));
const uiModule = { exports: {} };
vm.runInNewContext(ts.transpileModule("const STATUS_PENGAJUAN=['pending','pending_guru'];\n" + helpers.map(node => node.getText(tree)).join('\n') + '\nmodule.exports.expired=pengajuanKadaluarsa;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: uiModule, exports: uiModule.exports });

for (const initiator of ['SISWA', 'GURU']) {
    test(`expired ${initiator} requests are marked consistently and cannot be approved`, async () => {
        for (const status of ['pending', 'pending_guru']) {
            const slot = { id: 's1', status, initiator_type: initiator, tanggal: '2000-01-01', jam_mulai: '08:00:00', klinik_peserta: [] };
            assert.equal(uiModule.exports.expired(slot, '2026-10-22T08:00'), true);
            let writes = 0;
            const db = { from(table) {
                const chain = { select() { return this; }, eq() { return this; }, update() { writes++; return this; }, async single() { return { data: slot }; }, async maybeSingle() { return { data: table === 'site_settings' ? { value: 'Asia/Makassar' } : slot }; } };
                return chain;
            } };
            const action = status === 'pending_guru' ? 'approve_guru' : 'approve_slot';
            const payload = status === 'pending_guru' ? { guruAction: 'terima' } : { status: 'open' };
            await assert.rejects(apiModule.exports.handlePatch({ user: { roles: ['ADMIN'] } }, action, 's1', payload, db), error => error.getStatus() === 409 && error.getResponse().code === 'KLINIK_KADALUARSA');
            assert.equal(writes, 0);
            if (status === 'pending_guru') {
                await assert.rejects(apiModule.exports.handlePatch({ user: { roles: ['SISWA'] } }, action, 's1', payload, db), error => error.getStatus() === 403);
                assert.equal(writes, 0);
            }
            if (status === 'pending') {
                assert.equal((await apiModule.exports.handlePatch({ user: { roles: ['ADMIN'] } }, action, 's1', { status: 'cancelled' }, db)).ok, true);
                assert.equal(writes, 1, 'expired requests may still be rejected');
            }
            assert.equal(uiModule.exports.expired({ ...slot, tanggal: '2100-01-01' }, '2026-10-22T08:00'), false);
            assert.equal(uiModule.exports.expired({ ...slot, status: 'open' }, '2026-10-22T08:00'), false);
        }
    });
}
