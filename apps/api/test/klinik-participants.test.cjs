const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/klinik/klinik.service.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText, {
 module:mod,exports:mod.exports,URLSearchParams,Date,console,
 require(name) { if(name==='@nestjs/common')return require(name); if(name==='../access/access.service')return {can:user=>!!user.manage}; return {}; }
});
function fixture({actor=9,manage=true,status='full',initiator=null,attendance=false,assigned=false,missing=false,deleteError=false}={}) {
 const rows=[{id:'p1',siswa_id:1,status:assigned?'ditugaskan':'registered',kehadiran:null},{id:'p2',siswa_id:2,status:'registered',kehadiran:attendance?'H':null},{id:'p3',siswa_id:3,status:'registered',kehadiran:null}];
 const slot={max_siswa:3,status,guru_id:9,initiator_type:initiator?'SISWA':'GURU',initiator_siswa_id:initiator};const deletions=[];
 const db={from(table){let filters=[],mode='select',value,head=false; const q={select(_cols,opts){head=opts?.head;return q},eq(key,val){filters.push(r=>r[key]===val);return q},in(key,vals){filters.push(r=>vals.includes(r[key]));return q},delete(){mode='delete';return q},update(v){mode='update';value=v;return q},maybeSingle(){return Promise.resolve(result(true))},then(resolve,reject){return Promise.resolve(result(false)).then(resolve,reject)}};
 function result(single){if(table==='users')return {data:{id:actor,nama:'User'}};if(table==='klinik_slots'){if(mode==='update')Object.assign(slot,value);return {data:single?slot:[slot]};}
 const found=rows.filter(r=>filters.every(f=>f({...r,slot_id:'s1'}))).filter(r=>!missing||r.siswa_id!==2);
 if(mode==='delete'){if(deleteError)return {error:new Error('Database gagal')};deletions.push(found.map(r=>r.siswa_id));for(const r of found)rows.splice(rows.indexOf(r),1);}
 return {data:head?null:found,count:rows.length};}return q;}};
 return {rows,slot,deletions,run(payload={siswa_ids:[1,2]}){return mod.exports.handlePost({user:{authId:'auth',roles:manage?['ADMIN']:['SISWA'],manage}},'cancel_registration',{slot_id:'s1',...payload},db)}};
}
test('bulk removes exactly selected participants and reopens full slot',async()=>{const f=fixture();const r=await f.run();assert.equal(r.ok,true);assert.deepEqual(f.deletions,[[1,2]]);assert.equal(f.rows.length,1);assert.equal(f.slot.status,'open');});
test('legacy single deletion remains supported and duplicate ids are deduplicated',async()=>{let f=fixture();await f.run({siswa_id:1});assert.deepEqual(f.deletions,[[1]]);f=fixture();await f.run({siswa_ids:[1,1,2]});assert.deepEqual(f.deletions,[[1,2]]);});
for(const [label,options] of [['attendance',{attendance:true}],['initiator',{initiator:1}],['missing participant',{missing:true}],['paid',{status:'paid'}],['cancelled',{status:'cancelled'}],['student bulk access',{actor:1,manage:false}],['different student',{actor:4,manage:false}]])test('rejects '+label+' before deleting any participant',async()=>{const f=fixture(options);await assert.rejects(f.run());assert.equal(f.deletions.length,0);assert.equal(f.rows.length,3);});
test('student may cancel self but cannot cancel assigned participation',async()=>{const f=fixture({actor:1,manage:false});await f.run({siswa_id:1});assert.deepEqual(f.deletions,[[1]]);const g=fixture({actor:1,manage:false,assigned:true});await assert.rejects(g.run({siswa_id:1}));assert.equal(g.deletions.length,0);});
test('invalid selection and database errors are reported',async()=>{for(const ids of [[],[0],[null],['invalid'],[1.5]]){const f=fixture();await assert.rejects(f.run({siswa_ids:ids}));assert.equal(f.deletions.length,0);}const f=fixture({deleteError:true});await assert.rejects(f.run());assert.equal(f.rows.length,3);});
