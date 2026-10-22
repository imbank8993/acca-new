// Isolated real-component visual audit; fake responses only, no application login/database.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
(async () => {
  const bundle = path.join(os.tmpdir(), 'acca-user-access-audit-' + Date.now() + '.js');
  await require('esbuild').build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import Features from './apps/web/app/pengaturan-users/tabs/FeatureAccessTab';
    import Pages from './apps/web/app/pengaturan-users/tabs/RolePageAccessTab';
    window.__writes=[]; window.__errors=[];
    const users=Array.from({length:30},(_,i)=>({id:String(i+1),nama:'Pengguna Contoh '+(i+1),role:'GURU',roles:['GURU'],nip:'fixture-'+i}));
    window.fetch=async(url,init)=>{if(init){window.__writes.push({url,body:JSON.parse(init.body)});return{ok:true,json:async()=>({ok:true})}};
      return{ok:true,json:async()=>url==='/api/admin/users'?{ok:true,data:users}:url==='/api/admin/roles'?{ok:true,data:['GURU','SISWA','WALI_KELAS','WKM_AKADEMIK','OP_JURNAL','OP_MADRASAH','ADMIN'].map(name=>({name}))}:url==='/api/menu-layout'?{ok:true,layout:[],labels:{}}:url==='/api/admin/role-theme'?{ok:true,themeMap:{GURU:'LIGHT',SISWA:'LIGHT'}}:url.includes('/role-pages?')?{ok:true,pageIds:['jurnal','master'],flatGroups:[]}:url==='/api/site-settings'?{ok:true,data:[]}:{ok:true,roles:[],grants:[],revokes:[]}}};
    const root=createRoot(document.getElementById('root'));let key=0;window.showAudit=(tab)=>root.render(tab==='pages'?<Pages key={++key}/>:<Features key={++key}/>);window.showAudit('features');
  ` }, bundle: true, platform: 'browser', jsx: 'automatic', outfile: bundle, tsconfig: 'apps/web/tsconfig.json', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'audit-boundaries', setup(build) {
    build.onResolve({ filter: /^(sweetalert2|@\/lib\/auth|@\/components\/ui\/Spinner|@\/components\/ModalBlurProvider)$/ }, a => ({ path: a.path, namespace: 'audit' }));
    build.onLoad({ filter: /.*/, namespace: 'audit' }, a => ({ loader: 'js', contents: a.path === 'sweetalert2' ? 'export default {fire:async()=>({isConfirmed:false})}' : a.path === '@/lib/auth' ? 'export const formatRoleDisplay=s=>s.replaceAll("_"," ");' : a.path.includes('Spinner') ? 'export const Spinner=()=>null; export const PageLoader=()=>null;' : 'export const useModalBlur=()=>({registerModal:()=>()=>{},isAnyModalOpen:false});' }));
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
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 900 });
      metrics['features-' + width] = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    }
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluate(() => { const cards = [...document.querySelectorAll('.fa-card')]; const card = cards.find(c => c.querySelector('h3').textContent === 'Pengelola Bank Data'); card.scrollIntoView({ block: 'center' }); card.querySelectorAll('input')[1].focus(); });
    await page.waitForSelector('.ss__drop');
    metrics.dropdown = await page.evaluate(() => {
      const drop = document.querySelector('.ss__drop'), group = drop.closest('.fa-group');
      const d = drop.getBoundingClientRect(), g = group.getBoundingClientRect();
      return { dropdownHeight: d.height, dropdownBottom: d.bottom, clippingGroupBottom: g.bottom, visibleHeight: Math.max(0, Math.min(d.bottom, g.bottom) - d.top), groupOverflow: getComputedStyle(group).overflow };
    });
    assert(metrics.dropdown.visibleHeight < metrics.dropdown.dropdownHeight / 2);
    assert.equal(metrics.dropdown.groupOverflow, 'hidden');
    await page.screenshot({ path: 'artifacts/audit-user-access-dropdown-1280.png' });
    await page.evaluate(() => window.showAudit('pages'));
    await page.waitForSelector('.rpa__tile');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 900 });
      metrics['pages-' + width] = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    }
    await page.setViewport({ width: 320, height: 900 });
    await page.screenshot({ path: 'artifacts/audit-user-access-pages-320.png' });
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluate(() => document.querySelector('.rpa__bulkIconBtn').click());
    await page.waitForSelector('.rpa__bulkSelect input');
    await page.click('.rpa__shortcutBtn');
    metrics.bulk = await page.$eval('.rpa__bulkSelect', el => { const c = el.querySelector('[class*="control"]'); return { selectedLabels: el.textContent, controlHeight: c?.getBoundingClientRect().height, rootHeight: el.getBoundingClientRect().height }; });
    await page.screenshot({ path: 'artifacts/audit-user-access-bulk-1280.png' });
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/audit-user-access-ui-2026-10-22-metrics.json', JSON.stringify({ mockedData: true, metrics, errors }, null, 2));
    console.log(JSON.stringify({ metrics, errors }, null, 2));
  } finally {
    await browser.close();
    for (const f of [bundle, bundle.replace(/\.js$/, '.css')]) if (fs.existsSync(f)) fs.unlinkSync(f);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
