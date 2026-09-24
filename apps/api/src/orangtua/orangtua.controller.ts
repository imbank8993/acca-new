import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  aksesDiizinkan,
  parseKonfigurasiAkses,
  PENGATURAN_DATA_ACCESS_KEYS,
} from '../auth/feature-access.guard';
import { OrangtuaService } from './orangtua.service';

@ApiTags('Orang Tua & Siswa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orangtua')
export class OrangtuaController {
  constructor(
    private readonly orangtuaService: OrangtuaService,
    private readonly accessService: AccessService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Gerbang tab "Relasi Orang Tua" di halaman Pengaturan Data.
   *
   * Dulu memakai `access.pageIds.includes('pengaturan-data')`, yaitu tabel
   * `role_pages` — yang mengatur NAVIGASI, bukan wewenang. Pola yang sama sudah
   * dicabut dari Master Data: memberi halaman kepada sebuah role di tab "Akses per
   * Role" seharusnya tidak sekaligus memberi izin membaca dan mengubah seluruh
   * relasi orang tua–siswa.
   *
   * Sekarang: role ADMIN (melekat di kode, tidak bisa dicabut), atau ditunjuk di
   * Pengaturan Users -> Hak Akses Fitur ("Pengaturan Data: Relasi Orang Tua").
   *
   * Satu gerbang untuk baca DAN tulis. Sebelumnya tiga aksi tulisnya memakai
   * `adminOnly`, sehingga menunjuk seseorang di Hak Akses Fitur hanya memberinya
   * hak melihat — menambah, mengubah, dan menghapus relasi tetap milik ADMIN
   * sendiri, dan pencarian siswa untuk form tambahnya pun ditolak. Itu membuat
   * penunjukannya hampir tidak berguna, padahal seluruh halaman ini justru
   * dirancang supaya pengelola tiap tab ditentukan dari layar itu.
   *
   * Tidak ada aksi di sini yang perlu dikecualikan: semuanya berdampak satu baris
   * dan bisa dipulihkan dengan menautkan ulang — tidak seperti mutasi jenis
   * pegawai atau pengosongan tabel di Master Data, yang memang tetap khusus ADMIN.
   */
  private async requireAccess(req: any) {
    const [access, row] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.prisma.site_settings.findUnique({
        where: { key: PENGATURAN_DATA_ACCESS_KEYS.relasi_ortu },
        select: { value: true },
      }),
    ]);

    if (!aksesDiizinkan({ ...req.user, roles: access.roles }, parseKonfigurasiAkses(row?.value))) {
      throw new ForbiddenException(
        'Anda tidak berwenang atas data ini. Minta Admin menunjuk akun/role Anda di Hak Akses Fitur.',
      );
    }
  }

  @Get('anak')
  @ApiOperation({ summary: 'Daftar anak yang diklaim orang tua yang login' })
  async listAnak(@Request() req: any) {
    return { ok: true, data: await this.orangtuaService.listAnak(req.user) };
  }

  @Get('anak/:nisn')
  @ApiOperation({ summary: 'Detail satu anak (hanya untuk orang tua yang mengklaimnya)' })
  async detailAnak(@Request() req: any, @Param('nisn') nisn: string) {
    return { ok: true, data: await this.orangtuaService.getAnakDetail(req.user, nisn) };
  }

  @Post('anak')
  @ApiOperation({ summary: 'Klaim anak tambahan dari dashboard orang tua' })
  async claimAnak(
    @Request() req: any,
    @Body() body: { nisn: string; tanggal_lahir_siswa: string; status_keluarga: string },
  ) {
    return { ok: true, ...(await this.orangtuaService.claimAnak(req.user, body)) };
  }

  @Get('relasi')
  @ApiOperation({ summary: 'Seluruh relasi orang tua–siswa, atau cari siswa (?siswa=)' })
  async listRelasi(@Request() req: any, @Query('siswa') siswa?: string) {
    await this.requireAccess(req);

    // `String(...)` bukan `siswa || ''`: Express mem-parsing query dengan `qs`,
    // jadi `?siswa[contains]=a` tiba sebagai objek dan `.replace` di atasnya
    // melempar TypeError — keluar sebagai 500, bukan sebagai masukan yang ditolak.
    const query = String(siswa ?? '').replace(/[,()]/g, ' ').trim();
    if (query) {
      // Pencarian siswa dipakai form tambah relasi, jadi wewenangnya sama dengan
      // wewenang menambah relasi itu sendiri — bukan ADMIN saja.
      return { ok: true, data: await this.orangtuaService.searchSiswa(query) };
    }

    return { ok: true, ...(await this.orangtuaService.listRelasi()) };
  }

  @Post('relasi')
  @ApiOperation({ summary: 'Pengelola menautkan siswa ke akun orang tua' })
  async addRelasi(
    @Request() req: any,
    @Body() body: { user_id: number; nisn: string; status_keluarga: string },
  ) {
    await this.requireAccess(req);
    return { ok: true, ...(await this.orangtuaService.addRelasi(body)) };
  }

  @Patch('relasi')
  @ApiOperation({ summary: 'Ubah status keluarga sebuah relasi' })
  async updateRelasi(@Request() req: any, @Body() body: { id: string; status_keluarga: string }) {
    await this.requireAccess(req);
    return {
      ok: true,
      ...(await this.orangtuaService.updateRelasi(
        String(body.id || '').trim(),
        String(body.status_keluarga || '').trim(),
      )),
    };
  }

  @Delete('relasi')
  @ApiOperation({ summary: 'Hapus relasi (akun orang tuanya tetap ada)' })
  async deleteRelasi(@Request() req: any, @Query('id') id: string) {
    await this.requireAccess(req);
    return { ok: true, ...(await this.orangtuaService.deleteRelasi(String(id ?? '').trim())) };
  }
}
