const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function callback(file, name) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let body;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
            body = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(source) : node.initializer.getText(source);
        }
        ts.forEachChild(node, visit);
    }
    visit(source); assert.ok(body, name);
    return context => {
        const script = `const ${name} = ${body}; result = ${name};`;
        vm.runInNewContext(ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
        return context.result;
    };
}
const openPersonal = callback('apps/web/app/dokumen/tabs/PersonalDocumentsTab.tsx', 'bukaDokumen');
const openSchool = callback('apps/web/app/dokumen/tabs/ManageDokumenTab.tsx', 'handleView');
const files = [
    { id: 'c', judul: 'C.png', file_url: '/C.png' },
    { id: 'a', judul: 'A.pdf', file_url: '/A.pdf' },
    { id: 'b', judul: 'B.docx', file_url: '/B.docx' },
];

test('personal folder arrows follow the displayed mixed-file order and stop at either end', async () => {
    const opened = [];
    const open = openPersonal({ filteredDocuments: files, openFile: (...args) => opened.push(args), Swal: { fire() { assert.fail('Unexpected error'); } } });
    await open(files[1]);
    assert.equal(opened.at(-1)[0], '/A.pdf');
    assert.equal(opened.at(-1)[2].positionLabel, '2 / 3');
    opened.at(-1)[2].onPrevious();
    assert.equal(opened.at(-1)[0], '/C.png');
    assert.equal(opened.at(-1)[2].onPrevious, undefined);
    opened.at(-1)[2].onNext();
    opened.at(-1)[2].onNext();
    assert.equal(opened.at(-1)[0], '/B.docx');
    assert.equal(opened.at(-1)[2].onNext, undefined);
});

test('search results form the navigation list; hidden documents never appear', async () => {
    const opened = [];
    const open = openPersonal({ filteredDocuments: [files[2]], openFile: (...args) => opened.push(args) });
    await open(files[2]);
    assert.equal(opened[0][2].onPrevious, undefined);
    assert.equal(opened[0][2].onNext, undefined);
    assert.equal(opened[0][2].positionLabel, '1 / 1');
});

test('metadata fallback keeps folder navigation and passes the actual file URL to the viewer', async () => {
    const opened = [];
    const open = openPersonal({ filteredDocuments: files, openFile: (...args) => opened.push(args),
        fetch: async url => { assert.equal(url, '/api/personal/documents/a/file'); return { json: async () => ({ ok: true, data: { file_url: '/resolved.pdf' } }) }; },
        Swal: { fire() { assert.fail('Unexpected error'); } } });
    await open({ ...files[1], file_url: null });
    assert.equal(opened[0][0], '/resolved.pdf');
    assert.equal(opened[0][2].positionLabel, '2 / 3');
    opened[0][2].onNext();
    assert.equal(opened.at(-1)[0], '/B.docx');
});

test('school document navigation opens exactly the indexed row and ignores out-of-range indices', () => {
    const opened = [];
    const open = openSchool({ documents: files.map(f => ({ ...f, file_name: f.judul })), ensureAbsoluteUrl: url => url, setSelectedDoc: file => opened.push(file) });
    open(1); assert.equal(opened[0].url, '/A.pdf'); assert.equal(opened[0].index, 1);
    open(-1); open(3); assert.equal(opened.length, 1);
});
