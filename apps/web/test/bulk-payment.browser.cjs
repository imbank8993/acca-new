const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),puppeteer=require('puppeteer');
async function main(){
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Modal from './apps/web/app/pembayaran/BulkPaymentModal';window.applied=0;createRoot(document.getElementById('root')).render(<Modal initialKind="GURU_ASUH" initialMonth={10} initialYear={2026} onClose={()=>window.closed=true} onApplied={()=>window.applied++}/>);`;
 const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'scratch/bulk-ui',format:'iife',jsx:'automatic'});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(js)}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css)}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--n-card:#fff;--n-ink:#172b4d;--n-text:#172b4d;--n-muted:#64748b;--n-primary:#3083ff;--n-border:#dce3ed;--n-soft:#eff6ff;--n-surface:#f8fafc;--n-bg:#f1f5f9}html.dark{--n-card:#0b1329;--n-ink:#f1f5f9;--n-text:#f1f5f9;--n-muted:#94a3b8;--n-border:#28446d;--n-soft:#142846;--n-surface:#111e35}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}</style><div id="root"></div><script src="/app.js"></script>')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(()=>{
   window.saved=JSON.parse(sessionStorage.getItem('test-receipts')||'[]');window.attempt=0;
   const candidates=Array.from({length:10},(_,i)=>({key:'GURU_ASUH:target-'+i,name:'Guru '+(i+1),nip:'123'+i,label:'Guru Asuh',amount:100000}));
   window.fetch=async(url,options)=>{
    const body=options?.body?JSON.parse(options.body):null;
    const json=data=>({ok:true,json:async()=>data});
    if(!body)return json({ok:true,configured:true,candidates,receipts:window.saved});
    if(body.action==='apply'){window.lastApply=body;window.saved=window.saved.map(r=>{const s=body.selections.find(s=>s.id===r.id);return s?{...r,applied_at:new Date().toISOString(),selected:candidates.find(c=>c.key===s.key)}:r});sessionStorage.setItem('test-receipts',JSON.stringify(window.saved));return json({ok:true,count:body.selections.length})}
    const i=window.attempt++;
    if(body.filename.includes('fail'))return {ok:false,json:async()=>({error:'Gambar tidak dapat dibaca'})};
    const receipt={id:body.receiptId,filename:body.filename,extracted:{recipient:'Guru '+(i+1),bank:'BRI',account:i===1?'***789':'0123456789',amount:100000,date:'2026-10-31',reference:'REF'+i,status:'success'},ready:i!==1,suggestedKey:candidates[i]?.key||'',reason:i===1?'Nama cocok; rekening perlu diperiksa':'Rekening, bank, dan nominal sesuai'};
    window.saved.push(receipt);sessionStorage.setItem('test-receipts',JSON.stringify(window.saved));return json({ok:true,receipt,candidates});
   };
  });
  await page.setViewport({width:1280,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('.bp-drop button:not([disabled])');
  assert.equal(await page.$$('.bp-scope .uisel select').then(a=>a.length),3);
  await page.evaluate(()=>{const dt=new DataTransfer();for(let i=0;i<10;i++)dt.items.add(new File(['synthetic'],i===9?'fail.png':'transfer-'+i+'.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))});
  await page.waitForFunction(()=>document.querySelectorAll('.bp-row').length===10 && document.querySelector('.bp-row:last-child').textContent.includes('Gambar tidak dapat dibaca'));
  await page.waitForFunction(()=>!document.querySelector('.bp-drop button').disabled);
  assert.equal(await page.$$('.bp-row .bp-check input:checked').then(a=>a.length),8);
  assert.equal(await page.$$('.bp-review').then(a=>a.length),1);
  await page.click('.bp-review input');assert.equal(await page.$$('.bp-row .bp-check input:checked').then(a=>a.length),9);
  fs.mkdirSync('scratch',{recursive:true});await page.evaluate(()=>document.querySelector('.mdl-body').scrollTop=0);await page.screenshot({path:'scratch/bulk-payment-desktop.png'});
  for(const width of [390,320]){await page.setViewport({width,height:844});await page.screenshot({path:`scratch/bulk-payment-mobile-${width}.png`});assert(await page.evaluate(()=>document.querySelector('.mdl-panel').getBoundingClientRect().width<=innerWidth));assert(await page.evaluate(()=>document.querySelector('.mdl-body').scrollWidth<=document.querySelector('.mdl-body').clientWidth+1));assert(await page.evaluate(()=>document.querySelector('.mdl-foot').getBoundingClientRect().bottom<=innerHeight+1))}
  await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:'scratch/bulk-payment-dark.png'});
  await page.click('.bp-footer-actions button:last-child');await page.waitForFunction(()=>window.applied===1);assert.equal(await page.evaluate(()=>window.lastApply.selections.length),9);assert.equal(await page.$$('.bp-row .bp-status--success').then(a=>a.length),9);
  await page.reload();await page.waitForSelector('.bp-row');assert.equal(await page.$$('.bp-row').then(a=>a.length),9);assert.equal(await page.$$('.bp-row .bp-status--success').then(a=>a.length),9);assert.equal(await page.$eval('.bp-row .bp-mapping select',e=>e.value),'GURU_ASUH:target-0');
  assert.deepEqual(errors,[]);console.log('Verified shared Modal/InlineSelect, 10 uploads, per-file failure, manual review, apply, 320/390/1280px, dark mode.');
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
