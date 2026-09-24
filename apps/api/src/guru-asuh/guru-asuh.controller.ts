import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeatureAccessGuard, FeatureAccess, GURU_ASUH_APPROVAL_KEY } from '../auth/feature-access.guard';
import { GuruAsuhService } from './guru-asuh.service';

@ApiTags('Guru Asuh')
@Controller('guru-asuh')
export class GuruAsuhController {
  constructor(private readonly service: GuruAsuhService) {}

  @Get('absensi-akumulasi')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ambil daftar mapel/kelas atau rekap akumulasi absensi anak asuh' })
  async getAbsensiAkumulasi(@Query() query: any, @Request() req: any) {
    return await this.service.getAbsensiAkumulasi(query, req.user);
  }

  @Get('ekskul')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Daftar ekstrakurikuler anak asuh' })
  async getEkskul(@Query() query: any, @Request() req: any) {
    return await this.service.getEkskul(query, req.user);
  }

  @Get('kokurikuler')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Daftar anak asuh aktif guru' })
  async getKokurikuler(@Query() query: any, @Request() req: any) {
    return await this.service.getKokurikuler(query, req.user);
  }

  @Get('laporan')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Daftar log kegiatan pembinaan guru asuh' })
  async getLaporan(@Request() req: any, @Query() query: any) {
    return await this.service.getLaporan(req.user, query);
  }

  @Post('laporan')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Simpan / perbarui log kegiatan pembinaan guru asuh' })
  async saveLaporan(@Request() req: any, @Body() body: any) {
    return await this.service.saveLaporan(req.user, body);
  }

  @Delete('laporan')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hapus log kegiatan pembinaan guru asuh' })
  async deleteLaporan(@Request() req: any, @Query('id') id: string) {
    return await this.service.deleteLaporan(req.user, id);
  }

  @Get('laporan-submission')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Daftar pengajuan laporan bulanan guru asuh' })
  async getSubmissions(@Request() req: any, @Query() query: any) {
    return await this.service.getSubmissions(req.user, query);
  }

  @Post('laporan-submission')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ajukan laporan bulanan guru asuh' })
  async postSubmission(@Request() req: any, @Body() body: any) {
    return await this.service.postSubmission(req.user, body);
  }

  @Delete('laporan-submission')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Batalkan pengajuan laporan bulanan guru asuh' })
  async deleteSubmission(@Request() req: any, @Query('id') id: string) {
    return await this.service.deleteSubmission(req.user, id);
  }

  @Post('laporan-submission/approve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(GURU_ASUH_APPROVAL_KEY, 'WKM_KEASRAMAAN')
  @ApiOperation({ summary: 'Persetujuan / revisi pengajuan laporan bulanan guru asuh' })
  async approveSubmission(@Request() req: any, @Body() body: any) {
    return await this.service.approveSubmission(req.user, body);
  }

  @Get('laporan-submission/verify')
  @ApiOperation({ summary: 'Verifikasi publik dokumen laporan bulanan via QR' })
  async verifySubmission(@Query('id') id: string) {
    return await this.service.verifySubmission(id);
  }

  @Post('laporan-submission/pembayaran')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tandai status pembayaran komite' })
  async postPembayaran(@Request() req: any, @Body() body: any) {
    return await this.service.postPembayaran(req.user, body);
  }

  @Get('laporan-submission/report-data')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Data lengkap untuk laporan PDF & preview' })
  async getReportData(@Request() req: any, @Query() query: any) {
    return await this.service.getReportData(req.user, query);
  }

  @Post('laporan-submission/pdf-url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Perbarui URL PDF submission laporan' })
  async updatePdfUrl(@Request() req: any, @Body() body: { id: string; pdf_url: string }) {
    return await this.service.updatePdfUrl(req.user, body.id, body.pdf_url);
  }

  @Post('bulk-copy')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bulk copy siswa asuh dari tahun ajaran sebelumnya' })
  async bulkCopy(@Request() req: any, @Body() body: any) {
    return await this.service.bulkCopy(body, req.user);
  }
}
