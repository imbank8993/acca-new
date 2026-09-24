import { Controller, Get, Post, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { AnalisisBebanService } from './analisis-beban.service';

@ApiTags('Analisis Beban Kerja')
@ApiBearerAuth()
/**
 * Analisis beban mengajar. Tidak ada halaman yang memanggilnya dan belum ada
 * page_id `analisis-beban` di role_pages, jadi untuk sekarang efektif khusus
 * ADMIN — dan otomatis mengikuti begitu halamannya didaftarkan.
 */
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('analisis-beban')
@Controller('analisis-beban')
export class AnalisisBebanController {
  constructor(private readonly analisisBebanService: AnalisisBebanService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar Ploting Beban Kerja Guru' })
  async getAll(
    @Query('q') q?: string,
    @Query('tahun_ajaran') tahun_ajaran?: string,
    @Query('semester') semester?: string,
  ) {
    const data = await this.analisisBebanService.getAll({ q, tahun_ajaran, semester });
    return { ok: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Tambah atau Update Ploting Beban Kerja Guru' })
  async upsert(@Body() body: any) {
    const data = await this.analisisBebanService.upsert(body);
    return { ok: true, data };
  }

  @Delete()
  @ApiOperation({ summary: 'Hapus Ploting Beban Kerja Guru' })
  async delete(@Query('id') id: string) {
    return await this.analisisBebanService.delete(id);
  }
}
