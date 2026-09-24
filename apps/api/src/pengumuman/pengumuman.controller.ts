import { Controller, Get, Post, Put, Delete, Body, Query, Req, UseGuards, Param, UnauthorizedException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PengumumanService } from './pengumuman.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  FeatureAccess,
  FeatureAccessGuard,
  PENGUMUMAN_KELOLA_KEY,
  ROLE_ADMIN,
  rolesUser,
} from '../auth/feature-access.guard';

@Controller('pengumuman')
@UseGuards(JwtAuthGuard, FeatureAccessGuard)
export class PengumumanController {
  constructor(private readonly pengumumanService: PengumumanService) {}

  /** Hak pemanggil atas kelola pengumuman, agar UI tidak perlu menebak sendiri. */
  @Get('izin-saya')
  async getIzinSaya(@Req() req: any) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Invalid token');
    const boleh = await this.pengumumanService.bolehKelola(user);
    return { ok: true, data: { bolehKelola: boleh } };
  }

  @Get()
  async getPengumuman(
    @Req() req: any,
    @Query('role') requestedRole?: string,
    @Query('manage') manage?: string,
  ) {
    try {
      const user = req.user;
      if (!user) throw new UnauthorizedException('Invalid token');

      const roleParts = rolesUser(user);
      const isAdmin = roleParts.some(r => ROLE_ADMIN.includes(r) || r === 'OP_PENGUMUMAN');
      const bolehKelola = isAdmin || (await this.pengumumanService.bolehKelola(user));

      // Mode kelola: pengelola melihat SELURUH pengumuman tanpa disaring target role
      if (manage === 'true') {
        if (!bolehKelola) {
          throw new ForbiddenException('Akses ditolak. Anda tidak memiliki izin kelola pengumuman.');
        }
        return await this.pengumumanService.getAllPengumumanForManage();
      }

      let filterRoles = roleParts;

      if (requestedRole) {
        // Mendukung role jamak dipisahkan koma atau pipe, mis. ?role=GURU,WKM_AKADEMIK
        const requested = requestedRole.split(/[,|]/).map(r => r.trim().toUpperCase()).filter(Boolean);

        if (bolehKelola) {
          // Admin / Pengelola diizinkan memfilter ke target role apapun (untuk preview/audit tampilan peran tertentu)
          filterRoles = requested;
        } else {
          // Pengguna biasa: cegah Broken Access Control / Role Tampering.
          // Role yang diminta HARUS merupakan subset dari role yang benar-benar dimiliki pengguna.
          const unauthorized = requested.filter(r => !roleParts.includes(r));
          if (unauthorized.length > 0) {
            throw new ForbiddenException(
              `Akses ditolak. Anda tidak memiliki izin untuk melihat pengumuman dengan peran: ${unauthorized.join(', ')}`,
            );
          }
          filterRoles = requested.length > 0 ? requested : roleParts;
        }
      } else if (bolehKelola) {
        // Jika pengelola/admin dan tidak meminta filter role tertentu, tampilkan semua pengumuman
        return await this.pengumumanService.getAllPengumumanForManage();
      }

      return await this.pengumumanService.getPengumumanMultipleRoles(filterRoles);
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        return { ok: true, data: [] as any[], table_missing: true };
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post()
  @FeatureAccess(PENGUMUMAN_KELOLA_KEY, 'OP_PENGUMUMAN')
  async createPengumuman(@Req() req: any, @Body() body: any) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Invalid token');
    return this.pengumumanService.createPengumuman(user, body);
  }

  @Put(':id')
  @FeatureAccess(PENGUMUMAN_KELOLA_KEY, 'OP_PENGUMUMAN')
  async updatePengumuman(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Invalid token');
    return this.pengumumanService.updatePengumuman(id, body);
  }

  @Delete(':id')
  @FeatureAccess(PENGUMUMAN_KELOLA_KEY, 'OP_PENGUMUMAN')
  async deletePengumuman(@Req() req: any, @Param('id') id: string) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Invalid token');
    return this.pengumumanService.deletePengumuman(id, user, req);
  }
}

