// Execute the production query against an isolated, in-memory PostgreSQL.
let database;
let queue = Promise.resolve();
require('node:test').after(async () => {
  await queue;
  await database?.close();
});
async function queryList(rows, sql, args) {
  const run = queue.then(async () => {
    if (!database) {
      const { PGlite } = require('@electric-sql/pglite');
      database = new PGlite();
      await database.exec(`CREATE TABLE notulensi_rapat (
        id bigint PRIMARY KEY, agenda varchar(255), tanggal date,
        waktu_mulai text, waktu_selesai text, lokasi text, pimpinan_rapat text,
        notulis text, peserta text, poin_poin jsonb, status text, catatan text,
        agenda_id bigint, created_by text, created_at timestamptz, updated_at timestamptz
      )`);
    }
    return database.transaction(async tx => {
      await tx.exec('DELETE FROM notulensi_rapat');
      for (const row of rows) {
        const keys = ['id', 'agenda', 'tanggal', 'waktu_mulai', 'waktu_selesai', 'lokasi',
          'pimpinan_rapat', 'notulis', 'peserta', 'poin_poin', 'status', 'catatan',
          'agenda_id', 'created_by', 'created_at', 'updated_at'];
        await tx.query(`INSERT INTO notulensi_rapat (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
          keys.map(key => key === 'poin_poin' ? JSON.stringify(row[key] ?? []) : row[key] ?? null));
      }
      return (await tx.query(sql, args)).rows;
    });
  });
  queue = run.catch(() => {});
  return run;
}
module.exports = { queryList };
