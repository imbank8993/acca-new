import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';
import {
  LIBUR_ACCESS_KEY,
  FeatureAccessGuard,
  aksesDiizinkan,
} from '../auth/feature-access.guard';
import { LiburService } from './libur.service';

/** Role yang melekat di kode sebagai pengelola kalender libur. */
const ROLE_PENGELOLA_LIBUR = ['ADMIN', 'ADMINISTRATOR', 'OP_JURNAL'];

/** Capability granular yang juga memberi hak tulis, bila di-grant per user/role. */
const CAP_LIBUR = ['pengaturan_data:libur', 'pengaturan_data.libur'];

/**
 * Kalender hari libur madrasah.
 *
 * Membaca terbuka untuk semua yang login — dropdown & kalender di banyak
 * halaman (Jurnal, Jadwal, Absensi, Guru Asuh, Wali Kelas) bergantung padanya.
 * MENULIS dibatasi `assertCanWrite`: role bawaan, pemegang capability granular,
 * atau ditunjuk lewat Pengaturan Users → Hak Akses Fitur (libur_access_config).
 */
@ApiTags('Libur')
@ApiBearerAuth()
@Controller(['libur', 'jadwal/libur'])
export class LiburController {
  constructor(
    private readonly liburService: LiburService,
    private readonly accessService: AccessService,
    private readonly featureAccess: FeatureAccessGuard,
  ) {}

  /**
   * Pengelola libur bukan satu role tunggal. Daftarnya disamakan dengan yang
   * dipakai UI (halaman Agenda → tab Data Libur): role bawaan di
   * ROLE_PENGELOLA_LIBUR, pemegang capability granular `pengaturan_data:libur`,
   * atau ditunjuk admin lewat Pengaturan Users → Hak Akses Fitur.
   */
  private async assertCanWrite(req: any) {
    const konfig = await this.featureAccess.bacaKonfigurasi(LIBUR_ACCESS_KEY);
    if (aksesDiizinkan(req.user, konfig, ['OP_JURNAL'])) return;

    const access = await this.accessService.resolveUserAccess(req.user);

    const punyaRole = access.roles.some((r) =>
      ROLE_PENGELOLA_LIBUR.includes(r.toUpperCase()),
    );
    if (punyaRole) return;

    const punyaCap = (access.caps || []).some((c) => CAP_LIBUR.includes(c));
    if (punyaCap) return;

    throw new ForbiddenException('Anda tidak memiliki izin mengubah data hari libur');
  }

  @Get('izin-saya')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cek izin kelola hari libur' })
  async getIzinSaya(@Request() req: any) {
    const konfig = await this.featureAccess.bacaKonfigurasi(LIBUR_ACCESS_KEY);
    const bolehKelola = aksesDiizinkan(req.user, konfig, ['OP_JURNAL']);
    return { success: true, data: { bolehKelola } };
  }

  @Get()
  @ApiOperation({ summary: 'Daftar hari libur madrasah' })
  async getLibur(
    @Query('q') q?: string,
    @Query('tahun') tahun?: string,
    @Query('tahun_ajaran') tahun_ajaran?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    return this.liburService.getLibur({ q, tahun, tahun_ajaran, start, end, limit });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tambah data hari libur' })
  async createLibur(@Request() req: any, @Body() body: any) {
    await this.assertCanWrite(req);
    return this.liburService.createLibur(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update data hari libur per id di URL' })
  async updateLiburParam(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    await this.assertCanWrite(req);
    return this.liburService.updateLibur(id, body);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update data hari libur per id di body' })
  async updateLiburBody(@Request() req: any, @Body() body: any) {
    await this.assertCanWrite(req);
    return this.liburService.updateLibur(body.id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hapus data hari libur per id di URL' })
  async deleteLiburParam(@Request() req: any, @Param('id') id: string) {
    await this.assertCanWrite(req);
    return this.liburService.deleteLibur(id);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hapus data hari libur per query id atau ids' })
  async deleteLiburQuery(
    @Request() req: any,
    @Query('id') id?: string,
    @Query('ids') ids?: string,
  ) {
    await this.assertCanWrite(req);
    return this.liburService.deleteLibur(id, ids);
  }
}
