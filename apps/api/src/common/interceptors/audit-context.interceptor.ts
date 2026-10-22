import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { auditContext } from '../audit-context';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler) {
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        const actor = {
            user_id: user?.auth_id || user?.id?.toString() || null,
            user_nip: user?.nip || user?.username || null,
            user_name: user?.nama_lengkap || user?.nama || user?.username || null,
            user_role: Array.isArray(user?.roles) ? user.roles.join(',') : user?.role || null,
            ip_address: String(req.headers?.['x-forwarded-for'] || req.ip || '').split(',')[0].slice(0, 64),
            user_agent: String(req.headers?.['user-agent'] || '').slice(0, 500),
            page: String(req.originalUrl || req.url || '').split('?')[0].slice(0, 300), source: 'acca-api',
        };
        return new Observable(subscriber => {
            const subscription = auditContext.run(actor, () => next.handle().subscribe(subscriber));
            return () => subscription.unsubscribe();
        });
    }
}
