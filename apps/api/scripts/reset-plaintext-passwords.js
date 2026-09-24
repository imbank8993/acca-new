/**
 * Reset password akun yang kredensialnya TIDAK TERCATAT di tempat yang benar.
 *
 * Kredensial yang sah hanya satu: `auth_users.encrypted_password` (bcrypt) —
 * itulah yang diperiksa AuthService saat login. Sebagian akun lama tidak punya
 * entri di sana; satu-satunya yang membuat mereka bisa login adalah kolom
 * warisan `public.users.password_hash`, yang isinya teks polos dan sedang
 * dihapus. Tanpa reset, akun-akun itu terkunci begitu kolomnya hilang.
 *
 * Yang TIDAK disentuh: akun yang sudah punya bcrypt di `auth_users`. Password
 * lamanya tetap berlaku apa adanya — itu keputusan yang diambil sadar, dengan
 * catatan bahwa nilai teks polos di kolom lama sudah pernah terbaca dan
 * kolomnya karena itu dihapus.
 *
 * Bawaannya UJI KERING: tanpa `--apply` tidak ada satu baris pun yang ditulis.
 *
 *   node scripts/reset-plaintext-passwords.js            # lihat dampaknya
 *   node scripts/reset-plaintext-passwords.js --apply    # jalankan
 */
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const PASSWORD_BARU = 'acca123';
const BCRYPT_ROUNDS = 10; // samakan dengan AuthService
const APPLY = process.argv.includes('--apply');

async function main() {
  const prisma = new PrismaClient();

  /**
   * Sasarannya: akun yang TIDAK punya bcrypt yang sah di `auth_users`.
   *
   * Termasuk tiga keadaan — `auth_id` kosong, baris `auth_users` tidak ada,
   * atau `encrypted_password` kosong/bukan bcrypt. Semuanya berarti hal yang
   * sama: begitu kolom warisan dihapus, akun itu tidak punya jalan masuk.
   *
   * Tidak menyentuh `password_hash` sama sekali, jadi skrip ini tetap benar
   * baik sebelum maupun sesudah kolomnya dibuang.
   */
  const target = await prisma.$queryRawUnsafe(`
    SELECT u.id, u.username, u.email, u.auth_id, u.aktif, u.role
    FROM public.users u
    LEFT JOIN auth.users a ON a.id = u.auth_id
    WHERE u.auth_id IS NULL
       OR a.id IS NULL
       OR a.encrypted_password IS NULL
       OR a.encrypted_password NOT LIKE '$2%'
  `);

  console.log(`Mode         : ${APPLY ? 'APPLY (menulis ke basis data)' : 'UJI KERING (tidak menulis apa pun)'}`);
  console.log(`Kandidat     : ${target.length} akun tanpa kredensial tercatat di auth_users`);
  console.log(`Password baru: ${PASSWORD_BARU}\n`);
  target.forEach((u) => {
    console.log(`  id=${u.id}  username=${u.username}  peran=${u.role || '-'}  aktif=${u.aktif}`);
  });
  if (target.length) console.log('');

  let perluBuatAuthRow = 0;
  let diperbarui = 0;
  let dibuat = 0;
  const gagal = [];

  for (const u of target) {
    const adaAuthRow = u.auth_id
      ? await prisma.auth_users.findUnique({ where: { id: u.auth_id }, select: { id: true } })
      : null;
    if (!adaAuthRow) perluBuatAuthRow++;

    if (!APPLY) continue;

    try {
      const hash = await bcrypt.hash(PASSWORD_BARU, BCRYPT_ROUNDS);
      let authId = u.auth_id;

      if (!authId) {
        authId = crypto.randomUUID();
        await prisma.public_users.update({ where: { id: u.id }, data: { auth_id: authId } });
      }

      if (adaAuthRow) {
        await prisma.auth_users.update({
          where: { id: authId },
          data: { encrypted_password: hash, updated_at: new Date() },
        });
        diperbarui++;
      } else {
        await prisma.auth_users.create({
          data: {
            id: authId,
            email: u.email || `${u.username}@icgowa.sch.id`,
            encrypted_password: hash,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        dibuat++;
      }
    } catch (e) {
      gagal.push({ id: u.id.toString(), username: u.username, error: e.message });
    }
  }

  if (!APPLY) {
    console.log(`Akan diperbarui di auth_users : ${target.length - perluBuatAuthRow}`);
    console.log(`Akan DIBUATKAN baris auth_users: ${perluBuatAuthRow}`);
    console.log('\nTidak ada yang ditulis. Tambahkan --apply untuk menjalankan.');
  } else {
    console.log(`Diperbarui : ${diperbarui}`);
    console.log(`Dibuat     : ${dibuat}`);
    console.log(`Gagal      : ${gagal.length}`);
    if (gagal.length) console.log(JSON.stringify(gagal, null, 2));
    console.log('\nSetelah ini, jalankan migrasi drop kolom:');
    console.log('  prisma/sql/20260917_drop_users_password_hash.sql');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
