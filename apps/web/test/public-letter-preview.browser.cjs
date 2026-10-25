// Browser regression with a two-page fixture, no live user data or remote requests.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer');
const { PDFDocument, StandardFonts } = require('pdf-lib');

async function main() {
    const web = path.resolve('apps/web');
    const id = '00000000-0000-4000-8000-000000000001';
    const fixture = await PDFDocument.create();
    const font = await fixture.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= 2; n++) {
        const page = fixture.addPage([595, 842]);
        page.drawText(`Halaman ${n} - Dokumen pengujian`, { x: 40, y: 780, size: 20, font });
        for (let row = 0; row < 20; row++) page.drawText('Isi surat pengujian untuk pratinjau mobile.', { x: 40, y: 730 - row * 26, size: 12, font });
    }
    const pdf = Buffer.from(await fixture.save());
    const build = await esbuild.build({
        stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './app/surat/scan/[id]/page'; createRoot(document.getElementById('root')).render(<Page/>);`, resolveDir: web, loader: 'tsx' },
        outdir: 'preview-test', entryNames: 'app', bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [{ name: 'preview-fixtures', setup(b) {
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
            b.onResolve({ filter: /^@\/components\/MaintenanceBanner$/ }, () => ({ path: 'maintenance', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name === 'navigation'
                ? `export const useParams=()=>({id:'${id}'});export const useRouter=()=>({});`
                : 'export default function MaintenanceBanner(){return null;}' }));
            b.onResolve({ filter: /^@\// }, args => ({ path: path.join(web, args.path.slice(2) + (fs.existsSync(path.join(web, args.path.slice(2) + '.tsx')) ? '.tsx' : '.ts')) }));
            b.onResolve({ filter: /^(canvas|path|fs|http|https|url|zlib|stream)$/ }, args => ({ path: args.path, namespace: 'empty' }));
            b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'export default {};' }));
            b.onResolve({ filter: /\.(png|jpg|svg|woff2?)$/ }, args => ({ path: args.path, external: true }));
        } }],
    });
    const js = build.outputFiles.find(f => f.path.endsWith('.js')).contents;
    const css = build.outputFiles.find(f => f.path.endsWith('.css')).contents;
    const verify = { ok: true, valid: true, surat: { id, status: 'FINAL', nomor_surat: '008/G/AKADEMIK/X/2026', perkara: 'Edaran Tentang Penyesuaian KBM selama TKA', tempat_ttd: 'Gowa', tanggal_ttd: '2026-10-25', created_at: '2026-10-25', pejabat_nama: 'Guru Pengujian', pejabat_jabatan: 'Wakamad Akademik', file_url: 'https://files.example/test.pdf' } };
    const server = http.createServer((req, res) => {
        if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(js); }
        if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
        if (req.url.startsWith('/api/surat/verify')) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(verify)); }
        if (req.url.startsWith('/api/public/surat/file')) { res.setHeader('Content-Type', 'application/pdf'); return res.end(pdf); }
        if (req.url.startsWith('/api/public/e-sertifikat-worker')) { res.setHeader('Content-Type', 'application/javascript'); return res.end(fs.readFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.js'))); }
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}</style><div id="root"></div><script src="/app.js"></script>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'win32' && fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
        browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
        for (const width of [320, 390, 1280]) {
            const page = await browser.newPage();
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
            await page.setRequestInterception(true);
            page.on('request', request => request.url().startsWith('http://127.0.0.1:') ? request.continue() : request.abort());
            await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
            await page.waitForFunction(() => document.querySelector('.letter-pdf-count')?.textContent === '2 halaman');
            await page.$eval('.letter-pdf-page:last-child', element => element.scrollIntoView());
            await page.waitForFunction(() => [...document.querySelectorAll('.letter-pdf-sheet canvas')].length === 2 && [...document.querySelectorAll('.letter-pdf-sheet canvas')].every(c => c.dataset.rendered === 'true'));
            const measure = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth, canvas: document.querySelector('canvas').getBoundingClientRect().width, preview: document.querySelector('.letter-pdf-preview').clientWidth, iframes: document.querySelectorAll('iframe').length, banner: getComputedStyle(document.querySelector('.scan-letter-header')).backgroundColor }));
            assert(measure.body <= measure.viewport, JSON.stringify(measure));
            assert(measure.canvas <= measure.preview, JSON.stringify(measure));
            assert.equal(measure.iframes, 0);
            assert.equal(measure.banner, 'rgb(48, 131, 255)');
            assert.deepEqual(errors, []);
            if (width === 390) {
                await page.evaluate(() => scrollTo(0, 0));
                await page.screenshot({ path: path.join(os.tmpdir(), 'acca-letter-verification-mobile.png'), fullPage: true });
            }
            console.log(`Verified ${width}px: both PDF pages rendered, fitted width, no horizontal overflow.`);
            await page.close();
        }
        console.log('Mobile screenshot: ' + path.join(os.tmpdir(), 'acca-letter-verification-mobile.png'));
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
