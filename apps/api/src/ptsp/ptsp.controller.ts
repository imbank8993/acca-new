import { Controller, Get, Post, Delete, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PtspService } from './ptsp.service';

@ApiTags('PTSP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ptsp')
export class PtspController {
  constructor(private readonly ptspService: PtspService) {}

  @Get()
  @ApiOperation({ summary: 'Ambil data tabel PTSP dengan paginasi dan filter pencarian' })
  async getTable(
    @Request() req: any,
    @Query('table') table: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const roles = req.user?.roles || (req.user?.role ? String(req.user.role).split(/[,|]/).map((r: string) => r.trim().toUpperCase()) : []);
    const isPtspOrAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || roles.includes('PTSP') || roles.includes('OP_LAYANAN');
    
    if (!isPtspOrAdmin) {
      throw new (require('@nestjs/common').ForbiddenException)('Anda tidak berhak mengakses layanan PTSP');
    }

    const pageNum = parseInt(page || '1', 10);
    const sizeNum = parseInt(pageSize || '20', 10);
    return await this.ptspService.getTableData(table, pageNum, sizeNum, search || '');
  }

  @Post()
  @ApiOperation({ summary: 'Update data status dan catatan admin PTSP' })
  async updateTable(@Request() req: any, @Body() body: any) {
    const { table, id, data } = body;
    return await this.ptspService.updateTableData(req.user, table, id, data);
  }

  @Delete()
  @ApiOperation({ summary: 'Hapus data PTSP' })
  async deleteTable(
    @Request() req: any,
    @Query('table') table: string,
    @Query('id') id: string,
  ) {
    return await this.ptspService.deleteTableData(req.user, table, id);
  }

  @Get('notify-wa')
  @ApiOperation({ summary: 'Cron process ptsp_wa_log queue' })
  async notifyWa(@Query('limit') limit?: string) {
    const limitNum = parseInt(limit || '50', 10);
    return await this.ptspService.notifyWa(limitNum);
  }
}

