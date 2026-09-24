import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { SuratService } from './surat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Surat Templates')
@Controller('surat/templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuratController {
  constructor(
    private suratService: SuratService,
    private accessService: AccessService,
  ) {}

  @Get()
  async getTemplates() {
    const data = await this.suratService.getTemplates();
    return { ok: true, data };
  }

  @Get('urls')
  async getTemplateUrls() {
    return this.suratService.getTemplateUrls();
  }

  @Get(':id')
  async getTemplateById(@Param('id') id: string) {
    const data = await this.suratService.getTemplateById(id);
    if (data.template_html?.startsWith('http')) {
      return { ok: true, data: { ...data, url: data.template_html } };
    }
    return { ok: true, data };
  }

  @Post()
  async createTemplate(@Request() req: any, @Body() body: any) {
    const authId = req.user.id;
    const access = await this.accessService.resolveUserAccess(req.user);
    const isAdmin = access.roles.some(
      (r: string) =>
        r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'ADMINISTRATOR',
    );
    if (!isAdmin) {
      throw new ForbiddenException('Hanya admin yang bisa upload template');
    }

    const { jenis_surat, template_html, nama_template } = body;
    if (!jenis_surat) {
      return { ok: false, error: 'jenis_surat diperlukan' };
    }

    const result = await this.suratService.createOrUpdateTemplate({
      jenis_surat,
      template_html: template_html || '',
      nama_template: nama_template || jenis_surat,
      created_by: authId,
    });

    return { ok: true, data: result.template, old_html: result.old_html };
  }

  @Put(':id')
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const access = await this.accessService.resolveUserAccess(req.user);
    const isAdmin = access.roles.some(
      (r: string) =>
        r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'ADMINISTRATOR',
    );
    if (!isAdmin) {
      throw new ForbiddenException('Unauthorized');
    }

    const updateData: any = {};
    if (body.nama_template !== undefined)
      updateData.nama_template = body.nama_template;
    if (body.jenis_surat !== undefined)
      updateData.jenis_surat = body.jenis_surat;
    if (body.template_html !== undefined)
      updateData.template_html = body.template_html;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const data = await this.suratService.updateTemplate(id, updateData);
    return { ok: true, data };
  }

  @Delete(':id')
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    const access = await this.accessService.resolveUserAccess(req.user);
    const isAdmin = access.roles.some(
      (r: string) =>
        r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'ADMINISTRATOR',
    );
    if (!isAdmin) {
      throw new ForbiddenException('Unauthorized');
    }

    const deleted = await this.suratService.softDeleteTemplate(id);
    return { ok: true, old_html: deleted.template_html };
  }
}

@ApiTags('Surat Records')
@Controller('surat')
export class SuratRecordController {
  constructor(private suratService: SuratService) {}

  @Get('dropdown/jenis-surat')
  @ApiOperation({ summary: 'Dropdown pilihan jenis surat' })
  async getJenisSuratDropdown() {
    return this.suratService.getJenisSuratDropdown();
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verifikasi publik keabsahan QR code surat' })
  async verifySurat(@Query('letter_id') letterId: string) {
    return this.suratService.verifySurat(letterId);
  }

  @Get('by-nomor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cari surat berdasarkan nomor surat' })
  async getSuratByNomor(@Query('nomor') nomor: string) {
    return this.suratService.getSuratByNomor(nomor);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cari surat (dropdown/autocomplete)' })
  async searchSurat(@Query('q') q: string, @Query('limit') limit: string) {
    return this.suratService.searchSurat(q, limit ? parseInt(limit) : 10);
  }

  @Get('generate-number')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate nomor surat baru' })
  async generateNumber(@Query() query: any) {
    return this.suratService.generateNumber(query);
  }

  @Post('generate-number')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate / reserve nomor surat baru' })
  async generateNumberPost(@Body() body: any) {
    return this.suratService.generateNumber(body);
  }

  @Get('guru')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Daftar surat terkait guru atau list guru' })
  async getGuru(@Query() query: any) {
    return this.suratService.getGuru(query);
  }

  @Get('siswa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Daftar siswa untuk persuratan' })
  async getSiswa(@Query() query: any) {
    return this.suratService.getSiswa(query);
  }

  @Get('items')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Daftar semua arsip surat' })
  async getAllSurat(@Query() query: any) {
    return this.suratService.getAllSurat(query);
  }

  @Get('items/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detail arsip surat' })
  async getSuratById(@Param('id') id: string) {
    return this.suratService.getSuratById(id);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buat arsip surat baru (Draft/Final)' })
  async createSurat(@Body() body: any, @Request() req: any) {
    return this.suratService.createSurat(body, req.user);
  }

  @Put('items/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perbarui arsip surat' })
  async updateSurat(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.suratService.updateSurat(id, body, req.user);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hapus arsip surat' })
  async deleteSurat(@Param('id') id: string, @Request() req: any) {
    return this.suratService.deleteSurat(id, req.user);
  }

  // ── Permintaan Surat ────────────────────────────────────────

  @Get('permintaan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Daftar permohonan surat' })
  async getPermintaanList(@Query() query: any) {
    return this.suratService.getPermintaanList(query);
  }

  @Get('permintaan/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detail permohonan surat' })
  async getPermintaanById(@Param('id') id: string) {
    return this.suratService.getPermintaanById(id);
  }

  @Post('permintaan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajukan permohonan surat baru' })
  async createPermintaan(@Body() body: any, @Request() req: any) {
    return this.suratService.createPermintaan(body, req.user);
  }

  @Put('permintaan/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ubah / tinjau permohonan surat' })
  async updatePermintaan(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.suratService.updatePermintaan(id, body, req.user);
  }

  @Delete('permintaan/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Batalkan permohonan surat' })
  async deletePermintaan(@Param('id') id: string, @Request() req: any) {
    return this.suratService.deletePermintaan(id, req.user);
  }

  // ── Konfigurasi Surat ───────────────────────────────────────

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ambil konfigurasi surat' })
  async getConfigSurat(@Query('profil_id') profilId?: string) {
    return this.suratService.getConfigSurat(profilId);
  }

  @Post('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simpan konfigurasi surat' })
  async saveConfigSurat(@Body() body: any) {
    return this.suratService.saveConfigSurat(body);
  }

  @Put('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update konfigurasi surat' })
  async updateConfigSurat(@Body() body: any) {
    return this.suratService.saveConfigSurat(body);
  }

  @Post('generate-pdf-data')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Data pendukung untuk pdf generation' })
  async getSuratForPdf(@Body('surat_id') suratId?: string) {
    return this.suratService.getSuratForPdf(suratId);
  }
}

