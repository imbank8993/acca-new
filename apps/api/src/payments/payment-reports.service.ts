import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { canReadPayments } from './payment-access';
export function paymentNote(value: any) {
  try {
    const p=typeof value==='string'?JSON.parse(value):value;
    const n=typeof p?.nominal==='number'||(typeof p?.nominal==='string'&&/^\d+(?:\.0+)?$/.test(p.nominal.trim()))?Number(p.nominal):NaN;
    return { amount: Number.isSafeInteger(n)&&n>=0?n:null, url:typeof p?.url==='string'?p.url:'', date:typeof p?.paid_at==='string'?p.paid_at:null };
  } catch {return {amount:null,url:'',date:null};}
}
@Injectable()
export class PaymentReportsService {
 constructor(private prisma:PrismaService){}
 async report(user:any,query:any) {
  if (!await canReadPayments(this.prisma,user)) throw new ForbiddenException('Anda tidak memiliki akses rekapan pembayaran rutin.');
  const month=Number(query.month),year=Number(query.year),category=query.category||'ALL';
  if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2000||year>2200||!['ALL','GURU_ASUH','KLINIK','EKSKUL'].includes(category)) throw new BadRequestException('Pilih satu bulan, tahun, dan kategori pembayaran rutin.');
  const result=await this.prisma.$transaction(async tx=>{
   const rows:any[]=[];
   if(category==='ALL'||category==='GURU_ASUH'){
    const data=await tx.laporan_guru_asuh_submissions.findMany({where:{bulan:month,tahun:year,dibayarkan:true},orderBy:{nama_guru_snap:'asc'}});
    data.forEach(s=>{const note=paymentNote(s.catatan_pembayaran);rows.push({id:s.id,category:'GURU_ASUH',name:s.nama_guru_snap||s.nip,nip:s.nip,description:'Honor Guru Asuh',quantity:1,amount:note.amount,paidOn:s.dibayarkan_at||note.date,proofUrl:note.url});});
   }
   if(category==='ALL'||category==='EKSKUL'){
    const data=await tx.laporan_ekskul_submissions.findMany({where:{bulan:month,tahun:year,dibayarkan:true},include:{ekskul:true},orderBy:{pembina_nama:'asc'}});
    data.forEach(s=>{const note=paymentNote(s.catatan_pembayaran);rows.push({id:s.id,category:'EKSKUL',name:s.pembina_nama||s.pembina_nip||'Pembina',nip:s.pembina_nip||'',description:s.ekskul?.nama_ekskul||'Ekstrakurikuler',quantity:s.total_pertemuan||0,amount:note.amount,paidOn:s.dibayarkan_at||note.date,proofUrl:note.url});});
   }
   if(category==='ALL'||category==='KLINIK'){
    const data=await tx.klinik_slots.findMany({where:{status:'paid',tanggal:{gte:new Date(Date.UTC(year,month-1,1)),lt:new Date(Date.UTC(year,month,1))}},orderBy:[{nama_guru:'asc'},{tanggal:'asc'}]});
    const receipts:any[]=await tx.$queryRaw`SELECT id,selected FROM payment_receipts WHERE kind='KLINIK' AND month=${month} AND year=${year} AND applied_at IS NOT NULL ORDER BY applied_at DESC`;
    const links=new Map<string,string>();
    receipts.forEach(r=>{(r.selected?.ids||[]).forEach((id:string)=>{if(!links.has(id))links.set(id,`/api/pembayaran-massal/bukti?id=${r.id}`);});});
    data.forEach(s=>rows.push({id:s.id,category:'KLINIK',name:s.nama_guru||'Guru',nip:'',description:`${s.mapel||'Klinik'}: ${s.topik||'Kegiatan klinik'} (${s.tanggal.toISOString().slice(0,10)})`,quantity:1,amount:s.nominal_dibayarkan==null?null:Number(s.nominal_dibayarkan),paidOn:s.dibayarkan_at,proofUrl:links.get(s.id)||paymentNote(s.catatan_pembayaran).url}));
   }
   const profil=await tx.profil_sekolah.findFirst({orderBy:{updated_at:'desc'}});
   const categories=['GURU_ASUH','KLINIK','EKSKUL'].filter(c=>category==='ALL'||category===c);
   const summary=categories.map(category=>({category,count:rows.filter(r=>r.category===category).length,total:rows.filter(r=>r.category===category).reduce((s,r)=>s+(r.amount??0),0)}));
   return {rows,summary,profil};
  },{isolationLevel:'RepeatableRead',timeout:20000});
  return {ok:true,data:JSON.parse(JSON.stringify({...result,month,year,category,issuerId:user.auth_id||user.authId,printedBy:user.nama_lengkap||user.nama||user.username||'Petugas',printedAt:new Date(),missingAmounts:result.rows.filter(r=>r.amount===null).length,missingProofs:result.rows.filter(r=>!r.proofUrl).length},(_,v)=>typeof v==='bigint'?String(v):v))};
 }
 async proof(user:any,id:string) {
  if(!await canReadPayments(this.prisma,user)) throw new ForbiddenException('Akses bukti pembayaran ditolak.');
  if(!/^[0-9a-f-]{36}$/i.test(id||'')) throw new BadRequestException('Bukti tidak valid.');
  const rows:any[]=await this.prisma.$queryRaw`SELECT mime,image FROM payment_receipts WHERE id=${id}::uuid AND applied_at IS NOT NULL`;
  if(!rows.length)throw new NotFoundException('Bukti tidak ditemukan.');
  return {mime:rows[0].mime,image:Buffer.from(rows[0].image)};
 }
}
