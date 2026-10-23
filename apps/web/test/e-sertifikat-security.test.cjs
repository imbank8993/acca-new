const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const XLSX = require('xlsx');

// Load the real TypeScript modules without a build subprocess or application DB.
function modules(stubs = {}) {
    const cache = new Map();
    function load(file) {
        file = path.resolve(file);
        if (cache.has(file)) return cache.get(file).exports;
        const result = { exports: {} }; cache.set(file, result);
        const localRequire = createRequire(file);
        const resolve = name => {
            if (Object.hasOwn(stubs, name)) return stubs[name];
            if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
            return localRequire(name);
        };
        const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText;
        new Function('require', 'module', 'exports', compiled)(resolve, result, result.exports);
        return result.exports;
    }
    return name => load(`apps/web/lib/e-sertifikat/${name}.ts`);
}
const load = modules();
const { readParticipantExcel, mapParticipantColumns } = load('excel');
const { fitLayerPlacement, resizeLayerWidth, mmToPt, pointTemplate } = load('layout');
const { DEFAULT_TEMPLATE } = load('model');
const { createEventDraft } = load('draft');
const { CertificateService } = load('service');
const { limitPublicCertificateRequest } = load('rate-limit');
const owner = { authId: 'owner', isAdmin: false, pages: ['e-sertifikat'], roles: ['GURU'] };
const conflict = error => error.status === 409;
async function workbookFile(rows, change = () => {}) {
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Peserta');
    sheet.addRows(rows); change(sheet);
    return new File([await book.xlsx.writeBuffer()], 'peserta.xlsx');
}

test('XLSX parses names, rich text, institutions and leading zero identities', async () => {
    const result = await readParticipantExcel(await workbookFile([
        ['Nama', 'Instansi', 'NIP'], [{ richText: [{ text: 'Amelia ' }, { text: 'Putri' }] }, 'MAN', '00123'],
    ]));
    assert.deepEqual(result.headers, ['Nama', 'Instansi', 'NIP']);
    assert.deepEqual(result.rows, [['Amelia Putri', 'MAN', '00123']]);
});
function xlsFile(rows) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Peserta');
    return new File([XLSX.write(book, { type: 'buffer', bookType: 'biff8' })], 'peserta.xls');
}
test('XLS preserves names, leading zeros, commas, quotes and line breaks', async () => {
    const result = await readParticipantExcel(xlsFile([['Nama', 'NIP', 'Catatan'], ['Amelia, Putri', '00123', 'Baris 1\nBaris "2"']]));
    assert.deepEqual(result.rows, [['Amelia, Putri', '00123', 'Baris 1\nBaris "2"']]);
});
test('XLSX rejects formula cells instead of evaluating or accepting cached results', async () => {
    await assert.rejects(readParticipantExcel(await workbookFile([['Nama'], [{ formula: '1+1', result: 2 }]])), /formula/);
});
for (const header of ['__proto__', 'constructor', 'prototype']) test(`rejects unsafe header ${header}`, async () => {
    await assert.rejects(readParticipantExcel(xlsFile([[header], ['Amelia']])), /Judul kolom/);
    assert.equal({}.polluted, undefined);
});
test('rejects duplicate or empty headers, extra columns, long cells and unsupported file types', async () => {
    for (const headers of [['Nama', 'Nama'], ['Nama', '']]) await assert.rejects(readParticipantExcel(xlsFile([headers, ['A', 'B']])), /Judul kolom/);
    await assert.rejects(readParticipantExcel(await workbookFile([Array(31).fill('Judul'), Array(31).fill('A')])), /30 kolom/);
    await assert.rejects(readParticipantExcel(xlsFile([['Nama'], ['a'.repeat(201)]])), /200 karakter/);
    await assert.rejects(readParticipantExcel(new File(['Nama\nA'], 'peserta.csv')), /xls/);
    await assert.rejects(readParticipantExcel(new File(['Nama\nA'], 'peserta.xls')), /tidak valid/);
});
test('enforces 500 participants in XLSX and XLS without silently truncating', async () => {
    const rows = [['Nama'], ...Array.from({ length: 500 }, (_, i) => [`Peserta ${i}`])];
    assert.equal((await readParticipantExcel(await workbookFile(rows))).rows.length, 500);
    assert.equal((await readParticipantExcel(xlsFile(rows))).rows.length, 500);
    rows.push(['Kelebihan']);
    await assert.rejects(readParticipantExcel(await workbookFile(rows)), /500/);
    await assert.rejects(readParticipantExcel(xlsFile(rows)), /500/);
});
test('rejects oversized uploads and corrupted archives', async () => {
    await assert.rejects(readParticipantExcel(new File([Buffer.alloc(2 * 1024 * 1024 + 1)], 'peserta.xlsx')), /2 MB/);
    await assert.rejects(readParticipantExcel(new File(['not a zip'], 'peserta.xlsx')), /tidak valid/);
});

test('XLS rejects formulas and excessive columns', async () => {
    await assert.rejects(readParticipantExcel(xlsFile([['Nama'], [{ t: 'n', f: '1+1', v: 2, bf: [7, 0, 0x1e, 1, 0, 0x1e, 1, 0, 0x03] }]])), /formula/);
    await assert.rejects(readParticipantExcel(xlsFile([Array(31).fill('Kolom'), Array(31).fill('A')])), /30 kolom/);
});

test('Excel mapping rejects invalid, duplicate and out-of-range columns', () => {
    const table = { headers: ['Nama', 'Sekolah', 'NIP'], rows: [['Amelia', 'MAN', '00123']] }, ids = [randomUUID()];
    assert.deepEqual(mapParticipantColumns(table, { name: 0, institution: 1, extras: [2] }, ids), [{ id: ids[0], name: 'Amelia', institution: 'MAN', identities: { NIP: '00123' } }]);
    for (const mapping of [{ name: 0, institution: 0, extras: [] }, { name: 0, institution: 1, extras: [1] }, { name: 0, extras: [2, 2] }, { name: 3, extras: [] }, { name: '0', extras: [] }, { name: 0, extras: [99] }])
        assert.throws(() => mapParticipantColumns(table, mapping, ids), /kolom/);
    assert.throws(() => mapParticipantColumns(table, { name: 0, extras: [] }, []), /Jumlah/);
});

test('recipient HTTP endpoint requires an Excel file and ignores arbitrary manual rows', async () => {
    const { NextRequest } = require('next/server');
    const imported = [];
    const handler = modules({ '../prisma': { prisma: {} }, '../api-auth': { getApiUser: async () => owner },
        './service': { CertificateService: class { async importRecipients(user, eventId, rows) { imported.push(rows); return { count: rows.length }; } }, assertManager() {}, verifyUrl: () => 'http://localhost' },
    })('http');
    const eventId = randomUUID(), url = `http://localhost/api/e-sertifikat/${eventId}/recipients`;
    const manual = await handler.manage(new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [{ id: randomUUID(), name: 'Manual' }] }) }), [eventId, 'recipients']);
    assert.equal(manual.status, 400); assert.equal(imported.length, 0);
    const broken = new FormData(); broken.set('file', new File([Buffer.from('d0cf11e0a1b11ae10000000000000000', 'hex')], 'rusak.xls'));
    broken.set('mapping', JSON.stringify({ name: 0, extras: [] })); broken.set('ids', JSON.stringify([randomUUID()]));
    assert.equal((await handler.manage(new NextRequest(url, { method: 'POST', body: broken }), [eventId, 'recipients'])).status, 400);
    assert.equal(imported.length, 0);
    for (const file of [xlsFile([['Nama', 'Sekolah'], ['Amelia', 'MAN']]), await workbookFile([['Nama', 'Sekolah'], ['Amelia', 'MAN']])]) {
        const form = new FormData(); form.set('file', file); form.set('mapping', JSON.stringify({ name: 0, institution: 1, extras: [] })); form.set('ids', JSON.stringify([randomUUID()]));
        form.set('rows', JSON.stringify([{ name: 'Data palsu' }]));
        const response = await handler.manage(new NextRequest(url, { method: 'POST', body: form }), [eventId, 'recipients']);
        assert.equal(response.status, 200, JSON.stringify(await response.json()));
        assert.equal(imported.at(-1)[0].name, 'Amelia');
    }
});

test('name and institution move independently and text width can shrink without moving the anchor', () => {
    const page = { width: 842, height: 595 }, template = pointTemplate(DEFAULT_TEMPLATE, page);
    const moved = fitLayerPlacement(template.name, { x: 40, y: 180, width: 300 }, page);
    assert.equal(moved.x, 40); assert.equal(moved.y, 180); assert.equal(moved.width, 300);
    assert.equal(template.institution.x, 84.2);
    const width = resizeLayerWidth({ ...template.name, ...moved }, page, -120, 0);
    assert.equal(width, 180);
    const resized = fitLayerPlacement({ ...template.name, ...moved }, { width }, page);
    assert.equal(resized.x, 40); assert.equal(resized.y, 180);
});

test('QR shrinks, enlarges and stays within both page dimensions', () => {
    const page = { width: 842, height: 595 }, placement = { x: 700, y: 450, width: 100, size: 100 };
    assert.equal(resizeLayerWidth(placement, page, 30, 20, true), 130);
    assert.equal(resizeLayerWidth(placement, page, -20, 0, true), 80);
    assert.equal(resizeLayerWidth(placement, page, 0, -20, true), 80);
    assert.equal(resizeLayerWidth(placement, page, 300, 300, true), 142);
    assert.equal(resizeLayerWidth(placement, page, -1000, -1000, true), mmToPt(20));
    const fitted = fitLayerPlacement(placement, { width: 900 }, page, true);
    assert.equal(fitted.width, 595); assert.equal(fitted.x, 247); assert.equal(fitted.y, 0);
});
test('rejects ZIP bombs even with forged uncompressed size metadata', async () => {
    const zip = new JSZip(); zip.file('xl/worksheets/sheet1.xml', Buffer.alloc(25 * 1024 * 1024 + 1, 65));
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    // Both local and central directory claim one byte, while DEFLATE expands over the limit.
    bytes.writeUInt32LE(1, 22);
    const directory = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt32LE(1, directory + 24);
    await assert.rejects(readParticipantExcel(new File([bytes], 'bomb.xlsx')), /terlalu besar|arsip/);
});
test('rejects huge sparse row coordinates and merge ranges before workbook allocation', async () => {
    for (const xml of [
        '<worksheet><sheetData><row r="9999999"><c r="A9999999"><v>1</v></c></row></sheetData></worksheet>',
        '<worksheet><mergeCells><mergeCell ref="A1:XFD1048576"/></mergeCells></worksheet>',
        '<!DOCTYPE worksheet [<!ENTITY a "bad">]><worksheet/>',
    ]) {
        const zip = new JSZip(); zip.file('xl/worksheets/sheet1.xml', xml);
        await assert.rejects(readParticipantExcel(new File([await zip.generateAsync({ type: 'nodebuffer' })], 'sparse.xlsx')), /500|30 kolom|XML/);
    }
});

test('worksheet path aliases cannot bypass sparse coordinate preflight', async () => {
    for (const name of ['/xl/worksheets/sheet1.xml', 'prefix/xl/worksheets/sheet1.xml', 'xl/worksheets/sheet1.xml.extra']) {
        const zip = new JSZip();
        zip.file(name, '<worksheet><sheetData><row r="9999999"/></sheetData></worksheet>');
        await assert.rejects(readParticipantExcel(new File([await zip.generateAsync({ type: 'nodebuffer' })], 'alias.xlsx')), /500/);
    }
});
test('workbook sheet IDs are bounded before allocating the workbook', async () => {
    for (const name of ['xl/workbook.xml', '/xl/workbook.xml']) {
        const zip = new JSZip();
        zip.file(name, '<workbook><sheets><sheet name="Peserta" sheetId="999999999"/></sheets></workbook>');
        await assert.rejects(readParticipantExcel(new File([await zip.generateAsync({ type: 'nodebuffer' })], 'id.xlsx')), /ID lembar/);
    }
});

function draftFixture() {
    const event = { id: randomUUID(), owner_id: owner.authId }, row = { id: randomUUID(), name: 'Awal', institution: '', identities: {}, revision: 1, status: 'draft' };
    const db = {
        async $queryRaw(sql) {
            assert.match(sql.text, /FROM ecert_events/);
            return sql.values[1] || sql.values[2] === owner.authId ? [event] : [];
        },
        async $executeRaw(sql) {
            if (/INSERT INTO ecert_audit/.test(sql.text)) return 1;
            assert.match(sql.text, /revision=revision\+1/);
            assert.match(sql.text, /AND revision=/);
            const [name, institution, identities, id, eventId, revision] = sql.values;
            if (row.status !== 'draft' || row.revision !== revision || row.id !== id || event.id !== eventId) return 0;
            Object.assign(row, { name, institution, identities: JSON.parse(identities), revision: revision + 1 }); return 1;
        },
        async $transaction(callback) { return callback(db); },
    };
    return { service: new CertificateService(db), event, row };
}
test('draft update increments revision and rejects stale, missing and invalid revisions', async () => {
    const { service, event, row } = draftFixture();
    const first = { ...row, name: 'Perubahan pertama' };
    await service.updateDraft(owner, event.id, row.id, first);
    assert.equal(row.revision, 2);
    for (const revision of [1, undefined, '2', 0, -1, 1.5]) await assert.rejects(service.updateDraft(owner, event.id, row.id, { ...first, name: 'Data lama', revision }), conflict);
    assert.equal(row.name, 'Perubahan pertama');
});
test('two concurrent saves from the same revision have one winner', async () => {
    const { service, event, row } = draftFixture(), original = { ...row };
    const results = await Promise.allSettled(['Satu', 'Dua'].map(name => service.updateDraft(owner, event.id, row.id, { ...original, name })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
    assert.equal(row.revision, 2);
});
test('revision checks preserve owner scope and issued certificate immutability', async () => {
    const { service, event, row } = draftFixture();
    await assert.rejects(service.updateDraft({ ...owner, authId: 'other' }, event.id, row.id, row), error => error.status === 404);
    row.status = 'issued';
    await assert.rejects(service.updateDraft(owner, event.id, row.id, row), conflict);
    assert.equal(row.name, 'Awal');
});

function listFixture() {
    const events = Array.from({ length: 251 }, (_, i) => ({ id: String(i), owner_id: i === 250 ? 'other' : 'owner', title: `Kegiatan ${String(i).padStart(3, '0')}`, organizer: 'MAN', archived: i % 2 === 0 }));
    const queries = [];
    const db = { async $queryRaw(sql) {
        queries.push(sql);
        const [admin, authId, all, archived, empty, search] = sql.values;
        assert.match(sql.text, /owner_id=/); assert.match(sql.text, /strpos\(lower/);
        const filtered = events.filter(event => (admin || event.owner_id === authId) && (all || event.archived === archived) && (empty || `${event.title} ${event.organizer}`.toLowerCase().includes(search)));
        if (/SELECT count\(\*\)/.test(sql.text)) return [{ total: filtered.length }];
        assert.match(sql.text, /ORDER BY e.created_at DESC,e.id DESC LIMIT/);
        const [size, offset] = sql.values.slice(-2); return filtered.slice(offset, offset + size);
    } };
    return { service: new CertificateService(db), queries };
}
test('pagination reaches owner events beyond the former 200-event limit', async () => {
    const { service } = listFixture();
    const result = await service.list(owner, new URLSearchParams({ page: '11' }));
    assert.equal(result.total, 250); assert.equal(result.page, 11); assert.equal(result.items.length, 10);
    assert.equal(result.items.at(-1).title, 'Kegiatan 249');
});
test('search and archive filters apply on the server before pagination', async () => {
    const { service } = listFixture();
    const result = await service.list(owner, new URLSearchParams({ q: 'Kegiatan 249', status: 'active' }));
    assert.equal(result.total, 1); assert.equal(result.items[0].id, '249');
    assert.equal((await service.list(owner, new URLSearchParams({ q: 'Kegiatan 250' }))).total, 0);
    assert.equal((await service.list({ ...owner, isAdmin: true }, new URLSearchParams({ q: 'Kegiatan 250' }))).total, 1);
    assert.equal((await service.list(owner, new URLSearchParams({ q: '%' }))).total, 0);
});
test('pagination clamps an obsolete page and rejects invalid or excessive parameters', async () => {
    const { service } = listFixture();
    assert.equal((await service.list(owner, new URLSearchParams({ page: '1000' }))).page, 11);
    for (const value of ['page=0', 'page=-1', 'page=1.5', 'page=99999999', 'pageSize=101', 'status=unknown', `q=${'x'.repeat(201)}`])
        await assert.rejects(service.list(owner, new URLSearchParams(value)), error => error.status === 400);
});

function rateFixture() {
    const buckets = new Map(); let now = 0;
    const db = {
        async $queryRaw(sql) {
            if (/INSERT INTO ecert_public_limits/.test(sql.text)) {
                assert.match(sql.text, /ON CONFLICT\(bucket\) DO UPDATE/);
                assert.match(sql.text, /WHERE ecert_public_limits.expires_at<=now\(\) OR ecert_public_limits.hits</);
                const [key, limit] = sql.values; let bucket = buckets.get(key);
                if (!bucket || bucket.expires <= now) { bucket = { hits: 0, expires: now + 60000 }; buckets.set(key, bucket); }
                if (bucket.hits >= limit) return [];
                return [{ hits: ++bucket.hits }];
            }
            if (/FROM ecert_recipients/.test(sql.text)) return [{ event_id: randomUUID(), status: 'issued', certificate_number: 'TEST/1', snapshot: { name: 'Peserta', institution: 'MAN', event: {}, template: {} } }];
            if (/FROM ecert_assets/.test(sql.text)) return [];
            throw new Error('Unexpected query');
        },
        async $executeRaw(sql) {
            assert.match(sql.text, /DELETE FROM ecert_public_limits WHERE expires_at<now\(\)-interval '60 seconds'/);
            for (const [key, bucket] of buckets) if (bucket.expires < now - 60000) buckets.delete(key);
            return 0;
        },
    };
    return { db, buckets, advance: value => { now += value; } };
}
test('public limit survives handler recreation and spoofed forwarding headers', async () => {
    const f = rateFixture(), { NextRequest } = require('next/server');
    const stubs = { '../prisma': { prisma: f.db }, '../api-auth': { getApiUser: async () => null } };
    const workers = [modules(stubs)('http'), modules(stubs)('http')];
    const token = 'a'.repeat(48);
    for (let i = 0; i < 120; i++) {
        const response = await workers[i % 2].publicRead(new NextRequest(`http://localhost/api/public/e-sertifikat/${token}`, { headers: { 'x-forwarded-for': `198.51.100.${i}` } }), [token]);
        assert.equal(response.status, 200);
    }
    const response = await modules(stubs)('http').publicRead(new NextRequest(`http://localhost/${token}`, { headers: { 'x-forwarded-for': '203.0.113.100', 'cf-connecting-ip': '203.0.113.101' } }), [token]);
    assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(f.buckets.size, 2);
});
test('global limit prevents token rotation from bypassing limits or unbounded bucket growth', async () => {
    const f = rateFixture();
    for (let i = 0; i < 1200; i++) await limitPublicCertificateRequest(f.db, i.toString(16).padStart(48, '0'));
    await assert.rejects(limitPublicCertificateRequest(f.db, 'f'.repeat(48)), error => error.status === 429);
    assert.equal(f.buckets.size, 1201);
});
test('concurrent requests share an atomic token allowance', async () => {
    const f = rateFixture();
    const results = await Promise.allSettled(Array.from({ length: 150 }, () => limitPublicCertificateRequest(f.db, 'b'.repeat(48))));
    assert.equal(results.filter(value => value.status === 'fulfilled').length, 120);
    assert(results.filter(value => value.status === 'rejected').every(value => value.reason.status === 429));
});
test('expired buckets are reset and cleaned without clearing active counters', async () => {
    const f = rateFixture();
    await limitPublicCertificateRequest(f.db, 'a'.repeat(48));
    f.advance(120001);
    await limitPublicCertificateRequest(f.db, 'b'.repeat(48));
    assert.equal(f.buckets.size, 2); assert.equal(f.buckets.get('global').hits, 1);
    await assert.rejects(limitPublicCertificateRequest(f.db, 'bad'), error => error.status === 404);
    assert.equal(f.buckets.size, 2);
});
test('new event dates and certificate prefix year follow school timezone at midnight/year boundary', () => {
    const now = new Date('2026-12-31T16:30:00Z');
    const wita = createEventDraft('Asia/Makassar', now), wib = createEventDraft('Asia/Jakarta', now);
    assert.equal(wita.start_date, '2027-01-01'); assert.equal(wita.end_date, '2027-01-01'); assert.match(wita.number_prefix, /^ACCA-2027-/);
    assert.equal(wib.start_date, '2026-12-31'); assert.match(wib.number_prefix, /^ACCA-2026-/);
    assert.equal(createEventDraft(undefined, now).start_date, wita.start_date);
    assert.equal(createEventDraft('Asia/Jayapura', new Date('2026-10-20T15:30:00Z')).start_date, '2026-10-21');
});
