const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,Date,Map,Set,require:()=>rules});return m.exports}
const rules=load('apps/api/src/payment-receipts/payment-rules.ts');
const {parseReceiptLines,tsvLines,rupiahAmount}=load('apps/api/src/payment-receipts/receipt-ocr-parser.ts');
const parse=text=>parseReceiptLines(text.trim().split('\n').map(text=>({text,confidence:96})));
const receipt=`Transfer Berhasil
Dari
Nama Pengirim: BENDahara
No. Rekening: 9999999999
Bank: BNI
Nama Penerima: SITI AMINAH
Rekening Tujuan: 0123456789
Bank Tujuan: BRI
Nominal Transfer: Rp 100.000,00
Biaya Admin: Rp 2.500,00
Total: Rp 102.500,00
Tanggal: 31 Oktober 2026
No. Referensi: ABC123456789`;
test('destination account and principal exclude sender account and admin fees',()=>{const r=parse(receipt);assert.equal(r.recipient,'SITI AMINAH');assert.equal(r.account,'0123456789');assert.equal(r.bank,'BRI');assert.equal(r.amount,100000);assert.equal(r.status,'success');assert.equal(r.date,'2026-10-31');assert.equal(r.reference,'ABC123456789');assert.equal(r.reviewRequired,false)});
test('labels above values work for Indonesian and English receipts',()=>{const r=parse(`Transaction successful\nRecipient Name\nSITI AMINAH\nDestination Account Number\n0123456789\nDestination Bank\nBRI\nTransfer Amount\nIDR 100,000.00\nReference Number\nABC123456\nDate\n2026-10-31`);assert.equal(r.amount,100000);assert.equal(r.account,'0123456789');assert.equal(r.bank,'BRI');assert.equal(r.status,'success');assert.equal(r.reviewRequired,false)});
test('header bank and unlabeled amounts stay suggestions',()=>{const r=parse(`BRImo\nTransfer Berhasil\nRp 100.000,00\nNama Penerima: SITI AMINAH\nRekening Tujuan: 0123456789\nBRI\nBiaya Admin\nRp 2.500,00\nTotal\nRp 102.500,00`);assert.equal(r.amount,100000);assert.equal(r.bank,'BRI');assert.equal(r.reviewRequired,true)});
test('masked accounts are preserved; OCR-confused account characters are never repaired or truncated',()=>{assert.equal(parse(receipt.replace('0123456789','****456789')).account,'****456789');assert.equal(parse(receipt.replace('0123456789','01234567O123456')).account,'')});
test('failed, pending, scheduled and negated success cannot mark paid',()=>{for(const [status,expect] of [['Transfer tidak berhasil','failed'],['Transfer gagal','failed'],['Transfer pending','pending'],['Transfer terjadwal','pending'],['Belum berhasil','unknown'],['Transfer details','unknown']])assert.equal(parse(receipt.replace('Transfer Berhasil',status)).status,expect);assert.equal(parse(receipt+'\nStatus: Pending').status,'pending')});
test('unclear important words and conflicting destinations require review',()=>{const lines=receipt.split('\n').map(text=>({text,confidence:text.startsWith('Rekening Tujuan')?40:96}));assert.equal(parseReceiptLines(lines).reviewRequired,true);const r=parse(receipt+'\nRekening Tujuan: 9876543210');assert.equal(r.account,'');assert.equal(r.reviewRequired,true)});
test('ambiguous amounts, foreign currencies, noninteger amounts and impossible dates are rejected',()=>{assert.equal(parse(receipt+'\nNominal: Rp 150.000,00').amount,null);assert.equal(parse(receipt.replace('Rp 100.000,00','USD 100.00')).amount,null);for(const [v,n] of [['Rp 1.000.000,00',1000000],['IDR 1,000,000.00',1000000],['100000',100000],['Rp 100.000,-',100000],['USD 100.00',null],['Rp 100,50',null],['Rp 10.00.000',null]])assert.equal(rupiahAmount(v),n,v);assert.equal(parse(receipt.replace('31 Oktober 2026','31/02/2026')).date,'')});
test('TSV reconstructs lines and carries the lowest word confidence',()=>{const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t96\tTransfer\n5\t1\t1\t1\t1\t2\t10\t0\t10\t10\t41\tBerhasil';const result=tsvLines(tsv);assert.equal(result[0].text,'Transfer Berhasil');assert.equal(result[0].confidence,41)});
test('low confidence forces manual review even when the account and nominal match exactly',()=>{const r=parseReceiptLines(receipt.split('\n').map(text=>({text,confidence:40})));const c={key:'one',nip:'123',name:'SITI AMINAH',amount:100000,accounts:[{number:'0123456789',bank:'BRI',name:'SITI AMINAH'}]};assert.equal(rules.matchingReceipt(r,[c]).ready,false);assert.equal(rules.matchingReceipt(r,[c]).suggestedKey,'one')});
