const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('reflect-metadata');
const nest = require('@nestjs/common');

const NOW = '2026-10-25T16:30:00.000Z';
class SchoolDate extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return new Date(NOW).getTime(); }
}
function load(file, imports = {}) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
    }).outputText, {
        module, exports: module.exports, Date: SchoolDate, process: { env: {} },
        require: name => imports[name] || (name === '@nestjs/common' ? nest : {}),
    });
    return module.exports;
}
const { JurnalService } = load('apps/api/src/jurnal/jurnal.service.ts');
const { PegawaiGuard } = load('apps/api/src/auth/pegawai.guard.ts');
const { PageAccessGuard, RequiresPage, PAGE_ACCESS_KEY } = load('apps/api/src/auth/page-access.guard.ts');
const { JurnalController } = load('apps/api/src/jurnal/jurnal.controller.ts', {
    '../auth/jwt-auth.guard': { JwtAuthGuard: class {} },
    '../auth/pegawai.guard': { PegawaiGuard },
    '../auth/page-access.guard': { PageAccessGuard, RequiresPage },
    '../auth/feature-access.guard': { FeatureAccess: () => () => {}, FeatureAccessGuard: class {} },
});

const teachers = [
    { id: 1n, nip: 'A', nama_lengkap: 'Guru A', aktif: true, jenis_pegawai: 'GURU' },
    { id: 2n, nip: 'B', nama_lengkap: 'Guru B', aktif: true, jenis_pegawai: '' },
    { id: 3n, nip: 'C', nama_lengkap: 'Guru C', aktif: false, jenis_pegawai: 'GURU' },
    { id: 4n, nip: 'D', nama_lengkap: 'Tendik D', aktif: true, jenis_pegawai: 'TENDIK' },
];
const permit = (id, nip, jenis, start, end, status = 'disetujui') => ({
    id, nip, jenis, tanggal_mulai: new Date(start), tanggal_selesai: new Date(end), status,
    keterangan: 'Rahasia pribadi', surat_tugas_url: 'https://private.example/surat.pdf', approved_by_nip: 'Rahasia',
});
const permits = [
    permit('a1', 'A', 'izin', '2026-09-30', '2026-10-26'),
    permit('a2', 'A', 'izin', '2026-10-26', '2026-10-26'),
    permit('a3', 'A', 'dinas_luar', '2026-10-26', '2026-11-01'),
    permit('b1', 'B', 'sakit', '2026-10-26', '2026-10-27'),
    permit('pending', 'B', 'izin', '2026-10-26', '2026-10-26', 'pending'),
    permit('rejected', 'B', 'dinas_luar', '2026-10-26', '2026-10-26', 'ditolak'),
    permit('past', 'B', 'izin', '2026-10-01', '2026-10-25'),
    permit('future', 'B', 'izin', '2026-10-27', '2026-10-31'),
    permit('inactive', 'C', 'izin', '2026-10-26', '2026-10-26'),
    permit('staff', 'D', 'izin', '2026-10-26', '2026-10-26'),
];
function fixture(timezone = 'Asia/Makassar') {
    const calls = [];
    const prisma = {
        site_settings: { findUnique: async () => ({ value: timezone }) },
        master_guru: { findMany: async args => {
            calls.push(['teachers', args]);
            assert.equal(args.where.aktif, true);
            assert(args.where.OR.some(r => r.jenis_pegawai?.equals === 'GURU'));
            assert(args.where.OR.some(r => r.jenis_pegawai === ''));
            return teachers.filter(t => t.aktif && ['', 'GURU'].includes(t.jenis_pegawai));
        } },
        izin_guru: { findMany: async args => {
            calls.push(['permits', args]);
            const w = args.where;
            assert.equal(w.status, 'disetujui');
            assert.deepEqual(Array.from(w.jenis.in), ['izin', 'sakit', 'dinas_luar']);
            return permits.filter(p => w.nip.in.includes(p.nip) && p.status === w.status && w.jenis.in.includes(p.jenis)
                && p.tanggal_mulai <= w.tanggal_mulai.lte && p.tanggal_selesai >= w.tanggal_selesai.gte);
        } },
    };
    return { service: new JurnalService(prisma, {}), calls };
}

test('daily attendance includes approved spanning and boundary dates, counts each active teacher once', async () => {
    const { service, calls } = fixture();
    const result = await service.getKehadiranGuru('2026-10-26');
    assert.equal(result.tanggal, '2026-10-26');
    assert.deepEqual(JSON.parse(JSON.stringify(result.ringkasan)), { total: 2, izin: 1, sakit: 1, dinas_luar: 1 });
    assert.deepEqual(Array.from(result.guru, g => g.nama), ['Guru A', 'Guru B']);
    assert.deepEqual(Array.from(result.guru[0].izin, i => i.id), ['a1', 'a2', 'a3']);
    assert.deepEqual(Array.from(result.guru[1].izin, i => i.id), ['b1']);
    assert.equal(result.guru[0].id, '1');
    assert(!JSON.stringify(result).includes('Rahasia'));
    assert(!JSON.stringify(result).includes('surat_tugas_url'));
    assert(!JSON.stringify(result).includes('"nip"'));
    assert.deepEqual(Object.keys(calls[1][1].select).sort(), ['id', 'jenis', 'nip', 'tanggal_mulai', 'tanggal_selesai']);
});

test('today follows school timezone across midnight and selected date does not drift', async () => {
    assert.equal((await fixture().service.getKehadiranGuru()).tanggal, '2026-10-26');
    assert.equal((await fixture('Asia/Jakarta').service.getKehadiranGuru()).tanggal, '2026-10-25');
    assert.equal((await fixture('invalid/timezone').service.getKehadiranGuru()).timezone, 'Asia/Makassar');
    assert.equal((await fixture('Asia/Jayapura').service.getKehadiranGuru('2026-09-30')).tanggal, '2026-09-30');
    assert.equal((await fixture().service.getKehadiranGuru('2026-12-01')).ringkasan.total, 0);
});

test('bad dates are rejected before database work', async () => {
    const { service, calls } = fixture();
    for (const date of ['bad', '2026-02-30', '2026-13-01', '2026-10-26T08:00:00Z', ['2026-10-26'], '1999-01-01']) {
        await assert.rejects(service.getKehadiranGuru(date), err => err.getStatus() === 400);
    }
    assert.equal(calls.length, 0);
});

test('the endpoint requires staff and journal page access without weakening the izin-guru API', async () => {
    const handler = JurnalController.prototype.getKehadiranGuru;
    const guards = Reflect.getMetadata('__guards__', handler);
    assert(guards.includes(PegawaiGuard));
    assert(guards.includes(PageAccessGuard));
    assert.deepEqual(Array.from(Reflect.getMetadata(PAGE_ACCESS_KEY, handler)), ['jurnal']);
    const context = user => ({ switchToHttp: () => ({ getRequest: () => ({ user, headers: {} }) }) });
    const guard = new PegawaiGuard();
    for (const roles of [['SISWA'], ['SISWA', 'PENGURUS_KELAS'], ['ORANG_TUA'], ['TAMU'], []]) {
        assert.throws(() => guard.canActivate(context({ roles })), err => err.getStatus() === 403);
    }
    assert.equal(guard.canActivate(context({ roles: ['GURU'] })), true);
    const pageGuard = new PageAccessGuard({ getAllAndOverride: () => ['jurnal'] }, { resolveUserAccess: async () => ({ roles: ['GURU'], pageIds: [] }) });
    await assert.rejects(pageGuard.canActivate({ ...context({ roles: ['GURU'] }), getHandler: () => handler, getClass: () => JurnalController }), err => err.getStatus() === 403);
});
