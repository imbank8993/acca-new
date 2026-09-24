import { Body, Controller, Delete, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  FeatureAccess,
  FeatureAccessGuard,
  PENGATURAN_TUGAS_ACCESS_KEYS,
  aksesDiizinkan,
  parseKonfigurasiAkses,
} from '../auth/feature-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { TugasTambahanService } from './tugas-tambahan.service';

/**
 * Berbeda dari modul lain, gerbang di sini dipasang per METHOD, hanya pada
 * operasi tulis.
 *
 * Bacanya dikonsumsi lintas halaman — ketidakhadiran (PrintModal), kokurikuler,
 * lckh-approval, pengaturan-tugas, dan tugas-tambahan sendiri — sehingga
 * mengunci seluruh controller ke satu wewenang akan memutus pemakai yang sah.
 *
 * Tulisnya dipisah menjadi DUA wewenang yang berbeda, karena dua hal berbeda:
 *
 *   1. PENUGASAN (`POST`/`DELETE /tugas-tambahan`) — milik pengelola tab "Tugas
 *      Tambahan" di halaman Pengaturan Tugas. Tabel ini menentukan role tugas:
 *      `granted_role` dibaca `AccessService.getDutyRoles` dan digabungkan ke
 *      `roles` di JwtStrategy, jadi menulis di sini BERARTI memberi atau mencabut
 *      role (WALI_KELAS, PEMBINA_EKSKUL).
 *
 *      Sebelumnya gerbangnya `@RequiresPage('tugas-tambahan', 'pengaturan-tugas')`,
 *      yaitu tabel `role_pages` yang mengatur NAVIGASI. Role GURU dan TAMU
 *      memegang halaman `tugas-tambahan` di sana, sehingga setiap akun guru — dan
 *      setiap akun tamu — bisa mengirim `jabatan: 'Wali Kelas ...'` dengan NIP-nya
 *      sendiri lalu menjadi WALI_KELAS pada login berikutnya, atau menghapus
 *      penugasan orang lain beserta rolenya.
 *
 *   2. JURNAL (`POST`/`DELETE /tugas-tambahan/jurnal`) — catatan harian pemegang
 *      tugas, jadi tetap terbuka untuk guru sendiri. Yang ditambahkan adalah
 *      pemeriksaan KEPEMILIKAN per baris di service: `nip` tidak lagi dipercaya
 *      dari badan permintaan, dan jurnal milik orang lain tidak bisa dihapus.
 */
@ApiTags('Tugas Tambahan')
@ApiBearerAuth()
// `PageAccessGuard` dilepas: setelah `@RequiresPage` diganti Hak Akses Fitur,
// tidak ada lagi method yang memberinya metadata, dan guard tanpa metadata selalu
// meloloskan — jadi ia hanya tersisa sebagai hiasan yang menyesatkan pembaca.
@UseGuards(JwtAuthGuard, FeatureAccessGuard)
@Controller('tugas-tambahan')
export class TugasTambahanController {
  constructor(
    private readonly tugasTambahanService: TugasTambahanService,
    private readonly accessService: AccessService,
    private readonly prisma: PrismaService,
  ) {}

  /** Pengelola tab "Tugas Tambahan" — dipakai jalur jurnal yang punya dua perilaku. */
  private async bolehKelola(req: any): Promise<boolean> {
    const [access, row] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.prisma.site_settings.findUnique({
        where: { key: PENGATURAN_TUGAS_ACCESS_KEYS.ploting_tugas },
        select: { value: true },
      }),
    ]);
    return aksesDiizinkan(
      { ...req.user, roles: access.roles },
      parseKonfigurasiAkses(row?.value),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Daftar Tugas Tambahan' })
  async getTugasTambahan(
    @Query('nip') nip?: string,
    @Query('nama_guru') nama_guru?: string,
    @Query('tahun_ajaran') tahun_ajaran?: string,
    @Query('semester') semester?: string,
  ) {
    const data = await this.tugasTambahanService.getTugasTambahan({ nip, nama_guru, tahun_ajaran, semester });
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Post()
  @FeatureAccess(PENGATURAN_TUGAS_ACCESS_KEYS.ploting_tugas)
  @ApiOperation({ summary: 'Tambah atau Ubah Tugas Tambahan (pengelola)' })
  async upsertTugasTambahan(@Body() body: any) {
    const data = await this.tugasTambahanService.upsertTugasTambahan(body);
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Delete()
  @FeatureAccess(PENGATURAN_TUGAS_ACCESS_KEYS.ploting_tugas)
  @ApiOperation({ summary: 'Hapus Tugas Tambahan (pengelola)' })
  async deleteTugasTambahan(@Query('id') id: string) {
    return await this.tugasTambahanService.deleteTugasTambahan(id);
  }

  // --- Jurnal ---

  @Get('jurnal')
  @ApiOperation({ summary: 'Daftar Jurnal Tugas Tambahan' })
  async getJurnal(
    @Query('tugas_id') tugas_id?: string,
    @Query('nip') nip?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.tugasTambahanService.getJurnalTugas({ tugas_id, nip, startDate, endDate });
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Post('jurnal')
  @ApiOperation({ summary: 'Tambah atau Ubah Jurnal Tugas Tambahan (milik sendiri)' })
  async upsertJurnal(@Request() req: any, @Body() body: any) {
    const data = await this.tugasTambahanService.upsertJurnalTugas(
      body,
      req.user?.nip || '',
      await this.bolehKelola(req),
    );
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Delete('jurnal')
  @ApiOperation({ summary: 'Hapus Jurnal Tugas Tambahan (milik sendiri)' })
  async deleteJurnal(@Request() req: any, @Query('id') id: string) {
    return await this.tugasTambahanService.deleteJurnalTugas(
      id,
      req.user?.nip || '',
      await this.bolehKelola(req),
    );
  }
}
