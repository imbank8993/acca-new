const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_ENV_PATH = path.resolve('C:/Users/imran/.gemini/antigravity/scratch/acca-app/.env.local');
const content = fs.readFileSync(SUPABASE_ENV_PATH, 'utf8');
const env = {};
content.split('\n').forEach(line => {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const idx = t.indexOf('=');
    let val = t.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[t.substring(0, idx).trim()] = val;
  }
});
const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supaKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

require('dotenv').config({ path: 'apps/api/.env', quiet: true });
const pool = new Pool({ connectionString: (process.env.DATABASE_URL || '').replace(/['"]/g, '') });

async function check() {
  console.log('--- ANALISIS PASSWORD SUPABASE VS VPS ---');

  // 1. Cek public.users di Supabase
  const { data: supaUsers } = await supabase.from('users').select('id, username, email, password_hash, auth_id').limit(20);
  console.log('\nSampel data users di Supabase:');
  const hasPasswordHash = supaUsers.filter(u => !!u.password_hash);
  console.log(`Dari sampel ${supaUsers.length} user, yang memiliki password_hash: ${hasPasswordHash.length}`);
  if (hasPasswordHash.length > 0) {
    console.log('Contoh password_hash di Supabase public.users:', {
      username: hasPasswordHash[0].username,
      password_hash_sample: hasPasswordHash[0].password_hash.substring(0, 15) + '...',
      isBcrypt: hasPasswordHash[0].password_hash.startsWith('$2')
    });
  }

  // 2. Cek total user di public.users Supabase dan berapa yang punya password_hash
  const { count: totalSupaUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: totalWithHash } = await supabase.from('users').select('*', { count: 'exact', head: true }).not('password_hash', 'is', null);
  console.log(`\nTotal public.users di Supabase : ${totalSupaUsers}`);
  console.log(`Total user dengan password_hash: ${totalWithHash}`);

  // 3. Cek auth.users di VPS
  const authVpsCount = await pool.query('SELECT count(*) FROM auth.users');
  console.log(`\nTotal user di auth.users VPS   : ${authVpsCount.rows[0].count}`);

  const vpsAuthSample = await pool.query('SELECT id, email, encrypted_password FROM auth.users LIMIT 5');
  console.log('\nContoh akun di auth.users VPS:');
  for (const r of vpsAuthSample.rows) {
    console.log(`- Email: ${r.email.padEnd(35)} | Hash: ${r.encrypted_password ? r.encrypted_password.substring(0, 20) + '...' : 'NULL'}`);
  }

  // 4. Periksa apakah Supabase menyediakan direct db connection untuk auth.users
  console.log('\nKonfigurasi Supabase URL:', supaUrl);

  await pool.end();
}

check().catch(console.error);
