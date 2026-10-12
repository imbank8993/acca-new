const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const id = '11111111-1111-4111-8111-111111111111';
const stamp = '2026-10-12T00:00:00.000Z';
const student = {id:1n,role:'SISWA',nip:'0012345678',username:'0012345678',authId:'owner'};
const other = {...student,id:2n,nip:'0099999999',username:'0099999999',authId:'other'};
const validator = {id:3n,roles:['OP_LOMBA'],nama:'Validator',authId:'validator'};
const payload = {nisn:student.nip,nama_lomba:'OSN',kategori:'Akademik',tingkat:'Nasional',penyelenggara:'Madrasah',tanggal_pelaksanaan:'2026-10-01',prestasi_diraih:'Juara 1',bukti_sertifikat:'https://example.test/certificate.pdf'};
function fixture(overrides={}) {
 let rows=[{id,...payload,status_validasi:'Menunggu',updated_at:new Date(stamp),created_at:new Date(stamp),...overrides}];
 let files=[{file_url:payload.bukti_sertifikat,file_name:'certificate.pdf',folder:'owner:owner:prestasi',size_bytes:1000n}];
 let lastQuery;
 const match=(row,where)=>Object.entries(where).every(([key,value])=>{
  if(key==='OR')return value.some(filter=>Object.entries(filter).some(([k,v])=>row[k].toLowerCase().includes(v.contains.toLowerCase())));
  if(value instanceof Date)return row[key]?.getTime()===value.getTime();
  if(value && typeof value==='object')return value.gte ? row[key]?.getTime() >= value.gte.getTime() && row[key]?.getTime() < value.lt.getTime() : value.in?.includes(row[key]);
  return row[key]===value;
 });
 const prisma={prestasi_lomba:{
  async findMany(query){lastQuery=query;return structuredClone(rows.filter(r=>match(r,query.where)).slice(query.skip,query.skip+query.take));},
  async findUnique({where}){return structuredClone(rows.find(r=>r.id===where.id)||null);},
  async create({data}){const row={id,...data,updated_at:new Date(stamp)};rows.push(row);return structuredClone(row);},
  async updateMany({where,data}){const found=rows.filter(r=>match(r,where));found.forEach(r=>Object.assign(r,structuredClone(data)));return{count:found.length};},
  async deleteMany({where}){const found=rows.filter(r=>match(r,where));rows=rows.filter(r=>!found.includes(r));return{count:found.length};}
 },file_uploads:{async findUnique({where}){return files.find(f=>f.file_url===where.file_url)||null;}}};
 const module={exports:{}};
 class HttpError extends Error {constructor(message){super(message);this.name=new.target.name;}}
 const exceptions=Object.fromEntries(['NotFoundException','BadRequestException','ConflictException','ForbiddenException'].map(name=>[name,class extends HttpError {constructor(msg){super(msg);this.name=name;}}]));
 vm.runInNewContext(compile(fs.readFileSync('apps/api/src/prestasi/prestasi.service.ts','utf8')),{module,exports:module.exports,Date,URL,require(name){if(name==='@nestjs/common')return{...exceptions,Injectable:()=>value=>value};return{};}});
 return{service:new module.exports.PrestasiService(prisma),get rows(){return rows;},get query(){return lastQuery;},files,replace(value){rows=value;}};
}
const rejects=(promise,name)=>assert.rejects(promise,error=>error.name===name);

test('Siswa hanya membaca miliknya meskipun filter NISN dimanipulasi',async()=>{
 const f=fixture();assert.equal((await f.service.findAll({nisn:student.nip},other)).data.length,0);assert.equal(f.query.where.nisn,other.nip);
 assert.equal((await f.service.findAll({},student)).data.length,1);
});
test('Detail milik orang lain dan peran tanpa izin ditolak',async()=>{
 const f=fixture();await rejects(f.service.findOne(id,other),'ForbiddenException');await rejects(f.service.findAll({}, {id:9,role:'GURU'}),'ForbiddenException');await rejects(f.service.findAll({}),'ForbiddenException');
});
test('Siswa tidak dapat mengajukan atas nama NISN lain',async()=>{
 const f=fixture();await rejects(f.service.create(payload,other),'ForbiddenException');assert.equal(f.rows.length,1);
});
test('Metadata keputusan palsu pada pengajuan baru diabaikan',async()=>{
 const f=fixture();const result=await f.service.create({...payload,status_validasi:'Disetujui',validated_by:'Palsu',catatan_validator:'Palsu'},student);
 assert.equal(result.data.status_validasi,'Menunggu');assert.equal(result.data.validated_by,null);assert.equal(result.data.catatan_validator,null);
});
test('Siswa tidak dapat memvalidasi sendiri maupun mengubah isi',async()=>{
 const f=fixture();await rejects(f.service.update(id,{status_validasi:'Disetujui'},student),'ForbiddenException');await rejects(f.service.update(id,{nama_lomba:'Baru'},student),'ForbiddenException');
});
test('URL skrip dan lampiran orang lain tidak diterima',async()=>{
 const f=fixture();await rejects(f.service.create({...payload,bukti_sertifikat:'javascript:alert(1)'},student),'BadRequestException');f.files[0].folder='owner:other:prestasi';await rejects(f.service.create(payload,student),'ForbiddenException');
});
test('Format dan ukuran lampiran harus sesuai sertifikat',async()=>{
 for(const changed of [{file_name:'payload.html'},{size_bytes:11*1024*1024},{size_bytes:0}]){const f=fixture();Object.assign(f.files[0],changed);await rejects(f.service.create(payload,student),'BadRequestException');}
});
test('Tanggal, enum, teks kosong dan ID salah menghasilkan kesalahan validasi',async()=>{
 for(const changed of [{tanggal_pelaksanaan:'2026-02-30'},{tanggal_pelaksanaan:'invalid'},{kategori:'Palsu'},{tingkat:'Palsu'},{nama_lomba:' '},{nama_lomba:'a'.repeat(256)}])await rejects(fixture().service.create({...payload,...changed},student),'BadRequestException');
 await rejects(fixture().service.findOne('invalid',validator),'BadRequestException');
});
test('Keputusan harus valid dan penolakan memerlukan alasan',async()=>{
 for(const status of ['Palsu','Menunggu','Ditolak'])await rejects(fixture().service.update(id,{status_validasi:status,expected_updated_at:stamp},validator),'BadRequestException');
});
test('Identitas validator berasal dari sesi dan persetujuan bersifat final',async()=>{
 const f=fixture();const approved=await f.service.update(id,{status_validasi:'Disetujui',expected_updated_at:stamp,validated_by:'Palsu'},validator);
 assert.equal(approved.data.validated_by,'Validator');await rejects(f.service.update(id,{nama_lomba:'Baru'},validator),'ConflictException');
});
test('Data yang berubah setelah dibuka tidak dapat divalidasi dari tampilan lama',async()=>{
 const f=fixture({updated_at:new Date('2026-10-12T01:00:00Z')});await rejects(f.service.update(id,{status_validasi:'Disetujui',expected_updated_at:stamp},validator),'ConflictException');assert.equal(f.rows[0].status_validasi,'Menunggu');
});
test('Dua keputusan bersamaan hanya menyimpan satu keputusan',async()=>{
 const f=fixture();const results=await Promise.allSettled(['Disetujui','Ditolak'].map(status=>f.service.update(id,{status_validasi:status,catatan_validator:'uji',expected_updated_at:stamp},validator)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.name,'ConflictException');
});
test('Perubahan isi yang ditolak menghapus metadata keputusan lama',async()=>{
 const f=fixture({status_validasi:'Ditolak',validated_by:'Lama',catatan_validator:'Lama'});const result=await f.service.update(id,{nama_lomba:'Baru'},validator);assert.equal(result.data.status_validasi,'Menunggu');assert.equal(result.data.validated_by,null);assert.equal(result.data.catatan_validator,null);
});
test('Hapus siswa dibatasi kepemilikan dan status secara atomik',async()=>{
 const f=fixture();await rejects(f.service.delete(id,other),'ConflictException');f.rows[0].status_validasi='Disetujui';await rejects(f.service.delete(id,student),'ConflictException');assert.equal(f.rows.length,1);
 f.rows[0].status_validasi='Ditolak';await f.service.delete(id,student);assert.equal(f.rows.length,0);
});
test('ADMINISTRATOR dikenali dan validator dapat menghapus koreksi data',async()=>{
 const f=fixture({status_validasi:'Disetujui'});const admin={id:3,role:'ADMINISTRATOR'};assert.equal((await f.service.findAll({},admin)).data.length,1);await f.service.delete(id,admin);assert.equal(f.rows.length,0);
});
test('Daftar dibatasi per halaman dan filter tidak sah ditolak',async()=>{
 const f=fixture();f.replace(Array.from({length:3},(_,i)=>({...f.rows[0],id:String(i)})));const first=await f.service.findAll({limit:2,page:1},validator);assert.equal(first.data.length,2);assert.equal(first.has_more,true);
 assert.equal((await f.service.findAll({limit:2,page:2},validator)).data.length,1);
 for(const query of [{limit:501},{page:-1},{page:1.5},{status_validasi:'Palsu'}])await rejects(f.service.findAll(query,validator),'BadRequestException');
});
test('Unggahan menolak berkas palsu, SVG, ukuran berlebih dan menerima signature sah',async()=>{
 const module={exports:{}};vm.runInNewContext(compile(fs.readFileSync('apps/web/lib/prestasi-upload.ts','utf8')),{module,exports:module.exports,Uint8Array,TextDecoder});const validate=module.exports.validatePrestasiUpload;
 for(const [name,bytes] of [['cert.pdf','%PDF-1.7'],['cert.png',Uint8Array.from([137,80,78,71,13,10,26,10])],['cert.jpg',Uint8Array.from([255,216,255,224])]])assert.equal(await validate(new File([bytes],name)),true);
 for(const [name,bytes] of [['cert.pdf','<html>'],['cert.svg','<svg>'],['cert.png','text'],['cert.pdf','']])assert.equal(await validate(new File([bytes],name)),false);
 assert.equal(await validate({size:11*1024*1024,name:'cert.pdf'}),false);
});
