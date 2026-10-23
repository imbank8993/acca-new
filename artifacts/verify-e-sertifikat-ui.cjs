const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
(async () => {
  const bundle = path.join(os.tmpdir(), `acca-ecert-${Date.now()}.js`);
  await require('esbuild').build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';import Manager from './apps/web/app/e-sertifikat/view';import{getPageFab}from'./apps/web/components/mobile/page-fab';window.getPageFab=getPageFab;window.runPageFab=()=>getPageFab()?.run();import Verify from './apps/web/app/e-sertifikat/verifikasi/[token]/view';
const id='11111111-1111-4111-8111-111111111111';let events=[],event=null,assets=[],recipients=[];window.__mode='issued';window.__requests=[];
if(!crypto.randomUUID){let n=0;crypto.randomUUID=()=> '44444444-4444-4444-8444-'+String(++n).padStart(12,'0');}
window.fetch=async(url,init={})=>{const method=init.method||'GET';const body=typeof init.body==='string'?JSON.parse(init.body):init.body;window.__requests.push({url,method,body:typeof init.body==='string'?body:null});let data;
if(url.startsWith('/api/public/e-sertifikat/')){if(window.__mode==='invalid')return {ok:false,json:async()=>({ok:false,error:'Sertifikat tidak ditemukan'})};return{ok:true,json:async()=>({ok:true,data:window.__mode==='revoked'?{status:'revoked',certificate_number:'ACCA/0001',revoked_at:'2026-10-16',revoke_reason:'Data dikoreksi',assets:[]}:{status:'issued',certificate_number:'ACCA/0001',name:'Amelia Putri',institution:'Sekolah Contoh Gowa',issued_at:'2026-10-16',event:{title:'Lokakarya Pembelajaran Kreatif',organizer:'MAN Insan Cendekia Gowa',start_date:'2026-10-16',end_date:'2026-10-16',location:'Gowa',description:'Pengembangan kompetensi pendidik melalui kegiatan kolaboratif.'},assets:[{id:'document',kind:'correspondence',filename:'Surat Kegiatan.pdf',mime:'application/pdf'}]}})}};
const parsedUrl=new URL(url,'http://ecert.test');if(parsedUrl.pathname==='/api/site-settings')return{ok:true,json:async()=>({data:{value:'Asia/Makassar'}})};
const p=parsedUrl.pathname.replace('/api/e-sertifikat','');if(p===''&&method==='GET'){const q=(parsedUrl.searchParams.get('q')||'').toLowerCase(),s=parsedUrl.searchParams.get('status')||'all',page=Number(parsedUrl.searchParams.get('page')||1),pageSize=Number(parsedUrl.searchParams.get('pageSize')||24);const filtered=events.map(item=>item.id===event?.id?{...event,total:recipients.length,issued:recipients.filter(r=>r.status==='issued').length}:item).filter(item=>(s==='all'||item.archived===(s==='archived'))&&(item.title+' '+item.organizer).toLowerCase().includes(q));data={items:filtered.slice((page-1)*pageSize,page*pageSize),total:filtered.length,page,pageSize};}if(p===''&&method==='POST'){event={...body,id,owner_id:'owner',revision:1};events=[{...event,total:0,issued:0}];data=event;}if(p==='/'+id&&method==='GET')data={event,assets,recipients,audit:[]};if(p==='/'+id&&method==='PATCH'){event={...body,revision:event.revision+1};data=event;}
if(p==='/signers')data=[{id:'teacher',nama_lengkap:'Imran, S.Si.'}];if(p.includes('/geometry/'))data={width:841.89,height:595.28,rotation:0};
if(p==='/excel')data={headers:['Nama','Asal Sekolah','Peran'],rows:[['Amelia Putri','Sekolah Contoh Gowa','Peserta'],['Budi Santoso','Sekolah Contoh Makassar','Narasumber']]};
if(p.endsWith('/assets')&&method==='POST'){const aid=assets.length?'33333333-3333-4333-8333-333333333333':'22222222-2222-4222-8222-222222222222';assets.push({id:aid,kind:body.get('kind'),filename:body.get('file').name,mime:'application/pdf',is_public:false});data={id:aid};}
if(p.includes('/assets/')&&method==='PATCH'){assets=assets.map(a=>a.id===p.split('/').at(-1)?{...a,is_public:body.is_public}:a);data=null;}
if(p.endsWith('/recipients')&&method==='POST'){const mapping=JSON.parse(body.get('mapping')),ids=JSON.parse(body.get('ids'));recipients=[['Amelia Putri','Sekolah Contoh Gowa','Peserta'],['Budi Santoso','Sekolah Contoh Makassar','Narasumber']].map((row,i)=>({id:ids[i],name:row[mapping.name],institution:row[mapping.institution]||'',identities:Object.fromEntries(mapping.extras.map(col=>[['Nama','Asal Sekolah','Peran'][col],row[col]])),revision:1,status:'draft',certificate_number:null}));data={count:recipients.length};}
if(p.includes('/recipients/')&&method==='PATCH'){const r=recipients.find(r=>r.id===p.split('/').at(-1));if(r?.revision!==body.revision)return{ok:false,status:409,json:async()=>({ok:false,error:'Data peserta telah berubah'})};recipients=recipients.map(r=>r.id===p.split('/').at(-1)?{...r,...body,revision:r.revision+1}:r);data=null;}
if(p.endsWith('/issue')){recipients=recipients.map((r,i)=>body.ids.includes(r.id)?{...r,status:'issued',certificate_number:'ACCA/000'+(i+1),verify_token:'a'.repeat(48)}:r);data={count:body.ids.length};}
if(p.endsWith('/preview')){const data=Uint8Array.from(atob(await window.renderFixturePDF(body)),c=>c.charCodeAt(0));return{ok:true,arrayBuffer:async()=>data.buffer,blob:async()=>new Blob([data],{type:'application/pdf'})};}return{ok:true,json:async()=>({ok:true,data})};};
const root=createRoot(document.getElementById('root'));window.showVerify=(mode)=>{window.__mode=mode;root.render(<Verify token={(mode==='issued'?'a':mode==='revoked'?'b':'c').repeat(48)}/>)};root.render(<Manager/>);` }, bundle: true, platform: 'browser', outfile: bundle, define: { 'process.env.NODE_ENV': '"production"' } });
  const browser = await require('puppeteer').launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const { renderCertificate }=require('../scratch/ecert-test/pdf');
    const templateAsset={mime:'application/pdf',bytes:fs.readFileSync('output/pdf/template-e-sertifikat-contoh.pdf')};
    await page.exposeFunction('renderFixturePDF',async body=>Buffer.from(await renderCertificate({event:{organizer:'ACCA'},...body},'ACCA/0001','https://acca.icgowa.sch.id/e-sertifikat/verifikasi/'+'a'.repeat(48),templateAsset,true)).toString('base64'));
    await page.setRequestInterception(true); page.on('request', request => {
      if(request.url().endsWith('/api/public/e-sertifikat-worker'))return request.respond({status:200,contentType:'text/javascript',body:fs.readFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.js'))});
      if(request.isNavigationRequest())return request.respond({status:200,contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>'});
      request.abort();
    });
    await page.setViewport({ width: 1280, height: 960 });
    await page.goto('http://ecert.test');
    await page.addStyleTag({ content: '*{box-sizing:border-box}body{margin:0;padding:20px;background:#f1f5f9;font-family:Arial}button,input,select,textarea{font:inherit}' });
    await page.addStyleTag({ path: bundle.replace(/\.js$/, '.css') }); await page.addScriptTag({ path: bundle });
    const clickText = async text => {
      await page.waitForFunction(text => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === text && !el.disabled), {}, text);
      await page.evaluate(text => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text && !el.disabled).click(), text);
    };
    const tab = async label => {
      await page.waitForFunction(() => document.querySelector('.ec-root')?.getAttribute('aria-busy') !== 'true');
      await page.evaluate(label => { const el = [...document.querySelectorAll('[role="tab"]')].find(el => el.textContent.includes(label)); if (!el) throw new Error('Tab missing: '+label); el.click(); }, label);
      const text = label.startsWith('Penerima') ? 'Penerima sertifikat' : 'Dokumen pendukung';
      await page.waitForFunction(text => document.body.textContent.includes(text), {}, text);
    };
    await page.waitForFunction(() => document.body.textContent.includes('Belum ada kegiatan'));
    await clickText('Kegiatan baru'); await page.waitForSelector('.mdl-body .ec-form-grid input');
    await (await page.$$('.mdl-body .ec-form-grid input'))[0].type('Lokakarya Pembelajaran Kreatif');
    await clickText('Buat kegiatan');
    await page.waitForFunction(() => document.body.textContent.includes('Informasi kegiatan') && !document.querySelector('.mdl-overlay'));
    await page.$eval('input[type="file"]', () => {});
    await (await page.$('input[type="file"]')).uploadFile(path.resolve('output/pdf/template-e-sertifikat-contoh.pdf'));
    await page.waitForFunction(() => document.body.textContent.includes('Template tersimpan.'));
    await page.waitForSelector('.ec-editor-layer');
    await page.waitForFunction(()=>document.querySelector('.ec-editor-stage canvas')?.width>100);
    await page.click('.ec-signers > summary'); await clickText('Tambah penandatangan');
    await page.select('select[aria-label="Pilih pegawai 1"]','teacher');
    await page.type('input[aria-label="Jabatan penandatangan 1"]','Ketua Panitia');
    assert.equal(await page.$eval('input[aria-label="Nama penandatangan 1"]',el=>el.value),'Imran, S.Si.');
    // Millimeter coordinates persist as PDF points, independent of zoom.
    await page.click('.ec-position-details > summary'); const x=await page.$('input[aria-label="X (mm)"]');await x.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await x.type('25.01');
    await page.select('select[aria-label="Zoom template"]','2');
    await page.focus('.ec-editor-stage');await new Promise(resolve=>setTimeout(resolve,60));await page.keyboard.press('ArrowRight');await new Promise(resolve=>setTimeout(resolve,60));
    assert.equal(await page.$eval('input[aria-label="X (mm)"]',el=>el.value),'25.11');
    await page.keyboard.down('Alt');await page.keyboard.press('ArrowLeft');await page.keyboard.up('Alt');await new Promise(resolve=>setTimeout(resolve,60));
    assert.equal(await page.$eval('input[aria-label="X (mm)"]',el=>el.value),'25.1');
    await page.select('select[aria-label="Zoom template"]','fit');
    const layer=await page.$('button[aria-label="Posisi Nama peserta"]'),box=await layer.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+10,box.y+box.height/2+8,{steps:5});await page.mouse.up();
    assert(Number(await page.$eval('input[aria-label="X (mm)"]',el=>el.value))>25.1);
    const signerLayers=await page.$$eval('select[aria-label="Elemen aktif"] option',options=>options.filter(o=>o.value.startsWith('signer:')).map(o=>o.value));
    for(const id of signerLayers){await page.select('select[aria-label="Elemen aktif"]',id);const field=await page.$('input[aria-label="X (mm)"]');await field.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await field.type('141.11');await page.keyboard.press('Tab');}
    await page.select('select[aria-label="Elemen aktif"]','qr');
    assert(Number(await page.$eval('input[aria-label="Sisi QR (mm)"]',el=>el.value))>=20);
    // QR drag resizing and slider, at fit and 200% zoom.
    for (const zoom of ['fit','2']) {
      await page.select('select[aria-label="Zoom template"]',zoom);
      const before=Number(await page.$eval('input[aria-label="Sisi QR (mm)"]',el=>el.value));
      const handle=await page.$('button[aria-label="Ubah ukuran QR"]'); await handle.scrollIntoView();
      const b=await handle.boundingBox(); await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2-12,b.y+b.height/2-12,{steps:4});await page.mouse.up();
      const after=Number(await page.$eval('input[aria-label="Sisi QR (mm)"]',el=>el.value));assert(after<before&&after>=20,'QR resize at '+zoom);
    }
    await page.select('select[aria-label="Zoom template"]','fit');
    await page.$eval('input[aria-label="Ukuran QR"]',el=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,'26');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.waitForFunction(()=>Math.abs(Number(document.querySelector('input[aria-label="Sisi QR (mm)"]').value)-26)<.01);
    // Shrink the name box, then move name and school independently.
    for(const id of ['name','institution']) {
      await page.select('select[aria-label="Elemen aktif"]',id);
      const before=Number(await page.$eval('input[aria-label="Lebar (mm)"]',el=>el.value));
      const handle=await page.$('.ec-resize-handle');await handle.scrollIntoView();const b=await handle.boundingBox();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2-25,b.y+b.height/2,{steps:5});await page.mouse.up();
      assert(Number(await page.$eval('input[aria-label="Lebar (mm)"]',el=>el.value))<before,'Text resize '+id);
    }
    await page.select('select[aria-label="Elemen aktif"]','qr');
    const setPrecise=async(label,value)=>{const field=await page.$('input[aria-label="'+label+'"]');await field.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await field.type(String(value));await page.keyboard.press('Tab');};
    const originalQR=await page.$$eval('.ec-position-details input',nodes=>nodes.map(n=>n.value));
    await setPrecise('X (mm)',99999);await setPrecise('Y (mm)',99999);
    const edgeQR=await page.$$eval('.ec-position-details input',nodes=>nodes.map(n=>Number(n.value)));
    assert(edgeQR[0]<297&&edgeQR[1]<210,'Out-of-range positions must display their actual clamped value');
    const corner=await page.$('button[aria-label="Ubah ukuran QR"]');await corner.focus();await page.keyboard.down('Shift');await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');
    const resizedQR=await page.$$eval('.ec-position-details input',nodes=>nodes.map(n=>Number(n.value)));
    assert.equal(resizedQR[0],edgeQR[0],'Keyboard resize must not move QR X');assert.equal(resizedQR[1],edgeQR[1],'Keyboard resize must not move QR Y');
    await setPrecise('X (mm)',originalQR[0]);await setPrecise('Y (mm)',originalQR[1]);await setPrecise('Sisi QR (mm)',originalQR[2]);
    await page.evaluate(()=>{document.querySelector('.ec-signers').open=false;document.querySelector('.ec-position-details').open=false;});
    const editorMetrics={};for(const width of [320,390,768,1280]){
      await page.setViewport({width,height:1100});await new Promise(resolve=>setTimeout(resolve,800));
      await page.waitForFunction(()=>{const c=document.querySelector('.ec-editor-stage canvas');if(!c||!c.width)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<d.length;i+=16)if(d[i]<180&&d[i+3]>0)dark++;return dark>50;});
      editorMetrics[width]=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert(editorMetrics[width].document<=width+1,'Editor overflow '+width);
      if([390,1280].includes(width))await page.screenshot({path:`artifacts/e-sertifikat-simple-editor-${width}.png`,fullPage:true});
      if(width===1280)await (await page.$('.ec-editor-workspace')).screenshot({path:'artifacts/e-sertifikat-simple-preview.png'});
    }
    await tab('Penerima & Sertifikat');
    await (await page.$('input[accept=".xls,.xlsx"]')).uploadFile(path.resolve('apps/web/public/templates/peserta-e-sertifikat.xlsx'));
    await page.waitForFunction(() => document.body.textContent.includes('Petakan kolom Excel'));
    const checks = await page.$$('.mdl-body input[type="checkbox"]'); await checks[2].click();
    await clickText('Impor 2 peserta');
    await page.waitForFunction(() => document.querySelectorAll('.ec-table tbody tr').length === 2 && !document.querySelector('.mdl-overlay'));
    assert(await page.$eval('.ec-table', el => el.textContent.includes('Peran: Peserta') && el.textContent.includes('Sekolah Contoh Gowa')));
    await page.evaluate(()=>[...document.querySelectorAll('[role="tab"]')].find(el=>el.textContent.includes('Kegiatan & Template')).click());
    await page.waitForSelector('select[aria-label="Elemen aktif"]');
    await page.waitForFunction(()=>[...document.querySelector('select[aria-label="Elemen aktif"]').options].some(option=>option.value==='identity:Peran'));
    await page.select('select[aria-label="Elemen aktif"]','identity:Peran');
    await page.waitForFunction(()=>window.__requests.some(r=>r.body?.template?.identityFields?.Peran));
    await tab('Penerima & Sertifikat');
    await clickText('Edit'); await page.waitForSelector('.mdl-body .ec-form-grid input');
    const school = (await page.$$('.mdl-body .ec-form-grid input'))[1]; await school.focus(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await school.type('Sekolah Contoh Sulawesi');
    await clickText('Simpan identitas'); await page.waitForFunction(() => !document.querySelector('.mdl-overlay'));
    assert(await page.$eval('.ec-table', el => el.textContent.includes('Sekolah Contoh Sulawesi')));
    await page.click('input[aria-label="Pilih peserta pada halaman ini"]'); await clickText('Terbitkan (2)'); await clickText('Terbitkan sekarang');
    await page.waitForFunction(() => [...document.querySelectorAll('a[title="Unduh PDF"]')].filter(node => node.getBoundingClientRect().width > 0).length === 2);
    assert.equal(await page.$$eval('a[title="Verifikasi"]', nodes => nodes.filter(node => node.getBoundingClientRect().width > 0).length), 2);
    await tab('Dokumen Pendukung');
    await (await page.$('input[type="file"]')).uploadFile(path.resolve('output/pdf/template-e-sertifikat-contoh.pdf'));
    await page.waitForSelector('.ec-document input[type="checkbox"]');
    assert.equal(await page.$eval('.ec-document input', node => node.checked), false);
    await page.click('.ec-document input'); await page.waitForFunction(() => window.__requests.some(r => r.method==='PATCH'&&r.body?.is_public===true));
    await tab('Penerima & Sertifikat');
    const metrics = {};
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewport({ width, height: 960 }); await new Promise(resolve => setTimeout(resolve, 100));
      metrics[width] = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(metrics[width].document <= width + 1, `Overflow at ${width}: ${JSON.stringify(metrics[width])}`);
      assert.equal(await page.$$eval('a[title="Unduh PDF"]', nodes => nodes.filter(node => node.getBoundingClientRect().width > 0).length), 2);
      if ([390,1280].includes(width)) await page.screenshot({ path: `artifacts/e-sertifikat-simple-manager-${width}.png`, fullPage: true });
    }
    await clickText('Kegiatan');await page.waitForSelector('.ec-events-panel .ec-event-card');
    await page.waitForFunction(()=>window.getPageFab()?.label==='Tambah');
    const listMetrics={};for(const width of [320,390,768,1280]){
      await page.setViewport({width,height:960});await new Promise(resolve=>setTimeout(resolve,100));
      listMetrics[width]=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert(listMetrics[width].document<=width+1,'Event list overflow '+width);
      assert.equal(await page.$eval('.dfab-wrapper',el=>getComputedStyle(el).display==='none'),width<768);
      if([390,1280].includes(width))await page.screenshot({path:`artifacts/e-sertifikat-simple-kegiatan-${width}.png`,fullPage:true});
    }
    const search=await page.$('input[placeholder="Cari kegiatan atau penyelenggara"]');await search.type('Tidak cocok');await page.waitForFunction(()=>document.body.textContent.includes('Kegiatan tidak ditemukan'));await clickText('Reset filter');await page.waitForSelector('.ec-event-card');
    await page.setViewport({width:390,height:960});await page.evaluate(()=>window.runPageFab());await page.waitForSelector('.mdl-overlay');await clickText('Batal');await page.waitForFunction(()=>!document.querySelector('.mdl-overlay')&&window.getPageFab()?.label==='Tambah');
    await page.setViewport({width:1280,height:960});await clickText('Kegiatan baru');await page.waitForSelector('.mdl-overlay');await clickText('Batal');await page.waitForFunction(()=>!document.querySelector('.mdl-overlay'));
    await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:'artifacts/e-sertifikat-simple-kegiatan-dark-1280.png',fullPage:true});await page.evaluate(()=>document.documentElement.classList.remove('dark'));
    await page.evaluate(() => window.showVerify('issued'));
    await page.waitForFunction(() => document.body.textContent.includes('Sertifikat terverifikasi'));
    assert(await page.evaluate(() => document.body.textContent.includes('Amelia Putri') && document.body.textContent.includes('Dokumen persuratan')));
    for (const width of [390,1280]) { await page.setViewport({ width, height: 960 }); await page.screenshot({ path: `artifacts/e-sertifikat-verifikasi-${width}.png`, fullPage: true }); }
    await page.evaluate(() => window.showVerify('revoked'));
    await page.waitForFunction(() => document.body.textContent.includes('Sertifikat dicabut'));
    assert.equal(await page.$('a[href*="/files/"]'), null);
    assert(!(await page.evaluate(() => document.body.textContent.includes('Amelia Putri'))));
    await page.evaluate(() => window.showVerify('invalid'));
    await page.waitForFunction(() => document.body.textContent.includes('Sertifikat tidak ditemukan'));
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/e-sertifikat-simple-ui-metrics.json', JSON.stringify({ metrics, editorMetrics, listMetrics, passed: ['shared desktop FAB opens create modal','mobile bottomnav FAB registration opens create modal','event search and reset filter','320–1280 event list and light/dark styles','native-size PDF canvas','signer selection and title','mm precision and modifier arrow keys','drag position independent of zoom','QR minimum physical size','QR resizing at fit/200%','QR size slider','out-of-range coordinates remain synchronized','keyboard QR resize preserves edge anchor','name and school width handles','individual Excel identity layers','320–1280 editor layout','create event','template upload','Excel mapping and chosen identities','issue selected participants','PDF and verification links','private attachment default and publication toggle','320–1280 layout','valid/revoked/invalid verification'] }, null, 2));
    console.log('Passed e-sertifikat UI: event, template, Excel mapping, issue, documents, public verification, and mobile/desktop layout.');
  } catch (error) {
    const pages = await browser.pages(); const page = pages.at(-1);
    if (page) { fs.writeFileSync('scratch/ecert-ui-debug.json', JSON.stringify(await page.evaluate(() => ({ text: document.body.textContent, requests: window.__requests, inputs: [...document.querySelectorAll('input')].map(input => ({ type: input.type, accept: input.accept, disabled: input.disabled })) })), null, 2)); }
    throw error;
  } finally { await browser.close(); for (const file of [bundle, bundle.replace(/\.js$/, '.css')]) if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
