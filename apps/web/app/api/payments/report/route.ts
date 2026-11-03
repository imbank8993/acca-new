import { NextRequest,NextResponse } from 'next/server';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { fetchSafeFile } from '@/lib/proxy-guard';
import { launchPuppeteerBrowser } from '@/lib/puppeteer-launcher';
import { appendPaymentProofs,buildPaymentReportHTML,paymentProofs,PaymentProof,PaymentReport } from '@/lib/payments/report';
import { preparePaymentVerification,completePaymentVerification } from '@/lib/payments/verification';
export const dynamic='force-dynamic';export const maxDuration=180;
const MAX_PROOF_BYTES=25*1024*1024,MAX_TOTAL_PROOF_BYTES=150*1024*1024,PROOF_CONCURRENCY=4,PROOF_BUDGET_MS=90000;
async function readProof(proof:PaymentProof,token:string,deadline:number){
 const match=proof.url.match(/^\/api\/pembayaran-massal\/bukti\?id=([0-9a-f-]{36})$/i);
 let response:Response;
 if(match){const base=process.env.NEXT_PUBLIC_NEST_API_URL||'http://127.0.0.1:3007/api';response=await fetch(`${base}/payments/report-proof?id=${match[1]}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(Math.max(1000,Math.min(20000,deadline-Date.now())))});if(!response.ok)throw new Error('Bukti tidak tersedia.');}
 else response=await fetchSafeFile(proof.url);
 if(Number(response.headers.get('content-length')||0)>MAX_PROOF_BYTES)throw new Error('Bukti terlalu besar.');
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>MAX_PROOF_BYTES)throw new Error('Bukti terlalu besar.');
 if(bytes.subarray(0,5).toString()==='%PDF-'){const pdf=await PDFDocument.load(bytes);if(pdf.getPageCount()>20)throw new Error('Bukti terlalu banyak halaman.');proof.bytes=bytes;proof.mime='application/pdf';}
 else{proof.bytes=await sharp(bytes,{limitInputPixels:20000000}).rotate().flatten({background:'#ffffff'}).png().toBuffer();proof.mime='image/png';}
}
/**
 * Unduh bukti beberapa sekaligus dengan satu batas waktu bersama, supaya rekapan
 * dengan banyak lampiran tetap selesai di bawah maxDuration. Bukti yang gagal atau
 * kehabisan waktu ditandai di PDF; melewati 150 MB menghentikan seluruh unduhan.
 */
async function loadProofs(proofs:PaymentProof[],token:string){
 const deadline=Date.now()+PROOF_BUDGET_MS;let next=0,total=0,tooLarge=false;
 const worker=async()=>{
  while(!tooLarge&&next<proofs.length){
   const proof=proofs[next++];
   if(Date.now()>=deadline){proof.error='Waktu unduh bukti habis';continue;}
   try{await readProof(proof,token,deadline);}catch{proof.error='Bukti tidak dapat dimuat';proof.bytes=undefined;continue;}
   total+=proof.bytes?.byteLength||0;if(total>MAX_TOTAL_PROOF_BYTES)tooLarge=true;
  }
 };
 await Promise.all(Array.from({length:Math.min(PROOF_CONCURRENCY,proofs.length)},worker));
 if(tooLarge)throw new Error('Ukuran seluruh lampiran melebihi 150 MB. Cetak per kategori.');
}
export async function GET(req:NextRequest){
 const token=extractRequestToken(req);if(!token)return NextResponse.json({error:'Silakan masuk kembali.'},{status:401});
 const result=await nestFetchAsUser('/payments/report?'+req.nextUrl.searchParams.toString(),token);
 if(result.status!==200||!result.body?.ok)return NextResponse.json({error:result.body?.message||result.body?.error||'Gagal memuat rekapan.'},{status:result.status});
 const data:PaymentReport=result.body.data,proofs=paymentProofs(data.rows);
 if(data.rows.length>2000||proofs.length>200)return NextResponse.json({error:'Data terlalu banyak untuk satu cetakan. Pilih satu kategori pembayaran.'},{status:400});
 let browser;
 try{
  await loadProofs(proofs,token);
  const profile={...data.profil,logo_url:null};
  if(data.profil?.logo_url){try{const image=await fetchSafeFile(data.profil.logo_url);const logo=await sharp(Buffer.from(await image.arrayBuffer()),{limitInputPixels:20000000}).resize({width:240,height:240,fit:'inside'}).png().toBuffer();profile.logo_url='data:image/png;base64,'+logo.toString('base64');}catch{throw new Error('Logo kop tidak dapat dimuat. Periksa pengaturan profil sekolah sebelum mencetak.');}}
  data.profil=profile;
  const verification=await preparePaymentVerification(data,proofs);data.verification=verification.visual;
  browser=await launchPuppeteerBrowser();const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setRequestInterception(true);
  page.on('request',r=>{if(/^data:image\/png;base64,/.test(r.url()))void r.continue();else void r.abort();});
  await page.setContent(buildPaymentReportHTML(data,proofs),{waitUntil:'load'});await page.evaluate(async()=>{await Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve();})));});
  const base=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
  const pdf=await appendPaymentProofs(base,proofs);
  const registered=await nestFetchAsUser('/payments/report-verifications',token,{method:'POST',body:JSON.stringify(completePaymentVerification(verification.record,pdf))});
  if(![200,201].includes(registered.status)||!registered.body?.ok)throw new Error(registered.body?.message||'Verifikasi dokumen gagal disimpan. Silakan cetak kembali.');
  return new NextResponse(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Rekapan_Pembayaran_${data.month}_${data.year}.pdf"`,'Cache-Control':'private, no-store'}});
 }catch(e:any){return NextResponse.json({error:e.message||'Gagal membuat PDF rekapan.'},{status:500});}
 finally{if(browser)await browser.close();}
}
