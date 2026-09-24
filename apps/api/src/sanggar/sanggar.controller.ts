import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { SanggarService } from './sanggar.service';

/**
 * Guard dipasang di tingkat kelas, bukan per method.
 *
 * Sebelumnya 9 route hanya punya 4 guard: daftar pendaftaran, detail per id,
 * dan bahkan `POST /sanggar` (membuat pendaftaran) berjalan tanpa autentikasi
 * apa pun — tidak ada guard autentikasi global yang menutupinya. Sisanya boleh
 * ditulis sesi apa pun yang sah, termasuk `POST /sanggar/broadcast` yang
 * menyiarkan WhatsApp.
 *
 * Halaman sanggar-kurikulum adalah satu-satunya pemakai modul ini, jadi
 * gerbangnya aman dipasang menyeluruh. Route yang diproksikan dengan kunci
 * internal (`kuota`, `check`) tetap lewat — lihat catatan di PageAccessGuard.
 */
@ApiTags('Sanggar')
@Controller('sanggar')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('sanggar-kurikulum')
export class SanggarController {
  constructor(private readonly sanggarService: SanggarService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.sanggarService.findAll(query);
  }

  @Get('check')
  async check(@Query('nip') nip?: string, @Query('nama') nama?: string) {
    return this.sanggarService.check(nip, nama);
  }

  @Get('kuota')
  async getKuota() {
    return this.sanggarService.getKuota();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sanggarService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.sanggarService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Param('id') id: string, @Body() body: any) {
    return this.sanggarService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async delete(@Param('id') id: string) {
    return this.sanggarService.delete(id);
  }

  @Get('broadcast/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getBroadcastConfig() {
    return this.sanggarService.getBroadcastConfig();
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async postBroadcast(@Body() body: any) {
    return this.sanggarService.postBroadcast(body);
  }
}

