import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { env } from 'node:process';

/** Panggilan antar-service yang membawa INTERNAL_API_KEY yang benar. */
export function hasValidInternalKey(header: unknown, expected = env.INTERNAL_API_KEY): boolean {
  if (!expected || typeof header !== 'string' || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Kunci kuota login: IP asli + akun yang dicoba.
 *
 * Dulu login tanpa token jatuh ke kuota per IP, dan IP yang terlihat API
 * adalah kontainer acca-web (semua login lewat route Next) — seluruh sekolah
 * berbagi SATU kuota 120/menit. Siswa di jaringan sekolah pun keluar lewat satu
 * IP NAT, jadi kuota per IP saja tetap menyatukan mereka. Dengan menyertakan
 * nama akun, setiap siswa punya kuotanya sendiri, sementara percobaan beruntun
 * terhadap satu akun dari satu IP tetap dibatasi (lihat @Throttle di login).
 */
export function loginTracker(req: Record<string, any>): string | null {
  const account = loginAccount(req);
  return account ? `login:${req.ip || 'unknown'}:${account}` : null;
}

/** Akun yang dicoba pada POST /auth/login (huruf kecil), atau null. */
export function loginAccount(req: Record<string, any>): string | null {
  const path = String(req?.originalUrl || req?.url || '').split('?')[0];
  if (req?.method !== 'POST' || !/\/auth\/login$/.test(path)) return null;
  const raw = req.body?.usernameOrEmail ?? req.body?.username ?? req.body?.email;
  const account = typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 254) : '';
  return account || null;
}

/**
 * Batas kedua khusus login: per AKUN, berapa pun IP-nya. Bila proxy di depan
 * tidak menambahkan IP asli, X-Forwarded-For dapat dipalsukan dan kuota per IP
 * bisa dihindari dengan berganti "IP"; batas ini tetap menahan tebakan password
 * beruntun ke satu akun. Dipasang sebagai throttler bernama di app.module.ts.
 */
export const LOGIN_ACCOUNT_THROTTLER = {
  name: 'login-account',
  ttl: 15 * 60_000,
  limit: 30,
  skipIf: (context: ExecutionContext) => !loginAccount(context.switchToHttp().getRequest()),
  getTracker: (req: Record<string, any>) => `login-account:${loginAccount(req) || 'unknown'}`,
};

/** Next.js proxies many users from one IP; verified sessions need separate quotas. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
  ) {
    super(options, storage, reflector);
  }

  /**
   * Panggilan internal acca-web (mis. resolusi akses untuk SSO ke CBT) semuanya
   * datang dari IP kontainer yang sama. Tanpa pengecualian ini, ratusan siswa
   * yang membuka CBT bersamaan menghabiskan satu kuota 120/menit dan SSO gagal.
   * Kunci internal tetap diverifikasi guard masing-masing endpoint.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (hasValidInternalKey(req?.headers?.['x-internal-key'])) return true;
    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authorization = req.headers?.authorization;
    if (typeof authorization === 'string' && /^Bearer /i.test(authorization)) {
      try {
        // This global guard runs before JwtAuthGuard. Verify the signature and expiry
        // here; decoding an unverified token would let callers invent unlimited quotas.
        const claims = await this.jwt.verifyAsync<{ sub?: string | number }>(
          authorization.slice(7).trim(),
          { algorithms: ['HS256'] },
        );
        if (claims.sub != null && String(claims.sub)) return `user:${claims.sub}`;
      } catch {
        // Missing, expired and forged tokens retain the existing IP limit.
      }
    }
    const login = loginTracker(req);
    if (login) return login;
    return super.getTracker(req);
  }
}
