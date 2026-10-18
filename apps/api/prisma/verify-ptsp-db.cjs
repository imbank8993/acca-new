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
      const rows = await prisma.$queryRawUnsafe('SELECT to_regclass($1) AS table_name', `public.${table}`);
      if (!rows[0]?.table_name) missing.push(table);
    }
    if (missing.length) throw new Error(`Tabel acca_db belum tersedia: ${missing.join(', ')}`);
    console.log(`Verified ${REQUIRED_TABLES.length} PTSP tables in acca_db.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
