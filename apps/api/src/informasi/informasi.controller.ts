import { Controller, Get, Post, Patch, Delete, Body, Query, Req, UseGuards } from '@nestjs/common';
import { InformasiService } from './informasi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  FeatureAccess,
  FeatureAccessGuard,
  ALL_INFORMASI_KEYS,
  WKM_INFORMASI,
} from '../auth/feature-access.guard';

@Controller('informasi')
@UseGuards(JwtAuthGuard, FeatureAccessGuard)
export class InformasiController {
  constructor(private readonly informasiService: InformasiService) {}

  /**
   * Daftar informasi yang boleh DILIHAT pemanggil.
   *
   * Cakupannya diturunkan dari `req.user`, bukan dari query. Sebelumnya `role`
   * dan `admin` diambil mentah dari URL, sehingga menambahkan `?admin=true`
   * saja cukup untuk menembus seluruh penyaringan audience.
   */
  @Get()
  async getInformasi(
    @Req() req: any,
    @Query('category') category?: string,
    @Query('admin') admin?: string,
  ) {
    return this.informasiService.getInformasiUntuk(req.user, {
      category,
      mintaAdminView: admin === 'true',
    });
  }

  /** Hak pemanggil atas modul ini, agar UI tidak perlu menebak sendiri. */
  @Get('izin-saya')
  async getIzinSaya(@Req() req: any) {
    return this.informasiService.getIzinInformasi(req.user);
  }

  @Post()
  @FeatureAccess(ALL_INFORMASI_KEYS, ...WKM_INFORMASI)
  async createInformasi(@Req() req: any, @Body() body: any) {
    return this.informasiService.createInformasi(body, req.user);
  }

  @Patch()
  @FeatureAccess(ALL_INFORMASI_KEYS, ...WKM_INFORMASI)
  async updateInformasi(@Req() req: any, @Body() body: any) {
    return this.informasiService.updateInformasi(body, req.user);
  }

  @Get('audit-logs')
  @FeatureAccess(ALL_INFORMASI_KEYS, ...WKM_INFORMASI)
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('entity') entity?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.informasiService.getAuditLogs(limitNum, offsetNum, entity);
  }

  @Delete()
  @FeatureAccess(ALL_INFORMASI_KEYS, ...WKM_INFORMASI)
  async deleteInformasi(
    @Req() req: any,
    @Query('id') id?: string,
    @Query('category') category?: string,
    @Query('folder') folder?: string,
    @Query('keep_folder') keepFolder?: string
  ) {
    const targetFolder = category || folder;
    if (targetFolder) {
      return this.informasiService.deleteFolder(targetFolder, req.user, req);
    }
    return this.informasiService.deleteInformasi(id || '', req.user, { keepFolder: keepFolder !== 'false' }, req);
  }

  /**
   * Mode `?token=` dipakai halaman publik /info-link dan sengaja tidak
   * ber-role; mode daftar membocorkan token aktif sehingga dibatasi pengelola.
   */
  @Get('share')
  async getShareLink(@Req() req: any, @Query() query: any) {
    return this.informasiService.getShareLink(query, req.user);
  }

  @Post('share')
  @FeatureAccess(ALL_INFORMASI_KEYS, ...WKM_INFORMASI)
  async createShareLink(@Req() req: any, @Body() body: any) {
    return this.informasiService.createShareLink(body, req.user, req);
  }

  @Patch('share')
  @FeatureAccess(ALL_INFORMASI_KEYS, ...WKM_INFORMASI)
  async toggleShareLink(@Req() req: any, @Body() body: any) {
    return this.informasiService.toggleShareLink(body?.id, body?.revoked, req.user, req);
  }

  @Delete('share')
  @FeatureAccess(ALL_INFORMASI_KEYS, ...WKM_INFORMASI)
  async deleteShareLink(@Req() req: any, @Query('id') id: string) {
    return this.informasiService.deleteShareLink(id, req.user, req);
  }
}
