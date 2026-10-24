import { Controller, Get, Post, Delete, Patch, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ESupervisiService, PERAN_KELOLA_SUPERVISI, SUPERVISI_KELOLA_KEY } from './e-supervisi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { FeatureAccess, FeatureAccessGuard } from '../auth/feature-access.guard';

/**
 * Nilai supervisi, penugasan supervisor, dan dokumen unggahan guru.
 *
 * Gerbang berlapis:
 *   1. Kelas: sesi sah + akses halaman e-supervisi.
 *   2. Pengaturan (dokumen, indikator, penugasan, daftar supervisor): pemegang
 *      Hak Akses Fitur `supervisi_access_config` + peran bawaan WKM Akademik.
 *   3. Data per orang (nilai, unggahan, rekap): dibatasi di service — guru dan
 *      supervisor hanya melihat penugasan yang melibatkan dirinya; pengelola
 *      dan pimpinan (KAMAD/Pengawas) melihat semuanya.
 */
@Controller('e-supervisi')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('e-supervisi')
export class ESupervisiController {
  constructor(private readonly eSupervisiService: ESupervisiService) {}

  @Get('dokumen')
  async getDokumen(@Query('tahap') tahap: string, @Query('tahun_ajaran_id') tahun_ajaran_id: string) {
    const ta = parseInt(tahun_ajaran_id, 10);
    return this.eSupervisiService.getDokumen(tahap, Number.isInteger(ta) && ta > 0 ? ta : undefined);
  }

  @Post('dokumen')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(SUPERVISI_KELOLA_KEY, ...PERAN_KELOLA_SUPERVISI)
  async upsertDokumen(@Body() body: any) {
    return this.eSupervisiService.upsertDokumen(body);
  }

  @Delete('dokumen')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(SUPERVISI_KELOLA_KEY, ...PERAN_KELOLA_SUPERVISI)
  async deleteDokumen(@Query('id') id: string) {
    return this.eSupervisiService.deleteDokumen(id);
  }

  @Get('nilai')
  async getNilai(@Req() req: any, @Query('penugasan_id') penugasan_id: string) {
    return this.eSupervisiService.getNilai(req.user, penugasan_id);
  }

  @Post('nilai')
  async upsertNilai(@Req() req: any, @Body() body: any) {
    return this.eSupervisiService.upsertNilai(req.user, body);
  }

  @Get('penugasan')
  async getPenugasan(
    @Req() req: any,
    @Query('tahun_ajaran_id') tahun_ajaran_id: string,
    @Query('supervisor_nip') supervisor_nip: string,
    @Query('guru_nip') guru_nip: string,
  ) {
    const ta = parseInt(tahun_ajaran_id, 10);
    return this.eSupervisiService.getPenugasan(req.user, Number.isInteger(ta) && ta > 0 ? ta : undefined, supervisor_nip, guru_nip);
  }

  @Post('penugasan')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(SUPERVISI_KELOLA_KEY, ...PERAN_KELOLA_SUPERVISI)
  async upsertPenugasan(@Body() body: any) {
    return this.eSupervisiService.upsertPenugasan(body);
  }

  @Delete('penugasan')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(SUPERVISI_KELOLA_KEY, ...PERAN_KELOLA_SUPERVISI)
  async deletePenugasan(@Query('id') id: string) {
    return this.eSupervisiService.deletePenugasan(id);
  }

  @Patch('penugasan')
  async updateStatusPenugasan(@Req() req: any, @Body() body: any) {
    return this.eSupervisiService.updateStatusPenugasan(req.user, body);
  }

  @Get('rekap')
  async getRekap(@Req() req: any, @Query('tahun_ajaran_id') tahun_ajaran_id: string) {
    return this.eSupervisiService.getRekap(req.user, tahun_ajaran_id);
  }

  @Get('supervisor-list')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(SUPERVISI_KELOLA_KEY, ...PERAN_KELOLA_SUPERVISI)
  async getSupervisorList() {
    return this.eSupervisiService.getSupervisorList();
  }

  @Get('unggahan')
  async getUnggahan(@Req() req: any, @Query('guru_nip') guru_nip: string, @Query('tahun_ajaran_id') tahun_ajaran_id: string) {
    return this.eSupervisiService.getUnggahan(req.user, guru_nip, tahun_ajaran_id);
  }

  /** Pemeriksaan sebelum berkas dikirim ke penyimpanan (dipanggil route upload Next). */
  @Post('unggahan/cek')
  async cekUnggahan(@Req() req: any, @Body() body: any) {
    return this.eSupervisiService.cekUnggahan(body, req.user);
  }

  @Post('unggahan/record')
  async upsertUnggahanRecord(@Req() req: any, @Body() body: any) {
    return this.eSupervisiService.upsertUnggahanRecord(body, req.user);
  }

  @Delete('unggahan')
  async deleteUnggahan(@Req() req: any, @Query('id') id: string) {
    return this.eSupervisiService.deleteUnggahan(id, req.user);
  }

  @Get('tahun-ajaran')
  async getTahunAjaranList(@Req() req: any) {
    return this.eSupervisiService.getTahunAjaranList(req.user);
  }
}
