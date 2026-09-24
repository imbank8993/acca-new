import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SiswaService } from './siswa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';

/**
 * Guard dipasang di tingkat kelas, bukan per method.
 *
 * Sebelumnya tiap route memasang `@UseGuards` sendiri dan `by-kelas` terlewat —
 * 4 route, 3 guard — sehingga daftar siswa per kelas bisa diambil tanpa login
 * sama sekali (tidak ada guard autentikasi global di aplikasi ini; satu-satunya
 * APP_GUARD adalah ThrottlerGuard). Dengan guard di kelas, route baru ikut
 * terlindungi secara bawaan alih-alih menunggu diingat.
 *
 * Panggilan antar-service dengan `x-internal-key` tetap lewat: JwtAuthGuard
 * sudah mengizinkannya.
 */
@ApiTags('Data Siswa')
@Controller('siswa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SiswaController {
  constructor(
    private readonly siswaService: SiswaService,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Data induk siswa memuat NIK, tanggal lahir, nama dan nomor HP orang tua,
   * serta alamat rumah. Hanya pemegang halaman `master` yang menerimanya utuh;
   * sisanya cukup nisn/nama/gender — cocok dengan aturan di `/master/siswa`.
   */
  private async canReadSensitive(req: any): Promise<boolean> {
    // Pemanggilan antar-service (x-internal-key) tidak punya req.user.
    if (!req?.user) return false;
    const access = await this.accessService.resolveUserAccess(req.user);
    const isAdmin = access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
    return isAdmin || access.pageIds.includes('master');
  }

  @Get()
  @ApiOperation({ summary: 'Mendapatkan daftar siswa dari PostgreSQL VPS (dengan pencarian & paginasi)' })
  @ApiQuery({ name: 'search', required: false, description: 'Cari berdasarkan Nama/NISN/NIK' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Daftar siswa berhasil didapatkan' })
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.siswaService.findAll(search, page, limit, await this.canReadSensitive(req));
  }

  @Get(':nisn/kelas')
  @ApiOperation({ summary: 'Mendapatkan daftar kelas siswa berdasarkan NISN' })
  async getStudentClasses(@Param('nisn') nisn: string) {
    return this.siswaService.getStudentClasses(nisn);
  }

  @Get(':nisn')
  @ApiOperation({ summary: 'Mendapatkan detail siswa berdasarkan NISN' })
  @ApiResponse({ status: 200, description: 'Detail siswa ditemukan' })
  @ApiResponse({ status: 404, description: 'Siswa tidak ditemukan' })
  async findByNisn(@Request() req: any, @Param('nisn') nisn: string) {
    return this.siswaService.findByNisn(nisn, await this.canReadSensitive(req));
  }

  @Get('by-kelas/:kelas')
  @ApiOperation({ summary: 'Mendapatkan daftar siswa berdasarkan kelas' })
  async getSiswaByKelas(
    @Param('kelas') kelas: string,
    @Query('tahun_ajaran') tahunAjaran?: string,
    @Query('semester') semester?: string,
  ) {
    return this.siswaService.getSiswaByKelas(kelas, tahunAjaran, semester);
  }
}

