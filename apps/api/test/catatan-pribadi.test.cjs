const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const box={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/catatan-pribadi/catatan-pribadi.service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{module:box,exports:box.exports,require:n=>n==='@nestjs/common'?{Injectable:()=>x=>x,Logger:class{},BadRequestException:Error,NotFoundException:Error,ForbiddenException:Error,ConflictException:class extends Error{constructor(data){super(data.message);this.data=data;}}}:n==='sanitize-html'?require(n):{}});
test('atomic note updates reject a concurrent stale version and isolate ownership',async()=>{
 const db=new PGlite();try{
 await db.exec("CREATE TABLE notes (id bigint primary key, user_id bigint, version int, judul text, updated_at timestamptz);INSERT INTO notes VALUES (1,1,1,'awal',now());");
 const model=client=>({findUnique:async()=>{const r=(await client.query('SELECT * FROM notes WHERE id=1')).rows[0];return r?{...r,id:BigInt(r.id),user_id:BigInt(r.user_id)}:null;},findFirst:async()=>model(client).findUnique(),updateMany:async({where,data})=>({count:(await client.query('UPDATE notes SET judul=$1,version=$2,updated_at=now() WHERE id=$3 AND user_id=$4 AND version=$5 RETURNING id',[data.judul,data.version,String(where.id),String(where.user_id),where.version])).rows.length})});
 const service=new box.exports.CatatanPribadiService({catatan_pribadi:model(db),$transaction:fn=>db.transaction(tx=>fn({catatan_pribadi:model(tx)}))});
 const results=await Promise.allSettled([service.update(1n,'1',{version:1,judul:'tab A'}),service.update(1n,'1',{version:1,judul:'tab B'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const failed=results.find(r=>r.status==='rejected').reason;assert.equal(failed.data.serverData.version,2);
 await assert.rejects(service.update(2n,'1',{version:2,judul:'akun lain'}));
 await assert.rejects(service.update(1n,'1',{judul:'tanpa versi'}));
 const row=(await db.query('SELECT * FROM notes')).rows[0];assert.equal(row.version,2);
 }finally{await db.close();}
});
