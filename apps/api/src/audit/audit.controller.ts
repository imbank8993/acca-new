import { Controller, Get, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { rolesUser, ROLE_ADMIN, WKM_INFORMASI } from '../auth/feature-access.guard';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    const roles = rolesUser(req.user);
    const isAdminOrWkm = roles.some(
      r => ROLE_ADMIN.includes(r) || WKM_INFORMASI.includes(r) || r === 'OP_PENGUMUMAN'
    );
    if (!isAdminOrWkm) {
      throw new ForbiddenException('Akses ditolak: Hanya administrator yang dapat melihat riwayat log audit');
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.auditService.getRecentLogs(limitNum, offsetNum, entity, action, search);
  }
}
