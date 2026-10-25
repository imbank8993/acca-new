const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, extraExports = '') {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText + extraExports, { module, exports: module.exports, Date, require: name => imports[name] || {} });
    return module.exports;
}

test('documentation URLs remain stable across server/client renders and photo navigation', () => {
    const { getProxiedImageUrl } = load('apps/web/lib/image-utils.ts');
    const url = 'https://files.icgowa.sch.id/folder/photo.jpg';
    const first = getProxiedImageUrl(url, false);
    assert.equal(first, '/api/proxy/image?url=' + encodeURIComponent(url));
    assert.equal(getProxiedImageUrl(url, false), first);
    assert.match(getProxiedImageUrl(url), /&t=\d+$/);
    assert.equal(getProxiedImageUrl('https://example.com/photo.jpg', false), 'https://example.com/photo.jpg');
    assert.equal(getProxiedImageUrl(null, false), '');
});

test('malformed public report IDs return not-found before querying PostgreSQL', async () => {
    let queries = 0;
    const page = load('apps/web/app/piket/dokumentasi/[id]/page.tsx', {
        '@/lib/prisma': { prisma: { laporan_piket: { findUnique: async () => { queries++; return null; } } } },
        'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); } },
    });
    for (const id of ['not-a-uuid', "' OR 1=1", '']) {
        await assert.rejects(page.default({ params: Promise.resolve({ id }) }), /NOT_FOUND/);
    }
    assert.equal(queries, 0);
    await assert.rejects(page.default({ params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) }), /NOT_FOUND/);
    assert.equal(queries, 1);
});

test('piket documentation displays all attendance statuses and filters primary or additional Daring', () => {
    const reports = [{ id: 1, tanggal: '2026-10-09', nama_guru_piket: 'Petugas', details: [
        { id: 1, nama_kelas: 'XI A', nama_guru: 'Guru A', status_kehadiran: 'Sesuai', dokumentasi_url: 'a.jpg' },
        { id: 2, nama_kelas: 'XI B', nama_guru: 'Guru B', status_kehadiran: 'Daring', dokumentasi_url: 'b.jpg' },
        { id: 3, nama_kelas: 'XI C', nama_guru: 'Guru C', status_kehadiran: 'Sesuai', status_tambahan_1: 'Daring', dokumentasi_url: 'c.jpg' },
    ] }];
    function render(filter) {
        let stateIndex = 0;
        const states = ['', '', filter, 1, 10, null];
        const jsx = (type, props) => ({ type, props: props || {} });
        const { DokumentasiTab } = load('apps/web/app/piket/view.tsx', {
            react: { useState: () => [states[stateIndex++], () => {}], lazy: () => () => null },
            'react/jsx-runtime': { jsx, jsxs: jsx },
            '@/hooks/use-timezone': { useTimezone: () => ({ timezone: 'Asia/Makassar' }) },
            '@/lib/image-utils': { getProxiedImageUrl: url => url },
        }, '\nmodule.exports.DokumentasiTab = DokumentasiTab;');
        return DokumentasiTab({ reports, loading: false, isAdminOrOpJurnal: false });
    }
    function cards(tree) {
        if (!tree || typeof tree !== 'object') return [];
        if (Array.isArray(tree)) return tree.flatMap(cards);
        if (tree.props?.className === 'doc-card') return [tree];
        return cards(tree.props?.children);
    }
    const all = cards(render(''));
    assert.equal(all.length, 3);
    assert.match(JSON.stringify(all[0]), /Sesuai/);
    assert.match(JSON.stringify(all[1]), /Daring/);
    const daring = cards(render('daring'));
    assert.equal(daring.length, 2);
    assert.match(JSON.stringify(daring[0]), /XI B/);
    assert.match(JSON.stringify(daring[1]), /XI C/);
});
