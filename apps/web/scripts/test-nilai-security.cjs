// Exercise the actual page handlers with controlled network and file callbacks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../app/nilai/view.tsx'), 'utf8');
const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const page = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'NilaiPage');
function handlers(names, env) {
  const nodes = page.body.statements.filter(n => ts.isVariableStatement(n)
    && names.includes(n.declarationList.declarations[0].name.getText(ast)));
  assert.equal(nodes.length, names.length);
  const code = nodes.map(n => n.getText(ast)).join('\n') + '\nglobalThis.handlers = { ' + names.join(',') + ' };';
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = vm.createContext({ URLSearchParams, ...env });
  vm.runInContext(js, context);
  return context.handlers;
}
const response = data => ({ ok: true, json: async () => ({ ok: true, data }) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function context(scopeKey, refs = {}) {
  const state = { changes: { '001||PAS||-||': 80 }, nilai: [], sessions: [], messages: [], loaded: null };
  const env = {
    scopeKey, currentScope: refs.currentScope || { current: scopeKey },
    dataRequest: refs.dataRequest || { current: 0 }, apresiasiRequest: refs.apresiasiRequest || { current: 0 },
    user: { nip: 'G1' }, kelas: scopeKey, mapel: 'Matematika', semester: 'Ganjil', tahunAjaran: '2026/2027',
    DEFAULT_BOBOT: {}, dataReady: true, loading: false, savingRef: { current: false }, changes: state.changes,
    setLoading: value => { state.loading = value; }, setLoadedScope: value => { state.loaded = value; },
    setNilaiData: value => { state.nilai = value; }, setSiswa: () => {}, setTagihanConfig: () => {}, setBobot: () => {},
    setChanges: value => { state.changes = value; },
    setApresiasiSesi: value => { state.sessions = value; }, setApresiasiPoin: () => {},
    notif: { error: value => state.messages.push(['error', value]), success: value => state.messages.push(['success', value]) },
    loadApresiasi: async () => {},
  };
  return { state, env };
}

test('a late class A response cannot replace class B data or clear its drafts', async () => {
  const currentScope = { current: 'A' }, dataRequest = { current: 0 };
  const a = context('A', { currentScope, dataRequest });
  const b = context('B', { currentScope, dataRequest });
  const slow = deferred();
  a.env.authFetch = () => slow.promise;
  b.env.authFetch = async () => response({ nilai: ['B'] });
  const loadingA = handlers(['loadData'], a.env).loadData();
  currentScope.current = 'B';
  await handlers(['loadData'], b.env).loadData();
  slow.resolve(response({ nilai: ['A'] }));
  await loadingA;
  assert.deepEqual(b.state.nilai, ['B']);
  assert.equal(b.state.loaded, 'B');
  assert.deepEqual(a.state.nilai, []);
  assert.equal(a.state.changes['001||PAS||-||'], 80);
});

test('only the latest refresh within the same class may update state', async () => {
  const c = context('A');
  const slow = deferred(); let calls = 0;
  c.env.authFetch = () => ++calls === 1 ? slow.promise : Promise.resolve(response({ nilai: ['new'] }));
  const h = handlers(['loadData'], c.env);
  const first = h.loadData();
  await h.loadData();
  slow.resolve(response({ nilai: ['old'] }));
  await first;
  assert.deepEqual(c.state.nilai, ['new']);
});

test('stale appreciation responses are ignored', async () => {
  const c = context('A'), slow = deferred();
  c.env.authFetch = () => slow.promise;
  const request = handlers(['loadApresiasi'], c.env).loadApresiasi();
  c.env.currentScope.current = 'B';
  slow.resolve(response({ sesi: ['A'] }));
  await request;
  assert.deepEqual(c.state.sessions, []);
});

test('a partial-error success response preserves the draft and shows an error', async () => {
  const c = context('A'); let reloads = 0;
  c.env.authFetch = async () => ({ ok: true, json: async () => ({ ok: true, errors: ['failure'] }) });
  c.env.loadData = async () => { reloads++; };
  await handlers(['handleSave'], c.env).handleSave();
  assert.equal(reloads, 0);
  assert.equal(c.state.changes['001||PAS||-||'], 80);
  assert.equal(c.state.messages[0][0], 'error');
  assert.equal(c.env.savingRef.current, false);
});

test('server save failure preserves the draft without announcing success', async () => {
  const c = context('A');
  c.env.authFetch = async () => ({ ok: false, status: 500, json: async () => ({ ok: false }) });
  await handlers(['handleSave'], c.env).handleSave();
  assert.equal(c.state.changes['001||PAS||-||'], 80);
  assert.equal(c.state.messages[0][0], 'error');
});

test('saving stale class data makes no network request', async () => {
  const c = context('A'); let requests = 0;
  c.env.currentScope.current = 'B';
  c.env.authFetch = async () => { requests++; };
  await handlers(['handleSave'], c.env).handleSave();
  assert.equal(requests, 0);
});

test('malicious Excel cell contents are passed to SweetAlert as text, never HTML', async () => {
  const c = context('A');
  const payload = '<img src=x onerror="window.compromised=true">';
  const popups = []; let reader;
  Object.assign(c.env, {
    FileReader: class { constructor() { reader = this; } readAsBinaryString() {} },
    XLSX: { read: () => ({ SheetNames: ['Sheet'], Sheets: { Sheet: {} } }),
      utils: { sheet_to_json: () => [['NO', 'NISN', 'NAMA', 'KELAS', 'PAS'], [1, payload, 'Nama', 'A', 80]] } },
    Swal: { fire: options => popups.push(options), showLoading: () => {} },
    activeMode: 'PAS', siswa: [],
  });
  handlers(['handleImport'], c.env).handleImport({ target: { files: [{}], value: 'file.xlsx' } });
  await reader.onload({ target: { result: 'mock workbook' } });
  const error = popups.find(p => p.title === 'Validasi Gagal');
  assert.ok(error, 'must reach the actual workbook validation error');
  assert.ok(error.text.includes(payload));
  assert.equal(error.html, undefined);
});
