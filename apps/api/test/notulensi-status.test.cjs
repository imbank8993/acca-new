const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notulensiStatus } = require('../../../packages/shared/notulensi-status.cjs');
const { fixture, owner, points } = require('./notulensi-fixture.cjs');

test('overall status covers every combination of up to four points', () => {
  for (let length = 0; length <= 4; length++) for (let value = 0; value < 3 ** length; value++) {
    let n = value;
    const statuses = Array.from({ length }, () => {
      const status = ['Belum', 'Proses', 'Selesai'][n % 3]; n = Math.floor(n / 3); return status;
    });
    const expected = statuses.length && statuses.every(s => s === 'Selesai') ? 'Selesai' : statuses.every(s => s === 'Belum') ? 'Belum' : 'Proses';
    assert.equal(notulensiStatus(points(statuses)), expected);
  }
});

test('create/update derive status from points and ignore manual overall status', async () => {
  for (const method of ['create', 'update']) for (const statuses of [[], ['Belum', 'Belum'], ['Selesai', 'Selesai'], ['Belum', 'Selesai'], ['Proses']]) {
    const f = fixture();
    const body = { agenda: 'Rapat', tanggal: '2026-10-20', poin_poin: points(statuses), status: 'Selesai', revision: f.row.revision };
    const result = method === 'create' ? await f.service.create(body, owner) : await f.service.update('1', body, owner);
    assert.equal(result.data.status, notulensiStatus(body.poin_poin));
    assert.equal(f.row.status, result.data.status);
  }
});

test('point updates recompute overall progress under a row lock', async () => {
  const f = fixture({ poin_poin: points(['Belum', 'Belum']) });
  const set = async (id, status) => f.service.updateStatus('1', { poin_id: id, poin_status: status }, owner);
  assert.equal((await set('0', 'Selesai')).data.status, 'Proses');
  assert.equal((await set('1', 'Selesai')).data.status, 'Selesai');
  assert.equal((await set('0', 'Belum')).data.status, 'Proses');
  assert.equal((await set('1', 'Belum')).data.status, 'Belum');
  assert(f.queries.some(q => q.sql.includes('FOR UPDATE')));
});

test('manual overall edits, missing points and invalid point statuses cannot write', async () => {
  for (const body of [{ status: 'Selesai' }, { poin_id: 'missing', poin_status: 'Selesai' }, { poin_id: '0', poin_status: 'wrong' }]) {
    const f = fixture({ poin_poin: points(['Belum']) });
    await assert.rejects(f.service.updateStatus('1', body, owner));
    assert.equal(f.queries.some(q => q.sql.includes('UPDATE public')), false);
  }
});

test('legacy detail status follows points even if the saved status disagrees', async () => {
  const f = fixture({ poin_poin: points(['Belum', 'Selesai']), status: 'Belum' });
  assert.equal((await f.service.getDetail('1', owner)).data.status, 'Proses');
});
