const { PrismaClient } = require('@prisma/client');

const REQUIRED_TABLES = [
  'ptsp_buku_tamu', 'ptsp_izin_magang', 'ptsp_izin_penelitian', 'ptsp_izin_siswa',
  'ptsp_legalisir', 'ptsp_master_tracking', 'ptsp_mutasi_siswa',
  'ptsp_peminjaman_sarana', 'ptsp_pengaduan', 'ptsp_pengganti_ijazah',
  'ptsp_sosialisasi', 'ptsp_wa_log', 'site_settings',
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const missing = [];
    for (const table of REQUIRED_TABLES) {
      // Return a boolean instead of regclass, which Prisma cannot deserialize.
      const rows = await prisma.$queryRawUnsafe(
        'SELECT to_regclass($1) IS NOT NULL AS exists',
        `public.${table}`,
      );
      if (!rows[0]?.exists) missing.push(table);
    }
    if (missing.length) throw new Error(`Tabel acca_db belum tersedia: ${missing.join(', ')}`);
    if (process.argv.includes('--letters')) await verifyLetterSchema(prisma);
    console.log(`Verified ${REQUIRED_TABLES.length} PTSP tables in acca_db.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyLetterSchema(prisma) {
  const columns = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ptsp_disposisi'",
  );
  const names = new Set(columns.map(row => row.column_name));
  const missing = ['read_at', 'client_request_id'].filter(name => !names.has(name));
  if (missing.length) throw new Error(`Migrasi pemberitahuan PTSP belum lengkap: ${missing.join(', ')}`);
  const indexes = await prisma.$queryRawUnsafe(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ptsp_disposisi' AND indexname = 'idx_ptsp_letter_delivery'",
  );
  if (!indexes.length) throw new Error('Indeks pencegah kiriman ganda PTSP belum tersedia');
}

module.exports = { verifyLetterSchema };
if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
