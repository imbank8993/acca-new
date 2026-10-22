const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, { module, exports: module.exports, Date, require: name => imports[name] || {} });
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
