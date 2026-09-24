const path = require('path');
const fs = require('fs');

// 1. Load backend/.env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');
const tableFilter = args.find(a => a.startsWith('--table='))?.split('=')[1];

// Definition of tables that need sync (in dependency order)
const SYNC_CONFIG = [
  { supabaseTable: 'users', prismaModel: 'public_users', idField: 'id', idType: 'bigint' },
  { supabaseTable: 'master_siswa', prismaModel: 'master_siswa', idField: 'id', idType: 'bigint' },
  { supabaseTable: 'rekam_medis_siswa', prismaModel: 'rekam_medis_siswa', idField: 'id', idType: 'string' },
  { supabaseTable: 'ekskul', prismaModel: 'ekskul', idField: 'id', idType: 'string' },
  { supabaseTable: 'ekskul_pertemuan', prismaModel: 'ekskul_pertemuan', idField: 'id', idType: 'string' },
  { supabaseTable: 'ekskul_siswa', prismaModel: 'ekskul_siswa', idField: 'id', idType: 'string' },
  { supabaseTable: 'ketidakhadiran', prismaModel: 'ketidakhadiran', idField: 'id', idType: 'string' },
  { supabaseTable: 'absensi_sesi', prismaModel: 'absensi_sesi', idField: 'id', idType: 'string' },
  { supabaseTable: 'jurnal_guru', prismaModel: 'jurnal_guru', idField: 'id', idType: 'number' },
  { supabaseTable: 'absensi_detail', prismaModel: 'absensi_detail', idField: 'id', idType: 'string' },
  { supabaseTable: 'jurnal_banding', prismaModel: 'jurnal_banding', idField: 'id', idType: 'number' },
];

async function fetchAllSupabaseIds(tableName, idField) {
  let allIds = new Set();
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(idField)
      .range(from, from + step - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      allIds.add(String(row[idField]));
    }
    if (data.length < step) break;
    from += step;
  }
  return allIds;
}

async function fetchAllPrismaIds(prismaModel, idField) {
  const records = await prisma[prismaModel].findMany({
    select: { [idField]: true },
  });
  return new Set(records.map(r => String(r[idField])));
}

async function syncTable(config) {
  const { supabaseTable, prismaModel, idField, idType } = config;
  console.log(`\nAnalyzing table: ${supabaseTable} -> prisma.${prismaModel}...`);

  const [supaIdSet, prismaIdSet] = await Promise.all([
    fetchAllSupabaseIds(supabaseTable, idField),
    fetchAllPrismaIds(prismaModel, idField),
  ]);

  const missingInVps = [];
  for (const id of supaIdSet) {
    if (!prismaIdSet.has(id)) {
      missingInVps.push(id);
    }
  }

  console.log(`  Supabase records : ${supaIdSet.size}`);
  console.log(`  VPS records      : ${prismaIdSet.size}`);
  console.log(`  Missing in VPS   : ${missingInVps.length}`);

  if (missingInVps.length === 0) {
    console.log(`  Status           : 100% IN SYNC`);
    return { table: supabaseTable, missing: 0, synced: 0 };
  }

  if (isDryRun) {
    console.log(`  [DRY-RUN] Sample missing IDs (up to 5):`, missingInVps.slice(0, 5));
    console.log(`  [DRY-RUN] Pass --execute to apply missing records to VPS.`);
    return { table: supabaseTable, missing: missingInVps.length, synced: 0 };
  }

  // Execute sync
  console.log(`  [EXECUTE] Fetching and inserting ${missingInVps.length} missing rows...`);
  let synced = 0;
  const batchSize = 100;
  for (let i = 0; i < missingInVps.length; i += batchSize) {
    const chunkIds = missingInVps.slice(i, i + batchSize);
    
    // Fetch full data from Supabase
    let query = supabase.from(supabaseTable).select('*');
    if (idType === 'bigint' || idType === 'number') {
      query = query.in(idField, chunkIds.map(Number));
    } else {
      query = query.in(idField, chunkIds);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error(`  Error fetching chunk from Supabase:`, error.message);
      break;
    }

    // Insert chunk into Prisma VPS
    for (const row of rows) {
      try {
        // Convert dates and bigints
        const sanitized = { ...row };
        for (const [k, v] of Object.entries(sanitized)) {
          if (v && typeof v === 'string' && (/^\d{4}-\d{2}-\d{2}T/.test(v) || (/^\d{4}-\d{2}-\d{2}$/.test(v) && (k.includes('tanggal') || k.includes('date'))))) {
            sanitized[k] = new Date(v);
          } else if (v && typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v) && (k.includes('waktu') || k.includes('jam') || k.includes('time'))) {
            sanitized[k] = new Date(`1970-01-01T${v.length === 5 ? v + ':00' : v}Z`);
          } else if (k === 'id' && idType === 'bigint') {
            sanitized[k] = BigInt(v);
          } else if (k.endsWith('_id') && typeof v === 'number' && idType === 'bigint') {
            sanitized[k] = BigInt(v);
          }
        }

        try {
          await prisma[prismaModel].upsert({
            where: { [idField]: idType === 'bigint' ? BigInt(row[idField]) : row[idField] },
            update: sanitized,
            create: sanitized,
          });
          synced++;
        } catch (prismaErr) {
          // Fallback to raw SQL
          try {
            const cols = Object.keys(row);
            const vals = Object.values(row).map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
            const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
            const updateClause = cols.filter(c => c !== idField).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
            const query = `INSERT INTO "${supabaseTable}" ("${cols.join('", "')}") VALUES (${placeholders}) ON CONFLICT ("${idField}") DO UPDATE SET ${updateClause}`;
            await pool.query(query, vals);
            synced++;
          } catch (rawErr) {
            console.warn(`  Warning: failed to upsert row ${row[idField]}:`, rawErr.message);
          }
        }
      } catch (err) {
        console.warn(`  Warning: failed to process row:`, err.message);
      }
    }
  }

  console.log(`  [EXECUTE] Successfully synced ${synced}/${missingInVps.length} rows.`);
  return { table: supabaseTable, missing: missingInVps.length, synced };
}

async function main() {
  console.log('='.repeat(70));
  console.log(`  ACCA DATA SYNC TOOL (Supabase Cloud -> PostgreSQL VPS)`);
  console.log(`  Mode: ${isDryRun ? 'DRY-RUN (Safe, no writes)' : 'EXECUTE (Writing to VPS)'}`);
  console.log('='.repeat(70));

  const tables = tableFilter
    ? SYNC_CONFIG.filter(c => c.supabaseTable === tableFilter)
    : SYNC_CONFIG;

  if (tables.length === 0) {
    console.error(`Unknown table filter: ${tableFilter}`);
    process.exit(1);
  }

  for (const config of tables) {
    try {
      await syncTable(config);
    } catch (err) {
      console.error(`Failed on table ${config.supabaseTable}:`, err.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
