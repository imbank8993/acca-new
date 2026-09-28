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
const supaKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

require('dotenv').config({ path: 'apps/api/.env', quiet: true });
const pool = new Pool({ connectionString: (process.env.DATABASE_URL || '').replace(/['"]/g, '') });

async function analyze() {
  console.log('='.repeat(75));
  console.log('         ANALISIS DATA AUTH CSV DARI SUPABASE');
  console.log('='.repeat(75));

  // 1. Hitung total akun di Supabase Auth lewat API
  let page = 1;
  let totalAuthUsers = 0;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data || !data.users || data.users.length === 0) break;
    totalAuthUsers += data.users.length;
    if (data.users.length < 1000) break;
    page++;
  }
  console.log(`\n1. Total akun di Supabase Auth (seluruh sistem): ${totalAuthUsers} akun`);

  // 2. Baca CSV docs
  const csvPath = path.resolve('docs/Supabase Snippet Untitled query.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 3) {
      rows.push({
        id: parts[0].trim(),
        email: parts[1].trim(),
        encrypted_password: parts[2].trim()
      });
    }
  }
  console.log(`2. Baris yang berhasil diekspor di CSV       : ${rows.length} akun`);

  // Periksa email di CSV: apakah semua punya email?
  const localEmails = rows.filter(r => r.email.endsWith('@acca.local'));
  const realEmails = rows.filter(r => !r.email.endsWith('@acca.local'));
  console.log(`   - Email Asli (Gmail dsb) : ${realEmails.length}`);
  console.log(`   - Email Sistem (@acca.local): ${localEmails.length}`);

  // 3. Cek berapa banyak yang ada di tabel users VPS
  const vpsUsers = await pool.query('SELECT id, auth_id, email, username FROM users');
  const vpsAuthMap = new Map();
  vpsUsers.rows.forEach(u => {
    if (u.auth_id) vpsAuthMap.set(u.auth_id, u);
  });

  let matchedInVps = 0;
  for (const r of rows) {
    if (vpsAuthMap.has(r.id)) matchedInVps++;
  }
  console.log(`3. Cocok dengan tabel users VPS             : ${matchedInVps} akun`);

  await pool.end();
}

analyze().catch(console.error);
