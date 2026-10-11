const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/pembayaran/view.tsx'), 'utf8');
const tree = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = tree.statements.filter(node =>
    (ts.isFunctionDeclaration(node) && node.name?.text === 'parseNominal') ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(tree) === 'getCatatanData'))
).map(node => node.getText(tree)).join('\n');
const js = ts.transpileModule(declarations + '\n globalThis.readPayment = getCatatanData;', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const context = {};
vm.runInNewContext(js, context);
for (const value of [0, 100000, '0', '150000']) {
    assert.equal(context.readPayment(JSON.stringify({ nominal: value })).nominal, Number(value));
}
assert.equal(context.readPayment('catatan lama').nominal, null);
assert.equal(context.readPayment(JSON.stringify({ nominal: -1 })).nominal, null);
console.log('PASS: six payment nominal parsing regressions.');
