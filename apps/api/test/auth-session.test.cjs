const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const quiet={warn(){},debug(){},error(){}};const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function moduleOf(file,imports={},globals={}){const m={exports:{}};vm.runInNewContext(compile(fs.readFileSync(file,'utf8')),{module:m,exports:m.exports,console:quiet,Date,Buffer,TextEncoder,process:{env:{}},require:n=>imports[n]||{},...globals});return m.exports}
const jwt=moduleOf('apps/web/lib/app-jwt.ts');
function route(status=200,body={user:{id:'547'}},throwing=false){let used;const module=moduleOf('apps/web/app/api/auth/me/route.ts',{'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers||{}})}},'@/lib/app-jwt':jwt,'@/lib/nest-api':{nestFetchAsUser:async(_path,token)=>{used=token;if(throwing)throw Error('network');return{status,body}}},'@/lib/auth':{buildUserObject:async user=>user}});return{module,get used(){return used}}}
const request=(cookie,header)=>({cookies:{get:()=>cookie?{value:'base64-'+Buffer.from(cookie).toString('base64url')}:undefined},headers:new Headers(header?{authorization:'Bearer '+header}:{})});
test('auth/me prefers current login cookie over stale Authorization header',async()=>{const r=route();const res=await r.module.GET(request('fresh-cookie','old-supabase'));assert.equal(res.status,200);assert.equal(r.used,'fresh-cookie');assert.equal(res.body.user.id,'547')});
test('missing or expired sessions retain 401',async()=>{assert.equal((await route().module.GET(request())).status,401);assert.equal((await route(401,{}).module.GET(request('expired'))).status,401)});
test('backend failures, network errors and malformed responses do not impersonate logout',async()=>{for(const r of[route(500,{}),route(503,{}),route(200,{}),route(200,{},true)]){const res=await r.module.GET(request('cookie'));assert.equal(res.status,503);assert.match(res.headers['Cache-Control'],/no-store/)}assert.equal((await route(403,{}).module.GET(request('cookie'))).status,403)});
function client(fetch,storage){return moduleOf('apps/web/lib/auth-client.ts',{}, {fetch,AbortSignal,setTimeout:callback=>{callback();return 0},window:{},sessionStorage:storage||{getItem:()=>null,setItem(){},removeItem(){}}})}
test('strict client rejects temporary API and network failures for retry; legacy callers remain compatible',async()=>{const c=client(async()=>({ok:false,status:503}));await assert.rejects(c.getCurrentUser({throwOnFailure:true}));assert.equal(await c.getCurrentUser(),null);await assert.rejects(client(async()=>{throw Error('offline')}).getCurrentUser({throwOnFailure:true}))});
test('strict client returns null only for actual unauthenticated response',async()=>{assert.equal(await client(async()=>({ok:false,status:401})).getCurrentUser({throwOnFailure:true}),null);await assert.rejects(client(async()=>({ok:true,status:200,json:async()=>({ok:false})})).getCurrentUser({throwOnFailure:true}))});
test('blocked browser storage does not reject a successfully loaded user',async()=>{const storage={getItem(){throw Error('Storage blocked')},setItem(){throw Error('Storage blocked')},removeItem(){throw Error('Storage blocked')}};const c=client(async()=>({ok:true,status:200,json:async()=>({ok:true,user:{id:'547'}})}),storage);assert.equal((await c.getCurrentUser({throwOnFailure:true})).id,'547')});
test('temporary session failures recover automatically without page refresh',async()=>{let calls=0;const c=client(async(_url,init)=>{assert.equal(init.cache,'no-store');assert(init.signal);calls++;if(calls===1)throw new TypeError('Failed to fetch');if(calls===2)return{ok:false,status:503};return{ok:true,status:200,json:async()=>({ok:true,user:{id:'547'}})}});assert.equal((await c.getCurrentUser({throwOnFailure:true})).id,'547');assert.equal(calls,3)});
test('session retry is bounded and never retries unauthenticated or forbidden responses',async()=>{for(const status of[401,403,429,503]){let calls=0;const c=client(async()=>{calls++;return{ok:false,status}});if(status===401)assert.equal(await c.getCurrentUser({throwOnFailure:true}),null);else await assert.rejects(c.getCurrentUser({throwOnFailure:true}));assert.equal(calls,status===401||status===403?1:3)}});
const layout='apps/web/app/(dashboard)/layout.tsx',ast=ts.createSourceFile(layout,fs.readFileSync(layout,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='checkAuth')callback=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,walk)}walk(ast);
function shell(getCurrentUser,storage){let error='',user=null,loading=true;const redirects=[],m={exports:{}};vm.runInNewContext(compile('module.exports='+callback),{module:m,exports:m.exports,console:quiet,Date,getCurrentUser,sessionStorage:storage||{getItem:()=>null,setItem(){}},fetch:async()=>({}),router:{push:path=>redirects.push(path)},setUser:value=>user=value,setLoading:value=>loading=value,setAuthError:value=>error=value});return{check:m.exports,get redirects(){return redirects},get error(){return error},get user(){return user},get loading(){return loading}}}
test('dashboard opens valid profile even when login-log storage throws',async()=>{const s=shell(async()=>({id:'547',role:'SISWA'}),{getItem(){throw Error('Storage denied')}});await s.check();assert.equal(s.user.id,'547');assert.equal(s.redirects.length,0);assert.equal(s.loading,false)});
test('dashboard keeps temporary session failure on retry screen, while true 401 redirects',async()=>{const s=shell(async()=>{throw Error('API offline')});await s.check();assert.equal(s.redirects.length,0);assert(s.error);assert.equal(s.loading,false);const expired=shell(async()=>null);await expired.check();assert.deepEqual(expired.redirects,['/login'])});

const homeFile='apps/web/app/page.tsx',homeAst=ts.createSourceFile(homeFile,fs.readFileSync(homeFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let homeEffect;
function findHomeEffect(n){if(ts.isCallExpression(n)&&n.expression.getText(homeAst)==='useEffect')homeEffect=n.arguments[0].getText(homeAst);ts.forEachChild(n,findHomeEffect)}findHomeEffect(homeAst);
// Execute the complete effect: lifecycle variables must be declared by production code.
function homeSession(getCurrentUser,active=true){let error='',login=false;const redirects=[],m={exports:{}};vm.runInNewContext(compile('module.exports='+homeEffect),{module:m,exports:m.exports,console:quiet,Error,getCurrentUser,searchParams:{get:()=>null},router:{replace:path=>redirects.push(path)},setShowLogin:value=>login=value,setAuthError:value=>error=value});return{async check(){const cleanup=m.exports();if(!active&&cleanup)cleanup();await new Promise(setImmediate)},get error(){return error},get login(){return login},redirects}}
test('home keeps temporary session failures on retry screen instead of showing login',async()=>{const s=homeSession(async options=>{assert.equal(options.throwOnFailure,true);throw Error('Backend unavailable')});await s.check();assert(s.error);assert.equal(s.login,false);assert.equal(s.redirects.length,0)});
test('home shows login only for a verified unauthenticated session and redirects a valid session',async()=>{const anonymous=homeSession(async()=>null);await anonymous.check();assert.equal(anonymous.login,true);assert.equal(anonymous.error,'');const valid=homeSession(async()=>({id:'547'}));await valid.check();assert.deepEqual(valid.redirects,['/dashboard'])});
test('unmounted home does not redirect or show login after session response arrives',async()=>{const s=homeSession(async()=>({id:'547'}),false);await s.check();assert.equal(s.login,false);assert.equal(s.redirects.length,0)});
test('session failure includes the HTTP status for diagnosis without clearing cached credentials',async()=>{let cleared=0;const c=client(async()=>({ok:false,status:503}),{getItem:()=>null,setItem(){},removeItem(){cleared++}});await assert.rejects(c.getCurrentUser({throwOnFailure:true}),err=>err.name==='SessionCheckError'&&err.status===503);assert.equal(cleared,0)});

test('Next auth helper checks revocation online and uses current server identity',async()=>{for(const status of [200,401,503]){let calls=0;const j=moduleOf('apps/web/lib/app-jwt.ts',{'jose':{jwtVerify:async()=>({payload:{sub:'3',authId:'auth-3',role:'ADMIN',username:'stale'}})},'./nest-api':{nestFetchAsUser:async()=>{calls++;return{status,body:{user:{id:'3',auth_id:'auth-3',role:'GURU',username:'current',email:null}}}}}});const result=await j.getAuthUserFromRequest(request('token'));assert.equal(calls,1);if(status===200){assert.equal(result.user_metadata.role,'GURU');assert.equal(result.user_metadata.username,'current')}else assert.equal(result,null)}});

test('password update forwards current password and removes the revoked browser cookie only on success',async()=>{for(const status of[200,401]){const removed=[];let sent;const r=moduleOf('apps/web/app/api/auth/update-password/route.ts',{'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,cookies:{set:(...args)=>removed.push(args)}})}},'@/lib/app-jwt':{extractRequestToken:()=> 'token'},'@/lib/nest-api':{nestFetchAsUser:async(_path,_token,init)=>{sent=JSON.parse(init.body);return{status,body:{}}}}});const result=await r.POST({json:async()=>({password:'new-password',oldPassword:'old-password'})});assert.equal(sent.oldPassword,'old-password');assert.equal(result.status,status);assert.equal(removed.length,status===200?1:0);if(status===200){assert.equal(removed[0][0],'acca_session');assert.equal(removed[0][2].maxAge,0)}}});

const errorHelper=moduleOf('apps/web/lib/auth-error-message.ts');
test('account error messages accept Nest error and validation arrays without exposing server internals',()=>{
  for(const key of ['error','message']) assert.equal(errorHelper.authErrorMessage({[key]:'Password saat ini tidak sesuai'},400,'fallback'),'Password saat ini tidak sesuai');
  assert.equal(errorHelper.authErrorMessage({error:['A','B']},400,'fallback'),'A. B');
  assert.equal(errorHelper.authErrorMessage({error:{secret:'internal'}},400,'fallback'),'fallback');
  assert.match(errorHelper.authErrorMessage({error:'SQL password=secret'},500,'fallback'),/Layanan akun/);
  assert.match(errorHelper.authErrorMessage({},401,'fallback'),/login kembali/);
});

function accountRoute(file,status,body){const removed=[],calls=[];const module=moduleOf(file,{
  'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,cookies:{set:(...args)=>removed.push(args)}})}},
  '@/lib/app-jwt':{extractRequestToken:()=> 'token'},'@/lib/auth-error-message':errorHelper,
  '@/lib/nest-api':{nestFetchAsUser:async(path,token,init)=>{calls.push({path,token,...init,body:JSON.parse(init.body)});return{status,body}}}
});return{module,removed,calls}}
test('profile proxy shows the actual backend validation reason',async()=>{
  const r=accountRoute('apps/web/app/api/user/profile/route.ts',400,{error:'Password saat ini tidak sesuai'});
  const result=await r.module.PUT({json:async()=>({password:'new-password',oldPassword:'wrong'})});
  assert.equal(result.status,400);assert.equal(result.body.error,'Password saat ini tidak sesuai');assert.equal(r.removed.length,0);
});
test('dedicated password proxy validates current password and forwards only credentials',async()=>{
  for(const status of [200,201,400,503]){
    const r=accountRoute('apps/web/app/api/auth/update-password/route.ts',status,{error:'Password saat ini tidak sesuai'});
    const result=await r.module.POST({json:async()=>({password:'chosen-password',oldPassword:'temporary-password',username:'ignored',email:'invalid'})});
    assert.equal(r.calls[0].path,'/users/me/password');assert.equal(r.calls[0].method,'POST');
    assert.deepEqual(Object.keys(r.calls[0].body).sort(),['oldPassword','password']);
    assert.equal(result.status,status===201?200:status);assert.equal(r.removed.length,status<300?1:0);
    if(status===400)assert.equal(result.body.error,'Password saat ini tidak sesuai');
    if(status===503)assert.match(result.body.error,/Layanan akun/);
  }
  for(const payload of [{password:'chosen-password'},{password:'short',oldPassword:'temporary-password'}]){
    const r=accountRoute('apps/web/app/api/auth/update-password/route.ts',200,{});
    assert.equal((await r.module.POST({json:async()=>payload})).status,400);assert.equal(r.calls.length,0);
  }
});

test('forced-change sessions redirect home and dashboard to the password form',async()=>{
  const user={id:'3',must_change_password:true};const h=homeSession(async()=>user);await h.check();assert.deepEqual(h.redirects,['/update-password']);
  const s=shell(async()=>user);await s.check();assert.deepEqual(s.redirects,['/update-password']);
});
test('JWT and online Next helpers reject business access for temporary sessions',async()=>{
  for(const forcedClaim of [true,false]){
    let checks=0;
    const j=moduleOf('apps/web/lib/app-jwt.ts',{'jose':{jwtVerify:async()=>({payload:{sub:'3',must_change_password:forcedClaim}})},'./nest-api':{nestFetchAsUser:async()=>{checks++;return{status:200,body:{user:{id:'3',must_change_password:true}}}}}});
    assert.equal(await j.verifyAppSession('token'),null);assert.equal(checks,forcedClaim?0:1);
    if(forcedClaim){assert.equal(await j.verifyAppToken('token'),null);assert.equal((await j.verifyAppToken('token',true)).sub,'3')}
  }
  const n=moduleOf('apps/web/lib/nest-api.ts',{}, {fetch:async()=>({ok:true,json:async()=>({user:{must_change_password:true}})})});
  assert.equal(await n.fetchMyAccess('token'),null);
});

function accountSubmit(formData,response={ok:true,status:200,json:async()=>({ok:true})}){
  const file='apps/web/app/profile/view.tsx',source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
  function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='handleSubmitAccount')callback=node.initializer.getText(source);ts.forEachChild(node,walk)}walk(source);
  const state={error:'',calls:[],refreshes:0,clears:0},location={href:''};const m={exports:{}};
  vm.runInNewContext(compile('module.exports='+callback),{module:m,exports:m.exports,formData,window:{location},JSON,fetch:async(url,init)=>{state.calls.push({url,...init,body:JSON.parse(init.body)});return response},setPwdError:v=>state.error=v,setLoading(){},setFormData(){},clearUserCache:()=>state.clears++,onRefreshUser:async()=>state.refreshes++,swalError:(_title,text)=>state.error=text,Swal:{fire:async()=>{}}});
  return{submit:()=>m.exports({preventDefault(){}}),state,location};
}
test('profile form saves password independently from invalid profile fields without a second logout request',async()=>{
  const f=accountSubmit({username:'',email:'invalid-email',photoUrl:'old',newPassword:'chosen-password',confirmPassword:'chosen-password',currentPassword:'temporary-password'});
  await f.submit();assert.equal(f.state.calls.length,1);assert.equal(f.state.calls[0].url,'/api/auth/update-password');assert.equal(f.state.calls[0].method,'POST');
  assert.deepEqual(Object.keys(f.state.calls[0].body).sort(),['oldPassword','password']);assert.equal(f.location.href,'/login');assert.equal(f.state.refreshes,0);assert.equal(f.state.clears,1);
});
test('profile form rejects missing/wrong current password and preserves ordinary profile saves',async()=>{
  const missing=accountSubmit({newPassword:'chosen-password',confirmPassword:'chosen-password',currentPassword:''});await missing.submit();assert.match(missing.state.error,/Password saat ini/);assert.equal(missing.state.calls.length,0);
  const wrong=accountSubmit({newPassword:'chosen-password',confirmPassword:'chosen-password',currentPassword:'wrong-password'},{ok:false,status:400,json:async()=>({ok:false,error:'Password saat ini tidak sesuai'})});await wrong.submit();assert.match(wrong.state.error,/tidak sesuai/);assert.equal(wrong.location.href,'');
  const normal=accountSubmit({username:'guru',email:'guru@example.com',photoUrl:'photo'});await normal.submit();assert.equal(normal.state.calls[0].url,'/api/user/profile');assert.equal(normal.state.calls[0].method,'PUT');assert.equal(normal.state.refreshes,1);assert.equal(normal.location.href,'');
});

test('building a mandatory-change profile cannot restore admin caps or full navigation',async()=>{
  let lookups=0;
  const a=moduleOf('apps/web/lib/auth.ts',{
    './role-pages':{toPagesString:ids=>ids.join(',')},'./capabilities':{CAPABILITY_KEYS:['admin.all'],isKnownCapability:()=>true},
    './nest-api':{fetchUserAccessByAuthId:async()=>{lookups++;throw Error('Should not resolve business access')}}
  });
  const user=await a.buildUserObject({id:'1',auth_id:'auth-1',role:'ADMIN',aktif:true,must_change_password:true});
  assert.equal(user.role,'');assert.equal(user.roles.length,0);assert.equal(user.caps.length,0);assert.equal(user.pagesArray.join(','),'update-password');assert.equal(lookups,0);
});
