// Regresi: "Semua hadir → Simpan → Berhasil" tapi tidak ada yang tersimpan.
// Adapter DB mengembalikan BIGINT sebagai STRING; fixture di sini meniru itu
// (fixture lama memakai number sehingga bug-nya tidak pernah terlihat).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/klinik/klinik.service.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText, {
    module: mod, exports: mod.exports, URLSearchParams, Date, console,
    require(name) { if (name === '@nestjs/common') return require(name); if (name === '../access/access.service') return { can: u => !!u.manage }; return {}; },
});

function fixture({ guru = '9', actor = '9', manage = false, status = 'ongoing' } = {}) {
    const peserta = [
        { slot_id: 's1', siswa_id: '101', kehadiran: null },
        { slot_id: 's1', siswa_id: '102', kehadiran: null },
        { slot_id: 's1', siswa_id: '103', kehadiran: 'H' },
    ];
    const updates = [];
    const db = {
        from(table) {
            const filters = []; let mode = 'select', value;
            const q = {
                select() { return q; },
                eq(k, v) { filters.push(r => String(r[k]) === String(v)); return q; },
                // seperti adapter asli: parameter di-cast ::bigint, jadi '101' = 101
                in(k, vals) { filters.push(r => vals.map(String).includes(String(r[k]))); return q; },
                update(v) { mode = 'update'; value = v; return q; },
                maybeSingle() { return Promise.resolve(hasil(true)); },
                then(res, rej) { return Promise.resolve(hasil(false)).then(res, rej); },
            };
            function hasil(single) {
                if (table === 'users') return { data: { id: actor, nama: 'Guru' } };
                if (table === 'klinik_slots') return { data: { id: 's1', status, guru_id: guru } };
                const cocok = peserta.filter(r => filters.every(f => f(r)));
                if (mode === 'update') { updates.push({ value, ids: cocok.map(r => r.siswa_id) }); cocok.forEach(r => Object.assign(r, value)); return { error: null }; }
                return { data: single ? cocok[0] : cocok };
            }
            return q;
        },
    };
    const run = entries => mod.exports.handlePatch({ user: { authId: 'auth', roles: ['GURU'], manage } }, 'absen_guru', undefined, { slot_id: 's1', entries }, db);
    return { peserta, updates, run };
}

test('Semua hadir (siswa_id string dari API) benar-benar tersimpan', async () => {
    const f = fixture();
    const r = await f.run([{ siswa_id: '101', kehadiran: 'H' }, { siswa_id: '102', kehadiran: 'H' }, { siswa_id: '103', kehadiran: 'H' }]);
    assert.equal(r.ok, true);
    assert.equal(r.data.diproses, 3);
    assert.deepEqual(f.peserta.map(p => p.kehadiran), ['H', 'H', 'H']);
    assert.ok(f.peserta.every(p => p.kehadiran_sumber === 'GURU'));
});

test('siswa_id berupa number juga cocok', async () => {
    const f = fixture();
    const r = await f.run([{ siswa_id: 101, kehadiran: 'S' }, { siswa_id: 102, kehadiran: 'a' }]);
    assert.equal(r.data.diproses, 2);
    assert.equal(f.peserta[0].kehadiran, 'S');
    assert.equal(f.peserta[1].kehadiran, 'A');
});

test('mengosongkan kehadiran menghapus jejaknya', async () => {
    const f = fixture();
    await f.run([{ siswa_id: '103', kehadiran: null }]);
    assert.equal(f.peserta[2].kehadiran, null);
    assert.equal(f.peserta[2].kehadiran_sumber, null);
});

test('tidak ada entri yang cocok → error, bukan "berhasil" palsu', async () => {
    const f = fixture();
    await assert.rejects(f.run([{ siswa_id: '999', kehadiran: 'H' }]));
    assert.equal(f.updates.length, 0);
});

test('peserta asing dilewati, sisanya tetap tersimpan', async () => {
    const f = fixture();
    const r = await f.run([{ siswa_id: '101', kehadiran: 'H' }, { siswa_id: '999', kehadiran: 'H' }]);
    assert.equal(r.data.diproses, 1);
    assert.equal(r.data.diabaikan, 1);
});

test('guru lain ditolak; guru pengampu (id string) diterima', async () => {
    await assert.rejects(fixture({ actor: '7' }).run([{ siswa_id: '101', kehadiran: 'H' }]));
    const r = await fixture({ guru: '9', actor: '9' }).run([{ siswa_id: '101', kehadiran: 'H' }]);
    assert.equal(r.ok, true);
});

test('sesi lunas/batal tidak bisa diubah', async () => {
    for (const status of ['paid', 'cancelled']) {
        const f = fixture({ status });
        await assert.rejects(f.run([{ siswa_id: '101', kehadiran: 'H' }]));
        assert.equal(f.updates.length, 0);
    }
});
