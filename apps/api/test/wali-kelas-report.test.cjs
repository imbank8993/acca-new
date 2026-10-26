const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const box={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/wali-kelas/wali-kelas.service.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText,{module:box,exports:box.exports,Date,require:n=>n==='@nestjs/common'?require(n):{}});const{WaliKelasService}=box.exports;
function fixture(){const calls=[];const service=new WaliKelasService({
 wali_kelas:{findFirst:async({where})=>where.nip==='wali'&&where.nama_kelas==='X A'&&where.tahun_ajaran==='2026/2027'?{id:1}:null},
 siswa_kelas:{findMany:async args=>{calls.push(['roster',args]);return[{nisn:'001',nama_siswa:'Siswa A'},{nisn:'001',nama_siswa:'Siswa A'},{nisn:'002',nama_siswa:'Siswa B'}];}},
 log_kokurikuler_siswa:{findMany:async args=>{calls.push(['logs',args]);return[{nisn:'001',tanggal:new Date('2026-10-01'),nama_kegiatan:'Literasi',status:'Disetujui',catatan:'Baik',is_custom:false}];}},
 });return{service,calls};}
const query={kelas:'X A',tahun_ajaran:'2026/2027',bulan:'2026-10'};
test('monthly cocurricular report requires exact class/year homeroom assignment',async()=>{
 const{service,calls}=fixture();for(const user of [{nip:'other',roles:['GURU']},{nip:'',roles:['GURU']}])await assert.rejects(service.getKokurikulerReport(query,user),e=>e.getStatus()===403);
 await assert.rejects(service.getKokurikulerReport({...query,kelas:'X B'},{nip:'wali',roles:['GURU']}),e=>e.getStatus()===403);assert.equal(calls.length,0);
});
test('invalid and out-of-school-year months are rejected before data queries',async()=>{
 const{service,calls}=fixture();for(const params of [{bulan:'2026-13'},{bulan:'2027-10'},{tahun_ajaran:'2026/2028'},{bulan:['2026-10']},{kelas:''}])await assert.rejects(service.getKokurikulerReport({...query,...params},{nip:'wali',roles:['GURU']}),e=>e.getStatus()===400);assert.equal(calls.length,0);
});
test('monthly report selects assigned semester, inclusive/exclusive month boundaries and minimal log fields',async()=>{
 const{service,calls}=fixture();const result=await service.getKokurikulerReport(query,{nip:'wali',roles:['GURU']});assert.equal(result.data.length,2);assert.equal(result.data[0].kegiatan[0].tanggal,'2026-10-01');assert.equal(result.data[1].kegiatan.length,0);
 assert.equal(calls[0][1].where.semester,'Ganjil');assert.equal(calls[0][1].where.tahun_ajaran,'2026/2027');const where=calls[1][1].where;
 assert.deepEqual(Array.from(where.nisn.in),['001','002']);assert.equal(where.tanggal.gte.toISOString(),'2026-10-01T00:00:00.000Z');assert.equal(where.tanggal.lt.toISOString(),'2026-11-01T00:00:00.000Z');assert(!calls[1][1].select.verifier_nip);
});
test('admin export and second-semester months remain supported',async()=>{const{service,calls}=fixture();await service.getKokurikulerReport({...query,bulan:'2027-01'},{roles:['ADMIN']});assert.equal(calls[0][1].where.semester,'Genap');});
