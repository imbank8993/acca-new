const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
const { PDFDocument, degrees } = require('pdf-lib');

function load(file, imports) {
    const mod = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, {
        module: mod, exports: mod.exports, require: name => imports[name],
        URL, Buffer, Blob, File, FormData, Uint8Array, Date, process,
        console: { log() {}, warn() {}, error() {} },
        fetch: () => { throw new Error('Unexpected HTTP request to the upload server'); },
    });
    return mod.exports;
}

for (const signerId of ['42', '00000000-0000-4000-8000-000000000042']) {
    test(`signing a PDF preserves teacher ${signerId} without putting numeric IDs in UUID fields`, async () => {
        const original = await PDFDocument.create(); original.addPage([595, 842]);
        const bytes = await original.save();
        const form = new FormData();
        form.append('file', new File([bytes], 'surat.pdf', { type: 'application/pdf' }));
        form.append('data', JSON.stringify({ suratData: {
            nomor_surat: '1/A/2026', perkara: 'Pengujian', pejabat_id: signerId,
            pejabat_nama: 'Guru Pengujian', pejabat_nip: '123', tanggal_ttd: '2026-10-25',
        }, placement: { x: 20, y: 30, width: 57, height: 57, pageNum: 1, pageWidth: 595, pageHeight: 842 } }));
        let metadata, uploaded;
        const route = load('apps/web/app/api/surat/sign-pdf/route.ts', {
            'next/server': { NextRequest, NextResponse },
            'pdf-lib': { PDFDocument, degrees },
            qrcode: require('qrcode'),
            canvas: { createCanvas() { throw new Error('Use plain QR fallback'); } },
            '@/lib/app-jwt': { extractRequestToken: () => 'test-token' },
            '@/lib/api-auth': { getApiUser: async () => ({ authId: '00000000-0000-4000-8000-000000000001' }) },
            '@/lib/public-url': { getPublicOrigin: () => 'https://acca.icgowa.sch.id' },
            '@/lib/nest-api': { nestFetchAsUser: async (path, _token, options) => {
                if (path === '/profil-sekolah') return { status: 200, body: { data: { kabupaten_kota: 'Gowa' } } };
                if (options.method === 'POST') {
                    metadata = JSON.parse(options.body);
                    assert.match(metadata.tanggal_ttd, /^2026-10-25T00:00:00\.000Z$/);
                    assert.equal(metadata.penandatangan_id, signerId === '42' ? null : signerId);
                    return { status: 201, body: { data: { id: '00000000-0000-4000-8000-000000000002' } } };
                }
                assert.equal(JSON.parse(options.body).status, 'FINAL');
                return { status: 200, body: { ok: true } };
            } },
            '@/app/api/upload/route': { POST: async request => {
                assert.equal(request.headers.get('cookie'), 'acca_session=test-session');
                assert.equal(request.headers.get('authorization'), 'Bearer test-token');
                uploaded = await request.formData();
                return NextResponse.json({ ok: true, publicUrl: 'https://files.example/signed.pdf' });
            } },
        });
        const response = await route.POST(new NextRequest('http://0.0.0.0:3006/api/surat/sign-pdf', {
            method: 'POST', body: form,
            headers: { cookie: 'acca_session=test-session', authorization: 'Bearer test-token' },
        }));
        const result = await response.json();
        assert.equal(response.status, 200, result.error);
        assert.equal(result.ok, true);
        assert.equal(metadata.pejabat_id, signerId);
        assert.equal(metadata.penandatangan_nama, 'Guru Pengujian');
        assert.equal(metadata.penandatangan_nip, '123');
        const signed = await PDFDocument.load(await uploaded.get('file').arrayBuffer());
        assert.equal(signed.getPageCount(), 1);
        assert(signed.getPage(0).node.Resources().lookupMaybe(require('pdf-lib').PDFName.of('XObject'), require('pdf-lib').PDFDict));
    });
}

test('legacy surat upload preserves session and storage failure without making an internal HTTP call', async () => {
    const route = load('apps/web/app/api/surat/upload/route.ts', {
        'next/server': { NextRequest, NextResponse },
        '@/app/api/upload/route': { POST: async request => {
            assert.equal(request.headers.get('cookie'), 'acca_session=test-session');
            const body = await request.formData();
            assert.equal(body.get('file').name, 'surat.pdf');
            return NextResponse.json({ ok: false, error: 'Storage unavailable' }, { status: 503 });
        } },
    });
    const body = new FormData(); body.append('file', new File(['pdf'], 'surat.pdf'));
    const response = await route.POST(new NextRequest('http://0.0.0.0:3006/api/surat/upload', {
        method: 'POST', body, headers: { cookie: 'acca_session=test-session' },
    }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'Storage unavailable');
});

function previewHarness(engine) {
    const source = fs.readFileSync('apps/web/app/surat/view.tsx', 'utf8');
    const tree = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let loader;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'loadPdfDocument') loader = node.initializer.getText(tree);
        ts.forEachChild(node, visit);
    }
    visit(tree); assert(loader);
    const states = { docs: [], busy: [], errors: [], files: [] };
    const context = {
        pdfLoadId: { current: 0 }, Uint8Array,
        setProcessing: value => states.busy.push(value), setPdfDoc: value => states.docs.push(value),
        setPdfFile: value => states.files.push(value), setNumPages() {}, setCurrentPage() {},
        loadPdfJsIfNeeded: async () => engine, console: { error() {} },
        Swal: { fire: (...args) => states.errors.push(args) },
    };
    const run = vm.runInNewContext(ts.transpileModule(`(${loader})`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    return { run, states };
}

test('preview stays busy until PDF is loaded and discards an older selection', async () => {
    const pending = []; let destroyed = false;
    const h = previewHarness({ getDocument: () => ({ promise: new Promise(resolve => pending.push(resolve)) }) });
    const file = { arrayBuffer: async () => new ArrayBuffer(8) };
    const first = h.run(file); await new Promise(setImmediate);
    assert.equal(h.states.busy.at(-1), true);
    const second = h.run(file); await new Promise(setImmediate);
    pending[1]({ numPages: 2 }); await second;
    pending[0]({ numPages: 1, destroy: async () => { destroyed = true; } }); await first;
    assert.equal(h.states.docs.length, 1);
    assert.equal(h.states.docs[0].numPages, 2);
    assert.equal(destroyed, true);
    assert.equal(h.states.busy.at(-1), false);
});

test('unreadable or password protected PDF clears the selection and releases loading', async () => {
    const h = previewHarness({ getDocument: () => ({ promise: Promise.reject(Object.assign(Error(), { name: 'PasswordException' })) }) });
    await h.run({ arrayBuffer: async () => new ArrayBuffer(8) });
    assert.equal(h.states.files.at(-1), null);
    assert.equal(h.states.busy.at(-1), false);
    assert.match(h.states.errors[0][1], /sandi/);
});
