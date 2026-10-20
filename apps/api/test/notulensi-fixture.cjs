const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const common = require('@nestjs/common');

function compileModule(path, resolve) {
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, Date, console, require: resolve });
  return module.exports;
}
const access = compileModule('apps/api/src/notulensi/notulensi-access.ts', require);
const rolesUser = user => user?.roles || [];
const { NotulensiService } = compileModule('apps/api/src/notulensi/notulensi.service.ts', name => {
  if (name === './notulensi-access') return access;
  if (name === '@nestjs/common') return common;
  if (name.endsWith('feature-access.guard')) return {
    rolesUser, ROLE_ADMIN: ['ADMIN', 'ADMINISTRATOR'], NOTULENSI_KELOLA_KEY: 'notulensi_access_config',
    aksesDiizinkan: user => user?.canCreate === true || rolesUser(user).includes('ADMIN'),
    parseKonfigurasiAkses: value => value,
  };
  return {};
});

const owner = { id: 1n, nama: 'Pembuat', username: 'pembuat', nip: '001', roles: ['GURU'], canCreate: true };
const pic = { id: 2n, nama: 'PIC Satu', username: 'pic1', nip: '002', roles: ['GURU'] };
const other = { id: 3n, nama: 'Pengguna Lain', username: 'lain', nip: '003', roles: ['GURU'], canCreate: true };
const admin = { id: 4n, nama: 'Admin', username: 'admin', nip: '004', roles: ['ADMIN'] };
const points = statuses => statuses.map((status, index) => ({ id: String(index), teks: `Keputusan ${index}`, status }));
const json = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v));

function fixture(initial = {}, extraUsers = []) {
  let row = {
    id: 1n, agenda: 'Rapat', tanggal: '2026-10-20', waktu_mulai: '08:00', lokasi: 'Ruang privat',
    pimpinan_rapat: 'Pimpinan', notulis: 'Notulis', peserta: 'Daftar rahasia', catatan: 'Catatan rahasia',
    poin_poin: [], status: 'Selesai', created_by: 'user:1', revision: 'revision-1',
    created_at: new Date('2026-10-20T00:00:00Z'), updated_at: new Date('2026-10-20T00:00:00Z'), ...initial,
  };
  let version = 1;
  const queries = [];
  const users = [owner, pic, other, admin, ...extraUsers].map(user => ({ ...user }));
  let legacySnapshot = null;
  const touch = changes => { row = { ...row, ...changes, revision: `revision-${++version}` }; return [row]; };
  const db = {
    public_users: { async findMany() { return users; } },
    master_guru: { async findMany() { return users.map(user => ({ nip: user.nip, nama_lengkap: user.nama })); } },
    master_siswa: { async findMany() { return []; } },
    site_settings: {
      async findUnique() { return legacySnapshot; },
      async upsert(input) { if (!legacySnapshot) legacySnapshot = { ...input.create }; return legacySnapshot; },
    },
    async $transaction(fn) { return fn(db); },
    async $queryRawUnsafe(sql, ...args) {
      queries.push({ sql, args });
      if (sql.includes('INSERT INTO')) return touch({
        agenda: args[0], tanggal: args[1], poin_poin: JSON.parse(args[8]), status: args[9], created_by: args[12],
      });
      if (sql.includes('agenda = $1')) {
        if (row.revision !== args[13] || row.created_by !== args[15]) return [];
        return touch({ agenda: args[0], tanggal: args[1], poin_poin: JSON.parse(args[8]), status: args[9], created_by: args[14] });
      }
      if (sql.includes('UPDATE public')) return touch({ status: args[0], poin_poin: JSON.parse(args[1]) });
      if (sql.includes('WHERE id') && String(args[0]) !== String(row.id)) return [];
      return [row];
    },
    async $executeRawUnsafe(sql, ...args) {
      queries.push({ sql, args });
      return String(row.id) === String(args[0]) && row.created_by === args[1] ? 1 : 0;
    },
  };
  return { service: new NotulensiService(db, { async bacaKonfigurasi() { return {}; } }), queries, db, users, get row() { return row; } };
}

module.exports = { fixture, owner, pic, other, admin, points, json, ...access };
