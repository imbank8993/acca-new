// Dry run by default. --apply updates metadata and HTML snapshots in one transaction.
// Backups contain private document data and stay in the Git-ignored scratch directory.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { Client } = require('pg');
const { wrongDefaultSigner, repairSignatureHtml } = require('./lib/uks-letter-repair.cjs');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
const APPLY = process.argv.includes('--apply');
const mutable = new Set(['penjabat_nama', 'penjabat_jabatan', 'file_url', 'file_name', 'file_size']);
const immutable = record => Object.fromEntries(Object.entries(record).filter(([key]) => !mutable.has(key)));
(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
    await client.connect(); let committed = false;
    try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout='10s'");
        await client.query("SET LOCAL statement_timeout='30s'");
        if (APPLY) await client.query('SELECT pg_advisory_xact_lock(424201)');
        const rows = await client.query(`SELECT l.*,coalesce(nullif(trim(m.petugas_nama),''),nullif(trim(k.petugas_nama),'')) AS correct_name,
            CASE WHEN nullif(trim(m.petugas_nama),'') IS NOT NULL THEN m.petugas_nip ELSE k.petugas_nip END AS correct_nip
            FROM acca_letters l LEFT JOIN ketidakhadiran k ON k.id=l.ketidakhadiran_id
            LEFT JOIN rekam_medis_siswa m ON m.id=k.rekam_medis_id
            WHERE l.jenis_izin IN ('REKOMENDASI_KONTROL','SAKIT','UKS')
            AND regexp_replace(lower(coalesce(l.penjabat_nama,'')),'[^a-z]','','g')='imranssi'
            ORDER BY l.id ${APPLY ? 'FOR UPDATE OF l' : ''}`);
        const patches = [], skipped = [];
        for (const row of rows.rows) {
            const { correct_name, correct_nip, ...letter } = row;
            if (!correct_name || /^(?:-|petugas(?: uks)?|admin uks)$/i.test(correct_name)) { skipped.push(row.id); continue; }
            if (wrongDefaultSigner(correct_name)) continue;
            const snapshot = (await client.query(`SELECT key,value,updated_at,updated_by FROM system_config WHERE key=$1 ${APPLY ? 'FOR UPDATE' : ''}`, [`acca-snapshot-${letter.id}`])).rows[0] || null;
            const signer = { nama: correct_name, nip: correct_nip || '-' };
            patches.push({ letter, snapshot, signer, html: snapshot?.value ? repairSignatureHtml(snapshot.value, signer) : null });
        }
        const summary = { mode: APPLY ? 'apply' : 'dry-run', candidates: rows.rowCount, corrected: patches.length,
            htmlSnapshots: patches.filter(p => p.html).length, detachedOldFiles: patches.filter(p => p.letter.file_url).length,
            missingAuthoritativeStaff: skipped.length, byStaff: patches.reduce((all, patch) => ({ ...all, [patch.signer.nama]: (all[patch.signer.nama] || 0) + 1 }), {}) };
        if (!APPLY) { await client.query('ROLLBACK'); console.log(JSON.stringify(summary)); return; }
        if (skipped.length) throw new Error('Some affected letters lack authoritative staff; inspect before applying');
        const backupDir = path.join(root, 'scratch', 'uks-letter-backups'); fs.mkdirSync(backupDir, { recursive: true });
        const backupPath = path.join(backupDir, `before-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), patches }, null, 2), { mode: 0o600 });
        for (const patch of patches) {
            const { letter, signer, snapshot, html } = patch;
            const result = await client.query(`UPDATE acca_letters SET penjabat_nama=$2,penjabat_jabatan='Petugas UKS',
                file_name=CASE WHEN file_url IS NOT NULL THEN NULL ELSE file_name END,
                file_size=CASE WHEN file_url IS NOT NULL THEN NULL ELSE file_size END,file_url=NULL
                WHERE id=$1 AND penjabat_nama IS NOT DISTINCT FROM $3 RETURNING *`, [letter.id, signer.nama, letter.penjabat_nama]);
            assert.equal(result.rowCount, 1); assert.deepEqual(immutable(result.rows[0]), immutable(letter));
            if (snapshot && html) {
                const changed = await client.query(`UPDATE system_config SET value=$2,updated_at=now(),updated_by='uks-signer-data-correction-20261017' WHERE key=$1 AND value IS NOT DISTINCT FROM $3`, [snapshot.key, html, snapshot.value]);
                assert.equal(changed.rowCount, 1);
            }
        }
        await client.query('COMMIT'); committed = true;
        console.log(JSON.stringify({ ...summary, committed: true, numbersAndBarcodesPreserved: true, privateBackup: path.relative(root, backupPath) }));
    } catch (error) { if (!committed) await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); }
})().catch(error => { console.error('UKS signer correction failed:', error.code || error.message); process.exitCode = 1; });
