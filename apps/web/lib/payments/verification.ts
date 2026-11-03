import { createHash,createHmac,randomBytes,randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { getPublicOrigin } from '@/lib/public-url';
import type { PaymentProof,PaymentReport } from './report';
export function reportRegistrationSignature(record:Record<string,unknown>,secret:string){
 const key=createHmac('sha256',secret).update('acca:payment-report:verification-key:v1').digest();
 const canonical=JSON.stringify(Object.fromEntries(Object.keys(record).sort().map(key=>[key,record[key]])));
 return createHmac('sha256',key).update(canonical).digest('hex');
}
export async function preparePaymentVerification(data:PaymentReport,proofs:PaymentProof[]){
 if(!process.env.JWT_SECRET)throw new Error('Konfigurasi verifikasi dokumen belum tersedia.');
 const id=randomUUID(),token=randomBytes(24).toString('hex');
 const record={id,token,issuerId:data.issuerId,issuerName:data.printedBy,issuedAt:data.printedAt,month:data.month,year:data.year,category:data.category,
  amount:data.summary.reduce((s,r)=>s+r.total,0),entries:data.rows.length,proofs:proofs.length,missingAmounts:data.missingAmounts,missingProofs:data.missingProofs,unavailableProofs:proofs.filter(p=>p.error).length,
  sourceHash:createHash('sha256').update(JSON.stringify({rows:data.rows,summary:data.summary,proofs:proofs.map(p=>({label:p.label,hash:p.bytes?createHash('sha256').update(p.bytes).digest('hex'):null}))})).digest('hex')};
 const url=new URL(`/pembayaran/verifikasi/${token}`,getPublicOrigin()).href;
 const qrDataUrl=await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:4,width:360});
 return {record,visual:{code:`RP-${data.year}${String(data.month).padStart(2,'0')}-${id.slice(0,8).toUpperCase()}`,url,qrDataUrl}};
}
export function completePaymentVerification(record:Record<string,unknown>,pdf:Uint8Array){
 if(!process.env.JWT_SECRET)throw new Error('Konfigurasi verifikasi dokumen belum tersedia.');
 const completed={...record,pdfHash:createHash('sha256').update(pdf).digest('hex')};
 return {record:completed,signature:reportRegistrationSignature(completed,process.env.JWT_SECRET)};
}
