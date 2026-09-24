/**
 * Migrasi berkas Supabase Storage → Cloudflare R2.
 *
 * Latar: sejak STORAGE_DRIVER=cloudflare, unggahan BARU sudah masuk R2, tapi
 * berkas lama masih menyimpan URL Supabase di beberapa kolom. Skrip ini
 * memindahkan berkasnya lalu menulis ulang URL-nya supaya Cloudflare benar-benar
 * jadi satu-satunya penyimpanan.
 *
 * Perilaku yang disengaja:
 *
 * 1. TIDAK menghapus apa pun dari Supabase. Berkas aslinya ditinggal sebagai
 *    cadangan; menghapusnya keputusan terpisah setelah hasil migrasi diperiksa.
 * 2. Idempoten & bisa diulang. Objek yang sudah ada di R2 dilewati, dan kolom
 *    yang URL-nya sudah ditulis ulang tidak akan cocok lagi dengan pola
 *    pencarian — jadi menjalankan dua kali aman.
 * 3. Key di R2 = `<bucket supabase>/<path asli>`. Prefix bucket dipertahankan
 *    agar cocok dengan konvensi `StorageService.r2Key()`, sehingga penghapusan
 *    lewat `removeByUrl` tetap menemukan objeknya.
 * 4. Kolom JSON (`agenda_akademik.foto`) ditulis ulang sebagai teks lalu
 *    di-cast kembali, supaya struktur array + caption + tanggal tidak berubah.
 *
 * Pakai:
 *   node scripts/migrasi-storage-supabase-ke-r2.js --dry-run
 *   node scripts/migrasi-storage-supabase-ke-r2.js --apply
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { createHash, createHmac } = require('node:crypto');

const DRY = !process.argv.includes('--apply');

const R2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
};
const BASE = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

/** Kolom yang diketahui memuat URL berkas. Hasil pemindaian seluruh skema. */
const KOLOM = [
  ['agenda_akademik', 'foto', 'jsonb'],
  ['laporan_piket_detail', 'dokumentasi_url', 'text'],
  ['lckh_submissions', 'lampiran_tugas', 'text'],
  ['registrasi_sanggar', 'pas_foto', 'text'],
  ['sv_unggahan_guru', 'file_url', 'text'],
  ['file_uploads', 'file_url', 'text'],
];

const POLA = /https?:\/\/[^"'\s,}\]]+\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/([^"'\s,}\]]+)/g;

// ─── SigV4 (sama dengan src/common/r2.client.ts) ─────────────────────────────

const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

function uriEncode(input, encodeSlash) {
  let out = '';
  for (const ch of input) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
    else if (ch === '/') out += encodeSlash ? '%2F' : '/';
    else for (const b of Buffer.from(ch, 'utf8')) out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

async function r2Put(key, body, contentType) {
  const host = `${R2.accountId}.r2.cloudflarestorage.com`;
  const uri = `/${uriEncode(R2.bucket, false)}/${uriEncode(key, false)}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);

  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['content-type'] = contentType;

  const names = Object.keys(headers).sort();
  const canonical = [
    'PUT', uri, '',
    names.map((h) => `${h}:${headers[h].trim()}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const kDate = hmac(`AWS4${R2.secretAccessKey}`, dateStamp);
  const signature = hmac(hmac(hmac(hmac(kDate, 'auto'), 's3'), 'aws4_request'), toSign).toString('hex');

  const res = await fetch(`https://${host}${uri}`, {
    method: 'PUT',
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${R2.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`PUT ${key} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

const urlPublikR2 = (key) => `${BASE}/${key.split('/').map(encodeURIComponent).join('/')}`;

// ─── Migrasi ─────────────────────────────────────────────────────────────────

async function main() {
  for (const [k, v] of Object.entries({ ...R2, R2_PUBLIC_BASE_URL: BASE })) {
    if (!v) throw new Error(`Env ${k} belum diset`);
  }

  const prisma = new PrismaClient();
  console.log(DRY ? '=== DRY RUN (tidak ada yang diubah) ===\n' : '=== APPLY ===\n');

  // 1. Kumpulkan URL unik dari semua kolom.
  const urls = new Map();
  for (const [tabel, kolom] of KOLOM) {
    const rows = await prisma.$queryRawUnsafe(
      `select "${kolom}"::text v from public."${tabel}" where "${kolom}"::text like '%/storage/v1/object/%'`,
    );
    for (const r of rows) {
      let m;
      POLA.lastIndex = 0;
      while ((m = POLA.exec(r.v)) !== null) {
        const u = m[0].replace(/[\\"]+$/, '');
        if (!urls.has(u)) urls.set(u, { bucket: m[1], path: decodeURIComponent(m[2]) });
      }
    }
  }
  console.log(`URL Supabase unik ditemukan: ${urls.size}`);

  // 2. Pindahkan berkasnya.
  const peta = new Map(); // url lama → url baru
  let dipindah = 0, dilewati = 0;
  const gagal = [];

  for (const [lama, info] of urls) {
    const key = `${info.bucket}/${info.path}`;
    const baru = urlPublikR2(key);
    try {
      const sudah = await fetch(baru, { method: 'HEAD' });
      if (sudah.ok) {
        peta.set(lama, baru);
        dilewati++;
        continue;
      }

      const unduh = await fetch(lama);
      if (!unduh.ok) throw new Error(`unduh gagal HTTP ${unduh.status}`);
      const buf = Buffer.from(await unduh.arrayBuffer());
      const tipe = unduh.headers.get('content-type') || 'application/octet-stream';

      if (!DRY) await r2Put(key, buf, tipe);
      peta.set(lama, baru);
      dipindah++;
      if (dipindah % 20 === 0) console.log(`  … ${dipindah} berkas dipindah`);
    } catch (e) {
      gagal.push({ url: lama, key, sebab: e.message });
    }
  }

  console.log(`\nberkas dipindah : ${dipindah}${DRY ? ' (simulasi)' : ''}`);
  console.log(`sudah ada di R2 : ${dilewati}`);
  console.log(`gagal           : ${gagal.length}`);
  for (const g of gagal) console.log(`  ✗ ${g.key} — ${g.sebab}`);

  // 3. Tulis ulang URL di DB. Hanya URL yang berkasnya SUDAH aman di R2 yang
  //    ditulis ulang — kalau tidak, baris yang gagal dipindah akan menunjuk ke
  //    objek yang tidak ada dan berkasnya jadi tak terjangkau sama sekali.
  let barisDiubah = 0;
  for (const [tabel, kolom] of KOLOM) {
    const rows = await prisma.$queryRawUnsafe(
      `select id, "${kolom}"::text v from public."${tabel}" where "${kolom}"::text like '%/storage/v1/object/%'`,
    );
    for (const r of rows) {
      let baru = r.v;
      for (const [lamaUrl, baruUrl] of peta) {
        if (baru.includes(lamaUrl)) baru = baru.split(lamaUrl).join(baruUrl);
      }
      if (baru === r.v) continue;

      if (!DRY) {
        await prisma.$executeRawUnsafe(
          `update public."${tabel}" set "${kolom}" = $1::${tabel === 'agenda_akademik' ? 'jsonb' : 'text'} where id = $2`,
          baru,
          r.id,
        );
      }
      barisDiubah++;
    }
  }
  console.log(`\nbaris DB ditulis ulang: ${barisDiubah}${DRY ? ' (simulasi)' : ''}`);

  // 4. Selaraskan registry kapasitas.
  if (!DRY) {
    const n = await prisma.$executeRawUnsafe(
      `update public.file_uploads set storage_type = 'cloudflare'
       where storage_type = 'supabase' and file_url like $1 || '%'`,
      BASE,
    );
    console.log(`registry file_uploads diselaraskan: ${n} baris`);
  }

  await prisma.$disconnect();
  console.log(DRY ? '\nJalankan ulang dengan --apply untuk menerapkan.' : '\nSelesai.');
}

main().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
