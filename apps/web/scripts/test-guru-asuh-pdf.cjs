const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

async function main() {
    const outcomes = [];
    let handler;
    let scriptsDisabled = false;
    let intercepted = false;
    const requests = [
        ['http://127.0.0.1/admin', 'image', 'abort'],
        ['http://169.254.169.254/latest/meta-data', 'image', 'abort'],
        ['https://trusted.example/photo.png', 'image', 'respond'],
        ['https://trusted.example/page.html', 'image', 'abort'],
        ['https://trusted.example/script.js', 'script', 'abort'],
        ['data:image/png;base64,AAAA', 'image', 'continue'],
    ];
    const page = {
        setJavaScriptEnabled: async value => { scriptsDisabled = !value; },
        setRequestInterception: async value => { intercepted = value; },
        on: (_event, fn) => { handler = fn; },
        setContent: async () => {
            assert.ok(scriptsDisabled && intercepted);
            for (const [url, type, expected] of requests) {
                let outcome;
                await handler({
                    url: () => url, resourceType: () => type,
                    abort: async () => { outcome = 'abort'; },
                    continue: async () => { outcome = 'continue'; },
                    respond: async () => { outcome = 'respond'; },
                    isInterceptResolutionHandled: () => Boolean(outcome),
                });
                assert.equal(outcome, expected, url);
                outcomes.push(outcome);
            }
        },
        pdf: async () => Buffer.from('pdf'),
    };
    const mocks = {
        'next/server': { NextResponse: Response },
        '@/lib/app-jwt': { extractRequestToken: () => 'test-token' },
        '@/lib/guru-asuh/laporan-report': { buildLaporanReport: async () => ({ ok: true, html: '', submission: {} }) },
        '@/lib/puppeteer-launcher': { launchPuppeteerBrowser: async () => ({ newPage: async () => page, close: async () => {} }) },
        '@/lib/public-url': { getPublicOrigin: () => 'https://school.example' },
        '@/lib/proxy-guard': { fetchSafeFile: async url => {
            if (!url.startsWith('https://trusted.example/')) throw new Error('Blocked');
            return new Response('image', { headers: { 'content-type': url.endsWith('.png') ? 'image/png' : 'text/html' } });
        } },
    };
    const source = readFileSync(resolve(__dirname, '../app/api/guru-asuh/laporan-submission/pdf/route.ts'), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
    const exports = {};
    runInNewContext(js, { exports, require: name => {
        assert.ok(mocks[name], `Unexpected dependency ${name}`);
        return mocks[name];
    }, Buffer, Uint8Array, URL, console });
    const response = await exports.GET({ url: 'https://school.example/api/pdf?submissionId=test', headers: new Headers() });
    assert.equal(response.status, 200);
    assert.equal(outcomes.length, requests.length);
    console.log('PASS: 6 PDF request interception cases (mocked browser and downloader).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
