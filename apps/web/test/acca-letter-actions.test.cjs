const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/app/ketidakhadiran/letter-access.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: mod, exports: mod.exports });
const { canDeleteLetter } = mod.exports;
const service = fs.readFileSync('apps/api/src/ketidakhadiran/ketidakhadiran.service.ts', 'utf8');
const start = service.indexOf('    const roles = user.roles || [];', service.indexOf('async deleteAccaLetter('));
const end = service.indexOf('    await this.prisma.acca_letters.delete', start);
assert.ok(start >= 0 && end > start);
const backendAllows = vm.runInNewContext(`(user, letter) => { ${service.slice(start, end)} return { ok: true }; }`);

for (const roles of [[], ['GURU'], ['ADMIN'], ['ADMINISTRATOR'], ['OP_IZIN'], ['OP_UKS'], ['OP_IZIN', 'OP_UKS']]) {
    test(`delete action matches backend permission for ${roles.join(',') || 'no role'}`, () => {
        for (const jenis_izin of ['MENINGGALKAN_ASRAMA', 'P', 'M', 'REKAPAN_IZIN', 'IZIN', 'REKOMENDASI_KONTROL', 'REKAM_MEDIK', 'REKAPAN_SAKIT', 'UKS', 'SAKIT', 'UNKNOWN']) {
            for (const nomor_surat of ['001/IZIN/2026', '001/UKS/2026']) {
                const letter = { jenis_izin, nomor_surat };
                const access = { isAdmin: roles.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r)), canManageIzin: roles.includes('OP_IZIN'), canManageSakit: roles.includes('OP_UKS') };
                assert.equal(canDeleteLetter(letter, access), backendAllows({ roles }, letter).ok, `${jenis_izin} ${nomor_surat}`);
            }
        }
    });
}
test('server-provided admin flag retains the same full permission', () => {
    const letter = { jenis_izin: 'UKS', nomor_surat: '001/UKS/2026' };
    assert.equal(canDeleteLetter(letter, { isAdmin: true, canManageIzin: false, canManageSakit: false }), backendAllows({ roles: [], isAdmin: true }, letter).ok);
});
