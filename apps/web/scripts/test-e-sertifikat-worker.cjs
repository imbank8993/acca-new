const assert = require('node:assert/strict');
const path = require('node:path');

// Run after `npm run build --workspace=apps/web`. Testing source alone misses
// webpack's createRequire transform, which previously broke this GET in production.
(async () => {
    const route = require(path.resolve(__dirname, '../.next/server/app/api/public/e-sertifikat-worker/route.js'));
    const response = await route.routeModule.userland.GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    const script = await response.text();
    assert(script.length > 1000);
    assert(script.includes(require('pdfjs-dist/package.json').version), 'worker must match the installed PDF.js version');
    console.log('PASS: compiled e-Sertifikat PDF worker returns version-matched JavaScript.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
