import { Controller, Get, Post, Put, Delete, Body, Query, UseGuards, Req, BadRequestException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { AgendaService } from './agenda.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AGENDA_KELOLA_KEY, FeatureAccess, FeatureAccessGuard } from '../auth/feature-access.guard';

/**
 * Guard dipasang per-method, BUKAN di level kelas, karena `GET /agenda/public`
 * memang harus tetap anonim (layar display & integrasi luar) — guard kelas di
 * Nest tetap ikut berlaku walau method punya guard sendiri.
 *
 * Sebelumnya seluruh endpoint tulis di sini tidak punya guard sama sekali:
 * membuat, menghapus, dan mengunggah foto agenda bisa dilakukan tanpa
 * autentikasi oleh siapa pun yang dapat menjangkau port ini.
 */
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  /** Sengaja anonim: hanya agenda ber-`is_publik` yang dikembalikan. */
  @Get('public')
  async getPublicAgendas(@Query('bulan') bulan: string, @Query('limit') limit?: string, @Query('page') page?: string) {
    // `parseInt('abc')` menghasilkan NaN yang dulu diteruskan sebagai `take` ke
    // Prisma dan berujung 500. Dijepit ke rentang wajar.
    const diminta = Number.parseInt(String(limit ?? ''), 10);
    const take = Number.isFinite(diminta) ? Math.min(Math.max(diminta, 1), 200) : 50;
    const pageNumber = page === undefined ? 1 : Number(page);
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 10000) throw new BadRequestException('Halaman tidak valid');
    const list = await this.agendaService.getPublicAgendas(bulan, take + 1, (pageNumber - 1) * take);
    return { success: true, data: list.slice(0, take), has_more: list.length > take, page: pageNumber };
  }

  /** Hak pemanggil atas modul ini, agar UI tidak perlu menebak sendiri. */
  @Get('izin-saya')
  @UseGuards(JwtAuthGuard)
  async getIzinSaya(@Req() req: any) {
    return this.agendaService.getIzinAgenda(req.user);
  }

  // AGENDA MADRASAH
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAgendas(@Query('bulan') bulan: string) {
    const data = await this.agendaService.getAgendas(bulan);
    return { success: true, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async createAgenda(@Body() body: any, @Req() req: any) {
    const data = await this.agendaService.createAgenda(body, req.user, req);
    return { success: true, data };
  }

  @Put()
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async updateAgenda(@Body() body: any, @Req() req: any) {
    const data = await this.agendaService.updateAgenda(body, req.user, req);
    return { success: true, data };
  }

  @Delete()
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async deleteAgenda(@Query('id') id: string, @Req() req: any) {
    if (!id) throw new BadRequestException('ID wajib diisi');
    await this.agendaService.deleteAgenda(id, req.user, req);
    return { success: true };
  }

  // KATEGORI AGENDA
  @Get('kategori')
  @UseGuards(JwtAuthGuard)
  async getKategori() {
    const data = await this.agendaService.getKategori();
    return { success: true, data };
  }

  @Post('kategori')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async createKategori(@Body() body: any, @Req() req: any) {
    const data = await this.agendaService.createKategori(body, req.user, req);
    return { success: true, data };
  }

  @Put('kategori')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async updateKategori(@Body() body: any, @Req() req: any) {
    const data = await this.agendaService.updateKategori(body, req.user, req);
    return { success: true, data };
  }

  @Delete('kategori')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async deleteKategori(@Query('id') id: string, @Req() req: any) {
    if (!id) throw new BadRequestException('ID wajib diisi');
    await this.agendaService.deleteKategori(id, req.user, req);
    return { success: true };
  }

  // FOTO AGENDA
  @Post('foto')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  @UseInterceptors(AnyFilesInterceptor())
  async uploadFoto(@Req() req: any, @UploadedFiles() uploadedFiles: Array<any>) {
    const body = req.body;
    const agendaId = body.agenda_id;
    if (!agendaId) throw new BadRequestException('agenda_id wajib diisi');

    const files = uploadedFiles.filter(f => f.fieldname === 'files');
    if (!files || files.length === 0) throw new BadRequestException('file wajib diisi');

    // Handle single or multiple string values from form-data
    let captions = body.captions || [];
    if (!Array.isArray(captions)) captions = [captions];
    let tanggals = body.tanggals || [];
    if (!Array.isArray(tanggals)) tanggals = [tanggals];

    const data = await this.agendaService.uploadFoto(agendaId, files, captions, tanggals, req.user, req);
    return { success: true, data };
  }

  @Put('foto')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async updateFoto(@Body() body: any, @Req() req: any) {
    const data = await this.agendaService.updateFotoUrutan(body, req.user, req);
    return { success: true, data };
  }

  @Delete('foto')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(AGENDA_KELOLA_KEY, 'OP_AGENDA')
  async deleteFoto(@Query('agenda_id') agendaId: string, @Query('url') url: string, @Req() req: any) {
    if (!agendaId || !url) throw new BadRequestException('agenda_id dan url wajib diisi');
    const data = await this.agendaService.deleteFoto(agendaId, url, req.user, req);
    return { success: true, data };
  }
}
