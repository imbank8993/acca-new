/**
 * migrate-active-users.js
 * 
 * Skrip untuk memindahkan pengguna aktif (aktif = true) dari repositori lama (acca-app / Supabase)
 * ke repositori baru (acca-new / PostgreSQL VPS) dengan penanganan konflik email & password.
 * 
 * Fitur:
 * 1. Uji Kering (Dry Run) secara default — tidak menulis ke database tanpa argumen `--apply` / `--execute`.
 * 2. Deteksi Cerdas Konflik:
 *    - Mendeteksi user yang sama (berdasarkan ID, auth_id, atau username).
 *    - Menganalisis perbedaan email (kosong vs terisi, atau berbeda alamat).
 *    - Menganalisis perbedaan password (apakah sama persis atau beda).
 * 3. Opsi Kebijakan Konflik:
 *    - Default (Aman): Data akun existing TIDAK DIUBAH. Hanya user baru yang dimasukkan.
 *    - `--fill-empty-emails` : Melengkapi email di acca-new yang masih NULL menggunakan email dari acca-app.
 *    - `--force-sync-emails` : Memperbarui email di acca-new mengikuti email acca-app (dengan proteksi duplikasi).
 *    - `--force-sync-passwords`: Memperbarui password di acca-new menggunakan password terbaru dari acca-app.
 * 
 * Penggunaan:
 *   node scripts/migrate-active-users.js                                # Analisis & Uji Kering (Default Aman)
 *   node scripts/migrate-active-users.js --apply                        # Terapkan User Baru (Data existing tidak diubah)
 *   node scripts/migrate-active-users.js --apply --fill-empty-emails    # Terapkan User Baru + Lengkapi email kosong
 *   node scripts/migrate-active-users.js --apply --force-sync-passwords # Terapkan User Baru + Sinkronkan password beda
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const SUPABASE_ENV_PATH = path.resolve('C:/Users/imran/.gemini/antigravity/scratch/acca-app/.env.local');
const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'acca123';

function loadSupabaseConfig() {
  if (!fs.existsSync(SUPABASE_ENV_PATH)) {
    throw new Error(`File konfigurasi acca-app tidak ditemukan di: ${SUPABASE_ENV_PATH}`);
  }
  const content = fs.readFileSync(SUPABASE_ENV_PATH, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });

  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase URL atau SERVICE_ROLE_KEY tidak ditemukan di .env.local acca-app.');
  }

  return { url, key };
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply') || args.includes('--execute');
  const fillEmptyEmails = args.includes('--fill-empty-emails');
  const forceSyncEmails = args.includes('--force-sync-emails');
  const forceSyncPasswords = args.includes('--force-sync-passwords');

  console.log('='.repeat(75));
  console.log('  MIGRASI & SINKRONISASI PENGGUNA AKTIF: acca-app -> acca-new');
  console.log('='.repeat(75));
  console.log(`Mode Operasi       : ${isApply ? '🚀 APPLY (Menulis perubahan ke VPS)' : '🔍 DRY-RUN (Hanya Analisis, TIDAK MENULIS APAPUN)'}`);
  console.log(`Isi Email Kosong   : ${fillEmptyEmails || forceSyncEmails ? 'Aktif' : 'Nonaktif (Pertahankan acca-new)'}`);
  console.log(`Timpa Email Beda   : ${forceSyncEmails ? 'Aktif' : 'Nonaktif (Pertahankan acca-new)'}`);
  console.log(`Timpa Password Beda: ${forceSyncPasswords ? 'Aktif (Gunakan password acca-app)' : 'Nonaktif (Pertahankan password acca-new)'}`);
  console.log('-'.repeat(75));

  const { url: supaUrl, key: supaKey } = loadSupabaseConfig();
  const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });
  const prisma = new PrismaClient();

  try {
    // 1. Ambil data dari Supabase
    console.log('\n[1/4] Mengambil data user aktif dari Supabase (acca-app)...');
    const { data: supaUsers, error: supaErr } = await supabase
      .from('users')
      .select('*')
      .eq('aktif', true)
      .order('id', { ascending: true });

    if (supaErr) throw new Error(`Gagal mengambil data dari Supabase: ${supaErr.message}`);
    console.log(`  -> Terbaca ${supaUsers.length} pengguna aktif di acca-app.`);

    // 2. Ambil data dari acca-new (PostgreSQL VPS)
    console.log('\n[2/4] Mengambil data dari database PostgreSQL VPS (acca-new)...');
    const vpsUsers = await prisma.public_users.findMany();
    const vpsAuthUsers = await prisma.auth_users.findMany({
      select: { id: true, email: true, encrypted_password: true }
    });

    console.log(`  -> Terdaftar ${vpsUsers.length} pengguna di public.users.`);
    console.log(`  -> Terdaftar ${vpsAuthUsers.length} kredensial di auth.users.`);

    // Mapping indexing VPS
    const vpsById = new Map();
    const vpsByAuthId = new Map();
    const vpsByUsername = new Map();
    const vpsByEmail = new Map();
    const vpsByNip = new Map();

    vpsUsers.forEach(u => {
      vpsById.set(u.id.toString(), u);
      if (u.auth_id) vpsByAuthId.set(u.auth_id, u);
      if (u.username) vpsByUsername.set(u.username.trim().toLowerCase(), u);
      if (u.email) vpsByEmail.set(u.email.trim().toLowerCase(), u);
      if (u.nip && u.nip.trim()) vpsByNip.set(u.nip.trim(), u);
    });

    const vpsAuthById = new Map();
    vpsAuthUsers.forEach(a => vpsAuthById.set(a.id, a));

    // 3. Analisis Perbandingan, Deteksi Akun Sama, Perbedaan Email & Password
    console.log('\n[3/4] Menganalisis perbedaan akun, email, dan password...');
    const usersToCreate = [];
    const emailEmptyToFill = [];
    const emailConflictDifferent = [];
    const passwordMismatches = [];
    const authToCreate = [];

    for (const su of supaUsers) {
      const suIdStr = String(su.id);
      const suAuthId = su.auth_id;
      const suUsername = (su.username || '').trim().toLowerCase();
      const suEmail = (su.email || '').trim().toLowerCase();

      // Cari apakah sudah ada akun yang sama di VPS
      let matched = vpsById.get(suIdStr);
      if (!matched && suAuthId) matched = vpsByAuthId.get(suAuthId);
      if (!matched && suUsername) matched = vpsByUsername.get(suUsername);
      if (!matched && suEmail) matched = vpsByEmail.get(suEmail);
      if (!matched && su.nip && su.nip.trim()) matched = vpsByNip.get(su.nip.trim());

      if (!matched) {
        // User baru murni
        usersToCreate.push(su);
        continue;
      }

      // User ditemukan sama! Periksa status auth & kredensial
      const targetAuthId = matched.auth_id || suAuthId;
      const authRecord = targetAuthId ? vpsAuthById.get(targetAuthId) : null;

      // A. Periksa Password
      if (!authRecord || !authRecord.encrypted_password) {
        authToCreate.push({ user: matched, supaUser: su, targetAuthId });
      } else if (su.password_hash) {
        let isPassMatch = false;
        if (su.password_hash.startsWith('$2')) {
          isPassMatch = su.password_hash === authRecord.encrypted_password;
        } else {
          try {
            isPassMatch = bcrypt.compareSync(su.password_hash, authRecord.encrypted_password);
          } catch {
            isPassMatch = false;
          }
        }

        if (!isPassMatch) {
          passwordMismatches.push({
            user: matched,
            supaUser: su,
            vpsAuthId: authRecord.id,
            supaPlain: su.password_hash.startsWith('$2') ? '[Hash Bcrypt]' : su.password_hash
          });
        }
      }

      // B. Periksa Email
      const vpsEmail = (matched.email || '').trim().toLowerCase();
      if (!vpsEmail && suEmail) {
        // Email di VPS kosong, tapi di acca-app ada
        const emailAlreadyUsed = vpsByEmail.has(suEmail) && vpsByEmail.get(suEmail).id !== matched.id;
        emailEmptyToFill.push({
          user: matched,
          newEmail: su.email.trim(),
          blockedByConflict: emailAlreadyUsed
        });
      } else if (vpsEmail && suEmail && vpsEmail !== suEmail) {
        // Email berbeda di kedua sisi
        const emailAlreadyUsed = vpsByEmail.has(suEmail) && vpsByEmail.get(suEmail).id !== matched.id;
        emailConflictDifferent.push({
          user: matched,
          vpsEmail: matched.email,
          supaEmail: su.email,
          blockedByConflict: emailAlreadyUsed
        });
      }
    }

    // Tampilkan Ringkasan Analisis
    console.log(`  -> User BARU yang belum ada di acca-new           : ${usersToCreate.length}`);
    console.log(`  -> User sama dengan Email KOSONG di acca-new      : ${emailEmptyToFill.length}`);
    console.log(`  -> User sama dengan Email BERBEDA di acca-new     : ${emailConflictDifferent.length}`);
    console.log(`  -> User sama dengan Password BERBEDA              : ${passwordMismatches.length}`);
    console.log(`  -> User sama yang belum memiliki kredensial auth  : ${authToCreate.length}`);

    if (usersToCreate.length > 0) {
      console.log('\n  [Daftar Akun Baru yang Akan Dibuat]:');
      usersToCreate.forEach((u, i) => {
        console.log(`    ${i + 1}. [ID: ${u.id}] ${u.nama || '-'} | Username: ${u.username} | Role: ${u.role} | Email: ${u.email || '-'}`);
      });
    }

    if (passwordMismatches.length > 0) {
      console.log(`\n  [Sampel User dengan Password Berbeda (Total ${passwordMismatches.length})]:`);
      passwordMismatches.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. [ID: ${p.user.id}] ${p.user.nama} (${p.user.username}) | Password di acca-app: "${p.supaPlain}"`);
      });
      if (passwordMismatches.length > 5) {
        console.log(`    ... dan ${passwordMismatches.length - 5} pengguna lainnya.`);
      }
      console.log(`    Status: ${forceSyncPasswords ? 'Akan DIPERBARUI ke password acca-app (--force-sync-passwords aktif)' : 'DIPERTAHANKAN password acca-new (Aman)'}`);
    }

    if (emailEmptyToFill.length > 0) {
      console.log(`\n  [User dengan Email Kosong di acca-new (Total ${emailEmptyToFill.length})]:`);
      emailEmptyToFill.slice(0, 5).forEach((e, i) => {
        console.log(`    ${i + 1}. [ID: ${e.user.id}] ${e.user.nama} -> Email di acca-app: ${e.newEmail} ${e.blockedByConflict ? '(KONFLIK: Dipakai user lain)' : ''}`);
      });
      console.log(`    Status: ${fillEmptyEmails || forceSyncEmails ? 'Akan DILENGKAPI (--fill-empty-emails aktif)' : 'DIPERTAHANKAN kosong (Aman)'}`);
    }

    if (emailConflictDifferent.length > 0) {
      console.log(`\n  [User dengan Email Berbeda (Total ${emailConflictDifferent.length})]:`);
      emailConflictDifferent.slice(0, 5).forEach((e, i) => {
        console.log(`    ${i + 1}. [ID: ${e.user.id}] ${e.user.nama} | VPS: ${e.vpsEmail} vs Supa: ${e.supaEmail}`);
      });
      console.log(`    Status: ${forceSyncEmails ? 'Akan DITIMPA ke email acca-app (--force-sync-emails aktif)' : 'DIPERTAHANKAN email acca-new (Aman)'}`);
    }

    // 4. Eksekusi Perubahan
    if (!isApply) {
      console.log('\n' + '='.repeat(75));
      console.log('  UJI KERING SELESAI — BASIS DATA TIDAK MENGALAMI PERUBAHAN APAPUN');
      console.log('  Pilihan Perintah Eksekusi:');
      console.log('  1. Masukkan User Baru Saja (Paling Aman):');
      console.log('     node scripts/migrate-active-users.js --apply');
      console.log('  2. Masukkan User Baru + Lengkapi Email yang Kosong:');
      console.log('     node scripts/migrate-active-users.js --apply --fill-empty-emails');
      console.log('  3. Masukkan User Baru + Sinkronkan Password Beda (Jika ingin password acca-app berlaku):');
      console.log('     node scripts/migrate-active-users.js --apply --force-sync-passwords');
      console.log('='.repeat(75));
      return;
    }

    console.log('\n[4/4] 🚀 Menerapkan perubahan ke database PostgreSQL VPS...');
    let createdCount = 0;
    let authCreatedCount = 0;
    let passwordUpdatedCount = 0;
    let emailUpdatedCount = 0;

    // A. Buat User Baru
    for (const su of usersToCreate) {
      let authId = su.auth_id || crypto.randomUUID();

      let hash = null;
      if (su.password_hash) {
        hash = su.password_hash.startsWith('$2') ? su.password_hash : await bcrypt.hash(su.password_hash, BCRYPT_ROUNDS);
      } else {
        hash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
      }

      const email = su.email || `${su.username || su.id}@icgowa.sch.id`;

      await prisma.auth_users.upsert({
        where: { id: authId },
        update: { email, encrypted_password: hash, updated_at: new Date() },
        create: {
          id: authId,
          email,
          encrypted_password: hash,
          aud: 'authenticated',
          role: 'authenticated',
          created_at: su.created_at ? new Date(su.created_at) : new Date(),
          updated_at: new Date()
        }
      });
      authCreatedCount++;

      await prisma.public_users.create({
        data: {
          id: BigInt(su.id),
          auth_id: authId,
          nip: su.nip || null,
          username: su.username || null,
          nama: su.nama || null,
          role: su.role || null,
          divisi: su.divisi || null,
          aktif: true,
          created_at: su.created_at ? new Date(su.created_at) : new Date(),
          foto_profil: su.foto_profil || null,
          last_seen: su.last_seen ? new Date(su.last_seen) : null,
          last_location: su.last_location || null,
          profil_sekolah_id: su.profil_sekolah_id || null,
          email: su.email || null,
          cbt_auth_id: su.cbt_auth_id || null,
          page_overrides: su.page_overrides || {},
          pinned_pages: su.pinned_pages || [],
          nama_lengkap: su.nama_lengkap || null
        }
      });
      createdCount++;
    }

    // B. Isi Email Kosong (jika diminta)
    if (fillEmptyEmails || forceSyncEmails) {
      for (const item of emailEmptyToFill) {
        if (!item.blockedByConflict) {
          await prisma.public_users.update({
            where: { id: item.user.id },
            data: { email: item.newEmail }
          });
          emailUpdatedCount++;
        }
      }
    }

    // C. Timpa Email Berbeda (jika diminta)
    if (forceSyncEmails) {
      for (const item of emailConflictDifferent) {
        if (!item.blockedByConflict) {
          await prisma.public_users.update({
            where: { id: item.user.id },
            data: { email: item.supaEmail }
          });
          emailUpdatedCount++;
        }
      }
    }

    // D. Sinkronkan Password Berbeda (jika diminta)
    if (forceSyncPasswords) {
      for (const item of passwordMismatches) {
        const hash = item.supaUser.password_hash.startsWith('$2')
          ? item.supaUser.password_hash
          : await bcrypt.hash(item.supaUser.password_hash, BCRYPT_ROUNDS);

        await prisma.auth_users.update({
          where: { id: item.vpsAuthId },
          data: {
            encrypted_password: hash,
            updated_at: new Date()
          }
        });
        passwordUpdatedCount++;
      }
    }

    console.log('\n' + '='.repeat(75));
    console.log('  🎉 PROSES EKSEKUSI SELESAI DENGAN SUKSES');
    console.log('='.repeat(75));
    console.log(`  User baru ditambahkan ke public.users  : ${createdCount}`);
    console.log(`  Kredensial auth.users baru dibuat      : ${authCreatedCount}`);
    console.log(`  Email diperbarui / dilengkapi          : ${emailUpdatedCount}`);
    console.log(`  Password disinkronkan ke versi terbaru : ${passwordUpdatedCount}`);
    console.log('='.repeat(75));

  } catch (err) {
    console.error('\n❌ Terjadi kesalahan saat migrasi:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
