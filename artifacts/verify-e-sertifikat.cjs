const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { Client } = require('pg');
require('dotenv').config({ path: 'apps/api/.env', quiet: true });
const schema = `ecert_test_${Date.now()}`;
const connection = { connectionString: process.env.DATABASE_URL };
const output = path.resolve(process.env.ECERT_TEST_OUTPUT_DIR || 'output/pdf');
const reportPath = process.env.ECERT_TEST_REPORT_PATH || 'artifacts/e-sertifikat-test-results.json';

// A real PostgreSQL schema isolates all test writes from application data.
(async () => {
  fs.mkdirSync('scratch', { recursive: true }); fs.mkdirSync(output, { recursive: true });
  await require('esbuild').build({ entryPoints: ['apps/web/lib/e-sertifikat/service.ts', 'apps/web/lib/e-sertifikat/pdf.ts', 'apps/web/lib/e-sertifikat/excel.ts', 'apps/web/lib/e-sertifikat/validation.ts', 'apps/web/lib/e-sertifikat/model.ts', 'apps/web/lib/e-sertifikat/geometry.ts', 'apps/web/lib/e-sertifikat/layout.ts'], outdir: 'scratch/ecert-test', bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
  const { CertificateService, assertManager } = require('../scratch/ecert-test/service');
  const { renderCertificate, validateAsset } = require('../scratch/ecert-test/pdf');
  const { readParticipantExcel } = require('../scratch/ecert-test/excel');
  const { validateTemplate, validateRecipients, validateEvent } = require('../scratch/ecert-test/validation');
  const { pointTemplate, newSigner, changeLayer, mmToPt } = require('../scratch/ecert-test/layout');
  const { templateGeometry } = require('../scratch/ecert-test/geometry');
  const { DEFAULT_TEMPLATE } = require('../scratch/ecert-test/model');
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const owner = { authId: 'owner', isAdmin: false, pages: ['e-sertifikat'], roles: ['GURU'] };
  const other = { ...owner, authId: 'other' }, admin = { ...owner, authId: 'admin', isAdmin: true };
  let checks = 0;
  const pass = () => ++checks;
  const rejects = async (fn, match) => { await assert.rejects(fn, match); pass(); };
  const root = new Client(connection); await root.connect();
  const adapter = client => ({
    $queryRaw: async sql => (await client.query(sql.text, sql.values)).rows,
    $executeRaw: async sql => (await client.query(sql.text, sql.values)).rowCount,
    $transaction: async callback => {
      const tx = new Client(connection); await tx.connect();
      try { await tx.query(`SET search_path TO "${schema}"`); await tx.query('BEGIN'); const result = await callback(adapter(tx)); await tx.query('COMMIT'); return result; }
      catch (error) { await tx.query('ROLLBACK'); throw error; } finally { await tx.end(); }
    },
  });
  try {
    await root.query(`CREATE SCHEMA "${schema}"`); await root.query(`SET search_path TO "${schema}"`);
    const migration = fs.readFileSync('apps/api/prisma/sql/20261016_e_sertifikat.sql', 'utf8');
    await root.query(migration); await root.query(migration); pass(); // Re-running a deploy migration is safe.
    const hardening = fs.readFileSync('apps/api/prisma/sql/20261021_e_sertifikat_hardening.sql', 'utf8');
    await root.query(hardening); await root.query(hardening); pass();
    const service = new CertificateService(adapter(root));
    assert.throws(() => assertManager(null), /masuk/); pass();
    assert.throws(() => assertManager({ ...owner, roles: ['SISWA'] }), /akses/); pass();
    assert.throws(() => assertManager({ ...owner, pages: [] }), /akses/); pass();
    assert.throws(() => validateEvent(null), /tidak valid/); pass();
    assert.throws(() => validateTemplate({ ...DEFAULT_TEMPLATE, qr: { x: 95, y: 70, size: 12 } })); pass();
    assert.throws(() => validateRecipients([{ id: randomUUID(), name: '', institution: '' }])); pass();
    assert.throws(() => validateRecipients([{ id: randomUUID(), name: 'Peserta', identities: JSON.parse('{"__proto__":"bad"}') }])); pass();
    let event = await service.saveEvent(owner, { title: 'Lokakarya Pembelajaran Kreatif', organizer: 'MAN Insan Cendekia Gowa', description: 'Pengembangan kompetensi pendidik melalui kegiatan kolaboratif.', location: 'Gowa', start_date: '2026-10-16', end_date: '2026-10-16', number_prefix: `TEST-${Date.now()}`, template: DEFAULT_TEMPLATE });
    await rejects(() => service.event(other, event.id), /tidak ditemukan/);
    assert.equal((await service.list(other)).total, 0); pass();
    assert.equal((await service.list(admin)).total, 1); pass();
    await rejects(() => service.saveEvent(owner, { ...event, revision: 0 }, event.id), /berubah/);
    const templatePdf = await PDFDocument.create(); const page = templatePdf.addPage([841.89, 595.28]);
    const bold = await templatePdf.embedFont(StandardFonts.HelveticaBold), normal = await templatePdf.embedFont(StandardFonts.Helvetica);
    page.drawRectangle({ x: 0, y: 0, width: 841.89, height: 595.28, color: rgb(.98, .985, 1) });
    page.drawRectangle({ x: 22, y: 22, width: 797.89, height: 551.28, borderWidth: 2, borderColor: rgb(.15, .4, .8) });
    page.drawText('ACCA', { x: 60, y: 520, font: bold, size: 22, color: rgb(.15,.4,.8) });
    page.drawText('SERTIFIKAT', { x: 285, y: 465, font: bold, size: 38, color: rgb(.08,.18,.34) });
    page.drawText('Diberikan kepada', { x: 352, y: 405, font: normal, size: 16, color: rgb(.3,.4,.5) });
    page.drawText('Lokakarya Pembelajaran Kreatif', { x: 260, y: 175, font: bold, size: 20, color: rgb(.08,.18,.34) });
    page.drawText('Gowa, 16 Oktober 2026', { x: 90, y: 95, font: normal, size: 12 });
    page.drawText('Panitia Kegiatan', { x: 90, y: 70, font: bold, size: 12 });
    const templateBytes = await templatePdf.save(); fs.writeFileSync(path.join(output, 'template-e-sertifikat-contoh.pdf'), templateBytes);
    const validated = await validateAsset(new File([templateBytes], 'template.pdf', { type: 'application/pdf' }), 'template'); pass();
    const oversizedPng=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(oversizedPng);oversizedPng.write('IHDR',12);oversizedPng.writeUInt32BE(100000,16);oversizedPng.writeUInt32BE(100000,20);
    await rejects(()=>validateAsset(new File([oversizedPng],'oversized.png'),'template'),/24 megapiksel/);
    const multi = await PDFDocument.create(); multi.addPage(); multi.addPage();
    await rejects(() => validateAsset(new File([Buffer.from('%PDF-bad')], 'fake.pdf'), 'template'));
    await rejects(() => validateAsset(new File([Buffer.from('bad')], 'fake.png'), 'template'));
    const multiBytes = await multi.save();
    await rejects(() => validateAsset(new File([multiBytes], 'multi.pdf'), 'template'), /satu halaman/);
    const asset = await service.addAsset(owner, event.id, { kind: 'template', filename: 'template.pdf', mime: validated.mime, bytes: Buffer.from(validated.bytes) });
    event = await service.saveEvent(owner, { ...event, template: { ...DEFAULT_TEMPLATE, assetId: asset.id } }, event.id);
    const rows = [{ id: randomUUID(), name: 'Amelia Putri', institution: 'Sekolah Contoh Gowa', identities: { Peran: 'Peserta' } }, { id: randomUUID(), name: 'Budi Santoso', institution: 'Sekolah Contoh Makassar', identities: { Peran: 'Peserta' } }];
    assert.equal((await service.importRecipients(owner, event.id, rows)).count, 2); pass();
    assert.equal((await service.importRecipients(owner, event.id, rows)).count, 0); pass();
    await service.updateDraft(owner, event.id, rows[1].id, { ...rows[1], revision: 1, institution: 'Sekolah Contoh Sulawesi' });
    await rejects(() => service.updateDraft(owner, event.id, rows[1].id, { ...rows[1], revision: 1 }), /berubah/);
    assert.equal((await service.detail(owner, event.id)).recipients.find(row => row.id === rows[1].id).institution, 'Sekolah Contoh Sulawesi'); pass();
    await rejects(() => service.issue(other, event.id, [rows[0].id]), /tidak ditemukan/);
    await rejects(() => service.issue(owner, event.id, [rows[0].id], async () => { throw new Error('Render gagal'); }), /Render gagal/);
    assert((await service.detail(owner, event.id)).recipients.every(row => row.status === 'draft')); pass();
    const concurrent = await Promise.all([service.issue(owner, event.id, [rows[0].id]), service.issue(owner, event.id, [rows[0].id])]);
    assert.equal(concurrent.reduce((sum, result) => sum + result.count, 0), 1); pass();
    await service.issue(owner, event.id, [rows[1].id]);
    const certificate = await service.certificate(owner, event.id, rows[0].id);
    await rejects(() => service.updateDraft(owner, event.id, rows[0].id, { ...rows[0], revision: 1 }), /bukan draf/);
    await rejects(() => service.removeDraft(owner, event.id, rows[0].id), /Hanya peserta/);
    await rejects(() => service.removeAsset(owner, event.id, asset.id), /Ganti template/);
    assert(certificate.certificate_number.endsWith('/0001')); pass();
    assert.equal(certificate.verify_token.length, 48); pass();
    const doc = await service.addAsset(owner, event.id, { kind: 'correspondence', filename: 'surat-kegiatan.pdf', mime: validated.mime, bytes: Buffer.from(templateBytes) });
    assert.equal((await service.verification(certificate.verify_token)).assets.length, 0); pass();
    await rejects(() => service.asset(null, null, doc.id, certificate.verify_token), /tidak ditemukan/);
    await service.visibility(owner, event.id, doc.id, true);
    const publicRecord = await service.verification(certificate.verify_token);
    assert.equal(publicRecord.assets.length, 1); pass();
    assert(!('identities' in publicRecord) && !('snapshot' in publicRecord) && !('template' in publicRecord)); pass();
    await service.asset(null, null, doc.id, certificate.verify_token); pass();
    await rejects(() => service.asset(null, null, asset.id, certificate.verify_token), /tidak ditemukan/);
    await rejects(() => service.visibility(owner, event.id, asset.id, true), /tidak ditemukan/);
    const second = await service.saveEvent(other, { ...event, number_prefix: 'OTHER', template: DEFAULT_TEMPLATE });
    await rejects(() => service.saveEvent(owner, { ...event, template: { ...event.template, assetId: doc.id } }, event.id), /Template/);
    await rejects(() => service.importRecipients(other, second.id, [rows[0]]), /sudah digunakan/);
    event = await service.saveEvent(owner, { ...event, title: 'Judul baru setelah terbit' }, event.id);
    assert.equal((await service.verification(certificate.verify_token)).event.title, 'Lokakarya Pembelajaran Kreatif'); pass();
    await rejects(() => root.query('UPDATE ecert_recipients SET name=$1 WHERE id=$2', ['Pemalsuan', rows[0].id]), /immutable/);
    const url = `https://acca.icgowa.sch.id/e-sertifikat/verifikasi/${certificate.verify_token}`;
    const pdf = await renderCertificate(certificate.snapshot, certificate.certificate_number, url, validated);
    fs.writeFileSync(path.join(output, 'e-sertifikat-contoh.pdf'), pdf);
    assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1); pass();
    const { createCanvas } = require('canvas');
    for (const [mime, width, height] of [['image/png',1200,848],['image/jpeg',848,1200]]) {
      const canvas = createCanvas(width,height); const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0,0,width,height);
      const bytes = canvas.toBuffer(mime);
      const validatedImage = await validateAsset(new File([bytes], mime==='image/png'?'template.png':'template.jpg', {type:mime}), 'template');
      const rendered = await PDFDocument.load(await renderCertificate(certificate.snapshot,certificate.certificate_number,url,validatedImage));
      const size = rendered.getPages()[0].getSize(); assert.equal(rendered.getPageCount(),1); assert.equal(size.width>size.height,width>height); pass();
    }
    // Native geometry, precision, individual identities and signer snapshots.
    const native = await templateGeometry(validated);
    let point = pointTemplate({ ...DEFAULT_TEMPLATE, assetId: asset.id }, native, ['Peran']);
    const signer = { ...newSigner(native), name: 'Imran, S.Si.', title: 'Ketua Panitia', nameLayout: { ...newSigner(native).nameLayout, x: 400, y: 480 }, titleLayout: { ...newSigner(native).titleLayout, x: 400, y: 502 } };
    point.signers = [signer]; point = changeLayer(point, 'name', { x: mmToPt(25.01), y: mmToPt(80.02), width: mmToPt(240) });
    assert.equal(validateTemplate(point).unit, 'pt'); assert.equal(validateTemplate(point).signers[0].title, 'Ketua Panitia'); pass();
    assert.throws(() => validateTemplate({ ...point, qr: { ...point.qr, x: native.width } }), /batas/); pass();
    assert.throws(() => validateTemplate({ ...point, identityFields: JSON.parse('{"__proto__":{}}') }), /kolom/); pass();
    await rejects(() => service.saveEvent(owner, { ...event, template: { ...point, page: { width: 999, height: 999 } } }, event.id), /Ukuran tata letak/);
    event = await service.saveEvent(owner, { ...event, template: { ...point, signers: [] } }, event.id);
    const preciseRow = { id: randomUUID(), name: 'Amelia Putri', institution: 'Sekolah Contoh Gowa', identities: { Peran: 'Peserta' } };
    await service.importRecipients(owner, event.id, [preciseRow]);
    await rejects(() => service.issue(owner, event.id, [preciseRow.id]), /penandatangan/);
    event = await service.saveEvent(owner, { ...event, template: point }, event.id);
    await service.issue(owner, event.id, [preciseRow.id], (snapshot, number, asset) => renderCertificate(snapshot, number, url, asset)); pass();
    const preciseCertificate = await service.certificate(owner, event.id, preciseRow.id);
    const precisePublic = await service.verification(preciseCertificate.verify_token);
    assert.deepEqual(precisePublic.signers, [{ name: signer.name, title: signer.title }]); pass();
    assert(Math.abs(preciseCertificate.snapshot.template.name.x - mmToPt(25.01)) < .0001); pass();
    const precisePdf = await renderCertificate(preciseCertificate.snapshot, preciseCertificate.certificate_number, `https://acca.icgowa.sch.id/e-sertifikat/verifikasi/${preciseCertificate.verify_token}`, validated);
    fs.writeFileSync(path.join(output, 'e-sertifikat-contoh.pdf'), precisePdf);
    assert.deepEqual((await PDFDocument.load(precisePdf)).getPage(0).getSize(), { width: native.width, height: native.height }); pass();
    event = await service.saveEvent(owner, { ...event, template: { ...point, signers: [{ ...signer, name: 'Nama baru' }] } }, event.id);
    assert.equal((await service.verification(preciseCertificate.verify_token)).signers[0].name, signer.name); pass();
    for (const resolution of [undefined, 300]) {
      const canvas = createCanvas(1200, 848), ctx = canvas.getContext('2d'); ctx.fillStyle='white';ctx.fillRect(0,0,1200,848);
      const bytes=canvas.toBuffer('image/png', resolution ? { resolution } : undefined), asset={mime:'image/png',bytes};
      const geometry=await templateGeometry(asset), expected=1200*72/(resolution||96);
      assert(Math.abs(geometry.width-expected)<.05); pass();
      const snapshot={...preciseCertificate.snapshot,template:pointTemplate({...DEFAULT_TEMPLATE,assetId:null},geometry)};
      const rendered=await PDFDocument.load(await renderCertificate(snapshot,'TEST/0001',url,asset));
      assert(Math.abs(rendered.getPage(0).getWidth()-expected)<.05); pass();
    }
    for (const rotation of [90,180,270]) {
      const rotated = await PDFDocument.create(), source = rotated.addPage([600,400]);source.setRotation(require('pdf-lib').degrees(rotation)); source.drawText('ROTATED TEMPLATE',{x:20,y:350,size:20});
      const asset={mime:'application/pdf',bytes:await rotated.save()}, geometry=await templateGeometry(asset);
      assert.equal(geometry.width, rotation===180?600:400); assert.equal(geometry.height,rotation===180?400:600);
      const snapshot={...preciseCertificate.snapshot,template:pointTemplate({...DEFAULT_TEMPLATE,assetId:null},geometry)};
      const rendered=await PDFDocument.load(await renderCertificate(snapshot,'TEST/0001',url,asset));
      assert.equal(rendered.getPage(0).getWidth(),geometry.width);pass();
    }
    event=await service.saveEvent(owner,{...event,template:{...DEFAULT_TEMPLATE,assetId:asset.id}},event.id);
    await service.revoke(owner, event.id, rows[0].id, 'Data penerima perlu diperbaiki');
    const revoked = await service.verification(certificate.verify_token);
    assert.equal(revoked.status, 'revoked'); assert.equal(revoked.assets.length, 0); pass();
    await rejects(() => service.certificate(owner, event.id, rows[0].id), /tidak ditemukan/);
    await rejects(() => service.asset(null, null, doc.id, certificate.verify_token), /tidak ditemukan/);
    await rejects(() => service.revoke(owner, event.id, rows[0].id, 'ulang'), /tidak berstatus/);
    await rejects(() => service.verification('wrong'), /tidak ditemukan/);
    await service.removeAsset(owner, event.id, doc.id);
    await rejects(() => service.asset(owner, event.id, doc.id), /tidak ditemukan/);
    event = await service.saveEvent(owner, { ...event, template: { ...event.template, assetId: null } }, event.id);
    await rejects(() => service.removeAsset(owner, event.id, asset.id), /dipertahankan/);
    // Route-level checks use the real handlers and the isolated database adapter.
    global.__ecertDb = adapter(root); global.__ecertUser = null;
    await require('esbuild').build({ entryPoints: ['apps/web/lib/e-sertifikat/http.ts'], outfile: 'scratch/ecert-test/http.cjs', bundle: true, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'boundary', setup(build) {
      build.onResolve({ filter: /^\.\.\/(prisma|api-auth)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('/prisma') ? 'export const prisma=globalThis.__ecertDb' : 'export const getApiUser=async()=>globalThis.__ecertUser', loader: 'js' }));
    } }] });
    const { manage, publicRead } = require('../scratch/ecert-test/http.cjs'), { NextRequest } = require('next/server');
    assert.equal((await manage(new NextRequest('http://localhost:3006/api/e-sertifikat'))).status, 401); pass();
    global.__ecertUser = owner;
    await root.query("CREATE TABLE master_guru(id bigint,nama_lengkap text); INSERT INTO master_guru VALUES(9007199254740993,'Nama Penandatangan Uji')");
    const signersResponse=await manage(new NextRequest('http://localhost:3006/api/e-sertifikat/signers'),['signers']); assert.equal(signersResponse.status,200); assert.equal((await signersResponse.json()).data[0].id,'9007199254740993');pass();
    assert.equal((await manage(new NextRequest('http://localhost:3006/api/e-sertifikat', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' }))).status, 403); pass();
    assert.equal((await manage(new NextRequest('http://localhost:3006/api/e-sertifikat', { method: 'POST', body: 'x'.repeat(2*1024*1024+1) }))).status, 413); pass();
    assert.equal((await manage(new NextRequest('http://localhost:3006/api/e-sertifikat', { method: 'POST', body: 'null' }))).status, 400); pass();
    const geometryResponse = await manage(new NextRequest(`http://localhost:3006/api/e-sertifikat/${event.id}/geometry/${asset.id}`), [event.id,'geometry',asset.id]);
    assert.equal(geometryResponse.status,200); assert.equal((await geometryResponse.json()).data.width,native.width);pass();
    const unsavedPreview=await manage(new NextRequest(`http://localhost:3006/api/e-sertifikat/${event.id}/preview`,{method:'POST',body:JSON.stringify({template:point,name:'Pratinjau Belum Disimpan',identities:{Peran:'Narasumber'}})}),[event.id,'preview']);
    assert.equal(unsavedPreview.status,200);pass();
    const wrongPreview=await manage(new NextRequest(`http://localhost:3006/api/e-sertifikat/${event.id}/preview`,{method:'POST',body:JSON.stringify({template:{...point,page:{width:999,height:999}}})}),[event.id,'preview']);
    assert.equal(wrongPreview.status,400);pass();
    const liveCertificate = await service.certificate(owner, event.id, rows[1].id);
    const response = await manage(new NextRequest(`http://localhost:3006/api/e-sertifikat/${event.id}/certificates/${rows[1].id}/pdf`), [event.id, 'certificates', rows[1].id, 'pdf']);
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf'); pass();
    const zipResponse = await manage(new NextRequest(`http://localhost:3006/api/e-sertifikat/${event.id}/download`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [rows[1].id] }) }), [event.id, 'download']);
    assert.equal(zipResponse.status, 200); assert.equal(zipResponse.headers.get('content-type'), 'application/zip');
    const zip = await require('jszip').loadAsync(Buffer.from(await zipResponse.arrayBuffer()));
    const documents = Object.values(zip.files).filter(file => !file.dir);
    assert.equal(documents.length, 1); assert((await documents[0].async('nodebuffer')).subarray(0,5).toString() === '%PDF-'); pass();
    assert.equal((await manage(new NextRequest(`http://localhost:3006/api/e-sertifikat/${event.id}/download`, { method: 'POST', body: JSON.stringify({ ids: Array(26).fill(rows[1].id) }) }), [event.id, 'download'])).status, 400); pass();
    const publicDoc = await service.addAsset(owner, event.id, { kind: 'correspondence', filename: 'published.pdf', mime: validated.mime, bytes: Buffer.from(templateBytes) });
    await service.visibility(owner, event.id, publicDoc.id, true);
    global.__ecertUser = null;
    const publicResponse = await publicRead(new NextRequest(`http://localhost:3006/api/public/e-sertifikat/${liveCertificate.verify_token}`), [liveCertificate.verify_token]);
    assert.equal(publicResponse.status, 200); assert(!(await publicResponse.json()).data.identities); pass();
    const docResponse = await publicRead(new NextRequest('http://localhost:3006/api/public/e-sertifikat/file'), [liveCertificate.verify_token, 'files', publicDoc.id]);
    assert.equal(docResponse.status, 200); assert.equal(docResponse.headers.get('content-type'), 'application/pdf'); assert(docResponse.headers.get('content-disposition').startsWith('attachment')); pass();
    assert.equal((await publicRead(new NextRequest('http://localhost:3006/api/public/e-sertifikat/file'), [certificate.verify_token, 'files', publicDoc.id])).status, 404); pass();
    // Exercise the shared PostgreSQL counters, not just the in-memory boundary fixture.
    const tokenBucket = 'token:' + require('node:crypto').createHash('sha256').update(liveCertificate.verify_token).digest('hex');
    await root.query('UPDATE ecert_public_limits SET hits=119 WHERE bucket=$1', [tokenBucket]);
    const publicRequest = ip => new NextRequest('http://localhost:3006/api/public/e-sertifikat/check', { headers: { 'x-forwarded-for': ip } });
    assert.equal((await publicRead(publicRequest('198.51.100.1'), [liveCertificate.verify_token])).status, 200); pass();
    const capped = await publicRead(publicRequest('203.0.113.2'), [liveCertificate.verify_token]);
    assert.equal(capped.status, 429); assert.equal(capped.headers.get('Retry-After'), '60'); pass();
    await root.query("UPDATE ecert_public_limits SET hits=1199 WHERE bucket='global'");
    assert.equal((await publicRead(publicRequest('203.0.113.3'), ['c'.repeat(48)])).status, 404); pass();
    assert.equal((await publicRead(publicRequest('203.0.113.4'), ['d'.repeat(48)])).status, 429); pass();
    await root.query("UPDATE ecert_public_limits SET expires_at=now()-interval '121 seconds'");
    assert.equal((await publicRead(publicRequest('203.0.113.5'), [liveCertificate.verify_token])).status, 200); pass();
    assert.equal((await root.query('SELECT count(*)::int AS n FROM ecert_public_limits')).rows[0].n, 2); pass();

    // Keep fixtures under another owner so earlier authorization/count checks stay independent.
    await root.query(`INSERT INTO ecert_events(owner_id,title,organizer,start_date,end_date,number_prefix)
      SELECT 'pagination-owner','Pagination '||n,'MAN','2026-10-21','2026-10-21','PAGE-'||n FROM generate_series(1,205) n`);
    const paginationOwner = { ...owner, authId: 'pagination-owner' };
    const allEventIds = new Set();
    for (let page=1; page<=9; page++) {
      const result = await service.list(paginationOwner, new URLSearchParams({ page: String(page) }));
      assert.equal(result.total,205); result.items.forEach(row => allEventIds.add(row.id));
    }
    assert.equal(allEventIds.size,205); pass();
    const searched = await service.list(paginationOwner,new URLSearchParams({ q:'Pagination 205' }));
    assert.equal(searched.total,1); assert.equal(searched.items[0].title,'Pagination 205'); pass();
    delete global.__ecertDb; delete global.__ecertUser;
    const XLSX = require('xlsx'), workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Nama', 'Asal Sekolah', 'Peran'], ['Amelia', 'Sekolah Contoh', 'Peserta']]), 'Peserta');
    const parsed = await readParticipantExcel(new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })], 'peserta.xlsx'));
    assert.deepEqual(parsed.headers, ['Nama', 'Asal Sekolah', 'Peran']); assert.equal(parsed.rows[0][0], 'Amelia'); pass();
    await rejects(() => readParticipantExcel(new File(['Nama,Nama\nAmelia,Gowa'], 'duplicate.csv')), /xls/);
    await rejects(() => readParticipantExcel(new File(['Nama,Asal Sekolah\nAmelia,Gowa'], 'unsupported.xls')), /tidak valid/);
    const longWorkbook=XLSX.utils.book_new(),longRows=[['Nama'],...Array.from({length:505},(_,index)=>[index===501?'':`Peserta ${index}`])];
    XLSX.utils.book_append_sheet(longWorkbook,XLSX.utils.aoa_to_sheet(longRows),'Peserta');
    await rejects(()=>readParticipantExcel(new File([XLSX.write(longWorkbook,{type:'buffer',bookType:'xlsx'})],'lebih-500.xlsx')),/500/);
    const report = { checks, database: 'isolated schema; no existing application data modified', cases: ['authorization and owner scope', 'migration idempotency', 'input validation', 'template validation', 'safe Excel mapping', 'atomic import and issue', 'concurrent retries', 'draft revision conflicts', 'immutable snapshots', 'document publication', 'public DTO privacy', 'shared PostgreSQL public limits', 'server pagination beyond 200 events', 'revocation', 'PDF creation'], pdfPages: 1 };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally {
    await root.query('SET search_path TO public');
    await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
