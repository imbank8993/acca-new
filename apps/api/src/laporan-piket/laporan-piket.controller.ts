import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, UnauthorizedException, ForbiddenException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { LaporanPiketService } from './laporan-piket.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('laporan-piket')
@UseGuards(JwtAuthGuard)
export class LaporanPiketController {
  constructor(private readonly laporanPiketService: LaporanPiketService) {}

  private getApiUser(reqUser: any) {
    const roles: string[] = reqUser.role ? reqUser.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean) : [];
    
    const isReviewer = roles.some(r => ['ADMIN', 'ADMINISTRATOR', 'OP_JURNAL', 'OP JURNAL'].includes(r));
    const isInputter = isReviewer || roles.includes('GURU');
    const nip = reqUser.nip || '';
    
    return { nip, roles, isReviewer, isInputter };
  }

  @Get()
  async getLaporan(@Req() req: any, @Query() query: any) {
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const data = await this.laporanPiketService.getLaporan(limit);
    return { ok: true, data };
  }

  @Post()
  async createLaporan(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    if (!apiUser.isInputter) {
      throw new ForbiddenException('Anda tidak memiliki akses untuk membuat laporan piket');
    }

    const data = await this.laporanPiketService.createLaporan(apiUser, body);
    return { ok: true, data, message: 'Laporan berhasil disimpan' };
  }

  @Patch()
  async updateLaporan(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    if (!apiUser.isReviewer) {
      throw new ForbiddenException('Hanya ADMIN atau OP_JURNAL yang dapat mengedit laporan piket');
    }

    const data = await this.laporanPiketService.updateLaporan(body);
    return { ok: true, data };
  }

  @Delete()
  async deleteLaporan(@Req() req: any, @Query('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    if (!apiUser.isReviewer) {
      throw new ForbiddenException('Hanya ADMIN atau OP_JURNAL yang dapat menghapus laporan piket');
    }

    if (!id) {
      throw new BadRequestException('ID wajib diisi');
    }

    await this.laporanPiketService.deleteLaporan(id);
    return { ok: true };
  }
}
