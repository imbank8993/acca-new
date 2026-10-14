import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

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
    return super.getTracker(req);
  }
}
