import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { IzinGuruService } from './izin-guru.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PegawaiGuard } from '../auth/pegawai.guard';
import { rolesUser } from '../auth/feature-access.guard';

/**
 * Izin Guru.
 *
 * `PegawaiGuard` dipasang di tingkat kelas karena modul ini memang urusan
 * kepegawaian. Sebelumnya gerbangnya hanya `JwtAuthGuard`, sehingga SETIAP akun
 * yang login bisa memanggil semuanya — dan `createIzin` tidak memeriksa peran
 * sama sekali. Terbukti: akun siswa berhasil membuat pengajuan izin guru, dengan
 * NISN-nya masuk ke kolom `nip` karena kolom itu memang dipakai ganda.
 *
 * Wewenang di dalam halaman (mengelola pengajuan orang lain, menyetujui Izin &
 * Sakit, memverifikasi Dinas Luar) tidak lagi dihardcode di sini. Ketiganya
 * dibaca dari Hak Akses Fitur di `IzinGuruService.aksesIzin`, jadi hanya ADMIN
 * yang melekat di kode.
 */
@Controller('izin-guru')
@UseGuards(JwtAuthGuard, PegawaiGuard)
export class IzinGuruController {
  constructor(private readonly izinGuruService: IzinGuruService) {}

  /**
   * Identitas pemanggil — tanpa bendera wewenang.
   *
   * Dulu di sini juga dirakit `isAdmin`, `isOpIzinGuru`, `isKamad`, dan
   * `isFullAccess`. Semuanya sudah pindah ke Hak Akses Fitur; yang tersisa hanya
   * keterangan tentang SIAPA pemanggilnya.
   *
   * `rolesUser` membaca `roles` hasil JwtStrategy lebih dulu, baru jatuh ke kolom
   * mentah `role`. Versi sebelumnya hanya membaca kolom mentah, sehingga duty
   * role dihormati frontend (yang memang membaca `roles`) tapi diabaikan API.
   */
  private getApiUser(reqUser: any) {
    return {
      id: reqUser?.id,
      auth_id: reqUser?.auth_id,
      nip: reqUser?.nip || '',
      roles: rolesUser(reqUser),
      nama: reqUser?.nama || '',
      nama_lengkap: reqUser?.nama_lengkap || reqUser?.nama || '',
    };
  }

  @Get()
  async getIzinGuru(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    const [data, akses] = await Promise.all([
      this.izinGuruService.getIzin(apiUser, query),
      this.izinGuruService.aksesIzin(apiUser),
    ]);
    // `akses` ikut dikirim supaya tombol di layar bersumber dari wewenang yang
    // sama dengan yang ditegakkan API. Sebelumnya frontend menghitung sendiri
    // dari daftar peran, jadi keduanya bisa menyimpang.
    return { ok: true, data, akses };
  }

  @Post()
  async createIzinGuru(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.izinGuruService.createIzin(apiUser, body);
    return { ok: true, data };
  }

  @Patch(':id')
  async updateIzinGuru(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.izinGuruService.updateIzin(apiUser, id, body);
    return { ok: true, data };
  }

  @Delete(':id')
  async deleteIzinGuru(@Req() req: any, @Param('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    await this.izinGuruService.deleteIzin(apiUser, id);
    return { ok: true };
  }
}
