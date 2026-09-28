/**
 * sync-auth-passwords-from-csv.js
 * 
 * Mengimpor hash password asli dari Supabase Auth (hasil ekspor SQL Editor)
 * langsung ke tabel auth.users di PostgreSQL VPS (acca_db).
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: 'apps/api/.env', quiet: true });

async function main() {
  const isApply = process.argv.includes('--apply') || process.argv.includes('--execute');

  console.log('='.repeat(80));
  console.log('   SINKRONISASI PASSWORD ASLI SUPABASE AUTH -> POSTGRESQL VPS');
  console.log('='.repeat(80));
  console.log(`Mode Operasi: ${isApply ? '🚀 APPLY (Menulis ke VPS)' : '🔍 DRY-RUN (Hanya Simulasi)'}`);

  const csvPath = path.resolve('docs/Supabase Snippet Untitled query.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`File CSV tidak ditemukan di: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 3) {
      records.push({
        id: parts[0].trim(),
        email: parts[1].trim(),
        encrypted_password: parts[2].trim()
      });
    }
  }

  console.log(`\nTotal kredensial terbaca dari CSV: ${records.length} akun`);

  const pool = new Pool({ connectionString: (process.env.DATABASE_URL || '').replace(/['"]/g, '') });
  const client = await pool.connect();

  try {
    // 1. Ambil daftar user publik di VPS
    const vpsUsersRes = await client.query('SELECT id, auth_id, email, username, nama, role FROM users');
    const authIdToUser = new Map();
    vpsUsersRes.rows.forEach(u => {
      if (u.auth_id) authIdToUser.set(u.auth_id, u);
    });

    console.log(`Total user terdaftar di public.users VPS: ${vpsUsersRes.rows.length} akun`);

    let updatedCount = 0;
    let skippedCount = 0;
    let notInUsersCount = 0;

    for (const rec of records) {
      const vpsUser = authIdToUser.get(rec.id);
      if (!vpsUser) {
        notInUsersCount++;
        continue;
      }

      if (isApply) {
        // Upsert ke auth.users VPS dengan hash Bcrypt asli Supabase
        await client.query(`
          INSERT INTO auth.users (id, email, encrypted_password, aud, role, created_at, updated_at)
          VALUES ($1, $2, $3, 'authenticated', 'authenticated', NOW(), NOW())
          ON CONFLICT (id) DO UPDATE 
          SET encrypted_password = EXCLUDED.encrypted_password,
              updated_at = NOW();
        `, [rec.id, rec.email, rec.encrypted_password]);
      }
      updatedCount++;
    }

    console.log(`\nHasil Pemrosesan:`);
    console.log(`  - Berhasil dicocokkan & disinkronkan : ${updatedCount} akun`);
    console.log(`  - Akun lama Supabase di luar sistem VPS: ${notInUsersCount} akun (tidak terpakai)`);

    if (isApply) {
      console.log('\n✅ Seluruh hash password asli Supabase berhasil dimasukkan ke auth.users VPS!');
    } else {
      console.log('\n⚠️ Ini adalah UJI KERING. Untuk menyimpan ke database:');
      console.log('   node scripts/sync-auth-passwords-from-csv.js --apply');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
