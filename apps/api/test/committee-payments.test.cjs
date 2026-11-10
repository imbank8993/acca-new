const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const loaded={};function load(name){if(loaded[name])return loaded[name];const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/payments/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports:m.exports,module:m,Buffer,Date,URL,Set,Map,require:n=>n.startsWith('./')?load(n.slice(2)):['crypto','@nestjs/common'].includes(n)?require(n):{}});return loaded[name]=m.exports;}
const {CommitteeService}=load('committee.service'),{PaymentReportsService}=load('payment-reports.service'),{paymentSnapshot}=load('payment-snapshot');
const pj={authId:'11111111-1111-4111-8111-111111111111',nip:'G1',nama:'PJ Kegiatan',roles:['GURU']},other={...pj,authId:'22222222-2222-4222-8222-222222222222',nip:'G2'},admin={authId:'33333333-3333-4333-8333-333333333333',nama:'Bendahara',roles:['BENDAHARA_KOMITE']};
async function fixture(){const db=new PGlite();await db.exec('CREATE TABLE role_pages(id serial primary key,role text,page_id text,sort_order int,UNIQUE(role,page_id))');const sql=fs.readFileSync('apps/api/prisma/sql/20261103_committee_payments.sql','utf8');await db.exec(sql);const query=c=>async(strings,...values)=>(await c.query(strings.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values)).rows;const adapter=c=>({$queryRaw:query(c),$executeRaw:async(strings,...values)=>(await query(c)(strings,...values)).length,role_pages:{findFirst:async()=>null}});const prisma=adapter(db);prisma.$transaction=(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');return db.transaction(c=>fn(adapter(c)))};return {db,sql,service:new CommitteeService(prisma)};}
test('PJ creates a four-month activity without approval; partial payments, corrections and copied terms preserve accounting',async()=>{const {db,service:s}=await fixture();try{
 const activity=await s.save(pj,{kind:'activity',title:'Pengembangan Kurikulum',description:'Empat bulan',start_date:'2026-11-01',end_date:'2027-02-28'}),aid=activity.id;
 const first=await s.save(pj,{kind:'term',activityId:aid,title:'Ampra November',month:11,year:2026,attachments:[{name:'Ampra.pdf',url:'https://file.icgowa.sch.id/ampra.pdf'}]});
 const item=await s.save(pj,{kind:'item',activityId:aid,termId:first.id,description:'Honor penyusunan modul',recipient:'Tim Kurikulum',quantity:2,unit:'orang',unit_price:50000});
 let d=(await s.detail(pj,aid)).data;assert.equal(Number(d.items[0].amount),100000);assert.equal(d.activity.status,undefined);assert.equal(d.terms[0].status,undefined);
 await assert.rejects(s.detail(other,aid));await assert.rejects(s.save(other,{kind:'item',activityId:aid,termId:first.id,description:'Forged',quantity:1,unit_price:1}));await assert.rejects(s.save({...other,roles:['SISWA']},{kind:'activity'}));
 const payment={kind:'payment',activityId:aid,termId:first.id,id:item.id,revision:d.items[0].revision,amount:40000,paid_on:'2026-11-05',proof_url:'https://file.icgowa.sch.id/bukti.png',note:'Tahap pertama',requestId:'44444444-4444-4444-8444-444444444444'};
 await assert.rejects(s.save(pj,payment));await s.save(admin,payment);await s.save(admin,payment);
 d=(await s.detail(pj,aid)).data;assert.equal(d.payments.length,1);assert.equal(Number(d.items[0].paid),40000);
 await assert.rejects(s.save(admin,{...payment,amount:50000}));await assert.rejects(s.save(admin,{...payment,requestId:'55555555-5555-4555-8555-555555555555',amount:60001,revision:d.items[0].revision}));
 const edit={kind:'item',activityId:aid,termId:first.id,id:item.id,revision:d.items[0].revision,description:'Honor penyusunan modul revisi',recipient:'Tim Kurikulum',quantity:2,unit:'orang',unit_price:60000};
 await assert.rejects(s.save(pj,edit));await assert.rejects(s.save(admin,{...edit,reason:'Bukan pemilik'}));await s.save(pj,{...edit,reason:'Tambahan ruang lingkup pekerjaan'});
 await assert.rejects(s.save(pj,{...edit,reason:'Stale revision'}));
 const second=await s.save(pj,{kind:'term',activityId:aid,title:'Ampra Desember',month:12,year:2026,attachments:[],copyFrom:first.id});
 for(const [month,year]of[[1,2027],[2,2027]])await s.save(pj,{kind:'term',activityId:aid,title:'Termin '+month,month,year,attachments:[]});
 d=(await s.detail(pj,aid)).data;assert.equal(d.terms.length,4);const copied=d.items.find(i=>i.term_id===second.id);assert.equal(Number(copied.amount),120000);assert.equal(Number(copied.paid),0);assert(d.history.some(h=>h.reason==='Tambahan ruang lingkup pekerjaan'&&h.snapshot.before&&h.snapshot.after));
 await assert.rejects(s.save(pj,{kind:'term',activityId:aid,title:'Di luar periode',month:3,year:2027,attachments:[]}));
 const current=d.items.find(i=>i.id===item.id);await s.save(admin,{...payment,revision:current.revision,amount:80000,requestId:'66666666-6666-4666-8666-666666666666'});
 d=(await s.detail(pj,aid)).data;assert.equal(Number(d.items.find(i=>i.id===item.id).paid),120000);
 await assert.rejects(s.save(pj,{kind:'delete-item',activityId:aid,termId:first.id,id:item.id,revision:d.items.find(i=>i.id===item.id).revision}));
 await assert.rejects(s.save(pj,{...edit,revision:d.items.find(i=>i.id===item.id).revision,unit_price:10000,reason:'Below paid amount'}));
 const list=await s.list(pj);assert.equal(Number(list.data[0].total),240000);assert.equal(Number(list.data[0].paid),120000);assert.equal((await s.list(other)).data.length,0);assert.equal((await s.list(admin)).data.length,1);
 const secondPayment=d.payments.find(p=>Number(p.amount)===80000),currentItem=d.items.find(i=>i.id===item.id);
 const cancel={kind:'cancel-payment',activityId:aid,termId:first.id,id:secondPayment.id,itemId:item.id,revision:currentItem.revision,reason:'Salah rekening, akan ditransfer ulang'};
 await assert.rejects(s.save(pj,cancel));await assert.rejects(s.save(admin,{...cancel,reason:''}));await s.save(admin,cancel);await s.save(admin,cancel);
 d=(await s.detail(pj,aid)).data;assert.equal(Number(d.items.find(i=>i.id===item.id).paid),40000);assert.equal(d.payments.length,2);assert(d.payments.find(p=>p.id===secondPayment.id).voided_at);assert.equal(Number((await s.list(pj)).data[0].paid),40000);
 await assert.rejects(s.save(admin,{...payment,revision:currentItem.revision,amount:80000,requestId:'66666666-6666-4666-8666-666666666666'}));
 }finally{await db.close()}});
test('migration is repeatable and preserves access changes after initial installation',async()=>{const {db,sql}=await fixture();try{assert.equal((await db.query("SELECT * FROM role_pages WHERE role='GURU' AND page_id='pengajuan-komite'")).rows.length,1);await db.exec("DELETE FROM role_pages WHERE role='GURU'");await db.exec(sql);assert.equal((await db.query("SELECT * FROM role_pages WHERE role='GURU'")).rows.length,0)}finally{await db.close()}});
test('only the activity owner may add, edit, and delete items; treasurer may view',async()=>{
 const {db,service:s}=await fixture();try{
  const {id:activityId}=await s.save(pj,{kind:'activity',title:'Pelatihan',description:'',start_date:'2026-11-01',end_date:'2026-11-30'});
  const input={kind:'single-item',activityId,description:'Honor tentor',recipient:'Tentor',month:11,year:2026,quantity:1,unit:'orang',unit_price:100000,attachments:[]};
  await assert.rejects(s.save(admin,input));
  const {id:itemId}=await s.save(pj,input);
  const detail=await s.detail(admin,activityId),item=detail.data.items[0];
  assert.equal(item.description,'Honor tentor');
  await assert.rejects(s.save(admin,{...input,id:itemId,revision:item.revision,description:'Diubah orang lain'}));
  await assert.rejects(s.save(admin,{kind:'delete-item',activityId,termId:item.term_id,id:itemId,revision:item.revision}));
  await s.save(pj,{...input,id:itemId,revision:item.revision,description:'Honor tentor revisi'});
  const revised=(await s.detail(admin,activityId)).data.items[0];assert.equal(revised.description,'Honor tentor revisi');
  await s.save(pj,{kind:'delete-item',activityId,termId:revised.term_id,id:itemId,revision:revised.revision});
  assert.equal((await s.detail(admin,activityId)).data.items.length,0);
 }finally{await db.close()}
});
test('activity stores proposal file and requested amount separately from priced items',async()=>{
 const {db,sql,service:s}=await fixture();try{
  const proposal={kind:'activity',title:'Pelatihan Siswa',description:'',start_date:'2026-11-01',end_date:'2026-11-30',proposed_total:350000,proposal_url:'https://example.com/proposal.pdf',proposal_name:'Proposal Pelatihan.pdf'};
  await assert.rejects(s.save(pj,{...proposal,proposed_total:-1}));
  await assert.rejects(s.save(pj,{...proposal,proposal_url:'javascript:alert(1)'}));
  const {id:activityId}=await s.save(pj,proposal);
  let detail=(await s.detail(pj,activityId)).data;
  assert.equal(Number(detail.activity.proposed_total),350000);
  assert.equal(detail.activity.proposal_name,proposal.proposal_name);
  assert.equal(Number((await s.list(pj)).data[0].total),0);
  await s.save(pj,{kind:'activity',id:activityId,revision:detail.activity.revision,title:proposal.title,description:'',start_date:proposal.start_date,end_date:proposal.end_date});
  detail=(await s.detail(pj,activityId)).data;
  assert.equal(Number(detail.activity.proposed_total),350000);
  assert.equal(detail.activity.proposal_url,proposal.proposal_url);
  await s.save(pj,{...proposal,id:activityId,revision:detail.activity.revision,proposed_total:420000,proposal_url:'https://example.com/revisi.pdf',proposal_name:'Revisi.pdf'});
  await db.exec(sql);
  detail=(await s.detail(pj,activityId)).data;
  assert.equal(Number(detail.activity.proposed_total),420000);
  assert.equal(detail.activity.proposal_name,'Revisi.pdf');
  assert(detail.history.some(h=>h.action==='Kegiatan diperbarui'&&h.snapshot.after.proposed_total===420000));
 }finally{await db.close()}
});
test('monthly report excludes committee data, never reads current tariffs, and marks missing historical snapshots',async()=>{
 let manualProof=null;
 const db={role_pages:{findFirst:async()=>null},$transaction:async fn=>fn({
  laporan_guru_asuh_submissions:{findMany:async p=>{assert.equal(p.where.bulan,11);assert.equal(p.where.tahun,2026);assert.equal(p.where.dibayarkan,true);return [{id:'g1',nama_guru_snap:'Siti',nip:'123',catatan_pembayaran:'{"nominal":100000,"url":"https://file.icgowa.sch.id/proof.png"}'},{id:'g2',nama_guru_snap:'Ahmad',catatan_pembayaran:null}]}},
  laporan_ekskul_submissions:{findMany:async()=>[{id:'e1',pembina_nama:'Ali',catatan_pembayaran:'{"nominal":250000}',ekskul:{nama_ekskul:'Pramuka'},total_pertemuan:4}]},
  klinik_slots:{findMany:async()=>[{id:'c1',nama_guru:'Nina',tanggal:new Date('2026-11-02'),nominal_dibayarkan:50000,catatan_pembayaran:manualProof}]},
  tarif_honor:{findMany:async()=>{throw new Error('Current tariffs must not affect historical reports')}},
  profil_sekolah:{findFirst:async()=>({nama:'Madrasah Contoh'})},$queryRaw:async()=>[{id:'proof-id',selected:{ids:['c1']}}]
 })};
 const s=new PaymentReportsService(db);await assert.rejects(s.report(pj,{month:11,year:2026}));await assert.rejects(s.report(admin,{month:11,year:2026,category:'KOMITE'}));
 const report=await s.report(admin,{month:11,year:2026});assert.equal(report.data.rows.length,4);assert.equal(report.data.missingAmounts,1);assert.equal(report.data.summary.reduce((s,r)=>s+r.total,0),400000);assert(report.data.rows.find(r=>r.id==='c1').proofUrl.includes('proof-id'));
 manualProof=JSON.stringify({url:'https://example.com/replacement.pdf'});const updated=await s.report(admin,{month:11,year:2026,category:'KLINIK'});assert.equal(updated.data.rows[0].proofUrl,'https://example.com/replacement.pdf');
});
test('manual payment snapshots use authoritative amounts, reject changed totals and unsafe proofs, and preserve zero tariffs',async()=>{
 const db={tarif_honor:{findMany:async()=>[{modul:'GURU_ASUH',nominal:100000},{modul:'EKSKUL_INTERNAL',nominal:25000},{modul:'EKSKUL_EKSTERNAL',nominal:50000}]},ekskul_pertemuan:{findMany:async()=>[{status_pelatih:'Internal'},{status_pelatih:'Eksternal'}]}};
 assert.equal(JSON.parse(await paymentSnapshot(db,'GURU_ASUH','id','{}')).nominal,100000);assert.equal(JSON.parse(await paymentSnapshot(db,'EKSKUL','id','{}')).nominal,75000);
 await assert.rejects(paymentSnapshot(db,'GURU_ASUH','id','{"nominal":50000}'));await assert.rejects(paymentSnapshot(db,'GURU_ASUH','id','{"url":"javascript:alert(1)"}'));await assert.rejects(paymentSnapshot(db,'GURU_ASUH','id','{"url":"//example.com/file"}'));
 db.tarif_honor.findMany=async()=>[{modul:'GURU_ASUH',nominal:0}];assert.equal(JSON.parse(await paymentSnapshot(db,'GURU_ASUH','id','{}')).nominal,0);
});

test('new PJ transfers are rejected while historical advances remain repayable',async()=>{
 const {db,service:s}=await fixture();try{
  const {randomUUID}=require('node:crypto');
  const {id:activityId}=await s.save(pj,{kind:'activity',title:'Honor tentor',description:'',start_date:'2026-11-01',end_date:'2026-11-30'});
  const itemInput={kind:'single-item',activityId,description:'Honor tentor',recipient:'Tentor',month:11,year:2026,quantity:1,unit:'orang',unit_price:100000,attachments:[]};
  await assert.rejects(s.save(pj,{...itemInput,pj_advance:{amount:60000}}));
  const {id:itemId}=await s.save(pj,itemInput);
  let item=(await s.detail(pj,activityId)).data.items[0];
  const payment=(flow,amount)=>({kind:'payment',activityId,termId:item.term_id,id:itemId,revision:item.revision,flow,amount,paid_on:'2026-11-03',attachments:[{name:'Transfer',url:'https://example.com/proof.pdf'}],requestId:randomUUID()});
  await assert.rejects(s.save(pj,payment('DIRECT',100000)));
  await assert.rejects(s.save(admin,payment('PJ_ADVANCE',60000)));
  await assert.rejects(s.save(admin,payment('REIMBURSEMENT',60000)));
  const legacyId=randomUUID();
  await db.query('INSERT INTO committee_payments(id,item_id,amount,paid_on,proof_url,actor_id,actor_name,request_id,flow,attachments) VALUES ($1,$2,60000,$3,$4,$5,$6,$7,$8,$9)',[legacyId,itemId,'2026-11-02','https://example.com/old.pdf',pj.authId,'PJ',randomUUID(),'PJ_ADVANCE',JSON.stringify([{name:'Transfer PJ lama',url:'https://example.com/old.pdf'}])]);
  item=(await s.detail(pj,activityId)).data.items[0];
  await assert.rejects(s.save(admin,payment('DIRECT',40000)));
  await s.save(admin,payment('REIMBURSEMENT',60000));
  item=(await s.detail(pj,activityId)).data.items[0];
  assert.equal(Number(item.reimbursed),60000);assert.equal(Number(item.paid),60000);
  await s.save(admin,payment('DIRECT',40000));
  item=(await s.detail(pj,activityId)).data.items[0];assert.equal(Number(item.paid),100000);
 }finally{await db.close()}
});

test('committee proof replacement preserves accounting and audits old attachments',async()=>{
 const {db,service:s}=await fixture();try{
 const {randomUUID}=require('node:crypto');
 const {id:activityId}=await s.save(pj,{kind:'activity',title:'Honor',description:'',start_date:'2026-11-01',end_date:'2026-11-30'});
 const {id:termId}=await s.save(pj,{kind:'term',activityId,title:'Honor',month:11,year:2026,attachments:[]});
 const {id:itemId}=await s.save(pj,{kind:'item',activityId,termId,description:'Honor',quantity:1,unit_price:100000});
 const pay=await s.save(admin,{kind:'payment',activityId,termId,id:itemId,revision:1,flow:'DIRECT',amount:100000,paid_on:'2026-11-03',proof_url:'https://example.com/old.pdf',requestId:randomUUID()});
 const edit={kind:'edit-proof',activityId,termId,id:pay.id,itemId,revision:2,attachments:[{name:'Pengganti.pdf',url:'https://example.com/new.pdf'}]};
 await assert.rejects(s.save(other,edit));await assert.rejects(s.save(pj,edit));await assert.rejects(s.save(admin,{...edit,attachments:[]}));await s.save(admin,edit);await assert.rejects(s.save(admin,edit));
 const d=(await s.detail(pj,activityId)).data;assert.equal(d.payments[0].proof_url,'https://example.com/new.pdf');assert.equal(Number(d.payments[0].amount),100000);assert.equal(Number(d.items[0].paid),100000);assert(d.history.some(h=>h.action==='Bukti pembayaran diperbarui'&&h.snapshot.before.proof_url==='https://example.com/old.pdf'));
 await s.save(admin,{kind:'cancel-payment',activityId,termId,id:pay.id,itemId,revision:3,reason:'Salah catat'});await assert.rejects(s.save(admin,{...edit,revision:4}));
 }finally{await db.close()}
});

test('routine proof replacement preserves paid dates and historical amounts for all categories',async()=>{
 const {updatePaymentProof}=load('payment-proof');
 for(const [kind,model] of [['KLINIK','klinik_slots'],['GURU_ASUH','laporan_guru_asuh_submissions'],['EKSKUL','laporan_ekskul_submissions']]){
  const oldNote=JSON.stringify({nominal:70000,paid_at:'2026-10-01',url:'https://example.com/old.pdf',text:'Lama'});
  const row={id:'88888888-8888-4888-8888-888888888888',status:'paid',dibayarkan:true,catatan_pembayaran:oldNote,dibayarkan_at:'2026-10-01',nominal_dibayarkan:70000};let last;
  const db={$transaction:async fn=>fn({[model]:{findUnique:async()=>row,updateMany:async args=>{last=args;return {count:1}}},tarif_honor:{findMany:()=>{throw new Error('Tariff must not be read')}}})};
  const body={kind,id:row.id,expectedNote:oldNote,url:'https://example.com/new.pdf',text:'Baru',nominal:900000,dibayarkan_at:'2026-11-03'};
  await assert.rejects(updatePaymentProof(db,pj,body));await assert.rejects(updatePaymentProof(db,admin,{...body,url:'javascript:alert(1)'}));await assert.rejects(updatePaymentProof(db,admin,{...body,expectedNote:null}));
  await updatePaymentProof(db,admin,body);assert.deepEqual(Object.keys(last.data),['catatan_pembayaran']);const note=JSON.parse(last.data.catatan_pembayaran);assert.equal(note.nominal,70000);assert.equal(note.paid_at,'2026-10-01');assert.equal(note.url,body.url);assert.equal(note.proof_history[0].url,'https://example.com/old.pdf');
  row.status='finished';row.dibayarkan=false;await assert.rejects(updatePaymentProof(db,admin,body));
 }
});

test('one priced item owns its attachments and payments without a separate detail row',async()=>{
 const {db,service:s,sql}=await fixture();try{
  const {id:activityId}=await s.save(pj,{kind:'activity',title:'Pelatihan',description:'',start_date:'2026-11-01',end_date:'2026-11-30'});
  const files=[{name:'Ampra.pdf',url:'https://example.com/ampra.pdf'},{name:'Kuitansi.png',url:'https://example.com/kuitansi.png'}];
  const input={kind:'single-item',activityId,description:'Honor tentor',recipient:'Tentor A',month:11,year:2026,quantity:2,unit:'orang',unit_price:50000,attachments:files};
  const first=await s.save(pj,input),second=await s.save(pj,{...input,description:'Konsumsi',quantity:1,unit:'paket',unit_price:25000,attachments:[]});
  let detail=(await s.detail(pj,activityId)).data;
  assert.equal(detail.items.length,2);assert.equal(detail.terms.length,2);assert.equal(detail.items.find(i=>i.id===first.id).amount,'100000');
  assert.equal(detail.items.find(i=>i.id===first.id).attachments.length,2);
  assert.equal(Number((await s.list(pj)).data[0].total),125000);
  await assert.rejects(s.save(pj,{...input,month:12}));
  const current=detail.items.find(i=>i.id===first.id);
  await s.save(pj,{...input,id:first.id,revision:current.revision,unit_price:60000,attachments:[files[1]]});
  detail=(await s.detail(pj,activityId)).data;const edited=detail.items.find(i=>i.id===first.id);
  assert.equal(edited.amount,'120000');assert.equal(edited.attachments[0].name,files[1].name);assert.equal(edited.attachments[0].url,files[1].url);
  await db.exec(sql);assert.equal((await s.detail(pj,activityId)).data.items.find(i=>i.id===first.id).attachments[0].url,files[1].url);
  await s.save(pj,{kind:'delete-item',activityId,termId:edited.term_id,id:first.id,revision:edited.revision});
  assert.equal((await s.detail(pj,activityId)).data.items.length,1);
  assert.equal((await s.list(pj)).data[0].total,'25000');
  assert(second.id);
 }finally{await db.close()}
});

test('legacy empty item stays visible as a draft until its price is entered',async()=>{
 const {db,service:s,sql}=await fixture();try{
  const {id:activityId}=await s.save(pj,{kind:'activity',title:'Pelatihan',description:'',start_date:'2026-11-01',end_date:'2026-11-30'});
  const {id:termId}=await s.save(pj,{kind:'term',activityId,title:'Honor tentor',month:11,year:2026,attachments:[{name:'Ampra.pdf',url:'https://example.com/ampra.pdf'}]});
  await db.exec(sql);let detail=(await s.detail(pj,activityId)).data;
  const draft=detail.items.find(i=>i.term_id===termId);assert(draft);assert.equal(Number(draft.amount),0);assert.equal(draft.description,'Honor tentor');assert.equal(draft.attachments[0].name,'Ampra.pdf');
  await db.exec(sql);detail=(await s.detail(pj,activityId)).data;assert.equal(detail.items.length,1);
  await s.save(pj,{kind:'single-item',activityId,id:draft.id,revision:draft.revision,description:'Honor tentor',recipient:'Tentor',month:11,year:2026,quantity:1,unit:'orang',unit_price:75000,attachments:draft.attachments});
  assert.equal(Number((await s.detail(pj,activityId)).data.items[0].amount),75000);
 }finally{await db.close()}
});

test('PJ records transfer recipient as a note; treasurer marks payment and can replace proof',async()=>{
 const {db,service:s}=await fixture();try{
  const {randomUUID}=require('node:crypto');
  const {id:activityId}=await s.save(pj,{kind:'activity',title:'Honor tentor',description:'',start_date:'2026-11-01',end_date:'2026-11-30'});
  const input={kind:'single-item',activityId,description:'Honor tentor',recipient:'Tentor A',month:11,year:2026,quantity:1,unit:'orang',unit_price:100000,attachments:[{name:'Ampra honor tentor',url:'https://example.com/ampra.pdf'}]};
  const {id:itemId}=await s.save(pj,input);
  let d=(await s.detail(pj,activityId)).data,item=d.items.find(i=>i.id===itemId);
  assert.equal(d.items.length,1);assert.equal(item.attachments[0].name,'Ampra honor tentor');
  assert.equal(Number(item.advanced),0);assert.equal(Number(item.paid),0);assert.equal(d.payments.length,0);
  await s.save(admin,{kind:'payment',activityId,termId:item.term_id,id:itemId,revision:item.revision,flow:'DIRECT',amount:100000,paid_on:'2026-11-06',requestId:randomUUID(),attachments:[{name:'Bukti pembayaran',url:'https://example.com/direct.pdf'}]});
  d=(await s.detail(pj,activityId)).data;assert.equal(Number(d.items[0].paid),100000);assert.equal(d.payments.length,1);
  item=d.items[0];
  await assert.rejects(s.save(pj,{...input,id:itemId,revision:item.revision,unit_price:90000}));
  await s.save(pj,{...input,id:itemId,revision:item.revision,recipient:'Staf A',attachments:[{name:'Ampra November',url:'https://example.com/ampra-revisi.pdf'},{name:'Invoice tentor',url:'https://example.com/invoice.pdf'}]});
  d=(await s.detail(pj,activityId)).data;item=d.items[0];
  assert.equal(item.recipient,'Staf A');assert.equal(item.attachments.map(a=>a.name).join('|'),'Ampra November|Invoice tentor');
  const direct=d.payments.find(p=>p.flow==='DIRECT');
  await s.save(admin,{kind:'edit-proof',activityId,termId:item.term_id,itemId,id:direct.id,revision:item.revision,attachments:[{name:'Bukti transfer yang benar',url:'https://example.com/direct-correct.pdf'}]});
  d=(await s.detail(pj,activityId)).data;
  assert.equal(d.payments.find(p=>p.id===direct.id).attachments[0].url,'https://example.com/direct-correct.pdf');
  assert.equal(Number(d.payments.find(p=>p.id===direct.id).amount),100000);
  assert.equal(new Date(d.payments.find(p=>p.id===direct.id).paid_on).toISOString().slice(0,10),'2026-11-06');
 }finally{await db.close()}
});
