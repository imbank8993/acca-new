import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FormsOptionalAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        const authorization = String(context.switchToHttp().getRequest().headers?.authorization || '');
        const token = authorization.replace(/^Bearer\s*/i, '').trim();
        if (token && (err || !user)) throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir');
        return user || null;
    }
}
