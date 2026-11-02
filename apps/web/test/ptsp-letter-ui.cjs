const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const esbuild = require('esbuild'), puppeteer = require('puppeteer');
(async () => {
 const tempBase = fs.realpathSync(os.tmpdir());
 const temp = fs.mkdtempSync(path.join(tempBase, 'acca-letter-ui-'));
 assert.equal(path.dirname(path.resolve(temp)), path.resolve(tempBase));
 assert(path.basename(temp).startsWith('acca-letter-ui-'));
 const bundle = path.join(temp, 'fixture.js');
 const notice = { id:'33333333-3333-4333-8333-333333333333', recipient_id:'recipient', sender_name:'Petugas PTSP', recipient_name:'Imran, S.Si.', instructions:'Ada surat permohonan peminjaman sarana. Silakan lihat lampiran.', created_at:'2026-11-02T08:00:00Z', read_at:null, snapshot:{layanan:'Peminjaman Sarana',nama:'Imran, S.Si.',wa:'085110379893',alamat:'Alamat pemohon',file_proposal:'https://example.com/surat.pdf',tracking_token:'RAW_SECRET_TOKEN',storage_type:'supabase',status:1,id:42}};
 await esbuild.build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import Panel from './apps/web/app/layanan-ptsp/components/DisposisiPanel';
 window.__notice=${JSON.stringify(notice)};window.__posts=[];window.__fail=false;window.__mode='admin';window.__files=[];
 window.fetch=async(url,opt={})=>{await new Promise(r=>setTimeout(r,30));if(window.__fail)return{ok:false,status:503,json:async()=>({message:'SELECT * FROM secret_table'})};
 if(opt.method==='POST'){const b=JSON.parse(opt.body);window.__posts.push(b);if(b.action==='mark_read')window.__notice.read_at='2026-11-02T08:30:00Z';return{ok:true,status:200,json:async()=>({ok:true,data:window.__notice})}};
 if(url.includes('recipients=true'))return{ok:true,status:200,json:async()=>({ok:true,data:[{id:'recipient',nama:'Imran, S.Si.',role:'GURU'}]})};
 if(url.includes('?id='))return{ok:true,status:200,json:async()=>({ok:true,data:window.__notice})};
 return{ok:true,status:200,json:async()=>({ok:true,data:[window.__notice],page:1,total:1,summary:{total:1,unread:window.__notice.read_at?0:1}})}};
 function App(){const[source,setSource]=useState(null),[mode,setMode]=useState('admin');window.__recipient=()=>setMode('recipient');return <><button id="compose" onClick={()=>setSource({table:'ptsp_peminjaman_sarana',row:{id:1,nama:'Pemohon'}})}>Compose</button><Panel canManage={mode==='admin'} user={{auth_id:mode==='admin'?'admin':'recipient'}} source={source} onClose={()=>setSource(null)}/></>};createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,outfile:bundle,tsconfig:'apps/web/tsconfig.json',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture',setup(build){build.onResolve({filter:/^(next\/navigation|@\/components\/useFileViewer)$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path.includes('next/')?`export const useSearchParams=()=>new URLSearchParams();`:`export const useFileViewer=()=>({openFile:(url,label)=>window.__files.push({url,label}),viewer:null});`}));}}]});
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
 const browser=await puppeteer.launch({headless:true,userDataDir:path.join(temp,'browser-profile'),timeout:60000,args:['--disable-gpu'],executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||(fs.existsSync(chrome)?chrome:undefined)});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1280,height:900});await page.setRequestInterception(true);page.on('request',request=>request.url()==='http://localhost/ptsp-fixture'?request.respond({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>'}):request.abort());await page.goto('http://localhost/ptsp-fixture');
  await page.addStyleTag({content:fs.readFileSync('apps/web/app/globals.css','utf8').replace(/@import[^;]+;/g,'')});await page.addStyleTag({content:fs.readFileSync(bundle.replace(/\.js$/,'.css'),'utf8').replace(/@import[^;]+;/g,'')});await page.addStyleTag({content:'body{margin:0;padding:16px;font-family:Arial;background:#f6f8fc}*{box-sizing:border-box}button{font-family:inherit}'});
  await page.addScriptTag({path:bundle});await page.waitForSelector('.disposisi-item');
  const text=await page.$eval('.disposisi-panel',el=>el.textContent);assert(text.includes('Pemberitahuan surat masuk'));assert(!/Â|â†|â€¦|Disposisi|Diproses|Tindak lanjut/.test(text));
  for(const width of [320,390,768,1280]){await page.setViewport({width,height:900});for(const dark of [false,true]){await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}}
  await page.evaluate(()=>document.documentElement.classList.remove('dark'));
  await page.click('.disposisi-item');await page.waitForSelector('.disposisi-details');
  assert.equal(await page.evaluate(()=>window.__posts.length),0,'Manager viewing another recipient must not mark read');
  const details=await page.$eval('.mdl-panel',el=>el.textContent);assert(!details.includes('RAW_SECRET_TOKEN'));assert(!details.includes('storage type'));assert(!details.includes('supabase'));assert(details.includes('Nama pemohon'));assert(details.includes('Nomor WhatsApp'));
  await page.click('button.disposisi-download');assert.equal(await page.evaluate(()=>window.__files[0].label),'Proposal');
  for(const width of [320,390,1280]){await page.setViewport({width,height:900});assert(await page.$eval('.mdl-panel',el=>el.scrollWidth<=el.clientWidth+1));}
  await page.evaluate(()=>[...document.querySelectorAll('.mdl-foot button')].find(b=>b.textContent==='Tutup').click());
  await page.evaluate(()=>window.__recipient());await page.click('.disposisi-item');await page.waitForFunction(()=>window.__posts.some(p=>p.action==='mark_read'));await page.waitForFunction(()=>document.querySelector('.disposisi-detail-meta').textContent.includes('Sudah dibaca'));
  await page.evaluate(()=>[...document.querySelectorAll('.mdl-foot button')].find(b=>b.textContent==='Tutup').click());
  await page.click('#compose');await page.waitForFunction(()=>document.querySelector('select option[value="recipient"]'));
  assert.equal(await page.$eval('.mdl-head__title',el=>el.textContent),'Disposisi surat masuk');assert(await page.$('.mdl-panel .uisel select.uisel-input'));
  for(const width of [320,390,1280]){await page.setViewport({width,height:900});assert(await page.$eval('.mdl-panel',el=>el.scrollWidth<=el.clientWidth+1));}
  await page.select('select','recipient');assert.equal(await page.$eval('textarea',el=>el.required),false);
  await page.evaluate(()=>{const form=document.querySelector('#ptsp-letter-send');form.requestSubmit();form.requestSubmit()});
  await page.waitForSelector('.disposisi-success');assert.equal(await page.evaluate(()=>window.__posts.filter(p=>!p.action).length),1);assert(await page.evaluate(()=>window.__posts.find(p=>!p.action).clientRequestId.length===36));
  if(process.env.PTSP_UI_SCREENSHOT_DIR){fs.mkdirSync(process.env.PTSP_UI_SCREENSHOT_DIR,{recursive:true});for(const width of [390,1280]){await page.setViewport({width,height:900});await page.screenshot({path:path.join(process.env.PTSP_UI_SCREENSHOT_DIR,'ptsp-surat-masuk-'+width+'.png'),fullPage:true});}}
  await page.evaluate(()=>{window.__fail=true;[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Muat ulang')).click()});await page.waitForSelector('.disposisi-error');assert(!(await page.$eval('.disposisi-error',el=>el.textContent)).includes('secret_table'));
  assert.deepEqual(errors,[]);console.log('PASS: letter UI at 320-1280px in light/dark mode; readable labels; safe attachments; private read receipt; optional message; duplicate submit blocked; safe error display.');
 }finally{await browser.close();fs.rmSync(temp,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
})().catch(e=>{console.error(e);process.exitCode=1});
