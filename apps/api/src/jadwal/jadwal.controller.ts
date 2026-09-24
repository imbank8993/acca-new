import { JadwalWriteService } from './jadwal-write.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { FeatureAccess, FeatureAccessGuard, JADWAL_GENERATE_KEY } from '../auth/feature-access.guard';
import { JadwalService, type JadwalFilterParams } from './jadwal.service';

@ApiTags('Jadwal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
@Controller('jadwal')
export class JadwalController {
  constructor(private readonly jadwalService: JadwalService, private readonly writer: JadwalWriteService) {}

  @Post('generate')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  generate(@Body() body: any, @Request() req: any) { return this.writer.generate(body, req.user); }

  @Post('save')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  save(@Body() body: any) { return this.writer.save(body); }

  @Post('delete-dates')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  deleteDates(@Body() body: any) { return this.writer.deleteDates(body); }

  @Post('delete-rows')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  deleteRows(@Body() body: any) { return this.writer.deleteRows(body); }

  @Post('move-date')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  moveDate(@Body() body: any) { return this.writer.moveDate(body); }

  // =========================================================================
  // 1. JADWAL PELAJARAN
  // =========================================================================

  @Get()
  @ApiOperation({ summary: 'Ambil daftar jadwal pelajaran guru' })
  async getJadwal(@Query() query: JadwalFilterParams, @Request() req: any) {
    // `req.user` diteruskan hanya agar `nip` bisa diredaksi untuk akun siswa dan
    // orang tua; penyaringan barisnya sendiri tetap dari query.
    return this.jadwalService.getJadwal(query, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Bulk insert jadwal pelajaran guru' })
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async bulkCreateJadwal(@Body() body: any) {
    return this.jadwalService.bulkCreateJadwal(body);
  }

  @Get('izin-saya')
  @ApiOperation({ summary: 'Hak pengguna saat ini atas halaman jadwal' })
  async getIzinSaya(@Request() req: any) {
    return this.jadwalService.getIzinJadwal(req.user);
  }

  // =========================================================================
  // 2. TUKAR JADWAL
  // =========================================================================

  @Get('tukar/slots')
  @ApiOperation({ summary: 'Ambil slot jadwal guru yang dapat diajukan untuk ditukar' })
  async getTukarSlots(
    @Request() req: any,
    @Query('jenis') jenis?: string,
    @Query('nip') nip?: string,
  ) {
    return this.jadwalService.getTukarSlots(req.user, jenis, nip);
  }

  @Get('tukar/guru')
  @ApiOperation({ summary: 'Ambil daftar rekan guru yang memiliki jadwal aktif untuk diajak bertukar' })
  async getTukarGuru(@Request() req: any, @Query('jenis') jenis?: string) {
    return this.jadwalService.getTukarGuru(req.user, jenis);
  }

  @Get('tukar')
  @ApiOperation({ summary: 'Riwayat pengajuan tukar jadwal' })
  async getTukarList(
    @Request() req: any,
    @Query('requester_nip') requester_nip?: string,
    @Query('target_nip') target_nip?: string,
    @Query('status') status?: string,
  ) {
    return this.jadwalService.getTukarList(req.user, { requester_nip, target_nip, status });
  }

  @Post('tukar')
  @ApiOperation({ summary: 'Ajukan permohonan tukar jadwal baru' })
  async createTukar(@Request() req: any, @Body() body: any) {
    return this.jadwalService.createTukar(req.user, body);
  }

  @Get('tukar/:id')
  @ApiOperation({ summary: 'Ambil detail 1 request tukar jadwal' })
  async getTukarDetail(@Param('id') id: string, @Request() req: any) {
    return this.jadwalService.getTukarDetail(id, req.user);
  }

  @Put('tukar/:id')
  @ApiOperation({ summary: 'Tanggapi pengajuan tukar jadwal (terima/tolak/setujui)' })
  async respondTukarPut(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    return this.jadwalService.respondTukar(id, req.user, body);
  }

  @Patch('tukar/:id')
  @ApiOperation({ summary: 'Tanggapi pengajuan tukar jadwal (patch method)' })
  async respondTukarPatch(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    return this.jadwalService.respondTukar(id, req.user, body);
  }

  @Delete('tukar/:id')
  @ApiOperation({ summary: 'Batalkan pengajuan tukar jadwal' })
  async cancelTukar(@Param('id') id: string, @Request() req: any) {
    return this.jadwalService.cancelTukar(id, req.user);
  }

  @Get('scopes')
  @ApiOperation({ summary: 'Ambil scope kelas/mapel/jam guru untuk dropdown absensi' })
  async getScopes(
    @Request() req: any,
    @Query('nip') nip?: string,
    @Query('kelas') kelas?: string,
    @Query('tanggal') tanggal?: string,
  ) {
    return this.jadwalService.getScopes(nip, kelas, tanggal, req.user);
  }
}

