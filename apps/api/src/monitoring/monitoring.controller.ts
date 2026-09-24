import { Controller, ForbiddenException, Get, Query, Request, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Daftar pengguna dan log aktivitas seluruh penghuni aplikasi — sebelumnya
   * terbuka untuk setiap sesi yang valid, padahal menunya cuma diberikan ke
   * sebagian role. Izinnya sekarang mengikuti `role_pages` untuk halaman
   * `monitoring`, jadi yang menentukan tetap konfigurasi yang sudah ada, bukan
   * daftar role yang ditulis ulang di sini.
   */
  private async assertCanMonitor(req: any) {
    const access = await this.accessService.resolveUserAccess(req.user);
    const isAdmin = access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
    if (!isAdmin && !access.pageIds.includes('monitoring')) {
      throw new ForbiddenException('Anda tidak memiliki izin melihat data monitoring');
    }
  }

  @Get('activity')
  async getActivityLogs(
    @Request() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    await this.assertCanMonitor(req);

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;

    const data = await this.monitoringService.getActivityLogs(pageNum, limitNum);

    return {
      success: true,
      data,
    };
  }

  @Get('users')
  async getUsers(@Request() req: any) {
    await this.assertCanMonitor(req);

    const data = await this.monitoringService.getUsers();

    return {
      success: true,
      data,
    };
  }
}
