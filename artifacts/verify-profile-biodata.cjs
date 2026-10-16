const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const bundle = path.join(os.tmpdir(), `acca-profile-biodata-${Date.now()}.js`);
  await require('esbuild').build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import Profile from './apps/web/app/profile/view';
window.__calls=[];window.__mode='loading';window.__identity='Siswa Contoh';
window.fetch=async(url)=>{window.__calls.push(url);if(url!='/api/profile-siswa')return {ok:true,json:async()=>({ok:true,data:null})};const mode=window.__mode,identity=window.__identity;if(mode==='loading')await new Promise(resolve=>window.__release=resolve);return {ok:mode!=='error',json:async()=>mode==='error'?({ok:false,message:'Koneksi biodata gagal'}):({ok:true,data:mode==='missing'?null:{nisn:'0012345678',nama_lengkap:identity,gender:'L',asal_sekolah:'Sekolah Contoh'}})}};
const root=createRoot(document.getElementById('root'));window.renderProfile=(id,mode='ready',identity='Siswa Contoh',roles=['SISWA'])=>{window.__mode=mode;window.__identity=identity;root.render(<Profile user={{id,nip:'0012345678',username:'nama-login-'+id,nama:identity,roles,email:'siswa@example.test'}} onRefreshUser={async()=>{}}/>)};window.renderProfile(1,'loading');` }, bundle: true, platform: 'browser', outfile: bundle, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixtures', setup(build) {
    build.onResolve({ filter: /^(@\/components\/ModalBlurProvider|@\/lib\/auth-client|@\/lib\/settings-client|@\/lib\/swal-premium|sweetalert2)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path.includes('ModalBlurProvider') ? 'const noop=()=>{};export const useModalBlur=()=>({openModal:noop,closeModal:noop});' : args.path.includes('auth-client') ? 'export const clearUserCache=()=>{};' : args.path.includes('settings-client') ? 'export async function getActiveAcademicYear(){return "2026/2027"};export async function getActiveSettings(){return null}' : args.path.includes('swal-premium') ? 'export const swalSuccess=()=>{},swalError=()=>{},swalWarning=()=>{},swalConfirm=async()=>false;' : 'export default {fire:async()=>({isConfirmed:false})};' }));
  } }] });
  const browser = await require('puppeteer').launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true); page.on('request', request => request.abort());
    await page.setViewport({ width: 1280, height: 900 });
    await page.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ path: bundle.replace(/\.js$/, '.css') }); await page.addScriptTag({ path: bundle });
    const open = async () => { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Biodata Siswa'))); await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Biodata Siswa')).click()); };
    await open(); await page.waitForFunction(() => document.querySelector('[aria-label="Memuat biodata siswa..."]'));
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'Siswa Contoh'));
    await page.evaluate(() => window.renderProfile(2, 'missing'));
    await page.waitForFunction(() => document.body.textContent.includes('Biodata siswa belum tertaut'));
    assert(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Biodata Siswa'))));
    await page.evaluate(() => window.renderProfile(3, 'error'));
    await page.waitForFunction(() => document.body.textContent.includes('Koneksi biodata gagal'));
    await page.evaluate(() => { window.__mode = 'ready'; [...document.querySelectorAll('button')].find(b => b.textContent === 'Coba lagi').click(); });
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'Siswa Contoh'));
    await page.evaluate(() => window.renderProfile(4, 'loading', 'Profil lama'));
    await page.waitForFunction(() => typeof window.__release === 'function' && document.querySelector('[aria-label="Memuat biodata siswa..."]'));
    await page.evaluate(() => { window.__oldRelease = window.__release; window.renderProfile(5, 'ready', 'Profil baru', ['SISWA', 'GURU']); });
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'Profil baru'));
    await page.evaluate(() => window.__oldRelease());
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(!(await page.evaluate(() => [...document.querySelectorAll('input')].some(input => input.value === 'Profil lama'))));
    assert.deepEqual(errors, []);
    console.log('Passed: Biodata tab while loading, linked data, missing link, request error and retry, mixed student/teacher roles, stale response protection.');
  } finally { await browser.close(); for (const file of [bundle, bundle.replace(/\.js$/, '.css')]) if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
