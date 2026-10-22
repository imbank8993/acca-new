// Real password component with isolated responses; no account or database is modified.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
(async () => {
  const bundle = path.join(os.tmpdir(), 'acca-password-audit-' + Date.now() + '.js');
  await require('esbuild').build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import Page from './apps/web/app/update-password/page';
    window.__redirects=[];window.__writes=[];window.__clears=0;window.__sessionStatus=503;
    window.fetch=async(url,init)=>{
      if(url==='/api/auth/me')return{ok:window.__sessionStatus===200,status:window.__sessionStatus,json:async()=>({ok:window.__sessionStatus===200,user:window.__sessionStatus===200?{id:'3',must_change_password:true}:null})};
      if(url==='/api/auth/update-password'){
        const body=JSON.parse(init.body);window.__writes.push({url,method:init.method,body});
        const ok=body.oldPassword==='temporary-password';return{ok,status:ok?200:400,json:async()=>({ok,error:ok?undefined:'Password saat ini tidak sesuai'})};
      }
      throw new Error('Unexpected request: '+url);
    };
    const root=createRoot(document.getElementById('root'));let version=0;window.mountPassword=()=>root.render(<Page key={++version}/>);window.mountPassword();
  ` }, bundle: true, platform: 'browser', jsx: 'automatic', outfile: bundle, tsconfig: 'apps/web/tsconfig.json', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'password-audit', setup(build) {
    build.onResolve({ filter: /^(next\/navigation|@\/lib\/auth-client)$/ }, args => ({ path: args.path, namespace: 'password-audit' }));
    build.onLoad({ filter: /.*/, namespace: 'password-audit' }, args => ({ loader: 'js', contents: args.path === 'next/navigation'
      ? 'const router={replace:path=>window.__redirects.push(path)};export const useRouter=()=>router;'
      : 'export const clearUserCache=()=>{window.__clears++};' }));
  } }] });
  const browser = await require('puppeteer').launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage(), errors = [], metrics = {};
    page.on('pageerror', err => errors.push(err.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ path: bundle });
    await page.waitForSelector('.up-error');
    assert.match(await page.$eval('.up-error', el => el.textContent), /Sesi belum dapat diperiksa/);
    assert(await page.$eval('button[type="submit"]', el => el.disabled));
    await page.evaluate(() => { window.__sessionStatus = 200; });
    await page.click('button.up-retry');
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    assert.match(await page.$eval('h2', el => el.textContent), /Ganti Password Sementara/);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 900 });
      metrics[width] = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, fieldWidth: document.querySelector('#currentPassword').getBoundingClientRect().width, border: getComputedStyle(document.querySelector('#currentPassword')).borderRadius }));
      assert(metrics[width].document <= width); assert.equal(metrics[width].border, '12px');
    }
    await page.setViewport({ width: 390, height: 900 });
    await page.screenshot({ path: 'artifacts/verified-password-reset-390.png' });
    await page.type('#currentPassword', 'wrong-password');
    await page.type('#password', 'chosen-password');
    await page.type('#confirmPassword', 'chosen-password');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.up-error');
    assert.match(await page.$eval('.up-error', el => el.textContent), /Password saat ini tidak sesuai/);
    assert.equal(await page.$eval('#password', el => el.value), 'chosen-password');
    assert.equal(await page.evaluate(() => window.__redirects.length), 0);
    await page.$eval('#currentPassword', el => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('#currentPassword', 'temporary-password');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('h2')?.textContent === 'Password Diperbarui!');
    assert.equal(await page.$('input'), null);
    assert.equal(await page.$eval('.up-card', el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await page.screenshot({ path: 'artifacts/verified-password-reset-success-390.png' });
    await page.waitForFunction(() => window.__redirects.includes('/login'), { timeout: 5000 });
    const writes = await page.evaluate(() => window.__writes);
    assert.equal(writes.length, 2); assert.equal(writes[1].method, 'POST');
    assert.deepEqual(Object.keys(writes[1].body).sort(), ['oldPassword', 'password']);
    assert.equal(await page.evaluate(() => window.__clears), 1);
    await page.evaluate(() => { window.__sessionStatus = 401; window.mountPassword(); });
    await page.waitForSelector('.up-error');
    assert.match(await page.$eval('.up-error', el => el.textContent), /login dengan password sementara/);
    assert(await page.$eval('button[type="submit"]', el => el.disabled));
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/verified-password-reset-ui-2026-10-22-metrics.json', JSON.stringify({ mockedData: true, metrics, errors, passwordRequests: writes.length }, null, 2));
    console.log(JSON.stringify({ mockedData: true, metrics, errors, passwordRequests: writes.length }));
  } finally { await browser.close(); if (fs.existsSync(bundle)) fs.unlinkSync(bundle); }
})().catch(err => { console.error(err); process.exitCode = 1; });
