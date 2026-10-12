import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotulensiService } from './notulensi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NOTULENSI_KELOLA_KEY, FeatureAccess, FeatureAccessGuard } from '../auth/feature-access.guard';

@Controller('notulensi')
@UseGuards(JwtAuthGuard)
export class NotulensiController {
  constructor(private readonly notulensiService: NotulensiService) {}

  /**
   * Hak akses user pada modul ini
   */
  @Get('izin-saya')
  async getIzinSaya(@Req() req: any) {
    return this.notulensiService.getIzinSaya(req.user);
  }

  /**
   * Mengambil pengaturan hak akses CRUD (role & user yang ditunjuk)
   */
  @Get('pengaturan')
  async getPengaturan() {
    return this.notulensiService.getPengaturan();
  }

  /**
   * Memperbarui pengaturan hak akses CRUD (hanya ADMIN)
   */
  @Put('pengaturan')
  async updatePengaturan(@Body() body: any, @Req() req: any) {
    return this.notulensiService.updatePengaturan(body, req.user, req);
  }

  /**
   * Daftar notulensi rapat (dapat dilihat oleh semua guru/staf terotentikasi)
   */
  @Get()
  async getList(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('bulan') bulan?: string,
    @Query('tahun') tahun?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notulensiService.getList({ search, status, bulan, tahun, limit, offset });
  }

  /**
   * Detail notulensi rapat
   */
  @Get(':id')
  async getDetail(@Param('id') id: string) {
    return this.notulensiService.getDetail(id);
  }

  /**
   * Buat notulensi rapat baru (dibatasi oleh FeatureAccessGuard)
   */
  @Post()
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(NOTULENSI_KELOLA_KEY)
  async create(@Body() body: any, @Req() req: any) {
    return this.notulensiService.create(body, req.user, req);
  }

  /**
   * Perbarui notulensi rapat (dibatasi oleh FeatureAccessGuard)
   */
  @Put(':id')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(NOTULENSI_KELOLA_KEY)
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.notulensiService.update(id, body, req.user, req);
  }

  /**
   * Pembaruan cepat status tindak lanjut (dibatasi oleh FeatureAccessGuard)
   */
  @Patch(':id/status')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(NOTULENSI_KELOLA_KEY)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: string; poin_id?: string; poin_status?: string; keterangan?: string },
    @Req() req: any,
  ) {
    return this.notulensiService.updateStatus(id, body, req.user, req);
  }

  /**
   * Hapus notulensi rapat (dibatasi oleh FeatureAccessGuard)
   */
  @Delete(':id')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess(NOTULENSI_KELOLA_KEY)
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.notulensiService.delete(id, req.user, req);
  }
}
