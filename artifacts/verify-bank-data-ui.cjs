const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
(async () => {
  const bundle = path.join(os.tmpdir(), `acca-bank-data-${Date.now()}.js`);
  const columns = ['nisn', 'nama_lengkap', 'tempat_lahir', 'tanggal_lahir', 'kelas', 'ekskul', 'wali_kelas'].map(key => ({ key, label: key.replaceAll('_', ' ').toUpperCase() }));
  const datasets = ['siswa', 'guru', 'tendik'].map(id => ({ id, label: `Data ${id[0].toUpperCase() + id.slice(1)}`, ikon: 'bi-table', deskripsi: 'Data yang diizinkan beserta informasi pendukung.', filter: id === 'siswa' ? ['tahun_ajaran', 'semester', 'kelas'] : ['tahun_ajaran', 'semester'], batasBaris: 5000, kolom: columns }));
  await require('esbuild').build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import DataTab from './apps/web/app/bank-data/tabs/DataTab';import './apps/web/app/bank-data/bank-data.css';
window.__requests=[];window.fetch=async(url,options)=>{if(!options)return {ok:true,json:async()=>({ok:true,data:[{nama:'X A'}]})};const p=JSON.parse(options.body);window.__requests.push(p);if(p.action==='export')return {ok:true,headers:new Headers({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),blob:async()=>new Blob(['excel'])};await new Promise(r=>setTimeout(r,p.q==='lama'?250:15));const total=p.q==='tidakada'?0:p.q?1:45;return {ok:true,json:async()=>({ok:true,total,totalTersedia:total,batas:5000,terpotong:false,kolom:${JSON.stringify(columns)},data:Array.from({length:Math.max(0,Math.min(p.perHalaman,total-(p.halaman-1)*p.perHalaman))},(_,i)=>({nisn:'00'+((p.halaman-1)*p.perHalaman+i),nama_lengkap:p.q||'Siswa '+((p.halaman-1)*p.perHalaman+i+1),tempat_lahir:'Makassar',tanggal_lahir:'2010-05-12',kelas:'X A',ekskul:'Pramuka, Seni dan Musik',wali_kelas:'Nama wali kelas yang cukup panjang'}))})}};createRoot(document.getElementById('root')).render(<DataTab datasets={${JSON.stringify(datasets)}}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: bundle, platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture', setup(build) { build.onResolve({ filter: /^@\/lib\/settings-client$/ }, () => ({ path: 'settings', namespace: 'fixture' })); build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export async function getAllAcademicYears(){return ['2026/2027','2025/2026']}", loader: 'js' })); } }] });
  const browser = await require('puppeteer').launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true); page.on('request', request => request.abort());
    await page.setViewport({ width: 1280, height: 900 });
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root" class="bd-container"></div></body></html>');
    await page.addStyleTag({ content: '*{box-sizing:border-box}body{margin:0;padding:16px;font-family:Arial;background:#f1f5f9}#root{width:100%;min-width:0}.pagination-container{display:flex;flex-wrap:wrap;justify-content:space-between;padding:16px}.pagination-controls{display:flex;gap:8px}.mobile-pages{display:none}.btn-page{padding:8px;margin:2px}.is-active{color:#1a73e8}@media(max-width:639px){body{padding:10px}.desktop-pages{display:none}.mobile-pages{display:flex}}' });
    await page.addStyleTag({ path: bundle.replace(/\.js$/, '.css') });
    const iconsPath = require.resolve('bootstrap-icons/font/bootstrap-icons.css');
    const icons = fs.readFileSync(iconsPath, 'utf8').replace(/url\(["']?([^"')]+)["']?\)/g, (match, file) => { const full = path.resolve(path.dirname(iconsPath), file.split('?')[0]); return fs.existsSync(full) ? `url(data:font/woff2;base64,${fs.readFileSync(full).toString('base64')})` : match; });
    await page.addStyleTag({ content: icons }); await page.addScriptTag({ path: bundle });
    await page.waitForSelector('.bd-data-table tbody tr');
    assert.equal(await page.$$eval('.bd-data-table tbody tr', rows => rows.length), 20);
    await page.select('.ftb-desktop-wrap select[title="Tahun Ajaran"]', '2026/2027');
    await page.waitForFunction(() => window.__requests.at(-1)?.filter.tahun_ajaran === '2026/2027' && document.querySelector('.bd-data-table'));
    await page.evaluate(() => [...document.querySelectorAll('.desktop-pages button')].find(b => b.textContent.trim() === '2').click());
    await page.waitForFunction(() => window.__requests.at(-1)?.halaman === 2 && document.querySelector('.bd-data-table'));
    assert.equal(await page.$eval('.bd-data-table tbody td', cell => cell.textContent), '21');
    await page.type('.ftb-desktop-wrap input', 'Andi');
    await page.waitForFunction(() => window.__requests.at(-1)?.q === 'Andi' && document.querySelector('.bd-data-table'));
    assert.equal(await page.$$eval('.bd-data-table tbody tr', rows => rows.length), 1);
    await page.click('.ftb-desktop-wrap button[aria-label="Unduh Excel sesuai filter"]');
    await page.waitForFunction(() => window.__requests.some(p => p.action === 'export'));
    const sent = await page.evaluate(() => window.__requests.find(p => p.action === 'export'));
    assert.equal(sent.q, 'Andi'); assert.equal(sent.filter.tahun_ajaran, '2026/2027'); assert.equal(sent.halaman, undefined);
    await page.click('.ftb-desktop-wrap button[aria-label="Reset filter"]');
    await page.waitForFunction(() => window.__requests.at(-1)?.action === 'data' && window.__requests.at(-1)?.q === '' && document.querySelector('.bd-data-table'));
    const metrics = {};
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 900 });
      await new Promise(r => setTimeout(r, 80));
      metrics[width] = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, tableScroll: document.querySelector('.bd-data-scroll').scrollWidth, exportVisible: [...document.querySelectorAll('[aria-label="Unduh Excel sesuai filter"]')].some(button => { const rect = button.getBoundingClientRect(); return rect.width > 0 && rect.right <= innerWidth; }) }));
      assert(metrics[width].document <= width + 1, `Overflow at ${width}`); assert(metrics[width].exportVisible);
      if (width === 390 || width === 1280) await page.screenshot({ path: `artifacts/bank-data-${width}.png`, fullPage: true });
    }
    await page.setViewport({ width: 390, height: 900 });
    await page.click('.ftb-mobile-wrap button[aria-label="Filter"]');
    await page.waitForSelector('.ftb-modal-panel select[title="Dataset"]');
    await page.select('.ftb-modal-panel select[title="Dataset"]', 'guru');
    await page.waitForFunction(() => window.__requests.at(-1)?.dataset_id === 'guru' && document.querySelector('.bd-data-table'));
    assert.equal(await page.$eval('.bd-data-heading h3', heading => heading.textContent), 'Data Guru');
    assert.equal(await page.$('.ftb-modal-panel'), null);
    await page.type('.ftb-mobile-wrap input', 'tidakada');
    await page.waitForSelector('.bd-data-empty');
    assert.equal(await page.$eval('.ftb-mobile-wrap button[aria-label="Unduh Excel sesuai filter"]', button => button.disabled), true);
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/bank-data-visual-metrics.json', JSON.stringify(metrics, null, 2));
    console.log('Passed: paging, filters, search, filtered export, reset, mobile dataset switch, empty state, 320–1280 viewport, visible download button.'); console.log(JSON.stringify(metrics));
  } finally { await browser.close(); for (const file of [bundle, bundle.replace(/\.js$/, '.css')]) if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
