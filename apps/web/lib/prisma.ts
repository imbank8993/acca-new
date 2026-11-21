// ⚠️ SERVER-ONLY — Jangan diimport dari 'use client' component.
// Gunakan API route (fetch) untuk mengakses data dari client component.

import { PrismaClient } from '@prisma/client';
import { withPoolDefaults } from './database-url';

/** Bawaan pool acca-web; ubah lewat WEB_DB_CONNECTION_LIMIT (lihat database-url.ts). */
const DEFAULT_WEB_DB_CONNECTION_LIMIT = 10;
const datasourceUrl = withPoolDefaults(process.env.DATABASE_URL, {
  limitEnv: 'WEB_DB_CONNECTION_LIMIT',
  defaultLimit: DEFAULT_WEB_DB_CONNECTION_LIMIT,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

export const prisma = rawPrisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
