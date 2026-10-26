// Exercise the actual tab with local fixtures; never call the live application.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer');

async function main() {
    const web = path.resolve('apps/web');
    const build = await esbuild.build({
        stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Tab from './app/jurnal/components/KehadiranGuruTab';createRoot(document.getElementById('root')).render(<Tab/>);`, resolveDir: web, loader: 'tsx' },
        outdir: 'attendance-fixture', bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
        tsconfig: path.join(web, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' },
    });
    const js = build.outputFiles.find(f => f.path.endsWith('.js')).contents;
    const css = build.outputFiles.find(f => f.path.endsWith('.css')).contents;
    let today = '2026-10-26';
    let revision = 1;
    let fail = false;
    let requests = 0;
    const server = http.createServer((req, res) => {
        if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(js); }
        if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
        if (req.url.startsWith('/api/jurnal/kehadiran-guru')) {
            requests++;
            const date = new URL(req.url, 'http://localhost').searchParams.get('tanggal') || today;
            const data = { tanggal: date, hari_ini: today, timezone: 'Asia/Makassar', diperbarui_pada: '2026-10-26T02:30:00Z',
                ringkasan: { total: 2, izin: 1, sakit: 0, dinas_luar: 1 },
                guru: [
                    { id: '1', nama: `Guru ${date} revisi ${revision} dengan nama yang panjang untuk pengujian tampilan`, izin: [{ id: 'a', jenis: 'izin', tanggal_mulai: '2026-10-25', tanggal_selesai: '2026-10-28' }] },
                    { id: '2', nama: 'Guru Dinas Luar', izin: [{ id: 'b', jenis: 'dinas_luar', tanggal_mulai: date, tanggal_selesai: date }] },
                ] };
            const failure = fail;
            setTimeout(() => {
                res.statusCode = failure ? 503 : 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(failure ? { ok: false, error: 'Layanan sementara tidak tersedia' } : { ok: true, data }));
            }, date === '2026-10-25' ? 600 : 10);
            return;
        }
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--n-card:#fff;--n-border:#dce0e8;--n-surface:#f8fafc;--n-ink:#10254a;--n-primary:#3083ff;--n-muted:#64748b}*{box-sizing:border-box}body{margin:0;padding:16px;background:#ebecf1;font-family:Arial,sans-serif}main{max-width:1200px;margin:auto}</style><main id="root"></main><script src="/app.js"></script>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
        browser = await puppeteer.launch({ executablePath, headless: true });
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setRequestInterception(true);
        page.on('request', req => req.url().startsWith('http://127.0.0.1:') ? req.continue() : req.abort());
        // Speed up just the 30-second polling timer for the browser test.
        await page.evaluateOnNewDocument(() => {
            const original = window.setTimeout;
            window.setTimeout = (callback, ms, ...args) => original(callback, ms === 30_000 ? 1000 : ms, ...args);
        });
        const origin = `http://127.0.0.1:${server.address().port}`;
        await page.goto(origin);
        await page.waitForSelector('.jkg-row');
        assert.equal(await page.$$eval('.jkg-row', rows => rows.length), 2);
        assert.equal(await page.$$eval('input[type=date]', inputs => inputs.length), 0, 'Use shared DatePicker instead of browser date input');
        const setDate = async date => {
            assert(date.startsWith('2026-10-'), 'Calendar fixture uses October 2026');
            await page.$$eval('.dpk-trigger', buttons => {
                const button = buttons.find(el => el.getBoundingClientRect().width);
                if (!button) throw Error('DatePicker should be visible');
                button.click();
            });
            await page.waitForSelector('.dpk-panel');
            await page.$$eval('.dpk-day:not(.dpk-day-muted)', (buttons, day) => {
                const button = buttons.find(el => Number(el.textContent) === day);
                if (!button) throw Error('Calendar day not found');
                button.click();
            }, Number(date.slice(-2)));
            await page.waitForFunction(() => !document.querySelector('.dpk-panel'));
        };
        const clickText = async text => page.evaluate(text => {
            const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text && b.getBoundingClientRect().width);
            if (!button) throw Error('Button not found: ' + text);
            button.click();
        }, text);
        await setDate('2026-10-25');
        await new Promise(resolve => setTimeout(resolve, 100));
        await setDate('2026-10-26');
        await page.waitForFunction(() => document.querySelector('.jkg-row')?.textContent.includes('2026-10-26'));
        await new Promise(resolve => setTimeout(resolve, 700));
        assert(!(await page.$eval('.jkg-list', el => el.textContent)).includes('Guru 2026-10-25'));
        await clickText('Hari ini');
        today = '2026-10-27'; revision = 2;
        await page.waitForFunction(() => document.querySelector('.jkg-row')?.textContent.includes('2026-10-27 revisi 2'));
        assert.equal(await page.$eval('.dpk-value', el => el.textContent), '27/10/2026');
        assert(requests > 2, 'Polling should refresh after initial load');
        fail = true;
        await page.waitForSelector('.jkg-error');
        assert((await page.$eval('.jkg-error', el => el.textContent)).includes('data terakhir'));
        assert.equal(await page.$$eval('.jkg-row', rows => rows.length), 2, 'Keep last good data when refresh fails');
        await setDate('2026-10-28');
        await page.waitForFunction(() => document.querySelector('.jkg-error')?.textContent.includes('Layanan sementara'));
        assert.equal(await page.$$eval('.jkg-row', rows => rows.length), 0, 'Never show another date as selected-day data');
        fail = false;
        await clickText('Coba lagi');
        await page.waitForSelector('.jkg-row');
        await page.setViewport({ width: 390, height: 900 });
        // The shared toolbar keeps separate desktop/mobile branches; use the visible input.
        await page.$$eval('.jkg input[type=text]', inputs => {
            const input = inputs.find(el => el.getBoundingClientRect().width);
            if (!input) throw Error('Mobile search should be visible');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Dinas');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForFunction(() => document.querySelectorAll('.jkg-row').length === 1);
        assert((await page.$eval('.jkg-list', el => el.textContent)).includes('Guru Dinas Luar'));
        await page.$$eval('.jkg input[type=text]', inputs => {
            const input = inputs.find(el => el.getBoundingClientRect().width);
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForFunction(() => document.querySelectorAll('.jkg-row').length === 2);
        await page.click('.ftb-embedded-filter-btn');
        await page.waitForSelector('[role=dialog] .dpk-trigger');
        await setDate('2026-10-29');
        await clickText('Terapkan');
        await page.waitForFunction(() => document.querySelector('.jkg-row')?.textContent.includes('2026-10-29'));
        await page.evaluate(() => {
            const button = [...document.querySelectorAll('button[aria-label="Hari ini"]')].find(b => b.getBoundingClientRect().width);
            if (!button) throw Error('Mobile today action should remain accessible');
            button.click();
        });
        await page.waitForFunction(() => document.querySelector('.jkg-row')?.textContent.includes('2026-10-27'));
        for (const width of [320, 390, 1280]) {
            await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
            const size = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
            assert(size.page <= size.viewport, JSON.stringify(size));
            if (width !== 320) await page.screenshot({ path: path.join(os.tmpdir(), `acca-jurnal-kehadiran-${width}.png`), fullPage: true });
        }
        assert.deepEqual(errors, []);
        console.log('Verified: shared DatePicker on desktop/mobile, daily polling, midnight rollover, date-switch race, error/retry, mobile search, and 320/390/1280px layout.');
        await browser.close(); browser = null;
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
