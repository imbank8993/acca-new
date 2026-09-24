import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { KinerjaGuruService } from './kinerja-guru.service';

@ApiTags('Kinerja Guru')
@ApiBearerAuth()
/**
 * Rekap kinerja guru. Sebelumnya terbuka untuk sesi apa pun yang sah.
 */
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('kinerja-guru')
@Controller('kinerja-guru')
export class KinerjaGuruController {
  constructor(private readonly kinerjaGuruService: KinerjaGuruService) {}

  @Get()
  @ApiOperation({ summary: 'Statistik dan Metrik Kinerja Guru' })
  async getStats(
    @Query('start_month') start_month?: string,
    @Query('end_month') end_month?: string,
  ) {
    return await this.kinerjaGuruService.getStats(start_month, end_month);
  }
}
