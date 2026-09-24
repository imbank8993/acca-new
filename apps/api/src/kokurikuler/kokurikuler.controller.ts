import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KokurikulerService } from './kokurikuler.service';

@ApiTags('Kokurikuler')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kokurikuler')
export class KokurikulerController {
  constructor(private readonly kokurikulerService: KokurikulerService) {}

  // --- Master Kegiatan ---

  @Get('master')
  @ApiOperation({ summary: 'Daftar master kegiatan kokurikuler' })
  async getMaster(@Query('aktif') aktif?: string) {
    const data = await this.kokurikulerService.getMaster(aktif === 'true');
    return { ok: true, data };
  }

  @Post('master')
  @ApiOperation({ summary: 'Tambah kegiatan kokurikuler baru' })
  async createMaster(@Request() req: any, @Body() body: any) {
    const data = await this.kokurikulerService.createMaster(req.user, body);
    return { ok: true, data };
  }

  @Put('master/:id')
  @ApiOperation({ summary: 'Update master kegiatan kokurikuler' })
  async updateMaster(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.kokurikulerService.updateMaster(req.user, id, body);
    return { ok: true, data };
  }

  @Delete('master/:id')
  @ApiOperation({ summary: 'Hapus master kegiatan kokurikuler' })
  async deleteMaster(@Request() req: any, @Param('id') id: string) {
    return await this.kokurikulerService.deleteMaster(req.user, id);
  }

  // --- Log Kegiatan Siswa ---

  @Get('siswa')
  @ApiOperation({ summary: 'Ambil log kegiatan harian siswa' })
  async getSiswaLogs(@Query('nisn') nisn: string, @Query('tanggal') tanggal: string) {
    const data = await this.kokurikulerService.getSiswaLogs(nisn, tanggal);
    return { ok: true, data };
  }

  @Post('siswa')
  @ApiOperation({ summary: 'Simpan log kegiatan harian siswa' })
  async saveSiswaLogs(@Request() req: any, @Body() body: any) {
    return await this.kokurikulerService.saveSiswaLogs(req.user, body);
  }

  // --- Verifikasi Pembina ---

  @Get('verifikasi')
  @ApiOperation({ summary: 'Daftar kegiatan siswa untuk verifikasi' })
  async getVerifikasiList(@Query() query: any) {
    return await this.kokurikulerService.getVerifikasiList(query);
  }

  @Post('verifikasi')
  @ApiOperation({ summary: 'Verifikasi kegiatan siswa' })
  async verifyLogs(@Request() req: any, @Body() body: any) {
    return await this.kokurikulerService.verifyLogs(req.user, body);
  }

  // --- Laporan ---

  @Get('laporan')
  @ApiOperation({ summary: 'Rekapitulasi dan laporan kegiatan kokurikuler' })
  async getLaporan(@Query() query: any) {
    return await this.kokurikulerService.getLaporan(query);
  }
}
