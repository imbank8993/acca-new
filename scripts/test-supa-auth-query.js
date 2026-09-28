const { createClient } = require('@supabase/supabase-js');
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

async function testAuthSchema() {
  const supabase = createClient(supaUrl, supaKey, {
    auth: { persistSession: false },
    db: { schema: 'auth' }
  });

  const { data, error } = await supabase.from('users').select('id, email, encrypted_password').limit(5);
  console.log('Result querying auth.users with service_role:');
  console.log('Error:', error);
  console.log('Data:', data);
}

testAuthSchema().catch(console.error);
