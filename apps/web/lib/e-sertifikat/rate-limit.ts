import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CertificateDb } from './service';
import { CertificateError } from './validation';

async function consume(db: CertificateDb, key: string, limit: number) {
    // Database time and atomic upserts share counters across concurrent workers
    // and restarts. A denied request cannot reset the bucket.
    const rows = await db.$queryRaw<{ hits: number }[]>(Prisma.sql`
      INSERT INTO ecert_public_limits(bucket,hits,expires_at) VALUES(${key},1,now()+interval '60 seconds')
      ON CONFLICT(bucket) DO UPDATE SET
        hits=CASE WHEN ecert_public_limits.expires_at<=now() THEN 1 ELSE ecert_public_limits.hits+1 END,
        expires_at=CASE WHEN ecert_public_limits.expires_at<=now() THEN now()+interval '60 seconds' ELSE ecert_public_limits.expires_at END
      WHERE ecert_public_limits.expires_at<=now() OR ecert_public_limits.hits<${limit}
      RETURNING hits`);
    if (!rows.length) throw new CertificateError('Terlalu banyak permintaan. Coba lagi sebentar.', 429);
    return rows[0].hits;
}

export async function limitPublicCertificateRequest(db: CertificateDb, token: string) {
    // No client-supplied forwarding header is trusted. The global cap also limits
    // token rotation and bounds bucket growth to 1,200 new keys per minute.
    const hits = await consume(db, 'global', 1200);
    if (hits === 1) await db.$executeRaw(Prisma.sql`DELETE FROM ecert_public_limits WHERE expires_at<now()-interval '60 seconds'`);
    if (!/^[a-f\d]{48}$/.test(token)) throw new CertificateError('Sertifikat tidak ditemukan', 404);
    await consume(db, `token:${createHash('sha256').update(token).digest('hex')}`, 120);
}
