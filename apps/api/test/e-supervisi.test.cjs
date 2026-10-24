const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compile = (file, requireFn) => {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText, { module: mod, exports: mod.exports, require: requireFn || require, console, Date, Intl, BigInt, URL, Map, Set });
  return mod.exports;
};

const penilaian = compile('apps/api/src/e-supervisi/penilaian.ts');
const guard = {
  rolesUser: u => (Array.isArray(u?.roles) ? u.roles : String(u?.role || '').split(',')).map(r => String(r).trim().toUpperCase()).filter(Boolean),
  parseKonfigurasiAkses: () => ({ allowedRoles: ['ADMIN'], allowedUsers: [] }),
};
guard.aksesDiizinkan = (u, k, bawaan = []) => guard.rolesUser(u).some(r => ['ADMIN', 'ADMINISTRATOR', ...bawaan].includes(r));
const { ESupervisiService } = compile('apps/api/src/e-supervisi/e-supervisi.service.ts', name =>
  name === '@nestjs/common' ? require(name)
    : name === './penilaian' ? penilaian
      : name === '../auth/feature-access.guard' ? guard
        : {});

// Instrumen: dokumen 1 (tahap A) = indikator 10 (angka 1-4), 11 (group) dengan sub 12 (yatidak), 13 nonaktif.
const DOKUMEN = [{
  id: 1, tahap: 'perencanaan', nama_dokumen: 'Modul Ajar', aktif: true, butuh_dokumen: true, urutan: 0,
  sv_indikator: [
    { id: 10, nama_indikator: 'Tujuan', aktif: true, skala_config: { tipe: 'angka', min: 1, max: 4 } },
    { id: 11, nama_indikator: 'Langkah', aktif: true, skala_config: { tipe: 'group' } },
    { id: 12, nama_indikator: 'Pembuka', aktif: true, skala_config: { tipe: 'yatidak', parent_id: 11 } },
  ],
}];

function fixture({ penugasan = [], nilai = [], user } = {}) {
  const writes = [];
  const prisma = {
    site_settings: { findUnique: async () => null },
    sv_penugasan: {
      findUnique: async ({ where }) => penugasan.find(p => p.id === where.id) || null,
      findFirst: async ({ where }) => penugasan.find(p => Object.entries(where).every(([k, v]) => typeof v === 'object' ? true : p[k] === v)) || null,
      findMany: async ({ where }) => { writes.push(['penugasan.findMany', where]); return penugasan; },
      update: async (a) => { writes.push(['penugasan.update', a]); return a.data; },
      delete: async (a) => { writes.push(['penugasan.delete', a]); },
      create: async (a) => { writes.push(['penugasan.create', a]); return a.data; },
      count: async () => 0,
    },
    sv_master_dokumen: { findMany: async () => DOKUMEN, findUnique: async () => ({ id: 1, aktif: true, butuh_dokumen: true, tahun_ajaran_id: 7n }) },
    sv_rekam_nilai: {
      findMany: async () => nilai,
      upsert: (a) => { writes.push(['nilai.upsert', a]); return a; },
    },
    sv_unggahan_guru: { findMany: async () => [] },
    master_guru: { findMany: async () => [], findFirst: async ({ where }) => ({ nip: where.nip }) },
    public_users: { findFirst: async ({ where }) => ({ nip: where.nip }) },
    profil_sekolah: { findFirst: async () => ({ nama: 'MAN' }) },
    master_tahun_ajaran: { findUnique: async () => ({ id: 7n, tahun_ajaran: '2026/2027', semester: 'Ganjil' }) },
    $transaction: async (arg) => Array.isArray(arg) ? arg : arg(prisma),
  };
  const service = new ESupervisiService(prisma, { getJadwal: async () => ({ data: [] }) }, { removeByUrl: async () => ({ error: null }) });
  return { service, writes, prisma };
}

const P = (over = {}) => ({ id: 5, guru_nip: 'G1', supervisor_nip: 'S1', tahun_ajaran_id: 7n, status: 'aktif', ...over });

test('konversi nilai memakai skor/maksimal, menolak skor di luar skala, dan membaca data Ya/Tidak lama', () => {
  const { konversiNilai, bakukanMentah, normalisasiSkala } = penilaian;
  assert.equal(konversiNilai({ tipe: 'angka', min: 1, max: 4 }, '3'), 75);
  assert.equal(konversiNilai({ tipe: 'angka', min: 1, max: 4 }, '5'), null);
  assert.equal(konversiNilai({ tipe: 'angka', min: 1, max: 4 }, ''), null);
  assert.equal(konversiNilai({ tipe: 'angka', min: 1, max: 4 }, 'abc'), null);
  assert.equal(konversiNilai({ tipe: 'huruf' }, 'b'), 85); // opsi default walau konfigurasi impor tidak membawanya
  assert.equal(konversiNilai({ tipe: 'yatidak' }, '100'), 100);
  assert.equal(bakukanMentah({ tipe: 'yatidak' }, '0'), 'Tidak');
  assert.equal(typeof normalisasiSkala({ tipe: 'angka', min: 4, max: 4 }), 'string');
  assert.equal(typeof normalisasiSkala({ tipe: 'angka', min: 1, max: 100 }), 'string');
  assert.equal(normalisasiSkala({ tipe: 'Angka', min: '0', max: '4' }).min, 0);
});

test('label/induk dan sub dari induk yang dihapus tidak ikut dihitung', () => {
  const map = penilaian.indikatorDinilai([{ ...DOKUMEN[0], sv_indikator: [...DOKUMEN[0].sv_indikator,
    { id: 14, nama_indikator: 'Yatim', aktif: true, skala_config: { tipe: 'angka', parent_id: 99 } }] }]);
  assert.deepEqual([...map.keys()].sort(), [10, 12]);
  const hasil = penilaian.hitungHasil(map, [{ indikator_id: 10, nilai_mentah: '4' }, { indikator_id: 11, nilai_mentah: null }]);
  assert.equal(hasil.rata_rata, 100);
  assert.equal(hasil.progres, 50);
  assert.equal(penilaian.hitungHasil(map, [{ indikator_id: 10, nilai_mentah: '1' }]).predikat, 'Kurang');
});

test('salinan aturan penilaian web dan api identik', () => {
  assert.equal(fs.readFileSync('apps/web/lib/e-supervisi/penilaian.ts', 'utf8').replace(/\r/g, ''),
    fs.readFileSync('apps/api/src/e-supervisi/penilaian.ts', 'utf8').replace(/\r/g, ''));
});

test('hanya supervisor yang ditunjuk yang boleh menilai; nilai terkunci ditolak', async () => {
  const body = { penugasan_id: 5, scores: [{ indikator_id: 10, nilai_mentah: '3' }] };
  await assert.rejects(fixture({ penugasan: [P()] }).service.upsertNilai({ nip: 'X', roles: ['KAMAD'] }, body), e => e.getStatus() === 403);
  await assert.rejects(fixture({ penugasan: [P({ status: 'terkunci' })] }).service.upsertNilai({ nip: 'S1', roles: ['GURU'] }, body), e => e.getStatus() === 403);
  const f = fixture({ penugasan: [P()] });
  await f.service.upsertNilai({ nip: 'S1', roles: ['GURU'] }, body);
  const row = f.writes.find(w => w[0] === 'nilai.upsert')[1].create;
  assert.equal(row.nilai_konversi, 75);
  assert.equal(row.nilai_mentah, '3');
});

test('skor tak sah, indikator label, dan indikator di luar instrumen ditolak; catatan saja tidak menjadi nilai 0', async () => {
  const sup = { nip: 'S1', roles: ['GURU'] };
  const kirim = scores => fixture({ penugasan: [P()] }).service.upsertNilai(sup, { penugasan_id: 5, scores });
  await assert.rejects(kirim([{ indikator_id: 10, nilai_mentah: '9' }]), e => e.getStatus() === 400);
  await assert.rejects(kirim([{ indikator_id: 11, nilai_mentah: '3' }]), e => e.getStatus() === 400);
  await assert.rejects(kirim([{ indikator_id: 999, nilai_mentah: '3' }]), e => e.getStatus() === 400);
  const f = fixture({ penugasan: [P()] });
  await f.service.upsertNilai(sup, { penugasan_id: 5, scores: [{ indikator_id: 11, nilai_mentah: '', catatan: 'Perlu LKPD' }] });
  const row = f.writes.find(w => w[0] === 'nilai.upsert')[1].create;
  assert.equal(row.nilai_konversi, null);
  assert.equal(row.nilai_mentah, null);
  assert.equal(row.catatan, 'Perlu LKPD');
});

test('nilai dan unggahan guru lain tidak bisa dibaca guru yang tidak terkait', async () => {
  await assert.rejects(fixture({ penugasan: [P()] }).service.getNilai({ nip: 'G9', roles: ['GURU'] }, 5), e => e.getStatus() === 403);
  assert.equal((await fixture({ penugasan: [P()] }).service.getNilai({ nip: 'G1', roles: ['GURU'] }, 5)).ok, true);
  await assert.rejects(fixture().service.getNilai({ nip: 'G1', roles: ['GURU'] }, undefined), e => e.getStatus() === 400);
  await assert.rejects(fixture().service.getUnggahan({ nip: 'G9', roles: ['GURU'] }, 'G1', 7), e => e.getStatus() === 403);
});

test('nilai indikator nonaktif tidak dimuat ulang dan tidak menghalangi autosave indikator aktif', async () => {
  const f = fixture({ penugasan: [P()], nilai: [
    { indikator_id: 10, nilai_mentah: '3', catatan: '' },
    { indikator_id: 13, nilai_mentah: '4', catatan: 'Riwayat indikator dihapus' },
  ] });
  const user = { nip: 'S1', roles: ['GURU'] };
  const loaded = await f.service.getNilai(user, 5);
  assert.equal(loaded.data.length, 1);
  assert.equal(loaded.data[0].indikator_id, 10);
  await f.service.upsertNilai(user, { penugasan_id: 5, scores: loaded.data });
  assert.equal(f.writes.filter(w => w[0] === 'nilai.upsert').length, 1);
});

test('rekap dan daftar penugasan guru biasa dibatasi pada dirinya; pimpinan melihat semua', async () => {
  const f = fixture({ penugasan: [P()] });
  await f.service.getRekap({ nip: 'G1', roles: ['GURU'] }, 7);
  const where = f.writes.find(w => w[0] === 'penugasan.findMany')[1];
  assert.equal(JSON.stringify(where.OR), JSON.stringify([{ supervisor_nip: 'G1' }, { guru_nip: 'G1' }]));
  const k = fixture({ penugasan: [P()] });
  const r = await k.service.getRekap({ nip: 'K1', roles: ['KAMAD'] }, 7);
  assert.equal(k.writes.find(w => w[0] === 'penugasan.findMany')[1].OR, undefined);
  assert.equal(r.akses.pantau, true);
  const g = fixture({ penugasan: [P()] });
  await g.service.getPenugasan({ nip: 'G1', roles: ['GURU'] }, 7);
  assert.ok(g.writes.find(w => w[0] === 'penugasan.findMany')[1].AND);
});

test('penugasan menolak NIP kosong dan supervisor menilai diri sendiri', async () => {
  const f = fixture({ penugasan: [P()] });
  await assert.rejects(f.service.upsertPenugasan({ guru_nip: '', supervisor_nip: 'S1', tahun_ajaran_id: 7 }), e => e.getStatus() === 400);
  await assert.rejects(f.service.upsertPenugasan({ supervisor_nip: 'S1', tahun_ajaran_id: 7 }), e => e.getStatus() === 400);
  await assert.rejects(f.service.upsertPenugasan({ guru_nip: 'S1', supervisor_nip: 'S1', tahun_ajaran_id: 7 }), e => e.getStatus() === 400);
  assert.equal(f.writes.filter(w => w[0] === 'penugasan.update').length, 0);
});

test('status penugasan hanya aktif/terkunci; membuka kunci khusus pengelola', async () => {
  const f = fixture({ penugasan: [P({ status: 'terkunci' })] });
  await assert.rejects(f.service.updateStatusPenugasan({ nip: 'S1', roles: ['GURU'] }, { id: 5, status: 'paid' }), e => e.getStatus() === 400);
  await assert.rejects(f.service.updateStatusPenugasan({ nip: 'S1', roles: ['GURU'] }, { id: 5, status: 'aktif' }), e => e.getStatus() === 403);
  await f.service.updateStatusPenugasan({ nip: 'W1', roles: ['WKM_AKADEMIK'] }, { id: 5, status: 'aktif' });
  const s = fixture({ penugasan: [P()] });
  await s.service.updateStatusPenugasan({ nip: 'S1', roles: ['GURU'] }, { id: 5, status: 'terkunci' });
  assert.equal(s.writes.find(w => w[0] === 'penugasan.update')[1].data.status, 'terkunci');
});

test('indikator yang dihapus dari formulir dinonaktifkan, dan indikator dokumen lain tidak bisa dibajak', async () => {
  const f = fixture();
  const tx = {
    sv_master_dokumen: { findUnique: async () => ({ id: 1 }), update: async () => ({}) },
    sv_indikator: {
      findMany: async () => [{ id: 10 }, { id: 11 }, { id: 12 }],
      update: async (a) => { f.writes.push(['ind.update', a.where.id]); },
      create: async (a) => { f.writes.push(['ind.create', a.data.nama_indikator]); return { id: 50 }; },
      updateMany: async (a) => { f.writes.push(['ind.nonaktif', a.where.id.in]); },
    },
  };
  f.prisma.$transaction = async fn => fn(tx);
  await f.service.upsertDokumen({ id: 1, tahap: 'perencanaan', nama_dokumen: 'Modul', tahun_ajaran_id: 7, indikators: [
    { id: 10, nama_indikator: 'Tujuan', skala_config: { tipe: 'angka', min: 1, max: 4 } },
    { id: 777, nama_indikator: 'Milik dokumen lain', skala_config: { tipe: 'huruf' } },
  ] });
  assert.ok(f.writes.some(w => w[0] === 'ind.update' && w[1] === 10));
  assert.ok(!f.writes.some(w => w[0] === 'ind.update' && w[1] === 777));
  assert.ok(f.writes.some(w => w[0] === 'ind.create' && w[1] === 'Milik dokumen lain'));
  assert.equal(JSON.stringify(f.writes.find(w => w[0] === 'ind.nonaktif')[1]), '[11,12]');
  await assert.rejects(f.service.upsertDokumen({ tahap: 'x', nama_dokumen: 'y', tahun_ajaran_id: 7, indikators: [{ nama_indikator: 'z', skala_config: { tipe: 'angka', min: 5, max: 1 } }] }), e => e.getStatus() === 400);
});

test('catatan unggahan hanya menerima URL https dari folder e-supervisi milik pengunggah', async () => {
  const f = fixture();
  f.prisma.sv_penugasan.findFirst = async () => null;
  f.prisma.sv_unggahan_guru.findUnique = async () => null;
  f.prisma.sv_unggahan_guru.upsert = async (a) => a.create;
  const user = { nip: 'G1', roles: ['GURU'] };
  const base = { guru_nip: 'G1', tahun_ajaran_id: 7, dokumen_id: 1 };
  await assert.rejects(f.service.upsertUnggahanRecord({ ...base, file_url: 'javascript:alert(1)' }, user), e => e.getStatus() === 400);
  await assert.rejects(f.service.upsertUnggahanRecord({ ...base, file_url: 'https://evil.example/x.pdf' }, user), e => e.getStatus() === 400);
  await assert.rejects(f.service.upsertUnggahanRecord({ ...base, guru_nip: 'G2', file_url: 'https://cdn.example/e-supervisi/7/G2/1/x.pdf' }, user), e => e.getStatus() === 403);
  const ok = await f.service.upsertUnggahanRecord({ ...base, file_url: 'https://cdn.example/e-supervisi/7/G1/1/x.pdf' }, user);
  assert.equal(ok.ok, true);
});

test('route migrasi tanpa autentikasi sudah dihapus dan upload memeriksa hak sebelum mengunggah', () => {
  assert.equal(fs.existsSync('apps/web/app/api/e-supervisi/run-migration-supervisi/route.ts'), false);
  const src = fs.readFileSync('apps/web/app/api/e-supervisi/upload/route.ts', 'utf8');
  assert.ok(src.indexOf('/e-supervisi/unggahan/cek') < src.indexOf('handleUpload(uploadReq)'));
  assert.doesNotMatch(src, /unregisterUpload\(existingRecord/);
});
