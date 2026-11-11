import { BadRequestException, Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { rolesUser, ROLE_ADMIN } from '../auth/feature-access.guard';
import { DataSystemService } from './data-system.service';

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new BadRequestException('Parameter halaman tidak valid.');
  return number;
}

@Controller('data-sistem')
@UseGuards(JwtAuthGuard)
export class DataSystemController {
  constructor(private readonly explorer: DataSystemService) {}

  private assertAdmin(req: any) {
    if (!rolesUser(req.user).some(role => ROLE_ADMIN.includes(role))) throw new ForbiddenException('Hanya administrator yang dapat membuka tabel dan dokumen sistem.');
  }

  @Get('tables')
  tables(@Req() req: any) { this.assertAdmin(req); return this.explorer.tables(); }

  @Get('table')
  table(@Req() req: any, @Query('schema') schema: string, @Query('name') name: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    this.assertAdmin(req);
    return this.explorer.table(schema || 'public', name, integer(page, 1, 1, 100000), integer(limit, 25, 1, 100));
  }
}
