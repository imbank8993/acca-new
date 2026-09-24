import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { JurnalService } from './jurnal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  FeatureAccess,
  FeatureAccessGuard,
  JURNAL_ACCESS_KEY,
  JURNAL_INPUT_ACCESS_KEY,
  JURNAL_REVIEW_BANDING_ACCESS_KEY,
  JURNAL_GENERATE_ACCESS_KEY,
} from '../auth/feature-access.guard';

@Controller('jurnal')
@UseGuards(JwtAuthGuard)
export class JurnalController {
  constructor(private readonly jurnalService: JurnalService) {}

  // --- Pengaturan ---
  @Get('pengaturan')
  async getSettings() {
    const data = await this.jurnalService.getSettings();
    return { ok: true, success: true, data };
  }

  @Post('pengaturan')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess([JURNAL_GENERATE_ACCESS_KEY, JURNAL_ACCESS_KEY], 'OP_JURNAL')
  async updateSettings(@Req() req: any, @Body() body: any) {
    const data = await this.jurnalService.updateSettings(body, req.user);
    return { ok: true, success: true, data, message: 'Berhasil menyimpan pengaturan' };
  }


  @Post('pengaturan/generate-massal')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess([JURNAL_GENERATE_ACCESS_KEY, JURNAL_ACCESS_KEY], 'OP_JURNAL')
  async generateMassal(@Req() req: any, @Body() body: any) {
    const { startDate, endDate, jamKe } = body;
    if (!startDate) {
      throw new BadRequestException('startDate wajib diisi');
    }
    const end = endDate || startDate;
    let jamKeFilter: number[] = [];
    if (jamKe && typeof jamKe === 'string' && jamKe.trim() !== '') {
      jamKeFilter = jamKe.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    }

    const results = await this.jurnalService.generateMassal(req.user, startDate, end, jamKeFilter);
    return {
      success: true,
      message: 'Generate jurnal selesai',
      results,
      errors: results.errors.length > 0 ? results.errors : undefined,
    };
  }

  @Delete('pengaturan/delete-by-date')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess([JURNAL_GENERATE_ACCESS_KEY, JURNAL_ACCESS_KEY], 'OP_JURNAL')
  async deleteByDate(@Req() req: any, @Body() body: any) {
    const { startDate, endDate, jamKe } = body;
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate dan endDate wajib diisi');
    }
    let jamKeFilter: number[] = [];
    if (jamKe && typeof jamKe === 'string' && jamKe.trim() !== '') {
      jamKeFilter = jamKe.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    }

    // `termasuk_terisi` harus diminta dengan sadar; tanpa itu hanya kerangka
    // kosong yang dibuang. Lihat JurnalService.deleteByDate.
    const termasukTerisi = body.termasuk_terisi === true || body.termasuk_terisi === 'true';
    const hasil = await this.jurnalService.deleteByDate(
      startDate, endDate, req.user, jamKeFilter, termasukTerisi,
    );

    const pesan = hasil.terisi_dilewati > 0
      ? `${hasil.dihapus} jurnal kosong dihapus. ${hasil.terisi_dilewati} jurnal yang sudah terisi DILEWATI — centang "termasuk yang sudah terisi" bila memang ingin ikut dihapus.`
      : `${hasil.dihapus} jurnal berhasil dihapus`;

    return {
      success: true,
      message: pesan,
      deleted_count: hasil.dihapus,
      ...hasil,
    };
  }

  /**
   * Isi satu slot jurnal — jalur halaman Input Jurnal.
   *
   * Dipisahkan dari `POST /jurnal` (yang membuat baris bebas dan khusus
   * pengelola) karena ini operasi yang berbeda: mengisi slot yang sudah ada,
   * dengan aturan penggabungan antara isian guru dan isian pengurus kelas.
   */
  @Post('submit')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess([JURNAL_INPUT_ACCESS_KEY, JURNAL_ACCESS_KEY], 'PENGURUS_KELAS')
  async submitJurnal(@Req() req: any, @Body() body: any) {
    return this.jurnalService.submitJurnal(req.user, body);
  }

  // --- Check Slot & Rekap ---
  @Get('check-slot')
  async checkSlot(@Req() req: any, @Query() query: any) {
    return this.jurnalService.checkSlot(req.user, query);
  }

  @Get('rekap')
  async getRekap(@Req() req: any, @Query() query: any) {
    return this.jurnalService.getRekap(req.user, query);
  }

  // --- Banding Jurnal ---
  @Get('banding')
  async getBanding(@Req() req: any, @Query() query: any) {
    return this.jurnalService.getBanding(req.user, query);
  }

  @Post('banding')
  async createBanding(@Req() req: any, @Body() body: any) {
    return this.jurnalService.createBanding(req.user, body);
  }

  @Get('banding/:id')
  async getBandingById(@Req() req: any, @Param('id') id: string) {
    return this.jurnalService.getBandingById(req.user, parseInt(id, 10));
  }

  @Patch('banding/:id')
  @UseGuards(FeatureAccessGuard)
  @FeatureAccess([JURNAL_REVIEW_BANDING_ACCESS_KEY, JURNAL_ACCESS_KEY], 'OP_JURNAL')
  async updateBanding(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.jurnalService.updateBanding(req.user, parseInt(id, 10), body);
  }

  @Delete('banding/:id')
  async deleteBanding(@Req() req: any, @Param('id') id: string) {
    return this.jurnalService.deleteBanding(req.user, parseInt(id, 10));
  }


  // --- Main CRUD Jurnal ---
  @Get('jurnal-master')
  async getJurnalMaster(@Req() req: any, @Query() query: any) {
    return this.jurnalService.getJurnalMaster(req.user, query);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.jurnalService.findById(req.user, id);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.jurnalService.update(req.user, id, body);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.jurnalService.remove(req.user, id);
  }

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    return this.jurnalService.findAll(req.user, query);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.jurnalService.create(req.user, body);
  }
}

