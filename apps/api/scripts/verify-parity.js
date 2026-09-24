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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const prisma = new PrismaClient();

// List of important tables to compare
const TABLES_TO_CHECK = [
  // Auth & Pegawai
  { name: 'users', prismaModel: 'public_users' },
  { name: 'master_guru', prismaModel: 'master_guru' },
  { name: 'user_roles', prismaModel: 'user_roles' },
  { name: 'role_permissions', prismaModel: 'role_permissions' },

  // Master Data
  { name: 'master_tahun_ajaran', prismaModel: 'master_tahun_ajaran' },
  { name: 'master_kelas', prismaModel: 'master_kelas' },
  { name: 'master_mapel', prismaModel: 'master_mapel' },
  { name: 'master_siswa', prismaModel: 'master_siswa' },
  { name: 'master_pejabat', prismaModel: 'master_pejabat' },
  { name: 'master_dropdown', prismaModel: 'master_dropdown' },
  { name: 'master_jenis_surat', prismaModel: 'master_jenis_surat' },

  // Siswa
  { name: 'siswa_kelas', prismaModel: 'siswa_kelas' },
  { name: 'siswa_kelompok', prismaModel: 'siswa_kelompok' },

  // Jadwal
  { name: 'jadwal_guru', prismaModel: 'jadwal_guru' },
  { name: 'jadwal_piket', prismaModel: 'jadwal_piket' },
  { name: 'jadwal_versi', prismaModel: 'jadwal_versi' },

  // Jurnal & Tugas
  { name: 'jurnal_guru', prismaModel: 'jurnal_guru' },
  { name: 'jurnal_banding', prismaModel: 'jurnal_banding' },
  { name: 'jurnal_tugas_tambahan', prismaModel: 'jurnal_tugas_tambahan' },
  { name: 'tugas_tambahan', prismaModel: 'tugas_tambahan' },

  // Ketidakhadiran & Absensi
  { name: 'ketidakhadiran', prismaModel: 'ketidakhadiran' },
  { name: 'absensi_sesi', prismaModel: 'absensi_sesi' },
  { name: 'absensi_detail', prismaModel: 'absensi_detail' },
  { name: 'absensi_rekap_lock', prismaModel: 'absensi_rekap_lock' },

  // LCKH
  { name: 'lckh_periods', prismaModel: 'lckh_periods' },
  { name: 'lckh_submissions', prismaModel: 'lckh_submissions' },
  { name: 'lckh_approvals', prismaModel: 'lckh_approvals' },
  { name: 'lckh_modules', prismaModel: 'lckh_modules' },

  // Nilai
  { name: 'nilai_bobot', prismaModel: 'nilai_bobot' },
  { name: 'nilai_tagihan', prismaModel: 'nilai_tagihan' },
  { name: 'nilai_data', prismaModel: 'nilai_data' },
  { name: 'nilai_logs', prismaModel: 'nilai_logs' },

  // Surat & Dokumen
  { name: 'surat', prismaModel: 'surat' },
  { name: 'surat_templates', prismaModel: 'surat_templates' },
  { name: 'pengumuman', prismaModel: 'pengumuman' },
  { name: 'informasi_akademik', prismaModel: 'informasi_akademik' },

  // Klinik
  { name: 'rekam_medis_siswa', prismaModel: 'rekam_medis_siswa' },

  // Guru Asuh & Catatan Siswa
  { name: 'guru_asuh', prismaModel: 'guru_asuh' },
  { name: 'catatan_siswa', prismaModel: 'catatan_siswa' },

  // Ekskul
  { name: 'ekskul', prismaModel: 'ekskul' },
  { name: 'ekskul_siswa', prismaModel: 'ekskul_siswa' },
  { name: 'ekskul_pembina', prismaModel: 'ekskul_pembina' },
  { name: 'ekskul_pertemuan', prismaModel: 'ekskul_pertemuan' },

  // Settings & Storage
  { name: 'site_settings', prismaModel: 'site_settings' },
  { name: 'file_storage_config', prismaModel: 'file_storage_config' },
];

async function getSupabaseCount(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { count: null, error: error.message };
    }
    return { count, error: null };
  } catch (err) {
    return { count: null, error: err.message };
  }
}

async function getPrismaCount(modelName) {
  try {
    if (!prisma[modelName]) {
      return { count: null, error: `Model prisma.${modelName} not found` };
    }
    const count = await prisma[modelName].count();
    return { count, error: null };
  } catch (err) {
    return { count: null, error: err.message };
  }
}

async function run() {
  console.log('='.repeat(75));
  console.log('       ACCA PARITY VERIFICATION: Supabase Cloud vs PostgreSQL VPS');
  console.log('='.repeat(75));
  console.log(`Supabase URL : ${supabaseUrl}`);
  console.log(`Prisma URL   : ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('-'.repeat(75));

  const results = [];
  let totalSupabaseRows = 0;
  let totalVpsRows = 0;
  let matchCount = 0;
  let diffCount = 0;
  let errorCount = 0;

  for (const table of TABLES_TO_CHECK) {
    process.stdout.write(`Checking ${table.name.padEnd(25)} ... `);
    const [supaRes, prismaRes] = await Promise.all([
      getSupabaseCount(table.name),
      getPrismaCount(table.prismaModel),
    ]);

    const sCount = supaRes.count;
    const pCount = prismaRes.count;
    let status = 'UNKNOWN';
    let diff = 0;

    if (supaRes.error || prismaRes.error) {
      status = 'ERROR';
      errorCount++;
      const errMsg = supaRes.error ? `SupaErr: ${supaRes.error}` : `PrismaErr: ${prismaRes.error}`;
      console.log(`[!] ${errMsg}`);
    } else {
      diff = (sCount || 0) - (pCount || 0);
      totalSupabaseRows += sCount || 0;
      totalVpsRows += pCount || 0;

      if (diff === 0) {
        status = 'MATCH';
        matchCount++;
        console.log(`OK (Both: ${sCount})`);
      } else if (diff > 0) {
        status = `VPS_BEHIND (+${diff})`;
        diffCount++;
        console.log(`DIFF: Supa=${sCount}, VPS=${pCount} (VPS behind by ${diff})`);
      } else {
        status = `VPS_AHEAD (${diff})`;
        diffCount++;
        console.log(`DIFF: Supa=${sCount}, VPS=${pCount} (VPS ahead by ${Math.abs(diff)})`);
      }
    }

    results.push({
      table: table.name,
      supaCount: sCount !== null ? sCount : 'ERR',
      vpsCount: pCount !== null ? pCount : 'ERR',
      diff: diff,
      status,
    });
  }

  console.log('='.repeat(75));
  console.log('SUMMARY OF PARITY CHECK:');
  console.log(`Total Tables Checked : ${TABLES_TO_CHECK.length}`);
  console.log(`Tables in Sync (100%): ${matchCount}`);
  console.log(`Tables with Diffs    : ${diffCount}`);
  console.log(`Tables with Errors   : ${errorCount}`);
  console.log(`Total Rows Supabase  : ${totalSupabaseRows}`);
  console.log(`Total Rows VPS       : ${totalVpsRows}`);
  console.log(`Overall Discrepancy  : ${totalSupabaseRows - totalVpsRows} rows`);
  console.log('='.repeat(75));

  // Write detailed report to JSON file for sync script to consume
  const reportPath = path.resolve(__dirname, 'parity-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    matchCount,
    diffCount,
    errorCount,
    totalSupabaseRows,
    totalVpsRows,
    discrepancy: totalSupabaseRows - totalVpsRows,
    tables: results,
  }, null, 2));

  console.log(`Parity report saved to: ${reportPath}`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
