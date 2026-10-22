import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { redactAuditValue } from '@acca/shared';

export interface AuditLogOptions {
  user?: any;
  action: string;
  entity: string;
  entityId?: string;
  details?: any;
  req?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private extractIp(req?: any): string | null {
    if (!req) return null;
    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      return xForwardedFor.split(',')[0].trim().slice(0, 64);
    }
    if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      return xForwardedFor[0].trim().slice(0, 64);
    }
    return (req.ip || req.socket?.remoteAddress || null)?.toString().slice(0, 64) || null;
  }

  private extractUserAgent(req?: any): string | null {
    if (!req) return null;
    const ua = req.headers?.['user-agent'];
    return typeof ua === 'string' ? ua.slice(0, 500) : null;
  }

  /**
   * Catat audit log secara non-blocking dan resilient.
   * Kesalahan pencatatan log tidak akan menggagalkan operasi bisnis utama.
   */
  async record(options: AuditLogOptions): Promise<void> {
    const { user, action, entity, entityId, details, req } = options;

    const userId = user?.auth_id || user?.sub || (typeof user?.id === 'string' ? user.id : user?.id?.toString()) || null;
    const userNip = user?.nip || user?.username || null;
    const userName = user?.nama || user?.nama_lengkap || user?.name || null;
    const userRole = Array.isArray(user?.roles) 
      ? user.roles.join(',') 
      : (user?.role ? String(user.role) : null);

    const ipAddress = this.extractIp(req);
    const userAgent = this.extractUserAgent(req);

    try {
      await (this.prisma as any).audit_logs.create({
        data: {
          user_id: userId ? String(userId) : null,
          user_nip: userNip ? String(userNip) : null,
          user_name: userName ? String(userName) : null,
          user_role: userRole ? String(userRole) : null,
          action,
          entity,
          entity_id: entityId ? String(entityId) : null,
          details: details ? redactAuditValue(details) as any : null,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Gagal mencatat audit log [${action}] pada [${entity}]: ${err.message || err}`);
    }
  }

  /**
   * Mengambil riwayat log audit terkini dengan pagination / filter entity & action.
   */
  async getRecentLogs(limit = 50, offset = 0, entity?: string, action?: string, search?: string) {
    limit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 50;
    offset = Number.isSafeInteger(offset) ? Math.max(0, Math.min(offset, 10000000)) : 0;
    const where: any = {};
    if (entity && entity !== 'Semua') where.entity = { contains: entity, mode: 'insensitive' };
    if (action && action !== 'Semua') where.action = ['CREATE','UPDATE','DELETE'].includes(action) ? { startsWith: action } : action;
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { user_name: { contains: q, mode: 'insensitive' } },
        { user_nip: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { entity_id: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      (this.prisma as any).audit_logs.count({ where }),
      (this.prisma as any).audit_logs.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: Math.min(limit, 100),
        skip: offset,
      }),
    ]);

    const data = rows.map((r: any) => ({
      ...r,
      id: r.id.toString(),
      details: redactAuditValue(r.details),
    }));

    return { ok: true, total, data };
  }
}
