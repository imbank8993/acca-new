const { PrismaClient } = require('../dist/generated/ptsp-client');

const REQUIRED_TABLES = [
  'ptsp_buku_tamu',
  'ptsp_izin_magang',
  'ptsp_izin_penelitian',
  'ptsp_izin_siswa',
  'ptsp_legalisir',
  'ptsp_master_tracking',
  'ptsp_mutasi_siswa',
  'ptsp_peminjaman_sarana',
  'ptsp_pengaduan',
  'ptsp_pengganti_ijazah',
  'ptsp_sosialisasi',
  'ptsp_wa_log',
];

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const tables = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ptsp_%'",
    );
    const existing = new Set(tables.map(({ table_name }) => table_name));
    const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));

    if (missing.length) {
      throw new Error(`Tabel PTSP belum ditemukan: ${missing.join(', ')}`);
    }

    console.log(`Koneksi dan ${REQUIRED_TABLES.length} tabel PTSP terverifikasi.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Pemeriksaan database PTSP gagal: ${error.message}`);
  process.exitCode = 1;
});
