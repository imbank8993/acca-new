import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { renderKopHTML,CENTERED_KOP_CSS } from '@/lib/lckh/print-shared';
export type PaymentRow={id:string;category:string;name:string;nip:string;description:string;quantity:number;amount:number|null;paidOn:string|null;proofUrl:string};
export type PaymentReport={month:number;year:number;category:string;rows:PaymentRow[];summary:{category:string;count:number;total:number}[];profil:any;issuerId?:string;printedBy:string;printedAt:string;missingAmounts:number;missingProofs:number;verification?:{code:string;url:string;qrDataUrl:string}};
export type PaymentProof={label:string;url:string;rows:PaymentRow[];bytes?:Uint8Array;mime?:string;error?:string};
const names:Record<string,string>={GURU_ASUH:'Guru Asuh',KLINIK:'Klinik Pembelajaran',EKSKUL:'Ekstrakurikuler'};
const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const esc=(v:any)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const money=(v:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v);
const date=(v:any)=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Makassar',day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)):'Belum tercatat';
function proofNames(proof:PaymentProof,limit=6){const labels=[...new Set(proof.rows.map(r=>`${names[r.category]} - ${r.name}`))];return [...labels.slice(0,limit),...(labels.length>limit?[`dan ${labels.length-limit} penerima lainnya (lihat rincian ampra)`]:[])];}
export function paymentProofs(rows:PaymentRow[]):PaymentProof[]{const proofs:PaymentProof[]=[];const index=new Map<string,PaymentProof>();for(const row of rows){if(!row.proofUrl)continue;let key=row.proofUrl;try{const u=new URL(key,'https://acca.invalid');u.hash='';key=u.href;}catch{}let proof=index.get(key);if(!proof){proof={label:`B${String(proofs.length+1).padStart(2,'0')}`,url:row.proofUrl,rows:[]};proofs.push(proof);index.set(key,proof);}proof.rows.push(row);}return proofs;}
export function buildPaymentReportHTML(data:PaymentReport,proofs:PaymentProof[]){
 if(!data.verification||!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(data.verification.qrDataUrl))throw new Error('Barcode verifikasi dokumen belum tersedia.');
 const total=data.summary.reduce((s,r)=>s+r.total,0),failed=proofs.filter(p=>p.error).length;
 const reference=(r:PaymentRow)=>proofs.find(p=>p.rows.some(v=>v.id===r.id&&v.category===r.category))?.label||'Belum tersedia';
 const partial=data.missingAmounts>0||data.missingProofs>0||failed>0;
 return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekapan Pembayaran ${months[data.month-1]} ${data.year}</title><style>
 @page{size:A4 portrait;margin:12mm 14mm 17mm 18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10pt;color:#111;margin:0;line-height:1.45}${CENTERED_KOP_CSS}
 h1{font-size:13pt;text-align:center;margin:20px 0 4px}h2{font-size:12pt;margin:0 0 5mm}h3{font-size:11pt}p{margin:6px 0}.subtitle{text-align:center;margin-bottom:7mm}.note{font-size:9pt;color:#444;margin:4mm 0;padding:3mm;border:1px solid #aaa}.meta{font-size:9pt;margin:5mm 0}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:4mm 0}th,td{border:1px solid #555;padding:6px;vertical-align:top;overflow-wrap:anywhere}th{background:#f1f3f5;font-size:9pt}td{font-size:9pt}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}tfoot{display:table-row-group;font-weight:bold}.right{text-align:right}.center{text-align:center}.small{font-size:8pt;color:#444}.category{break-before:page}.verify-block{break-inside:avoid;page-break-inside:avoid;text-align:center;margin:9mm auto 0;max-width:100mm}.verify-block img{width:32mm;height:32mm;display:block;margin:0 auto 2mm}.verify-block strong{font-size:9pt}.verify-block p{font-size:8pt;color:#444;margin:2mm 0}.verify-code{font:8pt 'Courier New',monospace}.empty{padding:15mm;text-align:center}.proof-index{break-before:page}.period{font-size:10pt;margin-bottom:6mm}
 </style></head><body>${renderKopHTML(data.profil)}<h1>REKAPAN PEMBAYARAN BULANAN</h1><div class="subtitle">Periode Kegiatan / Laporan: ${months[data.month-1]} ${data.year}</div>
 <table><thead><tr><th>Kategori Pembayaran</th><th style="width:22mm">Jumlah</th><th style="width:48mm">Jumlah Tercatat</th></tr></thead><tbody>${data.summary.map(s=>`<tr><td>${names[s.category]||esc(s.category)}</td><td class="center">${s.count}</td><td class="right">${money(s.total)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">TOTAL NOMINAL TERCATAT</td><td class="right">${money(total)}</td></tr></tfoot></table>
 ${partial?`<div class="note"><strong>Kelengkapan laporan:</strong> ${data.missingAmounts} pembayaran belum memiliki nominal tersimpan; ${data.missingProofs} pembayaran belum dilengkapi bukti; ${failed} lampiran tidak dapat dimuat. Nominal yang belum tercatat tidak dimasukkan ke total.</div>`:''}
 <p class="small">Rekap mencakup pembayaran berstatus dibayar untuk bulan kegiatan/laporan yang dipilih. Tanggal pembayaran disajikan pada rincian ampra. Pengajuan Komite dicatat tersendiri.</p><p class="meta">Dicetak: ${date(data.printedAt)} oleh ${esc(data.printedBy)}</p>
 <div class="verify-block"><a href="${esc(data.verification.url)}"><img src="${data.verification.qrDataUrl}" alt="Barcode Verifikasi Dokumen"/></a><strong>Verifikasi Dokumen</strong><p>Pindai barcode untuk memeriksa keaslian rekapan pembayaran.</p><div class="verify-code">${esc(data.verification.code)}</div></div>
 ${data.summary.map(s=>{const rows=data.rows.filter(r=>r.category===s.category);return `<section class="category"><h2>AMPRA PEMBAYARAN ${esc(names[s.category]).toUpperCase()}</h2><div class="period">${months[data.month-1]} ${data.year}</div><table><colgroup><col style="width:11mm"><col style="width:35mm"><col><col style="width:9mm"><col style="width:28mm"><col style="width:23mm"><col style="width:15mm"></colgroup><thead><tr><th>No.</th><th>Nama / NIP</th><th>Uraian</th><th>Jml</th><th>Nominal</th><th>Tgl. Bayar</th><th>Bukti</th></tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr><td class="center">${i+1}</td><td>${esc(r.name)}${r.nip?`<br><span class="small">${esc(r.nip)}</span>`:''}</td><td>${esc(r.description)}</td><td class="center">${r.quantity}</td><td class="right">${r.amount===null?'Belum tercatat':money(r.amount)}</td><td>${date(r.paidOn)}</td><td>${reference(r)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">Tidak ada pembayaran pada periode ini.</td></tr>'}</tbody><tfoot><tr><td colspan="4">JUMLAH NOMINAL TERCATAT</td><td colspan="3" class="right">${money(s.total)}</td></tr></tfoot></table></section>`;}).join('')}
 ${proofs.length?`<section class="proof-index"><h2>DAFTAR LAMPIRAN BUKTI TRANSFER</h2><table><thead><tr><th style="width:18mm">Lampiran</th><th>Pembayaran Terkait</th><th style="width:27mm">Keterangan</th></tr></thead><tbody>${proofs.map(p=>`<tr><td>${p.label}</td><td>${proofNames(p).map(esc).join('<br>')}</td><td>${p.error?'Tidak dapat dimuat':'Terlampir'}</td></tr>`).join('')}</tbody></table><p class="small">Satu bukti dapat mencakup beberapa baris kegiatan. Jumlah nominal pada bukti gabungan tidak dijumlahkan ulang.</p></section>`:''}
 </body></html>`;
}
const ascii=(v:string)=>v.normalize('NFKD').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
export async function appendPaymentProofs(base:Uint8Array,proofs:PaymentProof[]){
 const doc=await PDFDocument.load(base),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let totalProofPages=0;
 for(const proof of proofs){
  const people=proofNames(proof,3).join(', ');
  const addPage=()=>{const page=doc.addPage([595.28,841.89]);page.drawText(`LAMPIRAN ${proof.label} - BUKTI TRANSFER`,{x:45,y:800,size:11,font:bold});const value=ascii(people);let part='',y=781;for(const word of value.split(' ')){if(font.widthOfTextAtSize(part+' '+word,9)>505){page.drawText(part,{x:45,y,size:9,font});y-=12;part=word;}else part+=(part?' ':'')+word;if(y<745)break;}if(part&&y>=745)page.drawText(part,{x:45,y,size:9,font});return {page,top:Math.min(735,y-15)};};
  if(proof.error||!proof.bytes){const {page}=addPage();page.drawText('Bukti tidak dapat dimuat. Periksa lampiran pada aplikasi.',{x:45,y:700,size:10,font});continue;}
  if(proof.mime==='application/pdf'){
   const source=await PDFDocument.load(proof.bytes);
   if(source.getPageCount()>20||totalProofPages+source.getPageCount()>300)throw new Error('Lampiran terlalu banyak halaman. Cetak per kategori atau gunakan bukti yang lebih ringkas.');
   const pages=await doc.embedPdf(source,source.getPageIndices());
   for(const embedded of pages){const {page,top}=addPage();const scale=Math.min(505/embedded.width,(top-48)/embedded.height);page.drawPage(embedded,{x:45+(505-embedded.width*scale)/2,y:48+(top-48-embedded.height*scale)/2,width:embedded.width*scale,height:embedded.height*scale});totalProofPages++;}
  }else{
   const embedded=await doc.embedPng(proof.bytes);const {page,top}=addPage();const scale=Math.min(505/embedded.width,(top-48)/embedded.height);page.drawImage(embedded,{x:45+(505-embedded.width*scale)/2,y:48+(top-48-embedded.height*scale)/2,width:embedded.width*scale,height:embedded.height*scale});totalProofPages++;
  }
 }
 const pages=doc.getPages();pages.forEach((page,i)=>{page.drawText(`Halaman ${i+1} dari ${pages.length}`,{x:440,y:22,size:8,font,color:rgb(.35,.35,.35)});});
 return Buffer.from(await doc.save());
}
