import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AbsensiService } from './absensi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PegawaiGuard } from '../auth/pegawai.guard';
import { rolesUser } from '../auth/feature-access.guard';

/**
 * Absensi PBM.
 *
 * `PegawaiGuard` dipasang di tingkat kelas: modul ini urusan guru dan pengelola
 * absensi. Sebelumnya gerbangnya hanya `JwtAuthGuard`, dan seluruh otorisasi di
 * dalamnya praktis tidak ada — beberapa handler bahkan tidak menerima identitas
 * pemanggil sama sekali. Akibatnya akun siswa dapat membaca seluruh sesi,
 * mengubah kehadiran siswa lain, membuat sesi atas nama guru lain, serta
 * menghapus sesi beserta catatan kehadirannya.
 *
 * Tidak ada halaman siswa yang memakai endpoint ini — layar "Kehadiran Siswa"
 * mengambil datanya dari modul ketidakhadiran — jadi pembatasan ini tidak
 * memutus fitur mana pun milik siswa dan orang tua.
 */
@Controller('absensi')
@UseGuards(JwtAuthGuard, PegawaiGuard)
export class AbsensiController {
  constructor(private readonly absensiService: AbsensiService) {}

  private getApiUser(reqUser: any) {
    // `rolesUser` membaca `roles` hasil JwtStrategy lebih dulu, baru jatuh ke
    // kolom mentah `role`. Versi sebelumnya hanya membaca kolom mentah, sehingga
    // duty role seperti WALI_KELAS — yang justru menentukan wewenang di modul
    // ini — tidak pernah terbaca.
    const roles: string[] = rolesUser(reqUser);
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const nip = reqUser.nip || '';
    const authId = reqUser.auth_id;
    const nama_lengkap = reqUser.nama_lengkap || reqUser.nama || '';
    const nama = reqUser.nama || '';

    return { nip, roles, isAdmin, authId, id: reqUser.id, nama_lengkap, nama };
  }

  // Sesi endpoints
  @Get('sesi')
  async getSesi(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    const result = await this.absensiService.getSesi(apiUser, query);
    return { ok: true, data: result.data, metadata: result.metadata };
  }


  @Get('sesi/:id')
  async getSesiById(@Req() req: any, @Param('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.absensiService.getSesiById(apiUser, id);
    return { ok: true, data };
  }

  @Post('sesi')
  async createSesi(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.absensiService.createSesi(apiUser, body);
    return { ok: true, data };
  }

  @Patch('sesi/:id')
  async updateSesi(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.absensiService.updateSesi(apiUser, id, body);
    return { ok: true, data };
  }

  @Delete('sesi/:id')
  async deleteSesi(@Req() req: any, @Param('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.absensiService.deleteSesi(apiUser, id);
    return { ok: true, data };
  }

  // Detail endpoints
  @Get('detail')
  async getDetail(@Req() req: any, @Query('sesi_id') sesi_id: string) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.absensiService.getDetail(apiUser, sesi_id);
    return { ok: true, data };
  }

  @Post('detail')
  async saveDetail(@Req() req: any, @Body() body: { sesi_id: string; items?: any[]; details?: any[] }) {
    const apiUser = this.getApiUser(req.user);
    const items = Array.isArray(body.items) ? body.items : (Array.isArray(body.details) ? body.details : []);
    const data = await this.absensiService.upsertDetail(apiUser, body.sesi_id, items);
    return { ok: true, data };
  }

  /**
   * Kelas yang diampu seorang guru.
   *
   * `?nip=` hanya dihormati untuk pengelola absensi. Sebelumnya
   * `query.nip || apiUser.nip` membuat siapa pun bisa menelusuri kelas guru lain
   * hanya dengan menebak NIP di query string.
   */
  @Get('classes')
  async getTeacherClasses(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    const nip = (await this.absensiService.bolehKelolaPublik(apiUser)) && query.nip
      ? query.nip
      : apiUser.nip;
    const tahunAjaran = query.tahun_ajaran;
    const data = await this.absensiService.getTeacherClasses(nip, tahunAjaran);
    return { ok: true, data };
  }

  @Post('export')
  async exportAbsensi(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    return this.absensiService.exportAbsensi(apiUser, body);
  }
}

