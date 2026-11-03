import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { canReadPayments } from './payment-access';

const canonical=(record:Record<string,unknown>)=>JSON.stringify(Object.fromEntries(Object.keys(record).sort().map(key=>[key,record[key]])));
export function reportRegistrationSignature(record:Record<string,unknown>,secret:string){
 const key=createHmac('sha256',secret).update('acca:payment-report:verification-key:v1').digest();
 return createHmac('sha256',key).update(canonical(record)).digest('hex');
}
@Injectable()
export class PaymentVerificationsService{
 constructor(private prisma:PrismaService){}
 async register(user:any,body:any){
  if(!await canReadPayments(this.prisma,user))throw new ForbiddenException('Anda tidak memiliki akses cetak pembayaran.');
  const secret=process.env.JWT_SECRET;
  if(!secret)throw new ServiceUnavailableException('Konfigurasi verifikasi dokumen belum tersedia.');
  const r=body?.record,signature=body?.signature;
  if(!r||typeof r!=='object'||Array.isArray(r)||JSON.stringify(r).length>5000||typeof signature!=='string'||!/^[0-9a-f]{64}$/.test(signature))throw new BadRequestException('Data verifikasi dokumen tidak valid.');
  const expected=reportRegistrationSignature(r,secret);
  if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))throw new ForbiddenException('Dokumen harus diterbitkan melalui cetak rekapan aplikasi.');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const issuer=user.auth_id||user.authId;
  if(!uuid.test(r.id||'')||!/^[0-9a-f]{48}$/.test(r.token||'')||r.issuerId!==issuer||!uuid.test(issuer||'')||
   !Number.isInteger(r.month)||r.month<1||r.month>12||!Number.isInteger(r.year)||r.year<2000||r.year>2200||
   !['ALL','GURU_ASUH','KLINIK','EKSKUL'].includes(r.category)||!Number.isSafeInteger(r.amount)||r.amount<0||
   !Number.isInteger(r.entries)||r.entries<0||r.entries>2000||!Number.isInteger(r.proofs)||r.proofs<0||r.proofs>200||
   !Number.isInteger(r.missingAmounts)||r.missingAmounts<0||r.missingAmounts>r.entries||!Number.isInteger(r.missingProofs)||r.missingProofs<0||r.missingProofs>r.entries||
   !Number.isInteger(r.unavailableProofs)||r.unavailableProofs<0||r.unavailableProofs>r.proofs||
   typeof r.issuedAt!=='string'||!Number.isFinite(Date.parse(r.issuedAt))||Math.abs(Date.now()-Date.parse(r.issuedAt))>10*60*1000||
   typeof r.issuerName!=='string'||!r.issuerName||r.issuerName.length>300||!/^[0-9a-f]{64}$/.test(r.sourceHash||'')||!/^[0-9a-f]{64}$/.test(r.pdfHash||''))throw new BadRequestException('Rincian verifikasi dokumen tidak valid.');
  const tokenHash=createHash('sha256').update(r.token).digest('hex');
  const snapshot={code:`RP-${r.year}${String(r.month).padStart(2,'0')}-${r.id.slice(0,8).toUpperCase()}`,month:r.month,year:r.year,category:r.category,amount:r.amount,entries:r.entries,issuedAt:r.issuedAt,issuerName:r.issuerName,proofs:r.proofs,missingAmounts:r.missingAmounts,missingProofs:r.missingProofs,unavailableProofs:r.unavailableProofs,pdfHash:r.pdfHash,sourceHash:r.sourceHash};
  const rows:any[]=await this.prisma.$queryRaw`INSERT INTO payment_report_verifications(id,token_hash,issuer_id,pdf_hash,snapshot) VALUES (${r.id}::uuid,${tokenHash},${issuer}::uuid,${r.pdfHash},${JSON.stringify(snapshot)}::jsonb) ON CONFLICT(id) DO UPDATE SET id=payment_report_verifications.id WHERE payment_report_verifications.token_hash=EXCLUDED.token_hash AND payment_report_verifications.pdf_hash=EXCLUDED.pdf_hash RETURNING id`;
  if(!rows.length)throw new BadRequestException('Identitas dokumen sudah digunakan. Buat cetakan baru.');
  return {ok:true,id:r.id};
 }
 async verify(token:string){
  if(!/^[0-9a-f]{48}$/.test(token||''))throw new NotFoundException('Kode verifikasi tidak ditemukan.');
  const hash=createHash('sha256').update(token).digest('hex');
  const rows:any[]=await this.prisma.$queryRaw`SELECT snapshot FROM payment_report_verifications WHERE token_hash=${hash} LIMIT 1`;
  if(!rows.length)throw new NotFoundException('Dokumen tidak terdaftar dalam sistem.');
  // Public scan reveals only document metadata, never recipient names, accounts, or proof URLs.
  return {ok:true,verified:true,document:rows[0].snapshot};
 }
}
