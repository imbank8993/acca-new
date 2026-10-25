const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

const id = '00000000-0000-4000-8000-000000000001';
function route({ valid = true, status = 'FINAL', file = '%PDF-1.7\nfixture', missing = false } = {}) {
    const calls = [];
    const mod = { exports: {} };
    const imports = {
        'next/server': { NextResponse },
        '@/lib/nest-api': { nestFetchAsUser: async (url, token) => {
            calls.push(['verify', url, token]);
            return { status: 200, body: { ok: !missing, valid, surat: missing ? null : { status, file_url: 'https://files.example/surat.pdf' } } };
        } },
        '@/lib/proxy-guard': { fetchSafeFile: async url => {
            calls.push(['file', url]);
            return new Response(file, { headers: { 'Content-Type': 'application/pdf' } });
        } },
    };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/app/api/public/surat/file/route.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { module: mod, exports: mod.exports, URL, TextDecoder, require: name => imports[name] });
    return { calls, get: query => mod.exports.GET(new NextRequest('https://acca.icgowa.sch.id/api/public/surat/file?' + query)) };
}

test('public PDF preview accepts a verified letter without a login and ignores caller-supplied storage URLs', async () => {
    const r = route();
    const response = await r.get(`id=${id}&url=http://127.0.0.1/private`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('content-disposition'), /^inline;/);
    assert.equal(await response.text(), '%PDF-1.7\nfixture');
    assert.deepEqual(r.calls, [['verify', '/surat/verify?letter_id=' + id, ''], ['file', 'https://files.example/surat.pdf']]);
    assert.match((await r.get(`id=SRT-${id}&download=1`)).headers.get('content-disposition'), /^attachment;/);
});

test('malformed IDs, unpublished letters and missing letters never fetch a stored file', async () => {
    const bad = route();
    assert.equal((await bad.get('id=bad')).status, 400);
    assert.equal(bad.calls.length, 0);
    for (const config of [{ valid: false }, { status: 'DRAFT' }, { missing: true }]) {
        const r = route(config);
        assert([403, 404].includes((await r.get('id=' + id)).status));
        assert(!r.calls.some(call => call[0] === 'file'));
    }
});

test('storage HTML is rejected instead of being shown as a public PDF', async () => {
    const response = await route({ file: '<html>storage error</html>' }).get('id=' + id);
    assert.equal(response.status, 422);
});

test('verification page accepts the backend surat response and keeps unpublished records invalid', async () => {
    const source = fs.readFileSync('apps/web/app/verifikasi/page.tsx', 'utf8');
    const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let loader;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'fetchVerification') loader = node.initializer.getText(tree);
        ts.forEachChild(node, visit);
    }
    visit(tree); assert(loader);
    for (const valid of [true, false]) {
        const states = {};
        const run = vm.runInNewContext(ts.transpileModule(`(${loader})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
            letterId: id, Date,
            fetch: async () => ({ ok: true, json: async () => ({ ok: true, found: true, valid, surat: { id, pejabat_nama: 'Guru A', pejabat_jabatan: 'Wakamad', file_url: 'file.pdf' } }) }),
            setLoading: value => { states.loading = value; }, setError: value => { states.error = value; }, setData: value => { states.data = value; },
        });
        await run();
        assert.equal(states.loading, false);
        if (valid) {
            assert.equal(states.data.letter.penandatangan.nama, 'Guru A');
            assert.equal(states.data.letter.id, id);
        } else {
            assert.equal(states.data, null);
            assert.match(states.error, /belum dipublikasikan/);
        }
    }
});
