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
 await assert.rejects(s.save(pj,edit));await assert.rejects(s.save(admin,edit));await s.save(admin,{...edit,reason:'Tambahan ruang lingkup pekerjaan'});
 await assert.rejects(s.save(admin,{...edit,reason:'Stale revision'}));
 const second=await s.save(pj,{kind:'term',activityId:aid,title:'Ampra Desember',month:12,year:2026,attachments:[],copyFrom:first.id});
 for(const [month,year]of[[1,2027],[2,2027]])await s.save(pj,{kind:'term',activityId:aid,title:'Termin '+month,month,year,attachments:[]});
 d=(await s.detail(pj,aid)).data;assert.equal(d.terms.length,4);const copied=d.items.find(i=>i.term_id===second.id);assert.equal(Number(copied.amount),120000);assert.equal(Number(copied.paid),0);assert(d.history.some(h=>h.reason==='Tambahan ruang lingkup pekerjaan'&&h.snapshot.before&&h.snapshot.after));
 await assert.rejects(s.save(pj,{kind:'term',activityId:aid,title:'Di luar periode',month:3,year:2027,attachments:[]}));
 const current=d.items.find(i=>i.id===item.id);await s.save(admin,{...payment,revision:current.revision,amount:80000,requestId:'66666666-6666-4666-8666-666666666666'});
 d=(await s.detail(pj,aid)).data;assert.equal(Number(d.items.find(i=>i.id===item.id).paid),120000);
 await assert.rejects(s.save(pj,{kind:'delete-item',activityId:aid,termId:first.id,id:item.id,revision:d.items.find(i=>i.id===item.id).revision}));
 await assert.rejects(s.save(admin,{...edit,revision:d.items.find(i=>i.id===item.id).revision,unit_price:10000,reason:'Below paid amount'}));
 const list=await s.list(pj);assert.equal(Number(list.data[0].total),240000);assert.equal(Number(list.data[0].paid),120000);assert.equal((await s.list(other)).data.length,0);assert.equal((await s.list(admin)).data.length,1);
 const secondPayment=d.payments.find(p=>Number(p.amount)===80000),currentItem=d.items.find(i=>i.id===item.id);
 const cancel={kind:'cancel-payment',activityId:aid,termId:first.id,id:secondPayment.id,itemId:item.id,revision:currentItem.revision,reason:'Salah rekening, akan ditransfer ulang'};
 await assert.rejects(s.save(pj,cancel));await assert.rejects(s.save(admin,{...cancel,reason:''}));await s.save(admin,cancel);await s.save(admin,cancel);
 d=(await s.detail(pj,aid)).data;assert.equal(Number(d.items.find(i=>i.id===item.id).paid),40000);assert.equal(d.payments.length,2);assert(d.payments.find(p=>p.id===secondPayment.id).voided_at);assert.equal(Number((await s.list(pj)).data[0].paid),40000);
 await assert.rejects(s.save(admin,{...payment,revision:currentItem.revision,amount:80000,requestId:'66666666-6666-4666-8666-666666666666'}));
 }finally{await db.close()}});
test('migration is repeatable and preserves access changes after initial installation',async()=>{const {db,sql}=await fixture();try{assert.equal((await db.query("SELECT * FROM role_pages WHERE role='GURU' AND page_id='pengajuan-komite'")).rows.length,1);await db.exec("DELETE FROM role_pages WHERE role='GURU'");await db.exec(sql);assert.equal((await db.query("SELECT * FROM role_pages WHERE role='GURU'")).rows.length,0)}finally{await db.close()}});
test('monthly report excludes committee data, never reads current tariffs, and marks missing historical snapshots',async()=>{
 const db={role_pages:{findFirst:async()=>null},$transaction:async fn=>fn({
  laporan_guru_asuh_submissions:{findMany:async p=>{assert.equal(p.where.bulan,11);assert.equal(p.where.tahun,2026);assert.equal(p.where.dibayarkan,true);return [{id:'g1',nama_guru_snap:'Siti',nip:'123',catatan_pembayaran:'{"nominal":100000,"url":"https://file.icgowa.sch.id/proof.png"}'},{id:'g2',nama_guru_snap:'Ahmad',catatan_pembayaran:null}]}},
  laporan_ekskul_submissions:{findMany:async()=>[{id:'e1',pembina_nama:'Ali',catatan_pembayaran:'{"nominal":250000}',ekskul:{nama_ekskul:'Pramuka'},total_pertemuan:4}]},
  klinik_slots:{findMany:async()=>[{id:'c1',nama_guru:'Nina',tanggal:new Date('2026-11-02'),nominal_dibayarkan:50000}]},
  tarif_honor:{findMany:async()=>{throw new Error('Current tariffs must not affect historical reports')}},
  profil_sekolah:{findFirst:async()=>({nama:'Madrasah Contoh'})},$queryRaw:async()=>[{id:'proof-id',selected:{ids:['c1']}}]
 })};
 const s=new PaymentReportsService(db);await assert.rejects(s.report(pj,{month:11,year:2026}));await assert.rejects(s.report(admin,{month:11,year:2026,category:'KOMITE'}));
 const report=await s.report(admin,{month:11,year:2026});assert.equal(report.data.rows.length,4);assert.equal(report.data.missingAmounts,1);assert.equal(report.data.summary.reduce((s,r)=>s+r.total,0),400000);assert(report.data.rows.find(r=>r.id==='c1').proofUrl.includes('proof-id'));
});
test('manual payment snapshots use authoritative amounts, reject changed totals and unsafe proofs, and preserve zero tariffs',async()=>{
 const db={tarif_honor:{findMany:async()=>[{modul:'GURU_ASUH',nominal:100000},{modul:'EKSKUL_INTERNAL',nominal:25000},{modul:'EKSKUL_EKSTERNAL',nominal:50000}]},ekskul_pertemuan:{findMany:async()=>[{status_pelatih:'Internal'},{status_pelatih:'Eksternal'}]}};
 assert.equal(JSON.parse(await paymentSnapshot(db,'GURU_ASUH','id','{}')).nominal,100000);assert.equal(JSON.parse(await paymentSnapshot(db,'EKSKUL','id','{}')).nominal,75000);
 await assert.rejects(paymentSnapshot(db,'GURU_ASUH','id','{"nominal":50000}'));await assert.rejects(paymentSnapshot(db,'GURU_ASUH','id','{"url":"javascript:alert(1)"}'));await assert.rejects(paymentSnapshot(db,'GURU_ASUH','id','{"url":"//example.com/file"}'));
 db.tarif_honor.findMany=async()=>[{modul:'GURU_ASUH',nominal:0}];assert.equal(JSON.parse(await paymentSnapshot(db,'GURU_ASUH','id','{}')).nominal,0);
});
