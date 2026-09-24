import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards, UnauthorizedException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CatatanSiswaService } from './catatan-siswa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('catatan-siswa')
@UseGuards(JwtAuthGuard)
export class CatatanSiswaController {
  constructor(private readonly catatanSiswaService: CatatanSiswaService) {}

  private getApiUser(reqUser: any) {
    const roles: string[] = reqUser.role ? reqUser.role.split(',').map((r: string) => r.trim().toUpperCase()) : [];
    const isAdmin = roles.includes('ADMIN');
    const isPrivileged = isAdmin || roles.includes('OP_JURNAL');
    const nip = reqUser.nip || reqUser.username || '';
    const authId = reqUser.auth_id;
    return { nip, roles, isAdmin, isPrivileged, authId, id: reqUser.id };
  }

  @Get()
  async getCatatanSiswa(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    const { sesi_id, kelas, tanggal_from, tanggal_to, jenis, status, nisn, q, pelapor, semester, tahun_ajaran, page, limit } = query;

    const result = await this.catatanSiswaService.getCatatan(apiUser, {
      sesi_id, kelas, tanggal_from, tanggal_to, jenis, status, nisn, q, pelapor, semester, tahun_ajaran, page, limit
    });

    return { ok: true, data: result.data, meta: result.meta };
  }

  @Post()
  async createCatatanSiswa(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const { sesi_id, nisn, nama_snapshot, jenis, catatan } = body;

    if (!sesi_id || !nisn || !nama_snapshot) {
      throw new BadRequestException('sesi_id, nisn, dan nama_snapshot wajib diisi');
    }
    if (jenis !== 'POSITIF' && jenis !== 'NEGATIF') {
      throw new BadRequestException("jenis wajib 'POSITIF' atau 'NEGATIF'");
    }
    if (!catatan || typeof catatan !== 'string' || !catatan.trim()) {
      throw new BadRequestException('catatan wajib diisi');
    }

    const data = await this.catatanSiswaService.createCatatan(apiUser, body);
    return { ok: true, data };
  }

  @Patch(':id')
  @Put(':id')
  async updateCatatanSiswa(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const { jenis, catatan } = body;

    if (jenis !== undefined && jenis !== 'POSITIF' && jenis !== 'NEGATIF') {
      throw new BadRequestException("jenis wajib 'POSITIF' atau 'NEGATIF'");
    }
    if (catatan !== undefined && (typeof catatan !== 'string' || !catatan.trim())) {
      throw new BadRequestException('catatan tidak boleh kosong');
    }

    const data = await this.catatanSiswaService.updateCatatan(apiUser, id, { jenis, catatan });
    return { ok: true, data };
  }

  @Delete(':id')
  async deleteCatatanSiswa(@Req() req: any, @Param('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    await this.catatanSiswaService.deleteCatatan(apiUser, id);
    return { ok: true };
  }

  @Post(':id/tindak-lanjut')
  async tindakLanjut(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const { catatan, status_baru } = body;

    if (!catatan || typeof catatan !== 'string' || !catatan.trim()) {
      throw new BadRequestException('catatan tindak lanjut wajib diisi');
    }
    if (status_baru !== 'DITINDAKLANJUTI' && status_baru !== 'SELESAI') {
      throw new BadRequestException("status_baru wajib 'DITINDAKLANJUTI' atau 'SELESAI'");
    }

    const data = await this.catatanSiswaService.tindakLanjut(apiUser, id, body);
    return { ok: true, data };
  }
}
