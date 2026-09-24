import { Controller, Get, Post, Delete, Patch, Body, Query, Param, UseGuards, Request, Req } from '@nestjs/common';
import { ESupervisiService } from './e-supervisi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { FeatureAccess, FeatureAccessGuard } from '../auth/feature-access.guard';
import { Request as ExpressRequest } from 'express';

/**
 * Nilai supervisi, penugasan supervisor, dan dokumen unggahan guru. Sebelumnya
 * sesi apa pun yang sah boleh membaca DAN menulisnya — termasuk SISWA atau
 * ORANG_TUA, yang bisa mengubah nilai supervisi siapa pun. Seluruh endpoint
 * modul ini hanya dipakai halaman e-supervisi, jadi gerbangnya dipasang di
 * tingkat kelas.
 */
@Controller('e-supervisi')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('e-supervisi')
export class ESupervisiController {
  constructor(private readonly eSupervisiService: ESupervisiService) {}

  @Get('dokumen')
  async getDokumen(@Query('tahap') tahap: string, @Query('tahun_ajaran_id') tahun_ajaran_id: string) {
    return this.eSupervisiService.getDokumen(tahap, tahun_ajaran_id ? parseInt(tahun_ajaran_id) : undefined);
  }

  @Post('dokumen')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess('supervisi_access_config', 'WKM_AKADEMIK', 'WAKAMAD_KURIKULUM')
  async upsertDokumen(@Body() body: any) {
    return this.eSupervisiService.upsertDokumen(body);
  }

  @Delete('dokumen')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess('supervisi_access_config', 'WKM_AKADEMIK', 'WAKAMAD_KURIKULUM')
  async deleteDokumen(@Query('id') id: string) {
    return this.eSupervisiService.deleteDokumen(parseInt(id));
  }

  @Get('nilai')
  async getNilai(@Query('penugasan_id') penugasan_id: string) {
    return this.eSupervisiService.getNilai(penugasan_id ? parseInt(penugasan_id) : undefined);
  }

  @Post('nilai')
  async upsertNilai(@Req() req: any, @Body() body: any) {
    return this.eSupervisiService.upsertNilai(req.user, body);
  }

  @Get('penugasan')
  async getPenugasan(
    @Query('tahun_ajaran_id') tahun_ajaran_id: string,
    @Query('supervisor_nip') supervisor_nip: string,
    @Query('guru_nip') guru_nip: string
  ) {
    return this.eSupervisiService.getPenugasan(tahun_ajaran_id ? parseInt(tahun_ajaran_id) : undefined, supervisor_nip, guru_nip);
  }

  @Post('penugasan')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess('supervisi_access_config', 'WKM_AKADEMIK', 'WAKAMAD_KURIKULUM')
  async upsertPenugasan(@Body() body: any) {
    return this.eSupervisiService.upsertPenugasan(body);
  }

  @Delete('penugasan')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess('supervisi_access_config', 'WKM_AKADEMIK', 'WAKAMAD_KURIKULUM')
  async deletePenugasan(@Query('id') id: string) {
    return this.eSupervisiService.deletePenugasan(parseInt(id));
  }

  @Patch('penugasan')
  async updateStatusPenugasan(@Req() req: any, @Body() body: any) {
    return this.eSupervisiService.updateStatusPenugasan(req.user, body);
  }

  @Get('rekap')
  async getRekap(@Query('tahun_ajaran_id') tahun_ajaran_id: string) {
    return this.eSupervisiService.getRekap(parseInt(tahun_ajaran_id));
  }

  @Get('supervisor-list')
  async getSupervisorList() {
    return this.eSupervisiService.getSupervisorList();
  }

  @Get('unggahan')
  async getUnggahan(@Query('guru_nip') guru_nip: string, @Query('tahun_ajaran_id') tahun_ajaran_id: string) {
    return this.eSupervisiService.getUnggahan(guru_nip, parseInt(tahun_ajaran_id));
  }

  @Post('unggahan/record')
  async upsertUnggahanRecord(@Req() req: any, @Body() body: any) {
    return this.eSupervisiService.upsertUnggahanRecord(body, req.user);
  }

  @Delete('unggahan')
  async deleteUnggahan(@Req() req: any, @Query('id') id: string) {
    return this.eSupervisiService.deleteUnggahan(parseInt(id), req.user);
  }

  @Get('tahun-ajaran')
  async getTahunAjaranList() {
    return this.eSupervisiService.getTahunAjaranList();
  }
}
