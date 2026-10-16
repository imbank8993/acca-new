const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const bundle=path.join(os.tmpdir(),`acca-bulk-data-${Date.now()}.js`);
 await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import Bulk from './apps/web/app/pengaturan-data/tabs/BulkReplaceTab';
window.confirm=()=>true;window.__calls=[];window.__hold=false;
window.fetch=async(url,options)=>{window.__calls.push({url,body:options?.body});if(options?.method==='POST'){const rows=JSON.parse(options.body).rows;window.__sent=rows;return{ok:true,json:async()=>({ok:true,updated:rows.length,failed:0,message:'Berhasil memperbarui '+rows.length+' sel.',results:rows.map(row=>({...row,id:JSON.stringify([row.table,row.rowId,row.column]),status:'ok'}))})}}const hold=window.__hold;if(hold)await new Promise(resolve=>window.__release=resolve);const old=new URL(url,'https://fixture.test').searchParams.get('value');return{ok:true,json:async()=>({ok:true,tablesSearched:206,tablesAvailable:206,columnsAvailable:2007,truncated:false,results:['alamat','nomor_hp'].map((column,i)=>({id:JSON.stringify(['new_business_table',JSON.stringify({id:i+1}),column]),table:'new_business_table',column,oldValue:old,oldJson:JSON.stringify(old),rowId:JSON.stringify({id:i+1}),tableKey:'__primary_key__',rowLabel:'Data contoh '+(i+1)}))})}};createRoot(document.getElementById('root')).render(<Bulk/>);`},bundle:true,platform:'browser',outfile:bundle,define:{'process.env.NODE_ENV':'"production"'}});
 const browser=await require('puppeteer').launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',request=>request.abort());await page.setViewport({width:1280,height:900});
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({content:'*{box-sizing:border-box}body{font-family:Arial;margin:0;padding:16px;--n-primary:#3083ff;--n-card:#fff;--n-border:#e2e8f0;--n-muted:#64748b;--n-ink:#172f50}'});
  if(fs.existsSync(bundle.replace(/\.js$/,'.css')))await page.addStyleTag({path:bundle.replace(/\.js$/,'.css')});await page.addScriptTag({path:bundle});
  await page.type('.bulk__inputGrid input','0812345678');await page.type('.bulk__field:nth-of-type(3) input','0899999999');
  await page.click('.bulk__actionRow button');await page.waitForSelector('.bulk__table tbody tr');
  assert.equal(await page.$$eval('.bulk__table tbody tr',rows=>rows.length),2);assert((await page.evaluate(()=>document.body.textContent)).includes('2007 kolom'));
  await page.click('.bulk__selectAll input');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Eksekusi')).click());
  await page.waitForFunction(()=>document.body.textContent.includes('Berhasil memperbarui 2 sel.'));
  const sent=await page.evaluate(()=>window.__sent);assert.equal(sent.length,2);assert.equal(sent[0].oldJson,'"0812345678"');assert.equal(sent[0].tableKey,'__primary_key__');
  assert.equal(await page.$('.bulk__table'),null);
  await page.evaluate(()=>window.__hold=true);await page.click('.bulk__actionRow button');
  await page.waitForFunction(()=>typeof window.__release==='function');
  await page.type('.bulk__inputGrid input','0');await page.evaluate(()=>window.__release());await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(await page.$('.bulk__table'),null);assert.deepEqual(errors,[]);
  for(const width of [390,1280]){await page.setViewport({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  console.log('Passed: dynamic table/column preview, coverage, selection, typed old value submission, success clears rows, input changes discard stale results, responsive layout.');
 }finally{await browser.close();for(const file of[bundle,bundle.replace(/\.js$/,'.css')])if(fs.existsSync(file))fs.unlinkSync(file);}
})().catch(error=>{console.error(error);process.exitCode=1;});
