const fs = require('fs');
const ts = require('typescript');
const vm = require('vm');
require('ts-node').register({ transpileOnly: true, project: 'apps/api/tsconfig.json' });
const { PrestasiService } = require('../apps/api/src/prestasi/prestasi.service.ts');
const results = [];
async function main() {
  let row = { id: 'test', status_validasi: 'Menunggu', validated_by: 'ORIGINAL', validated_at: null };
  const service = new PrestasiService({ prestasi_lomba: {
    findUnique: async () => ({ ...row }),
    updateMany: async ({ data }) => { if (row.status_validasi === 'Disetujui') return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    create: async ({ data }) => data,
  } });
  await service.update('test', { validated_by: 'FORGED', validated_at: '2020-01-01' }, { nama: 'REAL' });
  results.push({ test: 'update_without_status_ignores_metadata', pass: row.validated_by === 'ORIGINAL' && row.validated_at === null });
  await service.update('test', { status_validasi: 'Disetujui', validated_by: 'FORGED', validated_at: '2020-01-01' }, { nama: 'REAL' });
  results.push({ test: 'update_with_status_uses_session', pass: row.validated_by === 'REAL' && row.validated_at.getFullYear() !== 2020 });
  const created = await service.create({ nisn: 'test', nama_lomba: 'test', kategori: 'test', tingkat: 'test', penyelenggara: 'test', tanggal_pelaksanaan: '2026-01-01', prestasi_diraih: 'test', bukti_sertifikat: 'test', status_validasi: 'Disetujui', validated_by: 'FORGED', validated_at: '2020-01-01' });
  results.push({ test: 'create_rejects_forged_approval', pass: created.data.status_validasi === 'Menunggu' && created.data.validated_by === null && created.data.validated_at === null, observed: created.data });
  const source = fs.readFileSync('apps/web/app/api/surat/generate-pdf/route.ts', 'utf8');
  const ast = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  const handler = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'POST');
  const js = ts.transpileModule(handler.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  for (const scenario of [ { name: 'missing_token', token: null, status: 401 }, { name: 'invalid_token', token: 'invalid', backend: 401, status: 401 }, { name: 'forbidden', token: 'token', backend: 403, status: 403 }, { name: 'backend_failure', token: 'token', backend: 503, status: 503 }, { name: 'backend_exception', token: 'token', throws: true, status: 502 } ]) {
    let downloads = 0;
    const context = { exports: {}, console: { log() {}, error() {} }, NextResponse: { json: (body, opts) => ({ body, status: opts.status }) }, extractRequestToken: () => scenario.token, nestFetchAsUser: async () => { if (scenario.throws) throw new Error('simulated'); return { status: scenario.backend, body: { ok: false } }; }, fetchFileToDataUrl: async () => { downloads++; return ''; } };
    vm.runInNewContext(js, context);
    const response = await context.exports.POST({ json: async () => ({ suratData: { nomor_surat: 'TEST', lampiran_file: 'https://example.invalid/test.pdf' } }) });
    results.push({ test: 'pdf_' + scenario.name, pass: response.status === scenario.status && downloads === 0, status: response.status, downloads });
  }
  fs.writeFileSync(process.argv[2] || 'artifacts/AG-verifikasi-final-reproduksi.json', JSON.stringify(results, null, 2));
  if (results.some(result => !result.pass)) process.exitCode = 1;
  console.log(JSON.stringify(results, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
