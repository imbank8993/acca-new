import { Controller, Get, Post, Patch, Query, Body, Req, UseGuards } from '@nestjs/common';
import { UmKelulusanService } from './um-kelulusan.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // assuming JwtAuthGuard exists

@UseGuards(JwtAuthGuard)
@Controller()
export class UmKelulusanController {
  constructor(private readonly umKelulusanService: UmKelulusanService) {}

  @Get('kelulusan')
  getKelulusan(@Query() query: any) {
    return this.umKelulusanService.getKelulusan(query);
  }

  private isAdminKurikulum(req: any): boolean {
    const role = (req.user?.role || '').toUpperCase();
    return (req.user?.roles || role.split(/[,|]/).map((r: string) => r.trim())).some((r: string) => ['ADMIN','ADMINISTRATOR','KURIKULUM','WKM_AKADEMIK','WAKAMAD_KURIKULUM'].includes(r));
  }

  @Post('kelulusan')
  postKelulusan(@Req() req: any, @Body() body: any) {
    if (!this.isAdminKurikulum(req)) throw new (require('@nestjs/common').ForbiddenException)('Akses ditolak');
    return this.umKelulusanService.postKelulusan(body, req.user);
  }

  @Patch('kelulusan')
  patchKelulusan(@Req() req: any, @Body() body: any) {
    if (!this.isAdminKurikulum(req)) throw new (require('@nestjs/common').ForbiddenException)('Akses ditolak');
    return this.umKelulusanService.patchKelulusan(body);
  }

  @Get('ujian-madrasah')
  getUjianMadrasah(@Query() query: any) {
    return this.umKelulusanService.getUjianMadrasah(query);
  }

  @Post('ujian-madrasah')
  postUjianMadrasah(@Req() req: any, @Body() body: any) {
    return this.umKelulusanService.postUjianMadrasah(body, req.user);
  }

  @Get('ujian-madrasah/kelas-xii')
  getKelasXii(@Query() query: any) {
    return this.umKelulusanService.getKelasXii(query);
  }

  @Post('ujian-madrasah/config')
  postUmConfig(@Req() req: any, @Body() body: any) {
    if (!this.isAdminKurikulum(req)) throw new (require('@nestjs/common').ForbiddenException)('Akses ditolak');
    return this.umKelulusanService.postUmConfig(body);
  }

  @Post('ujian-madrasah/import-raport')
  postUmRaport(@Req() req: any, @Body() body: any) {
    if (!this.isAdminKurikulum(req)) throw new (require('@nestjs/common').ForbiddenException)('Akses ditolak');
    return this.umKelulusanService.postUmRaport(body);
  }

  @Get('settings/um-lock')
  getUmLock(@Query() query: any) {
    return this.umKelulusanService.getUmLock(query);
  }

  @Post('settings/um-lock')
  postUmLock(@Body() body: any, @Req() req: any) {
    // extract user info from token added by JwtAuthGuard
    const userRoleStr = req.user?.role || '';
    const nip = req.user?.nip || null;
    return this.umKelulusanService.postUmLock(body, userRoleStr, nip);
  }
}
