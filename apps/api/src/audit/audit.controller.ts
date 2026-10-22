import { Controller, Get, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { rolesUser, ROLE_ADMIN } from '../auth/feature-access.guard';
import { AuditExplorerService } from './audit-explorer.service';

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new BadRequestException('Parameter halaman tidak valid.');
  return number;
}

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly explorer: AuditExplorerService,
  ) {}

  private assertAdmin(req: any) {
    if (!rolesUser(req.user).some(role => ROLE_ADMIN.includes(role))) throw new ForbiddenException('Hanya administrator yang dapat membuka audit, tabel, dan dokumen sistem.');
  }

  @Get('status')
  status(@Req() req: any) { this.assertAdmin(req); return this.explorer.status(); }

  @Get('tables')
  tables(@Req() req: any) { this.assertAdmin(req); return this.explorer.tables(); }

  @Get('table')
  table(@Req() req: any, @Query('schema') schema: string, @Query('name') name: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    this.assertAdmin(req);
    return this.explorer.table(schema || 'public', name, integer(page, 1, 1, 100000), integer(limit, 25, 1, 100));
  }

  @Get()
  async getAuditLogs(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    this.assertAdmin(req);
    return this.auditService.getRecentLogs(integer(limit, 50, 1, 100), integer(offset, 0, 0, 10000000), entity?.slice(0, 128), action?.slice(0, 50), search?.slice(0, 200));
  }
}
