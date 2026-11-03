const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),esbuild=require('esbuild'),puppeteer=require('puppeteer');
async function main(){
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Payment from './apps/web/app/pembayaran/view';createRoot(document.getElementById('root')).render(<Payment user={{roles:['BENDAHARA_KOMITE'],pagesArray:['pembayaran']}}/>);`;
 const bundled=await esbuild.build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'scratch/committee-ui',format:'iife',jsx:'automatic',define:{'process.env':'{}'}});
 const js=bundled.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundled.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(js)}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css)}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--n-card:#fff;--n-ink:#172b4d;--n-muted:#64748b;--n-border:#dce3ed;--n-soft:#eff6ff;--n-primary:#3083ff;--n-surface:#f8fafc}html.dark{--n-card:#0b1329;--n-ink:#f1f5f9;--n-muted:#94a3b8;--n-border:#28446d;--n-soft:#142846;--n-surface:#111e35}*{box-sizing:border-box}body{margin:0;padding:16px;font-family:Arial,sans-serif;background:var(--n-surface)}</style><div id="root"></div><script src="/app.js"></script>')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message)});
  await page.evaluateOnNewDocument(()=>{
   const now=new Date(),month=now.getMonth()+1,year=now.getFullYear(),date=`${year}-${String(month).padStart(2,'0')}-03`;
   const guru={id:'g1',nama_guru_snap:'Guru Contoh',nip:'123',bulan:month,tahun:year,total_laporan:4,status:'Approved',dibayarkan:true,catatan_pembayaran:JSON.stringify({nominal:70000,url:'https://example.com/old.pdf',text:'Lama'})};
   const slots=[{id:'k1',guru_id:1,nama_guru:'Tentor Satu',mapel:'Matematika',topik:'Aljabar',tanggal:date,status:'paid',nominal_dibayarkan:50000,catatan_pembayaran:null},{id:'k2',guru_id:2,nama_guru:'Tentor Dua',mapel:'Fisika',topik:'Gaya',tanggal:date,status:'paid',nominal_dibayarkan:60000,catatan_pembayaran:null}];
   slots.push({...slots[0],id:'k3',topik:'Geometri'});
   window.fetch=async(url,opt)=>{
    const r=data=>({ok:true,status:200,json:async()=>data});
    if(url==='/api/upload')return r({ok:true,publicUrl:'https://example.com/new.pdf'});
    if(url==='/api/payments/proof'){const b=JSON.parse(opt.body);window.lastProof=b;const target=b.kind==='GURU_ASUH'?guru:slots.find(s=>s.id===b.id);target.catatan_pembayaran=JSON.stringify({...JSON.parse(target.catatan_pembayaran||'{}'),url:b.url,text:b.text});return r({ok:true})}
    if(url.startsWith('/api/guru-asuh/laporan-submission'))return r({ok:true,data:[guru]});
    if(url==='/api/klinik')return r({ok:true,data:slots});
    if(url.startsWith('/api/pembayaran-massal'))return r({ok:true,data:{k1:'bulk-old'}});
    if(url==='/api/tarif-honor')return r({ok:true,data:[{modul:'GURU_ASUH',nominal:999999},{modul:'KLINIK',nominal:999999}]});
    return r({ok:true,data:[]});
   };
  });
  const click=async text=>page.evaluate(t=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===t);if(!b)throw new Error('Button missing: '+t);b.click()},text);
  const pick=async()=>page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File(['proof'],'new.pdf',{type:'application/pdf'}));const input=document.querySelector('.mdl-panel input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))});
  await page.setViewport({width:1440,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.body.textContent.includes('Guru Contoh'));
  assert(!await page.evaluate(()=>/laporan/i.test(document.body.textContent)));await click('Edit Bukti');await page.waitForSelector('.mdl-panel');assert(await page.$eval('.pay-summary',e=>e.textContent.includes('70.000')));await pick();await click('Simpan Bukti');await page.waitForFunction(()=>window.lastProof?.kind==='GURU_ASUH');await page.waitForSelector('.mdl-panel',{hidden:true});
  await page.evaluate(()=>document.querySelector('.swal2-confirm')?.click());await page.evaluate(()=>Array.from(document.querySelectorAll('[role=tab]')).find(b=>b.textContent.includes('Klinik Pembelajaran')).click());await page.waitForFunction(()=>document.body.textContent.includes('Tentor Satu'));await click('Unggah / Edit Bukti');await click('Edit Bukti');await page.waitForSelector('.mdl-panel');await pick();await click('Simpan Bukti');await page.waitForFunction(()=>window.lastProof?.id==='k1');assert.equal(await page.evaluate(()=>window.lastProof.expectedNote),null);await page.waitForSelector('.mdl-panel',{hidden:true});await page.evaluate(()=>document.querySelector('.swal2-confirm')?.click());
  await click('Unggah Bukti');await page.waitForSelector('.mdl-panel');await pick();await click('Simpan Bukti');await page.waitForFunction(()=>window.lastProof?.id==='k2');await page.waitForSelector('.mdl-panel',{hidden:true});await page.evaluate(()=>document.querySelector('.swal2-confirm')?.click());
  await page.waitForSelector('.swal2-container',{hidden:true});fs.mkdirSync('scratch',{recursive:true});await page.screenshot({path:'scratch/klinik-proof-desktop.png'});
  await page.setViewport({width:390,height:844});await page.waitForSelector('.mui-item');await page.click('.mui-item');await click('Edit Bukti');await page.waitForSelector('.mdl-panel');assert(await page.evaluate(()=>document.querySelector('.mdl-panel').getBoundingClientRect().width<=innerWidth));await page.evaluate(()=>Promise.all(document.querySelector('.mdl-panel').getAnimations().map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:'scratch/klinik-proof-mobile.png'});assert.deepEqual(errors,[]);console.log('Verified Guru Asuh kegiatan labels, historical totals, Klinik upload and proof replacement on desktop/mobile.');
 }finally{try{await browser?.close()}catch(e){if(e.code!=='EBUSY')throw e}finally{await new Promise(r=>server.close(r))}}
}
main().catch(e=>{console.error(e);process.exitCode=1});
