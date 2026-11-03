const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),puppeteer=require('puppeteer');
const {PDFDocument,StandardFonts}=require('pdf-lib');
function load(file){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='@/lib/lckh/print-shared'?load('apps/web/lib/lckh/print-shared.ts'):require(n),m,m.exports);return m.exports}
async function main(){
 const {paymentProofs,buildPaymentReportHTML,appendPaymentProofs}=load('apps/web/lib/payments/report.ts');let browser;
 try{
  browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();
  await page.setViewport({width:400,height:800});await page.setContent('<style>body{margin:0;font-family:Arial;background:white}.receipt{padding:24px;height:740px;border:1px solid #ddd}h2{color:#08765a}p{line-height:2}</style><div class="receipt"><h2>TRANSFER BERHASIL</h2><p>BUKTI CONTOH PENGUJIAN</p><hr><p>Nama Penerima<br><strong>Siti Aminah</strong></p><p>Rekening Tujuan<br>0123456789</p><p>Nominal Transfer<br><strong>Rp 100.000,00</strong></p><p>Referensi: TEST123456<br>Tanggal: 3 November 2026</p></div>');
  const image=new Uint8Array(await page.screenshot());
  const source=await PDFDocument.create();const f=await source.embedFont(StandardFonts.Helvetica);source.addPage([420,595]).drawText('CONTOH BUKTI TRANSFER PDF - TEST987654',{x:20,y:540,size:12,font:f});
  const rows=Array.from({length:55},(_,i)=>({id:'g'+i,category:'GURU_ASUH',name:'Guru Contoh '+(i+1),nip:'198001012026111001',description:'Honor pendampingan dan laporan Guru Asuh bulan November',quantity:1,amount:i===54?null:100000,paidOn:'2026-11-03T00:00:00Z',proofUrl:i===54?'':'https://file.icgowa.sch.id/shared-proof.png'}));
  rows.push({id:'k1',category:'KLINIK',name:'Guru Klinik',nip:'',description:'Matematika: Persiapan Olimpiade',quantity:1,amount:50000,paidOn:'2026-11-04T00:00:00Z',proofUrl:'https://file.icgowa.sch.id/bank-proof.pdf'});
  rows.push({id:'e1',category:'EKSKUL',name:'Pembina Pramuka',nip:'123',description:'Ekstrakurikuler Pramuka',quantity:4,amount:250000,paidOn:'2026-11-05T00:00:00Z',proofUrl:'https://file.icgowa.sch.id/missing.png'});
  const data={month:11,year:2026,category:'ALL',rows,summary:[{category:'GURU_ASUH',count:55,total:5400000},{category:'KLINIK',count:1,total:50000},{category:'EKSKUL',count:1,total:250000}],profil:{nama:'MADRASAH CONTOH PENGUJIAN',jenjang:'MA',kabupaten_kota:'Gowa',alamat:'Jalan Pendidikan Nomor 1',provinsi:'Sulawesi Selatan',kepala_sekolah_nama:'Kepala Madrasah Contoh',kepala_sekolah_nip:'198001012026111001'},printedBy:'Bendahara Contoh',printedAt:'2026-11-03T00:00:00Z',missingAmounts:1,missingProofs:1};
  const proofs=paymentProofs(rows);assert.equal(proofs.length,3);assert.equal(proofs[0].rows.length,54);proofs[0].bytes=image;proofs[0].mime='image/png';proofs[1].bytes=await source.save();proofs[1].mime='application/pdf';proofs[2].error='Tidak tersedia';
  const html=buildPaymentReportHTML(data,proofs);assert(html.includes('KEMENTERIAN AGAMA REPUBLIK INDONESIA'));assert(html.includes('Belum tercatat'));assert(!html.includes('<script'));
  await page.setViewport({width:1000,height:1200});await page.setContent(html,{waitUntil:'load'});const base=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});const final=await appendPaymentProofs(base,proofs);
  const parsed=await PDFDocument.load(final);assert(parsed.getPageCount()>=8);for(const p of parsed.getPages()){assert(Math.abs(p.getWidth()-595.28)<1);assert(Math.abs(p.getHeight()-841.89)<1)}
  fs.mkdirSync('tmp/pdfs',{recursive:true});fs.writeFileSync('tmp/pdfs/payment-report-sample.pdf',final);fs.writeFileSync('tmp/pdfs/payment-report-sample.html',html);console.log('Verified A4 report, shared letterhead, 55-row multipage ampra, unique proofs, image/PDF attachments, unavailable-proof notice; pages:',parsed.getPageCount());
 }finally{try{await browser?.close()}catch(e){if(e.code!=='EBUSY')throw e}}
}
main().catch(e=>{console.error(e);process.exitCode=1});
