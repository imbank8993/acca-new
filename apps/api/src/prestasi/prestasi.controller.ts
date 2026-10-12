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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { PrestasiService } from './prestasi.service';

@ApiTags('Prestasi')
@ApiBearerAuth()
/**
 * Modul prestasi siswa. Sebelumnya sesi apa pun yang sah boleh menambah,
 * mengubah, dan menghapus catatan prestasi siapa pun.
 */
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('prestasi')
@Controller('prestasi')
export class PrestasiController {
  constructor(private readonly prestasiService: PrestasiService) {}

  @Get()
  async findAll(@Query() query: any, @Req() req: any) {
    return this.prestasiService.findAll(query, req?.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.prestasiService.findOne(id, req?.user);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    return this.prestasiService.create(body, req?.user);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.prestasiService.update(id, body, req?.user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.prestasiService.delete(id, req?.user);
  }
}
