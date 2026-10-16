const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('apps/web/lib/bulk-data.ts','utf8');
const loaded={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:loaded,exports:loaded.exports,require:()=>({}),Date});
const {searchBulkData,replaceBulkData}=loaded.exports;
const col=(table,column,type='text',extra={})=>({table,column,type,primary:['id'],generated:false,primaryColumn:false,...extra});
const defaultColumns=[col('new_business_table','id','int8',{primaryColumn:true}),col('new_business_table','alamat'),col('new_business_table','jumlah','numeric'),col('new_business_table','config','jsonb'),col('new_business_table','status','bool'),col('users','password_hash'),col('users','role'),col('new_business_table','computed','text',{generated:true}),col('audit_logs','details','jsonb')];
const item=(column='alamat',oldJson='"Lama"',newValue='Baru',table='new_business_table',rowId='{"id":9007199254740993123}')=>({table,column,oldJson,newValue,rowId,tableKey:'__primary_key__'});
function fixture(columns=defaultColumns,{failureAt=0,oldJson='"Lama"'}={}){
 let writes=[],committed=[],queries=[],audits=[];
 const tx={
  async $queryRawUnsafe(sql,...params){queries.push({sql,params});if(sql.includes('FROM pg_class'))return columns;if(sql.includes('CROSS JOIN LATERAL'))return [{column:'alamat',oldValue:'Lama',oldJson:'"Lama"',rowId:'{"id":9007199254740993123}',rowLabel:'Data contoh'}];return [{oldJson}];},
  async $executeRawUnsafe(sql,...params){if(sql.startsWith('SET LOCAL'))return 0;writes.push({sql,params});if(failureAt&&writes.length===failureAt)throw Error('Injected update failure');return 1;},
  audit_logs:{async create(data){audits.push(data);}},
 };
 const db={...tx,async $transaction(work){writes=[];try{const result=await work(tx);committed=[...writes];return result;}catch(error){writes=[];throw error;}}};
 return{db,queries,audits,get writes(){return writes},get committed(){return committed}};
}

test('Schema discovery includes unlisted business tables and all supported column types',async()=>{
 const f=fixture();const result=await searchBulkData('Lama',false,f.db);
 assert.equal(result.tablesAvailable,1);assert.equal(result.columnsAvailable,4);
 const sql=f.queries.find(q=>q.sql.includes('CROSS JOIN LATERAL')).sql;
 for(const key of ['alamat','jumlah','config','status'])assert(sql.includes(`t."${key}"`));
 for(const key of ['password_hash','computed'])assert(!sql.includes(key));
 assert(result.results[0].id.includes('alamat'));
});
test('Passwords, generated fields, primary keys and access/audit configuration cannot be changed',async()=>{
 for(const row of [item('password_hash','"Lama"','new','users'),item('computed'),item('id'),item('details','{}','{}','audit_logs')]){
  const f=fixture();await assert.rejects(replaceBulkData([row],true,f.db),e=>e.status===403);assert.equal(f.committed.length,0);
 }
});
test('Operators cannot change account roles; administrators can',async()=>{
 const f=fixture();await assert.rejects(replaceBulkData([item('role','"Lama"','ADMIN','users')],false,f.db),e=>e.status===403);
 assert((await replaceBulkData([item('role','"Lama"','ADMIN','users')],true,f.db)).ok);
});
test('Identifiers must exist in metadata; values remain SQL parameters',async()=>{
 const f=fixture();await assert.rejects(replaceBulkData([item('alamat"; DROP TABLE users;--')],true,f.db),e=>e.status===403);
 const injection="x'; DROP TABLE users; --";
 await replaceBulkData([item('alamat','"Lama"',injection)],true,f.db);
 assert(!f.writes[0].sql.includes(injection));assert(f.writes[0].params[1].includes(injection));
});
test('Real BIGINT primary key JSON is preserved without rounding',async()=>{
 const f=fixture();await replaceBulkData([item()],true,f.db);
 assert.equal(f.queries.find(q=>q.sql.includes('FOR UPDATE')).params[0],'{"id":9007199254740993123}');
 assert.equal(f.writes[0].params[0],'{"id":9007199254740993123}');
});
test('Composite keys are supported and incomplete or forged keys are rejected',async()=>{
 const f=fixture([col('new_business_table','alamat','text',{primary:['a','b']})]);
 await replaceBulkData([item('alamat','"Lama"','New','new_business_table','{"a":"01","b":"02"}')],true,f.db);
 assert(f.writes[0].sql.includes('t."a"'));assert(f.writes[0].sql.includes('t."b"'));
 await assert.rejects(replaceBulkData([item()],true,f.db),e=>e.status===400);
});
test('Stale preview does not write any selected cells',async()=>{
 const f=fixture(defaultColumns,{oldJson:'"Changed"'});
 await assert.rejects(replaceBulkData([item()],true,f.db),e=>e.status===409);assert.equal(f.committed.length,0);
});
test('Any failed update rolls back the entire selection',async()=>{
 const f=fixture(defaultColumns,{failureAt:2});
 await assert.rejects(replaceBulkData([item(),item('jumlah','"Lama"','10')],true,f.db));assert.equal(f.committed.length,0);
});
test('Numbers preserve precision, JSON is typed, and null/empty text are supported',async()=>{
 for(const [column,value,expected] of [['jumlah','99999999999999999999.1234','99999999999999999999.1234'],['config','{"enabled":true}',{enabled:true}],['alamat','null',null],['alamat','""','']]){
  const f=fixture();await replaceBulkData([item(column,'"Lama"',value)],true,f.db);
  assert.deepEqual(JSON.parse(f.writes[0].params[1])[column],expected);
 }
 await assert.rejects(replaceBulkData([item('config','"Lama"','not json')],true,fixture().db),e=>e.status===400);
});
test('Duplicate selections and over-limit/empty requests are rejected',async()=>{
 for(const rows of [[],[item(),item()],Array.from({length:1001},(_,i)=>item('alamat','"Lama"','New','new_business_table',`{"id":${i}}`))])await assert.rejects(replaceBulkData(rows,true,fixture().db),e=>e.status===400);
});
test('NISN changes discover reference columns and update linked user identity',async()=>{
 const f=fixture([col('master_siswa','nisn'),col('new_student_relation','nisn_siswa'),col('users','nip'),col('users','username')],{oldJson:'"00123"'});
 await replaceBulkData([item('nisn','"00123"','00456','master_siswa','{"id":1}')],true,f.db);
 assert(f.writes.some(w=>w.sql.includes('UPDATE "public"."new_student_relation"')));
 assert(f.writes.some(w=>w.sql.includes('UPDATE public.users')&&w.params[0]==='00456'&&w.params[1]==='00123'));
});
test('Changes are audited without storing replacement values',async()=>{
 const f=fixture();await replaceBulkData([item()],true,f.db,{authId:'1',nip:'admin',nama:'Admin',roles:['ADMIN']});
 assert.equal(f.audits[0].data.action,'BULK_REPLACE');assert(!JSON.stringify(f.audits).includes('Baru'));
});
test('Large numbers inside JSON remain exact in the database parameter',async()=>{
 const f=fixture();await replaceBulkData([item('config','"Lama"','{"number":9007199254740993123}')],true,f.db);
 assert(f.writes[0].params[1].includes('9007199254740993123'));
});
test('Empty and contradictory identity replacements are rejected before writes',async()=>{
 for(const value of ['null','""',''])await assert.rejects(replaceBulkData([item('nisn','"00123"',value,'master_siswa')],true,fixture().db),e=>e.status===400);
 await assert.rejects(replaceBulkData([item('nisn','"00123"','00456','master_siswa'),item('nisn','"00456"','00789','master_siswa','{"id":2}')],true,fixture().db),e=>e.status===400);
});
