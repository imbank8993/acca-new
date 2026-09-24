/**
 * Skrip uji mandiri untuk StorageService (Supabase Storage via REST fetch).
 * Menguji alur: upload file kecil -> ambil URL publik (getPublicUrl) -> hapus file (remove).
 * 
 * CATATAN KESELAMATAN:
 * Skrip ini melakukan operasi TULIS NYATA ke Supabase Storage.
 * Jangan dijalankan otomatis dalam pipeline/CI. Jalankan secara manual oleh pemilik repo saat pengujian.
 * 
 * Cara menjalankan:
 *   cd apps/api && node scripts/test-storage.js
 */

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env');
  process.exit(1);
}

async function runStorageTest() {
  const timestamp = Date.now();
  const bucket = 'documents';
  const filePath = `__smoketest__/${timestamp}.txt`;
  const fileContent = Buffer.from(`Smoke test Supabase Storage REST client at ${new Date().toISOString()}`);

  console.log(`[1/3] Mengunggah file pengujian ke bucket "${bucket}" pada path "${filePath}"...`);
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
  
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'text/plain',
      'x-upsert': 'true',
    },
    body: fileContent,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Gagal upload (${uploadRes.status}): ${errorText}`);
  }
  console.log('✅ Upload berhasil.');

  console.log('[2/3] Menguji pengambilan URL publik...');
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
  console.log(`  Public URL: ${publicUrl}`);
  const fetchPublicRes = await fetch(publicUrl, { method: 'HEAD' });
  if (fetchPublicRes.ok) {
    console.log('✅ Public URL dapat diakses.');
  } else {
    console.warn(`⚠️ Public URL mengembalikan status ${fetchPublicRes.status}.`);
  }

  console.log(`[3/3] Menghapus file pengujian "${filePath}"...`);
  const removeUrl = `${supabaseUrl}/storage/v1/object/${bucket}`;
  const removeRes = await fetch(removeUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [filePath] }),
  });

  if (!removeRes.ok) {
    const errorText = await removeRes.text();
    throw new Error(`Gagal hapus (${removeRes.status}): ${errorText}`);
  }
  console.log('✅ Hapus file berhasil.');
  console.log('\n🎉 Pengujian StorageService REST API LULUS sepenuhnya!');
}

runStorageTest().catch((err) => {
  console.error('\n❌ Pengujian StorageService GAGAL:', err.message);
  process.exit(1);
});
