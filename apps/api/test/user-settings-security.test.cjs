const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path'),bcrypt=require('bcryptjs');
const root=path.resolve(__dirname,'../../..');
const common={Injectable:()=>v=>v,Inject:()=>()=>{},forwardRef:f=>f,Logger:class{warn(){}error(){}log(){}},BadRequestException:class extends Error{},NotFoundException:class extends Error{},UnauthorizedException:class extends Error{},ForbiddenException:class extends Error{}};
const modules={};
function load(file){if(modules[file])return modules[file];const m={exports:{}};const output=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;vm.runInNewContext(output,{module:m,exports:m.exports,Date,Buffer,console,require(name){if(name==='@nestjs/common')return common;if(name==='@nestjs/passport')return{PassportStrategy:()=>class{}};if(name==='passport-jwt')return{Strategy:class{},ExtractJwt:{fromAuthHeaderAsBearerToken:()=>()=>{}}};if(name==='crypto'||name==='bcryptjs')return require(name);if(name.endsWith('session-security'))return load('apps/api/src/auth/session-security.ts');return{}}});return modules[file]=m.exports}
const {UsersService}=load('apps/api/src/users/users.service.ts'),{AccessService}=load('apps/api/src/access/access.service.ts'),{AuthService}=load('apps/api/src/auth/auth.service.ts'),{JwtStrategy}=load('apps/api/src/auth/jwt.strategy.ts');
const clone=v=>structuredClone(v);
function matches(row,w={}){return Object.entries(w).every(([key,v])=>key==='OR'?v.some(c=>matches(row,c)):key==='NOT'?!matches(row,v):v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Date)?('in'in v?v.in.includes(row[key]):'equals'in v?String(row[key]||'').toLowerCase()===String(v.equals).toLowerCase():'contains'in v?String(row[key]||'').toUpperCase().includes(String(v.contains).toUpperCase()):false):row[key]===v)}
function fixture(){let state={public_users:[{id:1n,auth_id:'auth-1',username:'admin1',nama:'Admin',email:'one@example.com',aktif:true,role:'ADMIN'},{id:2n,auth_id:'auth-2',username:'admin2',nama:'Admin 2',email:'two@example.com',aktif:true,role:'ADMIN'},{id:3n,auth_id:'auth-3',username:'guru',nama:'Guru',aktif:true,role:'GURU'},{id:4n,auth_id:null,username:'legacy',nama:'Legacy',aktif:true,role:'ADMIN'}],auth_users:[1,2,3].map(i=>({id:'auth-'+i,encrypted_password:bcrypt.hashSync('old-password',4),raw_app_meta_data:{provider:'email'},raw_user_meta_data:{}})),roles:['ADMIN','ADMINISTRATOR','GURU'].map(name=>({name}))};let queue=Promise.resolve();const failure={};
function models(get){return Object.fromEntries(Object.keys(state).map(table=>[table,{async findUnique({where}){return clone(get()[table].find(row=>matches(row,where))||null)},async findFirst({where}){return clone(get()[table].find(row=>matches(row,where))||null)},async findMany({where}={}){return clone(get()[table].filter(row=>matches(row,where)))},async update({where,data}){if(failure[table+'.update'])throw Error('Simulated write failure');const row=get()[table].find(r=>matches(r,where));if(!row)throw Error('Missing record');Object.assign(row,clone(data));return clone(row)},async updateMany({where,data}){if(failure[table+'.updateMany'])throw Error('Simulated write failure');let count=0;for(const r of get()[table])if(matches(r,where)){Object.assign(r,clone(data));count++}return{count}},async create({data}){if(failure[table+'.create'])throw Error('Simulated write failure');const row={id:99n,...clone(data)};get()[table].push(row);return clone(row)},async delete({where}){if(failure[table+'.delete'])throw Error('Simulated write failure');const rows=get()[table],i=rows.findIndex(r=>matches(r,where));if(i<0)throw Error('Missing record');return rows.splice(i,1)[0]}}]))}
const db={...models(()=>state),async $transaction(fn){let local,release;const tx={...models(()=>{if(!local)throw Error('Mutation without account lock');return local}),async $queryRawUnsafe(sql){assert.match(sql,/pg_advisory_xact_lock/);const previous=queue;queue=new Promise(r=>release=r);await previous;local=clone(state);return[{lock:''}]}};try{const value=await fn(tx);state=local;return value}finally{release?.()}}};const users=new UsersService(db,{}),access=new AccessService(db),auth=new AuthService(db,{sign:payload=>clone(payload)},{resolveUserAccess:async()=>({pageIds:[]})},{});const strategy=new JwtStrategy({get:()=> 'test-key'},db,{getDutyRoles:async()=>[],resolveCapabilities:async()=>[]});return{db,users,access,auth,strategy,failure,get state(){return state}}}

test('foreign legacy account linking is denied; own idempotent linking still works',async()=>{const f=fixture();await assert.rejects(f.users.linkAuth(f.state.public_users[2],{username:'legacy'}));assert.equal(f.state.public_users[3].auth_id,null);assert.equal((await f.users.linkAuth(f.state.public_users[2],{username:'guru'})).message,'Sudah tertaut')});
test('login cannot initialize an unlinked account from an arbitrary password',async()=>{const f=fixture();await assert.rejects(f.auth.login({usernameOrEmail:'legacy',password:'attacker-password'}));assert.equal(f.state.auth_users.length,3);assert.equal(f.state.public_users[3].auth_id,null)});
test('role endpoint rejects unknown roles, malformed actions and removing final role',async()=>{const f=fixture();await assert.rejects(f.access.updateUserRoles('3','UNKNOWN','add'));await assert.rejects(f.access.updateUserRoles('3','GURU','anything'));await assert.rejects(f.access.updateUserRoles('3','GURU','remove'));assert.equal(f.state.public_users[2].role,'GURU');await f.access.updateUserRoles('3','ADMIN','add');assert.equal(f.state.public_users[2].role,'GURU,ADMIN')});
test('simultaneous deactivation cannot remove the last active admin',async()=>{const f=fixture();const results=await Promise.allSettled([f.users.updateStatus('1',false,{id:2n}),f.users.updateStatus('2',false,{id:1n})]);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(f.state.public_users.filter(u=>u.aktif&&u.role==='ADMIN'&&u.auth_id).length,1)});
test('role removal and deactivation share the same last-admin lock',async()=>{const f=fixture();const results=await Promise.allSettled([f.access.updateUserRoles('1','GURU','replace'),f.users.updateStatus('2',false,{id:1n})]);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(f.state.public_users.filter(u=>u.aktif&&u.role==='ADMIN'&&u.auth_id).length,1)});
test('own password update rejects invalid or unchanged passwords and accepts a new password without reconfirming the old one',async()=>{for(const password of ['short','old-password']){const f=fixture();await assert.rejects(f.users.updateOwn(f.state.public_users[2],{nama:'Changed'},password));assert.equal(f.state.public_users[2].nama,'Guru')}const f=fixture();await f.users.updateOwn(f.state.public_users[2],{nama:'Changed'},'new-password');assert.equal(f.state.public_users[2].nama,'Changed');assert(await bcrypt.compare('new-password',f.state.auth_users[2].encrypted_password))});
test('password change revokes old JWT and fresh login obtains the new session version',async()=>{const f=fixture();const old=await f.auth.login({usernameOrEmail:'guru',password:'old-password'});await f.strategy.validate(old.access_token);await f.users.changeOwnPassword(f.state.public_users[2],'new-password','old-password');await assert.rejects(f.strategy.validate(old.access_token));const fresh=await f.auth.login({usernameOrEmail:'guru',password:'new-password'});assert(fresh.access_token.sessionVersion);await f.strategy.validate(fresh.access_token);assert.equal(f.state.auth_users[2].raw_app_meta_data.provider,'email')});
test('admin password reset revokes existing tokens and a valid temporary session can choose its new password',async()=>{const f=fixture();const old=await f.auth.login({usernameOrEmail:'guru',password:'old-password'});await f.auth.adminResetPassword('1','3','temporary-password');await assert.rejects(f.strategy.validate(old.access_token));const temporary=await f.auth.login({usernameOrEmail:'guru',password:'temporary-password'});const user=await f.strategy.validate(temporary.access_token);await f.users.changeOwnPassword(user,'chosen-password');await assert.rejects(f.strategy.validate(temporary.access_token));assert.equal(f.state.auth_users[2].raw_user_meta_data.must_change_password,undefined)});
test('email reuse cannot redirect a JWT to another account',async()=>{const f=fixture();const token={sub:'3',email:'one@example.com',authId:'auth-3'};assert.equal((await f.strategy.validate(token)).id,3n)});
test('update/create/delete failures roll back profile and credential changes together',async()=>{let f=fixture();f.failure['auth_users.update']=true;await assert.rejects(f.users.update('3',{nama:'Changed'}));assert.equal(f.state.public_users[2].nama,'Guru');f=fixture();f.failure['public_users.create']=true;await assert.rejects(f.users.create({username:'new',nama:'New',role:'GURU',password:'new-password'}));assert.equal(f.state.auth_users.length,3);f=fixture();f.failure['auth_users.delete']=true;await assert.rejects(f.users.remove('3','auth-1'));assert.equal(f.state.public_users.length,4);assert.equal(f.state.auth_users.length,3)});
test('a failed password write rolls back a simultaneous profile edit',async()=>{const f=fixture();f.failure['auth_users.update']=true;await assert.rejects(f.users.updateOwn(f.state.public_users[2],{nama:'Changed'},'new-password','old-password'));assert.equal(f.state.public_users[2].nama,'Guru');assert(await bcrypt.compare('old-password',f.state.auth_users[2].encrypted_password))});

test('recovery reset consumes the link, clears the forced-change flag and revokes old sessions',async()=>{const f=fixture();const old=await f.auth.login({usernameOrEmail:'guru',password:'old-password'});const token='a'.repeat(64);const credential=f.state.auth_users[2];credential.recovery_token=require('node:crypto').createHash('sha256').update(token).digest('hex');credential.recovery_sent_at=new Date();credential.raw_user_meta_data.must_change_password=true;await f.auth.resetPasswordDenganToken(token,'recovered-password');await assert.rejects(f.strategy.validate(old.access_token));assert.equal(f.state.auth_users[2].recovery_token,null);assert.equal(f.state.auth_users[2].raw_user_meta_data.must_change_password,undefined);await assert.rejects(f.auth.resetPasswordDenganToken(token,'replayed-password'));await f.auth.login({usernameOrEmail:'guru',password:'recovered-password'})});
test('failed provisioning by admin leaves legacy auth_id untouched',async()=>{const f=fixture();f.failure['auth_users.create']=true;await assert.rejects(f.auth.adminResetPassword('1','4','temporary-password'));assert.equal(f.state.public_users[3].auth_id,null)});

test('alternate admin registration also rolls back credential creation on profile failure',async()=>{const f=fixture();f.failure['public_users.create']=true;await assert.rejects(f.auth.register({email:'new@example.com',username:'new',name:'New',password:'new-password',role:'GURU'}));assert.equal(f.state.auth_users.length,3)});

test('temporary login has no business roles or grants until a different password is saved', async () => {
  for (const account of ['guru', 'admin2']) {
    const f = fixture(), target = account === 'guru' ? 2 : 1;
    await f.auth.adminResetPassword('1', String(target + 1), 'temporary-password');
    const login = await f.auth.login({ usernameOrEmail: account, password: 'temporary-password' });
    assert.equal(login.must_change_password, true);
    assert.equal(login.access_token.must_change_password, true);
    assert.equal(login.access_token.role, '');
    assert.deepEqual([...login.access_token.pageIds], ['update-password']);
    const user = await f.strategy.validate(login.access_token);
    assert.equal(user.must_change_password, true);
    assert.equal(user.role, ''); assert.equal(user.roles.length, 0); assert.equal(user.caps.length, 0);
    for (const [password, oldPassword] of [['short', undefined], [null, undefined], ['temporary-password', undefined]]) {
      await assert.rejects(f.users.changeOwnPassword(user, password, oldPassword));
      assert.equal(f.state.auth_users[target].raw_user_meta_data.must_change_password, true);
    }
    await f.users.changeOwnPassword(user, 'chosen-password');
    await assert.rejects(f.strategy.validate(login.access_token));
    const fresh = await f.auth.login({ usernameOrEmail: account, password: 'chosen-password' });
    assert.equal(fresh.must_change_password, false);
    assert.equal((await f.strategy.validate(fresh.access_token)).must_change_password, false);
    assert.equal(f.state.public_users[target].username, account);
    assert.equal(f.state.public_users[target].email, account === 'guru' ? undefined : 'two@example.com');
  }
});

test('recovery cannot clear mandatory change by retaining the current password', async () => {
  const f = fixture(), token = 'b'.repeat(64), credential = f.state.auth_users[2];
  credential.recovery_token = require('node:crypto').createHash('sha256').update(token).digest('hex');
  credential.recovery_sent_at = new Date(); credential.raw_user_meta_data.must_change_password = true;
  await assert.rejects(f.auth.resetPasswordDenganToken(token, 'old-password'), /berbeda/);
  assert.equal(f.state.auth_users[2].raw_user_meta_data.must_change_password, true);
  assert.equal(f.state.auth_users[2].recovery_token, credential.recovery_token);
});

function loadGuard(file) {
  const m = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  vm.runInNewContext(output, { module: m, exports: m.exports, process: { env: {} }, require: name => name === '@nestjs/common' ? common : { AuthGuard: () => class {} } });
  return Object.values(m.exports)[0];
}

test('mandatory-change guard only accepts own password and session endpoints; optional auth is anonymous', () => {
  const Guard = loadGuard('apps/api/src/auth/jwt-auth.guard.ts'), guard = new Guard();
  const user = { id: 3n, must_change_password: true };
  const context = (method, originalUrl) => ({ switchToHttp: () => ({ getRequest: () => ({ method, originalUrl }) }) });
  for (const [method, url] of [['GET', '/api/access/me'], ['GET', '/access/me?x=1'], ['POST', '/api/users/me/password/'], ['PUT', '/api/users/me']]) {
    assert.equal(guard.handleRequest(null, user, null, context(method, url)), user);
  }
  for (const [method, url] of [['GET', '/api/users'], ['PUT', '/api/users/1'], ['POST', '/api/access/me'], ['GET', '/api/users/me/password'], ['PUT', '/api/users/pinned-pages'], ['GET', '/api/access/me/extra']]) {
    assert.throws(() => guard.handleRequest(null, user, null, context(method, url)), common.ForbiddenException);
  }
  assert.throws(() => guard.handleRequest(null, null, null, context('POST', '/api/users/me/password')), common.UnauthorizedException);
  const normal = { id: 3n }; assert.equal(guard.handleRequest(null, normal, null, context('GET', '/api/users')), normal);
  const Optional = loadGuard('apps/api/src/auth/optional-jwt-auth.guard.ts');
  assert.equal(new Optional().handleRequest(null, user, null), null);
  assert.equal(new Optional().handleRequest(null, normal, null), normal);
});
