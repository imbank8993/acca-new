const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function compile(file, requireModule = require) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(requireModule, module, module.exports);
    return module.exports;
}
const shared = compile('apps/web/lib/lckh/print-shared.ts');
const { generateRekapKinerjaHtml } = compile('apps/web/lib/kinerja-guru/rekap-kinerja-report.ts', name => name === '@/lib/lckh/print-shared' ? shared : require(name));
test('Kinerja Guru uses the Guru Asuh letterhead markup, styles, logo and page margins', () => {
    const profil = { nama: 'MAN Insan Cendekia Gowa', jenjang: 'MA', kabupaten_kota: 'Gowa', logo_url: 'https://school.example/logo.png', alamat: 'Jalan Sekolah', email: 'info@example.test' };
    const html = generateRekapKinerjaHtml({ top10: [], kategoriLabel: 'Tidak Piket', kategoriKey: 'piket', periodeLabel: 'Oktober 2026', profil });
    assert(html.includes(shared.renderKopHTML(profil)));
    assert(html.includes(shared.CENTERED_KOP_CSS));
    assert.match(html, /margin: 10mm 15mm 15mm 20mm/);
    assert.match(html, /KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA/);
    assert.match(html, /MAN INSAN CENDEKIA GOWA/);
    const guruAsuh = fs.readFileSync('apps/web/lib/guru-asuh/laporan-report.ts', 'utf8');
    assert(guruAsuh.includes('${CENTERED_KOP_CSS}'));
    assert(guruAsuh.includes('${renderKopHTML(profil)}'));
});
test('profile loader accepts the actual nama field returned by profil-sekolah', async () => {
    const source = fs.readFileSync('apps/web/app/kinerja-guru/view.tsx', 'utf8');
    const tree = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let effect;
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes("fetch('/api/profil-sekolah')")) effect = node.arguments[0].getText(tree);
        ts.forEachChild(node, visit);
    };
    visit(tree); assert(effect);
    const profil = { nama: 'MAN Insan Cendekia Gowa', logo_url: 'https://school.example/logo.png' };
    const values = [], errors = [];
    const fn = compileFunction(effect);
    fn(async () => ({ ok: true, json: async () => ({ ok: true, data: profil }) }), value => values.push(value), value => errors.push(value));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(values[0], profil); assert.equal(errors.length, 0);
});
function compileFunction(effect) {
    const code = ts.transpileModule(`const setup = ${effect}; setup();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function('fetch', 'setProfil', 'setProfilError', code);
}
test('print cannot use stale data or a missing school profile', () => {
    const source = fs.readFileSync('apps/web/app/kinerja-guru/view.tsx', 'utf8');
    assert.match(source, /if \(loading \|\| dataError\) return/);
    assert.match(source, /if \(!profil\)/);
});

test('Daring is available in the category picker and chart configuration', () => {
    const source = fs.readFileSync('apps/web/app/kinerja-guru/view.tsx', 'utf8');
    const tree = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let chartOptions, pickerOptions;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'TAB_OPTIONS') chartOptions = node.initializer.getText(tree);
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'FilterSelect' && node.attributes.properties.some(prop => prop.name?.getText(tree) === 'label' && prop.initializer?.text === 'Kategori'))
            pickerOptions = node.attributes.properties.find(prop => prop.name?.getText(tree) === 'options').initializer.expression.getText(tree);
        ts.forEachChild(node, visit);
    };
    visit(tree);
    for (const options of [chartOptions, pickerOptions]) {
        assert(options); assert.match(options, /value: 'daring'/); assert.match(options, /label: 'Daring'/);
    }
    const html = generateRekapKinerjaHtml({ top10: [{ nama: 'Guru A', nip: '1', count: 1, total_jp: 4, details: [{ type: 'Daring', tanggal: '2020-01-06', kelas: 'X', jam_ke: '1', mapel: 'Matematika' }] }], kategoriKey: 'daring', kategoriLabel: 'Daring', periodeLabel: 'Januari 2020' });
    assert.match(html, /Matematika/);
});
test('Kepala Madrasah signer comes from the school profile, never a placeholder name', () => {
    const base = { nama: 'MAN Insan Cendekia Gowa', jenjang: 'MA', kabupaten_kota: 'Gowa' };
    const html = generateRekapKinerjaHtml({ top10: [], kategoriLabel: 'Daring', kategoriKey: 'daring', periodeLabel: 'Oktober 2026',
        profil: { ...base, kepala_sekolah_nama: 'Dr. Kepala Contoh, M.Pd.', kepala_sekolah_nip: '197001012000011001' } });
    assert.match(html, /<div class="sign-name">Dr\. Kepala Contoh, M\.Pd\.<\/div>/);
    assert.match(html, /NIP\. 197001012000011001/);
    const empty = generateRekapKinerjaHtml({ top10: [], kategoriLabel: 'Daring', kategoriKey: 'daring', periodeLabel: 'Oktober 2026', profil: base });
    assert.doesNotMatch(empty, /<div class="sign-name">Kepala Madrasah<\/div>/);
});
test('Daring is selectable as a Kinerja Guru filter', () => {
    const source = fs.readFileSync('apps/web/app/kinerja-guru/view.tsx', 'utf8');
    assert.match(source, /\{ value: 'daring', label: 'Daring' \}/);
    assert.match(source, /value: 'daring', label: 'Daring', icon:/);
});
