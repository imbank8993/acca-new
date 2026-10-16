const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
(async () => {
  const bundle = path.join(os.tmpdir(), `acca-nilai-cbt-${Date.now()}.js`);
  const base = { nip: 'G1', kelas: 'X A', mapel: 'Matematika', semester: 1, tahun_ajaran: '2026/2027', nisn: '001', jenis: 'TUGAS', materi_tp: 'Tugas Guru', tagihan: '', catatan: null, nama_guru: 'Guru Contoh', updated_at: '2026-10-16' };
  const rows = [
    { ...base, id: 'manual', sumber: 'guru', nilai: 88 },
    { ...base, id: 'cbt:1', sumber: 'cbt', nilai: 72, jenis: 'CBT', materi_tp: 'PAS CBT Klasikal', score_type: 'classical' },
    { ...base, id: 'cbt:2', sumber: 'cbt', nilai: 66.000000000001, jenis: 'CBT', materi_tp: 'SUM 1 CBT IRT', score_type: 'irt_3pl', mapel: 'Biologi', kelas: 'XI Matematika Lanjut dan Biologi 1' },
    { ...base, id: 'cbt:pending', sumber: 'cbt', nilai: null, jenis: 'CBT', materi_tp: 'Esai CBT', score_type: 'classical', catatan: 'Menunggu koreksi / finalisasi nilai CBT' },
    { ...base, id: 'cbt:old', sumber: 'cbt', nilai: 85, jenis: 'CBT', materi_tp: 'Ujian CBT Tahun Lalu', score_type: 'classical', semester: 2, tahun_ajaran: '2025/2026' },
  ];
  const grouped = { '2026/2027': { 1: rows.slice(0, 4) }, '2025/2026': { 2: rows.slice(4) } };
  const data = { siswa: { nisn: '001', nama_lengkap: 'Siswa Contoh' }, kelas: [
    { kelas: 'X A', tahun_ajaran: '2026/2027', semester: 'Ganjil' },
    { kelas: 'IX A', tahun_ajaran: '2025/2026', semester: 'Genap' },
  ], all: rows, grouped, cbt_linkage: 'linked' };
  await require('esbuild').build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Page from './apps/web/app/nilai-siswa/view';window.fetch=async(url)=>({ok:true,json:async()=>url.includes('/apresiasi')?{ok:true,data:[]}:{ok:true,data:${JSON.stringify(data)}}});createRoot(document.getElementById('root')).render(<Page/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: bundle, platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixtures', setup(build) {
    build.onResolve({ filter: /^(next\/navigation|@\/lib\/auth-client|@\/lib\/tahun-ajaran-client|@\/components\/MaintenanceBanner|sweetalert2)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents:
      args.path === 'next/navigation' ? 'const router={push(){}};export const useRouter=()=>router;' :
      args.path.includes('auth-client') ? 'export async function getCurrentUser(){return {id:1,nip:"001",role:"SISWA",roles:["SISWA"]}};' :
      args.path.includes('tahun-ajaran-client') ? 'export async function getActiveTahunAjaranList(){return ["2026/2027"]};export const currentSemesterDefault=()=>"1";' :
      args.path.includes('MaintenanceBanner') ? 'export default function Banner({children}){return children;}' : 'export default {fire:async()=>({})};' }));
  } }] });
  const browser = await require('puppeteer').launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true); page.on('request', request => request.abort());
    await page.setViewport({ width: 1280, height: 950 });
    await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: fs.readFileSync('apps/web/app/globals.css', 'utf8').replace(/^@import.*$/gm, '') });
    await page.addStyleTag({ content: '*{box-sizing:border-box}body{margin:0;padding:16px;font-family:Arial}#root{width:100%;min-width:0}' });
    await page.addStyleTag({ path: bundle.replace(/\.js$/, '.css') });
    await page.addScriptTag({ path: bundle });
    await page.waitForSelector('.nilai-page__table tbody tr');
    const count = () => page.$$eval('.nilai-page__table tbody tr', rows => rows.length);
    assert.equal(await count(), 4);
    assert.equal(await page.$eval('.nilai-page__stat-value--kelas', el => el.textContent), 'X A');
    assert(await page.$eval('.nilai-page__cbt-table', table => table.textContent.includes('PAS CBT Klasikal') && table.textContent.includes('SUM 1 CBT IRT')));
    assert.deepEqual(await page.$$eval('.nilai-page__cbt-table th', cells => cells.map(cell => cell.textContent)), ['Nama Ujian', 'Pembuat', 'Jenis Nilai', 'Mapel', 'Nilai']);
    assert.equal(await page.$$eval('.nilai-page__mapel-title', titles => titles.filter(title => title.textContent === 'Nilai ACCA-CBT').length), 1);
    assert.equal(await page.$eval('.nilai-page__cbt-table', table => table.closest('.nilai-page__mapel-card').querySelector('.nilai-page__mapel-guru')), null);
    assert(await page.$eval('.nilai-page__cbt-table', table => !table.textContent.includes('66.000000000001') && table.textContent.includes('Biologi')));
    assert(await page.$eval('.nilai-page__stats-grid', node => node.textContent.includes('75.3')));
    const selectors = '.ftb-desktop-wrap select';
    const select = async (index, value) => { const fields = await page.$$(selectors); await fields[index].select(value); };
    await select(0, 'guru');
    await page.waitForFunction(() => document.querySelectorAll('.nilai-page__table tbody tr').length === 1);
    assert.deepEqual(await page.$$eval('.nilai-page__table th', cells => cells.map(cell => cell.textContent)), ['Sumatif', 'Jenis', 'Topik', 'Nilai']);
    await select(0, 'cbt');
    await page.waitForFunction(() => document.querySelectorAll('.nilai-page__table tbody tr').length === 3);
    assert.equal(await page.$eval('.nilai-page__stat-value--kelas', el => el.textContent), 'X A');
    assert(await page.$eval('.nilai-page__table', table => table.textContent.includes('Menunggu koreksi')));
    assert(await page.$eval('.nilai-page__stats-grid', node => node.textContent.includes('69.0')));
    await select(1, '2025/2026');
    await page.waitForFunction(() => document.querySelector('.nilai-page__table')?.textContent.includes('Ujian CBT Tahun Lalu'));
    assert.equal(await count(), 1);
    assert.equal(await page.$eval('.nilai-page__stat-value--kelas', el => el.textContent), 'IX A');
    await select(1, '2026/2027'); await select(0, 'all');
    await page.waitForFunction(() => document.querySelectorAll('.nilai-page__table tbody tr').length === 4);
    const metrics = {};
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 950 }); await new Promise(resolve => setTimeout(resolve, 100));
      metrics[width] = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
        visibleSourceBadges: [...document.querySelectorAll('.nilai-page__source-badge')].filter(el => el.getBoundingClientRect().width > 0).length }));
      assert(metrics[width].document <= width + 1, `Page overflow at ${width}: ${JSON.stringify(metrics[width])}`);
      assert.equal(metrics[width].visibleSourceBadges, width < 1024 ? 4 : 3);
      if ([390, 1280].includes(width)) await page.screenshot({ path: `artifacts/nilai-cbt-${width}.png`, fullPage: true });
    }
    await page.setViewport({ width: 390, height: 950 });
    await page.click('.ftb-mobile-wrap button[aria-label="Filter"]');
    await page.waitForSelector('.ftb-modal-panel select', { visible: true });
    await page.select('.ftb-modal-panel select', 'guru');
    await page.waitForFunction(() => document.querySelectorAll('.nilai-page__table tbody tr').length === 1);
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/nilai-cbt-ui-metrics.json', JSON.stringify(metrics, null, 2));
    console.log('Passed: dedicated Nilai ACCA-CBT card, requested columns, no teacher subtitle, mixed subjects, rounded scores, source filters, pending essays, historical periods, mobile filter and 320–1280 layout.');
  } finally { await browser.close(); for (const file of [bundle, bundle.replace(/\.js$/, '.css')]) if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
