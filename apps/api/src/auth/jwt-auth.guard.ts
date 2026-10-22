import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const internalKey = req.headers['x-internal-key'];
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (expectedKey && internalKey === expectedKey) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context?: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Akses ditolak. Token tidak valid atau tidak ditemukan.');
    }
    if (user.must_change_password) {
      const req = context?.switchToHttp().getRequest();
      const path = String(req?.originalUrl || req?.url || '').split('?')[0].replace(/\/+$/, '').replace(/^\/api(?=\/)/, '');
      const action = `${String(req?.method || '').toUpperCase()} ${path}`;
      if (!['GET /access/me', 'POST /users/me/password', 'PUT /users/me'].includes(action)) {
        throw new ForbiddenException({ error: 'Anda wajib mengganti password sementara sebelum menggunakan aplikasi.', code: 'PASSWORD_CHANGE_REQUIRED' });
      }
    }
    return user;
  }
}

