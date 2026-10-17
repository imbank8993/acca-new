import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';

export function sessionVersion(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const value = (metadata as Record<string, unknown>).session_version;
  return typeof value === 'string' ? value : '';
}

export function revokeSessions(metadata: unknown): Record<string, any> {
  const current = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  return { ...current, session_version: randomUUID() };
}

/** All account/role writers share one lock; checks and writes cannot race. */
export async function lockAccountWrites(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(170017, 1)::text');
}

export async function countUsableAdmins(tx: Prisma.TransactionClient): Promise<number> {
  const candidates = await tx.public_users.findMany({
    where: { aktif: true, role: { contains: 'ADMIN', mode: 'insensitive' } },
    select: { role: true, auth_id: true },
  });
  const authIds = candidates.map(user => user.auth_id).filter((id): id is string => Boolean(id));
  if (!authIds.length) return 0;
  const credentials = await tx.auth_users.findMany({ where: { id: { in: authIds } }, select: { id: true, encrypted_password: true } });
  const usable = new Set(credentials.filter(credential => Boolean(credential.encrypted_password)).map(credential => credential.id));
  return candidates.filter(user => user.auth_id && usable.has(user.auth_id) &&
    String(user.role || '').split(/[,|]/).some(role => ['ADMIN', 'ADMINISTRATOR'].includes(role.trim().toUpperCase()))).length;
}
