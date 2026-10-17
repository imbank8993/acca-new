const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const common = { Injectable: () => value => value, Logger: class {}, BadRequestException: class extends Error {}, ForbiddenException: class extends Error {}, NotFoundException: class extends Error {} };
function moduleOf(file, imports = {}, globals = {}) {
  const output = ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, console, Date, URL, Buffer, AbortSignal, process, ...globals,
    require(name) { if (name === '@acca/shared/medical-letter-signer.cjs') return medicalSigner; if (name in imports) return imports[name]; if (name === '@nestjs/common') return common; if (name.includes('prisma.service')) return {}; return require(name); } });
  return module.exports;
}
const medicalSigner = require('../../../packages/shared/medical-letter-signer.cjs');
const validation = moduleOf('apps/api/src/ketidakhadiran/ketidakhadiran-validation.ts');
const studentIdentity = moduleOf('apps/api/src/common/student-identity.ts');
const { KetidakhadiranService: Service } = moduleOf('apps/api/src/ketidakhadiran/ketidakhadiran.service.ts', { './ketidakhadiran-validation': validation, '../common/student-identity': studentIdentity });
const date = new Date('2026-10-12T00:00Z');
const time = t => new Date(`1970-01-01T${t}:00Z`);
const uks = { id: 1, nip: 'uks', nama: 'UKS Operator', roles: ['OP_UKS'] };
const izin = { id: 2, nip: 'izin', nama: 'Izin Operator', roles: ['OP_IZIN'] };
const admin = { id: 3, nip: 'admin', isAdmin: true, roles: ['ADMIN'] };
const absence = (id = 'a', extra = {}) => ({ id, nisn: 'student', nama: 'Student', kelas: 'X', jenis: 'SAKIT', status: 'Ringan', aktif: true, tgl_mulai: date, tgl_selesai: date, keterangan: 'private diagnosis', tindakan: 'private medication', tindak_lanjut: 'Istirahat di UKS', ...extra });
const medical = (id = 'rm', extra = {}) => ({ id, nisn: 'student', nama_siswa: 'Student', kelas: 'X', aktif: true, tanggal: date, waktu: time('08:00'), keluhan: 'private diagnosis', tindak_lanjut: 'Istirahat di UKS', tindakan: [], riwayat_alergi_obat: ['private allergy'], ...extra });
function matches(row, where = {}) {
  if (!where) return true;
  for (const [key, v] of Object.entries(where)) {
    if (key === 'AND') { if (!(Array.isArray(v) ? v : [v]).every(x => matches(row, x))) return false; continue; }
    if (key === 'OR') { if (!v.some(x => matches(row, x))) return false; continue; }
    if (key === 'NOT') { if ((Array.isArray(v) ? v : [v]).some(x => matches(row, x))) return false; continue; }
    const value = row[key];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v && !v.in.includes(value)) return false;
      if ('notIn' in v && v.notIn.includes(value)) return false;
      if ('lte' in v && !(value <= v.lte)) return false;
      if ('gte' in v && !(value >= v.gte)) return false;
      if ('contains' in v && !String(value || '').toLowerCase().includes(String(v.contains).toLowerCase())) return false;
      if ('startsWith' in v && !String(value || '').startsWith(v.startsWith)) return false;
      if ('not' in v && value === v.not) return false;
    } else if (v instanceof Date ? !(value instanceof Date && value.getTime() === v.getTime()) : value !== v) return false;
  }
  return true;
}
function fixture(seed = {}, fail = () => false) {
  let state = { ketidakhadiran: [], rekam_medis_siswa: [], audit_logs: [], acca_letters: [], acca_letter_sequence: [], system_config: [], file_uploads: [], orangtua_siswa: [], guru_asuh: [], wali_kelas: [], jadwal_guru: [], public_users: [], master_waktu: [], site_settings: [{ key: 'timezone', value: 'Asia/Makassar' }], master_siswa: [{ nisn: 'student', nama_lengkap: 'Canonical Student', gender: 'P', alamat: 'Canonical address' }], master_kelas: [{ nama: 'X', program: 'Reguler', aktif: true }], siswa_kelas: [{ nisn: 'student', kelas: 'X', aktif: true }], ...structuredClone(seed) };
  let serial = Promise.resolve(); let sequence = 0; let locks = 0;
  function adapter(getState) {
    const db = {};
    for (const table of Object.keys(state)) db[table] = {
      async findMany(query = {}) {
        let rows = getState()[table].filter(r => matches(r, query.where));
        const order = Array.isArray(query.orderBy) ? query.orderBy : query.orderBy ? [query.orderBy] : [];
        rows.sort((a,b) => { for (const o of order) { const [key, dir] = Object.entries(o)[0]; if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * (dir === 'desc' ? -1 : 1); } return 0; });
        rows = rows.slice(query.skip || 0, (query.skip || 0) + (query.take || rows.length));
        return rows.map(row => {
          const result = structuredClone(row);
          if (query.include?.rekam_medis_siswa) result.rekam_medis_siswa = getState().rekam_medis_siswa.find(r => r.id === row.rekam_medis_id) || null;
          if (query.include?.acca_letters) result.acca_letters = getState().acca_letters.filter(r => r.ketidakhadiran_id === row.id);
          if (query.include?.ketidakhadiran) result.ketidakhadiran = getState().ketidakhadiran.filter(r => r.rekam_medis_id === row.id && r.aktif);
          return query.select ? Object.fromEntries(Object.keys(query.select).map(k => [k,result[k]])) : result;
        });
      },
      async findFirst(query = {}) { return (await this.findMany({ ...query, take: 1 }))[0] || null; },
      async findUnique(query) { return this.findFirst(query); },
      async count(query) { return getState()[table].filter(r => matches(r, query?.where)).length; },
      async create({ data, select }) {
        if (fail(table,'create')) throw Error('Injected failure');
        const row = { id: `new-${++sequence}`, ...structuredClone(data) };
        getState()[table].push(row);
        return select ? Object.fromEntries(Object.keys(select).map(k => [k,row[k]])) : structuredClone(row);
      },
      async update({ where, data, select }) {
        if (fail(table,'update')) throw Error('Injected failure');
        const row = getState()[table].find(r => matches(r,where)); if (!row) throw Error('Missing row');
        Object.assign(row,structuredClone(data));
        return select ? Object.fromEntries(Object.keys(select).map(k => [k,row[k]])) : structuredClone(row);
      },
      async updateMany({ where, data }) { if (fail(table,'updateMany')) throw Error('Injected failure'); const rows = getState()[table].filter(r => matches(r,where)); rows.forEach(r => Object.assign(r,structuredClone(data))); return { count: rows.length }; },
      async upsert({ where, create, update }) { const row = getState()[table].find(r => matches(r,where)); return row ? this.update({ where,data:update }) : this.create({data:create}); },
      async delete({where}) { const row = getState()[table].find(r=>matches(r,where)); if(!row)throw Error('Missing row'); getState()[table]=getState()[table].filter(r=>r!==row); return row; },
      async deleteMany({where}) { const rows=getState()[table].filter(r=>matches(r,where)); getState()[table]=getState()[table].filter(r=>!rows.includes(r));return {count:rows.length}; },
    };
    db.$executeRaw = async strings => { assert.match(strings.join(''), /pg_advisory_xact_lock/); locks++; };
    return db;
  }
  const db = adapter(() => state);
  db.$transaction = async work => {
    let release; const previous = serial; serial = new Promise(resolve => release = resolve); await previous;
    const draft = structuredClone(state);
    try { const result = await work(adapter(() => draft)); state = draft; return result; } finally { release(); }
  };
  return { db, service: new Service(db), get state() { return state; }, get locks() { return locks; } };
}

test('Siswa hanya menerima log sendiri dan kolom medis disamarkan', async () => {
  const f=fixture({ketidakhadiran:[absence(),absence('other',{nisn:'other'})]});
  const result=await f.service.getLog({mode:'history',tanggal:'2026-10-12'}, {roles:['SISWA'],username:'student'});
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].keterangan,'Sakit');assert.equal(result.rows[0].tindakan,null);
  assert.equal(result.stats.total_today,1);
});
test('Orang tua hanya mendapat log anak yang ditautkan; tamu ditolak', async () => {
  const f=fixture({ketidakhadiran:[absence(),absence('other',{nisn:'other'})],orangtua_siswa:[{user_id:4n,nisn:'student'}]});
  assert.equal((await f.service.getLog({mode:'history'},{id:4,roles:['ORANG_TUA']})).rows.length,1);
  await assert.rejects(f.service.getLog({mode:'history'},{roles:['TAMU']}), /Akses/);
});
test('Guru hanya membaca siswa kelas penugasan; operator UKS mendapat rincian', async () => {
  const f=fixture({ketidakhadiran:[absence(),absence('b',{kelas:'Y'})],jadwal_guru:[{nip:'teacher',kelas:'X',aktif:true}]});
  assert.equal((await f.service.getLog({mode:'history'},{roles:['GURU'],nip:'teacher'})).rows.length,1);
  assert.equal((await f.service.getLog({mode:'history'},uks)).rows[0].keterangan,'private diagnosis');
});
test('OP_IZIN tidak menerima relasi medis di endpoint detail', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{rekam_medis_id:'rm'})],rekam_medis_siswa:[medical()]});
  const result=await f.service.findById('a',izin);assert.equal(result.rekam_medis_siswa,undefined);assert.equal(result.tindakan,null);
  assert.equal((await f.service.findById('a',uks)).rekam_medis_siswa.riwayat_alergi_obat[0],'private allergy');
});
test('Akses medis tetap ditolak untuk non-UKS meskipun memiliki menu', async () => {
  await assert.rejects(fixture().service.getRekamMedisSiswa({},izin), /Operator UKS/);
});
test('Jenis tujuan dan jenis tidak dikenal ditolak sebelum write', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{jenis:'IZIN',status:'MADRASAH'})]});
  await assert.rejects(f.service.update('a',{jenis:'SAKIT',status:'Ringan'},izin), /hak/);
  await assert.rejects(f.service.createBulk(izin,{jenis:'LAIN',nisList:['student'],tgl_mulai:'2026-10-12'}), /harus IZIN/);
  assert.equal(f.state.ketidakhadiran[0].jenis,'IZIN');
});
test('Tanggal terbalik, waktu tidak valid dan status lain ditolak', async () => {
  for(const payload of [{tgl_mulai:'2026-10-12',tgl_selesai:'2026-10-11'},{tgl_mulai:'2026-02-30'},{tgl_mulai:'2026-10-12',waktu_mulai_real:'25:00'},{tgl_mulai:'2026-10-12',status:'INVALID'}]) {
    const f=fixture();await assert.rejects(f.service.createBulk(izin,{jenis:'IZIN',status:'MADRASAH',nisList:['student'],...payload}));assert.equal(f.state.ketidakhadiran.length,0);
  }
});
test('Pagination dan mode log salah menghasilkan penolakan terkontrol', async () => {
  for(const q of [{mode:'unexpected'},{page:'abc'},{limit:'0'},{tanggal:'2026-02-30'}]) await assert.rejects(fixture().service.getLog(q,admin));
});
test('Input medis mengambil biodata resmi dan audit aktor sesi', async () => {
  const f=fixture();const result=await f.service.createRekamMedisSiswa({nisn:'student',nama_siswa:'Forged',alamat:'Forged',keluhan:'Demam',tanggal:'2026-10-12',waktu:'08:00',tindak_lanjut:'Istirahat di UKS'},uks);
  assert.equal(result.data.nama_siswa,'Canonical Student');assert.equal(result.data.alamat,'Canonical address');assert.equal(f.state.audit_logs[0].user_nip,'uks');
});
test('Kegagalan sinkron atau audit membatalkan seluruh input medis', async () => {
  for(const target of ['ketidakhadiran','audit_logs']) {
    const f=fixture({},(table,op)=>table===target && op==='create');
    await assert.rejects(f.service.createRekamMedisSiswa({nisn:'student',keluhan:'Demam',tanggal:'2026-10-12',waktu:'08:00',auto_sync:true,mappedStatus:'Ringan'},uks),/Injected/);
    assert.equal(f.state.rekam_medis_siswa.length,0);assert.equal(f.state.ketidakhadiran.length,0);
  }
});
test('Dua input bersamaan mendapat nomor berbeda; retry idempoten', async () => {
  const f=fixture();const payload={nisn:'student',keluhan:'Demam',tanggal:'2026-10-12',waktu:'08:00'};
  await Promise.all([f.service.createRekamMedisSiswa(payload,uks),f.service.createRekamMedisSiswa(payload,uks)]);
  assert.equal(new Set(f.state.rekam_medis_siswa.map(r=>r.no_rekam_medis)).size,2);
  const request={...payload,idempotencyKey:'10000000-0000-4000-8000-000000000001'};
  const responses=await Promise.all([f.service.createRekamMedisSiswa(request,uks),f.service.createRekamMedisSiswa(request,uks)]);
  assert.equal(responses[0].data.id,responses[1].data.id);assert.equal(f.state.rekam_medis_siswa.length,3);
  await assert.rejects(f.service.createRekamMedisSiswa({...request,keluhan:'Changed'},uks),/data berbeda/);
});
test('Sinkron bersamaan membuat satu absensi, NONE tidak membuat absensi baru', async () => {
  const f=fixture({rekam_medis_siswa:[medical()]});
  await Promise.all([f.service.syncKetidakhadiran('rm','Kontrol',uks),f.service.syncKetidakhadiran('rm','Kontrol',uks)]);
  assert.equal(f.state.ketidakhadiran.length,1);
  const result=await f.service.syncKetidakhadiran('rm','NONE',uks);assert.equal(result.result.skipped,true);assert.equal(f.state.ketidakhadiran[0].aktif,false);assert.equal(f.state.rekam_medis_siswa[0].aktif,true);
});
test('Edit tindak lanjut memperbarui status atau membatalkan absensi NONE', async () => {
  const f=fixture({rekam_medis_siswa:[medical()],ketidakhadiran:[absence('a',{rekam_medis_id:'rm'})]});
  await f.service.updateRekamMedisSiswa('rm',{tindak_lanjut:'Kontrol'},uks);assert.equal(f.state.ketidakhadiran[0].status,'Kontrol');
  await f.service.updateRekamMedisSiswa('rm',{tindak_lanjut:'Kembali ke Kelas'},uks);assert.equal(f.state.ketidakhadiran[0].aktif,false);
});
test('Hapus medis gagal di tabel terkait mengembalikan kedua tabel', async () => {
  const f=fixture({rekam_medis_siswa:[medical()],ketidakhadiran:[absence('a',{rekam_medis_id:'rm'})]},(t,op)=>t==='ketidakhadiran'&&op==='updateMany');
  await assert.rejects(f.service.deleteRekamMedisSiswa('rm',uks),/Injected/);assert.equal(f.state.rekam_medis_siswa[0].aktif,true);
});
test('ALL tanpa seri hanya mengubah record terpilih; grup lintas hak ditolak', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{jenis:'IZIN',status:'MADRASAH'}),absence('b',{jenis:'IZIN',status:'MADRASAH'})]});
  await f.service.update('a',{keterangan:'Changed',scope:'ALL'},izin);assert.equal(f.state.ketidakhadiran[1].keterangan,'private diagnosis');
  const g=fixture({ketidakhadiran:[absence('a',{jenis:'IZIN',status:'MADRASAH',seri_id:'group'}),absence('b',{seri_id:'group'})]});
  await assert.rejects(g.service.remove('a',izin,'ALL'),/hak/);assert.ok(g.state.ketidakhadiran.every(r=>r.aktif));
});
test('ALL memperbarui setiap rekam medis yang terkait dalam grup', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{seri_id:'g',rekam_medis_id:'r1'}),absence('b',{seri_id:'g',rekam_medis_id:'r2'})],rekam_medis_siswa:[medical('r1'),medical('r2')]});
  await f.service.update('a',{scope:'ALL',keterangan:'Updated'},uks);assert.ok(f.state.rekam_medis_siswa.every(r=>r.keluhan==='Updated'));
});
test('Import memakai petugas sesi dan siswa tidak dikenal ditolak', async () => {
  const f=fixture();await f.service.createBulk(izin,{rows:[{nisn:'student',jenis:'IZIN',tgl_mulai:'2026-10-12',petugas_nama:'Forged',petugas_nip:'forged',petugas_role:'ADMIN'}]});
  assert.equal(f.state.ketidakhadiran[0].petugas_nip,'izin');assert.equal(f.state.ketidakhadiran[0].petugas_role,'OP_IZIN');
  assert.equal((await f.service.createBulk(izin,{jenis:'IZIN',status:'MADRASAH',nisList:['missing'],tgl_mulai:'2026-10-12'})).added,0);
});
test('Durasi satu jam, satu hari dan kontinu dihitung pada satuan 24 JP/hari', async () => {
  assert.equal(validation.absenceJp(absence('a',{waktu_mulai_real:time('08:00'),waktu_selesai_real:time('09:00')})),1);
  assert.equal(validation.absenceJp(absence()),24);
  assert.equal(validation.absenceJp(absence('a',{tgl_selesai:new Date('2026-10-14'),is_kontinu:true,waktu_mulai_real:time('08:00'),waktu_selesai_real:time('09:00')})),49);
  const f=fixture({ketidakhadiran:[absence('a',{waktu_mulai_real:time('08:00'),waktu_selesai_real:time('09:00')})]});
  assert.equal((await f.service.getLogSiswa('student',undefined,admin)).data.stat.total_jp,1);
});
test('Absensi jam lain tidak menyertakan siswa yang izinnya selesai', async () => {
  const hari=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][date.getUTCDay()];
  const f=fixture({ketidakhadiran:[absence('a',{waktu_mulai_real:time('08:00'),waktu_selesai_real:time('09:00')})],master_waktu:[{jam_ke:1,hari,program:'Reguler',aktif:true,is_istirahat:false,mulai:time('08:30'),selesai:time('09:00')},{jam_ke:2,hari,program:'Reguler',aktif:true,is_istirahat:false,mulai:time('09:00'),selesai:time('10:00')}]});
  assert.equal((await f.service.getAbsensi('X','2026-10-12',1,uks)).count,1);assert.equal((await f.service.getAbsensi('X','2026-10-12',2,uks)).count,0);
});
test('OP_IZIN tidak dapat mengganti URL surat UKS; URL bebas ditolak', async () => {
  const f=fixture({acca_letters:[{id:'letter',nomor_surat:'001/UKS/2026',jenis_izin:'P'}]});
  await assert.rejects(f.service.saveAccaLetter({id:'letter',file_url:'https://example.com/a.pdf'},izin),/hak/);
  await assert.rejects(f.service.saveAccaLetter({id:'letter',file_url:'https://example.com/a.html'},uks),/PDF/);
  await assert.rejects(f.service.saveAccaLetter({id:'letter',file_url:'https://example.com/a.pdf'},uks),/terdaftar/);
});
test('Verifikasi QR medis menyembunyikan isi, NISN, dan URL arsip', async () => {
  const f=fixture({acca_letters:[{id:'l',nomor_surat:'001/UKS/2026',jenis_izin:'P',barcode:'code',keterangan:'private',file_url:'https://cdn/a.pdf',siswa_nisn:'student'}]});
  const result=await f.service.verifyAccaLetter('code');assert.equal(result.verified,true);assert.equal(result.data.file_url,null);assert.equal(result.data.siswa_nisn,null);assert.notEqual(result.data.keterangan,'private');
});

// Execute the actual Next handler with a stub session, database and renderer.
function letterRoute(f, actor = { id:'1',nama:'UKS Operator',nip:'uks',roles:['OP_UKS'],pages:['ketidakhadiran'] }, renderFail = false) {
  const response={json:(body,options={})=>({body,status:options.status||200})};
  const { POST }=moduleOf('apps/web/app/api/ketidakhadiran/generate-letter/route.ts',{
    '@/lib/prisma':{prisma:f.db},'next/server':{NextResponse:response},qrcode:{default:{toDataURL:async()=> 'data:image/png;base64,test'}},
    '@/lib/ketidakhadiran-security':{letterActor:async()=>actor,LETTER_TYPES:['REKAM_MEDIK','REKAPAN_SAKIT','MENINGGALKAN_ASRAMA','REKOMENDASI_KONTROL','SAKIT','UKS'],mayManageLetter:(u,type,nomor='')=>u.roles.includes('ADMIN') || u.roles.includes(type==='REKOMENDASI_KONTROL'||type==='UKS'||type==='SAKIT'||type==='REKAM_MEDIK'||type==='REKAPAN_SAKIT'||nomor.includes('/UKS/')?'OP_UKS':'OP_IZIN')},
    '@/lib/public-url':{getPublicOrigin:()=> 'https://school.example'},'@/lib/surat-config':{getTemplateBackgroundUrl:async()=> '/images/background.png'},
    '@/app/ketidakhadiran/utils/letter-html':{getMonthRoman:()=> 'X',buildSingleHtml:p=>{if(renderFail)throw Error('Render failed');return `<p>${p.siswaNama}</p><div class="sign-name">${p.pejabatNama}</div>`;},buildCollectiveHtml:()=>'<p>collective</p>'},
    '@/lib/print/rekam-medis-letter':{buildRekapPrintHtml:p=>{assert.equal(p.appBase,'https://school.example');if(renderFail)throw Error('Render failed');return '<p>rekap</p>';}},
    '@/app/ketidakhadiran/utils/rekap-letter-data':{getRekapLetterData:async()=>({rekamRows:[],penandatangan:['UKS']})},
  });
  return body=>POST({json:async()=>body,headers:{get:()=> 'school.example'}});
}
test('Route surat menolak anonim dan role yang tidak berhak tanpa write', async () => {
  const f=fixture();assert.equal((await letterRoute(f,null)({letterType:'REKAM_MEDIK'})).status,401);
  assert.equal((await letterRoute(f,{roles:['SISWA']})({letterType:'REKAM_MEDIK'})).status,403);assert.equal(f.state.acca_letters.length,0);
});
test('Cetak ulang menghapus surat lama, membuat arsip baru dan audit', async () => {
  const f=fixture({ketidakhadiran:[absence()],acca_letters:[{id:'old',nomor_surat:'001/UKS/2026',nomor_urut:1,jenis_izin:'REKAM_MEDIK',siswa_nisn:'student'}],system_config:[{key:'acca-snapshot-old',value:'old html'}]});
  const result=await letterRoute(f)({letterType:'REKAM_MEDIK',row:{id:'a',nama:'Forged'},forceReprint:true,oldLetterId:'old'});
  assert.equal(result.body.ok,true);assert.equal(f.state.acca_letters.length,1);assert.notEqual(f.state.acca_letters[0].id,'old');assert.equal(f.state.acca_letters[0].siswa_nama,'Student');
  assert.equal(f.state.audit_logs[0].action,'REPRINT');assert.equal(f.state.system_config.length,1);assert.ok(f.state.acca_letters[0].barcode.length>30);
});
test('Gagal render atau simpan surat pengganti tidak menghapus arsip lama', async () => {
  for(const renderFail of [true,false]) {
    const f=fixture({ketidakhadiran:[absence()],acca_letters:[{id:'old',nomor_surat:'001/UKS/2026',nomor_urut:1,jenis_izin:'REKAM_MEDIK',siswa_nisn:'student'}]},(t,op)=>!renderFail && t==='acca_letters' && op==='create');
    const result=await letterRoute(f,undefined,renderFail)({letterType:'REKAM_MEDIK',row:{id:'a'},forceReprint:true,oldLetterId:'old'});
    assert.equal(result.body.ok,false);assert.equal(f.state.acca_letters[0].id,'old');assert.equal(f.state.acca_letters.length,1);
  }
});
test('Rekap memakai appBase yang tersedia dan penomoran serentak tidak bentrok', async () => {
  const f=fixture();const route=letterRoute(f);
  const results=await Promise.all([route({letterType:'REKAPAN_SAKIT',month:9,year:2026}),route({letterType:'REKAPAN_SAKIT',month:10,year:2026})]);
  assert.ok(results.every(r=>r.body.ok));assert.equal(new Set(f.state.acca_letters.map(r=>r.nomor_surat)).size,2);
});
test('Proxy POST menjaga query action; cetakan medis meng-escape data', () => {
  const proxy=read('apps/web/app/api/ketidakhadiran/rekam-medis-siswa/route.ts').split('export async function POST')[1].split('export async function PUT')[0];assert.match(proxy,/request.nextUrl.search/);
  const ui=read('apps/web/app/rekam-medis/view.tsx');for(const expr of ['safeText(r.keluhan','safeText(t)','safeText(student.nama_siswa)','safeText(oldItem)'])assert.ok(ui.includes(expr));
});

test('Daftar surat OP_IZIN tidak mengembalikan URL arsip medis', async () => {
  const f=fixture({acca_letters:[{id:'med',nomor_surat:'001/UKS/2026',jenis_izin:'P',file_url:'https://cdn/private.pdf'},{id:'izin',nomor_surat:'001/IZIN/P/2026',jenis_izin:'P'}]});
  const result=await f.service.getAccaLetters({},izin);assert.equal(result.data.length,1);assert.equal(result.data[0].id,'izin');
});
test('Cetak ulang jalur DOCX mempertahankan hapus-dan-ganti secara atomik', async () => {
  for(const failing of [false,true]) {
    const f=fixture({ketidakhadiran:[absence('a',{jenis:'IZIN',status:'MADRASAH'})],acca_letters:[{id:'old',nomor_surat:'001/IZIN/P/2026',nomor_urut:1,jenis_izin:'P',siswa_nisn:'student',tgl_mulai:'2026-10-12',tgl_selesai:'2026-10-12'}]},(t,op)=>failing && t==='acca_letters' && op==='create');
    const work=f.service.createAccaLetter({row:{id:'a'},forceReprint:true,oldLetterId:'old'},'https://school.example',izin);
    if(failing) {await assert.rejects(work,/Injected/);assert.equal(f.state.acca_letters[0].id,'old');}
    else {assert.equal((await work).ok,true);assert.notEqual(f.state.acca_letters[0].id,'old');assert.equal(f.state.acca_letters.length,1);}
  }
});
test('Rekap menghitung bagian rentang kontinu yang berada di dalam bulan', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{tgl_mulai:new Date('2026-09-30'),tgl_selesai:new Date('2026-10-02'),waktu_mulai_real:time('08:00'),waktu_selesai_real:time('09:00'),is_kontinu:true})]});
  const result=await f.service.getRekap({from:'2026-10-01',to:'2026-10-31'},uks);
  assert.equal(result.students[0].sakit_menit,33*60);
});
test('Preset tersimpan di server dan mapping NONE dibaca saat sinkron', async () => {
  const f=fixture({rekam_medis_siswa:[medical()]});
  await f.service.savePresets({keluhan:['Demam'],tindakan:['Observasi'],tindakLanjut:['Istirahat di UKS'],tindakLanjutMapping:[{name:'Istirahat di UKS',status:'NONE'}]},uks);
  assert.equal((await f.service.getPresets()).data.keluhan[0],'Demam');
  assert.equal((await f.service.syncKetidakhadiran('rm',undefined,uks)).result.skipped,true);
  assert.equal(f.state.ketidakhadiran.length,0);
});
test('Surat keluar asrama dari antrean sakit memakai alasan umum', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{status:'Sedang'})]});
  const result=await letterRoute(f,{id:'2',nama:'Izin Operator',nip:'izin',roles:['OP_IZIN'],pages:['ketidakhadiran']})({letterType:'MENINGGALKAN_ASRAMA',row:{id:'a'}});
  assert.equal(result.body.ok,true);assert.equal(f.state.acca_letters[0].keterangan,'Keperluan kesehatan');
});

test('Proxy arsip menolak host bebas, alamat privat, HTML dan redirect; IP koneksi dipatok', async () => {
  const { EventEmitter } = require('node:events');
  let connections=0, currentAddress='8.8.8.8', status=200, payload='%PDF-test';
  const security=moduleOf('apps/web/lib/ketidakhadiran-security.ts', {
    './app-jwt': { extractRequestToken:()=>'' }, './nest-api': { fetchMyAccess:async()=>null },
    './file-storage': { getCloudflareConfig:async()=>({publicUrl:'https://cdn.school.example'}) },
    'node:dns/promises': {lookup:async()=>[{address:currentAddress,family:4}]},
    'node:https': { request(url, options, callback) {
      connections++;options.lookup(url.hostname, {}, (error,address,family)=>{assert.equal(address,currentAddress);assert.equal(family,4);});
      const req=new EventEmitter();req.end=()=>{
        const response=new EventEmitter();response.statusCode=status;response.headers={};response.destroy=()=>{};
        callback(response);queueMicrotask(()=>{response.emit('data',Buffer.from(payload));response.emit('end');});
      };return req;
    } },
  });
  assert.equal(await security.fetchLetterArchive('https://evil.example/a.pdf'),null);
  assert.equal(await security.fetchLetterArchive('https://cdn.school.example/a.html'),null);
  assert.equal(connections,0);
  currentAddress='127.0.0.1';assert.equal(await security.fetchLetterArchive('https://cdn.school.example/a.pdf'),null);assert.equal(connections,0);
  currentAddress='8.8.8.8';assert.equal(Buffer.from(await security.fetchLetterArchive('https://cdn.school.example/a.pdf')).toString(),'%PDF-test');
  status=302;assert.equal(await security.fetchLetterArchive('https://cdn.school.example/a.pdf'),null);
  status=200;payload='<script>malicious()</script>';assert.equal(await security.fetchLetterArchive('https://cdn.school.example/a.pdf'),null);
});

test('Pratinjau medis anonim ditolak; arsip snapshot tidak dihitung ulang', async () => {
  const f=fixture({acca_letters:[{id:'l',barcode:'code',nomor_surat:'001/UKS/2026',jenis_izin:'REKAPAN_SAKIT'}],system_config:[{key:'acca-snapshot-l',value:'<p>Immutable snapshot</p>'}]});
  let actor=null;
  class ResponseStub { constructor(body,options={}) {this.body=body;this.status=options.status||200;this.headers=options.headers;} }
  const route=moduleOf('apps/web/app/api/ketidakhadiran/pdf-preview/route.ts', {
    '@/lib/prisma':{prisma:f.db},'next/server':{NextResponse:ResponseStub},qrcode:{default:{toDataURL:async()=> 'data:image/png;base64,test'}},
    '@/lib/ketidakhadiran-security':{letterActor:async()=>actor,mayManageLetter:()=>true,fetchLetterArchive:async()=>null},
    '@/lib/public-url':{getPublicOrigin:()=> 'https://school.example'},'@/lib/surat-config':{getTemplateBackgroundUrl:async()=> '/images/background.png'},
    '@/lib/puppeteer-launcher':{},'@/app/ketidakhadiran/utils/letter-html':{},'@/lib/print/rekam-medis-letter':{},
    '@/app/ketidakhadiran/utils/rekap-letter-data':{getRekapLetterData:async()=>{throw Error('Snapshot must not read current data');}},
  });
  const req={nextUrl:new URL('https://school.example/api/ketidakhadiran/pdf-preview?barcode=code'),headers:{get:()=> 'school.example'}};
  assert.equal((await route.GET(req)).status,401);
  actor={roles:['OP_UKS']};const result=await route.GET(req);assert.equal(result.status,200);assert.equal(result.body,'<p>Immutable snapshot</p>');assert.equal(result.headers['Cache-Control'],'no-store');
});

test('Siswa dengan username khusus membaca log NISN akun dan tetap ditolak untuk siswa lain', async () => {
  const f=fixture({ketidakhadiran:[absence(),absence('other',{nisn:'other'})]});
  const user={roles:['SISWA','PENGURUS_KELAS'],username:'custom_student',nip:'student'};
  const result=await f.service.getLog({mode:'history'},user);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].nisn,'student');
  await assert.rejects(f.service.getLogSiswa('other',undefined,user),/sendiri/);
});


test('Rekomendasi UKS memakai petugas pemeriksaan, bukan pencetak admin atau nama dari klien', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{status:'Kontrol',petugas_nama:'Perawat UKS A',petugas_nip:'123'})]});
  const result=await letterRoute(f,{id:'admin',nama:'Administrator',roles:['ADMIN']})({letterType:'REKOMENDASI_KONTROL',row:{id:'a',petugas_nama:'Nama palsu'},pejabatId:'Imran, S.Si.',pejabatJabatan:'Guru'});
  assert.equal(result.status,200);assert.equal(result.body.data.pejabat.nama,'Perawat UKS A');assert.equal(result.body.data.pejabat.jabatan,'Petugas UKS');assert.equal(result.body.data.pejabat.nip,'123');
  assert.equal(f.state.acca_letters[0].penjabat_nama,'Perawat UKS A');assert.equal(f.state.acca_letters[0].generated_by,'Administrator');assert(f.state.system_config[0].value.includes('Perawat UKS A'));assert(!f.state.system_config[0].value.includes('Imran'));
});
test('Petugas pada rekam medis terkait menjadi sumber penandatangan rekomendasi', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{status:'Kontrol',petugas_nama:'Penginput',rekam_medis_id:'rm'})],rekam_medis_siswa:[medical('rm',{petugas_nama:'Perawat Pemeriksa',petugas_nip:'456'})]});
  const result=await letterRoute(f)({letterType:'REKOMENDASI_KONTROL',row:{id:'a'}});assert.equal(result.body.data.pejabat.nama,'Perawat Pemeriksa');assert.equal(result.body.data.pejabat.nip,'456');
});
test('Rekomendasi tanpa nama petugas ditolak tanpa menyimpan surat', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{status:'Kontrol'})]});const result=await letterRoute(f)({letterType:'REKOMENDASI_KONTROL',row:{id:'a'}});
  assert.equal(result.status,400);assert.match(result.body.error,/petugas UKS/);assert.equal(f.state.acca_letters.length,0);
});
test('Jalur backend UKS memakai petugas catatan dan tidak menerima penandatangan palsu', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{status:'Kontrol',petugas_nama:'Perawat Backend',petugas_nip:'789'})]});
  const result=await f.service.createAccaLetter({row:{id:'a'},letterType:'UKS',pejabatId:'Imran, S.Si.'},'https://school.example',uks);
  assert.equal(result.data.pejabat.nama,'Perawat Backend');assert.equal(f.state.acca_letters[0].penjabat_jabatan,'Petugas UKS');
});
test('Jalur backend UKS menolak nama petugas kosong', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{status:'Kontrol'})]});await assert.rejects(f.service.createAccaLetter({row:{id:'a'},letterType:'UKS'},'https://school.example',uks),/petugas UKS/);assert.equal(f.state.acca_letters.length,0);
});
test('Perbaikan arsip hanya mengganti blok tanda tangan, menjaga nomor, QR, dan isi lain', () => {
  const {repairSignatureHtml}=require('../../../scripts/lib/uks-letter-repair.cjs');
  const html='<p>Imran, S.Si. pada isi surat</p><div class="sign-box"><div class="sign-place">Gowa, 1 Oktober</div><div>Guru</div><img src="data:QR"/><div class="sign-name">Imran, S.Si.</div><div class="barcode-id">ACCA-ORIGINAL</div><p>001/UKS/X/2026</p>';
  const result=repairSignatureHtml(html,{nama:'Perawat & Pemeriksa',nip:'-'});assert(result.includes('<p>Imran, S.Si. pada isi surat</p>'));assert(result.includes('<div class="sign-name">Perawat &amp; Pemeriksa</div>'));assert(result.includes('<div>Petugas UKS</div>'));assert(result.includes('ACCA-ORIGINAL'));assert(result.includes('data:QR'));assert(result.includes('001/UKS/X/2026'));
  assert.throws(()=>repairSignatureHtml('<p>Unexpected</p>',{nama:'Perawat',nip:'-'}),/structure/);
});

test('Jalur backend menggunakan petugas rekam medis terkait saat pencetak adalah admin', async () => {
  const f=fixture({ketidakhadiran:[absence('a',{status:'Kontrol',petugas_nama:'Penginput',rekam_medis_id:'rm'})],rekam_medis_siswa:[medical('rm',{petugas_nama:'Perawat Rekam Medis',petugas_nip:'999'})]});
  const result=await f.service.createAccaLetter({row:{id:'a'},letterType:'UKS'},'https://school.example',admin);assert.equal(result.data.pejabat.nama,'Perawat Rekam Medis');assert.equal(result.data.pejabat.nip,'999');
});
test('Rekomendasi kolektif dengan petugas berbeda ditolak tanpa write', async () => {
  for(const target of ['backend','next']) {
    const f=fixture({ketidakhadiran:[absence('a',{status:'Kontrol',petugas_nama:'Perawat A'}),absence('b',{status:'Kontrol',petugas_nama:'Perawat B'})]});
    const body={row:{id:'a'},rows:[{id:'a'},{id:'b'}],letterType:target==='backend'?'UKS':'REKOMENDASI_KONTROL'};
    if(target==='backend')await assert.rejects(f.service.createAccaLetter(body,'https://school.example',uks),/petugas UKS yang berbeda/);
    else assert.equal((await letterRoute(f)(body)).status,400);
    assert.equal(f.state.acca_letters.length,0);
  }
});
