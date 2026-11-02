const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function dashboardFor(user) {
    const module = { exports: {} };
    const imports = {
        '@/components/UserContext': { useDashboardUser: () => ({ user }) },
        './DashboardContent': { default: 'staff-dashboard' },
        './ParentDashboard': { default: 'parent-dashboard' },
        'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    };
    const source = fs.readFileSync('apps/web/app/(dashboard)/dashboard/page.tsx', 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, { module, exports: module.exports, require: name => {
        assert.ok(imports[name], `Unexpected import: ${name}`);
        return imports[name];
    } });
    return module.exports.default().type;
}

test('Mujahidin and other homeroom teachers receive the staff dashboard', () => {
    const role = 'GURU,WALI_KELAS,PROKTOR';
    assert.equal(dashboardFor({ role, roles: role.split(',') }), 'staff-dashboard');
    assert.equal(dashboardFor({ role }), 'staff-dashboard');
    assert.equal(dashboardFor({ role: ' wali kelas | guru ' }), 'staff-dashboard');
});

test('explicit parent roles still receive the parent dashboard', () => {
    for (const role of ['ORANG_TUA', 'ORANGTUA', 'WALI']) {
        assert.equal(dashboardFor({ role: `GURU,${role}` }), 'parent-dashboard');
        assert.equal(dashboardFor({ role: `guru | ${role.toLowerCase()} ` }), 'parent-dashboard');
        assert.equal(dashboardFor({ roles: [role], role: 'GURU' }), 'parent-dashboard');
    }
    assert.equal(dashboardFor({ role: 'Orang Tua' }), 'parent-dashboard');
});

test('missing roles and unrelated roles do not open the parent dashboard', () => {
    for (const user of [undefined, {}, { role: 'SISWA' }, { role: 'ADMIN' }, { role: 'WALI_ASRAMA' }]) {
        assert.equal(dashboardFor(user), 'staff-dashboard');
    }
});
