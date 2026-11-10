import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { canReadPayments, isTreasurer, requireStaff } from './payment-access';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(value: any) { if (typeof value !== 'string' || !uuid.test(value)) throw new BadRequestException('Identitas data tidak valid.'); return value; }
function text(value: any, label: string, max = 300, optional = false) {
  if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) throw new BadRequestException(`${label} belum diisi atau terlalu panjang.`);
  return value.trim();
}
function date(value: any) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new BadRequestException('Tanggal tidak valid.');
  return value;
}
function paymentAttachments(body: any) {
  const files = body.attachments ?? (body.proof_url ? [{ name: 'Bukti transfer', url: body.proof_url }] : []);
  if (!Array.isArray(files) || !files.length || files.length > 10) throw new BadRequestException('Lampirkan 1–10 bukti pembayaran.');
  return files.map((a: any) => ({ name: text(a.name, 'Nama lampiran', 200), url: committeeFileUrl(a.url) }));
}
export function committeeFileUrl(value: any) {
  const raw = text(value, 'Tautan lampiran', 2000);
  try { const url = new URL(raw); if (['https:','http:'].includes(url.protocol) && !url.username && !url.password) return raw; } catch {}
  throw new BadRequestException('Tautan lampiran tidak valid.');
}
const serialize = (value: any): any => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v));
@Injectable()
export class CommitteeService {
  constructor(private prisma: PrismaService) {}
  private async activity(db: any, user: any, activityId: string, write = false) {
    const owner = requireStaff(user);
    const rows: any[] = await db.$queryRaw`SELECT * FROM committee_activities WHERE id=${id(activityId)}::uuid`;
    const row = rows[0];
    if (!row) throw new NotFoundException('Kegiatan tidak ditemukan.');
    if (row.owner_id !== owner && !isTreasurer(user) && (write || !await canReadPayments(this.prisma,user))) throw new ForbiddenException('Anda hanya dapat mengelola pengajuan sendiri.');
    return row;
  }
  private async audit(db: any, user: any, activityId: string, action: string, snapshot: any, reason = '') {
    const owner = requireStaff(user), name = user.nama_lengkap || user.nama || user.username || 'Pengguna';
    await db.$executeRaw`INSERT INTO committee_history(id,activity_id,actor_id,actor_name,action,reason,snapshot) VALUES (${randomUUID()}::uuid,${activityId}::uuid,${owner}::uuid,${name},${action},${reason},${JSON.stringify(serialize(snapshot))}::jsonb)`;
  }
  async list(user: any) {
    const owner = requireStaff(user), all = await canReadPayments(this.prisma,user);
    const rows: any[] = await this.prisma.$queryRaw`SELECT a.*,coalesce(s.total,0)::text AS total,coalesce(p.paid,0)::text AS paid FROM committee_activities a LEFT JOIN (SELECT t.activity_id,sum(i.amount) total FROM committee_terms t JOIN committee_items i ON i.term_id=t.id GROUP BY t.activity_id) s ON s.activity_id=a.id LEFT JOIN (SELECT t.activity_id,sum(p.amount) paid FROM committee_terms t JOIN committee_items i ON i.term_id=t.id JOIN committee_payments p ON p.item_id=i.id WHERE p.voided_at IS NULL AND p.flow<>'PJ_ADVANCE' GROUP BY t.activity_id) p ON p.activity_id=a.id WHERE (${all} OR a.owner_id=${owner}::uuid) ORDER BY a.created_at DESC LIMIT 500`;
    return { ok: true, data: serialize(rows), canPay: isTreasurer(user), ownerId: owner };
  }
  async detail(user: any, activityId: string) {
    const activity = await this.activity(this.prisma,user,activityId);
    const terms: any[] = await this.prisma.$queryRaw`SELECT * FROM committee_terms WHERE activity_id=${activityId}::uuid ORDER BY year,month,created_at`;
    const items: any[] = await this.prisma.$queryRaw`SELECT i.*,t.month,t.year,i.quantity::text AS quantity,i.unit_price::text AS unit_price,i.amount::text AS amount,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow<>'PJ_ADVANCE'),0)::text AS paid,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow='PJ_ADVANCE'),0)::text AS advanced,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow='REIMBURSEMENT'),0)::text AS reimbursed FROM committee_items i JOIN committee_terms t ON t.id=i.term_id WHERE t.activity_id=${activityId}::uuid ORDER BY i.created_at`;
    const payments: any[] = await this.prisma.$queryRaw`SELECT p.*,p.amount::text AS amount FROM committee_payments p JOIN committee_items i ON i.id=p.item_id JOIN committee_terms t ON t.id=i.term_id WHERE t.activity_id=${activityId}::uuid ORDER BY p.created_at DESC`;
    const history: any[] = await this.prisma.$queryRaw`SELECT id,action,reason,actor_name,created_at,snapshot FROM committee_history WHERE activity_id=${activityId}::uuid ORDER BY created_at DESC LIMIT 100`;
    return { ok: true, data: serialize({ activity,terms,items,payments,history }), canRecordAdvance: activity.owner_id === requireStaff(user), ownerId: requireStaff(user), canEdit: activity.owner_id === requireStaff(user) || isTreasurer(user), canPay: isTreasurer(user) };
  }
  async save(user: any, body: any) {
    const owner = requireStaff(user);
    const kind = body.kind;
    if (!['activity','term','item','single-item','payment','delete-item','cancel-payment','edit-proof'].includes(kind)) throw new BadRequestException('Tindakan tidak valid.');
    if (kind==='payment' && !isTreasurer(user)) throw new ForbiddenException('Hanya Bendahara Komite/Admin yang dapat mencatat pembayaran.');
    try {
      return await this.prisma.$transaction(async tx => {
        if (kind === 'activity') {
          const title=text(body.title,'Nama kegiatan'), description=text(body.description || '','Keterangan',2000,true), start=date(body.start_date), end=date(body.end_date);
          if (end<start) throw new BadRequestException('Tanggal selesai harus setelah tanggal mulai.');
          const proposedTotal = body.proposed_total == null || body.proposed_total === '' ? null : Number(body.proposed_total);
          if (proposedTotal !== null && (!Number.isSafeInteger(proposedTotal) || proposedTotal <= 0 || proposedTotal > 1000000000000000)) throw new BadRequestException('Total yang diajukan dalam proposal tidak valid.');
          const proposalUrl = body.proposal_url ? committeeFileUrl(body.proposal_url) : null;
          const proposalName = proposalUrl ? text(body.proposal_name,'Nama berkas proposal',200) : null;
          const name=user.nama_lengkap || user.nama || user.username || 'Pengaju';
          const activityId = body.id?id(body.id):randomUUID();
          if(body.id){
            const before=await this.activity(tx,user,activityId,true);
            const nextProposedTotal = body.proposed_total === undefined ? before.proposed_total : proposedTotal;
            const nextProposalUrl = body.proposal_url === undefined ? before.proposal_url : proposalUrl;
            const nextProposalName = body.proposal_url === undefined ? before.proposal_name : proposalName;
            await tx.$queryRaw`SELECT id FROM committee_activities WHERE id=${activityId}::uuid FOR UPDATE`;
            if(before.revision!==body.revision)throw new ConflictException('Kegiatan berubah. Muat ulang data.');
            const existing:any[]=await tx.$queryRaw`SELECT month,year FROM committee_terms WHERE activity_id=${activityId}::uuid`;
            if(existing.some(t=>`${t.year}-${String(t.month).padStart(2,'0')}`<start.slice(0,7)||`${t.year}-${String(t.month).padStart(2,'0')}`>end.slice(0,7)))throw new ConflictException('Periode kegiatan harus mencakup seluruh item yang sudah dibuat.');
            const paid:any[]=await tx.$queryRaw`SELECT coalesce(sum(p.amount),0)::text AS paid FROM committee_payments p JOIN committee_items i ON i.id=p.item_id JOIN committee_terms t ON t.id=i.term_id WHERE t.activity_id=${activityId}::uuid AND p.voided_at IS NULL`;
            const reason=typeof body.reason==='string'?body.reason.trim().slice(0,1000):'';
            if(Number(paid[0].paid)>0&&(!isTreasurer(user)||!reason))throw new ConflictException('Kegiatan yang sudah dibayar hanya dapat dikoreksi bendahara dengan alasan perubahan.');
            await tx.$executeRaw`UPDATE committee_activities SET title=${title},description=${description},start_date=${start}::date,end_date=${end}::date,proposed_total=${nextProposedTotal},proposal_url=${nextProposalUrl},proposal_name=${nextProposalName},revision=revision+1,updated_at=now() WHERE id=${activityId}::uuid`;
            await this.audit(tx,user,activityId,'Kegiatan diperbarui',{before,after:{title,description,start_date:start,end_date:end,proposed_total:nextProposedTotal,proposal_url:nextProposalUrl,proposal_name:nextProposalName}},reason);
          }else{
            await tx.$executeRaw`INSERT INTO committee_activities(id,owner_id,owner_name,title,description,start_date,end_date,proposed_total,proposal_url,proposal_name) VALUES (${activityId}::uuid,${owner}::uuid,${name},${title},${description},${start}::date,${end}::date,${proposedTotal},${proposalUrl},${proposalName})`;
            await this.audit(tx,user,activityId,'Kegiatan dibuat',{title,description,start,end,proposed_total:proposedTotal,proposal_url:proposalUrl,proposal_name:proposalName});
          }
          return {ok:true,id:activityId};
        }
        const activityId=id(body.activityId), activity=await this.activity(tx,user,activityId,true);
        // One activity lock orders term edits, item corrections, and partial payments.
        await tx.$queryRaw`SELECT id FROM committee_activities WHERE id=${activityId}::uuid FOR UPDATE`;
        if (['single-item','term','item','delete-item'].includes(kind) && activity.owner_id !== owner) {
          throw new ForbiddenException('Hanya PJ pemilik kegiatan yang dapat menambah, mengedit, atau menghapus item.');
        }
        const reason=typeof body.reason==='string'?body.reason.trim().slice(0,1000):'';
        if (kind==='single-item') {
          const description=text(body.description,'Nama item'), recipient=text(body.recipient||'','Catatan penerima transfer',200,true);
          const unit=text(body.unit||'paket','Satuan',40),qty=body.quantity,price=body.unit_price,month=body.month,year=body.year;
          if (!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2000||year>2200) throw new BadRequestException('Bulan/tahun item tidak valid.');
          const first=`${year}-${String(month).padStart(2,'0')}-01`,last=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
          if(first>new Date(activity.end_date).toISOString().slice(0,10)||last<new Date(activity.start_date).toISOString().slice(0,10)) throw new BadRequestException('Item harus berada dalam periode kegiatan.');
          if(typeof qty!=='number'||!Number.isFinite(qty)||qty<=0||qty>1000000||Math.abs(qty*100-Math.round(qty*100))>0.00001||!Number.isSafeInteger(price)||price<=0||price>1000000000000||!Number.isSafeInteger(Math.round(qty*price))||qty*price>1000000000000) throw new BadRequestException('Jumlah/harga tidak valid.');
          if(!Array.isArray(body.attachments)||body.attachments.length>10) throw new BadRequestException('Maksimal 10 lampiran item.');
          const attachments=body.attachments.map((a:any)=>({name:text(a.name,'Nama lampiran',200),url:committeeFileUrl(a.url)}));
          if(body.pj_advance != null) throw new BadRequestException('Pencatatan transfer PJ tidak tersedia lagi.');
          const itemId=body.id?id(body.id):randomUUID();
          const old:any[]=body.id?await tx.$queryRaw`SELECT i.*,i.amount::text AS amount,t.activity_id,t.month,t.year,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow<>'PJ_ADVANCE'),0)::text AS paid,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow='PJ_ADVANCE'),0)::text AS advanced,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow='REIMBURSEMENT'),0)::text AS reimbursed FROM committee_items i JOIN committee_terms t ON t.id=i.term_id WHERE i.id=${itemId}::uuid AND t.activity_id=${activityId}::uuid FOR UPDATE`:[];
          if(body.id){
            if(!old.length||old[0].revision!==body.revision) throw new ConflictException('Item berubah. Muat ulang data.');
            const active=Number(old[0].paid)+Number(old[0].advanced)-Number(old[0].reimbursed);
            const nonFinancialOnly=description===old[0].description&&Number(qty)===Number(old[0].quantity)&&unit===old[0].unit&&price===Number(old[0].unit_price)&&month===old[0].month&&year===old[0].year;
            if(active&&!nonFinancialOnly&&!reason) throw new ConflictException('Isi alasan jika mengubah rincian item yang sudah dibayar.');
            if(Math.round(Math.round(qty*100)*price/100)<active) throw new ConflictException('Nominal item tidak boleh di bawah pembayaran aktif.');
            if(old[0].month!==month||old[0].year!==year){
              const siblings:any[]=await tx.$queryRaw`SELECT count(*)::int AS count FROM committee_items WHERE term_id=${old[0].term_id}::uuid`;
              if(siblings[0].count>1) throw new ConflictException('Periode item lama yang berbagi kelompok tidak dapat diubah.');
              await tx.$executeRaw`UPDATE committee_terms SET month=${month},year=${year},updated_at=now() WHERE id=${old[0].term_id}::uuid`;
            }
            await tx.$executeRaw`UPDATE committee_items SET description=${description},recipient=${recipient},quantity=${qty},unit=${unit},unit_price=${price},attachments=${JSON.stringify(attachments)}::jsonb,revision=revision+1,updated_at=now() WHERE id=${itemId}::uuid`;
          } else {
            const termId=randomUUID();
            await tx.$executeRaw`INSERT INTO committee_terms(id,activity_id,title,month,year,attachments) VALUES (${termId}::uuid,${activityId}::uuid,${description},${month},${year},'[]'::jsonb)`;
            await tx.$executeRaw`INSERT INTO committee_items(id,term_id,description,recipient,quantity,unit,unit_price,attachments,attachments_migrated) VALUES (${itemId}::uuid,${termId}::uuid,${description},${recipient},${qty},${unit},${price},${JSON.stringify(attachments)}::jsonb,true)`;
          }
          await this.audit(tx,user,activityId,body.id?'Item diperbarui':'Item dibuat',{before:old[0]||null,after:{id:itemId,description,recipient,quantity:qty,unit,unit_price:price,month,year,attachments}},reason);
          return {ok:true,id:itemId};
        }
        if (kind==='term') {
          const title=text(body.title,'Nama item'), month=body.month, year=body.year;
          if (!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2000||year>2200) throw new BadRequestException('Bulan/tahun item tidak valid.');
          const first=`${year}-${String(month).padStart(2,'0')}-01`,last=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
          if (first>new Date(activity.end_date).toISOString().slice(0,10)||last<new Date(activity.start_date).toISOString().slice(0,10)) throw new BadRequestException('Item harus berada dalam periode kegiatan.');
          if (!Array.isArray(body.attachments)||body.attachments.length>10) throw new BadRequestException('Maksimal 10 lampiran ampra.');
          const attachments=body.attachments.map((a:any)=>({name:text(a.name,'Nama lampiran',200),url:committeeFileUrl(a.url)}));
          const termId=body.id?id(body.id):randomUUID();
          const old:any[]=await tx.$queryRaw`SELECT * FROM committee_terms WHERE id=${termId}::uuid AND activity_id=${activityId}::uuid`;
          if (body.id) {
            if (!old.length||old[0].revision!==body.revision) throw new ConflictException('Item berubah. Muat ulang data.');
            const paid:any[]=await tx.$queryRaw`SELECT coalesce(sum(p.amount),0)::text AS paid FROM committee_payments p JOIN committee_items i ON i.id=p.item_id WHERE i.term_id=${termId}::uuid AND p.voided_at IS NULL`;
            if (Number(paid[0].paid)>0 && !reason) throw new ConflictException('Isi alasan jika mengubah item yang sudah dibayar.');
            await tx.$executeRaw`UPDATE committee_terms SET title=${title},month=${month},year=${year},attachments=${JSON.stringify(attachments)}::jsonb,revision=revision+1,updated_at=now() WHERE id=${termId}::uuid`;
          } else {
            await tx.$executeRaw`INSERT INTO committee_terms(id,activity_id,title,month,year,attachments) VALUES (${termId}::uuid,${activityId}::uuid,${title},${month},${year},${JSON.stringify(attachments)}::jsonb)`;
            if (body.copyFrom) {
              const from=id(body.copyFrom);
              const source:any[]=await tx.$queryRaw`SELECT id FROM committee_terms WHERE id=${from}::uuid AND activity_id=${activityId}::uuid`;
              if (!source.length) throw new BadRequestException('Item sumber tidak valid.');
              await tx.$executeRaw`INSERT INTO committee_items(id,term_id,description,recipient,quantity,unit,unit_price) SELECT gen_random_uuid(),${termId}::uuid,description,recipient,quantity,unit,unit_price FROM committee_items WHERE term_id=${from}::uuid`;
            }
          }
          await this.audit(tx,user,activityId,body.id?'Item diperbarui':'Item dibuat',{before:old[0]||null,after:{id:termId,title,month,year,attachments},copyFrom:body.copyFrom||null},reason);
          return {ok:true,id:termId};
        }
        const termId=id(body.termId);
        const terms:any[]=await tx.$queryRaw`SELECT id FROM committee_terms WHERE id=${termId}::uuid AND activity_id=${activityId}::uuid`;
        if (!terms.length) throw new NotFoundException('Item tidak ditemukan.');
        const itemId=['cancel-payment','edit-proof'].includes(kind)?id(body.itemId):body.id?id(body.id):randomUUID();
        const old:any[]=await tx.$queryRaw`SELECT i.*,i.amount::text AS amount,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow<>'PJ_ADVANCE'),0)::text AS paid,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow='PJ_ADVANCE'),0)::text AS advanced,coalesce((SELECT sum(p.amount) FROM committee_payments p WHERE p.item_id=i.id AND p.voided_at IS NULL AND p.flow='REIMBURSEMENT'),0)::text AS reimbursed FROM committee_items i WHERE id=${itemId}::uuid AND term_id=${termId}::uuid FOR UPDATE`;
        if(kind==='cancel-payment'||kind==='edit-proof'){
          const paymentId=id(body.id);
          const payments:any[]=await tx.$queryRaw`SELECT * FROM committee_payments WHERE id=${paymentId}::uuid AND item_id=${itemId}::uuid FOR UPDATE`;
          if(!old.length||!payments.length)throw new NotFoundException('Pembayaran tidak ditemukan.');
          if(!isTreasurer(user) && (payments[0].flow!=='PJ_ADVANCE' || payments[0].actor_id!==owner)) throw new ForbiddenException('Anda hanya dapat mengubah bukti atau membatalkan pembayaran PJ yang Anda catat.');
          if(kind==='edit-proof') {
            if(payments[0].voided_at) throw new ConflictException('Bukti pembayaran yang dibatalkan tidak dapat diubah.');
            if(old[0].revision!==body.revision) throw new ConflictException('Pembayaran berubah. Muat ulang data.');
            const attachments=paymentAttachments(body),proof=attachments[0].url;
            await tx.$executeRaw`UPDATE committee_payments SET attachments=${JSON.stringify(attachments)}::jsonb,proof_url=${proof} WHERE id=${paymentId}::uuid`;
            await tx.$executeRaw`UPDATE committee_items SET revision=revision+1,updated_at=now() WHERE id=${itemId}::uuid`;
            await this.audit(tx,user,activityId,'Bukti pembayaran diperbarui',{before:payments[0],after:{id:paymentId,attachments,proof_url:proof}});
            return {ok:true,id:paymentId};
          }
          if(payments[0].voided_at)return {ok:true,id:paymentId};
          if(old[0].revision!==body.revision||!reason)throw new ConflictException('Isi alasan pembatalan dan muat ulang jika data berubah.');
          if(payments[0].flow==='PJ_ADVANCE' && Number(old[0].advanced)-Number(payments[0].amount)<Number(old[0].reimbursed)) throw new ConflictException('Batalkan penggantian bendahara terlebih dahulu sebelum membatalkan pembayaran PJ.');
          await tx.$executeRaw`UPDATE committee_payments SET voided_at=now(),voided_by=${owner}::uuid,void_reason=${reason} WHERE id=${paymentId}::uuid`;
          await tx.$executeRaw`UPDATE committee_items SET revision=revision+1,updated_at=now() WHERE id=${itemId}::uuid`;
          await this.audit(tx,user,activityId,'Pembayaran dibatalkan',{payment:payments[0]},reason);
          return {ok:true,id:paymentId};
        }
        if (kind==='payment') {
          if (!old.length) throw new NotFoundException('Item tidak ditemukan.');
          const flow=body.flow || 'DIRECT';
          if(!['DIRECT','REIMBURSEMENT'].includes(flow)) throw new BadRequestException('Alur pembayaran tidak valid.');
          const attachments=paymentAttachments(body),proof=attachments[0].url;
          const account=text(body.destination_account||'','Rekening tujuan',300,true);
          const amount=body.amount,paidOn=date(body.paid_on),note=text(body.note||'','Catatan',1000,true),requestId=id(body.requestId);
          if (!Number.isSafeInteger(amount)||amount<=0) throw new BadRequestException('Nominal pembayaran tidak valid.');
          const previous:any[]=await tx.$queryRaw`SELECT * FROM committee_payments WHERE request_id=${requestId}::uuid`;
          if (previous.length) {
            const p=previous[0];
            if (p.item_id!==itemId||p.actor_id!==owner||Number(p.amount)!==amount||new Date(p.paid_on).toISOString().slice(0,10)!==paidOn||p.proof_url!==proof||p.note!==note||p.flow!==flow||p.destination_account!==account||JSON.stringify(p.attachments.map((a:any)=>({name:a.name,url:a.url})))!==JSON.stringify(attachments)) throw new ConflictException('Identitas pembayaran sudah digunakan untuk data berbeda.');
            if(p.voided_at)throw new ConflictException('Pembayaran sebelumnya sudah dibatalkan. Buat pencatatan baru.');
            return {ok:true,id:p.id};
          }
          const outstandingAdvance=Number(old[0].advanced)-Number(old[0].reimbursed);
          const expectedFlow=outstandingAdvance>0?'REIMBURSEMENT':'DIRECT';
          if(flow!==expectedFlow) throw new BadRequestException('Alur pembayaran tidak sesuai dengan sisa item. Muat ulang data.');
          const remaining=flow==='REIMBURSEMENT'?outstandingAdvance:Number(old[0].amount)-Number(old[0].paid)-outstandingAdvance;
          if (old[0].revision!==body.revision||amount>remaining) throw new ConflictException('Sisa pembayaran berubah atau nominal melebihi sisa alur pembayaran. Muat ulang data.');
          const paymentId=randomUUID(),name=user.nama_lengkap||user.nama||user.username||'Bendahara Komite';
          await tx.$executeRaw`INSERT INTO committee_payments(id,item_id,amount,paid_on,proof_url,note,actor_id,actor_name,request_id,flow,attachments,destination_account) VALUES (${paymentId}::uuid,${itemId}::uuid,${amount},${paidOn}::date,${proof},${note},${owner}::uuid,${name},${requestId}::uuid,${flow},${JSON.stringify(attachments)}::jsonb,${account})`;
          await tx.$executeRaw`UPDATE committee_items SET revision=revision+1,updated_at=now() WHERE id=${itemId}::uuid`;
          await this.audit(tx,user,activityId,'Pembayaran dicatat',{item:old[0],payment:{id:paymentId,amount,paid_on:paidOn,proof_url:proof,note,flow,attachments,destination_account:account}});
          return {ok:true,id:paymentId};
        }
        if (body.id && (!old.length||old[0].revision!==body.revision)) throw new ConflictException('Item berubah. Muat ulang data.');
        if (kind==='delete-item') {
          const historical:any[]=await tx.$queryRaw`SELECT id FROM committee_payments WHERE item_id=${itemId}::uuid LIMIT 1`;
          if (!old.length||historical.length) throw new ConflictException('Item yang memiliki riwayat pembayaran tidak dapat dihapus.');
          await tx.$executeRaw`DELETE FROM committee_items WHERE id=${itemId}::uuid`;
          await this.audit(tx,user,activityId,'Item dihapus',old[0]);
          return {ok:true};
        }
        const description=text(body.description,'Uraian biaya'),recipient=text(body.recipient||'','Penerima',200,true),unit=text(body.unit||'paket','Satuan',40),qty=body.quantity,price=body.unit_price;
        if (typeof qty!=='number'||!Number.isFinite(qty)||qty<=0||qty>1000000||Math.abs(qty*100-Math.round(qty*100))>0.00001||!Number.isSafeInteger(price)||price<=0||price>1000000000000||!Number.isSafeInteger(Math.round(qty*price))||qty*price>1000000000000) throw new BadRequestException('Jumlah/harga harus positif, maksimal dua desimal untuk jumlah, dan subtotal maksimal Rp1 triliun.');
        const paid=Number(old[0]?.paid||0)+Number(old[0]?.advanced||0)-Number(old[0]?.reimbursed||0);
        if (paid && !reason) throw new ConflictException('Isi alasan jika mengubah item yang sudah dibayar.');
        if (Math.round(Math.round(qty*100)*price/100)<paid) throw new ConflictException('Nominal item tidak boleh di bawah pembayaran yang sudah tercatat.');
        if (body.id) await tx.$executeRaw`UPDATE committee_items SET description=${description},recipient=${recipient},quantity=${qty},unit=${unit},unit_price=${price},revision=revision+1,updated_at=now() WHERE id=${itemId}::uuid`;
        else await tx.$executeRaw`INSERT INTO committee_items(id,term_id,description,recipient,quantity,unit,unit_price) VALUES (${itemId}::uuid,${termId}::uuid,${description},${recipient},${qty},${unit},${price})`;
        await this.audit(tx,user,activityId,body.id?'Item diperbarui':'Item dibuat',{before:old[0]||null,after:{id:itemId,description,recipient,quantity:qty,unit,unit_price:price}},reason);
        return {ok:true,id:itemId};
      },{isolationLevel:'Serializable',timeout:20000});
    } catch(e:any) {
      if(e.code==='P2034'||e.meta?.code==='40001') throw new ConflictException('Data sedang diperbarui. Muat ulang lalu coba kembali.');
      if(e.code==='P2002'||e.meta?.code==='23505') throw new ConflictException('Pembayaran yang sama sudah tercatat. Muat ulang data.');
      throw e;
    }
  }
}
