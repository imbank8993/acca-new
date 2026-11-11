// ⚠️ SERVER-ONLY — Jangan diimport dari 'use client' component.
// Gunakan API route (fetch) untuk mengakses data dari client component.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

export const prisma = rawPrisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
