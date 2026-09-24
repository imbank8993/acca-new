import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env manually if process.env.DATABASE_URL is missing
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding site_settings for P0.1 & P0.2...');

  // P0.1 — Daftarkan OP_AGENDA sebagai pengelola agenda
  const agendaConfig = JSON.stringify({
    allowedRoles: ['ADMIN', 'ADMINISTRATOR', 'OP_AGENDA'],
    allowedUsers: [],
  });

  await prisma.site_settings.upsert({
    where: { key: 'agenda_access_config' },
    update: {
      value: agendaConfig,
      label: 'Hak Akses Kelola Agenda Madrasah',
      description: 'Daftar role dan user yang diizinkan mengelola Agenda Madrasah.',
    },
    create: {
      key: 'agenda_access_config',
      value: agendaConfig,
      label: 'Hak Akses Kelola Agenda Madrasah',
      description: 'Daftar role dan user yang diizinkan mengelola Agenda Madrasah.',
      is_active: true,
    },
  });
  console.log('✓ agenda_access_config updated');

  // P0.1b — Daftarkan OP_JURNAL sebagai pengelola data libur
  const liburConfig = JSON.stringify({
    allowedRoles: ['ADMIN', 'ADMINISTRATOR', 'OP_JURNAL'],
    allowedUsers: [],
  });

  await prisma.site_settings.upsert({
    where: { key: 'libur_access_config' },
    update: {
      value: liburConfig,
      label: 'Hak Akses Kelola Data Libur Madrasah',
      description: 'Daftar role dan user yang diizinkan mengelola Data Hari Libur Madrasah.',
    },
    create: {
      key: 'libur_access_config',
      value: liburConfig,
      label: 'Hak Akses Kelola Data Libur Madrasah',
      description: 'Daftar role dan user yang diizinkan mengelola Data Hari Libur Madrasah.',
      is_active: true,
    },
  });
  console.log('✓ libur_access_config updated');

  // P0.2 — Aktifkan notifikasi WhatsApp tukar jadwal
  await prisma.site_settings.upsert({
    where: { key: 'notif_wa_jadwal' },
    update: {
      value: 'true',
      label: 'Notifikasi WA Tukar Jadwal',
      description: 'Aktifkan pengiriman notifikasi WhatsApp saat ada tukar jadwal.',
    },
    create: {
      key: 'notif_wa_jadwal',
      value: 'true',
      label: 'Notifikasi WA Tukar Jadwal',
      description: 'Aktifkan pengiriman notifikasi WhatsApp saat ada tukar jadwal.',
      is_active: true,
    },
  });
  console.log('✓ notif_wa_jadwal set to true');

  await prisma.site_settings.upsert({
    where: { key: 'wa_provider_jadwal' },
    update: {
      value: 'baileys',
      label: 'Provider WA Tukar Jadwal',
      description: 'Provider WA yang digunakan untuk tukar jadwal.',
    },
    create: {
      key: 'wa_provider_jadwal',
      value: 'baileys',
      label: 'Provider WA Tukar Jadwal',
      description: 'Provider WA yang digunakan untuk tukar jadwal.',
      is_active: true,
    },
  });
  console.log('✓ wa_provider_jadwal set to baileys');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding site_settings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
