// ⚠️ SERVER-ONLY — Jangan diimport dari 'use client' component.
// Gunakan API route (fetch) untuk mengakses data dari client component.

import { PrismaClient } from '@prisma/client';
import { withAuditContext } from '@acca/shared';
import { headers } from 'next/headers';
import { extractRequestToken, verifyAppToken } from './app-jwt';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

export const prisma = withAuditContext(rawPrisma, async () => {
  try {
    const requestHeaders = await headers();
    const token = extractRequestToken({ headers: requestHeaders });
    const user = token ? await verifyAppToken(token, true) : null;
    let page = '';
    try { page = new URL(requestHeaders.get('referer') || '').pathname; } catch { /* Non-browser operation. */ }
    return {
      user_id: user?.authId || user?.sub || null, user_nip: user?.username || null,
      user_name: user?.username || null, user_role: user?.role || null,
      page: page.slice(0, 300), source: 'acca-web',
      ip_address: (requestHeaders.get('x-forwarded-for') || '').split(',')[0].slice(0, 64),
      user_agent: (requestHeaders.get('user-agent') || '').slice(0, 500),
    };
  } catch { return undefined; }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
