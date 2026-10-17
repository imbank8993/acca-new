import { sessionVersion } from './session-security';
import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
    @Inject(forwardRef(() => AccessService))
    private accessService: AccessService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET belum diset — lihat backend/.env.example.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; email?: string; role?: string; authId?: string; id?: any; sessionVersion?: string }) {
    const isUuid = (val?: string) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const isNumber = (val?: any) => typeof val !== 'undefined' && val !== null && /^\d+$/.test(String(val));

    // The subject is authoritative; mutable email must never select another account.
    const subject = String(payload.sub || '');
    const user = isNumber(subject)
      ? await this.prismaService.public_users.findUnique({ where: { id: BigInt(subject) } })
      : isUuid(subject)
        ? await this.prismaService.public_users.findFirst({ where: { auth_id: subject } })
        : null;

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan atau sesi telah berakhir');
    }

    if (user.aktif !== true) {
      throw new UnauthorizedException('Akun telah dinonaktifkan');
    }

    if (!user.auth_id || (payload.authId && payload.authId !== user.auth_id)) {
      throw new UnauthorizedException('Sesi tidak sesuai dengan akun');
    }
    const credential = await this.prismaService.auth_users.findUnique({
      where: { id: user.auth_id }, select: { raw_app_meta_data: true },
    });
    if (!credential || (payload.sessionVersion || '') !== sessionVersion(credential.raw_app_meta_data)) {
      throw new UnauthorizedException('Sesi telah berakhir. Silakan login kembali.');
    }

    const baseRoles: string[] = user.role
      ? user.role.split(/[,|]/).map((r) => r.trim().toUpperCase()).filter(Boolean)
      : [];

    const dutyRoles: string[] = user.nip
      ? await this.accessService.getDutyRoles(user.nip)
      : [];

    const roles = [...new Set([...baseRoles, ...dutyRoles])];

    // Kapabilitas ikut dipasang di sini supaya `can(req.user, 'x.y')` (lihat
    // access.service) bisa sinkron di seluruh service tanpa query berulang.
    const caps = await this.accessService.resolveCapabilities(user.id, roles);

    return {
      ...user,
      authId: user.auth_id,
      roles,
      caps,
    };
  }
}
