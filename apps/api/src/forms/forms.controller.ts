import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  FeatureAccess,
  FeatureAccessGuard,
  PENGEMBANGAN_DIRI_ACCESS_KEY,
} from '../auth/feature-access.guard';
import { FormsService } from './forms.service';

@ApiTags('Forms')
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  /**
   * Rekap dan penghapusan respon survei Pengembangan Diri.
   *
   * Wewenangnya dipindah ke "Hak Akses Fitur" karena pengelolanya tidak bisa
   * ditanam di kode: maksud semula "admin atau operator" tidak punya role
   * operator yang cocok di basis data -- lihat PENGEMBANGAN_DIRI_ACCESS_KEY.
   * Tanpa baris site_settings, yang lolos hanya ADMIN, sama seperti sebelumnya.
   */
  @Get('pengembangan-diri')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(PENGEMBANGAN_DIRI_ACCESS_KEY)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rekap survei Pengembangan Diri (pengelola)' })
  async getPengembanganDiri(
    @Query('kelas') kelas?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.formsService.getPengembanganDiriSurvey(
      kelas,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Delete('pengembangan-diri')
  @UseGuards(JwtAuthGuard, FeatureAccessGuard)
  @FeatureAccess(PENGEMBANGAN_DIRI_ACCESS_KEY)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hapus respon survei Pengembangan Diri (pengelola)' })
  async deletePengembanganDiri(@Req() req: any, @Query('id') id: string) {
    if (req?.user?.role === 'SISWA' || (Array.isArray(req?.user?.roles) && req.user.roles.includes('SISWA') && !req.user.roles.includes('ADMIN'))) {
      throw new ForbiddenException('Akses ditolak');
    }
    return this.formsService.deletePengembanganDiriSurvey(id);
  }

  @Post('pengembangan-diri/submit')
  async submitPengembanganDiri(@Body() body: any, @Req() req: any) {
    return this.formsService.submitPengembanganDiriSurvey(body, req.headers || {});
  }

  @Get('public')
  @ApiOperation({ summary: 'Daftar form publik aktif' })
  async getPublicForms() {
    return this.formsService.getPublicForms();
  }

  @Get('dynamic-options')
  @ApiOperation({ summary: 'Ambil opsi dinamis untuk form' })
  async getDynamicOptions(@Query('source') source: string) {
    return this.formsService.getDynamicOptions(source || 'guru');
  }

  @Post('submit')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Kirim respon form (publik/privat)' })
  async submitResponse(@Body() body: any, @Req() req: any) {
    return this.formsService.submitResponse(body, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ambil semua form untuk dashboard' })
  async getForms(@Req() req: any) {
    return this.formsService.getForms(req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buat formulir baru' })
  async createForm(@Body() body: any, @Req() req: any) {
    return this.formsService.createForm(body, req.user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Ambil detail formulir berdasarkan ID atau slug' })
  async getFormById(@Param('id') id: string, @Req() req: any) {
    return this.formsService.getFormById(id, req.user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ubah formulir' })
  async updateForm(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.formsService.updateForm(id, body, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hapus formulir' })
  async deleteForm(@Param('id') id: string, @Req() req: any) {
    return this.formsService.deleteForm(id, req.user);
  }

  @Get(':id/responses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ambil daftar respon formulir' })
  async getResponses(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    return this.formsService.getResponses(id, query, req.user);
  }

  @Delete(':id/responses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hapus respon formulir (satu atau banyak)' })
  async deleteResponses(
    @Param('id') id: string,
    @Query('responseId') responseId: string,
    @Query('responseIds') responseIds: string,
    @Req() req: any,
  ) {
    const ids = [
      ...(responseId ? [responseId] : []),
      ...(responseIds || '').split(','),
    ]
      .map((s) => s.trim())
      .filter(Boolean);
    return this.formsService.deleteResponses(id, ids, req.user);
  }

  @Delete(':id/responses/:responseId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hapus respon formulir by ID' })
  async deleteResponse(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Req() req: any,
  ) {
    return this.formsService.deleteResponses(id, [responseId], req.user);
  }

  @Post(':id/allocate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Jalankan seleksi kuota respon formulir' })
  async allocate(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.formsService.allocate(id, body, req.user);
  }

  @Patch(':id/allocate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hitung ulang skor tanggapan formulir' })
  async recalculateScores(@Param('id') id: string, @Req() req: any) {
    return this.formsService.recalculateScores(id, req.user);
  }
}
