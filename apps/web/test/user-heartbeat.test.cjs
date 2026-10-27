const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(getUser=async()=>({id:1})) {
 const calls=[],effects=[],win=new Map(),dom=new Map();let timer,loggingOut=false;
 const events=map=>({addEventListener:(name,fn)=>map.set(name,fn),removeEventListener:(name)=>map.delete(name)});
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('apps/web/components/UserHeartbeat.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,require:n=>n==='react'?{useEffect:fn=>effects.push(fn),useRef:value=>({current:value})}:n==='next/navigation'?{usePathname:()=>'/dashboard',useSearchParams:()=>new URLSearchParams()}:n.includes('auth-client')?{getCurrentUser:getUser}:{isLogoutInProgress:()=>loggingOut},
 crypto:{randomUUID:()=> 'tab-1'},navigator:{sendBeacon:(url,body)=>{calls.push({url,body,beacon:true});return true;}},Blob,AbortSignal,
 fetch:async(url,options)=>{calls.push({url,...options});return{ok:true};},setInterval:(fn,ms)=>{assert.equal(ms,15000);timer=fn;return 1;},clearInterval:()=>{},window:events(win),document:{...events(dom),visibilityState:'visible'}});
 module.exports.default();const cleanup=effects[0]();effects[1]();
 return{calls,cleanup,fire:(name,event)=>win.get(name)?.(event),timer:()=>timer(),logout:()=>{loggingOut=true;win.get('acca:logout-start')?.();}};
}
async function bodies(calls){return Promise.all(calls.map(async c=>JSON.parse(c.beacon?await c.body.text():c.body)));}
test('browser close sends offline beacon and stops later heartbeats; bfcache restore reconnects',async()=>{
 const f=fixture();await flush();f.fire('pagehide');await f.timer();await flush();
 let data=await bodies(f.calls);assert.deepEqual(data.map(d=>d.online),[true,false]);assert(data[1].sequence>data[0].sequence);
 f.fire('pageshow');await flush();data=await bodies(f.calls);assert.equal(data.at(-1).online,true);assert(data.at(-1).sequence>data[1].sequence);f.cleanup();
});
test('logout sends offline and pending auth checks cannot resurrect connection',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));f.logout();resolve({id:1});await flush();assert.equal(f.calls.length,0);f.cleanup();
});
test('authenticated logout and network loss send offline without waiting for expiry',async()=>{
 const f=fixture();await flush();f.fire('offline');let data=await bodies(f.calls);assert.equal(data.at(-1).online,false);
 f.fire('online');await flush();f.logout();await f.timer();data=await bodies(f.calls);assert.deepEqual(data.map(d=>d.online),[true,false,true,false]);f.cleanup();
});
