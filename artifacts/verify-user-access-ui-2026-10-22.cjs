// Isolated real-component visual audit; fake responses only, no application login/database.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
(async () => {
  const bundle = path.join(os.tmpdir(), 'acca-user-access-audit-' + Date.now() + '.js');
  await require('esbuild').build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import Features from './apps/web/app/pengaturan-users/tabs/FeatureAccessTab';
    import Pages from './apps/web/app/pengaturan-users/tabs/RolePageAccessTab';
    window.__writes=[]; window.__errors=[]; window.__dialogs=[];
    const users=Array.from({length:30},(_,i)=>({id:String(i+1),nama:'Pengguna Contoh '+(i+1),role:'GURU',roles:['GURU'],nip:'fixture-'+i}));
    window.fetch=async(url,init)=>{if(init?.method){window.__writes.push({url,body:JSON.parse(init.body)});return{ok:true,json:async()=>({ok:true})}};
      return{ok:true,json:async()=>url==='/api/admin/users'?{ok:true,data:users}:url==='/api/admin/roles'?{ok:true,data:['GURU','SISWA','WALI_KELAS','WKM_AKADEMIK','OP_JURNAL','OP_MADRASAH','ADMIN'].map(name=>({name}))}:url==='/api/menu-layout'?{ok:true,layout:[],labels:{}}:url==='/api/admin/role-theme'?{ok:true,themeMap:{GURU:'LIGHT',SISWA:'LIGHT'}}:url.includes('/role-pages?')?{ok:true,role:new URL(url,'https://fixture.invalid').searchParams.get('role'),pageIds:['jurnal','master'],flatGroups:[]}:url==='/api/site-settings'?{ok:true,data:[]}:{ok:true,roles:[],grants:[],revokes:[]}}};
    const root=createRoot(document.getElementById('root'));let key=0;window.showAudit=(tab)=>root.render(tab==='pages'?<Pages key={++key}/>:<Features key={++key}/>);window.showAudit('features');
  ` }, bundle: true, platform: 'browser', jsx: 'automatic', outfile: bundle, tsconfig: 'apps/web/tsconfig.json', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'audit-boundaries', setup(build) {
    build.onResolve({ filter: /^(sweetalert2|@\/lib\/auth|@\/components\/ui\/Spinner|@\/components\/ModalBlurProvider)$/ }, a => ({ path: a.path, namespace: 'audit' }));
    build.onLoad({ filter: /.*/, namespace: 'audit' }, a => ({ loader: 'js', contents: a.path === 'sweetalert2' ? 'export default {fire:async(opts)=>{window.__dialogs.push(opts);return {isConfirmed:!!window.__confirm}}}' : a.path === '@/lib/auth' ? 'export const formatRoleDisplay=s=>s.replaceAll("_"," ");' : a.path.includes('Spinner') ? 'export const Spinner=()=>null; export const PageLoader=()=>null;' : 'export const useModalBlur=()=>({registerModal:()=>()=>{},isAnyModalOpen:false});' }));
  } }] });
  const browser = await require('puppeteer').launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage(), errors = [], metrics = {};
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: '*{box-sizing:border-box}body{margin:0;padding:16px;font-family:Poppins,Arial,sans-serif;background:#f1f5f9;color:#0f172a}:root{--n-primary:#3083ff;--n-ink:#0f172a;--n-card:#fff;--n-border:#cbd5e1;--n-muted:#64748b;--n-soft:#f8fafc}' });
    const css = bundle.replace(/\.js$/, '.css'); if (fs.existsSync(css)) await page.addStyleTag({ path: css });
    await page.addScriptTag({ path: bundle });
    await page.waitForSelector('.fa-card');
    await page.evaluate(() => { const card=[...document.querySelectorAll('.fa-card')].find(c=>c.querySelector('h3').textContent==='Pengelola Dokumen'); card.scrollIntoView(); card.querySelector('input').focus(); });
    await page.keyboard.type('GURU'); await page.keyboard.press('Enter');
    await page.evaluate(() => [...document.querySelectorAll('.fa-card')].find(c=>c.querySelector('h3').textContent==='Bentuk & Kelola Sesi').querySelector('.fa-btn-submit').click());
    await page.waitForFunction(() => window.__writes.length === 1);
    assert(await page.evaluate(() => [...document.querySelectorAll('.fa-card')].find(c=>c.querySelector('h3').textContent==='Pengelola Dokumen').querySelector('input').placeholder.includes('GURU')));
    assert.equal(await page.evaluate(() => window.__writes[0].url), '/api/admin/capabilities');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 900 });
      metrics['features-' + width] = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert(metrics['features-' + width].document <= width);
    }
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluate(() => { const cards = [...document.querySelectorAll('.fa-card')]; const card = cards.find(c => c.querySelector('h3').textContent === 'Pengelola Bank Data'); card.scrollIntoView({ block: 'center' }); card.querySelectorAll('input')[1].focus(); });
    await page.waitForSelector('.ss__drop');
    await new Promise(resolve => setTimeout(resolve, 180));
    metrics.dropdown = await page.evaluate(() => {
      const drop = document.querySelector('.ss__drop'), group = drop.closest('.fa-group');
      const d = drop.getBoundingClientRect(), g = group.getBoundingClientRect();
      return { dropdownHeight: d.height, dropdownBottom: d.bottom, clippingGroupBottom: g.bottom, visibleHeight: Math.max(0, Math.min(d.bottom, g.bottom) - d.top), groupOverflow: getComputedStyle(group).overflow };
    });
    assert.equal(metrics.dropdown.groupOverflow, 'visible');
    metrics.dropdown.hitOutsideGroup = await page.evaluate(() => { const drop=document.querySelector('.ss__drop'), group=drop.closest('.fa-group'), rect=drop.getBoundingClientRect();const y=Math.min(rect.bottom-12,group.getBoundingClientRect().bottom+24), hit=document.elementFromPoint(rect.left+25,y);return !!hit&&drop.contains(hit); });
    assert(metrics.dropdown.hitOutsideGroup);
    await page.screenshot({ path: 'artifacts/verified-user-access-dropdown-1280.png' });
    await page.evaluate(() => window.showAudit('pages'));
    await page.waitForSelector('.rpa__tile');
    assert.equal(await page.$('.rpa__errorAlert'), null);
    await page.evaluate(() => document.querySelector('.rpa__tile').click());
    await page.click('.rpa-select__control');
    await page.waitForSelector('.rpa-select__option');
    await page.evaluate(() => [...document.querySelectorAll('.rpa-select__option')].find(e=>e.textContent.includes('SISWA')).click());
    await page.waitForFunction(() => window.__dialogs.some(d=>d?.title==='Beralih role?'));
    assert((await page.$eval('.rpa-select__single-value',e=>e.textContent)).includes('GURU'));
    await page.click('.rpa__saveWrap button');
    await page.waitForFunction(() => window.__writes.some(w=>w.url==='/api/admin/role-pages'));
    assert.equal(await page.evaluate(() => window.__writes.find(w=>w.url==='/api/admin/role-pages').body.role),'GURU');
    await page.waitForFunction(() => document.querySelector('.rpa__saveWrap button').disabled);
    await page.evaluate(() => document.querySelector('button[title="Kunci ke Mode Gelap"]').click());
    await page.click('.rpa__saveWrap button');
    await page.waitForFunction(() => window.__writes.some(w=>w.body?.themeMode==='DARK'));
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 900 });
      metrics['pages-' + width] = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert(metrics['pages-' + width].document <= width);
      const overlaps = await page.evaluate(() => { const a=document.querySelector('.rpa__themeWrap').getBoundingClientRect(), b=document.querySelector('.rpa__saveWrap').getBoundingClientRect(); return Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top); });
      assert.equal(overlaps, false);
    }
    await page.setViewport({ width: 320, height: 900 });
    await page.screenshot({ path: 'artifacts/verified-user-access-pages-320.png' });
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluate(() => document.querySelector('.rpa__bulkIconBtn').click());
    await page.waitForSelector('.rpa__bulkSelect input');
    await page.click('.rpa__shortcutBtn');
    metrics.bulk = await page.$eval('.rpa__bulkSelect', el => { const c = el.querySelector('[class*="control"]'); return { selectedLabels: el.textContent, controlHeight: c?.getBoundingClientRect().height, rootHeight: el.getBoundingClientRect().height }; });
    assert(metrics.bulk.controlHeight > 38);
    await page.screenshot({ path: 'artifacts/verified-user-access-bulk-1280.png' });
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/verified-user-access-ui-2026-10-22-metrics.json', JSON.stringify({ mockedData: true, metrics, errors }, null, 2));
    console.log(JSON.stringify({ metrics, errors }, null, 2));
  } finally {
    await browser.close();
    for (const f of [bundle, bundle.replace(/\.js$/, '.css')]) if (fs.existsSync(f)) fs.unlinkSync(f);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
