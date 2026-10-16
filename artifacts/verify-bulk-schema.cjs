// Read-only SQL planning against the configured PostgreSQL database.
// EXPLAIN (without ANALYZE) plans SELECTs; no records are read or changed.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require('dotenv').config({path:'apps/api/.env',quiet:true});
const {Client}=require('pg');
(async()=>{
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/lib/bulk-data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:()=>({})});
 const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});let planned=0;
 try{
  await c.connect();await c.query('BEGIN READ ONLY');await c.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='5s'");
  const db={async $queryRawUnsafe(sql,...params){
   if(sql.includes('FROM pg_class'))return(await c.query(sql,params)).rows;
   await c.query('EXPLAIN '+sql,params);planned++;return[];
  }};
  const result=await module.exports.searchBulkData('__bulk_schema_check_no_data__',true,db);
  await c.query('ROLLBACK');
  console.log(JSON.stringify({readOnly:true,plannedTables:planned,availableColumns:result.columnsAvailable,excludedColumns:result.protectedColumns}));
 }finally{await c.end();}
})().catch(error=>{console.error('Read-only planning failed',error.code||error.name,error.position||'');process.exitCode=1;});
