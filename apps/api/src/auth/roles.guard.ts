import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * Penegak `@Roles()`. Selalu dipasang SETELAH `JwtAuthGuard` supaya `req.user`
 * sudah terisi.
 *
 * Role dibaca dari `req.user.roles`, yang diisi `JwtStrategy` dari baris
 * `public_users` di database — bukan dari klaim token — jadi tidak bisa
 * dipalsukan lewat token yang dirakit sendiri.
 *
 * Pemanggilan antar-service dengan `x-internal-key` dilewatkan, mengikuti
 * perlakuan yang sama di `JwtAuthGuard`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();

    const expectedKey = process.env.INTERNAL_API_KEY;
    if (expectedKey && req.headers['x-internal-key'] === expectedKey) return true;

    const roles: string[] = Array.isArray(req.user?.roles)
      ? req.user.roles.map((r: string) => String(r).trim().toUpperCase())
      : String(req.user?.role || '')
          .split(/[,|]/)
          .map((r: string) => r.trim().toUpperCase())
          .filter(Boolean);

    if (!roles.some((r) => required.includes(r))) {
      throw new ForbiddenException(
        'Akses ditolak. Anda tidak memiliki peran yang diperlukan untuk tindakan ini.',
      );
    }
    return true;
  }
}
