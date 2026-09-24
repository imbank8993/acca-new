import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PegawaiGuard } from '../auth/pegawai.guard';
import { WaliKelasService } from './wali-kelas.service';

@ApiTags('Wali Kelas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PegawaiGuard)
@Controller('wali-kelas')
export class WaliKelasController {
  constructor(private readonly waliKelasService: WaliKelasService) {}

  @Get('absensi-akumulasi')
  @ApiOperation({ summary: 'Ambil daftar kelas atau rekap absensi akumulasi wali kelas' })
  async getAbsensiAkumulasi(@Query() query: any, @Request() req: any) {
    return await this.waliKelasService.getAbsensiAkumulasi(query, req.user);
  }

  @Post('absensi-akumulasi/lock')
  @ApiOperation({ summary: 'Kunci/bekukan rekap absensi akumulasi bulanan kelas' })
  async lockAbsensi(@Body() body: any, @Request() req: any) {
    return await this.waliKelasService.lockAbsensi(body, req.user);
  }

  @Post('absensi-akumulasi/unlock')
  @ApiOperation({ summary: 'Buka kunci rekap absensi akumulasi bulanan kelas' })
  async unlockAbsensi(@Body() body: any, @Request() req: any) {
    return await this.waliKelasService.unlockAbsensi(body, req.user);
  }

  @Get('ekskul')
  @ApiOperation({ summary: 'Daftar ekstrakurikuler siswa dalam kelas' })
  async getEkskul(@Query() query: any, @Request() req: any) {
    return await this.waliKelasService.getEkskul(query, req.user);
  }
}
