const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the page's actual loader and effect with deliberately reordered responses.
const source = fs.readFileSync('apps/web/app/kinerja-guru/view.tsx', 'utf8');
const tree = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loader, effect;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'fetchData') loader = node.initializer.getText(tree);
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes('new AbortController()')) {
    effect = node.arguments[0].getText(tree);
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert(loader && effect);
function harness() {
  const requests = [], updates = [], loading = [], cleared = [];
  const state = { requestId: { current: 0 }, AbortController, URLSearchParams, console,
    setData: value => updates.push(value), setCanCetakRekap: () => {}, setLoading: value => loading.push(value),
    setInterval: () => 1, clearInterval: id => cleared.push(id),
    fetch: (url, options) => new Promise(resolve => requests.push({ url, signal: options.signal,
      finish: data => resolve({ json: async () => ({ success: true, data }) }) })),
  };
  function mount(month) {
    const module = { exports: {} };
    const code = `const fetchData = ${loader}; const setup = ${effect}; module.exports = { setup, fetchData };`;
    vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
      { ...state, module, periodStart: month, periodEnd: month });
    const cleanup = module.exports.setup();
    return { cleanup, refresh: module.exports.fetchData };
  }
  return { requests, updates, loading, cleared, mount };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('a slow previous filter cannot overwrite the latest period or loading state', async () => {
  const f = harness();
  const old = f.mount('2020-01');
  old.cleanup();
  const current = f.mount('2020-02');
  assert.equal(f.requests[0].signal.aborted, true);
  f.requests[1].finish('February');
  await flush();
  f.requests[0].finish('January');
  await flush();
  assert.deepEqual(f.updates, ['February']);
  assert.equal(f.loading.at(-1), false);
  current.cleanup();
  assert.equal(f.cleared.length, 2);
});
test('overlapping refreshes retain only the newest response, and cleanup suppresses updates', async () => {
  const f = harness();
  const current = f.mount('2020-01');
  const refresh = current.refresh();
  f.requests[1].finish('Newest');
  await refresh;
  f.requests[0].finish('Older');
  await flush();
  assert.deepEqual(f.updates, ['Newest']);
  const pending = current.refresh();
  current.cleanup();
  f.requests[2].finish('After unmount');
  await pending;
  assert.deepEqual(f.updates, ['Newest']);
});
