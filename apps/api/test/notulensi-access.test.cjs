const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, owner, pic, other, admin, points, json, notulensiDirectory } = require('./notulensi-fixture.cjs');
const notePoints = [
  { id: 'a', teks: 'Tugas pribadi PIC', status: 'Belum', pic: 'Nama lama', pic_user_id: '2', tenggat: '2026-10-31' },
  { id: 'b', teks: 'Keputusan rahasia pihak lain', status: 'Selesai', pic_user_id: '3', pic: 'Pengguna Lain' },
];
const isForbidden = error => error.getStatus?.() === 403;

test('list and detail expose only assigned points, without meeting metadata', async () => {
  const f = fixture({ poin_poin: notePoints });
  for (const response of [await f.service.getList({}, pic), await f.service.getDetail('1', pic)]) {
    const item = Array.isArray(response.data) ? response.data[0] : response.data;
    assert.equal(item.visibility, 'pic');
    assert.deepEqual(json(item.poin_poin).map(point => point.id), ['a']);
    assert.equal(item.can_edit, false);
    assert.equal(item.can_print, false);
    assert.equal(item.status, 'Belum');
    for (const key of ['tanggal', 'lokasi', 'peserta', 'catatan', 'pimpinan_rapat', 'notulis', 'created_by', 'revision', 'updated_at']) assert.equal(key in item, false);
    assert.equal(JSON.stringify(response).includes('Keputusan rahasia'), false);
  }
});

test('unrelated users, including administrators, get title only from list and detail', async () => {
  const f = fixture({ poin_poin: notePoints.slice(0, 1) });
  for (const user of [other, admin]) {
    const detail = (await f.service.getDetail('1', user)).data;
    const list = await f.service.getList({}, user);
    assert.deepEqual(json(detail), { id: '1', agenda: 'Rapat', poin_poin: [], status: null, visibility: 'title', can_edit: false, can_print: false });
    assert.deepEqual(json(list.data[0]), json(detail));
    assert.deepEqual(json(list.stats), { total: 1, belum: 0, proses: 0, selesai: 0 });
  }
});

test('search, date and status filters cannot reveal hidden metadata or points', async () => {
  const f = fixture({ poin_poin: notePoints });
  for (const user of [pic, admin]) {
    for (const search of ['Keputusan rahasia', 'Daftar rahasia', 'Catatan rahasia', 'Ruang privat']) {
      assert.equal((await f.service.getList({ search }, user)).data.length, 0);
    }
    assert.equal((await f.service.getList({ status: 'Selesai' }, user)).data.length, 0);
    assert.equal((await f.service.getList({ tanggal: '2026-10-20' }, user)).data.length, 0);
  }
  assert.equal((await f.service.getList({ search: 'Tugas pribadi PIC' }, pic)).data.length, 1);
  assert.equal((await f.service.getList({ search: 'Rapat' }, admin)).data.length, 1);
});

test('only the creator may edit, delete or change status; manager/admin/PIC cannot', async () => {
  for (const user of [pic, other, admin]) {
    const f = fixture({ poin_poin: notePoints });
    await assert.rejects(f.service.update('1', { agenda: 'Palsu', created_by: 'user:2', revision: f.row.revision }, user), isForbidden);
    await assert.rejects(f.service.updateStatus('1', { poin_id: 'a', poin_status: 'Selesai' }, user), isForbidden);
    await assert.rejects(f.service.delete('1', user), isForbidden);
    assert.equal(f.queries.some(query => /UPDATE public|DELETE FROM|INSERT INTO/.test(query.sql)), false);
  }
  const f = fixture({ poin_poin: notePoints });
  assert.equal((await f.service.getDetail('1', owner)).data.can_print, true);
  assert.equal((await f.service.updateStatus('1', { poin_id: 'a', poin_status: 'Proses' }, { ...owner, canCreate: false })).data.status, 'Proses');
  assert.equal((await f.service.delete('1', owner)).success, true);
});

test('new notes bind creator and PIC to server identities, ignoring forged names', async () => {
  const f = fixture();
  await f.service.create({ agenda: 'Rapat', tanggal: '2026-10-20', created_by: 'user:2', poin_poin: [{ ...notePoints[0], pic: 'Palsu' }] }, owner);
  assert.equal(f.row.created_by, 'user:1');
  assert.equal(f.row.poin_poin[0].pic_user_id, '2');
  assert.equal(f.row.poin_poin[0].pic, pic.nama);
  await assert.rejects(f.service.create({ agenda: 'Rapat', tanggal: '2026-10-20', poin_poin: [] }, pic), isForbidden);
});

test('legacy owner and PIC names match exactly and only when unambiguous', async () => {
  const f = fixture({ created_by: 'Pembuat', poin_poin: [{ id: 'a', teks: 'Tugas', status: 'Belum', pic: '  PIC   Satu ' }] });
  assert.equal((await f.service.getDetail('1', owner)).data.visibility, 'owner');
  assert.equal((await f.service.getDetail('1', pic)).data.visibility, 'pic');
  const duplicate = fixture({ created_by: 'Pembuat', poin_poin: [{ id: 'a', teks: 'Tugas', status: 'Belum', pic: pic.nama }] }, [{ ...pic, id: 8n, nip: '008', username: 'pic2' }, { ...owner, id: 9n, nip: '009', username: 'pembuat2' }]);
  assert.equal((await duplicate.service.getDetail('1', owner)).data.visibility, 'title');
  assert.equal((await duplicate.service.getDetail('1', pic)).data.visibility, 'title');
  const directory = notulensiDirectory([pic]);
  assert.equal(directory.picId({ pic_user_id: '999', pic: pic.nama }), null);
  assert.equal(directory.resolveLegacy('PIC Sat'), null);
});

test('duplicate names cannot steal an explicit owner or PIC assignment', async () => {
  const f = fixture({ poin_poin: notePoints }, [{ ...pic, id: 8n, nip: '008', username: 'pic2' }, { ...owner, id: 9n, nip: '009', username: 'pembuat2' }]);
  assert.equal((await f.service.getDetail('1', { id: 8n })).data.visibility, 'title');
  assert.equal((await f.service.getDetail('1', { id: 9n })).data.visibility, 'title');
  assert.equal((await f.service.getDetail('1', pic)).data.visibility, 'pic');
});

test('changing account names cannot claim a legacy owner or PIC identity', async () => {
  const f = fixture({ created_by: 'Pembuat', poin_poin: [{ id: 'a', teks: 'Tugas', status: 'Belum', pic: 'PIC Satu' }] });
  await f.service.getList({}, owner);
  f.users[0].nama = 'Nama baru pembuat';
  f.users[0].username = 'pembuat-baru';
  f.users[1].nama = 'Nama baru PIC';
  f.users.push({ id: 8n, nama: 'Pembuat', username: 'pembuat', nip: '008' });
  f.users.push({ id: 9n, nama: 'PIC Satu', username: 'pic-baru', nip: '009' });
  assert.equal((await f.service.getDetail('1', { id: 8n })).data.visibility, 'title');
  assert.equal((await f.service.getDetail('1', { id: 9n })).data.visibility, 'title');
  assert.equal((await f.service.getDetail('1', owner)).data.visibility, 'owner');
  assert.equal((await f.service.getDetail('1', pic)).data.visibility, 'pic');
});

test('a stale explicit PIC ID cannot fall back to a matching user name', async () => {
  const f = fixture({ poin_poin: [{ id: 'a', teks: 'Tugas', status: 'Belum', pic_user_id: '999', pic: pic.nama }] });
  assert.equal((await f.service.getDetail('1', pic)).data.visibility, 'title');
});

test('legacy point IDs are stable and editable without replacing other points', async () => {
  const f = fixture({ poin_poin: [{ teks: 'Tanpa ID', status: 'Belum', pic_user_id: '2' }, { teks: 'Lainnya', status: 'Selesai' }] });
  const first = (await f.service.getDetail('1', owner)).data;
  const next = (await f.service.getDetail('1', owner)).data;
  assert.equal(first.poin_poin[0].id, next.poin_poin[0].id);
  await f.service.updateStatus('1', { poin_id: first.poin_poin[0].id, poin_status: 'Proses' }, owner);
  assert.equal(f.row.poin_poin[1].status, 'Selesai');
});

test('stale full edits cannot overwrite a newer point update', async () => {
  const f = fixture({ poin_poin: points(['Belum']) });
  const stale = (await f.service.getDetail('1', owner)).data;
  await f.service.updateStatus('1', { poin_id: '0', poin_status: 'Selesai' }, owner);
  await assert.rejects(f.service.update('1', stale, owner), error => error.getStatus?.() === 409);
  assert.equal(f.row.status, 'Selesai');
});

test('malformed pagination, IDs, dates, duplicate point IDs and invalid PICs are rejected', async () => {
  const f = fixture();
  for (const query of [{ limit: 'NaN' }, { offset: '-1' }, { limit: '1; DROP TABLE' }, { bulan: '2026-13' }, { status: 'wrong' }]) await assert.rejects(f.service.getList(query, owner));
  for (const id of ['0', '-1', '1 OR 1=1', '9223372036854775808']) await assert.rejects(f.service.getDetail(id, owner));
  for (const tanggal of ['2026-02-30', '2026-10-20garbage']) await assert.rejects(f.service.create({ agenda: 'Rapat', tanggal, poin_poin: [] }, owner));
  await assert.rejects(f.service.create({ agenda: 'Rapat', tanggal: '2026-10-20', poin_poin: [{ ...notePoints[0], pic_user_id: '999' }] }, owner));
  await assert.rejects(f.service.create({ agenda: 'Rapat', tanggal: '2026-10-20', poin_poin: [notePoints[0], notePoints[0]] }, owner));
});

test('configuration and participant directory cannot be read by unrelated viewers', async () => {
  const f = fixture();
  await assert.rejects(f.service.getPengaturan(pic), isForbidden);
  await assert.rejects(f.service.getPesertaOptions(pic), isForbidden);
  assert.equal((await f.service.getPengaturan(admin)).success, true);
  assert.equal((await f.service.getPesertaOptions(owner)).data.picUsers[1].id, '2');
});
