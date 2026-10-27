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

test('deployment migration creates notes table idempotently before app startup',async()=>{
 const db=new PGlite();try{await db.exec('CREATE TABLE public.users (id bigint primary key);');const sql=fs.readFileSync('apps/api/prisma/sql/20261027_create_catatan_pribadi.sql','utf8');await db.exec(sql);await db.exec(sql);const listSql=fs.readFileSync('apps/api/prisma/sql/20261027_catatan_list.sql','utf8');await db.exec(listSql);await db.exec(listSql);await db.exec("INSERT INTO public.users VALUES (1);INSERT INTO public.catatan_pribadi(user_id,jenis) VALUES (1,'list');");const result=await db.query("SELECT to_regclass('public.catatan_pribadi') as name");assert.equal(result.rows[0].name,'catatan_pribadi');const deploy=fs.readFileSync('.github/workflows/deploy.yml','utf8');assert(deploy.indexOf('20261027_create_catatan_pribadi.sql')<deploy.indexOf('docker compose up -d'));}finally{await db.close();}
});

test('custom note colors accept strict HEX, preserve legacy colors and reject invalid values',async()=>{
 const service=new box.exports.CatatanPribadiService({catatan_pribadi:{create:async({data})=>({id:1n,...data})}});
 assert.equal((await service.create(1n,{warna:'#A1b2C3'})).warna,'#a1b2c3');
 assert.equal((await service.create(1n,{warna:'blue'})).warna,'blue');
 assert.equal((await service.create(1n,{warna:'default'})).warna,'default');
 for(const warna of ['#fff','#12345678','red;background:url(x)','rgb(0,0,0)',123])await assert.rejects(service.create(1n,{warna}));
});

test('calendar includes notes and lists, uses WITA creation date only when no explicit date',async()=>{
 let where;const service=new box.exports.CatatanPribadiService({catatan_pribadi:{findMany:async query=>{where=query.where;return[{id:1n,user_id:1n,jenis:'catatan',tanggal_agenda:null,created_at:new Date('2026-10-26T17:00:00Z')},{id:2n,user_id:1n,jenis:'list',tanggal_agenda:new Date('2026-10-25T00:00:00Z'),created_at:new Date('2026-10-20T00:00:00Z')}];}}});
 const result=await service.getKalender(1n,'2026-10');assert.equal(result[0].tanggal_agenda,'2026-10-27');assert.equal(result[1].tanggal_agenda,'2026-10-25');assert.equal(result[1].jenis,'list');assert.equal(where.user_id,1n);assert.equal(where.jenis,undefined);assert.equal(where.OR[1].tanggal_agenda,null);assert.equal(where.OR[1].created_at.gte.toISOString(),'2026-09-30T16:00:00.000Z');
});
