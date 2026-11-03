import { BadRequestException, ConflictException } from '@nestjs/common';
// All new manual payments store the authoritative tariff at the time of payment.
/** Baca catatan pembayaran kiriman klien ({text,url,nominal}) dan pastikan tautan buktinya aman. */
export function parsePaymentNote(raw:any):{text:string;url:string;nominal:any} {
 let note:any={};
 try {if(raw)note=typeof raw==='string'?JSON.parse(raw):raw;}catch{note={text:typeof raw==='string'?raw:''};}
 if(!note||typeof note!=='object'||Array.isArray(note))note={};
 const url=typeof note.url==='string'?note.url:'';
 if(url&&!/^https?:\/\//i.test(url)&&!/^\/(?![\/\\])/.test(url))throw new BadRequestException('Tautan bukti tidak valid.');
 const text=typeof note.text==='string'?note.text:'';
 return {text,url,nominal:note.nominal};
}
export async function paymentSnapshot(db:any,kind:'GURU_ASUH'|'EKSKUL',id:string,raw:any) {
 const note=parsePaymentNote(raw);
 const url=note.url;
 const rates=await db.tarif_honor.findMany();
 const rate=(key:string)=>{const row=rates.find((r:any)=>r.modul===key);const value=Number(row?.nominal);if(!row||!Number.isSafeInteger(value)||value<0)throw new ConflictException('Tarif honor belum valid.');return value;};
 let amount:number;
 if(kind==='GURU_ASUH')amount=rate('GURU_ASUH');
 else {const meetings=await db.ekskul_pertemuan.findMany({where:{submission_id:id},select:{status_pelatih:true}});const external=meetings.filter((m:any)=>m.status_pelatih==='Eksternal').length;const internal=meetings.length-external;amount=(internal?internal*rate('EKSKUL_INTERNAL'):0)+(external?external*rate('EKSKUL_EKSTERNAL'):0);}
 if(note.nominal!=null&&note.nominal!==amount)throw new ConflictException('Nominal atau tarif berubah. Muat ulang sebelum menandai pembayaran.');
 return JSON.stringify({text:note.text,url,nominal:amount,paid_at:new Date().toISOString()});
}
