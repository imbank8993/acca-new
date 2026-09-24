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
import { ObservasiKelasService } from './observasi-kelas.service';

@ApiTags('Observasi Kelas')
@ApiBearerAuth()
/**
 * Catatan observasi kelas. Sebelumnya bisa dibaca dan ditulis sesi apa pun
 * yang sah, padahal menunya hanya untuk ADMIN dan PENGAWAS_MADRASAH.
 */
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('observasi-kelas')
@Controller('observasi-kelas')
export class ObservasiKelasController {
  constructor(private readonly observasiKelasService: ObservasiKelasService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.observasiKelasService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.observasiKelasService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.observasiKelasService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.observasiKelasService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.observasiKelasService.delete(id);
  }
}
