const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,esModuleInterop:true}}).outputText;
const stamp='2026-10-12T00:00:00.000Z';const user={id:1n,nip:'001',roles:['SISWA','PENGURUS_KELAS'],authId:'owner'};
const teacher={id:2n,nip:'teacher-A',roles:['GURU'],nama:'Guru A',authId:'teacher'};const admin={id:3n,roles:['ADMINISTRATOR'],authId:'admin'};
const input={kelas:'A',kelas_list:['A'],judul_tugas:'Tugas',tanggal_mulai:'2026-10-12',is_range:false,guru_id:'teacher-A',mapel_id:1};
const nulls={DbNull:'DB_NULL',JsonNull:'JSON_NULL'};
function fixture(overrides={},failure=()=>false,clock=Date){
 let state={tasks:[{id:1n,...input,tanggal_mulai:new Date('2026-10-12T00:00:00Z'),tanggal_selesai:null,tahun_ajaran:'2026/2027',target_siswa:null,created_by:'1',updated_at:new Date(stamp)}],enroll:[{nisn:'001',kelas:'A',tahun_ajaran:'2026/2027',aktif:true,is_pengurus:true},{nisn:'999',kelas:'A',tahun_ajaran:'2026/2027',aktif:true,is_pengurus:false}],checklists:[],files:[{file_url:'https://example.test/file.pdf',file_name:'file.pdf',folder:'owner:owner:tugas-siswa',size_bytes:100n,storage_type:'cloudflare'}],...overrides};let serial=Promise.resolve();
 function matches(row,where={}){return Object.entries(where).every(([k,v])=>{
  if(k==='AND')return v.every(w=>matches(row,w));if(k==='OR')return v.some(w=>matches(row,w));
  const val=row[k];if(v instanceof Date)return val?.getTime()===v.getTime();
  if(v && typeof v==='object'){
   if('equals'in v)return ['DB_NULL','JSON_NULL'].includes(v.equals)?val==null:JSON.stringify(val)===JSON.stringify(v.equals);
   if(v.array_contains){const array=v.path?v.path.reduce((a,key)=>a?.[key],val):val;return Array.isArray(array)&&v.array_contains.every(x=>array.includes(x));}
   if(v.in)return v.in.includes(val);if(v.contains)return String(val||'').toLowerCase().includes(v.contains.toLowerCase());
   return (!v.gte||val>=v.gte)&&(!v.lte||val<=v.lte);
  }return val===v;
 });}
 function client(get){const models={};
  function table(name){return{
   async findMany(q={}){const list=get()[name].filter(r=>matches(r,q.where));return structuredClone(list.slice(q.skip||0,q.take?(q.skip||0)+q.take:undefined));},
   async findFirst(q){return structuredClone(get()[name].find(r=>matches(r,q.where))||null);},async findUnique(q){return this.findFirst(q);},
   async count(q){return get()[name].filter(r=>matches(r,q.where)).length;},
   async create({data}){const row={id:BigInt(get()[name].length+1),updated_at:new Date(stamp),...structuredClone(data)};if(row.target_siswa==='DB_NULL')row.target_siswa=null;get()[name].push(row);return structuredClone(row);},
   async update({where,data}){if(failure(name,'update'))throw new Error('Injected failure');const row=get()[name].find(r=>matches(r,where));Object.assign(row,structuredClone(data));if(row.target_siswa==='DB_NULL')row.target_siswa=null;return structuredClone(row);},
   async deleteMany({where}){const old=get()[name];get()[name]=old.filter(r=>!matches(r,where));return{count:old.length-get()[name].length};},
   async delete({where}){if(failure(name,'delete'))throw new Error('Injected failure');return this.deleteMany({where});},
   async upsert({where,create,update}){const key=where.tugas_id_siswa_id;const row=get()[name].find(r=>matches(r,key));if(row)Object.assign(row,update);else get()[name].push(create);}
  };}
  models.tugas_siswa=table('tasks');models.siswa_kelas=table('enroll');models.tugas_siswa_checklist=table('checklists');models.file_uploads=table('files');
  models.master_tahun_ajaran={async findMany(){return[{tahun_ajaran:'2026/2027'}];}};
  models.master_guru={async findFirst({where}){return ['teacher-A','teacher-B'].includes(where.nip)?{nip:where.nip,nama_lengkap:where.nip==='teacher-A'?'Guru A':'Guru B'}:null;},async findMany(){return[];}};
  models.master_mapel={async findFirst({where}){return where.id===1n?{id:1n,nama:'Matematika'}:null;},async findMany(){return[];}};
  models.master_kelas={async findMany(){return[{nama:'A'},{nama:'B'}];}};models.$executeRaw=async strings=>assert.match(strings.join(''),/pg_advisory_xact_lock/);return models;
 }
 const prisma=client(()=>state);prisma.$transaction=async work=>{let release;const prior=serial;serial=new Promise(r=>release=r);await prior;const draft=structuredClone(state);try{const result=await work(client(()=>draft));state=draft;return result;}finally{release();}};
 const module={exports:{}};class E extends Error{constructor(msg){super(msg);this.name=new.target.kind;}}
 const errors=Object.fromEntries(['BadRequestException','NotFoundException','ForbiddenException','ConflictException'].map(name=>{class ErrorType extends E{static kind=name;}return[name,ErrorType];}));
 vm.runInNewContext(compile(fs.readFileSync('apps/api/src/tugas-siswa/tugas-siswa.service.ts','utf8')),{module,exports:module.exports,Date:clock,Intl,URL,require(name){if(name==='@nestjs/common')return{...errors,Injectable:()=>v=>v};if(name==='@prisma/client')return{Prisma:nulls};return{};}});
 return{service:new module.exports.TugasSiswaService(prisma),get state(){return state;}};
}
const reject=(p,name)=>assert.rejects(p,e=>e.name===name);
test('TAMU dan sesi kosong ditolak',async()=>{const f=fixture();await reject(f.service.findAll({}, {id:5,roles:['TAMU']}),'ForbiddenException');await reject(f.service.findAll({},null),'ForbiddenException');});
test('Siswa hanya melihat kelas dan tahun enrollment miliknya',async()=>{const f=fixture();assert.equal((await f.service.findAll({},user)).total,1);f.state.tasks[0].tahun_ajaran='2025/2026';assert.equal((await f.service.findAll({},user)).total,0);});
test('Target siswa berlaku pada daftar, detail, statistik dan checklist',async()=>{const f=fixture();f.state.tasks[0].target_siswa={A:['999']};assert.equal((await f.service.findAll({},user)).total,0);await reject(f.service.findById(1,user),'NotFoundException');assert.equal((await f.service.getStats({},user)).stats.totalActive,0);await reject(f.service.toggleChecklist(1,1,true,user),'NotFoundException');});
test('Target null dan target sendiri tetap dapat dibaca',async()=>{const f=fixture();assert.equal((await f.service.findAll({},user)).total,1);f.state.tasks[0].target_siswa={A:['001']};assert.equal((await f.service.findById(1,user)).id,1);});
test('Filter multikelas konsisten dengan daftar dan statistik',async()=>{const f=fixture();Object.assign(f.state.tasks[0],{kelas:'B',kelas_list:['B','A']});assert.equal((await f.service.findAll({kelas:'A'},user)).total,1);assert.equal((await f.service.getStats({kelas:'A'},user)).stats.totalActive,1);});
test('Kelas kosong dan kelas utama tidak konsisten ditolak',async()=>{for(const data of [{kelas:'B',kelas_list:[]},{kelas:'B',kelas_list:['A']}])await reject(fixture().service.create({...input,...data},user),'BadRequestException');});
test('Pengurus tidak dapat menulis kelas atau tahun lain',async()=>{for(const data of [{kelas:'B',kelas_list:['B']},{tanggal_mulai:'2025-10-12'}])await reject(fixture().service.create({...input,...data},user),'ForbiddenException');});
test('Update parsial memeriksa data gabungan dan enrollment',async()=>{const f=fixture();await reject(f.service.update(1,{kelas_list:['B'],expected_updated_at:stamp},user),'ForbiddenException');assert.equal(f.state.tasks[0].kelas,'A');});
test('Input wajib, kalender, urutan tanggal, enum dan integer divalidasi',async()=>{for(const data of [{judul_tugas:' '},{tanggal_mulai:'2026-02-30'},{is_range:'false'},{is_range:true,tanggal_selesai:'2026-10-01'},{jenis:'evil'},{mapel_id:'1garbage'}])await reject(fixture().service.create({...input,...data},user),'BadRequestException');for(const q of [{page:1.5},{limit:Infinity},{page:-1},{tanggalAwal:'bad'}])await reject(fixture().service.findAll(q,user),'BadRequestException');});
test('URL tidak aman dan lampiran milik orang lain ditolak',async()=>{const f=fixture();await reject(f.service.create({...input,file_url:'javascript:alert(1)'},user),'BadRequestException');f.state.files[0].folder='owner:other:tugas-siswa';await reject(f.service.create({...input,file_url:'https://example.test/file.pdf'},user),'ForbiddenException');});
test('Metadata lampiran diambil dari registry',async()=>{const f=fixture();const result=await f.service.create({...input,file_url:'https://example.test/file.pdf',file_name:'fake',file_size:999,storage_type:'evil'},user);assert.equal(result.file_name,'file.pdf');assert.equal(result.file_size,100);assert.equal(result.storage_type,'cloudflare');});
test('Target siswa harus anggota kelas dan tahun terkait',async()=>{await reject(fixture().service.create({...input,target_siswa:{A:['777']}},user),'BadRequestException');await reject(fixture().service.create({...input,target_siswa:{B:['999']}},user),'BadRequestException');assert((await fixture().service.create({...input,target_siswa:{A:['999']}},user)).id);});
test('Guru terpilih dan penginput disimpan terpisah; admin tanpa NIP dapat menulis',async()=>{const result=await fixture().service.create({...input,guru_id:'teacher-B',nama_guru:'Palsu'},admin);assert.equal(result.guru_id,'teacher-B');assert.equal(result.nama_guru,'Guru B');assert.equal(result.created_by,'3');});
test('Guru tidak dapat menyamar sebagai guru lain',async()=>{await reject(fixture().service.create({...input,guru_id:'teacher-B'},teacher),'ForbiddenException');});
test('Guru pemberi tugas tidak otomatis menjadi pemilik catatan orang lain',async()=>{await reject(fixture().service.update(1,{expected_updated_at:stamp},teacher),'ForbiddenException');});
test('Versi lama ditolak; update parsial sah mempertahankan data',async()=>{const f=fixture();await reject(f.service.update(1,{judul_tugas:'Baru',expected_updated_at:null},user),'ConflictException');assert.equal((await f.service.update(1,{judul_tugas:'Baru',expected_updated_at:stamp},user)).judul_tugas,'Baru');});
test('Dua perubahan bersamaan tidak saling menimpa',async()=>{const f=fixture();const results=await Promise.allSettled(['A','B'].map(judul_tugas=>f.service.update(1,{judul_tugas,expected_updated_at:stamp},user)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.name,'ConflictException');});
test('Kegagalan hapus tugas membatalkan penghapusan checklist',async()=>{const f=fixture({checklists:[{tugas_id:1n,siswa_id:1n,is_done:true}]},(name,op)=>name==='tasks'&&op==='delete');await assert.rejects(f.service.remove(1,user));assert.equal(f.state.checklists.length,1);assert.equal(f.state.tasks.length,1);});
test('Checklist wajib boolean, ID sah dan identitas sendiri',async()=>{const f=fixture();await reject(f.service.toggleChecklist(1,1,'false',user),'BadRequestException');await reject(f.service.toggleChecklist(1,2,true,user),'ForbiddenException');await reject(f.service.toggleChecklist('1bad',1,true,user),'BadRequestException');await reject(f.service.toggleChecklist(1,2,true,teacher),'ForbiddenException');await f.service.toggleChecklist(1,1,true,user);assert.equal(f.state.checklists.length,1);});
test('Upload hanya untuk penulis yang berwenang',async()=>{await fixture().service.uploadAccess(admin);await fixture().service.uploadAccess(user);const f=fixture();f.state.enroll.forEach(e=>e.is_pengurus=false);await reject(f.service.uploadAccess(user),'ForbiddenException');});
test('Statistik dan deadline memakai kalender sekolah setelah tengah malam',async()=>{
 class Clock extends Date{constructor(...a){super(...(a.length?a:['2026-10-12T17:30:00Z']));}}
 assert.equal((await fixture({},()=>false,Clock).service.getStats({},user)).stats.totalActive,0);
 const module={exports:{}};vm.runInNewContext(compile(fs.readFileSync('apps/web/app/tugas-siswa/deadline.ts','utf8')),{module,exports:module.exports,Date:Clock,Intl});assert.equal(module.exports.getDeadlineInfo('2026-10-12').tone,'lewat');assert.equal(module.exports.getDeadlineInfo('2026-10-13').tone,'today');assert.equal(module.exports.getDeadlineInfo('2026-02-30').text,'');
});
test('Upload anonim ditolak sebelum membaca body; jalur lama memaksa folder tugas',async()=>{
 const module={exports:{}};let token=null,forwarded;
 class Request{constructor(url,init){this.url=url;Object.assign(this,init);}}
 vm.runInNewContext(compile(fs.readFileSync('apps/web/app/api/tugas-siswa/upload/route.ts','utf8')),{module,exports:module.exports,Headers,require(name){if(name==='next/server')return{NextRequest:Request,NextResponse:{json:(body,opts)=>({body,status:opts.status})}};if(name.includes('app-jwt'))return{extractRequestToken:()=>token};return{POST:async req=>{forwarded=req;return{status:200};}};}});
 assert.equal((await module.exports.POST({formData(){throw new Error('Must not read');}})).status,401);
 token='session';const form=new FormData();form.set('folder','evil');await module.exports.POST({url:'https://example.test/api/tugas-siswa/upload',headers:{'content-type':'multipart/form-data'},formData:async()=>form});assert.equal(forwarded.body.get('folder'),'tugas-siswa');assert.equal(forwarded.headers.has('content-type'),false);
});
test('Unggahan utama menegakkan izin, format, MIME dan pencatatan pemilik',async()=>{
 const module={exports:{}};let token='session',allowed=true,failRegistry=false,stored,registered;
 const config={storage_type:'cloudflare',cloudflare_account_id:'test',cloudflare_access_key_id:'test',cloudflare_secret_access_key:'test',cloudflare_bucket_name:'test',cloudflare_cdn_domain:'https://example.test'};
 vm.runInNewContext(compile(fs.readFileSync('apps/web/app/api/upload/route.ts','utf8')),{module,exports:module.exports,Buffer,File,Blob,URL,URLSearchParams,process:{env:{}},console:{log(){},warn(){},error(){}},require(name){
  if(name==='next/server')return{NextResponse:{json:(body,options)=>Response.json(body,options)}};
  if(name==='@aws-sdk/client-s3')return{S3Client:class{},PutObjectCommand:class{},DeleteObjectCommand:class{}};
  if(name==='@aws-sdk/lib-storage')return{Upload:class{constructor(options){stored=options.params;}async done(){}}};
  if(name.includes('file-registry'))return{registerUpload:async(entry,required)=>{assert.equal(required,true);registered=entry;if(failRegistry)throw new Error('registry failed');}};
  if(name.includes('storage/mime'))return{getMimeTypeFromFileName:()=> 'application/pdf'};
  if(name.includes('prestasi-upload'))return{validatePrestasiUpload:async()=>true};
  if(name.includes('api-auth'))return{getApiUser:async()=>({authId:'owner'})};
  if(name.includes('app-jwt'))return{extractRequestToken:()=>token};
  if(name.includes('nest-api'))return{nestFetch:async()=>({status:200,body:{data:config}}),nestFetchAsUser:async()=>({status:allowed?200:403,body:{ok:allowed}})};
  return require(name);
 }});
 async function call(file){const form=new FormData();form.set('folder','tugas-siswa');form.set('file',file);return module.exports.POST({formData:async()=>form});}
 const pdf=new File(['%PDF-1.7'],'test.pdf',{type:'text/html'});
 token=null;assert.equal((await call(pdf)).status,401);assert.equal(stored,undefined);
 token='session';allowed=false;assert.equal((await call(pdf)).status,403);assert.equal(stored,undefined);
 allowed=true;assert.equal((await call(new File(['<script>evil</script>'],'evil.html',{type:'text/html'}))).status,400);
 assert.equal((await call(new File([new Uint8Array(10*1024*1024+1)],'big.pdf'))).status,400);
 assert.equal((await call(pdf)).status,200);assert.equal(stored.ContentType,'application/pdf');assert.equal(registered.owner_auth_id,'owner');assert.equal(registered.folder,'tugas-siswa');
 failRegistry=true;assert.equal((await call(pdf)).status,503);
});
test('Target NISN pembaca disembunyikan, tetapi penginput dapat mempertahankan target saat edit',async()=>{
 const f=fixture();Object.assign(f.state.tasks[0],{created_by:'2',target_siswa:{A:['001','999']}});assert.deepEqual(JSON.parse(JSON.stringify((await f.service.findById(1,user)).target_siswa)),{A:['001']});
 f.state.tasks[0].created_by='1';assert.deepEqual(JSON.parse(JSON.stringify((await f.service.findById(1,user)).target_siswa)),{A:['001','999']});
});
