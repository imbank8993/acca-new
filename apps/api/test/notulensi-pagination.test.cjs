const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, owner, pic, compileModule } = require('./notulensi-fixture.cjs');
const { queryList } = require('./notulensi-list-db.cjs');
const { NOTULENSI_LIST_SQL: sql } = compileModule('apps/api/src/notulensi/notulensi-list.ts', require);

test('database pagination preserves order, totals and global visible statistics', async () => {
  const base = fixture().row;
  const notes = Array.from({ length: 125 }, (_, i) => ({ ...base, id: String(i + 1),
    agenda: `Rapat ${i}`, poin_poin: [{ teks: 'Tugas', status: i % 2 ? 'Selesai' : 'Belum' }] }));
  const [page] = await queryList(notes, sql, ['1', '{}', '', '', '', 50, 50]);
  assert.equal(page.total, 125);
  assert.equal(page.data.length, 50);
  assert.equal(page.data[0].id, '75');
  assert.equal(page.data[49].id, '26');
  assert.deepEqual(page.stats, { total: 125, belum: 63, selesai: 62, proses: 0 });
  const [beyond] = await queryList(notes, sql, ['1', '{}', '', '', '', 50, 150]);
  assert.equal(beyond.total, 125);
  assert.equal(beyond.data.length, 0);
});

test('legacy JSON strings, invalid payloads and normalized statuses match projected visibility', async () => {
  for (const raw of [JSON.stringify([{ id: 'p', teks: 'Tugas lama', pic: 'PIC Satu', status: ' selesai ' }]),
    [{ poin: 'Tugas lama', pic_user_id: '2', status: 'SELESAI' }],
    [{ teks: 'Tugas lama', pic: '\tPIC   Satu\n', status: '\tSelesai\n' }]]) {
    const f = fixture({ created_by: 'Pembuat', poin_poin: raw });
    assert.equal((await f.service.getList({ status: 'Selesai' }, pic)).data.length, 1);
    assert.equal((await f.service.getList({ search: 'tugas lama' }, pic)).total, 1);
    assert.equal((await f.service.getList({ tanggal: '2026-10-20' }, pic)).total, 0);
    assert.equal((await f.service.getList({ tanggal: '2026-10-20' }, owner)).total, 1);
  }
  for (const raw of ['invalid JSON', '{}', [null, { teks: '\t \n', status: 'Selesai' }]]) {
    const f = fixture({ poin_poin: raw });
    assert.equal((await f.service.getList({}, owner)).data[0].status, 'Belum');
    assert.equal((await f.service.getList({}, pic)).data[0].status, null);
  }
});

test('literal search treats SQL punctuation as text and cannot match hidden metadata', async () => {
  const f = fixture({ agenda: 'Rapat 100%_aman', poin_poin: [{ teks: 'Rahasia', pic_user_id: '3' }] });
  assert.equal((await f.service.getList({ search: '%_aman' }, pic)).total, 1);
  for (const search of ["' OR 1=1 --", 'Rahasia', 'Catatan rahasia']) {
    assert.equal((await f.service.getList({ search }, pic)).total, 0);
  }
});
