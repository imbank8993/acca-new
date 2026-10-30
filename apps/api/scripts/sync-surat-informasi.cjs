const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
process.env.TS_NODE_PROJECT = path.join(__dirname, '../tsconfig.json');
require('ts-node/register/transpile-only');
const { PrismaClient } = require('@prisma/client');
const { SuratService } = require('../src/surat/surat.service');
const apply = process.argv.includes('--apply');
const db = new PrismaClient({ log: [] });
(async () => {
  try {
    const report = await new SuratService(db).syncExistingEdaran(apply);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', ...report }));
    if (report.failed.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ error: 'Sinkronisasi gagal; periksa koneksi database.', code: error.code || error.name }));
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
})();
