const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/surat/surat.service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText, { module: mod, exports: mod.exports, require, Date, console });
const { SuratService } = mod.exports;
const owner = { auth_id: 'owner', roles: ['GURU'] };

function setup() {
  let letters = new Map(), documents = new Map();
  let failPublish = false;
  const db = {
    surat: {
      async findUnique({ where }) { return letters.get(where.id) || null; },
      async findMany({ cursor, take }) { return [...letters.values()].filter(row => row.status === 'FINAL' && row.file_url !== null && (!cursor || row.id > cursor.id)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, take); },
      async create({ data }) {
        const row = { id: 'letter-1', status: 'DRAFT', jenis_surat: 'EDARAN_AKADEMIK', nomor_surat: '001/A/X/2026', perkara: 'Edaran kegiatan', file_url: null, file_size: null, storage_type: 'cloudflare', ...data };
        letters.set(row.id, row); return row;
      },
      async update({ where, data }) { const row = { ...letters.get(where.id), ...data }; letters.set(where.id, row); return row; },
      async delete({ where }) { letters.delete(where.id); },
    },
    informasi_akademik: {
      async deleteMany({ where }) { documents.delete(where.id); },
      async upsert({ where, create, update }) {
        if (failPublish) throw new Error('Publication unavailable');
        documents.set(where.id, documents.has(where.id) ? { ...documents.get(where.id), ...update } : create);
      },
    },
    async $transaction(fn) {
      const oldLetters = new Map(letters), oldDocuments = new Map(documents);
      try { return await fn(db); } catch (err) { letters = oldLetters; documents = oldDocuments; throw err; }
    },
  };
  return { service: new SuratService(db), get letters() { return letters; }, get docs() { return documents; }, fail(value = true) { failPublish = value; } };
}

test('drafts stay private; final academic PDF is linked to Surat Edaran', async () => {
  const ctx = setup();
  const draft = await ctx.service.createSurat({}, owner);
  assert.equal(ctx.docs.size, 0);
  const final = await ctx.service.updateSurat(draft.data.id, { status: 'FINAL', file_url: 'https://files.example/final.pdf' }, owner);
  assert.equal(final.informasiCategory, '[Akademik] Surat Edaran');
  const doc = ctx.docs.get(draft.data.id);
  assert.equal(doc.file_url, final.data.file_url);
  assert.equal(doc.title, '001-A-X-2026_Edaran kegiatan');
  assert.equal(doc.audience, 'umum');
  assert.equal(doc.show_on_landing, true);
});

test('kesiswaan is routed correctly for dropdown code and readable label', async () => {
  for (const jenis of ['EDARAN_KESISWAAN', 'Surat Edaran Kesiswaan']) {
    const ctx = setup();
    await ctx.service.createSurat({ jenis_surat: jenis, status: 'FINAL', file_url: 'https://files.example/surat.pdf' }, owner);
    assert.equal(ctx.docs.get('letter-1').category, '[Kesiswaan] Surat Edaran');
  }
});

test('repeated finalization updates one document and preserves audience settings', async () => {
  const ctx = setup();
  await ctx.service.createSurat({ status: 'FINAL', file_url: 'https://files.example/v1.pdf' }, owner);
  ctx.docs.get('letter-1').audience = 'guru';
  ctx.docs.get('letter-1').show_on_landing = true;
  await ctx.service.updateSurat('letter-1', { perkara: 'Judul revisi', file_url: 'https://files.example/v2.pdf', jenis_surat: 'EDARAN_KESISWAAN' }, owner);
  assert.equal(ctx.docs.size, 1);
  const doc = ctx.docs.get('letter-1');
  assert.equal(doc.title, '001-A-X-2026_Judul revisi');
  assert.equal(doc.file_url, 'https://files.example/v2.pdf');
  assert.equal(doc.category, '[Kesiswaan] Surat Edaran');
  assert.equal(doc.audience, 'guru');
  assert.equal(doc.show_on_landing, true);
});

test('other letters, ambiguous division, draft and missing PDF do not publish', async () => {
  for (const data of [
    { jenis_surat: 'UNDANGAN_AKADEMIK' },
    { jenis_surat: 'EDARAN_UMUM' },
    { jenis_surat: 'EDARAN_AKADEMIK_KESISWAAN' },
    { status: 'DRAFT' },
    { file_url: null },
    { file_url: '  ' },
  ]) {
    const ctx = setup();
    await ctx.service.createSurat({ status: 'FINAL', file_url: 'https://files.example/file.pdf', ...data }, owner);
    assert.equal(ctx.docs.size, 0);
  }
});

test('deleting a letter removes its linked information document only', async () => {
  const ctx = setup();
  await ctx.service.createSurat({ status: 'FINAL', file_url: 'https://files.example/file.pdf' }, owner);
  ctx.docs.set('manual', { title: 'Manual upload' });
  await ctx.service.deleteSurat('letter-1', owner);
  assert.equal(ctx.docs.has('letter-1'), false);
  assert.equal(ctx.docs.has('manual'), true);
  assert.equal(ctx.letters.size, 0);
});

test('failed publication rolls back finalization; retry publishes successfully', async () => {
  const ctx = setup();
  await ctx.service.createSurat({}, owner);
  ctx.fail();
  await assert.rejects(ctx.service.updateSurat('letter-1', { status: 'FINAL', file_url: 'https://files.example/file.pdf' }, owner), /Publication unavailable/);
  assert.equal(ctx.letters.get('letter-1').status, 'DRAFT');
  assert.equal(ctx.docs.size, 0);
  ctx.fail(false);
  await ctx.service.updateSurat('letter-1', { status: 'FINAL', file_url: 'https://files.example/file.pdf' }, owner);
  assert.equal(ctx.docs.size, 1);
  assert.equal(ctx.letters.get('letter-1').status, 'FINAL');
});

test('another user cannot publish or delete the letter', async () => {
  const ctx = setup();
  await ctx.service.createSurat({}, owner);
  const stranger = { auth_id: 'other', roles: ['GURU'] };
  await assert.rejects(ctx.service.updateSurat('letter-1', { status: 'FINAL' }, stranger), /berhak/);
  await assert.rejects(ctx.service.deleteSurat('letter-1', stranger), /berhak/);
  assert.equal(ctx.letters.size, 1);
  assert.equal(ctx.docs.size, 0);
});

const { suratFileName } = require('../../../packages/shared/surat-document.cjs');
test('names include letter number and subject with unsafe filename characters removed', () => {
  assert.equal(suratFileName('001/A/X/2026', 'Edaran KBM'), '001-A-X-2026_Edaran KBM.pdf');
  assert.equal(suratFileName('001', 'Ujian: kelas "X"?'), '001_Ujian- kelas -X--.pdf');
  assert.equal(suratFileName('', ''), 'Surat.pdf');
  assert.ok(!/[\\/:*?"<>|\r\n]/.test(suratFileName('001', 'test\r\nheader')));
});
test('backfill previews without writing, then syncs old letters once across batches', async () => {
  const ctx = setup();
  for (let i = 0; i < 105; i++) {
    await ctx.service.createSurat({ id: `letter-${String(i).padStart(3, '0')}`, status: 'FINAL', file_url: `https://files.example/${i}.pdf` }, owner);
  }
  ctx.docs.clear();
  await ctx.service.createSurat({ id: 'unrelated', jenis_surat: 'UNDANGAN', status: 'FINAL', file_url: 'https://files.example/other.pdf' }, owner);
  const preview = await ctx.service.syncExistingEdaran();
  assert.equal(preview.eligible, 105);
  assert.equal(preview.synced, 0);
  assert.equal(ctx.docs.size, 0);
  const applied = await ctx.service.syncExistingEdaran(true);
  assert.equal(applied.scanned, 106);
  assert.equal(applied.synced, 105);
  assert.equal(applied.failed.length, 0);
  const repeated = await ctx.service.syncExistingEdaran(true);
  assert.equal(repeated.synced, 105);
  assert.equal(ctx.docs.size, 105);
});

test('legacy generic edaran uses department in letter number, never arbitrary subject text', async () => {
  const { edaranDivision } = require('../../../packages/shared/surat-document.cjs');
  assert.equal(edaranDivision({ jenis_surat: 'SURAT_EDARAN', nomor_surat: '007/G/AKADEMIK/IX/2026' }), 'Akademik');
  assert.equal(edaranDivision({ jenis_surat: 'SURAT_EDARAN', nomor_surat: '007/G/KESISWAAN/IX/2026' }), 'Kesiswaan');
  assert.equal(edaranDivision({ jenis_surat: 'SURAT_EDARAN', pejabat_jabatan: 'WKM Kesiswaan' }), 'Kesiswaan');
  assert.equal(edaranDivision({ jenis_surat: 'UNDANGAN', nomor_surat: '007/G/AKADEMIK/IX/2026' }), null);
  assert.equal(edaranDivision({ jenis_surat: 'SURAT_EDARAN', perkara: 'Akademik' }), null);
  assert.equal(edaranDivision({ jenis_surat: 'SURAT_EDARAN', nomor_surat: 'AKADEMIK/KESISWAAN', pejabat_jabatan: 'WKM Akademik' }), null);
});
