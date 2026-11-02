const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports:m.exports,module:m,Date,Intl,URL,URLSearchParams,console,require:n=>n==='@nestjs/common'?require(n):{}});return m.exports;}
const {PtspService}=load('apps/api/src/ptsp/ptsp.service.ts');
const {KlinikService}=load('apps/api/src/klinik/klinik.service.ts');
const admin={authId:'11111111-1111-4111-8111-111111111111',nama:'Petugas',roles:['ADMIN']};
const recipientId='22222222-2222-4222-8222-222222222222', dispositionId='33333333-3333-4333-8333-333333333333';
function payment(slots=[{id:'a',guru_id:1n,status:'finished'},{id:'b',guru_id:1n,status:'finished'}]){let updates=0;const tx={klinik_slots:{findMany:async()=>slots,updateMany:async()=>{updates++;return {count:slots.length}}},klinik_laporan:{findMany:async()=>slots.map(s=>({slot_id:s.id,status:'Approved'}))},tarif_honor:{findFirst:async()=>({nominal:75000})}};return {service:new KlinikService({$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');return fn(tx)}}),updates:()=>updates};}
test('two approved sessions are paid together at the confirmed accumulated total',async()=>{const p=payment();const r=await p.service.handlePatch({user:admin},'mark_paid_batch',null,{ids:['a','b'],expectedTotal:150000});assert.equal(r.total,150000);assert.equal(r.count,2);assert.equal(p.updates(),1)});
test('mixed recipients, already paid sessions, and stale totals cannot cause partial payment',async()=>{for(const [slots,total] of [[[{id:'a',guru_id:1n,status:'finished'},{id:'b',guru_id:2n,status:'finished'}],150000],[[{id:'a',guru_id:1n,status:'paid'}],75000],[[{id:'a',guru_id:1n,status:'finished'}],1]]){const p=payment(slots);await assert.rejects(p.service.handlePatch({user:admin},'mark_paid_batch',null,{ids:slots.map(s=>s.id),expectedTotal:total}));assert.equal(p.updates(),0)}});
test('ordinary user cannot mark a batch paid',async()=>{const p=payment();await assert.rejects(p.service.handlePatch({user:{roles:['GURU']}},'mark_paid_batch',null,{ids:['a'],expectedTotal:75000}));assert.equal(p.updates(),0)});
test('recipient sees only their inbox and cannot open another recipient PDF data',async()=>{const calls=[];const s=new PtspService({$queryRaw:async(...p)=>{calls.push(p);return p[0].join('').includes('COUNT(*)')?[{total:1,unread:1}]:[{recipient_id:recipientId}];}});await s.listDispositions({authId:recipientId,roles:['GURU']});assert.equal(calls[0][1],false);assert.equal(calls[0][2],recipientId);assert.equal(calls[1][2],recipientId);await assert.rejects(s.getDisposition({authId:admin.authId,roles:['GURU']},dispositionId));assert.equal((await s.getDisposition(admin,dispositionId)).recipient_id,recipientId)});
test('only recipient can mark a notice read without a follow-up report',async()=>{let writes=0;const s=new PtspService({$queryRaw:async()=>[{recipient_id:recipientId}],$executeRaw:async()=>{writes++}});await assert.rejects(s.markLetterRead(admin,dispositionId));await s.markLetterRead({authId:recipientId,roles:[]},dispositionId);assert.equal(writes,1)});
test('dispatched snapshot contains request attachments and notification is private',async()=>{let insert,notification,override;const recipient={id:2n,auth_id:recipientId,nama:'Penerima'};const tx={$queryRaw:async(...p)=>{insert=p;return [{id:dispositionId,recipient_id:recipientId,instructions:"Pemberitahuan"}]},public_users:{findUnique:async()=>({page_overrides:{add:['surat'],remove:[]}}),update:async p=>{override=p}},notifications:{upsert:async p=>{notification=p}}};const s=new PtspService({public_users:{findFirst:async()=>recipient},ptsp_legalisir:{findUnique:async()=>({id:1n,nama:'Pemohon',wa:'0812345',file_dokumen:'https://example.com/surat.pdf'})},$transaction:fn=>fn(tx)});await s.createDisposition(admin,{table:'ptsp_legalisir',id:'1',recipientId,instructions:'Tolong verifikasi'});const snapshot=JSON.parse(insert.at(-2));assert.equal(snapshot.file_dokumen,'https://example.com/surat.pdf');assert.equal(snapshot.wa,'0812345');assert.equal(notification.create.recipient_user_id,recipientId);assert(override.data.page_overrides.add.includes('layanan-ptsp'));assert(override.data.page_overrides.add.includes('surat'))});
test('migration is repeatable, persistent, and scheduled before application restart',async()=>{const db=new PGlite();try{const sql=fs.readFileSync('apps/api/prisma/sql/20261102_ptsp_disposisi.sql','utf8');await db.exec(sql);await db.exec(sql);await db.query('INSERT INTO ptsp_disposisi (table_name,request_id,sender_id,recipient_id,sender_name,recipient_name,instructions,snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ['ptsp_legalisir','1',admin.authId,recipientId,'Admin','Guru','Periksa','{"nama":"Pemohon"}']);assert.equal((await db.query('SELECT status FROM ptsp_disposisi')).rows[0].status,'Menunggu');const deploy=fs.readFileSync('.github/workflows/deploy.yml','utf8');assert(deploy.indexOf('20261102_ptsp_disposisi.sql')<deploy.indexOf('docker compose up -d'))}finally{await db.close()}});

test('PDF route returns a paginated PDF with the request and denies unauthorized downloads',async()=>{
 let permitted=true;
 const data={id:dispositionId,created_at:new Date().toISOString(),sender_name:'Admin',recipient_name:'Guru',instructions:'Tindak lanjuti',status:'Menunggu',snapshot:{nama:'Pemohon',wa:'08123',isi_laporan:'Detail permohonan '.repeat(800),file_dokumen:'https://example.com/surat.pdf',tracking_token:'private-token'}};
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/app/api/ptsp/disposisi/pdf/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,Date,Uint8Array,require:n=> n==='next/server'?require('next/server'): n==='jspdf'?require('jspdf'):n==='@/lib/ptsp-letter'?load('apps/web/lib/ptsp-letter.ts'):n==='@/lib/app-jwt'?{extractRequestToken:()=> 'session'}:{nestFetchAsUser:async()=>permitted?{status:200,body:{ok:true,data}}:{status:403,body:{ok:false}}}});
 const req={nextUrl:new URL('http://localhost/api/ptsp/disposisi/pdf?id='+dispositionId)};
 const response=await m.exports.GET(req);assert.equal(response.headers.get('content-type'),'application/pdf');
 const pdf=Buffer.from(await response.arrayBuffer()).toString('latin1');assert(pdf.startsWith('%PDF-'));assert(pdf.includes('PEMBERITAHUAN SURAT MASUK'));assert((pdf.match(/\/Type \/Page\b/g)||[]).length>1);assert(!pdf.includes('private-token'));
 permitted=false;const denied=await m.exports.GET(req);assert.equal(denied.status,403);
});


test('letter helpers hide storage metadata, label fields, and reject unsafe attachments',()=>{
 const {letterFields,letterAttachments}=load('apps/web/lib/ptsp-letter.ts');
 const data={id:1,tracking_token:'secret',storage_type:'supabase',file_proposal_size:123,status:1,nama:'Pemohon',wa:'08123',file_proposal:'javascript:alert(1)',file_url:'https://example.com/surat.pdf'};
 const fields=letterFields(data);assert.equal(fields.length,2);assert.equal(fields[0].label,'Nama pemohon');assert.equal(fields[1].value,'08123');
 const files=letterAttachments(data);assert.equal(files.length,1);assert.equal(files[0].label,'Lampiran surat');
 assert.equal(letterAttachments({file_url:'//evil.example/file'}).length,0);
 assert.equal(letterAttachments({file_url:'/\\evil.example/file'}).length,0);
 assert.equal(letterFields(null).length,0);
});

test('letter migrations preserve existing notices, paginate privately, and make retries idempotent',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE TABLE notifications (type text,title text,link text,source_id text,source_table text)');
  await db.exec(fs.readFileSync('apps/api/prisma/sql/20261102_ptsp_disposisi.sql','utf8'));
  const migration=fs.readFileSync('apps/api/prisma/sql/20261102_ptsp_surat_masuk.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const query=client=>async(strings,...values)=>(await client.query(strings.reduce((sql,part,index)=>sql+(index?'$'+index:'')+part,''),values)).rows;
  const delivered=new Map();const recipient={id:2n,auth_id:recipientId,nama:'Penerima'};
  const service=new PtspService({
   $queryRaw:query(db),$executeRaw:async(strings,...values)=>query(db)(strings,...values),
   public_users:{findFirst:async()=>recipient},
   ptsp_legalisir:{findUnique:async()=>({id:1n,nama:'Pemohon',wa:'0812345',file_dokumen:'https://example.com/surat.pdf'})},
   $transaction:fn=>db.transaction(client=>fn({$queryRaw:query(client),public_users:{findUnique:async()=>({page_overrides:null}),update:async()=>({})},notifications:{upsert:async({where,create})=>{delivered.set(where.id,create);return create}}})),
  });
  const input={table:'ptsp_legalisir',id:'1',recipientId,message:'',clientRequestId:'44444444-4444-4444-8444-444444444444'};
  const first=await service.createDisposition(admin,input);const retry=await service.createDisposition(admin,input);
  assert.equal(first.data.id,retry.data.id);assert.equal(delivered.size,1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM ptsp_disposisi')).rows[0].count,1);
  assert.equal(delivered.values().next().value.type,'PTSP_SURAT_MASUK');
  assert(first.data.instructions.includes('Ada surat masuk'));
  const reader={authId:recipientId,roles:['GURU']};
  let list=await service.listDispositions(reader);assert.equal(list.total,1);assert.equal(list.summary.unread,1);
  await service.markLetterRead(reader,first.data.id);
  const read=(await service.getDisposition(reader,first.data.id)).read_at;
  await service.markLetterRead(reader,first.data.id);
  assert.equal((await service.getDisposition(reader,first.data.id)).read_at.toISOString(),read.toISOString());
  list=await service.listDispositions(reader,'1',true);assert.equal(list.total,0);assert.equal(list.summary.unread,0);
  const stranger={authId:'55555555-5555-4555-8555-555555555555',roles:['GURU']};
  assert.equal((await service.listDispositions(stranger)).total,0);
  await assert.rejects(service.markLetterRead(stranger,first.data.id));
  for(let i=0;i<15;i++)await db.query('INSERT INTO ptsp_disposisi (table_name,request_id,sender_id,recipient_id,sender_name,recipient_name,instructions,snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ['ptsp_legalisir',String(i),admin.authId,recipientId,'Admin','Guru','Ada surat','{}']);
  list=await service.listDispositions(reader,'2');assert.equal(list.total,16);assert.equal(list.data.length,4);assert.equal(list.page,2);
  const deploy=fs.readFileSync('.github/workflows/deploy.yml','utf8');assert(deploy.indexOf('20261102_ptsp_surat_masuk.sql')<deploy.indexOf('docker compose up -d'));
 }finally{await db.close()}
});
