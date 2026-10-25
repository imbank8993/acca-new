const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sharp = require('sharp');

function load(file, imports = {}) {
    const mod = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { module: mod, exports: mod.exports, URL, require: name => imports[name] || {} });
    return mod.exports;
}
const branding = load('apps/web/lib/branding.ts');
const logo = load('apps/web/lib/branding-logo.ts');

test('global and shared-link previews use the new public brand image without leaking shared content', async () => {
    const imports = {
        '@/lib/branding': branding,
        '@/lib/public-url': { getPublicOrigin: () => 'https://acca.icgowa.sch.id' },
        '@/lib/informasi/share': { resolveShareToken() { throw Error('Metadata must not resolve private content'); } },
    };
    const root = load('apps/web/app/layout.tsx', imports).metadata;
    const share = load('apps/web/app/info-link/[token]/page.tsx', imports).metadata;
    assert.equal(root.metadataBase.origin, 'https://acca.icgowa.sch.id');
    for (const metadata of [root, share]) {
        assert.equal(metadata.openGraph.images[0].url, branding.APP_BRAND.shareImage);
        assert.equal(metadata.twitter.images[0], branding.APP_BRAND.shareImage);
        const image = await sharp(path.join('apps/web/public', metadata.openGraph.images[0].url)).metadata();
        assert.equal(image.width, 1200);
        assert.equal(image.height, 630);
    }
    assert.equal(share.robots.index, false);
    assert.equal(root.icons.apple, branding.APP_BRAND.appleIcon);
});

test('legacy logo URLs, Next favicon, installation icons and report logo agree with the sidebar source', async () => {
    const source = fs.readFileSync('apps/web/public/logo-sidebar-kecil.png');
    for (const name of ['logo-icon.png', 'logo_final.png']) {
        assert(source.equals(fs.readFileSync(path.join('apps/web/public', name))));
    }
    const dataUri = 'data:image/png;base64,' + source.toString('base64');
    assert.equal(logo.APP_LOGO_DATA_URI, dataUri);
    for (const name of ['apps/web/app/icon.svg', 'apps/web/public/icon.svg', 'apps/web/public/Logo.svg']) {
        assert(fs.readFileSync(name, 'utf8').includes(dataUri));
    }
    const manifest = JSON.parse(fs.readFileSync('apps/web/public/manifest.json', 'utf8'));
    for (const entry of manifest.icons) {
        const image = await sharp(path.join('apps/web/public', entry.src)).metadata();
        assert.equal(`${image.width}x${image.height}`, entry.sizes);
        assert.equal(image.format, 'png');
    }
    const reports = load('apps/web/lib/report-templates.ts', { './branding-logo': logo });
    assert(reports.piketReportHtml({ tanggal: '2026-10-25' }, []).includes(dataUri));
});
