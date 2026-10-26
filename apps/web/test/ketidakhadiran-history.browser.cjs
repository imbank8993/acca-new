// Local browser coverage for the actual history modal, with synthetic student data only.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer');

async function main() {
    const web = path.resolve('apps/web');
    const built = await esbuild.build({
        stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Modal from './app/ketidakhadiran/log-components/HistorySiswaModal';import Header from './components/ui/DetailHeader';import './app/ketidakhadiran/ketidakhadiran.css';import './app/nilai-siswa/nilai-siswa.css';function App(){const [nisn,setNisn]=React.useState('A');window.fixtureStudent=setNisn;return <><div className="kehadiran-page"><Header name="Siswa Contoh" onBack={()=>{}}/></div><div className="nilai-page"><Header name="Siswa Contoh" onBack={()=>{}}/></div><Modal nisn={nisn} onClose={()=>{}}/></>}createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: web, loader: 'tsx' },
        outdir: 'history-fixture', bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
        tsconfig: path.join(web, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [{ name: 'school-year-fixture', setup(b) {
            b.onResolve({filter:/^@\/hooks\/use-tahun-ajaran-filter$/}, () => ({path:'school-year',namespace:'fixture'}));
            b.onLoad({filter:/.*/,namespace:'fixture'}, () => ({contents:`import {useState} from 'react';export function useTahunAjaranFilter(){const[selected,setSelected]=useState('2026/2027');return{years:['2026/2027','2025/2026'],selected,setSelected};}`,resolveDir:web}));
        } }],
    });
    const js = built.outputFiles.find(f => f.path.endsWith('.js')).contents;
    const css = built.outputFiles.find(f => f.path.endsWith('.css')).contents;
    let fail = false;
    const row = (id,jenis,keterangan,status) => ({id,jenis,keterangan,status,tgl_mulai:'2026-10-26',tgl_selesai:'2026-10-26',display_durasi:'1 Hari',waktu_mulai_real:'07:00',waktu_selesai_real:'16:00',created_at:'2026-10-26T05:55:00Z'});
    const server = http.createServer((req,res) => {
        if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');return res.end(js);}
        if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
        if(req.url.startsWith('/api/ketidakhadiran/log/siswa/')){
            const url = new URL(req.url,'http://localhost');
            const old = url.searchParams.get('tahun_ajaran') === '2025/2026';
            const second = url.pathname.endsWith('/B');
            const riwayat = second ? [row('b','IZIN','Kunjungan Siswa Kedua','MADRASAH')] : old ? [row('old','IZIN','Riwayat tahun lalu','MADRASAH')] : [row('s1','SAKIT','Perawatan Luar','BERAT'),row('i1','IZIN','Kompetisi Yogyakarta dengan keterangan panjang untuk memeriksa susunan kartu riwayat','MADRASAH'),row('s2','SAKIT','Demam ringan','RINGAN')];
            const failure = fail;
            setTimeout(()=>{res.statusCode=failure?503:200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(failure?{ok:false,error:'Layanan pengujian tidak tersedia'}:{ok:true,data:{siswa:{nisn:second?'B':'A',nama:second?'Siswa Kedua':'Siswa Contoh dengan Nama Panjang',kelas:'XI A'},stat:{total_izin_hari_kalender:17,total_sakit_hari_kalender:10,total_izin_jp:314.5,total_sakit_jp:96.0666666666666},riwayat}}));},old?400:10);
            return;
        }
        res.setHeader('Content-Type','text/html');
        res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--n-card:#fff;--n-border:#dce0e8;--n-surface:#f8fafc;--n-soft:#eff6ff;--n-ink:#10254a;--n-text:#10254a;--n-primary:#3083ff;--n-muted:#64748b}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.dark{--n-card:#0b1329;--n-surface:#101d34;--n-border:#264163;--n-ink:#e8edf5;--n-text:#e8edf5;--n-muted:#94a3b8;--n-soft:#172c49}</style><div id="root"></div><script src="/app.js"></script>');
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
        browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
        const page=await browser.newPage();
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
        await page.setViewport({width:1280,height:900});
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===3);
        const select=async(title,value)=>page.$$eval(`select[title="${title}"]`,(elements,value)=>{const el=elements.find(e=>e.getBoundingClientRect().width);if(!el)throw Error('Filter not visible');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},value);
        const search=async(value)=>page.$$eval('.hsm-modal input[type=text]',(elements,value)=>{const el=elements.find(e=>e.getBoundingClientRect().width);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
        await select('Jenis','SAKIT');await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===2);
        await search('Kompetisi');await page.waitForSelector('.hsm__timeline:empty');
        await select('Jenis','IZIN');await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===1);
        assert((await page.$eval('.hsm__item',e=>e.textContent)).includes('Yogyakarta'));
        await search('');await select('Jenis','');await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===3);
        assert((await page.$eval('.hsm__stats',e=>e.textContent)).includes('96,07 JP'));
        assert(!(await page.$eval('.hsm__stats',e=>e.textContent)).includes('666666'));
        await select('Tahun ajaran','2025/2026');await new Promise(resolve=>setTimeout(resolve,50));await select('Tahun ajaran','2026/2027');
        await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===3);await new Promise(resolve=>setTimeout(resolve,450));
        assert.equal(await page.$$eval('.hsm__item',e=>e.length),3,'Late school-year response cannot replace current data');
        fail=true;await select('Tahun ajaran','2025/2026');await page.waitForSelector('.hsm__error');
        fail=false;await select('Tahun ajaran','2026/2027');await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===3);
        assert.equal(await page.$$('.hsm__error').then(e=>e.length),0,'Error clears on successful reload');
        for(const width of [320,390,1280]) {
            await page.setViewport({width,height:900});
            await select('Jenis','SAKIT');await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===2);
            await search('ringan');await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===1);
            await search('');await select('Jenis','');
            const size=await page.evaluate(()=>{const p=document.querySelector('.hsm-modal');const b=p.querySelector('.mdl-body');return{viewport:innerWidth,page:document.documentElement.scrollWidth,panel:p.getBoundingClientRect().width,body:b.clientWidth,content:b.scrollWidth,heading:getComputedStyle(p.querySelector('.dh-header')).borderTopWidth,headers:[...document.querySelectorAll('.kehadiran-page .dh-header,.kehadiran-page .dh-backBtn,.nilai-page .dh-header,.nilai-page .dh-backBtn')].map(e=>getComputedStyle(e).borderTopWidth)};});
            assert(size.page<=size.viewport);assert(size.content<=size.body);assert.equal(size.heading,'1px');assert(size.headers.every(w=>w==='1px'));
            if(width!==320)await page.screenshot({path:path.join(os.tmpdir(),`acca-history-siswa-${width}.png`),fullPage:true});
        }
        await select('Jenis','SAKIT');await search('perawatan');
        await page.evaluate(()=>window.fixtureStudent('B'));
        await page.waitForFunction(()=>document.querySelector('.hsm-modal .dh-name')?.textContent==='Siswa Kedua');
        await page.waitForFunction(()=>document.querySelectorAll('.hsm__item').length===1);
        assert((await page.$eval('.hsm__item',e=>e.textContent)).includes('Kunjungan Siswa Kedua'));
        await page.evaluate(()=>document.documentElement.classList.add('dark'));
        assert.equal(await page.$eval('.hsm-modal .dh-header',e=>getComputedStyle(e).borderTopWidth),'1px');
        assert.deepEqual(errors,[]);
        console.log('Verified history type/search intersection, school-year race/error recovery, student switch, JP rounding, 1px borders, and 320/390/1280px layouts.');
    } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
