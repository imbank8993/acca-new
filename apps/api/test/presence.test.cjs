const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const box={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/presence/presence.service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{module:box,exports:box.exports,require:n=>n==='@nestjs/common'?{Injectable:()=>x=>x}:require(n)});
const {PresenceService,PRESENCE_TTL_MS}=box.exports;
test('closing the final tab immediately removes online status without erasing last activity',()=>{
 const s=new PresenceService();s.update('1','session','a',1,true,100);assert(s.onlineUsers(101).has('1'));
 s.update('1','session','a',2,false,102);assert(!s.onlineUsers(103).has('1'));
});
test('closing one tab keeps another tab or device online',()=>{
 const s=new PresenceService();s.update('1','session','a',1,true,100);s.update('1','session','b',1,true,100);s.update('1','other','c',1,true,100);
 s.update('1','session','a',2,false,101);assert(s.onlineUsers(102).has('1'));
 s.logout('1','session',103);assert(s.onlineUsers(104).has('1'));
 s.logout('1','other',105);assert(!s.onlineUsers(106).has('1'));
});
test('crashed browsers expire at the lease boundary even without a close event',()=>{
 const s=new PresenceService();s.update('1','s','a',1,true,100);
 assert(s.onlineUsers(99+PRESENCE_TTL_MS).has('1'));assert(!s.onlineUsers(100+PRESENCE_TTL_MS).has('1'));
});
test('delayed heartbeat cannot resurrect a closed tab or logged out session',()=>{
 const s=new PresenceService();s.update('1','s','a',2,false,100);s.update('1','s','a',1,true,101);assert(!s.onlineUsers(102).has('1'));
 s.update('1','s','a',3,true,103);assert(s.onlineUsers(104).has('1'));
 s.logout('1','s',105);s.update('1','s','a',4,true,106);assert(!s.onlineUsers(107).has('1'));
});
test('restart never treats a historical last_seen as a live connection',()=>{assert.equal(new PresenceService().onlineUsers().size,0);});

test('monitoring uses live connections instead of recent last_seen', async()=>{
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/monitoring/monitoring.service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{module:m,exports:m.exports,require:n=>n==='@nestjs/common'?{Injectable:()=>x=>x,Logger:class{error(){}warn(){}}}:{}});
 const presence=new PresenceService();
 const service=new m.exports.MonitoringService({public_users:{findMany:async()=>[{id:1n,role:'GURU',last_seen:new Date(),nama:'Guru'}]}},presence);
 assert.equal((await service.getUsers())[0].is_online,false);
 presence.update('1','s','a',1,true);
 assert.equal((await service.getUsers())[0].is_online,true);
 presence.logout('1','s');assert.equal((await service.getUsers())[0].is_online,false);
});
