const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),sharp=require('sharp');
const loaded={};
function load(name){if(loaded[name])return loaded[name];const m={exports:{}};const req=n=>n.startsWith('./')?load(n.slice(2)):require(n);req.resolve=require.resolve;vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/payment-receipts/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports:m.exports,module:m,Buffer,Date,Set,Map,Promise,process,setTimeout,clearTimeout,require:req});return loaded[name]=m.exports}
const {LocalReceiptOcr}=load('local-receipt-ocr');
const xml=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
async function slip(lines,format='png'){
 const width=960,height=lines.length*66+100;
 const svg=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${lines.map((s,i)=>`<text x="45" y="${70+i*66}" fill="black" font-family="Arial" font-size="32">${xml(s)}</text>`).join('')}</svg>`;
 return sharp(Buffer.from(svg)).toFormat(format).toBuffer();
}
test('real Tesseract reads local image bytes without API credentials or network',async()=>{
 const ocr=new LocalReceiptOcr();assert.equal(ocr.available(),true);
 const lines=['TRANSFER BERHASIL','Nama Penerima: SITI AMINAH','Rekening Tujuan: 0123456789','Bank Tujuan: BRI','Nominal Transfer: Rp 100.000,00','Biaya Admin: Rp 2.500,00','Total: Rp 102.500,00','No. Referensi: ABC123456789','Tanggal: 31 Oktober 2026'];
 const png=await slip(lines);fs.mkdirSync('scratch',{recursive:true});fs.writeFileSync('scratch/receipt-ocr-sample.png',png);
 for(const format of ['png','jpeg','webp']){
  const r=await ocr.extract(format==='png'?png:await slip(lines,format));
  assert.equal(r.amount,100000,format);assert.equal(r.account,'0123456789',format);assert.equal(r.bank,'BRI',format);assert.equal(r.status,'success',format);assert.equal(r.recipient,'SITI AMINAH',format);
  console.log(format,JSON.stringify(r));
 }
});
test('real OCR rejects invalid bytes and identifies failed and pending receipts',async()=>{
 const ocr=new LocalReceiptOcr();await assert.rejects(ocr.extract(Buffer.from('not an image')),/Gambar/);
 for(const [text,status]of[['TRANSFER GAGAL','failed'],['TRANSFER PENDING','pending']]){const r=await ocr.extract(await slip([text,'Nama Penerima: SITI AMINAH','Rekening Tujuan: 0123456789','Bank Tujuan: BRI','Nominal Transfer: Rp 100.000,00']));assert.equal(r.status,status);}
});
