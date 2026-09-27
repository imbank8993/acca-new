import { Controller, Get, Post, Put, Query, Body, Request, UseGuards, Res, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BankDataService } from './bank-data.service';

@ApiTags('Bank Data')
@Controller('bank-data')
export class BankDataController {
  constructor(private readonly service: BankDataService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Katalog Bank Data' })
  async getCatalog(@Request() req: any) {
    return this.service.getCatalog(req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Preview & Export Bank Data' })
  async handlePost(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: any) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.headers?.['x-real-ip'] || req.ip || req.socket?.remoteAddress || '');
    const result = await this.service.handlePost(body, req.user, clientIp);
    
    // Check if result is a buffer or stream (we'll just use StreamableFile)
    if (result && (result instanceof StreamableFile || result.constructor?.name === 'StreamableFile')) {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${body.dataset_id || 'export'}.xlsx"`,
      });
    }
    return result;
  }


  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Konfigurasi dataset Bank Data' })
  async getConfig(@Request() req: any) {
    return this.service.getConfig(req.user);
  }

  @Put('config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update konfigurasi dataset Bank Data' })
  async updateConfig(@Request() req: any, @Body() body: any) {
    return this.service.updateConfig(body, req.user);
  }

  @Get('log')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Riwayat ekspor Bank Data' })
  async getLogs(
    @Request() req: any,
    @Query('halaman') halaman?: string,
    @Query('dataset') dataset?: string,
  ) {
    const page = parseInt(halaman || '1', 10);
    return this.service.getLogs(req.user, page, 50, dataset);
  }
}
