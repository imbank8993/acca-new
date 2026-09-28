const { Pool } = require('pg');
require('dotenv').config({ path: 'apps/api/.env', quiet: true });
const pool = new Pool({ connectionString: (process.env.DATABASE_URL || '').replace(/['"]/g, '') });

async function check() {
  const roleRes = await pool.query(`
    SELECT coalesce(role, 'TANPA ROLE') as role, count(*) as count
    FROM users
    GROUP BY role
    ORDER BY count DESC
  `);
  console.log('Distribusi Pengguna di VPS:');
  console.table(roleRes.rows);

  const authStats = await pool.query(`
    SELECT count(*) as total_auth,
           count(CASE WHEN encrypted_password LIKE '$2%' THEN 1 END) as valid_bcrypt
    FROM auth.users
  `);
  console.log('\nStatistik auth.users di VPS:');
  console.table(authStats.rows);

  await pool.end();
}

check().catch(console.error);
